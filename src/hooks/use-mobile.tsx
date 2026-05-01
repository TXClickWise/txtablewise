import * as React from "react";

const MOBILE_BREAKPOINT = 768;
// Onder dit punt wil de sidebar zich als overlay/sheet gedragen i.p.v. vaste kolom.
// Komt overeen met 'desktop' uit use-breakpoint (>=1280): tablet portrait én landscape
// krijgen dus een collapsible sidebar i.p.v. permanent open.
export const SIDEBAR_OVERLAY_BREAKPOINT = 1280;

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    mql.addEventListener("change", onChange);
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return !!isMobile;
}

/**
 * True voor mobiel + tablet (portrait & landscape).
 * Sidebar gebruikt dit om onder 1280px als Sheet-overlay te tonen.
 */
export function useIsBelowDesktop() {
  const [below, setBelow] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${SIDEBAR_OVERLAY_BREAKPOINT - 1}px)`);
    const onChange = () => setBelow(window.innerWidth < SIDEBAR_OVERLAY_BREAKPOINT);
    mql.addEventListener("change", onChange);
    setBelow(window.innerWidth < SIDEBAR_OVERLAY_BREAKPOINT);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return !!below;
}
