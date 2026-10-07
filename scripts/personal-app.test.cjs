const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
function storage(values={}) {
  const data={...values};
  return new Proxy({}, {
    ownKeys:()=>Object.keys(data),
    getOwnPropertyDescriptor:()=>({enumerable:true,configurable:true}),
    get:(_,key)=>({getItem:k=>data[k]??null,setItem:(k,v)=>{data[k]=String(v);},removeItem:k=>{delete data[k];}})[key],
  });
}
function functions(names,extra={}) {
  const ctx=vm.createContext({localStorage:storage(),Date,JSON,Map,Set,...extra});
  for(const name of names){
    const match=html.match(new RegExp('(?:async )?function '+name+'\\([^]*?\\n\\}'));
    assert.ok(match,'missing '+name);
    vm.runInContext(match[0],ctx);
  }
  return ctx;
}
test('switching accounts preserves both copies and isolates automatic backups',()=>{
  const localStorage=storage({budget_local_owner:'alice',budget_tx:'[1]',budget_autobackup:'alice-backup',budget_theme:'dark','sb-auth-token':'token'});
  const ctx=functions(['_accountKeys','_switchLocalAccount'],{localStorage});
  assert.equal(ctx._switchLocalAccount('bob'),true);
  assert.equal(localStorage.getItem('budget_tx'),null);
  assert.equal(localStorage.getItem('budget_autobackup'),null);
  assert.equal(localStorage.getItem('budget_theme'),'dark');
  assert.equal(localStorage.getItem('sb-auth-token'),'token');
  localStorage.setItem('budget_tx','[2]');
  ctx._switchLocalAccount('alice');
  assert.equal(localStorage.getItem('budget_tx'),'[1]');
  assert.equal(localStorage.getItem('budget_autobackup'),'alice-backup');
  ctx._switchLocalAccount('bob');
  assert.equal(localStorage.getItem('budget_tx'),'[2]');
});
test('unknown legacy data is archived as guest rather than uploaded into a new account',()=>{
  const localStorage=storage({budget_tx:'[1]'});
  const ctx=functions(['_accountKeys','_switchLocalAccount'],{localStorage});
  ctx._switchLocalAccount('bob');
  assert.equal(localStorage.getItem('budget_tx'),null);
  ctx._switchLocalAccount('guest');
  assert.equal(localStorage.getItem('budget_tx'),'[1]');
});
test('corrupt local data recovers from a valid backup and retains the damaged value',()=>{
  const localStorage=storage({budget_tx:'{broken',budget_autobackup:JSON.stringify({data:{budget_tx:'[{"id":1}]'}})});
  const ctx=functions(['_readStored'],{localStorage});
  assert.equal(JSON.stringify(ctx._readStored('budget_tx',[])),'[{"id":1}]');
  assert.equal(localStorage.getItem('budget_corrupt:budget_tx'),'{broken');
});
test('valid JSON with the wrong collection shape does not crash startup',()=>{
  const ctx=functions(['_readStored'],{localStorage:storage({budget_tx:'null',budget_limits:'[]'})});
  assert.equal(JSON.stringify(ctx._readStored('budget_tx',[])),'[]');
  assert.equal(JSON.stringify(ctx._readStored('budget_limits',{})),'{}');
});
test('offline CDN libraries are served from cache but Supabase requests are untouched',async()=>{
  const listeners={};let result;
  vm.runInNewContext(fs.readFileSync(path.join(root,'sw.js'),'utf8'),{
    self:{location:{origin:'https://example.test'},addEventListener:(event,fn)=>{listeners[event]=fn;}},URL,
    caches:{match:async()=>({cached:true})},fetch:()=>{throw Error('offline');},Response,
  });
  listeners.fetch({request:{method:'GET',url:'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js',headers:{get:()=>''}},respondWith:p=>{result=p;}});
  assert.ok(result,'CDN cache must be intercepted');
  assert.equal((await result).cached,true);
  result=null;
  listeners.fetch({request:{method:'GET',url:'https://project.supabase.co/rest/v1/budget_data'},respondWith:p=>{result=p;}});
  assert.equal(result,null);
});
test('a changed cloud version is treated as a conflict instead of a successful save',async()=>{
  const filters=[];
  const query={eq:(...args)=>{filters.push(args);return query;},select:()=>query,maybeSingle:async()=>({data:null,error:null})};
  const db={from:()=>({update:()=>query})};
  const ctx=functions(['_writeBudgetVersion'],{_sb:db});
  const result=await ctx._writeBudgetVersion({user_id:'alice',updated_at:'new'}, {updated_at:'old'});
  assert.equal(result.conflict,true);
  assert.deepEqual(filters,[['user_id','alice'],['updated_at','old']]);
});
test('new rows use insert and a duplicate identity is retried as a conflict',async()=>{
  const ctx=functions(['_writeBudgetVersion'],{_sb:{from:()=>({insert:()=>({select:()=>({maybeSingle:async()=>({error:{code:'23505'}})})})})}});
  const result=await ctx._writeBudgetVersion({user_id:'alice'},null);
  assert.equal(result.conflict,true);
});
test('closing the page flushes pending local edits',()=>{
  assert.match(html,/addEventListener\('pagehide',\s*_flushLocalSave\)/);
  assert.match(html,/document\.hidden\)\s*_flushLocalSave\(\)/);
});

