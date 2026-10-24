// Client for the Grafia (ThemeGraph) FastAPI backend. Set VITE_API_URL to point elsewhere.
export const API_BASE =
  (import.meta.env["VITE_API_URL"] as string | undefined) ?? "http://localhost:8000";

export type Health = {
  ok: boolean;
  api_key: boolean;
  index_ready: boolean;
  /** The index was built from exactly the documents uploaded now. */
  fresh: boolean;
  documents: number;
  /** Why questions can't be answered yet, or null when they can. */
  reason: string | null;
};

export type ServerDocument = { name: string; size: number; modified: number | null };

export type UploadResult = {
  accepted: string[];
  errors: string[];
  warnings: string[];
  estimate: { docs?: number; chunks?: number; llm_calls?: number };
};

export type IndexState = "idle" | "running" | "success" | "failed" | "cancelled";

export type IndexStatus = {
  state: IndexState;
  stages: string[];
  done: string[];
  current: string | null;
  elapsed_s: number;
  tail: string[];
  error: string | null;
  started: number | null;
  fresh: boolean;
  built_files: string[];
};

export type AskMode = "auto" | "global" | "local" | "hybrid";

export type Claim = { text: string; evidence: { chunk_id: string; quote: string }[] };

export type AnswerSource = { doc: string; chunk_id: string; text: string };

export type AskResponse = {
  route: string;
  answer: string;
  abstained: boolean;
  abstain_reason: string | null;
  claims: Claim[];
  sources: AnswerSource[];
  highlights: { nodes: string[]; edges: string[]; communities: string[] };
  timings_ms: Record<string, number>;
  router: { route?: string; confidence?: number; reason?: string };
};

export type Entity = {
  name: string;
  type: string;
  description: string;
  degree: number;
  community: string;
};

export type Relationship = { source: string; target: string; description: string; weight: number };

export type Community = { id: string; title: string; summary: string; size: number; rank: number };

export type Insights = {
  ready: boolean;
  reason: string | null;
  stats: { docs: number; entities: number; relationships: number; communities: number };
  type_counts: Record<string, number>;
  entities: Entity[];
  relationships: Relationship[];
  communities: Community[];
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, init);
  } catch {
    throw new Error(`Can't reach the backend at ${API_BASE}. Is the API server running?`);
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const detail = body?.detail;
    throw new Error(typeof detail === "string" ? detail : `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

const json = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export const api = {
  health: () => request<Health>("/api/health"),
  documents: () => request<ServerDocument[]>("/api/documents"),
  upload: (files: File[]) => {
    const form = new FormData();
    files.forEach((f) => form.append("files", f));
    return request<UploadResult>("/api/documents", { method: "POST", body: form });
  },
  deleteDocument: (name: string) =>
    request<{ deleted: string }>(`/api/documents/${encodeURIComponent(name)}`, {
      method: "DELETE",
    }),
  insights: () => request<Insights>("/api/insights"),
  indexStatus: () => request<IndexStatus>("/api/index"),
  startIndex: () => request<IndexStatus>("/api/index", { method: "POST" }),
  cancelIndex: () => request<IndexStatus>("/api/index/cancel", { method: "POST" }),
  ask: (question: string, mode: AskMode = "auto") =>
    request<AskResponse>("/api/ask", json({ question, mode })),
};
