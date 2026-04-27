import { createContext, useState, useEffect, useCallback } from 'react';

const AddToOrderContext = createContext(null);

const STORAGE_KEY = 'addToOrderToken';
const STORAGE_INFO_KEY = 'addToOrderInfo';

export function AddToOrderProvider({ children }) {
  const [token, setTokenState] = useState(() => sessionStorage.getItem(STORAGE_KEY) || null);
  const [info, setInfoState] = useState(() => {
    const raw = sessionStorage.getItem(STORAGE_INFO_KEY);
    try { return raw ? JSON.parse(raw) : null; } catch { return null; }
  });

  const setToken = useCallback((t, i) => {
    if (t) {
      sessionStorage.setItem(STORAGE_KEY, t);
      if (i) sessionStorage.setItem(STORAGE_INFO_KEY, JSON.stringify(i));
      setTokenState(t);
      setInfoState(i || null);
    } else {
      sessionStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem(STORAGE_INFO_KEY);
      setTokenState(null);
      setInfoState(null);
    }
  }, []);

  const clear = useCallback(() => setToken(null), [setToken]);

  // Auto-clear if expired
  useEffect(() => {
    if (info?.expiresAt && new Date(info.expiresAt) < new Date()) clear();
  }, [info, clear]);

  return (
    <AddToOrderContext.Provider value={{ token, info, setToken, clear }}>
      {children}
    </AddToOrderContext.Provider>
  );
}

export default AddToOrderContext;
