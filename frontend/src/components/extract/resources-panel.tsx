import { useMemo, useState } from "react";
import {
  ExternalLink,
  FileCheck2,
  Globe,
  GraduationCap,
  Link2,
  Newspaper,
  Search,
  type LucideIcon,
} from "lucide-react";
import type { Insights } from "@/lib/api";
import { categoryOf, prettyName } from "@/components/extract/entity-types";

export type ResourceKind = "web" | "papers" | "official" | "news" | "links";

const q = encodeURIComponent;

export const RESOURCE_KINDS: {
  id: ResourceKind;
  label: string;
  icon: LucideIcon;
  site: string;
  url: (topic: string) => string;
}[] = [
  {
    id: "web",
    label: "Web Sources",
    icon: Globe,
    site: "Google",
    url: (t) => `https://www.google.com/search?q=${q(t)}`,
  },
  {
    id: "papers",
    label: "Research Papers",
    icon: GraduationCap,
    site: "Google Scholar",
    url: (t) => `https://scholar.google.com/scholar?q=${q(t)}`,
  },
  {
    id: "official",
    label: "Official Documents",
    icon: FileCheck2,
    site: "Government PDFs",
    url: (t) =>
      `https://www.google.com/search?q=${q(`${t} filetype:pdf (site:gov OR site:gov.uk OR site:europa.eu OR site:gov.in)`)}`,
  },
  {
    id: "news",
    label: "News Articles",
    icon: Newspaper,
    site: "Google News",
    url: (t) => `https://news.google.com/search?q=${q(t)}`,
  },
  {
    id: "links",
    label: "Relevant Links",
    icon: Link2,
    site: "Wikipedia",
    url: (t) => `https://en.wikipedia.org/w/index.php?search=${q(t)}`,
  },
];

/** Search starters for the case's themes and key entities, grouped by kind of source. */
export function ResourcesPanel({
  data,
  kind,
  onKind,
}: {
  data: Insights;
  kind: ResourceKind;
  onKind: (k: ResourceKind) => void;
}) {
  const topics = useMemo(() => {
    const themes = data.communities.map((c) => c.title);
    const key = data.entities
      .filter((e) => categoryOf(e.type) !== "dates")
      .slice(0, 8)
      .map((e) => prettyName(e.name));
    return Array.from(new Set([...themes, ...key])).slice(0, 12);
  }, [data]);
  const [custom, setCustom] = useState("");
  const [picked, setPicked] = useState<string[]>(() => topics.slice(0, 4));
  const active = RESOURCE_KINDS.find((k) => k.id === kind) ?? RESOURCE_KINDS[0]!;
  const queries = custom.trim() ? [custom.trim(), ...picked] : picked;

  function toggle(t: string) {
    setPicked((prev) => (prev.includes(t) ? prev.filter((p) => p !== t) : [...prev, t]));
  }

  return (
    <div className="space-y-5">
      <p className="rounded-2xl bg-secondary px-4 py-3 text-sm text-secondary-foreground">
        Pick topics from your case, then open ready-made searches on trusted sites. Links open in a
        new tab; nothing from your documents is sent anywhere until you click.
      </p>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-ink-deep">Topics from your documents</h3>
        <div className="flex flex-wrap gap-2">
          {topics.map((t) => {
            const on = picked.includes(t);
            return (
              <button
                key={t}
                onClick={() => toggle(t)}
                aria-pressed={on}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
                  on
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-card text-foreground ring-1 ring-border hover:ring-primary/40"
                }`}
              >
                {t}
              </button>
            );
          })}
        </div>
        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="Or type your own search…"
            aria-label="Custom search"
            className="w-full rounded-xl border border-input bg-card py-2.5 pl-10 pr-4 text-sm outline-none transition-colors focus:border-primary"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2" role="tablist">
        {RESOURCE_KINDS.map((k) => (
          <button
            key={k.id}
            role="tab"
            aria-selected={k.id === active.id}
            onClick={() => onKind(k.id)}
            className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-all ${
              k.id === active.id
                ? "bg-primary text-primary-foreground shadow-leaf"
                : "bg-secondary text-secondary-foreground hover:bg-accent"
            }`}
          >
            <k.icon className="h-4 w-4" />
            {k.label}
          </button>
        ))}
      </div>

      {queries.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Pick at least one topic or type a search.
        </p>
      ) : (
        <ul key={active.id} className="grid gap-3 sm:grid-cols-2">
          {queries.map((t, i) => (
            <li key={t} className="animate-fade-up" style={{ animationDelay: `${i * 40}ms` }}>
              <a
                href={active.url(t)}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <active.icon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-ink-deep">{t}</span>
                  <span className="block text-xs text-muted-foreground">Search {active.site}</span>
                </span>
                <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" />
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
