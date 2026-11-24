// ============================================================
// BFS Commercial — DÉMARCHAGE de proximité (professionnels, particuliers plus tard)
// Source : API « Recherche d'entreprises » (data.gouv.fr, gratuite, sans clé) — établissements ouverts autour d'un point.
// Dépend de : db, ME, $, toast, goTo, geocoderAdresse (BC_catalogue.js), carteKm/carteChargerLeaflet (BC_carte.js)
// Règles : on écarte les entreprises opposées à la diffusion commerciale et, par défaut, les entrepreneurs individuels
// (souvent un domicile) ; les clients existants sont masqués. Le suivi (visité, RDV, pas intéressé) est partagé entre commerciaux.
// ============================================================
const DEM_SECTIONS={C:'Industrie / ateliers',F:'BTP',G:'Commerce / garages',H:'Transport / logistique',I:'Hôtels / restaurants',J:'Information / communication',K:'Finance / assurance',L:'Immobilier',M:'Services spécialisés',N:'Services administratifs',P:'Enseignement',Q:'Santé / social',R:'Arts / loisirs',S:'Autres services'};
const DEM_SECTIONS_DEFAUT=['C','G','I','M','N','P','Q','R','S'];
const DEM_EFFECTIF={NN:'Non renseigné','00':'0 salarié','01':'1-2','02':'3-5','03':'6-9','11':'10-19','12':'20-49','21':'50-99','22':'100-199','31':'200-249','32':'250-499','41':'500-999','42':'1 000-1 999','51':'2 000-4 999','52':'5 000-9 999','53':'10 000+'};
const DEM_MOTIFS={APSAD_R4R5:'APSAD R4/R5 à jour (contraint par son assureur)'};
const DEM_STATUTS={a_demarcher:{lib:'À démarcher',col:'#2563eb'},visite:{lib:'Visité',col:'#d97706'},rdv:{lib:'RDV pris',col:'#16a34a'},offre:{lib:'Offre envoyée',col:'#7c3aed'},pas_interesse:{lib:'Pas intéressé',col:'#9ca3af'},client:{lib:'Client',col:'#111827'}};
let _dem={map:null,couche:null,centre:null,prospects:[],suivi:{},exclus:{},clientsSirets:new Set()};
const _escD=s=>String(s??'').replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));

// ---------- Recherche ----------
async function demRechercher(centre,{rayonKm=3,sections=DEM_SECTIONS_DEFAUT,employeurSeul=false,inclureEI=false,maxPages=6}={}){
  const exclus={opposition:0,ei:0,clients:0};const out=new Map();
  for(let page=1;page<=maxPages;page++){
    const p=new URLSearchParams({lat:centre.lat,long:centre.lon,radius:rayonKm,per_page:25,page,etat_administratif:'A'});
    if(sections.length&&sections.length<Object.keys(DEM_SECTIONS).length)p.set('section_activite_principale',sections.join(','));
    const r=await fetch('https://recherche-entreprises.api.gouv.fr/near_point?'+p);
    if(!r.ok)throw new Error(r.status===429?'Trop de requêtes, réessaie dans une minute':'Service entreprises indisponible ('+r.status+')');
    const j=await r.json();
    for(const e of j.results||[]){
      if(e.opposition_diffusion_commerciale===true){exclus.opposition++;continue}
      if(e.complements?.est_entrepreneur_individuel&&!inclureEI){exclus.ei++;continue}
      for(const t of e.matching_etablissements||[]){
        if(t.etat_administratif!=='A')continue;
        const lat=parseFloat(t.latitude),lng=parseFloat(t.longitude);if(isNaN(lat)||isNaN(lng))continue;
        if(employeurSeul&&t.caractere_employeur!=='O')continue;
        if(_dem.clientsSirets.has(t.siret)){exclus.clients++;continue}
        const d=carteKm(centre,{lat,lon:lng});if(d>rayonKm*1.05)continue;
        out.set(t.siret,{siret:t.siret,nom:(t.liste_enseignes&&t.liste_enseignes[0])||e.nom_complet,raison:e.nom_complet,adresse:t.adresse,ville:t.libelle_commune,
          lat,lng,naf:t.activite_principale||e.activite_principale,section:e.section_activite_principale,effectif:t.tranche_effectif_salarie||e.tranche_effectif_salarie||'NN',dist:d});
      }
    }
    if(page>=(j.total_pages||1))break;
    await new Promise(r=>setTimeout(r,180));
  }
  return {liste:[...out.values()].sort((a,b)=>a.dist-b.dist),exclus};
}
async function demChargerSuivi(liste){
  _dem.suivi={};const sirets=liste.map(p=>p.siret);
  for(let i=0;i<sirets.length;i+=100){
    const {data}=await db.from('prospects').select('siret,statut,notes,contact_nom,contact_tel,contact_email,prochain_rappel,rappel_motif,derniere_action').in('siret',sirets.slice(i,i+100));
    (data||[]).forEach(s=>_dem.suivi[s.siret]=s);
  }
}
async function demChargerSiretsClients(){
  const {data}=await db.from('clients').select('siret').not('siret','is',null);
  _dem.clientsSirets=new Set((data||[]).map(c=>String(c.siret).replace(/\s/g,'')).filter(Boolean));
}

