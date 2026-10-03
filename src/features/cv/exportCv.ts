// Exports a structured CV in the classic finance/consulting layout:
// centred name and contact line, UPPERCASE section headings with a rule,
// organisation in bold with dates on the right, role in italics, compact bullets, Times New Roman.
// Requires the npm packages "docx" and "jspdf".
import { AlignmentType, BorderStyle, Document, Packer, Paragraph, Tab, TabStopType, TextRun } from "docx";
import { jsPDF } from "jspdf";
import { flattenCv, isLabelLine, sectionKind } from "./cvModel";
import type { CvDocument, CvEntry } from "./types";

const FONT = "Times New Roman";
// A4 is 11906 twips wide; margins 0.6" (864 twips) each side → text width 10178 twips.
const MARGIN_TWIPS = 864;
const TEXT_WIDTH_TWIPS = 11906 - MARGIN_TWIPS * 2;

export const contactLines = (doc: CvDocument): string[] => {
  const links = (doc.contact.links ?? []).filter(Boolean);
  const main = [doc.contact.email, doc.contact.phone, doc.contact.location].filter(Boolean).join(" | ");
  return [links.join(" | "), main].filter((l) => l.length > 0);
};

const headLine = (e: CvEntry) => [e.heading, e.location].filter(Boolean).join(", ");

/** Section kinds where the role/degree line is shown in italics (education stays regular, as in classic CVs). */
const italicRole = (kind: string) => kind !== "education";

// ---------- Word ----------

export function buildDocx(cv: CvDocument): Document {
  const size = (pt: number) => pt * 2; // docx uses half-points
  const children: Paragraph[] = [];

  children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: cv.name, size: size(16), font: FONT })] }));
  for (const line of contactLines(cv))
    children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: line, size: size(9.5), font: FONT })] }));
  if (cv.summary)
    children.push(new Paragraph({ spacing: { before: 120 }, children: [new TextRun({ text: cv.summary, size: size(10.5), font: FONT })] }));

  for (const s of cv.sections) {
    const kind = s.kind ?? sectionKind(s.title);
    children.push(
      new Paragraph({
        spacing: { before: 200, after: 40 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "000000", space: 1 } },
        children: [new TextRun({ text: s.title.toUpperCase(), bold: true, size: size(10.5), font: FONT })],
      }),
    );
    for (const e of s.entries) {
      if (isLabelLine(kind, e)) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: `${e.heading}: `, bold: true, size: size(10.5), font: FONT }),
              new TextRun({ text: e.bullets[0]?.text ?? "", size: size(10.5), font: FONT }),
            ],
          }),
        );
        continue;
      }
      const head = headLine(e);
      if (head || e.dates) {
        children.push(
          new Paragraph({
            spacing: { before: 60 },
            tabStops: [{ type: TabStopType.RIGHT, position: TEXT_WIDTH_TWIPS }],
            children: [
              new TextRun({ text: head, bold: true, size: size(10.5), font: FONT }),
              ...(e.dates ? [new TextRun({ children: [new Tab(), e.dates], size: size(10.5), font: FONT })] : []),
            ],
          }),
        );
      }
      if (e.subheading)
        children.push(
          new Paragraph({
            indent: { left: italicRole(kind) ? 240 : 0 },
            children: [new TextRun({ text: e.subheading, italics: italicRole(kind), bold: italicRole(kind), size: size(10.5), font: FONT })],
          }),
        );
      for (const b of e.bullets)
        children.push(new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text: b.text, size: size(10.5), font: FONT })] }));
    }
  }

  return new Document({
    creator: "OpportunityOS",
    title: `${cv.name} CV`,
    styles: { default: { document: { run: { font: FONT } } } },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 }, // A4
            margin: { top: 720, bottom: 720, left: MARGIN_TWIPS, right: MARGIN_TWIPS },
          },
        },
        children,
      },
    ],
  });
}

export async function cvToDocxBlob(cv: CvDocument): Promise<Blob> {
  return Packer.toBlob(buildDocx(cv));
}

// ---------- PDF ----------

/** True if the CV contains characters the built-in PDF font cannot draw (e.g. Chinese). */
export function needsUnicodeFont(cv: CvDocument): boolean {
  return /[^\u0000-\u024F\u2013\u2014\u2018\u2019\u201C\u201D\u2022\u2026]/.test(flattenCv(cv));
}

export function buildPdf(cv: CvDocument): jsPDF {
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 43; // ≈ 0.6 inch
  const pageW = pdf.internal.pageSize.getWidth();
  const width = pageW - margin * 2;
  const bottom = pdf.internal.pageSize.getHeight() - margin;
  const body = 10.5;
  const lh = body * 1.25;
  let y = margin + 6;

  const ensure = (h: number) => {
    if (y + h > bottom) {
      pdf.addPage();
      y = margin + 6;
    }
  };
  const font = (style: "normal" | "bold" | "italic" | "bolditalic", pt: number) => {
    pdf.setFont("times", style);
    pdf.setFontSize(pt);
  };
  const wrapped = (text: string, x: number, maxW: number, style: "normal" | "bold" | "italic" | "bolditalic" = "normal") => {
    font(style, body);
    for (const l of pdf.splitTextToSize(text, maxW) as string[]) {
      ensure(lh);
      pdf.text(l, x, y);
      y += lh;
    }
  };

  font("normal", 16);
  pdf.text(cv.name, pageW / 2, y, { align: "center" });
  y += 16;
  font("normal", 9.5);
  for (const line of contactLines(cv)) {
    pdf.text(line, pageW / 2, y, { align: "center" });
    y += 12;
  }
  if (cv.summary) {
    y += 4;
    wrapped(cv.summary, margin, width);
  }

  for (const s of cv.sections) {
    const kind = s.kind ?? sectionKind(s.title);
    ensure(30);
    y += 8;
    font("bold", body);
    pdf.text(s.title.toUpperCase(), margin, y);
    pdf.setLineWidth(0.6);
    pdf.line(margin, y + 2.5, margin + width, y + 2.5);
    y += lh + 1;

    for (const e of s.entries) {
      if (isLabelLine(kind, e)) {
        font("bold", body);
        const label = `${e.heading}:`;
        const lw = pdf.getTextWidth(label) + 3; // explicit gap after the label
        ensure(lh);
        pdf.text(label, margin, y);
        font("normal", body);
        const lines = pdf.splitTextToSize(e.bullets[0]?.text ?? "", width - lw) as string[];
        lines.forEach((l, i) => {
          if (i > 0) ensure(lh);
          pdf.text(l, margin + lw, y);
          y += lh;
        });
        continue;
      }
      const head = headLine(e);
      if (head || e.dates) {
        ensure(lh);
        font("normal", body);
        const datesW = e.dates ? pdf.getTextWidth(e.dates) : 0;
        font("bold", body);
        const headLines = pdf.splitTextToSize(head, width - datesW - 12) as string[];
        pdf.text(headLines[0] ?? "", margin, y);
        if (e.dates) {
          font("normal", body);
          pdf.text(e.dates, margin + width, y, { align: "right" });
        }
        y += lh;
        for (const extra of headLines.slice(1)) {
          ensure(lh);
          font("bold", body);
          pdf.text(extra, margin, y);
          y += lh;
        }
      }
      if (e.subheading) wrapped(e.subheading, margin + (italicRole(kind) ? 12 : 0), width - 12, italicRole(kind) ? "bolditalic" : "normal");
      for (const b of e.bullets) {
        ensure(lh);
        font("normal", body);
        pdf.text("•", margin + 6, y);
        wrapped(b.text, margin + 18, width - 18);
      }
      y += 2;
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
