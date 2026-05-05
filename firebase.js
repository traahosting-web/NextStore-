// firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    GoogleAuthProvider, 
    signInWithPopup, 
    onAuthStateChanged, 
    signOut,
    sendPasswordResetEmail,
    fetchSignInMethodsForEmail,
    sendEmailVerification // 👈 Tambahkan ini
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// GANTI DENGAN CONFIG FIREBASE ANDA
const firebaseConfig = {
    apiKey: "AIzaSyBEPnglAGgeJxho9kfdM5d1Bhwlq-9dGDw",
    authDomain: "nexstore-f286a.firebaseapp.com",
    projectId: "nexstore-f286a",
    storageBucket: "nexstore-f286a.appspot.com",
    messagingSenderId: "604566007255",
    appId: "1:604566007255:web:878da0f8b29e"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export { 
    auth, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    googleProvider, 
    signInWithPopup, 
    onAuthStateChanged, 
    signOut, 
    sendPasswordResetEmail,
    fetchSignInMethodsForEmail,
    sendEmailVerification,
};
