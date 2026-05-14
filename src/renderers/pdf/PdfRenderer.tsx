import { useEffect, useMemo, useRef, useState, type WheelEvent } from "react"
import { Document, Page, pdfjs } from "react-pdf"
import { createWorker } from "tesseract.js"
import { ViewerOverlayControls } from "../../components/ViewerOverlayControls"
import { Alert } from "../../components/ui/alert"
import { Card } from "../../components/ui/card"
import { useViewerCanvas } from "../../hooks/useViewerCanvas"
import type { BaseRendererProps } from "../../types"

import "react-pdf/dist/Page/AnnotationLayer.css"
import "react-pdf/dist/Page/TextLayer.css"

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

type LoadSuccessData = {
  numPages: number
}

type PdfPageSize = {
  width: number
  height: number
}

type PdfTextContent = {
  items?: unknown[]
}

type PdfPageProxy = {
  getViewport: (options: { scale: number }) => PdfPageSize
  getTextContent: () => Promise<PdfTextContent>
  render: (options: any) => { promise: Promise<unknown> }
}

type PdfDocumentProxy = LoadSuccessData & {
  getPage: (pageNumber: number) => Promise<PdfPageProxy>
}

type PdfSearchMatch = {
  pageNumber: number
  pageMatchIndex: number
  source: "pdf" | "ocr"
  ocrWordIndex?: number
}

type OcrStatus = "idle" | "running" | "done" | "error"

type OcrWordBox = {
  text: string
  left: number
  top: number
  width: number
  height: number
}

type PageSlideTransition = {
  fromPage: number
  toPage: number
  direction: 1 | -1
  duration: number
}

function getTextItemString(item: unknown) {
  return typeof item === "object" && item !== null && "str" in item && typeof item.str === "string" ? item.str : ""
}

