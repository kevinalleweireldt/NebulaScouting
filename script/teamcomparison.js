// Team comparison — pick 2-3 teams, show side-by-side stats and per-match line charts.
// Plain script (not module). Requires Chart.js via CDN.

const CLIMB_POINTS = [0, 15, 20, 30];
const CLIMB_LABELS = ['None', 'L1', 'L2', 'L3'];

const TEAM_COLORS = [
    { bg: 'rgba(180,40,200,0.5)',  border: 'rgba(180,40,200,1)' },
    { bg: 'rgba(0,170,255,0.5)',   border: 'rgba(0,170,255,1)'  },
    { bg: 'rgba(0,204,136,0.5)',   border: 'rgba(0,204,136,1)'  }
];

let chartCompareScore = null;
let chartCompareFuel = null;

function getHistory() {
    return JSON.parse(localStorage.getItem('matchHistory')) || [];
}

function normalizeEntry(m) {
    return {
        matchNumber: m.matchNumber ?? 'Unknown',
        teamNumber: m.teamNumber ?? 'Unknown',
        autoFuel: m.autoFuel ?? 0,
        autoClimb: m.autoClimb ?? 0,
        teleopFuel: m.teleopFuel ?? 0,
        endgameClimb: m.endgameClimb ?? 0,
        defense: m.defense ?? false,
        brokeDown: m.brokeDown ?? false,
        score: m.score ?? 0,
        timestamp: m.timestamp ?? '',
        extraComments: m.extraComments ?? ''
    };
}

function uniqueTeams() {
    const set = new Set();
    getHistory().forEach(m => {
        if (m.teamNumber) set.add(m.teamNumber);
    });
    return [...set].sort((a, b) => {
        const na = Number(a), nb = Number(b);
        if (!isNaN(na) && !isNaN(nb)) return na - nb;
        return String(a).localeCompare(String(b));
    });
}

function populateSelects() {
    const teams = uniqueTeams();
    const selects = ['selectTeamA', 'selectTeamB', 'selectTeamC'];
    selects.forEach((id, idx) => {
        const sel = document.getElementById(id);
        if (!sel) return;
        const noneLabel = idx === 2 ? '-- None --' : '-- Select Team --';
        sel.innerHTML = `<option value="">${noneLabel}</option>` +
            teams.map(t => `<option value="${t}">${t}</option>`).join('');
    });
}

