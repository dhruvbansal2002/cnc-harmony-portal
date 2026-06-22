import { useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import {
  createEmptyOutfitGuideFormValues,
  type OutfitGuideFormValues,
} from '../../lib/outfitGuide'

interface OutfitGuideFormProps {
  title: string
  description: string
  initialValues?: OutfitGuideFormValues
  submitLabel: string
  variant?: 'panel' | 'inline'
  isSubmitting?: boolean
  error?: string | null
  onSubmit: (values: OutfitGuideFormValues) => Promise<void> | void
  onCancel: () => void
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
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">{title}</p>
      <div className="mt-4 grid gap-3">{children}</div>
    </div>
  )
}

export function OutfitGuideForm({
  title,
  description,
  initialValues = createEmptyOutfitGuideFormValues(),
  submitLabel,
  variant = 'panel',
  isSubmitting = false,
  error = null,
  onSubmit,
  onCancel,
}: OutfitGuideFormProps) {
  const [values, setValues] = useState<OutfitGuideFormValues>(initialValues)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await onSubmit(values)
  }

  const containerClasses =
    variant === 'panel'
      ? 'rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-2xl shadow-cyan-950/20 backdrop-blur sm:p-8'
      : 'rounded-[1.75rem] border border-white/10 bg-slate-950/70 p-4 sm:p-5'

  return (
    <form className={`${containerClasses} grid gap-5`} onSubmit={handleSubmit}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200/80">
            Outfit Guide editor
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-white">{title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">{description}</p>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <label className="block lg:col-span-2">
          <span className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Title
          </span>
          <input
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-400/50"
            onChange={(event) =>
              setValues((current) => ({ ...current, title: event.target.value }))
            }
            value={values.title}
          />
        </label>

        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Category
          </span>
          <input
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-400/50"
            onChange={(event) =>
              setValues((current) => ({ ...current, category: event.target.value }))
            }
            value={values.category}
          />
        </label>

        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Image URL
          </span>
          <input
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-400/50"
            onChange={(event) =>
              setValues((current) => ({ ...current, image_url: event.target.value }))
            }
            placeholder="Optional"
            value={values.image_url}
          />
        </label>
      </div>

      <div className="mt-1">
        <SectionCard title="Description">
          <textarea
            className="min-h-36 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-400/50"
            onChange={(event) =>
              setValues((current) => ({ ...current, description: event.target.value }))
            }
            value={values.description}
          />
        </SectionCard>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Status
          </span>
          <select
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400/50"
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                status: event.target.value as OutfitGuideFormValues['status'],
              }))
            }
            value={values.status}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="archived">Archived</option>
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          className="rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? 'Saving...' : submitLabel}
        </button>
        <button
          className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:border-cyan-400/40 hover:bg-slate-900"
          onClick={onCancel}
          type="button"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
