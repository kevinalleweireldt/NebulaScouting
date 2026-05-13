import { initScoreControls } from './matchScore.js';
import { requireAuth }       from './auth.js';
import { db }                from './firebase-config.js';
import { collection, addDoc, serverTimestamp }
    from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';
import { getActiveEventKey, getEventMatches, teamNumberFromKey, formatMatchLabel }
    from './tba.js';

const CLIMB_POINTS = [0, 15, 20, 30];

export function computeScore({ autoFuel, teleopFuel, autoClimb, endgameClimb }) {
    return (autoFuel ?? 0)
        + (teleopFuel ?? 0)
        + CLIMB_POINTS[autoClimb ?? 0]
        + CLIMB_POINTS[endgameClimb ?? 0];
}

function replaceWithSelect(oldEl, options) {
    const sel = document.createElement('select');
    sel.id = oldEl.id;
    sel.className = oldEl.className;
    sel.required = oldEl.required;
    options.forEach(o => {
        if (o.group) {
            const og = document.createElement('optgroup');
            og.label = o.group;
            o.options.forEach(child => {
                const op = document.createElement('option');
                op.value = child.value;
                op.textContent = child.label;
                og.appendChild(op);
            });
            sel.appendChild(og);
        } else {
            const op = document.createElement('option');
            op.value = o.value;
            op.textContent = o.label;
            sel.appendChild(op);
        }
    });
    oldEl.parentNode.replaceChild(sel, oldEl);
    return sel;
}

