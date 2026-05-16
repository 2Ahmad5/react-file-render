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

- `interactive`: enables zoom/pan/search/pagination controls when supported; set `false` for static display mode
- `allowDownload`: shows download control when `interactive` is enabled
- `allowSearch`: enables search for searchable renderers (PDF, DOCX, images via OCR, code)
- `theme`: `"light" | "dark"`
- `documentSize`: `"small" | "normal" | "large" | "xlarge"`
- `image`: `fit`, `repeat`, `position`, `backgroundColor`
- `code`: `language`, `showLineNumbers`, `wrapLines`, `theme`
- `byType`: per-file-type option overrides

## Local development

```bash
npm install
npm run build
npm run playground:install
npm run playground
```