// ---------- Interface ----------
async function demarchageOuvrir(vue){
  goTo('s-demarchage');
  const root=$('dem-root');_dem.vue=vue||'prospection';
  const tab=(k,l)=>`<button class="btn ${_dem.vue===k?'btn-p':'btn-s'}" style="flex:1;padding:10px" onclick="demarchageOuvrir('${k}')">${l}</button>`;
  root.innerHTML=`<div style="display:flex;gap:6px;padding:12px 14px 0">${tab('prospection','🎯 Prospection')}${tab('suivi','📞 Suivi &amp; rappels')}</div><div id="dem-corps"></div>`;
  if(_dem.vue==='suivi'){await demSuiviOuvrir();return}
  await demVueProspection();
}
async function demVueProspection(){
  const root=$('dem-corps');
  const {data:cl}=await db.from('clients').select('id,raison_sociale,adresse,code_postal,ville,lat,lng').eq('actif',true).order('raison_sociale');
  _dem.clients=cl||[];
  const sel='padding:9px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:14px;background:#fff';
  root.innerHTML=`<div style="padding:14px">
    <div style="display:flex;gap:6px;margin-bottom:10px">
      <select id="dem-cible" style="${sel};flex:1"><option value="professionnel">🏢 Professionnels</option><option value="particulier" disabled>🏠 Particuliers (bientôt)</option></select>
    </div>
    <label style="font-size:12px;font-weight:600">Autour de</label>
    <select id="dem-centre" style="${sel};width:100%;margin-bottom:8px" onchange="document.getElementById('dem-adr').style.display=this.value==='adresse'?'block':'none'">
      <option value="gps">📍 Ma position</option><option value="adresse">🔎 Une adresse…</option>
      <optgroup label="Nos clients">${_dem.clients.map(c=>`<option value="c:${c.id}">${_escD(c.raison_sociale)}${c.ville?' — '+_escD(c.ville):''}</option>`).join('')}</optgroup></select>
    <input id="dem-adr" style="${sel};width:100%;margin-bottom:8px;display:none" placeholder="Adresse ou ville">
    <div style="display:flex;gap:10px;align-items:center;margin-bottom:8px;font-size:13px">
      <label>Rayon <input id="dem-rayon" type="number" min="0.5" max="30" step="0.5" value="3" style="width:70px;${sel}"> km</label>
      <label><input type="checkbox" id="dem-employeur"> avec salariés seulement</label></div>
    <details style="margin-bottom:8px"><summary style="font-size:13px;font-weight:600;cursor:pointer">Secteurs d'activité</summary>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-top:6px;font-size:12.5px">${Object.entries(DEM_SECTIONS).map(([k,v])=>`<label><input type="checkbox" class="dem-sec" value="${k}"${DEM_SECTIONS_DEFAUT.includes(k)?' checked':''}> ${_escD(v)}</label>`).join('')}</div>
      <label style="display:block;margin-top:8px;font-size:12.5px"><input type="checkbox" id="dem-ei"> inclure les entrepreneurs individuels <span style="color:var(--txt-l)">(souvent un domicile)</span></label></details>
    <button class="btn btn-p" style="width:100%;padding:12px" id="dem-btn" onclick="demLancer()">🎯 Chercher des prospects</button>
    <div id="dem-info" style="font-size:12.5px;color:var(--txt-l);margin:10px 0"></div>
    <div id="dem-map" style="height:340px;border-radius:10px;border:1px solid #e5e7eb;background:#f3f4f6"></div>
    <div id="dem-filtre" style="display:flex;gap:6px;flex-wrap:wrap;margin:10px 0"></div>
    <div id="dem-liste"></div></div>`;
}
async function demCentre(){
  const v=$('dem-centre').value;
  if(v==='gps'){
    return await new Promise((ok,ko)=>navigator.geolocation?navigator.geolocation.getCurrentPosition(p=>ok({lat:p.coords.latitude,lon:p.coords.longitude,nom:'Ma position'}),()=>ko(new Error('Position indisponible : autorise la localisation')),{timeout:10000}):ko(new Error('Géolocalisation non disponible')));
  }
  if(v==='adresse'){const a=$('dem-adr').value.trim();if(!a)throw new Error('Saisis une adresse');const g=await geocoderAdresse(a);if(!g)throw new Error('Adresse introuvable');return {lat:g.lat,lon:g.lon,nom:a}}
  const c=_dem.clients.find(x=>'c:'+x.id===v);
  if(c.lat&&c.lng)return {lat:c.lat,lon:c.lng,nom:c.raison_sociale};
  const g=await geocoderAdresse([c.adresse,c.code_postal,c.ville].filter(Boolean).join(' '));if(!g)throw new Error('Adresse du client introuvable');
  return {lat:g.lat,lon:g.lon,nom:c.raison_sociale};
}
async function demLancer(){
  const btn=$('dem-btn'),info=$('dem-info');btn.disabled=true;btn.textContent='⏳ Recherche…';info.textContent='';
  try{
    await carteChargerLeaflet();
    const centre=await demCentre();_dem.centre=centre;
    await demChargerSiretsClients();
    const rayon=Math.min(30,Math.max(0.5,parseFloat($('dem-rayon').value)||3));
    const secs=[...document.querySelectorAll('.dem-sec:checked')].map(x=>x.value);
    const res=await demRechercher(centre,{rayonKm:rayon,sections:secs,employeurSeul:$('dem-employeur').checked,inclureEI:$('dem-ei').checked});
    _dem.prospects=res.liste;_dem.exclus=res.exclus;_dem.rayon=rayon;_dem.filtre='';
    await demChargerSuivi(res.liste);
    info.innerHTML=`<b>${res.liste.length}</b> prospect${res.liste.length>1?'s':''} à moins de ${rayon} km de ${_escD(centre.nom)}`+
      ((res.exclus.opposition+res.exclus.ei+res.exclus.clients)?` — écartés : ${res.exclus.clients} client(s) existant(s), ${res.exclus.opposition} opposé(s) à la prospection commerciale, ${res.exclus.ei} entrepreneur(s) individuel(s)`:'');
    demDessiner();demRendreListe();
  }catch(e){info.textContent='Erreur : '+(e.message||e)}
  btn.disabled=false;btn.textContent='🎯 Chercher des prospects';
}
function demDessiner(){
  const el=$('dem-map');if(!window.L||!el)return;
  if(_dem.map)_dem.map.remove();
  _dem.map=L.map(el).setView([_dem.centre.lat,_dem.centre.lon],13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'© OpenStreetMap'}).addTo(_dem.map);
  L.circle([_dem.centre.lat,_dem.centre.lon],{radius:_dem.rayon*1000,color:'#e65c28',weight:1,fillOpacity:.04}).addTo(_dem.map);
  L.marker([_dem.centre.lat,_dem.centre.lon]).addTo(_dem.map).bindTooltip('📍 '+_dem.centre.nom);
  _dem.couche=L.layerGroup().addTo(_dem.map);
  _dem.prospects.filter(p=>!_dem.filtre||(_dem.suivi[p.siret]?.statut||'a_demarcher')===_dem.filtre).forEach(p=>{
    const st=_dem.suivi[p.siret]?.statut||'a_demarcher';
    L.circleMarker([p.lat,p.lng],{radius:7,color:'#fff',weight:2,fillColor:DEM_STATUTS[st].col,fillOpacity:.95}).addTo(_dem.couche)
      .bindPopup(`<b>${_escD(p.nom)}</b><br>${_escD(p.adresse||'')}<br><a target="_blank" href="https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}">🧭 Itinéraire</a>`);
  });
  setTimeout(()=>_dem.map.invalidateSize(),150);
}
function demRendreListe(){
  const cnt={};_dem.prospects.forEach(p=>{const s=_dem.suivi[p.siret]?.statut||'a_demarcher';cnt[s]=(cnt[s]||0)+1});
  $('dem-filtre').innerHTML=`<button class="btn ${_dem.filtre?'btn-s':'btn-p'} btn-xs" onclick="demFiltrer('')">Tous (${_dem.prospects.length})</button>`+
    Object.entries(DEM_STATUTS).filter(([k])=>k!=='client').map(([k,v])=>`<button class="btn ${_dem.filtre===k?'btn-p':'btn-s'} btn-xs" onclick="demFiltrer('${k}')"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${v.col}"></span> ${v.lib} (${cnt[k]||0})</button>`).join('')+
    `<button class="btn ${_dem.filtre==='erp'?'btn-p':'btn-s'} btn-xs" onclick="demFiltrer('erp')">🏢 ERP (${_dem.prospects.filter(p=>_dem.suivi[p.siret]?.erp).length})</button>`;
  const l=_dem.prospects.filter(p=>!_dem.filtre||(_dem.filtre==='erp'?!!_dem.suivi[p.siret]?.erp:(_dem.suivi[p.siret]?.statut||'a_demarcher')===_dem.filtre));
  $('dem-liste').innerHTML=l.length?l.slice(0,150).map(p=>{const s=_dem.suivi[p.siret],st=s?.statut||'a_demarcher';return `<div onclick="if(!event.target.closest('button,a'))demFiche('${p.siret}')" style="cursor:pointer;background:#fff;border-radius:10px;border-left:5px solid ${DEM_STATUTS[st].col};padding:10px 12px;margin-bottom:8px">
    <div style="display:flex;justify-content:space-between;gap:8px"><b style="font-size:14px">${_escD(p.nom)}${s?.erp?' <span style="font-size:11px;background:#fef3c7;color:#92400e;border-radius:6px;padding:1px 6px;font-weight:700">ERP</span>':''}</b><span style="font-size:12px;color:var(--txt-l);white-space:nowrap">${p.dist.toFixed(1)} km</span></div>
    ${s?.contact_tel||s?.contact_email?`<div style="font-size:12.5px;margin-top:2px">👤 ${_escD(s.contact_nom||'')} ${s.contact_tel?`<a href="tel:${_escD(s.contact_tel)}" style="color:#2563eb;font-weight:600">${_escD(s.contact_tel)}</a>`:''} ${s.contact_email?_escD(s.contact_email):''}</div>`:''}
    ${s?.motif_refus?`<div style="font-size:12px;color:#6b7280;margin-top:2px">🚫 ${_escD(DEM_MOTIFS[s.motif_refus]||s.motif_refus)}</div>`:''}
    <div style="font-size:12.5px;color:var(--txt-l)">${_escD(p.adresse||'')}</div>
    <div style="font-size:12px;margin-top:2px">${_escD(DEM_SECTIONS[p.section]||'')} · NAF ${_escD(p.naf||'—')} · effectif ${_escD(DEM_EFFECTIF[p.effectif]||p.effectif)}</div>
    ${s?.prochain_rappel?`<div style="font-size:12px;margin-top:4px;color:${s.prochain_rappel<=demAujourdhui()?'#dc2626':'#2563eb'};font-weight:600">⏰ Rappel le ${new Date(s.prochain_rappel+'T12:00:00').toLocaleDateString('fr-FR')}${s.rappel_motif?' — '+_escD(s.rappel_motif):''}</div>`:''}
    ${s?.notes?`<div style="font-size:12px;background:#fffbeb;padding:5px 8px;border-radius:6px;margin-top:5px">📝 ${_escD(s.notes)}</div>`:''}
    <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">
      <a class="btn btn-s btn-xs" target="_blank" style="text-decoration:none" href="https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}">🧭 Y aller</a>
      <button class="btn ${st==='visite'?'btn-p':'btn-s'} btn-xs" onclick="demStatut('${p.siret}','visite')">Visité</button>
      <button class="btn ${st==='rdv'?'btn-p':'btn-s'} btn-xs" onclick="demStatut('${p.siret}','rdv')">RDV pris</button>
      <button class="btn ${st==='pas_interesse'?'btn-p':'btn-s'} btn-xs" onclick="demStatut('${p.siret}','pas_interesse')">Pas intéressé</button>
      <button class="btn btn-s btn-xs" onclick="demNote('${p.siret}')">📝 Note</button>
      <button class="btn btn-p btn-xs" onclick="demFiche('${p.siret}')">📋 Fiche / offre</button></div></div>`}).join('')+(l.length>150?`<div style="text-align:center;color:var(--txt-l);font-size:12px">… ${l.length-150} autres (réduis le rayon)</div>`:''):'<div style="text-align:center;color:var(--txt-l);padding:20px;font-size:13px">Aucun prospect</div>';
}
function demFiltrer(f){_dem.filtre=f;demDessiner();demRendreListe()}
async function demEnregistrer(siret,champs){
  const p=_dem.prospects.find(x=>x.siret===siret);
  const cur=_dem.suivi[siret]||{};
  const maj={derniere_action:new Date().toISOString(),...champs};
  let error;
  if(p){
    const row={siret,nom:p.nom,adresse:p.adresse,ville:p.ville,lat:p.lat,lng:p.lng,naf:p.naf,effectif:p.effectif,type_cible:'professionnel',statut:cur.statut||'a_demarcher',
      agence_id:ME?.agence_id||null,technicien_id:ME?.id||null,...maj};
    ({error}=await db.from('prospects').upsert(row,{onConflict:'siret'}));
  }else{
    ({error}=await db.from('prospects').update(maj).eq('siret',siret));
  }
  if(error){toast('Erreur : '+error.message,'err');return false}
  _dem.suivi[siret]={...cur,siret,statut:cur.statut||'a_demarcher',...maj};
  return true;
}
async function demStatut(siret,statut){
  const cur=_dem.suivi[siret]?.statut;const nouveau=cur===statut?'a_demarcher':statut;
  if(await demEnregistrer(siret,{statut:nouveau})){demDessiner();demRendreListe()}
}
async function demNote(siret){
  const n=prompt('Note (contact rencontré, besoin, à rappeler…) :',_dem.suivi[siret]?.notes||'');if(n===null)return;
  if(await demEnregistrer(siret,{notes:n.trim()||null}))demRendreListe();
}


