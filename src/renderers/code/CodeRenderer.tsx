import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type WheelEvent } from "react"
import { ViewerOverlayControls } from "../../components/ViewerOverlayControls"
import { getSearchPattern } from "../../components/highlights/pagedTextSearch"
import { Card } from "../../components/ui/card"
import { fallbackPageAspectRatio, getDocumentWidth, type Size } from "../../components/document/documentSizing"
import { useElementSize } from "../../components/viewport/useElementSize"
import { useZoomPan } from "../../components/viewport/useZoomPan"
import type { BaseRendererProps, CodeTheme } from "../../types"
import { canHighlightLanguage, createPlainTokenResult, highlightCode, type CodeToken } from "./codeHighlighter"
import { getCodeLanguage } from "./codeLanguages"

type CodeSearchMatch = {
  lineIndex: number
  matchIndex: number
}

type SearchRange = {
  start: number
  end: number
  matchIndex: number
}

const codeTypographyByDocumentSize = {
  small: {
    codeClassName: "p-3 text-[11px] leading-4",
    lineNumberClassName: "mr-2 inline-block w-7 select-none text-right",
  },
  normal: {
    codeClassName: "p-3.5 text-xs leading-5",
    lineNumberClassName: "mr-3 inline-block w-8 select-none text-right",
  },
  large: {
    codeClassName: "p-4 text-[13px] leading-6",
    lineNumberClassName: "mr-3 inline-block w-9 select-none text-right",
  },
  xlarge: {
    codeClassName: "p-4.5 text-sm leading-6",
    lineNumberClassName: "mr-4 inline-block w-10 select-none text-right",
  },
}

function getCodeTheme(theme: "light" | "dark", codeTheme?: CodeTheme) {
  return codeTheme ?? (theme === "dark" ? "github-dark" : "github-light")
}

function normalizeLanguage(language: string) {
  return canHighlightLanguage(language) ? language : "text"
}

function getLineSearchRanges(lines: string[], query: string) {
  const searchPattern = getSearchPattern(query, "gi")
  const ranges: Record<number, SearchRange[]> = {}
  const matches: CodeSearchMatch[] = []

  if (!searchPattern) {
    return { ranges, matches }
  }

  lines.forEach((line, lineIndex) => {
    Array.from(line.matchAll(searchPattern)).forEach((match) => {
      const value = match[0]
      const start = match.index ?? 0
      const matchIndex = matches.length
      const range = { start, end: start + value.length, matchIndex }

      ranges[lineIndex] = [...(ranges[lineIndex] ?? []), range]
      matches.push({ lineIndex, matchIndex })
    })
  })

  return { ranges, matches }
}

function getTokenStyle(token: CodeToken): CSSProperties {
  const style: CSSProperties = {}
  if (token.color) {
    style.color = token.color
  }
  if (token.bgColor) {
    style.backgroundColor = token.bgColor
  }
  if (token.fontStyle) {
    if (token.fontStyle & 1) {
      style.fontStyle = "italic"
    }
    if (token.fontStyle & 2) {
      style.fontWeight = 700
    }
    if (token.fontStyle & 4) {
      style.textDecoration = "underline"
    }
  }
  return style
}

