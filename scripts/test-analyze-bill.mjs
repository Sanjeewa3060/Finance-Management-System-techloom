/**
 * Unit tests for Textract normalization + bill scan file rules + AWS error mapping.
 * Run: npm run test:ocr
 */
import {
  normalizeAnalyzeExpense,
  parseExpenseDate,
  mapNormalizedToEntryFields,
  isLowConfidence,
  LOW_CONFIDENCE_THRESHOLD,
} from '../src/utils/textractNormalize.js'
import { validateBillScanFile, BILL_SCAN_MAX_BYTES } from '../src/utils/billScanValidation.js'
import {
  classifyTextractHttpError,
  extractAwsErrorType,
  sniffImageKind,
  textractDiagCounts,
} from '../supabase/functions/analyze-bill/awsErrors.js'
import {
  friendlyMessageForCode,
  mapAnalyzeBillHttpError,
} from '../src/utils/analyzeBillErrors.js'

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

console.log('\n=== Analyze-bill / Textract normalize tests ===\n')

// --- malformed / missing ---
{
  const empty = normalizeAnalyzeExpense(null)
  assert(empty.hasUsefulFields === false, 'null response → no useful fields')
  assert(empty.vendor.value === null, 'null response vendor null')
  assert(Array.isArray(empty.lineItems) && empty.lineItems.length === 0, 'null response lineItems empty')
}

{
  const empty = normalizeAnalyzeExpense({})
  assert(empty.hasUsefulFields === false, 'empty object → no useful fields')
}

{
  const empty = normalizeAnalyzeExpense({ ExpenseDocuments: [{ SummaryFields: null }] })
  assert(empty.hasUsefulFields === false, 'malformed summary → no useful fields')
}

{
  const empty = normalizeAnalyzeExpense({ ExpenseDocuments: [] })
  assert(empty.hasUsefulFields === false, 'zero ExpenseDocuments → no useful fields')
  const counts = textractDiagCounts({ ExpenseDocuments: [] })
  assert(counts.expenseDocuments === 0, 'diag: zero docs')
}

// --- valid AnalyzeExpense sample ---
{
  const sample = {
    ExpenseDocuments: [
      {
        SummaryFields: [
          {
            Type: { Text: 'VENDOR_NAME', Confidence: 99 },
            ValueDetection: { Text: 'Techloom Supplies', Confidence: 98.5 },
          },
          {
            Type: { Text: 'INVOICE_RECEIPT_ID', Confidence: 90 },
            ValueDetection: { Text: 'INV-1001', Confidence: 88 },
          },
          {
            Type: { Text: 'INVOICE_RECEIPT_DATE', Confidence: 95 },
            ValueDetection: { Text: '15/03/2024', Confidence: 94 },
          },
          {
            Type: { Text: 'SUBTOTAL', Confidence: 92 },
            ValueDetection: { Text: '1,000.00', Confidence: 91 },
          },
          {
            Type: { Text: 'TAX', Confidence: 80 },
            ValueDetection: { Text: '150.00', Confidence: 79 },
          },
          {
            Type: { Text: 'TOTAL', Confidence: 99 },
            ValueDetection: { Text: 'LKR 1,150.00', Confidence: 97 },
          },
        ],
        LineItemGroups: [
          {
            LineItems: [
              {
                LineItemExpenseFields: [
                  { Type: { Text: 'ITEM' }, ValueDetection: { Text: 'Cement bag', Confidence: 90 } },
                  { Type: { Text: 'QUANTITY' }, ValueDetection: { Text: '2', Confidence: 85 } },
                  { Type: { Text: 'UNIT_PRICE' }, ValueDetection: { Text: '500.00', Confidence: 84 } },
                  { Type: { Text: 'PRICE' }, ValueDetection: { Text: '1000.00', Confidence: 86 } },
                ],
              },
            ],
          },
        ],
      },
    ],
  }

  const n = normalizeAnalyzeExpense(sample)
  assert(n.hasUsefulFields === true, 'valid AnalyzeExpense has useful fields')
  assert(n.vendor.value === 'Techloom Supplies', 'vendor', String(n.vendor.value))
  assert(n.invoiceNumber.value === 'INV-1001', 'invoice number')
  assert(n.date.value === '2024-03-15', 'date day-first → ISO', String(n.date.value))
  assert(n.subtotal.value === 1000, 'subtotal', String(n.subtotal.value))
  assert(n.tax.value === 150, 'tax', String(n.tax.value))
  assert(n.total.value === 1150, 'total strips currency', String(n.total.value))
  assert(n.lineItems.length === 1, 'one line item')
  assert(n.lineItems[0].description === 'Cement bag', 'line description')
  assert(n.lineItems[0].quantity === 2, 'line quantity')
  assert(n.lineItems[0].unitPrice === 500, 'line unit price')
  assert(n.lineItems[0].amount === 1000, 'line amount')

  const counts = textractDiagCounts(sample)
  assert(counts.expenseDocuments === 1, 'diag: 1 doc')
  assert(counts.summaryFields === 6, 'diag: 6 summary fields')
  assert(counts.lineItems === 1, 'diag: 1 line item')
}

