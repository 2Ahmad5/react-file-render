import { useEffect, useMemo, useRef, useState } from "react"
import { Document, Page, pdfjs } from "react-pdf"
import { ViewerOverlayControls } from "../../components/ViewerOverlayControls"
import type { BaseRendererProps } from "../../types"

import "react-pdf/dist/Page/AnnotationLayer.css"
import "react-pdf/dist/Page/TextLayer.css"

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

type LoadSuccessData = {
  numPages: number
}

export function PdfRenderer({ source, options }: BaseRendererProps) {
  const [numPages, setNumPages] = useState(0)
  const [searchQuery, setSearchQuery] = useState("")
  const [pagesWithText, setPagesWithText] = useState<Record<number, boolean>>({})
  const [pageTextMap, setPageTextMap] = useState<Record<number, string>>({})
  const [textLayerVersion, setTextLayerVersion] = useState(0)
  const [activeMatchIndex, setActiveMatchIndex] = useState(-1)
  const [totalMatches, setTotalMatches] = useState(0)
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const pageContainerRefs = useRef<Record<number, HTMLDivElement | null>>({})

  const allowDownload = options?.allowDownload ?? false
  const allowSearch = options?.allowSearch ?? false
  const slotClasses = options?.slotClasses

  function onLoadSuccess({ numPages: loadedPages }: LoadSuccessData) {
    setNumPages(loadedPages)
    setPagesWithText({})
    setPageTextMap({})
    setTextLayerVersion(0)
    setActiveMatchIndex(-1)
    setTotalMatches(0)
  }

  function scrollPageIntoView(pageNumber: number) {
    if (!viewportRef.current) {
      return
    }

    const pageContainer = pageContainerRefs.current[pageNumber]
    if (!pageContainer) {
      return
    }

    const targetTop = pageContainer.offsetTop - 72
    viewportRef.current.scrollTo({ top: Math.max(targetTop, 0), behavior: "smooth" })
  }

  function paintMatches(nextActiveIndex: number) {
    if (!viewportRef.current) {
      return
    }

    const marks = Array.from(viewportRef.current.querySelectorAll("mark.rf-pdf-match")) as HTMLElement[]
    setTotalMatches(marks.length)

    marks.forEach((mark, index) => {
      if (index === nextActiveIndex) {
        mark.className = "rf-pdf-match rounded-sm bg-rose-300 text-slate-900"
      } else {
        mark.className = "rf-pdf-match rounded-sm bg-amber-200 text-slate-900"
      }
    })
  }

  function goToMatch(nextIndex: number) {
    if (!viewportRef.current) {
      return
    }

    const marks = Array.from(viewportRef.current.querySelectorAll("mark.rf-pdf-match")) as HTMLElement[]
    if (marks.length === 0) {
      setActiveMatchIndex(-1)
      setTotalMatches(0)
      return
    }

    const normalizedIndex = ((nextIndex % marks.length) + marks.length) % marks.length
    setActiveMatchIndex(normalizedIndex)
    paintMatches(normalizedIndex)

    const target = marks[normalizedIndex]
    target.scrollIntoView({ block: "start", behavior: "smooth" })

    requestAnimationFrame(() => {
      if (!viewportRef.current) {
        return
      }
      viewportRef.current.scrollTop = Math.max(viewportRef.current.scrollTop - 72, 0)
    })
  }

  function onSearchEnter() {
    if (!searchQuery.trim()) {
      return
    }

    if (activeMatchIndex < 0) {
      const firstPageMatch = Object.entries(pageTextMap)
        .map(([page, text]) => ({ page: Number(page), text }))
        .sort((a, b) => a.page - b.page)
        .find(({ text }) => text.toLowerCase().includes(searchQuery.trim().toLowerCase()))

      if (firstPageMatch) {
        scrollPageIntoView(firstPageMatch.page)
      }
    }

    const next = activeMatchIndex < 0 ? 0 : activeMatchIndex + 1
    goToMatch(next)
  }

  function onPageTextSuccess(pageNumber: number, textContent: { items?: Array<{ str?: string }> }) {
    const text = (textContent.items ?? [])
      .map((item) => item.str ?? "")
      .join(" ")

    const hasText = (textContent.items ?? []).some((item) => (item.str ?? "").trim().length > 0)
    setPagesWithText((prev) => {
      if (prev[pageNumber] === hasText) {
        return prev
      }
      return { ...prev, [pageNumber]: hasText }
    })

    setPageTextMap((prev) => {
      if (prev[pageNumber] === text) {
        return prev
      }
      return { ...prev, [pageNumber]: text }
    })

    setTextLayerVersion((prev) => prev + 1)
  }

  function pdfSearch(text: string, query: string) {
    const normalizedQuery = query.trim()
    if (!normalizedQuery) {
      return text
    }

    const escapedQuery = normalizedQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const searchPattern = new RegExp(`(${escapedQuery})`, "gi")

    return text.replace(
      searchPattern,
      '<mark class="rf-pdf-match rounded-sm bg-amber-200 text-slate-900">$1</mark>',
    )
  }

  const customTextRenderer = useMemo(
    () => (textItem: { str: string }) => pdfSearch(textItem.str, searchQuery),
    [searchQuery],
  )

  useEffect(() => {
    if (!searchQuery.trim()) {
      setActiveMatchIndex(-1)
      setTotalMatches(0)
      return
    }

    const normalizedQuery = searchQuery.trim().toLowerCase()
    const firstMatchingPage = Object.entries(pageTextMap)
      .map(([page, text]) => ({ page: Number(page), text }))
      .sort((a, b) => a.page - b.page)
      .find(({ text }) => text.toLowerCase().includes(normalizedQuery))

    if (firstMatchingPage) {
      scrollPageIntoView(firstMatchingPage.page)
    }

    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null
    let attempts = 0

    const tryActivateFirstMatch = () => {
      if (cancelled || !viewportRef.current) {
        return
      }

      const marks = Array.from(viewportRef.current.querySelectorAll("mark.rf-pdf-match")) as HTMLElement[]
      if (marks.length > 0) {
        goToMatch(0)
        return
      }

      attempts += 1
      if (attempts < 80) {
        timer = setTimeout(tryActivateFirstMatch, 80)
      } else {
        setActiveMatchIndex(-1)
        setTotalMatches(0)
      }
    }

    timer = setTimeout(tryActivateFirstMatch, 0)

    return () => {
      cancelled = true
      if (timer) {
        clearTimeout(timer)
      }
    }
  }, [searchQuery, numPages, textLayerVersion, pageTextMap])

  const searchActive = searchQuery.trim().length > 0
  const searchablePageCount = Object.values(pagesWithText).filter(Boolean).length
  const showNoTextHint = allowSearch && searchActive && numPages > 0 && searchablePageCount === 0

  return (
    <div
      className={
        slotClasses?.container ??
        options?.className ??
        "group relative rounded-lg border border-slate-200 bg-white shadow-sm"
      }
    >
      <ViewerOverlayControls
        source={source}
        showDownload={allowDownload}
        showSearch={allowSearch}
        iconButtonClassName={slotClasses?.iconButton}
        searchInputClassName={slotClasses?.searchInput}
        searchValue={searchQuery}
        onSearchChange={(value) => {
          setSearchQuery(value)
          setActiveMatchIndex(-1)
        }}
        onSearchEnter={onSearchEnter}
        searchCounterText={totalMatches === 0 || activeMatchIndex < 0 ? `0/${totalMatches}` : `${activeMatchIndex + 1}/${totalMatches}`}
      />

      <div
        ref={viewportRef}
        className={
          slotClasses?.viewport ?? "max-h-[80vh] space-y-4 overflow-auto rounded-lg bg-slate-100 p-4"
        }
      >
        {showNoTextHint ? (
          <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            This PDF appears to have no selectable text (likely scanned/image-based), so search highlight cannot run.
          </div>
        ) : null}
        <Document
          file={source}
          onLoadSuccess={onLoadSuccess}
          loading={<div className="p-4 text-sm">Loading PDF...</div>}
        >
          {Array.from({ length: numPages }, (_, index) => (
            <div
              key={`page-container-${index + 1}`}
              ref={(node) => {
                pageContainerRefs.current[index + 1] = node
              }}
            >
              <Page
                key={`page-${index + 1}`}
                pageNumber={index + 1}
                width={900}
                renderTextLayer
                renderAnnotationLayer
                className={slotClasses?.page}
                customTextRenderer={customTextRenderer}
                onGetTextSuccess={(textContent) => onPageTextSuccess(index + 1, textContent as { items?: Array<{ str?: string }> })}
              />
            </div>
          ))}
        </Document>
      </div>
    </div>
  )
}
