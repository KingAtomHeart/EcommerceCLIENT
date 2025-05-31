// import { useState, useEffect, useContext } from 'react';
// import { Form, Button } from 'react-bootstrap';
// import { useNavigate, Link } from 'react-router-dom';
// import UserContext from '../context/UserContext';
// import { Notyf } from 'notyf';
// import 'notyf/notyf.min.css';

// export default function Login() {
//     const notyf = new Notyf();
//     const { setUser } = useContext(UserContext);
//     const navigate = useNavigate();
//     const [email, setEmail] = useState('');
//     const [password, setPassword] = useState('');
//     const [isActive, setIsActive] = useState(false);

//     // Handle user authentication
//     const authenticate = async (e) => {
//         e.preventDefault();

//         try {
//             const response = await fetch(`${process.env.REACT_APP_API_BASE_URL}/users/login`, {
//                 method: 'POST',
//                 headers: {
//                     'Content-Type': 'application/json',
//                 },
//                 body: JSON.stringify({ email, password }),
//             });

//             const data = await response.json();

//             if (data.access) {
//                 // Store the token and fetch user details
//                 localStorage.setItem('token', data.access);
//                 console.log('User logged in successfully:', localStorage.getItem('token'));
//                 retrieveUserDetails(data.access);

//                 // Clear input fields
//                 setEmail('');
//                 setPassword('');
//                 notyf.success('Login Successful');
//             } else {
//                 handleLoginError(data);
//             }
//         } catch (error) {
//             console.error('Network or server error:', error);
//             notyf.error('An error occurred. Please try again.');
//         }
//     };

//     // Fetch user details after login
//     const retrieveUserDetails = async (token) => {
//         try {
//             const response = await fetch(`${process.env.REACT_APP_API_BASE_URL}/users/details`, {
//                 headers: { Authorization: `Bearer ${token}` },
//             });

//             const data = await response.json();
//             const user = data.user;

//             console.log('User details:', user);

//             // Store user details in local storage and update context
//             localStorage.setItem('user', JSON.stringify({ id: user._id, isAdmin: user.isAdmin }));
//             setUser({ id: user._id, isAdmin: user.isAdmin });

//             navigate('/products');
//         } catch (error) {
//             console.error('Failed to retrieve user details:', error);
//             notyf.error('Failed to retrieve user details.');
//         }
//     };

//     // Handle login errors
//     const handleLoginError = (data) => {
//         console.error('Login error:', data);

//         if (data.error) {
//             switch (data.error) {
//                 case 'Email and password do not match':
//                     notyf.error('Incorrect Credentials. Try Again.');
//                     break;
//                 case 'No email found':
//                     notyf.error('User Not Found. Try Again.');
//                     break;
//                 default:
//                     notyf.error('An error occurred. Please try again.');
//             }
//         } else {
//             notyf.error('Unexpected response. Please try again.');
//         }
//     };

//     // Enable/disable login button based on input validity
//     useEffect(() => {
//         setIsActive(email !== '' && password !== '');
//     }, [email, password]);

//     return (
//         <div className="form-container">
//             <Form onSubmit={authenticate} className="my-4">
//                 <h1 className="text-center">Login</h1>

//                 <Form.Group className="mb-4">
//                     <Form.Label>Email Address</Form.Label>
//                     <Form.Control
//                         type="email"
//                         placeholder="Enter email"
//                         required
//                         value={email}
//                         onChange={(e) => setEmail(e.target.value)}
//                     />
//                 </Form.Group>

//                 <Form.Group className="mb-4">
//                     <Form.Label>Password</Form.Label>
//                     <Form.Control
//                         type="password"
//                         placeholder="Enter password"
//                         required
//                         value={password}
//                         onChange={(e) => setPassword(e.target.value)}
//                     />
//                 </Form.Group>

//                 <Button
//                     variant={isActive ? 'primary' : 'danger'}
//                     type="submit"
//                     disabled={!isActive}
//                     className="w-100"
//                 >
//                     Login
//                 </Button>
//             </Form>

//             <div className="text-center mt-3">
//                 <p>
//                     Don't have an account? <Link to="/register">Sign Up</Link>
//                 </p>
//             </div>
//         </div>
//     );
// }


import { useState, useEffect, useContext } from 'react';
import { Form, Button } from 'react-bootstrap';
import { useNavigate, Link } from 'react-router-dom'; 
import UserContext from '../context/UserContext';
import { Notyf } from 'notyf';
import 'notyf/notyf.min.css';

export default function Login() {
    const notyf = new Notyf();
    const { setUser } = useContext(UserContext);
    const navigate = useNavigate();  
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isActive, setIsActive] = useState(false);

function authenticate(e) {
    e.preventDefault();

    fetch(`${process.env.REACT_APP_API_BASE_URL}/users/login`, {
        method: 'POST',
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ email, password })
    })
    .then(res => res.json())
    .then(data => {
        if (data.access) {
            localStorage.setItem('token', data.access);
            console.log("client message: User logged in successfully", localStorage.getItem('token'));
            console.log(data.log);
            retrieveUserDetails(data.access);
            setEmail('');
            setPassword('');
            notyf.success('Successful Login');
        } else if (data.error) {
            console.error(data.log);
            console.error('client message:', data.error);
            
            switch (data.error) {
                case 'Email and password do not match':
                    notyf.error('Incorrect Credentials. Try Again');
                    break;
                case 'No email found':
                    notyf.error('User Not Found. Try Again.');
                    break;
                default:
                    notyf.error('An error occurred. Please try again.');
                    break;
            }
        } else {
            console.log('client message: Unexpected response structure', data);
            notyf.error('An unexpected error occurred. Please try again.');
        }
    })
    .catch(error => {
        console.error('client message: Network or server error', error);
        notyf.error('An error occurred. Please try again.');
    });
}

function retrieveUserDetails(token) {
    fetch(`${process.env.REACT_APP_API_BASE_URL}/users/details`, {
        headers: { Authorization: `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(data => {
        console.log('User details:', data); 
        const user = data.user; 
        console.log('Is admin:', user.isAdmin);

        // Save the user details and token in localStorage
        localStorage.setItem('user', JSON.stringify({ id: user._id, isAdmin: user.isAdmin }));
        setUser({ id: user._id, isAdmin: user.isAdmin });

        navigate('/products');
    })
    .catch(error => {
        console.error('Failed to retrieve user details:', error);
        notyf.error('Failed to retrieve user details.');
    });
}



    useEffect(() => {
        setIsActive(email !== '' && password !== '');
    }, [email, password]);

    return (
        <div className="form-container">
            <Form onSubmit={authenticate} className="my-4">
                <h1 className="text-center">Login</h1>
                <Form.Group className='mb-4'>
                    <Form.Label>Email address</Form.Label>
                    <Form.Control
                        type="email" 
                        placeholder="Enter email" 
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                </Form.Group>
                <Form.Group className="mb-4">
                    <Form.Label>Password</Form.Label>
                    <Form.Control 
                        type="password" 
                        placeholder="Password" 
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                </Form.Group>
                <Button 
                    variant={isActive ? "primary" : "danger"} 
                    type="submit" 
                    disabled={!isActive}
                    className="w-100"
                >
                    Login
                </Button>
            </Form>
            <div className="text-center mt-3">
                <p>Don't have an account?{" "}<Link to="/register">Sign Up</Link></p> 
            </div>
        </div>
    )
}