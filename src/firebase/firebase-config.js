// src/firebase/firebase-config.js

import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, FacebookAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore'; // Import Firestore
import { getStorage } from 'firebase/storage'; // Import Storage

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyB4G4hmCoE-y0YdsSBk8Wk9nHEq-MRlwcc",
  authDomain: "scinventory1-57023.firebaseapp.com",
  projectId: "scinventory1-57023",
  storageBucket: "scinventory1-57023.appspot.com",
  messagingSenderId: "57401651388",
  appId: "1:57401651388:web:2d5fda989542b9d16da0b9",
  measurementId: "G-EB1ZL9ZV57"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
const auth = getAuth(app);

// Initialize Firestore and Storage
const db = getFirestore(app);
const storage = getStorage(app); // Initialize Storage

// Initialize Google and Facebook Auth Providers
const googleProvider = new GoogleAuthProvider();
const facebookProvider = new FacebookAuthProvider();

// Export the auth, db, storage, and providers
export { auth, db, storage, googleProvider, facebookProvider };
