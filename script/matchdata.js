import { requireAuth }    from './auth.js';
import { db }             from './firebase-config.js';
import { collection, query, where, orderBy, getDocs, deleteDoc, doc, writeBatch }
    from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';

const CLIMB_LABELS = ['None', 'L1', 'L2', 'L3'];

const currentSort = { field: 'matchNumber', dir: 'asc' };
let currentFilter = '';

let chartAvgScore  = null;
let chartAutoFuel  = null;
let chartTeleopFuel = null;
let chartClimb     = null;
let chartsRendered = false;

let allData = [];
let currentUser, currentRole;

async function fetchHistory() {
    let q;
    if (currentRole === 'admin') {
        q = query(collection(db, 'matchHistory'), orderBy('timestamp', 'asc'));
    } else {
        q = query(
            collection(db, 'matchHistory'),
            where('submittedBy', '==', currentUser.uid),
            orderBy('timestamp', 'asc')
        );
    }
    const snap = await getDocs(q);
    return snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
        timestamp: d.data().timestamp?.toDate?.()?.toISOString() ?? d.data().timestamp ?? ''
    }));
}

function normalizeEntry(m) {
    return {
        ...m,
        matchNumber:  m.matchNumber  ?? 'Unknown',
        teamNumber:   m.teamNumber   ?? 'Unknown',
        autoFuel:     m.autoFuel     ?? 0,
        autoClimb:    m.autoClimb    ?? 0,
        teleopFuel:   m.teleopFuel   ?? 0,
        endgameClimb: m.endgameClimb ?? 0,
        defense:      m.defense      ?? false,
        brokeDown:    m.brokeDown    ?? false,
        score:        m.score        ?? 0,
        timestamp:    m.timestamp    ?? '',
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
        t.matchCount    += 1;
        t.totalScore    += m.score;
        t.totalAutoFuel += m.autoFuel;
        t.totalTeleopFuel += m.teleopFuel;
        if (m.endgameClimb > 0) t.climbCount += 1;
        if (m.endgameClimb > t.bestClimb) t.bestClimb = m.endgameClimb;
        if (m.defense)    t.defenseCount += 1;
        if (m.brokeDown)  t.brokeDownCount += 1;
        t.climbHistogram[m.endgameClimb] += 1;
    });

    const result = new Map();
    byTeam.forEach((t, key) => {
        result.set(key, {
            teamNumber:    t.teamNumber,
            matchCount:    t.matchCount,
            avgScore:      t.totalScore / t.matchCount,
            avgAutoFuel:   t.totalAutoFuel / t.matchCount,
            avgTeleopFuel: t.totalTeleopFuel / t.matchCount,
            climbRate:     t.climbCount / t.matchCount,
            bestClimb:     t.bestClimb,
            defenseRate:   t.defenseCount / t.matchCount,
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
        const an = Number(av), bn = Number(bv);
        if (!isNaN(an) && !isNaN(bn)) return (an - bn) * mult;
        return String(av).localeCompare(String(bv)) * mult;
    }
    if (typeof av === 'boolean') av = av ? 1 : 0;
    if (typeof bv === 'boolean') bv = bv ? 1 : 0;
    av = av ?? 0;
    bv = bv ?? 0;
    if (av < bv) return -1 * mult;
    if (av > bv) return  1 * mult;
    return 0;
}

function escapeHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function renderAllMatchesTable() {
    const container = document.getElementById('matchTableContainer');
    if (!container) return;

    let rows = allData.map(normalizeEntry);
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
        { f: 'matchNumber',  label: 'Match #' },
        { f: 'teamNumber',   label: 'Team #' },
        { f: 'autoFuel',     label: 'Auto FUEL' },
        { f: 'autoClimb',   label: 'Auto Climb' },
        { f: 'teleopFuel',   label: 'Teleop FUEL' },
        { f: 'endgameClimb', label: 'Endgame Climb' },
        { f: 'defense',      label: 'Defense' },
        { f: 'brokeDown',    label: 'Broke Down' },
        { f: 'score',        label: 'Score' },
        { f: 'extraComments', label: 'Comments' }
    ];

    let html = '<table class="match-table"><thead><tr>';
    cols.forEach(c => {
        const active = c.f === currentSort.field ? 'sort-active' : '';
        const arrow  = c.f === currentSort.field
            ? `<span class="sort-arrow">${currentSort.dir === 'asc' ? '▲' : '▼'}</span>` : '';
        html += `<th class="${active}" data-field="${c.f}">${c.label}${arrow}</th>`;
    });
    if (currentRole === 'admin') html += '<th></th>';
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
        if (currentRole === 'admin') {
            html += `<td><button class="btn btn-sm btn-danger" data-delete-id="${escapeHtml(r.id)}">Delete</button></td>`;
        }
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
                currentSort.dir   = 'asc';
            }
            const sortFieldSel = document.getElementById('sortField');
            const sortDirSel   = document.getElementById('sortDir');
            if (sortFieldSel) sortFieldSel.value = f;
            if (sortDirSel)   sortDirSel.value   = currentSort.dir;
            renderAllMatchesTable();
        });
    });

    if (currentRole === 'admin') {
        container.querySelectorAll('[data-delete-id]').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (!confirm('Delete this match entry? This cannot be undone.')) return;
                const id = btn.dataset.deleteId;
                btn.disabled = true;
                try {
                    await deleteDoc(doc(db, 'matchHistory', id));
                    allData = allData.filter(r => r.id !== id);
                    renderAllMatchesTable();
                    renderTeamAveragesTable();
                    if (chartsRendered) renderCharts();
                } catch (err) {
                    alert('Failed to delete entry.');
                    btn.disabled = false;
                }
            });
        });
    }
}

