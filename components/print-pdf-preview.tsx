"use client";
import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import styles from "./print-quick.module.css";

export function PrintPdfPreview({ url, fileName }: { url: string; fileName: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy>(), [page, setPage] = useState(1);
  const [error, setError] = useState(""), [rendering, setRendering] = useState(true);
  useEffect(() => {
    let disposed = false;
    let task: ReturnType<typeof import("pdfjs-dist")["getDocument"]> | undefined;
    setError(""); setPdf(undefined); setPage(1); setRendering(true);
    void (async () => {
      try {
        const lib = await import("pdfjs-dist");
        if (disposed) return;
        const assets = `/vendor/pdfjs/${lib.version}/`;
        lib.GlobalWorkerOptions.workerSrc = `${assets}pdf.worker.min.mjs`;
        // Canvas rendering only: no scripting manager, links, forms or PDF actions.
        task = lib.getDocument({ url, cMapUrl: `${assets}cmaps/`, cMapPacked: true, standardFontDataUrl: `${assets}standard_fonts/`, wasmUrl: `${assets}wasm/` });
        const doc = await task.promise;
        if (!disposed) setPdf(doc);
      } catch { if (!disposed) { setError("Anteprima non disponibile: apri il PDF nella scheda dedicata prima di approvare."); setRendering(false); } }
    })();
    return () => { disposed = true; void task?.destroy(); };
  }, [url]);
  useEffect(() => {
    if (!pdf || !canvas.current) return;
    let disposed = false; let renderTask: RenderTask | undefined;
    setRendering(true);
    void (async () => {
      try {
        const item = await pdf.getPage(page);
        if (disposed || !canvas.current) return;
        const viewport = item.getViewport({ scale: 1.6 });
        canvas.current.width = viewport.width; canvas.current.height = viewport.height;
        renderTask = item.render({ canvas: canvas.current, viewport });
        await renderTask.promise;
        if (!disposed) setRendering(false);
      } catch { if (!disposed) { setError("Impossibile mostrare questa pagina. Apri il PDF nella scheda dedicata."); setRendering(false); } }
    })();
    return () => { disposed = true; renderTask?.cancel(); };
  }, [pdf, page]);
  return <>
    <div className={styles.pdfPage} aria-busy={rendering}>
      {error ? <p role="alert">{error}</p> : <><canvas ref={canvas} aria-label={`Anteprima ${fileName}, pagina ${page}`} role="img" />{rendering && <p role="status">Caricamento anteprima…</p>}</>}
    </div>
    {pdf && <div className={styles.pager}><button type="button" aria-label="Pagina precedente" disabled={page === 1 || rendering} onClick={() => setPage(p => p - 1)}>←</button><span>Pagina {page} di {pdf.numPages}</span><button type="button" aria-label="Pagina successiva" disabled={page === pdf.numPages || rendering} onClick={() => setPage(p => p + 1)}>→</button></div>}
  </>;
}
