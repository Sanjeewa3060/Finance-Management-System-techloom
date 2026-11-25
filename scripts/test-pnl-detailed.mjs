/**
 * Unit tests for Detailed P&L (Entry Type classification) + Summary regression.
 * Run: npm run test:pnl
 */
import { computeTotals } from '../src/utils/calculations.js'
import { filterTransactions } from '../src/utils/filters.js'
import {
  computeDetailedPnl,
  ENTRY_TYPE_TO_PNL_SECTION,
  pnlSectionForEntryType,
  PNL_SECTION_IDS,
} from '../src/utils/pnlDetailed.js'
import { buildDetailedPnlHtml } from '../src/utils/pnlDetailedExport.js'

let passed = 0
let failed = 0

function assert(condition, label, detail = '') {
  if (condition) {
    console.log(`  PASS: ${label}`)
    passed += 1
  } else {
    console.log(`  FAIL: ${label}${detail ? ` — ${detail}` : ''}`)
    failed += 1
  }
}

console.log('\n=== Entry Type → P&L section mapping ===\n')

assert(pnlSectionForEntryType('sale') === 'sales', 'sale → Revenue/sales')
assert(pnlSectionForEntryType('purchase') === 'purchases', 'purchase → Cost of Sales/purchases')
assert(pnlSectionForEntryType('expense') === 'operating_expenses', 'expense → Operating Expenses')
assert(pnlSectionForEntryType('other') === 'other_income', 'other → Other Income')
assert(pnlSectionForEntryType('unknown') === null, 'invalid entry type skipped')
assert(
  ENTRY_TYPE_TO_PNL_SECTION.sale === 'sales' &&
    ENTRY_TYPE_TO_PNL_SECTION.purchase === 'purchases' &&
    ENTRY_TYPE_TO_PNL_SECTION.expense === 'operating_expenses' &&
    ENTRY_TYPE_TO_PNL_SECTION.other === 'other_income',
  'ENTRY_TYPE_TO_PNL_SECTION exact values',
)
assert(
  PNL_SECTION_IDS.join(',') === 'sales,purchases,operating_expenses,other_income',
  'Section id order',
)

console.log('\n=== Fixture: Rev 100k → Net 53k (purchases-only COGS) ===\n')

const fixtureTx = [
  { id: 'f1', type: 'sale', category: 'Project Fees', amount: 100000 },
  { id: 'f2', type: 'purchase', category: 'Materials', amount: 30000 },
  { id: 'f3', type: 'expense', category: 'Rent', amount: 20000 },
  { id: 'f4', type: 'other', other_direction: 'profit', category: 'Interest', amount: 3000 },
]

const fixture = computeDetailedPnl({
  transactions: fixtureTx,
})

assert(fixture.totals.salesTotal === 100000, 'Revenue 100k', String(fixture.totals.salesTotal))
assert(fixture.totals.purchasesTotal === 30000, 'Purchases 30k', String(fixture.totals.purchasesTotal))
// COGS = purchases only = 30k
assert(fixture.totals.cogsTotal === 30000, 'COGS = purchases only 30k', String(fixture.totals.cogsTotal))
// GP = 100k - 30k = 70k
assert(fixture.totals.grossProfit === 70000, 'Gross profit 70k', String(fixture.totals.grossProfit))
assert(fixture.totals.operatingExpensesTotal === 20000, 'OpEx 20k', String(fixture.totals.operatingExpensesTotal))
assert(fixture.totals.otherIncomeTotal === 3000, 'Other Income 3k', String(fixture.totals.otherIncomeTotal))
// Net = 70k + 3k - 20k = 53k
assert(fixture.totals.netProfit === 53000, 'Net profit 53k', String(fixture.totals.netProfit))
assert(fixture.totals.openingStock === undefined, 'No openingStock in totals')
assert(fixture.totals.closingStock === undefined, 'No closingStock in totals')

const fixtureHeaders = fixture.lines.filter((l) => l.kind === 'header').map((l) => l.label)
assert(fixtureHeaders.includes('Revenue'), 'Has Revenue section')
assert(fixtureHeaders.includes('Cost of Sales'), 'Has Cost of Sales section')
assert(fixtureHeaders.includes('Operating Expenses'), 'Has Operating Expenses section')
assert(fixtureHeaders.includes('Other Income'), 'Has Other Income section')
assert(!fixtureHeaders.includes('Administration Expenses'), 'No Administration section')
assert(!fixtureHeaders.includes('Selling & Distribution'), 'No Selling & Distribution section')
assert(!fixtureHeaders.includes('Finance & Others'), 'No Finance & Others section')
assert(
  fixture.lines.some((l) => l.kind === 'result' && l.label === 'GROSS PROFIT / (LOSS)'),
  'GROSS PROFIT / (LOSS) line',
)
assert(
  fixture.lines.some((l) => l.kind === 'result' && l.label === 'NET PROFIT / (LOSS) BEFORE TAX'),
  'NET PROFIT / (LOSS) BEFORE TAX line',
)
assert(!fixture.lines.some((l) => l.stock === 'opening' || l.label === 'Opening Stock'), 'No Opening Stock line')
assert(!fixture.lines.some((l) => l.stock === 'closing' || l.label === 'Closing Stock'), 'No Closing Stock line')
assert(!('hasUnmapped' in fixture), 'No hasUnmapped flag')
assert(fixture.totals.unmappedCount === undefined, 'No unmappedCount')

