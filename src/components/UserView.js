// import { useState, useEffect } from 'react';
// import ProductCard from './ProductCard';
// import { Spinner, Container, Row } from 'react-bootstrap';

// export default function UserView() {
//   const [products, setProducts] = useState([]);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState(null);

//   const fetchProducts = async () => {
//     try {
//       const response = await fetch(`${process.env.REACT_APP_API_BASE_URL}/products/active`, {
//         headers: {
//           Authorization: `Bearer ${localStorage.getItem('token')}`,
//         },
//       });
//       const data = await response.json();
//       if (response.ok) {
//         setProducts(data);
//       } else {
//         setError('Error fetching products.');
//       }
//     } catch (error) {
//       console.error('Error fetching products:', error);
//       setError('Error fetching products.');
//     } finally {
//       setLoading(false);
//     }
//   };

//   useEffect(() => {
//     fetchProducts();
//   }, []);

//   if (loading) {
//     return (
//       <Container className="text-center mt-5">
//         <Spinner animation="border" role="status" />
//         <span className="visually-hidden">Loading...</span>
//       </Container>
//     );
//   }

//   if (error) {
//     return <Container className="text-center mt-5"><p>{error}</p></Container>;
//   }

//   return (
//     <Container className="mt-5">
//       <Row>
//         {products.map((product) => (
//           <ProductCard productProp={product} key={product._id} />
//         ))}
//       </Row>
//     </Container>
//   );
// }


import { useState, useEffect } from 'react';
import ProductCard from './ProductCard';

export default function UserView() {

    const [products, setProducts] = useState([]);

    const fetchData = () => {
        fetch(`${process.env.REACT_APP_API_BASE_URL}/products/active`, {
            headers: {
                Authorization: `Bearer ${localStorage.getItem('token')}` 
            }
        })
        .then(response => response.json())
        .then(data => {
            setProducts(data);  
        })
        .catch(error => {
            console.error('Error fetching products:', error);
        });
    };

    useEffect(() => {
        fetchData();  
    }, []);

    return (
        <>
            {products.map(product => (
                <ProductCard productProp={product} key={product._id} />
            ))}
        </>
    );
}
