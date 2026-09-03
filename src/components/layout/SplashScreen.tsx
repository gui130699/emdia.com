import { useEffect, useState } from "react";
import { TrendingUp } from "lucide-react";

const SESSION_KEY = "emdia:splashShown";
const DURATION_MS = 2400;
const REDUCED_DURATION_MS = 900;

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/** A short, premium launch animation — point, circle draws, check draws,
 * wordmark, slogan — shown once per session (not on every navigation) and
 * never blocking: it always resolves on its own fixed timer regardless of
 * what's still loading underneath. */
export default function SplashScreen() {
  const [visible, setVisible] = useState(() => {
    try {
      return sessionStorage.getItem(SESSION_KEY) !== "1";
    } catch {
      return true;
    }
  });
  const [fadingOut, setFadingOut] = useState(false);
  const [reduced] = useState(prefersReducedMotion);

  useEffect(() => {
    if (!visible) return;
    try {
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      /* private mode / storage unavailable — splash just shows every time, harmless */
    }
    const duration = reduced ? REDUCED_DURATION_MS : DURATION_MS;
    const fadeTimer = setTimeout(() => setFadingOut(true), duration - 300);
    const hideTimer = setTimeout(() => setVisible(false), duration);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, [visible, reduced]);

  if (!visible) return null;

  return (
    <div
      className={`splash-overlay ${fadingOut ? "splash-fade-out" : ""} ${reduced ? "splash-reduced" : ""}`}
      role="presentation"
      aria-hidden="true"
    >
      <div className="splash-content">
        <svg className="splash-badge" viewBox="0 0 24 24" fill="none">
          <circle className="splash-circle" cx="12" cy="12" r="9" />
          <path className="splash-check" d="m8 12.5 2.5 2.5 5-5.5" />
        </svg>
        <p className="splash-wordmark">EM DIA</p>
        <p className="splash-slogan">Seu dinheiro. Sempre em dia.</p>
        <TrendingUp className="splash-icon" size={16} />
      </div>
    </div>
  );
}
