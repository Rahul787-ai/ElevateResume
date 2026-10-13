const {test} = require('node:test');
const assert = require('node:assert/strict');
const C = require('../public/core.js');
const {createServer} = require('../server.cjs');
const sample = require('../public/market-sample.json');
const expected = require('./market-expected.json');

test('every collected posting satisfies the actual application validator and provenance contract',()=>{
  for(const p of sample.postings){
    assert.equal(C.market({scope:sample.scope,postings:[p]}).size,1,p.id);
    assert.equal(p.collectedAt,'2026-10-09'); assert.match(p.verifiedBy,/AI-assisted collector/);
    assert.ok(p.idType && Object.hasOwn(p,'employerPostingId'));
    assert.ok(Object.hasOwn(p,'postedAt')); assert.ok(p.postedAt===null || p.postedAt<=p.collectedAt);
    assert.ok(p.location && p.level && p.verificationNote.length>60);
  }
  assert.equal(sample.postings.filter(p=>p.postedAt===null).length,16);
  assert.equal(sample.postings.find(p=>p.source==='Moonfire Private Limited').postedAt,'2026-09-19');
});
test('independent record identities and denominator agree: 17 unique roles and publishers',()=>{
  const canonical=url=>{const u=new URL(url);return u.hostname.replace(/^www\./,'')+u.pathname.replace(/\/$/,'');};
  assert.equal(sample.postings.length,expected.size);
  assert.equal(new Set(sample.postings.map(p=>p.id)).size,expected.size);
  assert.equal(new Set(sample.postings.map(p=>canonical(p.url))).size,expected.size);
  assert.equal(new Set(sample.postings.map(p=>p.source)).size,expected.size);
  assert.deepEqual(sample.postings.map(p=>p.id).sort(),Object.keys(expected.records).sort());
  assert.equal(C.market(sample).size,expected.size);
});
test('all per-record recognized skills match independently reviewed excerpt annotations',()=>{
  for(const p of sample.postings) assert.deepEqual(C.recognize(p.text).sort(),[...expected.records[p.id]].sort(),p.id);
  const independentlyTallied={};
  Object.values(expected.records).forEach(skills=>new Set(skills).forEach(s=>independentlyTallied[s]=(independentlyTallied[s]||0)+1));
  assert.deepEqual(independentlyTallied,expected.counts);
  const actual=C.market(sample);
  assert.deepEqual(Object.fromEntries(actual.skills.map(s=>[s.skill,s.count])),expected.counts);
  actual.skills.forEach(s=>assert.equal(s.percent,Number((expected.counts[s.skill]*100/expected.size).toFixed(1)),s.skill));
});
test('real-record duplicates and repeated skill mentions cannot inflate the denominator or counts',()=>{
  const a=sample.postings[0], b=sample.postings[1];
  const modified={...sample,postings:[...sample.postings,{...a,url:a.url+'?duplicate-copy=1'},{...b,id:b.id+'-alternate',url:b.url+'#copy'}]};
  assert.deepEqual(C.market(modified).skills,C.market(sample).skills);assert.equal(C.market(modified).size,17);
  const repeated={...sample,postings:sample.postings.map(p=>({...p,text:p.text+' '+p.text}))};
  assert.deepEqual(C.market(repeated).skills,C.market(sample).skills);
});
test('JS alias does not match framework/runtime suffixes; literal skill names still match',()=>{
  assert.deepEqual(C.recognize('Next.js'),[]);assert.deepEqual(C.recognize('React.js'),['React']);assert.deepEqual(C.recognize('Node.js'),['Node.js']);
  assert.deepEqual(C.recognize('JS, JavaScript, Java'),['JavaScript','Java']);
  assert.deepEqual(C.recognize('TypeScript MySQL GitHub'),[]);
});
test('server serves the exact bundled dataset as JSON',async t=>{
  const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
  t.after(()=>new Promise(r=>server.close(r)));
  const response=await fetch('http://127.0.0.1:'+server.address().port+'/market-sample.json');
  assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/application\/json/);
  assert.deepEqual(await response.json(),sample);
});
