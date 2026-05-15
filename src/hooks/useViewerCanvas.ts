import { useZoomPan } from "../components/viewport/useZoomPan"

type UseViewerCanvasOptions = {
  minZoom?: number
  maxZoom?: number
}

export function useViewerCanvas(options: UseViewerCanvasOptions = {}) {
  const zoomPan = useZoomPan(options)

  return {
    canvasRef: zoomPan.viewportRef,
    zoom: zoomPan.zoom,
    panOffset: zoomPan.panOffset,
    setPanOffset: zoomPan.setPanOffset,
    resetCanvasView: zoomPan.resetView,
    isCanvasReset: zoomPan.isViewReset,
    canvasHandlers: zoomPan.handlers,
  }
}