test('all inline scripts remain valid JavaScript',()=>{
  const blocks=html.match(/<script(?![^>]*src=)[^>]*>[^]*?<\/script>/g)||[];
  assert.ok(blocks.length>0);
  for(const block of blocks)new vm.Script(block.replace(/^<script[^>]*>/,'').replace(/<\/script>$/,''));
});
test('an interrupted account switch resumes from the saved transition',()=>{
  const localStorage=storage({budget_local_owner:'alice',budget_tx:'partial',budget_account_transition:JSON.stringify({next:'bob',data:{budget_tx:'[2]'}})});
  const ctx=functions(['_accountKeys','_switchLocalAccount'],{localStorage});
  ctx._switchLocalAccount('bob');
  assert.equal(localStorage.getItem('budget_tx'),'[2]');
  assert.equal(localStorage.getItem('budget_account_transition'),null);
  assert.equal(localStorage.getItem('budget_local_owner'),'bob');
});
function cloudContext(onWrite=()=>{}) {
  let reads=0,writes=0,local=[{id:'a',u:1}],scheduled=0;
  const payloads=[];
  const row=()=>({user_id:'alice',updated_at:'2026-01-01T00:00:00Z',transactions:reads===1?[{id:'a',u:1}]:[{id:'a',u:1},{id:'b',u:2}]});
  const query={eq:()=>query,select:()=>query,maybeSingle:async()=>{writes++;onWrite(ctx);return {data:writes===1?null:{user_id:'alice'},error:null};}};
  const db={from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>{reads++;return {data:row(),error:null};}})}),update:payload=>{payloads.push(payload);return query;}})};
  const ctx=functions(['_mergeArrays','_writeBudgetVersion','_doCloudSave'],{
    _sb:db,_cloudUser:{id:'alice'},_activeMode:'personal',_localAccountReady:true,_canWriteLocalData:()=>true,
    localStorage:storage({budget_local_owner:'alice'}),_modeKey:k=>k,_getDataUserId:()=> 'alice',
    _cloudSaveInFlight:false,_cloudSaveQueued:false,_syncPending:true,_localSaveVersion:0,_syncFailedNotified:false,
    _syncMeta:{bu:{}},userSettings:{},_renderSyncStatus:()=>{},_syncRetryTimer:null,_missingCols:new Set(),_OPTIONAL_COLS:[],_setSyncState:()=>{},
    _buildMerged:bundle=>({transactions:ctx._mergeArrays(local,bundle.transactions,{})}),
    _applyMerged:merged=>{local=merged.transactions;return false;},
    scheduleCloudSave:()=>{scheduled++;},showToast:()=>{},refreshAll:()=>{},
    _DEBUG:false,clearTimeout:()=>{},setTimeout:()=>0,
  });
  return {ctx,payloads,reads:()=>reads,scheduled:()=>scheduled};
}
test('personal cloud save retries a conflicting write and preserves concurrent additions',async()=>{
  const {ctx,payloads,reads}=cloudContext();
  await ctx._doCloudSave();
  assert.equal(reads(),2);
  assert.equal(payloads.length,2);
  assert.equal(JSON.stringify(payloads[1].transactions.map(t=>t.id)),'["a","b"]');
  assert.equal(ctx._syncPending,false);
});
test('edits arriving during a cloud write remain queued for the next save',async()=>{
  const {ctx,scheduled}=cloudContext(ctx=>{ctx._localSaveVersion++;});
  await ctx._doCloudSave();
  assert.equal(ctx._syncPending,true);
  assert.equal(scheduled(),1);
  assert.equal(ctx.localStorage.getItem('budget_sync_pending'),'1');
});
test('a tab from the previous account cannot flush edits into the newly selected account',()=>{
  let saves=0;
  const ctx=functions(['_canWriteLocalData','_flushLocalSave'],{
    localStorage:storage({budget_local_owner:'bob'}),_localStorageOwner:'alice',_localAccountReady:true,
    _saveDataDebounceTimer:1,clearTimeout:()=>{},saveData:()=>{saves++;},
  });
  ctx._flushLocalSave();
  assert.equal(saves,0);
});

