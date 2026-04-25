import * as React from "react";

/**
 * Tablet-first breakpoints aligned met TableWise UX-richtlijn:
 * - mobile:           < 768
 * - tablet portrait:  768 – 1023
 * - tablet landscape: 1024 – 1279
 * - desktop:          >= 1280
 */
export type Breakpoint = "mobile" | "tablet-portrait" | "tablet-landscape" | "desktop";

function compute(width: number): Breakpoint {
  if (width < 768) return "mobile";
  if (width < 1024) return "tablet-portrait";
  if (width < 1280) return "tablet-landscape";
  return "desktop";
}

export function useBreakpoint(): Breakpoint {
  const [bp, setBp] = React.useState<Breakpoint>(() =>
    typeof window === "undefined" ? "desktop" : compute(window.innerWidth)
  );

  React.useEffect(() => {
    const onResize = () => setBp(compute(window.innerWidth));
    window.addEventListener("resize", onResize);
    onResize();
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return bp;
}

export function useIsTablet() {
  const bp = useBreakpoint();
  return bp === "tablet-portrait" || bp === "tablet-landscape";
}

export function useIsTabletLandscapeOrLarger() {
  const bp = useBreakpoint();
  return bp === "tablet-landscape" || bp === "desktop";
}

export function useIsCompact() {
  // mobile of tablet-portrait → bottom sheets ipv side panels
  const bp = useBreakpoint();
  return bp === "mobile" || bp === "tablet-portrait";
}
