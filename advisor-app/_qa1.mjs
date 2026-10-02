import {start,go,log,body,SH,errs} from './_lib.mjs';
const {b,p}=await start();
await go(p,'dashboard');
const labels=['דשבורד','לקוח','מיפוי כלכלי','תקציב','ניתוח','יעדים','מנויים','הלוואות ואשראי','נכסים והתחייבויות','אפיון נדלני'];
for(const l of labels){await p.getByRole('button',{name:l,exact:true}).first().click();await p.waitForTimeout(500);
 const cur=await p.evaluate(()=>document.querySelector('nav [aria-current]')?.getAttribute('aria-label'));
 log('nav '+l,cur===l,'current='+cur+' url='+p.url().split('nav=')[1]);}
console.log('groups:',await p.evaluate(()=>[...document.querySelectorAll('nav span')].map(s=>s.innerText).filter(Boolean).join('|')));
await p.getByRole('button',{name:'חיפוש לקוח'}).click();await p.waitForTimeout(400);await p.screenshot({path:SH+'search.png'});
console.log('search open inputs:',await p.evaluate(()=>[...document.querySelectorAll('input')].map(i=>i.placeholder||i.type)));
await p.keyboard.press('Escape');await p.waitForTimeout(300);
await p.getByRole('button',{name:'הלקוחות שלי'}).click();await p.waitForTimeout(600);
console.log('clients page:',(await body(p)).slice(0,150).replace(/\n/g,' | '));await p.screenshot({path:SH+'clients.png'});
await go(p,'dashboard');
// theme
const t0=await p.evaluate(()=>document.documentElement.dataset.theme||document.body.className);
await p.getByRole('button',{name:/עבור למצב/}).click();await p.waitForTimeout(300);
const t1=await p.evaluate(()=>document.documentElement.dataset.theme||document.body.className);
log('theme toggle',t0!==t1,t0+'->'+t1);
await p.getByRole('button',{name:/עבור למצב/}).click();
// account menu
const acc=p.getByRole('button',{name:/^חשבון/});
await acc.click();await p.waitForTimeout(300);
const panel=p.locator('[class*=accountPanel]').first();
const bb=await panel.boundingBox(); const ab=await acc.boundingBox();
console.log('panel',bb,'trigger',ab);
log('account opens upward',bb&&bb.y+bb.height<=ab.y+ab.height+2 && bb.y>=0 && bb.x>=0 && bb.x+bb.width<=1400,'');
await p.screenshot({path:SH+'account.png'});
const inps=p.locator('[class*=accountPanel] input');const n=await inps.count();let foc=0;
for(let i=0;i<n;i++){await inps.nth(i).focus();if(await inps.nth(i).evaluate(e=>document.activeElement===e))foc++;}
log('account inputs focusable',n>=2&&foc===n,n+' inputs');
await p.keyboard.press('Escape');await p.waitForTimeout(300);
log('account closes Escape',await panel.count()===0);
await acc.click();await p.waitForTimeout(200);await p.mouse.click(700,300);await p.waitForTimeout(300);
log('account closes outside click',await p.locator('[class*=accountPanel]').count()===0);
// month nav
for(const k of ['dashboard','budget','analysis','mortgage']){
 await go(p,k);const t=async()=>(await body(p));
 const m0=await p.evaluate(()=>[...document.querySelectorAll('button')].find(b=>/20\d\d/.test(b.innerText))?.innerText);
 const b0=await t();
 await p.getByRole('button',{name:'חודש קודם'}).click();await p.waitForTimeout(700);
 const m1=await p.evaluate(()=>[...document.querySelectorAll('button')].find(b=>/20\d\d/.test(b.innerText))?.innerText);const b1=await t();
 await p.getByRole('button',{name:'חודש הבא'}).click();await p.waitForTimeout(500);
 await p.getByRole('button',{name:'חודש הבא'}).click();await p.waitForTimeout(700);
 const m2=await p.evaluate(()=>[...document.querySelectorAll('button')].find(b=>/20\d\d/.test(b.innerText))?.innerText);
 await p.getByRole('button',{name:m2}).click().catch(()=>{});await p.waitForTimeout(500);
 const m3=await p.evaluate(()=>[...document.querySelectorAll('button')].find(b=>/20\d\d/.test(b.innerText))?.innerText);
 log('month '+k,m0!==m1&&m1!==m2,[m0,m1,m2,m3].join(' / ')+' dataChanged='+(b0!==b1));
}
// mobile
const m=await p.context().newPage();await m.setViewportSize({width:390,height:844});
m.on('pageerror',e=>errs.push('PE m '+e.message));m.on('console',x=>{if(x.type()==='error')errs.push('CE m '+x.text())});
await go(m,'dashboard');await m.screenshot({path:SH+'m-dash.png'});
console.log('mobile buttons:',await m.evaluate(()=>[...document.querySelectorAll('button')].filter(b=>b.offsetParent).map(b=>(b.getAttribute('aria-label')||b.innerText).trim().slice(0,25)).join('|')));
const macc=m.getByRole('button',{name:/^חשבון/});
console.log('acc visible',await macc.isVisible());await macc.click();await m.waitForTimeout(300);
const mp=m.locator('[class*=accountPanel]').first();console.log('mpanel',await mp.boundingBox());await m.screenshot({path:SH+'m-account.png'});
await m.keyboard.press('Escape');
console.log('ERRS',errs);await b.close();