// --- TOTAL only (missing vendor / invoice / tax / lines) ---
{
  const n = normalizeAnalyzeExpense({
    ExpenseDocuments: [
      {
        SummaryFields: [
          {
            Type: { Text: 'TOTAL' },
            ValueDetection: { Text: '42.50', Confidence: 99 },
          },
        ],
      },
    ],
  })
  assert(n.hasUsefulFields === true, 'TOTAL only → useful')
  assert(n.total.value === 42.5, 'TOTAL only value')
  assert(n.vendor.value === null, 'TOTAL only vendor null')
  assert(n.invoiceNumber.value === null, 'TOTAL only invoice null')
  assert(n.tax.value === null, 'TOTAL only tax null')
  assert(n.lineItems.length === 0, 'TOTAL only no lines')
}

// --- DATE only ---
{
  const n = normalizeAnalyzeExpense({
    ExpenseDocuments: [
      {
        SummaryFields: [
          {
            Type: { Text: 'INVOICE_RECEIPT_DATE' },
            ValueDetection: { Text: '2024-07-04', Confidence: 90 },
          },
        ],
      },
    ],
  })
  assert(n.hasUsefulFields === true, 'DATE only → useful')
  assert(n.date.value === '2024-07-04', 'DATE only value')
}

// --- missing vendor / invoice / tax / line items but subtotal present ---
{
  const n = normalizeAnalyzeExpense({
    ExpenseDocuments: [
      {
        SummaryFields: [
          {
            Type: { Text: 'SUBTOTAL' },
            ValueDetection: { Text: '10.00', Confidence: 88 },
          },
        ],
        LineItemGroups: [],
      },
    ],
  })
  assert(n.hasUsefulFields === true, 'subtotal only → useful (missing vendor/tax/lines OK)')
  assert(n.subtotal.value === 10, 'subtotal value')
}

// --- no line items but other fields ---
{
  const n = normalizeAnalyzeExpense({
    ExpenseDocuments: [
      {
        SummaryFields: [
          {
            Type: { Text: 'VENDOR_NAME' },
            ValueDetection: { Text: 'Shop', Confidence: 80 },
          },
          {
            Type: { Text: 'TOTAL' },
            ValueDetection: { Text: '5', Confidence: 90 },
          },
        ],
      },
    ],
  })
  assert(n.hasUsefulFields === true, 'no line items still useful')
  assert(n.lineItems.length === 0, 'no line items empty array')
}

// --- pick higher confidence when duplicates ---
{
  const n = normalizeAnalyzeExpense({
    ExpenseDocuments: [
      {
        SummaryFields: [
          {
            Type: { Text: 'TOTAL' },
            ValueDetection: { Text: '10.00', Confidence: 40 },
          },
          {
            Type: { Text: 'TOTAL' },
            ValueDetection: { Text: '99.00', Confidence: 95 },
          },
        ],
      },
    ],
  })
  assert(n.total.value === 99, 'prefers higher confidence total', String(n.total.value))
}

// --- dates ---
assert(parseExpenseDate('2024-01-05') === '2024-01-05', 'ISO date passthrough')
assert(parseExpenseDate('05/01/2024') === '2024-01-05', 'DD/MM/YYYY')
assert(parseExpenseDate(null) === null, 'null date')

