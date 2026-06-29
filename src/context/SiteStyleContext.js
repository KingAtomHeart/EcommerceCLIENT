import { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { apiFetch } from '../utils/api';

const SiteStyleContext = createContext();

export const VALID_STYLES = ['classic', 'minimal', 'pastel-paper', 'pixel'];

// Persists the admin-chosen site-wide visual style. Mirrors ThemeContext (which
// handles light/dark per-visitor) but the source of truth is the server so
// every visitor sees what the admin picked.
//
// `localStorage.ok_site_style` is only a cache to avoid a flash-of-classic
// while the GET resolves. The fetched value always wins.
export const SiteStyleProvider = ({ children }) => {
  const [style, setStyleState] = useState(() => {
    const cached = localStorage.getItem('ok_site_style');
    return VALID_STYLES.includes(cached) ? cached : 'classic';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-style', style);
    localStorage.setItem('ok_site_style', style);
  }, [style]);

  useEffect(() => {
    let cancelled = false;
    apiFetch('/site-settings')
      .then(data => {
        if (cancelled) return;
        if (VALID_STYLES.includes(data?.style)) setStyleState(data.style);
      })
      .catch(() => { /* keep cached value */ });
    return () => { cancelled = true; };
  }, []);

  // Admin call. Optimistic update; reverts if the PATCH fails.
  const setStyle = useCallback(async (next) => {
    if (!VALID_STYLES.includes(next)) throw new Error('Invalid style');
    const prev = style;
    setStyleState(next);
    try {
      const data = await apiFetch('/site-settings', {
        method: 'PATCH',
        body: JSON.stringify({ style: next }),
      });
      if (VALID_STYLES.includes(data?.style)) setStyleState(data.style);
    } catch (err) {
      setStyleState(prev);
      throw err;
    }
  }, [style]);

  return (
    <SiteStyleContext.Provider value={{ style, setStyle }}>
      {children}
    </SiteStyleContext.Provider>
  );
};

export const useSiteStyle = () => useContext(SiteStyleContext);

export default SiteStyleContext;
