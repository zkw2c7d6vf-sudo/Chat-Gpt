'use strict';
(() => {
  const byId = id => document.getElementById(id);
  const dialog = byId('driveDialog');
  const list = byId('driveRecent');
  const tiles = byId('driveTiles');
  const configure = byId('driveTilesConnect');
  const status = byId('driveStatus');
  const setup = byId('driveSetup');
  const recovery = byId('driveRecovery');
  function clearError() { dialog.dataset.state = 'loading'; recovery.hidden = true; recovery.textContent = ''; refresh.textContent = 'Refresh'; }
  function showError(error, action = 'load') {
    dialog.dataset.state = 'error';
    const auth = [401, 403].includes(error.status);
    status.textContent = auth ? 'Drive needs your attention' : 'Drive is unavailable';
    recovery.textContent = auth ? 'Your connection may have expired, or Google needs permission. Check your setup below, then reconnect.' : 'We couldn’t load your recent files. Check your connection and try again.';
    recovery.hidden = false;
    recovery.textContent+=' '+(error.message||'');
    if (action !== 'load') {
      status.textContent = action === 'connect' ? 'Couldn’t connect Drive' : 'Couldn’t disconnect Drive';
      recovery.textContent = error.message || 'Please try again.';
    }
    refresh.textContent = 'Try again';
  }
  const disconnect = byId('driveDisconnect');
  const refresh = byId('driveRefresh');
  const form = byId('driveConnect');
  const typeNames = {
    'application/vnd.google-apps.document': 'Doc',
    'application/vnd.google-apps.spreadsheet': 'Sheet',
    'application/vnd.google-apps.presentation': 'Slide deck',
    'application/pdf': 'PDF',
  };

  const typeIcons = {
    'application/vnd.google-apps.document': 'document',
    'application/vnd.google-apps.spreadsheet': 'spreadsheet',
    'application/vnd.google-apps.presentation': 'slides',
    'application/pdf': 'pdf',
  };

  function linkFor(file, compact = false) {
    const link = document.createElement('a');
    link.href = file.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.title = file.name;
    const name = document.createElement('span');
    name.className = 'driveFileName';
    name.textContent = file.name;
    const kind = document.createElement('small');
    kind.textContent = typeNames[file.mimeType] || 'File';
    if (compact) {
      link.setAttribute('aria-label', file.name + ', ' + kind.textContent);
      link.append(MidnightIcons.make(typeIcons[file.mimeType] || 'file'), name);
    } else link.append(name, kind);
    return link;
  }

  let snapshot=[];window.MidnightDrive={snapshot:()=>snapshot.map(file=>({...file}))};
  function render(files) {
    snapshot=files.slice(0,3);window.dispatchEvent(new Event('midnight:drive'));
    const recent = files.slice(0, 3);
    const rows = recent.map(file => {
      const item = document.createElement('li');
      item.append(linkFor(file));
      return item;
    });
    list.replaceChildren(...rows);
    tiles.replaceChildren(...recent.map(file => linkFor(file, true)));
    tiles.hidden = recent.length === 0;
  }

  let requestVersion = 0;
  let lastLoad = 0;
  async function load(force = false) {
    const version = ++requestVersion;
    refresh.disabled = true;
    clearError();
    status.textContent = 'Loading recent files…';
    list.setAttribute('aria-busy', 'true');
    lastLoad = Date.now();
    try {
      const data = await MidnightApp.request('drive/recent' + (force ? '?refresh=true' : ''));
      if (version !== requestVersion) return;
      dialog.dataset.state = data.connected ? 'connected' : 'disconnected';
      render(data.files);
      setup.hidden = data.connected;
      configure.hidden = data.connected && data.files.length > 0;
      configure.disabled = data.connected && !data.files.length;
      configure.textContent = data.connected ? 'No recent Drive files' : 'Connect Drive';
      disconnect.hidden = !data.connected;
      status.textContent = data.connected
        ? data.files.length ? '' : 'No recently opened files found.'
        : 'Connect Drive to show your recent files.';
    } catch (error) {
      if (version !== requestVersion) return;
      setup.hidden = ![401, 403].includes(error.status);
      render([]);
      configure.hidden = false;
      configure.disabled = false;
      configure.textContent = setup.hidden ? 'Drive unavailable · Retry' : 'Reconnect Drive';
      showError(error);
    } finally {
      if (version === requestVersion) { refresh.disabled = false; list.setAttribute('aria-busy', 'false'); }
    }
  }

  function openDrive() {
    MidnightUI.open(dialog);
    load();
  }
  byId('driveOpen').onclick = openDrive;
  configure.onclick = openDrive;
  byId('driveClose').replaceChildren(MidnightIcons.make('close'));
  byId('driveClose').onclick = () => MidnightUI.close(dialog);
  refresh.onclick = () => load(true);
  byId('driveReconnect').onclick=async()=>{try{const data=await MidnightApp.request('drive/reconnect',{method:'POST'});location.assign(data.url);}catch(error){showError(error,'connect');}};
  form.onsubmit = async event => {
    event.preventDefault();
    const submit = byId('driveConnectSubmit');
    submit.disabled = true;
    try {
      const data = await MidnightApp.request('drive/connect', {
        method: 'POST',
        body: JSON.stringify({
          client_id: byId('driveClientId').value,
          client_secret: byId('driveClientSecret').value,
        }),
      });
      location.assign(data.url);
    } catch (error) {
      showError(error, 'connect');
      submit.disabled = false;
    }
  };
  disconnect.onclick = async () => {
    requestVersion++;
    disconnect.disabled = true;
    try {
      await MidnightApp.request('drive/disconnect', {method: 'POST'});
      render([]);
      clearError();
      dialog.dataset.state = 'disconnected';
      setup.hidden = false;
      configure.hidden = false;
      configure.disabled = false;
      configure.textContent = 'Connect Drive';
      disconnect.hidden = true;
      form.reset();
      status.textContent = 'Drive disconnected.';
    } catch (error) {
      showError(error, 'disconnect');
    } finally {
      disconnect.disabled = false;
      refresh.disabled = false;
    }
  };
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && Date.now() - lastLoad >= 60000) load();
  });
  if (['#drive-connected', '#drive-denied'].includes(location.hash)) {
    const denied = location.hash === '#drive-denied';
    history.replaceState(null, '', location.pathname + location.search);
    openDrive();
    byId('driveAuthStatus').textContent = denied ? 'Google sign-in didn’t finish. Check your OAuth setup and try again.' : 'Google Drive connected.';
  } else {
    load();
  }
})();
