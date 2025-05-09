// Initialize score values for each category
let levelOneScoreValue = 0;
let levelTwoScoreValue = 0;
let levelThreeScoreValue = 0;
let levelFourScoreValue = 0;
let processorValue = 0;
let bargeValue = 0;

// Get DOM elements
const elements = {
    levelOneScore: document.getElementById('level-one-score'),
    levelTwoScore: document.getElementById('level-two-score'),
    levelThreeScore: document.getElementById('level-three-score'),
    levelFourScore: document.getElementById('level-four-score'),
    processorScore: document.getElementById('processor-algae-score'),
    bargeScore: document.getElementById('barge-algae-score'),

    addLevelOne: document.getElementById('addLevelOne'),
    subtractLevelOne: document.getElementById('subtractLevelOne'),
    addLevelTwo: document.getElementById('addLevelTwo'),
    subtractLevelTwo: document.getElementById('subtractLevelTwo'),
    addLevelThree: document.getElementById('addLevelThree'),
    subtractLevelThree: document.getElementById('subtractLevelThree'),
    addLevelFour: document.getElementById('addLevelFour'),
    subtractLevelFour: document.getElementById('subtractLevelFour'),
    addProcessorAlgae: document.getElementById('addProcessorAlgae'),
    subtractProcessorAlgae: document.getElementById('subtractProcessorAlgae'),
    addBargeAlgae: document.getElementById('addBargeAlgae'),
    subtractBargeAlgae: document.getElementById('subtractBargeAlgae')
};

// Ensure all elements exist before proceeding
const allElements = Object.values(elements);
if (allElements.every(element => element !== null)) {
    // Function to update the scores in the DOM
    function updateScores() {
        elements.levelOneScore.textContent = levelOneScoreValue;
        elements.levelTwoScore.textContent = levelTwoScoreValue;
        elements.levelThreeScore.textContent = levelThreeScoreValue;
        elements.levelFourScore.textContent = levelFourScoreValue;
        elements.processorScore.textContent = processorValue;
        elements.bargeScore.textContent = bargeValue;
    }

    // Function to handle adding and subtracting score values
    function handleScoreUpdate(scoreType, scoreChange) {
        switch (scoreType) {
            case 'levelOne':
                levelOneScoreValue += scoreChange;
                break;
            case 'levelTwo':
                levelTwoScoreValue += scoreChange;
                break;
            case 'levelThree':
                levelThreeScoreValue += scoreChange;
                break;
            case 'levelFour':
                levelFourScoreValue += scoreChange;
                break;
            case 'processor':
                processorValue += scoreChange;
                break;
            case 'barge':
                bargeValue += scoreChange;
                break;
            default:
                break;
        }

        // Ensure no score goes below 0
        if (levelOneScoreValue < 0) levelOneScoreValue = 0;
        if (levelTwoScoreValue < 0) levelTwoScoreValue = 0;
        if (levelThreeScoreValue < 0) levelThreeScoreValue = 0;
        if (levelFourScoreValue < 0) levelFourScoreValue = 0;
        if (processorValue < 0) processorValue = 0;
        if (bargeValue < 0) bargeValue = 0;

        // Update the scores in the DOM
        updateScores();
    }

    // Add event listeners for all the buttons
    elements.addLevelOne.addEventListener('click', () => handleScoreUpdate('levelOne', 1));
    elements.subtractLevelOne.addEventListener('click', () => handleScoreUpdate('levelOne', -1));

    elements.addLevelTwo.addEventListener('click', () => handleScoreUpdate('levelTwo', 1));
    elements.subtractLevelTwo.addEventListener('click', () => handleScoreUpdate('levelTwo', -1));

    elements.addLevelThree.addEventListener('click', () => handleScoreUpdate('levelThree', 1));
    elements.subtractLevelThree.addEventListener('click', () => handleScoreUpdate('levelThree', -1));

    elements.addLevelFour.addEventListener('click', () => handleScoreUpdate('levelFour', 1));
    elements.subtractLevelFour.addEventListener('click', () => handleScoreUpdate('levelFour', -1));

    elements.addProcessorAlgae.addEventListener('click', () => handleScoreUpdate('processor', 1));
    elements.subtractProcessorAlgae.addEventListener('click', () => handleScoreUpdate('processor', -1));

    elements.addBargeAlgae.addEventListener('click', () => handleScoreUpdate('barge', 1));
    elements.subtractBargeAlgae.addEventListener('click', () => handleScoreUpdate('barge', -1));

} else {
    console.error('One or more required DOM elements are missing.');
}
