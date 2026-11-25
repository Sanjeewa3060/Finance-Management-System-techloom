import React from 'react'
import { formatMoney } from '../utils/money.js'

function Card({ label, value, hint, tone = 'default' }) {
  const toneClass =
    tone === 'good'
      ? 'glass border-emerald-500/30 bg-emerald-500/10'
      : tone === 'bad'
        ? 'glass border-rose-500/25 bg-rose-500/10'
        : tone === 'warn'
          ? 'glass border-amber-400/30 bg-amber-400/10'
        : tone === 'info'
          ? 'glass border-violet-500/30 bg-violet-500/10'
          : 'glass'

  return (
    <div className={`flex h-full min-h-[5.25rem] flex-col rounded-xl border p-3 sm:min-h-[6rem] sm:p-4 xl:min-h-[7.5rem] ${toneClass}`}>
      <div className="text-sm font-medium text-slate-600 dark:text-slate-300">{label}</div>
      <div className="summary-card-value mt-1 text-lg font-bold tracking-tight text-slate-900 sm:mt-2 sm:text-2xl dark:text-slate-50">
        {value}
      </div>
      <div className="mt-auto pt-2">
        {hint ? (
          <div className="text-xs leading-snug text-slate-500 dark:text-slate-400">{hint}</div>
        ) : (
          <div className="text-xs text-transparent select-none" aria-hidden>
            —
          </div>
        )}
      </div>
    </div>
  )
}

export default function SummaryCards({ totals, className = '' }) {
  if (!totals) return null

  const { revenue, otherIncome = 0, purchases, expenses, netProfit, profitMargin, grossIncome } = totals
  const incomeBase = grossIncome ?? revenue + otherIncome

  return (
    <div
      className={`summary-cards-grid grid w-full gap-3 sm:gap-4 ${className}`}
      style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(9.5rem, 1fr))' }}
    >
      <Card label="Total Revenue" value={formatMoney(revenue)} tone="good" hint="Sales only" />
      <Card label="Other Income" value={formatMoney(otherIncome)} tone="good" hint="Other entries marked +" />
      <Card label="Purchases" value={formatMoney(purchases)} tone="bad" />
      <Card label="Total Expenses" value={formatMoney(expenses)} tone="bad" />
      <Card label="Net Profit" value={formatMoney(netProfit)} tone={netProfit >= 0 ? 'good' : 'bad'} />
      <Card
        label="Profit Margin"
        value={`${profitMargin.toFixed(1)}%`}
        hint={incomeBase > 0 ? 'Net profit / (sales + other income)' : 'Add income to compute margin'}
      />
    </div>
  )
}
