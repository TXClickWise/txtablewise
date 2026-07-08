import { useEffect, useRef, useState, type ReactNode, type ElementType } from "react";
import { cn } from "@/lib/utils";

interface RevealOnScrollProps {
  children: ReactNode;
  as?: ElementType;
  className?: string;
  delayMs?: number;
  threshold?: number;
}

/**
 * Wraps content and reveals it (fade + translateY) once it enters the viewport.
 * Purely presentational — uses the existing `.reveal` / `.reveal.visible` CSS.
 */
export function RevealOnScroll({
  children,
  as: Tag = "div",
  className,
  delayMs = 0,
  threshold = 0.15,
}: RevealOnScrollProps) {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || visible) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            io.disconnect();
            break;
          }
        }
      },
      { threshold, rootMargin: "0px 0px -40px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold, visible]);

  return (
    <Tag
      ref={ref as never}
      className={cn("reveal", visible && "visible", className)}
      style={delayMs ? { transitionDelay: `${delayMs}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}
