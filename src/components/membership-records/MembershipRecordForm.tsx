import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type {
  CustomerRecord,
  EmployeeRecord,
  MembershipPlanRecord,
  MembershipRecordRecord,
} from '../../auth/types'
import {
  createEmptyMembershipRecordFormValues,
  addDaysToIsoDate,
  fetchMembershipRecordHistory,
  isMembershipRecordExpiredByDate,
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
  const [historyRecords, setHistoryRecords] = useState<MembershipRecordRecord[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState<string | null>(null)

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

  function handleGivenDateChange(givenDate: string) {
    setValues((current) => {
      const normalizedGivenDate = givenDate.trim() || new Date().toISOString().slice(0, 10)

      return {
        ...current,
        given_date: normalizedGivenDate,
        expiry_date: current.expiry_auto_28_days
          ? addDaysToIsoDate(normalizedGivenDate, 28)
          : current.expiry_date,
      }
    })
  }

  function handleExpiryAutoToggle(enabled: boolean) {
    setValues((current) => {
      const normalizedGivenDate = current.given_date.trim() || new Date().toISOString().slice(0, 10)

      return {
        ...current,
        expiry_auto_28_days: enabled,
        given_date: normalizedGivenDate,
        expiry_date: enabled
          ? addDaysToIsoDate(normalizedGivenDate, 28)
          : current.expiry_date,
      }
    })
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

  useEffect(() => {
    const linkedCustomerId = values.customer_mode === 'linked' ? values.customer_id.trim() : ''
    const snapshotCitizenId =
      values.customer_mode === 'snapshot' ? values.customer_citizen_id.trim() : ''
    const historyCustomerId = linkedCustomerId || null
    const historyCustomerCitizenId = !linkedCustomerId && snapshotCitizenId ? snapshotCitizenId : null

    if (!historyCustomerId && !historyCustomerCitizenId) {
      return
    }

    let active = true

    const timer = window.setTimeout(async () => {
      setHistoryLoading(true)
      setHistoryError(null)

      try {
        const records = await fetchMembershipRecordHistory({
          customerId: historyCustomerId,
          customerCitizenId: historyCustomerCitizenId,
        })

        if (active) {
          setHistoryRecords(records)
        }
      } catch (error) {
        if (active) {
          setHistoryRecords([])
          setHistoryError(
            error instanceof Error
              ? error.message
              : 'Unable to load previous membership history.',
          )
        }
      } finally {
        if (active) {
          setHistoryLoading(false)
        }
      }
    }, 250)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [values.customer_citizen_id, values.customer_id, values.customer_mode])

  const containerClasses =
    variant === 'inline'
      ? 'rounded-[1.75rem] border border-white/10 bg-slate-950/70 p-4 sm:p-5'
      : 'rounded-[2rem] border border-white/10 bg-white/5 p-5 shadow-2xl shadow-cyan-950/20 backdrop-blur sm:p-6'

  const currentCustomerList = membershipRecordCustomerOptions(customerOptions, values.customer_id)
  const showHistoryPanel =
    (values.customer_mode === 'linked' && values.customer_id.trim().length > 0) ||
    (values.customer_mode === 'snapshot' && values.customer_citizen_id.trim().length > 0)
  const hasActiveMembershipHistory = historyRecords.some(
    (record) => record.status === 'active' && !isMembershipRecordExpiredByDate(record),
  )
  const hasExpiredMembershipHistory = historyRecords.some(
    (record) =>
      record.status === 'expired' ||
      isMembershipRecordExpiredByDate(record),
  )

  return (
    <form className={`${containerClasses} grid w-full max-w-full gap-5 overflow-x-hidden`} onSubmit={handleSubmit}>
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
          {values.customer_mode === 'snapshot' ? (
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Citizen ID is needed to save this buyer into Customers.
            </p>
          ) : null}
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

        {showHistoryPanel ? (
          <section className="grid gap-4 rounded-[1.5rem] border border-white/10 bg-slate-950/70 p-4 lg:col-span-2">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-200/80">
                  Previous Membership History
                </p>
                <h3 className="mt-2 text-sm font-semibold text-white">
                  Membership history lookup for this customer
                </h3>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  This check is read-only and does not block new membership creation.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-300">
                  {historyRecords.length} records
                </span>
                {hasExpiredMembershipHistory ? (
                  <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-100">
                    Has previous expired membership
                  </span>
                ) : null}
                {hasActiveMembershipHistory ? (
                  <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-rose-100">
                    May already have an active membership
                  </span>
                ) : null}
              </div>
            </div>

            {historyLoading ? (
              <p className="text-sm text-slate-400">Loading previous membership history...</p>
            ) : historyError ? (
              <p className="text-sm text-rose-100">{historyError}</p>
            ) : historyRecords.length === 0 ? (
              <p className="text-sm text-slate-400">No previous membership history found.</p>
            ) : (
              <div className="grid gap-3">
                {historyRecords.map((record) => {
                  const expiredByDate = isMembershipRecordExpiredByDate(record)

                  return (
                    <article
                      className="grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 sm:grid-cols-[minmax(0,1.1fr)_repeat(2,minmax(0,0.7fr))_auto]"
                      key={record.id}
                    >
                      <div className="min-w-0 break-words">
                        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                          Membership Plan
                        </p>
                        <p className="mt-2 text-sm font-semibold text-white">
                          {record.membership_plan?.plan_name ?? '-'}
                        </p>
                      </div>
                      <div className="min-w-0 break-words">
                        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                          Given Date
                        </p>
                        <p className="mt-2 text-sm text-slate-200">{record.given_date ?? '-'}</p>
                      </div>
                      <div className="min-w-0 break-words">
                        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                          Expiry Date
                        </p>
                        <p className="mt-2 text-sm text-slate-200">{record.expiry_date ?? '-'}</p>
                      </div>
                      <div className="flex min-w-0 flex-wrap items-center gap-2 sm:justify-end">
                        <span className="rounded-full border border-white/10 bg-slate-950/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-300">
                          {record.status}
                        </span>
                        <span
                          className={[
                            'rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em]',
                            expiredByDate
                              ? 'border border-amber-500/30 bg-amber-500/10 text-amber-100'
                              : 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-100',
                          ].join(' ')}
                        >
                          {expiredByDate ? 'Expired by date' : 'Not expired by date'}
                        </span>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </section>
        ) : null}

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
            onChange={(event) => handleGivenDateChange(event.target.value)}
            type="date"
            value={values.given_date}
          />
        </label>

        <div className="grid gap-3 lg:col-span-2">
          <label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100">
            <input
              checked={values.expiry_auto_28_days}
              onChange={(event) => handleExpiryAutoToggle(event.target.checked)}
              type="checkbox"
            />
            <span className="grid gap-1">
              <span className="font-semibold text-slate-100">
                Set expiry to 28 days after given date
              </span>
              <span className="text-xs leading-5 text-slate-500">
                Uncheck to choose an expiry date manually.
              </span>
            </span>
          </label>

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
              Expiry Date
            </span>
            <input
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-400/50 disabled:cursor-not-allowed disabled:opacity-60"
              onChange={(event) =>
                setValues((current) => ({ ...current, expiry_date: event.target.value }))
              }
              disabled={values.expiry_auto_28_days}
              type="date"
              value={values.expiry_date}
            />
          </label>
        </div>

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
