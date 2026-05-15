import type { ComponentType } from "react"
import type { BaseRendererProps, SupportedFileType } from "./types"
import { DocxRenderer } from "./renderers/docx/DocxRenderer"
import { ImageRenderer } from "./renderers/image/ImageRenderer"
import { PdfRenderer } from "./renderers/pdf/PdfRenderer"
import { VideoRenderer } from "./renderers/video/VideoRenderer"

type RendererMap = Partial<Record<SupportedFileType, ComponentType<BaseRendererProps>>>

export const rendererRegistry: RendererMap = {
  pdf: PdfRenderer,
  docx: DocxRenderer,
  image: ImageRenderer,
  jpg: ImageRenderer,
  jpeg: ImageRenderer,
  png: ImageRenderer,
  avif: ImageRenderer,
  video: VideoRenderer,
}