function statsForTeam(teamNum) {
    const matches = getHistory()
        .map(normalizeEntry)
        .filter(m => String(m.teamNumber) === String(teamNum));

    if (matches.length === 0) {
        return { teamNumber: teamNum, matches: [], matchCount: 0 };
    }

    const sum = (arr, k) => arr.reduce((a, b) => a + b[k], 0);
    const avgScore = sum(matches, 'score') / matches.length;
    const avgAutoFuel = sum(matches, 'autoFuel') / matches.length;
    const avgTeleopFuel = sum(matches, 'teleopFuel') / matches.length;
    const maxScore = matches.reduce((m, x) => Math.max(m, x.score), 0);
    const climbCount = matches.filter(m => m.endgameClimb > 0).length;
    const defenseCount = matches.filter(m => m.defense).length;
    const brokeCount = matches.filter(m => m.brokeDown).length;
    const bestClimb = matches.reduce((m, x) => Math.max(m, x.endgameClimb), 0);

    return {
        teamNumber: teamNum,
        matches,
        matchCount: matches.length,
        avgScore,
        avgAutoFuel,
        avgTeleopFuel,
        maxScore,
        climbRate: climbCount / matches.length,
        defenseRate: defenseCount / matches.length,
        brokeDownRate: brokeCount / matches.length,
        bestClimb
    };
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

function renderComparisonTable(teamStats) {
    const tbl = document.getElementById('comparisonTable');
    if (!tbl) return;

    const rows = [
        ['Matches Scouted', t => t.matchCount],
        ['Avg Total Score', t => t.matchCount ? t.avgScore.toFixed(2) : '—'],
        ['Max Score', t => t.matchCount ? t.maxScore : '—'],
        ['Avg Auto FUEL', t => t.matchCount ? t.avgAutoFuel.toFixed(2) : '—'],
        ['Avg Teleop FUEL', t => t.matchCount ? t.avgTeleopFuel.toFixed(2) : '—'],
        ['Climb Rate', t => t.matchCount ? `${(t.climbRate * 100).toFixed(0)}%` : '—'],
        ['Best Climb', t => t.matchCount ? CLIMB_LABELS[t.bestClimb] : '—'],
        ['Defense %', t => t.matchCount ? `${(t.defenseRate * 100).toFixed(0)}%` : '—'],
        ['Breakdown %', t => t.matchCount ? `${(t.brokeDownRate * 100).toFixed(0)}%` : '—']
    ];

    let html = '<thead><tr><th>Stat</th>';
    teamStats.forEach(t => { html += `<th>Team ${escapeHtml(t.teamNumber)}</th>`; });
    html += '</tr></thead><tbody>';

    rows.forEach(([label, getter]) => {
        html += `<tr><td><strong>${label}</strong></td>`;
        teamStats.forEach(t => { html += `<td>${getter(t)}</td>`; });
        html += '</tr>';
    });
    html += '</tbody>';

    tbl.innerHTML = html;
}

function renderDetails(teamStats) {
    const container = document.getElementById('comparisonDetails');
    if (!container) return;
    let html = '';
    teamStats.forEach(t => {
        if (t.matchCount === 0) {
            html += `<div class="section-card"><h2>Team ${escapeHtml(t.teamNumber)}</h2><p style="font-family:monospace; color:rgba(255,255,255,0.7);">No scouted matches.</p></div>`;
            return;
        }
        html += `<div class="section-card"><h2>Team ${escapeHtml(t.teamNumber)} — Recent Matches</h2>`;
        html += '<table class="match-table"><thead><tr><th>Match #</th><th>Auto FUEL</th><th>Teleop FUEL</th><th>Auto Climb</th><th>Endgame</th><th>Score</th><th>Notes</th></tr></thead><tbody>';
        const recent = t.matches.slice(-8).reverse();
        recent.forEach(m => {
            const flags = [];
            if (m.defense) flags.push('D');
            if (m.brokeDown) flags.push('BD');
            html += `<tr>
                <td>${escapeHtml(m.matchNumber)}</td>
                <td>${m.autoFuel}</td>
                <td>${m.teleopFuel}</td>
                <td>${CLIMB_LABELS[m.autoClimb]}</td>
                <td>${CLIMB_LABELS[m.endgameClimb]}</td>
                <td><strong>${m.score}</strong></td>
                <td>${flags.join(', ')}${flags.length && m.extraComments ? ' • ' : ''}${escapeHtml(m.extraComments)}</td>
            </tr>`;
        });
        html += '</tbody></table></div>';
    });
    container.innerHTML = html;
}

function destroyChart(c) { if (c) c.destroy(); }

function chartOptions() {
    return {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
            legend: { labels: { color: '#fff', font: { family: 'monospace' } } }
        },
        scales: {
            x: {
                ticks: { color: '#fff', font: { family: 'monospace' } },
                grid: { color: 'rgba(255,255,255,0.1)' }
            },
            y: {
                beginAtZero: true,
                ticks: { color: '#fff', font: { family: 'monospace' } },
                grid: { color: 'rgba(255,255,255,0.1)' }
            }
        }
    };
}

function renderLineCharts(teamStats) {
    if (typeof Chart === 'undefined') return;
    destroyChart(chartCompareScore);
    destroyChart(chartCompareFuel);

    const maxLen = Math.max(...teamStats.map(t => t.matchCount), 1);
    const labels = Array.from({ length: maxLen }, (_, i) => `M${i + 1}`);

    const scoreDatasets = teamStats.map((t, idx) => ({
        label: `Team ${t.teamNumber}`,
        data: t.matches.map(m => m.score),
        borderColor: TEAM_COLORS[idx].border,
        backgroundColor: TEAM_COLORS[idx].bg,
        tension: 0.2
    }));

    const fuelDatasets = teamStats.map((t, idx) => ({
        label: `Team ${t.teamNumber}`,
        data: t.matches.map(m => m.autoFuel + m.teleopFuel),
        borderColor: TEAM_COLORS[idx].border,
        backgroundColor: TEAM_COLORS[idx].bg,
        tension: 0.2
    }));

    const scoreCtx = document.getElementById('chartCompareScore');
    if (scoreCtx) {
        chartCompareScore = new Chart(scoreCtx, {
            type: 'line',
            data: { labels, datasets: scoreDatasets },
            options: chartOptions()
        });
    }

    const fuelCtx = document.getElementById('chartCompareFuel');
    if (fuelCtx) {
        chartCompareFuel = new Chart(fuelCtx, {
            type: 'line',
            data: { labels, datasets: fuelDatasets },
            options: chartOptions()
        });
    }
}

function compare() {
    const a = document.getElementById('selectTeamA')?.value || '';
    const b = document.getElementById('selectTeamB')?.value || '';
    const c = document.getElementById('selectTeamC')?.value || '';
    const picks = [a, b, c].filter(t => t !== '');
    const unique = [...new Set(picks)];

    if (unique.length < 2) {
        alert('Pick at least two distinct teams to compare.');
        return;
    }

    const teamStats = unique.map(statsForTeam);

    const result = document.getElementById('comparisonResult');
    if (result) result.hidden = false;

    renderComparisonTable(teamStats);
    renderDetails(teamStats);
    renderLineCharts(teamStats);
}

document.addEventListener('DOMContentLoaded', () => {
    populateSelects();
    const btn = document.getElementById('compareBtn');
    if (btn) btn.addEventListener('click', compare);
});
