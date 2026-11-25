/** Recharts colors that match light / dark app theme. */
export function getChartTheme(theme) {
  if (theme === 'light') {
    return {
      grid: '#e2e8f0',
      tick: '#64748b',
      tooltip: {
        background: '#ffffff',
        border: '1px solid #cbd5e1',
        borderRadius: 10,
        color: '#0f172a',
      },
    }
  }
  return {
    grid: '#334155',
    tick: '#94a3b8',
    tooltip: {
      background: '#0b1220',
      border: '1px solid #1f2937',
      borderRadius: 10,
      color: '#f1f5f9',
    },
  }
}
