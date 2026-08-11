/* composer.js
   The point of this control: state the price before the credit is spent.
   Picking a target fills in the estimate beside Send; until then Send is
   disabled, because a run with no target has no cost to quote. */

import { RUNNABLE, credits } from './data.js';

export function initComposer() {
  const trigger = document.getElementById('selBtn');
  const caret = document.getElementById('selCaret');
  const label = document.getElementById('selTxt');
  const menu = document.getElementById('selMenu');
  const estimate = document.getElementById('est');
  const textarea = document.querySelector('.composer .ta');
  const send = document.querySelector('.composer .send');
  if (!trigger || !menu) return;

  let picked = null;

  menu.innerHTML = RUNNABLE.map((r, i) => `
    <button role="option" data-index="${i}">
      <span class="k">${r.kind}</span>
      <span class="n">${r.name}</span>
      <span class="c">${credits(r.cost)}</span>
    </button>`).join('');

  function renderEstimate() {
    if (!picked) {
      estimate.hidden = true;
      send.disabled = true;
      send.title = 'Choose an agent or workflow first';
      return;
    }
    estimate.hidden = false;
    send.disabled = false;
    send.title = 'Send';
    estimate.textContent = `≈ ${credits(picked.cost)} credits`;
  }

  const setOpen = (open) => {
    menu.hidden = !open;
    trigger.setAttribute('aria-expanded', String(open));
  };

  const toggle = (e) => { e.stopPropagation(); setOpen(menu.hidden); };
  trigger.addEventListener('click', toggle);
  caret.addEventListener('click', toggle);
  document.addEventListener('click', () => setOpen(false));

  menu.addEventListener('click', (e) => {
    const option = e.target.closest('button[data-index]');
    if (!option) return;
    picked = RUNNABLE[Number(option.dataset.index)];
    label.textContent = picked.name;
    trigger.classList.add('has');
    setOpen(false);
    renderEstimate();
    textarea.focus();
  });

  renderEstimate();
}
