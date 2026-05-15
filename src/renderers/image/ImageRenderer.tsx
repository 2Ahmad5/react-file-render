import { useCallback, useEffect, useMemo, useRef, useState, type WheelEvent } from "react"
import { createWorker } from "tesseract.js"
import { ViewerOverlayControls } from "../../components/ViewerOverlayControls"
import type { Size } from "../../components/document/documentSizing"
import { buildPagedItemMatches, type PagedTextSearchMatch } from "../../components/highlights/pagedTextSearch"
import { Card } from "../../components/ui/card"
import { useElementSize } from "../../components/viewport/useElementSize"
import { useZoomPan } from "../../components/viewport/useZoomPan"
import { cn } from "../../lib/utils"
import type { BaseRendererProps, ImageFit, ImageRepeat } from "../../types"

type OcrStatus = "idle" | "running" | "done" | "error"

type OcrWordBox = {
  text: string
  left: number
  top: number
  width: number
  height: number
}

type ImageSearchMatch = PagedTextSearchMatch<"ocr">

function getRenderedImageSize(fit: ImageFit, viewportSize: Size | null, naturalSize: Size | null) {
  if (!viewportSize || !naturalSize) {
    return undefined
  }

  if (fit === "fill") {
    return viewportSize
  }

  if (fit === "none") {
    return naturalSize
  }

  const containScale = Math.min(viewportSize.width / naturalSize.width, viewportSize.height / naturalSize.height)
  const coverScale = Math.max(viewportSize.width / naturalSize.width, viewportSize.height / naturalSize.height)
  const scale = fit === "cover" ? coverScale : fit === "scale-down" ? Math.min(containScale, 1) : containScale

  return {
    width: naturalSize.width * scale,
    height: naturalSize.height * scale,
  }
}

function getBackgroundSize(fit: ImageFit, repeat: ImageRepeat) {
  if (repeat !== "no-repeat" && fit === "none") {
    return "auto"
  }

  if (fit === "fill") {
    return "100% 100%"
  }

  if (fit === "scale-down") {
    return "contain"
  }

  return fit
}

function getCssUrl(source: string) {
  return `url("${source.replace(/"/g, '\\"')}")`
}

