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
    return {open,style:{},querySelector:()=>sheet,sheet,contains:el=>el.overlay===sheet};
  }
  const main=overlay(true),child=overlay(false);
  sheets.set('main',main);sheets.set('child',child);
  const window={visualViewport:vv,innerHeight:844,openSheet:id=>{sheets.get(id).open=true;},closeSheet:id=>{sheets.get(id).open=false;}};
  const document={listeners:{},addEventListener:(name,fn)=>{document.listeners[name]=fn;},querySelectorAll:selector=>[...sheets.values()].filter(ov=>selector.includes(':not(.open)')?!ov.open:selector.includes('.open')?ov.open:true)};
  const source=html.match(/\(function\(\)\{\s*var vv=window\.visualViewport;[^]*?\}\)\(\);/);
  assert.ok(source);
  vm.runInNewContext(source[0],{window,document,setTimeout:fn=>fn(),requestAnimationFrame:fn=>fn()});
  vv.listeners.resize();
  return {window,vv,main,child,document};
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
 const ctx=functions(['_fxUpsert','_fxPushMonth','_expAddInsurance','_expEditInsurance','_expDeleteInsurance','_mergeFixedCatInto','_migrateInsuranceCats'],{transactions:[],insurances:[],fixedExpenses:[],budgets:{},_isSavingCat:()=>false,userSettings:{},_syncMeta:{del:{tx:{}}},_curMonthKey:()=> '2026-10',_fxTxId:(m,c)=>'fx|'+m+'|'+c,renderTxPage:()=>{},showToast:()=>{},promptSheet:async()=>['Health','120']});
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
 ctx._migrateCats=()=>ctx._migrateInsuranceCats();vm.runInContext(html.match(/function _sanitizeIds\([^]*?\n\}/)[0],ctx);vm.runInContext(html.match(/function _applyMerged\([^]*?\n\}/)[0],ctx);
 const m={transactions:[],goals:[],subscriptions:[],loans:[],payments:[],fixed_expenses:[{id:'ביטוח בריאות',amount:120}],insurances:[],budgets:{}};
 assert.equal(ctx._applyMerged(m),true);assert.equal(m.fixed_expenses.length,0);assert.equal(m.insurances.length,1);assert.ok(m.insurances[0].u);assert.ok(ctx._syncMeta.del.fixed['ביטוח בריאות']);assert.equal(ctx.queued,true);
 assert.equal(JSON.parse(ctx.localStorage.getItem('budget_insurances'))[0].monthly,120);
 ctx.queued=false;assert.equal(ctx._applyMerged(m),false);assert.equal(ctx.queued,false);
});

