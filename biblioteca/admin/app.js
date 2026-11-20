
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://grjqqhmzyfozrxrkvmyn.supabase.co';
const SUPABASE_KEY = 'sb_publishable_6JiVK0CopQQiY-d2Ha0-mQ_Q6VuKGIe';
const WORKER_URL = 'https://radio-jocoqui-musica.radiojocoqui.workers.dev';

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
window.verificarRadioJocoqui = async () => {
  const resultado = await workerRequest('/verificar');

  console.log('Diagnóstico Radio Jocoqui:', resultado);

  return resultado;
};
const $ = id => document.getElementById(id);

const MAX_SIZE = 200 * 1024 * 1024;

let user = null;
let admin = false;
let activeAudio = null;
let activeButton = null;

const status = message => {
  $('status').textContent = message;
};

const safeError = error =>
  error?.message || 'Ocurrió un error';

async function workerRequest(path, options = {}) {
  const { data: { session }, error } =
    await sb.auth.getSession();

  if (error || !session?.access_token) {
    throw new Error('Inicia sesión nuevamente.');
  }

  const response = await fetch(WORKER_URL + path, {
    ...options,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      ...(options.headers || {})
    }
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      result.detalle || result.error || 'Error de Cloudflare'
    );
  }

  return result;
}

async function refresh() {
  if (!user) return;

  const { data, error } = await sb
    .from('rj_music_tracks')
    .select('id,title,artist,status,storage_path,created_at')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    status('No se pudo consultar la biblioteca: ' + safeError(error));
    return;
  }

  $('tracks').replaceChildren();

  for (const track of data || []) {
    const tr = document.createElement('tr');

    for (const value of [
      track.title,
      track.artist,
      track.status
    ]) {
      const td = document.createElement('td');
      td.textContent = value || '—';
      tr.appendChild(td);
    }

    const cell = document.createElement('td');
    const isR2 = track.storage_path?.startsWith('r2:');

    if (admin && track.status === 'pending') {
      if (isR2) {
        
const btn = document.createElement('button');
btn.type = 'button';
btn.textContent = 'Verificar archivo';

btn.addEventListener('click', async () => {
  btn.disabled = true;
  btn.textContent = 'Verificando...';

  try {
    const result = await workerRequest('/aprobar', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        trackId: track.id
      })
    });

    if (result.verificado && result.archivoEncontrado) {
      const mb = (result.tamanoBytes / 1024 / 1024).toFixed(2);
      alert(`Archivo encontrado en R2 privado: ${mb} MB`);
    } else {
      alert('No se pudo confirmar el archivo.');
    }
  } catch (error) {
    alert('Error de verificación: ' + error.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Verificar archivo';
  }
});

cell.appendChild(btn);

      } else {
        for (const [label, next] of [
          ['Aprobar', 'approved'],
          ['Rechazar', 'rejected']
        ]) {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.textContent = label;
          btn.className = next === 'rejected' ? 'secondary' : '';

          btn.addEventListener('click', async () => {
            btn.disabled = true;

            const { error } = await sb
              .from('rj_music_tracks')
              .update({ status: next })
              .eq('id', track.id);

            status(error
              ? 'No se pudo actualizar: ' + safeError(error)
              : 'Estado actualizado a ' + next
            );

            await refresh();
          });

          cell.append(btn, document.createTextNode(' '));
        }
      }
    }

    if (
      admin &&
      track.status === 'approved' &&
      track.storage_path &&
      !isR2
    ) {
      const play = document.createElement('button');
      play.type = 'button';
      play.className = 'secondary';
      play.textContent = '▶ Escuchar';

      play.addEventListener('click', async () => {
        if (activeAudio && activeButton === play) {
          activeAudio.pause();
          activeAudio = null;
          activeButton = null;
          play.textContent = '▶ Escuchar';
          return;
        }

        if (activeAudio) activeAudio.pause();
        if (activeButton) activeButton.textContent = '▶ Escuchar';

        play.disabled = true;
        status('Preparando reproducción privada...');

        const { data: signed, error } = await sb.storage
          .from('radio-jocoqui-musica')
          .createSignedUrl(track.storage_path, 120);

        play.disabled = false;

        if (error || !signed?.signedUrl) {
          status('No se pudo obtener el audio: ' + safeError(error));
          return;
        }

        const audio = new Audio(signed.signedUrl);
        activeAudio = audio;
        activeButton = play;
        play.textContent = '■ Detener';

        audio.addEventListener('ended', () => {
          if (activeAudio === audio) {
            activeAudio = null;
            activeButton = null;
            play.textContent = '▶ Escuchar';
          }
        });

        audio.addEventListener('error', () => {
          if (activeAudio === audio) {
            activeAudio = null;
            activeButton = null;
            play.textContent = '▶ Escuchar';
            status('No se pudo reproducir este MP3.');
          }
        });

        try {
          await audio.play();
          status('Reproduciendo: ' + track.title);
        } catch (error) {
          status('Error de reproducción: ' + safeError(error));
        }
      });

      cell.appendChild(play);
    }

    if (!cell.childNodes.length) {
      cell.textContent = '—';
    }

    tr.appendChild(cell);
    $('tracks').appendChild(tr);
  }
}

