import { useState } from 'react'
import type { FormEvent } from 'react'
import type { MembershipPlanRecord, PriceItemRecord } from '../../auth/types'
import {
  createEmptyComplimentaryItemFormValues,
  type ComplimentaryItemFormValues,
} from '../../lib/complimentaryItems'

export function ComplimentaryItemForm({
  title,
  description,
  membershipPlans,
  priceItems,
  initialValues,
  onSubmit,
  onCancel,
  error,
  isSubmitting,
  submitLabel,
  variant = 'create',
}: {
  title: string
  description: string
  membershipPlans: MembershipPlanRecord[]
  priceItems: PriceItemRecord[]
  initialValues?: ComplimentaryItemFormValues
  onSubmit: (values: ComplimentaryItemFormValues) => Promise<void>
  onCancel?: () => void
  error: string | null
  isSubmitting: boolean
  submitLabel: string
  variant?: 'create' | 'inline'
}) {
  const [values, setValues] = useState<ComplimentaryItemFormValues>(
    initialValues ?? createEmptyComplimentaryItemFormValues(),
  )

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await onSubmit(values)
  }

  const containerClasses =
    variant === 'inline'
      ? 'rounded-[1.75rem] border border-white/10 bg-slate-950/70 p-4 sm:p-5'
      : 'rounded-[2rem] border border-white/10 bg-white/5 p-5 shadow-2xl shadow-cyan-950/20 backdrop-blur sm:p-6'

  return (
    <form className={`${containerClasses} grid gap-5`} onSubmit={handleSubmit}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200/80">
            Complimentary Items
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
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Membership Plan
          </span>
          <select
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400/50"
            onChange={(event) =>
              setValues((current) => ({ ...current, membership_plan_id: event.target.value }))
            }
            value={values.membership_plan_id}
          >
            <option value="">Select a membership plan</option>
            {membershipPlans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.plan_name}
                {plan.archived_at ? ' (Archived)' : ''}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Price Item
          </span>
          <select
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400/50"
            onChange={(event) =>
              setValues((current) => ({ ...current, price_item_id: event.target.value }))
            }
            value={values.price_item_id}
          >
            <option value="">Select a price item</option>
            {priceItems.map((item) => (
              <option key={item.id} value={item.id}>
                {item.category} · {item.item_name}
                {item.archived_at ? ' (Archived)' : ''}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Quantity
          </span>
          <input
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-400/50"
            min={1}
            onChange={(event) =>
              setValues((current) => ({ ...current, quantity: event.target.value }))
            }
            step={1}
            type="number"
            value={values.quantity}
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
                status: event.target.value as ComplimentaryItemFormValues['status'],
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
        {onCancel ? (
          <button
            className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:border-cyan-400/40 hover:bg-slate-900"
            onClick={onCancel}
            type="button"
          >
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  )
}
