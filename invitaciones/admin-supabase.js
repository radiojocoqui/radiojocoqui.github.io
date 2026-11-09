import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
const sb = createClient('https://grjqqhmzyfozrxrkvmyn.supabase.co', 'sb_publishable_6JiVK0CopQQiY-d2Ha0-mQ_Q6VuKGIe');
const $ = id => document.getElementById(id);
const money = n => new Intl.NumberFormat('es-MX', {style:'currency', currency:'MXN'}).format(Number(n)||0);
const status = message => { $('status').textContent = message; };
let events = [];
let selectedId = '';
let busy = false;
function clearForm() {
  selectedId = '';
  $('eventSelect').value = '';
  $('eventForm').reset();
  $('saveEventButton').textContent = 'Crear evento';
  $('capacity').textContent = '—';
}
function showEvent(id) {
  selectedId = id || '';
  const event = events.find(x => x.id === selectedId);
  if (!event) { clearForm(); return; }
  $('eventSelect').value = event.id;
  $('eventName').value = event.title;
  $('eventDate').value = event.event_date;
  $('capacityInput').value = event.capacity;
  $('price').value = event.price_per_person;
  $('capacity').textContent = event.capacity;
  $('saveEventButton').textContent = 'Guardar cambios';
}
async function refresh(preferredId = selectedId) {
  const {data:{user},error:authError} = await sb.auth.getUser();
  if (authError || !user) {
    $('adminArea').hidden = true;
    $('loginPanel').hidden = false;
    status('Inicia sesión con tu cuenta administradora.');
    return;
  }
  const {data:profile,error:profileError} = await sb.from('profiles').select('role').eq('id',user.id).single();
  if (profileError || profile?.role !== 'admin') {
    $('adminArea').hidden = true;
    $('loginPanel').hidden = false;
    status('Acceso restringido: necesitas rol admin.');
    return;
  }
  $('adminArea').hidden = false;
  $('loginPanel').hidden = true;
  const {data,error} = await sb.from('rj_events').select('id,title,event_date,capacity,price_per_person,created_at').order('created_at',{ascending:false}).limit(200);
  if (error) { status('Error al consultar eventos: ' + error.message); return; }
  events = data || [];
  const selector = $('eventSelect');
  selector.replaceChildren();
  const newOption = document.createElement('option');
  newOption.value = '';
  newOption.textContent = '+ Crear nuevo evento';
  selector.append(newOption);
  for (const event of events) {
    const option = document.createElement('option');
    option.value = event.id;
    option.textContent = `${event.title} · ${event.event_date}`;
    selector.append(option);
  }
  const list = $('eventList');
  list.replaceChildren();
  for (const event of events) {
    const li = document.createElement('li');
    li.textContent = `${event.title} · ${event.event_date} · Cupo ${event.capacity} · ${money(event.price_per_person)}`;
    list.append(li);
  }
  if (!events.length) { const li=document.createElement('li');li.textContent='No hay eventos todavía';list.append(li); }
  if (preferredId === '' && events.length) showEvent(events[0].id);
  else if (preferredId === '') clearForm();
  else showEvent(events.some(x => x.id === preferredId) ? preferredId : (events[0]?.id || ''));
  $('reserved').textContent = '—';
  $('deposits').textContent = '—';
  $('balances').textContent = '—';
  $('guests').innerHTML = '<tr><td colspan="7">Las invitaciones todavía no están conectadas. No registrar pagos reales.</td></tr>';
  status('Sesión administrativa activa · Eventos conectados a Supabase. Puedes crear o editar eventos. Invitaciones aún deshabilitadas.');
}
$('loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  status('Iniciando sesión…');
  const {error} = await sb.auth.signInWithPassword({email:$('loginEmail').value.trim(),password:$('loginPassword').value});
  $('loginPassword').value = '';
  if (error) { status('No se pudo iniciar sesión: ' + error.message); return; }
  await refresh();
});
$('logout').addEventListener('click', async () => {
  const {error} = await sb.auth.signOut();
  if (error) { status('No se pudo cerrar sesión: ' + error.message); return; }
  selectedId = '';
  $('adminArea').hidden = true;
  $('loginPanel').hidden = false;
  status('Sesión cerrada.');
});
$('eventSelect').addEventListener('change', e => showEvent(e.target.value));
$('newEventButton').addEventListener('click', () => { clearForm(); status('Nuevo evento: completa los campos y pulsa Crear evento.'); });
$('eventForm').addEventListener('submit', async e => {
  e.preventDefault();
  if (busy) return;
  const title = $('eventName').value.trim();
  const event_date = $('eventDate').value;
  const capacity = Number($('capacityInput').value);
  const price_per_person = Number($('price').value);
  if (!title || !event_date || !Number.isInteger(capacity) || capacity < 1 || !Number.isFinite(price_per_person) || price_per_person <= 0) {
    status('Revisa los datos del evento.'); return;
  }
  busy = true;
  $('saveEventButton').disabled = true;
  status(selectedId ? 'Guardando cambios…' : 'Creando evento…');
  try {
    const wasEditing = Boolean(selectedId);
    const payload = {title,event_date,capacity,price_per_person};
    const result = selectedId
      ? await sb.from('rj_events').update(payload).eq('id',selectedId).select('id').single()
      : await sb.from('rj_events').insert(payload).select('id').single();
    if (result.error) { status('No se pudo guardar el evento: ' + result.error.message); return; }
    await refresh(result.data.id);
    status(wasEditing ? 'Cambios guardados correctamente en Supabase.' : 'Evento creado correctamente en Supabase.');
  } catch (error) {
    status('Error de conexión: ' + (error?.message || 'intenta de nuevo'));
  } finally {
    busy = false;
    $('saveEventButton').disabled = false;
  }
});
$('guestForm').addEventListener('submit', e => {e.preventDefault();status('Las invitaciones se habilitarán después de verificar sus columnas y las reglas de cupo.');});
$('export').addEventListener('click', () => status('La exportación de invitados todavía no está habilitada.'));
$('reset').disabled = true;
const list = document.createElement('section');
list.className = 'card';
list.style.marginTop = '16px';
list.innerHTML = '<h2>Eventos existentes en Supabase</h2><ul id="eventList"></ul><p style="font-size:13px">Selecciona un evento para editarlo o crea uno nuevo. No se borran eventos anteriores.</p>';
$('eventForm').closest('section').after(list);
await refresh();
