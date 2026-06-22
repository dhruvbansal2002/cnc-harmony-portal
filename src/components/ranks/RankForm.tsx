import { useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import {
  createEmptyRankFormValues,
  operationalAbilityFields,
  portalCapabilityFields,
  type RankFormValues,
} from '../../lib/ranks'

interface RankFormProps {
  title: string
  description: string
  initialValues?: RankFormValues
  submitLabel: string
  variant?: 'panel' | 'inline'
  isSubmitting?: boolean
  error?: string | null
  onSubmit: (values: RankFormValues) => Promise<void> | void
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

function SectionCard({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
        {title}
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">{children}</div>
    </div>
  )
}

export function RankForm({
  title,
  description,
  initialValues = createEmptyRankFormValues(),
  submitLabel,
  variant = 'panel',
  isSubmitting = false,
  error = null,
  onSubmit,
  onCancel,
}: RankFormProps) {
  const [values, setValues] = useState<RankFormValues>(initialValues)

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
            Rank editor
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
            Rank Name
          </span>
          <input
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-400/50"
            onChange={(event) =>
              setValues((current) => ({ ...current, rank_name: event.target.value }))
            }
            placeholder="Technician"
            value={values.rank_name}
          />
        </label>

        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Display Order
          </span>
          <input
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-400/50"
            inputMode="numeric"
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                display_order: event.target.value,
              }))
            }
            type="number"
            value={values.display_order}
          />
        </label>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Description
          </span>
          <textarea
            className="mt-2 min-h-28 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-400/50"
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                description: event.target.value,
              }))
            }
            placeholder="Short description of the rank"
            value={values.description}
          />
        </label>

        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Responsibilities
          </span>
          <textarea
            className="mt-2 min-h-28 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-400/50"
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                responsibilities: event.target.value,
              }))
            }
            placeholder="Role expectations and responsibilities"
            value={values.responsibilities}
          />
        </label>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Hiring Status
          </span>
          <select
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400/50"
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                hiring_status: event.target.value as RankFormValues['hiring_status'],
              }))
            }
            value={values.hiring_status}
          >
            <option value="open">Open</option>
            <option value="closed">Closed</option>
          </select>
        </label>

        <BooleanField
          checked={values.is_management_rank}
          label="Is Management Rank"
          onChange={(checked) =>
            setValues((current) => ({ ...current, is_management_rank: checked }))
          }
        />

        <BooleanField
          checked={values.is_active}
          label="Is Active"
          onChange={(checked) =>
            setValues((current) => ({ ...current, is_active: checked }))
          }
        />
      </div>

      <div className="mt-6 grid gap-4">
        <SectionCard title="Operational Abilities">
          {operationalAbilityFields.map((field) => (
            <BooleanField
              key={field.key}
              checked={values[field.key]}
              label={field.label}
              onChange={(checked) =>
                setValues((current) => ({ ...current, [field.key]: checked }))
              }
            />
          ))}
        </SectionCard>

        <SectionCard title="Portal Permissions / Management Capabilities">
          {portalCapabilityFields.map((field) => (
            <BooleanField
              key={field.key}
              checked={values[field.key]}
              label={field.label}
              onChange={(checked) =>
                setValues((current) => ({ ...current, [field.key]: checked }))
              }
            />
          ))}
        </SectionCard>
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
