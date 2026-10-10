export const QUOTE_BUSINESS = {
  company: "CoelhoFit",
  address: "Rua Carolina, nº 39 - Brasil Novo - Imperatriz - MA",
  postalCode: "65911-393",
  responsible: "Matheus Amorim Coelho Neto",
};
export type QuoteLine = { productId: string; sku: string; name: string; quantity: number; unitPrice: number };
export type QuoteStatus = "open" | "approved" | "declined";
export type Quote = {
  id: string; number: string; version: number; status: QuoteStatus;
  party: string; phone: string; customerAddress: string; date: string; validUntil: string;
  lines: QuoteLine[]; discount: number; shipping: number; total: number;
  paymentTerms: string; deliveryTerms: string; notes: string;
  company: string; address: string; postalCode: string; responsible: string;
  createdAt: string; updatedAt: string;
};
export const quoteMoney = (n: number) => (n / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const quoteDate = (v: string) => v ? v.slice(0, 10).split("-").reverse().join("/") : "A definir";
export function quoteStatus(q: Quote, currentDate: string) {
  return q.status === "approved" ? "Aprovado" : q.status === "declined" ? "Recusado" : q.validUntil < currentDate ? "Vencido" : "Em aberto";
}
export function quoteModel(date: string): Quote {
  return { ...QUOTE_BUSINESS, id: "model", number: "MODELO", version: 0, status: "open", party: "Nome do cliente", phone: "", customerAddress: "Endereço do cliente", date, validUntil: "", lines: [], discount: 0, shipping: 0, total: 0, paymentTerms: "Informe a forma e as condições de pagamento.", deliveryTerms: "Informe o prazo e as condições de entrega ou retirada.", notes: "Preencha os itens, valores e validade para emitir o orçamento ao cliente.", createdAt: "", updatedAt: "" };
}
