import type { BaseRendererProps } from "../../types"
import { ViewerOverlayControls } from "../../components/ViewerOverlayControls"
import { buttonVariants } from "../../components/ui/button"
import { Card, CardContent } from "../../components/ui/card"
import { cn } from "../../lib/utils"

export function DocxRenderer({ source, options }: BaseRendererProps) {
  const allowDownload = options?.allowDownload ?? false

  return (
    <Card className={options?.className ?? "group relative rounded-md shadow-none"}>
      <ViewerOverlayControls source={source} showDownload={allowDownload} showSearch={false} />
      <CardContent className="p-4">
        <p className="text-sm">DOCX preview is not wired yet.</p>
        <a
          href={source}
          target="_blank"
          rel="noreferrer"
          className={cn(buttonVariants({ variant: "link" }), "mt-2 h-auto p-0 text-sm")}
        >
          Open DOCX file
        </a>
      </CardContent>
    </Card>
  )
}
