import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { FileSearch } from "lucide-react";

/** Pill tabs; only the active tab's content is mounted, so its entrance animations replay. */
export function PanelTabs<T extends string>({
  value,
  onChange,
  tabs,
}: {
  value: T;
  onChange: (t: T) => void;
  tabs: { id: T; label: string; content: ReactNode }[];
}) {
  const current = tabs.find((t) => t.id === value) ?? tabs[0]!;
  return (
    <div>
      <div
        role="tablist"
        className="sticky top-0 z-10 -mx-6 mb-5 flex gap-1.5 overflow-x-auto border-b border-border bg-card/90 px-6 pb-3 pt-1 backdrop-blur-md"
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={t.id === current.id}
            onClick={() => onChange(t.id)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-all ${
              t.id === current.id
                ? "bg-primary text-primary-foreground shadow-leaf"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" key={current.id} className="animate-fade-up">
        {current.content}
      </div>
    </div>
  );
}

export function EmptyState({ text }: { text?: string }) {
  return (
    <div className="flex flex-col items-center py-16 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary text-primary">
        <FileSearch className="h-8 w-8" />
      </span>
      <p className="mt-4 font-semibold text-ink-deep">Nothing extracted yet</p>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">
        {text ?? "Upload documents and run the extraction to see results here."}
      </p>
      <Link
        to="/get-started"
        className="mt-5 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5"
      >
        Go to uploads
      </Link>
    </div>
  );
}
