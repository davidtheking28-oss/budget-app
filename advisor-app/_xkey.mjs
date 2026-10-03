import { chromium } from 'playwright';
const pages=['dashboard','crm','mapping','budget','analysis','goals','subs','credit','assets','mortgage'];
const theme=process.argv[2]||'dark';const W=+process.argv[3]||1440;
const sig=()=>{const el=document.activeElement;const cs=getComputedStyle(el);return {o:cs.outlineStyle+' '+cs.outlineWidth+' '+cs.outlineColor,s:cs.boxShadow,b:cs.borderTopColor+cs.borderBottomColor,bg:cs.backgroundColor,c:cs.color,td:cs.textDecorationLine}};
const desc=()=>{const el=document.activeElement;return el.tagName.toLowerCase()+(el.className&&typeof el.className==='string'?'.'+el.className.split(' ')[0].replace(/_[a-z0-9]{5,}_\d+$/,m=>m):'')+'['+(el.getAttribute('aria-label')||el.textContent||el.placeholder||el.type||'').trim().slice(0,22)+']'};
const b=await chromium.launch();
const ctx=await b.newContext({viewport:{width:W,height:900},colorScheme:theme});
await ctx.addInitScript(t=>localStorage.setItem('advisor_theme',t),theme);
const p=await ctx.newPage();
for(const k of pages){
 await p.goto(`http://localhost:5213/?client=11111111-1111-1111-1111-111111111111&nav=${k}`);
 await p.waitForTimeout(1500);
 await p.evaluate(()=>document.body.focus());
 const bad=[];let n=0;const seen=new Set();
 for(let i=0;i<140;i++){
  await p.keyboard.press('Tab');
  const d=await p.evaluate(desc);if(d.startsWith('body')&&i>0)break;seen.add(d);
  const s1=await p.evaluate(sig);
  const vis=await p.evaluate(()=>{const el=document.activeElement;const r=el.getBoundingClientRect();return r.width>0&&r.height>0});
  await p.evaluate(()=>{window.__e=document.activeElement;document.activeElement.blur()});
  const s2=await p.evaluate(sig);
  await p.evaluate(()=>window.__e.focus());
  n++;
  const hasOutline=!s1.o.startsWith('none')&&!s1.o.includes(' 0px')&&s1.o!==s2.o;
  const changed=hasOutline||s1.s!==s2.s||s1.b!==s2.b||s1.bg!==s2.bg;
  if(!changed||!vis)bad.push((vis?'':'HIDDEN ')+d+' '+JSON.stringify(s1.o)+(s1.o===s2.o?'':''));
  if(d==='body[]'&&i>3)break;
 }
 console.log(k,'stops',n,'uniq',seen.size,'noRing:',JSON.stringify([...new Set(bad)]));
}
await b.close();
