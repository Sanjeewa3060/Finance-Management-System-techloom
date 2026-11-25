/**
 * Unit tests for Income Tax Computation logic.
 * Run: npm run test:tax
 */
import {
  apportionToPartners,
  computeTaxReport,
  computeTaxReportForPeriod,
  formatTaxAmount,
  getAssessmentYearRange,
  normalizeTaxSettings,
} from '../src/utils/taxComputation.js'

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

console.log('\n=== Income Tax Computation tests ===\n')

const range = getAssessmentYearRange(2023)
assert(range.label === '2023/2024', 'YOA label 2023/2024')
assert(range.fromDate === '2023-04-01', 'YOA starts April 1')
assert(range.toDate === '2024-03-31', 'YOA ends March 31')

assert(formatTaxAmount(2393347) === '2,393,347', 'formatTaxAmount positive')
assert(formatTaxAmount(1000000, { parenthesesForNegative: true }) === '(1,000,000)', 'formatTaxAmount parentheses')

const referenceSettings = normalizeTaxSettings({
  assessment_year_start: 2023,
  tax_free_allowance: 1000000,
  tax_rate_percent: 6,
  tax_paid: 90000,
  manual_overrides: {
    netIncome: 2393347,
    disallowable: {
      'E.T.F penalty': 567,
      Charity: 68200,
      'Proportionate share of partners welfare': 74502,
      'Insurance (No. 151)': 68367,
      'Insurance (No. 234)': 20483,
      'Insurance arrears': 198065,
    },
  },
})

const referenceReport = computeTaxReport({ transactions: [], settings: referenceSettings })

assert(referenceReport.netIncome === 2393347, 'Net income', String(referenceReport.netIncome))
assert(referenceReport.disallowableTotal === 430184, 'Disallowable total', String(referenceReport.disallowableTotal))
assert(referenceReport.divisibleIncome === 2823531, 'Divisible income', String(referenceReport.divisibleIncome))
assert(referenceReport.taxableIncome === 1823531, 'Taxable income', String(referenceReport.taxableIncome))
assert(referenceReport.partnershipTax === 109412, 'Partnership tax @ 6%', String(referenceReport.partnershipTax))
assert(referenceReport.balanceTaxPayable === 19412, 'Balance tax payable', String(referenceReport.balanceTaxPayable))

const apportion = apportionToPartners({
  partners: referenceSettings.partners,
  firstPeriodDivisible: 2117648,
  secondPeriodDivisible: 705883,
  divisibleIncome: 2823531,
  partnershipTax: 109412,
})

assert(apportion.totals.divisibleIncome === 2823531, 'Apportionment divisible total', String(apportion.totals.divisibleIncome))
assert(apportion.totals.partnershipTax === 109412, 'Apportionment tax total', String(apportion.totals.partnershipTax))
assert(apportion.rows.length === 3, 'Three partner rows')
assert(apportion.rows[0].firstPeriod === 705883, 'Partner 1 first period', String(apportion.rows[0].firstPeriod))
assert(apportion.rows[0].secondPeriod === 235294, 'Partner 1 second period', String(apportion.rows[0].secondPeriod))
assert(apportion.rows[0].total === 941177, 'Partner 1 total divisible', String(apportion.rows[0].total))

console.log('\n=== Period-based report (print) ===\n')

const deptA = 'dept-a'
const deptB = 'dept-b'
const sampleTx = [
  { id: '1', department_id: deptA, type: 'sale', category: 'Project Payment', amount: 1000, entry_date: '2025-01-05' },
  { id: '2', department_id: deptA, type: 'expense', category: 'Rent', amount: 200, entry_date: '2025-01-10' },
  { id: '3', department_id: deptB, type: 'sale', category: 'Service Income', amount: 500, entry_date: '2025-01-20' },
  { id: '4', department_id: deptB, type: 'expense', category: 'Donation', amount: 50, entry_date: '2025-01-25' },
]

const periodReport = computeTaxReportForPeriod({
  transactions: sampleTx,
  fromDate: '2025-01-01',
  toDate: '2025-01-31',
  departments: [
    { id: deptA, name: 'Dept A' },
    { id: deptB, name: 'Dept B' },
  ],
  departmentAggregates: [
    { department_id: deptA, department_name: 'Dept A', entries: 2 },
    { department_id: deptB, department_name: 'Dept B', entries: 2 },
  ],
  settings: { tax_free_allowance: 0, tax_rate_percent: 6, tax_paid: 0 },
  periodLabel: 'Period: Jan 2025',
})

assert(periodReport.netIncome === 1250, 'Period net income from sample tx', String(periodReport.netIncome))
assert(periodReport.disallowableTotal === 50, 'Donation matched as disallowable', String(periodReport.disallowableTotal))
assert(periodReport.divisibleIncome === 1300, 'Period divisible income', String(periodReport.divisibleIncome))
assert(periodReport.apportionment.rows.length === 2, 'Two department apportionment rows')
assert(periodReport.periodLabel === 'Period: Jan 2025', 'Period label preserved')

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`)
process.exit(failed > 0 ? 1 : 0)
