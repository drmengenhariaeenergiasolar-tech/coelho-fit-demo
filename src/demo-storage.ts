import { applyAction, emptyStore, normalizeStore, type Action, type Store } from "./lib/store";
const KEY = "coelhofit-demo-v1";
export function initialDemo(): Store {
  const s = emptyStore();
  s.products = [
    { id: "demo-whey", sku: "COE0001", name: "Whey Protein 900 g — exemplo", category: "Suplementos", cost: 8500, price: 12990, minimum: 3, active: true, barcode: "" },
    { id: "demo-halter", sku: "COE0002", name: "Halter emborrachado 10 kg — exemplo", category: "Acessórios", cost: 11000, price: 16990, minimum: 2, active: true, barcode: "" },
    { id: "demo-banco", sku: "COE0003", name: "Banco regulável — exemplo", category: "Máquinas", cost: 65000, price: 99900, minimum: 1, active: true, barcode: "" },
  ];
  return s;
}
export function readDemo(): Store {
  const raw = localStorage.getItem(KEY);
  if (!raw) return initialDemo();
  const data = JSON.parse(raw) as Store;
  if (!data || !Array.isArray(data.products) || !Array.isArray(data.contacts) || !Array.isArray(data.processed)) throw new Error("Os dados de teste não puderam ser carregados.");
  return normalizeStore(data);
}
export function applyDemoAction(original: Store, action: Action): Store {
  if (!["product", "contact", "quote"].includes(action.type)) throw new Error("Esta função está em desenvolvimento.");
  return applyAction(original, action);
}
export function saveDemo(data: Store) { localStorage.setItem(KEY, JSON.stringify(data)); }
