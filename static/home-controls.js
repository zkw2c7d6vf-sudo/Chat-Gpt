'use strict';
(() => {
  const byId = id => document.getElementById(id);
  const shortcuts = [
    ['music', () => byId('musicMore').click()],
    ['weather', () => MidnightApp.openWeather()],
    ['nextEvent', () => {
      const event = byId('todayNextEvent').querySelector('.todayEvent');
      (event || byId('todayCalendar')).click();
    }],
  ];

  for (const [id, open] of shortcuts) {
    const widget = byId(id);
    widget.classList.add('widgetOpener');
    widget.addEventListener('click', event => {
      // A child action can replace its icon before this listener runs. The event
      // path retains that original button even when event.target is detached.
      const interactive='button, a, input, select, textarea, label, summary, [role="button"], [contenteditable]';
      if(event.defaultPrevented||(event.composedPath?.()||[event.target]).some(node=>node.matches?.(interactive)))return;
      if (window.getSelection()?.toString()) return;
      open();
    });
  }

  const due = document.createElement('button');
  due.type = 'button';
  due.className = 'homeDue agendaPreviewRow';
  due.hidden = true;
  const dueTime = document.createElement('span');
  dueTime.className = 'agendaWhen';
  const dueLabel = document.createElement('span');
  const dueDate = document.createElement('small');
  dueTime.append(dueLabel, dueDate);
  const dueText = document.createElement('span');
  dueText.className = 'agendaText';
  const dueTitle = document.createElement('strong');
  dueText.append(MidnightIcons.make('reminder'), dueTitle);
  due.append(dueTime, dueText);
  byId('todayNextEvent').after(due);

  let deadline;
  let deadlineRequest = 0;
  let lastDeadlineMinute = -1;

  function showDeadline(now = Date.now()) {
    due.hidden = !deadline || Date.parse(deadline.dueAt) - now > 7 * 86400000;
    if (!deadline) return;
    const date = new Date(deadline.dueAt);
    const delta = date.getTime() - now;
    const timeZone = MidnightApp.timezone();
    const day = new Intl.DateTimeFormat(undefined, {month: 'short', day: 'numeric', timeZone}).format(date);
    const time = new Intl.DateTimeFormat(undefined, {hour: 'numeric', minute: '2-digit', timeZone}).format(date);
    const when = day + ' · ' + time;
    due.dataset.urgent = String(delta <= 86400000);
    dueLabel.textContent = delta < 0 ? 'Overdue' : 'Due soon';
    dueDate.textContent = when;
    dueTitle.textContent = deadline.text;
    due.title = deadline.text + ' · ' + when;
  }

  async function refreshDeadline() {
    const request = ++deadlineRequest;
    try {
      const entries = await MidnightCapture.all();
      if (request !== deadlineRequest) return;
      const now = Date.now();
      deadline = entries.filter(item => !item.archived && !item.done &&
        ['task', 'reminder'].includes(item.kind) && Number.isFinite(Date.parse(item.dueAt)) && Date.parse(item.dueAt)<=now+7*86400000)
        .sort((a, b) => {
          const left = Date.parse(a.dueAt) - now, right = Date.parse(b.dueAt) - now;
          if ((left < 0) !== (right < 0)) return left < 0 ? 1 : -1;
          return left < 0 ? right - left : left - right;
        })[0];
      showDeadline();
    } catch {
      // Capture already reports storage errors through its own UI.
    }
  }

  due.onclick = () => { if (deadline) MidnightCapture.edit(deadline); };
  addEventListener('midnight:captures', refreshDeadline);
  addEventListener('midnight:tick', () => {
    const minute = Math.floor(Date.now() / 60000);
    if (minute === lastDeadlineMinute) return;
    lastDeadlineMinute = minute;
    showDeadline(minute * 60000);
  });
  refreshDeadline();

})();
