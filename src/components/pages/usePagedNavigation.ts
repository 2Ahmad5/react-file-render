import { useEffect, useMemo, useRef, useState } from "react"

type UsePagedNavigationOptions = {
  totalPages: number
  initialPage?: number
  settleDelay?: number
  snapDuration?: number
  overscan?: number
}

function clampPage(page: number, totalPages: number) {
  if (totalPages <= 0) {
    return 1
  }

  return Math.min(Math.max(page, 1), totalPages)
}

export function usePagedNavigation({
  totalPages,
  initialPage = 1,
  settleDelay = 110,
  snapDuration = 220,
  overscan = 1,
}: UsePagedNavigationOptions) {
  const initialBoundedPage = clampPage(initialPage, totalPages)
  const [currentPage, setCurrentPage] = useState(initialBoundedPage)
  const [scrollPosition, setScrollPosition] = useState(initialBoundedPage)
  const [isScrolling, setIsScrolling] = useState(false)
  const [snapActive, setSnapActive] = useState(false)
  const scrollPositionRef = useRef(initialBoundedPage)
  const scrollSettleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const snapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function clearTimers() {
    if (scrollSettleTimerRef.current) {
      clearTimeout(scrollSettleTimerRef.current)
      scrollSettleTimerRef.current = null
    }
    if (snapTimerRef.current) {
      clearTimeout(snapTimerRef.current)
      snapTimerRef.current = null
    }
  }

  function settlePage(page: number, animate = true) {
    const boundedPage = clampPage(page, totalPages)
    clearTimers()
    scrollPositionRef.current = boundedPage
    setSnapActive(animate)
    setIsScrolling(animate)
    setScrollPosition(boundedPage)
    setCurrentPage(boundedPage)

    if (animate) {
      snapTimerRef.current = setTimeout(() => {
        setIsScrolling(false)
        setSnapActive(false)
        snapTimerRef.current = null
      }, snapDuration)
    }
  }

  function goToPage(page: number, animate = true) {
    const boundedPage = clampPage(page, totalPages)
    if (boundedPage === currentPage && !isScrolling) {
      return
    }

    settlePage(boundedPage, animate)
  }

  function reset(page = initialPage) {
    const boundedPage = clampPage(page, totalPages)
    clearTimers()
    scrollPositionRef.current = boundedPage
    setCurrentPage(boundedPage)
    setScrollPosition(boundedPage)
    setIsScrolling(false)
    setSnapActive(false)
  }

  function scrollBy(delta: number, pageStride: number) {
    if (totalPages <= 1) {
      return
    }

    clearTimers()

    const nextPosition = Math.min(
      Math.max(scrollPositionRef.current + delta / Math.max(pageStride, 1), 1),
      totalPages,
    )
    const livePage = clampPage(Math.round(nextPosition), totalPages)

    scrollPositionRef.current = nextPosition
    setSnapActive(false)
    setIsScrolling(true)
    setScrollPosition(nextPosition)
    setCurrentPage(livePage)

    scrollSettleTimerRef.current = setTimeout(() => {
      settlePage(Math.round(scrollPositionRef.current))
    }, settleDelay)
  }

  const visiblePages = useMemo(() => {
    if (!isScrolling) {
      return totalPages > 0 ? [currentPage] : []
    }

    const centerPage = clampPage(Math.round(scrollPosition), totalPages)
    const pages: number[] = []
    for (let page = centerPage - overscan; page <= centerPage + overscan; page += 1) {
      if (page >= 1 && page <= totalPages) {
        pages.push(page)
      }
    }
    return pages
  }, [currentPage, isScrolling, overscan, scrollPosition, totalPages])

  useEffect(() => {
    if (totalPages <= 0) {
      return
    }

    const boundedPage = clampPage(scrollPositionRef.current, totalPages)
    if (boundedPage !== scrollPositionRef.current || currentPage > totalPages) {
      reset(boundedPage)
    }
  }, [currentPage, totalPages])

  useEffect(() => {
    return clearTimers
  }, [])

  return {
    currentPage,
    scrollPosition,
    visiblePages,
    isScrolling,
    snapActive,
    goToPage,
    reset,
    scrollBy,
  }
}
