export type SupportedFileType =
  | "pdf"
  | "docx"
  | "image"
  | "jpg"
  | "jpeg"
  | "png"
  | "avif"
  | "code"
  | "txt"
  | "js"
  | "jsx"
  | "ts"
  | "tsx"
  | "json"
  | "css"
  | "scss"
  | "html"
  | "md"
  | "py"
  | "java"
  | "c"
  | "cpp"
  | "cs"
  | "go"
  | "rs"
  | "php"
  | "rb"
  | "swift"
  | "kt"
  | "sql"
  | "sh"
  | "yml"
  | "yaml"
  | "xml"
  | "folder"

export type ImageFit = "contain" | "cover" | "fill" | "none" | "scale-down"

export type ImageRepeat = "no-repeat" | "repeat" | "repeat-x" | "repeat-y"

export type DocumentSize = "small" | "normal" | "large" | "xlarge"

export type CodeTheme = "github-light" | "github-dark" | "vitesse-light" | "vitesse-dark"

export type RendererStyleOptions = {
  interactive?: boolean
  theme?: "light" | "dark"
  className?: string
  showToolbar?: boolean
  allowDownload?: boolean
  allowSearch?: boolean
  documentSize?: DocumentSize
  code?: {
    language?: string
    showLineNumbers?: boolean
    wrapLines?: boolean
    theme?: CodeTheme
  }
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

export type RendererOptions = RendererStyleOptions & {
  byType?: Partial<Record<SupportedFileType, RendererStyleOptions>>
}

export type FileRendererProps = {
  source: string
  fileType: SupportedFileType
  options?: RendererOptions
}

export type BaseRendererProps = {
  source: string
  options?: RendererStyleOptions
}
