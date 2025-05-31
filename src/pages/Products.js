// import { useState, useEffect, useContext, useCallback } from 'react';
// import { Container, Spinner, Row, Alert } from 'react-bootstrap';
// import AdminView from '../components/AdminView'; 
// import UserView from '../components/UserView';   
// import UserContext from '../context/UserContext';

// export default function Products() {
//   const { user } = useContext(UserContext);
//   const [products, setProducts] = useState([]);
//   const [error, setError] = useState(null);
//   const [loading, setLoading] = useState(true);

//   const fetchData = useCallback(() => {
//     setLoading(true); 
//     const fetchUrl = user && user.isAdmin
//       ? `${process.env.REACT_APP_API_BASE_URL}/products/all`
//       : `${process.env.REACT_APP_API_BASE_URL}/products/active`;

//     const fetchOptions = {
//       method: 'GET',
//       headers: user 
//         ? { Authorization: `Bearer ${localStorage.getItem('token')}` }
//         : {},
//     };

//     fetch(fetchUrl, fetchOptions)
//       .then((res) => {
//         if (!res.ok) {
//           throw new Error('Network response was not ok');
//         }
//         return res.json();
//       })
//       .then((data) => {
//         setProducts(data);
//         setLoading(false); 
//       })
//       .catch((err) => {
//         console.error('Fetch error:', err);
//         setError(err.message);
//         setLoading(false); 
//       });
//   }, [user]); 

//   useEffect(() => {
//     fetchData();
//   }, [fetchData]); 

//   if (loading) {
//     return (
//       <Container className="mt-5 text-center">
//         <Spinner animation="border" role="status">
//           <span className="visually-hidden">Loading...</span>
//         </Spinner>
//       </Container>
//     );
//   }

//   return (
//     <Container className="mt-5">
//       {error && <Alert variant="danger" className="text-center">{`Error: ${error}`}</Alert>}
//       <Row>
//         {user?.isAdmin ? (
//           <AdminView productsData={products} fetchData={fetchData} />
//         ) : (
//           <UserView productsData={products} />
//         )}
//       </Row>
//     </Container>
//   );
// }

import { useState, useEffect, useContext, useCallback } from 'react';
import AdminView from '../components/AdminView'; 
import UserView from '../components/UserView';   
import UserContext from '../context/UserContext';
import { Container, Spinner, Row } from 'react-bootstrap';

export default function Products() {
  const { user } = useContext(UserContext);
  const [products, setProducts] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(() => {
    setLoading(true); 
    let fetchUrl = user && user.isAdmin
      ? `${process.env.REACT_APP_API_BASE_URL}/products/all`
      : `${process.env.REACT_APP_API_BASE_URL}/products/active`;

    const fetchOptions = {
      method: 'GET',
      headers: user 
        ? { Authorization: `Bearer ${localStorage.getItem('token')}` }
        : {},
    };

    fetch(fetchUrl, fetchOptions)
      .then((res) => {
        if (!res.ok) {
          throw new Error('Network response was not ok');
        }
        return res.json();
      })
      .then((data) => {
        setProducts(data);
        setLoading(false); 
      })
      .catch((err) => {
        console.error('Fetch error:', err);
        setError(err.message);
        setLoading(false); 
      });
  }, [user]); 
  
  useEffect(() => {
    fetchData();
  }, [fetchData]); 

  if (loading) {
    return (
      <Container className="mt-5 text-center">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Loading...</span>
        </Spinner>
      </Container>
    );
  }

  return (
    <Container>
      {error && <p>Error: {error}</p>}
      <Row>
        {user?.isAdmin ? (
          <AdminView productsData={products} fetchData={fetchData} />
        ) : (
          <UserView productsData={products} />
        )}
      </Row>
    </Container>
  );
}
