import { useState, useEffect, useContext } from 'react';
import { Container, Button, Row, Col, ListGroup, Spinner } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import UserContext from '../context/UserContext';
import { Notyf } from 'notyf';
import 'notyf/notyf.min.css';
import './app.css';

export default function CartView() {
    const { user } = useContext(UserContext);
    const [cart, setCart] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const notyf = new Notyf();
    const navigate = useNavigate();

    useEffect(() => {
        if (user) {
            fetchCart();
        }
    }, [user]);

    const fetchCart = () => {
        setLoading(true);
        fetch(`${process.env.REACT_APP_API_BASE_URL}/cart/get-cart`, {
            headers: {
                Authorization: `Bearer ${localStorage.getItem('token')}`,
            },
        })
            .then((res) => res.json())
            .then((data) => {
                setCart(data.cart || null);
                setLoading(false);
            })
            .catch((err) => {
                console.error('Fetch error:', err);
                setError(err.message);
                setLoading(false);
            });
    };

    const updateQuantity = (productId, newQuantity) => {
        if (newQuantity < 1) {
            notyf.error('Quantity must be at least 1');
            return;
        }

        fetch(`${process.env.REACT_APP_API_BASE_URL}/cart/update-cart-quantity`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${localStorage.getItem('token')}`,
            },
            body: JSON.stringify({ productId, newQuantity }),
        })
            .then((res) => res.json())
            .then((data) => {
                if (data.message === 'Item quantity updated successfully') {
                    notyf.success('Quantity updated');
                    fetchCart();
                } else {
                    notyf.error('Error updating quantity');
                }
            })
            .catch((err) => {
                console.error('Update error:', err);
                notyf.error('Error updating quantity');
            });
    };

    const removeItem = (productId) => {
        fetch(`${process.env.REACT_APP_API_BASE_URL}/cart/${productId}/remove-from-cart`, {
            method: 'PATCH',
            headers: {
                Authorization: `Bearer ${localStorage.getItem('token')}`,
            },
        })
            .then((res) => res.json())
            .then((data) => {
                // if (data.message === 'Item removed from cart successfully') {
                //     notyf.success('Item removed');
                //     fetchCart();
                // } else {
                //     notyf.error('Error removing item');
                // }
                if (data.message && data.message.includes('Item removed')) {
                    notyf.success('Item removed');
                    fetchCart();
                } else {
                    notyf.error('Error removing item');
                }
            });
    };

    const clearCart = () => {
        fetch(`${process.env.REACT_APP_API_BASE_URL}/cart/clear-cart`, {
            method: 'PUT',
            headers: {
                Authorization: `Bearer ${localStorage.getItem('token')}`,
            },
        })
            .then((res) => res.json())
            .then((data) => {
                if (data.message === 'Cart cleared successfully') {
                    notyf.success('Cart cleared');
                    fetchCart();
                } else {
                    notyf.error('Error clearing cart');
                }
            });
    };

    const checkout = () => {
        fetch(`${process.env.REACT_APP_API_BASE_URL}/orders/checkout`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${localStorage.getItem('token')}`,
            },
        })
            .then((res) => res.json())
            .then((data) => {
                if (data.message === 'Ordered Successfully') {
                    notyf.success('Order placed successfully');
                    fetchCart();
                } else {
                    notyf.error('Error placing order');
                }
            })
            .catch((err) => {
                console.error('Checkout error:', err);
                notyf.error('Error placing order');
            });
    };

    if (!user) {
        return (
            <Container className="text-center mt-5">
                <p>
                    Please <Link to="/login">login</Link> to view your cart.
                </p>
            </Container>
        );
    }

    if (loading) {
        return (
 /*           <div className="d-flex justify-content-center align-items-center" style={{ height: '50vh' }}>
                <Spinner animation="border" role="status">
                    <span className="sr-only">Loading...</span>
                </Spinner>
            </div>
*/
        <div className="d-flex justify-content-center align-items-center" style={{ height: '50vh' }}>
            <Spinner animation="border" role="status" aria-label="Loading" />
        </div>

        );
    }

    if (error) {
        return <p className="text-danger text-center mt-5">Error: {error}</p>;
    }

    if (!cart || cart.cartItems.length === 0) {
        return (
            <div className="text-center mt-5">
                <p>Your cart is empty.</p>
                <Button variant="primary" onClick={() => navigate('/products')}>
                    Browse Products
                </Button>
            </div>
        );
    }

    return (
        <Container className="my-5">
            <h2 className="text-center mb-4">Your Cart</h2>
            <ListGroup className="shadow rounded">
                {cart.cartItems.map((item) => (
                    <ListGroup.Item
                        key={item.productId}
                        className="d-flex justify-content-between align-items-center py-3"
                    >
                        <div>
                            <h5 className="mb-1">{item.productName}</h5>
                            <p className="mb-0 text-muted">Subtotal: ₱ {item.subtotal}</p>
                        </div>
                        <div className="d-flex align-items-center">
                            <Button
                                variant="outline-secondary"
                                size="sm"
                                onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                                disabled={item.quantity <= 1}
                                className="mx-1"
                            >
                                -
                            </Button>
                            <span className="mx-2">{item.quantity}</span>
                            <Button
                                variant="outline-secondary"
                                size="sm"
                                onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                                className="mx-1"
                            >
                                +
                            </Button>
                        </div>
                        <Button
                            variant="outline-danger"
                            size="sm"
                            onClick={() => removeItem(item.productId)}
                        >
                            Remove
                        </Button>
                    </ListGroup.Item>
                ))}
            </ListGroup>
            <div className="text-end mt-4">
                <h4>Total: ₱ {cart.totalPrice}</h4>
                <div>
                    <Button variant="outline-danger" onClick={clearCart} className="me-2">
                        Clear Cart
                    </Button>
                    <Button variant="success" onClick={checkout}>
                        Checkout
                    </Button>
                </div>
            </div>
        </Container>
    );
}
