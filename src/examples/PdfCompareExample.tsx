import { FileRenderer } from "../FileRenderer"
import { Card, CardContent } from "../components/ui/card"
import { Document, Page, pdfjs } from "react-pdf"

import "react-pdf/dist/Page/AnnotationLayer.css"
import "react-pdf/dist/Page/TextLayer.css"

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

type PdfCompareExampleProps = {
  source: string
}

export function PdfCompareExample({ source }: PdfCompareExampleProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div>
        <h3 className="mb-2 text-sm font-semibold">Your renderer (react-pdf wrapper)</h3>
        <FileRenderer
          source={source}
          fileType="pdf"
          options={{ allowDownload: true, allowSearch: true }}
        />
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold">Default react-pdf baseline</h3>
          <Card className="rounded-md shadow-none">
            <CardContent className="p-3">
            <div className="max-h-[80vh] overflow-auto rounded-md border bg-gray-50 p-3">
              <Document file={source} loading={<div className="p-4 text-sm">Loading PDF...</div>}>
                <Page pageNumber={1} width={900} renderTextLayer renderAnnotationLayer />
              </Document>
            </div>
            </CardContent>
          </Card>
        </div>
      </div>
  )
}