async function tryWireTbaDropdowns() {
    const eventKey = await getActiveEventKey();
    if (!eventKey) return;

    const matches = await getEventMatches(eventKey);
    if (!matches || matches.length === 0) return;

    matches.sort((a, b) => {
        const order = { qm: 0, ef: 1, qf: 2, sf: 3, f: 4 };
        const lvl = (order[a.comp_level] ?? 9) - (order[b.comp_level] ?? 9);
        if (lvl !== 0) return lvl;
        if (a.set_number !== b.set_number) return (a.set_number || 0) - (b.set_number || 0);
        return (a.match_number || 0) - (b.match_number || 0);
    });

    const oldMatch = document.getElementById('matchNumber');
    const oldTeam  = document.getElementById('teamNumber');
    if (!oldMatch || !oldTeam) return;

    const matchOptions = [{ value: '', label: '— Select match —' }];
    matches.forEach(m => {
        matchOptions.push({ value: `${m.comp_level}|${m.set_number}|${m.match_number}`, label: formatMatchLabel(m) });
    });
    const matchSel = replaceWithSelect(oldMatch, matchOptions);

    const teamSel = replaceWithSelect(oldTeam, [{ value: '', label: '— Select match first —' }]);

    matchSel.addEventListener('change', () => {
        const v = matchSel.value;
        teamSel.innerHTML = '';
        if (!v) {
            teamSel.appendChild(new Option('— Select match first —', ''));
            return;
        }
        const [lvl, setN, matchN] = v.split('|');
        const m = matches.find(x =>
            x.comp_level === lvl &&
            String(x.set_number) === setN &&
            String(x.match_number) === matchN
        );
        if (!m || !m.alliances) {
            teamSel.appendChild(new Option('— No teams found —', ''));
            return;
        }
        teamSel.appendChild(new Option('— Select team —', ''));
        ['red', 'blue'].forEach(color => {
            const og = document.createElement('optgroup');
            og.label = color === 'red' ? 'Red Alliance' : 'Blue Alliance';
            (m.alliances[color]?.team_keys || []).forEach(tk => {
                const num = teamNumberFromKey(tk);
                og.appendChild(new Option(String(num), String(num)));
            });
            teamSel.appendChild(og);
        });
    });

    matchSel.dataset.tba = 'true';
    teamSel.dataset.tba = 'true';

    // The original "input" listener doesn't fire on selects — wire change to clear errors.
    [matchSel, teamSel].forEach(el => {
        el.addEventListener('change', () => {
            el.classList.remove('is-invalid');
            const msg = document.getElementById('formError');
            if (msg) msg.hidden = true;
        });
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    const { user } = await requireAuth();

    initScoreControls();

    const submitButton = document.getElementById('submitScores');
    if (!submitButton) return;

    // Wire text-input listeners first; if TBA succeeds, the inputs are replaced and
    // those listeners go with them — replaceWithSelect re-wires the select equivalents.
    ['matchNumber', 'teamNumber'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', e => {
            e.target.classList.remove('is-invalid');
            const msg = document.getElementById('formError');
            if (msg) msg.hidden = true;
        });
    });

    await tryWireTbaDropdowns();

    submitButton.addEventListener('click', async () => {
        const matchNumberEl = document.getElementById('matchNumber');
        const teamNumberEl  = document.getElementById('teamNumber');
        const rawMatch = matchNumberEl?.value || '';
        const rawTeam  = teamNumberEl?.value || '';

        // For TBA dropdowns the value is "qm|1|12" — extract the human match number for storage.
        let matchNumber = rawMatch.trim();
        if (matchNumberEl?.dataset.tba === 'true' && matchNumber.includes('|')) {
            const [lvl, , mn] = matchNumber.split('|');
            matchNumber = lvl === 'qm' ? mn : `${lvl.toUpperCase()}${mn}`;
        }
        const teamNumber = rawTeam.trim();

        matchNumberEl?.classList.remove('is-invalid');
        teamNumberEl?.classList.remove('is-invalid');

        const missing = [];
        if (!matchNumber) {
            missing.push('Match Number');
            matchNumberEl?.classList.add('is-invalid');
        }
        if (!teamNumber) {
            missing.push('Team Number');
            teamNumberEl?.classList.add('is-invalid');
        }

        if (missing.length > 0) {
            const errorMsg = document.getElementById('formError');
            if (errorMsg) {
                errorMsg.textContent = `Please enter ${missing.join(' and ')} before submitting.`;
                errorMsg.hidden = false;
            }
            const firstInvalid = matchNumberEl?.classList.contains('is-invalid')
                ? matchNumberEl
                : teamNumberEl;
            firstInvalid?.focus();
            firstInvalid?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }

        const autoFuel     = parseInt(document.getElementById('auto-fuel-score')?.textContent, 10) || 0;
        const teleopFuel   = parseInt(document.getElementById('teleop-fuel-score')?.textContent, 10) || 0;
        const autoClimbEl  = document.querySelector('input[name="autoClimb"]:checked');
        const autoClimb    = autoClimbEl ? parseInt(autoClimbEl.value, 10) : 0;
        const endgameEl    = document.querySelector('input[name="endgameClimb"]:checked');
        const endgameClimb = endgameEl ? parseInt(endgameEl.value, 10) : 0;
        const defense      = document.getElementById('defense')?.checked || false;
        const brokeDown    = document.getElementById('brokeDown')?.checked || false;
        const extraComments = document.getElementById('extraComments')?.value.trim() || '';
        const score        = computeScore({ autoFuel, teleopFuel, autoClimb, endgameClimb });

        submitButton.disabled    = true;
        submitButton.textContent = 'Saving…';

        try {
            await addDoc(collection(db, 'matchHistory'), {
                matchNumber,
                teamNumber,
                autoFuel,
                autoClimb,
                teleopFuel,
                endgameClimb,
                defense,
                brokeDown,
                score,
                extraComments,
                submittedBy:      user.uid,
                submittedByEmail: user.email,
                timestamp:        serverTimestamp()
            });
            window.location.href = '/dashboard';
        } catch (err) {
            console.error('Failed to save match:', err);
            alert('Failed to save match data. Check your connection and try again.');
            submitButton.disabled    = false;
            submitButton.textContent = 'Submit Match';
        }
    });
});
