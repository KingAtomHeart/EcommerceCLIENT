import { useContext } from 'react';
import AddToOrderContext from '../context/AddToOrderContext';

export default function AddToOrderBanner() {
  const { token, info, clear } = useContext(AddToOrderContext);
  if (!token || !info) return null;
  return (
    <div style={{
      background: 'var(--accent)', color: '#fff',
      padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center',
      gap: 14, fontSize: '0.86rem', flexWrap: 'wrap', position: 'sticky', top: 'var(--nav-h, 64px)', zIndex: 50
    }}>
      <span>
        Add-to-order mode: items will be appended to <strong>{info.targetLabel}</strong>. Shipping is free.
      </span>
      <button onClick={clear} style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', padding: '4px 12px', borderRadius: 'var(--radius-pill)', fontSize: '0.78rem', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
        Exit mode
      </button>
    </div>
  );
}
