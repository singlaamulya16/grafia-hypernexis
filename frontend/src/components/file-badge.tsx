import { FileText, Image as ImageIcon } from "lucide-react";

export type FileKind = "pdf" | "doc" | "xls" | "png" | "jpg" | "txt" | "other";

export const KIND_LABEL: Record<FileKind, string> = {
  pdf: "PDF",
  doc: "DOCX",
  xls: "XLSX",
  png: "PNG",
  jpg: "JPG",
  txt: "TXT",
  other: "FILE",
};

export function extKind(name: string): FileKind {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return "pdf";
  if (ext === "doc" || ext === "docx") return "doc";
  if (ext === "xls" || ext === "xlsx" || ext === "csv") return "xls";
  if (ext === "png") return "png";
  if (ext === "jpg" || ext === "jpeg") return "jpg";
  if (ext === "txt" || ext === "md") return "txt";
  return "other";
}

export function formatSize(bytes: number) {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1_000))} KB`;
}

const TILE: Record<FileKind, { label?: string; className: string }> = {
  pdf: { label: "PDF", className: "bg-badge-red/10 text-badge-red" },
  doc: { label: "DOC", className: "bg-badge-blue/10 text-badge-blue" },
  xls: { label: "XLS", className: "bg-leaf-mid/10 text-leaf-mid" },
  png: { className: "bg-badge-purple/10 text-badge-purple" },
  jpg: { className: "bg-badge-orange/10 text-badge-orange" },
  txt: { label: "TXT", className: "bg-secondary text-primary" },
  other: { className: "bg-secondary text-muted-foreground" },
};

const SOLID: Record<FileKind, string> = {
  pdf: "bg-badge-red",
  doc: "bg-badge-blue",
  xls: "bg-leaf-mid",
  png: "bg-badge-purple",
  jpg: "bg-badge-orange",
  txt: "bg-primary",
  other: "bg-muted-foreground",
};

/** A soft tile with a solid file-type badge inside, as in the file lists. */
export function FileBadge({ kind, size = "md" }: { kind: FileKind; size?: "sm" | "md" }) {
  const tile = TILE[kind];
  const outer = size === "sm" ? "h-11 w-11 rounded-xl" : "h-12 w-12 rounded-2xl";
  const inner = size === "sm" ? "h-7 w-6 text-[8px]" : "h-8 w-7 text-[9px]";
  return (
    <span className={`flex shrink-0 items-center justify-center ${outer} ${tile.className}`}>
      <span
        className={`flex items-end justify-center rounded-[5px] pb-1 font-bold text-primary-foreground shadow-sm ${inner} ${SOLID[kind]}`}
        style={{ clipPath: "polygon(0 0, 70% 0, 100% 22%, 100% 100%, 0 100%)" }}
      >
        {tile.label ??
          (kind === "other" ? (
            <FileText className="mb-0.5 h-3.5 w-3.5" />
          ) : (
            <ImageIcon className="mb-0.5 h-3.5 w-3.5" />
          ))}
      </span>
    </span>
  );
}
