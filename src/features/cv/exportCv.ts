// Exports a structured CV. Requires the npm packages "docx" and "jspdf".
import { AlignmentType, BorderStyle, Document, Packer, Paragraph, TextRun } from "docx";
import { jsPDF } from "jspdf";
import { flattenCv } from "./cvModel";
import type { CvDocument } from "./types";

const contactLine = (doc: CvDocument) =>
  [doc.contact.email, doc.contact.phone, doc.contact.location, ...(doc.contact.links ?? [])].filter(Boolean).join("  |  ");

const entryLine = (e: { heading: string; subheading?: string; location?: string }) =>
  [e.heading, e.subheading, e.location].filter(Boolean).join(", ");

/** Clean one-column layout that application systems can read. */
export function buildDocx(cv: CvDocument): Document {
  const children: Paragraph[] = [];
  children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: cv.name, bold: true, size: 32 })] }));
  const contact = contactLine(cv);
  if (contact) children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 160 }, children: [new TextRun({ text: contact, size: 18 })] }));
  if (cv.summary) children.push(new Paragraph({ spacing: { after: 160 }, children: [new TextRun({ text: cv.summary, size: 20 })] }));

  for (const s of cv.sections) {
    children.push(
      new Paragraph({
        spacing: { before: 200, after: 80 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "999999", space: 2 } },
        children: [new TextRun({ text: s.title, bold: true, size: 22 })],
      }),
    );
    for (const e of s.entries) {
      const head = entryLine(e);
      if (head || e.dates) {
        children.push(
          new Paragraph({
            spacing: { before: 80 },
            children: [
              new TextRun({ text: head, bold: true, size: 20 }),
              ...(e.dates ? [new TextRun({ text: head ? `   ${e.dates}` : e.dates, size: 20, italics: true })] : []),
            ],
          }),
        );
      }
      for (const b of e.bullets) {
        children.push(new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text: b.text, size: 20 })] }));
      }
    }
  }

  return new Document({
    creator: "OpportunityOS",
    title: `${cv.name} CV`,
    styles: { default: { document: { run: { font: "Calibri" } } } },
    sections: [{ properties: { page: { margin: { top: 720, bottom: 720, left: 900, right: 900 } } }, children }],
  });
}

export async function cvToDocxBlob(cv: CvDocument): Promise<Blob> {
  return Packer.toBlob(buildDocx(cv));
}

/** True if the CV contains characters the built-in PDF font cannot draw (e.g. Chinese). */
export function needsUnicodeFont(cv: CvDocument): boolean {
  return /[^\u0000-\u024F\u2013\u2014\u2018\u2019\u201C\u201D\u2022\u2026]/.test(flattenCv(cv));
}

export function buildPdf(cv: CvDocument): jsPDF {
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 48;
  const width = pdf.internal.pageSize.getWidth() - margin * 2;
  const bottom = pdf.internal.pageSize.getHeight() - margin;
  let y = margin;

  const ensure = (h: number) => {
    if (y + h > bottom) {
      pdf.addPage();
      y = margin;
    }
  };
  const write = (text: string, opts: { size: number; bold?: boolean; italic?: boolean; indent?: number; align?: "center"; gap?: number }) => {
    pdf.setFont("helvetica", opts.bold ? "bold" : opts.italic ? "italic" : "normal");
    pdf.setFontSize(opts.size);
    const indent = opts.indent ?? 0;
    const lines = pdf.splitTextToSize(text, width - indent) as string[];
    const lh = opts.size * 1.3;
    for (const line of lines) {
      ensure(lh);
      if (opts.align === "center") pdf.text(line, pdf.internal.pageSize.getWidth() / 2, y, { align: "center" });
      else pdf.text(line, margin + indent, y);
      y += lh;
    }
    y += opts.gap ?? 0;
  };

  write(cv.name, { size: 18, bold: true, align: "center", gap: 2 });
  const contact = contactLine(cv);
  if (contact) write(contact, { size: 9, align: "center", gap: 10 });
  if (cv.summary) write(cv.summary, { size: 10, gap: 6 });

  for (const s of cv.sections) {
    ensure(30);
    y += 6;
    write(s.title, { size: 11, bold: true });
    pdf.setDrawColor(150);
    pdf.line(margin, y - 8, margin + width, y - 8);
    y += 2;
    for (const e of s.entries) {
      const head = entryLine(e);
      if (head) write(head + (e.dates ? `   ${e.dates}` : ""), { size: 10, bold: true, gap: 1 });
      else if (e.dates) write(e.dates, { size: 10, italic: true });
      for (const b of e.bullets) {
        ensure(13);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(10);
        pdf.text("•", margin + 4, y);
        write(b.text, { size: 10, indent: 14 });
      }
      y += 4;
    }
  }
  return pdf;
}

export function cvToPdfBlob(cv: CvDocument): Blob {
  return buildPdf(cv).output("blob");
}

export function cvToTextBlob(cv: CvDocument): Blob {
  return new Blob([flattenCv(cv)], { type: "text/plain;charset=utf-8" });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const cvFileName = (cv: CvDocument, ext: string) =>
  `${(cv.name || "CV").replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_|_$/g, "")}_CV.${ext}`;