export function PdfRenderer({ source, options }: BaseRendererProps) {
  const [numPages, setNumPages] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState("")
  const [pagesWithText, setPagesWithText] = useState<Record<number, boolean>>({})
  const [pageTextMap, setPageTextMap] = useState<Record<number, string>>({})
  const [textLayerVersion, setTextLayerVersion] = useState(0)
  const [activeMatchIndex, setActiveMatchIndex] = useState(-1)
  const [viewportSize, setViewportSize] = useState<PdfPageSize | null>(null)
  const [pageSize, setPageSize] = useState<PdfPageSize | null>(null)
  const [ocrStatus, setOcrStatus] = useState<OcrStatus>("idle")
  const [ocrPage, setOcrPage] = useState(0)
  const [ocrWordMap, setOcrWordMap] = useState<Record<number, OcrWordBox[]>>({})
  const [pageSlideTransition, setPageSlideTransition] = useState<PageSlideTransition | null>(null)
  const [pageSlideActive, setPageSlideActive] = useState(false)
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const textLoadIdRef = useRef(0)
  const horizontalWheelRef = useRef<{ delta: number; timer: ReturnType<typeof setTimeout> | null }>({
    delta: 0,
    timer: null,
  })
  const pageSlideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { canvasRef, zoom, panOffset, setPanOffset, resetCanvasView, isCanvasReset, canvasHandlers } = useViewerCanvas()

  const allowDownload = options?.allowDownload ?? false
  const allowSearch = options?.allowSearch ?? false
  const slotClasses = options?.slotClasses

  function getTextFromContent(textContent: PdfTextContent) {
    return (textContent.items ?? [])
      .map(getTextItemString)
      .join(" ")
  }

  function onLoadSuccess(pdf: PdfDocumentProxy) {
    const loadedPages = pdf.numPages
    const loadId = textLoadIdRef.current + 1
    textLoadIdRef.current = loadId

    setNumPages(loadedPages)
    setCurrentPage(1)
    setPagesWithText({})
    setPageTextMap({})
    setTextLayerVersion(0)
    setActiveMatchIndex(-1)
    setPageSize(null)
    resetCanvasView()
    setOcrStatus("idle")
    setOcrPage(0)
    setOcrWordMap({})
    setPageSlideTransition(null)
    setPageSlideActive(false)

    Promise.all(
      Array.from({ length: loadedPages }, async (_, index) => {
        const pageNumber = index + 1
        const page = await pdf.getPage(pageNumber)
        const textContent = await page.getTextContent()
        const text = getTextFromContent(textContent)
        const hasText = (textContent.items ?? []).some((item) => getTextItemString(item).trim().length > 0)
        return { pageNumber, text, hasText }
      }),
    ).then((pageTexts) => {
      if (textLoadIdRef.current !== loadId) {
        return
      }

      setPagesWithText(
        pageTexts.reduce<Record<number, boolean>>((acc, { pageNumber, hasText }) => {
          acc[pageNumber] = hasText
          return acc
        }, {}),
      )
      setPageTextMap(
        pageTexts.reduce<Record<number, string>>((acc, { pageNumber, text }) => {
          acc[pageNumber] = text
          return acc
        }, {}),
      )

      if (!pageTexts.some(({ hasText }) => hasText)) {
        runOcrFallback(pdf, loadedPages, loadId)
      }
    })
  }

  async function runOcrFallback(pdf: PdfDocumentProxy, loadedPages: number, loadId: number) {
    if (typeof document === "undefined") {
      return
    }

    setOcrStatus("running")
    setOcrPage(0)

    try {
      const ocrTexts: Record<number, string> = {}
      const ocrWordsByPage: Record<number, OcrWordBox[]> = {}
      const worker = await createWorker("eng")

      try {
        for (let pageNumber = 1; pageNumber <= loadedPages; pageNumber += 1) {
          if (textLoadIdRef.current !== loadId) {
            return
          }

          setOcrPage(pageNumber)
          const page = await pdf.getPage(pageNumber)
          const viewport = page.getViewport({ scale: 2 })
          const canvas = document.createElement("canvas")
          const context = canvas.getContext("2d")

          if (!context) {
            continue
          }

          canvas.width = Math.ceil(viewport.width)
          canvas.height = Math.ceil(viewport.height)
          await page.render({ canvasContext: context, viewport }).promise

          const result = await worker.recognize(canvas, {}, { blocks: true, text: true })
          const words = (result.data.blocks ?? [])
            .flatMap((block) => block.paragraphs)
            .flatMap((paragraph) => paragraph.lines)
            .flatMap((line) => line.words)
            .filter((word) => word.text.trim().length > 0)

          ocrTexts[pageNumber] = words.length > 0 ? words.map((word) => word.text).join(" ") : result.data.text.trim()
          ocrWordsByPage[pageNumber] = words.map((word) => ({
            text: word.text,
            left: (word.bbox.x0 / canvas.width) * 100,
            top: (word.bbox.y0 / canvas.height) * 100,
            width: ((word.bbox.x1 - word.bbox.x0) / canvas.width) * 100,
            height: ((word.bbox.y1 - word.bbox.y0) / canvas.height) * 100,
          }))
        }
      } finally {
        await worker.terminate()
      }

      if (textLoadIdRef.current !== loadId) {
        return
      }

      setPageTextMap(ocrTexts)
      setOcrWordMap(ocrWordsByPage)
      setPagesWithText(
        Object.entries(ocrTexts).reduce<Record<number, boolean>>((acc, [pageNumber, text]) => {
          acc[Number(pageNumber)] = text.trim().length > 0
          return acc
        }, {}),
      )
      setOcrStatus("done")
    } catch {
      if (textLoadIdRef.current === loadId) {
        setOcrStatus("error")
      }
    }
  }

  function paintMatches(nextActiveIndex: number) {
    if (!viewportRef.current) {
      return
    }

    const marks = Array.from(viewportRef.current.querySelectorAll("mark.rf-pdf-match")) as HTMLElement[]

    marks.forEach((mark, index) => {
      if (index === nextActiveIndex) {
        mark.className = "rf-pdf-match rounded-sm bg-rose-300 text-slate-900"
      } else {
        mark.className = "rf-pdf-match rounded-sm bg-amber-200 text-slate-900"
      }
    })

    centerElementIfNeeded(marks[nextActiveIndex])
  }

  function centerElementIfNeeded(element?: HTMLElement | null) {
    if (!element || !canvasRef.current) {
      return
    }

    const markRect = element.getBoundingClientRect()
    const canvasRect = canvasRef.current.getBoundingClientRect()
    const isVisible =
      markRect.left >= canvasRect.left &&
      markRect.right <= canvasRect.right &&
      markRect.top >= canvasRect.top &&
      markRect.bottom <= canvasRect.bottom

    if (isVisible) {
      return
    }

    const markCenterX = markRect.left + markRect.width / 2
    const markCenterY = markRect.top + markRect.height / 2
    const canvasCenterX = canvasRect.left + canvasRect.width / 2
    const canvasCenterY = canvasRect.top + canvasRect.height / 2

    setPanOffset((prev) => ({
      x: prev.x + canvasCenterX - markCenterX,
      y: prev.y + canvasCenterY - markCenterY,
    }))
  }

  function paintOcrMatch(matchIndex: number) {
    if (!viewportRef.current) {
      return
    }

    const marks = Array.from(viewportRef.current.querySelectorAll("[data-rf-ocr-match]")) as HTMLElement[]
    marks.forEach((mark) => {
      mark.className = "absolute rounded-sm bg-amber-200/70 mix-blend-multiply"
    })

    const activeMark = viewportRef.current.querySelector(`[data-rf-ocr-match="${matchIndex}"]`) as HTMLElement | null
    if (activeMark) {
      activeMark.className = "absolute rounded-sm bg-rose-300/75 mix-blend-multiply"
      centerElementIfNeeded(activeMark)
    }
  }

  function onSearchEnter() {
    if (!searchQuery.trim()) {
      return
    }

    activateMatch(activeMatchIndex < 0 ? 0 : activeMatchIndex + 1)
  }

  function changePage(nextPage: number, direction?: 1 | -1, wheelVelocity = 0) {
    const boundedPage = Math.min(Math.max(nextPage, 1), numPages)
    if (boundedPage === currentPage || pageSlideTransition) {
      return
    }

    setActiveMatchIndex(-1)

    const slideDirection = direction ?? (boundedPage > currentPage ? 1 : -1)
    const duration = Math.round(Math.min(Math.max(420 - Math.abs(wheelVelocity) * 1.4, 180), 360))

    if (pageSlideTimerRef.current) {
      clearTimeout(pageSlideTimerRef.current)
    }

    setPageSlideTransition({
      fromPage: currentPage,
      toPage: boundedPage,
      direction: slideDirection,
      duration,
    })
    setPageSlideActive(false)
    setCurrentPage(boundedPage)

    requestAnimationFrame(() => {
      setPageSlideActive(true)
    })

    pageSlideTimerRef.current = setTimeout(() => {
      setPageSlideTransition(null)
      setPageSlideActive(false)
      pageSlideTimerRef.current = null
    }, duration)
  }

  function onCanvasWheel(event: WheelEvent<HTMLDivElement>) {
    const horizontalIntent = Math.abs(event.deltaX) > Math.abs(event.deltaY) * 1.15 && Math.abs(event.deltaX) > 4

    if (horizontalIntent && numPages > 1) {
      event.preventDefault()

      if (horizontalWheelRef.current.timer) {
        clearTimeout(horizontalWheelRef.current.timer)
      }

      horizontalWheelRef.current.delta += event.deltaX
      const wheelDelta = horizontalWheelRef.current.delta
      const wheelThreshold = 72

      if (Math.abs(wheelDelta) >= wheelThreshold) {
        const direction = wheelDelta > 0 ? 1 : -1
        horizontalWheelRef.current.delta = 0
        changePage(currentPage + direction, direction, Math.abs(wheelDelta))
        return
      }

      horizontalWheelRef.current.timer = setTimeout(() => {
        horizontalWheelRef.current.delta = 0
        horizontalWheelRef.current.timer = null
      }, 140)
      return
    }

    canvasHandlers.onWheel(event)
  }

  function onPageTextSuccess(pageNumber: number, textContent: PdfTextContent) {
    const text = getTextFromContent(textContent)

    const hasText = (textContent.items ?? []).some((item) => getTextItemString(item).trim().length > 0)
    setPagesWithText((prev) => {
      if (!hasText && prev[pageNumber]) {
        return prev
      }
      if (prev[pageNumber] === hasText) {
        return prev
      }
      return { ...prev, [pageNumber]: hasText }
    })

    setPageTextMap((prev) => {
      if (!hasText && prev[pageNumber]) {
        return prev
      }
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

  const globalMatches = useMemo<PdfSearchMatch[]>(() => {
    const normalizedQuery = searchQuery.trim()
    if (!normalizedQuery) {
      return []
    }

    const ocrMatches = Object.entries(ocrWordMap)
      .map(([page, words]) => ({ pageNumber: Number(page), words }))
      .sort((a, b) => a.pageNumber - b.pageNumber)
      .flatMap(({ pageNumber, words }) =>
        words.flatMap((word, wordIndex) =>
          word.text.toLowerCase().includes(normalizedQuery.toLowerCase())
            ? [{ pageNumber, pageMatchIndex: wordIndex, source: "ocr" as const, ocrWordIndex: wordIndex }]
            : [],
        ),
      )

    if (ocrMatches.length > 0) {
      return ocrMatches
    }

    const escapedQuery = normalizedQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const searchPattern = new RegExp(escapedQuery, "gi")

    return Object.entries(pageTextMap)
      .map(([page, text]) => ({ pageNumber: Number(page), text }))
      .sort((a, b) => a.pageNumber - b.pageNumber)
      .flatMap(({ pageNumber, text }) => {
        const matches = Array.from(text.matchAll(searchPattern))
        return matches.map((_, pageMatchIndex) => ({ pageNumber, pageMatchIndex, source: "pdf" as const }))
      })
  }, [ocrWordMap, pageTextMap, searchQuery])

  function activateMatch(nextIndex: number) {
    if (globalMatches.length === 0) {
      setActiveMatchIndex(-1)
      return
    }

    const normalizedIndex = ((nextIndex % globalMatches.length) + globalMatches.length) % globalMatches.length
    const match = globalMatches[normalizedIndex]
    setActiveMatchIndex(normalizedIndex)

    if (match.pageNumber !== currentPage) {
      setCurrentPage(match.pageNumber)
      return
    }

    if (match.source === "ocr") {
      paintOcrMatch(normalizedIndex)
    } else {
      paintMatches(match.pageMatchIndex)
    }
  }

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) {
      return
    }

    function updateViewportSize() {
      if (!viewport) {
        return
      }
      setViewportSize({ width: viewport.clientWidth, height: viewport.clientHeight })
    }

    updateViewportSize()
    const observer = new ResizeObserver(updateViewportSize)
    observer.observe(viewport)

    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    return () => {
      if (horizontalWheelRef.current.timer) {
        clearTimeout(horizontalWheelRef.current.timer)
      }
      if (pageSlideTimerRef.current) {
        clearTimeout(pageSlideTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!searchQuery.trim()) {
      setActiveMatchIndex(-1)
      return
    }

    if (globalMatches.length === 0) {
      return
    }

    if (activeMatchIndex < 0) {
      return
    }

    const normalizedActiveIndex =
      activeMatchIndex < globalMatches.length ? activeMatchIndex : 0
    const activeMatch = globalMatches[normalizedActiveIndex]

    if (activeMatchIndex !== normalizedActiveIndex) {
      setActiveMatchIndex(normalizedActiveIndex)
    }

    if (activeMatch.pageNumber !== currentPage) {
      setCurrentPage(activeMatch.pageNumber)
      return
    }

    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null
    let attempts = 0

    const tryActivateFirstMatch = () => {
      if (cancelled || !viewportRef.current) {
        return
      }

      if (activeMatch.source === "ocr") {
        const activeOcrMark = viewportRef.current.querySelector(`[data-rf-ocr-match="${normalizedActiveIndex}"]`)
        if (activeOcrMark) {
          paintOcrMatch(normalizedActiveIndex)
          return
        }
      }

      const marks = Array.from(viewportRef.current.querySelectorAll("mark.rf-pdf-match")) as HTMLElement[]
      if (activeMatch.source === "pdf" && marks.length > activeMatch.pageMatchIndex) {
        paintMatches(activeMatch.pageMatchIndex)
        return
      }

      attempts += 1
      if (attempts < 80) {
        timer = setTimeout(tryActivateFirstMatch, 80)
      }
    }

    timer = setTimeout(tryActivateFirstMatch, 0)

    return () => {
      cancelled = true
      if (timer) {
        clearTimeout(timer)
      }
    }
  }, [searchQuery, numPages, textLayerVersion, globalMatches, currentPage, activeMatchIndex])

  const searchActive = searchQuery.trim().length > 0
  const searchablePageCount = Object.values(pagesWithText).filter(Boolean).length
  const ocrHint = (() => {
    if (!allowSearch || numPages === 0) {
      return null
    }

    if (ocrStatus === "running") {
      return `No selectable PDF text found. Running OCR fallback${ocrPage > 0 ? ` on page ${ocrPage}/${numPages}` : ""}...`
    }

    if (ocrStatus === "error" && searchActive) {
      return "This PDF appears scanned, and OCR failed. Search may not work for this file."
    }

    if (ocrStatus === "done" && searchActive && searchablePageCount === 0) {
      return "OCR finished, but no searchable text was found in this PDF."
    }

    return null
  })()
  const pageScale = useMemo(() => {
    if (!viewportSize || !pageSize) {
      return undefined
    }

    const availableWidth = Math.max(viewportSize.width - 32, 1)
    const availableHeight = Math.max(viewportSize.height - 96, 1)
    return Math.min(availableWidth / pageSize.width, availableHeight / pageSize.height)
  }, [pageSize, viewportSize])

  const currentPageOcrHighlights = globalMatches
    .map((match, matchIndex) => ({ ...match, matchIndex }))
    .filter((match) => match.source === "ocr" && match.pageNumber === currentPage && match.ocrWordIndex !== undefined)

  return (
    <Card
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
          setActiveMatchIndex(value.trim() ? 0 : -1)
        }}
        onSearchEnter={onSearchEnter}
        searchCounterText={globalMatches.length === 0 || activeMatchIndex < 0 ? `0/${globalMatches.length}` : `${activeMatchIndex + 1}/${globalMatches.length}`}
        showReset
        resetDisabled={isCanvasReset}
        onReset={resetCanvasView}
        showPagination={numPages > 1}
        currentPage={currentPage}
        totalPages={numPages}
        onPreviousPage={() => {
          changePage(currentPage - 1, -1)
        }}
        onNextPage={() => {
          changePage(currentPage + 1, 1)
        }}
        onPageChange={(page) => {
          changePage(page)
        }}
      />

      <div
        ref={viewportRef}
        className={
          slotClasses?.viewport ?? "h-[80vh] max-h-[80vh] overflow-hidden rounded-lg bg-slate-100 p-4"
        }
      >
        {ocrHint ? (
          <Alert variant="warning" className="mb-3 rounded-md px-3 py-2 text-xs">
            {ocrHint}
          </Alert>
        ) : null}
        <Document
          file={source}
          onLoadSuccess={onLoadSuccess}
          loading={<div className="p-4 text-sm">Loading PDF...</div>}
          className="h-full"
        >
          {numPages > 0 ? (
            <div className="relative flex h-full items-center justify-center">
              <div
                ref={canvasRef}
                className="relative h-full w-full touch-none overflow-hidden cursor-grab active:cursor-grabbing"
                {...canvasHandlers}
                onWheel={onCanvasWheel}
              >
                <div
                  className="absolute left-1/2 top-1/2 min-h-0 min-w-0 select-none"
                  style={{ transform: `translate(calc(-50% + ${panOffset.x}px), calc(-50% + ${panOffset.y}px))` }}
                >
                  <div
                    className="relative min-h-0 min-w-0 overflow-hidden shadow-sm"
                    style={{ transform: `scale(${zoom})`, transformOrigin: "center" }}
                  >
                    {pageSlideTransition ? (
                      <div
                        className="absolute left-0 top-0 transition-transform ease-out will-change-transform"
                        style={{
                          transitionDuration: `${pageSlideTransition.duration}ms`,
                          transform: pageSlideActive
                            ? `translateX(${-pageSlideTransition.direction * 112}%)`
                            : "translateX(0%)",
                        }}
                      >
                        <Page
                          key={`page-${pageSlideTransition.fromPage}`}
                          pageNumber={pageSlideTransition.fromPage}
                          scale={pageScale}
                          renderTextLayer
                          renderAnnotationLayer
                          className={slotClasses?.page}
                          customTextRenderer={customTextRenderer}
                        />
                      </div>
                    ) : null}
                    <div
                      className={pageSlideTransition ? "transition-transform ease-out will-change-transform" : undefined}
                      style={{
                        transitionDuration: pageSlideTransition ? `${pageSlideTransition.duration}ms` : undefined,
                        transform: pageSlideTransition
                          ? pageSlideActive
                            ? "translateX(0%)"
                            : `translateX(${pageSlideTransition.direction * 112}%)`
                          : "translateX(0%)",
                      }}
                    >
                      <Page
                        key={`page-${currentPage}`}
                        pageNumber={currentPage}
                        scale={pageScale}
                        renderTextLayer
                        renderAnnotationLayer
                        className={slotClasses?.page}
                        customTextRenderer={customTextRenderer}
                        onLoadSuccess={(page) => setPageSize(page.getViewport({ scale: 1 }))}
                        onGetTextSuccess={(textContent) => onPageTextSuccess(currentPage, textContent as PdfTextContent)}
                      />
                    </div>
                    {!pageSlideTransition && currentPageOcrHighlights.length > 0 ? (
                      <div className="pointer-events-none absolute inset-0 z-10">
                        {currentPageOcrHighlights.map((match) => {
                          const word = ocrWordMap[currentPage]?.[match.ocrWordIndex ?? -1]
                          if (!word) {
                            return null
                          }

                          return (
                            <div
                              key={`ocr-match-${match.matchIndex}`}
                              data-rf-ocr-match={match.matchIndex}
                              className={
                                match.matchIndex === activeMatchIndex
                                  ? "absolute rounded-sm bg-rose-300/75 mix-blend-multiply"
                                  : "absolute rounded-sm bg-amber-200/70 mix-blend-multiply"
                              }
                              style={{
                                left: `${word.left}%`,
                                top: `${word.top}%`,
                                width: `${word.width}%`,
                                height: `${word.height}%`,
                              }}
                            />
                          )
                        })}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

            </div>
          ) : null}
        </Document>
      </div>
    </Card>
  )
}
