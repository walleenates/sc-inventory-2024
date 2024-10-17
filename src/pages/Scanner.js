import React, { useState, useEffect, useCallback, useRef } from 'react';
import { db } from '../firebase/firebase-config';
import { collection, getDocs, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import Webcam from 'react-webcam';
import { BrowserMultiFormatReader } from '@zxing/library';
import JsBarcode from 'jsbarcode';
import './Scanner.css';

const Scanner = () => {
  const [quantityInput, setQuantityInput] = useState(1);
  const [items, setItems] = useState([]);
  const [message, setMessage] = useState('');
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [searchMode, setSearchMode] = useState(false);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [videoDevices, setVideoDevices] = useState([]);
  const [searchedItem, setSearchedItem] = useState(null); // State to hold the searched item details
  const webcamRef = useRef(null);
  const codeReader = useRef(new BrowserMultiFormatReader());

  // Fetch items from Firestore
  const fetchItems = async () => {
    const itemsCollection = collection(db, 'items');
    const itemSnapshot = await getDocs(itemsCollection);
    const itemList = itemSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setItems(itemList);
  };

  // Get camera devices on mount
  useEffect(() => {
    const getDevices = async () => {
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = allDevices.filter(device => device.kind === 'videoinput');
      setVideoDevices(videoDevices);
      if (videoDevices.length > 0) {
        setSelectedDeviceId(videoDevices[0].deviceId); // Default to the first device
      }
    };

    getDevices();
  }, []);

  // Fetch items when component mounts
  useEffect(() => {
    fetchItems();
  }, []);

  // Handle barcode scan to update/delete or search item based on quantity
  const handleBarcodeScan = useCallback(async (barcode) => {
    const item = items.find(item => item.barcode === barcode);
    if (item) {
      if (searchMode) {
        setSearchedItem(item); // Set the found item details for display
        setMessage(`Found item: '${item.text}' - Quantity: ${item.quantity}`);
        setCameraEnabled(false); // Automatically close the camera after a successful search
      } else {
        const updatedQuantity = item.quantity - quantityInput;
        const itemDoc = doc(db, 'items', item.id);

        if (updatedQuantity <= 0) {
          await deleteDoc(itemDoc);
          setMessage(`Item '${item.text}' deleted as quantity is now zero.`);
        } else {
          await updateDoc(itemDoc, { quantity: updatedQuantity });
          setMessage(`Updated item '${item.text}'. New quantity: ${updatedQuantity}.`);
        }
        await fetchItems(); // Refresh the item list
      }
    } else {
      setMessage('Item not found. Please check the barcode and try again.');
      setSearchedItem(null); // Reset the searched item if not found
    }
  }, [items, quantityInput, searchMode]);

  // Handle scanning from the camera for updating/deleting or searching for items
  const handleScanFromCamera = useCallback(() => {
    if (webcamRef.current) {
      codeReader.current.decodeFromVideoDevice(selectedDeviceId, webcamRef.current.video, (result, err) => {
        if (result) {
          handleBarcodeScan(result.text);
          if (!searchMode) setCameraEnabled(false); // Stop the camera if not in search mode
        }
        if (err) {
          console.error(err);
        }
      });
    }
  }, [selectedDeviceId, handleBarcodeScan, searchMode]);

  // Start or stop camera scanning
  useEffect(() => {
    if (cameraEnabled) {
      handleScanFromCamera();
    } else {
      codeReader.current.reset();
    }
  }, [cameraEnabled, handleScanFromCamera]);

  // Render barcode for each item and return the canvas element
  const renderBarcode = (barcode, elementId) => {
    if (barcode) {
      JsBarcode(`#${elementId}`, barcode, {
        format: "CODE128",
        lineColor: "#000",
        width: 2,
        height: 50,
        displayValue: false
      });
    }
  };

  // Generate barcodes for items
  useEffect(() => {
    items.forEach(item => {
      renderBarcode(item.barcode, `barcode-${item.id}`);
    });
  }, [items]);

  // Handle barcode submission for update/delete
  const handleBarcodeSubmit = (e) => {
    e.preventDefault();
    setCameraEnabled(true); // Enable the camera for scanning
  };

  // Function to save barcode image with college name
  const saveBarcodeImage = (barcode, college) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const canvasWidth = 200;
    const canvasHeight = 100;
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    // Generate barcode
    JsBarcode(canvas, barcode, {
      format: "CODE128",
      lineColor: "#000",
      width: 2,
      height: 50,
      displayValue: false
    });

    // Draw college name on the canvas
    ctx.font = "10px Arial";
    ctx.fillStyle = "black";
    ctx.textAlign = "center";
    ctx.fillText(college, canvasWidth / 2, canvasHeight - 10);

    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = `${college}_barcode_${barcode}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setMessage(`Saved barcode for ${college}: ${barcode}`);
  };

  return (
    <div>
      <h1>Scanner</h1>
      <form onSubmit={handleBarcodeSubmit}>
        <input
          type="number"
          value={quantityInput}
          onChange={(e) => setQuantityInput(Number(e.target.value))}
          placeholder="Quantity"
          min="1"
          required
        />
        <button type="submit-scanner">Get Item</button>
      </form>

      <button onClick={() => {
        setSearchMode(true);
        setCameraEnabled(true);
      }}>
        Search Item through Scan
      </button>

      {message && <p className="message">{message}</p>}

      {searchedItem && (
        <div className="searched-item">
          <h2>Searched Item Details:</h2>
          <p><strong>Name:</strong> {searchedItem.text}</p>
          <p><strong>Barcode:</strong> {searchedItem.barcode}</p>
          <p><strong>Quantity:</strong> {searchedItem.quantity}</p>
          <p><strong>College:</strong> {searchedItem.college}</p>
          <p><strong>Category:</strong> {searchedItem.category}</p>
        </div>
      )}

      <div>
        <label htmlFor="cameraSelect">Select Camera:</label>
        <select
          id="cameraSelect"
          value={selectedDeviceId}
          onChange={(e) => setSelectedDeviceId(e.target.value)}
        >
          {videoDevices.map(device => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label || `Camera ${device.deviceId}`}
            </option>
          ))}
        </select>
      </div>

      {cameraEnabled && (
        <div>
          <Webcam ref={webcamRef} width="300" height="200" videoConstraints={{ deviceId: selectedDeviceId }} />
          <button onClick={() => setCameraEnabled(false)}>Stop Camera</button>
        </div>
      )}

      <h2>All Items</h2>
      <ul>
        {items.map(item => (
          <li key={item.id}>
            {item.text} - Barcode: {item.barcode} - Quantity: {item.quantity} - College: {item.college} - Category: {item.category}
            <svg id={`barcode-${item.id}`} style={{ cursor: 'pointer' }}></svg>
            <button onClick={() => saveBarcodeImage(item.barcode, item.college)}>Save Barcode Image</button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Scanner;
