import { useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import type { MembershipPlanRecord, PriceItemRecord } from '../../auth/types'
import {
  createEmptyMembershipBenefitFormValues,
  type MembershipBenefitFormValues,
} from '../../lib/membershipBenefits'

interface MembershipBenefitFormProps {
  title: string
  description: string
  membershipPlans: MembershipPlanRecord[]
  priceItems: PriceItemRecord[]
  initialValues?: MembershipBenefitFormValues
  submitLabel: string
  variant?: 'panel' | 'inline'
  isSubmitting?: boolean
  error?: string | null
  onSubmit: (values: MembershipBenefitFormValues) => Promise<void> | void
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
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
        {title}
      </p>
      <div className="mt-4 grid gap-3">{children}</div>
    </div>
  )
}

export function MembershipBenefitForm({
  title,
  description,
  membershipPlans,
  priceItems,
  initialValues = createEmptyMembershipBenefitFormValues(),
  submitLabel,
  variant = 'panel',
  isSubmitting = false,
  error = null,
  onSubmit,
  onCancel,
}: MembershipBenefitFormProps) {
  const [values, setValues] = useState<MembershipBenefitFormValues>(initialValues)

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
            Membership benefit editor
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
                {item.category} - {item.item_name}
                {item.archived_at ? ' (Archived)' : ''}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-4">
        <SectionCard title="Discount">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
              Discount Percent
            </span>
            <input
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-400/50"
              inputMode="decimal"
              onChange={(event) =>
                setValues((current) => ({ ...current, discount_percent: event.target.value }))
              }
              step="0.01"
              type="number"
              value={values.discount_percent}
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
                  status: event.target.value as MembershipBenefitFormValues['status'],
                }))
              }
              value={values.status}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="archived">Archived</option>
            </select>
          </label>
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
