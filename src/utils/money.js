export const DEFAULT_CURRENCY = 'LKR'
export const CURRENCY_LABEL = 'LKR (Rs.)'

export function formatMoney(v) {
  const n = typeof v === 'number' ? v : Number(v ?? 0)
  if (!Number.isFinite(n)) return 'Rs. 0.00'
  return `Rs. ${n.toFixed(2)}`
}

export function chartMoneyTick(v) {
  return `Rs. ${v}`
}
