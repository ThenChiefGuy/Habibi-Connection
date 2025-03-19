import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage"; // Import Firebase Storage

const firebaseConfig = {
  apiKey: "AIzaSyChvathqKkO0oL9wyMMjAX3SiYm8QC7sPY", // Dein Web-API-Schlüssel
  authDomain: "habibi-connections.firebaseapp.com",   // Ersetze mit deinem Auth-Domain
  projectId: "habibi-connections",                   // Deine Projekt-ID
  storageBucket: "habibi-connections.appspot.com",   // Optional (wenn du Storage verwendest)
  messagingSenderId: "195211067297",                 // Deine Projektnummer
  appId: "DEINE_APP_ID"                             // Optional (wenn du eine App-ID hast)
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app); // Initialize Firebase Storage

export { db, auth, storage }; // Export storage