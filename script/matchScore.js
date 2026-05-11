let autoFuelValue = 0;
let teleopFuelValue = 0;

export function initScoreControls() {
    const autoDisplay = document.getElementById('auto-fuel-score');
    const teleopDisplay = document.getElementById('teleop-fuel-score');

    if (!autoDisplay || !teleopDisplay) {
        console.error('matchScore: counter display elements missing.');
        return;
    }

    function updateDisplay() {
        autoDisplay.textContent = autoFuelValue;
        teleopDisplay.textContent = teleopFuelValue;
    }

    function applyDelta(counter, delta) {
        if (counter === 'auto') {
            autoFuelValue = Math.max(0, autoFuelValue + delta);
        } else if (counter === 'teleop') {
            teleopFuelValue = Math.max(0, teleopFuelValue + delta);
        }
        updateDisplay();
    }

    document.querySelectorAll('[data-counter][data-delta]').forEach(btn => {
        btn.addEventListener('click', () => {
            const counter = btn.dataset.counter;
            const delta = parseInt(btn.dataset.delta, 10) || 0;
            applyDelta(counter, delta);
        });
    });

    updateDisplay();
}
