// Vercel serverless proxy for The Blue Alliance API.
// TBA's CORS policy blocks direct browser calls (custom X-TBA-Auth-Key header
// triggers a preflight that TBA rejects). The frontend calls
// /api/tba?path=<endpoint> instead, and this function attaches the auth header
// server-side.

const TBA_API_KEY = 'sjHDan7PDrQZk8wCmcyIuDwFiOeQxM1hliUT978SzOiJlNql8w81VzlNJnjwMC2V';
const BASE_URL = 'https://www.thebluealliance.com/api/v3';

module.exports = async (req, res) => {
    const raw = req.query.path || '';
    // Strip any leading slash and reject path traversal.
    const cleaned = String(raw).replace(/^\/+/, '');
    if (cleaned.includes('..') || /[\r\n]/.test(cleaned)) {
        res.status(400).json({ error: 'Invalid path' });
        return;
    }

    try {
        const response = await fetch(`${BASE_URL}/${cleaned}`, {
            method: 'GET',
            headers: { 'X-TBA-Auth-Key': TBA_API_KEY }
        });
        const text = await response.text();
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'public, max-age=300');
        res.status(response.status).send(text);
    } catch (err) {
        res.status(502).json({ error: 'TBA proxy failed', detail: err.message });
    }
};