function renderTeamAveragesTable() {
    const container = document.getElementById('avgTableContainer');
    if (!container) return;

    const avgMap = computeTeamAverages(allData);
    const teams  = [...avgMap.values()].sort((a, b) => b.avgScore - a.avgScore);

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

function destroyChart(c) { if (c) c.destroy(); }

function chartOptions() {
    return {
        responsive: true,
        maintainAspectRatio: true,
        plugins: { legend: { labels: { color: '#fff', font: { family: 'monospace' } } } },
        scales: {
            x: { ticks: { color: '#fff', font: { family: 'monospace' } }, grid: { color: 'rgba(255,255,255,0.1)' } },
            y: { beginAtZero: true, ticks: { color: '#fff', font: { family: 'monospace' } }, grid: { color: 'rgba(255,255,255,0.1)' } }
        }
    };
}

function renderCharts() {
    if (typeof Chart === 'undefined') return;
    const avgMap = computeTeamAverages(allData);
    const teams  = [...avgMap.values()].sort((a, b) => b.avgScore - a.avgScore);
    const labels = teams.map(t => t.teamNumber);

    destroyChart(chartAvgScore);
    destroyChart(chartAutoFuel);
    destroyChart(chartTeleopFuel);
    destroyChart(chartClimb);

    const scoreCtx = document.getElementById('chartAvgScore');
    if (scoreCtx) {
        chartAvgScore = new Chart(scoreCtx, {
            type: 'bar',
            data: { labels, datasets: [{ label: 'Avg Total Score', data: teams.map(t => t.avgScore.toFixed(2)), backgroundColor: 'rgba(128,0,128,0.7)', borderColor: 'rgba(200,100,200,1)', borderWidth: 1 }] },
            options: chartOptions()
        });
    }
    const autoCtx = document.getElementById('chartAutoFuel');
    if (autoCtx) {
        chartAutoFuel = new Chart(autoCtx, {
            type: 'bar',
            data: { labels, datasets: [{ label: 'Avg Auto FUEL', data: teams.map(t => t.avgAutoFuel.toFixed(2)), backgroundColor: 'rgba(0,170,255,0.6)', borderColor: 'rgba(0,170,255,1)', borderWidth: 1 }] },
            options: chartOptions()
        });
    }
    const teleCtx = document.getElementById('chartTeleopFuel');
    if (teleCtx) {
        chartTeleopFuel = new Chart(teleCtx, {
            type: 'bar',
            data: { labels, datasets: [{ label: 'Avg Teleop FUEL', data: teams.map(t => t.avgTeleopFuel.toFixed(2)), backgroundColor: 'rgba(0,204,136,0.6)', borderColor: 'rgba(0,204,136,1)', borderWidth: 1 }] },
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
            options: { ...chartOptions(), scales: {
                x: { stacked: true, ticks: { color: '#fff', font: { family: 'monospace' } }, grid: { color: 'rgba(255,255,255,0.1)' } },
                y: { stacked: true, beginAtZero: true, ticks: { color: '#fff', font: { family: 'monospace' } }, grid: { color: 'rgba(255,255,255,0.1)' } }
            }}
        });
    }
    chartsRendered = true;
}

function exportToCsv() {
    if (allData.length === 0) { alert('No data to export.'); return; }
    const normalized = allData.map(normalizeEntry);
    const headers = ['matchNumber','teamNumber','autoFuel','autoClimb','teleopFuel','endgameClimb','defense','brokeDown','score','timestamp','extraComments'];
    const lines = [headers.join(',')];
    normalized.forEach(m => {
        const row = headers.map(h => {
            const v = m[h];
            const s = String(v ?? '').replace(/"/g, '""');
            return /[",\n]/.test(s) ? `"${s}"` : s;
        });
        lines.push(row.join(','));
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `match-history-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

async function clearAllData() {
    if (!confirm('Delete ALL match data? This cannot be undone.')) return;
    try {
        const snap  = await getDocs(collection(db, 'matchHistory'));
        const batch = writeBatch(db);
        snap.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();
        allData = [];
        renderAllMatchesTable();
        renderTeamAveragesTable();
        if (chartsRendered) renderCharts();
    } catch (err) {
        alert('Failed to clear data. Check your connection.');
    }
}

function switchTab(name) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === name);
    });
    document.querySelectorAll('.tab-panel').forEach(panel => {
        panel.hidden = panel.id !== `tab-${name}`;
    });
    if (name === 'charts') renderCharts();
}

document.addEventListener('DOMContentLoaded', async () => {
    ({ user: currentUser, role: currentRole } = await requireAuth());

    allData = await fetchHistory();
    renderAllMatchesTable();
    renderTeamAveragesTable();

    // Hide "Clear All Data" for scouters
    const clearBtn = document.getElementById('clearData');
    if (clearBtn) {
        if (currentRole !== 'admin') {
            clearBtn.hidden = true;
        } else {
            clearBtn.addEventListener('click', clearAllData);
        }
    }

    const filterInput = document.getElementById('filterTeam');
    if (filterInput) {
        filterInput.addEventListener('input', e => {
            currentFilter = e.target.value;
            renderAllMatchesTable();
        });
    }

    const sortFieldSel = document.getElementById('sortField');
    const sortDirSel   = document.getElementById('sortDir');
    if (sortFieldSel) sortFieldSel.addEventListener('change', e => { currentSort.field = e.target.value; renderAllMatchesTable(); });
    if (sortDirSel)   sortDirSel.addEventListener('change',   e => { currentSort.dir   = e.target.value; renderAllMatchesTable(); });

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    const exportBtn = document.getElementById('exportCsv');
    if (exportBtn) exportBtn.addEventListener('click', exportToCsv);
});
