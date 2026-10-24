import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  FileText,
  Loader2,
  Network,
  Quote,
  Send,
  ShieldQuestion,
} from "lucide-react";
import { WorkspaceShell } from "@/components/workspace-shell";
import { RevealText, Skeleton } from "@/components/motion";
import { KnowledgeGraph } from "@/components/extract/relation-panel";
import { prettyName } from "@/components/extract/entity-types";
import { api, type AskMode, type AskResponse, type Health, type Insights } from "@/lib/api";

export const Route = createFileRoute("/chat")({
  head: () => ({
    meta: [
      { title: "DocuDetect — Ask Your Documents" },
      {
        name: "description",
        content: "Ask questions about your case files and get answers backed by verified quotes.",
      },
      { property: "og:title", content: "DocuDetect — Ask Your Documents" },
      { property: "og:type", content: "website" },
    ],
  }),
  component: ChatPage,
});

type Turn = { id: number; question: string; mode: AskMode; response?: AskResponse; error?: string };

const MODES: { value: AskMode; label: string; hint: string }[] = [
  { value: "auto", label: "Auto", hint: "Let the router pick" },
  { value: "global", label: "Themes", hint: "Big-picture questions" },
  { value: "local", label: "Facts", hint: "Specific facts and links" },
  { value: "hybrid", label: "Hybrid", hint: "Both, fused" },
];

const ROUTE_LABEL: Record<string, string> = {
  global: "Themes",
  local: "Facts",
  hybrid: "Hybrid",
  abstain: "Abstained",
  basic: "Basic search",
};

const SUGGESTIONS = [
  "What are the main themes across these documents?",
  "Who are the key people and organisations involved?",
  "How are the main topics connected?",
];

