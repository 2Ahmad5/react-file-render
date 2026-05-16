import type { SupportedFileType } from "../../types"

export const codeExtensions = [
  "txt",
  "js",
  "jsx",
  "ts",
  "tsx",
  "json",
  "css",
  "scss",
  "html",
  "md",
  "py",
  "java",
  "c",
  "cpp",
  "cs",
  "go",
  "rs",
  "php",
  "rb",
  "swift",
  "kt",
  "sql",
  "sh",
  "yml",
  "yaml",
  "xml",
] as const

export const codeExtensionSet = new Set<string>(codeExtensions)

export const codeLanguageByExtension: Record<string, string> = {
  c: "c",
  cpp: "cpp",
  cs: "csharp",
  css: "css",
  go: "go",
  html: "html",
  java: "java",
  js: "javascript",
  json: "json",
  jsx: "jsx",
  kt: "kotlin",
  md: "markdown",
  php: "php",
  py: "python",
  rb: "ruby",
  rs: "rust",
  scss: "scss",
  sh: "bash",
  sql: "sql",
  swift: "swift",
  ts: "typescript",
  tsx: "tsx",
  txt: "text",
  xml: "xml",
  yaml: "yaml",
  yml: "yaml",
}

export function getCodeLanguage(source: string, explicitLanguage?: string) {
  if (explicitLanguage) {
    return explicitLanguage
  }

  const pathname = source.split(/[?#]/)[0]
  const extension = pathname.split(".").pop()?.toLowerCase()
  return extension ? codeLanguageByExtension[extension] ?? "text" : "text"
}

export function isCodeFileType(fileType: SupportedFileType) {
  return fileType === "code" || codeExtensionSet.has(fileType)
}
