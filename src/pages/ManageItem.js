// src/components/ManageItem.js

import React, { useState, useEffect, useRef } from 'react';
import { db, storage } from '../firebase/firebase-config';
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
} from 'firebase/firestore';
import { Timestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import JsBarcode from 'jsbarcode';
import Camera from '../components/Camera';

import './ManageItem.css';

const colleges = ["CCS", "COC", "CED", "CBA", "BED", "COE"];
const offices = ["Office A", "Office B", "Office C"]; // New offices array
const departments = ["Department X", "Department Y", "Department Z"]; // New departments array
const itemTypes = ["Equipment", "Office Supplies", "Books", "Electrical Parts"];

const Barcode = ({ value }) => {
  const svgRef = useRef(null);

  useEffect(() => {
    if (svgRef.current) {
      JsBarcode(svgRef.current, value, {
        format: "CODE128",
        lineColor: "#000",
        width: 2,
        height: 50,
        displayValue: true,
      });
    }
  }, [value]);

  return <svg ref={svgRef}></svg>;
};

const ManageItem = () => {
  const [items, setItems] = useState([]);
  const [newItem, setNewItem] = useState("");
  const [selectedCollege, setSelectedCollege] = useState(""); // College selection is now optional
  const [selectedOffice, setSelectedOffice] = useState(""); // New state for selected office
  const [selectedDepartment, setSelectedDepartment] = useState(""); // New state for selected department
  const [quantity, setQuantity] = useState(1);
  const [amount, setAmount] = useState(0);
  const [requestedDate, setRequestedDate] = useState("");
  const [supplier, setSupplier] = useState("");
  const [itemType, setItemType] = useState("Equipment");
  const [editItem, setEditItem] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [editCollege, setEditCollege] = useState("");
  const [editOffice, setEditOffice] = useState(""); // New edit state for office
  const [editDepartment, setEditDepartment] = useState(""); // New edit state for department
  const [editQuantity, setEditQuantity] = useState(1);
  const [editAmount, setEditAmount] = useState(0);
  const [editRequestedDate, setEditRequestedDate] = useState("");
  const [editSupplier, setEditSupplier] = useState("");
  const [editItemType, setEditItemType] = useState("Equipment");
  const [imagePreview, setImagePreview] = useState(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [visibleColleges, setVisibleColleges] = useState({});
  const [saveOption, setSaveOption] = useState('local');

  useEffect(() => {
    const itemsCollection = collection(db, "items");
    const unsubscribe = onSnapshot(itemsCollection, (snapshot) => {
      const fetchedItems = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setItems(fetchedItems);
    });

    return () => unsubscribe();
  }, []);

  const generateBarcode = () => {
    return `ITEM-${Math.random().toString(36).substr(2, 9)}`;
  };

  const handleAddItem = async () => {
    if (newItem && quantity > 0 && amount >= 0 && requestedDate && supplier && itemType) {
      const newBarcode = generateBarcode();
      try {
        await addDoc(collection(db, "items"), {
          text: newItem,
          college: selectedCollege || null, // Optional: Set to null if not selected
          collegeType: selectedCollege ? 'College' : selectedDepartment ? 'Department' : null, // Determine type
          office: selectedOffice || null, // Optional: Set to null if not selected
          department: selectedDepartment || null, // Optional: Set to null if not selected
          quantity,
          amount,
          requestedDate: new Date(requestedDate),
          supplier,
          itemType,
          barcode: newBarcode,
          image: imagePreview,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
        clearFields();
      } catch (error) {
        console.error("Error adding document: ", error);
      }
    }
  };

  const handleEditItem = (item) => {
    setEditItem(item);
    setEditValue(item.text);
    setEditCollege(item.college);
    setEditOffice(item.office || ""); // Handle undefined values
    setEditDepartment(item.department || ""); // Handle undefined values
    setEditQuantity(item.quantity);
    setEditAmount(item.amount);
    setEditRequestedDate(item.requestedDate.toDate().toISOString().substr(0, 10));
    setEditSupplier(item.supplier);
    setEditItemType(item.itemType);
    setImagePreview(item.image);
  };

  const handleSaveEdit = async () => {
    if (editItem && editValue && editQuantity > 0 && editAmount >= 0 && editRequestedDate && editSupplier && editItemType) {
      try {
        const itemDoc = doc(db, "items", editItem.id);
        await updateDoc(itemDoc, {
          text: editValue,
          college: editCollege,
          office: editOffice || null, // Optional: Set to null if not selected
          department: editDepartment || null, // Optional: Set to null if not selected
          quantity: editQuantity,
          amount: editAmount,
          requestedDate: new Date(editRequestedDate),
          supplier: editSupplier,
          itemType: editItemType,
          image: imagePreview,
          updatedAt: Timestamp.now(),
        });
        clearEditFields();
      } catch (error) {
        console.error("Error updating document: ", error);
      }
    }
  };

  const handleDeleteItem = async (id) => {
    try {
      const itemDoc = doc(db, "items", id);
      await deleteDoc(itemDoc);
    } catch (error) {
      console.error("Error deleting document: ", error);
    }
  };

  const toggleFolderVisibility = (college) => {
    setVisibleColleges((prevState) => ({
      ...prevState,
      [college]: !prevState[college],
    }));
  };

  const groupedItems = items.reduce((acc, item) => {
    if (!acc[item.college]) {
      acc[item.college] = { items: [], totalQuantity: 0 };
    }
    acc[item.college].items.push(item);
    acc[item.college].totalQuantity += item.quantity;
    return acc;
  }, {});

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveOptionChange = (e) => {
    setSaveOption(e.target.value);
  };

  const handleCameraCapture = async (imageUrl) => {
    if (saveOption === 'local') {
      const link = document.createElement('a');
      link.href = imageUrl;
      link.download = 'captured-image.png';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      alert("Image downloaded successfully.");
    } else if (saveOption === 'system') {
      const fileName = `captured-image-${Date.now()}.png`;
      const storageRef = ref(storage, `images/${fileName}`);
      try {
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        await uploadBytes(storageRef, blob);
        const downloadURL = await getDownloadURL(storageRef);
        setImagePreview(downloadURL);
      } catch (error) {
        console.error("Error uploading file: ", error);
      }
    }
    setIsCameraOpen(false);
  };

  const clearFields = () => {
    setNewItem("");
    setSelectedCollege("");
    setSelectedOffice(""); // Clear office selection
    setSelectedDepartment(""); // Clear department selection
    setQuantity(1);
    setAmount(0);
    setRequestedDate("");
    setSupplier("");
    setItemType("Equipment");
    setImagePreview(null);
  };

  const clearEditFields = () => {
    setEditItem(null);
    setEditValue("");
    setEditCollege("");
    setEditOffice(""); // Clear edit office selection
    setEditDepartment(""); // Clear edit department selection
    setEditQuantity(1);
    setEditAmount(0);
    setEditRequestedDate("");
    setEditSupplier("");
    setEditItemType("Equipment");
    setImagePreview(null);
  };

  return (
    <div className="manage-item-container">
      <h1>Manage Items</h1>
      <div className="add-item">
        <input type="text" value={newItem} onChange={(e) => setNewItem(e.target.value)} placeholder="Add new item" />
        <select value={selectedCollege} onChange={(e) => setSelectedCollege(e.target.value)}>
          <option value="">Select College (Optional)</option> {/* Changed to optional */}
          {colleges.map((college) => (
            <option key={college} value={college}>{college}</option>
          ))}
        </select>
        
        {/* Office Dropdown */}
        <select value={selectedOffice} onChange={(e) => setSelectedOffice(e.target.value)}>
          <option value="">Select Office (Optional)</option>
          {offices.map((office) => (
            <option key={office} value={office}>{office}</option>
          ))}
        </select>

        {/* Department Dropdown */}
        <select value={selectedDepartment} onChange={(e) => setSelectedDepartment(e.target.value)}>
          <option value="">Select Department (Optional)</option>
          {departments.map((department) => (
            <option key={department} value={department}>{department}</option>
          ))}
        </select>

        <input type="number" value={quantity} min="1" onChange={(e) => setQuantity(parseInt(e.target.value))} />
        <input type="number" value={amount} min="0" onChange={(e) => setAmount(parseFloat(e.target.value))} />
        <input type="date" value={requestedDate} onChange={(e) => setRequestedDate(e.target.value)} />
        <input type="text" value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="Supplier" />
        <select value={itemType} onChange={(e) => setItemType(e.target.value)}>
          {itemTypes.map((type) => <option key={type} value={type}>{type}</option>)}
        </select>
        <input type="file" onChange={handleImageUpload} />
        <div>
          <label>Save Option:</label>
          <select value={saveOption} onChange={handleSaveOptionChange}>
            <option value="local">Save Locally</option>
            <option value="system">Save to System</option>
          </select>
          <button onClick={() => setIsCameraOpen(true)}>Capture Image</button>
        </div>
        {isCameraOpen && <Camera onCapture={handleCameraCapture} />}
        <button onClick={handleAddItem}>Add Item</button>
      </div>

      <div className="item-list">
  {Object.entries(groupedItems).map(([college, { items, totalQuantity }]) => (
    <div key={college} className="college-section">
      <div className="college-header" onClick={() => toggleFolderVisibility(college)}>
        {college} - Total Quantity: {totalQuantity}
      </div>
      {visibleColleges[college] && (
        <table>
          <thead>
            <tr>
              <th>Item Name</th>
              <th>College</th>
              <th>Office</th>
              <th>Department</th>
              <th>Quantity</th>
              <th>Amount</th>
              <th>Requested Date</th>
              <th>Supplier</th>
              <th>Type</th>
              <th>Image</th>
              <th>Barcode</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>{item.text}</td>
                <td>{item.college}</td>
                <td>{item.office}</td>
                <td>{item.department ? item.department : 'Departments'}</td> {/* Label null as "Departments" */}
                <td>{item.quantity}</td>
                <td>{item.amount}</td>
                <td>{item.requestedDate.toDate().toLocaleDateString()}</td>
                <td>{item.supplier}</td>
                <td>{item.itemType}</td>
                <td>
                  {item.image && <img src={item.image} alt="Item" width="50" />}
                </td>
                <td><Barcode value={item.barcode} /></td>
                <td>
                  <button onClick={() => handleEditItem(item)}>Edit</button>
                  <button onClick={() => handleDeleteItem(item.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  ))}
</div>


      {editItem && (
        <div className="edit-item">
          <h2>Edit Item</h2>
          <input type="text" value={editValue} onChange={(e) => setEditValue(e.target.value)} />
          <select value={editCollege} onChange={(e) => setEditCollege(e.target.value)}>
            <option value="">Select College (Optional)</option> {/* Changed to optional */}
            {colleges.map((college) => (
              <option key={college} value={college}>{college}</option>
            ))}
          </select>
          <input type="number" value={editQuantity} min="1" onChange={(e) => setEditQuantity(parseInt(e.target.value))} />
          <input type="number" value={editAmount} min="0" onChange={(e) => setEditAmount(parseFloat(e.target.value))} />
          <input type="date" value={editRequestedDate} onChange={(e) => setEditRequestedDate(e.target.value)} />
          <input type="text" value={editSupplier} onChange={(e) => setEditSupplier(e.target.value)} />
          <select value={editItemType} onChange={(e) => setEditItemType(e.target.value)}>
            {itemTypes.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
          <input type="file" onChange={handleImageUpload} />
          <button onClick={handleSaveEdit}>Save</button>
        </div>
      )}
    </div>
  );
};

export default ManageItem;