console.log('\n=== Classification ignores legacy pnl_group ===\n')

const legacyCats = [
  { id: 'c1', name: 'Project Fees', entry_type: 'sale', pnl_group: null, is_active: true },
  { id: 'c2', name: 'Materials', entry_type: 'purchase', pnl_group: null, is_active: true },
  { id: 'c3', name: 'Rent', entry_type: 'expense', pnl_group: null, is_active: true },
  { id: 'c4', name: 'Interest', entry_type: 'other', pnl_group: 'administration', is_active: true },
]
const withNullMapping = computeDetailedPnl({
  transactions: fixtureTx,
  categories: legacyCats,
})
assert(withNullMapping.totals.netProfit === 53000, 'Null pnl_group still includes all txs', String(withNullMapping.totals.netProfit))
assert(withNullMapping.totals.otherIncomeTotal === 3000, 'other stays Other Income despite legacy pnl_group')
assert(withNullMapping.totals.operatingExpensesTotal === 20000, 'expense in OpEx without mapping')

console.log('\n=== Multi-category dynamic rows ===\n')

const multi = computeDetailedPnl({
  transactions: [
    { type: 'sale', category: 'Retail', amount: 400 },
    { type: 'sale', category: 'Wholesale', amount: 600 },
    { type: 'expense', category: 'Rent', amount: 50 },
    { type: 'expense', category: 'Utilities', amount: 30 },
  ],
})
const revenueItems = multi.lines.filter((l) => l.kind === 'item' && l.sectionId === 'sales')
assert(revenueItems.length === 2, 'Two revenue category rows', String(revenueItems.length))
assert(
  revenueItems.some((r) => r.label === 'Retail' && r.amount === 400) &&
    revenueItems.some((r) => r.label === 'Wholesale' && r.amount === 600),
  'Dynamic revenue category amounts',
)
const opexItems = multi.lines.filter((l) => l.kind === 'item' && l.sectionId === 'operating_expenses')
assert(opexItems.length === 2, 'Two OpEx category rows', String(opexItems.length))
assert(multi.totals.salesTotal === 1000, 'Multi revenue total')
assert(multi.totals.operatingExpensesTotal === 80, 'Multi OpEx total')

console.log('\n=== Zero / empty / loss ===\n')

const empty = computeDetailedPnl({ transactions: [] })
assert(empty.totals.salesTotal === 0 && empty.totals.netProfit === 0, 'Empty → zeros')

const loss = computeDetailedPnl({
  transactions: [
    { type: 'sale', category: 'Sales', amount: 100 },
    { type: 'purchase', category: 'Stock', amount: 80 },
    { type: 'expense', category: 'Rent', amount: 50 },
  ],
})
// COGS = 80; GP = 100-80 = 20; Net = 20 - 50 = -30
assert(loss.totals.cogsTotal === 80, 'Loss case COGS = purchases', String(loss.totals.cogsTotal))
assert(loss.totals.grossProfit === 20, 'Loss case GP', String(loss.totals.grossProfit))
assert(loss.totals.netProfit === -30, 'Loss case net', String(loss.totals.netProfit))

console.log('\n=== Date range / department scoping (caller filter) ===\n')

const scopedPool = [
  { id: 'a', type: 'sale', category: 'A', amount: 1000, entry_date: '2026-03-01', department_id: 'd1', status: 'approved' },
  { id: 'b', type: 'sale', category: 'B', amount: 500, entry_date: '2026-04-01', department_id: 'd1', status: 'approved' },
  { id: 'c', type: 'sale', category: 'C', amount: 200, entry_date: '2026-03-15', department_id: 'd2', status: 'approved' },
  { id: 'd', type: 'expense', category: 'X', amount: 50, entry_date: '2026-03-10', department_id: 'd1', status: 'pending' },
]

const marchD1 = filterTransactions(scopedPool, {
  departmentId: 'd1',
  fromDate: '2026-03-01',
  toDate: '2026-03-31',
})
const marchPnl = computeDetailedPnl({ transactions: marchD1 })
assert(marchPnl.totals.salesTotal === 1000, 'Date+dept filter → only March d1 sale', String(marchPnl.totals.salesTotal))
assert(marchPnl.totals.operatingExpensesTotal === 50, 'Pending expense included when caller passes it')