// ============================================================
// CRM : suivi des prospects démarchés, historique et rappels
// ============================================================
const DEM_ACTIONS={appel:'📞 Appel',visite:'🚶 Visite',mail:'✉️ Mail',rdv:'📅 RDV',offre:'💶 Offre',note:'📝 Note'};
const demAujourdhui=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
const demDateFr=d=>d?new Date(String(d).slice(0,10)+'T12:00:00').toLocaleDateString('fr-FR'):'—';
const demJoursApres=n=>{const d=new Date();d.setDate(d.getDate()+n);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};

async function demAjouterAction(siret,type,resume){
  const {error}=await db.from('prospect_actions').insert({siret,type,resume:resume||null,par:ME?.id||null});
  if(error){toast('Erreur : '+error.message,'err');return false}
  return true;
}

// ---- Vue « Suivi & rappels » ----
async function demSuiviOuvrir(){
  const c=$('dem-corps');c.innerHTML='<div class="loading"><div class="spin spin-dark"></div></div>';
  let q=db.from('prospects').select('*').neq('statut','client').neq('statut','pas_interesse').or('prochain_rappel.not.is.null,statut.in.(visite,rdv,offre)').order('prochain_rappel',{ascending:true,nullsFirst:false}).limit(300);
  if(_dem.suiviMes!==false&&ME?.id)q=q.eq('technicien_id',ME.id);
  const {data,error}=await q;
  if(error){c.innerHTML='<div style="padding:16px;color:var(--txt-l)">Erreur : '+_escD(error.message)+'</div>';return}
  _dem.liste=data||[];demSuiviRendre();
}
function demSuiviCarte(p){
  const st=DEM_STATUTS[p.statut]||DEM_STATUTS.a_demarcher,auj=demAujourdhui();
  const retard=p.prochain_rappel&&p.prochain_rappel<auj;
  return `<div onclick="if(!event.target.closest('button,a'))demFiche('${p.siret}')" style="cursor:pointer;background:#fff;border-radius:10px;border-left:5px solid ${st.col};padding:10px 12px;margin-bottom:8px">
    <div style="display:flex;justify-content:space-between;gap:8px"><b style="font-size:14px">${_escD(p.nom)}${p.erp?' <span style="font-size:11px;background:#fef3c7;color:#92400e;border-radius:6px;padding:1px 6px;font-weight:700">ERP</span>':''}</b><span style="font-size:12px;color:${st.col};font-weight:600;white-space:nowrap">${st.lib}</span></div>
    <div style="font-size:12.5px;color:var(--txt-l)">${_escD([p.adresse,p.ville].filter(Boolean).join(' — '))}</div>
    ${p.contact_nom||p.contact_tel?`<div style="font-size:13px;margin-top:3px">👤 ${_escD(p.contact_nom||'')} ${p.contact_tel?`· <a href="tel:${_escD(p.contact_tel)}" style="color:#2563eb;font-weight:600">${_escD(p.contact_tel)}</a>`:''}</div>`:''}
    ${p.prochain_rappel?`<div style="font-size:12.5px;margin-top:3px;font-weight:600;color:${retard?'#dc2626':'#2563eb'}">⏰ ${retard?'En retard — ':''}${demDateFr(p.prochain_rappel)}${p.rappel_motif?' · '+_escD(p.rappel_motif):''}</div>`:''}
    ${p.derniere_action?`<div style="font-size:11.5px;color:var(--txt-l);margin-top:2px">Dernière action : ${demDateFr(p.derniere_action)}</div>`:''}
    <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">
      ${p.contact_tel?`<a class="btn btn-s btn-xs" style="text-decoration:none" href="tel:${_escD(p.contact_tel)}">📞 Appeler</a>`:''}
      <button class="btn btn-p btn-xs" onclick="demFiche('${p.siret}')">📋 Fiche / noter un appel</button></div></div>`;
}
function demSuiviRendre(){
  const c=$('dem-corps'),l=_dem.liste||[],auj=demAujourdhui(),sem=demJoursApres(7);
  const gr=[['⏰ En retard',l.filter(p=>p.prochain_rappel&&p.prochain_rappel<auj)],
    ["📅 Aujourd'hui",l.filter(p=>p.prochain_rappel===auj)],
    ['🗓️ Cette semaine',l.filter(p=>p.prochain_rappel&&p.prochain_rappel>auj&&p.prochain_rappel<=sem)],
    ['Plus tard',l.filter(p=>p.prochain_rappel&&p.prochain_rappel>sem)],
    ['⚠️ Contactés, sans rappel planifié',l.filter(p=>!p.prochain_rappel)]];
  c.innerHTML=`<div style="padding:14px">
    <div style="display:flex;gap:6px;margin-bottom:10px"><button class="btn ${_dem.suiviMes!==false?'btn-p':'btn-s'} btn-xs" onclick="_dem.suiviMes=true;demSuiviOuvrir()">Mes prospects</button><button class="btn ${_dem.suiviMes===false?'btn-p':'btn-s'} btn-xs" onclick="_dem.suiviMes=false;demSuiviOuvrir()">Toute l'équipe</button></div>
    ${l.length?gr.filter(g=>g[1].length).map(g=>`<div style="font-weight:700;margin:12px 0 6px">${g[0]} (${g[1].length})</div>${g[1].map(demSuiviCarte).join('')}`).join(''):'<div style="text-align:center;color:var(--txt-l);padding:24px;font-size:13px">Aucun prospect en suivi.<br>Depuis « Prospection », ouvre une fiche pour noter un contact et fixer un rappel.</div>'}</div>`;
}

