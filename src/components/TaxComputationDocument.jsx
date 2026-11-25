import React from 'react'
import { buildTaxReportHtml, TAX_REPORT_PRINT_STYLES } from '../utils/taxReportPrint.js'

export default function TaxComputationDocument({ report }) {
  if (!report) return null

  return (
    <>
      <style>{TAX_REPORT_PRINT_STYLES}</style>
      <div
        className="tax-document-preview bg-white text-black"
        dangerouslySetInnerHTML={{ __html: buildTaxReportHtml(report) }}
      />
    </>
  )
}
