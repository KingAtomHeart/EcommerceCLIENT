// import { Card, Button, Col } from 'react-bootstrap';
// import { Link } from 'react-router-dom';
// import PropTypes from 'prop-types';
// import './app.css';

// export default function ProductCard({ productProp: { _id, name, description, price } }) {
//     return (
//         <Col sm={12} md={6} lg={4} className="product-card">
//             <Card className="h-100">
//                 <Card.Body className="d-flex flex-column justify-content-between">
//                     <div>
//                         <Card.Title>{name}</Card.Title>
//                         <Card.Text>{description}</Card.Text>
//                     </div>
//                     <div>
//                         <Card.Text>
//                             <strong>₱ {price?.toFixed(2) || '0.00'}</strong>
//                         </Card.Text>
//                         <Link to={`/products/${_id}`}>
//                             <Button variant="primary" className="w-100" aria-label={`View details for ${name}`}>
//                                 View Details
//                             </Button>
//                         </Link>
//                     </div>
//                 </Card.Body>
//             </Card>
//         </Col>
//     );
// }

// // PropTypes validation
// ProductCard.propTypes = {
//     productProp: PropTypes.shape({
//         _id: PropTypes.string.isRequired,
//         name: PropTypes.string.isRequired,
//         description: PropTypes.string.isRequired,
//         price: PropTypes.number.isRequired,
//     }).isRequired,
// };

// // Default Props (optional)
// ProductCard.defaultProps = {
//     productProp: {
//         description: 'No description available',
//     },
// };


import { Card, Button, Col } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import PropTypes from 'prop-types';
import './app.css';

export default function ProductCard({ productProp }) {
    const { _id, name, description, price } = productProp;

    return (
        <Col sm={12} md={6} lg={4} className="product-card"> 
            <Card className="h-100">
                <Card.Body className="d-flex flex-column justify-content-between">
                    <div>
                        <Card.Title>{name}</Card.Title>
                        <Card.Text>{description}</Card.Text>
                    </div>
                    <div>
                        <Card.Text>
                            <strong>₱ {price.toFixed(2)}</strong>
                        </Card.Text>
                        <Link to={`/products/${_id}`}>
                            <Button variant="primary" className="w-100">View Details</Button>
                        </Link>
                    </div>
                </Card.Body>
            </Card>
        </Col>
    );
}

// PropTypes validation
ProductCard.propTypes = {
    productProp: PropTypes.shape({
        _id: PropTypes.string.isRequired,
        name: PropTypes.string.isRequired,
        description: PropTypes.string.isRequired,
        price: PropTypes.number.isRequired,
    }).isRequired,
};