function viewportContext(){
  const sheets=new Map();
  const vv={height:500,offsetTop:0,listeners:{},addEventListener:(name,fn)=>{vv.listeners[name]=fn;}};
  function overlay(wizard,open=true){
    const sheet={style:{},classList:{contains:cls=>wizard&&cls==='wiz-sheet'}};
    return {open,style:{},querySelector:()=>sheet,sheet};
  }
  const main=overlay(true),child=overlay(false);
  sheets.set('main',main);sheets.set('child',child);
  const window={visualViewport:vv,innerHeight:844,openSheet:id=>{sheets.get(id).open=true;},closeSheet:id=>{sheets.get(id).open=false;}};
  const document={querySelectorAll:selector=>[...sheets.values()].filter(ov=>selector.includes(':not(.open)')?!ov.open:selector.includes('.open')?ov.open:true)};
  const source=html.match(/\(function\(\)\{\s*var vv=window\.visualViewport;[^]*?\}\)\(\);/);
  assert.ok(source);
  vm.runInNewContext(source[0],{window,document,setTimeout:fn=>fn()});
  vv.listeners.resize();
  return {window,vv,main,child};
}
test('closing a nested dialog keeps the remaining wizard sized to the keyboard viewport',()=>{
  const {window,main}=viewportContext();
  window.closeSheet('child');
  assert.equal(main.sheet.style.height,'500px');
  assert.equal(main.sheet.style.maxHeight,'500px');
});
test('viewport panning updates the keyboard offset without requiring a resize',()=>{
  const {vv,child}=viewportContext();
  vv.offsetTop=120;
  assert.equal(typeof vv.listeners.scroll,'function');
  vv.listeners.scroll();
  assert.equal(child.style.paddingBottom,'224px');
});
test('fullscreen input wizard follows the visible top after keyboard panning',()=>{
  const {vv,main}=viewportContext();
  vv.offsetTop=120;
  vv.listeners.scroll();
  assert.equal(main.style.paddingTop,'120px');
  assert.equal(main.sheet.style.height,'500px');
});

function syncStatusContext(extra={}){
  return functions(['_syncStatus'],{_cloudUser:{id:'alice'},_localSaveFailed:false,_cloudSyncVerified:true,_cloudSaveFailed:false,_cloudSaveInFlight:false,_syncPending:false,navigator:{onLine:true},...extra});
}
test('pending edits are never described as synchronized',()=>{
  const ctx=syncStatusContext({_syncPending:true});
  assert.equal(ctx._syncStatus().state,'pending');
  assert.match(ctx._syncStatus().text,/ממתין לסנכרון/);
});
test('offline edits distinguish local storage from cloud backup',()=>{
  const ctx=syncStatusContext({_syncPending:true,navigator:{onLine:false}});
  assert.equal(ctx._syncStatus().state,'offline');
  assert.match(ctx._syncStatus().text,/נשמר במכשיר/);
});
test('cloud backup is not claimed before the first successful cloud read',()=>{
  const ctx=syncStatusContext({_cloudSyncVerified:false});
  assert.equal(ctx._syncStatus().state,'checking');
});
test('a failed local write takes precedence over an earlier successful cloud sync',()=>{
  const ctx=syncStatusContext({_localSaveFailed:true});
  assert.equal(ctx._syncStatus().state,'error');
  assert.match(ctx._syncStatus().text,/השמירה במכשיר נכשלה/);
});
test('users without an account see local storage rather than a pending cloud operation',()=>{
  const ctx=syncStatusContext({_cloudUser:null,_syncPending:true});
  assert.equal(ctx._syncStatus().state,'local');
});

