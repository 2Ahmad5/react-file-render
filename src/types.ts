export type SupportedFileType = "pdf" | "docx" | "image" | "jpg" | "jpeg" | "png" | "avif" | "video" | "folder"

export type ImageFit = "contain" | "cover" | "fill" | "none" | "scale-down"

export type ImageRepeat = "no-repeat" | "repeat" | "repeat-x" | "repeat-y"

export type DocumentSize = "small" | "normal" | "large" | "xlarge"

export type RendererOptions = {
  theme?: "light" | "dark"
  className?: string
  showToolbar?: boolean
  allowDownload?: boolean
  allowSearch?: boolean
  documentSize?: DocumentSize
  image?: {
    fit?: ImageFit
    repeat?: ImageRepeat
    position?: string
    backgroundColor?: string
  }
  slotClasses?: {
    container?: string
    toolbar?: string
    iconButton?: string
    searchInput?: string
    viewport?: string
    image?: string
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
