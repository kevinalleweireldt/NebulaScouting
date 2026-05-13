import { auth, db } from './firebase-config.js';
import { signOut, onAuthStateChanged }
    from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js';
import { doc, getDoc }
    from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';

function wireScrollHide(navEl) {
    const DELTA = 6;       // ignore tiny jitter
    const REVEAL_AT = 80;  // always show when near top
    let lastY = window.scrollY;
    let ticking = false;

    const onScroll = () => {
        const y = window.scrollY;
        const diff = y - lastY;

        if (Math.abs(diff) < DELTA) { ticking = false; return; }

        if (y <= REVEAL_AT) {
            navEl.classList.remove('navbar--hidden');
        } else if (diff > 0) {
            navEl.classList.add('navbar--hidden');
        } else {
            navEl.classList.remove('navbar--hidden');
        }

        lastY = y;
        ticking = false;
    };

    window.addEventListener('scroll', () => {
        if (!ticking) {
            window.requestAnimationFrame(onScroll);
            ticking = true;
        }
    }, { passive: true });
}

document.addEventListener('DOMContentLoaded', async () => {
    const navEl = document.querySelector('.navbar');
    if (!navEl) return;

    // Absolute path works from both root (index.html) and /pages/ pages
    const res  = await fetch('/pages/navbar.html');
    const html = await res.text();
    navEl.innerHTML = html;

    wireScrollHide(navEl);

    const logoLink    = document.getElementById('nav-logo-link');
    const aboutLink   = document.getElementById('nav-about-link');
    const contactLink = document.getElementById('nav-contact-link');

    onAuthStateChanged(auth, async user => {
        const authLinks = document.querySelectorAll('.nav-auth-link');
        if (!user) {
            if (logoLink) logoLink.setAttribute('href', '/');
            if (aboutLink) aboutLink.hidden = false;
            if (contactLink) contactLink.hidden = false;
            authLinks.forEach(el => el.hidden = true);
            const navUser = document.querySelector('.nav-user');
            if (navUser) navUser.innerHTML = '<a href="/login" class="btn btn-sm">Sign In</a>';
            return;
        }

        if (logoLink) logoLink.setAttribute('href', '/dashboard');
        if (aboutLink) aboutLink.hidden = true;
        if (contactLink) contactLink.hidden = true;

        const emailEl   = document.getElementById('nav-user-email');
        const logoutBtn = document.getElementById('nav-logout-btn');
        const adminLink = document.getElementById('nav-admin-link');

        if (emailEl) emailEl.textContent = user.email;

        try {
            const snap = await getDoc(doc(db, 'users', user.uid));
            if (snap.exists() && snap.data().role === 'admin' && adminLink) {
                adminLink.hidden = false;
            }
        } catch { /* silently fail — navbar chrome shouldn't break the page */ }

        if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
                await signOut(auth);
                window.location.href = '/login';
            });
        }
    });
});
