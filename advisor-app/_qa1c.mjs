import {chromium} from 'playwright';
import {go,SH} from './_lib.mjs';
const b=await chromium.launch();const m=await b.newPage({viewport:{width:390,height:844}});
for(const k of ['dashboard','crm','budget','mortgage','subs']){await go(m,k);console.log(k,await m.evaluate(()=>[document.documentElement.scrollWidth,document.body.scrollWidth,innerWidth, scrollX]));}
await go(m,'dashboard');await m.screenshot({path:SH+'m-dash2.png'});
await b.close();
