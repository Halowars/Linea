(() => {
  const textButton = document.querySelector("#downloadTextButton");
  const editor = document.querySelector("#editor");

  if (!textButton || !editor) return;

  const pdfButton = document.createElement("button");
  pdfButton.id = "downloadPdfButton";
  pdfButton.type = "button";
  pdfButton.textContent = "Download PDF";
  textButton.after(pdfButton);

  function getDraftTitle() {
    const firstLine = editor.innerText.trim().split(/\n/).find(Boolean) || "draft";
    return firstLine.slice(0, 60);
  }

  function safeFileName(title) {
    return (title || "draft")
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase() || "draft";
  }

  function loadJsPdf() {
    if (window.jspdf?.jsPDF) return Promise.resolve(window.jspdf.jsPDF);

    return new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-jspdf="true"]');
      if (existing) {
        existing.addEventListener("load", () => resolve(window.jspdf.jsPDF), { once: true });
        existing.addEventListener("error", reject, { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
      script.dataset.jspdf = "true";
      script.onload = () => resolve(window.jspdf.jsPDF);
      script.onerror = reject;
      document.head.append(script);
    });
  }

  function exportWithPrintFallback() {
    const title = getDraftTitle();
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`<!doctype html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${title}</title>
          <style>
            body { font-family: Georgia, serif; max-width: 720px; margin: 48px auto; line-height: 1.55; color: #111; }
            h1, h2, p, blockquote { margin-bottom: 14px; }
            blockquote { border-left: 4px solid #aaa; padding-left: 14px; color: #444; }
          </style>
        </head>
        <body>${editor.innerHTML}</body>
      </html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  async function exportPdf() {
    const title = getDraftTitle();
    const text = editor.innerText.trim() || " ";

    pdfButton.disabled = true;
    pdfButton.textContent = "Making PDF...";

    try {
      const jsPDF = await loadJsPdf();
      const doc = new jsPDF({ unit: "pt", format: "letter" });
      const margin = 54;
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const maxWidth = pageWidth - margin * 2;
      const lineHeight = 16;
      let y = margin;

      doc.setFont("times", "normal");
      doc.setFontSize(12);

      const lines = doc.splitTextToSize(text, maxWidth);
      lines.forEach((line) => {
        if (y > pageHeight - margin) {
          doc.addPage();
          y = margin;
        }
        doc.text(line, margin, y);
        y += lineHeight;
      });

      doc.save(`${safeFileName(title)}.pdf`);
    } catch {
      exportWithPrintFallback();
    } finally {
      pdfButton.disabled = false;
      pdfButton.textContent = "Download PDF";
    }
  }

  pdfButton.addEventListener("click", exportPdf);
})();
