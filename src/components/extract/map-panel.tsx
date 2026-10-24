import { useMemo, useState, type ReactNode } from "react";
import { ArrowRight, Link2, Search, Sparkles } from "lucide-react";
import type { Insights } from "@/lib/api";
import {
  CATEGORIES,
  categoryMeta,
  categoryOf,
  prettyName,
  prettyType,
  type Category,
} from "@/components/extract/entity-types";
import { EmptyState, PanelTabs } from "@/components/extract/panel-kit";

export type MapTab = "summary" | "entities" | "facts";

export function MapPanel({
  data,
  tab,
  onTab,
}: {
  data: Insights;
  tab: MapTab;
  onTab: (t: MapTab) => void;
}) {
  return (
    <PanelTabs
      value={tab}
      onChange={onTab}
      tabs={[
        { id: "summary", label: "Summarise", content: <Summary data={data} /> },
        { id: "entities", label: "Extract Entities", content: <Entities data={data} /> },
        { id: "facts", label: "Find Key Facts", content: <Facts data={data} /> },
      ]}
    />
  );
}

function Summary({ data }: { data: Insights }) {
  const counts = useMemo(() => countByCategory(data), [data]);
  if (!data.communities.length && !data.entities.length) return <EmptyState />;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {CATEGORIES.map((c, i) => (
          <div
            key={c.id}
            className="animate-fade-up rounded-2xl border border-border bg-card p-3 transition-transform hover:-translate-y-0.5"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${c.soft}`}>
              <c.icon className="h-4 w-4" />
            </span>
            <p className="mt-2 text-2xl font-bold text-ink-deep">{counts[c.id] ?? 0}</p>
            <p className="text-xs text-muted-foreground">{c.label}</p>
          </div>
        ))}
      </div>
      <div>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink-deep">
          <Sparkles className="h-4 w-4 text-primary" /> Main themes across your documents
        </h3>
        <ol className="space-y-3">
          {data.communities.map((c, i) => (
            <li
              key={c.id}
              className="animate-fade-up rounded-2xl border border-border bg-card p-4 transition-shadow hover:shadow-md"
              style={{ animationDelay: `${150 + i * 60}ms` }}
            >
              <div className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="font-semibold text-ink-deep">{c.title}</p>
                  {c.summary ? (
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {c.summary}
                    </p>
                  ) : null}
                  {c.size ? (
                    <p className="mt-2 text-xs font-medium text-primary">{c.size} entities</p>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function Entities({ data }: { data: Insights }) {
  const [filter, setFilter] = useState<Category | "all">("all");
  const [query, setQuery] = useState("");
  const counts = useMemo(() => countByCategory(data), [data]);
  const list = data.entities.filter(
    (e) =>
      (filter === "all" || categoryOf(e.type) === filter) &&
      (!query || `${e.name} ${e.description}`.toLowerCase().includes(query.trim().toLowerCase())),
  );
  if (!data.entities.length) return <EmptyState />;
  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search entities…"
          aria-label="Search entities"
          className="w-full rounded-xl border border-input bg-card py-2.5 pl-10 pr-4 text-sm outline-none transition-colors focus:border-primary"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
          All <span className="opacity-70">{data.entities.length}</span>
        </FilterChip>
        {CATEGORIES.map((c) => (
          <FilterChip key={c.id} active={filter === c.id} onClick={() => setFilter(c.id)}>
            <c.icon className="h-3.5 w-3.5" /> {c.label}{" "}
            <span className="opacity-70">{counts[c.id] ?? 0}</span>
          </FilterChip>
        ))}
      </div>
      {list.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">No entities match.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {list.slice(0, 120).map((e, i) => {
            const meta = categoryMeta(e.type);
            return (
              <li
                key={e.name}
                className="animate-fade-up rounded-2xl border border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
                style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${meta.soft}`}
                  >
                    <meta.icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold leading-tight text-ink-deep">
                      {prettyName(e.name)}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {prettyType(e.type)} · {e.degree} connection{e.degree === 1 ? "" : "s"}
                    </p>
                  </div>
                </div>
                {e.description ? (
                  <p className="mt-2.5 line-clamp-3 text-sm leading-relaxed text-foreground/80">
                    {e.description}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Facts({ data }: { data: Insights }) {
  const degree = useMemo(() => new Map(data.entities.map((e) => [e.name, e.degree])), [data]);
  const facts = useMemo(
    () =>
      data.relationships
        .filter((r) => r.description)
        .map((r) => ({
          ...r,
          score: r.weight * 10 + (degree.get(r.source) ?? 0) + (degree.get(r.target) ?? 0),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 40),
    [data, degree],
  );
  if (!facts.length) return <EmptyState />;
  return (
    <ol className="space-y-3">
      {facts.map((f, i) => (
        <li
          key={`${f.source}-${f.target}`}
          className="animate-fade-up group rounded-2xl border border-border bg-card p-4 transition-all hover:border-primary/30 hover:shadow-md"
          style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}
        >
          <p className="text-sm leading-relaxed text-ink-deep">{f.description}</p>
          <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <Link2 className="h-3.5 w-3.5 text-primary" />
            <span className="font-medium text-foreground">{prettyName(f.source)}</span>
            <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
            <span className="font-medium text-foreground">{prettyName(f.target)}</span>
          </p>
        </li>
      ))}
    </ol>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "bg-secondary text-secondary-foreground hover:bg-accent"
      }`}
    >
      {children}
    </button>
  );
}

export function countByCategory(data: Insights): Partial<Record<Category, number>> {
  const out: Partial<Record<Category, number>> = {};
  for (const [type, n] of Object.entries(data.type_counts)) {
    const c = categoryOf(type);
    out[c] = (out[c] ?? 0) + n;
  }
  return out;
}
