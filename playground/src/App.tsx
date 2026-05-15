import { useState } from "react";
import { FileRenderer, type DocumentSize, type ImageFit, type ImageRepeat, type SupportedFileType } from "react-file-render";
import { Input } from "../../src/components/ui/input";
import { Label } from "../../src/components/ui/label";

import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

type TestFile = { label: string; source: string; fileType: SupportedFileType };

const testFileModules = import.meta.glob("../public/test/*", { eager: true, query: "?url", import: "default" });

function getFileType(path: string): SupportedFileType {
  const extension = path.split(".").pop()?.toLowerCase();

  if (extension === "jpg" || extension === "jpeg" || extension === "png" || extension === "avif" || extension === "pdf" || extension === "docx") {
    return extension;
  }

  return "image";
}

function getFileLabel(path: string) {
  const filename = path.split("/").pop() ?? path;
  return decodeURIComponent(filename).replace(/\.[^.]+$/, "");
}

const testFiles = Object.keys(testFileModules)
  .map<TestFile>((path) => ({
    label: getFileLabel(path),
    source: path.replace("../public", ""),
    fileType: getFileType(path),
  }))
  .sort((a, b) => a.label.localeCompare(b.label));

const imageFits = ["contain", "cover", "fill", "none", "scale-down"] satisfies ImageFit[];
const imageRepeats = ["no-repeat", "repeat", "repeat-x", "repeat-y"] satisfies ImageRepeat[];
const documentSizes = ["small", "normal", "large", "xlarge"] satisfies DocumentSize[];

export default function App() {
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const [source, setSource] = useState(testFiles[0].source);
  const [fileType, setFileType] = useState<SupportedFileType>(testFiles[0].fileType);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [documentSize, setDocumentSize] = useState<DocumentSize>("normal");
  const [imageFit, setImageFit] = useState<ImageFit>("cover");
  const [imageRepeat, setImageRepeat] = useState<ImageRepeat>("no-repeat");
  const [imagePosition, setImagePosition] = useState("center");

  const isImage = fileType === "image" || fileType === "jpg" || fileType === "jpeg" || fileType === "png" || fileType === "avif";
  const isDocument = fileType === "pdf" || fileType === "docx";

  function selectTestFile(index: number) {
    const testFile = testFiles[index];
    setSelectedFileIndex(index);
    setSource(testFile.source);
    setFileType(testFile.fileType);
  }

  return (
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="text-2xl font-semibold">File renderer playground</h1>
      <p className="mt-1 text-sm text-slate-600">Test PDF, JPG, and PNG rendering with package options.</p>

      <section className="mt-5 grid gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-3">
        <label className="block text-sm font-medium text-slate-700">
          Test file
          <select
            value={selectedFileIndex}
            onChange={(event) => selectTestFile(Number(event.target.value))}
            className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
          >
            {testFiles.map((file, index) => (
              <option key={file.source} value={index}>
                {file.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm font-medium text-slate-700">
          File type
          <select
            value={fileType}
            onChange={(event) => setFileType(event.target.value as SupportedFileType)}
            className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
          >
            <option value="pdf">pdf</option>
            <option value="docx">docx</option>
            <option value="jpg">jpg</option>
            <option value="png">png</option>
            <option value="avif">avif</option>
            <option value="image">image</option>
            <option value="folder">folder</option>
          </select>
        </label>

        <label className="block text-sm font-medium text-slate-700">
          Theme
          <select
            value={theme}
            onChange={(event) => setTheme(event.target.value as "light" | "dark")}
            className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
          >
            <option value="light">light</option>
            <option value="dark">dark</option>
          </select>
        </label>

        {isDocument ? (
          <label className="block text-sm font-medium text-slate-700">
            Document size
            <select
              value={documentSize}
              onChange={(event) => setDocumentSize(event.target.value as DocumentSize)}
              className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
            >
              {documentSizes.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <div className="md:col-span-3">
          <Label className="block">Source URL</Label>
          <Input
            value={source}
            onChange={(event) => setSource(event.target.value)}
            className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm"
          />
        </div>

        {isImage ? (
          <>
            <label className="block text-sm font-medium text-slate-700">
              Image fit
              <select
                value={imageFit}
                onChange={(event) => setImageFit(event.target.value as ImageFit)}
                className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
              >
                {imageFits.map((fit) => (
                  <option key={fit} value={fit}>
                    {fit}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-medium text-slate-700">
              Image repeat
              <select
                value={imageRepeat}
                onChange={(event) => setImageRepeat(event.target.value as ImageRepeat)}
                className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
              >
                {imageRepeats.map((repeat) => (
                  <option key={repeat} value={repeat}>
                    {repeat}
                  </option>
                ))}
              </select>
            </label>

            <div>
              <Label className="block">Image position</Label>
              <Input
                value={imagePosition}
                onChange={(event) => setImagePosition(event.target.value)}
                className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm"
                placeholder="center"
              />
            </div>
          </>
        ) : null}
      </section>

      <section className="mt-6">
        <h2 className="mb-2 text-sm font-semibold">Renderer</h2>
        <FileRenderer
          source={source}
          fileType={fileType}
          options={{
            allowDownload: true,
            allowSearch: fileType === "pdf" || fileType === "docx" || isImage || fileType === "folder",
            theme,
            documentSize,
            image: {
              fit: imageFit,
              repeat: imageRepeat,
              position: imagePosition,
            },
          }}
        />
      </section>
    </main>
  );
}
