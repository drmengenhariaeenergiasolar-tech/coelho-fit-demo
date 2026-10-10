import { quoteDate, quoteMoney, type Quote } from "./quotation.ts";

// The locally vendored, MIT-licensed PDF library is loaded only on export.
type PdfLibrary = { PDFDocument: any; StandardFonts: Record<string, string>; rgb: (r: number, g: number, b: number) => any };
let libraryPromise: Promise<PdfLibrary> | undefined;
function loadPdfLibrary(): Promise<PdfLibrary> {
  const getLibrary = () => (window as Window & { PDFLib?: PdfLibrary }).PDFLib;
  if (getLibrary()) return Promise.resolve(getLibrary()!);
  if (!libraryPromise) libraryPromise = new Promise<PdfLibrary>((resolve, reject) => {
    const script = document.createElement("script"); script.src = "./vendor/pdf-lib-1.17.1.min.js"; script.async = true;
    script.onload = () => { const lib = getLibrary(); if (lib) resolve(lib); else { libraryPromise = undefined; script.remove(); reject(new Error("Não foi possível iniciar o PDF. Tente novamente.")); } };
    script.onerror = () => { libraryPromise = undefined; script.remove(); reject(new Error("Não foi possível carregar o PDF. Verifique a conexão e tente novamente.")); };
    document.head.appendChild(script);
  });
  return libraryPromise;
}

