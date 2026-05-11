import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js';
import { getAuth }       from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js';
import { getFirestore }  from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';

// Paste your Firebase project config here:
// Firebase Console → Project Settings → Your apps → SDK setup and configuration
const firebaseConfig = {
    apiKey:            "PASTE_HERE",
    authDomain:        "PASTE_HERE",
    projectId:         "PASTE_HERE",
    storageBucket:     "PASTE_HERE",
    messagingSenderId: "PASTE_HERE",
    appId:             "PASTE_HERE"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);
