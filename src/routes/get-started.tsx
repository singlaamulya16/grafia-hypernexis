import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  CloudUpload,
  FileStack,
  FileText,
  Info,
  Loader2,
  LoaderCircle,
  MoreVertical,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { WorkspaceShell } from "@/components/workspace-shell";
import { CountUp, FitScale } from "@/components/motion";
import { FileBadge, KIND_LABEL, extKind, formatSize, type FileKind } from "@/components/file-badge";
import {
  api,
  type Health,
  type IndexStatus,
  type ReadReport,
  type ServerDocument,
} from "@/lib/api";

export const Route = createFileRoute("/get-started")({
  head: () => ({
    meta: [
      { title: "DocuDetect — Upload Your Documents" },
      {
        name: "description",
        content: "Add your case files — PDF and TXT — and let your AI detective analyse them.",
      },
      { property: "og:title", content: "DocuDetect — Upload Your Documents" },
      {
        property: "og:description",
        content: "Drag & drop your files to start a new case.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GetStartedPage,
});

type FileStatus = "reading" | "failed" | "processing" | "extracted" | "queued";

type CaseFile = {
  /** Corpus id, used to delete. */
  id: string;
  name: string;
  kind: FileKind;
  size: string;
  meta: string;
  status: FileStatus;
  /** Pages read so far, 0..1, while a PDF is being read. */
  progress: number | null;
  pages: number;
  done: number;
  error: string | null;
};

type Message = { tone: "error" | "warning" | "info"; text: string };

/** One line summarising how a PDF was read. */
function describeRead(r: ReadReport) {
  const parts = [`${r.pages} page${r.pages === 1 ? "" : "s"}`];
  if (r.text_pages) parts.push(`${r.text_pages} from text`);
  if (r.ocr_pages) parts.push(`${r.ocr_pages} read from images`);
  if (r.figure_pages) parts.push(`${r.figure_pages} with figures described`);
  if (r.failed_pages.length) parts.push(`${r.failed_pages.length} could not be read`);
  return parts.join(" • ");
}

function toCaseFile(doc: ServerDocument, job: IndexStatus | null): CaseFile {
  const display = doc.original ?? doc.name;
  const kind = extKind(display);
  const reading = doc.status === "reading" || doc.status === "queued";
  const status: FileStatus = reading
    ? "reading"
    : doc.status === "failed"
      ? "failed"
      : job?.state === "running"
        ? "processing"
        : job?.built_files.includes(doc.name)
          ? "extracted"
          : "queued";
  const added = doc.modified
    ? new Date(doc.modified * 1000).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "just added";
  const meta = reading
    ? doc.pages
      ? `Reading page ${Math.min(doc.done + 1, doc.pages)} of ${doc.pages}…`
      : "Opening document…"
    : doc.status === "failed"
      ? (doc.error ?? "Could not be read")
      : doc.report
        ? `${KIND_LABEL[kind]} • ${describeRead(doc.report)}`
        : `${KIND_LABEL[kind]} • ${added}`;
  return {
    id: doc.name,
    name: display,
    kind,
    size: formatSize(doc.size),
    meta,
    status,
    progress: reading ? (doc.pages ? doc.done / doc.pages : 0) : null,
    pages: doc.pages,
    done: doc.done,
    error: doc.error,
  };
}

function GetStartedPage() {
  const navigate = useNavigate();
  const [docs, setDocs] = useState<ServerDocument[]>([]);
  const [job, setJob] = useState<IndexStatus | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [loaded, setLoaded] = useState(false);
  // Last seen status per document, to announce each reading report once when it finishes.
  const seen = useRef<Map<string, ServerDocument["status"]>>(new Map());

  const refresh = useCallback(async () => {
    try {
      const [d, j, h] = await Promise.all([api.documents(), api.indexStatus(), api.health()]);
      const finished: Message[] = [];
      for (const doc of d) {
        const before = seen.current.get(doc.name);
        if (before === "reading" || before === "queued") {
          const name = doc.original ?? doc.name;
          if (doc.status === "ready" && doc.report) {
            finished.push({ tone: "info", text: `${name} is ready: ${describeRead(doc.report)}.` });
          } else if (doc.status === "failed") {
            finished.push({
              tone: "error",
              text: `${name} could not be read: ${doc.error ?? "unknown error"}`,
            });
          }
        }
        seen.current.set(doc.name, doc.status);
      }
      if (finished.length) setMessages((prev) => [...finished, ...prev].slice(0, 6));
      setDocs(d);
      setJob(j);
      setHealth(h);
    } catch (err) {
      setMessages([{ tone: "error", text: (err as Error).message }]);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // While documents are being read, poll for live page progress.
  const reading = docs.some((d) => d.status === "reading" || d.status === "queued");
  useEffect(() => {
    if (!reading) return;
    const id = setInterval(() => void refresh(), 1000);
    return () => clearInterval(id);
  }, [reading, refresh]);

  // Poll while a build runs so file rows move from Processing to Extracted.
  const running = job?.state === "running";
  useEffect(() => {
    if (!running) return;
    const id = setInterval(async () => {
      try {
        const next = await api.indexStatus();
        setJob(next);
        if (next.state !== "running") void refresh();
      } catch (err) {
        setMessages([{ tone: "error", text: (err as Error).message }]);
      }
    }, 1500);
    return () => clearInterval(id);
  }, [running, refresh]);

  async function addFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    setBusy(true);
    setUploading(true);
    setUploadPct(0);
    try {
      const res = await api.upload(Array.from(list), setUploadPct);
      const notes: Message[] = [
        ...res.errors.map((text) => ({ tone: "error" as const, text })),
        ...res.warnings.map((text) => ({ tone: "warning" as const, text })),
      ];
      const pdfs = res.accepted.filter((n) => n.toLowerCase().endsWith(".pdf")).length;
      if (res.accepted.length) {
        notes.push({
          tone: "info",
          text: `Added ${res.accepted.length} file${res.accepted.length === 1 ? "" : "s"}.${
            pdfs
              ? " PDFs are being read page by page; scanned pages and figures are read from their images."
              : ""
          }`,
        });
      }
      setMessages(notes);
      await refresh();
    } catch (err) {
      setMessages([{ tone: "error", text: (err as Error).message }]);
    } finally {
      setBusy(false);
      setUploading(false);
    }
  }

  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
      setMessages([]);
    } catch (err) {
      setMessages([{ tone: "error", text: (err as Error).message }]);
    } finally {
      setBusy(false);
      await refresh();
    }
  }

  const files = docs.map((d) => toCaseFile(d, job));
  // The index matches the uploaded files exactly (nothing added, replaced or deleted since the last build).
  const upToDate = files.length > 0 && Boolean(job?.fresh);
  const readyFiles = files.filter((f) => f.status !== "reading" && f.status !== "failed").length;
  const canExtract = readyFiles > 0 && !reading;

  // Rebuild from the current files unless a build is running or the index already matches them,
  // then open the Extract step.
  async function extract() {
    setBusy(true);
    try {
      if (!running && !upToDate) await api.startIndex();
      await navigate({ to: "/extract" });
    } catch (err) {
      setMessages([{ tone: "error", text: (err as Error).message }]);
      setBusy(false);
    }
  }

  return (
    <WorkspaceShell active={0}>
      <main className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 py-6 sm:px-6 sm:py-8 lg:h-full lg:grid-cols-[1.15fr_1fr] lg:grid-rows-[minmax(0,1fr)] lg:py-5 [&>*]:min-w-0">
        <div className="space-y-5 lg:flex lg:min-h-0 lg:flex-col lg:gap-4 lg:space-y-0">
          <UploadCard
            onFiles={addFiles}
            disabled={busy || running}
            uploading={uploading}
            uploadPct={uploadPct}
          />
          {messages.length > 0 ? <Messages items={messages} /> : null}
        </div>
        <div className="flex flex-col gap-5 lg:min-h-0 lg:gap-4">
          <FilesCard
            files={files}
            loaded={loaded}
            disabled={busy || running}
            onDelete={(name) => act(() => api.deleteDocument(name))}
            onClear={() => act(() => Promise.all(docs.map((d) => api.deleteDocument(d.name))))}
          />
          <button
            onClick={extract}
            disabled={busy || !canExtract}
            className="btn-sheen group animate-fade-up flex w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-leaf-deep via-primary to-leaf-mid px-6 py-5 text-lg font-semibold sm:px-8 sm:py-6 sm:text-xl text-primary-foreground shadow-leaf transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
            style={{ animationDelay: "240ms" }}
          >
            {busy && !uploading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <Sparkles className="h-6 w-6 transition-transform duration-500 group-hover:rotate-90 group-hover:scale-110" />
            )}
            {reading
              ? "Reading Documents…"
              : running
                ? "View Extraction Progress"
                : upToDate
                  ? "Explore Extracted Information"
                  : "Extract Information"}
            <ArrowRight className="h-6 w-6 transition-transform duration-300 group-hover:translate-x-1.5" />
          </button>
          {health && !health.api_key ? (
            <p className="flex items-center justify-center gap-2 text-center text-xs text-destructive">
              <AlertCircle className="h-3.5 w-3.5" />
              GEMINI_API_KEY is not set in Grafia/.env, so documents can't be processed yet.
            </p>
          ) : files.length > 0 && !upToDate && !running ? (
            <p className="flex items-center justify-center gap-2 text-center text-xs text-muted-foreground">
              <Info className="h-3.5 w-3.5" />
              {files.some((f) => f.status === "queued")
                ? "Some files haven't been extracted yet. Extract to include them."
                : "Files were removed since the last extraction. Extract again to update."}
            </p>
          ) : null}
        </div>
      </main>
    </WorkspaceShell>
  );
}

function Messages({ items }: { items: Message[] }) {
  const tone = {
    error: "border-destructive/30 bg-destructive/10 text-destructive",
    warning: "border-badge-orange/30 bg-badge-orange/10 text-foreground",
    info: "border-primary/20 bg-secondary text-secondary-foreground",
  };
  return (
    <ul className="space-y-2">
      {items.map((m, i) => (
        <li
          key={`${m.text}-${i}`}
          className={`animate-fade-up flex items-start gap-2.5 rounded-2xl border px-4 py-3 text-sm shadow-sm backdrop-blur-md ${tone[m.tone]}`}
          style={{ animationDelay: `${i * 60}ms` }}
        >
          {m.tone === "info" ? (
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <span>{m.text}</span>
        </li>
      ))}
    </ul>
  );
}

function UploadCard({
  onFiles,
  disabled,
  uploading,
  uploadPct,
}: {
  onFiles: (files: FileList | null) => void;
  disabled: boolean;
  uploading: boolean;
  uploadPct: number;
}) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <section className="glass-card animate-fade-up p-5 sm:p-10 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:p-8">
      <h1 className="text-3xl font-extrabold tracking-tight text-ink-deep sm:text-5xl lg:text-[2.75rem] xl:whitespace-nowrap 2xl:text-5xl">
        1. Upload <span className="text-gradient-leaf">Your Documents</span>
      </h1>
      <p className="mt-4 text-lg text-muted-foreground lg:mt-2">
        Add your files to get started. We'll analyse them in the next steps.
      </p>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (!disabled) onFiles(e.dataTransfer.files);
        }}
        className={`group relative mt-8 rounded-3xl border-2 border-dashed px-4 py-6 text-center transition-all duration-300 sm:p-10 lg:mt-5 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:justify-center lg:py-5 ${
          dragOver
            ? "scale-[1.01] border-primary bg-secondary/80"
            : "border-border bg-background/40 hover:border-leaf-mid/60 hover:bg-secondary/40"
        }`}
      >
        <FitScale baseHeight={224} className="h-48 sm:h-56 lg:h-auto lg:max-h-56 lg:flex-1">
          <FileFan spread={dragOver} />
        </FitScale>
        <p className="mt-6 text-2xl font-bold text-ink-deep lg:mt-3">
          {dragOver ? "Drop to add your files" : "Drag & drop your files here"}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">or</p>
        <button
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
          className="btn-sheen group/btn mx-auto mt-4 flex w-full max-w-sm items-center justify-center gap-3 rounded-2xl bg-primary px-10 py-4 text-lg font-semibold text-primary-foreground shadow-leaf transition-all duration-300 hover:-translate-y-0.5 hover:bg-leaf-deep disabled:opacity-50 disabled:hover:translate-y-0"
        >
          {uploading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Upload
              className="h-5 w-5 transition-transform group-hover/btn:-translate-y-0.5"
              strokeWidth={2.4}
            />
          )}
          {uploading
            ? uploadPct < 1
              ? `Uploading ${Math.round(uploadPct * 100)}%`
              : "Saving…"
            : "Browse Files"}
        </button>
        <p className="mt-6 text-sm text-muted-foreground">
          Supports PDF and TXT (max 100 MB each, up to 100 files)
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.txt"
          multiple
          className="hidden"
          onChange={(e) => {
            onFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
    </section>
  );
}

type FanCard = { pos: string; move: string; tilt: string; delay: string; body: ReactNode };

/** Fanned file cards over a folder; they float idly and spread on hover or drag. */
function FileFan({ spread }: { spread: boolean }) {
  const cards: FanCard[] = [
    {
      pos: "left-[4%] top-[36%]",
      move: "group-hover:-translate-x-3 group-hover:-translate-y-1",
      tilt: "-16deg",
      delay: "0s",
      body: <Badge className="bg-badge-red text-[11px]">PDF</Badge>,
    },
    {
      pos: "left-[22%] top-[8%]",
      move: "group-hover:-translate-x-2 group-hover:-translate-y-3",
      tilt: "-8deg",
      delay: "0.4s",
      body: <Badge className="bg-badge-blue text-lg">W</Badge>,
    },
    {
      pos: "left-[44%] top-[4%]",
      move: "group-hover:translate-x-2 group-hover:-translate-y-3",
      tilt: "8deg",
      delay: "0.8s",
      body: <Badge className="bg-leaf-mid text-lg">X</Badge>,
    },
    {
      pos: "right-[14%] top-[24%]",
      move: "group-hover:translate-x-3 group-hover:-translate-y-2",
      tilt: "14deg",
      delay: "1.2s",
      body: (
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-badge-orange text-primary-foreground">
          <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
            <rect
              x="3"
              y="4"
              width="18"
              height="16"
              rx="3"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            />
            <circle cx="9" cy="10" r="2" fill="currentColor" />
            <path
              d="M4 18l5-5 3 3 3-4 5 6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      ),
    },
    {
      pos: "right-[0%] top-[46%]",
      move: "group-hover:translate-x-3",
      tilt: "24deg",
      delay: "1.6s",
      body: (
        <span className="flex flex-col gap-1.5">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className={`h-1 rounded-full bg-badge-purple/50 ${i === 3 ? "w-6" : "w-9"}`}
            />
          ))}
        </span>
      ),
    },
  ];

  return (
    <div className="relative mx-auto h-full w-full max-w-[22rem]">
      <svg viewBox="0 0 352 224" className="absolute inset-0 h-full w-full" aria-hidden="true">
        {["M150 4 L152 22", "M84 50 L96 66", "M262 46 L250 64", "M36 120 L52 134"].map((d) => (
          <path
            key={d}
            d={d}
            stroke="var(--leaf-mid)"
            strokeWidth="2.4"
            strokeLinecap="round"
            opacity="0.55"
          />
        ))}
      </svg>
      {cards.map((card, i) => (
        <div
          key={i}
          className={`absolute transition-transform duration-500 ease-out ${card.pos} ${card.move} ${
            spread ? "scale-110" : ""
          }`}
        >
          <div
            className="animate-float flex h-[5.5rem] w-[4.5rem] items-center justify-center rounded-2xl bg-card shadow-lg ring-1 ring-border/60"
            style={{ ["--tilt" as string]: card.tilt, animationDelay: card.delay }}
          >
            {card.body}
          </div>
        </div>
      ))}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2">
        <div className="relative transition-transform duration-500 group-hover:-translate-y-1 group-hover:scale-105">
          <svg viewBox="0 0 200 120" className="h-28 w-48 drop-shadow-lg" aria-hidden="true">
            <path
              d="M14 30c0-7.7 6.3-14 14-14h44l12 12h88c7.7 0 14 6.3 14 14v62c0 7.7-6.3 14-14 14H28c-7.7 0-14-6.3-14-14V30Z"
              fill="var(--leaf-deep)"
            />
            <path
              d="M10 50c0-7.7 6.3-14 14-14h152c7.7 0 14 6.3 14 14v54c0 7.7-6.3 14-14 14H24c-7.7 0-14-6.3-14-14V50Z"
              fill="var(--leaf-mid)"
            />
          </svg>
          <span className="absolute bottom-5 left-1/2 flex h-12 w-16 -translate-x-1/2 items-center justify-center rounded-full bg-card shadow-md">
            <CloudUpload
              className="h-7 w-7 text-primary transition-transform duration-300 group-hover:-translate-y-0.5"
              strokeWidth={2.2}
            />
          </span>
        </div>
      </div>
    </div>
  );
}