export function ImageRenderer({ source, options }: BaseRendererProps) {
  const allowDownload = options?.allowDownload ?? false
  const allowSearch = options?.allowSearch ?? true
  const theme = options?.theme ?? "light"
  const isDark = theme === "dark"
  const fit = options?.image?.fit ?? "cover"
  const repeat = options?.image?.repeat ?? "no-repeat"
  const position = options?.image?.position ?? "center"
  const backgroundColor = options?.image?.backgroundColor
  const [naturalSize, setNaturalSize] = useState<Size | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [activeMatchIndex, setActiveMatchIndex] = useState(-1)
  const [ocrStatus, setOcrStatus] = useState<OcrStatus>("idle")
  const [ocrWords, setOcrWords] = useState<OcrWordBox[]>([])
  const ocrLoadIdRef = useRef(0)
  const viewport = useElementSize<HTMLDivElement>()
  const zoomPan = useZoomPan()
  const setViewportRef = useCallback((node: HTMLDivElement | null) => {
    zoomPan.setViewportRef(node)
    viewport.setElementRef(node)
  }, [viewport.setElementRef, zoomPan.setViewportRef])
  const renderedImageSize = useMemo(() => getRenderedImageSize(fit, viewport.size, naturalSize), [fit, naturalSize, viewport.size])
  const displayImageSize = repeat === "no-repeat" ? renderedImageSize : viewport.size

  const globalMatches = useMemo<ImageSearchMatch[]>(() => {
    return buildPagedItemMatches({ 1: ocrWords }, searchQuery, "ocr")
  }, [ocrWords, searchQuery])

  const searchDisabled = allowSearch && (ocrStatus === "idle" || ocrStatus === "running" || ocrStatus === "error" || (ocrStatus === "done" && ocrWords.length === 0))

  async function runImageOcr(image: HTMLImageElement) {
    if (!allowSearch) {
      return
    }

    const loadId = ocrLoadIdRef.current + 1
    ocrLoadIdRef.current = loadId
    setOcrStatus("running")
    setOcrWords([])
    setActiveMatchIndex(-1)

    try {
      const canvas = document.createElement("canvas")
      const context = canvas.getContext("2d")
      const imageWidth = Math.max(image.naturalWidth, 1)
      const imageHeight = Math.max(image.naturalHeight, 1)
      const ocrScale = 3
      const ocrWidth = imageWidth * ocrScale
      const ocrHeight = imageHeight * ocrScale

      if (!context) {
        setOcrStatus("error")
        return
      }

      canvas.width = ocrWidth
      canvas.height = ocrHeight
      context.imageSmoothingEnabled = true
      context.imageSmoothingQuality = "high"
      context.drawImage(image, 0, 0, ocrWidth, ocrHeight)

      const worker = await createWorker("eng")
      try {
        const result = await worker.recognize(canvas, {}, { blocks: true, text: true })
        if (ocrLoadIdRef.current !== loadId) {
          return
        }

        const words = (result.data.blocks ?? [])
          .flatMap((block) => block.paragraphs)
          .flatMap((paragraph) => paragraph.lines)
          .flatMap((line) => line.words)
          .filter((word) => word.text.trim().length > 0)

        setOcrWords(
          words.map((word) => ({
            text: word.text,
            left: (word.bbox.x0 / ocrWidth) * 100,
            top: (word.bbox.y0 / ocrHeight) * 100,
            width: ((word.bbox.x1 - word.bbox.x0) / ocrWidth) * 100,
            height: ((word.bbox.y1 - word.bbox.y0) / ocrHeight) * 100,
          })),
        )
        setOcrStatus("done")
      } finally {
        await worker.terminate()
      }
    } catch {
      if (ocrLoadIdRef.current === loadId) {
        setOcrStatus("error")
      }
    }
  }

  function activateMatch(nextIndex: number) {
    if (globalMatches.length === 0) {
      setActiveMatchIndex(-1)
      return
    }

    const normalizedIndex = ((nextIndex % globalMatches.length) + globalMatches.length) % globalMatches.length
    setActiveMatchIndex(normalizedIndex)
  }

  function onImageWheel(event: WheelEvent<HTMLDivElement>) {
    event.preventDefault()
    event.stopPropagation()

    if (event.ctrlKey) {
      zoomPan.handlers.onWheel(event)
    }
  }

  useEffect(() => {
    ocrLoadIdRef.current += 1
    setSearchQuery("")
    setActiveMatchIndex(-1)
    setOcrWords([])
    setOcrStatus("idle")
    zoomPan.resetView()
  }, [source])

  useEffect(() => {
    zoomPan.resetView()
  }, [fit, position, repeat])

  return (
    <Card
      className={
        options?.slotClasses?.container ??
        options?.className ??
        (isDark
          ? "group relative h-[80vh] overflow-hidden rounded-lg border border-neutral-700 bg-neutral-800 shadow-sm"
          : "group relative h-[80vh] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm")
      }
    >
      <ViewerOverlayControls
        source={source}
        theme={theme}
        showDownload={allowDownload}
        showSearch={allowSearch}
        searchDisabled={searchDisabled}
        searchValue={searchQuery}
        onSearchChange={(value) => {
          setSearchQuery(value)
          setActiveMatchIndex(value.trim() ? 0 : -1)
        }}
        onSearchEnter={() => activateMatch(activeMatchIndex < 0 ? 0 : activeMatchIndex + 1)}
        searchCounterText={globalMatches.length === 0 || activeMatchIndex < 0 ? `0/${globalMatches.length}` : `${activeMatchIndex + 1}/${globalMatches.length}`}
        showReset
        resetDisabled={zoomPan.isViewReset}
        onReset={zoomPan.resetView}
      />

      <div
        className={cn(
          options?.slotClasses?.viewport ?? (isDark ? "h-full w-full touch-none overflow-hidden bg-neutral-700" : "h-full w-full touch-none overflow-hidden bg-slate-100"),
          "relative flex items-center justify-center",
        )}
        style={{ backgroundColor }}
      >
        <div
          ref={setViewportRef}
          className="relative flex h-full w-full touch-none items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing"
          {...zoomPan.handlers}
          onWheel={onImageWheel}
        >
          <div
            className="relative select-none overflow-hidden"
            style={{
              width: displayImageSize?.width,
              height: displayImageSize?.height,
              backgroundImage: getCssUrl(source),
              backgroundPosition: position,
              backgroundRepeat: repeat,
              backgroundSize: repeat === "no-repeat" ? "100% 100%" : getBackgroundSize(fit, repeat),
              transform: `translate(${zoomPan.panOffset.x}px, ${zoomPan.panOffset.y}px) scale(${zoomPan.zoom})`,
              transformOrigin: "center",
            }}
          >
            <img
              src={source}
              alt="Preview"
              draggable={false}
              className={cn("pointer-events-none block h-full w-full opacity-0", options?.slotClasses?.image)}
              style={{ objectFit: "fill", objectPosition: position }}
              onLoad={(event) => {
                const nextNaturalSize = {
                  width: event.currentTarget.naturalWidth,
                  height: event.currentTarget.naturalHeight,
                }
                setNaturalSize(nextNaturalSize)
                runImageOcr(event.currentTarget)
              }}
            />

            {globalMatches.length > 0 ? (
              <div className="pointer-events-none absolute inset-0 z-10">
                {globalMatches.map((match, matchIndex) => {
                  const word = ocrWords[match.itemIndex ?? -1]
                  if (!word) {
                    return null
                  }

                  return (
                    <div
                      key={`image-ocr-match-${matchIndex}`}
                      className={
                        matchIndex === activeMatchIndex
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
    </Card>
  )
}
