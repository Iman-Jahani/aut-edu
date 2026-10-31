import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export interface Crumb {
  label: string;
  href?: string;
}

/**
 * "داشبورد ‹ کلاس ‹ جلسه" — every earlier step is a link back, the last one is where you are.
 * On narrow screens only the last two steps are shown so it never wraps.
 */
export default function Breadcrumbs({ items, className = "" }: { items: Crumb[]; className?: string }) {
  return (
    <nav aria-label="مسیر صفحه" className={`min-w-0 ${className}`}>
      <ol className="flex items-center gap-1 text-xs min-w-0">
        {items.map((c, i) => {
          const last = i === items.length - 1;
          const hideOnMobile = i < items.length - 2;
          if (last) {
            return (
              <li key={i} aria-current="page" className="font-extrabold text-sm text-ink truncate">
                {c.label}
              </li>
            );
          }
          return (
            <li key={i} className={`items-center gap-1 min-w-0 shrink-0 max-w-[10rem] ${hideOnMobile ? "hidden sm:flex" : "flex"}`}>
              {c.href ? (
                <Link href={c.href} className="text-muted hover:text-primary transition truncate">
                  {c.label}
                </Link>
              ) : (
                <span className="text-muted truncate">{c.label}</span>
              )}
              <ChevronLeft size={12} className="text-muted/60 shrink-0" />
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
