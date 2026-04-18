import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { UserProvider } from './context/UserContext';
import { ThemeProvider } from './context/ThemeContext';
import AppNavbar from './components/AppNavbar';
import Footer from './components/Footer';
import ErrorBoundary from './components/ErrorBoundary';
import Home from './pages/Home';
import Products from './pages/Products';
import ProductView from './pages/ProductView';
import CartView from './pages/CartView';
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
import './styles/globals.css';

export default function App() {
  return (
    <ThemeProvider>
      <UserProvider>
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
          <ErrorBoundary>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/products" element={<Products />} />
              <Route path="/products/:productId" element={<ProductView />} />
              <Route path="/cart" element={<CartView />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Navigate to="/login" />} />
              <Route path="/logout" element={<Logout />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/order-history" element={<OrderHistory />} />
              <Route path="/group-buys" element={<GroupBuys />} />
              <Route path="/group-buys/admin" element={<GroupBuyAdmin />} />
              <Route path="/group-buys/:id" element={<GroupBuyView />} />
              <Route path="/community" element={<Placeholder />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/contact/admin" element={<ContactAdmin />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </ErrorBoundary>
          <Footer />
        </Router>
      </UserProvider>
    </ThemeProvider>
  );
}