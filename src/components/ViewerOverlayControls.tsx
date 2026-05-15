import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Download, ScanSearch, Search } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { cn } from "../lib/utils"
import { Button, buttonVariants } from "./ui/button"
import { Input } from "./ui/input"

type ViewerOverlayControlsProps = {
  source: string
  theme?: "light" | "dark"
  compact?: boolean
  showDownload: boolean
  showSearch: boolean
  searchDisabled?: boolean
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
  paginationPlacement?: "left-center" | "bottom-center"
  currentPage?: number
  totalPages?: number
  onPreviousPage?: () => void
  onNextPage?: () => void
  onPageChange?: (page: number) => void
  showSourcePagination?: boolean
  currentSource?: number
  totalSources?: number
  onPreviousSource?: () => void
  onNextSource?: () => void
  onSourceChange?: (sourceIndex: number) => void
}

export function ViewerOverlayControls({
  source,
  theme = "light",
  compact = false,
  showDownload,
  showSearch,
  searchDisabled = false,
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
  paginationPlacement = "bottom-center",
  currentPage = 1,
  totalPages = 0,
  onPreviousPage,
  onNextPage,
  onPageChange,
  showSourcePagination = false,
  currentSource = 1,
  totalSources = 0,
  onPreviousSource,
  onNextSource,
  onSourceChange,
}: ViewerOverlayControlsProps) {
  const [searchOpen, setSearchOpen] = useState(false)
  const [localSearchValue, setLocalSearchValue] = useState("")
  const [pageInputOpen, setPageInputOpen] = useState(false)
  const [pageInputValue, setPageInputValue] = useState(String(currentPage))
  const [sourceInputOpen, setSourceInputOpen] = useState(false)
  const [sourceInputValue, setSourceInputValue] = useState(String(currentSource))
  const searchRef = useRef<HTMLDivElement | null>(null)

  if (!showDownload && !showSearch && !showReset && !showPagination && !showSourcePagination) {
    return null
  }

  function handleSearchChange(value: string) {
    if (searchDisabled) {
      return
    }

    setLocalSearchValue(value)
    onSearchChange?.(value)
  }

  function openPageInput() {
    setPageInputValue(String(currentPage))
    setPageInputOpen(true)
  }

  function openSourceInput() {
    setSourceInputValue(String(currentSource))
    setSourceInputOpen(true)
  }

  function commitPageInput() {
    const parsedPage = Number.parseInt(pageInputValue, 10)
    if (Number.isFinite(parsedPage) && totalPages > 0) {
      onPageChange?.(Math.min(Math.max(parsedPage, 1), totalPages))
    }
    setPageInputOpen(false)
  }

  function commitNumberInput(value: string, total: number, onChange?: (value: number) => void) {
    const parsedValue = Number.parseInt(value, 10)
    if (Number.isFinite(parsedValue) && total > 0) {
      onChange?.(Math.min(Math.max(parsedValue, 1), total))
    }
  }

  const effectiveSearchValue = searchValue ?? localSearchValue
  const canGoBack = currentPage > 1
  const canGoForward = totalPages > 0 && currentPage < totalPages
  const canGoToPreviousSource = currentSource > 1
  const canGoToNextSource = totalSources > 0 && currentSource < totalSources
  const isDark = theme === "dark"
  const controlSizeClassName = compact ? "!h-8 !w-8" : "!h-10 !w-10"
  const searchSizeClassName = compact ? "h-8" : "h-10"
  const searchButtonSizeClassName = compact ? "!h-6 !w-6" : "!h-8 !w-8"
  const searchOpenWidthClassName = compact ? "w-52" : "w-64"
  const iconSizeClassName = compact ? "h-4 w-4" : "h-5 w-5"
  const pageButtonClassName = cn(
    compact ? "!h-6 !w-6" : "!h-7 !w-7",
    "rounded-full disabled:cursor-not-allowed disabled:opacity-35",
    isDark ? "text-neutral-200 hover:bg-neutral-600/80 hover:text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
  )
  const pageNavigationAtLeft = paginationPlacement === "left-center"
  const pageValueClassName = cn(
    pageNavigationAtLeft ? "!h-5 !w-9 text-[10px]" : compact ? "!h-5 !w-12" : "!h-6 !w-14",
    "rounded-md text-center font-medium tabular-nums",
    isDark ? "text-neutral-100 hover:bg-neutral-600/80 hover:text-white" : "text-slate-700 hover:bg-slate-100",
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
      <div className={cn("pointer-events-none absolute z-10 flex items-center opacity-0 transition-opacity duration-150 group-hover:opacity-100", compact ? "right-2 top-2 gap-1.5" : "right-3 top-3 gap-2")}>
        {showSearch ? (
          <div
            ref={searchRef}
            className={cn(
              "pointer-events-auto relative overflow-hidden rounded-full border shadow-sm backdrop-blur transition-all duration-250 ease-out",
              searchSizeClassName,
              searchOpen && !searchDisabled ? searchOpenWidthClassName : compact ? "w-8" : "w-10",
              isDark ? "border-neutral-500 bg-neutral-700/95 text-neutral-100" : "border-slate-300 bg-white/95 text-slate-700",
              searchDisabled && "opacity-45",
            )}
          >
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => {
                if (!searchDisabled) {
                  setSearchOpen((prev) => !prev)
                }
              }}
              disabled={searchDisabled}
              className={
                iconButtonClassName ??
                cn(
                  "absolute left-1 top-1 rounded-full bg-transparent p-0 leading-none hover:bg-transparent disabled:cursor-not-allowed disabled:opacity-50",
                  searchButtonSizeClassName,
                  isDark ? "text-neutral-200 hover:text-white" : "text-slate-700 hover:text-slate-900",
                )
              }
              aria-label={searchDisabled ? "Search unavailable" : "Toggle search"}
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
                "h-full w-full rounded-full !border-0 bg-transparent text-sm shadow-none outline-none transition-opacity duration-150 focus-visible:ring-0",
                compact ? "pl-9 pr-12" : "pl-11 pr-14",
                isDark ? "!text-neutral-100 placeholder:text-neutral-400" : "!text-slate-800 placeholder:text-slate-400",
                searchOpen && !searchDisabled ? "opacity-100" : "pointer-events-none opacity-0",
                searchInputClassName,
              )}
            />
            {searchOpen && !searchDisabled ? (
              <span className={cn("pointer-events-none absolute top-1/2 -translate-y-1/2 text-xs", compact ? "right-2" : "right-3", isDark ? "text-neutral-400" : "text-slate-500")}>
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
              "pointer-events-auto rounded-full backdrop-blur disabled:cursor-not-allowed disabled:opacity-40",
              controlSizeClassName,
              isDark
                ? "!border-neutral-500 !bg-neutral-700/95 !text-neutral-100 hover:!bg-neutral-600 hover:!text-white"
                : "border-slate-300 bg-white/95 text-slate-700 hover:bg-white/95 hover:text-slate-900",
            )}
            aria-label="Reset view"
          >
            <ScanSearch className={iconSizeClassName} strokeWidth={2} />
          </Button>
        ) : null}

        {showDownload ? (
          <a
            href={source}
            download
            className={cn(
              buttonVariants({ variant: "outline", size: "icon" }),
              "pointer-events-auto rounded-full backdrop-blur",
              controlSizeClassName,
              isDark
                ? "!border-neutral-500 !bg-neutral-700/95 !text-neutral-100 hover:!bg-neutral-600 hover:!text-white"
                : "border-slate-300 bg-white/95 text-slate-700 hover:bg-white/95 hover:text-slate-900",
            )}
            aria-label="Download file"
          >
            <Download className={iconSizeClassName} strokeWidth={2} />
          </a>
        ) : null}
      </div>

      {showPagination && totalPages > 0 ? (
        <div
          className={cn(
            "pointer-events-auto absolute z-10 flex items-center rounded-full border text-xs opacity-0 shadow-sm backdrop-blur transition-opacity duration-150 group-hover:opacity-100 focus-within:opacity-100",
            pageNavigationAtLeft
              ? "left-2 top-1/2 -translate-y-1/2 flex-col px-0.5 py-1"
              : "bottom-3 left-1/2 -translate-x-1/2",
            pageNavigationAtLeft ? "gap-0.5" : compact ? "gap-0.5 px-1.5 py-0.5" : "gap-1 px-2 py-1",
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
            {pageNavigationAtLeft ? <ChevronUp className="h-4 w-4" strokeWidth={2} /> : <ChevronLeft className="h-4 w-4" strokeWidth={2} />}
          </Button>

          {pageInputOpen ? (
            <Input
              type="text"
              inputMode="numeric"
              min={1}
              max={totalPages}
              value={pageInputValue}
              autoFocus
              onChange={(event) => setPageInputValue(event.target.value)}
              onBlur={commitPageInput}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault()
                  commitNumberInput(pageInputValue, totalPages, onPageChange)
                  setPageInputOpen(false)
                }
                if (event.key === "Escape") {
                  setPageInputOpen(false)
                }
              }}
              className={cn(
                pageNavigationAtLeft ? "!h-5 !w-9 text-[10px]" : compact ? "!h-5 !w-12" : "!h-6 !w-14",
                "rounded-md px-1 text-center font-medium tabular-nums shadow-none focus-visible:ring-0",
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
              className={pageValueClassName}
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
            {pageNavigationAtLeft ? <ChevronDown className="h-4 w-4" strokeWidth={2} /> : <ChevronRight className="h-4 w-4" strokeWidth={2} />}
          </Button>
        </div>
      ) : null}

      {showSourcePagination && totalSources > 1 ? (
        <div
          className={cn(
            "pointer-events-auto absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center rounded-full border text-xs opacity-0 shadow-sm backdrop-blur transition-opacity duration-150 group-hover:opacity-100 focus-within:opacity-100",
            compact ? "gap-0.5 px-1.5 py-0.5" : "gap-1 px-2 py-1",
            isDark ? "border-neutral-500 bg-neutral-700/95 text-neutral-100" : "border-slate-200 bg-white/95 text-slate-700",
          )}
        >
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={pageButtonClassName}
            onClick={onPreviousSource}
            disabled={!canGoToPreviousSource}
            aria-label="Previous source"
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={2} />
          </Button>

          {sourceInputOpen ? (
            <Input
              type="text"
              inputMode="numeric"
              min={1}
              max={totalSources}
              value={sourceInputValue}
              autoFocus
              onChange={(event) => setSourceInputValue(event.target.value)}
              onBlur={() => {
                commitNumberInput(sourceInputValue, totalSources, onSourceChange)
                setSourceInputOpen(false)
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault()
                  commitNumberInput(sourceInputValue, totalSources, onSourceChange)
                  setSourceInputOpen(false)
                }
                if (event.key === "Escape") {
                  setSourceInputOpen(false)
                }
              }}
              className={cn(
                compact ? "!h-5 !w-12" : "!h-6 !w-14",
                "rounded-md px-1 text-center font-medium tabular-nums shadow-none focus-visible:ring-0",
                isDark
                  ? "!border-neutral-500 !bg-neutral-600 !text-neutral-100 focus:!border-neutral-400"
                  : "border-slate-200 bg-white text-slate-700 focus:border-slate-400",
              )}
              aria-label="Go to source"
            />
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onDoubleClick={openSourceInput}
              className={cn(
                compact ? "!h-5 !w-12" : "!h-6 !w-14",
                "rounded-md px-0 text-center font-medium tabular-nums",
                isDark ? "text-neutral-100 hover:bg-neutral-600/80 hover:text-white" : "text-slate-700 hover:bg-slate-100",
              )}
              aria-label="Double click to enter source number"
            >
              {currentSource}/{totalSources}
            </Button>
          )}

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={pageButtonClassName}
            onClick={onNextSource}
            disabled={!canGoToNextSource}
            aria-label="Next source"
          >
            <ChevronRight className="h-4 w-4" strokeWidth={2} />
          </Button>
        </div>
      ) : null}
    </>
  )
}
