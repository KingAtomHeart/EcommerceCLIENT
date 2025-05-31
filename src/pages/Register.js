// import { useState, useEffect, useContext } from 'react';
// import { Form, Button, Row, Col } from 'react-bootstrap';
// import { Navigate, Link } from 'react-router-dom';
// import UserContext from '../context/UserContext';
// import { Notyf } from 'notyf';
// import 'notyf/notyf.min.css';

// export default function Register() {
//   const notyf = new Notyf();
//   const { user } = useContext(UserContext);

//   const [firstName, setFirstName] = useState('');
//   const [lastName, setLastName] = useState('');
//   const [email, setEmail] = useState('');
//   const [mobileNo, setMobileNo] = useState('');
//   const [password, setPassword] = useState('');
//   const [confirmPassword, setConfirmPassword] = useState('');
//   const [isActive, setIsActive] = useState(false);
//   const [redirectToLogin, setRedirectToLogin] = useState(false);

//   useEffect(() => {
//     if (
//       firstName &&
//       lastName &&
//       email &&
//       mobileNo.length === 11 &&
//       password &&
//       confirmPassword &&
//       password === confirmPassword
//     ) {
//       setIsActive(true);
//     } else {
//       setIsActive(false);
//     }
//   }, [firstName, lastName, email, mobileNo, password, confirmPassword]);

//   function registerUser(e) {
//     e.preventDefault();

//     fetch(`${process.env.REACT_APP_API_BASE_URL}/users/register`, {
//       method: 'POST',
//       headers: {
//         'Content-Type': 'application/json',
//       },
//       body: JSON.stringify({
//         firstName,
//         lastName,
//         email,
//         mobileNo,
//         password,
//       }),
//     })
//       .then((res) => res.json())
//       .then((data) => {
//         if (data.message === 'Registered Successfully') {
//           setFirstName('');
//           setLastName('');
//           setEmail('');
//           setMobileNo('');
//           setPassword('');
//           setConfirmPassword('');

//           notyf.success('Registration successful');
//           setRedirectToLogin(true);
//         } else {
//           notyf.error(data.message || 'Something went wrong.');
//         }
//       })
//       .catch((error) => {
//         notyf.error('Registration failed.');
//         console.error('Error:', error);
//       });
//   }

//   if (redirectToLogin) {
//     return <Navigate to="/login" />;
//   }

//   if (user && user.id) {
//     return <Navigate to="/" />;
//   }

//   return (
//     <div className="form-container">
//       <Form onSubmit={registerUser} className="my-5">
//         <h1 className="text-center mb-4">Register</h1>

//         <Row>
//           <Col md={6}>
//             <Form.Group className="mb-3">
//               <Form.Label>First Name:</Form.Label>
//               <Form.Control
//                 type="text"
//                 placeholder="Enter your First Name"
//                 value={firstName}
//                 onChange={(e) => setFirstName(e.target.value)}
//                 required
//               />
//             </Form.Group>
//           </Col>

//           <Col md={6}>
//             <Form.Group className="mb-3">
//               <Form.Label>Last Name:</Form.Label>
//               <Form.Control
//                 type="text"
//                 placeholder="Enter your Last Name"
//                 value={lastName}
//                 onChange={(e) => setLastName(e.target.value)}
//                 required
//               />
//             </Form.Group>
//           </Col>
//         </Row>

//         <Form.Group className="mb-3">
//           <Form.Label>Email:</Form.Label>
//           <Form.Control
//             type="email"
//             placeholder="Enter your Email"
//             value={email}
//             onChange={(e) => setEmail(e.target.value)}
//             required
//           />
//         </Form.Group>

//         <Form.Group className="mb-3">
//           <Form.Label>Mobile No:</Form.Label>
//           <Form.Control
//             type="text"
//             placeholder="Enter your 11 Digit Mobile No."
//             value={mobileNo}
//             onChange={(e) => setMobileNo(e.target.value)}
//             required
//             maxLength="11"
//           />
//         </Form.Group>

//         <Form.Group className="mb-3">
//           <Form.Label>Password:</Form.Label>
//           <Form.Control
//             type="password"
//             placeholder="Enter your Password"
//             value={password}
//             onChange={(e) => setPassword(e.target.value)}
//             required
//           />
//         </Form.Group>

