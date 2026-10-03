"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import type { CurrentTeam } from "@/components/TeamPicker";
import type { ClassSession } from "@/lib/types";

function teamKey(sessionId: string, k: "Id" | "Name" | "Color") {
  return `team${k}_${sessionId}`;
}
function getStoredTeam(sessionId: string): CurrentTeam | null {
  if (typeof window === "undefined") return null;
  const id = localStorage.getItem(teamKey(sessionId, "Id"));
  const name = localStorage.getItem(teamKey(sessionId, "Name"));
  const color = localStorage.getItem(teamKey(sessionId, "Color"));
  if (id && name) return { id, name, color: color || "#6366f1" };
  return null;
}
function storeTeam(sessionId: string, t: CurrentTeam) {
  localStorage.setItem(teamKey(sessionId, "Id"), t.id);
  localStorage.setItem(teamKey(sessionId, "Name"), t.name);
  localStorage.setItem(teamKey(sessionId, "Color"), t.color);
}
function clearStoredTeam(sessionId: string) {
  localStorage.removeItem(teamKey(sessionId, "Id"));
  localStorage.removeItem(teamKey(sessionId, "Name"));
  localStorage.removeItem(teamKey(sessionId, "Color"));
}

/**
 * Everything both class pages (the meetings list and a single meeting's
 * notebook) need in common: loading the class by code, the auth guard,
 * owner/co-teacher permission, the "preview as student" toggle, the
 * selected team, and marking the class as visited for the student dashboard.
 */
export function useClassAccess(code: string) {
  const router = useRouter();
  const { user, ready } = useAuth();

  const [session, setSession] = useState<ClassSession | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [currentTeam, setCurrentTeamState] = useState<CurrentTeam | null>(null);
  const [coTeacherIds, setCoTeacherIds] = useState<string[] | null>(null);
  const [previewAsStudent, setPreviewAsStudent] = useState(false);

  const { displayName } = useAuth();

  useEffect(() => {
    if (ready && !user) router.replace("/login?next=/class/" + code.toUpperCase());
  }, [ready, user, router, code]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("class_sessions").select("*").eq("code", code.toUpperCase()).maybeSingle();
      if (!data) {
        setNotFound(true);
        return;
      }
      setSession(data);
      localStorage.setItem("lastSessionCode", data.code);
      setCurrentTeamState(getStoredTeam(data.id));
    })();
  }, [code]);

  const loadCoTeachers = useCallback(async () => {
    if (!session) return;
    const { data } = await supabase.from("class_teachers").select("user_id").eq("class_id", session.id);
    setCoTeacherIds((data || []).map((r) => r.user_id));
  }, [session]);

  useEffect(() => {
    loadCoTeachers();
  }, [loadCoTeachers]);

  const isOwner = !!session && !!user && session.created_by === user.id;
  const isCoTeacher = !!user && !!coTeacherIds && coTeacherIds.includes(user.id);
  const isTeacher = isOwner || isCoTeacher;
  const teacherMode = isTeacher && !previewAsStudent;

  // Track that this (non-teacher) user has visited the class, for their student dashboard.
  useEffect(() => {
    if (!session || !user || !displayName) return;
    if (isOwner || isCoTeacher) return;
    supabase
      .from("class_members")
      .upsert(
        { class_id: session.id, user_id: user.id, display_name: displayName, last_seen_at: new Date().toISOString() },
        { onConflict: "class_id,user_id" }
      )
      .then(() => undefined);
  }, [session, user, displayName, isOwner, isCoTeacher]);

  const setCurrentTeam = (team: CurrentTeam | null) => {
    if (!session) return;
    setCurrentTeamState(team);
    if (team) storeTeam(session.id, team);
    else clearStoredTeam(session.id);
  };

  const leaveClass = () => {
    if (!confirm("از کلاس خارج می‌شوی؟")) return;
    localStorage.removeItem("lastSessionCode");
    router.push("/dashboard");
  };

  return {
    ready,
    user,
    session,
    notFound,
    isOwner,
    isCoTeacher,
    isTeacher,
    previewAsStudent,
    setPreviewAsStudent,
    teacherMode,
    currentTeam,
    setCurrentTeam,
    coTeacherIds,
    loadCoTeachers,
    leaveClass,
  };
}