// --- map to entry fields (never type) ---
{
  const { patch, warnings } = mapNormalizedToEntryFields({
    vendor: { value: 'Acme', confidence: 50 },
    total: { value: 42.5, confidence: 99 },
    date: { value: '2024-06-01', confidence: 80 },
    subtotal: { value: null, confidence: null },
  })
  assert(patch.description === 'Acme', 'maps vendor → description')
  assert(patch.amount === '42.5', 'maps total → amount')
  assert(patch.entry_date === '2024-06-01', 'maps date')
  assert(patch.type === undefined, 'does NOT set entry type')
  assert(warnings.includes('vendor'), 'low confidence vendor warned')
  assert(!warnings.includes('total'), 'high confidence total not warned')
}

{
  const { patch } = mapNormalizedToEntryFields({
    vendor: { value: null, confidence: null },
    total: { value: null, confidence: null },
    subtotal: { value: 20, confidence: 90 },
    date: { value: 'not-a-date', confidence: 90 },
  })
  assert(patch.amount === '20', 'falls back to subtotal for amount')
  assert(patch.entry_date === undefined, 'rejects non-ISO date')
}

{
  const { patch } = mapNormalizedToEntryFields({
    vendor: { value: 'Acme Co', confidence: 95 },
    invoiceNumber: { value: 'INV-9', confidence: 90 },
    total: { value: 10, confidence: 99 },
    date: { value: '2024-06-01', confidence: 90 },
  })
  assert(patch.description === 'Acme Co · Inv INV-9', 'maps vendor + invoice → description')
  assert(patch.type === undefined, 'vendor+invoice still does NOT set entry type')
}

{
  const { patch } = mapNormalizedToEntryFields({
    vendor: { value: null, confidence: null },
    invoiceNumber: { value: 'INV-only', confidence: 88 },
    total: { value: null, confidence: null },
    subtotal: { value: null, confidence: null },
    date: { value: null, confidence: null },
  })
  assert(patch.description === 'Invoice INV-only', 'maps invoice-only → description')
}

assert(isLowConfidence({ value: 'x', confidence: 10 }) === true, 'low confidence true')
assert(isLowConfidence({ value: 'x', confidence: 90 }) === false, 'high confidence false')
assert(isLowConfidence({ value: null, confidence: 10 }) === false, 'null value not flagged')
assert(LOW_CONFIDENCE_THRESHOLD === 70, 'threshold 70')

// --- AWS error classification (AccessDenied must NOT be clearer-photo) ---
assert(
  classifyTextractHttpError(400, 'AccessDeniedException') === 'aws_config_missing',
  'AccessDenied → aws_config_missing',
)
assert(
  classifyTextractHttpError(403, 'UnrecognizedClientException') === 'aws_config_missing',
  'UnrecognizedClient → aws_config_missing',
)
assert(
  classifyTextractHttpError(400, 'InvalidSignatureException') === 'aws_config_missing',
  'InvalidSignature → aws_config_missing',
)
assert(
  classifyTextractHttpError(400, 'SubscriptionRequiredException') === 'aws_config_missing',
  'SubscriptionRequired → aws_config_missing (not unreadable_bill)',
)
assert(
  classifyTextractHttpError(
    400,
    'com.amazon.coral.service#SubscriptionRequiredException',
  ) === 'aws_config_missing',
  'namespaced SubscriptionRequired → aws_config_missing',
)
assert(
  classifyTextractHttpError(400, 'UnsupportedDocumentException') === 'unreadable_bill',
  'UnsupportedDocument → unreadable_bill',
)
assert(
  classifyTextractHttpError(400, 'BadDocumentException') === 'unreadable_bill',
  'BadDocument → unreadable_bill',
)
assert(
  classifyTextractHttpError(400, 'InvalidParameterException') === 'textract_unavailable',
  'InvalidParameter → textract_unavailable',
)
assert(
  classifyTextractHttpError(400, 'DocumentTooLargeException') === 'too_large',
  'DocumentTooLarge → too_large',
)
assert(
  classifyTextractHttpError(400, 'ProvisionedThroughputExceededException') === 'rate_limited',
  'throughput → rate_limited',
)
assert(
  classifyTextractHttpError(500, 'InternalServerError') === 'textract_unavailable',
  '500 → textract_unavailable',
)
assert(
  classifyTextractHttpError(400, '') === 'textract_unavailable',
  'bare 400 without type → unavailable (not clearer-photo)',
)
assert(
  extractAwsErrorType({ __type: 'AccessDeniedException' }) === 'AccessDeniedException',
  'extract __type',
)
assert(
  extractAwsErrorType({
    __type: 'com.amazon.coral.service#UnrecognizedClientException',
  }).includes('UnrecognizedClient'),
  'extract namespaced __type',
)