function ChatPage() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [question, setQuestion] = useState("");
  const [mode, setMode] = useState<AskMode>("auto");
  const [pending, setPending] = useState(false);
  const [health, setHealth] = useState<Health | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.health().then(setHealth, (err: Error) => setHealthError(err.message));
  }, []);

  // The graph on the right comes from the same index the answers use.
  useEffect(() => {
    if (!health || health.reason) return;
    api.insights().then(
      (ins) => setInsights(ins.ready ? ins : null),
      () => setInsights(null),
    );
  }, [health]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [turns]);

  // Questions are only sent once the index matches the uploaded files.
  const blocked = !health || Boolean(health.reason);

  async function ask(text: string) {
    const q = text.trim();
    if (!q || pending || blocked) return;
    const id = Date.now();
    setTurns((prev) => [...prev, { id, question: q, mode }]);
    setQuestion("");
    setPending(true);
    try {
      const response = await api.ask(q, mode);
      setTurns((prev) => prev.map((t) => (t.id === id ? { ...t, response } : t)));
      setActiveId(id);
      setSelectedNode(null);
    } catch (err) {
      setTurns((prev) =>
        prev.map((t) => (t.id === id ? { ...t, error: (err as Error).message } : t)),
      );
    } finally {
      setPending(false);
    }
  }

  const answered = turns.filter((t) => t.response);
  const activeTurn =
    turns.find((t) => t.id === activeId && t.response) ?? answered[answered.length - 1] ?? null;

  return (
    <WorkspaceShell active={4}>
      <main className="mx-auto grid max-w-[1500px] grid-cols-1 gap-6 px-4 py-6 sm:px-6 lg:h-full lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:grid-rows-[minmax(0,1fr)] lg:py-5 [&>*]:min-w-0">
        <section className="glass-card animate-fade-up flex flex-col p-5 sm:p-6 lg:min-h-0">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-ink-deep">
                5. Ask <span className="text-gradient-leaf">Your Documents</span>
              </h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Every answer is split into claims, each backed by a quote checked against your
                files.
              </p>
            </div>
            <Link
              to="/get-started"
              className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold shadow-sm transition-colors hover:bg-accent"
            >
              <ArrowLeft className="h-4 w-4 text-muted-foreground" />
              Documents
            </Link>
          </div>

          {healthError ? (
            <p className="mt-4 flex items-start gap-2.5 rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {healthError}
            </p>
          ) : health?.reason ? (
            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl bg-secondary px-4 py-3 text-sm">
              <AlertCircle className="h-4 w-4 shrink-0 text-primary" />
              <span className="flex-1">{health.reason}</span>
              <Link
                to={health.documents ? "/extract" : "/get-started"}
                className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5"
              >
                {health.documents ? "Go to Extract" : "Upload files"}
              </Link>
            </div>
          ) : health ? (
            <p className="mt-4 rounded-2xl bg-secondary px-4 py-3 text-sm">
              Answering from the {health.documents} document{health.documents === 1 ? "" : "s"} you
              uploaded.
            </p>
          ) : null}

          <div ref={scrollRef} className="mt-5 min-h-[16rem] flex-1 space-y-6 overflow-y-auto pr-1">
            {turns.length === 0 ? (
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => ask(s)}
                    disabled={blocked}
                    className="rounded-xl bg-secondary px-4 py-2.5 text-left text-sm font-medium transition-colors hover:bg-accent disabled:opacity-50 disabled:hover:bg-secondary"
                  >
                    {s}
                  </button>
                ))}
              </div>
            ) : (
              turns.map((t) => (
                <TurnView
                  key={t.id}
                  turn={t}
                  active={t.id === activeTurn?.id}
                  onSelect={() => {
                    setActiveId(t.id);
                    setSelectedNode(null);
                  }}
                />
              ))
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void ask(question);
            }}
            className="mt-4 border-t border-border pt-4"
          >
            <div
              className="mb-3 flex flex-wrap gap-2"
              role="radiogroup"
              aria-label="Retrieval mode"
            >
              {MODES.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  role="radio"
                  aria-checked={mode === m.value}
                  title={m.hint}
                  onClick={() => setMode(m.value)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                    mode === m.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Ask a question about your documents…"
                aria-label="Question"
                className="min-w-0 flex-1 rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
              />
              <button
                type="submit"
                disabled={pending || blocked || !question.trim()}
                className="flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-md transition-transform hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
              >
                {pending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Ask
              </button>
            </div>
          </form>
        </section>

        <EvidencePanel
          insights={insights}
          turn={activeTurn}
          pending={pending}
          blockedReason={health?.reason ?? null}
          selected={selectedNode}
          onSelect={setSelectedNode}
        />
      </main>
    </WorkspaceShell>
  );
}

function EvidencePanel({
  insights,
  turn,
  pending,
  blockedReason,
  selected,
  onSelect,
}: {
  insights: Insights | null;
  turn: Turn | null;
  pending: boolean;
  blockedReason: string | null;
  selected: string | null;
  onSelect: (name: string | null) => void;
}) {
  const nodes = turn?.response?.highlights?.nodes ?? [];
  const known = new Set(insights?.entities.map((e) => e.name) ?? []);
  const shown = nodes.filter((n) => known.has(n));
  return (
    <aside
      className="glass-card animate-fade-up flex flex-col p-5 sm:p-6 lg:min-h-0 lg:overflow-y-auto"
      style={{ animationDelay: "120ms" }}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
          <Network className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-bold text-ink-deep">Evidence Graph</h2>
          <p className="truncate text-sm text-muted-foreground">
            {turn?.response
              ? `Evidence for: “${turn.question}”`
              : "Ask a question and the entities behind the answer light up here."}
          </p>
        </div>
        {pending ? <Loader2 className="mt-1 h-5 w-5 animate-spin text-primary" /> : null}
      </div>

      <div className="mt-4 flex-1">
        {insights ? (
          <KnowledgeGraph
            data={insights}
            selected={selected}
            onSelect={onSelect}
            highlight={shown}
          />
        ) : (
          <div className="relative flex h-full min-h-[18rem] flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed border-border text-center">
            {!blockedReason ? (
              <Skeleton className="absolute inset-0 rounded-2xl opacity-60" />
            ) : null}
            <Network className="relative h-10 w-10 text-muted-foreground/60" />
            <p className="relative mt-3 max-w-xs text-sm text-muted-foreground">
              {blockedReason ?? "Loading the knowledge graph…"}
            </p>
          </div>
        )}
      </div>

      {turn?.response && insights ? (
        <div className="mt-4">
          {shown.length ? (
            <>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Entities used in this answer
              </p>
              <div className="flex flex-wrap gap-2">
                {shown.map((n) => (
                  <button
                    key={n}
                    onClick={() => onSelect(n === selected ? null : n)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-all hover:-translate-y-0.5 ${
                      n === selected
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-secondary-foreground hover:bg-accent"
                    }`}
                  >
                    {prettyName(n)}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              This answer didn&apos;t point to specific entities in the graph.
            </p>
          )}
        </div>
      ) : null}
    </aside>
  );
}

function TurnView({
  turn,
  active,
  onSelect,
}: {
  turn: Turn;
  active: boolean;
  onSelect: () => void;
}) {
  const r = turn.response;
  return (
    <article className="animate-fade-up space-y-3">
      <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-3 text-sm text-primary-foreground">
        {turn.question}
      </p>
      <div
        role={r ? "button" : undefined}
        tabIndex={r ? 0 : undefined}
        aria-pressed={r ? active : undefined}
        title={r ? "Show this answer's evidence on the graph" : undefined}
        onClick={r ? onSelect : undefined}
        onKeyDown={(e) => {
          if (r && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            onSelect();
          }
        }}
        className={`max-w-[94%] rounded-2xl rounded-bl-md px-5 py-4 transition-all ${
          r ? "cursor-pointer" : ""
        } ${active ? "bg-secondary ring-2 ring-primary/40" : "bg-secondary/60 hover:bg-secondary/80"}`}
      >
        {turn.error ? (
          <p className="flex items-start gap-2 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {turn.error}
          </p>
        ) : !r ? (
          <ThinkingSteps />
        ) : (
          <AnswerView r={r} />
        )}
      </div>
    </article>
  );
}

function AnswerView({ r }: { r: AskResponse }) {
  const docs = Array.from(new Set(r.sources.map((src) => src.doc).filter(Boolean)));
  return (
    <RevealText
      text={r.answer}
      render={(visible, done) => (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span
              className={`animate-pop rounded-lg px-2.5 py-1 font-semibold ${
                r.abstained
                  ? "bg-muted text-muted-foreground"
                  : "bg-status-green/10 text-status-green"
              }`}
            >
              {ROUTE_LABEL[r.route] ?? r.route}
            </span>
            {r.timings_ms["total"] != null ? (
              <span className="text-muted-foreground">
                {(r.timings_ms["total"] / 1000).toFixed(1)} s
              </span>
            ) : null}
          </div>

          <Markdownish text={visible} caret={!done} />

          {done && r.abstained && r.abstain_reason ? (
            <p className="animate-fade-up flex items-start gap-2 text-sm text-muted-foreground">
              <ShieldQuestion className="mt-0.5 h-4 w-4 shrink-0" />
              {r.abstain_reason}
            </p>
          ) : null}

          {done && r.claims.length > 0 ? (
            <details className="animate-fade-up group rounded-xl bg-card px-4 py-3">
              <summary className="cursor-pointer text-sm font-semibold">
                <CheckCircle2 className="mr-1.5 inline h-4 w-4 fill-status-green text-card" />
                {r.claims.length} verified claim{r.claims.length === 1 ? "" : "s"}
              </summary>
              <ul className="mt-3 space-y-3">
                {r.claims.map((c, i) => (
                  <li
                    key={i}
                    className="animate-fade-up text-sm"
                    style={{ animationDelay: `${i * 60}ms` }}
                  >
                    <p className="font-medium">{c.text}</p>
                    {c.evidence.map((e, j) => (
                      <blockquote
                        key={j}
                        className="mt-1.5 flex gap-2 border-l-2 border-primary/40 pl-3 text-muted-foreground"
                      >
                        <Quote className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span className="italic">{e.quote}</span>
                      </blockquote>
                    ))}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}

          {done && docs.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {docs.map((d, i) => (
                <span
                  key={d}
                  className="animate-fade-up flex items-center gap-1.5 rounded-lg bg-card px-2.5 py-1 text-xs text-muted-foreground"
                  style={{ animationDelay: `${120 + i * 60}ms` }}
                >
                  <FileText className="h-3.5 w-3.5" />
                  {d}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      )}
    />
  );
}

const THINKING = [
  "Understanding your question",
  "Searching the knowledge graph",
  "Checking quotes against your files",
];

/** The answering pipeline's stages, advancing while the request runs; the last stays active until it returns. */
function ThinkingSteps() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const timers = [setTimeout(() => setStep(1), 1200), setTimeout(() => setStep(2), 4000)];
    return () => timers.forEach(clearTimeout);
  }, []);
  return (
    <ol className="space-y-2 text-sm" aria-live="polite">
      {THINKING.map((label, i) =>
        i > step ? null : (
          <li key={label} className="animate-fade-up flex items-center gap-2">
            {i < step ? (
              <CheckCircle2 className="animate-pop h-4 w-4 fill-status-green text-card" />
            ) : (
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            )}
            <span className={i < step ? "text-muted-foreground" : "text-foreground"}>
              {label}
              {i === step ? "…" : ""}
            </span>
          </li>
        ),
      )}
    </ol>
  );
}

// Answers use light markdown: paragraphs, numbered/bulleted lines and **bold**.
function Markdownish({ text, caret }: { text: string; caret?: boolean }) {
  const bold = (line: string) =>
    line
      .split(/(\*\*[^*]+\*\*)/g)
      .map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={i}>{part.slice(2, -2)}</strong>
        ) : (
          part
        ),
      );
  const lines = text.split(/\n+/).filter((l) => l.trim());
  return (
    <div className="space-y-2 text-sm leading-relaxed">
      {lines.map((line, i) => {
        const tail = caret && i === lines.length - 1 ? "caret" : "";
        const item = line.match(/^\s*(?:\d+\.|[-*])\s+(.*)$/);
        return item ? (
          <p key={i} className={`pl-4 -indent-4 ${tail}`}>
            • {bold(item[1] ?? "")}
          </p>
        ) : (
          <p key={i} className={tail}>
            {bold(line)}
          </p>
        );
      })}
    </div>
  );
}
