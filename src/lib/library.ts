// Search / paging for the shared exercise library. Everything is filtered by the database,
// because Supabase returns at most 1000 rows per request (a client-side filter would silently
// only ever see the first 1000 exercises).
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { SharedExercise } from "@/lib/types";

export const LIBRARY_PAGE_SIZE = 50;

export interface LibraryQuery {
  q?: string;
  difficulty?: number | null;
  topic?: string;
  page: number;
  pageSize?: number;
  /** popular = most used first (teachers); recent = newest first (admin) */
  sort?: "popular" | "recent";
}

/** Makes user text safe inside a PostgREST `or(...)` filter used with ilike. */
function likeTerm(s: string): string {
  return s
    .replace(/[\\%_]/g, (m) => "\\" + m) // literal %, _ and \
    .replace(/[,()*"]/g, " "); //            characters that would break the filter syntax
}

export async function searchLibrary(opts: LibraryQuery): Promise<{ items: SharedExercise[]; total: number }> {
  const size = opts.pageSize ?? LIBRARY_PAGE_SIZE;
  let query = supabase.from("shared_exercises").select("*", { count: "exact" });
  if (opts.difficulty) query = query.eq("difficulty", opts.difficulty);
  if (opts.topic) query = query.eq("topic", opts.topic);
  const term = (opts.q || "").trim();
  if (term) {
    const p = likeTerm(term);
    query = query.or(`title.ilike.*${p}*,description.ilike.*${p}*,topic.ilike.*${p}*`);
  }
  if (opts.sort === "popular") query = query.order("use_count", { ascending: false });
  query = query.order("created_at", { ascending: false }).order("id");
  const from = opts.page * size;
  const { data, error, count } = await query.range(from, from + size - 1);
  if (error) throw new Error(error.message);
  return { items: (data || []) as SharedExercise[], total: count ?? (data?.length || 0) };
}

/** All distinct topics (via the library_topics() SQL function; falls back to scanning a few pages). */
export async function libraryTopics(): Promise<string[]> {
  const { data, error } = await supabase.rpc("library_topics");
  if (!error && Array.isArray(data)) return data as string[];
  const seen = new Set<string>();
  for (let page = 0; page < 10; page++) {
    const { data: rows, error: e } = await supabase.from("shared_exercises").select("topic").not("topic", "is", null).range(page * 1000, page * 1000 + 999);
    if (e || !rows) break;
    rows.forEach((r) => r.topic && r.topic.trim() && seen.add(r.topic.trim()));
    if (rows.length < 1000) break;
  }
  return Array.from(seen).sort((a, b) => a.localeCompare(b));
}

/**
 * State for a searchable, paged library list.
 *  - mode "pages": each page replaces the list (admin)
 *  - mode "append": "load more" adds to it (teacher picker)
 */
export function useLibrarySearch({ sort, mode, pageSize = LIBRARY_PAGE_SIZE }: { sort: "popular" | "recent"; mode: "pages" | "append"; pageSize?: number }) {
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [diff, setDiffState] = useState<number | null>(null);
  const [topic, setTopicState] = useState("");
  const [page, setPage] = useState(0);
  const [items, setItems] = useState<SharedExercise[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [topics, setTopics] = useState<string[]>([]);
  const [nonce, setNonce] = useState(0);
  const reqId = useRef(0);

  // typing waits a moment before hitting the database
  useEffect(() => {
    const t = window.setTimeout(() => {
      setDebouncedQ((cur) => (cur === q.trim() ? cur : q.trim()));
      setPage(0);
    }, 300);
    return () => window.clearTimeout(t);
  }, [q]);

  useEffect(() => {
    libraryTopics().then(setTopics).catch(() => undefined);
  }, [nonce]);

  useEffect(() => {
    const id = ++reqId.current;
    setLoading(true);
    searchLibrary({ q: debouncedQ, difficulty: diff, topic, page, pageSize, sort })
      .then((r) => {
        if (id !== reqId.current) return; // a newer search already started
        setError(null);
        setTotal(r.total);
        setItems((prev) => (mode === "append" && page > 0 ? [...prev, ...r.items.filter((n) => !prev.some((p) => p.id === n.id))] : r.items));
      })
      .catch((e) => id === reqId.current && setError(e instanceof Error ? e.message : "خطا"))
      .finally(() => id === reqId.current && setLoading(false));
  }, [debouncedQ, diff, topic, page, pageSize, sort, mode, nonce]);

  const setDiff = useCallback((v: number | null) => {
    setDiffState(v);
    setPage(0);
  }, []);
  const setTopic = useCallback((v: string) => {
    setTopicState(v);
    setPage(0);
  }, []);

  return {
    q,
    setQ,
    diff,
    setDiff,
    topic,
    setTopic,
    topics,
    items,
    total,
    loading,
    error,
    page,
    setPage,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    hasMore: items.length < total,
    loadMore: () => setPage((p) => p + 1),
    hasFilter: diff !== null || !!topic || !!debouncedQ,
    clear: () => {
      setQ("");
      setDebouncedQ("");
      setDiffState(null);
      setTopicState("");
      setPage(0);
    },
    reload: () => setNonce((n) => n + 1),
    replace: (item: SharedExercise) => setItems((prev) => prev.map((e) => (e.id === item.id ? item : e))),
    remove: (id: string) => {
      setItems((prev) => prev.filter((e) => e.id !== id));
      setTotal((t) => Math.max(0, t - 1));
    },
  };
}
