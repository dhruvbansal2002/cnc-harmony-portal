import { useMemo, useState } from 'react'
import type { ChangeEvent } from 'react'
import type { RankRecord } from '../../auth/types'
import {
  evaluateEmployeeCsvPreview,
  parseEmployeeCsvText,
  type EmployeeCsvParseResult,
  type EmployeeCsvImportResult,
  type EmployeeCsvPreviewResult,
} from '../../lib/employeeCsvImport'

function StatPill({
  label,
  value,
  tone = 'neutral',
}: {
  label: string
  value: string | number
  tone?: 'neutral' | 'success' | 'warning' | 'error'
}) {
  const toneClasses: Record<'neutral' | 'success' | 'warning' | 'error', string> = {
    neutral: 'border-white/10 bg-white/5 text-slate-200',
    success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100',
    warning: 'border-amber-500/30 bg-amber-500/10 text-amber-100',
    error: 'border-rose-500/30 bg-rose-500/10 text-rose-100',
  }

  return (
    <div className={`rounded-2xl border px-4 py-3 ${toneClasses[tone]}`}>
      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.26em] opacity-70">
        {label}
      </p>
      <p className="mt-2 text-lg font-semibold tracking-tight">{value}</p>
    </div>
  )
}

function formatCell(value: string | null | undefined) {
  return value && value.trim().length > 0 ? value : '-'
}

function statusTone(state: EmployeeCsvPreviewResult['rows'][number]['importState']) {
  if (state === 'valid') {
    return 'text-emerald-100 border-emerald-500/30 bg-emerald-500/10'
  }

  if (state === 'skipped') {
    return 'text-amber-100 border-amber-500/30 bg-amber-500/10'
  }

  return 'text-rose-100 border-rose-500/30 bg-rose-500/10'
}

interface EmployeeCsvImportProps {
  rankOptions: RankRecord[]
  existingCitizenIds: string[]
  onConfirmImport: (
    rows: EmployeeCsvPreviewResult['rows'],
  ) => Promise<EmployeeCsvImportResult>
  onClose: () => void
}

