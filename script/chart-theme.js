/* ============================================================
   Chart.js shared theme — Nebula Scouting
   ============================================================ */

export const PALETTE = [
    { solid: '#b97cff', soft: 'rgba(185,124,255,0.18)', dim: 'rgba(185,124,255,0.45)' }, // purple
    { solid: '#d946ef', soft: 'rgba(217,70,239,0.18)',  dim: 'rgba(217,70,239,0.45)'  }, // magenta
    { solid: '#06b6d4', soft: 'rgba(6,182,212,0.18)',   dim: 'rgba(6,182,212,0.45)'   }, // cyan
    { solid: '#10b981', soft: 'rgba(16,185,129,0.18)',  dim: 'rgba(16,185,129,0.45)'  }, // emerald
    { solid: '#f59e0b', soft: 'rgba(245,158,11,0.18)',  dim: 'rgba(245,158,11,0.45)'  }  // amber
];

export const CLIMB_COLORS = ['rgba(120,120,140,0.6)', '#f59e0b', '#d946ef', '#b97cff'];

export function seriesColor(i) {
    return PALETTE[i % PALETTE.length];
}

let defaultsApplied = false;

export function applyChartDefaults() {
    if (defaultsApplied || typeof Chart === 'undefined') return;
    defaultsApplied = true;

    Chart.defaults.color = 'rgba(245,243,255,0.78)';
    Chart.defaults.font.family = "'Inter', system-ui, sans-serif";
    Chart.defaults.font.size = 12;
    Chart.defaults.borderColor = 'rgba(157,78,255,0.10)';

    Chart.defaults.plugins.legend.position = 'top';
    Chart.defaults.plugins.legend.align = 'end';
    Chart.defaults.plugins.legend.labels.usePointStyle = true;
    Chart.defaults.plugins.legend.labels.boxWidth = 8;
    Chart.defaults.plugins.legend.labels.boxHeight = 8;
    Chart.defaults.plugins.legend.labels.padding = 14;
    Chart.defaults.plugins.legend.labels.font = { family: "'Inter', sans-serif", size: 12, weight: '500' };

    Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(8,5,26,0.96)';
    Chart.defaults.plugins.tooltip.borderColor = 'rgba(217,70,239,0.5)';
    Chart.defaults.plugins.tooltip.borderWidth = 1;
    Chart.defaults.plugins.tooltip.titleColor = '#fff';
    Chart.defaults.plugins.tooltip.bodyColor = 'rgba(245,243,255,0.9)';
    Chart.defaults.plugins.tooltip.titleFont = { family: "'JetBrains Mono', monospace", size: 12, weight: '600' };
    Chart.defaults.plugins.tooltip.bodyFont  = { family: "'Inter', sans-serif", size: 13 };
    Chart.defaults.plugins.tooltip.padding = 12;
    Chart.defaults.plugins.tooltip.cornerRadius = 8;
    Chart.defaults.plugins.tooltip.boxPadding = 6;
    Chart.defaults.plugins.tooltip.usePointStyle = true;

    Chart.defaults.animation.duration = 600;
    Chart.defaults.animation.easing = 'easeOutQuart';
}

export function axisStyle() {
    return {
        ticks: {
            color: 'rgba(245,243,255,0.62)',
            font: { family: "'JetBrains Mono', monospace", size: 11 }
        },
        grid:   { color: 'rgba(157,78,255,0.08)', drawTicks: false },
        border: { color: 'rgba(157,78,255,0.18)' }
    };
}

export function commonOptions(overrides = {}) {
    const base = {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        scales: {
            x: { ...axisStyle() },
            y: { beginAtZero: true, ...axisStyle() }
        }
    };
    return deepMerge(base, overrides);
}

function deepMerge(a, b) {
    if (Array.isArray(a) || Array.isArray(b)) return b ?? a;
    if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return b ?? a;
    const out = { ...a };
    for (const k of Object.keys(b)) {
        out[k] = (k in a) ? deepMerge(a[k], b[k]) : b[k];
    }
    return out;
}

/* ------------------------------------------------------------
   Sparkline — lightweight inline canvas line, no axes
   ------------------------------------------------------------ */
export function drawSparkline(canvas, values, opts = {}) {
    if (!canvas || !values || values.length === 0) return;
    const color    = opts.color    || '#b97cff';
    const fillSoft = opts.fillSoft || 'rgba(185,124,255,0.18)';
    const dpr  = window.devicePixelRatio || 1;
    const cssW = canvas.clientWidth  || canvas.width  || 120;
    const cssH = canvas.clientHeight || canvas.height || 28;
    canvas.width  = cssW * dpr;
    canvas.height = cssH * dpr;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = (max - min) || 1;
    const pad = 2;
    const stepX = values.length > 1 ? (cssW - pad * 2) / (values.length - 1) : 0;
    const yFor = v => cssH - pad - ((v - min) / range) * (cssH - pad * 2);

    // Filled area
    ctx.beginPath();
    ctx.moveTo(pad, cssH);
    values.forEach((v, i) => ctx.lineTo(pad + i * stepX, yFor(v)));
    ctx.lineTo(pad + (values.length - 1) * stepX, cssH);
    ctx.closePath();
    ctx.fillStyle = fillSoft;
    ctx.fill();

    // Line
    ctx.beginPath();
    values.forEach((v, i) => {
        const x = pad + i * stepX;
        const y = yFor(v);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = color;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // End dot
    if (values.length > 0) {
        const lastX = pad + (values.length - 1) * stepX;
        const lastY = yFor(values[values.length - 1]);
        ctx.beginPath();
        ctx.arc(lastX, lastY, 2.2, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
    }
}
