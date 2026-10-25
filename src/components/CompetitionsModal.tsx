"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ToastProvider";
import { fmtRelative } from "@/lib/utils";
import CompetitionFormModal from "@/components/CompetitionFormModal";
import CompetitionTakeView from "@/components/CompetitionTakeView";
import CompetitionSubmissionsModal from "@/components/CompetitionSubmissionsModal";
import type { Competition, CompetitionSubmission } from "@/lib/types";
import type { CurrentTeam } from "@/components/TeamPicker";
import { CardGridSkeleton } from "@/components/Skeleton";
import { Flag, Eye, Plus, Play, Pencil, Trash2, Square, CircleDot, Timer, Users, CheckCircle2, X } from "lucide-react";
import type { ReactNode } from "react";

const STATUS_META: Record<string, { label: string; className: string; icon: ReactNode }> = {
  active: { label: "فعال", className: "bg-emerald-100 text-emerald-700", icon: <CircleDot size={11} className="animate-pulse" /> },
  ended: { label: "پایان یافته", className: "bg-slate-100 text-slate-600", icon: <Square size={10} /> },
  draft: { label: "پیش‌نویس", className: "bg-amber-100 text-amber-700", icon: <Pencil size={10} /> },
};
function StatusPill({ status }: { status: string }) {
  const m = STATUS_META[status] || STATUS_META.draft;
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${m.className}`}>
      {m.icon} {m.label}
    </span>
  );
}

export default function CompetitionsModal({
  classId,
  teacherMode,
  currentTeam,
  initialTakeActive = false,
  onClose,
  onNeedTeam,
}: {
  classId: string;
  teacherMode: boolean;
  currentTeam: CurrentTeam | null;
  initialTakeActive?: boolean;
  onClose: () => void;
  onNeedTeam: () => void;
}) {
  const toast = useToast();
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [mySubs, setMySubs] = useState<Record<string, CompetitionSubmission>>({});
  const [subCounts, setSubCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "take">(initialTakeActive ? "take" : "list");
  const [selected, setSelected] = useState<Competition | null>(null);
  const [formOpen, setFormOpen] = useState<Competition | "new" | null>(null);
  const [viewingSubs, setViewingSubs] = useState<Competition | null>(null);

  const activeCompetition = competitions.find((c) => c.status === "active") || null;

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("competitions")
      .select("*")
      .eq("class_id", classId)
      .order("created_at", { ascending: false });
    const list = data || [];
    setCompetitions(list);
    if (list.length) {
      const { data: subs } = await supabase
        .from("competition_submissions")
        .select("*")
        .in(
          "competition_id",
          list.map((c) => c.id)
        );
      const mine: Record<string, CompetitionSubmission> = {};
      const counts: Record<string, number> = {};
      (subs || []).forEach((s) => {
        counts[s.competition_id] = (counts[s.competition_id] || 0) + 1;
        if (currentTeam && s.team_id === currentTeam.id) mine[s.competition_id] = s;
      });
      setMySubs(mine);
      setSubCounts(counts);
    }
    setLoading(false);
  }, [classId, currentTeam]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (initialTakeActive && activeCompetition) {
      setSelected(activeCompetition);
      setView("take");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTakeActive, competitions.length]);

  const startCompetition = async (c: Competition) => {
    if (!confirm("مسابقه شروع بشه؟ همه‌ی دانشجوهای عضو تیم‌ها می‌بیننش.")) return;
    const others = competitions.filter((x) => x.status === "active" && x.id !== c.id);
    for (const o of others) await supabase.from("competitions").update({ status: "ended" }).eq("id", o.id);
    const { error } = await supabase.from("competitions").update({ status: "active", started_at: new Date().toISOString() }).eq("id", c.id);
    if (error) return toast("خطا: " + error.message, "err");
    toast("مسابقه شروع شد!", "ok");
    await load();
    setViewingSubs({ ...c, status: "active", started_at: new Date().toISOString() });
  };

  const stopCompetition = async (c: Competition) => {
    if (!confirm("مسابقه تموم بشه؟")) return;
    const { error } = await supabase.from("competitions").update({ status: "ended" }).eq("id", c.id);
    if (error) return toast("خطا: " + error.message, "err");
    toast("مسابقه تموم شد", "ok");
    load();
  };

  const deleteCompetition = async (c: Competition) => {
    if (!confirm(`مسابقه «${c.title}» حذف شود؟`)) return;
    const { error } = await supabase.from("competitions").delete().eq("id", c.id);
    if (error) return toast("خطا: " + error.message, "err");
    toast("حذف شد", "ok");
    load();
  };

  const title = view === "take" && selected ? selected.title : "مسابقه‌ها";

  return (
    <div
      className="fixed inset-0 z-[105] bg-slate-900/50 backdrop-blur-sm anim-fade flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl anim-pop w-full max-w-2xl max-h-[88vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-line">
          <h2 className="font-extrabold flex items-center gap-2"><Flag size={18} /> {title}</h2>
          <button onClick={onClose} className="text-muted hover:text-ink">
            <X size={17} />
          </button>
        </div>

        <div className="px-6 py-4 overflow-y-auto flex-1">
          {loading ? (
            <CardGridSkeleton count={4} />
          ) : view === "take" && selected ? (
            <CompetitionTakeView
              competition={selected}
              currentTeam={currentTeam}
              teamSubmission={currentTeam ? mySubs[selected.id] : undefined}
              onSubmitted={(s) => setMySubs((prev) => ({ ...prev, [s.competition_id]: s }))}
              onNeedTeam={() => {
                onClose();
                onNeedTeam();
              }}
            />
          ) : teacherMode ? (
            <>
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-muted">{competitions.length} مسابقه</span>
                <button
                  onClick={() => setFormOpen("new")}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-gradient-to-br from-primary to-primary2"
                >
                  <Plus size={14} /> مسابقه جدید
                </button>
              </div>
              {competitions.length === 0 ? (
                <div className="text-center py-16">
                  <Flag size={40} className="mx-auto mb-3 text-primary/40" />
                  <h3 className="font-bold">هنوز مسابقه‌ای نساختی</h3>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-3">
                  {competitions.map((c) => (
                    <div key={c.id} className="border border-line rounded-xl p-4">
                      <div className="font-bold text-sm mb-1.5 flex items-center gap-1.5"><Flag size={14} className="text-primary shrink-0" /> {c.title}</div>
                      <div className="flex gap-2 text-[11px] text-muted mb-2">
                        <span className="flex items-center gap-1 px-2 py-0.5 bg-slate-100 rounded-full"><Timer size={11} /> {c.time_limit} دقیقه</span>
                        <span className="flex items-center gap-1 px-2 py-0.5 bg-slate-100 rounded-full"><Users size={11} /> {subCounts[c.id] || 0} تیم</span>
                      </div>
                      <div className="flex justify-end mb-2.5">
                        <StatusPill status={c.status} />
                      </div>
                      <div className="flex gap-1.5 flex-wrap">
                        {c.status === "draft" && (
                          <>
                            <button onClick={() => startCompetition(c)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-white bg-emerald-600">
                              <Play size={12} /> شروع
                            </button>
                            <button onClick={() => setFormOpen(c)} className="px-2.5 py-1.5 rounded-lg text-xs font-bold border border-line">
                              <Pencil size={12} />
                            </button>
                            <button onClick={() => deleteCompetition(c)} className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-danger border border-red-200">
                              <Trash2 size={12} />
                            </button>
                          </>
                        )}
                        {c.status === "active" && (
                          <>
                            <button onClick={() => stopCompetition(c)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-white bg-warning">
                              <Square size={12} /> پایان
                            </button>
                            <button onClick={() => setViewingSubs(c)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold border border-line">
                              <Eye size={12} /> پاسخ‌ها ({subCounts[c.id] || 0})
                            </button>
                          </>
                        )}
                        {c.status === "ended" && (
                          <>
                            <button onClick={() => setViewingSubs(c)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold border border-line">
                              <Eye size={12} /> پاسخ‌ها ({subCounts[c.id] || 0})
                            </button>
                            <button onClick={() => deleteCompetition(c)} className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-danger border border-red-200">
                              <Trash2 size={12} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              {competitions.filter((c) => c.status === "ended").length === 0 ? (
                <div className="text-center py-16">
                  <Flag size={40} className="mx-auto mb-3 text-primary/40" />
                  <h3 className="font-bold">هنوز مسابقه‌ای نیست</h3>
                  <p className="text-sm text-muted mt-1">وقتی استاد مسابقه شروع کنه اینجا می‌بینی.</p>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-3">
                  {competitions
                    .filter((c) => c.status === "ended")
                    .map((c) => {
                      const teamSub = currentTeam ? mySubs[c.id] : null;
                      return (
                        <div key={c.id} className="border border-line rounded-xl p-4">
                          <div className="font-bold text-sm mb-1.5 flex items-center gap-1.5"><Flag size={14} className="text-primary shrink-0" /> {c.title}</div>
                          <div className="text-[11px] text-muted mb-3">
                            <span className="flex items-center gap-1 px-2 py-0.5 bg-slate-100 rounded-full w-fit"><Timer size={11} /> {c.time_limit} دقیقه</span>
                          </div>
                          {teamSub ? (
                            <div className="text-xs text-emerald-700 font-bold flex items-center gap-1"><CheckCircle2 size={13} /> پاسخ تیم ثبت شد · {fmtRelative(teamSub.submitted_at)}</div>
                          ) : (
                            <div className="text-xs text-muted">{currentTeam ? "تیم شما شرکت نکرد" : "تیم نداشتی"}</div>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {formOpen && (
        <CompetitionFormModal
          classId={classId}
          competition={formOpen === "new" ? null : formOpen}
          onClose={() => setFormOpen(null)}
          onSaved={() => {
            setFormOpen(null);
            load();
          }}
        />
      )}

      {viewingSubs && <CompetitionSubmissionsModal competition={viewingSubs} onClose={() => setViewingSubs(null)} />}
    </div>
  );
}
