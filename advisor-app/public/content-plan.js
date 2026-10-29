(function(){
var booted=false;
function boot(P){
var DATA=P.DATA,BANK=P.BANK,GUIDES=P.GUIDES;
var D=['ראשון','שלישי','רביעי','חמישי'];
var saved={};
try{saved=JSON.parse(localStorage.getItem('plan-done')||'{}')}catch(e){}
function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;')}
function words(it){if(it.slides)return 0;var a=(it.open||[]).concat((it.body||[]).map(function(b){return b[1]}),it.end||[]);return a.join(' ').split(/\s+/).filter(Boolean).length}
function len(it){if(it.slides)return it.len||(it.slides.length+' שקפים');var w=words(it);return w?'כ-'+Math.round(w/2.5/5)*5+' שניות':''}
function needs(it){var s=JSON.stringify([it.open,it.body,it.end,it.note]);if(s.indexOf('[__]')>-1)return 'צריך ממך: מספרים';if(/רק אם תחליט|באישור המשפחה|שותף/.test(it.note||''))return 'צריך ממך: החלטה';return ''}
var out='';
DATA.weeks.forEach(function(w){
out+='<div class="week"><div class="whead"><h2>שבוע '+w.n+'</h2><span class="goal">'+esc(w.goal)+'</span></div><div class="cards">';
w.items.forEach(function(id,i){
var it=DATA.items[id],v=it.type==='v',nd=it.ready?'':needs(it);
out+='<div class="c'+(v?' v':'')+(saved[id]?' done':'')+'" data-id="'+id+'"><div class="head"><span class="day">'+D[i]+'<small>'+w.dates[i]+'</small></span>'
+'<label class="done-box"><input type="checkbox"'+(saved[id]?' checked':'')+'>הועלה</label></div>'
+'<div class="tags"><span class="tag k">'+(v?'ערך':'חשיפה')+'</span><span class="tag f">'+esc(it.fmt)+'</span>'+(it.ready?'<span class="tag f">מוכן</span>':'')+'</div>'
+'<div class="t">'+esc(it.title)+'</div>'
+(it.formula?'<div class="fm">נוסחה: '+esc(it.formula.replace(/^\d+\.\s*/,''))+'</div>':'')
+(it.ready?'<div class="nt">'+esc(it.note)+'</div>':'')
+(nd?'<div class="need">'+nd+'</div>':'')
+(it.ready?'':'<button class="open" type="button" data-open="'+id+'">לתסריט · '+esc(len(it))+'</button>')
+'</div>';
});
out+='</div></div>';
});
document.getElementById('weeks').innerHTML=out;
function count(){var all=document.querySelectorAll('.c input'),n=0;all.forEach(function(c){if(c.checked)n++});document.getElementById('pcount').textContent=n+' מתוך '+all.length+' הועלו';document.getElementById('pbar').style.width=(100*n/all.length)+'%'}
document.querySelectorAll('.c').forEach(function(r){var c=r.querySelector('input');c.addEventListener('change',function(){r.classList.toggle('done',c.checked);saved[r.getAttribute('data-id')]=c.checked;try{localStorage.setItem('plan-done',JSON.stringify(saved))}catch(e){}count();notify()})});
count();
function notify(){try{if(window.parent!==window)window.parent.postMessage({type:'content-plan:done',done:saved},location.origin)}catch(e){}}
window.addEventListener('message',function(e){if(e.origin!==location.origin||!e.data||e.data.type!=='content-plan:state')return;saved=e.data.done||{};try{localStorage.setItem('plan-done',JSON.stringify(saved))}catch(x){}document.querySelectorAll('.c').forEach(function(r){var on=!!saved[r.getAttribute('data-id')];r.classList.toggle('done',on);r.querySelector('input').checked=on});count()});
var filt='top';
function drawBank(){
document.getElementById('bankList').innerHTML=BANK.map(function(g,gi){
var items=g.items.filter(function(i){return filt==='all'||(filt==='top'?i.top:String(gi)===filt)});
if(!items.length)return '';
return '<div class="bgrp"><h3>'+esc(g.f)+'<small>'+items.length+' רעיונות</small></h3><div class="bitems">'+items.map(function(i){return '<div class="bi'+(i.top?' top':'')+'"><b>'+(i.top?'<span class="star">★</span> ':'')+esc(i.t)+'</b><span class="o">"'+esc(i.o)+'"</span><span class="by">מבוסס על: '+esc(i.b)+'</span>'+(i.flag?'<span class="fl">'+esc(i.flag)+'</span>':'')+(i.sl?'<details class="sl"><summary>'+i.sl.length+' שקפים, הטקסט המלא</summary><ol>'+i.sl.map(function(s){return '<li>'+esc(s)+'</li>'}).join('')+'</ol></details>':'')+'</div>'}).join('')+'</div></div>'}).join('');
document.querySelectorAll('#bankChips .chip').forEach(function(c){c.setAttribute('aria-pressed',c.getAttribute('data-f')===filt?'true':'false')});
}
var total=BANK.reduce(function(a,g){return a+g.items.length},0),tops=BANK.reduce(function(a,g){return a+g.items.filter(function(i){return i.top}).length},0);
document.getElementById('bankChips').innerHTML='<button class="chip" type="button" data-f="top">★ מומלצים ('+tops+')</button><button class="chip" type="button" data-f="all">הכל ('+total+')</button>'+BANK.map(function(g,gi){return '<button class="chip" type="button" data-f="'+gi+'">'+esc(g.f.replace(/^\d+\.\s*/,''))+'</button>'}).join('');
document.querySelectorAll('#bankChips .chip').forEach(function(c){c.addEventListener('click',function(){filt=c.getAttribute('data-f');drawBank()})});
drawBank();
document.getElementById('gDemand').innerHTML=GUIDES.demand.map(function(x){return '<div class="gr"><b>'+x.n.toLocaleString('en-US')+'</b><div>'+esc(x.t)+'<div class="m">תגיבו "'+esc(x.w)+'" · '+esc(x.u)+' · '+esc(x.k)+'</div></div></div>'}).join('');
document.getElementById('gIdeas').innerHTML=GUIDES.ideas.map(function(x){return '<div class="bi'+(x.top?' top':'')+'"><b>'+(x.top?'<span class="star">★</span> ':'')+esc(x.t)+'</b><span class="kw">תגיבו "'+esc(x.w)+'"</span><span class="o">'+esc(x.d)+'</span><span class="by">מבוסס על: '+esc(x.b)+'</span><span class="by">זמן הכנה: '+esc(x.e)+(x.vid?' · מתאים לסרטון: '+esc(x.vid):'')+'</span>'+(x.flag?'<span class="fl">'+esc(x.flag)+'</span>':'')+'</div>'}).join('');
document.getElementById('gHow').innerHTML=GUIDES.how.map(function(s){return '<li>'+esc(s)+'</li>'}).join('');
var tabs=document.querySelectorAll('.tab');
function show(id){tabs.forEach(function(t){var on=t.getAttribute('data-tab')===id;t.setAttribute('aria-selected',on?'true':'false');t.tabIndex=on?0:-1;document.getElementById(t.getAttribute('data-tab')).hidden=!on});try{localStorage.setItem('plan-tab',id)}catch(e){}}
tabs.forEach(function(t){t.addEventListener('click',function(){show(t.getAttribute('data-tab'));window.scrollTo(0,0)})});
var start='plan',h=(location.hash||'').slice(1);
if(['plan','bank','guides','diff','ideas','profile'].indexOf(h)>-1)start=h;else{try{var s=localStorage.getItem('plan-tab');if(s&&document.getElementById(s))start=s}catch(e){}}
show(start);
var sheet=document.getElementById('sheet'),scrim=document.getElementById('scrim'),last=null;
function line(kind,t,s){return '<div class="line '+(kind==='x'?'x1':'f1')+'"><span class="k">'+(kind==='x'?'להגיד בדיוק':'במילים שלך')+'</span><span>'+esc(t)+'</span>'+(s?'<span class="s">על המסך: '+esc(s)+'</span>':'')+'</div>'}
function openS(id,btn){
var it=DATA.items[id],h='';
h+='<div class="sh"><div style="display:flex;flex-direction:column;gap:6px"><h2 id="shT">'+esc(it.title)+'</h2><div class="meta"><span>'+esc(it.fmt)+' · '+esc(len(it))+'</span>'+(it.formula?'<span>נוסחה: '+esc(it.formula)+'</span>':'')+(it.ref?'<span>דוגמה: '+esc(it.ref)+'</span>':'')+'</div></div><button class="x" type="button" aria-label="סגירה">×</button></div>';
if(it.note)h+='<p class="note">'+esc(it.note)+'</p>';
if(it.screen)h+='<p class="cap">'+esc(it.screen)+'</p>';
if(it.slides){h+='<div class="blk"><h4>שקפים</h4><ol class="slides">'+it.slides.map(function(s,i){return '<li><b>'+(i+1)+'</b>'+esc(s)+'</li>'}).join('')+'</ol></div>'}
else{
h+='<div class="blk"><h4>פתיחה, 0–3 שניות</h4>'+it.open.map(function(t){return line('x',t,'')}).join('')+'</div>';
h+='<div class="blk"><h4>גוף</h4>'+it.body.map(function(b){return line(b[0],b[1],b[2])}).join('')+'</div>';
h+='<div class="blk"><h4>סיום</h4>'+it.end.map(function(t){return line('x',t,'')}).join('')+'</div>';
}
if(it.numbers&&it.numbers.length)h+='<div class="blk"><h4>מספרים ומקורות</h4><ul>'+it.numbers.map(function(n){return '<li>'+esc(n)+'</li>'}).join('')+'</ul></div>';
if(it.caption)h+='<div class="blk"><h4>כיתוב לפוסט</h4><p class="cap">'+esc(it.caption)+'</p></div>';
if(it.alt)h+='<div class="blk"><h4>פתיחות חלופיות</h4><ul>'+it.alt.map(function(a){return '<li>'+esc(a)+'</li>'}).join('')+'</ul></div>';
sheet.innerHTML=h;sheet.hidden=false;scrim.hidden=false;sheet.scrollTop=0;last=btn;
sheet.querySelector('.x').addEventListener('click',closeS);sheet.querySelector('.x').focus();
}
function closeS(){sheet.hidden=true;scrim.hidden=true;if(last)last.focus()}
scrim.addEventListener('click',closeS);
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!sheet.hidden)closeS()});
document.querySelectorAll('[data-open]').forEach(function(b){b.addEventListener('click',function(){openS(b.getAttribute('data-open'),b)})});
}
window.addEventListener('message',function(e){
if(booted||e.origin!==location.origin||!e.data||e.data.type!=='content-plan:content')return;
booted=true;
document.getElementById('app').innerHTML=e.data.html;
boot(e.data);
});
try{if(window.parent!==window)window.parent.postMessage({type:'content-plan:ready'},location.origin)}catch(e){}
})();