const approvedOnly = marchD1.filter((t) => (t.status ?? 'approved') === 'approved')
const approvedPnl = computeDetailedPnl({ transactions: approvedOnly })
assert(approvedPnl.totals.operatingExpensesTotal === 0, 'Status filter at caller excludes pending')
assert(approvedPnl.totals.salesTotal === 1000, 'Approved sales remain')

console.log('\n=== Print HTML (Kaionex-themed structure) ===\n')

const html = buildDetailedPnlHtml({
  title: 'Detailed Profit & Loss report',
  filtersLabel: 'Period: Mar 2026',
  lines: fixture.lines,
})
assert(
  html.includes('Detailed Profit &amp; Loss report') || html.includes('Detailed Profit & Loss report'),
  'Print HTML report title',
)
assert(html.includes('Operating Expenses'), 'Print HTML OpEx')
assert(html.includes('NET PROFIT / (LOSS) BEFORE TAX'), 'Print HTML net')
assert(html.includes('GROSS PROFIT / (LOSS)'), 'Print HTML gross')
assert(html.includes('@page'), 'Print HTML A4 page rule')
assert(html.includes('size: A4'), 'Print HTML A4 size')
assert(html.includes('report-header'), 'Print HTML Kaionex header')
assert(html.includes('#059669') || html.includes('059669'), 'Print HTML brand green')
assert(html.includes('kaionex-wordmark.png'), 'Print HTML Kaionex logo')
assert(!html.includes('Administration Expenses'), 'Print HTML no Administration')
assert(!html.includes('unmapped-note'), 'Print HTML no unmapped note class when unused')
assert(!html.includes('Selling & Distribution'), 'Print HTML no Selling')
assert(!html.includes('Opening Stock'), 'Print HTML no Opening Stock')
assert(!html.includes('Closing Stock'), 'Print HTML no Closing Stock')

console.log('\n=== Security / classification contract ===\n')

assert(
  !String(computeDetailedPnl).includes('pnl_group'),
  'computeDetailedPnl source does not reference pnl_group',
)
assert(
  !String(computeDetailedPnl).includes('openingStock') && !String(computeDetailedPnl).includes('closingStock'),
  'computeDetailedPnl source does not use opening/closing stock',
)

console.log('\n=== Regression: Summary totals unchanged ===\n')

const summaryTx = [
  { id: 't1', type: 'sale', category: 'Project Payment', amount: 1000 },
  { id: 't2', type: 'purchase', category: 'Materials', amount: 300 },
  { id: 't3', type: 'expense', category: 'Rent', amount: 150 },
  {
    id: 't4',
    type: 'other',
    other_direction: 'profit',
    category: 'Interest',
    amount: 50,
  },
  { id: 't5', type: 'expense', category: 'Mystery', amount: 25 },
]

const summaryTotals = computeTotals(summaryTx)
assert(summaryTotals.revenue === 1000, 'Summary revenue unchanged path', String(summaryTotals.revenue))
assert(summaryTotals.otherIncome === 50, 'Summary other income', String(summaryTotals.otherIncome))
assert(summaryTotals.purchases === 300, 'Summary purchases', String(summaryTotals.purchases))
assert(summaryTotals.expenses === 175, 'Summary expenses', String(summaryTotals.expenses))
assert(summaryTotals.costs === 300 + 175, 'Summary costs', String(summaryTotals.costs))
assert(summaryTotals.netProfit === 1000 + 50 - 475, 'Summary net profit', String(summaryTotals.netProfit))

const detailedFromSame = computeDetailedPnl({
  transactions: summaryTx,
})
// Detailed: Rev 1000, Purch 300, OpEx 175, Other 50 → GP 700, Net 700+50-175 = 575
assert(detailedFromSame.totals.cogsTotal === 300, 'Detailed COGS = purchases', String(detailedFromSame.totals.cogsTotal))
assert(detailedFromSame.totals.netProfit === 575, 'Detailed net', String(detailedFromSame.totals.netProfit))
assert(
  detailedFromSame.totals.netProfit === summaryTotals.netProfit,
  'Detailed net matches Summary for this fixture (purchases-only COGS)',
)

const summaryFixture = computeTotals(fixtureTx)
assert(summaryFixture.revenue === 100000, 'Summary fixture revenue unchanged', String(summaryFixture.revenue))
assert(summaryFixture.expenses === 20000, 'Summary fixture expenses by entry type', String(summaryFixture.expenses))
assert(summaryFixture.netProfit === fixture.totals.netProfit, 'Summary fixture net matches Detailed (no stock)')

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`)
process.exit(failed > 0 ? 1 : 0)
