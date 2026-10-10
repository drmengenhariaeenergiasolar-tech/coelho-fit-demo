"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Download, Eye, FileText, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { today, type Store } from "./lib/store";
import { QUOTE_BUSINESS, quoteDate, quoteModel, quoteMoney, quoteStatus, type Quote, type QuoteStatus } from "./lib/quotation";
import { downloadQuotePdf } from "./lib/quote-pdf";

type ItemDraft = { productId: string; quantity: string; unitPrice: string };
type Draft = { id?: string; expectedVersion?: number; party: string; phone: string; customerAddress: string; date: string; validUntil: string; status: QuoteStatus; discount: string; shipping: string; paymentTerms: string; deliveryTerms: string; notes: string };
const cents = (value: string) => Math.round(Number(value || 0) * 100);
function Field({ label, children, wide = false }: { label: string; children: ReactNode; wide?: boolean }) { return <label className={`field ${wide ? "wide" : ""}`}><span>{label}</span>{children}</label>; }

export function QuoteDocument({ quote: q }: { quote: Quote }) {
  const subtotal = q.lines.reduce((n, l) => n + l.quantity * l.unitPrice, 0);
  return <article className="quote-sheet">
    <header className="quote-paper-header"><img src="./coelhofit-logo-hd.png" alt="CoelhoFit" width={2048} height={768}/><div><h2>ORÇAMENTO</h2><strong>{q.number}</strong><span>Proposta comercial</span></div><p>{q.address}<br/>CEP {q.postalCode}</p></header>
    <div className="quote-paper-content"><div className="quote-dates"><span>Emissão <strong>{quoteDate(q.date)}</strong></span><span>Validade <strong>{quoteDate(q.validUntil)}</strong></span></div>
    <section className="quote-customer"><small>CLIENTE</small><h3>{q.party}</h3>{q.phone && <p>Contato: {q.phone}</p>}{q.customerAddress && <p>{q.customerAddress}</p>}</section>
    <div className="table-wrap"><table className="quote-items-table"><thead><tr><th>Item</th><th>Descrição</th><th>Qtd.</th><th>Unitário</th><th>Total</th></tr></thead><tbody>{q.lines.map((l, i) => <tr key={i}><td>{String(i + 1).padStart(2, "0")}</td><td><strong>{l.name}</strong><small>{l.sku}</small></td><td>{l.quantity}</td><td>{quoteMoney(l.unitPrice)}</td><td><strong>{quoteMoney(l.quantity * l.unitPrice)}</strong></td></tr>)}</tbody></table></div>
    <div className="quote-totals"><div><span>Subtotal</span><strong>{quoteMoney(subtotal)}</strong></div><div><span>Desconto</span><strong>{quoteMoney(q.discount)}</strong></div><div><span>Frete / entrega</span><strong>{quoteMoney(q.shipping)}</strong></div><div className="quote-grand-total"><span>TOTAL</span><strong>{quoteMoney(q.total)}</strong></div></div>
    <section className="quote-terms"><h4>CONDIÇÕES DE PAGAMENTO</h4><p>{q.paymentTerms || "A combinar."}</p><h4>ENTREGA OU RETIRADA</h4><p>{q.deliveryTerms || "A combinar."}</p>{q.notes && <><h4>OBSERVAÇÕES</h4><p>{q.notes}</p></>}</section>
    <footer className="quote-responsible"><strong>{q.responsible}</strong><span>Responsável pelo orçamento</span></footer></div>
  </article>;
}

