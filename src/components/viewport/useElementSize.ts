import { useCallback, useEffect, useRef, useState } from "react"
import type { Size } from "../document/documentSizing"

export function useElementSize<TElement extends HTMLElement>() {
  const elementRef = useRef<TElement | null>(null)
  const [element, setElement] = useState<TElement | null>(null)
  const [size, setSize] = useState<Size | null>(null)

  const setElementRef = useCallback((node: TElement | null) => {
    elementRef.current = node
    setElement(node)
  }, [])

  useEffect(() => {
    if (!element) {
      setSize(null)
      return
    }

    const observedElement = element

    function updateSize() {
      setSize({ width: observedElement.clientWidth, height: observedElement.clientHeight })
    }

    updateSize()
    const observer = new ResizeObserver(updateSize)
    observer.observe(observedElement)

    return () => observer.disconnect()
  }, [element])

  return { elementRef, setElementRef, size }
}
