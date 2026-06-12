/* ---------------- UTIL ---------------- */
export const $ = id => document.getElementById(id);
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const rnd = (a, b) => a + Math.random() * (b - a);
export const ri = (a, b) => Math.floor(rnd(a, b + 1));
export const fmt = n => '$' + Math.round(n).toLocaleString('en-US');
export const dist2 = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
