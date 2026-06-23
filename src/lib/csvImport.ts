export type CsvRow = {
  cells: string[]
}

export function normalizeHeader(header: string) {
  return header.replace(/^\uFEFF/, '').trim().toLowerCase()
}

export function normalizeKey(value: string) {
  return value.trim().toLowerCase()
}

export function isBlank(value: string | null | undefined) {
  return !value || value.trim().length === 0
}

export function parseCsvRows(csvText: string): CsvRow[] {
  const rows: CsvRow[] = []
  let currentCell = ''
  let currentRow: string[] = []
  let inQuotes = false

  for (let index = 0; index < csvText.length; index += 1) {
    const character = csvText[index]
    const nextCharacter = csvText[index + 1]

    if (inQuotes) {
      if (character === '"') {
        if (nextCharacter === '"') {
          currentCell += '"'
          index += 1
        } else {
          inQuotes = false
        }
      } else {
        currentCell += character
      }

      continue
    }

    if (character === '"') {
      inQuotes = true
      continue
    }

    if (character === ',') {
      currentRow.push(currentCell)
      currentCell = ''
      continue
    }

    if (character === '\r') {
      continue
    }

    if (character === '\n') {
      currentRow.push(currentCell)
      rows.push({ cells: currentRow })
      currentRow = []
      currentCell = ''
      continue
    }

    currentCell += character
  }

  currentRow.push(currentCell)
  rows.push({ cells: currentRow })

  return rows
}

export function hasMeaningfulContent(row: CsvRow) {
  return row.cells.some((cell) => cell.trim().length > 0)
}

export function resolveDate(value: string, fallback: string | null, fieldLabel: string) {
  const trimmed = value.trim()

  if (trimmed.length === 0) {
    return {
      value: fallback,
      error: null,
    }
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return {
      value: null,
      error: `${fieldLabel} must use YYYY-MM-DD.`,
    }
  }

  const parsed = new Date(`${trimmed}T00:00:00Z`)

  if (Number.isNaN(parsed.getTime())) {
    return {
      value: null,
      error: `${fieldLabel} is not a valid date.`,
    }
  }

  const roundTripped = parsed.toISOString().slice(0, 10)

  if (roundTripped !== trimmed) {
    return {
      value: null,
      error: `${fieldLabel} is not a valid calendar date.`,
    }
  }

  return {
    value: trimmed,
    error: null,
  }
}

export function resolveRequiredDate(value: string, fieldLabel: string) {
  const trimmed = value.trim()

  if (trimmed.length === 0) {
    return {
      value: null,
      error: `${fieldLabel} is required.`,
    }
  }

  return resolveDate(trimmed, null, fieldLabel)
}

export function resolveBoolean(value: string) {
  const trimmed = value.trim().toLowerCase()

  if (trimmed.length === 0) {
    return false
  }

  if (['true', 'yes', '1'].includes(trimmed)) {
    return true
  }

  if (['false', 'no', '0'].includes(trimmed)) {
    return false
  }

  throw new Error('Boolean values must use true/false, yes/no, or 1/0.')
}

export function resolveInteger(value: string, fieldLabel: string, fallback = 0) {
  const trimmed = value.trim()

  if (trimmed.length === 0) {
    return fallback
  }

  const parsed = Number(trimmed)

  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${fieldLabel} must be a whole number greater than or equal to 0.`)
  }

  return parsed
}

export function resolveNumericText(value: string, fieldLabel: string, fallback = '0') {
  const trimmed = value.trim()

  if (trimmed.length === 0) {
    return fallback
  }

  const parsed = Number(trimmed)

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${fieldLabel} must be a number greater than or equal to 0.`)
  }

  return trimmed
}
