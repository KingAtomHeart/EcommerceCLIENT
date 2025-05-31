import { useContext, useEffect, useState } from 'react';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Card from 'react-bootstrap/Card';
import Button from 'react-bootstrap/Button';
import Spinner from 'react-bootstrap/Spinner';
import Alert from 'react-bootstrap/Alert';
import { NavLink, Link } from 'react-router-dom'; 
import UserContext from '../context/UserContext'; 
import logo from '../img/logo.png'; 
import './app.css';

export default function HomePage() {
    const { user } = useContext(UserContext); 
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
  
    useEffect(() => {
      fetch(`${process.env.REACT_APP_API_BASE_URL}/products/active`)
        .then(response => {
          if (response.status >= 200 && response.status < 300) {
            return response.json();
          } else {
            return response.text().then(errorText => {
              throw new Error(`HTTP error! Status: ${response.status}, Details: ${errorText}`);
            });
          }
        })
        .then(data => {
          setProducts(data);
          setLoading(false);
        })
        .catch(err => {
          setError(err.message);
          setLoading(false);
        });
    }, []);
  
    if (loading) return <Spinner animation="border" className="d-block mx-auto my-4" />;
    if (error) return <Alert variant="danger" className="text-center my-4">{error}</Alert>;
  
    return (
      <Container>
        <div className="text-center my-3 pt-3">
          <Link to="/products">
            <img
              src={logo}
              alt="Shop Logo"
              style={{
                height: '400px',        
                width: 'auto',           
                cursor: 'pointer',       
                transition: 'transform 0.3s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.2)')} 
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1.1)')}  
            />
          </Link>
        </div>
        <p className="text-center">Browse our collections</p>
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h1 className="text-center">Featured Products</h1>
          {!user && ( 
            <NavLink to="/login" className="btn btn-primary">
              Login
            </NavLink>
          )}
        </div>
        <Row>
          {products.map(product => (
            <Col key={product._id} sm={12} md={6} lg={4}>
              <Card className="mb-4 product-card">
                <Card.Body>
                  <Card.Title className="product-card-title">{product.name}</Card.Title>
                  <Card.Text className="product-card-description">{product.description}</Card.Text>
                  <Card.Text className="product-card-price">
                    <strong>₱ {product.price}</strong>
                  </Card.Text>
                  <Button variant="primary" as={NavLink} to={`/products/${product._id}`}>
                    View Details
                  </Button>
                </Card.Body>
              </Card>
            </Col>
          ))}
        </Row>
      </Container>
    );
}