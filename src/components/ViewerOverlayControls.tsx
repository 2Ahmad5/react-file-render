import { ChevronLeft, ChevronRight, Download, ScanSearch, Search } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { cn } from "../lib/utils"
import { Button, buttonVariants } from "./ui/button"
import { Input } from "./ui/input"

type ViewerOverlayControlsProps = {
  source: string
  theme?: "light" | "dark"
  showDownload: boolean
  showSearch: boolean
  iconButtonClassName?: string
  searchInputClassName?: string
  searchValue?: string
  onSearchChange?: (value: string) => void
  onSearchEnter?: () => void
  searchCounterText?: string
  showReset?: boolean
  resetDisabled?: boolean
  onReset?: () => void
  showPagination?: boolean
  currentPage?: number
  totalPages?: number
  onPreviousPage?: () => void
  onNextPage?: () => void
  onPageChange?: (page: number) => void
}

export function ViewerOverlayControls({
  source,
  theme = "light",
  showDownload,
  showSearch,
  iconButtonClassName,
  searchInputClassName,
  searchValue,
  onSearchChange,
  onSearchEnter,
  searchCounterText,
  showReset = false,
  resetDisabled = false,
  onReset,
  showPagination = false,
  currentPage = 1,
  totalPages = 0,
  onPreviousPage,
  onNextPage,
  onPageChange,
}: ViewerOverlayControlsProps) {
  const [searchOpen, setSearchOpen] = useState(false)
  const [localSearchValue, setLocalSearchValue] = useState("")
  const [pageInputOpen, setPageInputOpen] = useState(false)
  const [pageInputValue, setPageInputValue] = useState(String(currentPage))
  const searchRef = useRef<HTMLDivElement | null>(null)

  if (!showDownload && !showSearch && !showReset && !showPagination) {
    return null
  }

  function handleSearchChange(value: string) {
    setLocalSearchValue(value)
    onSearchChange?.(value)
  }

  function openPageInput() {
    setPageInputValue(String(currentPage))
    setPageInputOpen(true)
  }

  function commitPageInput() {
    const parsedPage = Number.parseInt(pageInputValue, 10)
    if (Number.isFinite(parsedPage) && totalPages > 0) {
      onPageChange?.(Math.min(Math.max(parsedPage, 1), totalPages))
    }
    setPageInputOpen(false)
  }

  const effectiveSearchValue = searchValue ?? localSearchValue
  const canGoBack = currentPage > 1
  const canGoForward = totalPages > 0 && currentPage < totalPages
  const isDark = theme === "dark"
  const pageButtonClassName = cn(
    "!h-7 !w-7 rounded-full disabled:cursor-not-allowed disabled:opacity-35",
    isDark ? "text-neutral-200 hover:bg-neutral-600/80 hover:text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
  )

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
    <>
      <div className="pointer-events-none absolute right-3 top-3 z-10 flex items-center gap-2 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
        {showSearch ? (
          <div
            ref={searchRef}
            className={cn(
              "pointer-events-auto relative h-10 overflow-hidden rounded-full border shadow-sm backdrop-blur transition-all duration-250 ease-out",
              searchOpen ? "w-64" : "w-10",
              isDark ? "border-neutral-500 bg-neutral-700/95 text-neutral-100" : "border-slate-300 bg-white/95 text-slate-700",
            )}
          >
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setSearchOpen((prev) => !prev)}
              className={
                iconButtonClassName ??
                cn(
                  "absolute left-1 top-1 !h-8 !w-8 rounded-full bg-transparent p-0 leading-none hover:bg-transparent",
                  isDark ? "text-neutral-200 hover:text-white" : "text-slate-700 hover:text-slate-900",
                )
              }
              aria-label="Toggle search"
            >
              <Search className="block h-4 w-4" strokeWidth={2} />
            </Button>

            <Input
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
              className={cn(
                "h-full w-full rounded-full !border-0 bg-transparent pl-11 pr-14 text-sm shadow-none outline-none transition-opacity duration-150 focus-visible:ring-0",
                isDark ? "!text-neutral-100 placeholder:text-neutral-400" : "!text-slate-800 placeholder:text-slate-400",
                searchOpen ? "opacity-100" : "pointer-events-none opacity-0",
                searchInputClassName,
              )}
            />
            {searchOpen ? (
              <span className={cn("pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs", isDark ? "text-neutral-400" : "text-slate-500")}>
                {searchCounterText ?? "0/0"}
              </span>
            ) : null}
          </div>
        ) : null}

        {showReset ? (
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onReset}
            disabled={resetDisabled}
            className={cn(
              "pointer-events-auto !h-10 !w-10 rounded-full backdrop-blur disabled:cursor-not-allowed disabled:opacity-40",
              isDark
                ? "!border-neutral-500 !bg-neutral-700/95 !text-neutral-100 hover:!bg-neutral-600 hover:!text-white"
                : "border-slate-300 bg-white/95 text-slate-700 hover:bg-white/95 hover:text-slate-900",
            )}
            aria-label="Reset view"
          >
            <ScanSearch className="h-5 w-5" strokeWidth={2} />
          </Button>
        ) : null}

        {showDownload ? (
          <a
            href={source}
            download
            className={cn(
              buttonVariants({ variant: "outline", size: "icon" }),
              "pointer-events-auto !h-10 !w-10 rounded-full backdrop-blur",
              isDark
                ? "!border-neutral-500 !bg-neutral-700/95 !text-neutral-100 hover:!bg-neutral-600 hover:!text-white"
                : "border-slate-300 bg-white/95 text-slate-700 hover:bg-white/95 hover:text-slate-900",
            )}
            aria-label="Download file"
          >
            <Download className="h-5 w-5" strokeWidth={2} />
          </a>
        ) : null}
      </div>

      {showPagination && totalPages > 0 ? (
        <div
          className={cn(
            "pointer-events-auto absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-full border px-2 py-1 text-xs opacity-0 shadow-sm backdrop-blur transition-opacity duration-150 group-hover:opacity-100 focus-within:opacity-100",
            isDark ? "border-neutral-500 bg-neutral-700/95 text-neutral-100" : "border-slate-200 bg-white/95 text-slate-700",
          )}
        >
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={pageButtonClassName}
            onClick={onPreviousPage}
            disabled={!canGoBack}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={2} />
          </Button>

          {pageInputOpen ? (
            <Input
              type="number"
              min={1}
              max={totalPages}
              value={pageInputValue}
              autoFocus
              onChange={(event) => setPageInputValue(event.target.value)}
              onBlur={commitPageInput}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault()
                  commitPageInput()
                }
                if (event.key === "Escape") {
                  setPageInputOpen(false)
                }
              }}
              className={cn(
                "!h-6 !w-14 rounded-md px-1 text-center font-medium tabular-nums shadow-none focus-visible:ring-0",
                isDark
                  ? "!border-neutral-500 !bg-neutral-600 !text-neutral-100 focus:!border-neutral-400"
                  : "border-slate-200 bg-white text-slate-700 focus:border-slate-400",
              )}
              aria-label="Go to page"
            />
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onDoubleClick={openPageInput}
              className={cn(
                "!h-6 !w-14 rounded-md px-0 text-center font-medium tabular-nums",
                isDark ? "text-neutral-100 hover:bg-neutral-600/80 hover:text-white" : "text-slate-700 hover:bg-slate-100",
              )}
              aria-label="Double click to enter page number"
            >
              {currentPage}/{totalPages}
            </Button>
          )}

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={pageButtonClassName}
            onClick={onNextPage}
            disabled={!canGoForward}
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" strokeWidth={2} />
          </Button>
        </div>
      ) : null}
    </>
  )
}
