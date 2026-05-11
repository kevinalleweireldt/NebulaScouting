// Match data viewer — sortable table, team averages, charts
// Plain script (not module). Depends on Chart.js loaded via CDN.

const CLIMB_POINTS = [0, 15, 20, 30];
const CLIMB_LABELS = ['None', 'L1', 'L2', 'L3'];

const currentSort = { field: 'matchNumber', dir: 'asc' };
let currentFilter = '';

let chartAvgScore = null;
let chartAutoFuel = null;
let chartTeleopFuel = null;
let chartClimb = null;
let chartsRendered = false;

function getHistory() {
    return JSON.parse(localStorage.getItem('matchHistory')) || [];
}

function normalizeEntry(m) {
    // Provide defaults for old (Reefscape-era) entries too.
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

function computeTeamAverages(history) {
    const byTeam = new Map();
    history.forEach(raw => {
        const m = normalizeEntry(raw);
        if (!byTeam.has(m.teamNumber)) {
            byTeam.set(m.teamNumber, {
                teamNumber: m.teamNumber,
                matchCount: 0,
                totalScore: 0,
                totalAutoFuel: 0,
                totalTeleopFuel: 0,
                climbCount: 0,
                bestClimb: 0,
                defenseCount: 0,
                brokeDownCount: 0,
                climbHistogram: [0, 0, 0, 0]
            });
        }
        const t = byTeam.get(m.teamNumber);
        t.matchCount += 1;
        t.totalScore += m.score;
        t.totalAutoFuel += m.autoFuel;
        t.totalTeleopFuel += m.teleopFuel;
        if (m.endgameClimb > 0) t.climbCount += 1;
        if (m.endgameClimb > t.bestClimb) t.bestClimb = m.endgameClimb;
        if (m.defense) t.defenseCount += 1;
        if (m.brokeDown) t.brokeDownCount += 1;
        t.climbHistogram[m.endgameClimb] += 1;
    });

    const result = new Map();
    byTeam.forEach((t, key) => {
        result.set(key, {
            teamNumber: t.teamNumber,
            matchCount: t.matchCount,
            avgScore: t.totalScore / t.matchCount,
            avgAutoFuel: t.totalAutoFuel / t.matchCount,
            avgTeleopFuel: t.totalTeleopFuel / t.matchCount,
            climbRate: t.climbCount / t.matchCount,
            bestClimb: t.bestClimb,
            defenseRate: t.defenseCount / t.matchCount,
            brokeDownRate: t.brokeDownCount / t.matchCount,
            climbHistogram: t.climbHistogram
        });
    });
    return result;
}

function compareForSort(a, b, field, dir) {
    const mult = dir === 'asc' ? 1 : -1;
    let av = a[field];
    let bv = b[field];
    if (field === 'matchNumber' || field === 'teamNumber') {
        const an = Number(av);
        const bn = Number(bv);
        if (!isNaN(an) && !isNaN(bn)) return (an - bn) * mult;
        return String(av).localeCompare(String(bv)) * mult;
    }
    if (typeof av === 'boolean') av = av ? 1 : 0;
    if (typeof bv === 'boolean') bv = bv ? 1 : 0;
    av = av ?? 0;
    bv = bv ?? 0;
    if (av < bv) return -1 * mult;
    if (av > bv) return 1 * mult;
    return 0;
}

function escapeHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function renderAllMatchesTable() {
    const container = document.getElementById('matchTableContainer');
    if (!container) return;

    const history = getHistory().map(normalizeEntry);

    let rows = history;
    if (currentFilter) {
        const f = currentFilter.toLowerCase();
        rows = rows.filter(r => String(r.teamNumber).toLowerCase().includes(f));
    }

    rows = rows.slice().sort((a, b) => compareForSort(a, b, currentSort.field, currentSort.dir));

    if (rows.length === 0) {
        container.innerHTML = '<p class="empty-state">No match data available.</p>';
        return;
    }

    const cols = [
        { f: 'matchNumber', label: 'Match #' },
        { f: 'teamNumber', label: 'Team #' },
        { f: 'autoFuel', label: 'Auto FUEL' },
        { f: 'autoClimb', label: 'Auto Climb' },
        { f: 'teleopFuel', label: 'Teleop FUEL' },
        { f: 'endgameClimb', label: 'Endgame Climb' },
        { f: 'defense', label: 'Defense' },
        { f: 'brokeDown', label: 'Broke Down' },
        { f: 'score', label: 'Score' },
        { f: 'extraComments', label: 'Comments' }
    ];

    let html = '<table class="match-table"><thead><tr>';
    cols.forEach(c => {
        const active = c.f === currentSort.field ? 'sort-active' : '';
        const arrow = c.f === currentSort.field
            ? `<span class="sort-arrow">${currentSort.dir === 'asc' ? '▲' : '▼'}</span>`
            : '';
        html += `<th class="${active}" data-field="${c.f}">${c.label}${arrow}</th>`;
    });
    html += '</tr></thead><tbody>';

    rows.forEach(r => {
        html += '<tr>';
        html += `<td>${escapeHtml(r.matchNumber)}</td>`;
        html += `<td>${escapeHtml(r.teamNumber)}</td>`;
        html += `<td>${r.autoFuel}</td>`;
        html += `<td>${CLIMB_LABELS[r.autoClimb] || 'None'}</td>`;
        html += `<td>${r.teleopFuel}</td>`;
        html += `<td>${CLIMB_LABELS[r.endgameClimb] || 'None'}</td>`;
        html += `<td>${r.defense ? 'Yes' : 'No'}</td>`;
        html += `<td>${r.brokeDown ? 'Yes' : 'No'}</td>`;
        html += `<td><strong>${r.score}</strong></td>`;
        html += `<td>${escapeHtml(r.extraComments)}</td>`;
        html += '</tr>';
    });
    html += '</tbody></table>';

    container.innerHTML = html;

    container.querySelectorAll('th[data-field]').forEach(th => {
        th.addEventListener('click', () => {
            const f = th.getAttribute('data-field');
            if (currentSort.field === f) {
                currentSort.dir = currentSort.dir === 'asc' ? 'desc' : 'asc';
            } else {
                currentSort.field = f;
                currentSort.dir = 'asc';
            }
            const sortFieldSel = document.getElementById('sortField');
            const sortDirSel = document.getElementById('sortDir');
            if (sortFieldSel) sortFieldSel.value = f;
            if (sortDirSel) sortDirSel.value = currentSort.dir;
            renderAllMatchesTable();
        });
    });
}

function renderTeamAveragesTable() {
    const container = document.getElementById('avgTableContainer');
    if (!container) return;

    const avgMap = computeTeamAverages(getHistory());
    const teams = [...avgMap.values()].sort((a, b) => b.avgScore - a.avgScore);

    if (teams.length === 0) {
        container.innerHTML = '<p class="empty-state">No team data yet.</p>';
        return;
    }

    let html = '<table class="match-table"><thead><tr>';
    html += '<th>Rank</th><th>Team #</th><th>Matches</th><th>Avg Score</th>';
    html += '<th>Avg Auto FUEL</th><th>Avg Teleop FUEL</th>';
    html += '<th>Climb Rate</th><th>Best Climb</th><th>Defense %</th><th>Breakdown %</th>';
    html += '</tr></thead><tbody>';

    teams.forEach((t, i) => {
        html += '<tr>';
        html += `<td><strong>${i + 1}</strong></td>`;
        html += `<td>${escapeHtml(t.teamNumber)}</td>`;
        html += `<td>${t.matchCount}</td>`;
        html += `<td><strong>${t.avgScore.toFixed(1)}</strong></td>`;
        html += `<td>${t.avgAutoFuel.toFixed(2)}</td>`;
        html += `<td>${t.avgTeleopFuel.toFixed(2)}</td>`;
        html += `<td>${(t.climbRate * 100).toFixed(0)}%</td>`;
        html += `<td>${CLIMB_LABELS[t.bestClimb] || 'None'}</td>`;
        html += `<td>${(t.defenseRate * 100).toFixed(0)}%</td>`;
        html += `<td>${(t.brokeDownRate * 100).toFixed(0)}%</td>`;
        html += '</tr>';
    });
    html += '</tbody></table>';

    container.innerHTML = html;
}

function destroyChart(c) {
    if (c) c.destroy();
}

function chartOptions(titleHidden = true) {
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

function renderCharts() {
    if (typeof Chart === 'undefined') return;
    const avgMap = computeTeamAverages(getHistory());
    const teams = [...avgMap.values()].sort((a, b) => b.avgScore - a.avgScore);
    const labels = teams.map(t => t.teamNumber);

    destroyChart(chartAvgScore);
    destroyChart(chartAutoFuel);
    destroyChart(chartTeleopFuel);
    destroyChart(chartClimb);

    const purpleBg = 'rgba(128,0,128,0.7)';
    const purpleBorder = 'rgba(200,100,200,1)';

    const scoreCtx = document.getElementById('chartAvgScore');
    if (scoreCtx) {
        chartAvgScore = new Chart(scoreCtx, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'Avg Total Score',
                    data: teams.map(t => t.avgScore.toFixed(2)),
                    backgroundColor: purpleBg,
                    borderColor: purpleBorder,
                    borderWidth: 1
                }]
            },
            options: chartOptions()
        });
    }

    const autoCtx = document.getElementById('chartAutoFuel');
    if (autoCtx) {
        chartAutoFuel = new Chart(autoCtx, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'Avg Auto FUEL',
                    data: teams.map(t => t.avgAutoFuel.toFixed(2)),
                    backgroundColor: 'rgba(0,170,255,0.6)',
                    borderColor: 'rgba(0,170,255,1)',
                    borderWidth: 1
                }]
            },
            options: chartOptions()
        });
    }

    const teleCtx = document.getElementById('chartTeleopFuel');
    if (teleCtx) {
        chartTeleopFuel = new Chart(teleCtx, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'Avg Teleop FUEL',
                    data: teams.map(t => t.avgTeleopFuel.toFixed(2)),
                    backgroundColor: 'rgba(0,204,136,0.6)',
                    borderColor: 'rgba(0,204,136,1)',
                    borderWidth: 1
                }]
            },
            options: chartOptions()
        });
    }

    const climbCtx = document.getElementById('chartClimb');
    if (climbCtx) {
        chartClimb = new Chart(climbCtx, {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    { label: 'None', data: teams.map(t => t.climbHistogram[0]), backgroundColor: 'rgba(120,120,120,0.7)' },
                    { label: 'L1',   data: teams.map(t => t.climbHistogram[1]), backgroundColor: 'rgba(255,200,0,0.7)' },
                    { label: 'L2',   data: teams.map(t => t.climbHistogram[2]), backgroundColor: 'rgba(255,120,40,0.7)' },
                    { label: 'L3',   data: teams.map(t => t.climbHistogram[3]), backgroundColor: 'rgba(180,40,200,0.85)' }
                ]
            },
            options: {
                ...chartOptions(),
                scales: {
                    x: {
                        stacked: true,
                        ticks: { color: '#fff', font: { family: 'monospace' } },
                        grid: { color: 'rgba(255,255,255,0.1)' }
                    },
                    y: {
                        stacked: true,
                        beginAtZero: true,
                        ticks: { color: '#fff', font: { family: 'monospace' } },
                        grid: { color: 'rgba(255,255,255,0.1)' }
                    }
                }
            }
        });
    }

    chartsRendered = true;
}

