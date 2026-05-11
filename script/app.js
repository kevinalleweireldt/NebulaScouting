import { initScoreControls } from './matchScore.js';
import { requireAuth }       from './auth.js';
import { db }                from './firebase-config.js';
import { collection, addDoc, serverTimestamp }
    from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';

const CLIMB_POINTS = [0, 15, 20, 30];

export function computeScore({ autoFuel, teleopFuel, autoClimb, endgameClimb }) {
    return (autoFuel ?? 0)
        + (teleopFuel ?? 0)
        + CLIMB_POINTS[autoClimb ?? 0]
        + CLIMB_POINTS[endgameClimb ?? 0];
}

document.addEventListener('DOMContentLoaded', async () => {
    const { user } = await requireAuth();

    initScoreControls();

    const submitButton    = document.getElementById('submitScores');
    if (!submitButton) return;

    const matchNumberInput = document.getElementById('matchNumber');
    const teamNumberInput  = document.getElementById('teamNumber');

    [matchNumberInput, teamNumberInput].forEach(input => {
        input?.addEventListener('input', () => {
            input.classList.remove('is-invalid');
            const msg = document.getElementById('formError');
            if (msg) msg.hidden = true;
        });
    });

    submitButton.addEventListener('click', async () => {
        const matchNumber = matchNumberInput?.value.trim() || '';
        const teamNumber  = teamNumberInput?.value.trim() || '';

        matchNumberInput?.classList.remove('is-invalid');
        teamNumberInput?.classList.remove('is-invalid');

        const missing = [];
        if (!matchNumber) {
            missing.push('Match Number');
            matchNumberInput?.classList.add('is-invalid');
        }
        if (!teamNumber) {
            missing.push('Team Number');
            teamNumberInput?.classList.add('is-invalid');
        }

        if (missing.length > 0) {
            const errorMsg = document.getElementById('formError');
            if (errorMsg) {
                errorMsg.textContent = `Please enter ${missing.join(' and ')} before submitting.`;
                errorMsg.hidden = false;
            }
            const firstInvalid = matchNumberInput?.classList.contains('is-invalid')
                ? matchNumberInput
                : teamNumberInput;
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