// ---- Fiche prospect (coordonnées, statut, rappel, historique) ----
async function demFiche(siret){
  let {data:row}=await db.from('prospects').select('*').eq('siret',siret).maybeSingle();
  const p=_dem.prospects?.find(x=>x.siret===siret);
  if(!row&&p)row={siret,nom:p.nom,adresse:p.adresse,ville:p.ville,lat:p.lat,lng:p.lng,statut:'a_demarcher'};
  if(!row){toast('Prospect introuvable','err');return}
  _dem.suivi[siret]={..._dem.suivi[siret],...row};
  const {data:acts}=await db.from('prospect_actions').select('*,profils(prenom,nom)').eq('siret',siret).order('date_action',{ascending:false}).limit(50);
  let ov=$('dem-fiche');if(!ov){ov=document.createElement('div');ov.id='dem-fiche';ov.style.cssText='position:fixed;inset:0;background:#f3f4f6;z-index:9000;overflow:auto';document.body.appendChild(ov)}
  const inp='padding:9px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:14px;background:#fff;width:100%;box-sizing:border-box';
  const lab='font-size:12px;font-weight:600;display:block;margin:8px 0 3px';
  ov.innerHTML=`<div style="background:linear-gradient(135deg,#e65c28,#c2410c);color:#fff;padding:12px 14px;display:flex;align-items:center;gap:10px"><button onclick="demFicheFermer()" style="background:rgba(255,255,255,.2);border:none;color:#fff;padding:6px 12px;border-radius:8px;font-size:15px">←</button><b style="font-size:15px">${_escD(row.nom)}</b></div>
  <div style="padding:14px;max-width:640px;margin:0 auto">
    <div style="font-size:13px;color:var(--txt-l)">${_escD([row.adresse,row.ville].filter(Boolean).join(' — '))}${row.lat?` · <a target="_blank" href="https://www.google.com/maps/dir/?api=1&destination=${row.lat},${row.lng}">🧭 Itinéraire</a>`:''}</div>
    <div style="background:#fff;border-radius:10px;padding:12px;margin-top:10px">
      <label style="${lab};margin-top:0">Statut</label>
      <select id="df-statut" style="${inp}">${Object.entries(DEM_STATUTS).filter(([k])=>k!=='client').map(([k,v])=>`<option value="${k}"${row.statut===k?' selected':''}>${v.lib}</option>`).join('')}</select>
      <label style="display:flex;align-items:center;gap:8px;margin:10px 0 0;font-size:14px;font-weight:600"><input type="checkbox" id="df-erp" style="width:18px;height:18px"${row.erp?' checked':''}> 🏢 ERP (établissement recevant du public)</label>
      <label style="${lab}">🚫 Motif de refus</label>
      <select id="df-refus" style="${inp}"><option value="">— Aucun —</option>${Object.entries(DEM_MOTIFS).map(([k,v])=>`<option value="${k}"${row.motif_refus===k?' selected':''}>${v}</option>`).join('')}</select>
      <label style="${lab}">Contact (nom, fonction)</label><input id="df-cnom" style="${inp}" value="${_escD(row.contact_nom||'')}">
      <label style="${lab}">Téléphone</label><input id="df-ctel" type="tel" style="${inp}" value="${_escD(row.contact_tel||'')}">
      <label style="${lab}">Email</label><input id="df-cmail" type="email" style="${inp}" value="${_escD(row.contact_email||'')}">
      <label style="${lab}">⏰ Prochain rappel</label>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px"><button class="btn btn-s btn-xs" onclick="demRappelRapide(1)">Demain</button><button class="btn btn-s btn-xs" onclick="demRappelRapide(7)">+ 1 semaine</button><button class="btn btn-s btn-xs" onclick="demRappelRapide(30)">+ 1 mois</button><button class="btn btn-s btn-xs" onclick="demRappelRapide(0)">Aucun</button></div>
      <input id="df-rappel" type="date" style="${inp}" value="${row.prochain_rappel||''}">
      <input id="df-motif" style="${inp};margin-top:6px" placeholder="Motif du rappel (ex : relancer après l'offre)" value="${_escD(row.rappel_motif||'')}">
      <button class="btn btn-p" style="width:100%;margin-top:12px;padding:11px" onclick="demFicheSauver('${siret}')">💾 Enregistrer la fiche</button>
      ${typeof offreOuvrir==='function'&&typeof currentClient!=='undefined'?`<button class="btn btn-s" style="width:100%;margin-top:8px;padding:11px;background:#ede9fe;color:#5b21b6" onclick="demFicheOffre('${siret}')">💶 Faire une offre de prix</button>`:''}</div>
    <div style="background:#fff;border-radius:10px;padding:12px;margin-top:10px">
      <div style="font-weight:700;margin-bottom:6px">Noter une action</div>
      <select id="df-type" style="${inp}">${Object.entries(DEM_ACTIONS).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select>
      <textarea id="df-resume" rows="3" style="${inp};margin-top:6px" placeholder="Ce qui s'est dit, besoin exprimé, suite à donner…"></textarea>
      <button class="btn btn-s" style="width:100%;margin-top:8px;padding:10px" onclick="demFicheAction('${siret}')">➕ Ajouter à l'historique</button></div>
    <div style="font-weight:700;margin:14px 0 6px">Historique</div>
    ${(acts&&acts.length)?acts.map(a=>`<div style="background:#fff;border-radius:8px;padding:8px 10px;margin-bottom:6px;font-size:13px"><div style="display:flex;justify-content:space-between"><b>${DEM_ACTIONS[a.type]||a.type}</b><span style="color:var(--txt-l);font-size:12px">${demDateFr(a.date_action)}${a.profils?' · '+_escD((a.profils.prenom||'')+' '+(a.profils.nom||'')):''}</span></div>${a.resume?`<div style="margin-top:3px;white-space:pre-wrap">${_escD(a.resume)}</div>`:''}</div>`).join(''):'<div style="color:var(--txt-l);font-size:13px">Aucune action enregistrée.</div>'}
  </div>`;
}
function demRappelRapide(n){$('df-rappel').value=n?demJoursApres(n):''}
function demFicheFermer(){const ov=$('dem-fiche');if(ov)ov.remove();
  if(_dem.vue==='suivi')demSuiviOuvrir();else if($('dem-liste')){demDessiner();demRendreListe()}}
