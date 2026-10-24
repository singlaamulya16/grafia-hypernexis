import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  MessageSquare,
  RotateCcw,
  Search,
  Sparkles,
  Square,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { WorkspaceShell } from "@/components/workspace-shell";
import { CountUp, FitScale, Skeleton } from "@/components/motion";
import { FileBadge, extKind, type FileKind } from "@/components/file-badge";
import {
  MapIllustration,
  RelationIllustration,
  ResourcesIllustration,
  VisualiseIllustration,
} from "@/components/extract/illustrations";
import { MapPanel, countByCategory, type MapTab } from "@/components/extract/map-panel";
import { VisualisePanel, type VisualiseTab } from "@/components/extract/visualise-panel";
import { RelationPanel, type RelationTab } from "@/components/extract/relation-panel";
import {
  RESOURCE_KINDS,
  ResourcesPanel,
  type ResourceKind,
} from "@/components/extract/resources-panel";
import { api, type Insights, type IndexStatus, type ServerDocument } from "@/lib/api";

type Panel = "map" | "visualise" | "relation" | "resources";

type ExtractSearch = { panel?: Panel | undefined; tab?: string | undefined };

const PANELS: Panel[] = ["map", "visualise", "relation", "resources"];

export const Route = createFileRoute("/extract")({
  validateSearch: (search: Record<string, unknown>): ExtractSearch => ({
    panel: PANELS.includes(search["panel"] as Panel) ? (search["panel"] as Panel) : undefined,
    tab: typeof search["tab"] === "string" ? search["tab"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "DocuDetect — Extract Information" },
      {
        name: "description",
        content:
          "Map key information, visualise insights, explore relationships and find related resources from your documents.",
      },
      { property: "og:title", content: "DocuDetect — Extract Information" },
      { property: "og:type", content: "website" },
    ],
  }),
  component: ExtractPage,
});

const STAGE_LABELS: Record<string, string> = {
  starting: "Starting",
  chunking: "Reading & chunking documents",
  entities: "Extracting entities & relationships",
  communities: "Detecting themes",
  reports: "Writing theme summaries",
  embeddings: "Indexing for search",
};

const PANEL_INFO: Record<
  Panel,
  { title: string; description: string; tabs: { id: string; label: string }[] }
> = {
  map: {
    title: "Map the Info",
    description: "A structured summary of the key information in your documents.",
    tabs: [
      { id: "summary", label: "Summarise" },
      { id: "entities", label: "Extract Entities" },
      { id: "facts", label: "Find Key Facts" },
    ],
  },
  visualise: {
    title: "Visualise",
    description: "Charts, timelines and visual insights drawn from your documents.",
    tabs: [
      { id: "charts", label: "Charts" },
      { id: "timelines", label: "Timelines" },
      { id: "trends", label: "Trends" },
      { id: "comparisons", label: "Comparisons" },
    ],
  },
  relation: {
    title: "Relation Diagram",
    description: "How people, organisations, events and topics are connected.",
    tabs: [
      { id: "graph", label: "Knowledge Graph" },
      { id: "connections", label: "Connections" },
      { id: "relationships", label: "Relationships" },
    ],
  },
  resources: {
    title: "Find All Resources",
    description: "Search trusted sources for more on your case's key topics.",
    tabs: RESOURCE_KINDS.map((k) => ({ id: k.id, label: k.label })),
  },
};

