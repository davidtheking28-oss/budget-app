import { chromium } from 'playwright';
const SP='C:/Users/david/AppData/Local/Temp/claude/c--Users-david-projects-ai-budget/19e33a93-7d7d-4c0d-b5c4-94bbdb95a1a8/scratchpad/a11y/';
const pages=['dashboard','crm','mapping','budget','analysis','goals','subs','credit','assets','mortgage'];
const theme=process.argv[2]||'dark';
const widths=[1440,390];
const inpage = () => {
  const cv=document.createElement('canvas');cv.width=cv.height=1;const cx=cv.getContext('2d',{willReadFrequently:true});
  const parse=c=>{cx.clearRect(0,0,1,1);cx.fillStyle='#000';cx.fillStyle=c;cx.fillRect(0,0,1,1);const d=cx.getImageData(0,0,1,1).data;return [d[0],d[1],d[2],d[3]/255];};
  const lum=([r,g,b])=>{const f=v=>{v/=255;return v<=.03928?v/12.92:((v+.055)/1.055)**2.4};return .2126*f(r)+.7152*f(g)+.0722*f(b)};
  const over=(f,b)=>{const a=f[3];return [0,1,2].map(i=>f[i]*a+b[i]*(1-a)).concat([1])};
  const bgOf=el=>{let layers=[];let e=el;while(e){const cs=getComputedStyle(e);const c=parse(cs.backgroundColor);if(c[3]>0)layers.push(c);if(c[3]>=1)break;e=e.parentElement}
    let base=[0,0,0,1];const bg=parse(getComputedStyle(document.body).backgroundColor);if(bg[3]>0)base=bg;
    if(layers.length&&layers[layers.length-1][3]>=1)base=layers.pop();
    for(let i=layers.length-1;i>=0;i--)base=over(layers[i],base);return base};
  const cr=(a,b)=>{const l1=lum(a),l2=lum(b);return (Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05)};
  const sel=el=>{let s=el.tagName.toLowerCase();if(el.className&&typeof el.className==='string')s+='.'+el.className.split(' ')[0];const t=(el.textContent||'').trim().slice(0,25);return s+'['+t+']'};
  const out={text:[],ui:[],small:[],noname:[],headings:[],hard:[]};
  const seen=new Set();
  for(const el of document.querySelectorAll('body *')){
    const cs=getComputedStyle(el);if(cs.visibility==='hidden'||cs.display==='none')continue;
    const r=el.getBoundingClientRect();if(r.width===0||r.height===0)continue;
    const hasText=[...el.childNodes].some(n=>n.nodeType===3&&n.textContent.trim());
    if(hasText){let fg=parse(cs.color);const bg=bgOf(el);let op=1;let e=el;while(e){op*=parseFloat(getComputedStyle(e).opacity);e=e.parentElement}
      fg=[fg[0],fg[1],fg[2],fg[3]*op];const f=over(fg,bg);const ratio=cr(f,bg);const size=parseFloat(cs.fontSize);const bold=parseInt(cs.fontWeight)>=700;const large=size>=24||(size>=18.66&&bold);
      const need=large?3:4.5;if(ratio<need){const k=sel(el)+cs.color;if(!seen.has(k)){seen.add(k);out.text.push({el:sel(el),ratio:+ratio.toFixed(2),fg:cs.color,bg:'rgb('+bg.slice(0,3).map(Math.round)+')',size,op})}}}
    const tag=el.tagName;const interactive=['BUTTON','A','INPUT','SELECT','TEXTAREA'].includes(tag)||el.getAttribute('role')==='button'||el.hasAttribute('tabindex');
    if(interactive&&!(tag==='INPUT'&&el.type==='hidden')){
      const bgc=bgOf(el.parentElement||el);const bw=parseFloat(cs.borderTopWidth);const bc=parse(cs.borderTopColor);
      const ebg=parse(cs.backgroundColor);
      if((tag==='INPUT'||tag==='SELECT'||tag==='TEXTAREA')&&el.type!=='checkbox'&&el.type!=='radio'){
        const b=bw>0?over(bc,bgc):null;const fillc=ebg[3]>0?over(ebg,bgc):null;
        const best=Math.max(b?cr(b,bgc):1,fillc?cr(fillc,bgc):1);
        if(best<3)out.ui.push({el:sel(el),ratio:+best.toFixed(2),border:cs.borderTopColor,bw});
      }
      if(r.height<24||r.width<24){const k=sel(el);out.small.push({el:k,w:Math.round(r.width),h:Math.round(r.height)})}
      else if(innerWidth<500&&(r.height<44||r.width<44))out.small.push({el:sel(el),w:Math.round(r.width),h:Math.round(r.height),touch:1});
      const name=(el.getAttribute('aria-label')||el.getAttribute('aria-labelledby')||el.textContent||el.getAttribute('title')||el.placeholder||'').trim();
      const lab=el.labels&&el.labels.length;const wrap=el.closest('label');
      if(!name&&!lab&&!wrap&&tag!=='INPUT')out.noname.push(sel(el)+el.outerHTML.slice(0,90));
      if((tag==='INPUT'||tag==='SELECT'||tag==='TEXTAREA')&&!lab&&!wrap&&!el.getAttribute('aria-label')&&!el.getAttribute('aria-labelledby')&&!el.title)out.noname.push('INPUT-unlabelled '+el.outerHTML.slice(0,110));
      if(el.closest('[aria-hidden="true"]'))out.noname.push('ARIA-HIDDEN-FOCUSABLE '+sel(el));
    }
  }
  out.headings=[...document.querySelectorAll('h1,h2,h3,h4')].map(h=>h.tagName+':'+h.textContent.trim().slice(0,20));
  return out;
};
const b=await chromium.launch();
for(const w of widths){
 const ctx=await b.newContext({viewport:{width:w,height:w>800?900:844},colorScheme:theme});
 await ctx.addInitScript(t=>localStorage.setItem('advisor_theme',t),theme);
 const p=await ctx.newPage();
 for(const k of pages){
  await p.goto(`http://localhost:5213/?client=11111111-1111-1111-1111-111111111111&nav=${k}`);
  await p.waitForTimeout(1800);
  if(process.argv[3]==='open'){
   for(let round=0;round<2;round++){
    const btns=await p.$$('button');
    for(const bt of btns){const t=((await bt.textContent())||'').trim();if(/^\+|עריכה|חדשה|חדש$|עבד|ניתוח/.test(t)&&!/הוסף יתרת/.test(t)){try{await bt.click({timeout:500})}catch(e){}}}
   }
   await p.waitForTimeout(500);
  }
  const r=await p.evaluate(inpage);
  console.log('=====',k,w,theme);console.log(JSON.stringify(r));
  await p.screenshot({path:SP+`${theme}-${process.argv[3]||''}${k}-${w}.png`,fullPage:true});
 }
 await ctx.close();
}
await b.close();