// --- image sniff ---
{
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0])
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0])
  const junk = new Uint8Array([0x00, 0x01, 0x02, 0x03])
  assert(sniffImageKind(jpeg) === 'jpeg', 'sniff jpeg')
  assert(sniffImageKind(png) === 'png', 'sniff png')
  assert(sniffImageKind(junk) === 'unknown', 'sniff unknown')
}

// --- frontend error message differentiation ---
{
  const clearer = friendlyMessageForCode('unreadable_bill')
  assert(clearer.includes('clearer photo'), 'unreadable message')
  assert(
    !friendlyMessageForCode('aws_config_missing').includes('clearer'),
    'config message not clearer-photo',
  )
  assert(
    !friendlyMessageForCode('textract_unavailable').includes('clearer'),
    'unavailable message not clearer-photo',
  )
  assert(
    !friendlyMessageForCode('network_failure').includes('clearer'),
    'network message not clearer-photo',
  )
  assert(
    !friendlyMessageForCode('unsupported_file').includes('clearer'),
    'unsupported message not clearer-photo',
  )
  assert(
    !friendlyMessageForCode('no_useful_fields').includes('clearer'),
    'no_useful_fields not clearer-photo',
  )

  const authErr = mapAnalyzeBillHttpError(
    { error: { code: 'aws_config_missing', message: friendlyMessageForCode('aws_config_missing') } },
    503,
  )
  assert(authErr.code === 'aws_config_missing', 'mapHttp AccessDenied-shaped code')
  assert(!authErr.message.includes('clearer'), 'mapHttp does not use clearer-photo for config')

  const unreadErr = mapAnalyzeBillHttpError(
    { error: { code: 'unreadable_bill', message: clearer } },
    422,
  )
  assert(unreadErr.code === 'unreadable_bill', 'mapHttp unreadable code')
  assert(unreadErr.message.includes('clearer'), 'mapHttp unreadable message')

  const netErr = mapAnalyzeBillHttpError(null, 0)
  assert(netErr.code === 'network_failure', 'mapHttp bare failure → network')
}

// --- file validation (browser File-like) ---
function fakeFile({ type, size, name = 'bill.jpg' }) {
  return { type, size, name }
}

try {
  validateBillScanFile(null)
  assert(false, 'missing file throws')
} catch (e) {
  assert(e.code === 'missing_file', 'missing file code')
}

try {
  validateBillScanFile(fakeFile({ type: 'application/pdf', size: 100 }))
  assert(false, 'pdf rejected')
} catch (e) {
  assert(e.code === 'unsupported_file', 'pdf unsupported')
}

try {
  validateBillScanFile(fakeFile({ type: 'image/webp', size: 100 }))
  assert(false, 'webp rejected for scan')
} catch (e) {
  assert(e.code === 'unsupported_file', 'webp unsupported for scan')
}

try {
  validateBillScanFile(fakeFile({ type: 'image/jpeg', size: BILL_SCAN_MAX_BYTES + 1 }))
  assert(false, 'too large throws')
} catch (e) {
  assert(e.code === 'too_large', 'too large code')
}

try {
  validateBillScanFile(fakeFile({ type: 'image/png', size: 1200 }))
  assert(true, 'png accepted')
} catch {
  assert(false, 'png accepted')
}

try {
  validateBillScanFile(fakeFile({ type: 'image/jpeg', size: 1200 }))
  assert(true, 'jpeg accepted')
} catch {
  assert(false, 'jpeg accepted')
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`)
process.exit(failed > 0 ? 1 : 0)
