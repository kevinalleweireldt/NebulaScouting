import { requireAuth } from './auth.js';
import { db }          from './firebase-config.js';
import { collection, query, where, getDocs }
    from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';
import { applyChartDefaults, commonOptions, PALETTE, seriesColor }
    from './chart-theme.js';

const CLIMB_LABELS = ['None', 'L1', 'L2', 'L3'];
const MAX_TEAMS    = 5;

let trendChart = null;
let currentUser, currentRole;
let allHistory = [];
let selectedTeams = [];   // ordered list of team numbers (strings)
let allTeams      = [];   // sorted list of team numbers
let teamFilter    = '';

async function fetchHistory() {
    let q;
    if (currentRole === 'admin') {
        q = collection(db, 'matchHistory');
    } else {
        q = query(collection(db, 'matchHistory'), where('submittedBy', '==', currentUser.uid));
    }
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data());
}

function normalizeEntry(m) {
    return {
        matchNumber:  m.matchNumber  ?? 'Unknown',
        teamNumber:   m.teamNumber   ?? 'Unknown',
        autoFuel:     m.autoFuel     ?? 0,
        autoClimb:    m.autoClimb    ?? 0,
        teleopFuel:   m.teleopFuel   ?? 0,
        endgameClimb: m.endgameClimb ?? 0,
        defense:      m.defense      ?? false,
        brokeDown:    m.brokeDown    ?? false,
        score:        m.score        ?? 0,
        timestamp:    m.timestamp?.toDate?.()?.toISOString() ?? m.timestamp ?? '',
        extraComments: m.extraComments ?? ''
    };
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
    );
}

function teamMatches(teamNum) {
    return allHistory
        .map(normalizeEntry)
        .filter(m => String(m.teamNumber) === String(teamNum))
        .sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)));
}

function statsForTeam(teamNum) {
    const matches = teamMatches(teamNum);
    if (matches.length === 0) return { teamNumber: teamNum, matches: [], matchCount: 0 };
    const sum = (arr, k) => arr.reduce((a, b) => a + b[k], 0);
    return {
        teamNumber:    teamNum,
        matches,
        matchCount:    matches.length,
        avgScore:      sum(matches, 'score') / matches.length,
        avgAutoFuel:   sum(matches, 'autoFuel') / matches.length,
        avgTeleopFuel: sum(matches, 'teleopFuel') / matches.length,
        maxScore:      matches.reduce((m, x) => Math.max(m, x.score), 0),
        climbRate:     matches.filter(m => m.endgameClimb > 0).length / matches.length,
        defenseRate:   matches.filter(m => m.defense).length / matches.length,
        brokeDownRate: matches.filter(m => m.brokeDown).length / matches.length,
        bestClimb:     matches.reduce((m, x) => Math.max(m, x.endgameClimb), 0)
    };
}

function runningAvg(values) {
    let sum = 0;
    return values.map((v, i) => { sum += v; return sum / (i + 1); });
}

/* ------------------------------------------------------------
   Chip rail
   ------------------------------------------------------------ */
function renderChipRail() {
    const rail = document.getElementById('teamChipRail');
    if (!rail) return;
    const filter = teamFilter.toLowerCase();
    const list = allTeams.filter(t => !filter || String(t).toLowerCase().includes(filter));

    if (list.length === 0) {
        rail.innerHTML = '<span class="kpi-hint">No teams scouted yet.</span>';
        return;
    }

    rail.innerHTML = list.map(team => {
        const idx = selectedTeams.indexOf(team);
        const isActive = idx !== -1;
        const swatchColor = isActive ? PALETTE[idx % PALETTE.length].solid : 'rgba(255,255,255,0.15)';
        return `<button type="button" class="team-chip ${isActive ? 'is-active' : ''}" data-team="${escapeHtml(team)}">
            <span class="team-chip-swatch" style="background:${swatchColor};color:${swatchColor};"></span>
            ${escapeHtml(team)}
        </button>`;
    }).join('');

    rail.querySelectorAll('.team-chip').forEach(btn => {
        btn.addEventListener('click', () => toggleTeam(btn.dataset.team));
    });
}

function toggleTeam(team) {
    const i = selectedTeams.indexOf(team);
    if (i !== -1) {
        selectedTeams.splice(i, 1);
    } else {
        if (selectedTeams.length >= MAX_TEAMS) {
            alert(`Up to ${MAX_TEAMS} teams at a time.`);
            return;
        }
        selectedTeams.push(team);
    }
    renderChipRail();
    renderAll();
}

function clearTeams() {
    selectedTeams = [];
    renderChipRail();
    renderAll();
}

/* ------------------------------------------------------------
   Trend chart — score per match + running avg + optional FUEL
   ------------------------------------------------------------ */