test('a successful cloud write leaves the displayed status synchronized rather than still syncing',async()=>{
  const {ctx}=cloudContext();
  const status={style:{},dataset:{}};
  ctx.navigator={onLine:true};ctx._localSaveFailed=false;ctx._cloudSyncVerified=false;ctx._cloudSaveFailed=false;
  ctx.document={querySelectorAll:()=>[status]};
  for(const name of ['_syncStatus','_renderSyncStatus','_setSyncState']){
    const source=html.match(new RegExp('function '+name+'\\([^]*?\\n\\}'));
    vm.runInContext(source[0],ctx);
  }
  await ctx._doCloudSave();
  assert.equal(status.dataset.state,'synced');
});

function insuranceContext(){
 const ctx=functions(['_fxUpsert','_fxPushMonth','_expAddInsurance','_expEditInsurance','_expDeleteInsurance','_mergeFixedCatInto','_migrateInsuranceCats'],{transactions:[],insurances:[],fixedExpenses:[],budgets:{},SAVING_FIXED_CATS:[],_syncMeta:{del:{tx:{}}},_curMonthKey:()=> '2026-10',_fxTxId:(m,c)=>'fx|'+m+'|'+c,renderTxPage:()=>{},showToast:()=>{},promptSheet:async()=>['Health','120']});
 ctx._fxMonthly=()=>ctx.insurances.reduce((s,i)=>s+i.monthly,0);ctx.saveData=()=>{ctx.saved=ctx.transactions.reduce((s,t)=>s+t.amount,0);};ctx.showUndoToast=(_,undo)=>{ctx.undo=undo;};return ctx;
}
test('insurance add, edit, delete and undo persist the current cash flow immediately',async()=>{
 const ctx=insuranceContext();await ctx._expAddInsurance();assert.equal(ctx.saved,120);
 ctx.promptSheet=async()=>['Health','200'];await ctx._expEditInsurance(ctx.insurances[0].id);assert.equal(ctx.saved,200);
 ctx._expDeleteInsurance(ctx.insurances[0].id);assert.equal(ctx.saved,0);ctx.undo();assert.equal(ctx.saved,200);assert.equal(ctx.transactions.length,1);
});
test('insurance edits preserve historical monthly expenses',async()=>{
 const ctx=insuranceContext();ctx.transactions=[{id:'fx|2026-09|ביטוחים',amount:80}];await ctx._expAddInsurance();assert.equal(ctx.transactions.find(t=>t.id.includes('2026-09')).amount,80);
});
test('repeated legacy insurance migration preserves a single editable policy',()=>{
 const ctx=insuranceContext();ctx.fixedExpenses=[{id:'ביטוח בריאות',amount:120}];ctx._migrateInsuranceCats();ctx.insurances[0].monthly=200;
 ctx.fixedExpenses=[{id:'ביטוח בריאות',amount:120}];ctx._migrateInsuranceCats();assert.equal(ctx.insurances.length,1);assert.equal(ctx.insurances[0].monthly,200);
});
test('legacy and current insurance expenses consolidate to a single monthly row',()=>{
 const ctx=insuranceContext();ctx.transactions=[{id:'fx|2026-09|ביטוחים',type:'expense',cat:'ביטוחים',desc:'ביטוחים',fx:true,amount:100},{id:'fx|2026-09|ביטוח בריאות',type:'expense',cat:'ביטוח בריאות',desc:'ביטוח בריאות',fx:true,amount:50}];
 ctx._migrateInsuranceCats();assert.equal(ctx.transactions.length,1);assert.equal(ctx.transactions[0].amount,150);assert.equal(ctx.transactions[0].desc,'ביטוחים');
});

