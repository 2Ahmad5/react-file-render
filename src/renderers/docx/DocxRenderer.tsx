import { useEffect, useMemo, useRef, useState, type WheelEvent } from "react"
import { renderAsync } from "docx-preview"
import { ViewerOverlayControls } from "../../components/ViewerOverlayControls"
import { fallbackPageAspectRatio, getDocumentWidth, getScaledPageSize, type Size } from "../../components/document/documentSizing"
import { buildPagedTextMatches, getSearchPattern, type PagedTextSearchMatch } from "../../components/highlights/pagedTextSearch"
import { usePagedNavigation } from "../../components/pages/usePagedNavigation"
import { Card } from "../../components/ui/card"
import { useZoomPan } from "../../components/viewport/useZoomPan"
import type { BaseRendererProps } from "../../types"

type DocxPageSize = Size

type DocxSearchMatch = PagedTextSearchMatch<"docx">

type DocxPageMode = "sections" | "virtual"

function getDocxSections(container: HTMLElement) {
  const wrapperSections = Array.from(
    container.querySelectorAll(".rf-docx-wrapper > section.rf-docx, .docx-wrapper > section.docx"),
  ) as HTMLElement[]
  if (wrapperSections.length > 0) {
    return wrapperSections
  }

  return Array.from(container.querySelectorAll("section")) as HTMLElement[]
}

function normalizeDocxLayout(container: HTMLElement) {
  const wrapper = container.querySelector(".rf-docx-wrapper, .docx-wrapper") as HTMLElement | null
  if (wrapper) {
    wrapper.style.background = "transparent"
    wrapper.style.padding = "0"
    wrapper.style.display = "block"
    wrapper.style.position = "relative"
    wrapper.style.overflow = "visible"
  }

  getDocxSections(container).forEach((section) => {
    section.style.margin = "0"
    section.style.boxShadow = "none"
  })
}

function splitTextIntoPages(text: string, pageCount: number) {
  if (pageCount <= 1) {
    return { 1: text }
  }

  const words = text.split(/(\s+)/)
  const targetLength = Math.ceil(text.length / pageCount)
  const pages: Record<number, string> = {}
  let pageNumber = 1
  let currentText = ""

  words.forEach((word) => {
    if (pageNumber < pageCount && currentText.length >= targetLength && word.trim()) {
      pages[pageNumber] = currentText
      pageNumber += 1
      currentText = ""
    }

    currentText += word
  })

  pages[pageNumber] = currentText
  for (let page = pageNumber + 1; page <= pageCount; page += 1) {
    pages[page] = ""
  }

  return pages
}

function unwrapDocxMatches(container: HTMLElement) {
  Array.from(container.querySelectorAll("mark.rf-docx-match")).forEach((mark) => {
    const parent = mark.parentNode
    if (!parent) {
      return
    }

    parent.replaceChild(document.createTextNode(mark.textContent ?? ""), mark)
    parent.normalize()
  })
}

function highlightSection(section: HTMLElement, query: string) {
  const searchPattern = getSearchPattern(query, "gi")
  if (!searchPattern) {
    return
  }

  const textNodes: Text[] = []
  const walker = document.createTreeWalker(section, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement
      if (!parent || parent.closest("mark.rf-docx-match")) {
        return NodeFilter.FILTER_REJECT
      }
      searchPattern.lastIndex = 0
      return node.textContent && searchPattern.test(node.textContent) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
    },
  })

  while (walker.nextNode()) {
    textNodes.push(walker.currentNode as Text)
  }

  textNodes.forEach((textNode) => {
    const text = textNode.textContent ?? ""
    const fragment = document.createDocumentFragment()
    let lastIndex = 0
    const nodePattern = getSearchPattern(query, "gi")

    if (!nodePattern) {
      return
    }

    Array.from(text.matchAll(nodePattern)).forEach((match) => {
      const index = match.index ?? 0
      const value = match[0]

      if (index > lastIndex) {
        fragment.append(document.createTextNode(text.slice(lastIndex, index)))
      }

      const mark = document.createElement("mark")
      mark.className = "rf-docx-match rounded-sm bg-amber-200 text-slate-900"
      mark.textContent = value
      fragment.append(mark)
      lastIndex = index + value.length
    })

    if (lastIndex < text.length) {
      fragment.append(document.createTextNode(text.slice(lastIndex)))
    }

    textNode.replaceWith(fragment)
  })
}