export function CodeRenderer({ source, options }: BaseRendererProps) {
  const interactive = options?.interactive ?? true
  const [code, setCode] = useState("")
  const [tokens, setTokens] = useState<CodeToken[][]>([])
  const [foregroundColor, setForegroundColor] = useState<string | undefined>()
  const [backgroundColor, setBackgroundColor] = useState<string | undefined>()
  const [loadError, setLoadError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [activeMatchIndex, setActiveMatchIndex] = useState(-1)
  const sourceLoadIdRef = useRef(0)
  const contentSize = useElementSize<HTMLPreElement>()
  const viewportSize = useElementSize<HTMLDivElement>()
  const zoomPan = useZoomPan({ minZoom: 0.6, maxZoom: 3, blockWheel: false })

  const allowDownload = options?.allowDownload ?? false
  const allowSearch = options?.allowSearch ?? true
  const slotClasses = options?.slotClasses
  const theme = options?.theme ?? "light"
  const isDark = theme === "dark"
  const showLineNumbers = options?.code?.showLineNumbers ?? true
  const wrapLines = options?.code?.wrapLines ?? false
  const documentSize = options?.documentSize ?? "normal"
  const typography = codeTypographyByDocumentSize[documentSize]
  const rendererWidth = getDocumentWidth(documentSize)
  const rendererHeight = Math.round(rendererWidth * fallbackPageAspectRatio)
  const language = normalizeLanguage(getCodeLanguage(source, options?.code?.language))
  const codeTheme = getCodeTheme(theme, options?.code?.theme)
  const lines = useMemo(() => code.split("\n"), [code])
  const { ranges: searchRanges, matches: globalMatches } = useMemo(
    () => getLineSearchRanges(lines, searchQuery),
    [lines, searchQuery],
  )
  const scaledContentSize: Size | null = contentSize.size
    ? { width: contentSize.size.width * zoomPan.zoom, height: contentSize.size.height * zoomPan.zoom }
    : null
  const surfaceWidth = Math.max(scaledContentSize?.width ?? 0, viewportSize.size?.width ?? rendererWidth)
  const surfaceHeight = Math.max(scaledContentSize?.height ?? 0, viewportSize.size?.height ?? rendererHeight)

  const setViewportRef = useCallback((node: HTMLDivElement | null) => {
    zoomPan.setViewportRef(node)
    viewportSize.setElementRef(node)
  }, [viewportSize.setElementRef, zoomPan.setViewportRef])

  function activateMatch(nextIndex: number) {
    if (globalMatches.length === 0) {
      setActiveMatchIndex(-1)
      return
    }

    const normalizedIndex = ((nextIndex % globalMatches.length) + globalMatches.length) % globalMatches.length
    const match = globalMatches[normalizedIndex]
    setActiveMatchIndex(normalizedIndex)

    requestAnimationFrame(() => {
      const line = zoomPan.viewportRef.current?.querySelector(`[data-rf-code-line="${match.lineIndex + 1}"]`)
      line?.scrollIntoView({ block: "center", inline: "nearest" })
    })
  }

  function onCodeWheel(event: WheelEvent<HTMLDivElement>) {
    if (!interactive) {
      return
    }

    if (event.ctrlKey) {
      zoomPan.handlers.onWheel(event)
    }
  }

  function renderToken(token: CodeToken, lineIndex: number, tokenStart: number, tokenIndex: number) {
    const ranges = searchRanges[lineIndex] ?? []
    const tokenEnd = tokenStart + token.content.length
    const overlappingRanges = ranges.filter((range) => range.start < tokenEnd && range.end > tokenStart)
    const tokenStyle = getTokenStyle(token)

    if (overlappingRanges.length === 0) {
      return <span key={tokenIndex} style={tokenStyle}>{token.content}</span>
    }

    const parts: JSX.Element[] = []
    let cursor = tokenStart

    overlappingRanges.forEach((range) => {
      const start = Math.max(range.start, tokenStart)
      const end = Math.min(range.end, tokenEnd)

      if (start > cursor) {
        parts.push(
          <span key={`${tokenIndex}-${cursor}`} style={tokenStyle}>
            {token.content.slice(cursor - tokenStart, start - tokenStart)}
          </span>,
        )
      }

      parts.push(
        <mark
          key={`${tokenIndex}-${start}-match`}
          className={range.matchIndex === activeMatchIndex ? "rounded-sm bg-rose-300 text-slate-950" : "rounded-sm bg-amber-200 text-slate-950"}
        >
          <span style={tokenStyle}>{token.content.slice(start - tokenStart, end - tokenStart)}</span>
        </mark>,
      )
      cursor = end
    })

    if (cursor < tokenEnd) {
      parts.push(
        <span key={`${tokenIndex}-${cursor}`} style={tokenStyle}>
          {token.content.slice(cursor - tokenStart)}
        </span>,
      )
    }

    return parts
  }

  useEffect(() => {
    const loadId = sourceLoadIdRef.current + 1
    sourceLoadIdRef.current = loadId
    setCode("")
    setTokens([])
    setLoadError(null)
    setSearchQuery("")
    setActiveMatchIndex(-1)
    zoomPan.resetView()

    fetch(source)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Unable to load code file (${response.status})`)
        }
        return response.text()
      })
      .then((text) => {
        if (sourceLoadIdRef.current === loadId) {
          setCode(text)
        }
      })
      .catch((error: unknown) => {
        if (sourceLoadIdRef.current === loadId) {
          setLoadError(error instanceof Error ? error.message : "Unable to load code file")
        }
      })
  }, [source])

  useEffect(() => {
    if (!code) {
      setTokens([])
      return
    }

    let cancelled = false
    highlightCode(code, language, codeTheme)
      .then((result) => {
        if (cancelled) {
          return
        }

        setTokens(result.tokens)
        setForegroundColor(result.fg)
        setBackgroundColor(result.bg)
      })
      .catch(() => {
        if (!cancelled) {
          setTokens(createPlainTokenResult(code).tokens)
        }
      })

    return () => {
      cancelled = true
    }
  }, [code, codeTheme, language, lines])

  useEffect(() => {
    setActiveMatchIndex(searchQuery.trim() && globalMatches.length > 0 ? 0 : -1)
  }, [globalMatches.length, searchQuery])

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
              width: rendererWidth,
              height: rendererHeight,
            }
      }
    >
      {interactive ? (
        <ViewerOverlayControls
          source={source}
          theme={theme}
          showDownload={allowDownload}
          showSearch={allowSearch}
          searchValue={searchQuery}
          onSearchChange={(value) => setSearchQuery(value)}
          onSearchEnter={() => activateMatch(activeMatchIndex < 0 ? 0 : activeMatchIndex + 1)}
          searchCounterText={globalMatches.length === 0 || activeMatchIndex < 0 ? `0/${globalMatches.length}` : `${activeMatchIndex + 1}/${globalMatches.length}`}
          showReset
          resetDisabled={zoomPan.isViewReset}
          onReset={zoomPan.resetView}
        />
      ) : null}

      <div
        className={
          slotClasses?.viewport ??
          (isDark
            ? `h-full w-full touch-none ${interactive ? "overflow-auto" : "overflow-hidden"} bg-neutral-900`
            : `h-full w-full touch-none ${interactive ? "overflow-auto" : "overflow-hidden"} bg-slate-50`)
        }
        ref={setViewportRef}
        onWheel={onCodeWheel}
      >
        {loadError ? (
          <div className={isDark ? "p-4 text-sm text-neutral-300" : "p-4 text-sm text-slate-700"}>{loadError}</div>
        ) : (
          <div
            className="relative"
            style={{ width: surfaceWidth || undefined, height: surfaceHeight || undefined }}
          >
            <pre
              ref={contentSize.setElementRef}
              className={`absolute left-0 top-0 m-0 min-h-full min-w-full select-text text-left ${typography.codeClassName}`}
              style={{
                backgroundColor: backgroundColor ?? (isDark ? "#171717" : "#f8fafc"),
                color: foregroundColor ?? (isDark ? "#f5f5f5" : "#0f172a"),
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                overflowWrap: wrapLines ? "anywhere" : undefined,
                tabSize: 2,
                transform: interactive ? `scale(${zoomPan.zoom})` : "none",
                transformOrigin: "top left",
                whiteSpace: wrapLines ? "pre-wrap" : "pre",
              }}
            >
              <code>
                {(tokens.length > 0 ? tokens : createPlainTokenResult(code).tokens).map((lineTokens, lineIndex) => {
                  let cursor = 0
                  const activeLine = activeMatchIndex >= 0 && globalMatches[activeMatchIndex]?.lineIndex === lineIndex
                  const matchingLine = (searchRanges[lineIndex] ?? []).length > 0

                  return (
                    <span
                      key={lineIndex}
                      data-rf-code-line={lineIndex + 1}
                      className={activeLine ? "block bg-rose-500/10" : matchingLine ? "block bg-amber-500/10" : "block"}
                    >
                      {showLineNumbers ? (
                        <span className={`${typography.lineNumberClassName} ${isDark ? "text-neutral-500" : "text-slate-400"}`}>
                          {lineIndex + 1}
                        </span>
                      ) : null}
                      {lineTokens.map((token, tokenIndex) => {
                        const renderedToken = renderToken(token, lineIndex, cursor, tokenIndex)
                        cursor += token.content.length
                        return renderedToken
                      })}
                    </span>
                  )
                })}
              </code>
            </pre>
          </div>
        )}
      </div>
    </Card>
  )
}
