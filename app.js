(() => {
  'use strict';
  const C = ResumeCore, X = ResumeXML, key = 'elevateresume_data_v2', $ = id => document.getElementById(id);
  const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const labels = { name:'Name', title:'Professional title', email:'Email', phone:'Phone', location:'Location', summary:'Summary', institution:'Institution', qualification:'Qualification', start:'Start date / period', end:'End date / period', details:'Details', role:'Role', url:'Link URL', organization:'Organization', issuer:'Issuer', date:'Date', label:'Link label' };
  const title = s => s[0].toUpperCase() + s.slice(1);
  let data = C.blank(), proposal = null, requestNumber = 0, ready = false, busy = false, pendingImport = null, legacy = null, storageBlocked = false;
  const revisions = new Map();
  function notice(text) { $('notice').textContent = text; }
  try {
    const raw = localStorage.getItem(key);
    if (raw) { data = C.validate(JSON.parse(raw)); $('saveStatus').textContent = 'Saved draft restored'; }
    legacy = localStorage.getItem('elevateresume_data_v1');
    document.documentElement.dataset.theme = localStorage.getItem('elevateresume_theme') === 'dark' ? 'dark' : 'light';
  } catch {
    storageBlocked = true;
    notice('Saved data could not be read. It has not been overwritten. Use Export Center to import a valid file; current edits stay in memory.');
    $('saveStatus').textContent = 'Local saving unavailable';
  }
  function save() {
    try {
      if (storageBlocked) throw new Error('Storage recovery required');
      localStorage.setItem(key, JSON.stringify(data));
      $('saveStatus').textContent = 'Draft saved in this browser';
    } catch { $('saveStatus').textContent = 'Not saved locally — keep this tab open and export confirmed content'; }
  }
  function navigate(page) {
    if (!document.querySelector(`section[data-page="${page}"]`)) page = 'dashboard';
    document.querySelectorAll('section.page').forEach(el => el.classList.toggle('active', el.dataset.page === page));
    document.querySelectorAll('#navigation button').forEach(el => { el.classList.toggle('active', el.dataset.page === page); if (el.dataset.page === page) el.setAttribute('aria-current','page'); else el.removeAttribute('aria-current'); });
    history.replaceState(null, '', '#' + page);
    $('currentPage').textContent = document.querySelector(`#navigation [data-page="${page}"]`).textContent.trim();
    if (page === 'coach') refreshBulletOptions();
  }
  $('navigation').addEventListener('click', e => { const b = e.target.closest('[data-page]'); if (b) navigate(b.dataset.page); });
  const navIcons = { dashboard:'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',builder:'M6 3h8l4 4v14H6zM14 3v5h4M9 12h6M9 16h6',preview:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',matching:'M4 5h10M4 10h7M4 15h5M14 15l3 3 5-6',coach:'M4 4h16v12H9l-5 4zM8 8h8M8 12h5',insights:'M4 3v18h17M8 16v-5M13 16V7M18 16V4',quality:'M3 6l2 2 3-4M11 6h10M3 14l2 2 3-4M11 14h10M11 20h10',export:'M12 3v12M7 10l5 5 5-5M4 16v5h16v-5' };
  document.querySelectorAll('#navigation button').forEach(b => { b.insertAdjacentHTML('afterbegin',`<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${navIcons[b.dataset.page]}"/></svg>`); });
  document.querySelectorAll('[data-goto]').forEach(b => { b.onclick = () => navigate(b.dataset.goto); });
  function themeLabel() { const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; $('theme').textContent = title(next) + ' theme'; $('theme').setAttribute('aria-label',`Switch to ${next} theme`); }
  themeLabel();
  $('theme').onclick = () => { const theme = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light'; document.documentElement.dataset.theme = theme; themeLabel(); try { localStorage.setItem('elevateresume_theme', theme); } catch {} };
  function field(name, value, context) {
    const id = `${context}-${name}`;
    return `<div class="${['summary','details'].includes(name) ? 'wide' : ''}"><label for="${id}">${labels[name] || name}</label>${['summary','details'].includes(name) ? `<textarea id="${id}" data-field="${name}" maxlength="12000">${esc(value)}</textarea>` : `<input id="${id}" data-field="${name}" type="${name === 'email' ? 'email' : name === 'url' ? 'url' : name === 'phone' ? 'tel' : 'text'}" maxlength="12000" value="${esc(value)}">`}</div>`;
  }
  function confirmation(checked, text) { return `<label class="check"><input type="checkbox" data-confirm ${checked ? 'checked' : ''}> ${text}</label>`; }
  function renderEditor() {
    $('editor').innerHTML = `<div class="glass panel" data-section="contact"><h3>Contact details & summary</h3><div class="field-grid">${C.contactFields.map(k => field(k,data.contact[k],'contact')).join('')}</div>${confirmation(data.contact.confirmed,'I confirm these details are accurate and ready for my resume.')}</div>` + Object.entries(C.fields).map(([section, names]) => `<div class="glass panel" data-section="${section}"><h3>${title(section)}</h3>${data[section].map((item,i) => `<div class="entry" data-id="${item.id}"><h4>${title(section)} ${i+1}</h4><div class="field-grid">${names.map(k => field(k,item[k],item.id)).join('')}</div>${(item.bullets || []).map((b,j) => `<div class="bullet-editor" data-bullet="${b.id}"><label for="${b.id}">Bullet ${j+1}</label><textarea id="${b.id}" data-bullet-text maxlength="12000">${esc(b.text)}</textarea><div class="actions"><button class="btn-ghost btn-small" data-action="coach">Coach this bullet</button><button class="btn-ghost btn-small" data-action="remove-bullet">Remove bullet</button></div></div>`).join('')}${item.bullets ? '<button class="btn-ghost btn-small" data-action="add-bullet">+ Add bullet</button>' : ''}${confirmation(item.confirmed,section === 'skills' ? 'I confirm I have this skill.' : 'I confirm this entry and its bullets are accurate.')}<button class="btn-ghost btn-small" data-action="remove-entry">Remove entry</button></div>`).join('')}<button class="btn-ghost" data-action="add-entry">+ Add ${section === 'experience' ? 'experience' : section === 'education' ? 'education' : section.slice(0,-1)}</button></div>`).join('');
  }
  function context(el) {
    const section = el.closest('[data-section]').dataset.section;
    const entryId = el.closest('[data-id]')?.dataset.id;
    return { section, entryId, item: section === 'contact' ? data.contact : data[section].find(x => x.id === entryId), bulletId: el.closest('[data-bullet]')?.dataset.bullet };
  }
  function touchBullet(id) {
    revisions.set(id, (revisions.get(id) || 0) + 1);
    if ($('bulletSelect').value === id) $('factsConfirmed').checked = false;
  }
  function renderDashboard() {
    const entries = Object.keys(C.fields).flatMap(k => data[k]);
    const count = entries.filter(e => e.confirmed).length;
    $('overviewConfirmed').textContent = count;
    $('overviewDrafts').textContent = entries.length ? `${entries.length - count} unconfirmed · ${entries.length} total entries` : 'No entries added yet';
    const issues = C.quality(data);
    $('overviewQuality').textContent = issues.length;
    $('overviewContact').textContent = data.contact.confirmed ? 'Confirmed' : C.contactFields.some(k => data.contact[k].trim()) ? 'Draft' : 'Not added';
    $('overviewNext').textContent = issues[0] || 'Review your preview and export when ready.';
    $('overviewAI').textContent = ready ? 'Configured · ready for review requests' : 'Unavailable · API setup pending';
  }
  function renderSignature() {
    const signature = data.signature;
    $('signatureImage').hidden = !signature.image;
    if (signature.image) $('signatureImage').src = signature.image; else $('signatureImage').removeAttribute('src');
    $('signatureConfirmed').checked = signature.confirmed;
    $('signatureConfirmed').disabled = !signature.image;
    $('removeSignature').disabled = !signature.image;
  }
  function update() { save(); renderOutputs(); renderMatching(); renderQuality(); refreshBulletOptions(); renderDashboard(); renderSignature(); }
  let signatureRequest = 0;
  $('signatureFile').onchange = async e => {
    const file = e.target.files[0], request = ++signatureRequest;
    if (!file) return;
    let image;
    try {
      if (!['image/png','image/jpeg'].includes(file.type) || file.size > 5 * 1024 * 1024) throw new Error('Choose a PNG or JPG image up to 5 MB.');
      image = await createImageBitmap(file);
      if (!image.width || !image.height || image.width * image.height > 12000000) throw new Error('Choose an image smaller than 12 megapixels.');
      const scale = Math.min(1, 900 / image.width, 400 / image.height);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.width * scale)); canvas.height = Math.max(1, Math.round(image.height * scale));
      canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
      const signature = { image:canvas.toDataURL('image/png'), confirmed:false };
      C.validate({...data, signature});
      if (request !== signatureRequest) return;
      data.signature = signature; update();
      $('signatureStatus').textContent = 'Signature uploaded. Select Include to add it to your resume.';
    } catch (error) { if (request === signatureRequest) $('signatureStatus').textContent = error.message + ' Your existing signature is unchanged.'; }
    finally { image?.close(); e.target.value = ''; }
  };
  $('signatureConfirmed').onchange = e => { data.signature.confirmed = Boolean(data.signature.image) && e.target.checked; update(); };
  $('removeSignature').onclick = () => { signatureRequest++; data.signature = {image:'',confirmed:false}; update(); $('signatureStatus').textContent = 'Signature removed.'; };
  $('editor').addEventListener('input', e => {
    if (!e.target.matches('[data-field],[data-bullet-text]')) return;
    const ctx = context(e.target);
    if (e.target.hasAttribute('data-bullet-text')) { ctx.item.bullets.find(b => b.id === ctx.bulletId).text = e.target.value; touchBullet(ctx.bulletId); }
    else ctx.item[e.target.dataset.field] = e.target.value;
    ctx.item.confirmed = false;
    const container = e.target.closest('[data-id]') || e.target.closest('[data-section]');
    container.querySelector('[data-confirm]').checked = false;
    update();
  });
  $('editor').addEventListener('change', e => {
    if (!e.target.hasAttribute('data-confirm')) return;
    context(e.target).item.confirmed = e.target.checked; update();
  });
  $('editor').addEventListener('click', e => {
    const b = e.target.closest('[data-action]'); if (!b) return;
    const ctx = context(b), action = b.dataset.action;
    if (action === 'coach') { navigate('coach'); $('bulletSelect').value = ctx.bulletId; selectBullet(); return; }
    if (action === 'add-entry') {
      if (data[ctx.section].length >= 200) { notice('This section supports at most 200 entries.'); return; }
      data[ctx.section].push(C.entry(ctx.section));
    }
    if (action === 'remove-entry') { if (!window.confirm('Remove this entry and its bullets?')) return; data[ctx.section] = data[ctx.section].filter(x => x.id !== ctx.entryId); }
    if (action === 'add-bullet') {
      if (ctx.item.bullets.length >= 100) { notice('Each entry supports at most 100 bullets.'); return; }
      ctx.item.bullets.push({ id:C.uid(), text:'' }); ctx.item.confirmed = false;
    }
    if (action === 'remove-bullet') { if (!window.confirm('Remove this bullet?')) return; ctx.item.bullets = ctx.item.bullets.filter(x => x.id !== ctx.bulletId); ctx.item.confirmed = false; }
    renderEditor(); update();
  });
  function preview() {
    const d = C.confirmed(data), c = d.contact;
    const link = (url,label) => C.validUrl(url) ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label || url)}</a>` : esc(label ? `${label}: ${url}` : url);
    let html = `${c.name ? `<h1>${esc(c.name)}</h1>` : ''}${c.title ? `<p>${esc(c.title)}</p>` : ''}${[c.email,c.phone,c.location].some(Boolean) ? `<p>${[c.email,c.phone,c.location].filter(Boolean).map(esc).join(' · ')}</p>` : ''}${c.summary ? `<p>${esc(c.summary)}</p>` : ''}`;
    for (const [section,names] of Object.entries(C.fields)) {
      const entries = d[section].filter(x => names.some(k => x[k].trim()) || x.bullets?.some(b => b.text.trim()));
      if (!entries.length) continue;
      html += `<section><h2>${title(section)}</h2>` + entries.map(item => {
        const heading = item.name || item.institution || item.organization || item.label || '';
        const details = names.filter(k => !['name','institution','organization','label','url'].includes(k)).map(k => item[k]).filter(Boolean).map(esc);
        return `<article>${heading ? `<h3>${esc(heading)}</h3>` : ''}${details.length ? `<p>${details.join(' · ')}</p>` : ''}${item.url ? `<p>${link(item.url)}</p>` : ''}${item.bullets?.some(b => b.text.trim()) ? `<ul>${item.bullets.filter(b => b.text.trim()).map(b => `<li>${esc(b.text)}</li>`).join('')}</ul>` : ''}</article>`;
      }).join('') + '</section>';
    }
    if (d.signature.image) html += `<div class="resume-signature"><img src="${esc(d.signature.image)}" alt="Signature"><span>Signature</span></div>`;
    return html;
  }
  function renderOutputs() { const html = preview(); ['livePreview','fullPreview'].forEach(id => { $(id).innerHTML = html || '<p class="empty">No confirmed information yet.</p>'; }); $('print-area').innerHTML = html; }
  function renderMatching() {
    const results = C.match(data,$('job').value), n = results.filter(x => x.evidence.length).length;
    $('matches').innerHTML = !results.length ? '<p>No dictionary skills recognized. Paste or revise the job description; requirements outside this dictionary are not evaluated.</p>' : `<h3>${n} of ${results.length} recognized skills have resume evidence</h3>` + results.map(r => `<div class="evidence"><div class="evidence-heading"><h4>${esc(r.skill)}</h4><span class="status-label ${r.evidence.length ? 'matched' : ''}">${r.evidence.length ? 'Evidence found' : 'No evidence found'}</span></div>${r.evidence.length ? `<ul>${r.evidence.map(e => `<li>${esc(title(e.section))}: “${esc(e.text)}”</li>`).join('')}</ul>` : '<p>Not evidenced in your resume</p>'}</div>`).join('');
  }
  $('job').addEventListener('input', renderMatching);
  $('dictionary').innerHTML = Object.entries(C.dictionary).map(([k,v]) => `<p><strong>${esc(k)}</strong>: ${v.map(esc).join(', ')}</p>`).join('');
  function renderQuality() { const issues = C.quality(data); $('qualityResults').innerHTML = issues.length ? `<ul>${issues.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '<p>No issues found by these basic checks. Review the resume for accuracy and completeness.</p>'; }
  function targets() { return ['projects','experience'].flatMap(section => data[section].flatMap(item => item.bullets.map(b => ({ section, entryId:item.id, bulletId:b.id, original:b.text, label:`${title(section)} · ${item.name || item.organization || 'Untitled'} · ${b.text || '(empty bullet)'}` })))); }
  function refreshBulletOptions() {
    const selected = $('bulletSelect').value;
    $('bulletSelect').innerHTML = '<option value="">Choose a bullet</option>' + targets().map(t => `<option value="${t.bulletId}">${esc(t.label.slice(0,140))}</option>`).join('');
    if (targets().some(t => t.bulletId === selected)) $('bulletSelect').value = selected;
    if (!proposal) $('original').textContent = targets().find(t => t.bulletId === $('bulletSelect').value)?.original || '';
    if (proposal && (!C.findBullet(data,proposal) || C.findBullet(data,proposal).text !== proposal.original || (revisions.get(proposal.bulletId) || 0) !== proposal.revision)) { $('approve').disabled = true; $('aiFeedback').textContent = 'Source changed. Reject this suggestion and request a new one.'; }
    refreshGenerate();
  }
  function clearProposal() { proposal = null; requestNumber++; $('suggestion').value = ''; $('suggestion').disabled = true; $('suggestionConfirmed').checked = false; $('suggestionConfirmed').disabled = true; $('approve').disabled = true; $('reject').disabled = true; }
  function selectBullet() { clearProposal(); $('facts').value = ''; $('factsConfirmed').checked = false; $('aiFeedback').textContent = ''; $('original').textContent = targets().find(t => t.bulletId === $('bulletSelect').value)?.original || ''; refreshGenerate(); }
  $('bulletSelect').onchange = selectBullet;
  function refreshGenerate() { $('generate').disabled = busy || !ready || !$('factsConfirmed').checked || !$('facts').value.trim() || !$('original').textContent.trim() || !targets().some(t => t.bulletId === $('bulletSelect').value); }
  $('facts').oninput = () => { $('factsConfirmed').checked = false; clearProposal(); refreshGenerate(); };
  $('factsConfirmed').onchange = () => { clearProposal(); refreshGenerate(); };
  $('includeJob').onchange = () => { clearProposal(); refreshGenerate(); };
  $('generate').onclick = async () => {
    clearProposal();
    const target = targets().find(t => t.bulletId === $('bulletSelect').value); if (!target) return;
    const number = requestNumber, revision = revisions.get(target.bulletId) || 0;
    const request = { requestId:C.uid(), section:target.section, entryId:target.entryId, bulletId:target.bulletId, original:target.original, revision, confirmedFacts:$('facts').value, factsConfirmed:true, jobDescription:$('includeJob').checked ? $('job').value : '' };
    busy = true; $('original').textContent = target.original;
    $('generate').disabled = true; $('aiFeedback').textContent = 'Requesting a suggestion…';
    try {
      const response = await fetch('/api/coach', { method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify(request), signal:AbortSignal.timeout(35000) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'AI request failed. Resume unchanged.');
      if (number !== requestNumber) return;
      if (result.requestId !== request.requestId || result.bulletId !== target.bulletId || result.original !== target.original || result.revision !== revision || typeof result.suggestion !== 'string' || !result.suggestion.trim() || result.suggestion.length > 12000) throw new Error('Invalid AI response. Resume unchanged.');
      if (C.findBullet(data,target)?.text !== target.original || (revisions.get(target.bulletId) || 0) !== revision) throw new Error('Source changed during request. Request a new suggestion.');
      proposal = { ...target, revision }; $('suggestion').value = result.suggestion; $('suggestion').disabled = false; $('suggestionConfirmed').disabled = false; $('reject').disabled = false;
      $('aiFeedback').textContent = 'Compare the original and suggestion. Edit as needed, verify every fact, then approve or reject.';
    } catch(e) { if (number === requestNumber) { clearProposal(); $('aiFeedback').textContent = e.name === 'TimeoutError' ? 'AI request timed out. Resume unchanged.' : e.message; } }
    finally { busy = false; refreshGenerate(); }
  };
  $('suggestion').oninput = () => { $('suggestionConfirmed').checked = false; $('approve').disabled = true; };
  $('suggestionConfirmed').onchange = () => { $('approve').disabled = !$('suggestionConfirmed').checked || !proposal || C.findBullet(data,proposal)?.text !== proposal.original || (revisions.get(proposal.bulletId)||0) !== proposal.revision; };
  $('approve').onclick = () => {
    if (!proposal || !$('suggestionConfirmed').checked) return;
    try { C.approve(data,proposal,$('suggestion').value,revisions.get(proposal.bulletId)||0); touchBullet(proposal.bulletId); clearProposal(); renderEditor(); update(); $('aiFeedback').textContent = 'Approved. Only the selected bullet was changed. Entry confirmation is still controlled in the builder.'; }
    catch(e) { $('aiFeedback').textContent = e.message; $('approve').disabled = true; }
  };
  $('reject').onclick = () => { clearProposal(); $('aiFeedback').textContent = 'Suggestion rejected. Resume unchanged.'; refreshGenerate(); };
  fetch('/api/coach/status').then(r => { if (!r.ok) throw new Error(); return r.json(); }).then(result => { ready = result.available === true; $('aiStatus').textContent = ready ? `AI coach ready · ${result.provider} / ${result.model}` : 'AI coach unavailable—API setup pending.'; refreshGenerate(); renderDashboard(); }).catch(() => { $('aiStatus').textContent = 'AI coach unavailable—API setup pending.'; renderDashboard(); });
  function download(text,name,type) { const url = URL.createObjectURL(new Blob([text],{type})); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url),1000); }
  $('exportXml').onclick = () => { download(X.serialize(C.confirmed(data)),'elevateresume.xml','application/xml'); notice('XML exported with confirmed information only.'); };
  document.querySelectorAll('.print-button').forEach(b => { b.onclick = () => { renderOutputs(); if (!preview()) { notice('Confirm your information before printing.'); return; } window.print(); }; });
  window.addEventListener('beforeprint',renderOutputs);
  $('xmlFile').onchange = async e => {
    pendingImport = null; $('importReview').hidden = true;
    const file = e.target.files[0]; if (!file) return;
    try {
      if (file.size > 2_000_000) throw new Error('XML file is too large.');
      pendingImport = X.parse(await file.text());
      $('importSummary').textContent = `Valid XML: ${pendingImport.contact.name || '(no name)'}, ${Object.keys(C.fields).reduce((n,k) => n + pendingImport[k].length,0)} entries. Replace your current draft? Imported sections will await your confirmation in the builder.`;
      $('importReview').hidden = false; notice('XML validated. Current data is unchanged until you choose Replace.');
    } catch(e) { notice(e.message + ' Existing data is unchanged.'); }
    finally { $('xmlFile').value = ''; }
  };
  $('confirmImport').onclick = () => {
    if (!pendingImport) return;
    signatureRequest++;
    data = pendingImport; data.contact.confirmed = false; data.signature.confirmed = false; Object.keys(C.fields).forEach(k => data[k].forEach(x => { x.confirmed = false; }));
    pendingImport = null; storageBlocked = false; revisions.clear(); clearProposal(); $('importReview').hidden = true; renderEditor(); update(); notice('Imported as unconfirmed draft. Review and confirm each section.'); navigate('builder');
  };
  $('cancelImport').onclick = () => { pendingImport = null; $('importReview').hidden = true; notice('Import cancelled. Resume unchanged.'); };
  $('legacyPanel').hidden = !legacy;
  $('recoverLegacy').onclick = () => {
    if (!window.confirm('Replace the current draft with the earlier saved text for review? No old information is automatically confirmed.')) return;
    try {
      const old = JSON.parse(legacy), candidate = C.blank();
      for (const k of ['name','title','summary']) if (typeof old[k] === 'string') candidate.contact[k] = old[k];
      if (Array.isArray(old.bullets)) { const item = C.entry('experience'); item.bullets = old.bullets.filter(x => typeof x === 'string').map(text => ({ id:C.uid(),text })); candidate.experience.push(item); }
      data = C.validate(candidate); storageBlocked = false; clearProposal(); renderEditor(); update(); notice('Earlier text recovered as draft. Verify all claims before confirming.'); navigate('builder');
    } catch { notice('Earlier saved text could not be recovered. Existing data is unchanged.'); }
  };
  let marketLoadVersion = 0;
  function marketEmpty(message) {
    $('marketResults').innerHTML = '<h3>No verified sample loaded</h3><p>Sample size: 0. No skill frequencies or percentages are available. Retry the bundled sample or import verified records.</p>';
    $('marketStatus').textContent = message;
    $('overviewMarket').textContent = 'Unavailable · no sample loaded';
  }
  function renderMarket(sample, origin) {
    // Use the same validation, deduplication and arithmetic for bundled and imported data.
    const result = C.market(sample);
    const dates = [...new Set(result.rows.map(p => p.collectedAt))].sort();
    const collected = dates.length > 1 ? `${dates[0]} to ${dates[dates.length - 1]}` : dates[0] || 'No collection dates';
    $('marketResults').innerHTML = `<h3>Skill frequency in our collected sample</h3><p><strong>Sample size: ${result.size} unique verified postings</strong></p><p>Collection dates: ${esc(collected)}</p><details class="method-details"><summary>Scope and counting method</summary><p>Scope: ${esc(result.scope)}</p><p>Each recognized skill counts once per unique posting. Percentage = posting count ÷ sample size × 100, rounded to one decimal. Counts include required, preferred and role-stack mentions in the retained excerpts; they do not measure proficiency or mandatory requirements. Skills outside the existing dictionary are not counted, and omitted text is not analysed.</p><p class="muted">Repeated IDs or normalized source URLs are counted once (first record retained). Collectors must assign the same stable ID to syndicated copies. This snapshot is not live, nationwide representative or evidence of a trend.</p></details>` + (result.size ? `<div class="table-wrap"><table><thead><tr><th scope="col">Skill</th><th scope="col">Posting count</th><th scope="col">Sample percentage</th></tr></thead><tbody>${result.skills.map(s => `<tr><td>${esc(s.skill)}</td><td>${s.count}</td><td>${s.percent}%</td></tr>`).join('')}</tbody></table></div>${result.skills.length ? '' : '<p>No dictionary skills recognized in these excerpts.</p>'}<h3>Sources and collection dates</h3><ol class="source-list">${result.rows.map(p => `<li><a href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">${esc(p.title)} — ${esc(p.source)}</a>${typeof p.location === 'string' ? `<p>${esc(p.location)}${typeof p.level === 'string' ? ' · ' + esc(p.level) : ''}</p>` : ''}<p>Collected ${esc(p.collectedAt)} · Posting date: ${typeof p.postedAt === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.postedAt) ? esc(p.postedAt) : 'Unknown (not supplied or not displayed)'}</p><p>Verified by ${esc(p.verifiedBy)} · Record ${esc(p.id)}${typeof p.idType === 'string' ? ' · ' + esc(p.idType) : ''}</p><p>${esc(p.verificationNote)}</p><details><summary>Requirements excerpt used for counts</summary><p>${esc(p.text)}</p><p>Recognized skills: ${C.recognize(p.text).map(esc).join(', ') || 'None'}</p></details></li>`).join('')}</ol>` : '<p>No verified records supplied. No percentages available.</p>');
    $('marketStatus').textContent = `${origin} loaded: ${result.size} unique postings. Collection dates: ${collected}.`;
    $('overviewMarket').textContent = `${result.size} unique postings · ${collected}`;
  }
  async function loadBundledMarket() {
    const version = ++marketLoadVersion;
    $('marketResults').innerHTML = '<p>Loading collected sample…</p>';
    $('marketStatus').textContent = 'Loading bundled snapshot…';
    $('overviewMarket').textContent = 'Loading bundled sample…';
    try {
      const response = await fetch('/market-sample.json', { cache:'no-store', signal:AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
      if (text.length > 5_000_000) throw new Error('Sample file exceeds the size limit.');
      const sample = JSON.parse(text);
      if (version !== marketLoadVersion) return;
      renderMarket(sample,'Bundled sample');
    } catch(e) {
      if (version === marketLoadVersion) marketEmpty('Bundled sample could not be loaded. ' + (e.name === 'TimeoutError' ? 'The request timed out.' : e.message));
    }
  }
  $('loadBundledMarket').onclick = loadBundledMarket;
  $('marketFile').onchange = async e => {
    const file = e.target.files[0]; if (!file) return;
    const version = ++marketLoadVersion;
    // A slow bundled request must not overwrite the user's subsequent import.
    try {
      if (file.size > 5_000_000) throw new Error('Sample file exceeds 5 MB.');
      const sample = JSON.parse(await file.text());
      if (version !== marketLoadVersion) return;
      renderMarket(sample,'Imported sample');
    } catch(e) {
      if (version === marketLoadVersion) {
        if ($('marketResults').querySelector('table')) $('marketStatus').textContent = 'Import failed; the previously displayed sample is unchanged. ' + e.message;
        else marketEmpty('Import failed. ' + e.message);
      }
    }
    finally { $('marketFile').value = ''; }
  };
  loadBundledMarket();
  renderEditor(); renderOutputs(); renderMatching(); renderQuality(); refreshBulletOptions(); renderDashboard(); renderSignature();
  navigate(['dashboard','builder','preview','matching','coach','insights','quality','export'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'dashboard');
})();

