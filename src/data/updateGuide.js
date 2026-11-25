// Change the release id and steps when shipping a user-facing feature update.
// Each user sees a new release once per browser; the mascot can replay it.
export const updateGuide = {
  id: '2026-10-detailed-pnl-report',
  title: 'Detailed Profit & Loss reports',
  steps: [
    {
      title: 'Meet your FMS guide',
      text: 'I’ll show you what’s new in a few quick steps. Reports now include a Detailed Profit & Loss view, clearer period labels, and branded PDF download.',
    },
    {
      title: 'Pick a period quickly',
      text: 'Open Reports and click the calendar. Use presets like Yesterday, This week, Month to date, or All time — the report header shows the preset name with its dates. You can still set a custom From and To range, then Confirm & generate report.',
      path: '/dashboard/reports',
    },
    {
      title: 'Summary or Detailed P&L',
      text: 'Use the Summary and Detailed P&L tabs above the report. Summary keeps the familiar overview and transaction list. Detailed P&L builds a full statement from your entries for the selected period.',
      path: '/dashboard/reports',
    },
    {
      title: 'How Detailed P&L groups entries',
      text: 'Detailed P&L classifies by Entry Type: sale → Revenue, purchase → Cost of Sales, expense → Operating Expenses, and other → Other Income. Stock adjustments are not included. Categories appear as line items under each section.',
      path: '/dashboard/reports',
    },
    {
      title: 'Download PDF or print',
      text: 'On Detailed P&L, use Download PDF or Print report for a light Kaionex-branded statement with Powered by Techloom.ai. On Summary, Download and Print report work as before. Click my icon anytime to replay this guide.',
      path: '/dashboard/reports',
    },
  ],
}
