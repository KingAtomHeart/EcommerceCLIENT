// // CreateProduct.js
// import { useState, useContext, useEffect } from 'react';
// import { Form } from 'react-bootstrap';
// import UserContext from '../context/UserContext';
// import { Notyf } from 'notyf';
// import 'notyf/notyf.min.css';
// import './app.css'

// export default function CreateProduct({ onSubmit, onFormValidityChange }) { // Accept onFormValidityChange as prop

//     const notyf = new Notyf();
//     const { user } = useContext(UserContext);

//     const [name, setName] = useState("");
//     const [description, setDescription] = useState("");
//     const [price, setPrice] = useState("");

//     useEffect(() => {
//         // Validate form fields
//         const isValid = name.trim() !== "" && description.trim() !== "" && !isNaN(price) && price > 0;
//         onFormValidityChange(isValid);
//     }, [name, description, price, onFormValidityChange]);

//     function createProduct(e) {
//         e.preventDefault();

//         let token = localStorage.getItem('token');
//         if (!token) {
//             notyf.error("Error: No token found.");
//             return;
//         }

//         fetch(`${process.env.REACT_APP_API_BASE_URL}/products`, {
//             method: 'POST',
//             headers: {
//                 "Content-Type": "application/json",
//                 'Authorization': `Bearer ${token}`
//             },
//             body: JSON.stringify({
//                 name: name,
//                 description: description,
//                 price: price
//             })
//         })
//         .then(res => res.json())
//         .then(data => {
//             console.log(data);

//             if (data.error === "Product already exists") {
//                 notyf.error("Error: Product already exists.");
//             } else if (data._id) {
//                 // Product was successfully created
//                 setName("");
//                 setDescription("");
//                 setPrice("");

//                 notyf.success("Product Added Successfully.");
//                 onSubmit(); // Call the onSubmit handler
//             } else {
//                 notyf.error("Error: Something went wrong.");
//             }
//         })
//         .catch(err => {
//             console.error(err);
//             notyf.error("Error: Unable to connect to server.");
//         });
//     }

//     return (
//         user.isAdmin
//         ?
//         <Form id="create-product-form" onSubmit={createProduct}>
//             <Form.Group className="mb-3">
//                 <Form.Label>Name:</Form.Label>
//                 <Form.Control
//                     type="text"
//                     placeholder="Enter Name"
//                     required
//                     value={name}
//                     onChange={e => setName(e.target.value)}
//                 />
//             </Form.Group>
//             <Form.Group className="mb-3">
//                 <Form.Label>Description:</Form.Label>
//                 <Form.Control
//                     type="text"
//                     placeholder="Enter Description"
//                     required
//                     value={description}
//                     onChange={e => setDescription(e.target.value)}
//                 />
//             </Form.Group>
//             <Form.Group className="mb-3">
//                 <Form.Label>Price:</Form.Label>
//                 <Form.Control
//                     type="number"
//                     placeholder="Enter Price"
//                     required
//                     value={price}
//                     onChange={e => setPrice(e.target.value)}
//                 />
//             </Form.Group>
//         </Form>
//         :
//         <div>Access Denied</div> // Display an access denied message if not an admin
//     );
// }

import { useState, useContext, useEffect } from 'react';
import { Form } from 'react-bootstrap';
import UserContext from '../context/UserContext';
import { Notyf } from 'notyf';
import 'notyf/notyf.min.css';
import './app.css'

export default function CreateProduct({ onSubmit, onFormValidityChange }) { 

    const notyf = new Notyf();
    const { user } = useContext(UserContext);

    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [price, setPrice] = useState("");

    useEffect(() => {
        // Validate form fields
        const isValid = name.trim() !== "" && description.trim() !== "" && !isNaN(price) && price > 0;
        onFormValidityChange(isValid);
    }, [name, description, price, onFormValidityChange]);

    function createProduct(e) {
        e.preventDefault();

        let token = localStorage.getItem('token');
        if (!token) {
            notyf.error("Error: No token found.");
            return;
        }

        fetch(`${process.env.REACT_APP_API_BASE_URL}/products`, {
            method: 'POST',
            headers: {
                "Content-Type": "application/json",
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                name: name,
                description: description,
                price: price
            })
        })
        .then(res => res.json())
        .then(data => {
            console.log(data);

            if (data.error === "Product already exists") {
                notyf.error("Error: Product already exists.");
            } else if (data._id) {
                // Product was successfully created
                setName("");
                setDescription("");
                setPrice("");

                notyf.success("Product Added Successfully.");
                onSubmit(); // Call the onSubmit handler
            } else {
                notyf.error("Error: Something went wrong.");
            }
        })
        .catch(err => {
            console.error(err);
            notyf.error("Error: Unable to connect to server.");
        });
    }

    return (
        user.isAdmin
        ?
        <Form id="create-product-form" onSubmit={createProduct}>
            <Form.Group className="mb-3">
                <Form.Label>Name:</Form.Label>
                <Form.Control
                    type="text"
                    placeholder="Enter Name"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                />
            </Form.Group>
            <Form.Group className="mb-3">
                <Form.Label>Description:</Form.Label>
                <Form.Control
                    type="text"
                    placeholder="Enter Description"
                    required
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                />
            </Form.Group>
            <Form.Group className="mb-3">
                <Form.Label>Price:</Form.Label>
                <Form.Control
                    type="number"
                    placeholder="Enter Price"
                    required
                    value={price}
                    onChange={e => setPrice(e.target.value)}
                />
            </Form.Group>
        </Form>
        :
        <div>Access Denied</div> // Display an access denied message if not an admin
    );
}
