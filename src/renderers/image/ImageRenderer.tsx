import type { BaseRendererProps, ImageFit, ImageRepeat } from "../../types"
import { ViewerOverlayControls } from "../../components/ViewerOverlayControls"
import { Card } from "../../components/ui/card"
import { cn } from "../../lib/utils"

function getBackgroundSize(fit: ImageFit, repeat: ImageRepeat) {
  if (repeat !== "no-repeat" && fit === "none") {
    return "auto"
  }

  if (fit === "fill") {
    return "100% 100%"
  }

  if (fit === "scale-down") {
    return "contain"
  }

  return fit
}

export function ImageRenderer({ source, options }: BaseRendererProps) {
  const allowDownload = options?.allowDownload ?? false
  const theme = options?.theme ?? "light"
  const isDark = theme === "dark"
  const fit = options?.image?.fit ?? "contain"
  const repeat = options?.image?.repeat ?? "no-repeat"
  const position = options?.image?.position ?? "center"
  const backgroundColor = options?.image?.backgroundColor

  return (
    <Card
      className={
        options?.slotClasses?.container ??
        options?.className ??
        (isDark
          ? "group relative h-[80vh] overflow-hidden rounded-lg border border-neutral-700 bg-neutral-800 shadow-sm"
          : "group relative h-[80vh] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm")
      }
    >
      <ViewerOverlayControls source={source} theme={theme} showDownload={allowDownload} showSearch={false} />
      <div
        role="img"
        aria-label="Preview"
        className={cn(
          options?.slotClasses?.viewport ?? (isDark ? "h-full w-full bg-neutral-700" : "h-full w-full bg-slate-100"),
          options?.slotClasses?.image,
        )}
        style={{
          backgroundColor,
          backgroundImage: `url(${source})`,
          backgroundPosition: position,
          backgroundRepeat: repeat,
          backgroundSize: getBackgroundSize(fit, repeat),
        }}
      />
    </Card>
  )
}
