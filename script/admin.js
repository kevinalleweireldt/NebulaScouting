import { requireAuth }   from './auth.js';
import { auth, db }      from './firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js';
import { getAuth, createUserWithEmailAndPassword }
    from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js';
import { collection, getDocs, doc, getDoc, setDoc, serverTimestamp }
    from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';

let secondaryAuth = null;

function getSecondaryAuth() {
    if (!secondaryAuth) {
        const secondaryApp = initializeApp(auth.app.options, 'Secondary');
        secondaryAuth = getAuth(secondaryApp);
    }
    return secondaryAuth;
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
    );
}

async function renderUserList() {
    const container = document.getElementById('userListContainer');
    try {
        const snap = await getDocs(collection(db, 'users'));
        if (snap.empty) {
            container.innerHTML = '<p class="empty-state">No user accounts found.</p>';
            return;
        }

        let html = '<table class="match-table"><thead><tr>'
            + '<th>Email</th><th>Display Name</th><th>Role</th>'
            + '</tr></thead><tbody>';

        snap.forEach(d => {
            const u = d.data();
            html += `<tr>
                <td>${escapeHtml(u.email ?? '—')}</td>
                <td>${escapeHtml(u.displayName ?? '—')}</td>
                <td><span class="role-badge role-${escapeHtml(u.role ?? '')}">${escapeHtml(u.role ?? '—')}</span></td>
            </tr>`;
        });
        html += '</tbody></table>';
        container.innerHTML = html;
    } catch (err) {
        container.innerHTML = `<p class="form-error">Failed to load users: ${escapeHtml(err.message)}</p>`;
    }
}

async function initEventKeySection() {
    const input = document.getElementById('eventKey');
    const btn = document.getElementById('saveEventKeyBtn');
    const status = document.getElementById('eventKeyStatus');
    if (!input || !btn) return;

    try {
        const snap = await getDoc(doc(db, 'config', 'app'));
        if (snap.exists()) input.value = snap.data().eventKey ?? '';
    } catch (err) {
        status.textContent = `Could not load current event key: ${err.message}`;
        status.hidden = false;
    }

    btn.addEventListener('click', async () => {
        const eventKey = input.value.trim();
        status.hidden = true;
        status.style.color = '';
        btn.disabled = true;
        btn.textContent = 'Saving…';
        try {
            await setDoc(doc(db, 'config', 'app'), { eventKey }, { merge: true });
            status.textContent = eventKey ? `Saved event key: ${eventKey}` : 'Event key cleared.';
            status.style.color = 'var(--emerald)';
            status.hidden = false;
        } catch (err) {
            status.textContent = `Error: ${err.message}`;
            status.hidden = false;
        } finally {
            btn.disabled = false;
            btn.textContent = 'Save Event Key';
        }
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    await requireAuth('admin');
    await renderUserList();
    await initEventKeySection();

    const createBtn = document.getElementById('createUserBtn');
    const statusEl  = document.getElementById('createUserStatus');

    createBtn.addEventListener('click', async () => {
        const email       = document.getElementById('newEmail').value.trim();
        const displayName = document.getElementById('newDisplayName').value.trim();
        const password    = document.getElementById('newPassword').value;

        statusEl.hidden = true;
        statusEl.style.color = '';

        if (!email || !password) {
            statusEl.textContent = 'Email and password are required.';
            statusEl.hidden = false;
            return;
        }

        createBtn.disabled = true;
        createBtn.textContent = 'Creating…';

        try {
            const secAuth = getSecondaryAuth();
            const cred    = await createUserWithEmailAndPassword(secAuth, email, password);
            const newUid  = cred.user.uid;
            await secAuth.signOut();

            await setDoc(doc(db, 'users', newUid), {
                email,
                displayName: displayName || email,
                role: 'scouter',
                createdAt: serverTimestamp()
            });

            statusEl.textContent = `Account created for ${email}.`;
            statusEl.style.color = 'var(--emerald)';
            statusEl.hidden = false;
            document.getElementById('newEmail').value = '';
            document.getElementById('newDisplayName').value = '';
            document.getElementById('newPassword').value = '';
            await renderUserList();
        } catch (err) {
            statusEl.textContent = `Error: ${err.message}`;
            statusEl.hidden = false;
        } finally {
            createBtn.disabled = false;
            createBtn.textContent = 'Create Account';
        }
    });
});
