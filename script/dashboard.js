import { requireAuth }   from './auth.js';
import { db }            from './firebase-config.js';
import { collection, query, orderBy, getDocs }
    from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';
import { drawSparkline, PALETTE } from './chart-theme.js';

let currentUser, currentRole;

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
        score:        m.score        ?? 0,
        submittedByEmail: m.submittedByEmail ?? 'someone',
        timestamp:    m.timestamp    ?? ''
    };
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
    );
}

function relativeTime(iso) {
    const t = new Date(iso).getTime();
    if (!isFinite(t)) return '—';
    const diff = Date.now() - t;
    const m = Math.floor(diff / 60000);
    if (m < 1)  return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    return `${d}d ago`;
}

function computeTeamAverages(rows) {
    const byTeam = new Map();
    rows.forEach(r => {
        const key = String(r.teamNumber);
        if (!byTeam.has(key)) byTeam.set(key, { teamNumber: key, count: 0, total: 0 });
        const t = byTeam.get(key);
        t.count += 1;
        t.total += r.score || 0;
    });
    return [...byTeam.values()].map(t => ({
        teamNumber: t.teamNumber,
        matchCount: t.count,
        avgScore:   t.total / t.count
    }));
}

function renderKpis(rows) {
    const total = rows.length;
    const uniqueTeams = new Set(rows.map(r => r.teamNumber));
    const avgScore = total ? rows.reduce((s, r) => s + (r.score || 0), 0) / total : 0;

    const teams = computeTeamAverages(rows).sort((a, b) => b.avgScore - a.avgScore);
    const top   = teams[0];

    const sortedByTime = [...rows]
        .filter(r => r.timestamp)
        .sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));
    const latest = sortedByTime[0];

    document.getElementById('dashTotal').textContent    = total.toLocaleString();
    document.getElementById('dashTeams').textContent    = uniqueTeams.size.toLocaleString();
    document.getElementById('dashAvgScore').textContent = total ? avgScore.toFixed(1) : '—';
    document.getElementById('dashTopTeam').textContent  = top ? top.teamNumber : '—';
    document.getElementById('dashLatest').textContent   = latest ? `M${latest.matchNumber}` : '—';

    const totalHint  = document.getElementById('dashTotalHint');
    const teamsHint  = document.getElementById('dashTeamsHint');
    const avgHint    = document.getElementById('dashAvgHint');
    const topHint    = document.getElementById('dashTopHint');
    const latestHint = document.getElementById('dashLatestHint');

    if (totalHint && total)        totalHint.textContent  = `${(total / Math.max(uniqueTeams.size, 1)).toFixed(1)} avg per team`;
    if (teamsHint && uniqueTeams.size) teamsHint.textContent = `${uniqueTeams.size} unique`;
    if (avgHint && total)          avgHint.textContent    = `max ${rows.reduce((m, r) => Math.max(m, r.score || 0), 0)}`;
    if (topHint && top)            topHint.textContent    = `${top.avgScore.toFixed(1)} avg · ${top.matchCount} matches`;
    if (latestHint && latest)      latestHint.textContent = `Team ${latest.teamNumber} · ${relativeTime(latest.timestamp)}`;

    // Sparklines
    const sparkTotal = document.getElementById('dashSparkTotal');
    if (sparkTotal && total > 0) {
        const points = rows.length <= 1 ? [1] : rows.map((_, i) => i + 1);
        const sampled = sampleLine(points, 16);
        drawSparkline(sparkTotal, sampled, { color: PALETTE[0].solid, fillSoft: PALETTE[0].soft });
    }
    const sparkAvg = document.getElementById('dashSparkAvg');
    if (sparkAvg && total > 0) {
        // running avg of score over chronological order
        let s = 0;
        const ravg = rows.map((r, i) => { s += (r.score || 0); return s / (i + 1); });
        const sampled = sampleLine(ravg, 16);
        drawSparkline(sparkAvg, sampled, { color: PALETTE[1].solid, fillSoft: PALETTE[1].soft });
    }
}

function sampleLine(values, n) {
    if (values.length <= n) return values.slice();
    const step = values.length / n;
    const out = [];
    for (let i = 0; i < n; i++) {
        const idx = Math.min(values.length - 1, Math.floor(i * step));
        out.push(values[idx]);
    }
    out.push(values[values.length - 1]);
    return out;
}

function renderActivity(rows) {
    const list = document.getElementById('activityList');
    if (!list) return;
    const recent = [...rows]
        .filter(r => r.timestamp)
        .sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)))
        .slice(0, 8);

    if (recent.length === 0) {
        list.innerHTML = '<li class="empty-state">No scouted matches yet.</li>';
        return;
    }

    list.innerHTML = recent.map(r => {
        const who = r.submittedByEmail?.split('@')[0] ?? 'scouter';
        return `<li class="activity-item">
            <span class="activity-dot"></span>
            <p class="activity-text"><span class="team">Team ${escapeHtml(r.teamNumber)}</span> · Match ${escapeHtml(r.matchNumber)} · <span class="score">${r.score}</span> pts <span style="color:var(--text-dim);font-size:11px;">by ${escapeHtml(who)}</span></p>
            <span class="activity-meta">${relativeTime(r.timestamp)}</span>
        </li>`;
    }).join('');
}

function renderLeaderboard(rows) {
    const list = document.getElementById('leaderboard');
    if (!list) return;
    const teams = computeTeamAverages(rows).sort((a, b) => b.avgScore - a.avgScore).slice(0, 5);

    if (teams.length === 0) {
        list.innerHTML = '<li class="empty-state">Awaiting data.</li>';
        return;
    }

    const max = Math.max(...teams.map(t => t.avgScore), 1);

    list.innerHTML = teams.map((t, i) => {
        const pct = (t.avgScore / max) * 100;
        return `<li class="leader-row" style="--bar:${pct.toFixed(1)}%">
            <span class="leader-rank">#${i + 1}</span>
            <span>
                <span class="leader-team">${escapeHtml(t.teamNumber)}</span>
                <span class="leader-team-meta">${t.matchCount} match${t.matchCount === 1 ? '' : 'es'}</span>
            </span>
            <span class="leader-score">${t.avgScore.toFixed(1)}</span>
        </li>`;
    }).join('');
}

document.addEventListener('DOMContentLoaded', async () => {
    ({ user: currentUser, role: currentRole } = await requireAuth());

    const subtitle = document.getElementById('dashSubtitle');
    if (subtitle && currentRole === 'scouter') {
        subtitle.textContent = 'Your submissions · 2026 FRC';
    }

    const rawRows = await fetchHistory();
    const rows = rawRows.map(normalizeEntry);

    renderKpis(rows);
    renderActivity(rows);
    renderLeaderboard(rows);
});
