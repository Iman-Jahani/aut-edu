"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import ProfileModal from "@/components/ProfileModal";
import CellList from "@/components/CellList";
import PlaygroundCell from "@/components/PlaygroundCell";
import { Skeleton } from "@/components/Skeleton";
import { Code2, LayoutDashboard } from "lucide-react";
import type { PlaygroundCell as PlaygroundCellType } from "@/lib/types";

const eff = (c: PlaygroundCellType) => c.position ?? new Date(c.created_at).getTime();
const sortCells = (list: PlaygroundCellType[]) => [...list].sort((a, b) => eff(a) - eff(b));

export default function PlaygroundPage() {
  const { ready, user, needsProfile, displayName, avatar } = useAuth();
  const router = useRouter();

  const [cells, setCells] = useState<PlaygroundCellType[]>([]);
  const [loading, setLoading] = useState(true);
  const loadedOnce = useRef(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    if (ready && !user) router.replace("/login?next=/playground");
  }, [ready, user, router]);

  const load = useCallback(async () => {
    if (!user) return;
    if (!loadedOnce.current) setLoading(true);
    const { data } = await supabase.from("playground_cells").select("*").eq("user_id", user.id).order("created_at", { ascending: true });
    setCells(sortCells(data || []));
    loadedOnce.current = true;
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const addCell = async (afterId?: string | null) => {
    if (!user) return;
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
      .from("playground_cells")
      .insert({ user_id: user.id, code: "", output: "", tags: [], position })
      .select()
      .single();
    if (error || !data) return;
    setHighlightId(data.id);
    setCells((prev) => sortCells([...prev.filter((c) => c.id !== data.id), data as PlaygroundCellType]));
  };

  if (!ready || !user) {
    return (
      <div className="min-h-screen p-6 max-w-3xl mx-auto space-y-4">
        <Skeleton className="h-12 w-full !rounded-2xl" />
        <Skeleton className="h-40 w-full !rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-28">
      <header className="sticky top-0 z-40 glass px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <Link href="/dashboard" className="w-9 h-9 rounded-xl grid place-items-center text-white shadow-soft shrink-0" style={{ background: "var(--grad)" }} title="داشبورد">
            🐍
          </Link>
          <div>
            <div className="font-extrabold text-sm flex items-center gap-1.5">
              <Code2 size={15} className="text-primary" /> پلی‌گراند
            </div>
            <div className="text-[11px] text-muted">دفترچه‌ی شخصی کد — مستقل از هر کلاسی</div>
          </div>
          <div className="flex-1" />
          <Link href="/dashboard" className="btn-ghost hidden sm:inline-flex">
            <LayoutDashboard size={14} /> داشبورد
          </Link>
          <button
            onClick={() => setProfileOpen(true)}
            className="flex items-center gap-2 pl-3 pr-1 py-1 rounded-full bg-white border border-line hover:shadow-soft transition"
          >
            <span className="w-7 h-7 rounded-full bg-indigo-50 grid place-items-center text-base">{avatar}</span>
            <span className="text-xs font-bold max-w-[90px] truncate hidden sm:block">{displayName}</span>
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        <div className="mb-4">
          <h2 className="font-extrabold text-lg">سلول‌های من</h2>
          <p className="text-xs text-muted mt-0.5">{cells.length} سلول — همیشه ذخیره می‌مونن تا خودت پاکشون کنی</p>
        </div>

        <CellList
          items={cells}
          getId={(c) => c.id}
          loading={loading}
          highlightId={highlightId}
          onAdd={addCell}
          renderItem={(cell) => <PlaygroundCell cell={cell} onDeleted={(id) => setCells((p) => p.filter((c) => c.id !== id))} />}
          emptyIcon={<Code2 size={44} className="mx-auto mb-3 text-primary/40" />}
          emptyTitle="بزن بریم!"
          emptyDesc="یه سلول بساز و هر وقت دلت خواست پایتون تمرین کن، بدون نیاز به هیچ کلاسی."
        />
      </main>

      <ProfileModal open={profileOpen || needsProfile} firstTime={needsProfile} onClose={() => setProfileOpen(false)} />
    </div>
  );
}
