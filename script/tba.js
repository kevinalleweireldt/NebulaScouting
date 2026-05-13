import { db } from './firebase-config.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';

const BASE_URL = '/api/tba';
const CACHE_TTL_MS = 15 * 60 * 1000;

const cache = new Map();
let cachedEventKey = null;

async function fetchTBAData(endpoint) {
    const hit = cache.get(endpoint);
    if (hit && Date.now() - hit.t < CACHE_TTL_MS) return hit.v;

    const res = await fetch(`${BASE_URL}${endpoint}`, { method: 'GET' });
    if (!res.ok) throw new Error(`TBA ${endpoint} failed: ${res.status}`);
    const v = await res.json();
    cache.set(endpoint, { t: Date.now(), v });
    return v;
}

export async function getActiveEventKey() {
    if (cachedEventKey !== null) return cachedEventKey;
    try {
        const snap = await getDoc(doc(db, 'config', 'app'));
        cachedEventKey = (snap.exists() && snap.data().eventKey) || '';
    } catch {
        cachedEventKey = '';
    }
    return cachedEventKey;
}

export async function getEventTeams(eventKey) {
    if (!eventKey) return [];
    try {
        return await fetchTBAData(`/event/${eventKey}/teams/simple`);
    } catch {
        return [];
    }
}

export async function getEventMatches(eventKey) {
    if (!eventKey) return [];
    try {
        return await fetchTBAData(`/event/${eventKey}/matches/simple`);
    } catch {
        return [];
    }
}

export async function getNextMatch(eventKey) {
    const matches = await getEventMatches(eventKey);
    const unplayed = matches.filter(m => m.actual_time == null);
    if (unplayed.length === 0) return null;
    unplayed.sort((a, b) => (a.predicted_time || a.time || 0) - (b.predicted_time || b.time || 0));
    return unplayed[0];
}

export function teamNumberFromKey(teamKey) {
    return Number(String(teamKey).replace(/^frc/, ''));
}

export function formatMatchLabel(m) {
    const lvl = (m.comp_level || '').toUpperCase();
    if (lvl === 'QM') return `Qual ${m.match_number}`;
    if (lvl === 'QF') return `QF ${m.set_number}-${m.match_number}`;
    if (lvl === 'SF') return `SF ${m.set_number}-${m.match_number}`;
    if (lvl === 'F')  return `Final ${m.match_number}`;
    return `${lvl} ${m.match_number}`;
}
