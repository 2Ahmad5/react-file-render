import { useEffect, useMemo, useState } from "react"
import { ViewerOverlayControls } from "./components/ViewerOverlayControls"
import { rendererRegistry } from "./registry"
import { codeExtensionSet, isCodeFileType } from "./renderers/code/codeLanguages"
import { UnsupportedRenderer } from "./renderers/fallback/UnsupportedRenderer"
import type { FileRendererProps, RendererOptions, RendererStyleOptions, SupportedFileType } from "./types"

type RenderableSource = {
  source: string
  fileType: SupportedFileType
}

const renderableExtensions: Record<string, SupportedFileType> = {
  pdf: "pdf",
  docx: "docx",
  jpg: "jpg",
  jpeg: "jpeg",
  png: "png",
  avif: "avif",
}

codeExtensionSet.forEach((extension) => {
  renderableExtensions[extension] = extension as SupportedFileType
})

function getFileTypeFromSource(source: string) {
  const pathname = source.split(/[?#]/)[0]
  const extension = pathname.split(".").pop()?.toLowerCase()
  return extension ? renderableExtensions[extension] : undefined
}

function getMergedOptions(fileType: SupportedFileType, options?: RendererOptions): RendererStyleOptions {
  const typeOverride = options?.byType?.[fileType]
  const mergedOptions: RendererStyleOptions = {
    ...options,
    ...typeOverride,
    image: {
      ...options?.image,
      ...typeOverride?.image,
    },
    slotClasses: {
      ...options?.slotClasses,
      ...typeOverride?.slotClasses,
    },
  }

  const isSearchableImage = fileType === "image" || fileType === "jpg" || fileType === "jpeg" || fileType === "png" || fileType === "avif"
  const isSearchableCode = isCodeFileType(fileType)
  const supportsSearch = fileType === "pdf" || fileType === "docx" || isSearchableImage || isSearchableCode
  const interactive = mergedOptions.interactive ?? true

  return {
    ...mergedOptions,
    allowDownload: interactive ? mergedOptions.allowDownload : false,
    allowSearch: interactive && supportsSearch ? mergedOptions.allowSearch ?? (isSearchableImage || isSearchableCode) : false,
  }
}

function isFolderSource(source: string, fileType: SupportedFileType) {
  return fileType === "folder" || source.endsWith("/")
}

function resolveFolderUrl(folderSource: string, href: string) {
  return new URL(href, new URL(folderSource, window.location.href)).toString()
}

function parseFolderSources(folderSource: string, html: string) {
  const doc = new DOMParser().parseFromString(html, "text/html")
  const seenSources = new Set<string>()
  const sources: RenderableSource[] = []

  Array.from(doc.querySelectorAll("a[href]")).forEach((link) => {
    const href = link.getAttribute("href")
    if (!href || href === "../" || href.startsWith("#")) {
      return
    }

    const resolvedSource = resolveFolderUrl(folderSource, href)
    const fileType = getFileTypeFromSource(resolvedSource)
    if (!fileType || seenSources.has(resolvedSource)) {
      return
    }

    seenSources.add(resolvedSource)
    sources.push({ source: resolvedSource, fileType })
  })

  return sources.sort((a, b) => a.source.localeCompare(b.source))
}

function parseFolderManifest(folderSource: string, manifestText: string) {
  const manifest = JSON.parse(manifestText) as string[] | { files?: string[] }
  const files = Array.isArray(manifest) ? manifest : manifest.files ?? []

  return files
    .map((file) => resolveFolderUrl(folderSource, file))
    .map((resolvedSource) => ({ source: resolvedSource, fileType: getFileTypeFromSource(resolvedSource) }))
    .filter((entry): entry is RenderableSource => Boolean(entry.fileType))
    .sort((a, b) => a.source.localeCompare(b.source))
}

async function loadFolderSources(folderSource: string) {
  const response = await fetch(folderSource)
  if (response.ok) {
    const text = await response.text()
    const sources = parseFolderSources(folderSource, text)
    if (sources.length > 0) {
      return sources
    }
  }

  const manifestResponse = await fetch(resolveFolderUrl(folderSource, "index.json"))
  if (!manifestResponse.ok) {
    throw new Error("Failed to load folder source")
  }

  return parseFolderManifest(folderSource, await manifestResponse.text())
}

function RenderSingleSource({ source, fileType, options }: { source: string; fileType: SupportedFileType; options?: RendererOptions }) {
  const Renderer = rendererRegistry[fileType]
  const normalizedOptions = getMergedOptions(fileType, options)

  if (!Renderer) {
    return <UnsupportedRenderer source={source} options={normalizedOptions} />
  }

  return <Renderer source={source} options={normalizedOptions} />
}

export function FileRenderer({ source, fileType, options }: FileRendererProps) {
  const [folderSources, setFolderSources] = useState<RenderableSource[]>([])
  const [folderLoading, setFolderLoading] = useState(false)
  const [folderLoadFailed, setFolderLoadFailed] = useState(false)
  const [currentSourceIndex, setCurrentSourceIndex] = useState(0)
  const folderMode = isFolderSource(source, fileType)

  useEffect(() => {
    if (!folderMode) {
      setFolderSources([])
      setFolderLoading(false)
      setFolderLoadFailed(false)
      setCurrentSourceIndex(0)
      return
    }

    let cancelled = false
    setFolderSources([])
    setFolderLoading(true)
    setFolderLoadFailed(false)
    setCurrentSourceIndex(0)

    loadFolderSources(source)
      .then((sources) => {
        if (!cancelled) {
          setFolderSources(sources)
          setFolderLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFolderLoading(false)
          setFolderLoadFailed(true)
        }
      })

    return () => {
      cancelled = true
    }
  }, [folderMode, source])

  const activeFolderSource = folderSources[currentSourceIndex]
  const fallbackFileType = useMemo(() => getFileTypeFromSource(source) ?? fileType, [fileType, source])

  if (!folderMode) {
    return <RenderSingleSource source={source} fileType={fallbackFileType} options={options} />
  }

  if (folderLoading) {
    return <div className="p-4 text-sm text-slate-500">Loading folder...</div>
  }

  if (folderLoadFailed || folderSources.length === 0) {
    return <UnsupportedRenderer source={source} options={options} />
  }

  return (
    <div className="group relative inline-block">
      <RenderSingleSource source={activeFolderSource.source} fileType={activeFolderSource.fileType} options={options} />
      {folderSources.length > 1 && (options?.interactive ?? true) ? (
        <ViewerOverlayControls
          source={activeFolderSource.source}
          theme={options?.theme}
          compact
          showDownload={false}
          showSearch={false}
          showSourcePagination
          currentSource={currentSourceIndex + 1}
          totalSources={folderSources.length}
          onPreviousSource={() => setCurrentSourceIndex((prev) => Math.max(prev - 1, 0))}
          onNextSource={() => setCurrentSourceIndex((prev) => Math.min(prev + 1, folderSources.length - 1))}
          onSourceChange={(nextSource) => setCurrentSourceIndex(nextSource - 1)}
        />
      ) : null}
    </div>
  )
}