//         <Form.Group className="mb-3">
//           <Form.Label>Verify Password:</Form.Label>
//           <Form.Control
//             type="password"
//             placeholder="Verify your Password"
//             value={confirmPassword}
//             onChange={(e) => setConfirmPassword(e.target.value)}
//             required
//           />
//         </Form.Group>

//         {isActive ? (
//           <Button variant="primary" type="submit" className="w-100">
//             Submit
//           </Button>
//         ) : (
//           <Button variant="danger" type="submit" className="w-100" disabled>
//             Please enter your registration details
//           </Button>
//         )}

//         <div className="text-center mt-3">
//           <p>
//             Already have an account? <Link to="/login">Click here</Link> to log in.
//           </p>
//         </div>
//       </Form>
//     </div>
//   );
// }


import { useState, useEffect, useContext } from 'react';
import { Form, Button } from 'react-bootstrap';
import { Navigate, Link } from 'react-router-dom';
import UserContext from '../context/UserContext';
import { Notyf } from 'notyf';
import 'notyf/notyf.min.css';

export default function Register() {
  
  const notyf = new Notyf();
  const { user } = useContext(UserContext);
  
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [mobileNo, setMobileNo] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isActive, setIsActive] = useState(false);
  const [redirectToLogin, setRedirectToLogin] = useState(false); 


  useEffect(() => {
    if (
      firstName &&
      lastName &&
      email &&
      mobileNo.length === 11 &&
      password &&
      confirmPassword &&
      password === confirmPassword
    ) {
      setIsActive(true);
    } else {
      setIsActive(false);
    }
  }, [firstName, lastName, email, mobileNo, password, confirmPassword]);

  function registerUser(e) {
    e.preventDefault();

    fetch(`${process.env.REACT_APP_API_BASE_URL}/users/register`, {
      method: 'POST',
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        firstName,
        lastName,
        email,
        mobileNo,
        password,
      }),
    })
    .then((res) => res.json())
    .then((data) => {
      if (data.message === "Registered Successfully") {

        setFirstName("");
        setLastName("");
        setEmail("");
        setMobileNo("");
        setPassword("");
        setConfirmPassword("");
        
        console.log("Registered Successfully")
        console.log("First Name:", data.user.firstName)
        console.log("Last Name:", data.user.lastName)
        console.log("Email:", data.user.email)
        notyf.success("Registration successful");
        

        setRedirectToLogin(true);
      } else {
        notyf.error(data.message || "Something went wrong.");
      }
    })
    .catch((error) => {
      console.error("Error:", error);
      notyf.error("Registration failed.");
    });
  }

  
  if (redirectToLogin) {
    return <Navigate to="/login" />;
  }

  if (user && user.id) {
    return <Navigate to="/" />; 
  }

  return (
    <div className="form-container">
      <Form onSubmit={registerUser} className="my-5">
        <h1 className="text-center">Register</h1>
        
        <Form.Group className="mb-3">
          <Form.Label>First Name:</Form.Label>
          <Form.Control 
            type="text"
            placeholder="First Name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
          />
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Label>Last Name:</Form.Label>
          <Form.Control 
            type="text"
            placeholder="Last Name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
          />
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Label>Email:</Form.Label>
          <Form.Control 
            type="email"
            placeholder="Enter your Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Label>Mobile No:</Form.Label>
          <Form.Control 
            type="text"
            placeholder="Enter your Mobile No. (11 digits)"
            value={mobileNo}
            onChange={(e) => setMobileNo(e.target.value)}
            required
            maxLength="11"
          />
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Label>Password:</Form.Label>
          <Form.Control 
            type="password"
            placeholder="Enter your Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Label>Verify Password:</Form.Label>
          <Form.Control 
            type="password"
            placeholder="Verify Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
        </Form.Group>

        {isActive ? (
          <Button variant="primary" type="submit" className="w-100">
            Submit
          </Button>
        ) : (
          <Button variant="danger" type="submit" className="w-100" disabled>
            Register Now
          </Button>
        )}

         <div className="text-center mt-3">
             <p>
                 Already have an account?{" "}
                 <Link to="/login">Click here</Link> to log in.
             </p>
         </div>

      </Form>
    </div>
  );
}