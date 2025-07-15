export const CATEGORIES = [
  "Pastéis Comuns",
  "Pastéis Especiais", 
  "Caldo de Cana",
  "Bebidas",
  "Gelo",
  "Outros"
] as const;

export const TRANSPORT_TYPES = [
  { value: "ônibus", label: "Ônibus" },
  { value: "van", label: "Van" },
  { value: "carro-app", label: "Carro por App" }
] as const;

export const ROLES = [
  { value: "employee", label: "Funcionário" },
  { value: "admin", label: "Administrador" }
] as const;

export const PAYMENT_METHODS = {
  cash: "Dinheiro",
  pix: "PIX", 
  stoneCard: "Stone D/C/V",
  stoneVoucher: "Stone Voucher",
  pagBankCard: "PagBank D/C/V"
} as const;

export const MIN_CASH_RECOMMENDED = 200;
export const MIN_COINS_RECOMMENDED = 50;
export const MAX_CASH_DIVERGENCE = 0.99; // R$ 0.99
export const DEFAULT_CONSUMPTION_DISCOUNT = 50; // percentage
export const DEFAULT_PROFIT_MARGIN = 0.5; // 50%

export const PERIOD_OPTIONS = [
  { value: "today", label: "Hoje" },
  { value: "yesterday", label: "Ontem" },
  { value: "week", label: "Semana" },
  { value: "month", label: "Mês" },
  { value: "custom", label: "Personalizado" }
] as const;
