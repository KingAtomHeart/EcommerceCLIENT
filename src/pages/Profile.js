import { useState, useContext, useEffect, useRef } from 'react';
import { Container, Row, Col, Card, ListGroup, Spinner } from 'react-bootstrap';
import { Navigate } from 'react-router-dom';
import UserContext from '../context/UserContext';
import { Notyf } from 'notyf';
import 'notyf/notyf.min.css';
import './app.css';

export default function Profile() {
    const notyf = useRef(new Notyf());
    const { user, setUser } = useContext(UserContext);
    const [details, setDetails] = useState({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem('token');
        
        if (!token) {
            notyf.current.error("User is not authenticated");
            setLoading(false);
            return;
        }

        fetch(`${process.env.REACT_APP_API_BASE_URL}/users/details`, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        })
        .then(res => res.json())
        .then(data => {
            if (data && data.user) {
                setDetails(data.user);
                setUser({ id: data.user._id, isAdmin: data.user.isAdmin });
            } else if (data.error) {
                notyf.current.error(data.error);
            } else {
                notyf.current.error("Invalid response structure.");
            }
        })
        .catch(() => {
            notyf.current.error("An error occurred. Please try again.");
        })
        .finally(() => setLoading(false));
    }, [setUser]);

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

    if (!user || user.id === null) {
        return <Navigate to="/login" />;
    }

    return (
        <Container className="mt-5">
            <Row className="justify-content-center">
                <Col md={8}>
                    <Card className="p-4">
                        <Card.Body>
                            <Card.Title className="text-center mb-4">Profile</Card.Title>
                            {details.firstName && details.lastName ? (
                                <div className="text-center">
                                    <h2>{details.firstName} {details.lastName}</h2>
                                    <ListGroup variant="flush" className="mt-4">
                                        <ListGroup.Item>
                                            <strong>Email:</strong> {details.email}
                                        </ListGroup.Item>
                                        <ListGroup.Item>
                                            <strong>Mobile No:</strong> {details.mobileNo}
                                        </ListGroup.Item>
                                    </ListGroup>
                                </div>
                            ) : (
                                <p className="text-center text-muted">No profile details available.</p>
                            )}
                        </Card.Body>
                    </Card>
                </Col>
            </Row>
        </Container>
    );
}
