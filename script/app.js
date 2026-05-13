import { initScoreControls } from './matchScore.js';
import { requireAuth }       from './auth.js';
import { db }                from './firebase-config.js';
import { collection, addDoc, serverTimestamp }
    from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';
import { getActiveEventKey, getEventMatches, teamNumberFromKey }
    from './tba.js';

const CLIMB_POINTS = [0, 15, 20, 30];

export function computeScore({ autoFuel, teleopFuel, autoClimb, endgameClimb }) {
    return (autoFuel ?? 0)
        + (teleopFuel ?? 0)
        + CLIMB_POINTS[autoClimb ?? 0]
        + CLIMB_POINTS[endgameClimb ?? 0];
}

let qualByNumber = null;

async function tryWireQualLookup() {
    const eventKey = await getActiveEventKey();
    if (!eventKey) return;

    const matches = await getEventMatches(eventKey);
    if (!matches || matches.length === 0) return;

    const quals = matches.filter(m => m.comp_level === 'qm');
    if (quals.length === 0) return;

    qualByNumber = new Map();
    quals.forEach(m => qualByNumber.set(Number(m.match_number), m));

    const matchInput = document.getElementById('matchNumber');
    const oldTeam    = document.getElementById('teamNumber');
    if (!matchInput || !oldTeam) return;

    const teamSel = document.createElement('select');
    teamSel.id = 'teamNumber';
    teamSel.required = true;
    teamSel.disabled = true;
    teamSel.dataset.tba = 'true';
    teamSel.appendChild(new Option('— Enter qual match # first —', ''));
    oldTeam.parentNode.replaceChild(teamSel, oldTeam);

    teamSel.addEventListener('change', () => {
        teamSel.classList.remove('is-invalid');
        const msg = document.getElementById('formError');
        if (msg) msg.hidden = true;
    });

    const updateTeams = () => {
        const raw = matchInput.value.trim();
        teamSel.innerHTML = '';

        if (!raw) {
            teamSel.disabled = true;
            teamSel.appendChild(new Option('— Enter qual match # first —', ''));
            matchInput.classList.remove('is-valid');
            return;
        }

        const n = Number(raw);
        const m = Number.isInteger(n) && n > 0 ? qualByNumber.get(n) : null;
        if (!m) {
            teamSel.disabled = true;
            teamSel.appendChild(new Option('— Not a valid qual match —', ''));
            matchInput.classList.remove('is-valid');
            matchInput.classList.add('is-invalid');
            return;
        }

        matchInput.classList.remove('is-invalid');
        matchInput.classList.add('is-valid');
        teamSel.disabled = false;
        teamSel.appendChild(new Option('— Select team —', ''));
        ['red', 'blue'].forEach(color => {
            const og = document.createElement('optgroup');
            og.label = color === 'red' ? 'Red Alliance' : 'Blue Alliance';
            (m.alliances?.[color]?.team_keys || []).forEach(tk => {
                const num = teamNumberFromKey(tk);
                og.appendChild(new Option(String(num), String(num)));
            });
            teamSel.appendChild(og);
        });
    };

    matchInput.addEventListener('input', updateTeams);
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

    await tryWireQualLookup();

    submitButton.addEventListener('click', async () => {
        const matchNumberEl = document.getElementById('matchNumber');
        const teamNumberEl  = document.getElementById('teamNumber');
        const matchNumber = (matchNumberEl?.value || '').trim();
        const teamNumber  = (teamNumberEl?.value || '').trim();

        matchNumberEl?.classList.remove('is-invalid');
        teamNumberEl?.classList.remove('is-invalid');

        const errors = [];
        if (!matchNumber) {
            errors.push('Match Number');
            matchNumberEl?.classList.add('is-invalid');
        } else if (qualByNumber) {
            const n = Number(matchNumber);
            if (!Number.isInteger(n) || n <= 0 || !qualByNumber.has(n)) {
                errors.push('a valid qualification Match Number');
                matchNumberEl?.classList.add('is-invalid');
            }
        }
        if (!teamNumber) {
            errors.push('Team Number');
            teamNumberEl?.classList.add('is-invalid');
        }

        if (errors.length > 0) {
            const errorMsg = document.getElementById('formError');
            if (errorMsg) {
                errorMsg.textContent = `Please enter ${errors.join(' and ')} before submitting.`;
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
