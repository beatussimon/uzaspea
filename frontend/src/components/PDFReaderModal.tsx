import React, { useState, useEffect, useRef } from 'react';
import { 
  X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, 
  Maximize2, Minimize2, ShieldAlert, Loader2 
} from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';

// Set up worker
try {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
} catch (e) {
  console.warn('PDF Worker setup warning:', e);
}

interface PDFReaderModalProps {
  title: string;
  pdfUrl?: string;
  pdfBlob?: Blob;
  buyerEmail?: string;
  licenseKey?: string;
  onClose: () => void;
}

export const PDFReaderModal: React.FC<PDFReaderModalProps> = ({
  title,
  pdfUrl,
  pdfBlob,
  buyerEmail,
  licenseKey,
  onClose,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [scale, setScale] = useState<number>(1.2);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Anti-piracy: intercept print, copy, save hotkeys and right clicks
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && ['p', 's', 'c', 'u'].includes(e.key.toLowerCase())) {
        e.preventDefault();
        e.stopPropagation();
      }
      if (e.key === 'Escape' && !isFullscreen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isFullscreen, onClose]);

  // Load PDF Document
  useEffect(() => {
    let isCancelled = false;
    setLoading(true);
    setError(null);

    const loadDoc = async () => {
      try {
        let loadingTask: any;
        if (pdfBlob) {
          const arrayBuffer = await pdfBlob.arrayBuffer();
          loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        } else if (pdfUrl) {
          loadingTask = pdfjsLib.getDocument({
            url: pdfUrl,
            withCredentials: false
          });
        } else {
          throw new Error('No PDF source provided');
        }

        const doc = await loadingTask.promise;
        if (!isCancelled) {
          setPdfDoc(doc);
          setTotalPages(doc.numPages);
          setCurrentPage(1);
          setLoading(false);
        }
      } catch (err: any) {
        console.error('Failed to load PDF document:', err);
        if (!isCancelled) {
          setError(err.message || 'Unable to open document. The session may have expired.');
          setLoading(false);
        }
      }
    };

    loadDoc();
    return () => {
      isCancelled = true;
    };
  }, [pdfUrl, pdfBlob]);

  // Render current page onto canvas
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;

    let renderTask: any = null;

    const renderPage = async () => {
      try {
        const page = await pdfDoc.getPage(currentPage);
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const viewport = page.getViewport({ scale });
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        renderTask = page.render({
          canvasContext: ctx,
          viewport,
        });

        await renderTask.promise;
      } catch (err: any) {
        if (err.name !== 'RenderingCancelledException') {
          console.error('Page render error:', err);
        }
      }
    };

    renderPage();
    return () => {
      if (renderTask) {
        try {
          renderTask.cancel();
        } catch {}
      }
    };
  }, [pdfDoc, currentPage, scale]);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 z-50 flex flex-col bg-neutral-900/90 backdrop-blur-md select-none animate-fade-in"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Top Navigation Toolbar */}
      <header className="h-14 px-4 bg-surface dark:bg-[#141414] border-0 flex items-center justify-between text-white shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <h2 className="text-sm font-bold truncate max-w-xs md:max-w-md text-gray-900 dark:text-white" title={title}>
            {title}
          </h2>
          {licenseKey && (
            <span className="hidden sm:inline-block text-3xs font-mono text-gray-500 dark:text-gray-400">
              {licenseKey}
            </span>
          )}
        </div>

        {/* Page navigation & Zoom controls */}
        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            className="p-1.5 rounded-lg bg-surface-muted dark:bg-[#1e1e24] text-gray-700 dark:text-gray-200 disabled:opacity-40 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition cursor-pointer"
            title="Previous Page"
          >
            <ChevronLeft size={16} />
          </button>

          <span className="text-xs font-semibold px-2 text-gray-800 dark:text-gray-200">
            {totalPages > 0 ? `${currentPage} / ${totalPages}` : '—'}
          </span>

          <button
            type="button"
            disabled={currentPage >= totalPages}
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            className="p-1.5 rounded-lg bg-surface-muted dark:bg-[#1e1e24] text-gray-700 dark:text-gray-200 disabled:opacity-40 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition cursor-pointer"
            title="Next Page"
          >
            <ChevronRight size={16} />
          </button>

          <div className="h-4 w-px bg-neutral-300 dark:bg-neutral-800 mx-1 hidden sm:block" />

          <button
            type="button"
            onClick={() => setScale((s) => Math.max(0.6, s - 0.2))}
            className="p-1.5 rounded-lg bg-surface-muted dark:bg-[#1e1e24] text-gray-700 dark:text-gray-200 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition cursor-pointer hidden sm:inline-flex"
            title="Zoom Out"
          >
            <ZoomOut size={16} />
          </button>

          <span className="text-3xs text-gray-500 dark:text-gray-400 hidden sm:inline-block min-w-10 text-center font-mono">
            {Math.round(scale * 100)}%
          </span>

          <button
            type="button"
            onClick={() => setScale((s) => Math.min(2.5, s + 0.2))}
            className="p-1.5 rounded-lg bg-surface-muted dark:bg-[#1e1e24] text-gray-700 dark:text-gray-200 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition cursor-pointer hidden sm:inline-flex"
            title="Zoom In"
          >
            <ZoomIn size={16} />
          </button>

          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-1.5 rounded-lg bg-surface-muted dark:bg-[#1e1e24] text-gray-700 dark:text-gray-200 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition cursor-pointer hidden md:inline-flex"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 ml-2 rounded-lg bg-surface-muted dark:bg-[#1e1e24] text-gray-700 dark:text-gray-200 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition cursor-pointer"
            title="Close Reader"
          >
            <X size={16} />
          </button>
        </div>
      </header>

      {/* Main Canvas Scroll Area */}
      <main className="flex-1 overflow-auto flex items-center justify-center p-4 bg-[#0A0A0A] relative">
        {loading && (
          <div className="flex flex-col items-center gap-3 text-neutral-400">
            <Loader2 size={32} className="animate-spin text-gray-400" />
            <p className="text-xs font-medium">Decrypting & verifying protected document...</p>
          </div>
        )}

        {error && (
          <div className="max-w-md p-6 bg-surface dark:bg-[#141414] rounded-xl text-center space-y-3">
            <ShieldAlert size={36} className="mx-auto text-red-500" />
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Document Access Restricted</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">{error}</p>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-neutral-200 dark:bg-neutral-800 text-xs font-bold text-gray-900 dark:text-white rounded-lg hover:bg-neutral-300 dark:hover:bg-neutral-700 transition"
            >
              Back to Library
            </button>
          </div>
        )}

        {!loading && !error && (
          <div className="relative shadow-2xl bg-white max-w-full">
            <canvas ref={canvasRef} className="block max-w-full h-auto pointer-events-none" />

            {/* Subtle floating anti-tamper watermark pill overlay */}
            <div className="absolute bottom-3 right-3 pointer-events-none opacity-40 text-3xs font-mono text-black bg-white/70 px-2 py-0.5 rounded">
              {buyerEmail ? `Licensed to ${buyerEmail}` : 'Verified Reader'}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
