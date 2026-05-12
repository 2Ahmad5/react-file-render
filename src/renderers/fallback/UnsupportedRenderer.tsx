import type { BaseRendererProps } from "../../types"

export function UnsupportedRenderer({ source, options }: BaseRendererProps) {
  return (
    <div className={options?.className ?? "rounded-md border p-4"}>
      <p className="text-sm font-medium">Unsupported file type</p>
      <a
        href={source}
        target="_blank"
        rel="noreferrer"
        className="mt-2 inline-block text-sm underline"
      >
        Open file
      </a>
    </div>
  )
}
