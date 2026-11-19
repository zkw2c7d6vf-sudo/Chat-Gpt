'use strict';
(() => {
  const widget = document.getElementById('quickCreate');
  const trigger = document.getElementById('createToggle');
  const actions = document.getElementById('createActions');
  const links = [...actions.querySelectorAll('a')];

  const favicons = new Map([
    ['docs.new', [
      'https://ssl.gstatic.com/docs/documents/images/kix-favicon-2023q4.ico',
      'https://drive-thirdparty.googleusercontent.com/32/type/application/vnd.google-apps.document',
    ]],
    ['slides.new', [
      'https://ssl.gstatic.com/docs/presentations/images/favicon-2023q4.ico',
      'https://drive-thirdparty.googleusercontent.com/32/type/application/vnd.google-apps.presentation',
    ]],
    ['www.canva.com', ['https://static.canva.com/static/images/favicon.ico']],
  ]);

  function loadFavicons() {
    for (const link of links) {
      if (link.querySelector('img')) continue;
      const urls = favicons.get(link.hostname);
      if (!urls) continue;
      const label = document.createElement('span');
      label.textContent = link.textContent;
      const icon = document.createElement('img');
      icon.alt = '';
      icon.hidden = true;
      icon.referrerPolicy = 'no-referrer';
      link.title = link.getAttribute('aria-label');
      let next = 0;
      icon.onload = () => { icon.hidden = false; label.hidden = false; };
      icon.onerror = () => { if (next < urls.length) icon.src = urls[next++]; };
      link.replaceChildren(label, icon);
      icon.src = urls[next++];
    }
  }

  trigger.append(MidnightIcons.make('plus'), 'New');
  if (trigger.getAttribute('aria-label') === 'Create') trigger.setAttribute('aria-label', 'New item');
  function setOpen(open) {
    if (widget.classList.contains('isOpen') === open) return;
    trigger.setAttribute('aria-expanded', String(open));
    actions.inert = !open;
    widget.classList.toggle('isOpen', open);
    if (open) loadFavicons();
  }
  trigger.onclick = () => setOpen(trigger.getAttribute('aria-expanded') !== 'true');
  trigger.addEventListener('keydown', event => {
    if (event.key !== 'ArrowDown') return;
    event.preventDefault();
    setOpen(true);
    links[0].focus();
  });
  actions.addEventListener('keydown', event => {
    const direction = {ArrowLeft: -1, ArrowRight: 1}[event.key];
    const index = links.indexOf(event.target);
    if (!direction || index < 0) return;
    event.preventDefault();
    links[(index + direction + links.length) % links.length].focus();
  });
  actions.addEventListener('click', event => {
    if (!event.target.closest('a')) return;
    setOpen(false);
    trigger.focus({preventScroll: true});
  });
  document.addEventListener('pointerdown', event => {
    if (!widget.contains(event.target)) setOpen(false);
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !widget.classList.contains('isOpen') || document.querySelector('dialog[open]')) return;
    event.preventDefault();
    setOpen(false);
    trigger.focus({preventScroll: true});
  });
  document.addEventListener('focusin', event => {
    if (!widget.contains(event.target)) setOpen(false);
  });
  window.addEventListener('midnight:dialogchange', () => setOpen(false));
})();