export async function downloadQuotePdf(quote: Quote) {
  const [lib, response] = await Promise.all([loadPdfLibrary(), fetch("./coelhofit-logo-hd.png")]);
  if (!response.ok) throw new Error("Não foi possível carregar a logo do orçamento.");
  const bytes = await buildQuotePdf(quote, lib, new Uint8Array(await response.arrayBuffer()));
  const url = URL.createObjectURL(new Blob([new Uint8Array(bytes).buffer], { type: "application/pdf" }));
  const link = document.createElement("a"); link.href = url; link.download = `CoelhoFit-Orcamento-${quote.number}.pdf`; document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

export async function buildQuotePdf(q: Quote, lib: PdfLibrary, logoBytes: Uint8Array): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = lib;
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica), bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const logo = await pdf.embedPng(logoBytes);
  const navy = rgb(32 / 255, 52 / 255, 91 / 255), green = rgb(67 / 255, 137 / 255, 80 / 255);
  const ink = rgb(.14, .20, .30), muted = rgb(.40, .46, .55), pale = rgb(.94, .96, .97), line = rgb(.87, .90, .92), white = rgb(1, 1, 1);
  const W = 595.28, H = 841.89, left = 42, right = W - left, width = right - left;
  let page: any, top = 0;
  const safe = (value: string, font = regular) => Array.from(String(value)).map(c => { if (c === "\n") return c; try { font.encodeText(c); return c; } catch { return "?"; } }).join("");
  function text(value: string, x: number, t: number, size = 10, font = regular, color = ink, align = "left", maxWidth = Infinity) {
    const content = safe(value, font), originalWidth = font.widthOfTextAtSize(content, size);
    if (originalWidth > maxWidth) size *= maxWidth / originalWidth;
    const measured = font.widthOfTextAtSize(content, size);
    page.drawText(content, { x: align === "right" ? x - measured : x, y: H - t - size, size, font, color });
  }
  function rect(x: number, t: number, w: number, h: number, color: any) { page.drawRectangle({ x, y: H - t - h, width: w, height: h, color }); }
  function rule(t: number) { page.drawLine({ start: { x: left, y: H - t }, end: { x: right, y: H - t }, thickness: .65, color: line }); }
  function wrap(value: string, max: number, size = 10, font = regular): string[] {
    const output: string[] = [];
    for (const paragraph of safe(value, font).split("\n")) {
      let current = "";
      for (const word of paragraph.split(/\s+/).filter(Boolean)) {
        if (font.widthOfTextAtSize(word, size) > max) {
          if (current) { output.push(current); current = ""; }
          for (const ch of word) { if (font.widthOfTextAtSize(current + ch, size) > max && current) { output.push(current); current = ""; } current += ch; }
        } else if (current && font.widthOfTextAtSize(current + " " + word, size) > max) { output.push(current); current = word; }
        else current = current ? current + " " + word : word;
      }
      output.push(current);
    }
    return output;
  }
  function newPage(continued = false) {
    page = pdf.addPage([W, H]);
    if (continued) {
      rect(24, 24, W - 48, 66, navy);
      page.drawImage(logo, { x: left, y: H - 33 - 48, width: 128, height: 48 });
      text("ORÇAMENTO", right, 39, 15, bold, white, "right");
      text(q.number + " | Continuação", right, 62, 9, regular, white, "right"); top = 113;
    } else {
      rect(24, 24, W - 48, 133, navy);
      page.drawImage(logo, { x: 38, y: H - 35 - 78, width: 208, height: 78 });
      text("ORÇAMENTO", right, 43, 20, bold, white, "right");
      text(q.number, right, 74, 12, bold, rgb(.60, .84, .57), "right");
      text("Equipamentos, acessórios e suplementos", right, 102, 8, regular, white, "right");
      text(q.address, left, 124, 9, regular, white);
      text("CEP " + q.postalCode, left, 139, 9, regular, white); top = 174;
    }
  }
  newPage();
  text("PROPOSTA COMERCIAL", left, top, 11, bold, green);
  text("Emissão: " + quoteDate(q.date), right, top, 10, regular, muted, "right"); top += 18;
  text(q.id === "model" ? "Modelo para preenchimento" : "Validade: " + quoteDate(q.validUntil), right, top, 10, bold, ink, "right");
  const nameLines = wrap(q.party, width - 28, 12, bold), addressLines = q.customerAddress ? wrap(q.customerAddress, width - 28, 10) : [];
  top += 24; const customerHeight = 35 + nameLines.length * 15 + (q.phone ? 14 : 0) + addressLines.length * 12;
  rect(left, top, width, customerHeight, pale); text("CLIENTE", left + 14, top + 12, 8, bold, muted);
  let detailTop = top + 28;
  for (const row of nameLines) { text(row, left + 14, detailTop, 12, bold); detailTop += 15; }
  if (q.phone) { text("Contato: " + q.phone, left + 14, detailTop, 10); detailTop += 14; }
  for (const row of addressLines) { text(row, left + 14, detailTop, 10, regular, muted); detailTop += 12; }
  top += customerHeight + 16;

  function tableHeader() {
    rect(left, top, width, 27, navy);
    text("ITEM", left + 8, top + 8, 8, bold, white); text("DESCRIÇÃO", 89, top + 8, 8, bold, white);
    text("QTD.", 370, top + 8, 8, bold, white, "right"); text("UNITÁRIO", 453, top + 8, 8, bold, white, "right"); text("TOTAL", right - 8, top + 8, 8, bold, white, "right"); top += 27;
  }
  tableHeader();
  const rows = q.lines.length ? q.lines : Array.from({ length: 4 }, (_, i) => ({ name: i === 0 ? "Descrição do produto" : "", sku: "", quantity: 0, unitPrice: 0 }));
  rows.forEach((item, i) => {
    const name = wrap(item.name, 245, 10), rowHeight = Math.max(34, name.length * 13 + (item.sku ? 13 : 0) + 14);
    if (top + rowHeight > 715) { newPage(true); tableHeader(); }
    if (i % 2 === 0) rect(left, top, width, rowHeight, pale);
    text(String(i + 1).padStart(2, "0"), left + 8, top + 11, 9, regular, muted);
    name.forEach((row, n) => text(row, 89, top + 8 + n * 13, 10));
    if (item.sku) text(item.sku, 89, top + 9 + name.length * 13, 8, regular, muted);
    text(q.id === "model" ? "-" : String(item.quantity), 370, top + 9, 10, regular, ink, "right", 35);
    text(q.id === "model" ? "-" : quoteMoney(item.unitPrice), 453, top + 9, 10, regular, ink, "right", 75);
    text(q.id === "model" ? "-" : quoteMoney(item.quantity * item.unitPrice), right - 8, top + 9, 10, bold, ink, "right", 84); top += rowHeight; rule(top);
  });
  top += 14; if (top + 101 > 755) newPage(true);
  const subtotal = q.lines.reduce((n, l) => n + l.quantity * l.unitPrice, 0);
  for (const [label, amount] of [["Subtotal", subtotal], ["Desconto", q.discount], ["Frete / entrega", q.shipping]] as const) {
    text(label, 350, top, 10, regular, muted); text(q.id === "model" ? "-" : quoteMoney(amount), right - 8, top, 10, regular, ink, "right", 109); top += 17;
  }
  rect(335, top + 3, right - 335, 40, green);
  text("TOTAL", 350, top + 15, 11, bold, white); text(q.id === "model" ? "A preencher" : quoteMoney(q.total), right - 12, top + 13, 15, bold, white, "right", 145); top += 59;

  function section(label: string, value: string) {
    if (!value.trim()) return;
    const body = wrap(value, width, 10);
    if (top + 35 > 755) newPage(true);
    text(label, left, top, 9, bold, green); top += 16;
    for (const row of body) { if (top + 13 > 755) { newPage(true); text(label + " (continuação)", left, top, 9, bold, green); top += 16; } text(row, left, top, 10); top += 13; }
    top += 12;
  }
  section("CONDIÇÕES DE PAGAMENTO", q.paymentTerms || "A combinar.");
  section("ENTREGA OU RETIRADA", q.deliveryTerms || "A combinar.");
  section("OBSERVAÇÕES", q.notes);
  if (top + 47 > 770) newPage(true);
  top += 6; rule(top); text(q.responsible, left, top + 10, 11, bold); text("Responsável pelo orçamento", left, top + 26, 9, regular, muted);
  const pages = pdf.getPages();
  pages.forEach((current: any, i: number) => { page = current; rule(791); text("CoelhoFit | Equipamentos, acessórios e suplementos", left, 802, 8, regular, muted); text(`${i + 1} / ${pages.length}`, right, 802, 8, regular, muted, "right"); });
  pdf.setTitle(`${q.company} - Orçamento ${q.number}`); pdf.setAuthor(q.responsible); pdf.setSubject("Proposta comercial CoelhoFit"); pdf.setCreator("CoelhoFit Gestão");
  return pdf.save();
}
