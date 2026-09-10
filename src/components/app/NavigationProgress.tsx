"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    setVisible(true);
    setProgress(18);
    const tick = window.setInterval(() => {
      setProgress((value) => Math.min(value + 12 + Math.random() * 18, 88));
    }, 180);
    const done = window.setTimeout(() => {
      setProgress(100);
      window.setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 220);
    }, 420);

    return () => {
      window.clearInterval(tick);
      window.clearTimeout(done);
    };
  }, [pathname, searchParams]);

  if (!visible) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-1.5 overflow-hidden bg-transparent"
      aria-hidden="true"
    >
      <div
        className="h-full origin-left rounded-r-full bg-[linear-gradient(90deg,#c10089_0%,#00aab3_100%)] shadow-[0_0_14px_rgba(193,0,137,0.5)] transition-[width] duration-200 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
