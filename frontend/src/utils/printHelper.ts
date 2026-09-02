export interface PrintElementOptions {
  pageTitle?: string;
  pageStyle?: string;
  bodyClass?: string;
}

/**
 * Cleanly prints a DOM element by rendering it in a hidden iframe with all active stylesheets.
 * Captures the complete Tailwind CSS bundle, enforces exact print color reproduction,
 * and ensures all images/logos are fully loaded before opening the print dialog.
 */
export const printElement = async (
  element: HTMLElement,
  options: PrintElementOptions = {}
): Promise<void> => {
  const {
    pageTitle = 'Print Document',
    pageStyle = '@page { size: A4 portrait; margin: 12mm 14mm;}',
    bodyClass = 'bg-white text-black p-0 m-0 font-sans',
  } = options;

  // 1. Create hidden iframe
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.zIndex = '-1000';
  iframe.setAttribute('aria-hidden', 'true');
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    if (document.body.contains(iframe)) {
      document.body.removeChild(iframe);
    }
    throw new Error('Failed to access print iframe document.');
  }

  // 2. Clone all active stylesheets and style blocks (captures full Tailwind CSS bundle)
  const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
    .map((node) => node.outerHTML)
    .join('\n');

  // 3. Construct self-contained document
  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html lang="en" class="light">
      <head>
        <meta charset="utf-8" />
        <title>${pageTitle}</title>
        ${styles}
        <style>
          ${pageStyle}
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
            box-sizing: border-box !important;
          }
          html, body {
            background: #ffffff !important;
            color: #111827 !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .print-hidden {
            display: none !important;
          }
          img {
            max-width: 100%;
          }
        </style>
      </head>
      <body class="${bodyClass}">
        <div class="print-content-wrapper">
          ${element.innerHTML}
        </div>
      </body>
    </html>
  `);
  doc.close();

  // 4. Wait for images and SVG fonts inside iframe to load before triggering print
  const images = Array.from(doc.images);
  await Promise.all(
    images.map((img) => {
      if (img.complete) return Promise.resolve();
      return new Promise<void>((resolve) => {
        img.onload = () => resolve();
        img.onerror = () => resolve(); // Continue even if an image fails
      });
    })
  );

  // 5. Short buffer for font decoding and layout stabilization
  await new Promise((resolve) => setTimeout(resolve, 150));

  const contentWindow = iframe.contentWindow;
  if (contentWindow) {
    contentWindow.focus();
    contentWindow.print();
  }

  // 6. Clean up iframe safely after the print dialog resolves
  setTimeout(() => {
    if (document.body.contains(iframe)) {
      document.body.removeChild(iframe);
    }
  }, 1000);
};

export default printElement;
