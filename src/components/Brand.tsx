import Link from "next/link";

/** The site mark: used in every header so the way "home" looks never changes. */
export default function Brand({ href = "/", showName = true }: { href?: string; showName?: boolean }) {
  return (
    <Link href={href} className="flex items-center gap-2.5 font-extrabold text-ink shrink-0" title="صفحه‌ی اصلی">
      <span className="w-9 h-9 rounded-xl bg-primary text-white grid place-items-center font-mono text-sm font-black">{">"}<span className="text-accent">_</span></span>
      {showName && <span className="hidden sm:inline">دفترچه کلاس پایتون</span>}
    </Link>
  );
}
