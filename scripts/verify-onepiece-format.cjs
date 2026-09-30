const {chromium}=require('playwright');
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const origin=process.argv[2] || 'http://localhost:3108';
const root=process.argv[3] || process.cwd();
const out=path.join(root,'.tmp','format-qa');fs.mkdirSync(out,{recursive:true});
const catalog=JSON.parse(fs.readFileSync(path.join(root,'data/onepiece/catalog.json'),'utf8'));
const card=catalog.products.find(p=>p.kind==='card'),box=catalog.products.find(p=>p.kind==='box');
(async()=>{
 const browser=await chromium.launch();const results=[],errors=[];
 for(const width of [390,1280]){
  const context=await browser.newContext({viewport:{width,height:900}});const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  for(const [name,route] of [['pokemon','/'],['onepiece','/onepiece'],['ranking','/onepiece/ranking'],['ai','/onepiece/ai'],['card','/onepiece/products/'+card.id],['box','/onepiece/products/'+box.id],['mypage','/onepiece/mypage'],['watchlist','/onepiece/watchlist'],['accuracy','/onepiece/accuracy'],['portfolio','/onepiece/portfolio']]){
   const response=await page.goto(origin+route,{waitUntil:'domcontentloaded',timeout:90000});assert.equal(response.status(),200,route);
   await page.waitForTimeout(700);
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth > innerWidth+1);assert.equal(overflow,false,`${width} ${route} overflow`);
   if(name==='ranking'){
    assert.deepEqual(await page.getByRole('tab').allTextContents(),['売れ筋','お買い得','値動き','閲覧','みんなの予想','BOX']);
    await page.getByRole('tab',{name:'BOX',exact:true}).click();assert.ok(await page.locator('.boxrank-row').count());
    assert.ok((await page.locator('.boxrank-row').first().getAttribute('href')).startsWith('/onepiece/products/'));
    await page.getByRole('tab',{name:'売れ筋',exact:true}).click();
   }
   if(name==='onepiece'){
    assert.equal(await page.locator('.home-pulse .pulse').count(),1);assert.equal(await page.locator('.home-sales-card').count(),5);
    assert.equal(await page.locator('.boxrank-row').count(),3);
   }
   if(['pokemon','onepiece','ranking','ai','card','box','mypage'].includes(name))await page.screenshot({path:path.join(out,`${name}-${width}.png`),fullPage:true});
   results.push({width,route,status:response.status(),overflow});
  }
  await page.goto(origin+'/onepiece/ranking?tab=boxes');await page.getByRole('tab',{name:'BOX',exact:true}).waitFor();await page.waitForTimeout(500);assert.equal(await page.getByRole('tab',{name:'BOX',exact:true}).getAttribute('aria-selected'),'true');
  await page.goto(origin+'/onepiece/sets/'+box.set_id);assert.equal(new URL(page.url()).pathname,'/onepiece/products/'+box.id);
  await context.close();
 }
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({origin,results,errors},null,2));console.log(JSON.stringify({origin,checked:results.length,errors,out}));await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});

