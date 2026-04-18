import { useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import UserContext from '../context/UserContext';
import toast from 'react-hot-toast';

export default function Logout() {
  const { logout } = useContext(UserContext);
  const navigate = useNavigate();

  useEffect(() => {
    logout();
    toast.success('Signed out successfully');
    navigate('/login');
  }, [logout, navigate]);

  return null;
}