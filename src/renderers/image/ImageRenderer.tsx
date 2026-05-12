import type { BaseRendererProps } from "../../types"
import { ViewerOverlayControls } from "../../components/ViewerOverlayControls"

export function ImageRenderer({ source, options }: BaseRendererProps) {
  const allowDownload = options?.allowDownload ?? false

  return (
    <div className={options?.className ?? "group relative"}>
      <ViewerOverlayControls source={source} showDownload={allowDownload} showSearch={false} />
      <img src={source} alt="Preview" className="max-h-[80vh] w-full rounded-md border object-contain" />
    </div>
  )
}
