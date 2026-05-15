import { useEffect, useMemo, useRef, useState, type WheelEvent } from "react"
import { Document, Page, pdfjs } from "react-pdf"
import { createWorker } from "tesseract.js"
import { ViewerOverlayControls } from "../../components/ViewerOverlayControls"
import { getDocumentWidth, getScaledPageSize, type Size } from "../../components/document/documentSizing"
import {
  buildPagedItemMatches,
  buildPagedTextMatches,
  highlightSearchText,
  type PagedTextSearchMatch,
} from "../../components/highlights/pagedTextSearch"
import { usePagedNavigation } from "../../components/pages/usePagedNavigation"
import { Card } from "../../components/ui/card"
import { useElementSize } from "../../components/viewport/useElementSize"
import { useZoomPan } from "../../components/viewport/useZoomPan"
import type { BaseRendererProps } from "../../types"

import "react-pdf/dist/Page/AnnotationLayer.css"
import "react-pdf/dist/Page/TextLayer.css"

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

type LoadSuccessData = {
  numPages: number
}

type PdfPageSize = Size

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

type PdfSearchMatch = PagedTextSearchMatch<"pdf" | "ocr">

type OcrStatus = "idle" | "running" | "done" | "error"

type OcrWordBox = {
  text: string
  left: number
  top: number
  width: number
  height: number
}

function getTextItemString(item: unknown) {
  return typeof item === "object" && item !== null && "str" in item && typeof item.str === "string" ? item.str : ""
}

