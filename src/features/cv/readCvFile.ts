// Reads CV text in the browser. Requires npm packages "pdfjs-dist" and "mammoth".
// The file never leaves the student's device at this step.

export class CvReadError extends Error {}

const MAX_BYTES = 5 * 1024 * 1024;

export async function readCvFile(file: File): Promise<string> {
  if (file.size > MAX_BYTES) throw new CvReadError("This file is larger than 5 MB. Upload a smaller file or paste the text.");
  const name = file.name.toLowerCase();

  if (name.endsWith(".txt")) return (await file.text()).trim();

  if (name.endsWith(".docx")) {
    const mammoth: any = await import("mammoth");
    const { value } = await (mammoth.default ?? mammoth).extractRawText({ arrayBuffer: await file.arrayBuffer() });
    const text = String(value ?? "").trim();
    if (text.length < 40) throw new CvReadError("We could not find text in this Word file. Paste your CV text instead.");
    return text;
  }

  if (name.endsWith(".pdf")) {
    const pdfjs: any = await import("pdfjs-dist");
    // Vite serves the worker file; this keeps PDF reading off the main thread.
    const worker: any = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const pages: string[] = [];
    for (let p = 1; p <= Math.min(pdf.numPages, 6); p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      // Rebuild lines from text positions so bullets stay on separate lines.
      const lines: Record<string, string[]> = {};
      for (const item of content.items as Array<{ str: string; transform: number[] }>) {
        const y = Math.round(item.transform[5]);
        (lines[y] ??= []).push(item.str);
      }
      const ordered = Object.keys(lines)
        .map(Number)
        .sort((a, b) => b - a)
        .map((y) => lines[y].join(" ").replace(/\s+/g, " ").trim())
        .filter(Boolean);
      pages.push(ordered.join("\n"));
    }
    const text = pages.join("\n").trim();
    if (text.length < 40)
      throw new CvReadError("This PDF looks like a scanned image, so we cannot read its text. Paste your CV text instead.");
    return text;
  }

  if (name.endsWith(".doc")) throw new CvReadError("Old .doc files are not supported. Save it as .docx or PDF, or paste the text.");
  throw new CvReadError("Upload a PDF, Word (.docx) or text file, or paste your CV text.");
}
