import { createHighlighterCore, type LanguageInput, type ThemedToken, type TokensResult } from "shiki/core"
import { createJavaScriptRegexEngine } from "shiki/engine/javascript"
import githubDark from "@shikijs/themes/github-dark"
import githubLight from "@shikijs/themes/github-light"
import vitesseDark from "@shikijs/themes/vitesse-dark"
import vitesseLight from "@shikijs/themes/vitesse-light"
import type { CodeTheme } from "../../types"

type LanguageLoader = () => Promise<LanguageInput>

const languageLoaders: Record<string, LanguageLoader> = {
  bash: () => import("@shikijs/langs/bash").then((module) => module.default),
  c: () => import("@shikijs/langs/c").then((module) => module.default),
  cpp: () => import("@shikijs/langs/cpp").then((module) => module.default),
  csharp: () => import("@shikijs/langs/csharp").then((module) => module.default),
  css: () => import("@shikijs/langs/css").then((module) => module.default),
  go: () => import("@shikijs/langs/go").then((module) => module.default),
  html: () => import("@shikijs/langs/html").then((module) => module.default),
  java: () => import("@shikijs/langs/java").then((module) => module.default),
  javascript: () => import("@shikijs/langs/javascript").then((module) => module.default),
  json: () => import("@shikijs/langs/json").then((module) => module.default),
  jsx: () => import("@shikijs/langs/jsx").then((module) => module.default),
  kotlin: () => import("@shikijs/langs/kotlin").then((module) => module.default),
  markdown: () => import("@shikijs/langs/markdown").then((module) => module.default),
  php: () => import("@shikijs/langs/php").then((module) => module.default),
  python: () => import("@shikijs/langs/python").then((module) => module.default),
  ruby: () => import("@shikijs/langs/ruby").then((module) => module.default),
  rust: () => import("@shikijs/langs/rust").then((module) => module.default),
  scss: () => import("@shikijs/langs/scss").then((module) => module.default),
  sql: () => import("@shikijs/langs/sql").then((module) => module.default),
  swift: () => import("@shikijs/langs/swift").then((module) => module.default),
  tsx: () => import("@shikijs/langs/tsx").then((module) => module.default),
  typescript: () => import("@shikijs/langs/typescript").then((module) => module.default),
  xml: () => import("@shikijs/langs/xml").then((module) => module.default),
  yaml: () => import("@shikijs/langs/yaml").then((module) => module.default),
}

const loadedLanguages = new Set<string>()
const highlighterPromise = createHighlighterCore({
  themes: [githubLight, githubDark, vitesseLight, vitesseDark],
  langs: [],
  engine: createJavaScriptRegexEngine(),
})

export type CodeToken = ThemedToken

export function canHighlightLanguage(language: string) {
  return language in languageLoaders
}

export function createPlainTokenResult(code: string): TokensResult {
  return {
    tokens: code.split("\n").map((line) => [{ content: line, offset: 0 }]),
  }
}

export async function highlightCode(code: string, language: string, theme: CodeTheme) {
  if (!canHighlightLanguage(language)) {
    return createPlainTokenResult(code)
  }

  const highlighter = await highlighterPromise
  if (!loadedLanguages.has(language)) {
    await highlighter.loadLanguage(await languageLoaders[language]())
    loadedLanguages.add(language)
  }

  return highlighter.codeToTokens(code, { lang: language, theme })
}
