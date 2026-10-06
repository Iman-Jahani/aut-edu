"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ToastProvider";
import ProfileModal from "@/components/ProfileModal";
import TeamPicker from "@/components/TeamPicker";
import ExercisesModal from "@/components/ExercisesModal";
import QuizzesModal from "@/components/QuizzesModal";
import CompetitionsModal from "@/components/CompetitionsModal";
import CoTeachersModal from "@/components/CoTeachersModal";
import TeamChat from "@/components/TeamChat";
import LiveBanner from "@/components/LiveBanner";
import ClassHeader from "@/components/ClassHeader";
import { Brain, Flag, CheckCircle2, AlertTriangle, Play, GraduationCap, Copy, Link2, LogOut } from "lucide-react";
import { useActiveItem } from "@/hooks/useActiveItem";
import { supabase } from "@/lib/supabase";
import type { useClassAccess } from "@/hooks/useClassAccess";
import type { Quiz, Competition } from "@/lib/types";

export default function ClassChrome({
  access,
  meetingTitle,
  ipynb,
  children,
}: {
  access: ReturnType<typeof useClassAccess>;
  meetingTitle?: string;
  ipynb?: { onExport: () => void; onImport: (file: File) => void; importing: boolean };
  children: ReactNode;
}) {
  const { session, currentTeam, setCurrentTeam, isTeacher, isOwner, teacherMode, previewAsStudent, setPreviewAsStudent, leaveClass, loadCoTeachers } = access;
  const { displayName, avatar, user, needsProfile } = useAuth();
  const toast = useToast();

  const [teamPickerOpen, setTeamPickerOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [coTeachersOpen, setCoTeachersOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [exercisesOpen, setExercisesOpen] = useState(false);
  const [exerciseBadge, setExerciseBadge] = useState(0);
  const [quizzesOpen, setQuizzesOpen] = useState(false);
  const [quizFromBanner, setQuizFromBanner] = useState(false);
  const [competitionsOpen, setCompetitionsOpen] = useState(false);
  const [compFromBanner, setCompFromBanner] = useState(false);

  const loadExerciseBadge = async () => {
    if (!session || !user || teacherMode) return setExerciseBadge(0);
    const { data: exList } = await supabase.from("exercises").select("id").eq("class_id", session.id);
    const ids = (exList || []).map((e) => e.id);
    if (!ids.length) return setExerciseBadge(0);
    const { data: subs } = await supabase.from("exercise_submissions").select("exercise_id, status").in("exercise_id", ids).eq("user_id", user.id);
    const solved = new Set((subs || []).filter((s) => s.status === "correct").map((s) => s.exercise_id));
    setExerciseBadge(ids.filter((id) => !solved.has(id)).length);
  };

  useEffect(() => {
    loadExerciseBadge();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id, teacherMode, user?.id]);

  const quiz = useActiveItem<Quiz>(
    "quizzes",
    session?.id,
    !!session,
    async (q) => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return false;
      const { data: ans } = await supabase.from("quiz_answers").select("id").eq("quiz_id", q.id).eq("user_id", data.user.id).maybeSingle();
      return !!ans;
    },
    [session?.id],
    teacherMode
  );

  const comp = useActiveItem<Competition>(
    "competitions",
    session?.id,
    !!session,
    async (c) => {
      if (!currentTeam) return false;
      const { data } = await supabase.from("competition_submissions").select("id").eq("competition_id", c.id).eq("team_id", currentTeam.id).maybeSingle();
      return !!data;
    },
    [currentTeam?.id],
    teacherMode
  );

  if (!session) return <>{children}</>;

  const copy = (text: string, msg: string) => {
    navigator.clipboard.writeText(text);
    toast(msg, "ok");
  };

  return (
    <div className="min-h-screen pb-28">
      <ClassHeader
        session={session}
        meetingTitle={meetingTitle}
        currentTeam={currentTeam}
        isTeacher={isTeacher}
        isOwner={isOwner}
        previewAsStudent={previewAsStudent}
        setPreviewAsStudent={setPreviewAsStudent}
        teacherMode={teacherMode}
        displayName={displayName}
        avatar={avatar}
        exerciseBadge={exerciseBadge}
        quiz={quiz}
        comp={comp}
        onShare={() => setShareOpen(true)}
        onTeamPicker={() => setTeamPickerOpen(true)}
        onExercises={() => setExercisesOpen(true)}
        onQuizzes={() => {
          // If a quiz is live right now, jump straight into it (same as the banner) —
          // the list view only shows *ended* quizzes for non-teachers, so without this
          // the top-nav button looked broken while one was actively running.
          setQuizFromBanner(!teacherMode && !!quiz.item);
          setQuizzesOpen(true);
        }}
        onCompetitions={() => {
          setCompFromBanner(!teacherMode && !!comp.item);
          setCompetitionsOpen(true);
        }}
        onProfile={() => setProfileOpen(true)}
        onCoTeachers={() => setCoTeachersOpen(true)}
        ipynb={ipynb}
      />

      {children}

      {currentTeam && !teacherMode && <TeamChat classId={session.id} team={currentTeam} />}

      {quiz.item && !teacherMode && !quizzesOpen && (
        <LiveBanner
          icon={<Brain size={16} />}
          title={quiz.item.title}
          remaining={quiz.remaining}
          status={
            quiz.answered ? (
              <>
                <CheckCircle2 size={13} /> پاسخ دادی
              </>
            ) : (
              <>
                <Play size={13} /> کلیک کن
              </>
            )
          }
          onClick={() => {
            setQuizFromBanner(true);
            setQuizzesOpen(true);
          }}
        />
      )}
      {comp.item && !teacherMode && !competitionsOpen && (
        <LiveBanner
          icon={<Flag size={16} />}
          title={comp.item.title}
          remaining={comp.remaining}
          status={
            !currentTeam ? (
              <>
                <AlertTriangle size={13} /> اول تیم انتخاب کن
              </>
            ) : comp.answered ? (
              <>
                <CheckCircle2 size={13} /> پاسخ تیم ثبت شد
              </>
            ) : (
              <>
                <Play size={13} /> کلیک کن
              </>
            )
          }
          offset={quiz.item && !quizzesOpen ? 56 : 0}
          onClick={() => {
            setCompFromBanner(true);
            setCompetitionsOpen(true);
          }}
        />
      )}

      {exercisesOpen && (
        <ExercisesModal
          classId={session.id}
          teacherMode={teacherMode}
          onClose={() => {
            setExercisesOpen(false);
            loadExerciseBadge();
          }}
        />
      )}
      {quizzesOpen && (
        <QuizzesModal
          classId={session.id}
          teacherMode={teacherMode}
          initialTakeActive={quizFromBanner}
          onClose={() => {
            setQuizzesOpen(false);
            quiz.reload();
          }}
        />
      )}
      {competitionsOpen && (
        <CompetitionsModal
          classId={session.id}
          teacherMode={teacherMode}
          currentTeam={currentTeam}
          initialTakeActive={compFromBanner}
          onNeedTeam={() => setTeamPickerOpen(true)}
          onClose={() => {
            setCompetitionsOpen(false);
            comp.reload();
          }}
        />
      )}

      <ProfileModal open={profileOpen || needsProfile} firstTime={needsProfile} onClose={() => setProfileOpen(false)} />
      <TeamPicker open={teamPickerOpen} onClose={() => setTeamPickerOpen(false)} classId={session.id} currentTeam={currentTeam} onTeamChange={setCurrentTeam} />

      {shareOpen && (
        <div
          className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm anim-fade flex items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && setShareOpen(false)}
        >
          <div className="bg-white rounded-2xl shadow-2xl anim-pop w-full max-w-sm p-6">
            <div className="text-center mb-5">
              <div className="w-14 h-14 mx-auto rounded-2xl grid place-items-center text-2xl text-white shadow-glow mb-3" style={{ background: "var(--grad)" }}>
                <GraduationCap size={26} />
              </div>
              <h2 className="font-extrabold">{session.title}</h2>
              <p className="text-xs text-muted mt-1">کد یا لینک رو برای دانشجوها بفرست</p>
            </div>
            <div className="text-center text-3xl font-extrabold tracking-[0.35em] grad-text py-2 mb-3">{session.code}</div>
            <div className="flex gap-2 mb-2">
              <button onClick={() => copy(session.code, "کد کپی شد")} className="btn-ghost flex-1">
                <Copy size={15} /> کپی کد
              </button>
              <button onClick={() => copy(`${window.location.origin}/class/${session.code}`, "لینک کپی شد")} className="btn-primary flex-1">
                <Link2 size={15} /> کپی لینک
              </button>
            </div>
            <button onClick={leaveClass} className="w-full mt-3 py-2 text-sm font-bold text-danger hover:bg-red-50 rounded-xl transition flex items-center justify-center gap-1.5">
              <LogOut size={15} /> خروج از کلاس
            </button>
          </div>
        </div>
      )}

      {coTeachersOpen && (
        <CoTeachersModal
          classId={session.id}
          ownerId={session.created_by}
          onClose={() => {
            setCoTeachersOpen(false);
            loadCoTeachers();
          }}
        />
      )}
    </div>
  );
}
