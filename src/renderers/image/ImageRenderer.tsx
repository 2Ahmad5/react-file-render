import type { BaseRendererProps } from "../../types"
import { ViewerOverlayControls } from "../../components/ViewerOverlayControls"
import { Card } from "../../components/ui/card"

export function ImageRenderer({ source, options }: BaseRendererProps) {
  const allowDownload = options?.allowDownload ?? false

  return (
    <Card className={options?.className ?? "group relative border-0 bg-transparent shadow-none"}>
      <ViewerOverlayControls source={source} showDownload={allowDownload} showSearch={false} />
      <img src={source} alt="Preview" className="max-h-[80vh] w-full rounded-md border object-contain" />
    </Card>
  )
}
