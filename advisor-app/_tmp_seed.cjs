const today = new Date();
const y = today.getFullYear(), m = today.getMonth();
function d(day){ return `${y}-${String(m+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`; }

const tx = [
  {id:'1',type:'income',cat:'שכר',desc:'משכורת',amount:18000,date:d(1),recurring:true},
  {id:'2',type:'expense',cat:'מזון לבית',desc:'סופר',amount:1450,date:d(3)},
  {id:'3',type:'expense',cat:'דלק וחניה',desc:'תדלוק',amount:320,date:d(5)},
  {id:'4',type:'expense',cat:'אוכל בחוץ ובילויים',desc:'מסעדה',amount:280,date:d(7)},
  {id:'5',type:'expense',cat:'דיור',desc:'שכירות',amount:5200,date:d(1),recurring:true},
  {id:'6',type:'expense',cat:'חשמל',desc:'חשבון חשמל',amount:410,date:d(10),recurring:true},
  {id:'7',type:'expense',cat:'ביגוד והנעלה',desc:'קניות בגדים',amount:560,date:d(12)},
  {id:'8',type:'expense',cat:'תחביבים',desc:'חדר כושר',amount:150,date:d(2),recurring:true},
  {id:'9',type:'income',cat:'פרילנס',desc:'פרויקט',amount:2500,date:d(15)},
  {id:'10',type:'expense',cat:'בריאות',desc:'רופא שיניים',amount:900,date:d(16)},
];

const goals = [
  {id:'g1',name:'קרן חירום',target:30000,saved:12000,date:`${y+1}-06-01`},
  {id:'g2',name:'חופשה',target:10000,saved:4200,date:`${y}-12-01`},
];

const subs = [
  {id:'s1',name:'נטפליקס',amount:55,cycle:'monthly',cat:'מנויים ושירותים'},
  {id:'s2',name:'ספוטיפיי',amount:20,cycle:'monthly',cat:'מנויים ושירותים'},
];

const limits = {'מזון לבית':2000,'אוכל בחוץ ובילויים':800,'דלק וחניה':500,'ביגוד והנעלה':600};

const fixed = [
  {id:'f1',cat:'דיור',amount:5200},
  {id:'f2',cat:'חשמל',amount:410},
];

const settings = {incomeSources:['שכר','פרילנס'], theme:'light'};

module.exports = {
  budget_tx: JSON.stringify(tx),
  budget_goals: JSON.stringify(goals),
  budget_subs: JSON.stringify(subs),
  budget_limits: JSON.stringify(limits),
  budget_fixed: JSON.stringify(fixed),
  budget_settings: JSON.stringify(settings),
};
