import { useCallback, useEffect, useRef, useState, type PointerEvent, type WheelEvent } from "react"

export type PanOffset = {
  x: number
  y: number
}

type PointerPoint = {
  x: number
  y: number
}

type UseZoomPanOptions = {
  minZoom?: number
  maxZoom?: number
  blockWheel?: boolean
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function getDistance(a: PointerPoint, b: PointerPoint) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export function useZoomPan({ minZoom = 0.75, maxZoom = 2.5, blockWheel = true }: UseZoomPanOptions = {}) {
  const [zoom, setZoom] = useState(1)
  const [panOffset, setPanOffset] = useState<PanOffset>({ x: 0, y: 0 })
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const [viewportElement, setViewportElement] = useState<HTMLDivElement | null>(null)
  const activePointersRef = useRef<Map<number, PointerPoint>>(new Map())
  const dragStartRef = useRef<{ pointerId: number; x: number; y: number; pan: PanOffset } | null>(null)
  const pinchStartRef = useRef<{ distance: number; zoom: number } | null>(null)

  function resetView() {
    setZoom(1)
    setPanOffset({ x: 0, y: 0 })
  }

  const setViewportRef = useCallback((node: HTMLDivElement | null) => {
    viewportRef.current = node
    setViewportElement(node)
  }, [])

  function onWheel(event: WheelEvent<HTMLDivElement>) {
    if (!event.ctrlKey) {
      return
    }

    event.preventDefault()
    const nextZoomFactor = Math.exp(-event.deltaY * 0.004)
    setZoom((prev) => clamp(prev * nextZoomFactor, minZoom, maxZoom))
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) {
      return
    }

    activePointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    event.currentTarget.setPointerCapture(event.pointerId)

    const activePointers = Array.from(activePointersRef.current.values())
    if (activePointers.length === 2) {
      dragStartRef.current = null
      pinchStartRef.current = { distance: getDistance(activePointers[0], activePointers[1]), zoom }
      return
    }

    if (activePointers.length === 1) {
      dragStartRef.current = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        pan: panOffset,
      }
    }
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!activePointersRef.current.has(event.pointerId)) {
      return
    }

    activePointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    const activePointers = Array.from(activePointersRef.current.values())

    if (pinchStartRef.current && activePointers.length >= 2) {
      const nextDistance = getDistance(activePointers[0], activePointers[1])
      if (pinchStartRef.current.distance > 0) {
        setZoom(clamp(pinchStartRef.current.zoom * (nextDistance / pinchStartRef.current.distance), minZoom, maxZoom))
      }
      return
    }

    const dragStart = dragStartRef.current
    if (!dragStart || dragStart.pointerId !== event.pointerId) {
      return
    }

    setPanOffset({
      x: dragStart.pan.x + event.clientX - dragStart.x,
      y: dragStart.pan.y + event.clientY - dragStart.y,
    })
  }

  function onPointerEnd(event: PointerEvent<HTMLDivElement>) {
    activePointersRef.current.delete(event.pointerId)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    if (activePointersRef.current.size < 2) {
      pinchStartRef.current = null
    }

    if (dragStartRef.current?.pointerId === event.pointerId) {
      dragStartRef.current = null
    }
  }

  useEffect(() => {
    const viewport = viewportElement
    if (!viewport) {
      return
    }

    function preventViewportGesture(event: Event) {
      if (event.type === "wheel" && !blockWheel && !(event as globalThis.WheelEvent).ctrlKey) {
        return
      }

      event.preventDefault()
    }

    viewport.addEventListener("wheel", preventViewportGesture, { passive: false })
    viewport.addEventListener("gesturestart", preventViewportGesture, { passive: false })
    viewport.addEventListener("gesturechange", preventViewportGesture, { passive: false })
    viewport.addEventListener("gestureend", preventViewportGesture, { passive: false })

    return () => {
      viewport.removeEventListener("wheel", preventViewportGesture)
      viewport.removeEventListener("gesturestart", preventViewportGesture)
      viewport.removeEventListener("gesturechange", preventViewportGesture)
      viewport.removeEventListener("gestureend", preventViewportGesture)
    }
  }, [blockWheel, viewportElement])

  return {
    viewportRef,
    setViewportRef,
    zoom,
    panOffset,
    setPanOffset,
    resetView,
    isViewReset: Math.abs(zoom - 1) < 0.001 && Math.abs(panOffset.x) < 0.5 && Math.abs(panOffset.y) < 0.5,
    handlers: {
      onWheel,
      onPointerDown,
      onPointerMove,
      onPointerUp: onPointerEnd,
      onPointerCancel: onPointerEnd,
    },
  }
}