function renderTrend() {
    if (typeof Chart === 'undefined') return;
    applyChartDefaults();

    const canvas = document.getElementById('chartTrend');
    if (!canvas) return;

    if (trendChart) trendChart.destroy();

    const showRaw  = document.getElementById('toggleRaw')?.checked  ?? true;
    const showAvg  = document.getElementById('toggleAvg')?.checked  ?? true;
    const showFuel = document.getElementById('toggleFuel')?.checked ?? false;

    const datasets = [];
    let maxLen = 0;

    selectedTeams.forEach((team, idx) => {
        const c = seriesColor(idx);
        const matches = teamMatches(team);
        if (matches.length === 0) return;
        maxLen = Math.max(maxLen, matches.length);

        const scores = matches.map(m => m.score);
        const ravg   = runningAvg(scores);

        if (showRaw) {
            datasets.push({
                label: `Team ${team} · score`,
                data: scores,
                borderColor: c.solid,
                backgroundColor: c.soft,
                borderWidth: 1.5,
                borderDash: [4, 4],
                pointRadius: 3,
                pointBackgroundColor: c.solid,
                pointBorderColor: 'rgba(8,5,26,0.9)',
                pointBorderWidth: 1,
                tension: 0,
                fill: false,
                teamNumber: team,
                kind: 'raw'
            });
        }

        if (showAvg) {
            datasets.push({
                label: `Team ${team} · running avg`,
                data: ravg,
                borderColor: c.solid,
                backgroundColor: c.soft,
                borderWidth: 2.5,
                pointRadius: 0,
                pointHoverRadius: 4,
                tension: 0.25,
                fill: false,
                teamNumber: team,
                kind: 'avg'
            });
        }

        if (showFuel) {
            datasets.push({
                label: `Team ${team} · FUEL`,
                data: matches.map(m => m.autoFuel + m.teleopFuel),
                borderColor: c.solid,
                backgroundColor: c.soft,
                borderWidth: 1.5,
                pointRadius: 2,
                pointBackgroundColor: c.solid,
                tension: 0.2,
                fill: false,
                yAxisID: 'yFuel',
                teamNumber: team,
                kind: 'fuel'
            });
        }
    });

    const labels = Array.from({ length: Math.max(maxLen, 1) }, (_, i) => `M${i + 1}`);
    const isEmpty = datasets.length === 0;

    if (isEmpty) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
    }

    trendChart = new Chart(canvas, {
        type: 'line',
        data: { labels, datasets },
        options: commonOptions({
            plugins: {
                legend: {
                    onClick: (e, item, legend) => {
                        const ci = legend.chart;
                        ci.setDatasetVisibility(item.datasetIndex, !ci.isDatasetVisible(item.datasetIndex));
                        ci.update();
                    }
                },
                tooltip: {
                    callbacks: {
                        title: (items) => items[0] ? `Match ${items[0].label.replace('M','')}` : '',
                        label: (ctx) => {
                            const ds = ctx.dataset;
                            const v  = ctx.parsed.y;
                            if (ds.kind === 'avg') {
                                const prior = ctx.dataIndex > 0 ? ds.data[ctx.dataIndex - 1] : null;
                                const delta = prior !== null ? v - prior : 0;
                                const sign  = delta > 0 ? '▲' : (delta < 0 ? '▼' : '·');
                                return `Team ${ds.teamNumber} avg: ${v.toFixed(2)}  ${sign} ${Math.abs(delta).toFixed(2)}`;
                            }
                            if (ds.kind === 'raw')  return `Team ${ds.teamNumber} score: ${v}`;
                            if (ds.kind === 'fuel') return `Team ${ds.teamNumber} FUEL: ${v}`;
                            return `${ds.label}: ${v}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: { display: true, text: 'Match Order', color: 'rgba(245,243,255,0.5)', font: { family: "'JetBrains Mono', monospace", size: 11 } }
                },
                y: {
                    title: { display: true, text: 'Score', color: 'rgba(245,243,255,0.5)', font: { family: "'JetBrains Mono', monospace", size: 11 } }
                },
                ...(showFuel ? {
                    yFuel: {
                        type: 'linear',
                        position: 'right',
                        beginAtZero: true,
                        grid: { drawOnChartArea: false },
                        ticks: { color: 'rgba(245,243,255,0.5)', font: { family: "'JetBrains Mono', monospace", size: 11 } },
                        title:  { display: true, text: 'FUEL', color: 'rgba(245,243,255,0.5)', font: { family: "'JetBrains Mono', monospace", size: 11 } }
                    }
                } : {})
            }
        })
    });
}

/* ------------------------------------------------------------
   Comparison table + per-team detail
   ------------------------------------------------------------ */
function renderComparisonTable(teamStats) {
    const tbl = document.getElementById('comparisonTable');
    if (!tbl) return;

    const rows = [
        ['Matches Scouted', t => t.matchCount,                                            t => t.matchCount],
        ['Avg Total Score', t => t.matchCount ? t.avgScore.toFixed(2) : '—',              t => t.avgScore ?? 0],
        ['Max Score',       t => t.matchCount ? t.maxScore : '—',                          t => t.maxScore ?? 0],
        ['Avg Auto FUEL',   t => t.matchCount ? t.avgAutoFuel.toFixed(2) : '—',           t => t.avgAutoFuel ?? 0],
        ['Avg Teleop FUEL', t => t.matchCount ? t.avgTeleopFuel.toFixed(2) : '—',         t => t.avgTeleopFuel ?? 0],
        ['Climb Rate',      t => t.matchCount ? `${(t.climbRate * 100).toFixed(0)}%` : '—',  t => t.climbRate ?? 0],
        ['Best Climb',      t => t.matchCount ? CLIMB_LABELS[t.bestClimb] : '—',           t => t.bestClimb ?? 0],
        ['Defense %',       t => t.matchCount ? `${(t.defenseRate * 100).toFixed(0)}%` : '—', t => t.defenseRate ?? 0],
        ['Breakdown %',     t => t.matchCount ? `${(t.brokeDownRate * 100).toFixed(0)}%` : '—', t => t.brokeDownRate ?? 0]
    ];

    let html = '<thead><tr><th>Stat</th>';
    teamStats.forEach(t => { html += `<th>Team ${escapeHtml(t.teamNumber)}</th>`; });
    html += '</tr></thead><tbody>';

    rows.forEach(([label, getter, val]) => {
        const vals = teamStats.map(val);
        const max  = Math.max(...vals.map(v => Number(v) || 0), 0.0001);
        html += `<tr><td><strong>${label}</strong></td>`;
        teamStats.forEach((t, i) => {
            const numVal = Number(vals[i]) || 0;
            const pct = Math.min(100, (numVal / max) * 100);
            html += `<td class="cell-bar"><span class="bar-fill" style="width:${pct.toFixed(1)}%"></span><span class="bar-value">${getter(t)}</span></td>`;
        });
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
            html += `<div class="section-card section-card--tight"><h2>Team ${escapeHtml(t.teamNumber)}</h2><p class="empty-state">No scouted matches.</p></div>`;
            return;
        }
        html += `<div class="section-card section-card--tight"><h2>Team ${escapeHtml(t.teamNumber)} — Recent Matches</h2>`;
        html += '<table class="match-table"><thead><tr><th>Match #</th><th>Auto FUEL</th><th>Teleop FUEL</th><th>Auto Climb</th><th>Endgame</th><th>Score</th><th>Notes</th></tr></thead><tbody>';
        t.matches.slice(-8).reverse().forEach(m => {
            const flags = [m.defense && 'D', m.brokeDown && 'BD'].filter(Boolean);
            html += `<tr>
                <td>${escapeHtml(m.matchNumber)}</td>
                <td>${m.autoFuel}</td><td>${m.teleopFuel}</td>
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

/* ------------------------------------------------------------
   Render everything based on selectedTeams
   ------------------------------------------------------------ */
function renderAll() {
    const result = document.getElementById('comparisonResult');
    const empty  = document.getElementById('comparisonEmpty');

    if (selectedTeams.length === 0) {
        if (result) result.hidden = true;
        if (empty)  empty.hidden  = false;
        renderTrend();
        return;
    }

    if (result) result.hidden = false;
    if (empty)  empty.hidden  = true;

    const teamStats = selectedTeams.map(statsForTeam);
    renderTrend();
    renderComparisonTable(teamStats);
    renderDetails(teamStats);
}

/* ------------------------------------------------------------
   Bootstrap
   ------------------------------------------------------------ */
document.addEventListener('DOMContentLoaded', async () => {
    ({ user: currentUser, role: currentRole } = await requireAuth());

    allHistory = await fetchHistory();
    const set = new Set();
    allHistory.forEach(m => { if (m.teamNumber) set.add(String(m.teamNumber)); });
    allTeams = [...set].sort((a, b) => {
        const na = Number(a), nb = Number(b);
        if (!isNaN(na) && !isNaN(nb)) return na - nb;
        return a.localeCompare(b);
    });

    renderChipRail();
    renderAll();

    const filterInput = document.getElementById('teamFilter');
    if (filterInput) filterInput.addEventListener('input', e => {
        teamFilter = e.target.value;
        renderChipRail();
    });

    const clearBtn = document.getElementById('clearTeamsBtn');
    if (clearBtn) clearBtn.addEventListener('click', clearTeams);

    ['toggleRaw', 'toggleAvg', 'toggleFuel'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', renderTrend);
    });
});
