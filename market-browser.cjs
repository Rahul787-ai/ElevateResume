// Market-only browser checks. Imported subsets reuse real collected postings.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const {createServer}=require('../server.cjs');
const sample=require('../public/market-sample.json');
const expected=require('./market-expected.json');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
(async()=>{
  const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
  let browser;
  const results=[],errors=[];
  try{
    browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL || 'msedge'});
    const page=await browser.newPage({viewport:{width:1440,height:1000}});
    page.on('pageerror',e=>errors.push(e.message));
    const base='http://127.0.0.1:'+server.address().port;
    const check=async(name,fn)=>{await fn();results.push(name);console.log('PASS '+name);};
    const upload=async value=>page.locator('#marketFile').setInputFiles({name:'reviewed-sample.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(value))});
    const subset={...sample,scope:'Test import of the first two real records from the bundled collection.',postings:sample.postings.slice(0,2)};
    await check('Default bundled dataset loads and renders all independently checked counts and percentages',async()=>{
      await page.goto(base+'/#insights');await page.locator('#marketResults table').waitFor();
      assert.match(await page.locator('#marketResults').innerText(),/Skill frequency in our collected sample/);
      assert.match(await page.locator('#marketStatus').innerText(),/Bundled sample loaded: 17 unique postings/);
      const actual=await page.locator('#marketResults tbody tr').evaluateAll(rows=>Object.fromEntries(rows.map(row=>[row.cells[0].textContent,[Number(row.cells[1].textContent),parseFloat(row.cells[2].textContent)]])));
      const independent=Object.fromEntries(Object.entries(expected.counts).map(([skill,n])=>[skill,[n,Number((n*100/17).toFixed(1))]]));
      assert.deepEqual(actual,independent);
    });
    await check('All source links, collector identity, collection date and known/unknown posting dates render',async()=>{
      const links=await page.locator('#marketResults .source-list>li>a').evaluateAll(nodes=>nodes.map(n=>n.href));
      assert.deepEqual(links,sample.postings.map(p=>p.url));
      assert.equal(await page.locator('#marketResults .source-list>li').count(),17);
      const text=await page.locator('#marketResults').innerText();
      assert.match(text,/2026-10-09/);assert.match(text,/Posting date: 2026-09-19/);
      assert.equal((text.match(/Posting date: Unknown/g)||[]).length,16);
      assert.equal((text.match(/Codex \(OpenAI\), AI-assisted collector/g)||[]).length,17);
      await page.locator('#marketResults .source-list summary').first().click();
      assert.ok((await page.locator('#marketResults .source-list>li').first().innerText()).includes(sample.postings[0].text));
    });
    await check('Manual import replaces bundled sample; invalid import preserves the displayed valid sample',async()=>{
      await upload(subset);await page.locator('#marketStatus').filter({hasText:'Imported sample loaded: 2 unique postings'}).waitFor();
      assert.equal(await page.locator('#marketResults .source-list>li').count(),2);
      await upload({...subset,postings:[{...subset.postings[0],verified:false}]});
      await page.locator('#marketStatus').filter({hasText:'Import failed; the previously displayed sample is unchanged'}).waitFor();
      assert.equal(await page.locator('#marketResults .source-list>li').count(),2);
      await page.locator('#loadBundledMarket').click();await page.locator('#marketStatus').filter({hasText:'Bundled sample loaded: 17 unique postings'}).waitFor();
    });
    await check('HTTP failure gives an honest empty state and retry restores the bundled data',async()=>{
      await page.route('**/market-sample.json',r=>r.fulfill({status:404,json:{error:'Not found'}}));
      await page.locator('#loadBundledMarket').click();await page.locator('#marketStatus').filter({hasText:'HTTP 404'}).waitFor();
      assert.match(await page.locator('#marketResults').innerText(),/No verified sample loaded/);assert.equal(await page.locator('#marketResults table').count(),0);
      await page.unroute('**/market-sample.json');await page.locator('#loadBundledMarket').click();await page.locator('#marketResults table').waitFor();
    });
    await check('Malformed bundled JSON and invalid schema never display statistics',async()=>{
      await page.route('**/market-sample.json',r=>r.fulfill({contentType:'application/json',body:'{broken'}));
      await page.locator('#loadBundledMarket').click();await page.locator('#marketStatus').filter({hasText:'could not be loaded'}).waitFor();assert.equal(await page.locator('#marketResults table').count(),0);
      await page.unroute('**/market-sample.json');await page.route('**/market-sample.json',r=>r.fulfill({json:{scope:'Invalid schema',postings:[{}]}}));
      await page.locator('#loadBundledMarket').click();await page.locator('#marketStatus').filter({hasText:'could not be loaded'}).waitFor();assert.equal(await page.locator('#marketResults table').count(),0);await page.unroute('**/market-sample.json');
    });
    await check('Slow bundled response cannot overwrite a later manual import',async()=>{
      let release;const requested=new Promise(resolve=>{release=resolve;});let held;
      await page.route('**/market-sample.json',r=>{held=r;release();});
      await page.locator('#loadBundledMarket').click();await requested;
      await upload(subset);await page.locator('#marketStatus').filter({hasText:'Imported sample loaded: 2 unique postings'}).waitFor();
      const finished=page.waitForResponse(r=>r.url().endsWith('/market-sample.json'));
      await held.fulfill({json:sample});await finished;
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      assert.equal(await page.locator('#marketResults .source-list>li').count(),2);
      assert.match(await page.locator('#marketStatus').innerText(),/Imported sample loaded/);await page.unroute('**/market-sample.json');
    });
    await check('Zero-record import has no percentages; page reload restores the default snapshot',async()=>{
      await upload({...sample,postings:[]});await page.locator('#marketStatus').filter({hasText:'0 unique postings'}).waitFor();
      assert.equal(await page.locator('#marketResults table').count(),0);assert.match(await page.locator('#marketResults').innerText(),/No percentages available/);
      await page.reload();await page.locator('#marketStatus').filter({hasText:'Bundled sample loaded: 17 unique postings'}).waitFor();
    });
    await check('Market dashboard is usable at desktop and 390px width',async()=>{
      await fs.mkdir('test-results',{recursive:true});
      await page.screenshot({path:'test-results/market-desktop.png',animations:'disabled'});
      await page.setViewportSize({width:390,height:844});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
      assert.equal(await page.locator('#loadBundledMarket').isVisible(),true);
      assert.equal(await page.locator('#marketFile').isVisible(),true);
      await page.locator('#marketResults table').scrollIntoViewIfNeeded();
      await page.screenshot({path:'test-results/market-mobile.png',animations:'disabled'});
    });
    assert.deepEqual(errors,[]);
    await fs.writeFile('test-results/market-browser.json',JSON.stringify({executedAt:new Date().toISOString(),browser:browser.version(),results,errors},null,2));
  }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
