let levelOneScoreValue = 0;
let levelTwoScoreValue = 0;
let levelThreeScoreValue = 0;
let levelFourScoreValue = 0;
let processorValue = 0;
let bargeValue = 0;

// Get DOM elements
const levelOneScore = document.getElementById('level-one-score');
const levelTwoScore = document.getElementById('level-two-score');
const levelThreeScore = document.getElementById('level-three-score');
const levelFourScore = document.getElementById('level-four-score');
const processorScore = document.getElementById('processor-algae-score');
const bargeScore = document.getElementById('barge-algae-score');

const addLevelOne = document.getElementById('addLevelOne');
const subtractLevelOne = document.getElementById('subtractLevelOne');
const addLevelTwo = document.getElementById('addLevelTwo');
const subtractLevelTwo = document.getElementById('subtractLevelTwo');
const addLevelThree = document.getElementById('addLevelThree');
const subtractLevelThree = document.getElementById('subtractLevelThree');
const addLevelFour = document.getElementById('addLevelFour');
const subtractLevelFour = document.getElementById('subtractLevelFour');
const addProcessorAlgae = document.getElementById('addProcessorAlgae');
const subtractProcessorAlgae = document.getElementById('subtractProcessorAlgae');
const addBargeAlgae = document.getElementById('addBargeAlgae');
const subtractBargeAlgae = document.getElementById('subtractBargeAlgae');

// Ensure all elements exist before proceeding
if (
    levelOneScore && levelTwoScore && levelThreeScore && levelFourScore &&
    processorScore && bargeScore &&
    addLevelOne && subtractLevelOne &&
    addLevelTwo && subtractLevelTwo &&
    addLevelThree && subtractLevelThree &&
    addLevelFour && subtractLevelFour &&
    addProcessorAlgae && subtractProcessorAlgae &&
    addBargeAlgae && subtractBargeAlgae
) {
    // Update scores in the DOM
    function updateScores() {
        levelOneScore.textContent = levelOneScoreValue;
        levelTwoScore.textContent = levelTwoScoreValue;
        levelThreeScore.textContent = levelThreeScoreValue;
        levelFourScore.textContent = levelFourScoreValue;
        processorScore.textContent = processorValue;
        bargeScore.textContent = bargeValue;
    }

    // Add event listeners for Level One
    addLevelOne.addEventListener('click', function () {
        levelOneScoreValue += 1;
        updateScores();
    });

    subtractLevelOne.addEventListener('click', function () {
        if (levelOneScoreValue > 0) {
            levelOneScoreValue -= 1;
            updateScores();
        }
    });

    // Add event listeners for Level Two
    addLevelTwo.addEventListener('click', function () {
        levelTwoScoreValue += 1;
        updateScores();
    });

    subtractLevelTwo.addEventListener('click', function () {
        if (levelTwoScoreValue > 0) {
            levelTwoScoreValue -= 1;
            updateScores();
        }
    });

    // Add event listeners for Level Three
    addLevelThree.addEventListener('click', function () {
        levelThreeScoreValue += 1;
        updateScores();
    });

    subtractLevelThree.addEventListener('click', function () {
        if (levelThreeScoreValue > 0) {
            levelThreeScoreValue -= 1;
            updateScores();
        }
    });

    // Add event listeners for Level Four
    addLevelFour.addEventListener('click', function () {
        levelFourScoreValue += 1;
        updateScores();
    });

    subtractLevelFour.addEventListener('click', function () {
        if (levelFourScoreValue > 0) {
            levelFourScoreValue -= 1;
            updateScores();
        }
    });

    // Add event listeners for Processor Algae
    addProcessorAlgae.addEventListener('click', function () {
        processorValue += 1;
        updateScores();
    });

    subtractProcessorAlgae.addEventListener('click', function () {
        if (processorValue > 0) {
            processorValue -= 1;
            updateScores();
        }
    });

    // Add event listeners for Barge Algae
    addBargeAlgae.addEventListener('click', function () {
        bargeValue += 1;
        updateScores();
    });

    subtractBargeAlgae.addEventListener('click', function () {
        if (bargeValue > 0) {
            bargeValue -= 1;
            updateScores();
        }
    });
} else {
    console.error('One or more required DOM elements are missing.');
}