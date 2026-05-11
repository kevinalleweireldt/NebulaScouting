import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js';
import { doc, getDoc }        from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';

// Call at the top of every protected page's DOMContentLoaded handler.
// Redirects to /login if not authenticated, or to /dashboard if requiredRole doesn't match.
export async function requireAuth(requiredRole = null) {
    return new Promise((resolve) => {
        const unsub = onAuthStateChanged(auth, async (user) => {
            unsub();
            if (!user) {
                window.location.href = '/login';
                return;
            }
            try {
                const snap = await getDoc(doc(db, 'users', user.uid));
                if (!snap.exists()) {
                    await auth.signOut();
                    window.location.href = '/login';
                    return;
                }
                const role = snap.data().role;
                if (requiredRole && role !== requiredRole) {
                    window.location.href = '/dashboard';
                    return;
                }
                document.body.classList.remove('auth-loading');
                resolve({ user, role, userData: snap.data() });
            } catch (err) {
                console.error('Auth check failed:', err);
                window.location.href = '/login';
            }
        });
    });
}
