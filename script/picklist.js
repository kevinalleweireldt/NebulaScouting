import { requireAuth }  from './auth.js';
import { db }           from './firebase-config.js';
import { collection, query, where, getDocs, doc, getDoc, setDoc }
    from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';
import { drawSparkline, PALETTE } from './chart-theme.js';
import { getActiveEventKey, getEventTeams } from './tba.js';

let currentRole;
let nicknameMap = new Map();
const pickListRef = () => doc(db, 'pickList', 'current');

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

async function loadPickList() {
    const snap = await getDoc(pickListRef());
    return snap.exists() ? (snap.data().teams ?? []) : [];
}

async function savePickList(list) {
    await setDoc(pickListRef(), { teams: list });
}

async function fetchHistory() {
    const snap = await getDocs(collection(db, 'matchHistory'));
    return snap.docs.map(d => d.data());
}

function normalizeEntry(m) {
    return {
        teamNumber:   m.teamNumber   ?? 'Unknown',
        autoFuel:     m.autoFuel     ?? 0,
        autoClimb:    m.autoClimb    ?? 0,
        teleopFuel:   m.teleopFuel   ?? 0,
        endgameClimb: m.endgameClimb ?? 0,
        defense:      m.defense      ?? false,
        brokeDown:    m.brokeDown    ?? false,
        score:        m.score        ?? 0,
        timestamp:    m.timestamp?.toDate?.()?.toISOString() ?? m.timestamp ?? ''
    };
}

function teamScoreSeries(history, teamNum) {
    return history
        .map(normalizeEntry)
        .filter(m => String(m.teamNumber) === String(teamNum))
        .sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)))
        .map(m => m.score);
}

function renderKpiStrip(list, avgMap) {
    const countEl    = document.getElementById('pkCount');
    const top3El     = document.getElementById('pkTop3');
    const bestEl     = document.getElementById('pkBest');
    const unscoutedEl= document.getElementById('pkUnscouted');
    if (!countEl) return;

    countEl.textContent = list.length.toLocaleString();
    const scouted = list.map(t => avgMap.get(t)).filter(Boolean);
    const top3 = [...scouted].sort((a, b) => b.avgScore - a.avgScore).slice(0, 3);
    top3El.textContent  = top3.length ? (top3.reduce((s, t) => s + t.avgScore, 0) / top3.length).toFixed(1) : '—';
    const best = top3[0];
    bestEl.textContent  = best ? best.teamNumber : '—';
    const bestHint = document.getElementById('pkBestHint');
    if (bestHint) bestHint.textContent = best ? `${best.avgScore.toFixed(1)} avg` : '—';
    unscoutedEl.textContent = (list.length - scouted.length).toString();

    const countHint = document.getElementById('pkCountHint');
    if (countHint) countHint.textContent = list.length > 0 ? `${scouted.length} with data` : 'add teams below';
}

function computeTeamAverages(history) {
    const byTeam = new Map();
    history.forEach(raw => {
        const m = normalizeEntry(raw);
        if (!byTeam.has(m.teamNumber)) {
            byTeam.set(m.teamNumber, { teamNumber: m.teamNumber, matchCount: 0, totalScore: 0, totalAutoFuel: 0, totalTeleopFuel: 0, climbCount: 0, defenseCount: 0 });
        }
        const t = byTeam.get(m.teamNumber);
        t.matchCount      += 1;
        t.totalScore      += m.score;
        t.totalAutoFuel   += m.autoFuel;
        t.totalTeleopFuel += m.teleopFuel;
        if (m.endgameClimb > 0) t.climbCount  += 1;
        if (m.defense)          t.defenseCount += 1;
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
            defenseRate:   t.defenseCount / t.matchCount
        });
    });
    return result;
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
    );
}

let dragSrcIdx = null;

function onDragStart(e) {
    dragSrcIdx = parseInt(e.currentTarget.dataset.idx, 10);
    e.dataTransfer.effectAllowed = 'move';
    e.currentTarget.style.opacity = '0.5';
}
function onDragEnd(e) {
    e.currentTarget.style.opacity = '';
    document.querySelectorAll('.picklist-row').forEach(r => r.classList.remove('drag-over'));
}
function onDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    e.currentTarget.classList.add('drag-over');
}
function onDragLeave(e) { e.currentTarget.classList.remove('drag-over'); }

async function onDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    const targetIdx = parseInt(e.currentTarget.dataset.idx, 10);
    if (dragSrcIdx === null || dragSrcIdx === targetIdx) return;
    const list = await loadPickList();
    const [moved] = list.splice(dragSrcIdx, 1);
    list.splice(targetIdx, 0, moved);
    await savePickList(list);
    dragSrcIdx = null;
    await renderPickList();
}

