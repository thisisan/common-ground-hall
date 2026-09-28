import { validateSubmission } from './profile-schema.js';
import { categories } from './data.js';
import { mountSocialInput } from './social-input.js';

export function mountStaff({ api, escape: esc, photoHTML, onClose }) {
  let token = ''; let rows = []; let active = null; let busy = false; let upload = ''; let requestId = crypto.randomUUID();
  try { token = sessionStorage.getItem('sky-wall:staff') || ''; } catch {}
  document.body.classList.add('admin-mode');
  const board = document.createElement('section'); board.id='admin-board';
  board.innerHTML = `<div class="admin-topline"><div class="eyebrow">SKY LEE SOCIAL WALL / STAFF</div><button class="button" id="staff-back">← Back to wall</button></div><div class="admin-heading"><div><h1>Manage the wall.</h1><p>Add and update SKYer profiles, and see how the wall is used.</p></div></div><form id="staff-login" class="admin-login-card"><h2>Staff sign-in</h2><label>Password<input name="password" type="password" autocomplete="current-password" required></label><button class="button primary">Sign in</button></form><div id="staff-workspace" hidden><div class="admin-toolbar"><button class="button primary" id="staff-add">Add profile</button><button class="button" id="staff-refresh">Refresh</button><button class="button" id="staff-logout">Sign out</button></div><section aria-label="Analytics" class="staff-metrics"><h2>Last 30 days</h2><div id="staff-metrics"></div><p id="staff-sources"></p><p class="field-note">Visits are anonymous browser sessions, ending after 30 minutes of inactivity. Contact clicks show interest, not confirmed conversations. Staff-page activity is excluded.</p></section><h2>Profiles</h2><div id="staff-rows"></div></div><p id="staff-error" class="form-error" role="alert"></p>`;
  document.querySelector('.site-header').after(board);
  const dialog = document.createElement('dialog'); dialog.className='staff-editor'; document.body.append(dialog);
  const $ = s => board.querySelector(s); const d = s => dialog.querySelector(s);
  function saveToken(value) {token=value;try {if(value)sessionStorage.setItem('sky-wall:staff',value);else sessionStorage.removeItem('sky-wall:staff');}catch{}}
  function error(e) {$('#staff-error').textContent=e.message;if(e.status===401){saveToken('');$('#staff-workspace').hidden=true;$('#staff-login').hidden=false;}}
  async function call(action,values={}) {return api(action,{...values,sessionToken:token});}
  async function load() {
    try {
      const [data,metrics] = await Promise.all([call('admin-list'),call('analytics')]);rows=data.profiles;
      $('#staff-login').hidden=true;$('#staff-workspace').hidden=false;$('#staff-error').textContent='';
      $('#staff-rows').innerHTML=rows.map(p=>`<div class="admin-row"><div class="admin-resident"><div class="admin-avatar">${photoHTML(p)}</div><strong>${esc(p.name)}</strong></div><div class="admin-course">${esc(p.curriculum)}</div><span class="status-pill ${esc(p.status)}">${esc(p.status)}</span><button class="button" data-edit="${esc(p.id)}">Manage</button></div>`).join('');
      const labels={visit:'Visits',page_view:'Page views',profile_open:'Profile opens',contact_open:'Contact details opened',contact_click:'Contact link clicks'};
      $('#staff-metrics').innerHTML=Object.entries(labels).map(([key,label])=>`<div><strong>${metrics.daily.filter(r=>r.event===key).reduce((n,r)=>n+r.count,0)}</strong><span>${label}</span></div>`).join('');
      $('#staff-sources').textContent='Traffic sources: '+(metrics.sources.map(r=>`${r.source}: ${r.count}`).join(' · ')||'No visits recorded yet.');
    }catch(e){error(e);}
  }
  $('#staff-back').onclick=()=>{board.remove();dialog.remove();document.body.classList.remove('admin-mode');onClose();};
  $('#staff-login').onsubmit=async e=>{e.preventDefault();const b=e.target.querySelector('button');b.disabled=true;try{const result=await api('login',{password:e.target.elements.password.value});saveToken(result.token);e.target.reset();await load();}catch(e){error(e);}finally{b.disabled=false;}};
  $('#staff-logout').onclick=async()=>{try{await call('logout');saveToken('');rows=[];$('#staff-rows').replaceChildren();$('#staff-workspace').hidden=true;$('#staff-login').hidden=false;}catch(e){error(e);}};
  $('#staff-refresh').onclick=load;
  $('#staff-add').onclick=()=>edit(null);
  $('#staff-rows').onclick=e=>{const b=e.target.closest('[data-edit]');if(b)edit(rows.find(p=>p.id===b.dataset.edit));};
  function edit(profile) {
    active=profile;upload=profile?.photo||'';requestId=crypto.randomUUID();
    const p=profile||{name:'',curriculum:'',year:'Year 1',category:'Others',intro:'',help:'',meet:'',contact:'',socials:[]};
    const field=(key,label,max,required=true)=>`<label>${label}<textarea name="${key}" rows="${max>100?3:1}" maxlength="${max}" ${required?'required':''}>${esc(p[key]||'')}</textarea></label>`;
    const select=(key,label,values)=>`<label>${label}<select name="${key}" aria-label="${label}">${values.map(v=>`<option ${p[key]===v?'selected':''}>${esc(v)}</option>`).join('')}</select></label>`;
    dialog.innerHTML=`<button type="button" class="close-button" id="staff-close" aria-label="Close editor">×</button><h2 id="staff-editor-title">${profile?'Edit profile':'Add SKYer'}</h2><form id="staff-edit"><div class="form-row">${field('name','Preferred name',60)}${field('curriculum','Field of study',80)}</div><div class="form-row">${select('year','Year',['Year 1','Year 2','Year 3','Year 4','Year 4+','Postgraduate'])}${select('category','Category',categories)}</div>${field('intro','I am',3000)}${field('help','I can help with',3000)}${field('meet','I want to meet',3000)}${field('contact','Public contact details',3000,false)}<fieldset class="social-fieldset"><legend>Contact links</legend><div id="staff-socials"></div></fieldset><label>Picture<input id="staff-photo" type="file" accept="image/png,image/jpeg,image/webp"></label><div id="staff-photo-preview" class="admin-avatar">${profile?photoHTML(p):''}</div><button class="text-button" id="staff-remove-photo" type="button">Remove picture</button><label class="checkbox-label"><input type="checkbox" name="consent" required ${profile?'checked':''}> This SKYer has agreed to share these profile details and picture.</label><button class="button primary" type="submit">${profile?'Save changes':'Save draft'}</button></form><div class="review-actions">${profile?`<button class="button" id="staff-publish">${p.status==='published'?'Unpublish':'Publish'}</button><details><summary>Delete profile</summary><label>Type DELETE<input id="staff-confirm"></label><button class="button danger" id="staff-delete">Delete permanently</button></details>`:''}</div><p id="staff-edit-error" class="form-error" role="alert"></p>`;
    dialog.setAttribute('aria-labelledby','staff-editor-title');dialog.showModal();
    const socials=mountSocialInput(d('#staff-socials'),p.socials||[]);
    d('#staff-close').onclick=()=>dialog.close();
    d('#staff-remove-photo').onclick=()=>{upload='';d('#staff-photo').value='';d('#staff-photo-preview').replaceChildren();};
    d('#staff-photo').onchange=async e=>{
      const file=e.target.files[0];if(!file)return;
      const submit=d('[type=submit]');submit.disabled=true;
      try {
        if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>10*1024*1024)throw new Error('Choose a PNG, JPEG or WebP under 10 MB.');
        const bitmap=await createImageBitmap(file);const canvas=document.createElement('canvas');const scale=Math.min(1,600/Math.max(bitmap.width,bitmap.height));canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();upload=canvas.toDataURL('image/webp',.86);
        if(upload.length>700000)throw new Error('Please choose a smaller picture.');
        d('#staff-photo-preview').innerHTML=`<img src="${upload}" alt="Picture preview">`;d('#staff-edit-error').textContent='';
      }catch(e){upload=profile?.photo||'';d('#staff-edit-error').textContent=e.message;}finally{submit.disabled=false;}
    };
    d('#staff-edit').onsubmit=async e=>{
      e.preventDefault();if(busy)return;
      try{const fields=Object.fromEntries(new FormData(e.target));const value=validateSubmission({...p,...fields,photo:upload,socials:socials.getValues(),consent:e.target.elements.consent.checked});await mutate(profile?'update':'submit',{profile:value,requestId});}catch(e){d('#staff-edit-error').textContent=e.message;}
    };
    if(profile){d('#staff-publish').onclick=()=>mutate(p.status==='published'?'archive':'publish');d('#staff-delete').onclick=()=>mutate('delete',{confirmation:d('#staff-confirm').value});}
  }
  async function mutate(action,values={}) {
    if(busy)return;busy=true;dialog.querySelectorAll('button').forEach(b=>b.disabled=true);
    try{await call(action,{...values,id:active?.id,version:active?.version});dialog.close();await load();}catch(e){d('#staff-edit-error').textContent=e.message;}finally{busy=false;dialog.querySelectorAll('button').forEach(b=>b.disabled=false);}
  }
  if(token)load();
}
