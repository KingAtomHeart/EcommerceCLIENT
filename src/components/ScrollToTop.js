import { useEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

// Resets scroll on route change so navigating from a deep scroll position
// doesn't dump the user partway down the next page. Skips:
//   * URLs with a hash (`/products#products`) — anchors land themselves
//   * back/forward navigation (POP) — browser restores the previous position
// Used by both admin and customer routes since it sits at the App root.
export default function ScrollToTop() {
  const { pathname, hash } = useLocation();
  const navType = useNavigationType();

  useEffect(() => {
    if (navType === 'POP') return;
    if (hash) {
      // Defer one frame so the destination has rendered before we try to
      // find the anchor. Falls back to top when the anchor is missing.
      requestAnimationFrame(() => {
        const el = document.getElementById(hash.slice(1));
        if (el) el.scrollIntoView({ block: 'start' });
        else window.scrollTo(0, 0);
      });
      return;
    }
    window.scrollTo(0, 0);
  }, [pathname, hash, navType]);

  return null;
}
