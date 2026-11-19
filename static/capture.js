/* Instant Capture is deliberately independent of network integrations and bootstrap. */
'use strict';
(() => {
  const byId = id => document.getElementById(id);
  const dialog = byId('captureDialog'), inbox = byId('inboxDialog'), text = byId('captureText');
  const kinds = ['note','task','idea','reminder'];
  let store, records = [], kind = 'note', editing = null, draftId = 'new', filter = 'inbox';
  let shift = false, symbols = false, keyboard = true, saving = false, draftQueue = Promise.resolve();
  let recognition = null, voiceSession = 0, voiceFailed = false, voiceBusy = false;
  let voiceInstallReady = false, skipCloseDraft = false, draftRevision = 0;
  let recordsRevision = 0, loadedRevision = -1, recordsRead = null;
  const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel('midnight-capture') : null;
  const message = value => { byId('captureMessage').textContent = value; };
  const voiceState = value => { byId('captureVoiceState').textContent = value; };
  function node(tag, cls, value) { const el = document.createElement(tag); el.className = cls || ''; if (value !== undefined) el.textContent = value; return el; }
  function button(label, action, cls='smallButton') { const el=node('button',cls,label); el.type='button'; el.onclick=action; return el; }
  function fail(error) { byId('captureDraftState').textContent='Your text is still here'; message('Could not save locally. Your text is still here. '+(error?.message || 'Check available browser storage.')); }
  function setKind(next) {
    kind = kinds.includes(next) ? next : 'note';
    byId('captureTypes').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.kind===kind)));
    byId('captureDueLabel').hidden = !['task','reminder'].includes(kind);
    byId('captureDueText').textContent=kind==='task'?'Due date · optional · this computer’s time':'Remind me · this computer’s time';
    byId('captureDue').required = kind === 'reminder';
  }
  function snapshot() { return {id:draftId,text:text.value,kind,due:byId('captureDue').value,updatedAt:new Date().toISOString()}; }
  let pendingDraft=null,draftWriting=false;
  function keepDraft() {
    const draft=snapshot(), revision=++draftRevision; pendingDraft=draft;
    byId('captureDraftState').textContent='Saving draft…';
    // Serialize snapshots so a slower old write can never replace a newer draft.
    if(!draftWriting){draftWriting=true;draftQueue=(async()=>{try{while(pendingDraft){const next=pendingDraft;pendingDraft=null;await store.saveDraft(next);}}finally{draftWriting=false;}})();}
    draftQueue.then(()=>{ if (revision===draftRevision) byId('captureDraftState').textContent=draft.text ? 'Draft saved in this browser' : 'Stored in this browser'; }).catch(fail);
    return draftQueue;
  }
  function readRecords() {
    if (loadedRevision===recordsRevision) return Promise.resolve(records);
    if (!recordsRead) recordsRead=(async()=>{
      // A committed edit arriving during a read requires a fresh snapshot.
      while (loadedRevision!==recordsRevision) {
        const revision=recordsRevision,next=await store.all();
        if (revision!==recordsRevision) continue;
        records=next.sort((a,b)=>b.createdAt.localeCompare(a.createdAt));loadedRevision=revision;
      }
      return records;
    })().finally(()=>{recordsRead=null;});
    return recordsRead.then(()=>loadedRevision===recordsRevision ? records : readRecords());
  }
  let reminderSignature='';
  function refreshReminders(render=true) {
    const due=records.filter(r=>!r.archived&&!r.done&&r.kind==='reminder'&&r.dueAt&&Date.parse(r.dueAt)<=Date.now());
    const signature=JSON.stringify(due.map(r=>[r.id,r.text,r.dueAt]));
    if (signature===reminderSignature) return;
    reminderSignature=signature;MidnightNotifications.reminders(due,openReminders);
    if (render&&inbox.open) renderInbox();
  }
  async function refresh() {
    recordsRevision++;
    await readRecords();
    const savedCount=records.filter(r=>!r.archived&&!r.done).length;byId('captureCount').hidden=!savedCount;byId('captureCount').textContent=savedCount>99?'99+':String(savedCount);byId('inboxOpen').title='Inbox · '+savedCount+' saved item'+(savedCount===1?'':'s');byId('inboxOpen').setAttribute('aria-label','Inbox, '+savedCount+' saved item'+(savedCount===1?'':'s'));
    refreshReminders(false);
    if (inbox.open) renderInbox();
    window.dispatchEvent(new Event('midnight:captures'));
  }
  async function changed() { await refresh(); channel?.postMessage('updated'); }
  async function openCapture(item=null,options={}) {
    if (saving) return;
    try {
      await store.ready;
      await draftQueue.catch(()=>{});
      editing=item; draftId=item ? item.id : 'new';
      const draft=await store.draft(draftId);
      const value=draft || (item ? {text:item.text,kind:item.kind,due:item.dueAt ? localDate(item.dueAt) : ''} : {});
      text.value=value.text || ''; byId('captureDue').value=value.due || ''; setKind(options.kind || value.kind); 
      byId('captureTitle').textContent=item ? 'Edit capture' : 'Quick Capture';
      message(''); byId('captureDraftState').textContent=draft?.text ? 'Draft restored from this browser' : 'Stored in this browser';
      dialog.scrollTop=0;
      window.dispatchEvent(new Event('midnight:captureopen'));
      MidnightUI.open(dialog); text.focus(); text.setSelectionRange(text.value.length,text.value.length);
    } catch(e) { byId('inboxStatus').textContent='Local storage unavailable. '+e.message; message('Local storage unavailable. '+e.message); if (!dialog.open) MidnightUI.open(dialog); }
  }
  function localDate(iso) { const d=new Date(iso); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; }
  const activeInput=()=>window.MidnightCommand?.mode==='search' ? byId('commandQuery') : text;
  function inputChanged(field){ if(field===text){keepDraft();suggestCapture();}else field.dispatchEvent(new Event('input',{bubbles:true})); }
  function insert(value) {
    if (saving) return;
    const field=activeInput(),start=field.selectionStart ?? field.value.length,end=field.selectionEnd ?? field.value.length;
    if (field.value.length-(end-start)+value.length>20000) { message('Capture limit is 20,000 characters. Save this and start another.'); return; }
    field.setRangeText(value,start,end,'end'); field.focus(); inputChanged(field);
  }
  function keyboardRender() {
    const target=byId('captureKeyboard'),focusedKey=target.contains(document.activeElement)?document.activeElement.textContent.toLocaleLowerCase():null; target.replaceChildren();
    const rows=symbols ? ['1234567890','@#$%&*()[]','.,?!:;\'"/+-='] : ['qwertyuiop','asdfghjkl','zxcvbnm'];
    rows.forEach(row=>{
      const line=node('div','keyRow');
      for (const char of row) {
        const value=shift ? char.toUpperCase() : char;
        line.append(button(value,()=>{insert(value); if (shift) { shift=false; keyboardRender(); }},'touchKey'));
      }
      target.append(line);
    });
    const controls=node('div','keyRow');
    const shiftButton=button('Shift',()=>{shift=!shift;keyboardRender();},'touchKey modifier'); shiftButton.setAttribute('aria-pressed',String(shift));
    const backspace=button('⌫',()=>{
      const field=activeInput();
      const start=field.selectionStart,end=field.selectionEnd;
      if (start===end&&start>0) {
        // Remove a grapheme (emoji and combining marks included), not half a surrogate.
        const prefix=field.value.slice(0,start);
        const parts=typeof Intl.Segmenter==='function' ? [...new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(prefix)].map(s=>s.segment) : Array.from(prefix);
        field.setRangeText('',start-(parts.pop()?.length || 0),end,'end');
      } else field.setRangeText('',start,end,'end');
      field.focus(); inputChanged(field);
    },'touchKey modifier'); backspace.setAttribute('aria-label','Backspace');
    controls.append(shiftButton,button(symbols ? 'ABC' : '123',()=>{symbols=!symbols;keyboardRender();},'touchKey modifier'),button('Space',()=>insert(' '),'touchKey spaceKey'),button('↵',()=>{const field=activeInput();if(field===text)insert('\n');else field.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));},'touchKey modifier'),backspace);
    target.append(controls);
    // Keep the textarea's selection while tapping keys. Keyboard users still use Tab/Enter.
    target.querySelectorAll('button').forEach(b=>b.onpointerdown=e=>e.preventDefault());
    if(focusedKey)[...target.querySelectorAll('button')].find(b=>b.textContent.toLocaleLowerCase()===focusedKey)?.focus({preventScroll:true});
  }
  function stopVoice(abort=false) {
    if (!abort && recognition) {
      voiceState('Finishing dictation…'); byId('captureMic').disabled=true;
      try { recognition.stop(); return; } catch {}
    }
    voiceSession++;
    const old=recognition; recognition=null; voiceBusy=false;
    try { if (old) abort ? old.abort() : old.stop(); } catch {}
    byId('captureMic').disabled=false; byId('captureMic').textContent='Dictate'; byId('captureMic').setAttribute('aria-pressed','false');
    byId('captureInterim').textContent='';
    if (old) voiceState('Microphone off. Dictation stopped.');
  }
  const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
  const localVoice=Speech && 'processLocally' in Speech.prototype && typeof Speech.available==='function';
  async function dictate() {
    if (recognition || voiceBusy) { stopVoice(!recognition); return; }
    if (!localVoice) { voiceState('On-device dictation is unavailable in this browser. Use your system’s dictation key or the touch keyboard.'); return; }
    const session=++voiceSession;
    voiceBusy=true; byId('captureMic').textContent='Cancel voice';
    voiceState('Checking the on-device English voice pack…');
    try {
      const available=await Speech.available({langs:['en-US'],processLocally:true});
      if (session!==voiceSession || !dialog.open) return;
      if (available!=='available') {
        voiceInstallReady=available==='downloadable';
        byId('captureVoiceInstall').hidden=!voiceInstallReady;
        voiceState(voiceInstallReady ? 'One-time setup: download the free English voice pack, then tap Dictate. Internet is needed for the download.' : available==='downloading' ? 'Voice pack is downloading. Try Dictate when the download finishes.' : 'English on-device dictation is unavailable. Use the keyboard or system dictation.');
        voiceBusy=false; byId('captureMic').textContent='Dictate'; return;
      }
      const rec=new Speech(); recognition=rec; rec.lang='en-US'; rec.processLocally=true; rec.continuous=true; rec.interimResults=true; voiceFailed=false;
      byId('captureVoiceInstall').hidden=true;
      voiceState('Waiting for microphone permission. Allow it in your browser to dictate.');
      rec.onstart=()=>{ if (session!==voiceSession) return; voiceState('Listening on this device · tap Stop when finished.'); byId('captureMic').textContent='Stop dictation'; byId('captureMic').setAttribute('aria-pressed','true'); };
      rec.onresult=e=>{
        if (session!==voiceSession || !dialog.open) return;
        let interim='';
        for (let i=e.resultIndex;i<e.results.length;i++) {
          if (e.results[i].isFinal) { const words=e.results[i][0].transcript.trim(); if (words) insert((text.selectionStart>0&&!/\s/.test(text.value[text.selectionStart-1]) ? ' ' : '')+words); }
          else interim+=e.results[i][0].transcript;
        }
        byId('captureInterim').textContent=interim;
      };
      rec.onerror=e=>{
        if (session!==voiceSession) return;
        voiceFailed=true;
        const states={'not-allowed':'Microphone permission denied. Allow microphone access in browser settings, then try Dictate again.','service-not-allowed':'On-device speech access is blocked by this browser. Use the keyboard or system dictation.','audio-capture':'No microphone available. Connect or enable a microphone, then try again.','no-speech':'No speech heard. Tap Dictate to try again.','network':'Voice service unavailable. On-device mode remains enabled; use the keyboard.','language-not-supported':'English voice pack unavailable. Try downloading it again.','aborted':'Microphone off. Dictation cancelled.'};
        voiceState(states[e.error] || 'Dictation failed. Your text is safe; try again or use the keyboard.');
      };
      rec.onend=()=>{
        if (session!==voiceSession) return;
        recognition=null; voiceBusy=false; byId('captureMic').disabled=false; byId('captureMic').textContent='Dictate'; byId('captureMic').setAttribute('aria-pressed','false'); byId('captureInterim').textContent='';
        if (!voiceFailed) voiceState('Microphone off. Tap Dictate to continue.');
      };
      rec.start();
    } catch(e) {
      if (session!==voiceSession) return;
      stopVoice(true); voiceState('Could not start on-device dictation. Check browser microphone permissions or use the keyboard.');
    }
  }
  async function installVoice() {
    if (!voiceInstallReady || typeof Speech?.install!=='function') return;
    byId('captureVoiceInstall').disabled=true;
    voiceState('Downloading the free English voice pack. This needs internet once.');
    try { const ok=await Speech.install({langs:['en-US']}); voiceState(ok ? 'Voice pack ready. Tap Dictate to allow microphone access.' : 'Voice pack download failed. Check internet and try again.'); if (ok) byId('captureVoiceInstall').hidden=true; }
    catch { voiceState('Voice pack download unavailable. Use the keyboard or system dictation.'); }
    finally { byId('captureVoiceInstall').disabled=false; }
  }
  async function save(e) {
    e.preventDefault(); if (saving) return;
    if (!text.value.trim()) { message('Add some text first.'); text.focus(); return; }
    const due=byId('captureDue').value;
    if (kind==='reminder'&&(!due||!Number.isFinite(new Date(due).getTime()))) { message('Choose a reminder date and time.'); byId('captureDue').focus(); return; }
    stopVoice(true); saving=true; byId('captureForm').inert=true; byId('captureSave').disabled=true; message('Saving on this browser…');
    const now=new Date().toISOString();
    const item={...(editing || {}),id:editing?.id || crypto.randomUUID(),text:text.value.trim(),kind,dueAt:['task','reminder'].includes(kind)&&due ? new Date(due).toISOString() : null,createdAt:editing?.createdAt || now,updatedAt:now,archived:editing?.archived || false,done:editing?.done || false};
    if(editing?.dueAt&&due===localDate(editing.dueAt)&&['task','reminder'].includes(kind))item.dueAt=editing.dueAt;
    if(!['task','reminder'].includes(kind))Object.assign(item,{done:false,completedAt:null,plannedFor:null,priorityOrder:0});
    try {
      await draftQueue.catch(()=>{}); await store.save(item,draftId,editing);
      text.value=''; skipCloseDraft=true; MidnightUI.close(dialog); await changed();
      byId('inboxStatus').textContent='Saved on this browser.';
      if (typeof toast==='function') toast('Saved to your inbox.');
    } catch(e) { fail(e); }
    finally { saving=false; byId('captureForm').inert=false; byId('captureSave').disabled=false; }
  }
  async function update(id,changes) { try { if('done' in changes)changes={...changes,completedAt:changes.done?new Date().toISOString():null};await store.update(id,changes); await changed();return true; } catch(e) { byId('inboxStatus').textContent='Could not update. '+e.message;window.MidnightApp?.toast('Could not save this change. '+e.message,true);return false; } }
  async function copyForChatGPT(item) {
    const content=`Midnight quick capture · ${item.kind}\n${item.text}${item.dueAt ? '\nDue: '+new Date(item.dueAt).toLocaleString() : ''}`;
    try {
      await navigator.clipboard.writeText(content);
      byId('inboxStatus').textContent='Copied. Open Quick Capture, paste, and send. Nothing has been sent yet.';
    } catch {
      byId('inboxStatus').textContent='Clipboard unavailable. Select and copy the capture text below, then paste it into Quick Capture.';
    }
  }
  let inboxLimit=100;
  function renderInbox() {
    const query=byId('captureSearch').value.toLocaleLowerCase().trim();
    const visible=records.filter(r=>(filter==='archive' ? r.archived : !r.archived && (filter==='inbox' || r.kind===filter)) && r.text.toLocaleLowerCase().includes(query));
    byId('captureSearchClear').hidden=!byId('captureSearch').value;
    const target=byId('captureItems'),restoreFocus=MidnightUI.rememberListFocus(target); target.replaceChildren();
    if (!visible.length) target.append(node('p','empty',query ? 'No matching captures.' : filter==='archive' ? 'Your archive is empty.' : 'Space for whatever comes next. Tap Capture to start.'));
    for (const item of visible.slice(0,inboxLimit)) {
      const row=node('article','captureItem'+(item.done ? ' captureDone' : ''));
      const due=item.kind==='reminder'&&item.dueAt&&!item.done&&Date.parse(item.dueAt)<=Date.now();
      const meta=node('p','captureItemMeta',`${item.kind[0].toUpperCase()+item.kind.slice(1)} · ${new Date(item.createdAt).toLocaleDateString()}${item.dueAt ? ' · '+(due || item.kind==='task' ? 'Due: ' : 'Remind: ')+new Date(item.dueAt).toLocaleString() : ''}`);
      if (due) meta.classList.add('captureOverdue');
      const body=node('div','captureItemBody');
      body.append(meta,node('p','captureCopy',item.text));
      if (['task','reminder'].includes(item.kind)) {
        const done=button(item.done ? '✓' : '',()=>update(item.id,{done:!item.done}),'captureTaskToggle');
        if(item.done)done.replaceChildren(MidnightIcons.make('check'));done.setAttribute('aria-label',(item.done ? 'Reopen' : 'Mark done')+': '+item.text.slice(0,100)); done.setAttribute('aria-pressed',String(item.done)); row.append(done); row.classList.add('hasTaskToggle');
      }
      row.append(body);
      const actions=node('div','captureActions');
      actions.append(button('Edit',()=>openCapture(item)),button('Copy for ChatGPT',()=>copyForChatGPT(item)),button(item.archived ? 'Restore' : 'Archive',()=>update(item.id,{archived:!item.archived})));
      actions.querySelectorAll('button').forEach(b=>b.setAttribute('aria-label',b.textContent+': '+item.text.slice(0,100)));
      row.dataset.itemId=item.id; body.append(actions); target.append(row);
    }
    if(visible.length>inboxLimit)target.append(button('Show 100 more ('+(visible.length-inboxLimit)+' remaining)',()=>{inboxLimit+=100;renderInbox();}));
    restoreFocus();
  }
    // Pagination keeps long collections responsive and leaves all matches reachable.
  async function openInbox() { MidnightUI.open(inbox); byId('inboxStatus').textContent=''; try { await refresh(); } catch(e) { byId('inboxStatus').textContent='Could not read local captures. '+e.message; } }
  async function exportBackup() {
    try {
      const data=await store.all(), drafts=await store.drafts();
      const blob=new Blob([JSON.stringify({format:'midnight-capture',version:2,exportedAt:new Date().toISOString(),items:data,drafts},null,2)],{type:'application/json'});
      const url=URL.createObjectURL(blob),a=node('a'); a.href=url; a.download='midnight-captures-'+new Date().toISOString().slice(0,10)+'.json'; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
      byId('inboxStatus').textContent='Backup exported. Keep it somewhere safe.';
    } catch(e) { byId('inboxStatus').textContent='Could not export. '+e.message; }
  }
  let restoreData=null,restoreGeneration=0,restoring=false;
  byId('captureRestore').onclick=()=>{byId('restorePanel').hidden=false;byId('restoreFile').focus();};
  byId('restoreCancel').onclick=()=>{if(restoring)return;restoreGeneration++;restoreData=null;byId('restorePanel').hidden=true;byId('restoreFile').value='';byId('restoreConfirm').disabled=true;};
  byId('restoreFile').onchange=async()=>{
    const token=++restoreGeneration;restoreData=null;byId('restoreConfirm').disabled=true;
    try{
      const file=byId('restoreFile').files[0];if(!file)return;
      const data=MidnightTodayCore.validateBackup(JSON.parse(await file.text()));if(token!==restoreGeneration)return;
      const existing=new Set((await store.all()).map(i=>i.id));if(token!==restoreGeneration)return;
      const added=data.items.filter(i=>!existing.has(i.id)).length;
      byId('restorePreview').textContent=`Ready: ${added} new captures; ${data.items.length-added} existing captures will be kept. ${data.drafts.length} saved drafts will be merged without replacing current drafts.`;
      restoreData=data;byId('restoreConfirm').disabled=false;
    }catch(e){if(token===restoreGeneration)byId('restorePreview').textContent='Could not read backup. '+e.message;}
  };
  byId('restoreConfirm').onclick=async()=>{
    if(!restoreData||restoring)return;restoring=true;byId('restoreConfirm').disabled=true;byId('restoreFile').disabled=true;byId('restoreCancel').disabled=true;
    try{await draftQueue;const result=await store.mergeBackup(restoreData.items,restoreData.drafts);await changed();byId('restorePreview').textContent=`Restored ${result.added} captures; kept ${result.skipped} existing captures.${result.draftRestored?' Saved draft restored.':''}`;restoreData=null;}
    catch(e){byId('restorePreview').textContent='Could not restore. '+e.message;byId('restoreConfirm').disabled=false;}
    finally{restoring=false;byId('restoreFile').disabled=false;byId('restoreCancel').disabled=false;}
  };
  byId('captureOpen').onclick=()=>openCapture(); byId('inboxCapture').onclick=()=>openCapture();
  byId('inboxOpen').onclick=openInbox; byId('inboxClose').onclick=()=>MidnightUI.close(inbox);
  function openReminders(){filter='reminder';byId('inboxFilters').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.filter===filter)));return openInbox();}
  byId('captureClose').onclick=()=>{if (!saving) MidnightUI.close(dialog);};
  dialog.addEventListener('cancel',e=>{if (saving) e.preventDefault();});
  dialog.addEventListener('close',()=>{stopVoice(true); if (skipCloseDraft) {skipCloseDraft=false;return;} if (!saving) keepDraft();});
  document.addEventListener('visibilitychange',()=>{ if (document.hidden) stopVoice(true); else refresh().catch(()=>{}); });
  window.addEventListener('pagehide',()=>stopVoice(true));
  window.addEventListener('midnight:captures-invalidated',()=>{recordsRevision++;});
  byId('captureTypes').onclick=e=>{ const b=e.target.closest('[data-kind]'); if (b&&!saving) {setKind(b.dataset.kind);keepDraft();} };
  text.oninput=()=>{message('');keepDraft();suggestCapture();}; byId('captureDue').oninput=keepDraft;
  let keyboardPreference='auto';
  function applyKeyboard() {
    const show=keyboardPreference!=='system'&&keyboard;
    byId('captureKeyboard').hidden=!show; text.inputMode=show ? 'none' : 'text';
    byId('commandQuery').inputMode=show&&window.MidnightCommand?.mode==='search'?'none':'text';
    byId('captureKeyboardToggle').textContent=show ? 'Hide keyboard' : 'Touch keyboard';
    byId('captureKeyboardToggle').setAttribute('aria-expanded',String(show));
    byId('commandKeyboardToggle').setAttribute('aria-pressed',String(show));
    byId('captureKeyboardToggle').disabled=keyboardPreference==='system'; byId('commandKeyboardToggle').disabled=keyboardPreference==='system';
  }
  try { keyboardPreference=localStorage.getItem('midnight-keyboard-preference') || 'auto'; const saved=localStorage.getItem('midnight-touch-keyboard'); keyboard=saved?saved!=='hidden':keyboardPreference==='touch'||(keyboardPreference==='auto'&&matchMedia('(any-pointer:coarse)').matches&&innerHeight>=650); } catch {}
  byId('virtualKeyboardSetting').value=keyboardPreference;
  byId('virtualKeyboardSetting').onchange=e=>{const chosen=e.target.value;try{localStorage.setItem('midnight-keyboard-preference',chosen);keyboardPreference=chosen;keyboard=chosen==='touch'||chosen==='auto'&&matchMedia('(any-pointer:coarse)').matches;localStorage.setItem('midnight-touch-keyboard',keyboard?'shown':'hidden');applyKeyboard();}catch{message('Keyboard preference could not be saved.');}};
  function toggleKeyboard(){keyboard=!keyboard;try{localStorage.setItem('midnight-touch-keyboard',keyboard?'shown':'hidden');}catch{}applyKeyboard();activeInput().focus();}
  byId('captureKeyboardToggle').onclick=toggleKeyboard;byId('commandKeyboardToggle').onclick=toggleKeyboard;
  applyKeyboard();
  let proposal=null;
  function suggestCapture(){proposal=MidnightCommandCore.parseCapture(text.value);const visible=proposal&&(proposal.kind!==kind||proposal.due&&!byId('captureDue').value);byId('captureProposal').hidden=!visible;if(visible)byId('captureProposalText').textContent='Suggested: '+proposal.kind+(proposal.due?' · '+new Date(proposal.due).toLocaleString():proposal.needsDate?' · choose a date':'')+'. Review before saving.';}
  byId('captureProposalApply').onclick=()=>{if(!proposal)return;setKind(proposal.kind);if(proposal.due)byId('captureDue').value=proposal.due;keepDraft();byId('captureProposal').hidden=true;};
  window.addEventListener('midnight:captureopen',()=>{byId('captureProposal').hidden=true;applyKeyboard();});
  window.MidnightCapture={importTasks:async items=>{await store.ready;const result=await store.importTasks(items);await changed();return result;},title:()=>editing?'Edit capture':'Quick Capture',open:openCapture,openInbox,edit:openCapture,update,all:async()=>{await store.ready;return (await readRecords()).map(item=>({...item}));},ready:()=>store.ready,flush:()=>draftQueue,stopVoice:()=>stopVoice(true),applyKeyboard,isSaving:()=>saving};
  byId('captureMic').onclick=dictate; byId('captureVoiceInstall').onclick=installVoice;
  byId('captureForm').onsubmit=save;
  byId('inboxFilters').onclick=e=>{const b=e.target.closest('[data-filter]');if (b) {filter=b.dataset.filter;byId('inboxFilters').querySelectorAll('button').forEach(el=>el.setAttribute('aria-pressed',String(el===b)));renderInbox();}};
  byId('captureSearchClear').onclick=()=>{byId('captureSearch').value='';renderInbox();byId('captureSearch').focus();};
  byId('captureSearch').oninput=renderInbox; byId('captureExport').onclick=exportBackup;
  document.addEventListener('keydown',e=>{
    if ((e.metaKey||e.ctrlKey||e.altKey)&&e.shiftKey&&e.code==='KeyK') {e.preventDefault();if(dialog.open&&window.MidnightCommand?.mode==='search')MidnightCommand.openCapture();else openCapture(editing);}
    if ((e.ctrlKey||e.metaKey)&&e.key==='Enter'&&dialog.open&&window.MidnightCommand?.mode!=='search') {e.preventDefault();byId('captureForm').requestSubmit();}
  });
  keyboardRender();
  if (!localVoice) voiceState('On-device dictation is unavailable here. Use the keyboard or your system’s dictation key.');
  try {
    store=new MidnightCaptureStore();
    store.ready.then(refresh).catch(e=>{byId('inboxStatus').textContent='Local storage unavailable. '+e.message;});
    if (channel) channel.onmessage=()=>refresh().catch(()=>{});
    setInterval(()=>{if(document.hidden)return;if(channel)refreshReminders();else refresh().catch(()=>{});},30000);
  } catch(e) { byId('inboxStatus').textContent='Local storage unavailable. '+e.message; }
})();