test('cloud normalization stamps legacy deletions and writes the normalized payload',()=>{
 const ctx=insuranceContext();Object.assign(ctx,{goals:[],subscriptions:[],loans:[],payments:[],_syncShadow:{},_modeKey:k=>k,_fixRefinedCats:()=>false,scheduleCloudSave:()=>{ctx.queued=true;}});
 ctx._syncMeta={del:Object.fromEntries(['tx','goals','subs','loans','payments','fixed','insurances','budgets'].map(k=>[k,{}])),bu:{}};
 const start=html.indexOf('function _itemSig('),end=html.indexOf('_rebuildShadow();',start)+'_rebuildShadow();'.length;vm.runInContext(html.slice(start,end),ctx);
 ctx._migrateCats=()=>ctx._migrateInsuranceCats();vm.runInContext(html.match(/function _applyMerged\([^]*?\n\}/)[0],ctx);
 const m={transactions:[],goals:[],subscriptions:[],loans:[],payments:[],fixed_expenses:[{id:'ביטוח בריאות',amount:120}],insurances:[],budgets:{}};
 assert.equal(ctx._applyMerged(m),true);assert.equal(m.fixed_expenses.length,0);assert.equal(m.insurances.length,1);assert.ok(m.insurances[0].u);assert.ok(ctx._syncMeta.del.fixed['ביטוח בריאות']);assert.equal(ctx.queued,true);
 assert.equal(JSON.parse(ctx.localStorage.getItem('budget_insurances'))[0].monthly,120);
 ctx.queued=false;assert.equal(ctx._applyMerged(m),false);assert.equal(ctx.queued,false);
});

function backupContext(data){
 const ctx=functions(['importBackup'],{transactions:[{id:'keep',amount:10}],goals:[],subscriptions:[],budgets:{},loans:[],payments:[],fixedExpenses:[],insurances:[],userSettings:{name:'keep'},confirmSheet:async()=>true,saveData:()=>{},saveSettingsData:()=>{},refreshAll:()=>{},showPage:()=>{},document:{getElementById:()=>null},showToast:t=>{ctx.toast=t;},FileReader:class{readAsText(){this.done=this.onload({target:{result:JSON.stringify(data)}});ctx.done=this.done;}}});return ctx;
}
test('malformed imported collections leave existing data untouched',async()=>{
 const ctx=backupContext({transactions:{bad:true},goals:[]});ctx.importBackup({files:[{}]});await ctx.done;assert.equal(ctx.transactions[0].id,'keep');assert.match(ctx.toast,/❌/);
});
test('invalid optional backup fields are rejected before replacing transactions',async()=>{
 const ctx=backupContext({transactions:[],insurances:'bad'});ctx.importBackup({files:[{}]});await ctx.done;assert.equal(ctx.transactions[0].id,'keep');
});
test('valid exported data restores all collections and settings',async()=>{
 const ctx=backupContext({transactions:[{id:1,amount:20}],insurances:[{id:2,monthly:100}],budgets:{Food:200},userSettings:{name:'restored'}});ctx.importBackup({files:[{}]});await ctx.done;assert.equal(ctx.transactions[0].amount,20);assert.equal(ctx.insurances[0].monthly,100);assert.equal(ctx.userSettings.name,'restored');
});
test('payments finish across a year boundary and do not remain in cash flow',()=>{
 const ctx=functions(['_monthsElapsed','_payCalc'],{_curMonthKey:()=> '2027-01'});assert.equal(ctx._payCalc({total:12,current:11,currentAnchor:'2026-12',amount:100}).left,0);assert.equal(ctx._payCalc({total:12,current:10,currentAnchor:'2026-12',amount:100}).sum,100);
});

