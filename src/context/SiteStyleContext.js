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
  const initial = (() => {
    const cached = localStorage.getItem('ok_site_style');
    return VALID_STYLES.includes(cached) ? cached : 'classic';
  })();
  // `style` is what's currently APPLIED (drives data-style) — it may be an
  // unsaved preview. `savedStyle` is what's actually persisted on the server.
  const [style, setStyleState] = useState(initial);
  const [savedStyle, setSavedStyle] = useState(initial);

  // Admin-chosen overrides for the built-in navbar link labels ({ key: label }).
  // Cached in localStorage only to avoid a flash of default labels before the GET
  // resolves; the fetched value always wins.
  const [navLabels, setNavLabelsState] = useState(() => {
    try { return JSON.parse(localStorage.getItem('ok_nav_labels')) || {}; }
    catch { return {}; }
  });

  // Applied style drives the live <html> attribute so previews show instantly.
  useEffect(() => {
    document.documentElement.setAttribute('data-style', style);
  }, [style]);
  // Only the SAVED style is cached, so a reload never resurrects an unsaved preview.
  useEffect(() => {
    localStorage.setItem('ok_site_style', savedStyle);
  }, [savedStyle]);

  useEffect(() => {
    let cancelled = false;
    apiFetch('/site-settings')
      .then(data => {
        if (cancelled) return;
        if (VALID_STYLES.includes(data?.style)) { setStyleState(data.style); setSavedStyle(data.style); }
        if (data && typeof data.navLabels === 'object' && data.navLabels !== null) {
          setNavLabelsState(data.navLabels);
          localStorage.setItem('ok_nav_labels', JSON.stringify(data.navLabels));
        }
      })
      .catch(() => { /* keep cached value */ });
    return () => { cancelled = true; };
  }, []);

  // Admin call. Persists navbar label overrides (pushes them live for every
  // visitor). Send the full { key: label } map — blank values clear an override.
  const setNavLabels = useCallback(async (next) => {
    const data = await apiFetch('/site-settings', {
      method: 'PATCH',
      body: JSON.stringify({ navLabels: next }),
    });
    const applied = (data && typeof data.navLabels === 'object' && data.navLabels !== null) ? data.navLabels : next;
    setNavLabelsState(applied);
    localStorage.setItem('ok_nav_labels', JSON.stringify(applied));
    return applied;
  }, []);

  // Apply a style locally for preview only — does NOT persist (won't go live).
  const previewStyle = useCallback((next) => {
    if (VALID_STYLES.includes(next)) setStyleState(next);
  }, []);

  // Admin call. Persists the style (pushes it live for every visitor). Optimistic;
  // reverts to the last saved value if the PATCH fails.
  const setStyle = useCallback(async (next) => {
    if (!VALID_STYLES.includes(next)) throw new Error('Invalid style');
    const prevSaved = savedStyle;
    setStyleState(next);
    try {
      const data = await apiFetch('/site-settings', {
        method: 'PATCH',
        body: JSON.stringify({ style: next }),
      });
      const applied = VALID_STYLES.includes(data?.style) ? data.style : next;
      setStyleState(applied);
      setSavedStyle(applied);
    } catch (err) {
      setStyleState(prevSaved);
      setSavedStyle(prevSaved);
      throw err;
    }
  }, [savedStyle]);

  return (
    <SiteStyleContext.Provider value={{ style, savedStyle, previewStyle, setStyle, navLabels, setNavLabels }}>
      {children}
    </SiteStyleContext.Provider>
  );
};

export const useSiteStyle = () => useContext(SiteStyleContext);

export default SiteStyleContext;
