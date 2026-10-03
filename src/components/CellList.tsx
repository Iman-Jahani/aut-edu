"use client";

import { Fragment, useEffect, useRef, type ReactNode } from "react";
import { CellSkeleton } from "@/components/Skeleton";

function InsertDivider({ onClick, label = "سلول جدید اینجا" }: { onClick: () => void; label?: string }) {
  return (
    <div className="insert-divider group relative h-8 flex items-center justify-center">
      <div className="absolute inset-x-8 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent opacity-0 group-hover:opacity-100 transition" />
      <button
        onClick={onClick}
        className="insert-btn relative z-10 flex items-center gap-1 px-3 py-1 rounded-full bg-white border border-primary/30 text-primary text-[11px] font-bold shadow-soft hover:bg-primary hover:text-white transition-colors"
      >
        <span className="text-sm leading-none">＋</span> {label}
      </button>
    </div>
  );
}

export default function CellList<T>({
  items,
  getId,
  loading,
  highlightId,
  onAdd,
  renderItem,
  emptyIcon,
  emptyTitle,
  emptyDesc,
  showFab = true,
}: {
  items: T[];
  getId: (item: T) => string;
  loading: boolean;
  /** Id of the most-recently-inserted item — CellList scrolls to it and flashes it once. */
  highlightId: string | null;
  onAdd: (afterId?: string | null) => void;
  renderItem: (item: T) => ReactNode;
  emptyIcon: ReactNode;
  emptyTitle: string;
  emptyDesc: string;
  showFab?: boolean;
}) {
  const flashedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!highlightId) return;
    const el = document.getElementById("cell-" + highlightId);
    if (!el) return;
    requestAnimationFrame(() => el.scrollIntoView({ behavior: "smooth", block: "center" }));
    flashedRef.current = highlightId;
    const t = setTimeout(() => {
      if (flashedRef.current === highlightId) flashedRef.current = null;
    }, 1400);
    return () => clearTimeout(t);
  }, [highlightId, items]);

  return (
    <div>
      {loading ? (
        <div className="space-y-4">
          <CellSkeleton />
          <CellSkeleton />
        </div>
      ) : items.length === 0 ? (
        <div className="card text-center py-16 px-6 anim-pop">
          {emptyIcon}
          <h3 className="font-extrabold mb-1">{emptyTitle}</h3>
          <p className="text-sm text-muted mb-5">{emptyDesc}</p>
          <button onClick={() => onAdd()} className="btn-primary mx-auto">
            <span className="text-base leading-none">＋</span> سلول جدید
          </button>
        </div>
      ) : (
        <>
          <InsertDivider onClick={() => onAdd(null)} label="سلول جدید در ابتدا" />
          {items.map((item) => {
            const id = getId(item);
            return (
              <Fragment key={id}>
                <div id={"cell-" + id} className={`scroll-mt-40 rounded-2xl ${highlightId === id ? "cell-flash" : ""}`}>
                  {renderItem(item)}
                </div>
                <InsertDivider onClick={() => onAdd(id)} />
              </Fragment>
            );
          })}
        </>
      )}

      {showFab && items.length > 0 && (
        <button
          onClick={() => onAdd()}
          className="fixed bottom-4 left-4 z-[80] btn-primary !rounded-full !px-5 !py-3.5 shadow-glow"
          aria-label="سلول جدید"
          title="سلول جدید در انتها"
        >
          <span className="text-lg leading-none">＋</span>
          <span className="hidden sm:inline">سلول جدید</span>
        </button>
      )}
    </div>
  );
}
