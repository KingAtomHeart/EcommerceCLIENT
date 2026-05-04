import { useState, useContext, useEffect } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import UserContext from '../context/UserContext';
import { useTheme } from '../context/ThemeContext';

export default function AppNavbar() {
  const { user } = useContext(UserContext);
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => { setMobileOpen(false); }, [location]);
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  const isAdmin = user?.isAdmin;
  const isShopActive = location.pathname === '/products' || location.search.includes('cat=');

  return (
    <>
      <nav className={`ok-nav ${theme === 'dark' ? 'dark-bg' : 'light-bg'}`}>
        <Link to="/" className="nav-logo" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img
            src={theme === 'dark' ? '/logo-white.svg' : '/logo-black.svg'}
            alt="Origami Keys"
            style={{ height: '40px', width: 'auto', objectFit: 'contain', display: 'block' }}
          />
          <span className="nav-logo-text">Origami <span>Keys</span></span>
        </Link>

        {/* ── Desktop Links ── */}
        <ul className="nav-links">
          {isAdmin ? (
            <>
              <li><NavLink to="/products" className={({ isActive }) => isActive ? 'active' : ''}>Dashboard</NavLink></li>
              <li><NavLink to="/contact/admin" className={({ isActive }) => isActive ? 'active' : ''}>Messages</NavLink></li>
            </>
          ) : (
            <>
              {/* Shop dropdown */}
              <li className="nav-dropdown-wrap">
                <Link
                  to="/products"
                  className={`nav-dropdown-trigger ${isShopActive ? 'active' : ''}`}
                >
                  Shop
                  <svg className="nav-dropdown-chevron" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ marginLeft: 4, transition: 'transform 0.2s' }}>
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </Link>
                <div className="nav-dropdown">
                  <Link to="/products" className="nav-dropdown-item">Shop All</Link>
                  <Link to="/products?cat=keyboards" className="nav-dropdown-item">Keyboards</Link>
                  <Link to="/products?cat=desk-accessories" className="nav-dropdown-item">Desk Accessories</Link>
                  <Link to="/products?cat=keycaps" className="nav-dropdown-item">Keycaps</Link>
                  <Link to="/products?cat=switches" className="nav-dropdown-item">Switches</Link>
                </div>
              </li>
              <li><NavLink to="/group-buys" className={({ isActive }) => isActive ? 'active' : ''}>Group Buys</NavLink></li>
              <li><NavLink to="/community" className={({ isActive }) => isActive ? 'active' : ''}>Community</NavLink></li>
              <li><NavLink to="/contact" className={({ isActive }) => isActive ? 'active' : ''}>Contact</NavLink></li>
            </>
          )}
        </ul>

        <div className="nav-actions">
          <button onClick={toggleTheme} className="dark-toggle" aria-label="Toggle dark mode">
            {theme === 'dark' ? (
              <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            ) : (
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
            )}
          </button>

          {user ? (
            <Link to="/profile" className="nav-avatar-btn" aria-label="Profile">
              <NavAvatar user={user} />
            </Link>
          ) : (
            <Link to="/login" className="nav-auth-link">Sign In / Register</Link>
          )}

          {(!user || !isAdmin) && (
            <Link to={user ? "/cart" : "/login"} className="nav-cart-btn">
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
              <span>Cart</span>
            </Link>
          )}

          <button className="mobile-menu-btn" onClick={() => setMobileOpen(!mobileOpen)} aria-label={mobileOpen ? 'Close menu' : 'Open menu'}>
            <div className={`hamburger ${mobileOpen ? 'open' : ''}`}><span /><span /><span /></div>
          </button>
        </div>
      </nav>

      {/* ── Mobile drawer ── */}
      <div className={`mobile-drawer-overlay ${mobileOpen ? 'open' : ''}`} onClick={() => setMobileOpen(false)} />
      <div className={`mobile-drawer ${mobileOpen ? 'open' : ''}`}>
        <div className="mobile-drawer-inner">
          <div className="mobile-drawer-links">
            {isAdmin ? (
              <>
                <NavLink to="/products" className={({ isActive }) => `mobile-link ${isActive ? 'active' : ''}`}>Dashboard</NavLink>
                <NavLink to="/contact/admin" className={({ isActive }) => `mobile-link ${isActive ? 'active' : ''}`}>Messages</NavLink>
              </>
            ) : (
              <>
                <NavLink to="/products" className={({ isActive }) => `mobile-link ${isActive && !location.search ? 'active' : ''}`}>Shop All</NavLink>
                <Link to="/products?cat=keyboards" className={`mobile-link ${location.search.includes('keyboards') ? 'active' : ''}`} style={{ paddingLeft: 32 }}>Keyboards</Link>
                <Link to="/products?cat=desk-accessories" className={`mobile-link ${location.search.includes('desk-accessories') ? 'active' : ''}`} style={{ paddingLeft: 32 }}>Desk Accessories</Link>
                <Link to="/products?cat=keycaps" className={`mobile-link ${location.search.includes('keycaps') ? 'active' : ''}`} style={{ paddingLeft: 32 }}>Keycaps</Link>
                <Link to="/products?cat=switches" className={`mobile-link ${location.search.includes('switches') ? 'active' : ''}`} style={{ paddingLeft: 32 }}>Switches</Link>
                <NavLink to="/group-buys" className={({ isActive }) => `mobile-link ${isActive ? 'active' : ''}`}>Group Buys</NavLink>
                <NavLink to="/community" className={({ isActive }) => `mobile-link ${isActive ? 'active' : ''}`}>Community</NavLink>
                <NavLink to="/contact" className={({ isActive }) => `mobile-link ${isActive ? 'active' : ''}`}>Contact</NavLink>
              </>
            )}
          </div>
          <div className="mobile-drawer-divider" />
          <div className="mobile-drawer-links">
            {user ? (
              <>
                <NavLink to="/profile" className={({ isActive }) => `mobile-link ${isActive ? 'active' : ''}`}>Profile</NavLink>
                <Link to="/logout" className="mobile-link" style={{ color: 'var(--ink-muted)' }}>Sign Out</Link>
              </>
            ) : (
              <NavLink to="/login" className={({ isActive }) => `mobile-link ${isActive ? 'active' : ''}`}>Sign In</NavLink>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function NavAvatar({ user }) {
  const initials = `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase() || '?';
  if (user.profilePicture) {
    return <img src={user.profilePicture} alt="" className="nav-avatar-img" />;
  }
  return <span className="nav-avatar-initials">{initials}</span>;
}