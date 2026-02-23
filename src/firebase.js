import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyDGYniFcmfP152GlUs1IZz2sQRzMgErXsg",
    authDomain: "movimientos-de-caja-mc.firebaseapp.com",
    projectId: "movimientos-de-caja-mc",
    storageBucket: "movimientos-de-caja-mc.firebasestorage.app",
    messagingSenderId: "81254845430",
    appId: "1:81254845430:web:c15cb1970d6737d7d595d7"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Auth & Firestore
export const auth = getAuth(app);
export const db = getFirestore(app);