function backupContext(data){
 const ctx=functions(['importBackup','_sanitizeIds'],{transactions:[{id:'keep',amount:10}],goals:[],subscriptions:[],budgets:{},loans:[],payments:[],fixedExpenses:[],insurances:[],userSettings:{name:'keep'},confirmSheet:async()=>true,saveData:()=>{},saveSettingsData:()=>{},refreshAll:()=>{},showPage:()=>{},document:{getElementById:()=>null},showToast:t=>{ctx.toast=t;},FileReader:class{readAsText(){this.done=this.onload({target:{result:JSON.stringify(data)}});ctx.done=this.done;}}});return ctx;
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
test('restoring from settings leaves the old form before applying the restored settings',async()=>{
 const ctx=backupContext({transactions:[{id:1}],userSettings:{name:'restored',savingsGoal:350}});
 ctx.showPage=()=>{ctx.userSettings.name='old form';ctx.userSettings.savingsGoal=10;};
 ctx.importBackup({files:[{}]});await ctx.done;
 assert.equal(ctx.userSettings.name,'restored');assert.equal(ctx.userSettings.savingsGoal,350);
});

test('payments finish across a year boundary and do not remain in cash flow',()=>{
 const ctx=functions(['_monthsElapsed','_payCalc'],{_curMonthKey:()=> '2027-01'});assert.equal(ctx._payCalc({total:12,current:11,currentAnchor:'2026-12',amount:100}).left,0);assert.equal(ctx._payCalc({total:12,current:10,currentAnchor:'2026-12',amount:100}).sum,100);
});

test('an installment deal is split by the number of payments and drops out of the cashflow when finished',()=>{
 const ctx=functions(['_monthsElapsed','_payCalc','_payMonthly','_payTxTotal'],{_curMonthKey:()=> '2027-01'});
 assert.equal(ctx._payMonthly(1000,4),250);assert.equal(ctx._payMonthly('1000',3),333.33);assert.equal(ctx._payMonthly(0,3),0);assert.equal(ctx._payMonthly(900,0),0);
 const p={total:3,current:0,txTotal:900,amount:ctx._payMonthly(900,3),currentAnchor:'2026-11'};
 assert.equal(ctx._payCalc(p).left,1);assert.equal(ctx._payCalc(p).sum,300);
 assert.equal(ctx._payTxTotal(p),900);assert.equal(ctx._payTxTotal({total:6,amount:50}),300);
 assert.equal(ctx._payCalc({...p,currentAnchor:'2026-10'}).left,0);
});

test('editing an income source also updates the income it already posted this month',async()=>{
 const src={name:'משכורת שלי',amount:'10000',day:'1'};let saved=0,committed=null;
 const ctx=functions(['_incomeFromPrompt','_incomeDailyError','_expEditIncome'],{_incomeWorkList:()=>[src],promptSheet:async()=>['משכורת שלי','monthly','8055','1'],mk:(y,m)=>y+'-'+String(m+1).padStart(2,'0'),currentYear:2026,currentMonth:10,saveData:()=>{saved++;},_incomeCommit:l=>{committed=l;},_incomeFields:()=>[],
  transactions:[{type:'income',recurring:true,desc:'משכורת שלי',amount:10000,date:'2026-11-01'},{type:'income',recurring:true,desc:'משכורת שלי',amount:10000,date:'2026-10-01'},{type:'income',desc:'בונוס',amount:500,date:'2026-11-05'}]});
 await ctx._expEditIncome(0);
 assert.equal(ctx.transactions[0].amount,8055);assert.equal(ctx.transactions[1].amount,10000);assert.equal(ctx.transactions[2].amount,500);assert.equal(saved,1);assert.ok(committed);
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

function workerBootContext(controlled=false,extra={}){
 const events={};let reloads=0,catches=0;const reg={update:()=>({catch:()=>{catches++;}})};
 const ctx=vm.createContext({navigator:{serviceWorker:{controller:controlled?{}:null,addEventListener:(event,fn)=>{events[event]=fn;},register:async()=>reg,getRegistration:async()=>reg}},location:{protocol:'https:',hostname:'example.test',reload:()=>{reloads++;}},window:{addEventListener:(event,fn)=>{events[event]=fn;}},document:{getElementById:()=>null,addEventListener:(event,fn)=>{events[event]=fn;}},setInterval:()=>{},clearInterval:()=>{},...extra});
 const start=html.indexOf("  if('serviceWorker' in navigator"),end=html.indexOf('  var deferred=',start);vm.runInContext(html.slice(start,end),ctx);return {ctx,events,reloads:()=>reloads,catches:()=>catches};
}
test('first install stays quiet and later updates require an explicit choice',()=>{
 const banner={hidden:true},button={hidden:true};
 const document={getElementById:id=>id==='appUpdateBanner'?banner:id==='settingsUpdateBtn'?button:null,addEventListener:()=>{}};
 const t=workerBootContext(false,{document});t.events.controllerchange();assert.equal(banner.hidden,true);assert.equal(t.reloads(),0);
 t.events.controllerchange();assert.equal(banner.hidden,false);assert.equal(button.hidden,false);assert.equal(t.reloads(),0);
 t.ctx.window.applyAppUpdate();t.ctx.window.applyAppUpdate();assert.equal(t.reloads(),1);
});

test('service worker update checks attach a rejection handler',async()=>{
 const t=workerBootContext();t.events.load();await new Promise(r=>setImmediate(r));assert.equal(t.catches(),1);
});

test('quick amount fills the input without saving an expense',()=>{
 let inputEvent;const input={value:'',dispatchEvent:e=>{inputEvent=e;}};const ctx=functions(['_setQuickAmount'],{Event,document:{getElementById:()=>input},haptic:()=>{}});ctx._setQuickAmount(50);assert.equal(input.value,'50');assert.equal(inputEvent.type,'input');assert.equal(inputEvent.bubbles,true);
});
test('navigation highlight follows the icon vertically when labels are visible',()=>{
 const indicator={style:{},dataset:{}};const nav={clientLeft:0,clientTop:0,getBoundingClientRect:()=>({left:10,top:200})};const icon={getBoundingClientRect:()=>({left:30,top:204,width:42,height:42})};const active={querySelector:()=>icon};const ctx=functions(['_positionNavIndicator'],{document:{querySelector:s=>s==='.bottom-nav'?nav:s==='.nav-indicator'?indicator:active}});ctx._positionNavIndicator();assert.equal(indicator.style.top,'4px');assert.equal(indicator.style.transform,'translateX(20px)');
});

test('navigation highlight remains centered while the icon is pressed and accounts for the border',()=>{
  const indicator={style:{},dataset:{}};
  const nav={clientLeft:1,clientTop:1,getBoundingClientRect:()=>({left:10,top:200})};
  const icon={getBoundingClientRect:()=>({left:33,top:207,width:36,height:36})};
  const active={querySelector:()=>icon};
  const ctx=functions(['_positionNavIndicator'],{document:{querySelector:s=>s==='.bottom-nav'?nav:s==='.nav-indicator'?indicator:active}});
  ctx._positionNavIndicator();
  assert.equal(indicator.style.top,'3px');
  assert.equal(indicator.style.transform,'translateX(19px)');
});

test('failed advisor task updates restore the task for response and network errors',async()=>{
 for(const rpc of [async()=>({error:{message:'denied'},data:null}),async()=>{throw new Error('offline');},async()=>({data:false,error:null})]){
  const task={id:'task',done:false};let notices=0;
  const ctx=functions(['toggleAdvisorTask'],{_advisorTaskPending:new Set(),_advisorTaskRequest:0,_cloudUser:{id:'client'},_advisorLink:{status:'active',advisor_id:'advisor'},_advisorTasks:[task],_sb:{rpc},renderTasksPage:()=>{},showToast:()=>{notices++;}});
  await ctx.toggleAdvisorTask('task',true);assert.equal(task.done,false);assert.equal(notices,1);
 }
 const task={id:'task',done:false};const ctx=functions(['toggleAdvisorTask'],{_advisorTaskPending:new Set(),_advisorTaskRequest:0,_cloudUser:{id:'client'},_advisorLink:{status:'active',advisor_id:'advisor'},_advisorTasks:[task],_sb:{rpc:async()=>({data:true,error:null})},renderTasksPage:()=>{},showToast:()=>{throw new Error('unexpected failure');}});
 await ctx.toggleAdvisorTask('task',true);assert.equal(task.done,true);
});
test('failed advisor reads preserve the last task and meeting lists',async()=>{
 for(const thrown of [false,true]){
  const tasks=[{id:'cached-task'}],meetings=[{id:'cached-meeting'}];
  const query={select(){return this;},eq(){return this;},order:async()=>({error:{message:'offline'},data:null})};
  const ctx=functions(['_loadAdvisorTasks'],{_advisorTaskRequest:0,_advisorTaskPending:new Set(),_advisorTasks:tasks,_advisorMeetings:meetings,_advisorTasksError:false,_cloudUser:{id:'client'},_advisorLink:{status:'active'},_sb:{from:()=>{if(thrown)throw new Error('offline');return query;}}});
  await ctx._loadAdvisorTasks();assert.equal(ctx._advisorTasks,tasks);assert.equal(ctx._advisorMeetings,meetings);assert.equal(ctx._advisorTasksError,true);
 }
});

test('update later remains deferred after closing a form and can be applied from settings',()=>{
 let open=true,tick,flushes=0,settingsSaves=0;
 const banner={hidden:true},button={hidden:true};
 const t=workerBootContext(true,{document:{activeElement:{matches:()=>open},querySelector:()=>open?{}:null,getElementById:id=>id==='appUpdateBanner'?banner:id==='settingsUpdateBtn'?button:{classList:{contains:()=>true}},addEventListener:()=>{}},setInterval:fn=>{tick=fn;return 1;},_flushLocalSave:()=>{flushes++;},saveSettings:()=>{settingsSaves++;},showToast:()=>{}});
 t.events.controllerchange();assert.equal(banner.hidden,true);assert.equal(t.reloads(),0);
 t.ctx.window.applyAppUpdate();assert.equal(flushes,0);
 open=false;tick();assert.equal(banner.hidden,false);assert.equal(t.reloads(),0);
 t.ctx.window.deferAppUpdate();tick();assert.equal(banner.hidden,true);assert.equal(button.hidden,false);assert.equal(t.reloads(),0);
 t.events.controllerchange();tick();assert.equal(banner.hidden,true);
 t.ctx.window.applyAppUpdate();assert.equal(t.reloads(),1);assert.equal(flushes,1);assert.equal(settingsSaves,1);
});

test('failed local save prevents an update reload',()=>{
 const t=workerBootContext(true,{_localSaveFailed:true,showToast:()=>{}});
 t.events.controllerchange();t.ctx.window.applyAppUpdate();assert.equal(t.reloads(),0);
});
function offlineWorkerContext(previous=false){
 const events={},items=new Map(),deleted=[];let waiting=0;
 const cache={add:async()=>{throw new Error('network failed');},match:async key=>items.get(key),put:async(key,value)=>items.set(key,value)};
 const ctx=vm.createContext({URL,Response,Promise,self:{location:{origin:'https://app.test'},addEventListener:(key,fn)=>{events[key]=fn;},skipWaiting:async()=>{waiting++;}},caches:{open:async()=>cache,match:async()=>previous?new Response('cached'):undefined,keys:async()=>['budget-app-old','another-app',fs.readFileSync(path.join(root,'sw.js'),'utf8').match(/const CACHE = '([^']+)'/)[1]],delete:async key=>{deleted.push(key);}},fetch:()=>new Promise(()=>{}),setTimeout:fn=>{ctx.fireTimeout=fn;return 1;},clearTimeout:()=>{}});
 vm.runInContext(fs.readFileSync(path.join(root,'sw.js'),'utf8'),ctx);return {ctx,events,deleted,waiting:()=>waiting};
}
test('an incomplete offline shell cannot replace the installed worker',async()=>{
 const t=offlineWorkerContext();let install;t.events.install({waitUntil:p=>{install=p;}});await assert.rejects(install,/Required offline/);assert.equal(t.waiting(),0);
});
test('worker upgrade recovers cached assets and preserves unrelated app caches',async()=>{
 const t=offlineWorkerContext(true);let install;t.events.install({waitUntil:p=>{install=p;}});await install;assert.equal(t.waiting(),1);
 let activation;t.events.activate({waitUntil:p=>{activation=p;}});t.ctx.self.clients={claim:async()=>{}};await activation;assert.deepEqual(t.deleted,['budget-app-old']);
});
test('a slow connection opens the cached app after the fallback timeout',async()=>{
 const t=offlineWorkerContext(true);let response;
 t.events.fetch({request:{url:'https://app.test/index.html',method:'GET',mode:'navigate',headers:{get:()=>''}},respondWith:p=>{response=p;},waitUntil:()=>{}});
 t.ctx.fireTimeout();assert.equal(await (await response).text(),'cached');
});

test('expense search coalesces rapid input and clearing applies immediately',()=>{
  let scheduled=null,calls=0,clears=0;
  const input={value:'ק'};
  const ctx=functions(['queueTxSearch'],{document:{getElementById:()=>input},clearTimeout:()=>{scheduled=null;clears++;},setTimeout:(fn,delay)=>{assert.equal(delay,120);scheduled=fn;return 1;},renderTxPage:()=>{calls++;}});
  vm.runInContext('let _txSearchTimer=null;',ctx);
  ctx.queueTxSearch({});input.value='קניות';ctx.queueTxSearch({});
  assert.equal(calls,0);assert.equal(clears,2);scheduled();assert.equal(calls,1);
  input.value='';ctx.queueTxSearch({});assert.equal(calls,2);assert.equal(scheduled,null);
});

test('expense search waits until text composition completes',()=>{
  let scheduled=null;
  const ctx=functions(['queueTxSearch'],{document:{getElementById:()=>({value:'בדיקה'})},clearTimeout:()=>{scheduled=null;},setTimeout:fn=>{scheduled=fn;return 1;},renderTxPage:()=>{}});
  vm.runInContext('let _txSearchTimer=null;',ctx);
  ctx.queueTxSearch({isComposing:true});assert.equal(scheduled,null);
  ctx.queueTxSearch({isComposing:false});assert.equal(typeof scheduled,'function');
});


test('refreshing another page skips hidden dashboard rendering but maintains automatic entries',()=>{
  for(const id of ['page-transactions','page-budget','page-settings']){
    const calls=[];
    const label={};
    const extra={document:{querySelector:()=>({id}),getElementById:()=>label},_fxApply:()=>true,saveData:()=>calls.push('save'),currentYear:2026,currentMonth:9,heMonth:()=> 'אוקטובר 2026'};
    for(const name of ['renderDashboard','renderDailyWidget','checkRecurring','checkSubscriptions','checkRecurringIncome','renderTxPage','renderBudget','renderMonthGrid'])extra[name]=()=>calls.push(name);
    const ctx=functions(['refreshAll'],extra);ctx.refreshAll();
    assert.ok(!calls.includes('renderDashboard'));assert.ok(!calls.includes('renderDailyWidget'));
    assert.deepEqual(calls.slice(0,4),['save','checkRecurring','checkSubscriptions','checkRecurringIncome']);
    assert.equal(calls.includes('renderTxPage'),id==='page-transactions');assert.equal(calls.includes('renderBudget'),id==='page-budget');
    assert.equal(label.textContent,'אוקטובר 2026');
  }
});

test('dashboard refresh and initial refresh still update daily budget',()=>{
  for(const id of ['page-dashboard','']){
    const calls=[];
    const extra={document:{querySelector:()=>id?{id}:null,getElementById:()=>({})},_fxApply:()=>false,currentYear:2026,currentMonth:9,heMonth:()=>''};
    for(const name of ['renderDashboard','renderDailyWidget','renderMonthGrid'])extra[name]=()=>calls.push(name);
    const ctx=functions(['refreshAll'],extra);ctx.refreshAll();
    assert.deepEqual(calls,['renderDashboard','renderDailyWidget','renderMonthGrid']);
  }
});


test('unchanged expense list preserves nodes while changes replace content',()=>{
  let writes=0,queries=0;
  const toggles=[];
  const el={querySelector:()=>{queries++;return {};},set innerHTML(value){writes++;this.value=value;},classList:{toggle:(...args)=>toggles.push(args)}};
  const ctx=functions(['_setTxListHtml']);
  ctx._setTxListHtml(el,'first');ctx._setTxListHtml(el,'first');
  assert.equal(writes,1);assert.equal(queries,1);assert.equal(el.value,'first');
  ctx._setTxListHtml(el,'updated');assert.equal(writes,2);assert.equal(el.value,'updated');
  ctx._setTxListHtml(el,'');ctx._setTxListHtml(el,'');assert.equal(writes,3);assert.equal(el.value,'');
  ctx._setTxListHtml(null,'unused');assert.equal(toggles.length,3);
});


test('keyboard resize reveals obscured focused fields without scrolling visible ones',()=>{
  const {vv,main,document}=viewportContext();
  let scrolls=0;
  let rect={top:450,bottom:550};
  document.activeElement={overlay:main.sheet,matches:()=>true,getBoundingClientRect:()=>rect,scrollIntoView:options=>{assert.equal(options.block,'nearest');scrolls++;}};
  vv.listeners.resize();assert.equal(scrolls,1);
  rect={top:200,bottom:250};vv.listeners.resize();assert.equal(scrolls,1);
  rect={top:0,bottom:40};document.listeners.focusin();assert.equal(scrolls,2);
});


test('reduced motion cancels running number animation and displays the exact value',()=>{
  const cancelled=[];
  const el={_cuVal:500,_cuRAF:7,_cuTO:8,textContent:'old'};
  const ctx=functions(['countUp'],{window:{matchMedia:()=>({matches:true})},fmt:n=>'₪'+Math.abs(n),cancelAnimationFrame:id=>cancelled.push(id),clearTimeout:id=>cancelled.push(id)});
  ctx.countUp(el,500);assert.equal(el.textContent,'₪500');assert.equal(el._cuRAF,0);assert.equal(el._cuTO,0);assert.deepEqual(cancelled,[7,8]);
  ctx.countUp(el,-123);assert.equal(el.textContent,'-₪123');
});


test('rapid sheet reopening cancels the previous close and focus callbacks',()=>{
  const timers=new Map();let timerId=0;
  const classes=new Set();const sheet={style:{}};
  const opener={focus:()=>{document.activeElement=opener;}};
  const field={getClientRects:()=>[{}],closest:()=>null,focus:()=>{document.activeElement=field;},blur:()=>{document.activeElement=opener;}};
  const overlay={style:{},classList:{add:c=>classes.add(c),remove:(...cs)=>cs.forEach(c=>classes.delete(c))},setAttribute:()=>{},querySelector:()=>sheet,querySelectorAll:()=>[field],contains:el=>el===field};
  const document={activeElement:opener,getElementById:id=>id==='fixture'?overlay:null,contains:()=>true,addEventListener:()=>{},removeEventListener:()=>{}};
  const ctx=functions(['openSheet','closeSheet'],{document,_openSheets:new Set(),_sheetOpenerEl:null,_lockBodyScroll:()=>{},_unlockBodyScroll:()=>{},_sheetSetBackgroundInert:()=>{},_sheetKeydown:()=>{},getComputedStyle:()=>({visibility:'visible'}),setTimeout:fn=>{timers.set(++timerId,fn);return timerId;},clearTimeout:id=>timers.delete(id)});
  ctx.openSheet('fixture');ctx.closeSheet('fixture');ctx.openSheet('fixture');
  assert.equal(timers.size,1);for(const callback of timers.values())callback();
  assert.ok(classes.has('open'));assert.equal(document.activeElement,field);assert.equal(sheet.style.animation,'');
  ctx.closeSheet('fixture');assert.equal(document.activeElement,opener);
});

test('tab swipe leaves transaction gestures alone and cancels interrupted gestures',()=>{
  const listeners={};let clicks=0;
  const main={addEventListener:(name,fn)=>{listeners[name]=fn;}};
  const nav=[{classList:{contains:()=>true}},{classList:{contains:()=>false},click:()=>{clicks++;}}];
  const ctx=functions(['initTabSwipe'],{document:{getElementById:()=>main,querySelectorAll:()=>nav},window:{getComputedStyle:()=>({overflowX:'visible'})},_openSheets:new Set()});
  ctx.initTabSwipe();
  const target={parentElement:main,closest:()=>({})};
  const start={touches:[{clientX:200,clientY:100}],target};const end={changedTouches:[{clientX:50,clientY:100}]};
  listeners.touchstart(start);listeners.touchend(end);assert.equal(clicks,0);
  target.closest=()=>null;listeners.touchstart(start);listeners.touchcancel();listeners.touchend(end);assert.equal(clicks,0);
  listeners.touchstart(start);listeners.touchend(end);assert.equal(clicks,1);
});

test('opening the app does not restamp unchanged settings with an empty name',()=>{
  let saves=0;
  const ctx=functions(['updatePartnerFromHousehold'],{userSettings:{name:'',partnerName:''},_cloudHousehold:null,saveSettingsData:()=>{saves++;},updateHeaderTitle:()=>{},document:{getElementById:()=>null}});
  ctx.updatePartnerFromHousehold();
  assert.equal(saves,0);
  ctx._cloudHousehold={role:'owner',member_email:'dana@example.com'};
  ctx.updatePartnerFromHousehold();
  assert.equal(saves,1);
  assert.equal(ctx.userSettings.partnerName,'dana');
  ctx.updatePartnerFromHousehold();
  assert.equal(saves,1);
});
test('cloud name fills an empty local name even when local settings look newer',async()=>{
  const cloudRow={updated_at:'2026-10-15T07:00:00.000Z',sync_meta:{},settings:{name:'David',partnerName:'',incomeSources:[]}};
  const query={select:()=>query,eq:()=>query,maybeSingle:async()=>({data:cloudRow,error:null})};
  const localStorage=storage({budget_local_owner:'u1',budget_settings_ts:String(Date.parse('2026-10-15T08:00:00.000Z'))});
  const ctx=functions(['_loadFromCloud'],{localStorage,_cloudUser:{id:'u1'},_sb:{from:()=>query},_localAccountReady:true,_getDataUserId:()=>'u1',_activeMode:'personal',_modeKey:k=>k,_syncMeta:{},_mergeMeta:a=>a,_buildMerged:()=>({}),_applyMerged:()=>false,_advisorAssets:[],_advisorOverdraft:{},userSettings:{name:'',partnerName:'',incomeSources:[]},_seedIncomeHistory:()=>{},_syncCurrentIncome:()=>{},refreshAll:()=>{},_decideOnboarding:()=>{},_syncPending:false,_setSyncState:()=>{},renderCloudSection:()=>{},scheduleCloudSave:()=>{},_householdOwner:null,_doCloudSave:async()=>{},_DEBUG:false});
  await ctx._loadFromCloud(true);
  assert.equal(ctx.userSettings.name,'David');
  assert.equal(JSON.parse(localStorage.getItem('budget_settings')).name,'David');
});
test('launch theme and every theme-color tag follow the resolved theme',()=>{
  const match=html.match(/<script>\(function\(\)\{try\{var m=localStorage\.getItem\('budget_theme'\)[^]*?<\/script>/);
  assert.ok(match);
  const src=match[0].replace(/^<script>/,'').replace(/<\/script>$/,'');
  function launch(values,systemDark){
    const metas=[{content:''},{content:''}];const scheme={content:''};const bar={content:''};const state={dark:null};
    const win={matchMedia:()=>({matches:systemDark})};
    const doc={body:{classList:{toggle:(name,on)=>{state.dark=on;}}},documentElement:{style:{}},querySelector:sel=>sel.includes('color-scheme')?{setAttribute:(k,v)=>{scheme.content=v;}}:sel.includes('status-bar-style')?{setAttribute:(k,v)=>{bar.content=v;}}:null,querySelectorAll:()=>metas.map(m=>({setAttribute:(k,v)=>{m.content=v;}}))};
    vm.runInNewContext(src,{localStorage:storage(values),window:win,document:doc});
    return {state,metas,scheme,bar,doc,win};
  }
  const dark=launch({},true);
  assert.equal(dark.state.dark,true);
  assert.equal(dark.doc.documentElement.style.background,'#100f0d');
  assert.deepEqual(dark.metas.map(m=>m.content),['#221e19','#221e19']);assert.equal(dark.bar.content,'black-translucent');
  dark.win._themeChrome(false);
  assert.equal(dark.doc.documentElement.style.background,'#eef3f1');
  assert.deepEqual(dark.metas.map(m=>m.content),['#e8eef6','#e8eef6']);assert.equal(dark.bar.content,'default');
  assert.equal(dark.scheme.content,'light');
  const manual=launch({budget_theme:'light'},true);
  assert.equal(manual.state.dark,false);
  assert.deepEqual(manual.metas.map(m=>m.content),['#e8eef6','#e8eef6']);assert.equal(manual.bar.content,'default');
});

test('category suggestions ignore a response for an older description',async()=>{
  const desc={value:'טקסט חדש'};
  const shown=[];
  const ctx=functions(['callAiCategorize'],{
    txTypeFilter:'expense',_sb:{auth:{getSession:async()=>({data:{session:{access_token:'test'}}})}},
    SUPA_URL:'https://example.invalid',SUPA_ANON:'test',userSettings:{},
    getEffectiveCats:()=>['מזון לבית'],document:{getElementById:()=>desc},
    fetch:async()=>({ok:true,json:async()=>({category:'מזון לבית'})}),
    showWizSuggestion:cat=>shown.push(cat)
  });
  await ctx.callAiCategorize('תיאור קודם');
  assert.deepEqual(shown,[]);
});

test('category suggestions still accept a response for the current description',async()=>{
  const shown=[];
  const ctx=functions(['callAiCategorize'],{
    txTypeFilter:'expense',_sb:{auth:{getSession:async()=>({data:{session:{access_token:'test'}}})}},
    SUPA_URL:'https://example.invalid',SUPA_ANON:'test',userSettings:{},
    wizCats:()=>['מזון לבית'],document:{getElementById:()=>({value:'סופר'})},
    fetch:async()=>({ok:true,json:async()=>({category:'מזון לבית'})}),
    showWizSuggestion:cat=>shown.push(cat)
  });
  await ctx.callAiCategorize('סופר');
  assert.deepEqual(shown,['מזון לבית']);
});

test('push-daily pace warning needs a week, real spend, and a clear overshoot',()=>{
  const src=fs.readFileSync(path.join(root,'supabase/functions/budget-push/index.ts'),'utf8');
  const m=src.match(/function paceProjection[\s\S]*?\r?\n}\r?\n/);
  assert.ok(m,'paceProjection missing');
  const pace=vm.runInNewContext('('+m[0].replace(/: number/g,'').replace(/^function paceProjection/,'function')+')');
  assert.equal(pace(400,1000,10,30),1200);
  assert.equal(pace(400,1000,6,30),null);
  assert.equal(pace(200,1000,7,30),null);
  assert.equal(pace(950,1000,10,30),null);
  assert.equal(pace(300,1000,10,30),null);
  assert.equal(pace(0,1000,10,30),null);
  assert.equal(pace(320,1000,10,30),null);
  assert.equal(pace(380,1000,10,30),1140);
});

test('user category rules beat learned categories, longest match wins, and apply retroactively',()=>{
  const transactions=[
    {type:'expense',cat:'שונות',desc:'שופרסל דיל תל אביב',amount:100},
    {type:'expense',cat:'מזון לבית',desc:'שופרסל',amount:50},
    {type:'income',cat:'אחר',desc:'שופרסל החזר',amount:20},
    {type:'expense',cat:'שונות',desc:'שופרסל אונליין',amount:70,fx:true},
  ];
  const userSettings={catRules:[
    {id:1,match:'שופרסל',cat:'מזון לבית',type:'expense'},
    {id:2,match:'שופרסל דיל',cat:'אוכל בחוץ ובילויים',type:'expense'},
  ]};
  const ctx=functions(['normDesc','ruleCategory','applyCatRule'],{userSettings,transactions});
  const valid=['מזון לבית','אוכל בחוץ ובילויים','שונות'];
  assert.equal(ctx.ruleCategory('שופרסל דיל תל אביב','expense',valid),'אוכל בחוץ ובילויים');
  assert.equal(ctx.ruleCategory('שופרסל סניף 12','expense',valid),'מזון לבית');
  assert.equal(ctx.ruleCategory('שופרסל','income',valid),null);
  assert.equal(ctx.ruleCategory('שופרסל','expense',['שונות']),null);
  assert.equal(ctx.ruleCategory('סופר אחר','expense',valid),null);
  assert.equal(ctx.applyCatRule(userSettings.catRules[0]),1);
  assert.equal(transactions[0].cat,'מזון לבית');
  assert.equal(transactions[2].cat,'אחר');
  assert.equal(transactions[3].cat,'שונות');
});

test('a pending advisor invite survives the guest-to-user account switch',()=>{
  const localStorage=storage({budget_local_owner:'guest',budget_pending_advisor:'11111111-1111-1111-1111-111111111111',budget_tx:'[1]'});
  const ctx=functions(['_accountKeys','_switchLocalAccount'],{localStorage});
  assert.equal(ctx._switchLocalAccount('new-user'),true);
  assert.equal(localStorage.getItem('budget_pending_advisor'),'11111111-1111-1111-1111-111111111111');
  assert.equal(localStorage.getItem('budget_tx'),null);
});

test('a pending advisor invite sends the request straight away without asking the client',async()=>{
  const localStorage=storage({budget_pending_advisor:'11111111-1111-1111-1111-111111111111'});
  const calls=[],notified=[];let toast='';
  const ctx=functions(['_pendingAdvisorRef','_doRequestPendingAdvisor'],{localStorage,_cloudUser:{id:'u'},_sb:{rpc:async(n,a)=>{calls.push([n,a]);return {data:'ok',error:null};}},_notifyAdvisorPush:a=>notified.push(a),showToast:m=>{toast=m;},confirmSheet:()=>{throw new Error('must not ask');}});
  await ctx._doRequestPendingAdvisor();
  assert.deepEqual(notified,['notify-client-request']);
  assert.equal(JSON.stringify(calls),JSON.stringify([['request_advisor_link',{p_advisor:'11111111-1111-1111-1111-111111111111'}]]));
  assert.equal(localStorage.getItem('budget_pending_advisor'),null);
  assert.match(toast,/הבקשה נשלחה/);
});

test('the app is locked only while the client\'s own advisor request is pending',()=>{
  const ctx=functions(['_approvalLocked']);
  assert.equal(ctx._approvalLocked({status:'pending',requested_by_client:true}),true);
  assert.equal(ctx._approvalLocked({status:'pending',requested_by_client:false}),false);
  assert.equal(ctx._approvalLocked({status:'active',requested_by_client:true}),false);
  assert.equal(ctx._approvalLocked(null),false);
});

test('statement upload is required only from an active self-signup client created after the cutoff',()=>{
  const ctx=functions(['_docsRequired'],{DOCS_CUTOFF:'2026-11-16'});
  assert.equal(ctx._docsRequired({status:'active',requested_by_client:true,created_at:'2026-11-20T10:00:00Z'}),true);
  assert.equal(ctx._docsRequired({status:'active',requested_by_client:true,created_at:'2026-05-01T10:00:00Z'}),false);
  assert.equal(ctx._docsRequired({status:'active',requested_by_client:false,created_at:'2026-11-20T10:00:00Z'}),false);
  assert.equal(ctx._docsRequired({status:'pending',requested_by_client:true,created_at:'2026-11-20T10:00:00Z'}),false);
  assert.equal(ctx._docsRequired(null),false);
});

test('the required statement months are the three full months before the start month',()=>{
  const ctx=functions(['_docsMonths','_docsMissing'],{DOCS_KINDS:[['bank','x'],['credit','y']]});
  assert.equal(JSON.stringify(ctx._docsMonths('2026-07-15T10:00:00')),JSON.stringify(['2026-04-01','2026-05-01','2026-06-01']));
  assert.equal(JSON.stringify(ctx._docsMonths('2026-01-10T10:00:00')),JSON.stringify(['2025-10-01','2025-11-01','2025-12-01']));
  const months=['2026-04-01','2026-05-01','2026-06-01'];
  const bankOnly=months.map(period_month=>({kind:'bank',period_month}));
  assert.equal(ctx._docsMissing(bankOnly,months).length,3);
  assert.equal(ctx._docsMissing(bankOnly.concat(months.map(period_month=>({kind:'credit',period_month}))),months).length,0);
});

test('iPhone haptic overlays go on every button once, never on buttons holding inputs, and stop the forwarded click',()=>{
  const el=(extra={})=>({className:'',kids:[],attrs:{},listeners:{},setAttribute(k,v){this.attrs[k]=v;},appendChild(c){this.kids.push(c);},addEventListener(n,f){this.listeners[n]=f;},closest:()=>null,querySelector(sel){return sel===':scope > .hx-ov'?(this.kids.find(c=>c.className==='hx-ov')||null):(this.holdsInput?{}:null);},...extra});
  const plain=el(),withInput=el({holdsInput:true}),already=el();
  already.kids.push({className:'hx-ov'});
  let observed=0;
  const document={body:{},createElement:()=>el(),querySelectorAll:()=>[plain,withInput,already]};
  const ctx=functions(['initIosHaptics'],{document,_iosHapticsOn:false,MutationObserver:class{observe(){observed++;}},requestAnimationFrame:fn=>fn()});
  ctx.initIosHaptics();
  ctx.initIosHaptics();
  assert.equal(observed,1);
  assert.equal(plain.kids.length,1);
  assert.equal(plain.kids[0].className,'hx-ov');
  assert.equal(plain.kids[0].attrs['aria-hidden'],'true');
  assert.equal(plain.kids[0].kids[0].attrs.switch,'');
  assert.equal(withInput.kids.length,0);
  assert.equal(already.kids.length,1);
  let stopped=false;
  plain.kids[0].kids[0].listeners.click({stopPropagation(){stopped=true;}});
  assert.equal(stopped,true);
});

test('the advisor link survives a lost local copy through the signup metadata, and is cleared once sent',async()=>{
  const ref='11111111-1111-1111-1111-111111111111';
  const calls=[];const updates=[];
  const ctx=functions(['_pendingAdvisorRef','_doRequestPendingAdvisor','_authRedirectUrl','_authSignupData'],{
    _ADVISOR_REF_RE:/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    _cloudUser:{id:'u',user_metadata:{advisor_ref:ref}},
    _sb:{rpc:async(n,a)=>{calls.push(a.p_advisor);return {data:'ok',error:null};},auth:{updateUser:async d=>{updates.push(JSON.stringify(d));return {};}}},
    _notifyAdvisorPush:()=>{},showToast:()=>{}
  });
  assert.equal(ctx._authRedirectUrl(),'https://davidtheking28-oss.github.io/budget-app/?advisor='+ref);
  assert.equal(JSON.stringify(ctx._authSignupData()),JSON.stringify({advisor_ref:ref}));
  await ctx._doRequestPendingAdvisor();
  assert.deepEqual(calls,[ref]);
  assert.deepEqual(updates,[JSON.stringify({data:{advisor_ref:null}})]);
});

test('without an invite the sign-in redirect stays plain and no signup metadata is sent',()=>{
  const ctx=functions(['_pendingAdvisorRef','_authRedirectUrl','_authSignupData'],{_ADVISOR_REF_RE:/^x$/,_cloudUser:null});
  assert.equal(ctx._authRedirectUrl(),'https://davidtheking28-oss.github.io/budget-app/');
  assert.equal(JSON.stringify(ctx._authSignupData()),'{}');
});

test('the tasks badge counts only unseen, open advisor items and upcoming meetings',()=>{
  const future=new Date(Date.now()+86400000).toISOString();
  const past=new Date(Date.now()-86400000).toISOString();
  const localStorage=storage({budget_advisor_seen:JSON.stringify(['t2','m2'])});
  const ctx=functions(['_advisorSeenSet','_upcomingAdvisorMeetings','_unseenAdvisorCount'],{
    localStorage,
    _advisorTasks:[{id:'t1',done:false},{id:'t2',done:false},{id:'t3',done:true}],
    _advisorMeetings:[{id:'m1',scheduled_at:future,status:'pending'},{id:'m2',scheduled_at:future,status:'pending'},{id:'m3',scheduled_at:past,status:'pending'},{id:'m4',scheduled_at:future,status:'declined'}]
  });
  assert.equal(ctx._unseenAdvisorCount(),2);
});


function syncedFixedContext() {
  const ctx=vm.createContext({Date,JSON,Map,Set,Math,Number,parseFloat,transactions:[],fixedExpenses:[],userSettings:{},FIXED_CATS:['חשמל','ביטוחים','החזר הלוואות + חיוב קבוע'],FIXED_AUTO:{'ביטוחים':()=>300,'החזר הלוואות + חיוב קבוע':()=>900},_syncMeta:{del:{tx:{}}},mk:(y,m)=>y+'-'+String(m+1).padStart(2,'0')});
  vm.runInContext(html.split('\n').find(line=>line.startsWith('function getEffectiveFixedCats()')),ctx);
  vm.runInContext(html.slice(html.indexOf('function _fxRow('),html.indexOf('function _fxRefreshTotal(')),ctx);
  for(const name of ['_savingCats','_isSavingCat','_fundPostsTx'])vm.runInContext(html.match(new RegExp('function '+name+'\\([^]*?\\n?\\}'))[0],ctx);
  ctx._curMonthKey=()=> '2026-11';
  return ctx;
}

test('synced fixed categories and amounts are available in client cash flow',()=>{
  const ctx=syncedFixedContext();ctx.fixedExpenses=[{id:'משכנתא',amount:3000,linkedSource:'mapping'},{id:'הוצאות שנתיות (חלק חודשי)',amount:120,linkedSource:'mapping'},{id:'ביטוחים',amount:450,linkedSource:'mapping'}];
  assert.ok(ctx.getEffectiveFixedCats().includes('משכנתא'));assert.ok(ctx.getEffectiveFixedCats().includes('הוצאות שנתיות (חלק חודשי)'));assert.equal(ctx._fxMonthly('ביטוחים'),450);
});

test('synced fixed amounts materialize once and update the current client month',()=>{
  const ctx=syncedFixedContext();ctx.fixedExpenses=[{id:'חשמל',amount:420,linkedSource:'mapping'}];ctx._fxApply();
  const id='fx|2026-11|חשמל';assert.equal(ctx.transactions.find(t=>t.id===id).amount,420);
  ctx.fixedExpenses[0].amount=520;ctx._fxApply();assert.equal(ctx.transactions.find(t=>t.id===id).amount,520);assert.equal(ctx.transactions.filter(t=>t.id===id).length,1);
  ctx.fixedExpenses[0].amount=0;ctx._fxApply();assert.equal(ctx.transactions.some(t=>t.id===id),false);
});

test('synced insurance remains a mapped fixed row instead of creating another policy',()=>{
  const ctx=insuranceContext();ctx.fixedExpenses=[{id:'ביטוחים',amount:450,linkedSource:'mapping'}];ctx.insurances=[{id:'policy',monthly:300}];
  ctx._migrateInsuranceCats();assert.equal(ctx.insurances.length,1);assert.equal(ctx.fixedExpenses[0].amount,450);
});

test('a recorded fixed expense is not charged again by mapped materialization',()=>{
  const ctx=syncedFixedContext();ctx.fixedExpenses=[{id:'חשמל',amount:420,linkedSource:'mapping'}];ctx.transactions=[{id:'recorded',type:'expense',cat:'חשמל',amount:600,date:'2026-11-05'}];
  ctx._fxApply();assert.equal(ctx.transactions.filter(t=>t.cat==='חשמל').reduce((sum,t)=>sum+t.amount,0),600);
});


test('cloud category ids with loan, education and annual-expense punctuation remain stable',()=>{
  const ctx=functions(['_sanitizeIds']);const categories=['החזר הלוואות + חיוב קבוע','חינוך, חוגים וקייטנות','הוצאות שנתיות (חלק חודשי)'];
  const bundle={fixed_expenses:categories.map(id=>({id,amount:100})),transactions:categories.map(cat=>({id:'fx|2026-11|'+cat,cat,type:'expense',amount:100,date:'2026-11-01'}))};
  ctx._sanitizeIds(bundle);assert.deepEqual(bundle.fixed_expenses.map(row=>row.id),categories);assert.deepEqual(bundle.transactions.map(row=>row.id),categories.map(cat=>'fx|2026-11|'+cat));
});

test('linked mortgage survives legacy category migration unchanged',()=>{
  const ctx=insuranceContext();Object.assign(ctx,{FIXED_CATS:['דיור'],EXPENSE_CATS:[],_CAT_MIGRATE:{'משכנתא':'דיור'},subscriptions:[],userSettings:{}});
  ctx.fixedExpenses=[{id:'משכנתא',amount:3000,linkedSource:'mapping'}];ctx.budgets={'משכנתא':3000};
  vm.runInContext(html.match(/function _migrateCats\([^]*?\n\}/)[0],ctx);ctx._migrateCats();assert.equal(ctx.fixedExpenses[0].id,'משכנתא');assert.equal(ctx.budgets['משכנתא'],3000);assert.equal(ctx.budgets['דיור'],undefined);
});


test('advisor actual adjustments retain the generated fixed baseline',()=>{
  const ctx=syncedFixedContext();ctx.fixedExpenses=[{id:'חשמל',amount:420,linkedSource:'mapping'}];ctx._fxApply();ctx.transactions.push({id:'adjust',type:'expense',cat:'חשמל',amount:80,date:'2026-11-02',desc:'התאמת ביצוע (אשף תקציב)'});
  ctx._fxApply();assert.equal(ctx.transactions.filter(t=>t.cat==='חשמל').reduce((sum,t)=>sum+t.amount,0),500);
});


test('re-reading unchanged linked categories does not schedule another normalization write',()=>{
  const ctx=insuranceContext();Object.assign(ctx,{FIXED_CATS:['דיור'],EXPENSE_CATS:[],_CAT_MIGRATE:{'משכנתא':'דיור'},subscriptions:[],userSettings:{}});
  ctx.fixedExpenses=[{id:'משכנתא',amount:3000,linkedSource:'mapping'}];ctx.budgets={'משכנתא':3000};ctx.transactions=[{id:'recorded',type:'expense',cat:'משכנתא',amount:3000}];
  vm.runInContext(html.match(/function _migrateCats\([^]*?\n\}/)[0],ctx);assert.equal(ctx._migrateCats(),false);assert.equal(ctx._migrateCats(),false);
});

test('recorded expenses in linked fixed categories appear under fixed cash flow',()=>{
  const ctx=vm.createContext({fixedExpenses:[{id:'חשמל',linkedSource:'mapping'}],getEffectiveFixedCats:()=>['חשמל']});vm.runInContext(html.split('\n').find(line=>line.startsWith('function isFixed(')),ctx);
  assert.equal(ctx.isFixed({type:'expense',cat:'חשמל'}),true);assert.equal(ctx.isFixed({type:'expense',cat:'מזון לבית'}),false);assert.equal(ctx.isFixed({type:'expense',cat:'חשמל',fixed:false}),false);
});


test('client variable and transaction category lists include synced custom categories without fixed duplicates',()=>{
  const ctx=functions(['getEffectiveExpenseCats','getEffectiveCats'],{_activeMode:'personal',EXPENSE_CATS:['מזון לבית','שונות'],EXPENSE_CATS_BUSINESS:['שיווק ופרסום','אחר'],INCOME_CATS:['שכר','אחר'],INCOME_CATS_BUSINESS:['הכנסות ממכירות','אחר'],userSettings:{customCats:['לימוד אישי','חשמל','לימוד אישי']},budgets:{'תחזוקת אתר':300,'משכנתא':3000},transactions:[{type:'expense',cat:'טיול עבודה'}],getEffectiveFixedCats:()=>['חשמל','משכנתא','אחזקת ציוד']});
  const variable=Array.from(ctx.getEffectiveExpenseCats());assert.ok(variable.includes('תחזוקת אתר'));assert.ok(variable.includes('טיול עבודה'));assert.ok(!variable.includes('חשמל'));assert.equal(new Set(variable).size,variable.length);
  assert.ok(ctx.getEffectiveCats('expense').includes('משכנתא'));assert.ok(ctx.getEffectiveCats('expense').includes('אחזקת ציוד'));
  ctx._activeMode='business';assert.ok(ctx.getEffectiveExpenseCats().includes('שיווק ופרסום'));assert.ok(!ctx.getEffectiveExpenseCats().includes('מזון לבית'));
});

test('business other and intentionally registered legacy names survive client migration',()=>{
  const ctx=insuranceContext();Object.assign(ctx,{_activeMode:'business',EXPENSE_CATS_BUSINESS:['שיווק ופרסום','אחר'],FIXED_CATS:['חשמל'],EXPENSE_CATS:[],_CAT_MIGRATE:{'אחר':'שונות','חינוך':'שונות'},subscriptions:[],userSettings:{customCats:['חינוך']}});
  ctx.transactions=[{type:'expense',cat:'אחר'},{type:'expense',cat:'חינוך'}];ctx.budgets={'אחר':300,'חינוך':100};
  vm.runInContext(html.match(/function _migrateCats\([^]*?\n\}/)[0],ctx);assert.equal(ctx._migrateCats(),false);assert.equal(ctx.transactions[0].cat,'אחר');assert.equal(ctx.transactions[1].cat,'חינוך');assert.equal(ctx.budgets['אחר'],300);
});


test('explicit custom fixed names do not get merged into legacy housing names',()=>{
 const ctx=insuranceContext();ctx.userSettings={customFixedCats:['משכנתא']};ctx.fixedExpenses=[{id:'משכנתא',amount:3000}];ctx._mergeFixedCatInto(['משכנתא'],'דיור');assert.equal(ctx.fixedExpenses[0].id,'משכנתא');
});


test('advisor tasks from an earlier signed-in client cannot overwrite the current account',async()=>{
 const pending=[];const sb={from:()=>{const query={select:()=>query,eq:()=>query,order:()=>new Promise(resolve=>pending.push(resolve))};return query;}};
 const ctx=functions(['_loadAdvisorTasks'],{_sb:sb,_cloudUser:{id:'first'},_advisorLink:{status:'active',advisor_id:'advisor'},_advisorTasks:[],_advisorMeetings:[],_advisorTasksError:false,_advisorTaskRequest:0,_advisorTaskPending:new Set()});
 const read=ctx._loadAdvisorTasks();ctx._cloudUser={id:'second'};pending[0]({data:[{id:'private-first-client'}]});pending[1]({data:[]});await read;assert.equal(ctx._advisorTasks.length,0);
});

test('rapid client task toggles send one update until the first one finishes',async()=>{
 const pending=[];const task={id:'task',done:false};const ctx=functions(['toggleAdvisorTask'],{_advisorTasks:[task],_cloudUser:{id:'client'},_advisorLink:{status:'active',advisor_id:'advisor'},_advisorTaskRequest:0,_advisorTaskPending:new Set(),renderTasksPage:()=>{},showToast:()=>{},_sb:{rpc:()=>new Promise(resolve=>pending.push(resolve))}});
 const first=ctx.toggleAdvisorTask('task',true);const second=ctx.toggleAdvisorTask('task',false);assert.equal(pending.length,1);pending[0]({data:true});await Promise.all([first,second]);assert.equal(task.done,true);assert.equal(task.done_by,'client');
});

test('client task update failure restores the open state and allows retry',async()=>{
 let fail=true;const task={id:'task',done:false};const ctx=functions(['toggleAdvisorTask'],{_advisorTasks:[task],_cloudUser:{id:'client'},_advisorLink:{status:'active',advisor_id:'advisor'},_advisorTaskRequest:0,_advisorTaskPending:new Set(),renderTasksPage:()=>{},showToast:()=>{},_sb:{rpc:async()=>{if(fail)throw Error('offline');return{data:true};}}});
 await ctx.toggleAdvisorTask('task',true);assert.equal(task.done,false);assert.equal(ctx._advisorTaskPending.size,0);fail=false;await ctx.toggleAdvisorTask('task',true);assert.equal(task.done,true);assert.equal(task.done_by,'client');
});


test('installed app back closes the top nested sheet rather than its parent',()=>{
  let onBack;const closed=[];const sheets=new Set(['addTxSheet','moveCatSheet']);
  const ctx=functions(['initBackButton'],{window:{matchMedia:()=>({matches:true}),addEventListener:(name,fn)=>{if(name==='popstate')onBack=fn;}},navigator:{standalone:true},history:{pushState:()=>{}},_openSheets:sheets,document:{getElementById:id=>({id}),querySelector:()=>({id:'addTxSheet'})},closeSheet:id=>{closed.push(id);sheets.delete(id);},closeMonthSheet:()=>{}});
  ctx.initBackButton();onBack();assert.deepEqual(closed,['moveCatSheet']);assert.equal(sheets.has('addTxSheet'),true);
  onBack();assert.deepEqual(closed,['moveCatSheet','addTxSheet']);
});

test('installed app back still closes the month picker when no sheet is open',()=>{
  let onBack;let closed=false;
  const ctx=functions(['initBackButton'],{window:{matchMedia:()=>({matches:true}),addEventListener:(name,fn)=>{if(name==='popstate')onBack=fn;}},navigator:{standalone:true},history:{pushState:()=>{}},_openSheets:new Set(),document:{querySelector:()=>({id:'monthSheetOverlay'})},closeMonthSheet:()=>{closed=true;}});
  ctx.initBackButton();onBack();assert.equal(closed,true);
});


test('resume lock restores pre-existing inert and accessibility states',()=>{
  const element = initial => {
    const attrs = new Map(Object.entries(initial));
    return { tagName:'MAIN', getAttribute:key=>attrs.has(key)?attrs.get(key):null, hasAttribute:key=>attrs.has(key), setAttribute:(key,value)=>attrs.set(key,value), removeAttribute:key=>attrs.delete(key) };
  };
  const background=element({inert:'','aria-hidden':'true'});
  const dialog=element({});const overlay=element({});
  const ctx=vm.createContext({_wasHidden:null,getEl:()=>overlay,document:{body:{children:[background,dialog,overlay]}}});
  vm.runInContext(html.match(/  function hideBehind\(on\)\{[^]*?\n  \}/)[0],ctx);
  ctx.hideBehind(true);assert.equal(dialog.hasAttribute('inert'),true);
  ctx.hideBehind(false);assert.equal(background.hasAttribute('inert'),true);assert.equal(background.getAttribute('aria-hidden'),'true');
  assert.equal(dialog.hasAttribute('inert'),false);assert.equal(dialog.getAttribute('aria-hidden'),null);
});


test('summary figures keep savings out of expenses and split fixed from variable',()=>{
  const tx=[
    {type:'income',cat:'שכר',amount:10000},
    {type:'expense',cat:'דיור',amount:3000,fixed:true},
    {type:'expense',cat:'מזון לבית',amount:1200,fixed:false},
    {type:'saving',cat:'הוראת קבע לחסכון',amount:500,fixed:true}
  ];
  const ctx=functions(['_sumFigures','_sumFlowOf'],{
    currentYear:2026,currentMonth:10,getMonthTx:()=>tx,isFixed:t=>t.fixed,
    _incomeSourcesFor:()=>[{amount:'11000'}],monthlyIncomeFor:()=>10000,
    _savingCats:()=>['הוראת קבע לחסכון'],_isSavingCat:c=>c==='הוראת קבע לחסכון',_fundPostsTx:()=>true,getEffectiveFixedCats:()=>['דיור','הוראת קבע לחסכון'],
    _fxMonthly:c=>c==='דיור'?3500:1000,getEffectiveExpenseCats:()=>['מזון לבית','פארם'],budgets:{'מזון לבית':1500}
  });
  const f=ctx._sumFigures();
  assert.equal(f.planInc,11000);assert.equal(f.planExp,5000);
  assert.equal(f.actInc,10000);assert.equal(f.actExp,4200);
  assert.equal(f.plan.sav,1000);assert.equal(f.actual.sav,500);
  const plan=ctx._sumFlowOf(f.plan),actual=ctx._sumFlowOf(f.actual);
  assert.equal(plan.flowNoSav,6000);assert.equal(plan.flow,5000);
  assert.equal(actual.flowNoSav,5800);assert.equal(actual.flow,5300);
});
test('yearly summary adds the months up to the cutoff and merges categories',()=>{
  const tx=[{type:'income',cat:'שכר',amount:10000},{type:'expense',cat:'דיור',amount:3000,fixed:true},{type:'expense',cat:'מזון לבית',amount:1200,fixed:false}];
  const ctx=functions(['_sumFigures','_sumAddCats','_sumAddSide','_sumFiguresYear'],{
    currentYear:2026,currentMonth:10,transactions:[{date:'2026-01-05'}],getMonthTx:()=>tx,isFixed:t=>t.fixed,
    _incomeSourcesFor:()=>[{amount:'11000'}],monthlyIncomeFor:()=>10000,
    _savingCats:()=>[],_isSavingCat:()=>false,_fundPostsTx:()=>true,getEffectiveFixedCats:()=>['דיור'],
    _fxMonthly:()=>3500,getEffectiveExpenseCats:()=>['מזון לבית'],budgets:{'מזון לבית':1500}
  });
  const y=ctx._sumFiguresYear(2026,2);
  assert.equal(y.planInc,33000);assert.equal(y.planExp,15000);
  assert.equal(y.actInc,30000);assert.equal(y.actExp,12600);
  assert.equal(y.actual.fixedCats.find(c=>c.label==='דיור').value,9000);
  assert.equal(y.plan.varCats.length,1);
});
test('summary chart scale rounds the largest value up to a clean axis maximum',()=>{
  const ctx=functions(['_sumNiceMax'],{Math});
  assert.equal(ctx._sumNiceMax(0),100);
  assert.equal(ctx._sumNiceMax(14000),20000);
  assert.equal(ctx._sumNiceMax(2192),2500);
  assert.equal(ctx._sumNiceMax(100),100);
});


function appEntryContext(user=null){
 const calls=[];
 const ctx=functions(['_proceedToApp','_authGateResolve'],{_cloudUser:user,_dashboardStarted:false,_gateDone:false,_gateShown:false,_authGateTimer:1,clearTimeout:()=>{},hideSplash:()=>calls.push('splash'),showAuthScreen:()=>calls.push('auth'),showPage:name=>calls.push(name),_decideOnboarding:()=>calls.push('onboarding'),updateModeSwitcher:()=>calls.push('mode'),setTimeout:()=>0,animateHeroNums:()=>{},document:{getElementById:()=>({})}});
 return {ctx,calls};
}

test('signed-out startup does not build the hidden dashboard',()=>{
 const t=appEntryContext();t.ctx._authGateResolve(null);
 assert.equal(t.calls.includes('dashboard'),false);assert.equal(t.calls.includes('auth'),true);
});

test('entering the app builds the dashboard once and preserves later navigation',()=>{
 const t=appEntryContext({id:'cached-client'});t.ctx._proceedToApp();t.ctx._proceedToApp();
 assert.equal(t.calls.filter(call=>call==='dashboard').length,1);
 assert.equal(t.calls.includes('onboarding'),false);
});

test('local-only entry still initializes the dashboard and onboarding',()=>{
 const t=appEntryContext();t.ctx._proceedToApp();
 assert.equal(t.calls.includes('dashboard'),true);assert.equal(t.calls.includes('onboarding'),true);
});


function chartLoaderContext(){
 const scripts=[];const ctx=functions(['_ensureChartLibrary'],{_chartLibraryPromise:null,document:{createElement:()=>({remove(){this.removed=true;}}),head:{appendChild:script=>scripts.push(script)}}});
 return {ctx,scripts};
}

test('chart loading is deferred and concurrent requests share one download',async()=>{
 const t=chartLoaderContext();assert.equal(t.scripts.length,0);
 const first=t.ctx._ensureChartLibrary(),second=t.ctx._ensureChartLibrary();assert.equal(first,second);assert.equal(t.scripts.length,1);
 t.ctx.Chart=function Chart(){};t.scripts[0].onload();assert.equal(await first,t.ctx.Chart);
 await t.ctx._ensureChartLibrary();assert.equal(t.scripts.length,1);
});

test('failed chart downloads can be retried instead of leaving a rejected cache',async()=>{
 const t=chartLoaderContext();const failed=t.ctx._ensureChartLibrary();t.scripts[0].onerror();await assert.rejects(failed,/unavailable/);assert.equal(t.scripts[0].removed,true);
 const retry=t.ctx._ensureChartLibrary();assert.equal(t.scripts.length,2);t.ctx.Chart=function Chart(){};t.scripts[1].onload();assert.equal(await retry,t.ctx.Chart);
});


test('published configuration does not enable the local development entry path',()=>{
 let entered=0;const published=html.replaceAll('__SUPABASE_ANON__','test-published-key');
 const ctx=vm.createContext({_localAccountReady:true,localStorage:storage(),_sb:{},SUPA_ANON:'test-published-key',_gateDone:false,_authGateTimer:null,hideSplash:()=>{},showAuthScreen:()=>{},_proceedToApp:()=>{entered++;},setTimeout:()=>1,document:{getElementById:()=>null}});
 vm.runInContext(published.match(/function _initAuthGate\([^]*?\n\}/)[0],ctx);ctx._initAuthGate();
 assert.equal(entered,0);assert.equal(ctx._gateDone,false);assert.equal(ctx._authGateTimer,1);
});


test('bundled authentication SDK matches the pinned browser integrity signature',()=>{
 const match=html.match(/<script src="\.\/assets\/vendor\/supabase-2\.108\.2\.min\.js" integrity="([^"]+)"/);assert.ok(match);
 const code=fs.readFileSync(path.join(root,'assets/vendor/supabase-2.108.2.min.js'));
 const actual='sha384-'+require('node:crypto').createHash('sha384').update(code).digest('base64');assert.equal(actual,match[1]);
});

test('new offline worker cannot activate without the bundled authentication SDK',async()=>{
 const events={},items=new Map();let activated=false;const cache={add:async key=>{if(key.includes('/vendor/'))throw Error('network failed');items.set(key,{});},match:async key=>items.get(key),put:async(key,value)=>items.set(key,value)};
 const ctx={URL,Response,Promise,self:{location:{origin:'https://app.test'},addEventListener:(name,fn)=>{events[name]=fn;},skipWaiting:async()=>{activated=true;}},caches:{open:async()=>cache,match:async()=>undefined},fetch:()=>{throw Error('offline');},setTimeout,clearTimeout};
 vm.runInNewContext(fs.readFileSync(path.join(root,'sw.js'),'utf8'),ctx);let install;events.install({waitUntil:p=>{install=p;}});
 await assert.rejects(install,/Required offline asset/);assert.equal(activated,false);
});


test('missing SDK in a configured app waits for retry instead of entering development mode',()=>{
 let entered=0;const ctx=functions(['_initAuthGate'],{_localAccountReady:true,localStorage:storage(),_sb:null,SUPA_ANON:'published-key',_gateDone:false,_authGateTimer:null,hideSplash:()=>{},showAuthScreen:()=>{},_proceedToApp:()=>{entered++;},setTimeout:()=>1,document:{getElementById:()=>null}});
 ctx._initAuthGate();assert.equal(entered,0);assert.equal(ctx._gateDone,false);assert.equal(ctx._authGateTimer,1);
});

test('cached users keep local access when the SDK is temporarily unavailable',()=>{
 let entered=0;const ctx=functions(['_initAuthGate'],{_localAccountReady:true,localStorage:storage({'sb-local-auth-token':JSON.stringify({user:{id:'cached-client'}})}),_sb:null,SUPA_ANON:'published-key',_cloudUser:null,_gateDone:false,_authGateTimer:null,hideSplash:()=>{},showAuthScreen:()=>{},_proceedToApp:()=>{entered++;},_loadAdvisorStatus:async()=>{},_applyAdvisorGate:()=>{},_loadMeetingAlerts:()=>{},_hasRealData:()=>true,setTimeout:()=>1,document:{getElementById:()=>null}});
 ctx._initAuthGate();assert.equal(entered,1);assert.equal(ctx._cloudUser.id,'cached-client');assert.equal(ctx._gateDone,true);
});
test('cash flow expansion restores keyboard focus without changing the scroll position',()=>{
  const key='fx:insurance',id='exp-toggle-'+encodeURIComponent(key);
  const main={scrollTop:240};let focusOptions;
  const ctx=functions(['toggleExpGroup'],{
    _expOpenGroups:new Set(),
    document:{activeElement:{id},getElementById:value=>value==='main-content'?main:value===id?{focus:options=>{focusOptions=options;}}:null},
    renderTxPage:()=>{main.scrollTop=0;},
  });
  ctx.toggleExpGroup(key);
  assert.equal(ctx._expOpenGroups.has(key),true);
  assert.equal(main.scrollTop,240);
  assert.equal(focusOptions.preventScroll,true);
  ctx.toggleExpGroup(key);
  assert.equal(ctx._expOpenGroups.has(key),false);
  assert.equal(main.scrollTop,240);
});
test('advisor budget settings without a profile name are applied and refresh the client',async()=>{
  const cloudRow={updated_at:'2026-11-04T08:00:00Z',sync_meta:{},settings:{customCats:['תקציב מותאם'],incomeSources:[{name:'שכר',amount:4000}]}};
  const query={select:()=>query,eq:()=>query,maybeSingle:async()=>({data:cloudRow,error:null})};let refreshes=0;
  const ctx=functions(['_loadFromCloud'],{localStorage:storage({budget_local_owner:'u1'}),_cloudUser:{id:'u1'},_sb:{from:()=>query},_localAccountReady:true,_getDataUserId:()=>'u1',_activeMode:'personal',_modeKey:k=>k,_syncMeta:{},_mergeMeta:a=>a,_buildMerged:()=>({}),_applyMerged:()=>false,userSettings:{},_seedIncomeHistory:()=>{},_syncCurrentIncome:()=>{},refreshAll:()=>{refreshes++;},_decideOnboarding:()=>{},_syncPending:false,_setSyncState:()=>{},renderCloudSection:()=>{},scheduleCloudSave:()=>{},_householdOwner:null,_doCloudSave:async()=>{},_DEBUG:false});
  await ctx._loadFromCloud(true);
  assert.deepEqual(Array.from(ctx.userSettings.customCats||[]),['תקציב מותאם']);
  assert.equal(ctx.userSettings.incomeSources[0].amount,4000);
  assert.equal(refreshes,1);
});
test('automatic budget refresh coalesces duplicate reads and allows a new mode to refresh',async()=>{
  const resolvers=[];let reads=0;
  const ctx=functions(['_refreshCloudBudget'],{navigator:{onLine:true},document:{hidden:false},_cloudUser:{id:'u1'},_sb:{},_localAccountReady:true,_getDataUserId:()=>'u1',_activeMode:'personal',_cloudBudgetRefresh:null,_loadFromCloud:()=>{reads++;return new Promise(resolve=>resolvers.push(resolve));}});
  const first=ctx._refreshCloudBudget();
  assert.equal(ctx._refreshCloudBudget(),first);
  assert.equal(reads,1);
  ctx._activeMode='business';
  const second=ctx._refreshCloudBudget();
  assert.equal(reads,2);
  resolvers[0]();await first;
  assert.equal(ctx._refreshCloudBudget(),second);
  resolvers[1]();await second;
  assert.equal(ctx._cloudBudgetRefresh,null);
});
test('automatic budget refresh stays idle while hidden, offline or signed out',async()=>{
  let reads=0;
  const ctx=functions(['_refreshCloudBudget'],{navigator:{onLine:false},document:{hidden:false},_cloudUser:{id:'u1'},_sb:{},_localAccountReady:true,_cloudBudgetRefresh:null,_loadFromCloud:async()=>{reads++;}});
  await ctx._refreshCloudBudget();ctx.navigator.onLine=true;ctx.document.hidden=true;
  await ctx._refreshCloudBudget();ctx.document.hidden=false;ctx._cloudUser=null;
  await ctx._refreshCloudBudget();
  assert.equal(reads,0);
});
test('budget subscription refreshes on reconnection and external advisor updates',()=>{
  let changed,status,reads=0,toasts=0;const filters=[];
  const channel={on:(_event,filter,callback)=>{filters.push(filter);changed=callback;return channel;},subscribe:callback=>{status=callback;return channel;}};
  const ctx=functions(['_subscribeHousehold'],{_sb:{channel:()=>channel},_getDataUserId:()=>'client',_realtimeChannel:null,_cloudUser:{id:'client'},_advisorLink:{status:'active',advisor_id:'advisor'},_refreshCloudBudget:()=>{reads++;},showToast:()=>{toasts++;}});
  ctx._subscribeHousehold();
  assert.equal(filters[0].filter,'user_id=eq.client');
  status('SUBSCRIBED');assert.equal(reads,1);
  changed({new:{updated_by:'advisor'}});assert.equal(reads,2);assert.equal(toasts,1);
  changed({new:{updated_by:'client'}});assert.equal(reads,2);
});
test('income summaries match names with surrounding spaces without counting the plan again',()=>{
  const now=new Date();
  const ctx=functions(['monthlyIncomeFor'],{getMonthTx:()=>[{type:'income',desc:' DJ ',amount:500}],_incomeSourcesFor:()=>[{name:'dj',amount:1000}]});
  assert.equal(ctx.monthlyIncomeFor(now.getFullYear(),now.getMonth()),500);
});
test('automatic income posting recognizes normalized names and never posts duplicate source names twice',()=>{
  const now=new Date();const key=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');let saves=0;
  const ctx=functions(['checkRecurringIncome'],{currentYear:now.getFullYear(),currentMonth:now.getMonth(),mk:()=>key,_modeKey:k=>k,userSettings:{incomeSources:[{name:'שכר',amount:1000,day:1},{name:' שכר ',amount:1000,day:1}]},transactions:[],localISO:()=>key+'-01',saveData:()=>{saves++;},refreshAll:()=>{},showUndoToast:()=>{},esc:s=>s});
  ctx.checkRecurringIncome();assert.equal(ctx.transactions.length,1);assert.equal(saves,1);
  saves=0;ctx.transactions=[{id:1,type:'income',desc:' שכר ',amount:1000,date:key+'-01'}];ctx.localStorage=storage();
  ctx.checkRecurringIncome();assert.equal(ctx.transactions.length,1);assert.equal(saves,0);
});

function clientTaskContext(rpc) {
  const fields = Object.fromEntries(['clientTaskForm','clientTaskTitle','clientTaskDue','clientTaskSubmit','clientTaskError','clientTaskComposer'].map(id => [id,{value:'',hidden:true,disabled:false,setAttribute(){},removeAttribute(){},focus(){}}]));
  fields.clientTaskTitle.value=' לבדוק דמי ניהול ';
  fields.clientTaskDue.value='2026-12-01';
  fields.clientTaskForm.reset=()=>{fields.clientTaskTitle.value='';fields.clientTaskDue.value='';};
  const ctx=functions(['addClientTask'],{crypto:{randomUUID:()=> 'request-id'},document:{getElementById:id=>fields[id],querySelector:()=>null},_clientTaskSaving:false,_clientTaskDraft:null,_advisorTaskRequest:0,_advisorTasks:[],_cloudUser:{id:'client'},_advisorLink:{advisor_id:'advisor',status:'active'},_sb:{rpc},_advisorSeenSet:()=>new Set(),renderTasksPage(){},showToast(){}});
  return {ctx,fields};
}

test('client creates a task for the active advisor and clears the form only after success',async()=>{
  let payload;
  const {ctx,fields}=clientTaskContext(async(name,p)=>{assert.equal(name,'add_client_task');payload=p;return {data:{id:p.p_request_id,client_id:'client',advisor_id:'advisor',title:p.p_title,done:false}};});
  await ctx.addClientTask();
  assert.equal(payload.p_title,'לבדוק דמי ניהול');assert.equal(payload.p_due_date,'2026-12-01');assert.equal(ctx._advisorTasks.length,1);assert.equal(fields.clientTaskTitle.value,'');assert.equal(ctx._clientTaskSaving,false);
});

test('client task retry reuses the request identity and preserves the draft after a failed save',async()=>{
  const ids=[];
  const {ctx,fields}=clientTaskContext(async(_name,p)=>{ids.push(p.p_request_id);return ids.length===1?{error:{message:'lost response'}}:{data:{id:p.p_request_id,client_id:'client',advisor_id:'advisor',title:p.p_title}};});
  await ctx.addClientTask();assert.equal(fields.clientTaskError.hidden,false);assert.equal(fields.clientTaskTitle.value,' לבדוק דמי ניהול ');assert.equal(fields.clientTaskSubmit.disabled,false);assert.equal(ctx._advisorTasks.length,0);
  await ctx.addClientTask();assert.equal(ids[0],ids[1]);assert.equal(ctx._advisorTasks.length,1);
});

test('client task creation rejects an empty title and ignores double submission',async()=>{
  let calls=0,complete;
  const {ctx,fields}=clientTaskContext((_name,p)=>{calls++;return new Promise(resolve=>{complete=()=>resolve({data:{id:p.p_request_id,client_id:'client',advisor_id:'advisor'}});});});
  fields.clientTaskTitle.value='  ';await ctx.addClientTask();assert.equal(calls,0);
  fields.clientTaskTitle.value='משימה';const pending=ctx.addClientTask();await ctx.addClientTask();assert.equal(calls,1);assert.equal(fields.clientTaskSubmit.disabled,true);complete();await pending;
});

test('a late task creation response does not add a task to another account',async()=>{
  let complete;
  const {ctx,fields}=clientTaskContext((_name,p)=>new Promise(resolve=>{complete=()=>resolve({data:{id:p.p_request_id,client_id:'client',advisor_id:'advisor'}});}));
  const pending=ctx.addClientTask();ctx._cloudUser={id:'other-client'};fields.clientTaskTitle.value='טיוטה אחרת';complete();await pending;
  assert.equal(ctx._advisorTasks.length,0);assert.equal(fields.clientTaskTitle.value,'טיוטה אחרת');
});

test('client task creation requires an active advisor connection',async()=>{
  let calls=0;const {ctx}=clientTaskContext(async()=>{calls++;});ctx._advisorLink.status='pending';await ctx.addClientTask();assert.equal(calls,0);
});

test('meeting booking dates use Israel working days and skip elapsed final starts',()=>{
  const ctx=functions(['_clientMeetingClock','_clientMeetingDefaultDate']);
  assert.equal(ctx._clientMeetingDefaultDate(new Date('2026-11-06T10:00:00Z')),'2026-11-06');
  assert.equal(ctx._clientMeetingDefaultDate(new Date('2026-11-06T12:00:00Z')),'2026-11-08');
  assert.equal(ctx._clientMeetingDefaultDate(new Date('2026-11-07T08:00:00Z')),'2026-11-08');
  assert.equal(ctx._clientMeetingDefaultDate(new Date('2026-11-05T15:00:00Z')),'2026-11-06');
  assert.equal(ctx._clientMeetingClock(new Date('2027-07-04T05:30:00Z')).minutes,510);
});

function clientMeetingContext(rpc) {
  const startsAt='2030-01-06T07:00:00+00:00';
  const fields=Object.fromEntries(['clientMeetingForm','clientMeetingDate','clientMeetingSlot','clientMeetingSubmit','clientMeetingError','clientMeetingComposer','clientMeetingSlotsStatus','clientMeetingRetry'].map(id=>[id,{value:'',hidden:true,disabled:false,setAttribute(){},removeAttribute(){},focus(){}}]));
  fields.clientMeetingDate.value='2030-01-06';fields.clientMeetingSlot.value=startsAt;
  fields.clientMeetingForm.reset=()=>{fields.clientMeetingSlot.value='';};
  const ctx=functions(['requestClientMeeting'],{crypto:{randomUUID:()=> 'meeting-request-id'},document:{getElementById:id=>fields[id],querySelector:()=>null},_clientMeetingSaving:false,_clientMeetingDraft:null,_clientMeetingSlots:[{starts_at:startsAt,label:'09:00–10:00'}],_advisorTaskRequest:0,_advisorMeetings:[],_cloudUser:{id:'client'},_advisorLink:{advisor_id:'advisor',status:'active'},_sb:{rpc},_advisorSeenSet:()=>new Set(),renderTasksPage(){},showToast(){},loadClientMeetingSlots(){ctx.reloaded=true;}});
  return {ctx,fields,startsAt};
}

test('a client meeting request remains pending for advisor approval',async()=>{
  const {ctx,fields,startsAt}=clientMeetingContext(async(name,p)=>{assert.equal(name,'request_client_meeting');assert.equal(p.p_notes,null);return {data:{id:p.p_request_id,client_id:'client',advisor_id:'advisor',scheduled_at:p.p_starts_at,status:'pending',requested_by_client:true}};});
  await ctx.requestClientMeeting();assert.equal(ctx._advisorMeetings.length,1);assert.equal(ctx._advisorMeetings[0].status,'pending');assert.equal(ctx._advisorMeetings[0].scheduled_at,startsAt);
});

test('meeting request retries reuse their identity and keep the draft after a failed save',async()=>{
  const ids=[];const {ctx,fields}=clientMeetingContext(async(_name,p)=>{ids.push(p.p_request_id);return ids.length===1?{error:{code:'network'}}:{data:{id:p.p_request_id,client_id:'client',advisor_id:'advisor',scheduled_at:p.p_starts_at,status:'pending',requested_by_client:true}};});
  await ctx.requestClientMeeting();assert.equal(fields.clientMeetingError.hidden,false);assert.equal(ctx._advisorMeetings.length,0);
  await ctx.requestClientMeeting();assert.equal(ids[0],ids[1]);assert.equal(ctx._advisorMeetings.length,1);
});

test('a meeting slot conflict refreshes availability after a taken slot',async()=>{
  const {ctx,fields}=clientMeetingContext(async()=>({error:{code:'23P01'}}));await ctx.requestClientMeeting();assert.equal(ctx.reloaded,true);assert.equal(ctx._advisorMeetings.length,0);
});

test('client meeting creation ignores double clicks and late responses for another account',async()=>{
  let complete,calls=0;const {ctx}=clientMeetingContext((_name,p)=>{calls++;return new Promise(resolve=>{complete=()=>resolve({data:{id:p.p_request_id,client_id:'client',advisor_id:'advisor',scheduled_at:p.p_starts_at,status:'pending',requested_by_client:true}});});});
  const pending=ctx.requestClientMeeting();await ctx.requestClientMeeting();assert.equal(calls,1);ctx._cloudUser={id:'other'};complete();await pending;assert.equal(ctx._advisorMeetings.length,0);
});

test('a client cannot choose a meeting time not returned in the available slots',async()=>{
  let calls=0;const {ctx,fields}=clientMeetingContext(async()=>{calls++;});fields.clientMeetingSlot.value='2030-01-06T04:00:00Z';await ctx.requestClientMeeting();assert.equal(calls,0);assert.equal(fields.clientMeetingError.hidden,false);
});

test('client-requested pending meetings never show the client an approval button',()=>{
  const element={innerHTML:''};const ctx=functions(['_renderMeetingAlerts'],{document:{getElementById:()=>element},localISO:()=> '2030-01-06',esc:s=>s,_meetingReminderDismissed:()=>false});
  ctx._renderMeetingAlerts([{id:'m',scheduled_at:'2030-01-06T07:00:00Z',status:'pending',requested_by_client:true}]);assert.equal(element.innerHTML,'');
  ctx._renderMeetingAlerts([{id:'m',scheduled_at:'2030-01-06T07:00:00Z',status:'pending',requested_by_client:false}]);assert.match(element.innerHTML,/אשר/);
});

function applePayContext(rows,over={}) {
  const log=[];
  const query={select(){return query;},eq(){return query;},order(){return query;},limit(){return Promise.resolve({data:rows,error:null});},delete(){return {in(_c,ids){return {eq(){log.push('delete:'+ids.join(','));return Promise.resolve({error:null});}};}};}};
  const ctx=functions(['pullIncomingExpenses'],{_applePayPulling:false,_aiCatCache:new Map(),_aiCategorizeMerchant:async()=>null,_sb:{from:()=>query},_cloudUser:{id:'u1'},_activeMode:'personal',_localAccountReady:true,document:{hidden:false},navigator:{onLine:true},transactions:[],categorize:d=>d.includes('שופרסל')?'מזון לבית':null,localISO:d=>d.toISOString().slice(0,10),saveData(){log.push('save');},refreshAll(){log.push('refresh');},showToast(m){log.push('toast:'+m);},...over});
  return {ctx,log};
}

test('apple pay expenses are categorized, saved, and only then removed from the inbox',async()=>{
  const {ctx,log}=applePayContext([{id:'a1',merchant:'שופרסל דיל',amount:'45.5',occurred_at:'2026-11-08T10:00:00Z'},{id:'a2',merchant:'מקום לא מוכר',amount:12,occurred_at:'2026-11-08T11:00:00Z'}]);
  await ctx.pullIncomingExpenses();
  assert.equal(ctx.transactions.length,2);
  assert.equal(ctx.transactions.find(t=>t.srcId==='a1').cat,'מזון לבית');
  assert.equal(ctx.transactions.find(t=>t.srcId==='a2').cat,'שונות');
  assert.equal(ctx.transactions.every(t=>t.type==='expense'&&t.amount>0),true);
  assert.ok(log.indexOf('save')>=0&&log.indexOf('save')<log.indexOf('delete:a1,a2'));
});

test('apple pay inbox rows already imported or invalid are dropped without duplicating or importing junk',async()=>{
  const {ctx,log}=applePayContext([{id:'d1',merchant:'כפול',amount:5,occurred_at:'2026-11-08T10:00:00Z'},{id:'bad',merchant:'מינוס',amount:-3,occurred_at:'2026-11-08T10:00:00Z'},{id:'ctl',merchant:'שם\u0000עם\u0007בקרה',amount:9,occurred_at:'2026-11-08T10:00:00Z'}],{transactions:[{id:1,srcId:'d1',type:'expense',amount:5}]});
  await ctx.pullIncomingExpenses();
  assert.equal(ctx.transactions.filter(t=>t.srcId==='d1').length,1);
  assert.equal(ctx.transactions.some(t=>t.srcId==='bad'),false);
  assert.equal(ctx.transactions.find(t=>t.srcId==='ctl').desc.includes('\u0000'),false);
  assert.ok(log.includes('delete:d1,bad,ctl'));
});

test('apple pay inbox is ignored outside the personal account and when the account changes mid-fetch',async()=>{
  const business=applePayContext([{id:'b1',merchant:'x',amount:5,occurred_at:'2026-11-08T10:00:00Z'}],{_activeMode:'business'});
  await business.ctx.pullIncomingExpenses();
  assert.equal(business.ctx.transactions.length,0);assert.equal(business.log.length,0);
  const rows=[{id:'s1',merchant:'x',amount:5,occurred_at:'2026-11-08T10:00:00Z'}];
  const {ctx,log}=applePayContext(rows);
  const original=ctx._sb.from;ctx._sb.from=()=>{const q=original();const limit=q.limit;q.limit=()=>{ctx._activeMode='business';return limit();};return q;};
  await ctx.pullIncomingExpenses();
  assert.equal(ctx.transactions.length,0);assert.equal(log.some(l=>l.startsWith('delete')),false);
});

test('index.html contains no raw control characters that corrupt inline scripts',()=>{
  const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
  const bad=[...html].filter(c=>{const n=c.charCodeAt(0);return n<32&&n!==9&&n!==10&&n!==13;});
  assert.equal(bad.length,0);
});

test('a loan with remaining payments counts down monthly and leaves the cashflow when it ends',()=>{
  const key=n=>{const d=new Date();d.setMonth(d.getMonth()-n,1);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');};
  const loans=[{id:1,monthly:500,monthsLeft:6,monthsLeftAnchor:key(2)},{id:2,monthly:300,monthsLeft:3,monthsLeftAnchor:key(3)},{id:3,monthly:200},{id:4,monthly:100,monthsLeft:9}];
  const ctx=functions(['_monthsElapsed','_loanMonthsLeft','_loanEnded'],{_curMonthKey:()=>key(0)});
  assert.equal(ctx._loanMonthsLeft(loans[0]),4);
  assert.equal(ctx._loanEnded(loans[1]),true);
  assert.deepEqual(loans.filter(l=>!ctx._loanEnded(l)).map(l=>l.id),[1,3,4]);assert.ok(html.includes('function activeLoans(){ return loans.filter(l=>!l.closed&&!_loanEnded(l)); }'))
  assert.equal(ctx._loanMonthsLeft(loans[3]),9);
});

test('apple pay merchants the dictionary cannot place are categorized by the AI service, and bad AI answers fall back safely',async()=>{
  const asked=[];
  const {ctx,log}=applePayContext([{id:'q1',merchant:'MYSTERY CAFE',amount:20,occurred_at:'2026-11-08T10:00:00Z'},{id:'q2',merchant:'WEIRD SHOP',amount:30,occurred_at:'2026-11-08T10:00:00Z'},{id:'q3',merchant:'שופרסל דיל',amount:5,occurred_at:'2026-11-08T10:00:00Z'}],{_aiCategorizeMerchant:async d=>{asked.push(d);return d==='MYSTERY CAFE'?'אוכל בחוץ ובילויים':null;}});
  await ctx.pullIncomingExpenses();
  assert.equal(ctx.transactions.find(t=>t.srcId==='q1').cat,'אוכל בחוץ ובילויים');
  assert.equal(ctx.transactions.find(t=>t.srcId==='q2').cat,'שונות');
  assert.deepEqual(asked,['MYSTERY CAFE','WEIRD SHOP']);
  assert.ok(log.includes('delete:q1,q2,q3'));
});

test('the AI merchant lookup accepts only known expense categories and survives failures',async()=>{
  let answer={category:'אוכל בחוץ ובילויים'},calls=0,ok=true;
  const make=()=>functions(['_aiCategorizeMerchant'],{_aiCatCache:new Map(),_sb:{auth:{getSession:async()=>({data:{session:{access_token:'tok'}}})}},SUPA_URL:'https://x.test',SUPA_ANON:'anon',userSettings:{},EXPENSE_CATS:['אוכל בחוץ ובילויים','שונות'],AbortController,setTimeout,clearTimeout,fetch:async()=>{calls++;if(!ok)throw new Error('offline');return {ok:true,json:async()=>answer};}});
  const ctx=make();
  assert.equal(await ctx._aiCategorizeMerchant('A'),'אוכל בחוץ ובילויים');
  assert.equal(await ctx._aiCategorizeMerchant('A'),'אוכל בחוץ ובילויים');assert.equal(calls,1);
  answer={category:'קטגוריה מומצאת'};assert.equal(await ctx._aiCategorizeMerchant('B'),null);
  ok=false;assert.equal(await ctx._aiCategorizeMerchant('C'),null);
});

test('a client over the upcoming-meeting limit gets a clear message and keeps the slot list',async()=>{
  const {ctx,fields}=clientMeetingContext(async()=>({error:{code:'53400'}}));
  await ctx.requestClientMeeting();
  assert.equal(fields.clientMeetingError.hidden,false);
  assert.match(fields.clientMeetingError.textContent,/3 פגישות קרובות/);
  assert.equal(ctx.reloaded,undefined);
  assert.equal(ctx._advisorMeetings.length,0);
});
test('every category named in the extra dictionary exists in the personal expense categories',()=>{
  const cats=vm.runInNewContext(html.match(/const EXPENSE_CATS=(\[[^\]]*\]);/)[1]);
  const block=html.match(/const _DICT_EXTRA=\{([^]*?)\n\};/)[1];
  const values=[...block.matchAll(/:'([^']+)'/g)].map(m=>m[1]);
  assert.ok(values.length>50);
  assert.deepEqual(values.filter(v=>!cats.includes(v)),[]);
});
test('israeli id check digit',()=>{
  const ctx=functions(['_normalizeIsraeliId','_isValidIsraeliId']);
  assert.equal(ctx._isValidIsraeliId('000000018'),true);
  assert.equal(ctx._isValidIsraeliId('123456789'),false);
  assert.equal(ctx._isValidIsraeliId('18'),true);
  assert.equal(ctx._isValidIsraeliId(' 0000 00018 '),true);
  assert.equal(ctx._isValidIsraeliId('12a456782'),false);
  assert.equal(ctx._isValidIsraeliId(''),false);
  assert.equal(ctx._isValidIsraeliId('000000000'),false);
  assert.equal(ctx._isValidIsraeliId('1234567890'),false);
  assert.equal(ctx._normalizeIsraeliId(' 18 '),'000000018');
  assert.equal(ctx._normalizeIsraeliId('12a456782'),'');
});
test('stroke length ignores a single tap',()=>{
  const ctx=functions(['_strokeLength']);
  assert.equal(ctx._strokeLength([]),0);
  assert.equal(ctx._strokeLength([[{x:5,y:5}]]),0);
  assert.equal(ctx._strokeLength([[{x:0,y:0},{x:30,y:40}]]),50);
  assert.equal(ctx._strokeLength([[{x:0,y:0},{x:30,y:40}],[{x:0,y:0},{x:0,y:10}]]),60);
});
test('agreement form needs every clause and a real signature',()=>{
  const ctx=functions(['_israelToday','_normalizeIsraeliId','_isValidIsraeliId','_agreementBirthProblem','_agreementFormReady']);
  const [ty,tm,td]=ctx._israelToday().split('-').map(Number);
  const adultOn=new Date(Date.UTC(ty-18,tm-1,td)).toISOString().slice(0,10);
  const adultTomorrow=new Date(Date.UTC(ty-18,tm-1,td+1)).toISOString().slice(0,10);
  const base={fullName:'Dana Levi',nationalId:'000000018',birthDate:'1990-01-01',address:'Tel Aviv',phone:'0501234567',ink:40,confirmed:['a','b'],required:['a','b']};
  assert.equal(ctx._agreementFormReady(base),true);
  assert.equal(ctx._agreementFormReady({...base,fullName:'Dana'}),false);
  assert.equal(ctx._agreementFormReady({...base,fullName:'   '}),false);
  assert.equal(ctx._agreementFormReady({...base,nationalId:'123456789'}),false);
  assert.equal(ctx._agreementFormReady({...base,birthDate:''}),false);
  assert.equal(ctx._agreementFormReady({...base,birthDate:adultOn}),true);
  assert.equal(ctx._agreementFormReady({...base,birthDate:adultTomorrow}),false);
  assert.equal(ctx._agreementFormReady({...base,birthDate:'1850-01-01'}),false);
  assert.equal(ctx._agreementFormReady({...base,nationalId:'00000001-8'}),true);
  assert.equal(ctx._agreementFormReady({...base,address:' '}),false);
  assert.equal(ctx._agreementFormReady({...base,phone:''}),false);
  assert.equal(ctx._agreementFormReady({...base,ink:39}),false);
  assert.equal(ctx._agreementFormReady({...base,confirmed:['a']}),false);
  assert.equal(ctx._agreementFormReady({...base,confirmed:['b','a','c']}),true);
});
test('israel today matches the Asia/Jerusalem calendar date',()=>{
  const ctx=functions(['_israelToday']);
  const expected=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jerusalem'}).format(new Date());
  assert.equal(ctx._israelToday(),expected);
  assert.match(ctx._israelToday(),/^\d{4}-\d{2}-\d{2}$/);
});
test('agreement field hints name the invalid field and stay quiet on empty ones',()=>{
  const ctx=functions(['_israelToday','_normalizeIsraeliId','_isValidIsraeliId','_agreementBirthProblem','_agreementFieldHints']);
  const [ty,tm,td]=ctx._israelToday().split('-').map(Number);
  const under18=new Date(Date.UTC(ty-18,tm-1,td+1)).toISOString().slice(0,10);
  assert.deepEqual({...ctx._agreementFieldHints({fullName:'',nationalId:'',birthDate:''})},{fullName:'',nationalId:'',birthDate:''});
  assert.equal(ctx._agreementFieldHints({fullName:'דנה',nationalId:'',birthDate:''}).fullName,'יש להקליד שם פרטי ושם משפחה');
  assert.equal(ctx._agreementFieldHints({fullName:'דנה לוי',nationalId:'',birthDate:''}).fullName,'');
  assert.equal(ctx._agreementFieldHints({fullName:'',nationalId:'123456789',birthDate:''}).nationalId,'תעודת הזהות אינה תקינה, בדוק את הספרות');
  assert.equal(ctx._agreementFieldHints({fullName:'',nationalId:'00000001-8',birthDate:''}).nationalId,'');
  assert.equal(ctx._agreementFieldHints({fullName:'',nationalId:'',birthDate:under18}).birthDate,'ההסכם מיועד לבני 18 ומעלה');
  assert.equal(ctx._agreementFieldHints({fullName:'',nationalId:'',birthDate:'1850-01-01'}).birthDate,'תאריך הלידה אינו תקין');
});
test('agreement server errors become specific Hebrew messages',()=>{
  const ctx=functions(['_agreementErrorText']);
  assert.equal(ctx._agreementErrorText('Invalid national id'),'תעודת הזהות אינה תקינה');
  assert.equal(ctx._agreementErrorText('Must be 18 or older'),'ההסכם מיועד לבני 18 ומעלה');
  assert.equal(ctx._agreementErrorText('Full name required'),'יש להקליד שם פרטי ושם משפחה');
  assert.equal(ctx._agreementErrorText('Valid signature required'),'החתימה אינה תקינה, נסה לצייר אותה שוב');
  assert.equal(ctx._agreementErrorText('Every clause must be confirmed'),'יש לאשר את כל הסעיפים');
  assert.equal(ctx._agreementErrorText('something else'),'שגיאה בשמירת החתימה, נסה שוב');
  assert.equal(ctx._agreementErrorText(undefined),'שגיאה בשמירת החתימה, נסה שוב');
});
test('agreement name is cleaned of odd whitespace before it is sent',()=>{
  const ctx=functions(['_agreementCleanName']);
  assert.equal(ctx._agreementCleanName('  Dana  Levi  '),'Dana Levi');
});
test('two overlapping agreement checks run only once',async()=>{
  let calls=0;
  const ctx=functions(['_ensureClientAgreement'],{_agreementBusy:false,_runClientAgreementCheck:async()=>{calls++;await new Promise(r=>setTimeout(r,10));}});
  await Promise.all([ctx._ensureClientAgreement(),ctx._ensureClientAgreement()]);
  assert.equal(calls,1);
  await ctx._ensureClientAgreement();
  assert.equal(calls,2);
});
test('waiting for images resolves once every image is complete or loaded',async()=>{
  const ctx=functions(['_waitForImages']);
  let fired=0;
  const pending={complete:false,addEventListener:(t,cb)=>{fired++;setTimeout(cb,5);}};
  const root={querySelectorAll:()=>[{complete:true},pending]};
  await ctx._waitForImages(root);
  assert.equal(fired,2);
  await ctx._waitForImages({querySelectorAll:()=>[]});
});
test('agreement dates are shown in Israel time as DD/MM/YYYY HH:MM',()=>{
  const ctx=functions(['_agreementDateText']);
  assert.equal(ctx._agreementDateText('2026-11-22T10:26:00Z',true),'22/11/2026 12:26');
  assert.equal(ctx._agreementDateText('2026-07-01T10:00:00Z',true),'01/07/2026 13:00');
  assert.equal(ctx._agreementDateText('2026-11-22T22:00:00Z',true),'23/11/2026 00:00');
  assert.equal(ctx._agreementDateText('2026-11-22T22:00:00Z',false),'23/11/2026');
  assert.equal(ctx._agreementDateText('not a date',true),'—');
  assert.equal(ctx._agreementDateText(null,true),'—');
});
test('agreement audit page lists sent opened and signed with network details and escapes stored text',()=>{
  const ctx=functions(['_agreementDateText','_agreementAuditHtml']);
  vm.runInContext(html.match(/function esc\(s\)\{[^\n]*\}/)[0],ctx);
  const out=ctx._agreementAuditHtml({id:'agr-1',version:'2026-11',presented_at:'2026-11-22T10:26:00Z',presented_ip:'87.1.2.3',presented_user_agent:'Safari <script>x</script>',signed_at:'2026-11-22T10:31:00Z',signed_ip:null,signed_user_agent:'Safari',body_sha256:'aaa111',record_sha256:'bbb222'});
  for(const word of ['נשלח','נפתח','נחתם','agr-1','aaa111','bbb222','87.1.2.3','22/11/2026 12:26','22/11/2026 12:31'])assert.ok(out.includes(word),word);
  assert.ok(!out.includes('<script>'));
  assert.ok(out.includes('&lt;script&gt;'));
  assert.ok(out.includes('—'));
});
test('agreement copy email escapes stored text, embeds the signature by cid and mails only the account address',async()=>{
  const {buildMailMessage,escapeHtml}=await import(require('node:url').pathToFileURL(path.join(root,'supabase/functions/send-agreement-copy/agreementHtml.js')).href);
  const record={id:'agr-1',email:'old@x.com',full_name:'דנה <img src=x onerror=alert(1)>',national_id:'000000018',birth_date:'1990-05-04',address:'"><script>x</script>',phone:'050',version:'2026-11',body:'סעיף <b>1</b>',body_sha256:'aaa111',signature_png:'data:image/png;base64,QUJD',presented_at:'2026-11-22T10:26:00Z',presented_ip:'87.1.2.3',presented_user_agent:'Safari <i>',signed_at:'2026-11-22T10:31:00Z',signed_ip:null,signed_user_agent:'Safari',record_sha256:'bbb222'};
  const p=buildMailMessage(record,'ס <a@b.c>','me@x.com');
  assert.equal(p.to,'me@x.com');
  assert.equal(p.from,'ס <a@b.c>');
  assert.ok(p.html.includes('src="cid:signature"'));
  assert.ok(!p.html.includes('<script>')&&!p.html.includes('<img src=x')&&!p.html.includes('<b>1</b>'));
  for(const word of ['נשלח','נפתח','נחתם','agr-1','aaa111','bbb222','87.1.2.3','04/05/1990','22/11/2026 12:31','דף ביקורת'])assert.ok(p.html.includes(word),word);
  const inline=p.attachments.find(a=>a.cid==='signature'&&a.encoding==='base64');
  assert.equal(inline.content,'QUJD');
  const doc=Buffer.from(p.attachments.find(a=>a.filename==='agreement.html').content,'base64').toString('utf8');
  assert.ok(doc.includes('src="data:image/png;base64,QUJD"'));
  assert.ok(doc.includes('דף ביקורת'));
  assert.throws(()=>buildMailMessage({...record,signature_png:'javascript:alert(1)'},'a@b.c','me@x.com'));
  assert.equal(escapeHtml(`<&>"'`),'&lt;&amp;&gt;&quot;&#39;');
});
test('signed agreement copy is requested only when the client asked for it',async()=>{
  const calls=[];const toasts=[];
  const mk=(result)=>functions(['_requestAgreementCopy'],{_sb:{functions:{invoke:async(n)=>{calls.push(n);return result;}}},showToast:(m,t)=>toasts.push([m,t])});
  await mk({data:{ok:true},error:null})._requestAgreementCopy(false);
  assert.deepEqual(calls,[]);
  await mk({data:{ok:true},error:null})._requestAgreementCopy(true);
  assert.deepEqual(calls,['send-agreement-copy']);
  assert.equal(toasts.at(-1)[1],'success');
  await mk({data:null,error:{message:'x'}})._requestAgreementCopy(true);
  assert.equal(toasts.at(-1)[1],'error');
  assert.ok(toasts.at(-1)[0].includes('עותק'));
});
test('signature gate offers an unchecked copy-by-email box and asks for the copy after signing',()=>{
  const gate=html.slice(html.indexOf('async function _runClientAgreementCheck'),html.indexOf('function _agreementAuditHtml'));
  assert.ok(gate.includes('id="agCopy"'));
  assert.ok(gate.includes('שלחו לי עותק חתום למייל'));
  assert.ok(!/id="agCopy"[^>]*checked/.test(gate));
  assert.ok(gate.includes("_requestAgreementCopy(copyWanted)"));
});
test('unsigned agreement and missing documents become automatic client tasks',()=>{
  const ctx=functions(['_autoTasks'],{_agreementRequired:false,_docsMissingCount:0});
  assert.equal(ctx._autoTasks().length,0);
  ctx._agreementRequired=true;
  assert.equal(JSON.stringify(ctx._autoTasks().map(t=>t.action)),JSON.stringify(['openAgreementTask()']));
  ctx._docsMissingCount=2;
  assert.equal(JSON.stringify(ctx._autoTasks().map(t=>t.action)),JSON.stringify(['openAgreementTask()','openDocsTask()']));
  assert.ok(ctx._autoTasks().every(t=>t.title&&t.button));
});
test('an unsigned agreement no longer opens a blocking screen on login, only when the client starts the task',async()=>{
  const calls=[];
  const ctx=functions(['_runClientAgreementCheck'],{
    _cloudUser:{id:'u1'},_agreementCheckedFor:null,_agreementRequired:false,
    document:{getElementById:()=>null,createElement:()=>{throw new Error('gate opened');}},
    _refreshMyAgreementButton:()=>{},_updateTasksBadge:()=>{},renderTasksPage:()=>{},
    _sb:{rpc:async(n)=>{calls.push(n);return n==='client_agreement_status'?{data:{required:true,signed:false,version:'v1'},error:null}:{data:null,error:{message:'stop'}};}},
  });
  await ctx._runClientAgreementCheck();
  assert.deepEqual(calls,['client_agreement_status']);
  assert.equal(ctx._agreementRequired,true);
  await ctx._runClientAgreementCheck(true);
  assert.ok(calls.includes('present_client_agreement'));
});
test('documents no longer lock the app: the upload screen can be closed and logout is not forced',()=>{
  const docs=html.slice(html.indexOf('function _renderDocsLock'),html.indexOf('async function _docsUpload'));
  assert.ok(docs.includes('id="docsClose"'));
  assert.ok(!docs.includes('signOut'));
  const lock=html.slice(html.indexOf('async function _applyDocsLock'),html.indexOf('function openDocsTask'));
  assert.ok(!lock.includes("classList.add('docs-locked')"));
});

test('daily income counts only recorded entries and is never auto-posted',()=>{
  const now=new Date();const y=now.getFullYear(),m=now.getMonth();const key=y+'-'+String(m+1).padStart(2,'0');
  const sources=[{name:'עבודה',amount:10000,day:1,daily:true},{name:'קצבה',amount:300}];let tx=[];
  const income=functions(['monthlyIncomeFor'],{getMonthTx:()=>tx,_incomeSourcesFor:()=>sources});
  assert.equal(income.monthlyIncomeFor(y,m),300);
  tx=[{type:'income',desc:'עבודה',amount:500},{type:'income',desc:'עבודה',amount:450}];
  assert.equal(income.monthlyIncomeFor(y,m),1250);
  const auto=functions(['checkRecurringIncome'],{currentYear:y,currentMonth:m,mk:()=>key,_modeKey:k=>k,userSettings:{incomeSources:[sources[0]]},transactions:[],localISO:()=>key+'-01',saveData(){},refreshAll(){},showUndoToast(){},esc:s=>s});
  auto.checkRecurringIncome();assert.equal(auto.transactions.length,0);
});
test('daily flag survives cloning of income sources and is absent on monthly sources',()=>{
  const line=html.match(/function _cloneSources\(a\)\{.*\}/)[0];
  const ctx=vm.createContext({});vm.runInContext(line,ctx);
  const out=JSON.parse(JSON.stringify(ctx._cloneSources([{name:'a',amount:1,daily:true},{name:'b',amount:2,day:3}])));
  assert.deepEqual(out,[{name:'a',amount:1,day:'',daily:true},{name:'b',amount:2,day:3}]);
});
test('adding daily income records one entry dated inside the shown month and rejects bad input',async()=>{
  const now=new Date();const y=now.getFullYear(),m=now.getMonth();const key=y+'-'+String(m+1).padStart(2,'0');const today=key+'-10';
  let answer;
  const ctx=functions(['_addDailyIncome'],{currentYear:y,currentMonth:m,_canWriteLocalData:()=>true,_incomeSourcesFor:()=>[{name:'עבודה',daily:true}],mk:()=>key,localISO:()=>today,daysInMonth:()=>30,promptSheet:async()=>answer,transactions:[],saveData(){},refreshAll(){},showToast(){},fmt:String,_incomeEntries:()=>[]});
  answer=['500',today];await ctx._addDailyIncome(0);
  assert.equal(ctx.transactions.length,1);assert.equal(ctx.transactions[0].amount,500);assert.equal(ctx.transactions[0].desc,'עבודה');assert.equal(ctx.transactions[0].recurring,false);
  for(const bad of [['0',today],['',today],['500',key+'-11'],['500','']]){answer=bad;await ctx._addDailyIncome(0);}
  answer=null;await ctx._addDailyIncome(0);
  assert.equal(ctx.transactions.length,1);
});

test('turning a source daily renames this month entries, stops carrying them and keeps their amounts',async()=>{
  const src={name:'עבודה',amount:'10000',day:'1'};let committed=null;const toasts=[];
  const ctx=functions(['_incomeFromPrompt','_incomeDailyError','_expEditIncome'],{_incomeWorkList:()=>[src],promptSheet:async()=>['עבודה יומית','daily','9000','1'],mk:(y,m)=>y+'-'+String(m+1).padStart(2,'0'),currentYear:2026,currentMonth:10,saveData(){},_incomeCommit:l=>{committed=l;},_incomeFields:()=>[],_incomeEntries:()=>[{}],showToast:t=>toasts.push(t),
    transactions:[{type:'income',recurring:true,desc:'עבודה',amount:10000,date:'2026-11-01'},{type:'income',recurring:true,desc:'עבודה',amount:9800,date:'2026-10-01'}]});
  await ctx._expEditIncome(0);
  assert.deepEqual(JSON.parse(JSON.stringify(committed)),[{name:'עבודה יומית',amount:'9000',day:'',daily:true}]);
  assert.equal(ctx.transactions[0].desc,'עבודה יומית');assert.equal(ctx.transactions[0].amount,10000);assert.equal(ctx.transactions[0].recurring,false);
  assert.equal(ctx.transactions[1].desc,'עבודה');assert.equal(ctx.transactions[1].recurring,false);assert.equal(toasts.length,1);
});

test('the client is reminded in the app a day before an approved meeting and on the day itself',()=>{
  const at=days=>{const d=new Date();d.setDate(d.getDate()+days);d.setHours(12,0,0,0);return d.toISOString();};
  const localISO=d=>{d=d||new Date();return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().split('T')[0];};
  const element={innerHTML:''};let seen=false;
  const ctx=functions(['_renderMeetingAlerts'],{document:{getElementById:()=>element},localISO,esc:s=>s,_meetingReminderDismissed:()=>seen});
  ctx._renderMeetingAlerts([{id:'a',scheduled_at:at(1),status:'confirmed',requested_by_client:true}]);
  assert.match(element.innerHTML,/פגישה מחר עם היועץ, בשעה 12:00/);assert.doesNotMatch(element.innerHTML,/היום/);
  ctx._renderMeetingAlerts([{id:'a',scheduled_at:at(0),status:'confirmed',requested_by_client:false}]);
  assert.match(element.innerHTML,/פגישה היום עם היועץ/);
  ctx._renderMeetingAlerts([{id:'a',scheduled_at:at(2),status:'confirmed',requested_by_client:true}]);assert.equal(element.innerHTML,'');
  ctx._renderMeetingAlerts([{id:'a',scheduled_at:at(-1),status:'confirmed',requested_by_client:true}]);assert.equal(element.innerHTML,'');
  seen=true;ctx._renderMeetingAlerts([{id:'a',scheduled_at:at(1),status:'confirmed',requested_by_client:true}]);assert.equal(element.innerHTML,'');
  seen=false;ctx._renderMeetingAlerts([{id:'a',scheduled_at:at(1),status:'pending',requested_by_client:false}]);
  assert.match(element.innerHTML,/אשר/);assert.doesNotMatch(element.innerHTML,/מחר/);
});

test('a background refresh never closes or restarts onboarding, and a killed one resumes',()=>{
  const store=new Map(),classes=new Set();let input={value:''};
  const overlay={classList:{contains:c=>classes.has(c),add:c=>classes.add(c),remove:c=>classes.delete(c)}};
  const ctx=functions(['_hasRealData','showOnboarding','skipOnboarding','_decideOnboarding'],{onboardStep:0,userSettings:{name:'',incomeSources:[]},transactions:[],budgets:{},
    localStorage:{getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},
    document:{getElementById:id=>id==='onboardOverlay'?overlay:id==='obNameInput'?input:null},renderOnboardStep:()=>{},checkFabHint:()=>{},_resyncPush:async()=>{},_autoPush:()=>{},showFabHint:()=>{},setTimeout:()=>0});
  const open=()=>classes.has('open');
  ctx._decideOnboarding();assert.equal(open(),true);
  input.value='דנה';ctx.userSettings.name='דנה';ctx._decideOnboarding();assert.equal(open(),true);
  input=null;ctx.onboardStep=2;ctx._decideOnboarding();assert.equal(open(),true);assert.equal(ctx.onboardStep,2);
  classes.clear();ctx.onboardStep=0;ctx._decideOnboarding();assert.equal(open(),true);
  ctx.skipOnboarding();assert.equal(open(),true);assert.equal(ctx.onboardStep,2);
  ctx.skipOnboarding();assert.equal(open(),false);ctx._decideOnboarding();assert.equal(open(),false);
  store.clear();ctx.userSettings.name='';ctx._decideOnboarding();assert.equal(open(),true);
  ctx.transactions.push({id:1});ctx._decideOnboarding();assert.equal(open(),false);assert.equal(store.has('budget_onboarding'),false);
});
test('visitors in the browser get the install-first step on iPhone and on Android with an install prompt, unless installed or arriving from an advisor link on iPhone',()=>{
  const need=(ua,over={})=>{const store=new Map(over.skip?[['auth_install_skip','1']]:[]);const ctx=functions(['_authNeedsInstall'],{navigator:{userAgent:ua,platform:'iPhone',maxTouchPoints:5,standalone:false,...over},window:{matchMedia:()=>({matches:false}),canPromptInstall:()=>!!over.prompt},_pendingAdvisorRef:()=>over.ref||null,sessionStorage:{getItem:k=>store.get(k)||null}});return ctx._authNeedsInstall();};
  const iphone='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari',android='Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/120 Mobile';
  assert.equal(need(iphone),'ios');
  assert.equal(need(iphone,{standalone:true}),false);
  assert.equal(need(iphone,{skip:true}),false);
  assert.equal(need(iphone,{ref:'abc'}),false);
  assert.equal(need(android,{prompt:true}),'android');
  assert.equal(need(android,{prompt:true,ref:'abc'}),'android');
  assert.equal(need(android,{prompt:false}),false);
  assert.equal(need(android,{prompt:true,standalone:true}),false);
  assert.equal(need('Mozilla/5.0 (Windows NT 10.0) Chrome',{platform:'Win32',maxTouchPoints:0,prompt:true}),false);
});

test('a device that shows notifications as on is re-registered when the server lost it, and switched off when the browser lost it',async()=>{
  const run=async({flag=true,sub=true,perm='granted',row=false}={})=>{
    const log={upserts:0,flag:flag?'1':null,unchecked:false};
    const subscription={endpoint:'e1',toJSON:()=>({keys:{p256dh:'p',auth:'a'}})};
    const query={select:()=>query,eq:()=>query,maybeSingle:async()=>({data:row?{endpoint:'e1'}:null})};
    const ctx=functions(['_resyncPush'],{_pushResyncedFor:null,_cloudUser:{id:'u'},_sb:{from:()=>({...query,upsert:async()=>{log.upserts++;return{}}})},_pushSupported:()=>true,
      localStorage:{getItem:k=>k==='budget_push_on'?log.flag:null,removeItem:k=>{if(k==='budget_push_on')log.flag=null;}},
      navigator:{serviceWorker:{ready:Promise.resolve({pushManager:{getSubscription:async()=>sub?subscription:null}})}},Notification:{permission:perm},
      document:{getElementById:()=>({set checked(v){log.unchecked=!v}})},_renderPushPrefs:()=>{}});
    await ctx._resyncPush();return log;
  };
  assert.equal((await run({flag:false})).upserts,0);
  assert.equal((await run({row:true})).upserts,0);
  const lost=await run({});assert.equal(lost.upserts,1);assert.equal(lost.flag,'1');
  const gone=await run({sub:false});assert.equal(gone.flag,null);assert.equal(gone.upserts,0);
  assert.equal((await run({perm:'denied'})).flag,null);
});

test('apple pay status separates never reached, reached without a payment, and paid',()=>{
  const ctx=functions(['_applePayState','_iosMajor'],{});
  const none=ctx._applePayState({active:true});
  assert.equal(none.cls,' wait');assert.match(none.help,/▶/);assert.match(none.help,/iOS 27/);
  const seen=ctx._applePayState({active:true,last_seen_at:'2026-11-24T10:00:00Z'});
  assert.equal(seen.cls,'');assert.match(seen.head,/הקיצור מחובר/);assert.match(seen.help,/הפעולה האוטומטית מכובה/);
  const paid=ctx._applePayState({active:true,last_seen_at:'2026-11-24T10:00:00Z',last_used_at:'2026-11-24T10:00:00Z'});
  assert.match(paid.sub,/תשלום אחרון נקלט/);assert.equal(paid.help,'');
  assert.equal(ctx._iosMajor('Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) Version/26.6.2 Mobile/15E148'),26);
  assert.equal(ctx._iosMajor('Mozilla/5.0 (Windows NT 10.0) Version/27'),0);
});

test('apple pay setup turns connected once the server saw the shortcut',async()=>{
  const el={textContent:'',classList:{remove:c=>{el.removed=c;}}};let cleared=0,data={active:true};
  const ctx=functions(['_applePayCheckTest'],{_applePayWatch:1,document:{hidden:false,getElementById:()=>el},_sb:{rpc:async()=>({data})},_cloudUser:{id:'u'},clearInterval:()=>{cleared++;}});
  await ctx._applePayCheckTest();assert.equal(el.textContent,'');assert.equal(cleared,0);
  data={active:true,last_seen_at:'x'};await ctx._applePayCheckTest();
  assert.match(el.textContent,/הקיצור מחובר/);assert.equal(el.removed,'wait');assert.equal(cleared,1);
});

test('expenses of the same day are listed newest first',()=>{
  const ctx=functions(['_byNewest'],{});
  const list=[{id:'fx|2026-11|x',date:'2026-11-25'},{id:1795586759420.7,date:'2026-11-25'},{id:1795590489209.2,date:'2026-11-25'},{id:1795101148978.8,date:'2026-11-19'}];
  assert.deepEqual(list.sort(ctx._byNewest).map(t=>t.id),[1795590489209.2,1795586759420.7,'fx|2026-11|x',1795101148978.8]);
});

test('amounts are shown without agorot, rounded up',()=>{
  const ctx=functions(['fmt'],{_safeSym:()=>'₪',userSettings:{}});
  assert.equal(ctx.fmt(8.9),'₪9');assert.equal(ctx.fmt(8.1),'₪9');assert.equal(ctx.fmt(12),'₪12');
  assert.equal(ctx.fmt(0.1+0.2+11.7),'₪12');assert.equal(ctx.fmt(-3.2),'₪4');assert.equal(ctx.fmt(0),'₪0');
});

function autoPushContext(permission,active,store={},ua='iPhone'){
  const log={sub:0,asked:0,handlers:[]};
  const Notification={permission,requestPermission:async()=>{log.asked++;Notification.permission='granted';return 'granted';}};
  const ctx=functions(['_autoPush'],{_autoPushFor:null,_cloudUser:{id:'u'},_sb:{rpc:async()=>({data:{active}})},_pushSupported:()=>true,navigator:{userAgent:ua},Notification,
    localStorage:{getItem:k=>store[k]||null,setItem:(k,v)=>{store[k]=v;}},document:{getElementById:()=>null,addEventListener:(n,f)=>log.handlers.push(f),removeEventListener:()=>{log.handlers.length=0;}},
    _subscribePush:async()=>{log.sub++;},_renderPushPrefs:()=>{},showToast:()=>{}});
  return {ctx,log,store};
}
test('payment notices turn on by themselves once the phone already allowed them',async()=>{
  const a=autoPushContext('granted',true);await a.ctx._autoPush();assert.equal(a.log.sub,1);assert.equal(a.log.asked,0);
});
test('payment notices ask on the first tap, once, and not from the setup buttons',async()=>{
  const a=autoPushContext('default',true);await a.ctx._autoPush();
  assert.equal(a.log.asked,0);assert.equal(a.log.handlers.length,1);
  const tap=a.log.handlers[0];
  tap({target:{closest:()=>({})}});assert.equal(a.log.asked,0);
  tap({target:{closest:()=>null}});await new Promise(r=>setTimeout(r,5));
  assert.equal(a.log.asked,1);assert.equal(a.log.sub,1);assert.equal(a.store.push_auto_asked,'1');
});
test('payment notices stay off without Apple Pay, after a refusal, after an opt out, or off the phone',async()=>{
  for(const a of [autoPushContext('granted',false),autoPushContext('denied',true),autoPushContext('granted',true,{push_opt_out:'1'}),autoPushContext('granted',true,{},'Windows'),autoPushContext('default',true,{push_auto_asked:'1'})]){
    await a.ctx._autoPush();assert.equal(a.log.sub,0);assert.equal(a.log.handlers.length,0);
  }
});

test('the yearly summary starts at the first month with data, and actual income matches the home screen',()=>{
  const calls=[];
  const ctx=functions(['_sumFiguresYear','_sumAddSide','_sumAddCats'],{transactions:[{date:'2026-05-10'},{date:'2026-11-02'}],
    _sumFigures:(y,m)=>{calls.push(m);return {planInc:1,planExp:1,actInc:1,actExp:1,plan:{inc:1,fixed:0,vari:1,sav:0,fixedCats:[],varCats:[]},actual:{inc:1,fixed:0,vari:1,sav:0,fixedCats:[],varCats:[]}};}});
  assert.equal(ctx._sumFiguresYear(2026,10).planInc,7);assert.deepEqual(calls,[4,5,6,7,8,9,10]);
  calls.length=0;ctx._sumFiguresYear(2027,2);assert.deepEqual(calls,[0,1,2]);
  calls.length=0;ctx._sumFiguresYear(2025,11);assert.deepEqual(calls,[11]);
  assert.match(fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8'),/const actInc=monthlyIncomeFor\(y,m\);/);
});

test('the money left this month on the home screen subtracts what went to savings',()=>{
  assert.match(html,/const remaining=income-total-saved;/);
});

test('savings categories include flagged fixed rows',()=>{
  const ctx=vm.createContext({fixedExpenses:[{id:'קרן השתלמות',savings:true},{id:'דיור'}]});for(const name of ['_savingCats','_isSavingCat'])vm.runInContext(html.match(new RegExp('function '+name+'\\([^]*?\\n?\\}'))[0],ctx);
  assert.deepEqual([...ctx._savingCats()],['הוראת קבע לחסכון','קרן השתלמות']);
  assert.equal(ctx._isSavingCat('דיור'),false);assert.equal(ctx._isSavingCat('קרן השתלמות'),true);
});

test('a goal deposit is saving, and old ones migrate',()=>{
  const ctx=insuranceContext();Object.assign(ctx,{FIXED_CATS:['דיור'],EXPENSE_CATS:[],_CAT_MIGRATE:{},subscriptions:[],userSettings:{}});
  ctx.transactions=[{id:'g1',type:'expense',cat:'חיסכון ליעד',amount:100,goalTx:true,goalId:1}];
  vm.runInContext(html.match(/function _migrateCats\([^]*?\n\}/)[0],ctx);assert.equal(ctx._migrateCats(),true);assert.equal(ctx.transactions[0].type,'saving');
  assert.match(html,/type:'saving',cat:'חיסכון ליעד'/);
});

test('from-salary funds post nothing',()=>{
  const ctx=syncedFixedContext();ctx.fixedExpenses=[{id:'קופת גמל',amount:500,savings:true,fromSalary:true},{id:'תיק מסחר',amount:300,savings:true}];ctx._fxApply();
  assert.equal(ctx.transactions.some(t=>t.cat==='קופת גמל'),false);
  assert.equal(ctx.transactions.find(t=>t.cat==='תיק מסחר').type,'saving');
});

function fundContext(rows,tx=[]){
  const ctx=functions(['_fundStats','_funds'],{fixedExpenses:rows,transactions:tx});
  for(const name of ['_savingCats','_fundPostsTx'])vm.runInContext(html.match(new RegExp('function '+name+'\\([^]*?\\n?\\}'))[0],ctx);
  ctx._fxRow=c=>rows.find(r=>r.id===c);ctx._fxMonthly=c=>+(rows.find(r=>r.id===c)?.amount)||0;return ctx;
}
const fundTx=[{type:'saving',cat:'X',amount:500,date:'2026-10-01'},{type:'saving',cat:'X',amount:500,date:'2026-11-01'},{type:'expense',cat:'X',amount:999,date:'2026-11-02'}];

test('a fund sums its opening balance and saving deposits',()=>{
  const s=fundContext([],fundTx)._fundStats({id:'X',opening:1000,savings:true});
  assert.equal(s.deposited,2000);assert.equal(s.value,null);assert.equal(s.gain,null);
});

test('a from-salary fund grows by its amount every month since it started',()=>{
  const s=fundContext([])._fundStats({id:'G',amount:300,fromSalary:true,since:'2026-09',opening:0,savings:true},new Date(2026,10,26));
  assert.equal(s.deposited,900);
});

test('a fund value with a date gives the gain against deposits up to that date',()=>{
  const s=fundContext([],fundTx)._fundStats({id:'X',opening:1000,savings:true,value:2500,valueDate:'2026-10-20'});
  assert.equal(s.value,2500);assert.equal(s.gain,1000);assert.equal(s.deposited,2000);
});

test('a fund value without a date shows no gain',()=>{
  const s=fundContext([],fundTx)._fundStats({id:'X',opening:1000,savings:true,value:2500});
  assert.equal(s.value,2500);assert.equal(s.gain,null);
});

test('funds list the savings rows and the standing order',()=>{
  const ctx=fundContext([{id:'הוראת קבע לחסכון',amount:1000},{id:'תיק מסחר',savings:true,kind:'trading'},{id:'דיור',amount:4000}]);
  assert.deepEqual([...ctx._funds().map(r=>r.id)],['הוראת קבע לחסכון','תיק מסחר']);
  assert.equal(fundContext([{id:'דיור',amount:4000}])._funds().length,0);
});

test('a linked goal takes its progress from the fund, and falls back when the fund is gone',()=>{
  const rows=[{id:'X',savings:true,opening:700}];
  const ctx=functions(['_goalSaved'],{_funds:()=>rows,_fundStats:r=>({deposited:+r.opening,value:r.value??null,gain:null})});
  assert.equal(ctx._goalSaved({saved:100,fund:'X'}),700);
  rows[0].value=900;assert.equal(ctx._goalSaved({saved:100,fund:'X'}),900);
  rows.length=0;assert.equal(ctx._goalSaved({saved:100,fund:'X'}),100);
  assert.equal(ctx._goalSaved({saved:50}),50);
});

test('deleting a fund unlinks its goals and can be undone',()=>{
  const ctx=functions(['deleteFund'],{fixedExpenses:[{id:'X',savings:true,amount:200},{id:'דיור',amount:4000}],goals:[{id:1,name:'רכב',fund:'X'},{id:2,name:'חופשה'}],
    _fxPushMonth:()=>{},saveData:()=>{},renderTxPage:()=>{},renderGoals:()=>{},refreshAll:()=>{},showUndoToast:(_,undo)=>{ctx.undo=undo;}});
  ctx.deleteFund('X');
  assert.equal(ctx.fixedExpenses.some(r=>r.id==='X'),false);assert.equal(ctx.goals[0].fund,undefined);
  ctx.undo();assert.equal(ctx.fixedExpenses.some(r=>r.id==='X'),true);assert.equal(ctx.goals[0].fund,'X');
});

test('a fund from the sheet keeps its fields and stamps the value date',async()=>{
  const ctx=functions(['editFund'],{fixedExpenses:[],goals:[],transactions:[],FUND_KINDS:{standing:'הוראת קבע לחסכון',trading:'תיק מסחר',hishtalmut:'קרן השתלמות',gemel:'קופת גמל',other:'אחר'},
    promptSheet:async()=>['','gemel','800','','5000','5600'],_curMonthKey:()=> '2026-11',_fxPushMonth:()=>{},_fxTxId:(m,c)=>'fx|'+m+'|'+c,saveData:()=>{},renderTxPage:()=>{},renderGoals:()=>{},showToast:()=>{}});
  await ctx.editFund(null);
  const r=ctx.fixedExpenses[0];
  assert.equal(r.id,'קופת גמל');assert.equal(r.savings,true);assert.equal(r.fromSalary,true);assert.equal(r.amount,800);assert.equal(r.opening,5000);assert.equal(r.value,5600);assert.equal(r.since,'2026-11');assert.match(r.valueDate,/^\d{4}-\d{2}-\d{2}$/);
});
