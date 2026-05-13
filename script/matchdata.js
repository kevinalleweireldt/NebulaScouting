import { requireAuth }    from './auth.js';
import { db }             from './firebase-config.js';
import { collection, query, orderBy, getDocs, deleteDoc, doc, writeBatch }
    from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';
import { applyChartDefaults, commonOptions, PALETTE, CLIMB_COLORS, seriesColor, drawSparkline }
    from './chart-theme.js';
import { getActiveEventKey, getEventTeams } from './tba.js';

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
let nicknameMap = new Map();

async function loadNicknames() {
    const eventKey = await getActiveEventKey();
    const teams = await getEventTeams(eventKey);
    const m = new Map();
    teams.forEach(t => {
        if (t.team_number != null) m.set(String(t.team_number), t.nickname || '');
    });
    nicknameMap = m;
}

function teamLabel(team) {
    const nick = nicknameMap.get(String(team));
    return nick ? `${escapeHtml(team)} <span class="team-nickname">— ${escapeHtml(nick)}</span>` : escapeHtml(team);
}

async function fetchHistory() {
    const q = query(collection(db, 'matchHistory'), orderBy('timestamp', 'asc'));
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
        html += `<td>${teamLabel(r.teamNumber)}</td>`;
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
                    renderKpis();
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

    const maxScore   = Math.max(...teams.map(t => t.avgScore), 1);
    const maxAuto    = Math.max(...teams.map(t => t.avgAutoFuel), 1);
    const maxTeleop  = Math.max(...teams.map(t => t.avgTeleopFuel), 1);

    let html = '<table class="match-table"><thead><tr>';
    html += '<th>Rank</th><th>Team #</th><th>Matches</th><th>Avg Score</th>';
    html += '<th>Avg Auto FUEL</th><th>Avg Teleop FUEL</th>';
    html += '<th>Climb Rate</th><th>Best Climb</th><th>Defense %</th><th>Breakdown %</th>';
    html += '</tr></thead><tbody>';

    const bar = (val, max) => `<td class="cell-bar"><span class="bar-fill" style="width:${Math.min(100, (val/max)*100).toFixed(1)}%"></span><span class="bar-value">${val.toFixed(2)}</span></td>`;
    const pct = (val) => `<td class="cell-bar"><span class="bar-fill" style="width:${Math.min(100, val*100).toFixed(1)}%"></span><span class="bar-value">${(val*100).toFixed(0)}%</span></td>`;

    teams.forEach((t, i) => {
        html += '<tr>';
        html += `<td><strong>${i + 1}</strong></td>`;
        html += `<td>${teamLabel(t.teamNumber)}</td>`;
        html += `<td>${t.matchCount}</td>`;
        html += `<td class="cell-bar"><span class="bar-fill" style="width:${Math.min(100, (t.avgScore/maxScore)*100).toFixed(1)}%"></span><span class="bar-value"><strong>${t.avgScore.toFixed(1)}</strong></span></td>`;
        html += bar(t.avgAutoFuel, maxAuto);
        html += bar(t.avgTeleopFuel, maxTeleop);
        html += pct(t.climbRate);
        html += `<td>${CLIMB_LABELS[t.bestClimb] || 'None'}</td>`;
        html += pct(t.defenseRate);
        html += pct(t.brokeDownRate);
        html += '</tr>';
    });
    html += '</tbody></table>';
    container.innerHTML = html;
}

function renderKpis() {
    const totalEl  = document.getElementById('kpiTotalMatches');
    const teamsEl  = document.getElementById('kpiTeams');
    const avgEl    = document.getElementById('kpiAvgScore');
    const topEl    = document.getElementById('kpiTopTeam');
    const latestEl = document.getElementById('kpiLatest');
    if (!totalEl) return;

    const rows = allData.map(normalizeEntry);
    const total = rows.length;
    const uniqueTeams = new Set(rows.map(r => r.teamNumber));
    const avgScore = total ? (rows.reduce((s, r) => s + (r.score || 0), 0) / total) : 0;

    const avgMap = computeTeamAverages(allData);
    const ranked = [...avgMap.values()].sort((a, b) => b.avgScore - a.avgScore);
    const top = ranked[0];

    const sortedByTime = rows.filter(r => r.timestamp).sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));
    const latest = sortedByTime[0];

    totalEl.textContent  = total.toLocaleString();
    teamsEl.textContent  = uniqueTeams.size.toLocaleString();
    avgEl.textContent    = total ? avgScore.toFixed(1) : '—';
    topEl.textContent    = top ? top.teamNumber : '—';
    latestEl.textContent = latest ? `M${latest.matchNumber}` : '—';

    const topHint    = document.getElementById('kpiTopHint');
    if (topHint && top) topHint.textContent = `${top.avgScore.toFixed(1)} avg · ${top.matchCount} matches`;
    const latestHint = document.getElementById('kpiLatestHint');
    if (latestHint && latest) {
        const when = latest.timestamp ? relativeTime(latest.timestamp) : 'submitted';
        latestHint.textContent = `Team ${latest.teamNumber} · ${when}`;
    }
    const avgHint = document.getElementById('kpiAvgHint');
    if (avgHint && total) {
        const max = rows.reduce((m, r) => Math.max(m, r.score || 0), 0);
        avgHint.textContent = `max ${max}`;
    }
    const teamsHint = document.getElementById('kpiTeamsHint');
    if (teamsHint && uniqueTeams.size) {
        teamsHint.textContent = `${(total / Math.max(uniqueTeams.size, 1)).toFixed(1)} matches/team`;
    }

    const spark = document.getElementById('kpiSparkMatches');
    if (spark && total > 0) {
        // Build a cumulative-matches sparkline by chronological order
        const buckets = bucketMatchesOverTime(rows);
        drawSparkline(spark, buckets, { color: PALETTE[0].solid, fillSoft: PALETTE[0].soft });
    }
}