function exportToCsv() {
    const history = getHistory().map(normalizeEntry);
    if (history.length === 0) {
        alert('No data to export.');
        return;
    }
    const headers = ['matchNumber', 'teamNumber', 'autoFuel', 'autoClimb', 'teleopFuel', 'endgameClimb', 'defense', 'brokeDown', 'score', 'timestamp', 'extraComments'];
    const lines = [headers.join(',')];
    history.forEach(m => {
        const row = headers.map(h => {
            const v = m[h];
            const s = String(v ?? '').replace(/"/g, '""');
            return /[",\n]/.test(s) ? `"${s}"` : s;
        });
        lines.push(row.join(','));
    });
    const csv = lines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `match-history-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function clearAllData() {
    if (!confirm('Delete ALL scouted match data? This cannot be undone.')) return;
    localStorage.removeItem('matchHistory');
    renderAllMatchesTable();
    renderTeamAveragesTable();
    if (chartsRendered) renderCharts();
}

function switchTab(name) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === name);
    });
    document.querySelectorAll('.tab-panel').forEach(panel => {
        panel.hidden = panel.id !== `tab-${name}`;
    });
    if (name === 'charts') {
        renderCharts();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    renderAllMatchesTable();
    renderTeamAveragesTable();

    const filterInput = document.getElementById('filterTeam');
    if (filterInput) {
        filterInput.addEventListener('input', e => {
            currentFilter = e.target.value;
            renderAllMatchesTable();
        });
    }

    const sortFieldSel = document.getElementById('sortField');
    const sortDirSel = document.getElementById('sortDir');
    if (sortFieldSel) {
        sortFieldSel.addEventListener('change', e => {
            currentSort.field = e.target.value;
            renderAllMatchesTable();
        });
    }
    if (sortDirSel) {
        sortDirSel.addEventListener('change', e => {
            currentSort.dir = e.target.value;
            renderAllMatchesTable();
        });
    }

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    const exportBtn = document.getElementById('exportCsv');
    if (exportBtn) exportBtn.addEventListener('click', exportToCsv);

    const clearBtn = document.getElementById('clearData');
    if (clearBtn) clearBtn.addEventListener('click', clearAllData);
});
