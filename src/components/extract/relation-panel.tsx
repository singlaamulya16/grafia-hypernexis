import { useMemo, useState } from "react";
import { ArrowRight, Search } from "lucide-react";
import type { Entity, Insights, Relationship } from "@/lib/api";
import {
  CATEGORIES,
  categoryMeta,
  prettyName,
  prettyType,
} from "@/components/extract/entity-types";
import { EmptyState, PanelTabs } from "@/components/extract/panel-kit";

export type RelationTab = "graph" | "connections" | "relationships";

const MAX_NODES = 60;
const W = 720;
const H = 480;

type Placed = Entity & { x: number; y: number; r: number };

/** Small force-directed layout (repulsion, edge springs, centering), run once per data set. */
function layout(entities: Entity[], edges: Relationship[]): Placed[] {
  const n = entities.length;
  const idx = new Map(entities.map((e, i) => [e.name, i]));
  const pos = entities.map((_, i) => {
    const a = (i / Math.max(1, n)) * Math.PI * 2;
    const rad = 120 + (i % 5) * 18;
    return { x: Math.cos(a) * rad, y: Math.sin(a) * rad };
  });
  const links = edges
    .map((e) => [idx.get(e.source), idx.get(e.target)] as const)
    .filter((l): l is readonly [number, number] => l[0] != null && l[1] != null);
  for (let step = 0; step < 320; step++) {
    const cool = 1 - step / 320;
    const disp = pos.map(() => ({ x: 0, y: 0 }));
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dx = pos[i]!.x - pos[j]!.x;
        const dy = pos[i]!.y - pos[j]!.y;
        const d2 = Math.max(dx * dx + dy * dy, 25);
        const f = 4200 / d2;
        disp[i]!.x += dx * f * 0.05;
        disp[i]!.y += dy * f * 0.05;
        disp[j]!.x -= dx * f * 0.05;
        disp[j]!.y -= dy * f * 0.05;
      }
    }
    for (const [a, b] of links) {
      const dx = pos[b]!.x - pos[a]!.x;
      const dy = pos[b]!.y - pos[a]!.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const f = (d - 85) * 0.04;
      disp[a]!.x += (dx / d) * f;
      disp[a]!.y += (dy / d) * f;
      disp[b]!.x -= (dx / d) * f;
      disp[b]!.y -= (dy / d) * f;
    }
    for (let i = 0; i < n; i++) {
      disp[i]!.x -= pos[i]!.x * 0.01;
      disp[i]!.y -= pos[i]!.y * 0.01;
      const m = Math.sqrt(disp[i]!.x ** 2 + disp[i]!.y ** 2) || 1;
      const cap = 12 * cool + 0.5;
      pos[i]!.x += (disp[i]!.x / m) * Math.min(m, cap);
      pos[i]!.y += (disp[i]!.y / m) * Math.min(m, cap);
    }
  }
  const xs = pos.map((p) => p.x);
  const ys = pos.map((p) => p.y);
  const [minX, maxX, minY, maxY] = [
    Math.min(...xs),
    Math.max(...xs),
    Math.min(...ys),
    Math.max(...ys),
  ];
  const pad = 46;
  const sx = (W - pad * 2) / Math.max(1, maxX - minX);
  const sy = (H - pad * 2) / Math.max(1, maxY - minY);
  const maxDeg = Math.max(1, ...entities.map((e) => e.degree));
  return entities.map((e, i) => ({
    ...e,
    x: pad + (pos[i]!.x - minX) * sx,
    y: pad + (pos[i]!.y - minY) * sy,
    r: 7 + (e.degree / maxDeg) * 11,
  }));
}