function Badge({ className, children }: { className: string; children: ReactNode }) {
  return (
    <span
      className={`flex h-11 w-11 items-center justify-center rounded-xl font-bold text-primary-foreground shadow-sm ${className}`}
    >
      {children}
    </span>
  );
}

function FilesCard({
  files,
  loaded,
  disabled,
  onDelete,
  onClear,
}: {
  files: CaseFile[];
  loaded: boolean;
  disabled: boolean;
  onDelete: (name: string) => void;
  onClear: () => void;
}) {
  return (
    <aside
      className="glass-card animate-fade-up p-4 sm:p-6 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col"
      style={{ animationDelay: "120ms" }}
    >
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2">
        <div className="flex items-center gap-3">
          <FileText className="h-7 w-7 text-primary" strokeWidth={1.8} />
          <h2 className="text-xl font-bold text-ink-deep">Uploaded Files</h2>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">
            <CountUp value={files.length} duration={500} /> file{files.length === 1 ? "" : "s"}
          </span>
          <button
            onClick={onClear}
            disabled={disabled || files.length === 0}
            className="group flex items-center gap-2 rounded-xl bg-secondary px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50 disabled:hover:bg-secondary disabled:hover:text-foreground"
          >
            <Trash2 className="h-4 w-4 transition-transform group-hover:-rotate-12" />
            Clear all
          </button>
        </div>
      </div>

      {!loaded ? (
        <div className="space-y-3 py-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-2xl bg-secondary/70" />
          ))}
        </div>
      ) : files.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center lg:flex-1 lg:justify-center lg:py-6">
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary text-primary">
            <FileStack className="h-8 w-8" />
          </span>
          <p className="mt-4 font-semibold text-ink-deep">No files yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add some documents to begin your case.
          </p>
        </div>
      ) : (
        <ul
          className={`lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-1 ${files.length > 6 ? "max-h-[520px] overflow-y-auto pr-1 lg:max-h-none" : ""}`}
        >
          {files.map((file, i) => (
            <FileRow
              key={file.id}
              index={i}
              file={file}
              disabled={disabled}
              onDelete={() => onDelete(file.id)}
            />
          ))}
        </ul>
      )}
    </aside>
  );
}

