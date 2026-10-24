import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Renders children at their design height and scales them down (never up) to fit the height this box gets
 * from its parent. Give it a fixed height on small screens and flex-1 where the layout constrains height.
 */
export function FitScale({
  baseHeight,
  className = "",
  children,
}: {
  baseHeight: number;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => {
      const h = entry?.contentRect.height ?? baseHeight;
      setScale(Math.max(0.35, Math.min(1, h / baseHeight)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [baseHeight]);
  return (
    <div ref={ref} className={`relative min-h-0 ${className}`}>
      <div
        className="absolute inset-x-0 top-0 transition-transform duration-300"
        style={{ height: baseHeight, transform: `scale(${scale})`, transformOrigin: "top center" }}
      >
        {children}
      </div>
    </div>
  );
}

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

/** A number that counts up from its previous value with an ease-out curve. */
export function CountUp({ value, duration = 900 }: { value: number; duration?: number }) {
  const [shown, setShown] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    if (prefersReducedMotion()) {
      setShown(value);
      from.current = value;
      return;
    }
    const start = performance.now();
    const begin = from.current;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      setShown(Math.round(begin + (value - begin) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <span className="tabular-nums">{shown.toLocaleString()}</span>;
}

/** Reveals text a few words at a time, like it is being written; `instant` shows it all at once. */
export function RevealText({
  text,
  instant,
  render,
}: {
  text: string;
  instant?: boolean;
  render: (visible: string, done: boolean) => ReactNode;
}) {
  const words = text.split(/(\s+)/);
  const [count, setCount] = useState(instant ? words.length : 0);
  useEffect(() => {
    if (instant || prefersReducedMotion()) {
      setCount(words.length);
      return;
    }
    setCount(0);
    const step = Math.max(2, Math.ceil(words.length / 60));
    const id = setInterval(() => {
      setCount((c) => {
        const next = c + step;
        if (next >= words.length) clearInterval(id);
        return Math.min(words.length, next);
      });
    }, 30);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, instant]);
  const done = count >= words.length;
  return <>{render(words.slice(0, count).join(""), done)}</>;
}

/** A shimmering placeholder block shown while data loads. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-shimmer rounded-xl ${className}`} />;
}
