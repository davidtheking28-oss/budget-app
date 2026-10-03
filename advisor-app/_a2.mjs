import { chromium } from 'playwright';
const b=await chromium.launch();const pg=await (await b.newContext({viewport:{width:390,height:900}})).newPage();
await pg.goto('http://localhost:5201/?client=11111111-1111-1111-1111-111111111111&nav=analysis');await pg.waitForTimeout(1500);
console.log(await pg.evaluate(()=>[...document.querySelectorAll("*")].filter(e=>!e.closest("nav")&&e.getBoundingClientRect().left<-1).slice(0,8).map(e=>e.tagName+"."+e.className+" "+Math.round(e.getBoundingClientRect().left)+" "+Math.round(e.getBoundingClientRect().right))));
await b.close();
