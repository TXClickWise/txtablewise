// useKeyboardInset — exposes the on-screen keyboard height as a CSS variable
// (--kb-inset) on <html>, by listening to window.visualViewport.
// Falls back to 0 when the visual viewport API is not available.
// Mount once at the app root (e.g. in App.tsx).
import { useEffect } from "react";

export function useKeyboardInset() {
  useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (!vv) return;

    const update = () => {
      // Keyboard inset = the difference between the layout viewport (innerHeight)
      // and the visual viewport (vv.height). When the keyboard is hidden, both
      // are equal, so the value is 0.
      const inset = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
      document.documentElement.style.setProperty("--kb-inset", `${inset}px`);
    };

    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      document.documentElement.style.removeProperty("--kb-inset");
    };
  }, []);
}

export function KeyboardInsetMount() {
  useKeyboardInset();
  return null;
}
