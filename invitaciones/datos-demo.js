/* DEMOSTRACIÓN LOCAL. No almacena pagos reales ni se conecta a Supabase. */
const KEY='rj_invitaciones_demo_v1';
const seed={event:{name:'Evento de prueba · Radio Jocoqui',date:'2026-11-16',capacity:20,price:600},guests:[{id:'RJ-001',name:'Invitada de ejemplo',contact:'demo@ejemplo.com',seats:2,deposit:600,verified:true,balancePaid:false,entered:false},{id:'RJ-002',name:'Invitado pendiente',contact:'',seats:1,deposit:0,verified:false,balancePaid:false,entered:false}]};
function load(){try{const v=JSON.parse(localStorage.getItem(KEY));if(v&&v.event&&Array.isArray(v.guests))return v}catch(e){}return structuredClone(seed)}
function save(data){localStorage.setItem(KEY,JSON.stringify(data))}
function money(v){return new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(v)}
function total(g,d){return g.seats*d.event.price}
function paid(g,d){return g.verified?total(g,d)/2:0}
function balance(g,d){return total(g,d)-paid(g,d)-(g.balancePaid?total(g,d)/2:0)}
function reserved(d){return d.guests.filter(g=>g.verified).reduce((a,g)=>a+g.seats,0)}
function escapeHtml(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function nextId(d){return 'RJ-'+String(Math.max(0,...d.guests.map(g=>Number(g.id.split('-')[1])||0))+1).padStart(3,'0')}
