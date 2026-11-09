import {createClient} from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
const sb=createClient('https://grjqqhmzyfozrxrkvmyn.supabase.co','sb_publishable_6JiVK0CopQQiY-d2Ha0-mQ_Q6VuKGIe');
const $=id=>document.getElementById(id), money=n=>new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(Number(n)||0);
const status=(message)=>{$('status').textContent=message};
const escapeHtml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let event=null;
async function refresh(){
 const {data:{user},error:ue}=await sb.auth.getUser();
 if(ue||!user){$('adminArea').hidden=true;status('Inicia sesión con tu cuenta administradora.');return}
 const {data:profile,error:pe}=await sb.from('profiles').select('role').eq('id',user.id).single();
 if(pe||profile?.role!=='admin'){$('adminArea').hidden=true;status('Acceso restringido: necesitas rol admin.');return}
 $('adminArea').hidden=false;status('Sesión administrativa activa · Eventos conectados a Supabase. Invitaciones todavía deshabilitadas.');
 const {data,error}=await sb.from('rj_events').select('id,title,event_date,capacity,price_per_person,created_at').order('created_at',{ascending:false}).limit(50);
 if(error){status('Error al consultar eventos: '+error.message);return}
 event=data?.[0]||null;
 if(event){$('eventName').value=event.title;$('eventDate').value=event.event_date;$('capacityInput').value=event.capacity;$('price').value=event.price_per_person;}
 else {$('eventForm').reset();}
 $('capacity').textContent=event?.capacity??'—';$('reserved').textContent='—';$('deposits').textContent='—';$('balances').textContent='—';
 $('guests').innerHTML='<tr><td colspan="7">Etapa 1: todavía no se muestran invitaciones. No registrar pagos reales.</td></tr>';
 const el=document.getElementById('eventList'); if(el)el.innerHTML=(data||[]).map(x=>`<li>${escapeHtml(x.title)} · ${escapeHtml(x.event_date)} · Cupo ${Number(x.capacity)} · ${money(x.price_per_person)}</li>`).join('')||'<li>No hay eventos todavía</li>';
}
$('loginForm').addEventListener('submit',async e=>{e.preventDefault();status('Iniciando sesión…');const {error}=await sb.auth.signInWithPassword({email:$('loginEmail').value.trim(),password:$('loginPassword').value});$('loginPassword').value='';if(error){status('No se pudo iniciar sesión: '+error.message);return}await refresh()});
$('logout').addEventListener('click',async()=>{await sb.auth.signOut();$('adminArea').hidden=true;status('Sesión cerrada')});
$('eventForm').addEventListener('submit',async e=>{e.preventDefault();const title=$('eventName').value.trim(),event_date=$('eventDate').value,capacity=Number($('capacityInput').value),price_per_person=Number($('price').value);if(!title||!event_date||!Number.isInteger(capacity)||capacity<1||!Number.isFinite(price_per_person)||price_per_person<=0){status('Revisa los datos del evento.');return}if(event){status('Por seguridad, en esta etapa solo creamos eventos nuevos; no editamos eventos existentes.');return}const {error}=await sb.from('rj_events').insert({title,event_date,capacity,price_per_person});if(error){status('No se pudo crear el evento: '+error.message);return}await refresh();status('Evento creado correctamente en Supabase.')});
$('guestForm').addEventListener('submit',e=>{e.preventDefault();status('Crear invitaciones se habilitará en la etapa 2, después de verificar las columnas y las reglas de cupo.')});
$('export').addEventListener('click',()=>status('La exportación de invitados se habilitará cuando estén conectadas las invitaciones.'));
$('reset').disabled=true;
const list=document.createElement('section');list.className='card';list.style.marginTop='16px';list.innerHTML='<h2>Eventos existentes en Supabase</h2><ul id="eventList"></ul><p style="font-size:13px">Si ya existe un evento, esta etapa no permite modificarlo. Para probar la creación de uno nuevo, revisaremos primero cómo manejar varios eventos.</p>';$('eventForm').closest('section').after(list);
await refresh();
