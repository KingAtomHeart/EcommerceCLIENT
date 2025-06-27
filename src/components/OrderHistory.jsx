// import React, { useState, useEffect, useContext } from 'react';
// import { Container, Row, Col, ListGroup, Alert, Card, Spinner } from 'react-bootstrap';
// import { Link } from 'react-router-dom';
// import UserContext from '../context/UserContext';
// import './app.css';

// const OrderHistory = () => {
//     const { user } = useContext(UserContext);
//     const [orders, setOrders] = useState([]);
//     const [loading, setLoading] = useState(true);
//     const [error, setError] = useState(null);

//     useEffect(() => {
//         if (user) {
//             fetchOrders();
//         }
//     }, [user]);

//     const fetchOrders = async () => {
//         setLoading(true);

//         try {
//             const response = await fetch(`${process.env.REACT_APP_API_BASE_URL}/orders/my-orders`, {
//                 method: 'GET',
//                 headers: {
//                     Authorization: `Bearer ${localStorage.getItem('token')}`,
//                 },
//             });

//             if (!response.ok) {
//                 throw new Error(`HTTP error! status: ${response.status}`);
//             }

//             const data = await response.json();
//             setOrders(data.orders || []);
//         } catch (err) {
//             console.error('Fetch error:', err);
//             setError('Error fetching orders.');
//         } finally {
//             setLoading(false);
//         }
//     };

//     if (!user) {
//         return (
//             <p>
//                 Please <Link to="/login">login</Link> to view your order history.
//             </p>
//         );
//     }

//     if (loading) {
//         return (
//             <Row className="justify-content-center">
//                 <Col md={8} className="text-center mt-5">
//                     <Spinner animation="border" role="status" className="loading-spinner">
//                         <span className="visually-hidden">Loading...</span>
//                     </Spinner>
//                 </Col>
//             </Row>
//         );
//     }

//     if (error) {
//         return <Alert variant="danger">{error}</Alert>;
//     }

//     if (orders.length === 0) {
//         return <Alert variant="info">You have no orders.</Alert>;
//     }

//     return (
//         <Container className="mt-5">
//             <h2>Your Order History</h2>
//             {orders.map((order) => (
//                 <OrderCard key={order._id} order={order} />
//             ))}
//         </Container>
//     );
// };

// const OrderCard = ({ order }) => (
//     <Card className="mb-4">
//         <Card.Body>
//             <Card.Title>
//                 <Row>
//                     <Col>
//                         <strong>Order ID:</strong> {order._id}
//                     </Col>
//                     <Col className="text-end">
//                         <strong>Total Price:</strong> ₱ {order.totalPrice.toLocaleString()}
//                     </Col>
//                 </Row>
//             </Card.Title>
//             <Card.Subtitle className="mb-2 text-muted">
//                 <Row>
//                     <Col>
//                         <strong>Ordered On:</strong> {new Date(order.orderedOn).toLocaleDateString()}
//                     </Col>
//                 </Row>
//             </Card.Subtitle>
//             <ProductList products={order.productsOrdered} />
//         </Card.Body>
//     </Card>
// );

// const ProductList = ({ products }) => (
//     <ListGroup variant="flush">
//         {products.map((item) => (
//             <ListGroup.Item key={item.productId}>
//                 <Row>
//                     <Col>
//                         <strong>Product:</strong> {item.productName}
//                     </Col>
//                     <Col>
//                         <strong>Quantity:</strong> {item.quantity}
//                     </Col>
//                     <Col className="text-end">
//                         <strong>Subtotal:</strong> ₱ {item.subtotal.toLocaleString()}
//                     </Col>
//                 </Row>
//             </ListGroup.Item>
//         ))}
//     </ListGroup>
// );

// export default OrderHistory;

import { useState, useEffect, useContext } from 'react';
import { Container, Row, Col, ListGroup, Alert, Card, Spinner } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import UserContext from '../context/UserContext';
import './app.css';

export default function OrderHistory() {
    const { user } = useContext(UserContext);
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (user) {
            fetchOrders();
        }
    }, [user]);

    const fetchOrders = () => {
        setLoading(true);
        fetch(`${process.env.REACT_APP_API_BASE_URL}/orders/my-orders`, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${localStorage.getItem('token')}`,
            },
        })
        .then((res) => res.json())
        .then((data) => {
            if (data.orders) {
                setOrders(data.orders);
            } else {
                setOrders([]);
            }
            setLoading(false);
        })
        .catch((err) => {
            console.error('Fetch error:', err);
            setError('Error fetching orders.');
            setLoading(false);
        });
    };

    if (!user) {
        return <p>Please <Link to="/login">login</Link> to view your order history.</p>;
    }

    if (loading) {
        return (
            <Row className="justify-content-center">
                <Col md={8} className="text-center mt-5">
                    <Spinner animation="border" role="status" className="loading-spinner">
                        <span className="visually-hidden">Loading...</span>
                    </Spinner>
                </Col>
            </Row>
        );
    }

    if (error) {
        return <Alert variant="danger">{error}</Alert>;
    }

    if (orders.length === 0) {
        return <Alert variant="info">You have no orders.</Alert>;
    }

    return (
        <Container className="mt-5">
            <h2>Your Order History</h2>
            {orders.map((order) => (
                <Card key={order._id} className="mb-4">
                    <Card.Body>
                        <Card.Title>
                            <Row>
                                <Col><strong>Order ID:</strong> {order._id}</Col>
                                <Col className="text-end"><strong>Total Price:</strong> ₱ {order.totalPrice.toLocaleString()}</Col>
                            </Row>
                        </Card.Title>
                        <Card.Subtitle className="mb-2 text-muted">
                            <Row>
                                <Col><strong>Ordered On:</strong> {new Date(order.orderedOn).toLocaleDateString()}</Col>
                            </Row>
                        </Card.Subtitle>
                        <ListGroup variant="flush">
                            {order.productsOrdered.map(item => (
                                <ListGroup.Item key={item.productId}>
                                    <Row>
                                        <Col><strong>Product:</strong> {item.productName}</Col>
                                        <Col><strong>Quantity:</strong> {item.quantity}</Col>
                                        <Col className="text-end"><strong>Subtotal:</strong> ₱ {item.subtotal.toLocaleString()}</Col>
                                    </Row>
                                </ListGroup.Item>
                            ))}
                        </ListGroup>
                    </Card.Body>
                </Card>
            ))}
        </Container>
    );
}