export function DocxRenderer({ source, options }: BaseRendererProps) {
  const [numPages, setNumPages] = useState(0)
  const [sourceError, setSourceError] = useState<string | null>(null)
  const [pageSize, setPageSize] = useState<DocxPageSize | null>(null)
  const [pageTextMap, setPageTextMap] = useState<Record<number, string>>({})
  const [pageMode, setPageMode] = useState<DocxPageMode>("sections")
  const [searchQuery, setSearchQuery] = useState("")
  const [activeMatchIndex, setActiveMatchIndex] = useState(-1)
  const [textLayerVersion, setTextLayerVersion] = useState(0)
  const renderHostRef = useRef<HTMLDivElement | null>(null)
  const pageElementsRef = useRef<HTMLElement[]>([])
  const contentElementRef = useRef<HTMLElement | null>(null)
  const zoomPan = useZoomPan()

  const allowDownload = options?.allowDownload ?? false
  const allowSearch = options?.allowSearch ?? false
  const interactive = options?.interactive ?? true
  const slotClasses = options?.slotClasses
  const theme = options?.theme ?? "light"
  const isDark = theme === "dark"
  const documentSize = options?.documentSize ?? "normal"
  const pagedNavigation = usePagedNavigation({ totalPages: numPages })
  const currentPage = pagedNavigation.currentPage
  const targetWidth = getDocumentWidth(documentSize)
  const pageScale = pageSize ? targetWidth / pageSize.width : 1
  const renderedPageSize = useMemo(() => getScaledPageSize(pageSize, documentSize), [documentSize, pageSize])
  const controlsCompact = renderedPageSize.width < 560 || renderedPageSize.height < 460
  const globalMatches = useMemo<DocxSearchMatch[]>(
    () => buildPagedTextMatches(pageTextMap, searchQuery, "docx"),
    [pageTextMap, searchQuery],
  )

  function paintMatch(pageNumber: number, pageMatchIndex: number) {
    const section = pageMode === "virtual" ? contentElementRef.current : pageElementsRef.current[pageNumber - 1]
    if (!section) {
      return
    }

    const marks = Array.from(section.querySelectorAll("mark.rf-docx-match")) as HTMLElement[]
    const matchOffset = pageMode === "virtual"
      ? globalMatches.findIndex((match) => match.pageNumber === pageNumber && match.pageMatchIndex === pageMatchIndex)
      : pageMatchIndex

    marks.forEach((mark, index) => {
      mark.className =
        index === matchOffset
          ? "rf-docx-match rounded-sm bg-rose-300 text-slate-900"
          : "rf-docx-match rounded-sm bg-amber-200 text-slate-900"
    })
  }

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

    paintMatch(match.pageNumber, match.pageMatchIndex)
  }

  function onSearchEnter() {
    if (!searchQuery.trim()) {
      return
    }

    activateMatch(activeMatchIndex < 0 ? 0 : activeMatchIndex + 1)
  }

  function onCanvasWheel(event: WheelEvent<HTMLDivElement>) {
    if (!interactive) {
      return
    }

    if (event.ctrlKey) {
      zoomPan.handlers.onWheel(event)
      return
    }

    event.preventDefault()

    if (numPages <= 1) {
      return
    }

    pagedNavigation.scrollBy(event.deltaY, Math.max(renderedPageSize.height, 1))
  }

  function changePage(nextPage: number) {
    pagedNavigation.goToPage(nextPage)
  }

  useEffect(() => {
    const renderHost = renderHostRef.current
    if (!renderHost) {
      return
    }

    let cancelled = false
    const abortController = new AbortController()

    setSourceError(null)
    setNumPages(0)
    setPageSize(null)
    setPageTextMap({})
    setPageMode("sections")
    setActiveMatchIndex(-1)
    setTextLayerVersion(0)
    pageElementsRef.current = []
    contentElementRef.current = null
    pagedNavigation.reset(1)
    zoomPan.resetView()
    renderHost.replaceChildren()

    fetch(source, { signal: abortController.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Unable to load DOCX (${response.status})`)
        }
        return response.blob()
      })
      .then((blob) =>
        renderAsync(blob, renderHost, undefined, {
          breakPages: true,
          className: "rf-docx",
          ignoreHeight: false,
          ignoreWidth: false,
          inWrapper: true,
          renderFooters: true,
          renderHeaders: true,
        }),
      )
      .then(() => {
        if (cancelled) {
          return
        }

        normalizeDocxLayout(renderHost)
        const sections = getDocxSections(renderHost)
        const firstSection = sections[0]
        const measuredWidth = firstSection?.offsetWidth || getDocumentWidth(documentSize)
        const measuredHeight = firstSection?.offsetHeight || measuredWidth * fallbackPageAspectRatio
        const virtualPageHeight = measuredWidth * fallbackPageAspectRatio
        const nextPageMode = sections.length <= 1 && measuredHeight > virtualPageHeight * 1.15 ? "virtual" : "sections"
        const pageCount = nextPageMode === "virtual" ? Math.max(Math.ceil(measuredHeight / virtualPageHeight), 1) : Math.max(sections.length, 1)
        const pageTexts = nextPageMode === "virtual"
          ? splitTextIntoPages(firstSection?.textContent ?? "", pageCount)
          : sections.reduce<Record<number, string>>((acc, section, index) => {
              acc[index + 1] = section.textContent ?? ""
              return acc
            }, {})

        pageElementsRef.current = sections
        contentElementRef.current = firstSection ?? renderHost
        setPageMode(nextPageMode)
        setNumPages(pageCount)
        setPageTextMap(pageTexts)
        setPageSize({ width: measuredWidth, height: nextPageMode === "virtual" ? virtualPageHeight : measuredHeight })
        setTextLayerVersion((prev) => prev + 1)
      })
      .catch((error: unknown) => {
        if (cancelled || abortController.signal.aborted) {
          return
        }

        setSourceError(error instanceof Error ? error.message : "Unable to render DOCX")
      })

    return () => {
      cancelled = true
      abortController.abort()
    }
  }, [source, documentSize])

  useEffect(() => {
    const visiblePages = new Set(pagedNavigation.visiblePages)
    const wrapper = renderHostRef.current?.querySelector(".rf-docx-wrapper, .docx-wrapper") as HTMLElement | null
    if (wrapper && pageSize) {
      wrapper.style.width = `${pageSize.width}px`
      wrapper.style.height = pageMode === "virtual" ? "auto" : `${pageSize.height}px`
    }

    if (pageMode === "virtual") {
      const contentElement = contentElementRef.current
      if (wrapper) {
        wrapper.style.display = "block"
        wrapper.style.position = "relative"
        wrapper.style.transform = `translateY(${-(pagedNavigation.scrollPosition - 1) * (pageSize?.height ?? 0)}px)`
        wrapper.style.transition = pagedNavigation.isScrolling && pagedNavigation.snapActive ? "transform 220ms ease-out" : "none"
        wrapper.style.willChange = pagedNavigation.isScrolling ? "transform" : "auto"
      }
      if (contentElement) {
        contentElement.style.display = "block"
        contentElement.style.position = "relative"
        contentElement.style.transform = "translateY(0)"
        contentElement.style.transition = "none"
      }
      return
    }

    if (wrapper) {
      wrapper.style.transform = "translateY(0)"
      wrapper.style.transition = "none"
    }

    pageElementsRef.current.forEach((section, index) => {
      const pageNumber = index + 1
      if (!visiblePages.has(pageNumber)) {
        section.style.display = "none"
        return
      }

      section.style.display = "block"
      section.style.left = "0"
      section.style.top = "0"
      section.style.position = pagedNavigation.isScrolling ? "absolute" : "relative"
      section.style.transform = pagedNavigation.isScrolling
        ? `translateY(${(pageNumber - pagedNavigation.scrollPosition) * (pageSize?.height ?? 0)}px)`
        : "translateY(0)"
      section.style.transition = pagedNavigation.isScrolling && pagedNavigation.snapActive ? "transform 220ms ease-out" : "none"
      section.style.willChange = pagedNavigation.isScrolling ? "transform" : "auto"
    })
  }, [pageMode, pageSize, pagedNavigation.isScrolling, pagedNavigation.snapActive, pagedNavigation.scrollPosition, pagedNavigation.visiblePages])

  useEffect(() => {
    const renderHost = renderHostRef.current
    if (!renderHost) {
      return
    }

    unwrapDocxMatches(renderHost)
    if (searchQuery.trim()) {
      if (pageMode === "virtual" && contentElementRef.current) {
        highlightSection(contentElementRef.current, searchQuery)
      } else {
        pageElementsRef.current.forEach((section) => highlightSection(section, searchQuery))
      }
    }

    setActiveMatchIndex(searchQuery.trim() && globalMatches.length > 0 ? 0 : -1)
    setTextLayerVersion((prev) => prev + 1)
  }, [pageMode, searchQuery, pageTextMap])

  useEffect(() => {
    if (activeMatchIndex < 0 || globalMatches.length === 0) {
      return
    }

    const normalizedIndex = activeMatchIndex < globalMatches.length ? activeMatchIndex : 0
    const match = globalMatches[normalizedIndex]

    if (activeMatchIndex !== normalizedIndex) {
      setActiveMatchIndex(normalizedIndex)
    }

    if (match.pageNumber !== currentPage) {
      pagedNavigation.reset(match.pageNumber)
      return
    }

    const timer = setTimeout(() => paintMatch(match.pageNumber, match.pageMatchIndex), 0)
    return () => clearTimeout(timer)
  }, [activeMatchIndex, currentPage, globalMatches, textLayerVersion])

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
      {interactive ? (
        <ViewerOverlayControls
          source={source}
          theme={theme}
          compact={controlsCompact}
          showDownload={allowDownload}
          showSearch={allowSearch}
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
          onPreviousPage={() => changePage(currentPage - 1)}
          onNextPage={() => changePage(currentPage + 1)}
          onPageChange={changePage}
        />
      ) : null}
      <div
        className={
          slotClasses?.viewport ??
          (isDark
            ? "h-full w-full touch-none overscroll-contain overflow-hidden rounded-lg bg-neutral-800"
            : "h-full w-full touch-none overscroll-contain overflow-hidden rounded-lg bg-white")
        }
      >
        {sourceError ? (
          <div className={isDark ? "p-4 text-sm text-neutral-300" : "p-4 text-sm text-slate-700"}>{sourceError}</div>
        ) : null}
        <div
          ref={zoomPan.setViewportRef}
          className={interactive ? "relative h-full w-full touch-none overflow-hidden cursor-grab active:cursor-grabbing" : "relative h-full w-full touch-none overflow-hidden"}
          {...(interactive ? zoomPan.handlers : {})}
          onWheel={onCanvasWheel}
        >
          <div
            className="absolute left-1/2 top-1/2 min-h-0 min-w-0 select-none"
            style={{ transform: `translate(calc(-50% + ${zoomPan.panOffset.x}px), calc(-50% + ${zoomPan.panOffset.y}px))` }}
          >
            <div
              ref={renderHostRef}
              className="relative min-h-0 min-w-0 overflow-hidden shadow-sm"
              style={{
                width: pageSize?.width,
                height: pageSize?.height,
                transform: `scale(${pageScale * zoomPan.zoom})`,
                transformOrigin: "center",
              }}
            />
          </div>
        </div>
      </div>
    </Card>
  )
}
