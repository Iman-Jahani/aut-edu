"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Renders children directly under <body>. Needed for modals: headers use `backdrop-filter`, which makes
 * any `position: fixed` descendant position itself against the header instead of the screen (so a modal
 * opened from a header menu ends up half off-screen). Also locks page scroll while mounted.
 */
export default function Portal({ children, lockScroll = true }: { children: React.ReactNode; lockScroll?: boolean }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!lockScroll) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [lockScroll]);
  return mounted ? createPortal(children, document.body) : null;
}
