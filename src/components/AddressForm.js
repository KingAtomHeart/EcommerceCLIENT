import { PROVINCE_GROUPS } from '../utils/shipping';

const empty = { fullName: '', phone: '', street: '', city: '', province: '', postalCode: '', isDefault: false };

export function emptyAddress() { return { ...empty }; }

export default function AddressForm({ value, onChange, showDefaultToggle = true, compact = false }) {
  const v = value || empty;
  const set = (k) => (e) => onChange({ ...v, [k]: e.target.value });
  const toggle = (k) => (e) => onChange({ ...v, [k]: e.target.checked });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? '10px' : '14px' }}>
      <div className="form-row-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: compact ? '10px' : '14px' }}>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Full name</label>
          <input className="form-input" value={v.fullName} onChange={set('fullName')} />
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Mobile number</label>
          <input className="form-input" value={v.phone} onChange={set('phone')} />
        </div>
      </div>
      <div className="form-group" style={{ margin: 0 }}>
        <label className="form-label">Street address</label>
        <input className="form-input" placeholder="Unit / House no., street, barangay" value={v.street} onChange={set('street')} />
      </div>
      <div className="form-row-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: compact ? '10px' : '14px' }}>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">City / Municipality</label>
          <input className="form-input" value={v.city} onChange={set('city')} />
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Province</label>
          <select className="form-input" value={v.province} onChange={set('province')}>
            <option value="">Select a province…</option>
            {PROVINCE_GROUPS.map(group => (
              <optgroup key={group.region} label={group.region === 'NCR' ? 'Metro Manila' : group.region[0] + group.region.slice(1).toLowerCase()}>
                {group.provinces.map(p => <option key={p} value={p}>{p}</option>)}
              </optgroup>
            ))}
          </select>
        </div>
      </div>
      <div className="form-group" style={{ margin: 0 }}>
        <label className="form-label">Postal code (optional)</label>
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

// asdfasdfasdfasdfasdfasdfasdfasdfasdf