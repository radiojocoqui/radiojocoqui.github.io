import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
const sb = createClient('https://grjqqhmzyfozrxrkvmyn.supabase.co', 'sb_publishable_6JiVK0CopQQiY-d2Ha0-mQ_Q6VuKGIe');
const $ = id => document.getElementById(id);
const money = n => new Intl.NumberFormat('es-MX', {style:'currency', currency:'MXN'}).format(Number(n)||0);
const status = message => { $('status').textContent = message; };
let events = [];
let selectedId = '';
let busy = false;
let invitations = [];
let loadSequence = 0;
let registeredUsers = [];
const csvCell = value => {
  let s = String(value ?? '');
  if (/^[=+@\-\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
};
function clearForm() {
  selectedId = '';
  $('eventSelect').value = '';
  $('eventForm').reset();
  $('saveEventButton').textContent = 'Crear evento';
  $('capacity').textContent = '—';
  clearInvitations();
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
  void loadInvitations(event.id);
}
function clearInvitations() {
  loadSequence++;
  invitations = [];
  $('reserved').textContent = '—';
  $('deposits').textContent = '—';
  $('balances').textContent = '—';
  $('guests').replaceChildren();
  const row = $('guests').insertRow();
  const cell = row.insertCell();
  cell.colSpan = 7;
  cell.textContent = 'Selecciona un evento para consultar sus invitaciones.';
}
function showInvitations(event) {
  const body = $('guests');
  body.replaceChildren();
  const confirmed = invitations.filter(x => x.deposit_verified);
  const reserved = confirmed.reduce((n,x) => n + x.seats, 0);
  $('reserved').textContent = String(reserved);
  $('deposits').textContent = money(confirmed.reduce((n,x) => n + Number(x.deposit_amount || 0), 0));
  $('balances').textContent = money(confirmed.reduce((n,x) => n + Math.max(0, x.seats * Number(event.price_per_person) - Number(x.deposit_amount || 0) - Number(x.final_payment_amount || 0)), 0));
  if (!invitations.length) {
    const row = body.insertRow();
    const cell = row.insertCell();
    cell.colSpan = 7;
    cell.textContent = 'Todavía no hay invitaciones para este evento.';
    return;
  }
  for (const inv of invitations) {
    const row = body.insertRow();
    const total = inv.seats * Number(event.price_per_person);
    const values = [inv.folio, inv.guest_name, inv.seats, money(total), money(inv.deposit_amount), inv.deposit_verified ? 'Anticipo verificado' : 'Pendiente · sin acceso'];
    for (const value of values) row.insertCell().textContent = String(value);
    const actions = row.insertCell();
    const link = new URL('ver-invitacion.html', window.location.href);
    link.searchParams.set('folio', inv.folio);
    const url = link.href;
    const email = String(inv.guest_contact || '').trim();
    const subject = `Invitación pendiente · ${event.title} · Radio Jocoqui`;
    const bodyText = `Hola ${inv.guest_name},\\n\\nTe compartimos una invitación pendiente para ${event.title} (${event.event_date}), para ${inv.seats} persona(s).\\n\\nConsulta los detalles aquí: ${url}\\n\\nEsta invitación NO garantiza entrada ni reserva lugares. Para confirmar es necesario que Radio Jocoqui verifique el anticipo del 50%. El 50% restante se paga antes de ingresar.\\n\\nRadio Jocoqui`;
    const mail = document.createElement('button');
    mail.type = 'button'; mail.textContent = 'Correo';
    mail.disabled = !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email);
    mail.title = mail.disabled ? 'Esta invitación no tiene correo válido' : 'Abrir correo para enviarlo manualmente';
    mail.addEventListener('click', () => {
      window.location.href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText)}`;
      status('Se abrió tu aplicación de correo. Revisa el mensaje y pulsa Enviar allí; no se ha enviado automáticamente.');
    });
    const copy = document.createElement('button');
    copy.type = 'button'; copy.textContent = 'Copiar enlace';
    copy.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(url); status('Enlace copiado. Compártelo solo con el destinatario; todavía no es un acceso confirmado.'); }
      catch { window.prompt('Copia este enlace:', url); }
    });
    
actions.append(
  mail,
  document.createTextNode(' '),
  copy
);

if (!inv.deposit_verified) {
  const confirmBtn = document.createElement('button');
  confirmBtn.type = 'button';
  confirmBtn.textContent = 'Confirmar anticipo';

  confirmBtn.addEventListener('click', async () => {
    confirmBtn.disabled = true;

    try {
      await confirmDeposit(inv, event);
    } finally {
      confirmBtn.disabled = false;
    }
  });

  actions.append(
    document.createTextNode(' '),
    confirmBtn
  );
}

  }
}

async function confirmDeposit(inv, event) {
  const total = inv.seats * Number(event.price_per_person);
  const minimum = total * 0.5;

  const answer = window.prompt(
    `Confirmar anticipo de ${inv.guest_name}\n` +
    `Evento: ${event.title}\n` +
    `Total: ${money(total)}\n` +
    `Anticipo mínimo: ${money(minimum)}\n\n` +
    `Escribe el importe recibido en MXN:`,
    String(minimum)
  );

  if (answer === null) return;

  const amount = Number(answer.trim());

  if (
    !Number.isFinite(amount) ||
    amount < minimum ||
    amount > total
  ) {
    status(
      `El anticipo debe estar entre ${money(minimum)} ` +
      `y ${money(total)}.`
    );
    return;
  }

  if (!window.confirm(
    `¿Ya verificaste el pago de ${money(amount)} ` +
    `de ${inv.guest_name}?\n\n` +
    `Esta acción confirmará ${inv.seats} lugar(es).`
  )) {
    return;
  }

  status('Confirmando anticipo en Supabase…');

  const { error } = await sb.rpc(
    'rj_confirm_invitation',
    {
      p_invitation_id: inv.id,
      p_deposit_amount: amount
    }
  );

  if (error) {
    status('No se pudo confirmar: ' + error.message);
    return;
  }

  await loadInvitations(event.id);
  status(
    `Anticipo verificado. ${inv.guest_name} tiene ` +
    `${inv.seats} lugar(es) confirmado(s).`
  );
}
async function loadInvitations(id) {
  const sequence = ++loadSequence;
  invitations = [];
  if (!id) { clearInvitations(); return; }
  const event = events.find(x => x.id === id);
  if (!event) { clearInvitations(); return; }
  const {data,error} = await sb.from('rj_invitations')
    .select('id,event_id,folio,guest_name,guest_contact,seats,deposit_verified,deposit_amount,final_payment_amount,checked_in_at,created_at')
    .eq('event_id', id).order('created_at', {ascending:false}).limit(1000);
  if (sequence !== loadSequence || selectedId !== id) return;
  if (error) { status('Error al consultar invitaciones: ' + error.message); return; }
  invitations = data || [];
  showInvitations(event);
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
  await loadRegisteredUsers();
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
  status('Sesión administrativa activa · Eventos e invitaciones conectados a Supabase. Los depósitos aún no se validan desde este panel.');
}

async function loadRegisteredUsers() {
  const {data,error} = await sb.rpc('rj_admin_registered_users');
  const select = $('registeredUser');
  select.replaceChildren();
  const placeholder = document.createElement('option');
  placeholder.value = ''; placeholder.textContent = 'Selecciona un usuario';
  select.append(placeholder);
  if (error) {
    registeredUsers = [];
    const opt = document.createElement('option');
    opt.textContent = 'Directorio no disponible: ejecuta primero el SQL de instalación';
    opt.disabled = true; select.append(opt);
    return;
  }
  registeredUsers = data || [];
  for (const user of registeredUsers) {
    const opt = document.createElement('option');
    opt.value = user.id;
    opt.textContent = `${user.display_name || 'Usuario'} · ${user.email}`;
    select.append(opt);
  }
}
$('recipientMode').addEventListener('change', () => {
  const registered = $('recipientMode').value === 'registered';
  $('registeredBox').hidden = !registered;
  $('registeredUser').required = registered;
  $('guestName').readOnly = registered;
  $('contact').readOnly = registered;
  $('guestName').value = '';
  $('contact').value = '';
});
$('registeredUser').addEventListener('change', () => {
  const user = registeredUsers.find(x => x.id === $('registeredUser').value);
  $('guestName').value = user ? (user.display_name || user.email.split('@')[0]) : ''; 
  $('contact').value = user?.email || '';
});

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
$('guestForm').addEventListener('submit', async e => {
  e.preventDefault();
  if (busy) return;
  const event = events.find(x => x.id === selectedId);
  if (!event) { status('Selecciona un evento guardado antes de crear la invitación.'); return; }
  if ($('recipientMode').value === 'registered' && !registeredUsers.some(x => x.id === $('registeredUser').value)) {
    status('Selecciona un usuario registrado válido.'); return;
  }
  const recipient_user_id = $('recipientMode').value === 'registered' ? $('registeredUser').value : null;
  const guest_name = $('guestName').value.trim();
  const guest_contact = $('contact').value.trim();
  if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(guest_contact)) { status('Escribe un correo electrónico válido.'); return; }
  const seats = Number($('seats').value);
  if (!guest_name || !Number.isInteger(seats) || seats < 1 || seats > 50) {
    status('Revisa el nombre y la cantidad de personas (1 a 50).'); return;
  }
  // El folio se genera en el navegador, pero nunca se considera acceso confirmado.
  if (!globalThis.crypto?.randomUUID) { status('Tu navegador no permite generar un folio seguro. Actualízalo e inténtalo de nuevo.'); return; }
  const folio = 'RJ-' + crypto.randomUUID().toUpperCase();
  busy = true;
  const button = $('guestForm').querySelector('button[type="submit"],button');
  button.disabled = true;
  status('Guardando invitación pendiente…');
  try {
    const {error} = await sb.from('rj_invitations').insert({
      event_id:event.id, folio, guest_name, guest_contact, recipient_user_id, seats,
      deposit_verified:false, deposit_amount:0, final_payment_amount:0
    });
    if (error) { status('No se pudo crear la invitación: ' + error.message); return; }
    $('guestForm').reset();
    $('registeredBox').hidden = true;
    $('guestName').readOnly = false;
    $('contact').readOnly = false;
    $('seats').value = '1';
    await loadInvitations(event.id);
    status('Invitación pendiente creada. Usa Correo o Copiar enlace en la lista para compartirla. No se envía automáticamente ni reserva lugares.');
  } catch (error) {
    status('Error de conexión al crear la invitación: ' + (error?.message || 'intenta de nuevo'));
  } finally {
    busy = false;
    button.disabled = false;
  }
});
$('export').addEventListener('click', () => {
  const event = events.find(x => x.id === selectedId);
  if (!event) { status('Selecciona un evento antes de exportar.'); return; }
  const rows = [['Folio','Responsable','Contacto','Lugares','Anticipo verificado','Anticipo recibido','Pago final registrado'],
    ...invitations.map(x => [x.folio,x.guest_name,x.guest_contact,x.seats,x.deposit_verified ? 'Sí':'No',x.deposit_amount,x.final_payment_amount])];
  const csv = '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], {type:'text/csv;charset=utf-8'}));
  const a = document.createElement('a');
  a.href = url; a.download = 'invitaciones-radio-jocoqui.csv';
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  status('CSV descargado. Contiene datos personales: guárdalo de forma privada.');
});
$('reset').disabled = true;
const list = document.createElement('section');
list.className = 'card';
list.style.marginTop = '16px';
list.innerHTML = '<h2>Eventos existentes en Supabase</h2><ul id="eventList"></ul><p style="font-size:13px">Selecciona un evento para editarlo o crea uno nuevo. No se borran eventos anteriores.</p>';
$('eventForm').closest('section').after(list);
await refresh();