async function moveItem(idx, delta) {
    const list   = await loadPickList();
    const newIdx = idx + delta;
    if (newIdx < 0 || newIdx >= list.length) return;
    [list[idx], list[newIdx]] = [list[newIdx], list[idx]];
    await savePickList(list);
    await renderPickList();
}

async function removeTeam(team) {
    const list = (await loadPickList()).filter(t => t !== team);
    await savePickList(list);
    await renderPickList();
}

async function renderPickList() {
    const container = document.getElementById('pickListContainer');
    if (!container) return;
    const list   = await loadPickList();
    const history = await fetchHistory();
    const avgMap = computeTeamAverages(history);
    const isAdmin = currentRole === 'admin';

    if (list.length === 0) {
        container.innerHTML = '<div class="picklist-empty">No teams in pick list. Add a team number above, or auto-populate from your scouted data.</div>';
        renderStatsTable(list, avgMap);
        renderKpiStrip(list, avgMap);
        return;
    }

    container.innerHTML = '';
    list.forEach((team, idx) => {
        const stats   = avgMap.get(team);
        const statLine = stats
            ? `Avg Score: ${stats.avgScore.toFixed(1)} • ${stats.matchCount} match${stats.matchCount === 1 ? '' : 'es'}`
            : 'No scouted matches yet';
        const sparkId = `pk-spark-${idx}`;

        const row = document.createElement('div');
        row.className    = 'picklist-row';
        row.dataset.team = team;
        row.dataset.idx  = idx;

        if (isAdmin) {
            row.draggable = true;
            row.innerHTML = `
                <span class="drag-handle" title="Drag to reorder">≡</span>
                <span class="rank-number">${idx + 1}</span>
                <span class="team-number-cell">${teamLabel(team)}</span>
                <span class="team-stat">${statLine}</span>
                <canvas class="picklist-spark" id="${sparkId}"></canvas>
                <span class="row-actions">
                    <button class="arrow-btn" data-action="up"     data-idx="${idx}" title="Move up">▲</button>
                    <button class="arrow-btn" data-action="down"   data-idx="${idx}" title="Move down">▼</button>
                    <button class="btn btn-sm btn-danger" data-action="remove" data-team="${escapeHtml(team)}">Remove</button>
                </span>`;
            row.addEventListener('dragstart', onDragStart);
            row.addEventListener('dragend',   onDragEnd);
            row.addEventListener('dragover',  onDragOver);
            row.addEventListener('dragleave', onDragLeave);
            row.addEventListener('drop',      onDrop);
        } else {
            row.innerHTML = `
                <span class="rank-number">${idx + 1}</span>
                <span class="team-number-cell">${teamLabel(team)}</span>
                <span class="team-stat">${statLine}</span>
                <canvas class="picklist-spark" id="${sparkId}"></canvas>`;
        }

        container.appendChild(row);
    });

    // Sparklines need to be drawn after canvases are in the DOM and laid out.
    requestAnimationFrame(() => {
        list.forEach((team, idx) => {
            const series = teamScoreSeries(history, team);
            if (series.length === 0) return;
            const canvas = document.getElementById(`pk-spark-${idx}`);
            const palette = PALETTE[idx % PALETTE.length];
            drawSparkline(canvas, series, { color: palette.solid, fillSoft: palette.soft });
        });
    });

    renderStatsTable(list, avgMap);
    renderKpiStrip(list, avgMap);
}

function renderStatsTable(list, avgMap) {
    const container = document.getElementById('picklistStatsTable');
    if (!container) return;
    if (list.length === 0) { container.innerHTML = ''; return; }

    const scoutedStats = list.map(t => avgMap.get(t)).filter(Boolean);
    const maxScore  = Math.max(...scoutedStats.map(s => s.avgScore || 0), 1);
    const maxAuto   = Math.max(...scoutedStats.map(s => s.avgAutoFuel || 0), 1);
    const maxTeleop = Math.max(...scoutedStats.map(s => s.avgTeleopFuel || 0), 1);

    const bar = (val, max, fmt) => {
        const pct = Math.min(100, ((val || 0) / max) * 100);
        return `<td class="cell-bar"><span class="bar-fill" style="width:${pct.toFixed(1)}%"></span><span class="bar-value">${fmt(val)}</span></td>`;
    };
    const pct = (val) => {
        const w = Math.min(100, (val || 0) * 100);
        return `<td class="cell-bar"><span class="bar-fill" style="width:${w.toFixed(1)}%"></span><span class="bar-value">${((val || 0) * 100).toFixed(0)}%</span></td>`;
    };

    let html = '<table class="match-table"><thead><tr>';
    html += '<th>Rank</th><th>Team #</th><th>Matches</th><th>Avg Score</th><th>Avg Auto FUEL</th><th>Avg Teleop FUEL</th><th>Climb Rate</th><th>Defense %</th>';
    html += '</tr></thead><tbody>';

    list.forEach((team, idx) => {
        const s = avgMap.get(team);
        html += '<tr>';
        html += `<td><strong>${idx + 1}</strong></td>`;
        html += `<td>${teamLabel(team)}</td>`;
        if (s) {
            html += `<td>${s.matchCount}</td>`;
            html += bar(s.avgScore, maxScore, v => `<strong>${v.toFixed(1)}</strong>`);
            html += bar(s.avgAutoFuel, maxAuto, v => v.toFixed(2));
            html += bar(s.avgTeleopFuel, maxTeleop, v => v.toFixed(2));
            html += pct(s.climbRate);
            html += pct(s.defenseRate);
        } else {
            html += '<td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td>';
        }
        html += '</tr>';
    });
    html += '</tbody></table>';
    container.innerHTML = html;
}

