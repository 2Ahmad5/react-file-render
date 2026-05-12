import type { BaseRendererProps } from "../../types"
import { ViewerOverlayControls } from "../../components/ViewerOverlayControls"

export function DocxRenderer({ source, options }: BaseRendererProps) {
  const allowDownload = options?.allowDownload ?? false

  return (
    <div className={options?.className ?? "group relative rounded-md border p-4"}>
      <ViewerOverlayControls source={source} showDownload={allowDownload} showSearch={false} />
      <p className="text-sm">DOCX preview is not wired yet.</p>
      <a
        href={source}
        target="_blank"
        rel="noreferrer"
        className="mt-2 inline-block text-sm underline"
      >
        Open DOCX file
      </a>
    </div>
  )
}
