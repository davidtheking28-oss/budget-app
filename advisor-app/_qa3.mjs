import {start,go,log,body,SH,errs} from './_lib.mjs';
const {b,p}=await start();
const T=async(n,f)=>{try{const r=await f();log(n,r!==false,typeof r==='string'?r:'')}catch(e){log(n,false,'EXC '+e.message.split('\n')[0])}};
const has=async s=>(await body(p)).includes(s);
await go(p,'crm');
await T('hero shows',async()=>{const t=await body(p);return /יאיר|אברמוביץ/.test(t)?'':'name?'+t.slice(0,200)});
console.log((await body(p)).slice(0,400).replace(/\n/g,' | '));
await p.screenshot({path:SH+'crm-hero.png'});
// quick actions
await T('quick action משימה חדשה opens task form+focus',async()=>{await p.getByRole('button',{name:'משימה חדשה'}).click();await p.waitForTimeout(500);return await p.locator('textarea[aria-label="משימות"]').isVisible() && await p.evaluate(()=>document.activeElement?.getAttribute('aria-label'))==='משימות' ? '' : 'focus='+await p.evaluate(()=>document.activeElement?.outerHTML.slice(0,80))});
await T('add task',async()=>{await p.locator('textarea[aria-label="משימות"]').fill('QA משימה ראשונה');await p.getByRole('button',{name:'הוסף משימה'}).click();await p.waitForTimeout(600);return await has('QA משימה ראשונה')});
await T('toggle done',async()=>{const cb=p.getByRole('checkbox',{name:/QA משימה ראשונה/});await cb.click();await p.waitForTimeout(500);return await cb.isChecked()});
await T('edit task',async()=>{await p.getByText('QA משימה ראשונה').first().click();await p.waitForTimeout(300);const inp=p.locator('input[class*=input]').filter({hasNot:p.locator('x')}).first();
  const i=p.locator('input[value="QA משימה ראשונה"]');await i.fill('QA ערוכה');await p.getByRole('button',{name:'שמור'}).click();await p.waitForTimeout(500);return (await has('QA ערוכה'))&&!(await has('QA משימה ראשונה'))});
await T('delete task',async()=>{const row=p.locator('div').filter({hasText:/^QA ערוכה/}).last();await p.getByRole('button',{name:'מחק'}).nth(await p.evaluate(()=>0)).count();
  const btns=p.locator('[class*=task]').filter({hasText:'QA ערוכה'});const n0=await p.getByRole('button',{name:'מחק'}).count();
  await p.getByRole('checkbox',{name:/QA ערוכה/}).locator('xpath=ancestor::*[.//button[@aria-label="מחק"]][1]').getByRole('button',{name:'מחק'}).click();await p.waitForTimeout(500);return !(await has('QA ערוכה'))});
// meeting
await T('quick action פגישה חדשה opens form',async()=>{await p.getByRole('button',{name:'פגישה חדשה'}).click();await p.waitForTimeout(500);return await p.locator('input[aria-label="נושא הפגישה"]').isVisible()});
await T('add meeting',async()=>{await p.locator('input[aria-label="נושא הפגישה"]').first().fill('QA פגישת בדיקה');await p.locator('input[type=datetime-local]').first().fill('2026-11-05T10:00');await p.getByRole('button',{name:'קבע פגישה'}).click();await p.waitForTimeout(600);return await has('QA פגישת בדיקה')});
await p.screenshot({path:SH+'crm-after-meeting.png'});
// profile
await T('profile edit',async()=>{await p.getByRole('button',{name:/עריכת פרטים/}).click().catch(()=>{});await p.waitForTimeout(300);
 await p.locator('input[aria-label="טלפון"]').fill('050-1234567');await p.locator('textarea[aria-label="רקע על הלקוח"]').fill('רקע QA');await p.getByRole('button',{name:'שמור',exact:true}).first().click();await p.waitForTimeout(700);
 return (await has('050-1234567'))&&(await has('רקע QA'))});
await p.screenshot({path:SH+'crm-profile.png'});
// tags / personal-business
await T('personal/business toggle',async()=>{const biz=p.getByRole('button',{name:'עסקי'});await biz.click();await p.waitForTimeout(500);const a=await biz.getAttribute('aria-pressed')+'|'+await biz.getAttribute('class');await p.getByRole('button',{name:'פרטי'}).click();await p.waitForTimeout(400);return a+' -> '+await p.getByRole('button',{name:'פרטי'}).getAttribute('class')});
await T('add tag',async()=>{await p.getByRole('button',{name:'+ הוסף תגית'}).click();await p.waitForTimeout(300);const i=p.locator('input:focus');await i.fill('QAתגית');await i.press('Enter');await p.waitForTimeout(500);return await has('QAתגית')});
await p.screenshot({path:SH+'crm-tag.png'});
await T('remove tag',async()=>{console.log(await p.evaluate(()=>[...document.querySelectorAll('button')].filter(b=>/QAתגית|הסר|מחק תגית/.test(b.innerText+b.getAttribute('aria-label'))).map(b=>b.outerHTML.slice(0,160))));
 await p.getByRole('button',{name:/הסר.*QAתגית|QAתגית.*(הסר|מחק)|מחק.*QAתגית/}).first().click();await p.waitForTimeout(400);return !(await has('QAתגית'))});
await T('add phone via + הוסף טלפון',async()=>{const bt=p.getByRole('button',{name:'+ הוסף טלפון'});if(!await bt.count())return 'n/a (phone now set)';await bt.click();await p.waitForTimeout(300);return await p.locator('input[aria-label="טלפון"]').isVisible()});
console.log('ERRS',errs);await b.close();