function autoRestoreContext(snapshot,localStorage=storage({budget_autobackup:JSON.stringify(snapshot),budget_tx:'[{"id":"keep"}]'})){
 const ctx=vm.createContext({JSON,Date,localStorage,window:{},BK_KEYS:['budget_tx','budget_insurances'],confirmSheet:async()=>true,location:{reload:()=>{ctx.reloaded=true;}},showToast:t=>{ctx.toast=t;}});
 const start=html.indexOf('window.restoreAutoBackup=async function()'),end=html.indexOf('  var _sd=',start);vm.runInContext(html.slice(start,end),ctx);return ctx;
}
test('automatic restore rejects corrupt collection shapes without writes',async()=>{
 const ctx=autoRestoreContext({ts:Date.now(),data:{budget_tx:'{}'}});await ctx.window.restoreAutoBackup();assert.equal(ctx.reloaded,undefined);assert.match(ctx.localStorage.getItem('budget_tx'),/keep/);
});
test('automatic restore only accepts budget keys and removes absent snapshot collections',async()=>{
 const ctx=autoRestoreContext({ts:Date.now(),data:{budget_tx:'[]','sb-auth-token':'intruder'}});ctx.localStorage.setItem('budget_insurances','[{"id":2}]');await ctx.window.restoreAutoBackup();assert.equal(ctx.localStorage.getItem('sb-auth-token'),null);assert.equal(ctx.localStorage.getItem('budget_insurances'),null);assert.equal(ctx.reloaded,true);
});
test('failed automatic restore rolls back completed writes and never reloads',async()=>{
 const backing=storage({budget_autobackup:JSON.stringify({ts:Date.now(),data:{budget_tx:'[]',budget_insurances:'[]'}}),budget_tx:'[{"id":"keep"}]',budget_insurances:'[{"id":2}]'});
 let failed=false;const localStorage={getItem:k=>backing.getItem(k),removeItem:k=>backing.removeItem(k),setItem:(k,v)=>{if(k==='budget_insurances'&&!failed){failed=true;throw Error('quota');}backing.setItem(k,v);}};
 const ctx=autoRestoreContext(null,localStorage);await ctx.window.restoreAutoBackup();assert.equal(ctx.reloaded,undefined);assert.match(backing.getItem('budget_tx'),/keep/);assert.match(ctx.toast,/❌/);
});

test('dialog Enter on the cancel button leaves native cancellation intact',()=>{
 let submitted=false;const ctx=functions(['_dialogKeydown'],{document:{activeElement:{tagName:'BUTTON'}}});ctx._dialogKeydown({key:'Enter'},null,()=>{},()=>{submitted=true;});assert.equal(submitted,false);
});
test('dialog Escape cannot close its parent sheet',()=>{
 let stopped=false,canceled=false;const ctx=functions(['_dialogKeydown']);ctx._dialogKeydown({key:'Escape',preventDefault:()=>{},stopImmediatePropagation:()=>{stopped=true;}},null,()=>{canceled=true;},()=>{});assert.ok(stopped&&canceled);
});

test('sheet keyboard wrap skips controls in hidden wizard steps',()=>{
 let focused='',prevented=false;const first={getClientRects:()=>[1],closest:()=>null,focus:()=>{focused='first';}},last={getClientRects:()=>[1],closest:()=>null,focus:()=>{focused='last';}},hidden={getClientRects:()=>[],closest:()=>null,focus:()=>{focused='hidden';}};
 const ctx=functions(['_sheetKeydown'],{_openSheets:new Set(['wizard']),getComputedStyle:()=>({visibility:'visible'}),document:{activeElement:last,getElementById:()=>({querySelectorAll:()=>[first,last,hidden]})}});
 ctx._sheetKeydown({key:'Tab',shiftKey:false,preventDefault:()=>{prevented=true;}});assert.equal(focused,'first');assert.equal(prevented,true);
});
test('sheet backwards keyboard wrap skips visually hidden header buttons',()=>{
 let focused='';const hidden={getClientRects:()=>[1],closest:()=>null,focus:()=>{focused='hidden';}},first={getClientRects:()=>[1],closest:()=>null,focus:()=>{focused='first';}},last={getClientRects:()=>[1],closest:()=>null,focus:()=>{focused='last';}};
 const ctx=functions(['_sheetKeydown'],{_openSheets:new Set(['wizard']),getComputedStyle:el=>({visibility:el===hidden?'hidden':'visible'}),document:{activeElement:first,getElementById:()=>({querySelectorAll:()=>[hidden,first,last]})}});
 ctx._sheetKeydown({key:'Tab',shiftKey:true,preventDefault:()=>{}});assert.equal(focused,'last');
});