export function RelationPanel({
  data,
  tab,
  onTab,
}: {
  data: Insights;
  tab: RelationTab;
  onTab: (t: RelationTab) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  if (!data.entities.length) return <EmptyState />;
  return (
    <PanelTabs
      value={tab}
      onChange={onTab}
      tabs={[
        {
          id: "graph",
          label: "Knowledge Graph",
          content: (
            <Graph
              data={data}
              selected={selected}
              onSelect={setSelected}
              onOpen={() => onTab("connections")}
            />
          ),
        },
        {
          id: "connections",
          label: "Connections",
          content: <Connections data={data} selected={selected} onSelect={setSelected} />,
        },
        { id: "relationships", label: "Relationships", content: <Relationships data={data} /> },
      ]}
    />
  );
}

function Graph({
  data,
  selected,
  onSelect,
  onOpen,
}: {
  data: Insights;
  selected: string | null;
  onSelect: (name: string | null) => void;
  onOpen: () => void;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const nodes = useMemo(() => {
    const top = data.entities.slice(0, MAX_NODES);
    const keep = new Set(top.map((e) => e.name));
    return layout(
      top,
      data.relationships.filter((r) => keep.has(r.source) && keep.has(r.target)),
    );
  }, [data]);
  const byName = useMemo(() => new Map(nodes.map((n) => [n.name, n])), [nodes]);
  const edges = useMemo(
    () => data.relationships.filter((r) => byName.has(r.source) && byName.has(r.target)),
    [data, byName],
  );
  const focus = hover ?? selected;
  const neighbours = useMemo(() => {
    if (!focus) return null;
    const set = new Set([focus]);
    for (const e of edges) {
      if (e.source === focus) set.add(e.target);
      if (e.target === focus) set.add(e.source);
    }
    return set;
  }, [focus, edges]);
  const sel = selected ? byName.get(selected) : null;
  const selEdges = sel ? edges.filter((e) => e.source === sel.name || e.target === sel.name) : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        {CATEGORIES.map((c) => (
          <span key={c.id} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />
            {c.label}
          </span>
        ))}
        <span className="ml-auto">
          Top {nodes.length} of {data.stats.entities} entities · hover to focus, click for details
        </span>
      </div>
      <div className="overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-card to-secondary/60">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full"
          role="img"
          aria-label="Knowledge graph of the most connected entities"
          onClick={() => onSelect(null)}
        >
          {edges.map((e) => {
            const a = byName.get(e.source)!;
            const b = byName.get(e.target)!;
            const on =
              neighbours &&
              neighbours.has(e.source) &&
              neighbours.has(e.target) &&
              (e.source === focus || e.target === focus);
            return (
              <line
                key={`${e.source}-${e.target}`}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={on ? "var(--primary)" : "var(--leaf-mid)"}
                strokeOpacity={neighbours ? (on ? 0.9 : 0.08) : 0.3}
                strokeWidth={on ? 2.2 : 1.2}
                strokeDasharray={on ? "5 4" : undefined}
                className={on ? "animate-dash" : undefined}
                style={{ transition: "stroke-opacity 200ms" }}
              />
            );
          })}
          {nodes.map((n, i) => {
            const meta = categoryMeta(n.type);
            const dim = neighbours && !neighbours.has(n.name);
            const isSel = n.name === selected;
            const showLabel = i < 14 || (neighbours?.has(n.name) ?? false);
            return (
              <g
                key={n.name}
                transform={`translate(${n.x} ${n.y})`}
                className="cursor-pointer"
                style={{ opacity: dim ? 0.18 : 1, transition: "opacity 200ms" }}
                onMouseEnter={() => setHover(n.name)}
                onMouseLeave={() => setHover(null)}
                onClick={(ev) => {
                  ev.stopPropagation();
                  onSelect(n.name);
                }}
              >
                <g
                  className="animate-fade-up"
                  style={{ animationDelay: `${Math.min(i, 40) * 15}ms` }}
                >
                  {isSel ? (
                    <circle r={n.r + 6} fill="none" stroke="var(--primary)" strokeWidth="2" />
                  ) : null}
                  <circle r={n.r} fill={meta.color} stroke="var(--card)" strokeWidth="2.5" />
                  {showLabel ? (
                    <text
                      y={n.r + 13}
                      textAnchor="middle"
                      fontSize="11"
                      fontWeight={isSel ? 700 : 500}
                      fill="var(--foreground)"
                      stroke="var(--card)"
                      strokeWidth="3"
                      paintOrder="stroke"
                    >
                      {truncate(prettyName(n.name), 22)}
                    </text>
                  ) : null}
                  <title>{`${prettyName(n.name)} (${prettyType(n.type)})`}</title>
                </g>
              </g>
            );
          })}
        </svg>
      </div>
      {sel ? (
        <div className="animate-fade-up rounded-2xl border border-primary/30 bg-card p-4 shadow-md">
          <EntityHeader entity={sel} />
          {sel.description ? (
            <p className="mt-2 text-sm leading-relaxed text-foreground/80">{sel.description}</p>
          ) : null}
          <p className="mt-3 text-xs font-semibold text-muted-foreground">
            {selEdges.length} connection{selEdges.length === 1 ? "" : "s"} in view
          </p>
          <button
            onClick={onOpen}
            className="group mt-3 flex items-center gap-1.5 text-sm font-semibold text-primary"
          >
            See all connections
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </button>
        </div>
      ) : null}
    </div>
  );
}

function Connections({
  data,
  selected,
  onSelect,
}: {
  data: Insights;
  selected: string | null;
  onSelect: (name: string) => void;
}) {
  const [query, setQuery] = useState("");
  const current = data.entities.find((e) => e.name === selected) ?? data.entities[0]!;
  const links = data.relationships.filter(
    (r) => r.source === current.name || r.target === current.name,
  );
  const matches = query
    ? data.entities
        .filter((e) => e.name.toLowerCase().includes(query.trim().toLowerCase()))
        .slice(0, 8)
    : [];
  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find an entity…"
          aria-label="Find an entity"
          className="w-full rounded-xl border border-input bg-card py-2.5 pl-10 pr-4 text-sm outline-none transition-colors focus:border-primary"
        />
        {matches.length ? (
          <ul className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-border bg-popover shadow-lg">
            {matches.map((m) => (
              <li key={m.name}>
                <button
                  onClick={() => {
                    onSelect(m.name);
                    setQuery("");
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-secondary"
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: categoryMeta(m.type).color }}
                  />
                  {prettyName(m.name)}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <div className="rounded-2xl border border-border bg-card p-4">
        <EntityHeader entity={current} />
        {current.description ? (
          <p className="mt-2 text-sm leading-relaxed text-foreground/80">{current.description}</p>
        ) : null}
      </div>
      <ul className="space-y-2">
        {links.map((r, i) => {
          const other = r.source === current.name ? r.target : r.source;
          const otherEntity = data.entities.find((e) => e.name === other);
          return (
            <li
              key={`${r.source}-${r.target}`}
              className="animate-fade-up"
              style={{ animationDelay: `${Math.min(i, 12) * 35}ms` }}
            >
              <button
                onClick={() => onSelect(other)}
                className="group w-full rounded-2xl border border-border bg-card p-3.5 text-left transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
              >
                <p className="flex items-center gap-2 text-sm font-semibold text-ink-deep">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: categoryMeta(otherEntity?.type ?? "").color }}
                  />
                  {prettyName(other)}
                  <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
                </p>
                {r.description ? (
                  <p className="mt-1 text-sm text-muted-foreground">{r.description}</p>
                ) : null}
              </button>
            </li>
          );
        })}
        {!links.length ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No connections recorded.</p>
        ) : null}
      </ul>
    </div>
  );
}

function Relationships({ data }: { data: Insights }) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const rows = data.relationships.filter(
    (r) => !q || `${r.source} ${r.target} ${r.description}`.toLowerCase().includes(q),
  );
  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter relationships…"
          aria-label="Filter relationships"
          className="w-full rounded-xl border border-input bg-card py-2.5 pl-10 pr-4 text-sm outline-none transition-colors focus:border-primary"
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {rows.length} of {data.relationships.length} relationships
      </p>
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-secondary/70 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-semibold">From</th>
              <th className="px-4 py-2.5 font-semibold">To</th>
              <th className="hidden px-4 py-2.5 font-semibold sm:table-cell">Relationship</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 200).map((r) => (
              <tr
                key={`${r.source}-${r.target}`}
                className="border-t border-border/70 transition-colors hover:bg-secondary/40"
              >
                <td className="px-4 py-2.5 font-medium text-ink-deep">{prettyName(r.source)}</td>
                <td className="px-4 py-2.5 font-medium text-ink-deep">{prettyName(r.target)}</td>
                <td className="hidden px-4 py-2.5 text-muted-foreground sm:table-cell">
                  {r.description}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EntityHeader({ entity }: { entity: Entity }) {
  const meta = categoryMeta(entity.type);
  return (
    <div className="flex items-center gap-3">
      <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${meta.soft}`}>
        <meta.icon className="h-5 w-5" />
      </span>
      <div>
        <p className="font-semibold text-ink-deep">{prettyName(entity.name)}</p>
        <p className="text-xs text-muted-foreground">
          {prettyType(entity.type)} · {entity.degree} connection{entity.degree === 1 ? "" : "s"}
        </p>
      </div>
    </div>
  );
}

function truncate(s: string, n: number) {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}
