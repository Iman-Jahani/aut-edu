"use client";

import { useRef } from "react";
import Link from "next/link";
import {
  GraduationCap,
  Users,
  Sparkles,
  CalendarDays,
  BookOpen,
  Brain,
  Flag,
  Eye,
  UserCog,
  Download,
  Upload,
  ChevronRight,
  BarChart3,
} from "lucide-react";
import type { CurrentTeam } from "@/components/TeamPicker";
import type { ClassSession } from "@/lib/types";

interface ActiveItemState {
  item: unknown;
  answered: boolean;
  draftCount: number;
}

export default function ClassHeader({
  session,
  meetingTitle,
  currentTeam,
  isTeacher,
  isOwner,
  previewAsStudent,
  setPreviewAsStudent,
  teacherMode,
  displayName,
  avatar,
  exerciseBadge,
  quiz,
  comp,
  onShare,
  onTeamPicker,
  onExercises,
  onQuizzes,
  onCompetitions,
  onProfile,
  onCoTeachers,
  ipynb,
  section,
}: {
  session: ClassSession;
  /** When set, shows a "← جلسات" back link plus this meeting's title under the class title. */
  meetingTitle?: string;
  currentTeam: CurrentTeam | null;
  isTeacher: boolean;
  isOwner: boolean;
  previewAsStudent: boolean;
  setPreviewAsStudent: (v: boolean | ((prev: boolean) => boolean)) => void;
  teacherMode: boolean;
  displayName: string;
  avatar: string;
  exerciseBadge: number;
  quiz: ActiveItemState;
  comp: ActiveItemState;
  onShare: () => void;
  onTeamPicker: () => void;
  onExercises: () => void;
  onQuizzes: () => void;
  onCompetitions: () => void;
  onProfile: () => void;
  onCoTeachers: () => void;
  ipynb?: { onExport: () => void; onImport: (file: File) => void; importing: boolean };
  /** Which top-level section is open when there is no meeting title. */
  section?: "students";
}) {
  const ipynbInputRef = useRef<HTMLInputElement>(null);
  const compNeedsAttention = !!comp.item && !teacherMode && (!currentTeam || !comp.answered);
  const tabBase = "relative flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-bold whitespace-nowrap transition";

  return (
    <header className="sticky top-0 z-40 glass">
      <div className="max-w-4xl mx-auto px-4 pt-3 pb-2.5 flex items-center gap-2">
        <Link
          href="/dashboard"
          className="w-9 h-9 rounded-xl grid place-items-center text-white text-lg shadow-soft shrink-0"
          style={{ background: "var(--grad)" }}
          title="داشبورد"
        >
          🐍
        </Link>
        <button onClick={onShare} className="min-w-0 text-right group">
          {meetingTitle ? (
            <>
              <div className="flex items-center gap-1 text-[11px] text-muted group-hover:text-primary transition">
                <ChevronRight size={12} /> {session.title}
              </div>
              <div className="font-extrabold text-sm truncate">{meetingTitle}</div>
            </>
          ) : (
            <>
              <div className="font-extrabold text-sm truncate group-hover:text-primary transition">{session.title}</div>
              <div className="text-[11px] text-muted font-mono tracking-widest">کد: {session.code}</div>
            </>
          )}
        </button>
        <div className="flex-1" />

        <button
          onClick={onTeamPicker}
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border bg-white hover:shadow-soft transition"
          style={{ borderColor: currentTeam?.color || "#e2e8f0", color: currentTeam?.color || "#64748b" }}
        >
          {currentTeam ? (
            <>
              <span className="w-2 h-2 rounded-full" style={{ background: currentTeam.color }} />
              {currentTeam.name}
            </>
          ) : (
            <>
              <Users size={13} /> انتخاب تیم
            </>
          )}
        </button>

        {ipynb && teacherMode && (
          <div className="hidden md:flex items-center gap-1">
            <button
              onClick={ipynb.onExport}
              title="خروجی ipynb از این جلسه"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border border-line bg-white hover:shadow-soft transition"
            >
              <Download size={13} /> ipynb
            </button>
            <button
              onClick={() => ipynbInputRef.current?.click()}
              disabled={ipynb.importing}
              title="آپلود فایل ipynb"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border border-line bg-white hover:shadow-soft transition disabled:opacity-50"
            >
              <Upload size={13} /> {ipynb.importing ? "..." : "آپلود"}
            </button>
            <input
              ref={ipynbInputRef}
              type="file"
              accept=".ipynb,application/x-ipynb+json,application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) ipynb.onImport(f);
                e.target.value = "";
              }}
            />
          </div>
        )}

        {isTeacher && (
          <>
            <span className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <GraduationCap size={13} /> معلم{!isOwner ? " همکار" : ""}
            </span>
            <button
              onClick={() => setPreviewAsStudent((v) => !v)}
              title="دیدِ دانشجو رو پیش‌نمایش کن"
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1.5 ${
                previewAsStudent ? "bg-amber-500 text-white shadow-soft" : "border border-line bg-white hover:shadow-soft"
              }`}
            >
              <Eye size={13} /> {previewAsStudent ? "پیش‌نمایش فعاله" : "دیدِ دانشجو"}
            </button>
            {isOwner && (
              <button
                onClick={onCoTeachers}
                title="معلم‌های همکار این کلاس"
                className="px-3 py-1.5 rounded-full text-xs font-bold border border-line bg-white hover:shadow-soft transition flex items-center gap-1.5"
              >
                <UserCog size={13} />
              </button>
            )}
          </>
        )}

        <button
          onClick={onProfile}
          className="flex items-center gap-2 pl-3 pr-1 py-1 rounded-full bg-white border border-line hover:shadow-soft transition"
          title="پروفایل"
        >
          <span className="w-7 h-7 rounded-full bg-indigo-50 grid place-items-center text-base">{avatar}</span>
          <span className="text-xs font-bold max-w-[90px] truncate hidden sm:block">{displayName}</span>
        </button>
      </div>

      {/* Section nav */}
      <div className="max-w-4xl mx-auto px-4 pb-2.5 flex items-center gap-1.5 overflow-x-auto">
        {meetingTitle || section ? (
          <Link href={`/class/${session.code}`} className={`${tabBase} text-muted hover:bg-white hover:text-ink hover:shadow-soft`}>
            <CalendarDays size={14} /> جلسات
          </Link>
        ) : (
          <span className={`${tabBase} bg-indigo-50 text-primary`}>
            <Sparkles size={14} /> جلسات
          </span>
        )}
        {isTeacher && (
          <Link
            href={`/class/${session.code}/students`}
            className={`${tabBase} ${section === "students" ? "bg-indigo-50 text-primary" : "text-muted hover:bg-white hover:text-ink hover:shadow-soft"}`}
          >
            <BarChart3 size={14} /> دانشجوها
          </Link>
        )}
        <button onClick={onExercises} className={`${tabBase} text-muted hover:bg-white hover:text-ink hover:shadow-soft`}>
          <BookOpen size={14} /> تمرین‌ها
          {exerciseBadge > 0 && (
            <span className="min-w-[18px] h-[18px] px-1 grid place-items-center rounded-full bg-danger text-white text-[10px] font-bold">{exerciseBadge}</span>
          )}
        </button>
        <button onClick={onQuizzes} className={`${tabBase} text-muted hover:bg-white hover:text-ink hover:shadow-soft`}>
          <Brain size={14} /> کوییز
          {teacherMode && quiz.draftCount > 0 && (
            <span className="min-w-[18px] h-[18px] px-1 grid place-items-center rounded-full bg-amber-500 text-white text-[10px] font-bold" title="پیش‌نویس">
              {quiz.draftCount}
            </span>
          )}
          {!!quiz.item && <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />}
        </button>
        <button onClick={onCompetitions} className={`${tabBase} text-muted hover:bg-white hover:text-ink hover:shadow-soft`}>
          <Flag size={14} /> مسابقه
          {teacherMode && comp.draftCount > 0 && (
            <span className="min-w-[18px] h-[18px] px-1 grid place-items-center rounded-full bg-amber-500 text-white text-[10px] font-bold" title="پیش‌نویس">
              {comp.draftCount}
            </span>
          )}
          {compNeedsAttention && <span className="min-w-[18px] h-[18px] px-1 grid place-items-center rounded-full bg-danger text-white text-[10px] font-bold">!</span>}
          {!!comp.item && !compNeedsAttention && <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />}
        </button>
        <button onClick={onTeamPicker} className={`${tabBase} text-muted hover:bg-white hover:text-ink hover:shadow-soft sm:hidden`}>
          <Users size={14} /> {currentTeam ? currentTeam.name : "تیم"}
        </button>
      </div>

      {teacherMode && (
        <div className="bg-gradient-to-l from-amber-400 to-orange-400 text-white text-center text-xs font-bold py-1.5">
          حالت معلم فعاله — همه‌چیز رو می‌بینی
        </div>
      )}
    </header>
  );
}
