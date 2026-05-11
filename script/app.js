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

    submitButton.addEventListener('click', () => {
        const autoFuel = parseInt(document.getElementById('auto-fuel-score')?.textContent, 10) || 0;
        const teleopFuel = parseInt(document.getElementById('teleop-fuel-score')?.textContent, 10) || 0;

        const autoClimbEl = document.querySelector('input[name="autoClimb"]:checked');
        const autoClimb = autoClimbEl ? parseInt(autoClimbEl.value, 10) : 0;

        const endgameClimbEl = document.querySelector('input[name="endgameClimb"]:checked');
        const endgameClimb = endgameClimbEl ? parseInt(endgameClimbEl.value, 10) : 0;

        const defense = document.getElementById('defense')?.checked || false;
        const brokeDown = document.getElementById('brokeDown')?.checked || false;

        const matchNumber = document.getElementById('matchNumber')?.value.trim() || 'Unknown';
        const teamNumber = document.getElementById('teamNumber')?.value.trim() || 'Unknown';
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
