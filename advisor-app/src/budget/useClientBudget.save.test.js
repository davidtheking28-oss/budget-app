import { beforeEach, describe, expect, it, vi } from 'vitest';
const state=vi.hoisted(()=>({effects:[],row:null,reads:0,writes:0,fail:false,mode:'personal'}));
vi.mock('react',()=>({createContext:value=>({value}),useContext:()=>state.mode,useCallback:fn=>fn,useEffect:fn=>state.effects.push(fn),useReducer:()=>[0,()=>{}],useRef:value=>({current:value})}));
vi.mock('../mapping/useEconomicMapping.js',()=>({useEconomicMapping:()=>({loading:false,data:null,error:null})}));
vi.mock('../toast.js',()=>({toast:vi.fn()}));
vi.mock('../supabaseClient.js',()=>({supabase:{
 from:()=>{let patch=null;const filters=[];const q={select:()=>q,eq:(k,v)=>{filters.push([k,v]);return q;},is:(k,v)=>{filters.push([k,v]);return q;},update:value=>{patch=value;return q;},insert:value=>{patch=value;return q;},maybeSingle:async()=>{
  if(!patch){state.reads++;return{data:structuredClone(state.row),error:null};}
  state.writes++;
  if(state.fail)return{data:null,error:{message:'offline'}};
  if(!filters.every(([k,v])=>state.row?.[k]===v))return{data:null,error:null};
  state.row={...state.row,...structuredClone(patch)};return{data:{user_id:state.row.user_id},error:null};
 }};return q;},
 channel:()=>{const c={on:()=>c,subscribe:()=>c};return c;},removeChannel:()=>{}
}}));
beforeEach(()=>{vi.resetModules();Object.assign(state,{effects:[],reads:0,writes:0,fail:false,mode:'personal',row:{user_id:'client',updated_at:'2026-11-01T00:00:00Z',transactions:[],budgets:{food:500},settings:{},loans:[],insurances:[],subscriptions:[],payments:[],fixed_expenses:[]}});});
async function setup(){const {useClientBudget:readBudget}=await import('./useClientBudget.js');const current=()=>readBudget('client','advisor');current();state.effects[0]();await vi.waitFor(()=>expect(current().data?.user_id).toBe('client'));state.reads=0;return current;}
describe('cached-version budget saves',()=>{
 it('uses one conditional write without an extra read when the displayed version is current',async()=>{const current=await setup();expect(await current().save({budgets:{food:600}})).toBe(true);expect(state.reads).toBe(0);expect(state.writes).toBe(1);expect(state.row.budgets.food).toBe(600);});
 it('rereads after a version conflict and preserves a concurrent client transaction',async()=>{const current=await setup();state.row.updated_at='2026-11-02T00:00:00Z';state.row.transactions=[{id:'remote',amount:20,u:123}];expect(await current().save({budgets:{food:700}})).toBe(true);expect(state.reads).toBe(1);expect(state.writes).toBe(2);expect(state.row.transactions).toEqual([{id:'remote',amount:20,u:123}]);expect(state.row.budgets.food).toBe(700);});
 it('rolls back a failed write and retains the known version for retry',async()=>{const current=await setup();state.fail=true;expect(await current().save({budgets:{food:800}})).toBe(false);expect(current().data.budgets.food).toBe(500);state.fail=false;expect(await current().save({budgets:{food:800}})).toBe(true);expect(state.row.budgets.food).toBe(800);expect(state.reads).toBe(0);});
 it('keeps queued saves in order using the version returned by the preceding save',async()=>{const current=await setup();const one=current().save({budgets:{food:650}});const two=current().save(cur=>({transactions:[...cur.transactions,{id:'added',amount:30}]}));expect(await one).toBe(true);expect(await two).toBe(true);expect(state.row.budgets.food).toBe(650);expect(state.row.transactions).toHaveLength(1);expect(state.reads).toBe(0);expect(state.writes).toBe(2);});
});
it('preserves personal data while saving the business bundle without an extra read',async()=>{
 state.mode='business';state.row.business={transactions:[],budgets:{food:100},settings:{},loans:[],insurances:[],fixed_expenses:[]};
 const current=await setup();expect(await current().save({budgets:{food:250}})).toBe(true);
 expect(state.row.budgets.food).toBe(500);expect(state.row.business.budgets.food).toBe(250);expect(state.reads).toBe(0);
});
it('reads before creating a row when no server version is cached',async()=>{
 state.row=null;const current=await setup();expect(await current().save({budgets:{food:300}})).toBe(true);
 expect(state.reads).toBe(1);expect(state.row.budgets.food).toBe(300);
});