async function demFicheEnregistrer(siret){
  const refus=$('df-refus').value||null;
  // un motif de refus place automatiquement le prospect en « Pas intéressé »
  const statut=refus?'pas_interesse':$('df-statut').value;
  const ok=await demEnregistrer(siret,{statut,erp:$('df-erp').checked,motif_refus:refus,contact_nom:$('df-cnom').value.trim()||null,contact_tel:$('df-ctel').value.trim()||null,contact_email:$('df-cmail').value.trim()||null,
    prochain_rappel:$('df-rappel').value||null,rappel_motif:$('df-motif').value.trim()||null});
  if(ok)_dem.suivi[siret].statut=statut;
  return ok;
}
async function demFicheSauver(siret){
  if(await demFicheEnregistrer(siret)){toast('Fiche enregistrée ✓');await demFiche(siret)}
}
// Après la création d'une offre : le prospect correspondant passe en « Offre envoyée » (ou « Client » si le contrat est signé)
async function demApresOffre(client,contratSigne){
  if(!client?.siret)return;
  const {data:pr}=await db.from('prospects').select('siret,statut').eq('siret',client.siret).maybeSingle();
  if(!pr)return;
  const statut=contratSigne?'client':'offre';
  const {error}=await db.from('prospects').update({statut,derniere_action:new Date().toISOString()}).eq('siret',client.siret);
  if(error)return;
  if(_dem.suivi?.[client.siret])_dem.suivi[client.siret].statut=statut;
  await demAjouterAction(client.siret,'offre',contratSigne?'Offre signée + contrat de maintenance':'Offre de prix créée');
}
// Offre de prix depuis la fiche : le prospect devient (ou retrouve) une fiche client, puis l'écran d'offre s'ouvre
async function demFicheOffre(siret){
  if(!(await demFicheEnregistrer(siret)))return;
  const r=_dem.suivi[siret]||{};
  const p=_dem.prospects?.find(x=>x.siret===siret)||{};
  let {data:c}=await db.from('clients').select('*,agences(nom,code)').eq('siret',siret).eq('actif',true).limit(1).maybeSingle();
  if(!c){
    const ins={agence_id:ME?.agence_id||null,raison_sociale:r.nom||p.nom,adresse:r.adresse||p.adresse||null,ville:r.ville||p.ville||null,siret,
      contact_nom:r.contact_nom||null,contact_telephone:r.contact_tel||null,contact_email:r.contact_email||null,lat:r.lat??p.lat??null,lng:r.lng??p.lng??null,actif:true};
    const {data,error}=await db.from('clients').insert(ins).select('*,agences(nom,code)').single();
    if(error){toast('Création du client impossible : '+error.message,'err');return}
    c=data;
    await affecterNouveauClient(c.id);
  }
  if(r.contact_email&&!c.contact_email)c.contact_email=r.contact_email;
  if(r.contact_nom&&!c.contact_nom)c.contact_nom=r.contact_nom;
  if(r.contact_tel&&!c.contact_telephone)c.contact_telephone=r.contact_tel;
  currentClient=c;
  const ov=$('dem-fiche');if(ov)ov.remove();
  offreOuvrir();
}
async function demFicheAction(siret){
  const t=$('df-type').value,r=$('df-resume').value.trim();
  if(!r&&t==='note'){toast('Écris la note','err');return}
  // une action sur un prospect encore absent de la base : on le crée d'abord
  if(!(await demEnregistrer(siret,{statut:$('df-statut').value})))return;
  if(await demAjouterAction(siret,t,r)){
    // une visite / un RDV / une offre fait avancer automatiquement le statut s'il était « À démarcher »
    const auto={visite:'visite',rdv:'rdv',offre:'offre'}[t];
    if(auto&&$('df-statut').value==='a_demarcher')await demEnregistrer(siret,{statut:auto});
    toast('Action ajoutée ✓');await demFiche(siret);
  }
}

// Pastille « rappels du jour » pour l'accueil de l'appli commerciale
async function demRappelsBadge(){
  const el=document.getElementById('com-rappels-n');if(!el||typeof db==='undefined')return;
  try{
    let q=db.from('prospects').select('siret',{count:'exact',head:true}).lte('prochain_rappel',demAujourdhui()).not('prochain_rappel','is',null).neq('statut','client').neq('statut','pas_interesse');
    if(ME?.id)q=q.eq('technicien_id',ME.id);
    const {count}=await q;el.textContent=count?` (${count} à faire)`:'';el.style.color=count?'#dc2626':'';
  }catch(e){}
}
