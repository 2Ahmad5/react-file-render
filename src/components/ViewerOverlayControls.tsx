import { useEffect, useRef, useState } from "react"

type ViewerOverlayControlsProps = {
  source: string
  showDownload: boolean
  showSearch: boolean
  iconButtonClassName?: string
  searchInputClassName?: string
  searchValue?: string
  onSearchChange?: (value: string) => void
  onSearchEnter?: () => void
  searchCounterText?: string
}

export function ViewerOverlayControls({
  source,
  showDownload,
  showSearch,
  iconButtonClassName,
  searchInputClassName,
  searchValue,
  onSearchChange,
  onSearchEnter,
  searchCounterText,
}: ViewerOverlayControlsProps) {
  const [searchOpen, setSearchOpen] = useState(false)
  const [localSearchValue, setLocalSearchValue] = useState("")
  const searchRef = useRef<HTMLDivElement | null>(null)

  if (!showDownload && !showSearch) {
    return null
  }

  function handleSearchChange(value: string) {
    setLocalSearchValue(value)
    onSearchChange?.(value)
  }

  const effectiveSearchValue = searchValue ?? localSearchValue

  useEffect(() => {
    if (!searchOpen) {
      return
    }

    function handlePointerDown(event: MouseEvent) {
      if (!searchRef.current) {
        return
      }

      const target = event.target as Node
      if (!searchRef.current.contains(target)) {
        setSearchOpen(false)
      }
    }

    document.addEventListener("mousedown", handlePointerDown)
    return () => {
      document.removeEventListener("mousedown", handlePointerDown)
    }
  }, [searchOpen])

  return (
    <div className="pointer-events-none absolute right-3 top-3 z-10 flex items-center gap-2 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
      {showSearch ? (
        <div
          ref={searchRef}
          className={`pointer-events-auto relative h-10 overflow-hidden rounded-full border border-slate-300 bg-white/95 text-slate-700 shadow-sm backdrop-blur transition-all duration-250 ease-out ${searchOpen ? "w-64" : "w-10"}`}
        >
          <button
            type="button"
            onClick={() => setSearchOpen((prev) => !prev)}
            className={
              iconButtonClassName ??
              "absolute left-1 top-1 inline-flex h-8 w-8 items-center justify-center rounded-full bg-transparent p-0 leading-none text-slate-700 hover:text-slate-900"
            }
            aria-label="Toggle search"
          >
            <svg viewBox="0 0 24 24" className="block h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
          </button>

          <input
            type="text"
            value={effectiveSearchValue}
            onChange={(event) => handleSearchChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault()
                onSearchEnter?.()
              }
            }}
            placeholder="Search"
            className={`h-full w-full bg-transparent pl-11 pr-14 text-sm text-slate-800 outline-none transition-opacity duration-150 ${searchOpen ? "opacity-100" : "pointer-events-none opacity-0"} ${searchInputClassName ?? ""}`}
          />
          {searchOpen ? (
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">
              {searchCounterText ?? "0/0"}
            </span>
          ) : null}
        </div>
      ) : null}

      {showDownload ? (
        <a
          href={source}
          download
          className="pointer-events-auto inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-white/95 text-slate-700 shadow-sm backdrop-blur hover:text-slate-900"
          aria-label="Download file"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 3v10" />
            <path d="m8.5 10.5 3.5 3.5 3.5-3.5" />
            <path d="M4 20h16" />
          </svg>
        </a>
      ) : null}
    </div>
  )
}
