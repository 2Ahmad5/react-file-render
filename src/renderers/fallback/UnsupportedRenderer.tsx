import type { BaseRendererProps } from "../../types"
import { buttonVariants } from "../../components/ui/button"
import { Card, CardContent } from "../../components/ui/card"
import { cn } from "../../lib/utils"

export function UnsupportedRenderer({ source, options }: BaseRendererProps) {
  return (
    <Card className={options?.className ?? "rounded-md shadow-none"}>
      <CardContent className="p-4">
        <p className="text-sm font-medium">Unsupported file type</p>
        <a
          href={source}
          target="_blank"
          rel="noreferrer"
          className={cn(buttonVariants({ variant: "link" }), "mt-2 h-auto p-0 text-sm")}
        >
          Open file
        </a>
      </CardContent>
    </Card>
  )
}