async function addTeam() {
    const input = document.getElementById('addTeamInput');
    if (!input) return;
    const team = input.value.trim();
    if (!team) return;
    const list = await loadPickList();
    if (list.includes(team)) { alert(`Team ${team} is already in the pick list.`); return; }
    list.push(team);
    await savePickList(list);
    input.value = '';
    await renderPickList();
}

async function autoPopulate() {
    const existing = await loadPickList();
    if (existing.length > 0) {
        if (!confirm('This will replace the current pick list with teams sorted by avg score. Continue?')) return;
    }
    const history = await fetchHistory();
    const avgMap  = computeTeamAverages(history);
    const ranked  = [...avgMap.values()].sort((a, b) => b.avgScore - a.avgScore).map(t => t.teamNumber);
    if (ranked.length === 0) { alert('No scouted teams to populate from.'); return; }
    await savePickList(ranked);
    await renderPickList();
}

async function clearList() {
    const list = await loadPickList();
    if (list.length === 0) return;
    if (!confirm('Clear the entire pick list?')) return;
    await savePickList([]);
    await renderPickList();
}

async function seedFromEvent() {
    const eventKey = await getActiveEventKey();
    if (!eventKey) { alert('No event key set. Set one in /admin first.'); return; }
    const teams = await getEventTeams(eventKey);
    if (teams.length === 0) { alert(`No teams found for event ${eventKey}. Check the event key.`); return; }
    const nums = teams.map(t => String(t.team_number)).filter(Boolean);
    const existing = await loadPickList();
    const merged = [...existing];
    let added = 0;
    nums.forEach(n => { if (!merged.includes(n)) { merged.push(n); added++; } });
    if (added === 0) { alert(`All ${nums.length} event teams are already in the pick list.`); return; }
    if (!confirm(`Add ${added} team${added === 1 ? '' : 's'} from ${eventKey} to the pick list?`)) return;
    await savePickList(merged);
    await renderPickList();
}

document.addEventListener('DOMContentLoaded', async () => {
    ({ role: currentRole } = await requireAuth());

    await loadNicknames();
    await renderPickList();

    // Hide edit controls for scouters
    if (currentRole !== 'admin') {
        ['addTeamInput', 'addTeamBtn', 'autoPopulateBtn', 'clearPicklist', 'seedFromEventBtn'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.hidden = true;
        });
        const subtitle = document.querySelector('.subtitle');
        if (subtitle) subtitle.textContent = 'View-only';
        return;
    }

    const addBtn = document.getElementById('addTeamBtn');
    if (addBtn) addBtn.addEventListener('click', addTeam);

    const input = document.getElementById('addTeamInput');
    if (input) input.addEventListener('keypress', e => { if (e.key === 'Enter') addTeam(); });

    const autoBtn = document.getElementById('autoPopulateBtn');
    if (autoBtn) autoBtn.addEventListener('click', autoPopulate);

    const seedBtn = document.getElementById('seedFromEventBtn');
    if (seedBtn) seedBtn.addEventListener('click', seedFromEvent);

    const clearBtn = document.getElementById('clearPicklist');
    if (clearBtn) clearBtn.addEventListener('click', clearList);

    const container = document.getElementById('pickListContainer');
    if (container) {
        container.addEventListener('click', e => {
            const btn = e.target.closest('button[data-action]');
            if (!btn) return;
            const action = btn.dataset.action;
            if (action === 'remove') removeTeam(btn.dataset.team);
            else if (action === 'up')   moveItem(parseInt(btn.dataset.idx, 10), -1);
            else if (action === 'down') moveItem(parseInt(btn.dataset.idx, 10),  1);
        });
    }
});
