import { isRouteErrorResponse, useRouteError } from 'react-router-dom'

export function RouteErrorBoundary() {
  const error = useRouteError()

  let title = 'Route unavailable'
  let message = 'The portal route could not be rendered.'

  if (isRouteErrorResponse(error)) {
    title = `${error.status} ${error.statusText}`
    message =
      typeof error.data === 'string' && error.data.trim().length > 0
        ? error.data
        : message
  } else if (error instanceof Error) {
    message = error.message
  }

  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-slate-100">
      <section className="w-full max-w-xl rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl shadow-cyan-950/30 backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200/80">
          CNC Harmony
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">{message}</p>
      </section>
    </main>
  )
}
