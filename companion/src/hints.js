import { computePosition, offset, flip, shift, autoUpdate } from '@floating-ui/dom';
export function installHints() {
  const tip = document.createElement('div'); tip.id = 'desktop-tooltip'; tip.className = 'desktop-tooltip'; tip.role = 'tooltip'; tip.hidden = true; document.body.append(tip);
  let active, cleanup, sequence = 0;
  function hide() { sequence++; cleanup?.(); cleanup = null; active?.removeAttribute('aria-describedby'); active = null; tip.hidden = true; }
  function show(element) {
    if (active === element) return;
    hide(); const label = element.getAttribute('aria-label') || element.getAttribute('title'); if (!label) return;
    active = element; tip.textContent = label; tip.hidden = false; element.setAttribute('aria-describedby', tip.id); const current = sequence;
    cleanup = autoUpdate(element, tip, async () => {
      const { x, y } = await computePosition(element, tip, { strategy: 'fixed', placement: 'bottom', middleware: [offset(8), flip(), shift({ padding: 10 })] });
      if (sequence === current) { tip.style.left = `${x}px`; tip.style.top = `${y}px`; }
    });
  }
  const anchor = target => target.closest('button.icon,button[data-account-refresh]');
  document.addEventListener('pointerover', e => { const button = anchor(e.target); if (button) show(button); });
  document.addEventListener('pointerout', e => { if (active && !active.contains(e.relatedTarget)) hide(); });
  document.addEventListener('focusin', e => { const button = anchor(e.target); if (button) show(button); });
  document.addEventListener('focusout', hide);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') hide(); });
}
