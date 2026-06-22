import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { fetchPublicPriceItems } from '../../lib/priceItems'
import type { PriceItemRecord } from '../../auth/types'

function formatPrice(value: string | number | null) {
  if (value === null || value === undefined) {
    return '-'
  }

  const parsed = typeof value === 'number' ? value : Number(value)

  if (!Number.isFinite(parsed)) {
    return '-'
  }

  return `$${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(parsed)}`
}

export function PublicCustomerPriceListPage() {
  const { status, accessLevel } = useAuth()
  const [priceItems, setPriceItems] = useState<PriceItemRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    async function loadData() {
      setLoading(true)
      setPageError(null)

      try {
        const data = await fetchPublicPriceItems()
        if (!isMounted) {
          return
        }

        setPriceItems(data)
      } catch (error) {
        if (!isMounted) {
          return
        }

        setPageError(error instanceof Error ? error.message : 'Unable to load price list.')
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    void loadData()

    return () => {
      isMounted = false
    }
  }, [])

  if (status === 'loading') {
    return (
      <section className="rounded-[2rem] border border-white/10 bg-white/5 p-8 text-slate-100 shadow-2xl shadow-cyan-950/20 backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200/80">
          Customer Price List
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Loading customer price list</h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">Checking portal access.</p>
      </section>
    )
  }

  if (status === 'ready' && (accessLevel === 'management' || accessLevel === 'employee')) {
    return <Navigate replace to="/dashboard" />
  }

  if (status === 'ready' && accessLevel === 'customer') {
    return <Navigate replace to="/access" />
  }

  if (status === 'setup' || status === 'inactive') {
    return <Navigate replace to="/access" />
  }

  if (loading) {
    return (
      <section className="rounded-[2rem] border border-white/10 bg-white/5 p-8 text-slate-100 shadow-2xl shadow-cyan-950/20 backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200/80">
          Customer Price List
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Loading customer price list</h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">Fetching public price items.</p>
      </section>
    )
  }

  if (pageError) {
    return (
      <section className="rounded-[2rem] border border-white/10 bg-white/5 p-8 text-slate-100 shadow-2xl shadow-cyan-950/20 backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200/80">
          Customer Price List
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Unable to load price list</h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">{pageError}</p>
      </section>
    )
  }

  return (
    <section className="space-y-6">
      <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-2xl shadow-cyan-950/20 backdrop-blur sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200/80">
          Customer Price List
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Customer Price List
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
          Public selling prices sourced from Supabase. Cost price and internal wholesale details are
          not shown here.
        </p>
      </div>

      <section className="rounded-[2rem] border border-white/10 bg-white/5 p-4 shadow-2xl shadow-cyan-950/20 backdrop-blur sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200/80">
              Active items
            </p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-white">
              Current public price list
            </h2>
          </div>
          <p className="text-sm text-slate-400">
            Showing {priceItems.length} active {priceItems.length === 1 ? 'item' : 'items'}.
          </p>
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="min-w-[760px] w-full border-separate border-spacing-0">
            <thead>
              <tr className="text-left text-[0.7rem] uppercase tracking-[0.28em] text-slate-500">
                <th className="border-b border-white/10 px-4 py-3">Category</th>
                <th className="border-b border-white/10 px-4 py-3">Item Name</th>
                <th className="border-b border-white/10 px-4 py-3">Selling Price</th>
              </tr>
            </thead>
            <tbody>
              {priceItems.length === 0 ? (
                <tr>
                  <td className="px-4 py-10 text-sm text-slate-400" colSpan={3}>
                    No active public price items are available.
                  </td>
                </tr>
              ) : (
                priceItems.map((item) => (
                  <tr key={item.id}>
                    <td className="border-b border-white/5 px-4 py-4 text-sm text-slate-200">
                      {item.category}
                    </td>
                    <td className="border-b border-white/5 px-4 py-4 text-sm font-medium text-white">
                      {item.item_name}
                    </td>
                    <td className="border-b border-white/5 px-4 py-4 text-sm text-slate-200">
                      {formatPrice(item.common_selling_price)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  )
}
