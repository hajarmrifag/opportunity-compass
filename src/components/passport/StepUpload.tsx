import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { Check, FileText, Link2, LockKeyhole, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DocumentLabel } from "@/domain/types";
import { normalizeWebSourceUrl, webSourceLabel } from "@/lib/profileExtraction";
import { F } from "./fields";
import { MAX_DOCUMENTS, MAX_FILE_BYTES, formatSize, uid, type IntakeDocument } from "./shared";

export function StepUpload({
  documents,
  setDocuments,
  message,
  setMessage,
  webBusy,
  webError,
  onReadWebLink,
}: {
  documents: IntakeDocument[];
  setDocuments: (next: IntakeDocument[]) => void;
  message: string;
  setMessage: (text: string) => void;
  webBusy: boolean;
  webError: string;
  onReadWebLink: (url: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteName, setPasteName] = useState("Pasted notes");
  const [pasteText, setPasteText] = useState("");
  const [pasteLabel, setPasteLabel] = useState<DocumentLabel>("other");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameText, setRenameText] = useState("");
  const [webOpen, setWebOpen] = useState(false);
  const [webUrl, setWebUrl] = useState("");
  const [webConsent, setWebConsent] = useState(false);
  const [webTouched, setWebTouched] = useState(false);

  const acceptFiles = (incoming: File[]) => {
    const available = MAX_DOCUMENTS - documents.length;
    const accepted: IntakeDocument[] = [];
    const errors: string[] = [];
    for (const file of incoming.slice(0, Math.max(available, 0))) {
      if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
        errors.push(`${file.name}: only PDF files are supported.`);
      } else if (file.size > MAX_FILE_BYTES) {
        errors.push(`${file.name}: file is larger than 5 MB.`);
      } else if (file.size === 0) {
        errors.push(`${file.name}: file is empty.`);
      } else {
        accepted.push({
          id: uid(),
          name: file.name,
          label: "cv",
          kind: "pdf",
          file,
          state: "ready",
        });
      }
    }
    if (incoming.length > available) errors.push(`You can add up to ${MAX_DOCUMENTS} documents.`);
    setDocuments([...documents, ...accepted]);
    setMessage(errors.join(" "));
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    acceptFiles([...event.dataTransfer.files]);
  };

  const onPick = (event: ChangeEvent<HTMLInputElement>) => {
    acceptFiles([...(event.target.files ?? [])]);
    event.target.value = "";
  };

  const addPasted = () => {
    if (!pasteText.trim()) return setMessage("Paste some document text first.");
    if (documents.length >= MAX_DOCUMENTS)
      return setMessage(`You can add up to ${MAX_DOCUMENTS} documents.`);
    setDocuments([
      ...documents,
      {
        id: uid(),
        name: pasteName.trim() || "Pasted text",
        label: pasteLabel,
        kind: "text",
        text: pasteText.trim(),
        state: "ready",
      },
    ]);
    setPasteText("");
    setPasteOpen(false);
    setMessage("");
  };

  const commitRename = (id: string) => {
    const name = renameText.trim();
    if (name) setDocuments(documents.map((doc) => (doc.id === id ? { ...doc, name } : doc)));
    setRenaming(null);
  };

  const normalized = normalizeWebSourceUrl(webUrl);
  const webInvalid = webTouched && webUrl.trim().length > 0 && !normalized;

  return (
    <div>
      <p className="eyebrow">Step 1 of 5</p>
      <h2 className="mt-1 text-2xl">Add your documents</h2>
      <p className="mt-1 text-muted-foreground">
        Upload a CV, transcript, certificates or research papers. We read them privately, delete
        them straight after, and only keep what you confirm.
      </p>

      <div
        role="button"
        tabIndex={0}
        aria-label="Upload documents"
        onClick={() => fileRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            fileRef.current?.click();
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`mt-5 flex cursor-pointer flex-col items-center gap-2 border-2 border-dashed p-10 text-center transition-colors duration-200 ${
          dragging ? "border-primary bg-teal-soft" : "border-input bg-card"
        }`}
      >
        <Upload className="size-8 text-primary" aria-hidden="true" />
        <p className="text-lg font-semibold">Drag and drop your documents</p>
        <p className="text-sm text-muted-foreground">
          or <span className="font-semibold text-primary underline">browse files</span>. PDF only,
          up to 5 MB each, {MAX_DOCUMENTS} documents maximum
        </p>
        <p className="text-xs text-muted-foreground">
          For example: CV, transcript, certificates, research papers
        </p>
        <input
          ref={fileRef}
          className="sr-only"
          type="file"
          accept="application/pdf,.pdf"
          multiple
          onChange={onPick}
        />
      </div>

      {message && (
        <p role="alert" className="field-error mt-3">
          {message}
        </p>
      )}

      {documents.length > 0 && (
        <ul className="mt-5 grid gap-3" aria-label="Added documents">
          {documents.map((document) => (
            <li
              key={document.id}
              className="flex flex-wrap items-center gap-3 border border-border bg-card p-3"
            >
              <FileText className="size-5 shrink-0 text-primary" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                {renaming === document.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      aria-label="New document name"
                      value={renameText}
                      autoFocus
                      onChange={(event) => setRenameText(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") commitRename(document.id);
                        if (event.key === "Escape") setRenaming(null);
                      }}
                    />
                    <Button size="sm" onClick={() => commitRename(document.id)}>
                      <Check /> Save name
                    </Button>
                  </div>
                ) : (
                  <p className="truncate font-semibold">{document.name}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  {document.kind === "pdf" ? "PDF" : "Pasted text"}
                  {document.file ? ` · ${formatSize(document.file.size)}` : ""} ·{" "}
                  {document.state === "extracting"
                    ? "Reading…"
                    : document.state === "done"
                      ? "Read successfully"
                      : document.state === "error"
                        ? "Could not be read"
                        : "Ready"}
                </p>
                {document.error && <p className="field-error">{document.error}</p>}
              </div>
              <select
                aria-label={`Label ${document.name}`}
                className="w-36"
                value={document.label}
                onChange={(event) =>
                  setDocuments(
                    documents.map((item) =>
                      item.id === document.id
                        ? { ...item, label: event.target.value as DocumentLabel }
                        : item,
                    ),
                  )
                }
              >
                <option value="cv">CV</option>
                <option value="transcript">Transcript</option>
                <option value="other">Other</option>
              </select>
              <Button
                size="icon"
                variant="ghost"
                aria-label={`Rename ${document.name}`}
                onClick={() => {
                  setRenaming(document.id);
                  setRenameText(document.name);
                }}
              >
                <Pencil />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                aria-label={`Remove ${document.name}`}
                onClick={() => setDocuments(documents.filter((item) => item.id !== document.id))}
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-5 grid gap-3">
        <button
          type="button"
          className="flex min-h-[44px] items-center gap-2 text-left font-semibold text-primary"
          aria-expanded={pasteOpen}
          onClick={() => setPasteOpen((open) => !open)}
        >
          <Plus className="size-4" /> Paste text instead
        </button>
        {pasteOpen && (
          <div className="grid gap-3 border-l-2 border-primary pl-4">
            <F id="paste-name" label="Document name">
              <input
                id="paste-name"
                value={pasteName}
                onChange={(event) => setPasteName(event.target.value)}
              />
            </F>
            <F id="paste-label" label="Document label">
              <select
                id="paste-label"
                value={pasteLabel}
                onChange={(event) => setPasteLabel(event.target.value as DocumentLabel)}
              >
                <option value="cv">CV</option>
                <option value="transcript">Transcript</option>
                <option value="other">Other</option>
              </select>
            </F>
            <F id="paste-text" label="Document text">
              <textarea
                id="paste-text"
                rows={6}
                value={pasteText}
                onChange={(event) => setPasteText(event.target.value)}
                placeholder="Paste the document exactly as written…"
              />
            </F>
            <div>
              <Button onClick={addPasted}>Add pasted document</Button>
            </div>
          </div>
        )}

        <button
          type="button"
          className="flex min-h-[44px] items-center gap-2 text-left font-semibold text-primary"
          aria-expanded={webOpen}
          onClick={() => setWebOpen((open) => !open)}
        >
          <Link2 className="size-4" /> Add a LinkedIn, GitHub, portfolio, or personal website
        </button>
        {webOpen && (
          <div className="grid gap-3 border-l-2 border-primary pl-4">
            <p className="text-sm text-muted-foreground">
              We read only the link you give, never search for your name, and don't keep the page
              text.
            </p>
            <F id="web-url" label="Link">
              <input
                id="web-url"
                inputMode="url"
                placeholder="https://www.linkedin.com/in/yourname"
                value={webUrl}
                aria-invalid={webInvalid}
                onChange={(event) => setWebUrl(event.target.value)}
                onBlur={() => setWebTouched(true)}
              />
            </F>
            {webInvalid && (
              <p role="alert" className="field-error">
                Enter a full public link, like https://github.com/yourname.
              </p>
            )}
            <label className="flex min-h-[44px] items-start gap-2 font-normal">
              <input
                type="checkbox"
                className="mt-1 w-auto"
                checked={webConsent}
                onChange={(event) => setWebConsent(event.target.checked)}
              />
              <span className="text-sm">
                This link is about me, and I agree to it being read once.
              </span>
            </label>
            <div>
              <Button
                type="button"
                disabled={webBusy || !normalized || !webConsent}
                onClick={() => {
                  if (normalized) onReadWebLink(normalized);
                }}
              >
                {webBusy ? "Reading link…" : "Read link"}
              </Button>
            </div>
            {webError && (
              <p role="alert" className="text-sm text-warning-strong">
                {webError}
              </p>
            )}
          </div>
        )}
      </div>

      <p className="mt-5 flex items-center gap-1 text-xs text-muted-foreground">
        <LockKeyhole className="size-3" /> Files are processed privately and deleted after
        extraction.
      </p>
    </div>
  );
}

export { webSourceLabel };
