# react-file-render

Basic multi-file renderer package (v1), with PDF powered by `react-pdf`.

## Local dev workflow

```bash
npm install
npm run build
npm run playground:install
npm run playground
```

Then open the Vite URL and test side-by-side:
- left: your wrapper (`FileRenderer`) with search + download icons
- right: basic `react-pdf`

Your test PDF is loaded from `test/2225.pdf` through `playground/public/test`.

## Package usage

```tsx
import { FileRenderer } from "react-file-render"

export function App() {
  return (
    <FileRenderer
      source="/sample.pdf"
      fileType="pdf"
      options={{ showToolbar: true, allowDownload: true, allowSearch: true }}
    />
  )
}
```
