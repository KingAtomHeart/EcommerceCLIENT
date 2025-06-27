// // AdminView.js
// import React, { useState, useEffect } from 'react';
// import { Button, Table, Spinner, Alert, Modal } from 'react-bootstrap';
// import UpdateProduct from './UpdateProduct';
// import ArchiveProduct from './ArchiveProduct';
// import CreateProduct from './CreateProduct';
// import './app.css';

// const AdminView = () => {
//     const [products, setProducts] = useState([]);
//     const [loading, setLoading] = useState(true);
//     const [error, setError] = useState(null);
//     const [showModal, setShowModal] = useState(false);
//     const [isFormValid, setIsFormValid] = useState(false);

//     // Fetch product data from the server
//     const fetchData = async () => {
//         setLoading(true);
//         try {
//             const response = await fetch(`${process.env.REACT_APP_API_BASE_URL}/products/all`, {
//                 headers: {
//                     Authorization: `Bearer ${localStorage.getItem('token')}`,
//                 },
//             });

//             if (!response.ok) {
//                 throw new Error('Failed to fetch products');
//             }

//             const data = await response.json();
//             setProducts(data);
//         } catch (err) {
//             setError('Error fetching products');
//         } finally {
//             setLoading(false);
//         }
//     };

//     useEffect(() => {
//         fetchData();
//     }, []);

//     // Modal handlers
//     const handleShowModal = () => setShowModal(true);
//     const handleCloseModal = () => setShowModal(false);

//     // Form submission and validation
//     const handleCreateProductSubmit = () => {
//         fetchData();
//         handleCloseModal();
//     };

//     const handleFormValidityChange = (isValid) => setIsFormValid(isValid);

//     // Render loading state
//     if (loading) {
//         return (
//             <div className="text-center my-4">
//                 <Spinner animation="border" variant="primary" />
//                 <p className="mt-2">Loading...</p>
//             </div>
//         );
//     }

//     // Render error state
//     if (error) {
//         return (
//             <div className="text-center my-4">
//                 <Alert variant="danger">{error}</Alert>
//             </div>
//         );
//     }

//     return (
//         <div className="admin-view">
//             <h1 className="text-center my-4">Admin Dashboard</h1>
//             <div className="my-4 text-center">
//                 <Button variant="primary" onClick={handleShowModal} className="mb-3">
//                     Create Product
//                 </Button>
//             </div>

//             <Table striped bordered hover responsive>
//                 <thead>
//                     <tr className="text-center">
//                         <th>ID</th>
//                         <th>Name</th>
//                         <th>Description</th>
//                         <th>Price</th>
//                         <th>Availability</th>
//                         <th colSpan="2">Actions</th>
//                     </tr>
//                 </thead>
//                 <tbody>
//                     {products.length > 0 ? (
//                         products.map((product) => (
//                             <tr key={product._id}>
//                                 <td>{product._id}</td>
//                                 <td>{product.name}</td>
//                                 <td>{product.description}</td>
//                                 <td>₱{product.price}</td>
//                                 <td className={product.isActive ? 'text-success' : 'text-danger'}>
//                                     {product.isActive ? 'Available' : 'Unavailable'}
//                                 </td>
//                                 <td className="text-center">
//                                     <UpdateProduct product={product} fetchData={fetchData} />
//                                 </td>
//                                 <td className="text-center">
//                                     <ArchiveProduct
//                                         product={product}
//                                         isActive={product.isActive}
//                                         fetchData={fetchData}
//                                     />
//                                 </td>
//                             </tr>
//                         ))
//                     ) : (
//                         <tr>
//                             <td colSpan="7" className="text-center">
//                                 No products available
//                             </td>
//                         </tr>
//                     )}
//                 </tbody>
//             </Table>

