const {test} = require('node:test');
const assert = require('node:assert/strict');
const C = require('../public/core.js');
function fixture() { const d=C.blank(), e=C.entry('projects'); e.name='Timetable'; e.bullets=[{id:C.uid(),text:'Built a page using JavaScript.'},{id:C.uid(),text:'Tested form inputs.'}]; e.confirmed=true; d.projects.push(e); return d; }
test('blank data and confirmation exclude unconfirmed claims',()=>{
  const d=C.blank(); assert.equal(d.contact.name,''); assert.deepEqual(C.evidence(d),[]);
  const s=C.entry('skills'); s.name='Python'; d.skills.push(s);
  assert.deepEqual(C.confirmed(d).skills,[]); assert.equal(C.match(d,'Python')[0].evidence.length,0);
  s.confirmed=true; assert.equal(C.match(d,'Python')[0].evidence.length,1);
  assert.deepEqual(C.validate(d),d);
});
test('complete alias boundaries and job-specific results',()=>{
  assert.deepEqual(C.recognize('JavaScript, chair, GitHub, NoSQL'),['JavaScript']);
  assert.deepEqual(C.recognize('Java C++ C# XML node.js JS'),['JavaScript','Java','XML','Node.js','C++','C#']);
  const d=fixture(); assert.equal(C.match(d,'JavaScript')[0].evidence.length,1);
  assert.equal(C.match(d,'Java')[0].evidence.length,0);
  assert.deepEqual(C.match(d,'Python').map(x=>x.skill),['Python']);
});
test('approval changes only selected bullet, rejects changed source and edit/revert revisions',()=>{
  const d=fixture(),e=d.projects[0],b=e.bullets[0];
  const p={section:'projects',entryId:e.id,bulletId:b.id,original:b.text,revision:0};
  const before=structuredClone(d); C.approve(d,p,'Developed a page using JavaScript.',0);
  before.projects[0].bullets[0].text=b.text; assert.deepEqual(d,before);
  assert.throws(()=>C.approve(d,p,'Other',0),/Source changed/);
  b.text=p.original; assert.throws(()=>C.approve(d,p,'Other',2),/Source changed/);
  e.bullets=[]; assert.throws(()=>C.approve(d,p,'Other',0),/Source changed/);
});
test('quality checks are independent of job matching',()=>{
  const d=fixture(), e=C.entry('links'); e.url='javascript:alert(1)'; d.links.push(e);
  d.education.push(C.entry('education')); d.projects[0].bullets.push({id:C.uid(),text:'x'.repeat(301)});
  const result=C.quality(d).join('\n'); assert.match(result,/add your name/); assert.match(result,/email address or phone/); assert.match(result,/empty entry/); assert.match(result,/valid http/); assert.match(result,/shortening/);
});
test('synthetic market arithmetic counts unique posting mentions, not repeated words',()=>{
  const record=(id,url,text)=>({id,url,text,source:'Synthetic test',title:'Synthetic role',collectedAt:'2026-01-01',verified:true,verifiedBy:'Test fixture',verificationNote:'Synthetic unit test only'});
  const a=record('a','https://example.test/a','JavaScript JavaScript JavaScript'), b=record('b','https://example.test/b','Java Python');
  const result=C.market({scope:'Synthetic tests only',postings:[a,{...a}, {...a,id:'a-copy',url:a.url+'#fragment'},b,record('c','https://example.test/c','Python')]});
  assert.equal(result.size,3); assert.deepEqual(result.skills.find(s=>s.skill==='Python'),{skill:'Python',count:2,percent:66.7}); assert.equal(result.skills.find(s=>s.skill==='Java').count,1);
  assert.throws(()=>C.market({scope:'Test',postings:[{...a,verified:false}]}));
  assert.throws(()=>C.market({scope:'Test',postings:[{...a,collectedAt:'2026-02-30'}]}));
});
