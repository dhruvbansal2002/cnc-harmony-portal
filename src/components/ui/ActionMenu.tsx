import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'

type ActionMenuProps = {
  children: ReactNode
  triggerLabel?: string
  triggerClassName?: string
  menuClassName?: string
  align?: 'start' | 'end'
}

type MenuPosition = {
  top: number
  left: number
  transformOrigin: string
}

const DEFAULT_POSITION: MenuPosition = {
  top: 0,
  left: 0,
  transformOrigin: 'top right',
}

const VIEWPORT_PADDING = 12
const MENU_OFFSET = 10
const MENU_MAX_WIDTH = 320

export function ActionMenu({
  children,
  triggerLabel = 'Actions',
  triggerClassName,
  menuClassName,
  align = 'end',
}: ActionMenuProps) {
  const location = useLocation()
  const menuId = useId()
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [isReady, setIsReady] = useState(false)
  const [position, setPosition] = useState<MenuPosition>(DEFAULT_POSITION)

  const closeMenu = () => {
    setIsOpen(false)
    setIsReady(false)
  }

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      closeMenu()
    })

    return () => {
      window.cancelAnimationFrame(frame)
    }
  }, [location.pathname, location.search, location.hash])

  useEffect(() => {
    const handleMenuOpen = (event: Event) => {
      const customEvent = event as CustomEvent<string>

      if (customEvent.detail !== menuId) {
        closeMenu()
      }
    }

    window.addEventListener('cnc-action-menu-open', handleMenuOpen)

    return () => {
      window.removeEventListener('cnc-action-menu-open', handleMenuOpen)
    }
  }, [menuId])

  useEffect(() => {
    if (!isOpen) {
      return undefined
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null

      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return
      }

      closeMenu()
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMenu()
      }
    }

    const handleWindowBlur = () => {
      closeMenu()
    }

    document.addEventListener('pointerdown', handlePointerDown, true)
    document.addEventListener('keydown', handleKeyDown)
    window.addEventListener('blur', handleWindowBlur)
    window.addEventListener('resize', closeMenu)
    window.addEventListener('scroll', closeMenu, true)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true)
      document.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('blur', handleWindowBlur)
      window.removeEventListener('resize', closeMenu)
      window.removeEventListener('scroll', closeMenu, true)
    }
  }, [isOpen])

  useLayoutEffect(() => {
    if (!isOpen) {
      return undefined
    }

    const frame = window.requestAnimationFrame(() => {
      const triggerRect = triggerRef.current?.getBoundingClientRect()
      const menuElement = menuRef.current

      if (!triggerRect || !menuElement) {
        return
      }

      const menuRect = menuElement.getBoundingClientRect()
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight
      const menuWidth = menuRect.width
      const menuHeight = menuRect.height
      const fitsOnLeft = triggerRect.right - menuWidth >= VIEWPORT_PADDING
      const fitsOnRight = triggerRect.left + menuWidth <= viewportWidth - VIEWPORT_PADDING

      let left =
        align === 'start'
          ? fitsOnRight
            ? triggerRect.left
            : triggerRect.right - menuWidth
          : fitsOnLeft
            ? triggerRect.right - menuWidth
            : triggerRect.left

      left = Math.min(
        Math.max(VIEWPORT_PADDING, left),
        Math.max(VIEWPORT_PADDING, viewportWidth - menuWidth - VIEWPORT_PADDING),
      )

      let top = triggerRect.bottom + MENU_OFFSET
      let openAbove = false

      if (top + menuHeight > viewportHeight - VIEWPORT_PADDING) {
        const nextTop = triggerRect.top - menuHeight - MENU_OFFSET

        if (nextTop >= VIEWPORT_PADDING) {
          top = nextTop
          openAbove = true
        } else {
          top = Math.max(VIEWPORT_PADDING, viewportHeight - menuHeight - VIEWPORT_PADDING)
        }
      }

      setPosition({
        top,
        left,
        transformOrigin: openAbove
          ? align === 'start'
            ? 'bottom left'
            : 'bottom right'
          : align === 'start'
            ? 'top left'
            : 'top right',
      })
      setIsReady(true)
    })

    return () => {
      window.cancelAnimationFrame(frame)
    }
  }, [align, isOpen, children])

  const handleTriggerClick = () => {
    const next = !isOpen
    setIsOpen(next)

    if (next) {
      window.requestAnimationFrame(() => {
        window.dispatchEvent(new CustomEvent('cnc-action-menu-open', { detail: menuId }))
      })
    }
  }

  const triggerClass =
    triggerClassName ??
    'inline-flex items-center rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-[#d9822b]/40 hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d9822b]/50'

  const menu = isOpen
    ? createPortal(
        <div
          aria-label={triggerLabel}
          className={[
            'fixed z-[9999]',
            menuClassName ?? '',
          ]
            .filter(Boolean)
            .join(' ')}
          style={{
            left: `${position.left}px`,
            top: `${position.top}px`,
            maxWidth: `min(${MENU_MAX_WIDTH}px, calc(100vw - ${VIEWPORT_PADDING * 2}px))`,
            maxHeight: `calc(100vh - ${VIEWPORT_PADDING * 2}px)`,
            visibility: isReady ? 'visible' : 'hidden',
            willChange: 'top, left, transform',
          }}
        >
          <div
            ref={menuRef}
            className="scrollbar-none min-w-44 max-w-[calc(100vw-1rem)] overflow-y-auto rounded-2xl border border-white/10 bg-slate-950/95 p-2 shadow-[0_24px_80px_rgba(0,0,0,0.58)] backdrop-blur-xl"
            onClick={() => {
              window.requestAnimationFrame(closeMenu)
            }}
            onMouseLeave={closeMenu}
            role="menu"
            style={{ transformOrigin: position.transformOrigin }}
          >
            {children}
          </div>
        </div>,
        document.body,
      )
    : null

  return (
    <>
      <button
        ref={triggerRef}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className={triggerClass}
        onClick={handleTriggerClick}
        type="button"
      >
        {triggerLabel}
      </button>
      {menu}
    </>
  )
}
