let autoFuelValue = 0;
let teleopFuelValue = 0;

export function initScoreControls() {
    const els = {
        autoFuelScore: document.getElementById('auto-fuel-score'),
        teleopFuelScore: document.getElementById('teleop-fuel-score'),
        addAutoFuel: document.getElementById('addAutoFuel'),
        subtractAutoFuel: document.getElementById('subtractAutoFuel'),
        addTeleopFuel: document.getElementById('addTeleopFuel'),
        subtractTeleopFuel: document.getElementById('subtractTeleopFuel')
    };

    if (!Object.values(els).every(el => el !== null)) {
        console.error('matchScore: one or more required DOM elements are missing.');
        return;
    }

    function updateDisplay() {
        els.autoFuelScore.textContent = autoFuelValue;
        els.teleopFuelScore.textContent = teleopFuelValue;
    }

    function change(which, delta) {
        if (which === 'auto') {
            autoFuelValue = Math.max(0, autoFuelValue + delta);
        } else if (which === 'teleop') {
            teleopFuelValue = Math.max(0, teleopFuelValue + delta);
        }
        updateDisplay();
    }

    els.addAutoFuel.addEventListener('click', () => change('auto', 1));
    els.subtractAutoFuel.addEventListener('click', () => change('auto', -1));
    els.addTeleopFuel.addEventListener('click', () => change('teleop', 1));
    els.subtractTeleopFuel.addEventListener('click', () => change('teleop', -1));

    updateDisplay();
}
