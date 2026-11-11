import {createClient} from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
const sb=createClient('https://grjqqhmzyfozrxrkvmyn.supabase.co','sb_publishable_6JiVK0CopQQiY-d2Ha0-mQ_Q6VuKGIe');
const $=id=>document.getElementById(id);
let user=null,admin=false;
let activeAudio=null,activeButton=null;
const status=message=>$('status').textContent=message;
const safeError=e=>e?.message||'Ocurrió un error';
async function refresh(){
  if(!user)return;
  const {data,error}=await sb.from('rj_music_tracks').select('id,title,artist,status,storage_path,created_at').order('created_at',{ascending:false}).limit(200);
  if(error){status('No se pudo consultar la biblioteca: '+safeError(error));return;}
  $('tracks').replaceChildren();
  for(const track of data||[]){
    const tr=document.createElement('tr');
    for(const value of [track.title,track.artist,track.status])tr.appendChild(Object.assign(document.createElement('td'),{textContent:value}));
    const cell=document.createElement('td');
    if(admin&&track.status==='pending'){
      for(const [label,next] of [['Aprobar','approved'],['Rechazar','rejected']]){
        const btn=document.createElement('button');btn.type='button';btn.textContent=label;btn.className=next==='rejected'?'secondary':'';
        btn.addEventListener('click',async()=>{
          btn.disabled=true;
          const {error}=await sb.from('rj_music_tracks').update({status:next}).eq('id',track.id);
          status(error?'No se pudo actualizar: '+safeError(error):'Estado actualizado a '+next+'. Esto aún no publica audio al público.');
          await refresh();
        });cell.append(btn,document.createTextNode(' '));
      }
    }
    if(admin && track.status==='approved' && track.storage_path){
      const play=document.createElement('button');
      play.type='button';play.className='secondary';play.textContent='▶ Escuchar';
      play.addEventListener('click',async()=>{
        if(activeAudio && activeButton===play){
          activeAudio.pause();activeAudio=null;activeButton=null;play.textContent='▶ Escuchar';return;
        }
        if(activeAudio){activeAudio.pause();activeAudio=null;}
        if(activeButton)activeButton.textContent='▶ Escuchar';
        play.disabled=true;status('Preparando reproducción privada...');
        const {data:signed,error}=await sb.storage.from('radio-jocoqui-musica').createSignedUrl(track.storage_path,120);
        play.disabled=false;
        if(error || !signed?.signedUrl){status('No se pudo obtener el audio: '+safeError(error));return;}
        const audio=new Audio(signed.signedUrl);audio.preload='metadata';
        activeAudio=audio;activeButton=play;play.textContent='■ Detener';
        audio.addEventListener('ended',()=>{if(activeAudio===audio){activeAudio=null;activeButton=null;play.textContent='▶ Escuchar';}});
        audio.addEventListener('error',()=>{if(activeAudio===audio){activeAudio=null;activeButton=null;play.textContent='▶ Escuchar';status('No se pudo reproducir este MP3.');}});
        try{await audio.play();status('Reproduciendo: '+track.title+' — '+track.artist);}catch(e){if(activeAudio===audio){activeAudio=null;activeButton=null;play.textContent='▶ Escuchar';}status('No se pudo iniciar la reproducción: '+safeError(e));}
      });
      cell.append(play);
    }
    if(!cell.childNodes.length)cell.textContent='—';
    tr.append(cell);$('tracks').append(tr);
  }
}
async function init(){
 const {data:{user:current}}=await sb.auth.getUser();user=current;
 $('login').classList.toggle('hidden',!!user);$('app').classList.toggle('hidden',!user);
 if(!user)return;
 const [{data:profile,error:profileError},{data:adminValue,error:adminError}]=await Promise.all([
  sb.from('profiles').select('music_role').eq('id',user.id).single(),sb.rpc('is_admin')]);
 admin=!adminError&&adminValue===true;
 const allowed=admin||(!profileError&&['contributor','admin'].includes(profile?.music_role));
 $('identity').textContent=`${user.email} · ${admin?'Administrador':allowed?'Colaborador musical':'Sin permiso musical'}`;
 $('uploadForm').classList.toggle('hidden',!allowed);
 $('listTitle').textContent=admin?'Archivos para revisión':'Mis archivos';
 if(!allowed)status('Tu cuenta necesita autorización musical. Solicita al administrador que cambie music_role a contributor.');
 await refresh();
}
$('loginForm').addEventListener('submit',async e=>{
 e.preventDefault();const btn=e.submitter;btn.disabled=true;
 const {error}=await sb.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value});
 btn.disabled=false;
 if(error){alert('No se pudo iniciar sesión: '+safeError(error));return;}
 $('password').value='';await init();
});
$('logout').addEventListener('click',async()=>{await sb.auth.signOut();location.reload();});
$('uploadForm').addEventListener('submit',async e=>{
 e.preventDefault();const file=$('audio').files?.[0];
 if(!file){status('Selecciona un MP3.');return;}
 if(file.size>25*1024*1024){status('El archivo supera los 25 MB.');return;}
 if(!file.name.toLowerCase().endsWith('.mp3')){status('Solo se permiten archivos MP3.');return;}
 const title=$('title').value.trim(),artist=$('artist').value.trim(),genre=$('genre').value.trim();
 if(!title||!artist){status('Completa título y artista.');return;}
 const btn=$('uploadBtn');btn.disabled=true;
 const path=`${user.id}/${crypto.randomUUID()}.mp3`;
 try{
  status('Subiendo MP3 a almacenamiento privado...');
  const {error:uploadError}=await sb.storage.from('radio-jocoqui-musica').upload(path,file,{contentType:'audio/mpeg',upsert:false});
  if(uploadError)throw uploadError;
  status('MP3 cargado. Registrando para aprobación...');
  const {error:dbError}=await sb.from('rj_music_tracks').insert({uploaded_by:user.id,title,artist,genre:genre||null,storage_path:path,status:'pending'});
  if(dbError){status('El MP3 se cargó, pero no se registró en la biblioteca. Contacta al administrador para revisar el archivo '+path+'; no lo subas otra vez. Error: '+safeError(dbError));return;}
  $('uploadForm').reset();status('MP3 recibido. Estado: pendiente de aprobación.');await refresh();
 }catch(error){status('No se pudo completar la subida: '+safeError(error));}
 finally{btn.disabled=false;}
});
await init();
