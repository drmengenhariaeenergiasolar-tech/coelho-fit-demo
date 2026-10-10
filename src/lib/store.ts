import { QUOTE_BUSINESS, type Quote, type QuoteLine } from "./quotation.ts";
export type Category = "Máquinas" | "Acessórios" | "Suplementos";
export type Product = { id: string; name: string; sku: string; barcode?: string; category: Category; cost: number; price: number; minimum: number; active: boolean };
export type Contact = { id: string; name: string; phone: string; kind: "Cliente" | "Fornecedor" };
export type Lot = { id: string; productId: string; code: string; expiry: string; quantity: number; initial: number; cost: number; orderId?: string };
export type Allocation = { lotId: string; quantity: number };
export type Line = { productId: string; name: string; quantity: number; unitPrice: number; lot: string; expiry: string; allocations?: Allocation[]; lotId?: string };
export type Order = { id: string; number: string; kind: "sale" | "purchase"; status: "pending" | "completed" | "cancelled"; party: string; date: string; due: string; notes: string; lines: Line[]; discount: number; total: number; createdAt: string; completedAt?: string };
export type Cash = { id: string; direction: "in" | "out"; amount: number; date: string; method: string; description: string; orderId?: string; reversedBy?: string; reversalOf?: string };
export type Movement = { id: string; productId: string; quantity: number; date: string; reason: string; orderId?: string };
export type Store = { company: string; products: Product[]; contacts: Contact[]; lots: Lot[]; orders: Order[]; quotes: Quote[]; cash: Cash[]; movements: Movement[]; processed: string[] };
export type Action = { type: string; payload: Record<string, any>; requestId: string };
export function emptyStore(): Store { return { company: "CoelhoFit", products: [], contacts: [], lots: [], orders: [], quotes: [], cash: [], movements: [], processed: [] }; }
export function normalizeStore(s: Store): Store { s.quotes ??= []; if (s.company === "Minha loja fitness") s.company = "CoelhoFit"; return s; }
export const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const id = () => crypto.randomUUID();
function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
const text = (v: unknown, max = 200) => String(v ?? "").trim().slice(0, max);
const integer = (v: unknown, min = 0) => { const n = Number(v); assert(Number.isSafeInteger(n) && n >= min && n <= 100000000000, "Quantidade ou valor inválido."); return n; };
function date(v: unknown, optional = false): string { const d = text(v, 10); if (optional && !d) return ""; assert(/^\d{4}-\d{2}-\d{2}$/.test(d) && new Date(d + "T12:00:00Z").toISOString().slice(0, 10) === d, "Data inválida."); return d; }
const product = (s: Store, pid: unknown) => { const p = s.products.find(p => p.id === pid); assert(p, "Produto não encontrado."); return p; };
const order = (s: Store, oid: unknown) => { const o = s.orders.find(o => o.id === oid); assert(o, "Pedido não encontrado."); return o; };
export function findByBarcode(s: Store, code: string) { const value = code.trim(); return value ? s.products.find(p => p.barcode === value) : undefined; }
function nextProductSku(s: Store): string {
  let last = 0;
  for (const p of s.products) {
    const match = /^COE(\d+)$/i.exec(p.sku);
    if (!match) continue;
    const number = Number(match[1]);
    assert(Number.isSafeInteger(number) && number < Number.MAX_SAFE_INTEGER, "Limite da sequência de códigos atingido.");
    last = Math.max(last, number);
  }
  return `COE${String(last + 1).padStart(4, "0")}`;
}
export function stock(s: Store, pid: string, usable = false) { return s.lots.filter(l => l.productId === pid && (!usable || !l.expiry || l.expiry >= today())).reduce((a, l) => a + l.quantity, 0); }
export function paid(s: Store, o: Order) { return s.cash.filter(c => c.orderId === o.id).reduce((a, c) => a + ((c.direction === "in") === (o.kind === "sale") ? c.amount : -c.amount), 0); }
function allocate(s: Store, pid: string, quantity: number, includeExpired = false): Allocation[] {
  const p = product(s, pid);
  const lots = s.lots.filter(l => l.productId === pid && l.quantity > 0 && (includeExpired || !l.expiry || l.expiry >= today())).sort((a, b) => (a.expiry || "9999").localeCompare(b.expiry || "9999"));
  assert(lots.reduce((n, l) => n + l.quantity, 0) >= quantity, `Estoque disponível insuficiente para ${p.name}. Lotes vencidos não podem ser vendidos.`);
  let remaining = quantity; const allocations: Allocation[] = [];
  for (const lot of lots) { const q = Math.min(remaining, lot.quantity); if (!q) continue; lot.quantity -= q; allocations.push({ lotId: lot.id, quantity: q }); remaining -= q; if (!remaining) break; }
  return allocations;
}
function addCash(s: Store, input: Partial<Cash>) {
  const amount = integer(input.amount, 1); const method = text(input.method, 30);
  assert(["Pix", "Dinheiro", "Cartão", "Transferência", "Outro"].includes(method), "Selecione a forma de pagamento.");
  const c: Cash = { id: id(), amount, method, direction: input.direction === "in" ? "in" : "out", description: text(input.description), date: date(input.date), orderId: input.orderId, reversalOf: input.reversalOf };
  assert(c.date <= today(), "Pagamentos futuros devem permanecer em contas a receber ou a pagar.");
  assert(c.description, "Informe a descrição do lançamento."); s.cash.push(c); return c;
}
function complete(s: Store, o: Order, payment: any) {
  assert(o.status === "pending", "Somente pedidos pendentes podem ser concluídos.");
  assert(o.date <= today(), "Um pedido com data futura deve permanecer pendente.");
  for (const line of o.lines) {
    const p = product(s, line.productId); assert(p.active, `${p.name} está inativo.`);
    if (o.kind === "sale") line.allocations = allocate(s, p.id, line.quantity);
    else {
      if (p.category === "Suplementos") assert(line.lot && line.expiry, `Informe lote e validade de ${p.name}.`);
      assert(!line.expiry || line.expiry >= today(), "Não é possível receber um lote vencido.");
      const lid = id(); line.lotId = lid;
      s.lots.push({ id: lid, productId: p.id, code: line.lot || `ENT-${o.number}`, expiry: line.expiry, quantity: line.quantity, initial: line.quantity, cost: line.unitPrice, orderId: o.id });
    }
    s.movements.push({ id: id(), productId: p.id, quantity: o.kind === "sale" ? -line.quantity : line.quantity, date: today(), reason: `${o.kind === "sale" ? "Venda" : "Recebimento"} ${o.number}`, orderId: o.id });
  }
  o.status = "completed"; o.completedAt = new Date().toISOString();
  if (payment?.amount) payOrder(s, o, payment);
}
function payOrder(s: Store, o: Order, p: any) {
  assert(o.status === "completed", "Conclua o pedido antes de registrar pagamentos.");
  const amount = integer(p.amount, 1); assert(amount <= o.total - paid(s, o), "O pagamento ultrapassa o saldo pendente.");
  addCash(s, { amount, method: p.method, date: p.date || today(), direction: o.kind === "sale" ? "in" : "out", description: `${o.kind === "sale" ? "Recebimento" : "Pagamento"} ${o.number} · ${o.party}`, orderId: o.id });
}
export function applyAction(original: Store, action: Action): Store {
  assert(action && typeof action.type === "string" && typeof action.requestId === "string" && action.requestId.length >= 16, "Solicitação inválida.");
  if (original.processed.includes(action.requestId)) return original;
  const s: Store = normalizeStore(structuredClone(original)); const p = action.payload || {};
  switch (action.type) {
    case "quote": {
      const current = p.id ? s.quotes.find(q => q.id === p.id) : undefined;
      if (p.id) { assert(current, "Orçamento não encontrado."); assert(p.expectedVersion === current.version, "Este orçamento foi atualizado em outro dispositivo. Feche e abra novamente antes de editar."); }
      assert(["open", "approved", "declined"].includes(p.status), "Situação do orçamento inválida.");
      assert(Array.isArray(p.lines) && p.lines.length > 0 && p.lines.length <= 100, "Adicione de 1 a 100 itens ao orçamento.");
      const lines: QuoteLine[] = p.lines.map((l: any) => {
        const prod = product(s, l.productId); const savedLine = current?.lines.find(v => v.productId === prod.id);
        assert(prod.active || savedLine, "Selecione um produto ativo.");
        return { productId: prod.id, sku: savedLine?.sku || prod.sku, name: savedLine?.name || prod.name, quantity: integer(l.quantity, 1), unitPrice: integer(l.unitPrice) };
      });
      const subtotal = lines.reduce((n, l) => n + l.quantity * l.unitPrice, 0);
      assert(Number.isSafeInteger(subtotal), "Valor do orçamento inválido.");
      const discount = integer(p.discount), shipping = integer(p.shipping); assert(discount <= subtotal, "O desconto ultrapassa o valor dos itens.");
      const total = subtotal - discount + shipping; assert(Number.isSafeInteger(total), "Valor total inválido.");
      const party = text(p.party); assert(party, "Informe o nome do cliente.");
      const issued = date(p.date), validUntil = date(p.validUntil); assert(validUntil >= issued, "A validade deve ser igual ou posterior à data do orçamento.");
      const last = s.quotes.reduce((n, q) => Math.max(n, Number(/^ORC-(\d+)$/.exec(q.number)?.[1] || 0)), 0);
      assert(Number.isSafeInteger(last + 1), "Limite de numeração de orçamentos atingido.");
      const timestamp = new Date().toISOString();
      const value: Quote = { ...QUOTE_BUSINESS, id: current?.id || id(), number: current?.number || `ORC-${String(last + 1).padStart(4, "0")}`, version: (current?.version || 0) + 1, status: p.status, party, phone: text(p.phone, 40), customerAddress: text(p.customerAddress, 300), date: issued, validUntil, lines, discount, shipping, total, paymentTerms: text(p.paymentTerms, 1000), deliveryTerms: text(p.deliveryTerms, 1000), notes: text(p.notes, 2000), createdAt: current?.createdAt || timestamp, updatedAt: timestamp };
      if (current) { value.company = current.company; value.address = current.address; value.postalCode = current.postalCode; value.responsible = current.responsible; Object.assign(current, value); } else s.quotes.push(value);
      break;
    }
    case "settings": s.company = text(p.company, 80); assert(s.company, "Informe o nome da empresa."); break;
    case "product": {
      const current = p.id ? product(s, p.id) : undefined;
      const category = text(p.category) as Category; assert(["Máquinas", "Acessórios", "Suplementos"].includes(category), "Categoria inválida.");
      const name = text(p.name); assert(name, "Informe o nome do produto.");
      const sku = current ? current.sku : nextProductSku(s);
      const rawBarcode = p.barcode === undefined ? (current?.barcode || "") : p.barcode;
      assert(typeof rawBarcode === "string", "Informe o código de barras como texto.");
      const barcode = rawBarcode.trim();
      assert(barcode.length <= 80 && (!barcode || /^[ -~]+$/.test(barcode)), "Código de barras inválido. Use até 80 caracteres, sem quebras de linha.");
      assert(!barcode || !s.products.some(x => x.id !== current?.id && x.barcode === barcode), "Esse código de barras já está vinculado a outro produto.");
      assert(!s.products.some(x => x.id !== current?.id && x.sku.toLowerCase() === sku.toLowerCase()), "Esse código de produto já está cadastrado.");
      if (current && current.category !== category) assert(!s.lots.some(l => l.productId === current.id), "A categoria não pode mudar após movimentação de estoque.");
      const value: Product = { id: current?.id || id(), name, sku, barcode, category, cost: integer(p.cost), price: integer(p.price), minimum: integer(p.minimum), active: p.active !== false };
      if (current) Object.assign(current, value); else s.products.push(value); break;
    }
    case "contact": {
      assert(["Cliente", "Fornecedor"].includes(p.kind), "Tipo de contato inválido."); const name = text(p.name); assert(name, "Informe o nome.");
      const c = p.id ? s.contacts.find(c => c.id === p.id) : undefined; if (p.id) assert(c, "Contato não encontrado.");
      const value: Contact = { id: c?.id || id(), name, phone: text(p.phone, 40), kind: p.kind }; if (c) Object.assign(c, value); else s.contacts.push(value); break;
    }
    case "order": {
      assert(["sale", "purchase"].includes(p.kind), "Tipo de pedido inválido."); assert(Array.isArray(p.lines) && p.lines.length > 0 && p.lines.length <= 100, "Adicione ao menos um item ao pedido.");
      const lines: Line[] = p.lines.map((l: any) => { const prod = product(s, l.productId); assert(prod.active, "Selecione um produto ativo."); return { productId: prod.id, name: prod.name, quantity: integer(l.quantity, 1), unitPrice: integer(l.unitPrice), lot: text(l.lot, 100), expiry: date(l.expiry, true) }; });
      const subtotal = lines.reduce((v, l) => v + l.quantity * l.unitPrice, 0); assert(Number.isSafeInteger(subtotal), "Valor do pedido inválido.");
      const discount = integer(p.discount); assert(discount <= subtotal, "O desconto ultrapassa o valor do pedido."); const party = text(p.party); assert(party, "Informe cliente ou fornecedor.");
      const count = s.orders.filter(o => o.kind === p.kind).length + 1;
      const o: Order = { id: id(), number: `${p.kind === "sale" ? "V" : "C"}-${String(count).padStart(4, "0")}`, kind: p.kind, status: "pending", party, date: date(p.date), due: date(p.due, true), notes: text(p.notes, 1000), lines, discount, total: subtotal - discount, createdAt: new Date().toISOString() };
      s.orders.push(o); if (p.complete) complete(s, o, p.payment); break;
    }
    case "complete": complete(s, order(s, p.id), p.payment); break;
    case "payment": payOrder(s, order(s, p.id), p); break;
    case "cancel": {
      const o = order(s, p.id); assert(o.status !== "cancelled", "Pedido já cancelado.");
      if (o.status === "completed") {
        for (const line of o.lines) {
          if (o.kind === "purchase") { const lot = s.lots.find(l => l.id === line.lotId); assert(lot && lot.quantity === lot.initial, "Essa compra teve itens vendidos ou ajustados. Não é possível cancelar."); lot.quantity = 0; }
          else for (const a of line.allocations || []) { const lot = s.lots.find(l => l.id === a.lotId); assert(lot, "Lote original não encontrado."); lot.quantity += a.quantity; }
          s.movements.push({ id: id(), productId: line.productId, quantity: o.kind === "sale" ? line.quantity : -line.quantity, date: today(), reason: `Cancelamento ${o.number}`, orderId: o.id });
        }
        for (const c of s.cash.filter(c => c.orderId === o.id && !c.reversalOf && !c.reversedBy)) { const reverse = addCash(s, { ...c, date: today(), direction: c.direction === "in" ? "out" : "in", description: `Estorno ${o.number}`, reversalOf: c.id }); c.reversedBy = reverse.id; }
      }
      o.status = "cancelled"; break;
    }
    case "adjust": {
      const prod = product(s, p.productId); const q = integer(p.quantity, 1); const reason = text(p.reason); assert(reason.length >= 3, "Informe o motivo do ajuste.");
      assert(p.direction === "in" || p.direction === "out", "Direção inválida.");
      if (p.direction === "in") { const expiry = date(p.expiry, true); const code = text(p.lot, 100); if (prod.category === "Suplementos") assert(expiry && code, "Suplementos precisam de lote e validade.");
        s.lots.push({ id: id(), productId: prod.id, code: code || "Ajuste inicial", expiry, quantity: q, initial: q, cost: prod.cost });
      } else allocate(s, prod.id, q, true);
      s.movements.push({ id: id(), productId: prod.id, quantity: p.direction === "in" ? q : -q, date: today(), reason }); break;
    }
    case "cash": assert(p.direction === "in" || p.direction === "out", "Direção inválida."); addCash(s, { amount: p.amount, direction: p.direction, date: p.date, method: p.method, description: p.description }); break;
    case "reverseCash": {
      const c = s.cash.find(c => c.id === p.id); assert(c && !c.orderId && !c.reversalOf && !c.reversedBy, "Esse lançamento não pode ser estornado por aqui.");
      const reverse = addCash(s, { ...c, direction: c.direction === "in" ? "out" : "in", date: today(), description: `Estorno · ${c.description}`, reversalOf: c.id }); c.reversedBy = reverse.id; break;
    }
    default: throw new Error("Operação desconhecida.");
  }
  s.processed.push(action.requestId); if (s.processed.length > 5000) s.processed = s.processed.slice(-5000);
  return s;
}
