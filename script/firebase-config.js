import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js';
import { getAuth }       from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js';
import { getFirestore }  from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';

// Paste your Firebase project config here:
// Firebase Console → Project Settings → Your apps → SDK setup and configuration
const firebaseConfig = {
    apiKey: "AIzaSyBwg4dGVSf5BFkzLR6W3o3chmUNvTtU4-Q",
    authDomain: "nebulascouting.firebaseapp.com",
    projectId: "nebulascouting",
    storageBucket: "nebulascouting.firebasestorage.app",
    messagingSenderId: "62781326097",
    appId: "1:62781326097:web:77959eb4cea66bc754c2b0"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);
