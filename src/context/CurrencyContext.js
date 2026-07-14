import { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { apiFetch } from '../utils/api';

/* Storefront display currency. Prices are stored and CHARGED in PHP (the base);
   this only converts what shoppers SEE. The selected currency is remembered per
   visitor; live PHP-based rates come from the server (which caches a free FX API). */

const CurrencyContext = createContext();

// Currencies offered in the picker. Intl.NumberFormat derives each symbol and
// decimal behaviour from the code (e.g. JPY shows no decimals) — no manual table.
export const SUPPORTED_CURRENCIES = [
  { code: 'PHP', label: 'Philippine Peso' },
  { code: 'USD', label: 'US Dollar' },
  { code: 'EUR', label: 'Euro' },
  { code: 'GBP', label: 'British Pound' },
  { code: 'JPY', label: 'Japanese Yen' },
  { code: 'AUD', label: 'Australian Dollar' },
  { code: 'CAD', label: 'Canadian Dollar' },
  { code: 'SGD', label: 'Singapore Dollar' },
  { code: 'HKD', label: 'Hong Kong Dollar' },
  { code: 'KRW', label: 'South Korean Won' },
  { code: 'CNY', label: 'Chinese Yuan' },
  { code: 'MYR', label: 'Malaysian Ringgit' },
  { code: 'THB', label: 'Thai Baht' },
  { code: 'AED', label: 'UAE Dirham' },
];

const STORAGE_KEY = 'ok_currency';

export function CurrencyProvider({ children }) {
  const [currency, setCurrencyState] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return SUPPORTED_CURRENCIES.some(c => c.code === saved) ? saved : 'PHP';
  });
  const [rates, setRates] = useState({ PHP: 1 });

  useEffect(() => {
    apiFetch('/currency/rates')
      .then(d => { if (d?.rates) setRates({ ...d.rates, PHP: 1 }); })
      .catch(() => { /* keep PHP-only — display just stays in pesos */ });
  }, []);

  const setCurrency = useCallback((code) => {
    if (!SUPPORTED_CURRENCIES.some(c => c.code === code)) return;
    setCurrencyState(code);
    localStorage.setItem(STORAGE_KEY, code);
  }, []);

  // Rate of `currency` per 1 PHP. If a rate is missing, fall back to PHP (1:1).
  const rate = currency === 'PHP' ? 1 : (rates[currency] || 1);
  const rateReady = currency === 'PHP' || !!rates[currency];

  const convert = useCallback((php) => (Number(php) || 0) * rate, [rate]);

  // Format a PHP amount in the selected currency. Non-PHP conversions are
  // approximate (display only), so we prefix "≈" to be honest about it.
  const format = useCallback((php) => {
    const value = (Number(php) || 0) * rate;
    let str;
    try {
      str = new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(value);
    } catch {
      str = `${currency} ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return currency === 'PHP' ? str : `≈ ${str}`;
  }, [rate, currency]);

  // Signed modifier ("+₱3,300" / "+$59"), currency-aware. Mirrors priceDelta but
  // converts. Returns null for zero/blank so callers can render nothing.
  const formatDelta = useCallback((php) => {
    const num = Number(php);
    if (!num || Number.isNaN(num)) return null;
    const value = Math.abs(num) * rate;
    let str;
    try {
      str = new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: currency === 'PHP' ? 0 : 2 }).format(value);
    } catch {
      str = `${currency} ${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
    }
    return num > 0 ? `+${str}` : `−${str}`;
  }, [rate, currency]);

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, rates, rate, rateReady, convert, format, formatDelta, supported: SUPPORTED_CURRENCIES }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export const useCurrency = () => useContext(CurrencyContext);

export default CurrencyContext;
