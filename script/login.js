import { auth } from './firebase-config.js';
import { signInWithEmailAndPassword, onAuthStateChanged }
    from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js';

// Redirect already-signed-in users immediately
onAuthStateChanged(auth, user => {
    if (user) window.location.href = '/dashboard';
});

document.addEventListener('DOMContentLoaded', () => {
    const formEl   = document.getElementById('loginForm');
    const loginBtn = document.getElementById('loginBtn');
    const emailEl  = document.getElementById('loginEmail');
    const passEl   = document.getElementById('loginPassword');
    const errorEl  = document.getElementById('loginError');

    formEl.addEventListener('submit', async e => {
        e.preventDefault();
        errorEl.hidden = true;
        loginBtn.disabled = true;
        loginBtn.textContent = 'Signing in…';

        try {
            await signInWithEmailAndPassword(auth, emailEl.value.trim(), passEl.value);
            window.location.href = '/dashboard';
        } catch (err) {
            errorEl.textContent = friendlyError(err.code);
            errorEl.hidden = false;
            loginBtn.disabled = false;
            loginBtn.textContent = 'Sign In';
        }
    });
});

function friendlyError(code) {
    const map = {
        'auth/invalid-credential':     'Incorrect email or password.',
        'auth/invalid-email':          'Please enter a valid email address.',
        'auth/user-disabled':          'This account has been disabled.',
        'auth/too-many-requests':      'Too many attempts. Try again later.',
        'auth/network-request-failed': 'Network error. Check your connection.',
    };
    return map[code] ?? 'Sign-in failed. Please try again.';
}
