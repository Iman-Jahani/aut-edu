"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { preloadPyodide } from "@/lib/pyodide";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ToastProvider";
import { useClassAccess } from "@/hooks/useClassAccess";
import ClassChrome from "@/components/ClassChrome";
import CellList from "@/components/CellList";
import CodeCell from "@/components/CodeCell";
import { ClassPageSkeleton } from "@/components/Skeleton";
import { fetchAvatars } from "@/lib/utils";
import { downloadNotebook, parseNotebook } from "@/lib/ipynb";
import { Sparkles, Search } from "lucide-react";
import type { Cell, ClassMeeting } from "@/lib/types";
import { getErrorMessage } from "@/lib/errors";

const eff = (c: Cell) => c.position ?? new Date(c.created_at).getTime();
const sortCells = (list: Cell[]) => [...list].sort((a, b) => eff(a) - eff(b));

export default function MeetingPage({ params }: { params: { code: string; meetingId: string } }) {
  const access = useClassAccess(params.code);
  const { ready, session, notFound, currentTeam, teacherMode } = access;
  const { user, displayName, avatar } = useAuth();
  const toast = useToast();

  const [meeting, setMeeting] = useState<ClassMeeting | null>(null);
  const [meetingNotFound, setMeetingNotFound] = useState(false);
  const [cells, setCells] = useState<Cell[]>([]);
  const [loadingCells, setLoadingCells] = useState(true);
  const cellsLoadedOnce = useRef(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    preloadPyodide();
  }, []);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("class_meetings").select("*").eq("id", params.meetingId).maybeSingle();
      if (!data) {
        setMeetingNotFound(true);
        return;
      }
      setMeeting(data);
    })();
  }, [params.meetingId]);

  const loadCells = useCallback(async () => {
    if (!session || !user || !meeting) return;
    if (!cellsLoadedOnce.current) setLoadingCells(true);
    let q = supabase.from("cells").select("*").eq("meeting_id", meeting.id).order("created_at", { ascending: true });
    if (!teacherMode) {
      if (currentTeam?.id) {
        q = q.or(`team_id.eq.${currentTeam.id},and(team_id.is.null,author_id.eq.${user.id})`);
      } else {
        q = q.is("team_id", null).eq("author_id", user.id);
      }
    }
    const { data, error } = await q;
    if (error) {
      toast("خطا: " + error.message, "err");
    } else {
      const rows = data || [];
      const avatars = await fetchAvatars(rows.map((c) => c.author_id));
      setCells(sortCells(rows.map((c) => ({ ...c, author_avatar: avatars[c.author_id] || null }))));
    }
    cellsLoadedOnce.current = true;
    setLoadingCells(false);
  }, [session, user, meeting, currentTeam, teacherMode, toast]);

  useEffect(() => {
    if (session && user && meeting) loadCells();
  }, [session, user, meeting, loadCells]);

  useEffect(() => {
    if (!meeting) return;
    const channel = supabase
      .channel("cells-meeting-" + meeting.id)
      .on("postgres_changes", { event: "*", schema: "public", table: "cells", filter: `meeting_id=eq.${meeting.id}` }, () => loadCells())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [meeting, loadCells]);

  // afterId: undefined → append · null → insert at top · string → right after that cell
  const addCell = async (afterId?: string | null) => {
    if (!session || !user || !meeting) return;
    const now = Date.now();
    let position: number;
    if (afterId === undefined) {
      const last = cells[cells.length - 1];
      position = last ? Math.max(now, eff(last) + 1) : now;
    } else if (afterId === null) {
      position = cells.length ? eff(cells[0]) - 1000 : now;
    } else {
      const i = cells.findIndex((c) => c.id === afterId);
      const prev = cells[i];
      const next = cells[i + 1];
      position = next ? (eff(prev) + eff(next)) / 2 : Math.max(now, eff(prev) + 1);
    }
    const { data, error } = await supabase
      .from("cells")
      .insert({
        class_id: session.id,
        meeting_id: meeting.id,
        team_id: currentTeam?.id || null,
        team_name: currentTeam?.name || null,
        author_id: user.id,
        author_name: displayName,
        code: "",
        output: "",
        tags: [],
        position,
      })
      .select()
      .single();
    if (error || !data) {
      toast("خطا: " + (error?.message || "نامشخص"), "err");
      return;
    }
    setHighlightId(data.id);
    setCells((prev) => sortCells([...prev.filter((c) => c.id !== data.id), { ...(data as Cell), author_avatar: avatar }]));
  };

  const exportNotebook = () => {
    if (!cells.length) return toast("هنوز سلولی برای خروجی گرفتن نیست", "err");
    downloadNotebook(cells, `${meeting?.title || "session"}-${new Date().toISOString().slice(0, 10)}`);
    toast("فایل ipynb دانلود شد", "ok");
  };

  const importNotebook = async (file: File) => {
    if (!session || !user || !meeting) return;
    setImporting(true);
    try {
      const text = await file.text();
      const parsed = parseNotebook(text);
      if (!parsed.length) {
        toast("هیچ سلول کدی توی این فایل پیدا نشد", "err");
        return;
      }
      const last = cells[cells.length - 1];
      let position = last ? eff(last) + 1 : Date.now();
      const rows = parsed.map((p) => ({
        class_id: session.id,
        meeting_id: meeting.id,
        team_id: null,
        team_name: null,
        author_id: user.id,
        author_name: displayName,
        code: p.code,
        output: p.output,
        tags: ["از ipynb"],
        position: position++,
      }));
      const { error } = await supabase.from("cells").insert(rows);
      if (error) {
        toast("خطا در آپلود: " + error.message, "err");
        return;
      }
      toast(`${parsed.length} سلول از فایل ipynb اضافه شد`, "ok");
      loadCells();
    } catch (e) {
      toast("خطا: " + getErrorMessage(e), "err");
    } finally {
      setImporting(false);
    }
  };

  if (notFound || meetingNotFound) {
    return (
      <div className="min-h-screen grid place-items-center p-6 text-center">
        <div className="card p-10 max-w-sm anim-pop">
          <Search size={44} className="mx-auto mb-3 text-primary/40" />
          <h1 className="font-extrabold text-lg mb-2">{notFound ? "کلاسی با این کد پیدا نشد" : "این جلسه پیدا نشد"}</h1>
          <Link href={notFound ? "/dashboard" : `/class/${params.code}`} className="btn-primary">
            بازگشت
          </Link>
        </div>
      </div>
    );
  }

  if (!ready || !session || !meeting) return <ClassPageSkeleton />;

  return (
    <ClassChrome access={access} meetingTitle={meeting.title} ipynb={{ onExport: exportNotebook, onImport: importNotebook, importing }}>
      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="mb-4">
          <h2 className="font-extrabold text-lg">{teacherMode ? "همه‌ی سلول‌های این جلسه" : currentTeam ? `فضای تیم ${currentTeam.name}` : "سلول‌های شخصی من"}</h2>
          <p className="text-xs text-muted mt-0.5">{cells.length} سلول</p>
        </div>

        <CellList
          items={cells}
          getId={(c) => c.id}
          loading={loadingCells}
          highlightId={highlightId}
          onAdd={addCell}
          renderItem={(cell) => (
            <CodeCell
              cell={cell}
              teacherMode={teacherMode}
              autoFocus={cell.id === highlightId}
              onDeleted={(id) => setCells((p) => p.filter((c) => c.id !== id))}
            />
          )}
          emptyIcon={<Sparkles size={44} className="mx-auto mb-3 text-primary/40" />}
          emptyTitle="آماده‌ای شروع کنی؟"
          emptyDesc="یه سلول بساز و اولین کد پایتونت رو توی این جلسه بنویس."
        />
      </main>
    </ClassChrome>
  );
}
