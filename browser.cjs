/* Browser integration tests. AI responses below are test-only network fixtures. */
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const {createServer} = require('../server.cjs');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
(async()=>{
  await fs.mkdir('test-results',{recursive:true});
  const server=createServer(); await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const base='http://127.0.0.1:'+server.address().port;
  let browser;
  try { browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL || 'msedge'}); }
  catch(e) { await new Promise(r=>server.close(r)); throw e; }
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  const page=await context.newPage(), errors=[], results=[];
  page.on('pageerror',e=>errors.push(e.message));
  const check=async(name,fn)=>{await fn();results.push(name);console.log('PASS '+name);};
  try{
    await page.goto(base);
    await check('Blank initial state; AI configuration pending',async()=>{
      assert.equal(await page.locator('#contact-name').inputValue(),'');
      await page.locator('[data-page="coach"]').first().click();
      await page.locator('#aiStatus').filter({hasText:'AI coach unavailable—API setup pending.'}).waitFor();
      assert.equal(await page.locator('#generate').isDisabled(),true);
    });
    await check('Live preview confirmation, local save and reload',async()=>{
      await page.locator('#navigation [data-page="builder"]').click();
      await page.locator('#contact-name').fill('Test Student & <Writer>');
      await page.locator('#contact-email').fill('student@example.test');
      assert.ok(!(await page.locator('#livePreview').innerText()).includes('Test Student'));
      await page.locator('[data-section="contact"] [data-confirm]').check();
      await page.locator('[data-section="projects"] [data-action="add-entry"]').click();
      const project=page.locator('[data-section="projects"] .entry').first();
      await project.locator('[data-field="name"]').fill('Timetable');
      await project.locator('[data-action="add-bullet"]').click();
      await project.locator('[data-bullet-text]').fill('Built a page using JavaScript.');
      await project.locator('[data-action="add-bullet"]').click();
      await project.locator('[data-bullet-text]').nth(1).fill('Tested form inputs.');
      await project.locator('[data-confirm]').check();
      await page.locator('[data-section="skills"] [data-action="add-entry"]').click();
      await page.locator('[data-section="skills"] [data-field="name"]').fill('Python');
      assert.ok(!(await page.locator('#livePreview').innerText()).includes('Python'));
      await page.reload();
      assert.equal(await page.locator('#contact-name').inputValue(),'Test Student & <Writer>');
      assert.equal(await page.locator('[data-section="projects"] [data-bullet-text]').first().inputValue(),'Built a page using JavaScript.');
      assert.ok((await page.locator('#livePreview').innerText()).includes('Built a page using JavaScript.'));
      assert.equal(await page.locator('#livePreview script').count(),0);
    });
    await check('XML complete-schema round trip, Unicode, multiline and invalid document rejection',async()=>{
      const result=await page.evaluate(()=>{
        const C=ResumeCore,X=ResumeXML,d=C.blank();
        C.contactFields.forEach(k=>d.contact[k]='नमस्ते & <"test">\nsecond line');d.contact.confirmed=true;
        for(const section of Object.keys(C.fields)){const e=C.entry(section);C.fields[section].forEach(k=>e[k]='Ω & <tag>\nmore');e.confirmed=true;if(e.bullets)e.bullets=[{id:C.uid(),text:'Built a résumé — 日本語 & XML.'}];d[section].push(e);}
        const parsed=X.parse(X.serialize(d));
        const bad=['<broken>','<resume/>','<!DOCTYPE resume [<!ENTITY x "value">]><resume version="2">&x;</resume>',X.serialize(d).replace('<confirmed>true</confirmed>','<confirmed>yes</confirmed>'),X.serialize(d).replace('<name>','<unknown>')];
        return {equal:JSON.stringify(d)===JSON.stringify(parsed),rejected:bad.map(x=>{try{X.parse(x);return false;}catch{return true;}})};
      });assert.equal(result.equal,true);assert.ok(result.rejected.every(Boolean));
    });
    await check('XML export excludes unconfirmed skills; invalid UI import preserves saved draft',async()=>{
      await page.locator('#navigation [data-page="export"]').click();
      const downloadEvent=page.waitForEvent('download');await page.locator('#exportXml').click();const download=await downloadEvent;
      await download.saveAs(path.resolve('test-results/resume.xml'));
      const xml=await fs.readFile('test-results/resume.xml','utf8');assert.ok(xml.includes('JavaScript'));assert.ok(!xml.includes('Python'));assert.ok(!xml.includes('500'));
      const before=await page.evaluate(()=>localStorage.getItem('elevateresume_data_v2'));
      await page.locator('#xmlFile').setInputFiles({name:'bad.xml',mimeType:'application/xml',buffer:Buffer.from('<resume><broken>')});
      await page.locator('#notice').filter({hasText:'Existing data is unchanged'}).waitFor();
      assert.equal(await page.evaluate(()=>localStorage.getItem('elevateresume_data_v2')),before);
      await page.locator('#xmlFile').setInputFiles(path.resolve('test-results/resume.xml'));
      await page.locator('#confirmImport').waitFor();
      assert.equal(await page.evaluate(()=>localStorage.getItem('elevateresume_data_v2')),before);
      await page.locator('#cancelImport').click();
    });
    await check('Job changes recompute matches; Java does not match JavaScript',async()=>{
      await page.locator('#navigation [data-page="matching"]').click();
      await page.locator('#job').fill('JavaScript developer');assert.match(await page.locator('#matches').innerText(),/1 of 1/);
      await page.locator('#job').fill('Java developer');assert.match(await page.locator('#matches').innerText(),/0 of 1/);assert.match(await page.locator('#matches').innerText(),/Not evidenced in your resume/);
      await page.locator('#job').fill('Python developer');assert.match(await page.locator('#matches').innerText(),/0 of 1/);
    });
    // Test-only adapter responses exercise UI contract without a provider/key.
    await page.route('**/api/coach/status',r=>r.fulfill({json:{available:true,provider:'TEST FIXTURE',model:'TEST ONLY'}}));
    let mode='success', held;
    await page.route('**/api/coach',async r=>{
      if(mode==='error')return r.fulfill({status:502,json:{error:'AI request failed. Resume unchanged.'}});
      const req=r.request().postDataJSON();
      const finish=()=>r.fulfill({json:{requestId:req.requestId,bulletId:req.bulletId,original:req.original,revision:req.revision,suggestion:'Developed a page using JavaScript.'}});
      if(mode==='held'){held=finish;return;}await finish();
    });
    await page.reload();
    async function selectCoach(){await page.locator('#navigation [data-page="coach"]').click();await page.locator('#bulletSelect').selectOption({index:1});await page.locator('#facts').fill('Built a page using JavaScript.');await page.locator('#factsConfirmed').check();}
    await check('AI test fixture approval changes only selected bullet; rejection changes nothing',async()=>{
      await selectCoach();const before=JSON.parse(await page.evaluate(()=>localStorage.getItem('elevateresume_data_v2')));
      await page.locator('#generate').click();await page.locator('#suggestion').waitFor({state:'visible'});await page.waitForFunction(()=>!document.getElementById('suggestion').disabled);
      await page.locator('#reject').click();assert.deepEqual(JSON.parse(await page.evaluate(()=>localStorage.getItem('elevateresume_data_v2'))),before);
      await page.locator('#generate').click();await page.waitForFunction(()=>!document.getElementById('suggestion').disabled);
      await page.locator('#suggestionConfirmed').check();await page.locator('#approve').click();
      before.projects[0].bullets[0].text='Developed a page using JavaScript.';
      assert.deepEqual(JSON.parse(await page.evaluate(()=>localStorage.getItem('elevateresume_data_v2'))),before);
    });
    await check('AI API error leaves resume unchanged',async()=>{
      mode='error';await selectCoach();const before=await page.evaluate(()=>localStorage.getItem('elevateresume_data_v2'));
      await page.locator('#generate').click();await page.locator('#aiFeedback').filter({hasText:'AI request failed'}).waitFor();
      assert.equal(await page.evaluate(()=>localStorage.getItem('elevateresume_data_v2')),before);assert.equal(await page.locator('#approve').isDisabled(),true);
    });
    await check('In-flight source edit-and-revert rejects stale AI insertion',async()=>{
      mode='held';await selectCoach();await page.locator('#generate').click();
      for(let i=0;i<50&&!held;i++)await new Promise(r=>setTimeout(r,20));assert.ok(held);
      await page.locator('#navigation [data-page="builder"]').click();const field=page.locator('[data-section="projects"] [data-bullet-text]').first();
      await field.fill('Changed source.');await field.fill('Developed a page using JavaScript.');await held();held=null;
      await page.locator('#navigation [data-page="coach"]').click();await page.locator('#aiFeedback').filter({hasText:'Source changed during request'}).waitFor();assert.equal(await page.locator('#approve').isDisabled(),true);
    });
    await check('Bundled market snapshot displays verified records',async()=>{
      await page.locator('#navigation [data-page="insights"]').click();await page.locator('#marketResults table').waitFor();assert.match(await page.locator('#marketResults').innerText(),/Skill frequency in our collected sample/);assert.equal(await page.locator('#marketResults .source-list>li').count(),17);
    });
    await check('Mobile navigation, no horizontal overflow, and print-only resume layout',async()=>{
      await page.locator('#navigation [data-page="builder"]').click();await page.locator('[data-section="projects"] [data-confirm]').check();
      await page.setViewportSize({width:390,height:844});
      for(const pageId of ['builder','preview','matching','coach','insights','quality','export']){await page.locator(`#navigation [data-page="${pageId}"]`).click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,pageId);}
      await page.locator('#navigation [data-page="builder"]').click();await page.screenshot({path:'test-results/mobile.png',fullPage:true,animations:'disabled'});
      await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:'test-results/desktop.png',fullPage:true,animations:'disabled'});
      await page.emulateMedia({media:'print'});assert.equal(await page.locator('.app').isVisible(),false);assert.equal(await page.locator('#print-area').isVisible(),true);
      assert.ok(!(await page.locator('#print-area').innerText()).includes('Python'));assert.ok((await page.locator('#print-area').innerText()).includes('Developed a page using JavaScript.'));
      await page.pdf({path:'test-results/print.pdf',preferCSSPageSize:true});await page.screenshot({path:'test-results/print.png',fullPage:true});await page.emulateMedia({media:'screen'});
    });
    await check('Valid XML UI import preserves content, requires reconfirmation, and reloads',async()=>{
      await page.locator('#navigation [data-page="export"]').click();
      await page.locator('#xmlFile').setInputFiles(path.resolve('test-results/resume.xml'));await page.locator('#confirmImport').click();
      assert.equal(await page.locator('#contact-name').inputValue(),'Test Student & <Writer>');
      assert.equal(await page.locator('[data-section="contact"] [data-confirm]').isChecked(),false);
      assert.equal(await page.locator('[data-section="projects"] [data-bullet-text]').first().inputValue(),'Built a page using JavaScript.');
      assert.match(await page.locator('#livePreview').innerText(),/No confirmed information/);
      await page.reload();assert.equal(await page.locator('#contact-name').inputValue(),'Test Student & <Writer>');
      assert.equal(await page.locator('[data-section="projects"] [data-bullet-text]').first().inputValue(),'Built a page using JavaScript.');
    });
    assert.deepEqual(errors,[]);results.push('No browser JavaScript errors');
    await fs.writeFile('test-results/browser.json',JSON.stringify({executedAt:new Date().toISOString(),browser:await browser.version(),results},null,2));
  } finally {await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
