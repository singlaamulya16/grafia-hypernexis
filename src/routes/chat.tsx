import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  FileText,
  Loader2,
  Quote,
  Send,
  ShieldQuestion,
} from "lucide-react";
import { WorkspaceShell } from "@/components/workspace-shell";
import { api, type AskMode, type AskResponse, type Health } from "@/lib/api";

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
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.health().then(setHealth, (err: Error) => setHealthError(err.message));
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
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
    } catch (err) {
      setTurns((prev) =>
        prev.map((t) => (t.id === id ? { ...t, error: (err as Error).message } : t)),
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <WorkspaceShell active={4}>
      <main className="mx-auto max-w-4xl px-6 py-8">
        <section className="glass-card animate-fade-up p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-ink-deep sm:text-4xl">
                5. Ask <span className="text-gradient-leaf">Your Documents</span>
              </h1>
              <p className="mt-2 text-muted-foreground">
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
            <p className="mt-5 flex items-start gap-2.5 rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {healthError}
            </p>
          ) : health?.reason ? (
            <div className="mt-5 flex flex-wrap items-center gap-3 rounded-2xl bg-secondary px-4 py-3 text-sm">
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
            <p className="mt-5 rounded-2xl bg-secondary px-4 py-3 text-sm">
              Answering from the {health.documents} document{health.documents === 1 ? "" : "s"} you
              uploaded.
            </p>
          ) : null}

          <div className="mt-6 space-y-6">
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
              turns.map((t) => <TurnView key={t.id} turn={t} />)
            )}
            <div ref={endRef} />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void ask(question);
            }}
            className="mt-6 border-t border-border pt-5"
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
      </main>
    </WorkspaceShell>
  );
}

function TurnView({ turn }: { turn: Turn }) {
  const r = turn.response;
  return (
    <article className="space-y-3">
      <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-3 text-sm text-primary-foreground">
        {turn.question}
      </p>
      <div className="max-w-[92%] rounded-2xl rounded-bl-md bg-secondary/60 px-5 py-4">
        {turn.error ? (
          <p className="flex items-start gap-2 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {turn.error}
          </p>
        ) : !r ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Investigating…
          </p>
        ) : (
          <AnswerView r={r} />
        )}
      </div>
    </article>
  );
}

function AnswerView({ r }: { r: AskResponse }) {
  const docs = Array.from(new Set(r.sources.map((s) => s.doc).filter(Boolean)));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span
          className={`rounded-lg px-2.5 py-1 font-semibold ${
            r.abstained ? "bg-muted text-muted-foreground" : "bg-status-green/10 text-status-green"
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

      <Markdownish text={r.answer} />

      {r.abstained && r.abstain_reason ? (
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <ShieldQuestion className="mt-0.5 h-4 w-4 shrink-0" />
          {r.abstain_reason}
        </p>
      ) : null}

      {r.claims.length > 0 ? (
        <details className="group rounded-xl bg-card px-4 py-3">
          <summary className="cursor-pointer text-sm font-semibold">
            {r.claims.length} verified claim{r.claims.length === 1 ? "" : "s"}
          </summary>
          <ul className="mt-3 space-y-3">
            {r.claims.map((c, i) => (
              <li key={i} className="text-sm">
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

      {docs.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {docs.map((d) => (
            <span
              key={d}
              className="flex items-center gap-1.5 rounded-lg bg-card px-2.5 py-1 text-xs text-muted-foreground"
            >
              <FileText className="h-3.5 w-3.5" />
              {d}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// Answers use light markdown: paragraphs, numbered/bulleted lines and **bold**.
function Markdownish({ text }: { text: string }) {
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
  return (
    <div className="space-y-2 text-sm leading-relaxed">
      {text
        .split(/\n+/)
        .filter((l) => l.trim())
        .map((line, i) => {
          const item = line.match(/^\s*(?:\d+\.|[-*])\s+(.*)$/);
          return item ? (
            <p key={i} className="pl-4 -indent-4">
              • {bold(item[1] ?? "")}
            </p>
          ) : (
            <p key={i}>{bold(line)}</p>
          );
        })}
    </div>
  );
}
