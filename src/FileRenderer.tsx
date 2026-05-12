import { rendererRegistry } from "./registry"
import { UnsupportedRenderer } from "./renderers/fallback/UnsupportedRenderer"
import type { FileRendererProps } from "./types"

export function FileRenderer({ source, fileType, options }: FileRendererProps) {
  const Renderer = rendererRegistry[fileType]
  const normalizedOptions = {
    ...options,
    allowSearch: fileType === "pdf" ? options?.allowSearch : false,
  }

  if (!Renderer) {
    return <UnsupportedRenderer source={source} options={normalizedOptions} />
  }

  return <Renderer source={source} options={normalizedOptions} />
}
