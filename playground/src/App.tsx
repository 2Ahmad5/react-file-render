import { useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { FileRenderer } from "react-file-render";
import { Card, CardContent } from "../../src/components/ui/card";
import { Input } from "../../src/components/ui/input";
import { Label } from "../../src/components/ui/label";

import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export default function App() {
  const [source, setSource] = useState(
    "/test/342 Final Project Rough Draft.pdf",
  );

  return (
    <main className="mx-auto max-w-7xl p-6">
      <h1 className="text-2xl font-semibold">PDF side-by-side test</h1>
      <p className="mt-1 text-sm text-slate-600">
        Left: your wrapper. Right: basic react-pdf.
      </p>

      <Label className="mt-4 block">PDF source URL</Label>
      <Input
        value={source}
        onChange={(event) => setSource(event.target.value)}
        className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm"
      />

      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-2 text-sm font-semibold">Your renderer</h2>
          <FileRenderer
            source={source}
            fileType="pdf"
            options={{ allowDownload: true, allowSearch: true }}
          />
        </div>

        <div>
          <h2 className="mb-2 text-sm font-semibold">Basic react-pdf</h2>
          <Card className="rounded-md shadow-none">
            <CardContent className="p-3">
              <div className="max-h-[80vh] overflow-auto rounded-md border bg-slate-50 p-3">
                <Document
                  file={source}
                  loading={<div className="p-3 text-sm">Loading PDF...</div>}
                >
                  <Page
                    pageNumber={1}
                    width={900}
                    renderTextLayer
                    renderAnnotationLayer
                  />
                </Document>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}