function workerBootContext(controlled=false){
 const events={};let reloads=0,catches=0;const reg={update:()=>({catch:()=>{catches++;}})};
 const ctx=vm.createContext({navigator:{serviceWorker:{controller:controlled?{}:null,addEventListener:(event,fn)=>{events[event]=fn;},register:async()=>reg,getRegistration:async()=>reg}},location:{protocol:'https:',hostname:'example.test',reload:()=>{reloads++;}},window:{addEventListener:(event,fn)=>{events[event]=fn;}},document:{addEventListener:(event,fn)=>{events[event]=fn;}},setInterval:()=>{}});
 const start=html.indexOf("  if('serviceWorker' in navigator"),end=html.indexOf('  var deferred=',start);vm.runInContext(html.slice(start,end),ctx);return {ctx,events,reloads:()=>reloads,catches:()=>catches};
}
test('first service worker installation preserves the current page and later updates reload once',()=>{
 const t=workerBootContext();t.events.controllerchange();assert.equal(t.reloads(),0);t.events.controllerchange();t.events.controllerchange();assert.equal(t.reloads(),1);
 const existing=workerBootContext(true);existing.events.controllerchange();assert.equal(existing.reloads(),1);
});
test('service worker update checks attach a rejection handler',async()=>{
 const t=workerBootContext();t.events.load();await new Promise(r=>setImmediate(r));assert.equal(t.catches(),1);
});

test('quick amount fills the input without saving an expense',()=>{
 let inputEvent;const input={value:'',dispatchEvent:e=>{inputEvent=e;}};const ctx=functions(['_setQuickAmount'],{Event,document:{getElementById:()=>input},haptic:()=>{}});ctx._setQuickAmount(50);assert.equal(input.value,'50');assert.equal(inputEvent.type,'input');assert.equal(inputEvent.bubbles,true);
});
test('navigation highlight follows the icon vertically when labels are visible',()=>{
 const indicator={style:{},dataset:{}};const nav={getBoundingClientRect:()=>({left:10,top:200})};const icon={getBoundingClientRect:()=>({left:30,top:204,width:42})};const active={querySelector:()=>icon};const ctx=functions(['_positionNavIndicator'],{document:{querySelector:s=>s==='.bottom-nav'?nav:s==='.nav-indicator'?indicator:active}});ctx._positionNavIndicator();assert.equal(indicator.style.top,'4px');assert.equal(indicator.style.transform,'translateX(20px)');
});

test('failed advisor task updates restore the task for response and network errors',async()=>{
 for(const rpc of [async()=>({error:{message:'denied'},data:null}),async()=>{throw new Error('offline');},async()=>({data:false,error:null})]){
  const task={id:'task',done:false};let notices=0;
  const ctx=functions(['toggleAdvisorTask'],{_advisorTasks:[task],_sb:{rpc},renderTasksPage:()=>{},showToast:()=>{notices++;}});
  await ctx.toggleAdvisorTask('task',true);assert.equal(task.done,false);assert.equal(notices,1);
 }
 const task={id:'task',done:false};const ctx=functions(['toggleAdvisorTask'],{_advisorTasks:[task],_sb:{rpc:async()=>({data:true,error:null})},renderTasksPage:()=>{},showToast:()=>{throw new Error('unexpected failure');}});
 await ctx.toggleAdvisorTask('task',true);assert.equal(task.done,true);
});
test('failed advisor reads preserve the last task and meeting lists',async()=>{
 for(const thrown of [false,true]){
  const tasks=[{id:'cached-task'}],meetings=[{id:'cached-meeting'}];
  const query={select(){return this;},eq(){return this;},order:async()=>({error:{message:'offline'},data:null})};
  const ctx=functions(['_loadAdvisorTasks'],{_advisorTasks:tasks,_advisorMeetings:meetings,_advisorTasksError:false,_cloudUser:{id:'client'},_advisorLink:{status:'active'},_sb:{from:()=>{if(thrown)throw new Error('offline');return query;}}});
  await ctx._loadAdvisorTasks();assert.equal(ctx._advisorTasks,tasks);assert.equal(ctx._advisorMeetings,meetings);assert.equal(ctx._advisorTasksError,true);
 }
});
