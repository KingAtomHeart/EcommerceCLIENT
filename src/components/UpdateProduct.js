// import { useState } from 'react';
// import { Button, Modal, Form } from 'react-bootstrap';
// import { Notyf } from 'notyf';
// import 'notyf/notyf.min.css';

// export default function UpdateProduct({ product, fetchData }) {
//   const notyf = new Notyf();
//   const [formData, setFormData] = useState({
//     name: product.name,
//     description: product.description,
//     price: product.price,
//   });
//   const [isSubmitting, setIsSubmitting] = useState(false);
//   const [showEdit, setShowEdit] = useState(false);

//   const openEdit = () => setShowEdit(true);
//   const closeEdit = () => setShowEdit(false);

//   const handleChange = (e) => {
//     const { name, value } = e.target;
//     setFormData({ ...formData, [name]: value });
//   };

//   const editProduct = (e) => {
//     e.preventDefault();
//     setIsSubmitting(true);

//     fetch(`${process.env.REACT_APP_API_BASE_URL}/products/${product._id}/update`, {
//       method: 'PATCH',
//       headers: {
//         'Content-Type': 'application/json',
//         Authorization: `Bearer ${localStorage.getItem('token')}`,
//       },
//       body: JSON.stringify(formData),
//     })
//       .then((res) => res.json())
//       .then((data) => {
//         if (data.success) {
//           notyf.success('Product updated successfully');
//           fetchData();
//         } else {
//           notyf.error(data.message || 'Failed to update product');
//         }
//         closeEdit();
//       })
//       .catch((err) => {
//         console.error('Error updating product:', err);
//         notyf.error('Error updating product. Please try again.');
//       })
//       .finally(() => setIsSubmitting(false));
//   };

//   return (
//     <>
//       <Button variant="primary" size="sm" onClick={openEdit}>
//         Update
//       </Button>

//       <Modal show={showEdit} onHide={closeEdit} aria-labelledby="update-product-modal">
//         <Form onSubmit={editProduct}>
//           <Modal.Header closeButton>
//             <Modal.Title id="update-product-modal">Update Product</Modal.Title>
//           </Modal.Header>

//           <Modal.Body>
//             <Form.Group className="mb-3">
//               <Form.Label htmlFor="product-name">Name</Form.Label>
//               <Form.Control
//                 id="product-name"
//                 type="text"
//                 name="name"
//                 value={formData.name}
//                 onChange={handleChange}
//                 required
//                 aria-required="true"
//               />
//             </Form.Group>

//             <Form.Group className="mb-3">
//               <Form.Label htmlFor="product-description">Description</Form.Label>
//               <Form.Control
//                 id="product-description"
//                 type="text"
//                 name="description"
//                 value={formData.description}
//                 onChange={handleChange}
//                 required
//                 aria-required="true"
//               />
//             </Form.Group>

//             <Form.Group className="mb-3">
//               <Form.Label htmlFor="product-price">Price</Form.Label>
//               <Form.Control
//                 id="product-price"
//                 type="number"
//                 name="price"
//                 value={formData.price}
//                 onChange={handleChange}
//                 step="0.01"
//                 min="0"
//                 required
//                 aria-required="true"
//               />
//             </Form.Group>
//           </Modal.Body>

//           <Modal.Footer>
//             <Button variant="primary" type="submit" disabled={isSubmitting}>
//               {isSubmitting ? 'Updating...' : 'Submit'}
//             </Button>
//             <Button variant="danger" onClick={closeEdit} disabled={isSubmitting}>
//               Close
//             </Button>
//           </Modal.Footer>
//         </Form>
//       </Modal>
//     </>
//   );
// }


import { useState } from 'react';
import { Button, Modal, Form } from 'react-bootstrap';
import { Notyf } from 'notyf';
import 'notyf/notyf.min.css';

export default function UpdateProduct({ product, fetchData }) {
  const notyf = new Notyf();

  const [productId] = useState(product._id);

  const [name, setName] = useState(product.name);
  const [description, setDescription] = useState(product.description);
  const [price, setPrice] = useState(product.price);

  const [showEdit, setShowEdit] = useState(false);

  const openEdit = () => {
    setShowEdit(true);
  };

  const closeEdit = () => {
    setShowEdit(false);
  };

  const editProduct = (e) => {
    e.preventDefault();

    fetch(`${process.env.REACT_APP_API_BASE_URL}/products/${productId}/update`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({
        name: name,
        description: description,
        price: price
      })
    })
      .then(res => res.json())
      .then(data => {
        if (data.success === true) {
          notyf.success("Product updated successfully");
          closeEdit();
          fetchData(); 
        } else {
          notyf.error("Failed to update product");
          closeEdit();
          fetchData();
        }
      })
      .catch(() => {
        notyf.error("Error updating product");
        closeEdit();
      });
  };

  return (
    <>
      <Button variant="primary" size="sm" onClick={openEdit}>Update</Button>

      <Modal show={showEdit} onHide={closeEdit}>
        <Form onSubmit={editProduct}>
          <Modal.Header closeButton>
            <Modal.Title>Update Product</Modal.Title>
          </Modal.Header>

          <Modal.Body>
            <Form.Group>
              <Form.Label>Name</Form.Label>
              <Form.Control 
                type="text" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                required 
              />
            </Form.Group>

            <Form.Group>
              <Form.Label>Description</Form.Label>
              <Form.Control 
                type="text" 
                value={description} 
                onChange={(e) => setDescription(e.target.value)} 
                required 
              />
            </Form.Group>

            <Form.Group>
              <Form.Label>Price</Form.Label>
              <Form.Control 
                type="number" 
                value={price} 
                onChange={(e) => setPrice(e.target.value)} 
                required 
              />
            </Form.Group>
          </Modal.Body>

          <Modal.Footer>
          <Button variant="primary" type="submit">Submit</Button>
            <Button variant="danger" onClick={closeEdit}>Close</Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </>
  );
}