function bucketMatchesOverTime(rows) {
    const stamped = rows.filter(r => r.timestamp).sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)));
    if (stamped.length === 0) return [0];
    const n = Math.min(20, stamped.length);
    const step = stamped.length / n;
    const out = [];
    for (let i = 1; i <= n; i++) out.push(Math.round(i * step));
    return out;
}

function relativeTime(iso) {
    const t = new Date(iso).getTime();
    if (!isFinite(t)) return '—';
    const diff = Date.now() - t;
    const m = Math.floor(diff / 60000);
    if (m < 1)    return 'just now';
    if (m < 60)   return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24)   return `${h}h ago`;
    const d = Math.floor(h / 24);
    return `${d}d ago`;
}

function destroyChart(c) { if (c) c.destroy(); }

function renderCharts() {
    if (typeof Chart === 'undefined') return;
    applyChartDefaults();

    const avgMap = computeTeamAverages(allData);
    const teams  = [...avgMap.values()].sort((a, b) => b.avgScore - a.avgScore);
    const labels = teams.map(t => `Team ${t.teamNumber}`);

    destroyChart(chartAvgScore);
    destroyChart(chartAutoFuel);
    destroyChart(chartTeleopFuel);
    destroyChart(chartClimb);

    const scoreCtx = document.getElementById('chartAvgScore');
    if (scoreCtx) {
        const c = seriesColor(0);
        chartAvgScore = new Chart(scoreCtx, {
            type: 'bar',
            data: { labels, datasets: [{
                label: 'Avg Total Score',
                data: teams.map(t => +t.avgScore.toFixed(2)),
                backgroundColor: c.dim,
                borderColor: c.solid,
                borderWidth: 1,
                borderRadius: 6,
                maxBarThickness: 36
            }] },
            options: commonOptions({ plugins: { legend: { display: false } } })
        });
    }
    const autoCtx = document.getElementById('chartAutoFuel');
    if (autoCtx) {
        const c = seriesColor(2);
        chartAutoFuel = new Chart(autoCtx, {
            type: 'bar',
            data: { labels, datasets: [{
                label: 'Avg Auto FUEL',
                data: teams.map(t => +t.avgAutoFuel.toFixed(2)),
                backgroundColor: c.dim,
                borderColor: c.solid,
                borderWidth: 1,
                borderRadius: 6,
                maxBarThickness: 36
            }] },
            options: commonOptions({ plugins: { legend: { display: false } } })
        });
    }
    const teleCtx = document.getElementById('chartTeleopFuel');
    if (teleCtx) {
        const c = seriesColor(3);
        chartTeleopFuel = new Chart(teleCtx, {
            type: 'bar',
            data: { labels, datasets: [{
                label: 'Avg Teleop FUEL',
                data: teams.map(t => +t.avgTeleopFuel.toFixed(2)),
                backgroundColor: c.dim,
                borderColor: c.solid,
                borderWidth: 1,
                borderRadius: 6,
                maxBarThickness: 36
            }] },
            options: commonOptions({ plugins: { legend: { display: false } } })
        });
    }
    const climbCtx = document.getElementById('chartClimb');
    if (climbCtx) {
        chartClimb = new Chart(climbCtx, {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    { label: 'None', data: teams.map(t => t.climbHistogram[0]), backgroundColor: CLIMB_COLORS[0], borderRadius: 4, stack: 'c' },
                    { label: 'L1',   data: teams.map(t => t.climbHistogram[1]), backgroundColor: CLIMB_COLORS[1], borderRadius: 4, stack: 'c' },
                    { label: 'L2',   data: teams.map(t => t.climbHistogram[2]), backgroundColor: CLIMB_COLORS[2], borderRadius: 4, stack: 'c' },
                    { label: 'L3',   data: teams.map(t => t.climbHistogram[3]), backgroundColor: CLIMB_COLORS[3], borderRadius: 4, stack: 'c' }
                ]
            },
            options: commonOptions({
                scales: { x: { stacked: true }, y: { stacked: true } }
            })
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
        renderKpis();
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

    await loadNicknames();
    allData = await fetchHistory();
    renderKpis();
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
