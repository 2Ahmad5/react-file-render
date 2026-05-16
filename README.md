# react-file-render

React file renderer for PDF, DOCX, images, code files, and folder sources.

## Install

```bash
npm install react-file-render
```

## Supported file types

- `pdf`
- `docx`
- `image`, `jpg`, `jpeg`, `png`, `avif`
- code extensions: `txt`, `js`, `jsx`, `ts`, `tsx`, `json`, `css`, `scss`, `html`, `md`, `py`, `java`, `c`, `cpp`, `cs`, `go`, `rs`, `php`, `rb`, `swift`, `kt`, `sql`, `sh`, `yml`, `yaml`, `xml`
- `folder` (auto-selects supported files from a directory listing or `index.json` manifest)

## Usage

```tsx
import { FileRenderer } from "react-file-render"
import "react-pdf/dist/Page/AnnotationLayer.css"
import "react-pdf/dist/Page/TextLayer.css"

export function App() {
  return (
    <FileRenderer
      source="/test/2225.pdf"
      fileType="pdf"
      options={{
        interactive: true,
        allowDownload: true,
        allowSearch: true,
        theme: "light",
        documentSize: "normal",
      }}
    />
  )
}
```

## Options

`FileRenderer` accepts an `options` object.

- `interactive?: boolean`
  - Default: `true`
  - Turns renderer interactions on/off. When `false`, interactive controls are hidden and content is shown as static preview.

- `allowDownload?: boolean`
  - Default: `false`
  - Shows download control for supported renderers, only when `interactive` is `true`.

- `allowSearch?: boolean`
  - Default: auto by renderer type
  - Enables search in searchable renderers (`pdf`, `docx`, images via OCR, code files).

- `theme?: "light" | "dark"`
  - Default: `"light"`
  - Applies the renderer control/theme palette.

- `documentSize?: "small" | "normal" | "large" | "xlarge"`
  - Default: `"normal"`
  - Controls default viewport/document width for document-style renderers.

- `className?: string`
  - Optional root class override for renderer container.

- `slotClasses?: { container, toolbar, iconButton, searchInput, viewport, image, page }`
  - Optional class overrides for specific renderer UI regions.

- `image?: { fit, repeat, position, backgroundColor }`
  - `fit?: "contain" | "cover" | "fill" | "none" | "scale-down"` (default: `"cover"`)
  - `repeat?: "no-repeat" | "repeat" | "repeat-x" | "repeat-y"` (default: `"no-repeat"`)
  - `position?: string` (default: `"center"`, any valid CSS background-position)
  - `backgroundColor?: string` (any valid CSS color)

- `code?: { language, showLineNumbers, wrapLines, theme }`
  - `language?: string` to force a syntax language instead of extension-based auto-detect
  - `showLineNumbers?: boolean` (default: `true`)
  - `wrapLines?: boolean` (default: `false`)
  - `theme?: "github-light" | "github-dark" | "vitesse-light" | "vitesse-dark"`

- `byType?: Partial<Record<SupportedFileType, RendererStyleOptions>>`
  - Per-file-type option overrides.
  - Useful when rendering mixed types with one shared config.

Example with nested options:

```tsx
<FileRenderer
  source="/test/sample.py"
  fileType="py"
  options={{
    interactive: true,
    allowDownload: true,
    theme: "dark",
    code: {
      showLineNumbers: true,
      wrapLines: true,
      theme: "github-dark",
    },
    byType: {
      pdf: { documentSize: "large", allowSearch: true },
      png: { image: { fit: "contain", backgroundColor: "#0f172a" } },
    },
  }}
/>
```

## Local development

```bash
npm install
npm run build
npm run playground:install
npm run playground
```
