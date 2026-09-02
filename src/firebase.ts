import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDeGzJh6BNS4pDl0KX-PJ70Eg8apibKCQE",
  authDomain: "emdia-be87f.firebaseapp.com",
  projectId: "emdia-be87f",
  storageBucket: "emdia-be87f.firebasestorage.app",
  messagingSenderId: "88350368117",
  appId: "1:88350368117:web:c2e0910d5f5c7c4280b33c",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
