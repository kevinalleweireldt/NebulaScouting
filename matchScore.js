let algaeScore = 0;
let coralScore = 0;

// Get the elements to update the score
const algaeScoreElement = document.getElementById('algae-score');
const coralScoreElement = document.getElementById('coral-score');

// Get buttons
const addAlgaeButton = document.getElementById('addAlgae');
const subtractAlgaeButton = document.getElementById('subtractAlgae');
const addCoralButton = document.getElementById('addCoral');
const subtractCoralButton = document.getElementById('subtractCoral');

// Update the display for the scores
function updateScores() {
    algaeScoreElement.textContent = algaeScore;
    coralScoreElement.textContent = coralScore;
}

// Add event listeners for buttons
addAlgaeButton.addEventListener('click', function() {
    algaeScore += 1;
    updateScores();
});

subtractAlgaeButton.addEventListener('click', function() {
    if (algaeScore > 0) {
        algaeScore -= 1;
        updateScores();
    }
});

addCoralButton.addEventListener('click', function() {
    coralScore += 1;
    updateScores();
});

subtractCoralButton.addEventListener('click', function() {
    if (coralScore > 0) {
        coralScore -= 1;
        updateScores();
    }
});

// Initialize scores
updateScores();
