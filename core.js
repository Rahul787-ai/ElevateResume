(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ResumeCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const dictionary = {
    HTML: ['html', 'html5'], CSS: ['css', 'css3'], JavaScript: ['javascript', 'js', 'ecmascript'],
    Java: ['java'], Python: ['python'], SQL: ['sql'], XML: ['xml'],
    React: ['react', 'react.js', 'reactjs'], 'Node.js': ['node.js', 'nodejs'],
    Git: ['git'], 'C++': ['c++'], 'C#': ['c#'], AWS: ['aws', 'amazon web services'],
    'Machine learning': ['machine learning'], 'Data analysis': ['data analysis', 'data analytics'],
    Testing: ['testing', 'unit tests', 'unit testing'], Communication: ['communication']
  };
  const fields = {
    education: ['institution', 'qualification', 'start', 'end', 'details'],
    projects: ['name', 'role', 'url'], experience: ['organization', 'role', 'start', 'end'],
    skills: ['name'], certifications: ['name', 'issuer', 'date', 'url'], links: ['label', 'url']
  };
  const contactFields = ['name', 'title', 'email', 'phone', 'location', 'summary'];
  const uid = () => globalThis.crypto.randomUUID();
  const blank = () => ({ version: 2, contact: Object.fromEntries([...contactFields.map(k => [k, '']), ['confirmed', false]]), ...Object.fromEntries(Object.keys(fields).map(k => [k, []])), signature: { image: '', confirmed: false } });
  const entry = section => ({ id: uid(), confirmed: false, ...Object.fromEntries(fields[section].map(k => [k, ''])), ...(['projects', 'experience'].includes(section) ? { bullets: [] } : {}) });
  function validate(data) {
    data = structuredClone(data);
    if (data && !Object.hasOwn(data, 'signature')) data.signature = { image: '', confirmed: false };
    const assert = (condition, message) => { if (!condition) throw new Error(message); };
    const object = (value, keys) => assert(value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === keys.length && keys.every(k => Object.hasOwn(value, k)), 'Unexpected or missing resume fields.');
    const str = value => assert(typeof value === 'string' && value.length <= 12000 && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value), 'Invalid text field.');
    object(data, ['version', 'contact', ...Object.keys(fields), 'signature']);
    object(data.signature, ['image', 'confirmed']);
    assert(typeof data.signature.confirmed === 'boolean' && typeof data.signature.image === 'string' && data.signature.image.length <= 450000 && (data.signature.image === '' || /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/.test(data.signature.image)), 'Invalid signature image.');
    assert(data.version === 2, 'Unsupported resume version.');
    object(data.contact, [...contactFields, 'confirmed']);
    contactFields.forEach(k => str(data.contact[k]));
    assert(typeof data.contact.confirmed === 'boolean', 'Invalid confirmation.');
    const ids = new Set();
    const id = value => { assert(typeof value === 'string' && /^[a-zA-Z0-9-]{1,80}$/.test(value) && !ids.has(value), 'Invalid or duplicate entry ID.'); ids.add(value); };
    for (const [section, names] of Object.entries(fields)) {
      assert(Array.isArray(data[section]) && data[section].length <= 200, 'Invalid section.');
      data[section].forEach(item => {
        const bullets = ['projects', 'experience'].includes(section);
        object(item, ['id', 'confirmed', ...names, ...(bullets ? ['bullets'] : [])]);
        id(item.id); assert(typeof item.confirmed === 'boolean', 'Invalid confirmation.'); names.forEach(k => str(item[k]));
        if (bullets) {
          assert(Array.isArray(item.bullets) && item.bullets.length <= 100, 'Invalid bullets.');
          item.bullets.forEach(b => { object(b, ['id', 'text']); id(b.id); str(b.text); });
        }
      });
    }
    return structuredClone(data);
  }
  function confirmed(data) {
    const result = blank();
    if (data.signature?.confirmed) result.signature = structuredClone(data.signature);
    if (data.contact.confirmed) result.contact = structuredClone(data.contact);
    for (const section of Object.keys(fields)) result[section] = structuredClone(data[section].filter(x => x.confirmed));
    return result;
  }
  function recognize(text) {
    return Object.entries(dictionary).filter(([, aliases]) => aliases.some(alias => {
      const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Bare JS is an alias; a .js suffix in Next.js/Node.js/React.js is not.
      const before = alias === 'js' ? '(^|[^\\p{L}\\p{N}_.+#])' : '(^|[^\\p{L}\\p{N}_+#])';
      return new RegExp(before + escaped + '(?=$|[^\\p{L}\\p{N}_+#])', 'iu').test(text);
    })).map(([name]) => name);
  }
  function evidence(data) {
    const d = confirmed(data), rows = [];
    if (d.contact.summary.trim()) rows.push({ section: 'Summary', text: d.contact.summary });
    for (const [section, names] of Object.entries(fields)) for (const item of d[section]) {
      const text = names.filter(k => k !== 'url').map(k => item[k]).filter(Boolean).join(' · ');
      if (text) rows.push({ section, text });
      for (const b of item.bullets || []) if (b.text.trim()) rows.push({ section, text: b.text });
    }
    return rows;
  }
  function match(data, job) {
    const rows = evidence(data);
    return recognize(job).map(skill => ({ skill, evidence: rows.filter(row => recognize(row.text).includes(skill)) }));
  }
  function validUrl(value) {
    try { const u = new URL(value); return ['https:', 'http:'].includes(u.protocol) && Boolean(u.hostname) && !u.username && !u.password; } catch { return false; }
  }
  function quality(data) {
    const issues = [];
    if (!data.contact.name.trim()) issues.push('Contact: add your name.');
    if (!data.contact.email.trim() && !data.contact.phone.trim()) issues.push('Contact: add an email address or phone number.');
    if (data.contact.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.contact.email)) issues.push('Contact: check your email address.');
    if (!data.contact.confirmed && contactFields.some(k => data.contact[k].trim())) issues.push('Contact details await confirmation.');
    for (const [section, names] of Object.entries(fields)) data[section].forEach((item, i) => {
      const label = `${section} ${i + 1}`;
      if (!names.some(k => item[k].trim()) && !(item.bullets || []).some(b => b.text.trim())) issues.push(`${label}: empty entry.`);
      if (!item.confirmed) issues.push(`${label}: awaiting confirmation; excluded from output.`);
      if (Object.hasOwn(item, 'url') && (item.url || section === 'links') && !validUrl(item.url)) issues.push(`${label}: use a valid http:// or https:// link.`);
      (item.bullets || []).forEach((b, j) => {
        if (!b.text.trim()) issues.push(`${label}, bullet ${j + 1}: empty bullet.`);
        if (b.text.length > 300 || b.text.trim().split(/\s+/).length > 45) issues.push(`${label}, bullet ${j + 1}: consider shortening (over 300 characters or 45 words).`);
      });
    });
    return issues;
  }
  function findBullet(data, target) {
    if (!['projects', 'experience'].includes(target.section)) return null;
    return data[target.section].find(e => e.id === target.entryId)?.bullets.find(b => b.id === target.bulletId) || null;
  }
  function approve(data, proposal, text, revision) {
    const b = findBullet(data, proposal);
    if (!b || b.text !== proposal.original || revision !== proposal.revision) throw new Error('Source changed. Request a new suggestion.');
    if (!text.trim() || text.length > 12000) throw new Error('Enter a non-empty suggestion of at most 12000 characters.');
    b.text = text.trim();
  }
  function market(sample) {
    if (!sample || typeof sample.scope !== 'string' || !sample.scope.trim() || !Array.isArray(sample.postings)) throw new Error('Supply sample scope and a postings array.');
    const seenIds = new Set(), seenUrls = new Set(), rows = [];
    for (const p of sample.postings) {
      if (!p || p.verified !== true || !['id','source','url','collectedAt','title','text','verifiedBy','verificationNote'].every(k => typeof p[k] === 'string' && p[k].trim()) || !validUrl(p.url) || !/^\d{4}-\d{2}-\d{2}$/.test(p.collectedAt) || !Number.isFinite(Date.parse(p.collectedAt)) || new Date(p.collectedAt).toISOString().slice(0,10) !== p.collectedAt || p.collectedAt > new Date().toISOString().slice(0,10)) throw new Error('Each posting needs verified source text, URL, valid collection date, verifier and verification note.');
      const url = new URL(p.url); url.hash = ''; url.searchParams.sort();
      const key = url.href.replace(/\/$/, '');
      if (seenIds.has(p.id) || seenUrls.has(key)) continue;
      seenIds.add(p.id); seenUrls.add(key); rows.push(p);
    }
    return { scope: sample.scope, rows, size: rows.length, skills: Object.keys(dictionary).map(skill => {
      const count = rows.filter(p => recognize(p.text).includes(skill)).length;
      return { skill, count, percent: rows.length ? Math.round(count / rows.length * 1000) / 10 : 0 };
    }).filter(s => s.count).sort((a,b) => b.count-a.count || a.skill.localeCompare(b.skill)) };
  }
  return { dictionary, fields, contactFields, blank, entry, validate, confirmed, recognize, evidence, match, validUrl, quality, findBullet, approve, market, uid };
});
