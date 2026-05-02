import { useContext } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { UserProvider } from './context/UserContext';
import UserContext from './context/UserContext';
import { ThemeProvider } from './context/ThemeContext';
import { AddToOrderProvider } from './context/AddToOrderContext';
import AppNavbar from './components/AppNavbar';
import Footer from './components/Footer';
import ErrorBoundary from './components/ErrorBoundary';
import Home from './pages/Home';
import Products from './pages/Products';
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
      <UserProvider>
        <AddToOrderProvider>
          <Router>
            <Toaster
              position="bottom-center"
              toastOptions={{
                duration: 2600,
                style: {
                  background: 'var(--ink)', color: 'var(--bg)',
                  fontFamily: "'DM Sans', sans-serif", fontSize: '0.875rem', fontWeight: 500,
                  borderRadius: '50px', padding: '12px 24px', boxShadow: 'var(--shadow-lg)',
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
    </ThemeProvider>
  );
}