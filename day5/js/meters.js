/* meters.js
   Quota meters read their value from the markup's ARIA attributes — the same
   numbers a screen reader gets — and colour the fill by how much is left.

   The fill carries severity, the track stays a lighter step of the same ramp,
   so the whole bar reads as one scale rather than a bar sitting on grey. */

const LOW = 0.25;   // a quarter of the quota left
const OUT = 0.10;   // a tenth

export function initMeters() {
  document.querySelectorAll('.meter .fi[role="meter"]').forEach((fill) => {
    const now = Number(fill.getAttribute('aria-valuenow'));
    const min = Number(fill.getAttribute('aria-valuemin') || 0);
    const max = Number(fill.getAttribute('aria-valuemax'));
    if (!Number.isFinite(now) || !Number.isFinite(max) || max === min) return;

    const ratio = (now - min) / (max - min);
    fill.style.width = `${(ratio * 100).toFixed(1)}%`;

    fill.classList.remove('low', 'out');
    // Credits count down, so a small remainder is the warning. Storage counts
    // up, so it is the opposite — the meter says which way it runs.
    const countsDown = fill.dataset.direction !== 'up';
    const headroom = countsDown ? ratio : 1 - ratio;
    if (headroom <= OUT) fill.classList.add('out');
    else if (headroom <= LOW) fill.classList.add('low');
  });
}
