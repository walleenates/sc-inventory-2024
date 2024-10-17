import React, { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/firebase-config';
import './Reports.css';
import { FaFolder, FaFolderOpen } from 'react-icons/fa';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

const Reports = () => {
  const [items, setItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleColleges, setVisibleColleges] = useState({});
  const [visibleCategories, setVisibleCategories] = useState({});

  useEffect(() => {
    const fetchItems = async () => {
      const itemsCollection = collection(db, 'items');
      const unsubscribe = onSnapshot(itemsCollection, (snapshot) => {
        const fetchedItems = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setItems(fetchedItems);
      });

      return () => unsubscribe();
    };

    fetchItems();
  }, []);

  const filterItems = (items) => {
    const lowerCaseQuery = searchQuery.toLowerCase();
    return items.filter((item) => (
      item.text.toLowerCase().includes(lowerCaseQuery) ||
      item.college.toLowerCase().includes(lowerCaseQuery) ||
      item.itemType.toLowerCase().includes(lowerCaseQuery)
    ));
  };

  const groupItemsByCollege = () => {
    const filteredItems = filterItems(items);
    return filteredItems.reduce((acc, item) => {
      const collegeKey = item.college || 'Unknown';
      const categoryKey = item.itemType || 'Unknown Category';

      if (!acc[collegeKey]) acc[collegeKey] = {};
      if (!acc[collegeKey][categoryKey]) acc[collegeKey][categoryKey] = [];

      acc[collegeKey][categoryKey].push(item);
      return acc;
    }, {});
  };

  const handleToggleCollege = (collegeKey) => {
    setVisibleColleges((prev) => ({
      ...prev,
      [collegeKey]: !prev[collegeKey],
    }));
  };

  const handleToggleCategory = (collegeKey, categoryKey) => {
    setVisibleCategories((prev) => ({
      ...prev,
      [collegeKey]: {
        ...prev[collegeKey],
        [categoryKey]: !prev[collegeKey]?.[categoryKey],
      },
    }));
  };

  const downloadReport = (college, category = null) => {
    const groupedItems = groupItemsByCollege();
    const doc = new jsPDF();
    doc.setFontSize(16);

    if (category) {
      doc.text(`Report Summary for ${college} - ${category}`, 14, 22);
    } else {
      doc.text(`Report Summary for ${college}`, 14, 22);
    }

    let grandTotal = 0;
    let currentY = 32;

    const categories = category ? { [category]: groupedItems[college][category] } : groupedItems[college];

    if (categories) {
      Object.keys(categories).forEach((categoryKey) => {
        doc.setFontSize(14);
        doc.text(`Category: ${categoryKey}`, 14, currentY);

        const tableData = categories[categoryKey].map((item) => {
          grandTotal += item.amount;
          return [
            item.text,
            item.quantity,
            `$${item.amount.toFixed(2)}`,
            new Date(item.requestedDate.seconds * 1000).toLocaleDateString(),
          ];
        });

        currentY += 10;
        doc.autoTable({
          startY: currentY,
          head: [['Item', 'Quantity', 'Amount', 'Requested Date']],
          body: tableData,
        });

        currentY = doc.lastAutoTable.finalY + 10;
      });

      doc.setFontSize(14);
      doc.text(`Total Amount: $${grandTotal.toFixed(2)}`, 14, currentY + 10);
    } else {
      doc.text('No items found.', 14, 32);
    }

    doc.save(`${college}${category ? `-${category}` : ''}-report-summary.pdf`);
  };

  const groupedItems = groupItemsByCollege();

  return (
    <div className="reports-container">
      <h1>
        <FaFolder className="folder-icon" /> Items Report
      </h1>
      <div className="search-bar">
        <input
          type="text"
          placeholder="Search by item, college, or category"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>
      {Object.keys(groupedItems).map((collegeKey) => (
        <div key={collegeKey} className="report-section">
          <h2 onClick={() => handleToggleCollege(collegeKey)}>
            {visibleColleges[collegeKey] ? <FaFolderOpen /> : <FaFolder />} {collegeKey}
          </h2>
          {visibleColleges[collegeKey] && (
            <div className="college-details">
              <button onClick={() => downloadReport(collegeKey)} className="action-button">
                Download Summary for {collegeKey}
              </button>
              {Object.keys(groupedItems[collegeKey]).map((categoryKey) => (
                <div key={categoryKey}>
                  <h3 onClick={() => handleToggleCategory(collegeKey, categoryKey)}>
                    {visibleCategories[collegeKey]?.[categoryKey] ? <FaFolderOpen /> : <FaFolder />} {categoryKey}
                  </h3>
                  {visibleCategories[collegeKey]?.[categoryKey] && (
                    <div className="category-details">
                      <button
                        onClick={() => downloadReport(collegeKey, categoryKey)}
                        className="action-button"
                      >
                        Download Summary for {categoryKey}
                      </button>
                      <ul>
                        {groupedItems[collegeKey][categoryKey].map((item) => (
                          <li key={item.id}>
                            <div><strong>Item:</strong> {item.text}</div>
                            <div><strong>Quantity:</strong> {item.quantity}</div>
                            <div><strong>Amount:</strong> ${item.amount.toFixed(2)}</div>
                            <div><strong>Requested Date:</strong> {new Date(item.requestedDate.seconds * 1000).toLocaleDateString()}</div>
                            {item.image && <img src={item.image} alt="Item" className="report-image" />}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default Reports;