function ExtractPage() {
  const { panel, tab } = Route.useSearch();
  const navigate = useNavigate({ from: "/extract" });
  const [docs, setDocs] = useState<ServerDocument[]>([]);
  const [job, setJob] = useState<IndexStatus | null>(null);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [notReady, setNotReady] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [d, j] = await Promise.all([api.documents(), api.indexStatus()]);
      setDocs(d);
      setJob(j);
      if (j.state === "running") {
        setInsights(null);
      } else {
        const ins = await api.insights();
        setInsights(ins.ready ? ins : null);
        setNotReady(ins.ready ? null : ins.reason);
      }
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const running = job?.state === "running";
  useEffect(() => {
    if (!running) return;
    const id = setInterval(async () => {
      try {
        const next = await api.indexStatus();
        setJob(next);
        if (next.state !== "running") void refresh();
      } catch (err) {
        setError((err as Error).message);
      }
    }, 1500);
    return () => clearInterval(id);
  }, [running, refresh]);

  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
      await refresh();
    }
  }

  const open = (p: Panel, t?: string) => navigate({ search: { panel: p, tab: t } });
  const close = () => navigate({ search: {} });
  const counts = useMemo(() => (insights ? countByCategory(insights) : {}), [insights]);
  const ready = Boolean(insights && insights.entities.length) && !running;

  return (
    <WorkspaceShell active={1}>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:flex lg:h-full lg:flex-col lg:py-5">
        <div className="grid grid-cols-1 items-start gap-6 lg:shrink-0 lg:grid-cols-[1fr_auto] lg:items-center [&>*]:min-w-0">
          <div className="animate-fade-up pt-2">
            <h1 className="text-4xl font-extrabold tracking-tight text-ink-deep sm:text-6xl lg:text-4xl xl:text-5xl">
              Extract <span className="text-gradient-leaf">Information</span>
            </h1>
            <p className="mt-4 text-lg text-muted-foreground sm:text-xl lg:mt-1.5 lg:text-base">
              Choose how you want to explore the information from your documents.
            </p>
          </div>
          <FilesSummary docs={docs} />
        </div>

        <StatusBanner
          job={job}
          insights={insights}
          error={error}
          busy={busy}
          hasDocs={docs.length > 0}
          notReady={notReady}
          onStart={() => act(api.startIndex)}
          onCancel={() => act(api.cancelIndex)}
        />

        <section className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2 lg:mt-3 lg:min-h-0 lg:flex-1 lg:grid-cols-3 lg:grid-rows-[minmax(0,1fr)] [&>*]:min-w-0">
          <FeatureCard
            n={1}
            title="Map the Info"
            description="Get a structured summary of all key information from your documents."
            chips={PANEL_INFO.map.tabs}
            onOpen={(t) => open("map", t)}
            disabled={!ready}
            delay={0}
          >
            <MapIllustration counts={ready ? counts : {}} />
          </FeatureCard>
          <FeatureCard
            n={2}
            title="Visualise"
            description="Turn your information into clear charts, timelines and visual insights."
            chips={PANEL_INFO.visualise.tabs}
            onOpen={(t) => open("visualise", t)}
            disabled={!ready}
            delay={90}
          >
            <VisualiseIllustration />
          </FeatureCard>
          <FeatureCard
            n={3}
            title="Relation Diagram"
            description="See how people, organisations, events and topics are connected."
            chips={PANEL_INFO.relation.tabs}
            onOpen={(t) => open("relation", t)}
            disabled={!ready}
            delay={180}
          >
            <RelationIllustration />
          </FeatureCard>
        </section>

        <ResourcesCard disabled={!ready} onOpen={(t) => open("resources", t)} />

        <div className="mt-6 flex justify-center lg:hidden">
          <Link
            to="/chat"
            className="group flex items-center gap-2 rounded-full bg-card/80 px-5 py-2.5 text-sm font-semibold text-primary shadow-sm ring-1 ring-border backdrop-blur-md transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            <MessageSquare className="h-4 w-4" />
            Or ask your documents a question in Chat
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </main>

      <Sheet open={Boolean(panel && insights)} onOpenChange={(o) => (o ? null : close())}>
        <SheetContent
          side="right"
          className="theme-fresh w-full overflow-y-auto border-border bg-card p-6 text-foreground sm:max-w-3xl"
        >
          {panel && insights ? (
            <>
              <SheetHeader className="mb-4 text-left">
                <SheetTitle className="text-2xl font-bold text-ink-deep">
                  {PANEL_INFO[panel].title}
                </SheetTitle>
                <SheetDescription>{PANEL_INFO[panel].description}</SheetDescription>
              </SheetHeader>
              <PanelBody panel={panel} tab={tab} data={insights} onTab={(t) => open(panel, t)} />
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </WorkspaceShell>
  );
}

function PanelBody({
  panel,
  tab,
  data,
  onTab,
}: {
  panel: Panel;
  tab: string | undefined;
  data: Insights;
  onTab: (t: string) => void;
}) {
  const first = PANEL_INFO[panel].tabs[0]!.id;
  const current = PANEL_INFO[panel].tabs.some((t) => t.id === tab) ? tab! : first;
  if (panel === "map") return <MapPanel data={data} tab={current as MapTab} onTab={onTab} />;
  if (panel === "visualise")
    return <VisualisePanel data={data} tab={current as VisualiseTab} onTab={onTab} />;
  if (panel === "relation")
    return <RelationPanel data={data} tab={current as RelationTab} onTab={onTab} />;
  return <ResourcesPanel data={data} kind={current as ResourceKind} onKind={onTab} />;
}

function FilesSummary({ docs }: { docs: ServerDocument[] }) {
  const shown: FileKind[] = docs.slice(0, 4).map((d) => extKind(d.original ?? d.name));
  const extra = docs.length - shown.length;
  return (
    <aside
      className="glass-card animate-fade-up w-full p-5 lg:flex lg:w-auto lg:items-center lg:gap-4 lg:px-4 lg:py-3"
      style={{ animationDelay: "100ms" }}
    >
      <div className="flex items-center justify-between lg:shrink-0 lg:flex-col lg:items-start">
        <div className="flex items-center gap-3 lg:gap-2">
          <FileText className="h-7 w-7 text-primary lg:h-5 lg:w-5" strokeWidth={1.8} />
          <h2 className="text-lg font-bold text-ink-deep lg:text-base">Uploaded Files</h2>
        </div>
        <span className="text-sm text-muted-foreground lg:text-xs">
          <CountUp value={docs.length} duration={500} /> file{docs.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3 lg:mt-0 lg:flex-nowrap lg:gap-2">
        {shown.length ? (
          shown.map((k, i) => (
            <span
              key={i}
              className="animate-fade-up transition-transform hover:-translate-y-1"
              style={{ animationDelay: `${150 + i * 60}ms` }}
            >
              <FileBadge kind={k} size="sm" />
            </span>
          ))
        ) : (
          <span className="text-sm text-muted-foreground">No files uploaded yet.</span>
        )}
        {extra > 0 ? (
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary text-sm font-semibold text-muted-foreground">
            +{extra}
          </span>
        ) : null}
        <Link
          to="/get-started"
          className="group ml-auto flex items-center gap-2 whitespace-nowrap rounded-xl bg-secondary px-4 py-2.5 text-sm font-semibold text-ink-deep transition-colors hover:bg-accent lg:ml-2"
        >
          View Files
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </Link>
      </div>
    </aside>
  );
}

function StatusBanner({
  job,
  insights,
  error,
  busy,
  hasDocs,
  notReady,
  onStart,
  onCancel,
}: {
  job: IndexStatus | null;
  insights: Insights | null;
  error: string | null;
  busy: boolean;
  hasDocs: boolean;
  notReady: string | null;
  onStart: () => void;
  onCancel: () => void;
}) {
  if (error) {
    return (
      <Banner tone="error" icon={<AlertCircle className="h-5 w-5" />}>
        <span className="flex-1">{error}</span>
      </Banner>
    );
  }
  if (!job) {
    return (
      <div
        className="glass-card mt-6 flex items-center gap-4 px-5 py-4 lg:mt-3 lg:shrink-0"
        aria-label="Checking extraction status"
      >
        <Skeleton className="h-5 w-5 rounded-full" />
        <Skeleton className="h-4 w-44" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-28" />
      </div>
    );
  }
  if (job.state === "running") {
    const pct = Math.round(((job.done.length + 0.5) / job.stages.length) * 100);
    return (
      <section className="glass-card animate-fade-up mt-6 p-5 lg:mt-3 lg:shrink-0 lg:p-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-status-blue/10 text-status-blue">
            <Loader2 className="h-5 w-5 animate-spin" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-ink-deep">
              {STAGE_LABELS[job.current ?? "starting"] ?? "Extracting"}…
            </p>
            <p className="text-sm text-muted-foreground">
              Extracting information from your documents · {Math.round(job.elapsed_s)} s
            </p>
          </div>
          <button
            onClick={onCancel}
            disabled={busy}
            className="flex items-center gap-2 rounded-xl bg-secondary px-4 py-2 text-sm font-semibold transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
          >
            <Square className="h-4 w-4" /> Cancel
          </button>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-secondary lg:mt-3">
          <div
            className="relative h-full overflow-hidden rounded-full bg-gradient-to-r from-leaf-mid to-primary transition-all duration-700"
            style={{ width: `${pct}%` }}
          >
            <span className="absolute inset-0 animate-shimmer opacity-30" />
          </div>
        </div>
        <ol className="mt-4 grid gap-2 sm:grid-cols-5 lg:mt-3">
          {job.stages.map((s) => {
            const done = job.done.includes(s);
            const current = job.current === s;
            return (
              <li key={s} className="flex items-center gap-2 text-xs">
                {done ? (
                  <CheckCircle2 className="animate-pop h-4 w-4 shrink-0 fill-status-green text-card" />
                ) : current ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-status-blue" />
                ) : (
                  <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                <span className={done || current ? "text-foreground" : "text-muted-foreground"}>
                  {STAGE_LABELS[s] ?? s}
                </span>
              </li>
            );
          })}
        </ol>
      </section>
    );
  }
  if (job.state === "failed" || job.state === "cancelled") {
    return (
      <Banner tone="error" icon={<AlertCircle className="h-5 w-5" />}>
        <span className="flex-1">
          {job.state === "failed"
            ? (job.error ?? "Extraction failed.")
            : "The last extraction was cancelled."}
        </span>
        <ActionButton
          onClick={onStart}
          disabled={busy || !hasDocs}
          icon={<RotateCcw className="h-4 w-4" />}
        >
          Try again
        </ActionButton>
      </Banner>
    );
  }
  if (!insights || !insights.entities.length) {
    return (
      <Banner tone="info" icon={<Sparkles className="h-5 w-5" />}>
        <span className="flex-1">
          {hasDocs
            ? (notReady ?? "Run the extraction to unlock the tools below.")
            : "Upload documents first, then run the extraction."}
        </span>
        {hasDocs ? (
          <ActionButton onClick={onStart} disabled={busy} icon={<Sparkles className="h-4 w-4" />}>
            Start extraction
          </ActionButton>
        ) : (
          <Link
            to="/get-started"
            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Upload files
          </Link>
        )}
      </Banner>
    );
  }
  const s = insights.stats;
  return (
    <section className="glass-card animate-fade-up mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4 lg:mt-3 lg:shrink-0 lg:py-2.5">
      <span className="flex items-center gap-2 font-semibold text-status-green">
        <span className="relative flex">
          <span className="animate-pulse-ring absolute inset-0 rounded-full" />
          <CheckCircle2 className="animate-pop h-5 w-5 fill-status-green text-card" />
        </span>
        Extraction complete
      </span>
      {[
        ["documents", s.docs],
        ["entities", s.entities],
        ["relationships", s.relationships],
        ["themes", s.communities],
      ].map(([label, value]) => (
        <span key={label} className="text-sm text-muted-foreground">
          <span className="font-bold text-ink-deep">
            <CountUp value={Number(value)} />
          </span>{" "}
          {label}
        </span>
      ))}
      <Link
        to="/chat"
        className="group ml-auto hidden items-center gap-1.5 rounded-xl bg-secondary px-3.5 py-2 text-sm font-semibold text-primary transition-colors hover:bg-accent lg:flex"
      >
        <MessageSquare className="h-4 w-4" />
        Ask in Chat
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
      </Link>
    </section>
  );
}

function Banner({
  tone,
  icon,
  children,
}: {
  tone: "error" | "info";
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      className={`animate-fade-up mt-6 flex flex-wrap items-center gap-3 rounded-3xl border px-5 py-4 text-sm shadow-sm backdrop-blur-md lg:mt-3 lg:shrink-0 lg:py-2.5 ${
        tone === "error"
          ? "border-destructive/30 bg-destructive/10 text-destructive"
          : "border-primary/20 bg-card/85 text-foreground"
      }`}
    >
      {icon}
      {children}
    </section>
  );
}

function ActionButton({
  onClick,
  disabled,
  icon,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="btn-sheen flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-leaf transition-transform hover:-translate-y-0.5 disabled:opacity-50"
    >
      {icon}
      {children}
    </button>
  );
}

function FeatureCard({
  n,
  title,
  description,
  chips,
  onOpen,
  disabled,
  delay,
  children,
}: {
  n: number;
  title: string;
  description: string;
  chips: { id: string; label: string }[];
  onOpen: (tab?: string) => void;
  disabled: boolean;
  delay: number;
  children: ReactNode;
}) {
  return (
    <article
      className={`glass-card group animate-fade-up relative flex flex-col p-5 sm:p-6 lg:min-h-0 lg:p-5 ${
        disabled ? "opacity-70" : "lift-card cursor-pointer"
      }`}
      style={{ animationDelay: `${delay}ms` }}
      onClick={() => !disabled && onOpen()}
    >
      <div className="flex items-start gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-secondary text-xl font-bold text-primary transition-colors duration-300 group-hover:bg-primary group-hover:text-primary-foreground">
          {n}
        </span>
        <h2 className="mt-1.5 flex-1 text-2xl font-bold tracking-tight text-ink-deep lg:text-xl xl:text-2xl">
          {title}
        </h2>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpen();
          }}
          disabled={disabled}
          aria-label={`Open ${title}`}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-leaf transition-transform duration-300 group-hover:scale-110 disabled:opacity-50"
        >
          <ArrowRight className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-0.5" />
        </button>
      </div>
      <p className="mt-3 text-base leading-relaxed text-muted-foreground lg:mt-2 lg:text-sm">
        {description}
      </p>
      <FitScale baseHeight={240} className="my-5 h-60 lg:my-3 lg:h-auto lg:flex-1">
        {children}
      </FitScale>
      <div className="flex flex-wrap gap-2">
        {chips.map((c) => (
          <button
            key={c.id}
            onClick={(e) => {
              e.stopPropagation();
              onOpen(c.id);
            }}
            disabled={disabled}
            className="rounded-full bg-secondary px-3.5 py-1.5 text-[13px] font-medium text-ink-deep transition-all hover:-translate-y-0.5 hover:bg-primary hover:text-primary-foreground disabled:hover:translate-y-0 disabled:hover:bg-secondary disabled:hover:text-ink-deep"
          >
            {c.label}
          </button>
        ))}
      </div>
    </article>
  );
}

function ResourcesCard({
  disabled,
  onOpen,
}: {
  disabled: boolean;
  onOpen: (tab?: string) => void;
}) {
  return (
    <section
      className={`glass-card group animate-fade-up mt-5 grid items-center gap-6 p-5 sm:p-6 lg:mt-3 lg:shrink-0 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:gap-5 lg:py-3.5 ${
        disabled ? "opacity-70" : "lift-card"
      }`}
      style={{ animationDelay: "270ms" }}
    >
      <div className="flex items-center gap-5 lg:gap-3.5">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-leaf transition-transform duration-300 group-hover:rotate-[-8deg] group-hover:scale-105 lg:h-11 lg:w-11 lg:rounded-xl">
          <Search className="h-8 w-8 lg:h-5 lg:w-5" strokeWidth={2.4} />
        </span>
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-ink-deep lg:text-lg">
            Find All Resources
          </h2>
          <p className="mt-1 text-muted-foreground lg:mt-0 lg:max-w-xs lg:text-xs">
            Search and discover additional reliable sources related to your documents.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 lg:justify-center">
        {RESOURCE_KINDS.map((k, i) => (
          <button
            key={k.id}
            onClick={() => onOpen(k.id)}
            disabled={disabled}
            className="animate-fade-up flex items-center gap-1.5 rounded-full bg-secondary px-4 py-2 text-sm font-medium text-ink-deep transition-all hover:-translate-y-0.5 hover:bg-primary hover:text-primary-foreground disabled:hover:translate-y-0 disabled:hover:bg-secondary disabled:hover:text-ink-deep lg:px-3 lg:py-1.5 lg:text-xs"
            style={{ animationDelay: `${320 + i * 50}ms` }}
          >
            <k.icon className="h-3.5 w-3.5" />
            {k.label}
          </button>
        ))}
      </div>
      <div className="hidden justify-center md:flex lg:hidden">
        <ResourcesIllustration />
      </div>
      <button
        onClick={() => onOpen()}
        disabled={disabled}
        className="btn-sheen group/btn flex items-center justify-center gap-3 whitespace-nowrap rounded-2xl bg-primary px-8 py-5 text-lg font-semibold text-primary-foreground shadow-leaf transition-all duration-300 hover:-translate-y-0.5 hover:bg-leaf-deep disabled:opacity-50 disabled:hover:translate-y-0 lg:rounded-xl lg:px-5 lg:py-3 lg:text-sm"
      >
        Find All Resources
        <ArrowRight className="h-5 w-5 transition-transform group-hover/btn:translate-x-1 lg:h-4 lg:w-4" />
      </button>
    </section>
  );
}
