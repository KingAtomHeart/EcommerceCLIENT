// Country list for the global address form + phone country codes. `dial` is the
// international dialing prefix. Kept to a broad, practical set of markets; add
// more entries here as needed. Philippines is first so it stays the default.

export const COUNTRIES = [
  { name: 'Philippines', iso2: 'PH', dial: '+63' },
  { name: 'United States', iso2: 'US', dial: '+1' },
  { name: 'Canada', iso2: 'CA', dial: '+1' },
  { name: 'United Kingdom', iso2: 'GB', dial: '+44' },
  { name: 'Australia', iso2: 'AU', dial: '+61' },
  { name: 'New Zealand', iso2: 'NZ', dial: '+64' },
  { name: 'Singapore', iso2: 'SG', dial: '+65' },
  { name: 'Malaysia', iso2: 'MY', dial: '+60' },
  { name: 'Indonesia', iso2: 'ID', dial: '+62' },
  { name: 'Thailand', iso2: 'TH', dial: '+66' },
  { name: 'Vietnam', iso2: 'VN', dial: '+84' },
  { name: 'Japan', iso2: 'JP', dial: '+81' },
  { name: 'South Korea', iso2: 'KR', dial: '+82' },
  { name: 'China', iso2: 'CN', dial: '+86' },
  { name: 'Hong Kong', iso2: 'HK', dial: '+852' },
  { name: 'Taiwan', iso2: 'TW', dial: '+886' },
  { name: 'India', iso2: 'IN', dial: '+91' },
  { name: 'United Arab Emirates', iso2: 'AE', dial: '+971' },
  { name: 'Saudi Arabia', iso2: 'SA', dial: '+966' },
  { name: 'Qatar', iso2: 'QA', dial: '+974' },
  { name: 'Germany', iso2: 'DE', dial: '+49' },
  { name: 'France', iso2: 'FR', dial: '+33' },
  { name: 'Netherlands', iso2: 'NL', dial: '+31' },
  { name: 'Belgium', iso2: 'BE', dial: '+32' },
  { name: 'Spain', iso2: 'ES', dial: '+34' },
  { name: 'Italy', iso2: 'IT', dial: '+39' },
  { name: 'Portugal', iso2: 'PT', dial: '+351' },
  { name: 'Ireland', iso2: 'IE', dial: '+353' },
  { name: 'Switzerland', iso2: 'CH', dial: '+41' },
  { name: 'Austria', iso2: 'AT', dial: '+43' },
  { name: 'Sweden', iso2: 'SE', dial: '+46' },
  { name: 'Norway', iso2: 'NO', dial: '+47' },
  { name: 'Denmark', iso2: 'DK', dial: '+45' },
  { name: 'Finland', iso2: 'FI', dial: '+358' },
  { name: 'Poland', iso2: 'PL', dial: '+48' },
  { name: 'Czech Republic', iso2: 'CZ', dial: '+420' },
  { name: 'Mexico', iso2: 'MX', dial: '+52' },
  { name: 'Brazil', iso2: 'BR', dial: '+55' },
  { name: 'Argentina', iso2: 'AR', dial: '+54' },
  { name: 'Chile', iso2: 'CL', dial: '+56' },
  { name: 'South Africa', iso2: 'ZA', dial: '+27' },
  { name: 'Turkey', iso2: 'TR', dial: '+90' },
  { name: 'Israel', iso2: 'IL', dial: '+972' },
];

// Dial codes longest-first, so prefix matching picks "+971" over "+9".
const DIALS_BY_LEN = [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);

export function countryByName(name) {
  return COUNTRIES.find(c => c.name === name);
}

// Split a stored phone (which may include its dial code, e.g. "+63 9171234567")
// into { dial, local }. Falls back to the given country's dial code (or PH).
export function splitPhone(phone = '', countryName = 'Philippines') {
  const p = String(phone || '').trim();
  for (const c of DIALS_BY_LEN) {
    if (p.startsWith(c.dial)) return { dial: c.dial, local: p.slice(c.dial.length).trim() };
  }
  const def = countryByName(countryName) || countryByName('Philippines');
  return { dial: def?.dial || '+63', local: p };
}
