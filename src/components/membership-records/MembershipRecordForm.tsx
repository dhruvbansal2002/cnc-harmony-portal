import { useState } from 'react'
import type { FormEvent } from 'react'
import type { CustomerRecord, EmployeeRecord, MembershipPlanRecord } from '../../auth/types'
import {
  createEmptyMembershipRecordFormValues,
  membershipRecordCustomerOptions,
  membershipRecordToCustomerSnapshot,
  type MembershipRecordFormValues,
} from '../../lib/membershipRecords'

export function MembershipRecordForm({
  title,
  description,
  customerOptions,
  membershipPlans,
  employeeOptions,
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
  customerOptions: CustomerRecord[]
  membershipPlans: MembershipPlanRecord[]
  employeeOptions: EmployeeRecord[]
  initialValues?: MembershipRecordFormValues
  onSubmit: (values: MembershipRecordFormValues) => Promise<void>
  onCancel?: () => void
  error: string | null
  isSubmitting: boolean
  submitLabel: string
  variant?: 'create' | 'inline'
}) {
  const [values, setValues] = useState<MembershipRecordFormValues>(
    initialValues ?? createEmptyMembershipRecordFormValues(),
  )

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await onSubmit(values)
  }

  function handleModeChange(mode: MembershipRecordFormValues['customer_mode']) {
    setValues((current) => ({
      ...current,
      customer_mode: mode,
      customer_id: mode === 'linked' ? current.customer_id : '',
    }))
  }

  function handleCustomerChange(customerId: string) {
    if (!customerId) {
      setValues((current) => ({
        ...current,
        customer_id: '',
      }))
      return
    }

    const selectedCustomer = customerOptions.find((customer) => customer.id === customerId)

    if (!selectedCustomer) {
      setValues((current) => ({
        ...current,
        customer_id: customerId,
      }))
      return
    }

    const snapshot = membershipRecordToCustomerSnapshot(selectedCustomer)

    setValues((current) => ({
      ...current,
      customer_mode: 'linked',
      ...snapshot,
    }))
  }

  const containerClasses =
    variant === 'inline'
      ? 'rounded-[1.75rem] border border-white/10 bg-slate-950/70 p-4 sm:p-5'
      : 'rounded-[2rem] border border-white/10 bg-white/5 p-5 shadow-2xl shadow-cyan-950/20 backdrop-blur sm:p-6'

  const currentCustomerList = membershipRecordCustomerOptions(customerOptions, values.customer_id)

  return (
    <form className={`${containerClasses} grid gap-5`} onSubmit={handleSubmit}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200/80">
            Membership Records
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
            Customer Mode
          </span>
          <select
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400/50"
            onChange={(event) =>
              handleModeChange(event.target.value as MembershipRecordFormValues['customer_mode'])
            }
            value={values.customer_mode}
          >
            <option value="linked">Existing Customer</option>
            <option value="snapshot">Snapshot Only Buyer</option>
          </select>
        </label>

        {values.customer_mode === 'linked' ? (
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
              Existing Customer
            </span>
            <select
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400/50"
              onChange={(event) => handleCustomerChange(event.target.value)}
              value={values.customer_id}
            >
              <option value="">Select a customer</option>
              {currentCustomerList.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.character_name} · {customer.citizen_id}
                  {customer.archived_at ? ' (Archived)' : ''}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-slate-500">
              Snapshot fields will auto-fill from the selected customer and can still be edited.
            </p>
          </label>
        ) : null}

        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Customer Character Name
          </span>
          <input
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-400/50"
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                customer_character_name: event.target.value,
              }))
            }
            value={values.customer_character_name}
          />
        </label>

        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Customer Citizen ID
          </span>
          <input
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-400/50"
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                customer_citizen_id: event.target.value,
              }))
            }
            value={values.customer_citizen_id}
          />
        </label>

        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Customer Phone Number
          </span>
          <input
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-400/50"
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                customer_phone_number: event.target.value,
              }))
            }
            value={values.customer_phone_number}
          />
        </label>

        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Customer Discord Username
          </span>
          <input
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-400/50"
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                customer_discord_username: event.target.value,
              }))
            }
            value={values.customer_discord_username}
          />
        </label>

        <label className="block lg:col-span-2">
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

        <label className="block lg:col-span-2">
          <span className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Issued By
          </span>
          <select
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400/50"
            onChange={(event) =>
              setValues((current) => ({ ...current, issued_by_employee_id: event.target.value }))
            }
            value={values.issued_by_employee_id}
          >
            <option value="">Unassigned</option>
            {employeeOptions.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.character_name}
                {employee.archived_at ? ' (Archived)' : ''}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Given Date
          </span>
          <input
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-400/50"
            onChange={(event) =>
              setValues((current) => ({ ...current, given_date: event.target.value }))
            }
            type="date"
            value={values.given_date}
          />
        </label>

        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Expiry Date
          </span>
          <input
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-400/50"
            onChange={(event) =>
              setValues((current) => ({ ...current, expiry_date: event.target.value }))
            }
            type="date"
            value={values.expiry_date}
          />
        </label>

        <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 lg:col-span-2">
          <input
            checked={values.complimentary_items_given}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                complimentary_items_given: event.target.checked,
              }))
            }
            type="checkbox"
          />
          Complimentary Items Given
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
                status: event.target.value as MembershipRecordFormValues['status'],
              }))
            }
            value={values.status}
          >
            <option value="active">Active</option>
            <option value="expired">Expired</option>
            <option value="cancelled">Cancelled</option>
            <option value="archived">Archived</option>
          </select>
        </label>

        <label className="block lg:col-span-2">
          <span className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Notes
          </span>
          <textarea
            className="mt-2 min-h-28 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-400/50"
            onChange={(event) =>
              setValues((current) => ({ ...current, notes: event.target.value }))
            }
            value={values.notes}
          />
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

