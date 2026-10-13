const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const {createServer}=require('../server.cjs');
const C=require('../public/core.js');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const pages=['dashboard','builder','preview','matching','coach','insights','quality','export'];
(async()=>{
  const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
  const results=[],errors=[],contrast=[];
  try{
    await fs.mkdir('test-results/theme',{recursive:true});
    browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL || 'msedge'});
    const page=await browser.newPage({viewport:{width:1440,height:1000}});
    page.on('pageerror',e=>errors.push(e.message));
    const base='http://127.0.0.1:'+server.address().port;
    const check=async(name,fn)=>{await fn();results.push(name);console.log('PASS '+name);};
    await page.goto(base);
    await check('Fresh sessions default to the professional light dashboard; useful statuses and actions work',async()=>{
      assert.equal(await page.locator('html').getAttribute('data-theme'),'light');
      assert.equal(await page.locator('.page.active').getAttribute('data-page'),'dashboard');
      await page.locator('#overviewMarket').filter({hasText:'17 unique postings'}).waitFor();
      assert.equal(await page.locator('#overviewConfirmed').innerText(),'0');
      assert.equal(await page.locator('#overviewContact').innerText(),'Not added');
      await page.locator('[data-goto="builder"]').click();assert.equal(await page.locator('#currentPage').innerText(),'Resume Builder');
    });
    await check('Saved dark preferences receive the new neutral theme and the visible switch persists',async()=>{
      await page.evaluate(()=>localStorage.setItem('elevateresume_theme','dark'));await page.reload();
      assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
      assert.equal(await page.locator('#theme').innerText(),'Light theme');
      assert.equal(await page.evaluate(()=>getComputedStyle(document.body).backgroundColor),'rgb(21, 28, 38)');
      await page.locator('#theme').click();await page.reload();
      assert.equal(await page.locator('html').getAttribute('data-theme'),'light');
      assert.equal(await page.evaluate(()=>localStorage.getItem('elevateresume_theme')),'light');
    });
    const d=C.blank();d.contact={name:'Presentation Test Student',title:'Web Technologies Student',email:'student@example.test',phone:'',location:'India',summary:'Built a timetable interface using HTML, CSS and JavaScript.',confirmed:true};
    const project=C.entry('projects');project.name='University timetable';project.role='Frontend developer';project.url='https://example.test/project';project.confirmed=true;project.bullets=[{id:C.uid(),text:'Built a timetable interface using HTML, CSS and JavaScript.'},{id:C.uid(),text:'Validated form inputs and documented the XML data structure.'}];d.projects.push(project);
    await page.evaluate(data=>localStorage.setItem('elevateresume_data_v2',JSON.stringify(data)),d);await page.reload();
    await check('Overview reflects saved confirmations; matching uses explicit evidence labels',async()=>{
      await page.locator('#navigation [data-page="dashboard"]').click();assert.equal(await page.locator('#overviewConfirmed').innerText(),'1');assert.equal(await page.locator('#overviewContact').innerText(),'Confirmed');
      await page.locator('#navigation [data-page="matching"]').click();await page.locator('#job').fill('JavaScript and Python');
      assert.match(await page.locator('#matches').innerText(),/Evidence found/);assert.match(await page.locator('#matches').innerText(),/No evidence found/);assert.match(await page.locator('#matches').innerText(),/Not evidenced in your resume/);
    });
    await check('All eight pages fit desktop, tablet and mobile widths in light and dark themes',async()=>{
      for(const theme of ['light','dark']){
        if(await page.locator('html').getAttribute('data-theme')!==theme) await page.locator('#theme').click();
        for(const width of [1440,768,390,320]){
          await page.setViewportSize({width,height:1000});
          for(const name of pages){
            await page.locator(`#navigation [data-page="${name}"]`).click();
            assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`${theme} ${width} ${name}`);
            assert.equal(await page.locator('section.page.active').count(),1);
            const effects=await page.locator('.app *').evaluateAll(nodes=>nodes.some(el=>{const s=getComputedStyle(el);return /gradient/.test(s.backgroundImage)||s.backdropFilter!=='none'||s.animationName!=='none';}));assert.equal(effects,false);
            if(theme==='light' && (width===1440 || width===390)){await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:`test-results/theme/${name}-${width}.png`});}
          }
        }
      }
      await page.setViewportSize({width:1440,height:1000});await page.locator('#navigation [data-page="dashboard"]').click();await page.screenshot({path:'test-results/theme/dashboard-dark.png'});
    });
    await check('Theme text pairs meet 4.5:1; form boundaries and keyboard focus meet 3:1',async()=>{
      for(const theme of ['light','dark']){
        const measured=await page.evaluate(theme=>{
          document.documentElement.dataset.theme=theme;
          const s=getComputedStyle(document.documentElement),color=k=>s.getPropertyValue('--'+k).trim();
          const lum=hex=>{let h=hex.replace('#','');if(h.length===3)h=h.split('').map(c=>c+c).join('');return h.match(/../g).map(v=>parseInt(v,16)/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4).reduce((n,c,i)=>n+c*[.2126,.7152,.0722][i],0);};
          const ratio=(a,b)=>{const x=lum(color(a)),y=lum(color(b));return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
          const pairs=[];
          for(const fg of ['text','text-dim','heading','accent'])for(const bg of ['bg','surface','surface-soft'])pairs.push({fg,bg,ratio:ratio(fg,bg),minimum:4.5});
          for(const [fg,bg] of [['accent','accent-soft'],['on-accent','accent'],['on-accent','accent-hover'],['disabled-text','disabled-bg']])pairs.push({fg,bg,ratio:ratio(fg,bg),minimum:4.5});
          for(const fg of ['input-border','focus'])for(const bg of ['surface','bg'])pairs.push({fg,bg,ratio:ratio(fg,bg),minimum:3});
          return pairs;
        },theme);
        measured.forEach(p=>assert.ok(p.ratio>=p.minimum,`${theme}: ${p.fg}/${p.bg} ${p.ratio}`));contrast.push({theme,pairs:measured});
      }
    });
    await check('Keyboard skip link, navigation and form fields have visible focus',async()=>{
      await page.goto(base);await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(()=>document.activeElement.className),'skip-link');
      assert.equal(await page.locator('.skip-link').evaluate(el=>getComputedStyle(el).outlineWidth),'3px');
      await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>document.activeElement.id),'mainContent');
      await page.locator('#navigation [data-page="builder"]').focus();await page.keyboard.press('Enter');
      assert.equal(await page.locator('.page.active').getAttribute('data-page'),'builder');
      await page.locator('#contact-name').focus();await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(()=>document.activeElement.id),'contact-title');
      assert.equal(await page.locator('#contact-title').evaluate(el=>getComputedStyle(el).outlineWidth),'3px');
    });
    await check('Long content wraps without page overflow; confirmed-only print stays white in both themes',async()=>{
      const long=structuredClone(d);long.contact.name='VeryLongName'.repeat(35);long.contact.summary='Long summary text for wrapping. '.repeat(80);
      long.projects[0].url='https://example.test/'+ 'long-path'.repeat(45);
      long.projects[0].bullets=Array.from({length:18},(_,i)=>({id:C.uid(),text:`Bullet ${i+1}: `+'A detailed user-confirmed project description for pagination checks. '.repeat(5)}));
      const skill=C.entry('skills');skill.name='UnconfirmedSkill';long.skills.push(skill);
      await page.evaluate(data=>localStorage.setItem('elevateresume_data_v2',JSON.stringify(data)),long);await page.reload();
      await page.setViewportSize({width:320,height:900});
      for(const name of ['dashboard','builder','preview','matching','coach']){await page.locator(`#navigation [data-page="${name}"]`).click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,name);}
      await page.setViewportSize({width:1440,height:1000});
      for(const theme of ['light','dark']){
        await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);await page.emulateMedia({media:'print'});
        assert.equal(await page.locator('.app').isVisible(),false);assert.equal(await page.locator('.skip-link').isVisible(),false);
        assert.equal(await page.locator('#print-area').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(255, 255, 255)');
        assert.ok(!(await page.locator('#print-area').innerText()).includes('UnconfirmedSkill'));assert.ok((await page.locator('#print-area').innerText()).includes('Bullet 18:'));
        await page.pdf({path:`test-results/theme/long-print-${theme}.pdf`,preferCSSPageSize:true});
        await page.emulateMedia({media:'screen'});
      }
      await page.evaluate(data=>localStorage.setItem('elevateresume_data_v2',JSON.stringify(data)),d);await page.reload();await page.emulateMedia({media:'print'});await page.screenshot({path:'test-results/theme/print.png'});await page.emulateMedia({media:'screen'});
    });
    assert.deepEqual(errors,[]);await fs.writeFile('test-results/theme/checks.json',JSON.stringify({date:new Date().toISOString(),browser:browser.version(),results,contrast,errors},null,2));
  }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