async function init() {
  const { data: { user: current } } = await sb.auth.getUser();
  user = current;

  $('login').classList.toggle('hidden', !!user);
  $('app').classList.toggle('hidden', !user);

  if (!user) return;

  const [
    { data: profile, error: profileError },
    { data: adminValue, error: adminError }
  ] = await Promise.all([
    sb.from('profiles')
      .select('music_role')
      .eq('id', user.id)
      .single(),
    sb.rpc('is_admin')
  ]);

  admin = !adminError && adminValue === true;

  const allowed = admin ||
    (!profileError &&
      ['contributor', 'admin'].includes(profile?.music_role));

  $('identity').textContent =
    `${user.email} · ${
      admin ? 'Administrador' :
      allowed ? 'Colaborador musical' : 'Sin permiso musical'
    }`;

  $('uploadForm').classList.toggle('hidden', !allowed);
  $('listTitle').textContent =
    admin ? 'Archivos para revisión' : 'Mis archivos';

  if (!allowed) {
    status('Tu cuenta necesita autorización musical.');
  }

  await refresh();
}

$('loginForm').addEventListener('submit', async event => {
  event.preventDefault();

  const btn = event.submitter;
  btn.disabled = true;

  const { error } = await sb.auth.signInWithPassword({
    email: $('email').value.trim(),
    password: $('password').value
  });

  btn.disabled = false;

  if (error) {
    alert('No se pudo iniciar sesión: ' + safeError(error));
    return;
  }

  $('password').value = '';
  await init();
});

$('logout').addEventListener('click', async () => {
  await sb.auth.signOut();
  location.reload();
});

$('uploadForm').addEventListener('submit', async event => {
  event.preventDefault();

  const file = $('audio').files?.[0];

  if (!file) {
    status('Selecciona un archivo MP3.');
    return;
  }

  if (!file.name.toLowerCase().endsWith('.mp3')) {
    status('Solo se permiten archivos MP3.');
    return;
  }

  if (file.size > MAX_SIZE) {
    status('El archivo supera los 200 MB.');
    return;
  }

  const title = $('title').value.trim();
  const artist = $('artist').value.trim();
  const genre = $('genre').value.trim();

  if (!title || !artist) {
    status('Completa título y artista.');
    return;
  }

  const btn = $('uploadBtn');
  btn.disabled = true;

  let upload = null;
  let completed = false;

  try {
    status('Preparando subida a Cloudflare R2...');

    upload = await workerRequest('/iniciar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: file.name,
        size: file.size
      })
    });

    const parts = [];

    for (let i = 0; i < upload.totalParts; i++) {
      const start = i * upload.chunkSize;
      const end = Math.min(
        start + upload.chunkSize,
        file.size
      );

      const chunk = file.slice(start, end);

      const params = new URLSearchParams({
        key: upload.key,
        uploadId: upload.uploadId,
        partNumber: String(i + 1)
      });

      const part = await workerRequest(
        '/parte?' + params.toString(),
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/octet-stream'
          },
          body: chunk
        }
      );

      parts.push({
        partNumber: part.partNumber,
        etag: part.etag
      });

      const progress = Math.round(
        ((i + 1) / upload.totalParts) * 100
      );

      status(`Subiendo ${file.name}: ${progress}%`);
    }

    await workerRequest('/finalizar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: upload.key,
        uploadId: upload.uploadId,
        parts
      })
    });

    completed = true;

    status('Archivo recibido. Registrando para aprobación...');

    const { error: dbError } = await sb
      .from('rj_music_tracks')
      .insert({
        uploaded_by: user.id,
        title,
        artist,
        genre: genre || null,
        storage_path: 'r2:' + upload.key,
        status: 'pending'
      });

    if (dbError) {
      status(
        'El MP3 se subió, pero no se pudo registrar. ' +
        'No lo subas nuevamente. Referencia: ' +
        upload.key + '. Error: ' + safeError(dbError)
      );
      return;
    }

    $('uploadForm').reset();

    status(
      'MP3 recibido correctamente. Estado: pendiente de aprobación.'
    );

    await refresh();

  } catch (error) {
    status('Error durante la subida: ' + safeError(error));

    if (upload && !completed) {
      try {
        await workerRequest('/cancelar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            key: upload.key,
            uploadId: upload.uploadId
          })
        });
      } catch (_) {
        // La limpieza puede requerir intervención posterior.
      }
    }
  } finally {
    btn.disabled = false;
  }
});

await init();
