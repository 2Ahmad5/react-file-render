import type { ComponentType } from "react"
import type { BaseRendererProps, SupportedFileType } from "./types"
import { CodeRenderer } from "./renderers/code/CodeRenderer"
import { codeExtensions } from "./renderers/code/codeLanguages"
import { DocxRenderer } from "./renderers/docx/DocxRenderer"
import { ImageRenderer } from "./renderers/image/ImageRenderer"
import { PdfRenderer } from "./renderers/pdf/PdfRenderer"

type RendererMap = Partial<Record<SupportedFileType, ComponentType<BaseRendererProps>>>

export const rendererRegistry: RendererMap = {
  code: CodeRenderer,
  pdf: PdfRenderer,
  docx: DocxRenderer,
  image: ImageRenderer,
  jpg: ImageRenderer,
  jpeg: ImageRenderer,
  png: ImageRenderer,
  avif: ImageRenderer,
}

codeExtensions.forEach((extension) => {
  rendererRegistry[extension] = CodeRenderer
})
