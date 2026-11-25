export function parseTransactionsCsv(text) {
  const lines = String(text ?? '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  if (lines.length < 2) return []

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase())
  const idx = (name) => headers.indexOf(name)

  const dateI = idx('date') >= 0 ? idx('date') : idx('entry_date')
  const deptI = idx('department')
  const typeI = idx('type')
  const catI = idx('category')
  const descI = idx('description')
  const amtI = idx('amount')

  if (dateI < 0 || typeI < 0 || catI < 0 || amtI < 0) {
    throw new Error('CSV must include headers: date, type, category, amount (optional: department, description)')
  }

  return lines.slice(1).map((line) => {
    const cols = line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''))
    return {
      entry_date: cols[dateI],
      department_name: deptI >= 0 ? cols[deptI] : '',
      type: cols[typeI]?.toLowerCase(),
      category: cols[catI],
      description: descI >= 0 ? cols[descI] : '',
      amount: Number(cols[amtI]),
    }
  })
}
