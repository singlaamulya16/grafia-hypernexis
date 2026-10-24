import { useMemo, type ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Insights } from "@/lib/api";
import {
  categoryMeta,
  categoryOf,
  prettyName,
  prettyType,
} from "@/components/extract/entity-types";
import { EmptyState, PanelTabs } from "@/components/extract/panel-kit";
import { CountUp } from "@/components/motion";

export type VisualiseTab = "charts" | "timelines" | "trends" | "comparisons";

const SERIES = [
  "var(--primary)",
  "var(--badge-blue)",
  "var(--badge-orange)",
  "var(--badge-purple)",
  "var(--leaf-mid)",
  "var(--badge-red)",
  "var(--leaf-deep)",
];

const tooltipStyle = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  fontSize: 12,
  color: "var(--foreground)",
};

export function VisualisePanel({
  data,
  tab,
  onTab,
}: {
  data: Insights;
  tab: VisualiseTab;
  onTab: (t: VisualiseTab) => void;
}) {
  if (!data.entities.length) return <EmptyState />;
  return (
    <PanelTabs
      value={tab}
      onChange={onTab}
      tabs={[
        { id: "charts", label: "Charts", content: <Charts data={data} /> },
        { id: "timelines", label: "Timelines", content: <Timeline data={data} /> },
        { id: "trends", label: "Trends", content: <Trends data={data} /> },
        { id: "comparisons", label: "Comparisons", content: <Comparisons data={data} /> },
      ]}
    />
  );
}

function ChartCard({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4 transition-shadow hover:shadow-md">
      <h3 className="text-sm font-semibold text-ink-deep">{title}</h3>
      {note ? <p className="mt-0.5 text-xs text-muted-foreground">{note}</p> : null}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Charts({ data }: { data: Insights }) {
  const types = Object.entries(data.type_counts).map(([type, count], i) => ({
    type: prettyType(type),
    count,
    fill: SERIES[i % SERIES.length],
  }));
  const themes = data.communities
    .filter((c) => c.size > 0)
    .map((c) => ({ name: c.title, value: c.size }));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Documents", data.stats.docs],
          ["Entities", data.stats.entities],
          ["Relationships", data.stats.relationships],
          ["Themes", data.stats.communities],
        ].map(([label, value], i) => (
          <div
            key={label}
            className="animate-fade-up rounded-2xl bg-gradient-to-br from-secondary to-card p-4 ring-1 ring-border"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <p className="text-2xl font-bold text-primary">
              <CountUp value={Number(value)} />
            </p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>
      <ChartCard title="Entities by type" note="What kinds of things your documents talk about">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={types} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="type"
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--secondary)" }} />
            <Bar dataKey="count" name="Entities" radius={[8, 8, 0, 0]} animationDuration={900}>
              {types.map((t) => (
                <Cell key={t.type} fill={t.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
      {themes.length ? (
        <ChartCard title="Share of entities per theme">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={themes}
                dataKey="value"
                nameKey="name"
                innerRadius={62}
                outerRadius={96}
                paddingAngle={3}
                animationDuration={900}
              >
                {themes.map((t, i) => (
                  <Cell
                    key={t.name}
                    fill={SERIES[i % SERIES.length]}
                    stroke="var(--card)"
                    strokeWidth={2}
                  />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      ) : null}
    </div>
  );
}

const YEAR = /\b(1[89]\d{2}|20\d{2})\b/;

function Timeline({ data }: { data: Insights }) {
  const items = useMemo(() => {
    const dated = data.entities
      .map((e) => {
        const year = (e.name.match(YEAR) ?? e.description.match(YEAR))?.[1];
        return { ...e, year: year ? Number(year) : null };
      })
      .filter((e) => categoryOf(e.type) === "dates" || e.year != null);
    return dated.sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999));
  }, [data]);
  if (!items.length) return <EmptyState text="No dated events were found in your documents." />;
  return (
    <ol className="relative ml-3 border-l-2 border-leaf-soft pl-6">
      {items.map((e, i) => {
        const meta = categoryMeta(e.type);
        return (
          <li
            key={e.name}
            className="animate-fade-up relative pb-6 last:pb-0"
            style={{ animationDelay: `${Math.min(i, 14) * 50}ms` }}
          >
            <span className="absolute -left-[2.15rem] top-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-card ring-2 ring-primary">
              <span className="h-2.5 w-2.5 rounded-full bg-primary" />
            </span>
            <p className="text-xs font-bold uppercase tracking-wide text-primary">
              {e.year ?? "Undated"}
            </p>
            <div className="mt-1 rounded-2xl border border-border bg-card p-3.5 transition-all hover:-translate-y-0.5 hover:shadow-md">
              <p className="flex items-center gap-2 font-semibold text-ink-deep">
                <meta.icon className="h-4 w-4 text-muted-foreground" />
                {prettyName(e.name)}
              </p>
              {e.description ? (
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {e.description}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function Trends({ data }: { data: Insights }) {
  const top = data.entities.slice(0, 12).map((e) => ({
    name: prettyName(e.name),
    connections: e.degree,
    fill: categoryMeta(e.type).color,
  }));
  return (
    <ChartCard
      title="Most connected entities"
      note="The people, organisations and topics that link to the most others"
    >
      <ResponsiveContainer width="100%" height={Math.max(260, top.length * 34)}>
        <BarChart data={top} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
          <CartesianGrid horizontal={false} stroke="var(--border)" />
          <XAxis
            type="number"
            allowDecimals={false}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={170}
            tick={{ fontSize: 11, fill: "var(--foreground)" }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--secondary)" }} />
          <Bar
            dataKey="connections"
            name="Connections"
            radius={[0, 8, 8, 0]}
            animationDuration={900}
          >
            {top.map((t) => (
              <Cell key={t.name} fill={t.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

function Comparisons({ data }: { data: Insights }) {
  const rows = useMemo(() => {
    const byName = new Map(data.entities.map((e) => [e.name, e.community]));
    return data.communities.map((c) => {
      const members = data.entities.filter((e) => e.community === c.id);
      const links = data.relationships.filter(
        (r) => byName.get(r.source) === c.id && byName.get(r.target) === c.id,
      ).length;
      const people = members.filter((e) => categoryOf(e.type) === "people").length;
      const orgs = members.filter((e) => categoryOf(e.type) === "organisations").length;
      return {
        name: c.title.length > 28 ? `${c.title.slice(0, 26)}…` : c.title,
        Entities: members.length,
        Relationships: links,
        People: people,
        Organisations: orgs,
      };
    });
  }, [data]);
  if (!rows.length) return <EmptyState text="No themes were detected to compare." />;
  return (
    <ChartCard title="Themes compared" note="How large and how tightly connected each theme is">
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={rows} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--secondary)" }} />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
          {["Entities", "Relationships", "People", "Organisations"].map((k, i) => (
            <Bar
              key={k}
              dataKey={k}
              fill={SERIES[i]}
              radius={[6, 6, 0, 0]}
              animationDuration={900}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