//             <Modal show={showModal} onHide={handleCloseModal} centered>
//                 <Modal.Header closeButton>
//                     <Modal.Title>Create Product</Modal.Title>
//                 </Modal.Header>
//                 <Modal.Body>
//                     <CreateProduct
//                         onSubmit={handleCreateProductSubmit}
//                         onFormValidityChange={handleFormValidityChange}
//                     />
//                 </Modal.Body>
//                 <Modal.Footer>
//                     <Button
//                         variant="primary"
//                         type="submit"
//                         form="create-product-form"
//                         disabled={!isFormValid}
//                     >
//                         Submit
//                     </Button>
//                     <Button variant="secondary" onClick={handleCloseModal}>
//                         Close
//                     </Button>
//                 </Modal.Footer>
//             </Modal>
//         </div>
//     );
// };

// export default AdminView;


import { useState, useEffect } from 'react';
import { Button, Table, Spinner, Alert, Modal } from 'react-bootstrap';
import UpdateProduct from './UpdateProduct';
import ArchiveProduct from './ArchiveProduct';
import CreateProduct from './CreateProduct';
import './app.css';

export default function AdminView() {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showModal, setShowModal] = useState(false); 
    const [isFormValid, setIsFormValid] = useState(false); 

    const fetchData = () => {
        setLoading(true);
        fetch(`${process.env.REACT_APP_API_BASE_URL}/products/all`, {
            headers: {
                Authorization: `Bearer ${localStorage.getItem('token')}`
            }
        })
        .then(response => response.json())
        .then(data => {
            setProducts(data);
            setLoading(false);
        })
        .catch(error => {
            setError('Error fetching products');
            setLoading(false);
        });
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleShow = () => setShowModal(true); 
    const handleClose = () => setShowModal(false); 

    const handleCreateProductSubmit = () => {
        fetchData(); 
        handleClose(); 
    };

    const handleFormValidityChange = (isValid) => {
        setIsFormValid(isValid);
    };

    if (loading) {
        return (
            <div className="text-center my-4">
                <Spinner animation="border" variant="primary" />
                <p className="mt-2"></p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center my-4">
                <Alert variant="danger">
                    {error}
                </Alert>
            </div>
        );
    }

    return (
        <>
            <h1 className="text-center my-4">Admin Dashboard</h1>
            <div className="my-4 text-center">
                <Button variant="primary" onClick={handleShow} className="mb-3">
                    Create Product
                </Button>
            </div>
            <Table striped bordered hover responsive>
                <thead>
                    <tr className="text-center">
                        <th>ID</th>
                        <th>Name</th>
                        <th>Description</th>
                        <th>Price</th>
                        <th>Availability</th>
                        <th colSpan="2">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {products.length > 0 ? (
                        products.map(product => (
                            <tr key={product._id}>
                                <td>{product._id}</td>
                                <td>{product.name}</td>
                                <td>{product.description}</td>
                                <td>₱{product.price}</td>
                                <td className={product.isActive ? "text-success" : "text-danger"}>
                                    {product.isActive ? "Available" : "Unavailable"}
                                </td>
                                <td className="text-center">
                                    <UpdateProduct product={product} fetchData={fetchData} />
                                </td>
                                <td className="text-center">
                                    <ArchiveProduct product={product} isActive={product.isActive} fetchData={fetchData} />
                                </td>
                            </tr>
                        ))
                    ) : (
                        <tr>
                            <td colSpan="7" className="text-center">No products available</td>
                        </tr>
                    )}
                </tbody>
            </Table>

         
            <Modal show={showModal} onHide={handleClose} centered>
                <Modal.Header closeButton>
                    <Modal.Title>Create Product</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <CreateProduct 
                        onSubmit={handleCreateProductSubmit} 
                        onFormValidityChange={handleFormValidityChange} 
                    />
                </Modal.Body>
                <Modal.Footer>
                    <Button 
                        variant="primary" 
                        type="submit" 
                        form="create-product-form" 
                        disabled={!isFormValid}
                    >
                        Submit
                    </Button>
                    <Button variant="danger" onClick={handleClose}>Close</Button>
                </Modal.Footer>
            </Modal>
        </>
    );
}
