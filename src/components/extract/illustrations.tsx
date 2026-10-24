import type { ReactNode } from "react";
import { ArrowRight, FileText, Globe, Link2 } from "lucide-react";
import { CATEGORIES, type Category } from "@/components/extract/entity-types";
import { CountUp } from "@/components/motion";

/** Documents flowing into a "Key Information" list, with live counts per category. */
export function MapIllustration({ counts }: { counts: Partial<Record<Category, number>> }) {
  return (
    <div className="relative flex h-60 items-center gap-2">
      <div className="relative hidden h-48 w-28 shrink-0 sm:block">
        <DocSheet className="left-6 top-0 rotate-6" delay="0.2s">
          <span className="h-6 w-6 rounded-md bg-badge-purple/80" />
        </DocSheet>
        <DocSheet className="left-0 top-8 -rotate-12" delay="0s">
          <span className="rounded-md bg-badge-red px-1.5 py-1 text-[9px] font-bold text-primary-foreground">
            PDF
          </span>
        </DocSheet>
        <DocSheet className="left-7 top-20 rotate-0" delay="0.5s">
          <span className="rounded-md bg-badge-blue px-1.5 py-1 text-[9px] font-bold text-primary-foreground">
            DOC
          </span>
        </DocSheet>
      </div>
      <ArrowRight
        className="hidden h-7 w-7 shrink-0 text-leaf-mid transition-transform sm:block duration-500 group-hover:translate-x-1.5"
        strokeWidth={3}
      />
      <div className="min-w-0 flex-1 rounded-2xl border border-border bg-card p-3 shadow-md transition-shadow duration-300 group-hover:shadow-lg">
        <p className="px-1 pb-2 text-xs font-semibold text-ink-deep">Key Information</p>
        <ul className="space-y-1.5">
          {CATEGORIES.map((c, i) => (
            <li
              key={c.id}
              className="flex items-center gap-2 rounded-lg bg-secondary/60 px-2 py-1.5 text-[11px] text-foreground transition-all duration-300 group-hover:translate-x-0.5"
              style={{ transitionDelay: `${i * 40}ms` }}
            >
              <c.icon className="h-3.5 w-3.5 shrink-0 text-ink-deep" />
              <span className="truncate">{c.label === "Dates & Events" ? "Dates" : c.label}</span>
              {counts[c.id] != null ? (
                <span className="ml-auto rounded-md bg-card px-1.5 text-[10px] font-semibold text-primary">
                  <CountUp value={counts[c.id] ?? 0} />
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function DocSheet({
  className,
  delay,
  children,
}: {
  className: string;
  delay: string;
  children: ReactNode;
}) {
  return (
    <div className={`absolute ${className}`}>
      <div
        className="animate-float flex h-28 w-20 flex-col gap-1.5 rounded-xl bg-card p-2.5 shadow-lg ring-1 ring-border/60"
        style={{ animationDelay: delay }}
      >
        {children}
        <span className="mt-auto h-1 w-full rounded-full bg-muted-foreground/20" />
        <span className="h-1 w-3/4 rounded-full bg-muted-foreground/20" />
        <span className="h-1 w-full rounded-full bg-muted-foreground/20" />
      </div>
    </div>
  );
}

/** A small dashboard: area chart, donut, growing bars and a timeline. */
export function VisualiseIllustration() {
  const bars = [30, 52, 64, 78];
  return (
    <div className="h-60 overflow-hidden rounded-2xl border border-border bg-card shadow-md transition-shadow duration-300 group-hover:shadow-lg">
      <div className="flex h-6 items-center gap-1.5 bg-primary px-3">
        {[0, 1, 2].map((i) => (
          <span key={i} className="h-1.5 w-1.5 rounded-full bg-primary-foreground/80" />
        ))}
      </div>
      <div className="grid grid-cols-[1.4fr_1fr] gap-2.5 p-2.5">
        <div className="rounded-xl bg-secondary/50 p-2">
          <span className="block h-1.5 w-10 rounded-full bg-muted-foreground/30" />
          <svg viewBox="0 0 140 64" className="mt-1 h-20 w-full" aria-hidden="true">
            <path
              d="M4 58 L28 44 L50 48 L74 32 L98 36 L124 12 L136 6 L136 64 L4 64 Z"
              fill="var(--leaf-mid)"
              opacity="0.15"
            />
            <path
              d="M4 58 L28 44 L50 48 L74 32 L98 36 L124 12 L136 6"
              fill="none"
              stroke="var(--primary)"
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeDasharray="300"
              className="animate-draw"
            />
            {[
              [28, 44],
              [74, 32],
              [124, 12],
            ].map(([x, y]) => (
              <circle
                key={x}
                cx={x}
                cy={y}
                r="3"
                fill="var(--card)"
                stroke="var(--primary)"
                strokeWidth="2"
              />
            ))}
          </svg>
        </div>
        <div className="flex items-center justify-center rounded-xl bg-secondary/50">
          <svg
            viewBox="0 0 42 42"
            className="h-20 w-20 -rotate-90 transition-transform duration-700 group-hover:rotate-[0deg]"
            aria-hidden="true"
          >
            <circle
              cx="21"
              cy="21"
              r="15.9"
              fill="none"
              stroke="var(--leaf-soft)"
              strokeWidth="7"
            />
            <circle
              cx="21"
              cy="21"
              r="15.9"
              fill="none"
              stroke="var(--primary)"
              strokeWidth="7"
              strokeDasharray="62 38"
            />
            <circle
              cx="21"
              cy="21"
              r="15.9"
              fill="none"
              stroke="var(--leaf-mid)"
              strokeWidth="7"
              strokeDasharray="20 80"
              strokeDashoffset="-62"
            />
          </svg>
        </div>
        <div className="flex h-20 items-end gap-2 rounded-xl bg-secondary/50 px-3 pb-2">
          {bars.map((h, i) => (
            <span
              key={i}
              className="animate-grow-up w-4 rounded-t-md bg-primary transition-all duration-500 group-hover:bg-leaf-mid"
              style={{ height: `${h}%`, animationDelay: `${200 + i * 120}ms` }}
            />
          ))}
        </div>
        <div className="flex h-20 items-center rounded-xl bg-secondary/50 px-2">
          <svg viewBox="0 0 100 30" className="w-full" aria-hidden="true">
            <path d="M6 15 H94" stroke="var(--leaf-soft)" strokeWidth="2" />
            <path
              d="M6 15 H94"
              stroke="var(--primary)"
              strokeWidth="2"
              strokeDasharray="88"
              className="animate-draw"
              style={{ ["--len" as string]: 88 }}
            />
            {[6, 28, 56, 94].map((x, i) => (
              <circle
                key={x}
                cx={x}
                cy="15"
                r={i === 2 ? 5 : 3.5}
                fill={i === 2 ? "var(--leaf-deep)" : "var(--primary)"}
              />
            ))}
          </svg>
        </div>
      </div>
    </div>
  );
}

const SATELLITES: { id: Category; label: string; x: number; y: number }[] = [
  { id: "people", label: "Person", x: 18, y: 14 },
  { id: "organisations", label: "Organisation", x: 82, y: 14 },
  { id: "locations", label: "Location", x: 88, y: 56 },
  { id: "dates", label: "Date", x: 12, y: 66 },
  { id: "topics", label: "Topic", x: 70, y: 88 },
];

/** A document hub linked to entity kinds, with flowing connection lines. */
export function RelationIllustration() {
  return (
    <div className="relative h-60">
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        {SATELLITES.map((s) => (
          <line
            key={s.id}
            x1="50"
            y1="50"
            x2={s.x}
            y2={s.y}
            stroke="var(--leaf-mid)"
            strokeWidth="0.7"
            strokeDasharray="3 3"
            className="animate-dash"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {[
          [32, 28],
          [66, 30],
          [74, 52],
          [30, 60],
          [60, 72],
          [44, 84],
        ].map(([x, y]) => (
          <circle
            key={`${x}-${y}`}
            cx={x}
            cy={y}
            r="1.6"
            fill="var(--card)"
            stroke="var(--leaf-mid)"
            strokeWidth="0.8"
          />
        ))}
      </svg>
      <div className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-leaf transition-transform duration-500 group-hover:scale-110">
        <span className="absolute inset-0 animate-pulse-ring rounded-full" />
        <FileText className="h-7 w-7" />
      </div>
      {SATELLITES.map((s, i) => {
        const meta = CATEGORIES.find((c) => c.id === s.id)!;
        return (
          <div
            key={s.id}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${s.x}%`, top: `${s.y}%` }}
          >
            <div
              className="animate-float flex items-center gap-1.5 rounded-xl bg-card py-1 pl-1 pr-2.5 shadow-md ring-1 ring-border/60 transition-transform duration-300 group-hover:scale-105"
              style={{ animationDelay: `${i * 0.35}s` }}
            >
              <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${meta.soft}`}>
                <meta.icon className="h-4 w-4" />
              </span>
              <span className="text-[11px] font-medium text-ink-deep">{s.label}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** A browser window of search results under a magnifying glass. */
export function ResourcesIllustration() {
  return (
    <div className="relative h-36 w-72">
      <div className="absolute left-0 top-2 w-60 overflow-hidden rounded-2xl border border-border bg-card shadow-md">
        <div className="flex h-5 items-center gap-1 bg-primary px-2.5">
          {[0, 1, 2].map((i) => (
            <span key={i} className="h-1.5 w-1.5 rounded-full bg-primary-foreground/80" />
          ))}
        </div>
        <div className="space-y-2.5 p-3">
          {[Globe, Link2].map((Icon, i) => (
            <div key={i} className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-secondary text-primary">
                <Icon className="h-4 w-4" />
              </span>
              <span className="flex flex-1 flex-col gap-1">
                <span className="h-1.5 w-24 rounded-full bg-muted-foreground/30" />
                <span className="h-1.5 w-16 rounded-full bg-muted-foreground/20" />
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="absolute right-2 top-0 transition-transform duration-500 group-hover:-translate-x-6 group-hover:-rotate-12">
        <svg viewBox="0 0 80 80" className="h-28 w-28 drop-shadow-lg" aria-hidden="true">
          <circle
            cx="32"
            cy="32"
            r="22"
            fill="var(--card)"
            fillOpacity="0.35"
            stroke="var(--leaf-deep)"
            strokeWidth="6"
          />
          <path
            d="M48 48 L70 70"
            stroke="var(--leaf-deep)"
            strokeWidth="10"
            strokeLinecap="round"
          />
          <path
            d="M22 22 a14 14 0 0 1 12 -4"
            stroke="var(--card)"
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
          />
        </svg>
      </div>
    </div>
  );
}
