import { initScoreControls } from './matchScore.js';

document.addEventListener('DOMContentLoaded', () => {
    console.log("App initialized.");
    initScoreControls();

    const scoreElements = {
        levelOneScore: document.getElementById('level-one-score'),
        levelTwoScore: document.getElementById('level-two-score'),
        levelThreeScore: document.getElementById('level-three-score'),
        levelFourScore: document.getElementById('level-four-score'),
        processorScore: document.getElementById('processor-algae-score'),
        bargeScore: document.getElementById('barge-algae-score')
    };

    const submitButton = document.getElementById('submitScores');
    if (!submitButton) {
        console.warn("Submit button not found.");
        return;
    }

    submitButton.addEventListener('click', () => {
        // Collect individual scores
        const scores = {};
        for (let key in scoreElements) {
            scores[key] = parseInt(scoreElements[key].textContent, 10) || 0;
        }

        const totalScore = Object.values(scores).reduce((acc, val) => acc + val, 0);

        // Get match and team number from inputs (if available)
        const matchNumber = document.getElementById('matchNumber')?.value.trim() || 'Unknown';
        const teamNumber = document.getElementById('teamNumber')?.value.trim() || 'Unknown';
        const extraComments = document.getElementById('extraComments')?.value.trim() || '';

        const matchData = {
            matchNumber,
            teamNumber,
            score: totalScore,
            timestamp: new Date().toISOString(), // optional, but useful
            ...scores, // include all individual scores
            extraComments // Save comments
        };

        // Save to localStorage
        const matchHistory = JSON.parse(localStorage.getItem('matchHistory')) || [];
        matchHistory.push(matchData);
        localStorage.setItem('matchHistory', JSON.stringify(matchHistory));

        alert("Match data saved successfully!");

        // Redirect to the dashboard after saving the match data
        window.location.href = "./dashboard.html"; // Adjust the URL as needed for the correct dashboard path
    });
});
