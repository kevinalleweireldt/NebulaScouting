import { requireAuth } from './auth.js';
import { db }          from './firebase-config.js';
import { collection, query, where, getDocs }
    from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';

const CLIMB_LABELS = ['None', 'L1', 'L2', 'L3'];

const TEAM_COLORS = [
    { bg: 'rgba(180,40,200,0.5)',  border: 'rgba(180,40,200,1)' },
    { bg: 'rgba(0,170,255,0.5)',   border: 'rgba(0,170,255,1)'  },
    { bg: 'rgba(0,204,136,0.5)',   border: 'rgba(0,204,136,1)'  }
];

let chartCompareScore = null;
let chartCompareFuel  = null;
let currentUser, currentRole;

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

async function populateSelects() {
    const history = await fetchHistory();
    const set = new Set();
    history.forEach(m => { if (m.teamNumber) set.add(m.teamNumber); });
    const teams = [...set].sort((a, b) => {
        const na = Number(a), nb = Number(b);
        if (!isNaN(na) && !isNaN(nb)) return na - nb;
        return String(a).localeCompare(String(b));
    });

    ['selectTeamA', 'selectTeamB', 'selectTeamC'].forEach((id, idx) => {
        const sel = document.getElementById(id);
        if (!sel) return;
        const noneLabel = idx === 2 ? '-- None --' : '-- Select Team --';
        sel.innerHTML = `<option value="">${noneLabel}</option>` +
            teams.map(t => `<option value="${t}">${t}</option>`).join('');
    });
}

async function statsForTeam(teamNum) {
    const history = await fetchHistory();
    const matches = history.map(normalizeEntry).filter(m => String(m.teamNumber) === String(teamNum));

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

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
    );
}

function renderComparisonTable(teamStats) {
    const tbl = document.getElementById('comparisonTable');
    if (!tbl) return;

    const rows = [
        ['Matches Scouted', t => t.matchCount],
        ['Avg Total Score', t => t.matchCount ? t.avgScore.toFixed(2) : '—'],
        ['Max Score',       t => t.matchCount ? t.maxScore : '—'],
        ['Avg Auto FUEL',   t => t.matchCount ? t.avgAutoFuel.toFixed(2) : '—'],
        ['Avg Teleop FUEL', t => t.matchCount ? t.avgTeleopFuel.toFixed(2) : '—'],
        ['Climb Rate',      t => t.matchCount ? `${(t.climbRate * 100).toFixed(0)}%` : '—'],
        ['Best Climb',      t => t.matchCount ? CLIMB_LABELS[t.bestClimb] : '—'],
        ['Defense %',       t => t.matchCount ? `${(t.defenseRate * 100).toFixed(0)}%` : '—'],
        ['Breakdown %',     t => t.matchCount ? `${(t.brokeDownRate * 100).toFixed(0)}%` : '—']
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
            html += `<div class="section-card"><h2>Team ${escapeHtml(t.teamNumber)}</h2><p class="empty-state">No scouted matches.</p></div>`;
            return;
        }
        html += `<div class="section-card"><h2>Team ${escapeHtml(t.teamNumber)} — Recent Matches</h2>`;
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

function renderLineCharts(teamStats) {
    if (typeof Chart === 'undefined') return;
    destroyChart(chartCompareScore);
    destroyChart(chartCompareFuel);

    const maxLen = Math.max(...teamStats.map(t => t.matchCount), 1);
    const labels = Array.from({ length: maxLen }, (_, i) => `M${i + 1}`);

    const scoreCtx = document.getElementById('chartCompareScore');
    if (scoreCtx) {
        chartCompareScore = new Chart(scoreCtx, {
            type: 'line',
            data: { labels, datasets: teamStats.map((t, idx) => ({ label: `Team ${t.teamNumber}`, data: t.matches.map(m => m.score), borderColor: TEAM_COLORS[idx].border, backgroundColor: TEAM_COLORS[idx].bg, tension: 0.2 })) },
            options: chartOptions()
        });
    }
    const fuelCtx = document.getElementById('chartCompareFuel');
    if (fuelCtx) {
        chartCompareFuel = new Chart(fuelCtx, {
            type: 'line',
            data: { labels, datasets: teamStats.map((t, idx) => ({ label: `Team ${t.teamNumber}`, data: t.matches.map(m => m.autoFuel + m.teleopFuel), borderColor: TEAM_COLORS[idx].border, backgroundColor: TEAM_COLORS[idx].bg, tension: 0.2 })) },
            options: chartOptions()
        });
    }
}

async function compare() {
    const a = document.getElementById('selectTeamA')?.value || '';
    const b = document.getElementById('selectTeamB')?.value || '';
    const c = document.getElementById('selectTeamC')?.value || '';
    const unique = [...new Set([a, b, c].filter(t => t !== ''))];

    if (unique.length < 2) { alert('Pick at least two distinct teams to compare.'); return; }

    const btn = document.getElementById('compareBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Loading…'; }

    const teamStats = await Promise.all(unique.map(statsForTeam));

    const result = document.getElementById('comparisonResult');
    if (result) result.hidden = false;

    renderComparisonTable(teamStats);
    renderDetails(teamStats);
    renderLineCharts(teamStats);

    if (btn) { btn.disabled = false; btn.textContent = 'Compare'; }
}

document.addEventListener('DOMContentLoaded', async () => {
    ({ user: currentUser, role: currentRole } = await requireAuth());
    await populateSelects();
    const btn = document.getElementById('compareBtn');
    if (btn) btn.addEventListener('click', compare);
});
