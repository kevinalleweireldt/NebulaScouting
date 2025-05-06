import { initScoreControls } from './matchScore.js';

document.addEventListener('DOMContentLoaded', () => {
    console.log("App initialized.");
    initScoreControls();

});

document.addEventListener("DOMContentLoaded", function () {
    const scoreElements = {
        levelOneScore: document.getElementById('level-one-score'),
        levelTwoScore: document.getElementById('level-two-score'),
        levelThreeScore: document.getElementById('level-three-score'),
        levelFourScore: document.getElementById('level-four-score'),
        processorScore: document.getElementById('processor-algae-score'),
        bargeScore: document.getElementById('barge-algae-score')
    };

    function submitScores() {
        const scores = {};
        for (let key in scoreElements) {
            scores[key] = parseInt(scoreElements[key].textContent, 10) || 0;
        }

        localStorage.setItem('submittedScores', JSON.stringify(scores));
        alert("Scores submitted and saved locally!");
    }

    const submitButton = document.getElementById('submitScores');
    if (submitButton) {
        submitButton.addEventListener('click', submitScores);
    }
});