function FileRow({
  file,
  index,
  disabled,
  onDelete,
}: {
  file: CaseFile;
  index: number;
  disabled: boolean;
  onDelete: () => void;
}) {
  return (
    <li
      className="animate-fade-up group flex items-center gap-3.5 rounded-2xl border-b border-border/60 px-2 py-3.5 transition-colors last:border-0 hover:bg-secondary/60"
      style={{ animationDelay: `${Math.min(index, 10) * 50}ms` }}
    >
      <span className="transition-transform duration-300 group-hover:scale-105">
        <FileBadge kind={file.kind} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink-deep">{file.name}</p>
        <p
          className={`mt-1 truncate text-xs ${file.status === "failed" ? "text-destructive" : "text-muted-foreground"}`}
          title={file.meta}
        >
          {file.meta}
        </p>
        {file.progress != null ? (
          <div
            className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary"
            role="progressbar"
            aria-valuenow={Math.round(file.progress * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="relative h-full overflow-hidden rounded-full bg-gradient-to-r from-leaf-mid to-primary transition-all duration-500"
              style={{ width: `${Math.max(4, file.progress * 100)}%` }}
            >
              <span className="absolute inset-0 animate-shimmer opacity-40" />
            </div>
          </div>
        ) : null}
      </div>
      <span className="hidden w-16 text-right text-sm text-foreground/80 sm:block">
        {file.size}
      </span>
      <StatusPill
        status={file.status}
        label={
          file.status === "reading" && file.pages ? `${file.done}/${file.pages} pages` : undefined
        }
      />
      <DropdownMenu>
        <DropdownMenuTrigger
          className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`Options for ${file.name}`}
        >
          <MoreVertical className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="theme-fresh">
          <DropdownMenuItem
            disabled={disabled}
            onSelect={onDelete}
            className="text-destructive focus:bg-destructive/10 focus:text-destructive"
          >
            <Trash2 className="h-4 w-4" /> Delete file
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}

function StatusPill({ status, label }: { status: FileStatus; label?: string | undefined }) {
  const pill = {
    reading: {
      label: label ?? "Reading…",
      className: "bg-status-blue/10 text-status-blue",
      icon: <LoaderCircle className="h-4 w-4 animate-spin" />,
    },
    failed: {
      label: "Failed",
      className: "bg-destructive/10 text-destructive",
      icon: <AlertCircle className="h-4 w-4" />,
    },
    processing: {
      label: "Processing...",
      className: "bg-status-blue/10 text-status-blue",
      icon: <LoaderCircle className="h-4 w-4 animate-spin" />,
    },
    extracted: {
      label: "Extracted",
      className: "bg-status-green/10 text-status-green",
      icon: <CheckCircle2 className="h-4 w-4 fill-status-green text-card" />,
    },
    queued: {
      label: "Queued",
      className: "bg-muted text-muted-foreground",
      icon: <Clock className="h-4 w-4" />,
    },
  }[status];

  return (
    <span
      className={`hidden w-32 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold md:flex ${pill.className}`}
    >
      {pill.icon}
      <span className="tabular-nums">{pill.label}</span>
    </span>
  );
}
