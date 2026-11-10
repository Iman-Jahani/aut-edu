"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { preloadPyodide } from "@/lib/pyodide";
import { useClassAccess } from "@/hooks/useClassAccess";
import ClassChrome from "@/components/ClassChrome";
import MaterialSection from "@/components/MaterialSection";
import { ClassPageSkeleton } from "@/components/Skeleton";
import { Search } from "lucide-react";
import type { ClassNote } from "@/lib/types";

export default function NotePage({ params }: { params: { code: string; noteId: string } }) {
  const access = useClassAccess(params.code);
  const { ready, session, notFound, teacherMode } = access;
  const [note, setNote] = useState<ClassNote | null>(null);
  const [noteMissing, setNoteMissing] = useState(false);

  useEffect(() => {
    preloadPyodide();
  }, []);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("class_notes").select("*").eq("id", params.noteId).maybeSingle();
      if (!data) return setNoteMissing(true);
      setNote(data as ClassNote);
    })();
  }, [params.noteId]);

  if (notFound || noteMissing || (note && session && note.class_id !== session.id)) {
    return (
      <div className="min-h-screen grid place-items-center p-6 text-center">
        <div className="card p-10 max-w-sm anim-pop">
          <Search size={44} className="mx-auto mb-3 text-primary/40" />
          <h1 className="font-extrabold text-lg mb-2">{notFound ? "کلاسی با این کد پیدا نشد" : "این جزوه پیدا نشد"}</h1>
          <Link href={notFound ? "/dashboard" : `/class/${params.code}/notes`} className="btn-primary">
            بازگشت
          </Link>
        </div>
      </div>
    );
  }
  if (!ready || !session || !note) return <ClassPageSkeleton />;

  return (
    <ClassChrome access={access} section="notes" meetingTitle={note.title}>
      <main className="max-w-4xl mx-auto px-4 py-6">
        <MaterialSection
          kind="notes"
          classId={session.id}
          scopeId={note.id}
          teacherMode={teacherMode}
        />
      </main>
    </ClassChrome>
  );
}
