import { PROVINCE_GROUPS } from '../utils/shipping';
import { COUNTRIES, countryByName, splitPhone } from '../utils/countries';

const empty = { fullName: '', phone: '', street: '', city: '', province: '', postalCode: '', country: 'Philippines', isDefault: false };

export function emptyAddress() { return { ...empty }; }

export default function AddressForm({ value, onChange, showDefaultToggle = true, compact = false }) {
  const v = value || empty;
  const country = v.country || 'Philippines';
  const isPH = country === 'Philippines';
  const { dial, local } = splitPhone(v.phone, country);

  const set = (k) => (e) => onChange({ ...v, [k]: e.target.value });
  const toggle = (k) => (e) => onChange({ ...v, [k]: e.target.checked });

  // Switching country resets the region (PH uses a fixed province list; other
  // countries use free text) and re-defaults the phone's dial code to the new
  // country's — keeping whatever local digits were already entered.
  const setCountry = (e) => {
    const name = e.target.value;
    const c = countryByName(name);
    onChange({ ...v, country: name, province: '', phone: `${c?.dial || dial} ${local}`.trim() });
  };
  const setDial = (e) => onChange({ ...v, phone: `${e.target.value} ${local}`.trim() });
  const setLocalPhone = (e) => onChange({ ...v, phone: `${dial} ${e.target.value}`.trim() });

  const gap = compact ? '10px' : '14px';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap }}>
      <div className="form-group" style={{ margin: 0 }}>
        <label className="form-label">Country</label>
        <select className="form-input" value={country} onChange={setCountry} style={{ cursor: 'pointer' }}>
          {COUNTRIES.map(c => <option key={c.iso2} value={c.name}>{c.name}</option>)}
        </select>
      </div>

      <div className="form-row-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap }}>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Full name</label>
          <input className="form-input" value={v.fullName} onChange={set('fullName')} />
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Phone number</label>
          <div style={{ display: 'flex', gap: 6 }}>
            <select className="form-input" value={dial} onChange={setDial} aria-label="Country code"
              style={{ width: 'auto', flexShrink: 0, cursor: 'pointer', paddingRight: 8 }}>
              {COUNTRIES.map(c => <option key={c.iso2} value={c.dial}>{c.iso2} {c.dial}</option>)}
            </select>
            <input className="form-input" value={local} onChange={setLocalPhone} placeholder="Phone number" style={{ minWidth: 0 }} />
          </div>
        </div>
      </div>

      <div className="form-group" style={{ margin: 0 }}>
        <label className="form-label">Street address</label>
        <input className="form-input" placeholder={isPH ? 'Unit / House no., street, barangay' : 'Street address, apt, suite'} value={v.street} onChange={set('street')} />
      </div>

      <div className="form-row-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap }}>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">City {isPH ? '/ Municipality' : ''}</label>
          <input className="form-input" value={v.city} onChange={set('city')} />
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">{isPH ? 'Province' : 'State / Region / Province'}</label>
          {isPH ? (
            <select className="form-input" value={v.province} onChange={set('province')} style={{ cursor: 'pointer' }}>
              <option value="">Select a province…</option>
              {PROVINCE_GROUPS.map(group => (
                <optgroup key={group.region} label={group.region === 'NCR' ? 'Metro Manila' : group.region[0] + group.region.slice(1).toLowerCase()}>
                  {group.provinces.map(p => <option key={p} value={p}>{p}</option>)}
                </optgroup>
              ))}
            </select>
          ) : (
            <input className="form-input" value={v.province} onChange={set('province')} placeholder="State / region" />
          )}
        </div>
      </div>

      <div className="form-group" style={{ margin: 0 }}>
        <label className="form-label">Postal code{isPH ? ' (optional)' : ''}</label>
        <input className="form-input" value={v.postalCode} onChange={set('postalCode')} />
      </div>

      {showDefaultToggle && (
        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.88rem', color: 'var(--ink-muted)', cursor: 'pointer' }}>
          <input type="checkbox" checked={!!v.isDefault} onChange={toggle('isDefault')} style={{ accentColor: 'var(--ink)' }} />
          Set as default address
        </label>
      )}
    </div>
  );
}
