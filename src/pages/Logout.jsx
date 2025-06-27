// import { useEffect, useContext } from 'react';
// import { useNavigate } from 'react-router-dom';
// import UserContext from '../context/UserContext';

// export default function Logout() {
//     const { setUser } = useContext(UserContext);
//     const navigate = useNavigate();

//     useEffect(() => {
//         // Log the token before clearing
//         console.log('Token before removal:', localStorage.getItem('token'));

//         // Clear user data and reset context
//         setUser(null);
//         localStorage.removeItem('token');
//         localStorage.removeItem('user'); // Clear user details, if stored

//         console.log('Token after removal:', localStorage.getItem('token'));

//         // Navigate the user to the login page after logout
//         navigate('/login');
//     }, [setUser, navigate]);

//     return (
//         <div className="text-center mt-5">
//             <p>Logging you out...</p>
//         </div>
//     );
// }


import { useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import UserContext from '../context/UserContext';

export default function Logout() {
  const { setUser } = useContext(UserContext);
  const navigate = useNavigate();

  useEffect(() => {
    console.log('Token before removal:', localStorage.getItem('token'));

    setUser(null);
    localStorage.removeItem('token'); 

    console.log('Token after removal:', localStorage.getItem('token'));

    navigate('/login');
  }, [setUser, navigate]);

  return null;
}