export function PdfRenderer({ source, options }: BaseRendererProps) {
  const [numPages, setNumPages] = useState(0)
  const [searchQuery, setSearchQuery] = useState("")
  const [pagesWithText, setPagesWithText] = useState<Record<number, boolean>>({})
  const [pageTextMap, setPageTextMap] = useState<Record<number, string>>({})
  const [textLayerVersion, setTextLayerVersion] = useState(0)
  const [activeMatchIndex, setActiveMatchIndex] = useState(-1)
  const [pageSize, setPageSize] = useState<PdfPageSize | null>(null)
  const [ocrStatus, setOcrStatus] = useState<OcrStatus>("idle")
  const [ocrPage, setOcrPage] = useState(0)
  const [ocrWordMap, setOcrWordMap] = useState<Record<number, OcrWordBox[]>>({})
  const textLoadIdRef = useRef(0)
  const viewport = useElementSize<HTMLDivElement>()
  const zoomPan = useZoomPan()

  const allowDownload = options?.allowDownload ?? false
  const allowSearch = options?.allowSearch ?? false
  const slotClasses = options?.slotClasses
  const theme = options?.theme ?? "light"
  const isDark = theme === "dark"
  const documentSize = options?.documentSize ?? "normal"
  const pagedNavigation = usePagedNavigation({ totalPages: numPages })
  const currentPage = pagedNavigation.currentPage

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
    pagedNavigation.reset(1)
    setPagesWithText({})
    setPageTextMap({})
    setTextLayerVersion(0)
    setActiveMatchIndex(-1)
    setPageSize(null)
    zoomPan.resetView()
    setOcrStatus("idle")
    setOcrPage(0)
    setOcrWordMap({})

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
    if (!viewport.elementRef.current) {
      return
    }

    const marks = Array.from(viewport.elementRef.current.querySelectorAll("mark.rf-pdf-match")) as HTMLElement[]

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
    if (!element || !zoomPan.viewportRef.current) {
      return
    }

    const markRect = element.getBoundingClientRect()
    const canvasRect = zoomPan.viewportRef.current.getBoundingClientRect()
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

    zoomPan.setPanOffset((prev) => ({
      x: prev.x + canvasCenterX - markCenterX,
      y: prev.y + canvasCenterY - markCenterY,
    }))
  }

  function paintOcrMatch(matchIndex: number) {
    if (!viewport.elementRef.current) {
      return
    }

    const marks = Array.from(viewport.elementRef.current.querySelectorAll("[data-rf-ocr-match]")) as HTMLElement[]
    marks.forEach((mark) => {
      mark.className = "absolute rounded-sm bg-amber-200/70 mix-blend-multiply"
    })

    const activeMark = viewport.elementRef.current.querySelector(`[data-rf-ocr-match="${matchIndex}"]`) as HTMLElement | null
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

  function changePage(nextPage: number) {
    setActiveMatchIndex(-1)
    pagedNavigation.goToPage(nextPage)
  }

  function onCanvasWheel(event: WheelEvent<HTMLDivElement>) {
    if (event.ctrlKey) {
      zoomPan.handlers.onWheel(event)
      return
    }

    event.preventDefault()

    if (numPages <= 1) {
      return
    }

    const pageStride = Math.max((renderedPageSize?.height ?? viewport.size?.height ?? 700) + 24, 1)
    setActiveMatchIndex(-1)
    pagedNavigation.scrollBy(event.deltaY, pageStride)
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

  const customTextRenderer = useMemo(
    () => (textItem: { str: string }) =>
      highlightSearchText(textItem.str, searchQuery, "rf-pdf-match rounded-sm bg-amber-200 text-slate-900"),
    [searchQuery],
  )

  const globalMatches = useMemo<PdfSearchMatch[]>(() => {
    const ocrMatches = buildPagedItemMatches(ocrWordMap, searchQuery, "ocr")

    if (ocrMatches.length > 0) {
      return ocrMatches
    }

    return buildPagedTextMatches(pageTextMap, searchQuery, "pdf")
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
      pagedNavigation.reset(match.pageNumber)
      return
    }

    if (match.source === "ocr") {
      paintOcrMatch(normalizedIndex)
    } else {
      paintMatches(match.pageMatchIndex)
    }
  }

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
      pagedNavigation.reset(activeMatch.pageNumber)
      return
    }

    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null
    let attempts = 0

    const tryActivateFirstMatch = () => {
      if (cancelled || !viewport.elementRef.current) {
        return
      }

      if (activeMatch.source === "ocr") {
        const activeOcrMark = viewport.elementRef.current.querySelector(`[data-rf-ocr-match="${normalizedActiveIndex}"]`)
        if (activeOcrMark) {
          paintOcrMatch(normalizedActiveIndex)
          return
        }
      }

      const marks = Array.from(viewport.elementRef.current.querySelectorAll("mark.rf-pdf-match")) as HTMLElement[]
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

  const searchablePageCount = Object.values(pagesWithText).filter(Boolean).length
  const searchDisabled = allowSearch && numPages > 0 && (ocrStatus === "error" || (ocrStatus === "done" && searchablePageCount === 0))
  const pageScale = pageSize ? getDocumentWidth(documentSize) / pageSize.width : undefined
  const renderedPageSize = useMemo(() => getScaledPageSize(pageSize, documentSize), [documentSize, pageSize])
  const renderedPageGap = 0
  const controlsCompact = renderedPageSize.width < 560 || renderedPageSize.height < 460

  const currentPageOcrHighlights = globalMatches
    .map((match, matchIndex) => ({ ...match, matchIndex }))
    .filter((match) => match.source === "ocr" && match.pageNumber === currentPage && match.itemIndex !== undefined)

  return (
    <Card
      className={
        slotClasses?.container ??
        options?.className ??
        (isDark
          ? "group relative overflow-hidden rounded-lg border border-neutral-700 bg-neutral-800 text-neutral-100 shadow-sm"
          : "group relative overflow-hidden rounded-lg border border-slate-200 bg-white text-slate-950 shadow-sm")
      }
      style={
        slotClasses?.container || options?.className
          ? undefined
          : {
              width: renderedPageSize.width,
              height: renderedPageSize.height,
            }
      }
    >
      <ViewerOverlayControls
        source={source}
        theme={theme}
        compact={controlsCompact}
        showDownload={allowDownload}
        showSearch={allowSearch}
        searchDisabled={searchDisabled}
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
        resetDisabled={zoomPan.isViewReset}
        onReset={zoomPan.resetView}
        showPagination={numPages > 1}
        paginationPlacement="left-center"
        currentPage={currentPage}
        totalPages={numPages}
        onPreviousPage={() => {
          changePage(currentPage - 1)
        }}
        onNextPage={() => {
          changePage(currentPage + 1)
        }}
        onPageChange={(page) => {
          changePage(page)
        }}
      />

      <div
        ref={viewport.setElementRef}
        className={
          slotClasses?.viewport ??
          (isDark
            ? "h-full w-full touch-none overscroll-contain overflow-hidden rounded-lg bg-neutral-800"
            : "h-full w-full touch-none overscroll-contain overflow-hidden rounded-lg bg-white")
        }
      >
        <Document
          file={source}
          onLoadSuccess={onLoadSuccess}
          loading={<div className={isDark ? "p-4 text-sm text-neutral-300" : "p-4 text-sm text-slate-700"}>Loading PDF...</div>}
          className="h-full"
        >
          {numPages > 0 ? (
            <div className="relative flex h-full items-center justify-center">
              <div
                ref={zoomPan.setViewportRef}
                className="relative h-full w-full touch-none overflow-hidden cursor-grab active:cursor-grabbing"
                {...zoomPan.handlers}
                onWheel={onCanvasWheel}
              >
                <div
                  className="absolute left-1/2 top-1/2 min-h-0 min-w-0 select-none"
                  style={{ transform: `translate(calc(-50% + ${zoomPan.panOffset.x}px), calc(-50% + ${zoomPan.panOffset.y}px))` }}
                >
                  <div
                    className="relative min-h-0 min-w-0 overflow-hidden shadow-sm"
                    style={{
                      width: renderedPageSize?.width,
                      height: renderedPageSize?.height,
                      transform: `scale(${zoomPan.zoom})`,
                      transformOrigin: "center",
                    }}
                  >
                    {pagedNavigation.visiblePages.map((pageNumber) => (
                      <div
                        key={`page-${pageNumber}`}
                        className={
                          pagedNavigation.isScrolling
                            ? pagedNavigation.snapActive
                              ? "absolute left-0 top-0 transition-transform duration-200 ease-out will-change-transform"
                              : "absolute left-0 top-0 will-change-transform"
                            : "relative"
                        }
                        style={{
                          transform: pagedNavigation.isScrolling
                            ? `translateY(${(pageNumber - pagedNavigation.scrollPosition) * ((renderedPageSize?.height ?? 0) + renderedPageGap)}px)`
                            : "translateY(0)",
                        }}
                      >
                        <Page
                          pageNumber={pageNumber}
                          scale={pageScale}
                          loading={null}
                          renderTextLayer
                          renderAnnotationLayer
                          className={slotClasses?.page}
                          customTextRenderer={customTextRenderer}
                          onLoadSuccess={(page) => setPageSize(page.getViewport({ scale: 1 }))}
                          onGetTextSuccess={(textContent) => onPageTextSuccess(pageNumber, textContent as PdfTextContent)}
                        />
                      </div>
                    ))}
                    {!pagedNavigation.isScrolling && currentPageOcrHighlights.length > 0 ? (
                      <div className="pointer-events-none absolute inset-0 z-10">
                        {currentPageOcrHighlights.map((match) => {
                          const word = ocrWordMap[currentPage]?.[match.itemIndex ?? -1]
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
