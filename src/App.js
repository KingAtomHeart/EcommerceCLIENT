// import React from 'react';
// import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
// import AppNavbar from './components/AppNavbar';
// import OrderHistoryPage from './pages/OrderHistoryPage';
// import Register from './pages/Register';
// import Login from './pages/Login';
// import Products from './pages/Products';
// import ProductView from './pages/ProductView';
// import Logout from './pages/Logout';
// import Profile from './pages/Profile';
// import CartView from './pages/CartView';
// import Home from './pages/Home';
// import { UserProvider } from './context/UserContext';
// import 'bootstrap/dist/css/bootstrap.min.css';
// import './App.css';

// // App component which includes all routes and shared layout
// const App = () => (
//   <UserProvider>
//     <Router>
//       {/* Navigation bar component */}
//       <AppNavbar />
      
//       <div className="container mt-4">
//         <Routes>
//           {/* Defining routes for different pages */}
//           <Route path="/" element={<Home />} />
//           <Route path="/login" element={<Login />} />
//           <Route path="/logout" element={<Logout />} />
//           <Route path="/profile" element={<Profile />} />
//           <Route path="/products" element={<Products />} />
//           <Route path="/products/:productId" element={<ProductView />} />
//           <Route path="/cart" element={<CartView />} />
//           <Route path="/order-history" element={<OrderHistoryPage />} />
//           <Route path="/register" element={<Register />} />
//         </Routes>
//       </div>
//     </Router>
//   </UserProvider>
// );

// export default App;


import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import AppNavbar from './components/AppNavbar';
import OrderHistoryPage from './pages/OrderHistoryPage';
import Register from './pages/Register';
import Login from './pages/Login';
import Products from './pages/Products';
import ProductView from './pages/ProductView';
import Logout from './pages/Logout';
import Profile from './pages/Profile';
import CartView from './pages/CartView';
import Home from './pages/Home';
import { UserProvider } from './context/UserContext'; 
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';


const App = () => {
  return (
    <UserProvider>
      <Router>
        <AppNavbar />
        <div className="container mt-4">
          <Routes>
          <Route path='/' element={<Home />}/>
          <Route path="/login" element={<Login />} />
          <Route path="/logout" element={<Logout />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/products" element={<Products />} />
          <Route path="/products/:productId" element={<ProductView />} />
          <Route path="/cart" element={<CartView />} />
          <Route path="/order-history" element={<OrderHistoryPage />} />
          <Route path="/register" element={<Register />} />
          </Routes>
        </div>
      </Router>
    </UserProvider>
  );
};

export default App;