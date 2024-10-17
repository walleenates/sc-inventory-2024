import React, { useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, doc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { db, storage } from '../firebase/firebase-config';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import Camera from '../components/Camera';
import emailjs from 'emailjs-com';
import './ApproveRequest.css';

const categories = ["Equipment", "Office Supplies", "Books", "Electrical Parts"];
const colleges = ["CCS", "COC", "CED", "CBA", "BED", "COE"];

const ApproveRequest = () => {
  const [requestDetails, setRequestDetails] = useState({
    itemName: '',
    college: '',
    requestDate: '',
    imageUrl: '',
    category: '',
    uniqueId: '',
  });
  const [image, setImage] = useState(null);
  const [requests, setRequests] = useState([]);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [editingRequest, setEditingRequest] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [emailAddresses, setEmailAddresses] = useState({});
  const [approvalDates, setApprovalDates] = useState({});
  
  // State to manage open/close for college and category sections
  const [openColleges, setOpenColleges] = useState({});
  const [openCategories, setOpenCategories] = useState({});

  useEffect(() => {
    const requestCollection = collection(db, 'requests');
    const unsubscribe = onSnapshot(requestCollection, (snapshot) => {
      const fetchedRequests = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setRequests(fetchedRequests);
    });
    return () => unsubscribe();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setRequestDetails((prev) => ({ ...prev, [name]: value }));
    setErrorMessage('');
  };

  const handleEmailChange = (requestId, value) => {
    setEmailAddresses((prev) => ({ ...prev, [requestId]: value }));
  };

  const handleApprovalDateChange = (requestId, value) => {
    setApprovalDates((prev) => ({ ...prev, [requestId]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const isDuplicate = requests.some(request => request.uniqueId === requestDetails.uniqueId && request.id !== editingRequest?.id);
    if (isDuplicate) {
      setErrorMessage('Error: Request Number (Unique ID) must be unique.');
      return;
    }
    if (image) {
      const storageRef = ref(storage, `requests/${image.name}`);
      const uploadTask = uploadBytesResumable(storageRef, image);
      uploadTask.on(
        'state_changed',
        null,
        (error) => setErrorMessage('Error uploading image. Please try again.'),
        async () => {
          const uploadedImageUrl = await getDownloadURL(uploadTask.snapshot.ref);
          submitRequest(uploadedImageUrl);
        }
      );
    } else {
      submitRequest();
    }
  };

  const submitRequest = async (uploadedImageUrl = '') => {
    try {
      if (editingRequest) {
        const requestRef = doc(db, 'requests', editingRequest.id);
        await updateDoc(requestRef, {
          ...requestDetails,
          imageUrl: uploadedImageUrl || requestDetails.imageUrl,
          requestDate: new Date(requestDetails.requestDate).getTime(),
        });
        setEditingRequest(null);
      } else {
        await addDoc(collection(db, 'requests'), {
          ...requestDetails,
          imageUrl: uploadedImageUrl,
          requestDate: new Date(requestDetails.requestDate).getTime(),
          approved: false,
        });
      }
      resetForm();
    } catch (error) {
      setErrorMessage('Error submitting request.');
    }
  };

  const resetForm = () => {
    setRequestDetails({
      itemName: '',
      college: '',
      requestDate: '',
      imageUrl: '',
      category: '',
      uniqueId: '',
    });
    setImage(null);
    setEditingRequest(null);
    setErrorMessage('');
  };

  const sendNotification = async (approvalDate, request) => {
    const templateParams = {
      unique_id: request.uniqueId,
      college_requesting: request.college,
      purpose_of_request: request.itemName,
      category: request.category,
      request_date: new Date(request.requestDate).toLocaleDateString(),
      approval_date: new Date(approvalDate).toLocaleDateString(),
      email: emailAddresses[request.id] || '',
    };
    try {
      await emailjs.send('service_bl8cece', 'template_2914ned', templateParams, 'BMRt6JigJjznZL-FA');
    } catch (error) {
      setErrorMessage('Failed to send email notification.');
    }
  };

  const handlePurchased = async (requestId) => {
    const requestToUpdate = requests.find(req => req.id === requestId);
    
    const email = emailAddresses[requestId] || '';
    const approvalDate = approvalDates[requestId] || '';
    
    if (!approvalDate) {
      setErrorMessage('Error: Approval date is required to approve the request.');
      return;
    }
    
    if (!email) {
      setErrorMessage('Error: Email address is required to notify the requestor.');
      return;
    }
    
    if (!isEmailValid(email)) {
      setErrorMessage('Error: Invalid email format.');
      return;
    }

    try {
      const requestRef = doc(db, 'requests', requestId);
      await updateDoc(requestRef, {
        approvalDate: new Date(approvalDate).getTime(),
        approved: true,
        approvedEmail: email, // Save the email in the system
      });
      
      await sendNotification(new Date(approvalDate), requestToUpdate);
      setApprovalDates((prev) => ({ ...prev, [requestId]: '' })); // Clear approval date input for this request
    } catch (error) {
      setErrorMessage('Error updating approval status.');
    }
  };

  const handleEdit = (request) => {
    setEditingRequest(request);
    setRequestDetails({
      itemName: request.itemName,
      college: request.college,
      requestDate: new Date(request.requestDate).toISOString().substring(0, 10),
      imageUrl: request.imageUrl,
      category: request.category,
      uniqueId: request.uniqueId || '',
    });
    setImage(null);
  };

  const handleDelete = async (requestId) => {
    try {
      await deleteDoc(doc(db, 'requests', requestId));
      const updatedEmailAddresses = { ...emailAddresses };
      delete updatedEmailAddresses[requestId]; 
      setEmailAddresses(updatedEmailAddresses);
    } catch (error) {
      setErrorMessage('Error deleting request.');
    }
  };

  const handleImageCapture = (capturedImage) => {
    if (capturedImage instanceof File || capturedImage instanceof Blob) {
      setImage(capturedImage);
    } else {
      setErrorMessage('Invalid image format.');
    }
    setIsCameraOpen(false);
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file && (file instanceof File || file instanceof Blob)) {
      setImage(file);
    } else {
      setErrorMessage('Invalid image format.');
    }
  };

  const isEmailValid = (email) => {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailPattern.test(email);
  };

  // Group requests by college and then by category
  const groupedRequests = () => {
    return requests.reduce((acc, request) => {
      if (!acc[request.college]) {
        acc[request.college] = {};
      }
      if (!acc[request.college][request.category]) {
        acc[request.college][request.category] = [];
      }
      acc[request.college][request.category].push(request);
      return acc;
    }, {});
  };

  const toggleCollege = (college) => {
    setOpenColleges((prev) => ({ ...prev, [college]: !prev[college] }));
  };

  const toggleCategory = (college, category) => {
    setOpenCategories((prev) => ({
      ...prev,
      [`${college}-${category}`]: !prev[`${college}-${category}`],
    }));
  };

  const renderRequests = () => {
    const requestsByCollege = groupedRequests();
    return Object.keys(requestsByCollege).map((college) => (
      <div key={college} className="college-section">
        <h3 onClick={() => toggleCollege(college)} style={{ cursor: 'pointer' }}>
          {college} {openColleges[college] ? '[-]' : '[+]'}
        </h3>
        {openColleges[college] && (
          <div>
            {Object.keys(requestsByCollege[college]).map((category) => (
              <div key={category} className="category-section">
                <h4 onClick={() => toggleCategory(college, category)} style={{ cursor: 'pointer' }}>
                  {category} {openCategories[`${college}-${category}`] ? '[-]' : '[+]'}
                </h4>
                {openCategories[`${college}-${category}`] && (
                  <ul>
                    {requestsByCollege[college][category].map((request) => (
                      <li key={request.id}>
                        <div>
                          <p><strong>Item Name:</strong> {request.itemName}</p>
                          <p><strong>Request Date:</strong> {new Date(request.requestDate).toLocaleDateString()}</p>
                          <p><strong>Unique ID:</strong> {request.uniqueId}</p>
                          {request.imageUrl && <img src={request.imageUrl} alt="Uploaded" width="100" />}
                          {request.approved && (
                            <>
                              <p><strong>Approval Date:</strong> {new Date(request.approvalDate).toLocaleDateString()}</p>
                              <p><strong>Email Notified:</strong> {request.approvedEmail}</p>
                            </>
                          )}
                          {!request.approved && (
                            <>
                              <label>
                                Notify Requestor Email:
                                <input
                                  type="email"
                                  placeholder="Email"
                                  onChange={(e) => handleEmailChange(request.id, e.target.value)}
                                  value={emailAddresses[request.id] || ''}
                                  required
                                />
                              </label>
                              <label>
                                Approval Date:
                                <input
                                  type="date"
                                  onChange={(e) => handleApprovalDateChange(request.id, e.target.value)}
                                  value={approvalDates[request.id] || ''}
                                  required
                                />
                              </label>
                              <button onClick={() => handlePurchased(request.id)}>Approve Request</button>
                            </>
                          )}
                          <button onClick={() => handleEdit(request)}>Edit</button>
                          <button onClick={() => handleDelete(request.id)}>Delete</button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    ));
  };

  return (
    <div className="approve-request">
      <h1>Approve Requests</h1>
      {errorMessage && <p className="error-message">{errorMessage}</p>}
      <form onSubmit={handleSubmit}>
        <label>
          Purpose of the Request Item:
          <input type="text" name="itemName" value={requestDetails.itemName} onChange={handleInputChange} required />
        </label>
        <label>
          College:
          <select name="college" value={requestDetails.college} onChange={handleInputChange} required>
            <option value="">Select College</option>
            {colleges.map((college) => (
              <option key={college} value={college}>{college}</option>
            ))}
          </select>
        </label>
        <label>
          Request Date:
          <input type="date" name="requestDate" value={requestDetails.requestDate} onChange={handleInputChange} required />
        </label>
        <label>
          Category:
          <select name="category" value={requestDetails.category} onChange={handleInputChange} required>
            <option value="">Select Category</option>
            {categories.map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
        </label>
        <label>
          Unique ID (Request Number):
          <input type="text" name="uniqueId" value={requestDetails.uniqueId} onChange={handleInputChange} required />
        </label>
        <label>
          Upload Image:
          <input type="file" accept="image/*" onChange={handleImageUpload} />
          <button type="button" onClick={() => setIsCameraOpen(true)}>Open Camera</button>
        </label>
        {isCameraOpen && <Camera onCapture={handleImageCapture} />}
        <button type="submit">{editingRequest ? 'Update Request' : 'Submit Request'}</button>
      </form>
      {renderRequests()}
    </div>
  );
};

export default ApproveRequest;