export function EmployeeCsvImport({
  rankOptions,
  existingCitizenIds,
  onConfirmImport,
  onClose,
}: EmployeeCsvImportProps) {
  const [allowBlankRank, setAllowBlankRank] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)
  const [parsedCsv, setParsedCsv] = useState<EmployeeCsvParseResult | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [importResult, setImportResult] = useState<EmployeeCsvImportResult | null>(null)
  const [hasSubmitted, setHasSubmitted] = useState(false)

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    event.target.value = ''

    setParseError(null)
    setParsedCsv(null)
    setImportResult(null)
    setHasSubmitted(false)

    if (!file) {
      setFileName(null)
      return
    }

    if (!file.name.toLowerCase().endsWith('.csv')) {
      setFileName(file.name)
      setParseError('Only .csv files are accepted.')
      return
    }

    try {
      const text = await file.text()
      const parsed = parseEmployeeCsvText(text)

      if (parsed.missingHeaders.length > 0) {
        setFileName(file.name)
        setParseError(
          `Missing required headers: ${parsed.missingHeaders.join(', ')}.`,
        )
        return
      }

      if (parsed.duplicateHeaders.length > 0) {
        setFileName(file.name)
        setParseError(
          `Duplicate headers found: ${parsed.duplicateHeaders.join(', ')}.`,
        )
        return
      }

      setFileName(file.name)
      setParsedCsv(parsed)
    } catch (error) {
      setFileName(file.name)
      setParseError(error instanceof Error ? error.message : 'Unable to read the CSV file.')
    }
  }

  const activePreview = useMemo(() => {
    if (!parsedCsv) {
      return null
    }

    return evaluateEmployeeCsvPreview(parsedCsv, {
      rankOptions,
      existingCitizenIds,
      allowBlankRank,
    })
  }, [allowBlankRank, existingCitizenIds, parsedCsv, rankOptions])

  const handleConfirm = async () => {
    if (!activePreview || activePreview.validRows === 0 || hasSubmitted) {
      return
    }

    setIsImporting(true)
    setParseError(null)

    try {
      const result = await onConfirmImport(activePreview.rows)
      setImportResult(result)
      setHasSubmitted(true)
    } catch (error) {
      setParseError(error instanceof Error ? error.message : 'Unable to import employees.')
    } finally {
      setIsImporting(false)
    }
  }

  const totalRows = activePreview?.totalRows ?? 0
  const validRows = activePreview?.validRows ?? 0
  const skippedRows = activePreview?.skippedRows ?? 0
  const rowsWithErrors = activePreview?.rowsWithErrors ?? 0

  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-2xl shadow-cyan-950/20 backdrop-blur sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200/80">
            Employee CSV import
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white">
            Import employees from CSV
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
            Upload a CSV, review the preview, then confirm the rows that are safe to insert into
            Supabase.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:border-cyan-400/40 hover:bg-slate-900"
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </div>
      </div>

      {parseError ? (
        <div className="mt-6 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {parseError}
        </div>
      ) : null}

      {fileName ? (
        <div className="mt-6 rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-slate-200">
          Selected file: <span className="font-semibold text-white">{fileName}</span>
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <label className="inline-flex cursor-pointer items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:border-cyan-400/40 hover:bg-slate-900">
          <input
            accept=".csv"
            className="sr-only"
            onChange={handleFileChange}
            type="file"
          />
          Choose CSV
        </label>

        <label className="inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-200">
          <input
            checked={allowBlankRank}
            className="h-4 w-4 rounded border-white/20 bg-slate-950 text-cyan-400 focus:ring-cyan-400/60"
            onChange={(event) => setAllowBlankRank(event.target.checked)}
            type="checkbox"
          />
          Allow blank rank
        </label>
      </div>

      {activePreview ? (
        <>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <StatPill label="Total rows" value={totalRows} />
            <StatPill label="Valid rows" value={validRows} tone="success" />
            <StatPill label="Rows with errors" value={rowsWithErrors} tone="error" />
            <StatPill label="Skipped rows" value={skippedRows} tone="warning" />
            <StatPill
              label="Existing citizen IDs"
              value={activePreview.existingCitizenIds.length}
              tone="warning"
            />
          </div>

          {activePreview.duplicateCitizenIdsInCsv.length > 0 ? (
            <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              Duplicate citizen IDs in CSV:{' '}
              <span className="font-semibold">
                {activePreview.duplicateCitizenIdsInCsv.join(', ')}
              </span>
            </div>
          ) : null}

          {activePreview.unknownHeaders.length > 0 ? (
            <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-slate-300">
              Ignored headers: {activePreview.unknownHeaders.join(', ')}
            </div>
          ) : null}

          <div className="mt-6 overflow-x-auto rounded-[1.5rem] border border-white/10 bg-slate-950/60">
            <table className="min-w-[1100px] w-full border-separate border-spacing-0">
              <thead>
                <tr className="text-left text-[0.7rem] uppercase tracking-[0.28em] text-slate-500">
                  <th className="border-b border-white/10 px-4 py-3">Row</th>
                  <th className="border-b border-white/10 px-4 py-3">Character Name</th>
                  <th className="border-b border-white/10 px-4 py-3">Citizen ID</th>
                  <th className="border-b border-white/10 px-4 py-3">Rank</th>
                  <th className="border-b border-white/10 px-4 py-3">Hire Date</th>
                  <th className="border-b border-white/10 px-4 py-3">Status</th>
                  <th className="border-b border-white/10 px-4 py-3">Notes</th>
                </tr>
              </thead>
              <tbody>
                {activePreview.rows.map((row) => (
                  <tr key={`${row.lineNumber}-${row.citizen_id}`} className="align-top">
                    <td className="border-b border-white/5 px-4 py-4 text-sm text-slate-300">
                      {row.lineNumber}
                    </td>
                    <td className="border-b border-white/5 px-4 py-4 text-sm font-semibold text-white">
                      {formatCell(row.character_name)}
                    </td>
                    <td className="border-b border-white/5 px-4 py-4 text-sm text-slate-200">
                      {formatCell(row.citizen_id)}
                    </td>
                    <td className="border-b border-white/5 px-4 py-4 text-sm text-slate-200">
                      {formatCell(row.rank_label)}
                      {row.rank_id ? (
                        <div className="mt-2 text-xs text-emerald-200">Resolved rank match</div>
                      ) : null}
                    </td>
                    <td className="border-b border-white/5 px-4 py-4 text-sm text-slate-200">
                      {formatCell(row.hire_date)}
                    </td>
                    <td className="border-b border-white/5 px-4 py-4 text-sm">
                      <span
                        className={`inline-flex rounded-full border px-3 py-1 text-[0.72rem] font-semibold uppercase tracking-[0.18em] ${statusTone(row.importState)}`}
                      >
                        {row.importState === 'valid'
                          ? 'Ready'
                          : row.importState === 'skipped'
                            ? 'Skipped'
                            : 'Error'}
                      </span>
                    </td>
                    <td className="border-b border-white/5 px-4 py-4 text-sm text-slate-300">
                      <div className="space-y-1">
                        {row.warningsList.length > 0 ? (
                          <p className="text-amber-100">{row.warningsList.join(' ')}</p>
                        ) : null}
                        {row.errors.length > 0 ? (
                          <p className="text-rose-100">{row.errors.join(' ')}</p>
                        ) : null}
                        {!row.errors.length && !row.warningsList.length ? <p>-</p> : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {importResult ? (
            <div className="mt-6 rounded-2xl border border-white/10 bg-slate-950/70 p-4 text-sm text-slate-200">
              <p className="font-semibold text-white">Import complete</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <StatPill label="Inserted" value={importResult.insertedCount} tone="success" />
                <StatPill label="Skipped" value={importResult.skippedCount} tone="warning" />
                <StatPill label="Failed" value={importResult.failedCount} tone="error" />
              </div>
              {importResult.rowErrors.length > 0 ? (
                <div className="mt-4 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                    Row errors
                  </p>
                  <ul className="space-y-2">
                    {importResult.rowErrors.map((rowError, index) => (
                      <li
                        key={`${rowError.lineNumber}-${index}`}
                        className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-rose-100"
                      >
                        Row {rowError.lineNumber}: {rowError.message}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
            <button
              className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:border-cyan-400/40 hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isImporting}
              onClick={onClose}
              type="button"
            >
              Cancel
            </button>
            <button
              className="rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-cyan-500/60"
              disabled={isImporting || hasSubmitted || validRows === 0}
              onClick={handleConfirm}
              type="button"
            >
              {isImporting ? 'Importing...' : 'Confirm Import'}
            </button>
          </div>
        </>
      ) : (
        <div className="mt-6 rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-sm text-slate-300">
          Choose a CSV to preview the rows before importing.
        </div>
      )}
    </section>
  )
}
