import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import {
  Bell,
  Building2,
  Check,
  ChevronDown,
  Clock,
  CloudUpload,
  FileText,
  Image as ImageIcon,
  Loader2,
  MoreVertical,
  Network,
  Trash2,
  Upload,
} from "lucide-react";
import uploadBg from "@/assets/upload-bg.png";

export const Route = createFileRoute("/get-started")({
  head: () => ({
    meta: [
      { title: "DocuDetect — Upload Your Documents" },
      {
        name: "description",
        content:
          "Add your case files — PDF, DOCX, XLSX, TXT and images — and let your AI detective analyse them.",
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

type FileStatus = "processing" | "extracted" | "queued";
type FileKind = "pdf" | "doc" | "xls" | "png" | "jpg" | "txt" | "other";

type CaseFile = {
  name: string;
  kind: FileKind;
  size: string;
  meta: string;
  status: FileStatus;
};

const DEMO_FILES: CaseFile[] = [
  {
    name: "Annual_Report_2024.pdf",
    kind: "pdf",
    size: "2.4 MB",
    meta: "PDF • 24 pages • 10 Oct 2024",
    status: "processing",
  },
  {
    name: "Company_Policy.docx",
    kind: "doc",
    size: "1.1 MB",
    meta: "DOCX • 15 pages • 9 Oct 2024",
    status: "extracted",
  },
  {
    name: "Financial_Data.xlsx",
    kind: "xls",
    size: "3.2 MB",
    meta: "XLSX • 8 sheets • 9 Oct 2024",
    status: "extracted",
  },
  {
    name: "Office_Building.jpg",
    kind: "jpg",
    size: "4.1 MB",
    meta: "JPG • 10 Oct 2024",
    status: "extracted",
  },
  {
    name: "Contracts.pdf",
    kind: "pdf",
    size: "5.6 MB",
    meta: "PDF • 32 pages • 8 Oct 2024",
    status: "extracted",
  },
  {
    name: "Meeting_Notes.docx",
    kind: "doc",
    size: "800 KB",
    meta: "DOCX • 6 pages • 8 Oct 2024",
    status: "queued",
  },
  {
    name: "Diagram.png",
    kind: "png",
    size: "1.3 MB",
    meta: "PNG • 8 Oct 2024",
    status: "extracted",
  },
  {
    name: "Team_Data.xlsx",
    kind: "xls",
    size: "1.8 MB",
    meta: "XLSX • 4 sheets • 7 Oct 2024",
    status: "extracted",
  },
  {
    name: "Interview_Notes.txt",
    kind: "txt",
    size: "96 KB",
    meta: "TXT • 12 pages • 7 Oct 2024",
    status: "extracted",
  },
  {
    name: "Budget_2025.xlsx",
    kind: "xls",
    size: "2.0 MB",
    meta: "XLSX • 6 sheets • 6 Oct 2024",
    status: "extracted",
  },
  {
    name: "Evidence_Photo.jpg",
    kind: "jpg",
    size: "3.4 MB",
    meta: "JPG • 6 Oct 2024",
    status: "extracted",
  },
  {
    name: "Case_Summary.pdf",
    kind: "pdf",
    size: "1.9 MB",
    meta: "PDF • 18 pages • 6 Oct 2024",
    status: "extracted",
  },
];

const STEPS = ["Upload", "Extract", "Knowledge Graph", "Explore Insights", "Chat"];

const KIND_LABEL: Record<FileKind, string> = {
  pdf: "PDF",
  doc: "DOCX",
  xls: "XLSX",
  png: "PNG",
  jpg: "JPG",
  txt: "TXT",
  other: "FILE",
};

function extKind(name: string): FileKind {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return "pdf";
  if (ext === "doc" || ext === "docx") return "doc";
  if (ext === "xls" || ext === "xlsx" || ext === "csv") return "xls";
  if (ext === "png") return "png";
  if (ext === "jpg" || ext === "jpeg") return "jpg";
  if (ext === "txt" || ext === "md") return "txt";
  return "other";
}

function formatSize(bytes: number) {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1_000))} KB`;
}

function GetStartedPage() {
  const [files, setFiles] = useState<CaseFile[]>(DEMO_FILES);

  function addFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    const rows: CaseFile[] = Array.from(list).map((file) => {
      const kind = extKind(file.name);
      return {
        name: file.name,
        kind,
        size: formatSize(file.size),
        meta: `${KIND_LABEL[kind]} • just added`,
        status: "queued" as FileStatus,
      };
    });
    setFiles((prev) => [...rows, ...prev]);
  }

  return (
    <div className="theme-fresh relative min-h-screen bg-background text-foreground">
      <img
        src={uploadBg}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-background/50 via-background/30 to-background/60" />

      <div className="relative">
        <TopBar />
        <main className="mx-auto grid max-w-7xl gap-6 px-6 py-8 lg:grid-cols-[1.05fr_1fr]">
          <UploadCard onFiles={addFiles} />
          <FilesCard files={files} onClear={() => setFiles([])} />
        </main>
      </div>
    </div>
  );
}

function FreshLogo() {
  return (
    <svg viewBox="0 0 48 40" className="h-9 w-auto" aria-hidden="true">
      {/* fedora */}
      <path
        d="M6 22c0-1.2 1-2 2.2-2h31.6c1.2 0 2.2.8 2.2 2 0 1.2-1 2-2.2 2H8.2C7 24 6 23.2 6 22Z"
        fill="var(--ink-deep)"
      />
      <path
        d="M12 21c0-8 4-14 12-14s12 6 12 14v1H12v-1Z"
        fill="var(--leaf-mid)"
      />
      <path
        d="M11 16.5c4-2 22-2 26 0l-1 3c-4-1.6-20-1.6-24 0l-1-3Z"
        fill="var(--ink-deep)"
      />
      {/* magnifier */}
      <circle cx="19" cy="31" r="5.5" fill="none" stroke="var(--ink-deep)" strokeWidth="2.6" />
      <circle cx="19" cy="31" r="2" fill="var(--leaf-mid)" />
      <line
        x1="23"
        y1="35"
        x2="28"
        y2="39.5"
        stroke="var(--ink-deep)"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function TopBar() {
  return (
    <header className="bg-card/70 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-6 py-3.5">
        <Link to="/" className="flex items-center gap-2.5">
          <FreshLogo />
          <span className="text-2xl font-bold tracking-tight">
            Docu<span className="text-leaf-mid">Detect</span>
          </span>
        </Link>
        <Stepper />
        <div className="flex items-center gap-2">
          <button
            className="relative rounded-full p-2.5 text-foreground/70 transition-colors hover:bg-accent"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-destructive ring-2 ring-card" />
          </button>
          <button
            className="flex items-center gap-1 rounded-full p-1 transition-colors hover:bg-accent"
            aria-label="Account menu"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
              A
            </span>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </div>
    </header>
  );
}

function Stepper() {
  return (
    <ol className="hidden items-center xl:flex">
      {STEPS.map((label, i) => (
        <li key={label} className="contents">
          <div className="flex w-32 flex-col items-center">
            <span
              className={
                i === 0
                  ? "flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground"
                  : "flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-sm font-semibold text-muted-foreground"
              }
            >
              {i + 1}
            </span>
            <span
              className={
                i === 0
                  ? "mt-2 text-xs font-semibold text-primary"
                  : "mt-2 text-xs text-muted-foreground"
              }
            >
              {label}
            </span>
          </div>
          {i < STEPS.length - 1 ? (
            <div
              className={`h-0.5 w-14 self-start rounded-full ${
                i === 0 ? "mt-5 bg-gradient-to-r from-primary to-border" : "mt-5 bg-border"
              }`}
            />
          ) : null}
        </li>
      ))}
    </ol>
  );
}

function UploadCard({ onFiles }: { onFiles: (files: FileList | null) => void }) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <section className="rounded-3xl bg-card p-8 shadow-xl sm:p-10">
      <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
        <span className="text-leaf-mid">1. </span>Upload{" "}
        <span className="text-gradient-leaf">Your Documents</span>
      </h1>
      <p className="mt-4 text-lg text-muted-foreground">
        Add your files to get started. We'll analyse them in the next steps.
      </p>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          onFiles(e.dataTransfer.files);
        }}
        className={`mt-8 rounded-3xl border-2 border-dashed p-8 text-center transition-colors sm:p-10 ${
          dragOver ? "border-primary bg-secondary/70" : "border-leaf-mid/50 bg-secondary/40"
        }`}
      >
        <FileFan />
        <p className="mt-6 text-2xl font-bold">Drag & drop your files here</p>
        <p className="mt-2 text-sm text-muted-foreground">or</p>
        <button
          onClick={() => inputRef.current?.click()}
          className="mx-auto mt-4 flex items-center gap-2.5 rounded-xl bg-primary px-9 py-4 text-lg font-semibold text-primary-foreground shadow-md transition-transform hover:scale-[1.02]"
        >
          <Upload className="h-5 w-5" strokeWidth={2.4} />
          Browse Files
        </button>
        <p className="mt-6 text-sm text-muted-foreground">
          Supports PDF, DOCX, XLSX, TXT, PNG, JPG (Max 100MB each)
        </p>
        <input
          ref={inputRef}
          type="file"
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

function FileFan() {
  const cards = [
    {
      pos: "left-0 top-14 -rotate-12",
      badge: (
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-badge-red text-[10px] font-bold text-white">
          PDF
        </span>
      ),
    },
    {
      pos: "left-[4.6rem] top-4 -rotate-6",
      badge: (
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-badge-blue text-sm font-bold text-white">
          W
        </span>
      ),
    },
    {
      pos: "right-[4.6rem] top-4 rotate-3",
      badge: (
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-leaf-mid text-sm font-bold text-white">
          X
        </span>
      ),
    },
    {
      pos: "right-0 top-14 rotate-12",
      badge: (
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-badge-orange text-white">
          <ImageIcon className="h-5 w-5" />
        </span>
      ),
    },
  ];

  return (
    <div className="relative mx-auto h-52 w-80 max-w-full">
      {cards.map((card, i) => (
        <div
          key={i}
          className={`absolute flex h-24 w-[4.6rem] items-center justify-center rounded-2xl bg-card shadow-md ${card.pos}`}
        >
          {card.badge}
        </div>
      ))}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2">
        <div className="relative">
          <svg viewBox="0 0 160 100" className="h-24 w-40" aria-hidden="true">
            <path
              d="M12 32c0-6.6 5.4-12 12-12h34l10 10h70c6.6 0 12 5.4 12 12v44c0 6.6-5.4 12-12 12H24c-6.6 0-12-5.4-12-12V32Z"
              fill="var(--primary)"
            />
          </svg>
          <CloudUpload className="absolute bottom-4 left-1/2 h-9 w-9 -translate-x-1/2 text-primary-foreground" strokeWidth={1.9} />
        </div>
      </div>
    </div>
  );
}

function FilesCard({ files, onClear }: { files: CaseFile[]; onClear: () => void }) {
  return (
    <aside className="rounded-3xl bg-card p-6 shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary text-primary">
            <FileText className="h-5 w-5" />
          </span>
          <h2 className="text-xl font-bold">Uploaded Files</h2>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{files.length} files</span>
          <button
            onClick={onClear}
            className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground shadow-sm transition-colors hover:bg-accent"
          >
            <Trash2 className="h-4 w-4 text-muted-foreground" />
            Clear all
          </button>
        </div>
      </div>

      {files.length === 0 ? (
        <p className="py-20 text-center text-sm text-muted-foreground">
          No files yet — add some to begin your case.
        </p>
      ) : (
        <ul className="mt-2 max-h-[560px] overflow-y-auto pr-1">
          {files.map((file, i) => (
            <FileRow key={`${file.name}-${i}`} file={file} />
          ))}
        </ul>
      )}
    </aside>
  );
}

function FileRow({ file }: { file: CaseFile }) {
  return (
    <li className="flex items-center gap-3 border-b border-border/70 py-3.5 last:border-0">
      <FileTile kind={file.kind} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">{file.name}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{file.meta}</p>
      </div>
      <span className="hidden w-16 text-right text-sm text-foreground/80 sm:block">
        {file.size}
      </span>
      <StatusPill status={file.status} />
      <button
        className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent"
        aria-label={`Options for ${file.name}`}
      >
        <MoreVertical className="h-4 w-4" />
      </button>
    </li>
  );
}

function FileTile({ kind }: { kind: FileKind }) {
  if (kind === "jpg") {
    return (
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-b from-status-blue/40 to-secondary">
        <Building2 className="h-5 w-5 text-foreground/60" />
      </span>
    );
  }
  if (kind === "png") {
    return (
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
        <Network className="h-5 w-5" />
      </span>
    );
  }
  if (kind === "txt" || kind === "other") {
    return (
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
        <FileText className="h-5 w-5" />
      </span>
    );
  }
  const solid: Record<"pdf" | "doc" | "xls", { label: string; className: string }> = {
    pdf: { label: "PDF", className: "bg-badge-red" },
    doc: { label: "DOC", className: "bg-badge-blue" },
    xls: { label: "X", className: "bg-leaf-mid" },
  };
  const tile = solid[kind];
  return (
    <span
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[10px] font-bold text-white ${tile.className}`}
    >
      {tile.label}
    </span>
  );
}

function StatusPill({ status }: { status: FileStatus }) {
  const pill = {
    processing: {
      label: "Processing...",
      className: "bg-status-blue/10 text-status-blue",
      icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
    },
    extracted: {
      label: "Extracted",
      className: "bg-status-green/10 text-status-green",
      icon: <Check className="h-3.5 w-3.5" strokeWidth={3} />,
    },
    queued: {
      label: "Queued",
      className: "bg-muted text-muted-foreground",
      icon: <Clock className="h-3.5 w-3.5" />,
    },
  }[status];

  return (
    <span
      className={`hidden items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold md:flex ${pill.className}`}
    >
      {pill.icon}
      {pill.label}
    </span>
  );
}
