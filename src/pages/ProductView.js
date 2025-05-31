import { useState, useEffect, useContext } from 'react';
import { Container, Card, Button, Row, Col } from 'react-bootstrap';
import { useParams, useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import UserContext from '../context/UserContext';
import { Notyf } from 'notyf';
import 'notyf/notyf.min.css';

export default function ProductView() {
  const notyf = new Notyf();
  const { productId } = useParams();
  const { user } = useContext(UserContext) || {}; 
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState(0);
  const [quantity, setQuantity] = useState(1); 

  const handleQuantityChange = (change) => {
    setQuantity(prevQuantity => {
      const newQuantity = prevQuantity + change;
      return newQuantity > 0 ? newQuantity : 1; 
    });
  };

  function addToCart(productId) {
    fetch(`${process.env.REACT_APP_API_BASE_URL}/cart/add-to-cart`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({
        productId: productId,
        quantity: quantity, 
        subtotal: price * quantity 
      })
    })
    .then(res => res.json())
    .then(data => {
      if (data.message === 'Item added to cart successfully') {
        notyf.success("Item Added to Cart");
        navigate("/products");
      } else {
        notyf.error("Internal Server Error. Notify System Admin.");
      }
    });
  }

  useEffect(() => {
    console.log(productId);

    fetch(`${process.env.REACT_APP_API_BASE_URL}/products/${productId}`)
      .then(res => res.json())
      .then(data => {
        console.log(data);

        setName(data.name);
        setDescription(data.description);
        setPrice(data.price);
      });
  }, [productId]);

  return (
    <Container className="mt-5">
      <Row>
        <Col lg={{ span: 3, offset: 3 }}>
          <Card>
            <Card.Body className="text-center">
              <Card.Title>{name}</Card.Title>
              <Card.Subtitle>Description:</Card.Subtitle>
              <Card.Text>{description}</Card.Text>
              <Card.Subtitle>Price:</Card.Subtitle>
              <Card.Text><strong>₱ {price}</strong></Card.Text>
              
              {!user?.isAdmin && (
                <>
                  <div className="d-flex justify-content-center align-items-center mb-3">
                    <Button variant="outline-secondary" onClick={() => handleQuantityChange(-1)}>-</Button>
                    <span className="mx-3">{quantity}</span>
                    <Button variant="outline-secondary" onClick={() => handleQuantityChange(1)}>+</Button>
                  </div>

                  <Button variant="primary" block="true" onClick={() => addToCart(productId)}>
                    Add to Cart
                  </Button>
                </>
              )}

              {(!user || user.id === null) && (
                <Link className="btn btn-danger" to="/login">
                  Login to Purchase
                </Link>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}