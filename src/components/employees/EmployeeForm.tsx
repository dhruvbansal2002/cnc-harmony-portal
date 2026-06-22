import { useState } from 'react'
import type { FormEvent } from 'react'
import type { RankRecord } from '../../auth/types'
import {
  createEmptyEmployeeFormValues,
  employeeStatusOptions,
  type EmployeeFormValues,
} from '../../lib/employees'

interface EmployeeFormProps {
  title: string
  description: string
  rankOptions: RankRecord[]
  initialValues?: EmployeeFormValues
  submitLabel: string
  variant?: 'panel' | 'inline'
  isSubmitting?: boolean
  error?: string | null
  onSubmit: (values: EmployeeFormValues) => Promise<void> | void
  onCancel: () => void
}

function BooleanField({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-slate-200">
      <input
        checked={checked}
        className="mt-0.5 h-4 w-4 rounded border-white/20 bg-slate-950 text-cyan-400 focus:ring-cyan-400/60"
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
      <span>{label}</span>
    </label>
  )
}

export function EmployeeForm({
  title,
  description,
  rankOptions,
  initialValues = createEmptyEmployeeFormValues(),
  submitLabel,
  variant = 'panel',
  isSubmitting = false,
  error = null,
  onSubmit,
  onCancel,
}: EmployeeFormProps) {
  const [values, setValues] = useState<EmployeeFormValues>(initialValues)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await onSubmit(values)
  }

  const containerClasses =
    variant === 'panel'
      ? 'rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-2xl shadow-cyan-950/20 backdrop-blur sm:p-8'
      : 'rounded-[1.75rem] border border-white/10 bg-slate-950/70 p-4 sm:p-5'

  return (
    <form className={containerClasses} onSubmit={handleSubmit}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200/80">
            Employee editor
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white">
            {title}
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
            {description}
          </p>
        </div>
      </div>

      {error ? (
        <div className="mt-6 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Character Name
          </span>
          <input
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-400/50"
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                character_name: event.target.value,
              }))
            }
            placeholder="John Doe"
            value={values.character_name}
          />
        </label>

        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Citizen ID
          </span>
          <input
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-400/50"
            onChange={(event) =>
              setValues((current) => ({ ...current, citizen_id: event.target.value }))
            }
            placeholder="CIT-0001"
            value={values.citizen_id}
          />
        </label>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Phone Number
          </span>
          <input
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-400/50"
            onChange={(event) =>
              setValues((current) => ({ ...current, phone_number: event.target.value }))
            }
            placeholder="Optional"
            value={values.phone_number}
          />
        </label>

        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Discord Username
          </span>
          <input
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-400/50"
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                discord_username: event.target.value,
              }))
            }
            placeholder="Optional"
            value={values.discord_username}
          />
        </label>

        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Rank
          </span>
          <select
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400/50"
            onChange={(event) =>
              setValues((current) => ({ ...current, rank_id: event.target.value }))
            }
            value={values.rank_id}
          >
            <option value="">Select a rank</option>
            {rankOptions.map((rank) => (
              <option key={rank.id} value={rank.id}>
                {rank.rank_name}
                {rank.archived_at ? ' (Archived)' : ''}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Division
          </span>
          <input
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-400/50"
            onChange={(event) =>
              setValues((current) => ({ ...current, division: event.target.value }))
            }
            placeholder="Optional"
            value={values.division}
          />
        </label>

        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Hire Date
          </span>
          <input
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400/50"
            onChange={(event) =>
              setValues((current) => ({ ...current, hire_date: event.target.value }))
            }
            type="date"
            value={values.hire_date}
          />
        </label>

        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Last Promotion Date
          </span>
          <input
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400/50"
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                last_promotion_date: event.target.value,
              }))
            }
            type="date"
            value={values.last_promotion_date}
          />
        </label>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Warnings
          </span>
          <input
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-400/50"
            inputMode="numeric"
            onChange={(event) =>
              setValues((current) => ({ ...current, warnings: event.target.value }))
            }
            type="number"
            value={values.warnings}
          />
        </label>

        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Total Bills
          </span>
          <input
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-400/50"
            inputMode="decimal"
            onChange={(event) =>
              setValues((current) => ({ ...current, total_bills: event.target.value }))
            }
            step="0.01"
            type="number"
            value={values.total_bills}
          />
        </label>

        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Status
          </span>
          <select
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400/50"
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                status: event.target.value as EmployeeFormValues['status'],
              }))
            }
            value={values.status}
          >
            {employeeStatusOptions.map((status) => (
              <option key={status} value={status}>
                {status === 'on_leave'
                  ? 'On Leave'
                  : status === 'archived'
                    ? 'Archived'
                    : status === 'inactive'
                      ? 'Inactive'
                      : 'Active'}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-2 text-xs text-slate-500">
        Archived status is stored in Supabase and moves the record into the archive section.
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <BooleanField
          checked={values.strike_1}
          label="Strike 1"
          onChange={(checked) =>
            setValues((current) => ({ ...current, strike_1: checked }))
          }
        />
        <BooleanField
          checked={values.strike_2}
          label="Strike 2"
          onChange={(checked) =>
            setValues((current) => ({ ...current, strike_2: checked }))
          }
        />
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
        <button
          className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:border-cyan-400/40 hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={onCancel}
          type="button"
        >
          Cancel
        </button>
        <button
          className="rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-cyan-500/60"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? 'Saving...' : submitLabel}
        </button>
      </div>
    </form>
  )
}
