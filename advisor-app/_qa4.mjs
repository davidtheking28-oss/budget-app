import {start,go,log,body,SH,errs} from './_lib.mjs';
const {b,p}=await start();p.setDefaultTimeout(5000);
const T=async(n,f)=>{try{const r=await f();log(n,r!==false,typeof r==='string'?r:'')}catch(e){log(n,false,'EXC '+e.message.split('\n')[0])}};
const has=async s=>(await body(p)).includes(s);
const W=()=>p.waitForTimeout(500);
await go(p,'goals');
console.log((await body(p)).split('\n').slice(19,60).join(' | '));
await T('goal add',async()=>{await p.getByRole('button',{name:'+ הוסף יעד'}).click();await p.locator('input[aria-label="שם היעד"]').fill('QA יעד');await p.locator('input[aria-label="סכום היעד"]').fill('10000');await p.locator('input[aria-label="מספר חודשים ליעד"]').fill('10');await p.getByRole('button',{name:'הוסף יעד',exact:true}).click();await W();return await has('QA יעד')});
await p.screenshot({path:SH+'goals.png'});
const card=()=>p.locator('div').filter({has:p.getByText('QA יעד',{exact:true})}).filter({has:p.getByRole('button',{name:'הוסף לחיסכון'})}).last();
console.log('card text:',(await card().innerText()).replace(/\n/g,' | '));
await T('goal deposit',async()=>{const c=card();const before=await c.innerText();const inp=c.locator('input[type=number]');console.log('inputs',await inp.count());await inp.first().fill('500');await c.getByRole('button',{name:'הוסף לחיסכון'}).click();await W();const after=await card().innerText();console.log(after.replace(/\n/g,' | '));return before!==after&&after.includes('500')});
await T('goal withdraw',async()=>{const c=card();const inp=c.locator('input[type=number]');await inp.first().fill('200');await c.getByRole('button',{name:/משוך/}).click();await W();const after=await card().innerText();console.log(after.replace(/\n/g,' | '));return after.includes('300')});
await T('goal delete',async()=>{await card().getByRole('button',{name:'מחק יעד'}).click();await W();return !(await has('QA יעד'))});
// subs
await go(p,'subs');
const sections=[['הוסף מנוי','שם המנוי','QA מנוי',{'סכום המנוי':'99'},'הוסף מנוי'],['הוסף ביטוח','שם הביטוח','QA ביטוח',{'סכום חודשי לביטוח':'150'},'הוסף ביטוח'],['הוסף פריט','','QA טיפוח',{},'הוסף'],['הוסף אירוע','','QA אירוע',{},'הוסף'],['הוסף פריט','','QA חינוך',{},'הוסף'],['הוסף הוצאה','','QA הוצאה',{},'הוסף']];
console.log('subs headings', await p.evaluate(()=>[...document.querySelectorAll('button[aria-expanded]')].map(b=>b.innerText.replace(/\n/g,' ')+':'+b.getAttribute('aria-expanded'))));
await p.screenshot({path:SH+'subs0.png'});
