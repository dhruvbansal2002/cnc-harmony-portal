import { useMemo, useState } from 'react'
import type { ChangeEvent } from 'react'
import {
  evaluateCustomerCsvPreview,
  parseCustomerCsvForPreview,
  type CustomerCsvImportResult,
  type CustomerCsvParseResult,
  type CustomerCsvPreviewResult,
} from '../../lib/customerCsvImport'

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

function statusTone(state: CustomerCsvPreviewResult['rows'][number]['importState']) {
  if (state === 'valid') {
    return 'text-emerald-100 border-emerald-500/30 bg-emerald-500/10'
  }

  if (state === 'skipped') {
    return 'text-amber-100 border-amber-500/30 bg-amber-500/10'
  }

  return 'text-rose-100 border-rose-500/30 bg-rose-500/10'
}

interface CustomerCsvImportProps {
  existingCitizenIds: string[]
  onConfirmImport: (rows: CustomerCsvPreviewResult['rows']) => Promise<CustomerCsvImportResult>
  onClose: () => void
}

export function CustomerCsvImport({
  existingCitizenIds,
  onConfirmImport,
  onClose,
}: CustomerCsvImportProps) {
  const [parseError, setParseError] = useState<string | null>(null)
  const [parsedCsv, setParsedCsv] = useState<CustomerCsvParseResult | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [importResult, setImportResult] = useState<CustomerCsvImportResult | null>(null)
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
      const parsed = parseCustomerCsvForPreview(text, {
        existingCitizenIds,
      })

      if (parsed.missingHeaders.length > 0) {
        setFileName(file.name)
        setParseError(`Missing required headers: ${parsed.missingHeaders.join(', ')}.`)
        return
      }

      if (parsed.duplicateHeaders.length > 0) {
        setFileName(file.name)
        setParseError(`Duplicate headers found: ${parsed.duplicateHeaders.join(', ')}.`)
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

    return evaluateCustomerCsvPreview(parsedCsv, {
      existingCitizenIds,
    })
  }, [existingCitizenIds, parsedCsv])

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
      setParseError(error instanceof Error ? error.message : 'Unable to import customers.')
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
            Customer CSV import
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white">
            Import customers from CSV
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
            Upload a CSV, review the preview, then confirm the rows that are safe to insert into
            Supabase.
          </p>
        </div>

        <button
          className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:border-cyan-400/40 hover:bg-slate-900"
          onClick={onClose}
          type="button"
        >
          Close
        </button>
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
              <span className="font-semibold">{activePreview.duplicateCitizenIdsInCsv.join(', ')}</span>
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
                  <th className="border-b border-white/10 px-4 py-3">Phone Number</th>
                  <th className="border-b border-white/10 px-4 py-3">Discord Username</th>
                  <th className="border-b border-white/10 px-4 py-3">Status</th>
                  <th className="border-b border-white/10 px-4 py-3">Notes</th>
                  <th className="border-b border-white/10 px-4 py-3">State</th>
                </tr>
              </thead>

              <tbody>
                {activePreview.rows.map((row) => (
                  <tr key={`${row.lineNumber}-${row.citizen_id}`} className="align-top">
                    <td className="border-b border-white/5 px-4 py-4 text-sm text-slate-300">
                      {row.lineNumber}
                    </td>
                    <td className="border-b border-white/5 px-4 py-4 text-sm text-slate-100">
                      {formatCell(row.character_name)}
                    </td>
                    <td className="border-b border-white/5 px-4 py-4 text-sm text-slate-200">
                      {formatCell(row.citizen_id)}
                    </td>
                    <td className="border-b border-white/5 px-4 py-4 text-sm text-slate-200">
                      {formatCell(row.phone_number)}
                    </td>
                    <td className="border-b border-white/5 px-4 py-4 text-sm text-slate-200">
                      {formatCell(row.discord_username)}
                    </td>
                    <td className="border-b border-white/5 px-4 py-4 text-sm text-slate-200">
                      {row.status}
                    </td>
                    <td className="border-b border-white/5 px-4 py-4 text-sm text-slate-300">
                      {formatCell(row.notes)}
                    </td>
                    <td className="border-b border-white/5 px-4 py-4">
                      <span
                        className={[
                          'inline-flex items-center rounded-full border px-3 py-1 text-[0.72rem] font-semibold uppercase tracking-[0.18em]',
                          statusTone(row.importState),
                        ].join(' ')}
                      >
                        {row.importState}
                      </span>
                      {row.errors.length > 0 ? (
                        <div className="mt-2 grid gap-1 text-xs text-rose-100">
                          {row.errors.map((error) => (
                            <p key={error}>{error}</p>
                          ))}
                        </div>
                      ) : null}
                      {row.warningsList.length > 0 ? (
                        <div className="mt-2 grid gap-1 text-xs text-amber-100">
                          {row.warningsList.map((warning) => (
                            <p key={warning}>{warning}</p>
                          ))}
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-400">
              {importResult
                ? `Inserted ${importResult.insertedCount}, skipped ${importResult.skippedCount}, failed ${importResult.failedCount}.`
                : 'Review the preview and confirm the rows that are safe to insert.'}
            </p>
            <div className="flex items-center gap-3">
              <button
                className="rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isImporting || validRows === 0 || hasSubmitted}
                onClick={handleConfirm}
                type="button"
              >
                {isImporting ? 'Importing...' : 'Confirm Import'}
              </button>
            </div>
          </div>

          {importResult ? (
            <div className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-200">
              Import complete: {importResult.insertedCount} inserted, {importResult.skippedCount}{' '}
              skipped, {importResult.failedCount} failed.
              {importResult.rowErrors.length > 0 ? (
                <div className="mt-3 grid gap-2">
                  {importResult.rowErrors.map((error) => (
                    <p key={`${error.lineNumber}-${error.message}`} className="text-rose-100">
                      Row {error.lineNumber}: {error.message}
                    </p>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  )
}
