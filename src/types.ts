export type SupportedFileType = "pdf" | "docx" | "image" | "video"

export type RendererOptions = {
  className?: string
  showToolbar?: boolean
  allowDownload?: boolean
  allowSearch?: boolean
  slotClasses?: {
    container?: string
    toolbar?: string
    iconButton?: string
    searchInput?: string
    viewport?: string
    page?: string
  }
}

export type FileRendererProps = {
  source: string
  fileType: SupportedFileType
  options?: RendererOptions
}

export type BaseRendererProps = {
  source: string
  options?: RendererOptions
}
