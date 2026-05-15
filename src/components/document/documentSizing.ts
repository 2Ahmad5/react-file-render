import type { DocumentSize } from "../../types"

export type Size = {
  width: number
  height: number
}

export const documentSizeWidths: Record<DocumentSize, number> = {
  small: 360,
  normal: 480,
  large: 720,
  xlarge: 960,
}

export const fallbackPageAspectRatio = 11 / 8.5

export function getDocumentWidth(documentSize: DocumentSize) {
  return documentSizeWidths[documentSize]
}

export function getFallbackPageSize(documentSize: DocumentSize) {
  const width = getDocumentWidth(documentSize)
  return {
    width,
    height: width * fallbackPageAspectRatio,
  }
}

export function getScaledPageSize(pageSize: Size | null, documentSize: DocumentSize) {
  if (!pageSize) {
    return getFallbackPageSize(documentSize)
  }

  const scale = getDocumentWidth(documentSize) / pageSize.width
  return {
    width: pageSize.width * scale,
    height: pageSize.height * scale,
  }
}
