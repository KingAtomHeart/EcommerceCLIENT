import { useContext } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { UserProvider } from './context/UserContext';
import UserContext from './context/UserContext';
import { ThemeProvider } from './context/ThemeContext';
import { SiteStyleProvider } from './context/SiteStyleContext';
import { AddToOrderProvider } from './context/AddToOrderContext';
import AppNavbar from './components/AppNavbar';
import Footer from './components/Footer';
import ErrorBoundary from './components/ErrorBoundary';
import ScrollToTop from './components/ScrollToTop';
import Home from './pages/Home';
import Products from './pages/Products';
import CategoryPage from './pages/CategoryPage';
import ProductView from './pages/ProductView';
import CartView from './pages/CartView';
import Checkout from './pages/Checkout';
import Login from './pages/Login';
import Logout from './pages/Logout';
import Profile from './pages/Profile';
import OrderHistory from './pages/OrderHistory';
import GroupBuys from './pages/GroupBuys';
import GroupBuyView from './pages/GroupBuyView';
import GroupBuyAdmin from './pages/GroupBuyAdmin';
import Placeholder from './pages/Placeholder';
import Contact from './pages/Contact';
import ContactAdmin from './pages/ContactAdmin';
import PaymentSuccess from './pages/PaymentSuccess';
import AddToOrderHandler from './pages/AddToOrderHandler';
import AddToOrderBanner from './components/AddToOrderBanner';
import './styles/globals.css';

function ProtectedRoute({ element, adminOnly = false }) {
  const { user, loading } = useContext(UserContext);
  if (loading) return <div className="loading-center"><div className="spinner" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && !user.isAdmin) return <Navigate to="/products" replace />;
  return element;
}

export default function App() {
  return (
    <ThemeProvider>
      <SiteStyleProvider>
      <UserProvider>
        <AddToOrderProvider>
          <Router>
            <ScrollToTop />
            <Toaster
              position="bottom-center"
              toastOptions={{
                duration: 2600,
                // No emojis / checkmarks / X icons — text-only by design. Set on
                // every variant so react-hot-toast doesn't sneak its defaults back.
                icon: null,
                success: { icon: null, className: 'ok-toast-success', style: { background: 'var(--accent)', color: '#fff' } },
                error:   { icon: null, className: 'ok-toast-error',   style: { background: '#c54848', color: '#fff' } },
                loading: { icon: null },
                style: {
                  fontFamily: 'inherit', fontSize: '0.875rem', fontWeight: 500,
                  padding: '12px 22px',
                  background: 'var(--ink)', color: 'var(--bg)',
                  // Shape adapts per theme via the CSS custom property:
                  //   Classic     → 50px (pill)
                  //   Origami     → 4px  (subtle square)
                  //   Pastel Paper → 999px (full pill, overridden by frosted-glass rule)
                  borderRadius: 'var(--radius-pill)',
                  boxShadow: 'var(--shadow-lg)',
                },
              }}
            />
            <AppNavbar />
            <AddToOrderBanner />
            <ErrorBoundary>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/products" element={<Products />} />
                <Route path="/products/:productId" element={<ProductView />} />
                <Route path="/category/:slug" element={<CategoryPage />} />
                <Route path="/cart" element={<CartView />} />
                <Route path="/checkout" element={<Checkout />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Navigate to="/login" />} />
                <Route path="/logout" element={<Logout />} />
                <Route path="/profile" element={<ProtectedRoute element={<Profile />} />} />
                <Route path="/order-history" element={<OrderHistory />} />
                <Route path="/group-buys" element={<GroupBuys />} />
                <Route path="/group-buys/admin" element={<ProtectedRoute element={<GroupBuyAdmin />} adminOnly />} />
                <Route path="/group-buys/:id" element={<GroupBuyView />} />
                <Route path="/add-to-order/:token" element={<AddToOrderHandler />} />
                <Route path="/community" element={<Placeholder />} />
                <Route path="/contact" element={<Contact />} />
                <Route path="/contact/admin" element={<ProtectedRoute element={<ContactAdmin />} adminOnly />} />
                <Route path="/payment-success" element={<PaymentSuccess />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </ErrorBoundary>
            <Footer />
          </Router>
        </AddToOrderProvider>
      </UserProvider>
      </SiteStyleProvider>
    </ThemeProvider>
  );
}