export default function Quotes({ data, busy, onSave }: { data: Store; busy: boolean; onSave: (type: string, payload: Record<string, any>, close?: boolean) => Promise<boolean | string> }) {
  const [query, setQuery] = useState(""), [filter, setFilter] = useState("all");
  const [mode, setMode] = useState<"edit" | "preview" | null>(null), [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null), [items, setItems] = useState<ItemDraft[]>([]);
  const [exporting, setExporting] = useState(""), [message, setMessage] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const quotes = data.quotes || [], selected = quotes.find(q => q.id === selectedId);
  const subtotal = items.reduce((n, l) => n + Number(l.quantity || 0) * cents(l.unitPrice), 0);
  const total = subtotal - cents(draft?.discount || "") + cents(draft?.shipping || "");
  const currentDate = today();
  const filtered = quotes.filter(q => (q.number + " " + q.party + " " + q.lines.map(l => l.name).join(" ")).toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR")) && (filter === "all" || quoteStatus(q, currentDate) === filter)).slice().reverse();
  const openQuotes = quotes.filter(q => quoteStatus(q, currentDate) === "Em aberto");
  useEffect(() => {
    const element = dialog.current;
    if (mode && element && !element.open) element.showModal();
    if (!mode && element?.open) element.close();
    if (!mode) return;
    const previous = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [mode]);
  function open(q?: Quote) {
    const validity = new Date(currentDate + "T12:00:00Z"); validity.setUTCDate(validity.getUTCDate() + 7);
    setDraft(q ? { ...q, expectedVersion: q.version, discount: String(q.discount / 100), shipping: String(q.shipping / 100) } : { party: "", phone: "", customerAddress: "", date: currentDate, validUntil: validity.toISOString().slice(0, 10), status: "open", discount: "0", shipping: "0", paymentTerms: "A combinar.", deliveryTerms: "A combinar.", notes: "" });
    setItems(q ? q.lines.map(l => ({ productId: l.productId, quantity: String(l.quantity), unitPrice: String(l.unitPrice / 100) })) : [{ productId: "", quantity: "1", unitPrice: "" }]);
    setMessage(""); setMode("edit");
  }
  function update<K extends keyof Draft>(key: K, value: Draft[K]) { setDraft(d => d ? { ...d, [key]: value } : d); }
  function updateItem(index: number, key: keyof ItemDraft, value: string) {
    setItems(old => old.map((l, i) => i !== index ? l : key === "productId" ? { ...l, productId: value, unitPrice: String((data.products.find(p => p.id === value)?.price || 0) / 100) } : { ...l, [key]: value }));
  }
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!draft || busy) return; setMessage("");
    const saved = await onSave("quote", { ...draft, discount: cents(draft.discount), shipping: cents(draft.shipping), lines: items.map(l => ({ productId: l.productId, quantity: Number(l.quantity), unitPrice: cents(l.unitPrice) })) }, false);
    if (saved === true) setMode(null); else setMessage(typeof saved === "string" ? saved : "Não foi possível salvar. Tente novamente.");
  }
  async function exportPdf(q: Quote) {
    if (exporting) return; setExporting(q.id); setMessage("");
    try { await downloadQuotePdf(q); }
    catch (e) { setMessage(e instanceof Error ? e.message : "Não foi possível gerar o PDF. Tente novamente."); }
    finally { setExporting(""); }
  }
  return <>
    <div className="quote-intro"><div><FileText size={22}/><div><strong>Orçamentos com a identidade CoelhoFit</strong><small>Prepare a proposta e baixe o PDF para enviar ao cliente.</small></div></div><div className="quote-actions"><button className="button secondary" disabled={!!exporting} onClick={() => exportPdf(quoteModel(currentDate))}><Download size={16}/>{exporting === "model" ? "Gerando..." : "Baixar modelo"}</button><button className="button" onClick={() => open()}><Plus size={17}/>Novo orçamento</button></div></div>
    <div className="stats-grid quote-stats"><div className="stat accent"><div className="stat-top"><span>Em aberto</span><FileText size={18}/></div><strong>{openQuotes.length.toString().padStart(2, "0")}</strong><small>Dentro do prazo de validade</small></div><div className="stat"><div className="stat-top"><span>Valor em negociação</span></div><strong>{quoteMoney(openQuotes.reduce((n, q) => n + q.total, 0))}</strong><small>Soma dos orçamentos em aberto</small></div><div className="stat"><div className="stat-top"><span>Aprovados</span></div><strong>{quotes.filter(q => q.status === "approved").length.toString().padStart(2, "0")}</strong><small>Propostas aceitas pelo cliente</small></div></div>
    {message && <div className="alert" role="alert">{message}</div>}
    <section className="panel"><div className="toolbar"><div className="search"><Search size={17}/><input aria-label="Pesquisar orçamentos" placeholder="Buscar cliente, número ou produto..." value={query} onChange={e => setQuery(e.target.value)}/></div><select aria-label="Filtrar situação dos orçamentos" value={filter} onChange={e => setFilter(e.target.value)}><option value="all">Todas as situações</option>{["Em aberto", "Aprovado", "Recusado", "Vencido"].map(s => <option key={s}>{s}</option>)}</select></div>
    {filtered.length ? <div className="table-wrap"><table><thead><tr><th>Orçamento / cliente</th><th>Emissão</th><th>Validade</th><th>Situação</th><th>Total</th><th>Ações</th></tr></thead><tbody>{filtered.map(q => <tr key={q.id}><td><strong>{q.party}</strong><small>{q.number}</small></td><td>{quoteDate(q.date)}</td><td>{quoteDate(q.validUntil)}</td><td><span className={`badge ${q.status === "approved" ? "green" : q.status === "declined" ? "rose" : quoteStatus(q, currentDate) === "Vencido" ? "amber" : "neutral"}`}>{quoteStatus(q, currentDate)}</span></td><td><strong>{quoteMoney(q.total)}</strong></td><td><div className="quote-row-actions"><button className="icon-button" aria-label={`Visualizar ${q.number}`} title="Visualizar orçamento" onClick={() => { setSelectedId(q.id); setMessage(""); setMode("preview"); }}><Eye size={17}/></button><button className="icon-button" aria-label={`Editar ${q.number}`} title="Editar orçamento" onClick={() => open(q)}><Pencil size={16}/></button><button className="text-button" disabled={!!exporting} aria-label={`Baixar PDF de ${q.number}`} onClick={() => exportPdf(q)}><Download size={15}/>{exporting === q.id ? "Gerando..." : "PDF"}</button></div></td></tr>)}</tbody></table></div> : <div className="empty"><div className="empty-icon"><FileText size={26}/></div><strong>{quotes.length ? "Nenhum orçamento encontrado" : "Sua próxima venda começa com uma boa proposta"}</strong><p>{quotes.length ? "Ajuste a busca ou o filtro para encontrar o orçamento." : "Selecione os produtos, personalize as condições e envie um PDF com a marca da loja."}</p>{!quotes.length && <button className="button small" onClick={() => open()}><Plus size={15}/>Criar primeiro orçamento</button>}</div>}</section>
    <div className="quote-business-card"><strong>{QUOTE_BUSINESS.company}</strong><span>{QUOTE_BUSINESS.address} · CEP {QUOTE_BUSINESS.postalCode}</span><span>Responsável: {QUOTE_BUSINESS.responsible}</span></div>
    <dialog ref={dialog} className={`quote-dialog ${mode === "preview" ? "quote-preview-dialog" : ""}`} aria-labelledby="quote-dialog-title" onCancel={e => { if (busy || exporting) e.preventDefault(); else setMode(null); }} onClose={() => setMode(null)}>
    <div className="modal-heading"><div><small>COELHOFIT · ORÇAMENTOS</small><h2 id="quote-dialog-title">{mode === "preview" ? selected?.number : draft?.id ? "Editar orçamento" : "Novo orçamento"}</h2></div><button className="icon-button" aria-label="Fechar orçamento" disabled={busy || !!exporting} onClick={() => setMode(null)}><X size={21}/></button></div>
    {message && <div className="quote-modal-alert" role="alert">{message}</div>}
    {mode === "preview" && selected ? <><div className="quote-preview-body"><QuoteDocument quote={selected}/></div><div className="quote-dialog-footer"><button className="button secondary" disabled={!!exporting} onClick={() => open(selected)}><Pencil size={16}/>Editar</button><button className="button" disabled={!!exporting} onClick={() => exportPdf(selected)}><Download size={16}/>{exporting ? "Gerando PDF..." : "Baixar PDF"}</button></div></> : mode === "edit" && draft && <form onSubmit={save}><fieldset disabled={busy} className="modal-body quote-editor">
      <div className="form-grid"><Field label="Nome do cliente" wide><input required autoFocus list="quote-customers" maxLength={200} value={draft.party} placeholder="Nome do cliente ou empresa" onChange={e => { update("party", e.target.value); const c = data.contacts.find(c => c.kind === "Cliente" && c.name === e.target.value); if (c) update("phone", c.phone); }}/><datalist id="quote-customers">{data.contacts.filter(c => c.kind === "Cliente").map(c => <option key={c.id} value={c.name}/>)}</datalist></Field><Field label="Telefone (opcional)"><input type="tel" maxLength={40} value={draft.phone} placeholder="(99) 99999-9999" onChange={e => update("phone", e.target.value)}/></Field><Field label="Situação"><select value={draft.status} onChange={e => update("status", e.target.value as QuoteStatus)}><option value="open">Em aberto</option><option value="approved">Aprovado</option><option value="declined">Recusado</option></select></Field><Field label="Endereço do cliente (opcional)" wide><input maxLength={300} value={draft.customerAddress} onChange={e => update("customerAddress", e.target.value)}/></Field><Field label="Data de emissão"><input required type="date" value={draft.date} onChange={e => update("date", e.target.value)}/></Field><Field label="Válido até"><input required type="date" min={draft.date} value={draft.validUntil} onChange={e => update("validUntil", e.target.value)}/></Field></div>
      <div className="items-heading"><h3>Itens do orçamento</h3><button type="button" className="text-button" disabled={items.length >= 100} onClick={() => setItems(v => [...v, { productId: "", quantity: "1", unitPrice: "" }])}><Plus size={15}/>Adicionar item</button></div>
      {!data.products.some(p => p.active) && !draft.id && <div className="info-box">Cadastre um produto ativo na aba Produtos para montar o orçamento.</div>}
      <div className="order-lines">{items.map((l, i) => <div className="order-line" key={i}><div className="line-main"><Field label="Produto"><select required value={l.productId} onChange={e => updateItem(i, "productId", e.target.value)}><option value="">Selecione</option>{data.products.filter(p => p.active || items.some(l => l.productId === p.id)).map(p => <option key={p.id} value={p.id}>{p.sku} · {p.name}{p.active ? "" : " (inativo)"}</option>)}</select></Field><Field label="Quantidade"><input required type="number" min="1" step="1" value={l.quantity} onChange={e => updateItem(i, "quantity", e.target.value)}/></Field><Field label="Unitário (R$)"><input required type="number" min="0" step="0.01" value={l.unitPrice} onChange={e => updateItem(i, "unitPrice", e.target.value)}/></Field><button type="button" className="icon-button remove-line" disabled={items.length === 1} aria-label={`Remover item ${i + 1}`} onClick={() => setItems(v => v.filter((_, j) => j !== i))}><Trash2 size={17}/></button></div><div className="quote-line-total">Total do item <strong>{quoteMoney(Number(l.quantity || 0) * cents(l.unitPrice))}</strong></div></div>)}</div>
      <div className="form-grid quote-adjustments"><Field label="Desconto total (R$)"><input required type="number" min="0" step="0.01" max={subtotal / 100} value={draft.discount} onChange={e => update("discount", e.target.value)}/></Field><Field label="Frete / entrega (R$)"><input required type="number" min="0" step="0.01" value={draft.shipping} onChange={e => update("shipping", e.target.value)}/></Field></div><div className="quote-editor-total"><span>Total do orçamento</span><strong>{quoteMoney(total)}</strong></div>
      <div className="form-grid"><Field label="Condições de pagamento" wide><textarea rows={3} maxLength={1000} value={draft.paymentTerms} placeholder="Ex.: Pix à vista ou cartão em 3 parcelas" onChange={e => update("paymentTerms", e.target.value)}/></Field><Field label="Entrega ou retirada" wide><textarea rows={2} maxLength={1000} value={draft.deliveryTerms} placeholder="Prazo, local e condições de entrega" onChange={e => update("deliveryTerms", e.target.value)}/></Field><Field label="Observações (opcional)" wide><textarea rows={3} maxLength={2000} value={draft.notes} onChange={e => update("notes", e.target.value)}/></Field></div>
      <div className="quote-save-help">Após salvar, use Visualizar ou PDF na lista de orçamentos.</div>
      <div className="modal-footer"><button type="button" className="button secondary" onClick={() => setMode(null)}>Voltar</button><button className="button" type="submit" disabled={busy || !items.length || (!data.products.some(p => p.active) && !draft.id)}>{busy ? "Salvando..." : "Salvar orçamento"}</button></div>
    </fieldset></form>}</dialog>
  </>;
}
