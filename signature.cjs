// Synthetic image fixture; never a real person's signature.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const {chromium}=require('C:/Users/arahu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {createServer}=require('../server.cjs');
(async()=>{
 const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port+'/#builder');
  await page.locator('#contact-name').fill('Signature Demo');
  await page.locator('[data-section="contact"] [data-confirm]').check();
  const uri=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=400;c.height=120;const x=c.getContext('2d');x.fillStyle='white';x.fillRect(0,0,400,120);x.strokeStyle='#183855';x.lineWidth=3;x.beginPath();x.moveTo(20,85);x.bezierCurveTo(65,5,85,140,120,40);x.bezierCurveTo(150,0,155,110,210,65);x.lineTo(345,70);x.stroke();return c.toDataURL('image/png');});
  await page.locator('#signatureFile').setInputFiles({name:'synthetic-signature.png',mimeType:'image/png',buffer:Buffer.from(uri.split(',')[1],'base64')});
  await page.locator('#signatureStatus').filter({hasText:'Signature uploaded'}).waitFor();
  assert.equal(await page.locator('#fullPreview .resume-signature').count(),0);
  await page.locator('#signatureConfirmed').check();
  await page.locator('#fullPreview .resume-signature img').waitFor({state:'attached'});
  await page.reload();assert.equal(await page.locator('#signatureConfirmed').isChecked(),true);
  assert.ok(await page.locator('#signatureImage').isVisible());
  const xmlChecks=await page.evaluate(()=>{const d=JSON.parse(localStorage.getItem('elevateresume_data_v2'));const xml=ResumeXML.serialize(d);const restored=ResumeXML.parse(xml);const old=ResumeXML.parse(xml.replace(/<signature>[\s\S]*?<\/signature>/,''));return {roundtrip:JSON.stringify(d)===JSON.stringify(restored),old:old.signature.image==='',xml};});
  assert.ok(xmlChecks.roundtrip);assert.ok(xmlChecks.old);
  await page.locator('#signatureFile').setInputFiles({name:'bad.png',mimeType:'image/png',buffer:Buffer.from('not an image')});
  await page.locator('#signatureStatus').filter({hasText:'unchanged'}).waitFor();
  assert.equal(await page.locator('#fullPreview .resume-signature img').count(),1);
  await page.emulateMedia({media:'print'});
  await page.locator('#print-area .resume-signature img').evaluate(img=>img.decode());
  const bounds=await page.locator('#print-area .resume-signature').evaluate(el=>{const r=el.getBoundingClientRect(),i=el.querySelector('img').getBoundingClientRect();return {right:Math.abs(r.right-i.right)<2,below:r.top>=el.previousElementSibling.getBoundingClientRect().bottom};});
  assert.ok(bounds.right && bounds.below);
  await page.screenshot({path:'test-results/signature-print.png',fullPage:true});
  await page.emulateMedia({media:'screen'});
  await page.locator('#navigation [data-page="export"]').click();
  await page.locator('#xmlFile').setInputFiles({name:'signature.xml',mimeType:'application/xml',buffer:Buffer.from(xmlChecks.xml)});
  await page.locator('#confirmImport').click();
  assert.equal(await page.locator('#signatureConfirmed').isChecked(),false);
  assert.equal(await page.locator('#fullPreview .resume-signature img').count(),0);
  await page.locator('#signatureConfirmed').check();
  await page.locator('#removeSignature').click();
  assert.equal(await page.locator('#fullPreview .resume-signature img').count(),0);
  assert.equal(await page.locator('#signatureImage').isVisible(),false);
  await page.setViewportSize({width:390,height:844});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.deepEqual(errors,[]);
  console.log('PASS signature upload, opt-in, persistence, XML roundtrip and backward compatibility, invalid image, print alignment, import review, removal, mobile width.');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
