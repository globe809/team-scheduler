import * as XLSX from 'xlsx'

/**
 * Parse date string like "1/11~1/13", "3/10~3/12", "6/22~6/25\n"
 * Handles cross-year (e.g. 12/20~1/5 → end year +1)
 */
function parseDateRange(dateStr, defaultYear = 2026) {
  if (!dateStr) return null
  const cleaned = String(dateStr).replace(/\n/g, '').trim()

  // Handle pending dates
  if (cleaned.includes('待定') || cleaned.includes('TBD')) {
    return { pending: true, raw: cleaned }
  }

  // Split by ~ or - (but not the - in date numbers)
  const parts = cleaned.split(/[~～]/)
  if (parts.length < 2) return null

  const startStr = parts[0].trim()
  const endStr = parts[parts.length - 1].trim()

  const startMatch = startStr.match(/(\d{1,2})\/(\d{1,2})/)
  const endMatch = endStr.match(/(\d{1,2})\/(\d{1,2})/)

  if (!startMatch || !endMatch) return null

  const startMonth = parseInt(startMatch[1])
  const startDay = parseInt(startMatch[2])
  const endMonth = parseInt(endMatch[1])
  const endDay = parseInt(endMatch[2])

  // Detect cross-year (e.g., show starts in Dec, ends in Jan)
  const endYear = endMonth < startMonth ? defaultYear + 1 : defaultYear

  return {
    startDate: new Date(defaultYear, startMonth - 1, startDay).toISOString().split('T')[0],
    endDate: new Date(endYear, endMonth - 1, endDay).toISOString().split('T')[0],
    pending: false,
  }
}

/**
 * Detect which year the Excel file is for (default 2026)
 */
function detectYear(sheetName) {
  const match = sheetName?.match(/20\d{2}/)
  return match ? parseInt(match[0]) : 2026
}

/**
 * Parse uploaded Excel file and return array of tradeshow objects
 */
export async function parseTradeShowExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result)
        const workbook = XLSX.read(data, { type: 'array' })

        const results = []

        for (const sheetName of workbook.SheetNames) {
          const year = detectYear(sheetName)
          const sheet = workbook.Sheets[sheetName]
          const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })

          // Find header row (look for 'Status' or 'Date' column)
          let headerRow = -1
          for (let i = 0; i < Math.min(5, rows.length); i++) {
            const row = rows[i].map(String)
            if (row.some(c => c.includes('Status') || c.includes('Date'))) {
              headerRow = i
              break
            }
          }
          if (headerRow === -1) continue

          const headers = rows[headerRow].map(h => String(h).trim())

          // Find column indices
          const colName = 0 // First column = show name
          const colStatus = headers.findIndex(h => h === 'Status')
          const colDate = headers.findIndex(h => h === 'Date')
          const colOffice = headers.findIndex(h => h.includes('Office') || h.includes('in charge'))
          const colLocation = headers.findIndex(h => h === 'Location')
          const colShowType = headers.findIndex(h => h === 'Show Type')

          for (let i = headerRow + 1; i < rows.length; i++) {
            const row = rows[i]
            const name = String(row[colName] || '').trim()
            if (!name) continue

            const dateStr = colDate >= 0 ? String(row[colDate] || '') : ''
            const dateRange = parseDateRange(dateStr, year)
            if (!dateRange) continue

            results.push({
              name,
              status: colStatus >= 0 ? String(row[colStatus] || '').trim() : '',
              startDate: dateRange.startDate || null,
              endDate: dateRange.endDate || null,
              datePending: dateRange.pending || false,
              office: colOffice >= 0 ? String(row[colOffice] || '').trim() : '',
              location: colLocation >= 0 ? String(row[colLocation] || '').replace(/\n/g, ' ').trim() : '',
              showType: colShowType >= 0 ? String(row[colShowType] || '').trim() : '',
              year,
              type: 'tradeshow',
              assignments: [],
            })
          }
        }

        resolve(results)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}
