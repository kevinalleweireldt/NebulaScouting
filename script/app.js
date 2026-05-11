import { initScoreControls } from './matchScore.js';

const CLIMB_POINTS = [0, 15, 20, 30];

export function computeScore({ autoFuel, teleopFuel, autoClimb, endgameClimb }) {
    return (autoFuel ?? 0)
        + (teleopFuel ?? 0)
        + CLIMB_POINTS[autoClimb ?? 0]
        + CLIMB_POINTS[endgameClimb ?? 0];
}

document.addEventListener('DOMContentLoaded', () => {
    initScoreControls();

    const submitButton = document.getElementById('submitScores');
    if (!submitButton) return;

    const matchNumberInput = document.getElementById('matchNumber');
    const teamNumberInput = document.getElementById('teamNumber');

    [matchNumberInput, teamNumberInput].forEach(input => {
        input?.addEventListener('input', () => {
            input.classList.remove('is-invalid');
            const msg = document.getElementById('formError');
            if (msg) msg.hidden = true;
        });
    });

    submitButton.addEventListener('click', () => {
        const matchNumber = matchNumberInput?.value.trim() || '';
        const teamNumber = teamNumberInput?.value.trim() || '';

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

        const autoFuel = parseInt(document.getElementById('auto-fuel-score')?.textContent, 10) || 0;
        const teleopFuel = parseInt(document.getElementById('teleop-fuel-score')?.textContent, 10) || 0;

        const autoClimbEl = document.querySelector('input[name="autoClimb"]:checked');
        const autoClimb = autoClimbEl ? parseInt(autoClimbEl.value, 10) : 0;

        const endgameClimbEl = document.querySelector('input[name="endgameClimb"]:checked');
        const endgameClimb = endgameClimbEl ? parseInt(endgameClimbEl.value, 10) : 0;

        const defense = document.getElementById('defense')?.checked || false;
        const brokeDown = document.getElementById('brokeDown')?.checked || false;

        const extraComments = document.getElementById('extraComments')?.value.trim() || '';

        const score = computeScore({ autoFuel, teleopFuel, autoClimb, endgameClimb });

        const matchData = {
            matchNumber,
            teamNumber,
            autoFuel,
            autoClimb,
            teleopFuel,
            endgameClimb,
            defense,
            brokeDown,
            score,
            timestamp: new Date().toISOString(),
            extraComments
        };

        const matchHistory = JSON.parse(localStorage.getItem('matchHistory')) || [];
        matchHistory.push(matchData);
        localStorage.setItem('matchHistory', JSON.stringify(matchHistory));

        alert('Match data saved successfully!');
        window.location.href = './dashboard.html';
    });
});
