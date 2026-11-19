/* Local conversions and explicit, transactional deadline review. No document leaves this PC. */
'use strict';
(() => {
 const $=id=>document.getElementById(id),panel=$('fileToolsPanel');
 let options=[],loading=false,ready=false,converting=false,scanning=false,saving=false,token='',review=[],downloadUrls=[];
 const node=(tag,text,cls)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el;};
 function status(id,message,error=false){$(id).textContent=message;$(id).dataset.error=String(error);}
 function tab(which){for(const key of ['convert','import']){const active=which===key;$(key+'Section').hidden=!active;$(key+'Tab').setAttribute('aria-selected',String(active));$(key+'Tab').tabIndex=active?0:-1;}}
 for(const key of ['convert','import']){$(key+'Tab').onclick=()=>tab(key);$(key+'Tab').onkeydown=e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const next=e.key==='Home'?'convert':e.key==='End'?'import':key==='convert'?'import':'convert';tab(next);$(next+'Tab').focus();}};}
 async function csrfToken(){if(!token){const response=await fetch('/api/bootstrap');if(!response.ok)throw new Error('Reload Midnight and try again.');token=(await response.json()).csrf;}return token;}
 async function upload(path,file,params){
  const response=await fetch('/api/files/'+path+'?'+new URLSearchParams({...params,filename:file.name}),{method:'POST',headers:{'Content-Type':'application/octet-stream','X-Midnight-Token':await csrfToken()},body:file});
  if(!response.ok){let detail;try{detail=(await response.json()).detail;}catch{}if(response.status===403)token='';throw new Error(typeof detail==='string'?detail:'The local converter could not finish. Please try again.');}
  return response;
 }
 function selected(){return options.find(o=>o.id===$('fileConversion').value);}
 function updateConversion(){const option=selected();$('convertFiles').accept=option?.extensions.join(',')||'';$('conversionHint').textContent=option?.notice||'20 conversion options · up to 30 MB per file · no external upload';$('convertRun').disabled=!option?.available||converting;}
 async function load(){if(loading||ready)return;loading=true;
  try{const response=await fetch('/api/files/options');if(!response.ok)throw new Error('Restart Midnight to enable file tools.');const data=await response.json();options=data.conversions;$('fileConversion').replaceChildren();for(const option of options){const el=node('option',option.label+(option.available?'':' · setup needed'));el.value=option.id;$('fileConversion').append(el);}ready=true;updateConversion();}
  catch(e){status('convertStatus',e.message,true);}finally{loading=false;}
 }
 addEventListener('midnight:dialogchange',()=>{if(panel.open)load();});
 $('fileConversion').onchange=updateConversion;
 $('convertFiles').onchange=()=>{const file=$('convertFiles').files[0];if(file){const ext='.'+file.name.split('.').pop().toLowerCase();if(!selected()?.extensions.includes(ext)){const option=options.find(o=>o.extensions.includes(ext));if(option)$('fileConversion').value=option.id;}}updateConversion();};
 function convertingState(value){converting=value;for(const id of ['convertFiles','fileConversion','convertClear'])$(id).disabled=value;$('convertRun').textContent=value?'Converting…':'Convert';$('convertRun').setAttribute('aria-busy',String(value));updateConversion();}
 function clearResults(){downloadUrls.forEach(URL.revokeObjectURL);downloadUrls=[];$('convertResults').replaceChildren();}
 $('convertClear').onclick=()=>{if(converting)return;$('convertFiles').value='';clearResults();status('convertStatus','');};
 $('convertRun').onclick=async()=>{
  if(converting)return;const files=[...$('convertFiles').files],option=selected();
  if(!files.length)return status('convertStatus','Choose at least one file.',true);
  if(files.length>10)return status('convertStatus','Choose up to 10 files per batch.',true);
  if(!option?.available)return;
  convertingState(true);let succeeded=0;status('convertStatus','Converting on this computer…');
  for(const [index,file] of files.entries()){
   const row=node('div',undefined,'fileResult'),label=node('span',file.name),info=node('small','Converting…');label.append(info);row.append(label);$('convertResults').append(row);
   try{
    if(file.size>30*1024*1024)throw new Error('This file exceeds 30 MB.');
    if(!option.extensions.includes('.'+file.name.split('.').pop().toLowerCase()))throw new Error('Choose a file matching '+option.label+'.');
    status('convertStatus',`Converting ${index+1} of ${files.length}: ${file.name}`);
    const response=await upload('convert',file,{operation:option.id});const blob=await response.blob();
    const name=decodeURIComponent(response.headers.get('X-Midnight-Filename')||'converted-file');const url=URL.createObjectURL(blob);downloadUrls.push(url);
    const link=node('a','Download');link.href=url;link.download=name;link.setAttribute('aria-label','Download '+name);row.append(link);info.textContent=name+' · '+(blob.size/1024/1024).toFixed(2)+' MB';succeeded++;
   }catch(e){info.textContent=e.message;row.dataset.error='true';}
  }
  status('convertStatus',`${succeeded} of ${files.length} files converted. Downloads stay here until you clear them or reload.${succeeded<files.length?' Check the file errors below; your selected files are retained.':''}`,succeeded<files.length);convertingState(false);
 };
 $('deadlineYear').value=String(new Date().getFullYear());
 try{const year=localStorage.getItem('midnight-import-year');if(year)$('deadlineYear').value=year;}catch{}
 $('deadlineFile').onchange=()=>{if($('deadlineFile').files.length)$('deadlineText').value='';};
 function scanState(value){scanning=value;for(const id of ['deadlineScan','deadlineReset','deadlineFile','deadlineText','deadlineYear','deadlineCourse'])$(id).disabled=value;$('deadlineScan').textContent=value?'Finding deadlines…':'Find deadlines';$('deadlineScan').setAttribute('aria-busy',String(value));selectionCount();}
 function selectionCount(){const count=review.filter(row=>row.checked.checked&&!row.saved).length;$('deadlineSelectionCount').textContent=count+' selected';$('deadlineSave').disabled=!count||saving||scanning;}
 function renderReview(candidates,source){
  review=[];$('deadlineCandidates').replaceChildren();$('deadlineReview').hidden=!candidates.length;
  for(const [index,candidate] of candidates.entries()){
   const row=node('article',undefined,'deadlineRow'),select=node('label',undefined,'deadlineSelect'),checkbox=node('input');checkbox.type='checkbox';checkbox.checked=true;checkbox.setAttribute('aria-label','Import deadline '+(index+1));select.append(checkbox);
   const fields=node('div',undefined,'deadlineFields'),titleLabel=node('label','Task'),title=node('input');title.value=candidate.text;title.maxLength=500;title.required=true;title.setAttribute('aria-label','Deadline '+(index+1)+' task');titleLabel.append(title);
   const dueLabel=node('label','Due date & time'),due=node('input');due.type='datetime-local';due.required=true;due.value=candidate.localDate;due.setAttribute('aria-label','Deadline '+(index+1)+' due date');dueLabel.append(due);
   const evidence=node('p',candidate.source,'deadlineEvidence');fields.append(titleLabel,dueLabel,evidence);
   if(candidate.warnings.length)fields.append(node('p',candidate.warnings.join(' · '),'deadlineWarning'));
   row.append(select,fields);$('deadlineCandidates').append(row);const record={checked:checkbox,title,due,candidate,source,saved:false};review.push(record);checkbox.onchange=selectionCount;
  }selectionCount();
 }
 $('deadlineScan').onclick=async()=>{
  if(scanning||saving)return;const text=$('deadlineText').value,year=Number($('deadlineYear').value),file=text.trim()?new File([text],'pasted-text.txt',{type:'text/plain'}):$('deadlineFile').files[0];
  if(!Number.isInteger(year)||year<2000||year>2100)return status('deadlineStatus','Choose a year between 2000 and 2100.',true);
  if(!file)return status('deadlineStatus','Choose a syllabus file or paste its text.',true);
  if(file.size>30*1024*1024)return status('deadlineStatus','Choose a file up to 30 MB.',true);
  scanState(true);status('deadlineStatus','Reading locally. No tasks have been added.');
  try{const response=await upload('extract',file,{year}),data=await response.json();renderReview(data.candidates,file.name);try{localStorage.setItem('midnight-import-year',String(year));}catch{}
   status('deadlineStatus',data.candidates.length?`${data.candidates.length} possible deadlines. Review the source text, edit titles and dates, and deselect anything you do not want.${data.candidates.length===200?' Showing the first 200 candidates. Split your document to review more.':''}`:'No dates found. Try pasting a clearer assignment list, such as “November 24 — Lesson plan due at 6 PM”.');
  }catch(e){status('deadlineStatus',e.message+' Your input is retained.',true);}finally{scanState(false);selectionCount();}
 };
 $('deadlineSelectAll').onclick=()=>{const unsaved=review.filter(row=>!row.saved),checked=unsaved.some(row=>!row.checked.checked);for(const row of unsaved)row.checked.checked=checked;selectionCount();};
 $('deadlineSave').onclick=async()=>{
  if(saving||scanning)return;const selected=review.filter(row=>row.checked.checked&&!row.saved);if(!selected.length)return;
  const now=new Date().toISOString(),course=$('deadlineCourse').value.trim();const items=[];
  for(const row of selected){const title=row.title.value.trim(),date=new Date(row.due.value);if(!title||!row.due.value||!Number.isFinite(date.getTime()))return status('deadlineStatus','Give every selected deadline a task name and valid date/time.',true);
   // Reject DST gaps rather than silently moving an entered clock time.
   const parts=row.due.value.split(/[-T:]/).map(Number);if(date.getFullYear()!==parts[0]||date.getMonth()+1!==parts[1]||date.getDate()!==parts[2]||date.getHours()!==parts[3]||date.getMinutes()!==parts[4])return status('deadlineStatus','One selected time does not exist in this timezone. Choose another time.',true);
   items.push({id:crypto.randomUUID(),text:(course?course+' · ':'')+title,kind:'task',dueAt:date.toISOString(),done:false,archived:false,createdAt:now,updatedAt:now,sourceFile:row.source,sourceText:row.candidate.source});
  }
  saving=true;$('deadlineSave').textContent='Saving…';$('deadlineReset').disabled=true;$('deadlineScan').disabled=true;$('deadlineSelectAll').disabled=true;selectionCount();
  try{const result=await MidnightCapture.importTasks(items);for(const row of selected){row.saved=true;row.checked.checked=false;for(const el of [row.checked,row.title,row.due])el.disabled=true;}
   status('deadlineStatus',`Added ${result.added} tasks.${result.skipped?' Kept '+result.skipped+' existing matching tasks.':''} Saved in this browser; view them in Tasks or Inbox.`);
  }catch(e){status('deadlineStatus','Could not save locally. '+e.message+' Your reviewed deadlines are retained; try again.',true);}
  finally{saving=false;$('deadlineSave').textContent='Add selected to Tasks';$('deadlineReset').disabled=false;$('deadlineScan').disabled=false;$('deadlineSelectAll').disabled=false;selectionCount();}
 };
 $('deadlineReset').onclick=()=>{if(saving||scanning)return;$('deadlineFile').value='';$('deadlineText').value='';$('deadlineCourse').value='';renderReview([],'');status('deadlineStatus','');};
})();
