// import React, { useState } from 'react';
// import { Button } from 'react-bootstrap';
// import { Notyf } from 'notyf';

// const ArchiveProduct = ({ product, isActive, fetchData }) => {
//     const [productId] = useState(product._id);
//     const notyf = new Notyf();

//     // Unified API call function
//     const toggleProductStatus = async (action) => {
//         try {
//             const endpoint = `${process.env.REACT_APP_API_BASE_URL}/products/${productId}/${action}`;
//             const response = await fetch(endpoint, {
//                 method: 'PATCH',
//                 headers: {
//                     'Content-Type': 'application/json',
//                     Authorization: `Bearer ${localStorage.getItem('token')}`,
//                 },
//             });

//             console.log(`${action} Response Status:`, response.status);

//             if (!response.ok) {
//                 throw new Error(`HTTP error! status: ${response.status}`);
//             }

//             const data = await response.json();
//             console.log(`${action} Response Data:`, data);

//             if (data.success) {
//                 const message = action === 'archive' ? 'Successfully Deactivated' : 'Successfully Activated';
//                 notyf.success(message);
//             } else {
//                 notyf.error('Something Went Wrong');
//             }

//             fetchData();
//         } catch (error) {
//             console.error(`${action} Error:`, error);
//             notyf.error(`Something Went Wrong: ${error.message}`);
//         }
//     };

//     return (
//         <>
//             {isActive ? (
//                 <Button
//                     variant="danger"
//                     size="sm"
//                     onClick={() => toggleProductStatus('archive')}
//                 >
//                     Deactivate
//                 </Button>
//             ) : (
//                 <Button
//                     variant="success"
//                     size="sm"
//                     onClick={() => toggleProductStatus('activate')}
//                 >
//                     Activate
//                 </Button>
//             )}
//         </>
//     );
// };

// export default ArchiveProduct;


import { useState } from 'react';
import { Button } from 'react-bootstrap';
import { Notyf } from 'notyf';

export default function ArchiveProduct({ product, isActive, fetchData }) {

    const notyf = new Notyf();
    const [productId] = useState(product._id);

    const handleArchiveToggle = () => {
        fetch(`${process.env.REACT_APP_API_BASE_URL}/products/${productId}/archive`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${localStorage.getItem('token')}`
            }
        })
        .then(res => {
            console.log('Archive Response Status:', res.status); // Log status code
            if (!res.ok) {
                throw new Error(`HTTP error! status: ${res.status}`);
            }
            return res.json();
        })
        .then(data => {
            console.log('Archive Response Data:', data); // Log response data
            if (data.success !== true ) {
                notyf.success("Successfully Deactivated");
            } else {
                notyf.error(`Something Went Wrong`);
            }
            fetchData();
        })
        .catch(error => {
            console.error('Archive Error:', error); 
            notyf.error(`Something Went Wrong: ${error.message}`);
        });
    }

    const handleActivateToggle = () => {
        fetch(`${process.env.REACT_APP_API_BASE_URL}/products/${productId}/activate`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${localStorage.getItem('token')}`
            }
        })
        .then(res => {
            console.log('Activate Response Status:', res.status); 
            if (!res.ok) {
                throw new Error(`HTTP error! status: ${res.status}`);
            }
            return res.json();
        })
        .then(data => {
            console.log('Activate Response Data:', data); 
            if (data.success !== true ) {
                notyf.success("Successfully Activated");
            } else {
                notyf.error(`Something Went Wrong`);
            }
            fetchData();
        })
        .catch(error => {
            console.error('Activate Error:', error); 
            notyf.error(`Something Went Wrong: ${error.message}`);
        });
    }

    return (
        <>
            {isActive ? (
                <Button variant="danger" size="sm" onClick={handleArchiveToggle}>
                    Deactivate
                </Button>
            ) : (
                <Button variant="success" size="sm" onClick={handleActivateToggle}>
                    Activate
                </Button>
            )}
        </>
    );
}