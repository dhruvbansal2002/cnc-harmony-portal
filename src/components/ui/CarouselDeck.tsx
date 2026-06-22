import { useEffect, useRef, useState, type ReactNode } from 'react'

interface CarouselDeckProps<T> {
  title: string
  countLabel: string
  items: T[]
  emptyState: ReactNode
  renderItem: (item: T, index: number, isActive: boolean) => ReactNode
  getKey: (item: T, index: number) => string
  themeTone?: 'cyan' | 'emerald'
  controlsPlacement?: 'header' | 'overlay'
  cardClassName?: string
  controlStyle?: 'text' | 'icon'
  wrapAround?: boolean
  childrenBelow?: ReactNode
}

export function CarouselDeck<T>({
  title,
  countLabel,
  items,
  emptyState,
  renderItem,
  getKey,
  themeTone = 'cyan',
  controlsPlacement = 'header',
  cardClassName,
  controlStyle = 'text',
  wrapAround = false,
  childrenBelow,
}: CarouselDeckProps<T>) {
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const cardRefs = useRef<Array<HTMLDivElement | null>>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const activeIndex = items.length === 0 ? 0 : Math.min(selectedIndex, items.length - 1)

  useEffect(() => {
    const root = scrollerRef.current

    if (!root || items.length === 0) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntries = entries
          .filter((entry) => entry.isIntersecting)
          .sort((first, second) => second.intersectionRatio - first.intersectionRatio)

        if (visibleEntries.length === 0) {
          return
        }

        const index = Number((visibleEntries[0].target as HTMLElement).dataset.index)

        if (Number.isFinite(index)) {
          setSelectedIndex(index)
        }
      },
      {
        root,
        threshold: [0.35, 0.5, 0.7, 0.85],
      },
    )

    cardRefs.current.forEach((card) => {
      if (card) {
        observer.observe(card)
      }
    })

    return () => {
      observer.disconnect()
    }
  }, [items.length])

  function goToIndex(nextIndex: number) {
    if (items.length === 0) {
      return
    }

    const clampedIndex = wrapAround
      ? ((nextIndex % items.length) + items.length) % items.length
      : Math.min(Math.max(nextIndex, 0), items.length - 1)
    const card = cardRefs.current[clampedIndex]

    setSelectedIndex(clampedIndex)
    card?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center',
    })
  }

  const toneClasses =
    themeTone === 'emerald'
      ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-100'
      : 'border-cyan-400/25 bg-cyan-400/10 text-cyan-100'

  const iconClasses = 'h-5 w-5'

  const previousIcon =
    controlStyle === 'icon' ? (
      <svg aria-hidden="true" className={iconClasses} fill="none" viewBox="0 0 24 24">
        <path
          d="M15 6l-6 6 6 6"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.25"
        />
      </svg>
    ) : (
      'Previous'
    )

  const nextIcon =
    controlStyle === 'icon' ? (
      <svg aria-hidden="true" className={iconClasses} fill="none" viewBox="0 0 24 24">
        <path
          d="M9 6l6 6-6 6"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.25"
        />
      </svg>
    ) : (
      'Next'
    )

  const controls = (
    <div
      className={[
        'flex items-center gap-2',
        controlsPlacement === 'overlay'
          ? 'absolute inset-y-0 left-0 right-0 z-30 justify-between px-0 sm:px-2 lg:px-3 pointer-events-none'
          : 'flex flex-wrap items-center gap-2',
      ].join(' ')}
    >
      <button
        className={[
          'pointer-events-auto inline-flex items-center justify-center rounded-full border border-white/10 bg-slate-950/80 font-semibold text-slate-100 shadow-lg shadow-black/30 transition hover:border-cyan-400/40 hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50',
          controlStyle === 'icon' ? 'h-11 w-11' : 'px-3 py-2 text-sm',
        ].join(' ')}
        disabled={!wrapAround && activeIndex <= 0}
        onClick={() => goToIndex(activeIndex - 1)}
        type="button"
        aria-label="Previous card"
        data-testid="carousel-prev"
      >
        {previousIcon}
      </button>
      <button
        className={[
          'pointer-events-auto inline-flex items-center justify-center rounded-full border border-white/10 bg-slate-950/80 font-semibold text-slate-100 shadow-lg shadow-black/30 transition hover:border-cyan-400/40 hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50',
          controlStyle === 'icon' ? 'h-11 w-11' : 'px-3 py-2 text-sm',
        ].join(' ')}
        disabled={!wrapAround && activeIndex >= items.length - 1}
        onClick={() => goToIndex(activeIndex + 1)}
        type="button"
        aria-label="Next card"
        data-testid="carousel-next"
      >
        {nextIcon}
      </button>
    </div>
  )

  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/5 p-4 shadow-2xl shadow-cyan-950/20 backdrop-blur sm:p-6" data-testid="carousel-deck">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200/80">
            {title}
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-white">
            {items.length} {countLabel}
          </h2>
        </div>

        {controlsPlacement === 'header' ? (
          <div className="flex flex-wrap items-center gap-2">{controls}</div>
        ) : (
          <div className="flex items-center gap-2">
          <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[0.72rem] font-semibold uppercase tracking-[0.18em] ${toneClasses}`}>
            {items.length === 0 ? 'Empty' : 'Carousel'}
          </span>
          </div>
        )}
      </div>

      {childrenBelow}

      {items.length === 0 ? (
        <div className="mt-6 rounded-[1.75rem] border border-dashed border-white/10 bg-slate-950/45 p-6 text-sm text-slate-400">
          {emptyState}
        </div>
      ) : (
        <>
          <div className="relative mt-6">
            {controlsPlacement === 'overlay' ? controls : null}
            <div
              ref={scrollerRef}
              className={[
                'flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-4 [scrollbar-width:none] [-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:hidden',
                controlsPlacement === 'overlay' ? 'px-6 sm:px-8 lg:px-12' : '',
              ].join(' ')}
              onKeyDown={(event) => {
                if (event.key === 'ArrowLeft') {
                  event.preventDefault()
                  goToIndex(activeIndex - 1)
                }
                if (event.key === 'ArrowRight') {
                  event.preventDefault()
                  goToIndex(activeIndex + 1)
                }
              }}
              tabIndex={0}
              data-testid="carousel-scroller"
            >
              {items.map((item, index) => {
                const isActive = index === activeIndex

                return (
                  <div
                    ref={(element) => {
                      cardRefs.current[index] = element
                    }}
                    key={getKey(item, index)}
                    className={[
                      cardClassName ?? 'snap-center shrink-0 basis-[92%] sm:basis-[84%] md:basis-[76%] lg:basis-[68%] xl:basis-[62%] 2xl:basis-[58%]',
                      'transition-all duration-500',
                      isActive ? 'opacity-100 scale-[1.01]' : 'opacity-80 scale-[0.98]',
                    ].join(' ')}
                    data-carousel-active={isActive ? 'true' : 'false'}
                    data-carousel-card
                    data-index={index}
                  >
                    {renderItem(item, index, isActive)}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
              {items.length > 0 ? `Card ${activeIndex + 1} of ${items.length}` : 'No cards'}
            </div>
            <div className="flex items-center gap-2">
              {items.map((item, index) => (
                <button
                  aria-current={index === activeIndex ? 'true' : undefined}
                  aria-label={`Go to card ${index + 1} of ${items.length}`}
                  className={[
                    'h-2.5 rounded-full transition-all duration-300',
                    index === activeIndex
                      ? 'w-8 bg-cyan-300'
                      : 'w-2.5 bg-white/25 hover:bg-white/40',
                  ].join(' ')}
                  key={getKey(item, index)}
                  onClick={() => goToIndex(index)}
                  type="button"
                  data-testid="carousel-dot"
                />
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  )
}
