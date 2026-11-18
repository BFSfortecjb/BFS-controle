// ============================================================
// BFS Contrôle — CARTE des échéances + suggestion de TOURNÉES (partagé bureau / terrain)
// Dépend de : db, ME, $, toast, fmt, geocoderAdresse (BC_catalogue.js), Leaflet (chargé à la demande)
// ============================================================
const CARTE_BASES={briec:{lat:48.0996,lon:-3.9998,nom:'Briec'},sevremont:{lat:46.7905,lon:-0.9330,nom:'Sévremont'}};
const CARTE_COEF_ROUTE=1.3;
const CARTE_PALETTE=['#e11d48','#2563eb','#16a34a','#d97706','#7c3aed','#0891b2','#be185d','#65a30d','#ea580c','#4f46e5','#0d9488','#a16207'];
const CARTE_MOIS=['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const CARTE_COULEUR_STATUT={'en retard':'#dc2626',urgent:'#ea580c',proche:'#d97706','à jour':'#16a34a'};
let _carte={map:null,couche:null,traces:null,clients:[],tournees:[],opts:{},root:''};

// ---------- Outils géographiques ----------
function carteKm(a,b){
  const R=6371,rad=x=>x*Math.PI/180,dLat=rad(b.lat-a.lat),dLon=rad((b.lon??b.lng)-(a.lon??a.lng));
  const s=Math.sin(dLat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.sqrt(s));
}
const _cp=c=>({lat:c.lat,lon:c.lon??c.lng});
function carteIdxMois(d){return d.getFullYear()*12+d.getMonth()}
// Itinéraire base -> clients -> base : plus proche voisin puis 2-opt. Retourne {ordre, km} (km routiers estimés)
function carteItineraire(base,pts){
  if(!pts.length)return {ordre:[],km:0};
  const rest=pts.slice(),ordre=[];let cur=base;
  while(rest.length){let bi=0,bd=Infinity;rest.forEach((p,i)=>{const d=carteKm(cur,_cp(p));if(d<bd){bd=d;bi=i}});cur=_cp(rest[bi]);ordre.push(rest.splice(bi,1)[0])}
  const len=o=>{let t=0,c=base;o.forEach(p=>{t+=carteKm(c,_cp(p));c=_cp(p)});return t+carteKm(c,base)};
  let best=len(ordre),amelio=true,n=0;
  while(amelio&&n++<30){amelio=false;
    for(let i=0;i<ordre.length-1;i++)for(let j=i+1;j<ordre.length;j++){
      const t=ordre.slice(0,i).concat(ordre.slice(i,j+1).reverse(),ordre.slice(j+1));const l=len(t);
      if(l+1e-6<best){best=l;ordre.splice(0,ordre.length,...t);amelio=true}
    }}
  return {ordre,km:best*CARTE_COEF_ROUTE};
}
// Algorithme de regroupement au mois près.
// clients : [{id,nom,lat,lng,echeance:Date,nbEquip}]. Chaque client doit être vu au plus tard dans le mois de son échéance ;
// il peut être avancé de `flexMois` mois pour rejoindre une tournée voisine. Les retards sont traités dès le premier mois.
function carteProposerTournees(clients,{base,rayonKm=15,flexMois=1,capacite=8,moisCourant}={}){
  const aujourdhui=moisCourant||carteIdxMois(new Date());
  const items=clients.filter(c=>c.lat!=null&&c.lng!=null&&c.echeance).map(c=>({...c,idx:Math.max(carteIdxMois(c.echeance),aujourdhui)}));
  const restants=new Set(items);const tournees=[];
  const mois=[...new Set(items.map(c=>c.idx))].sort((a,b)=>a-b);
  for(const M of mois){
    for(;;){
      const dus=[...restants].filter(c=>c.idx<=M);if(!dus.length)break;
      // la tournée est « tirée » par le client dû le plus éloigné de la base
      dus.sort((a,b)=>carteKm(base,_cp(b))-carteKm(base,_cp(a)));
      const graine=dus[0],groupe=[graine];restants.delete(graine);
      const cand=[...restants].filter(c=>c.idx<=M+flexMois).sort((a,b)=>carteKm(_cp(graine),_cp(a))-carteKm(_cp(graine),_cp(b)));
      for(const c of cand){if(groupe.length>=capacite)break;if(carteKm(_cp(graine),_cp(c))<=rayonKm){groupe.push(c);restants.delete(c)}}
      const it=carteItineraire(base,groupe);
      const indiv=groupe.reduce((s,c)=>s+2*carteKm(base,_cp(c))*CARTE_COEF_ROUTE,0);
      tournees.push({id:'T'+(tournees.length+1),mois:M,annee:Math.floor(M/12),moisNum:M%12,clients:it.ordre.map(c=>({...c,avance:Math.max(0,c.idx-M)})),
        km:Math.round(it.km),kmIndividuels:Math.round(indiv),gain:Math.max(0,Math.round(indiv-it.km)),nbEquip:groupe.reduce((s,c)=>s+(c.nbEquip||0),0)});
    }
  }
  return tournees;
}

// ---------- Données ----------
async function carteChargerLeaflet(){
  if(window.L)return;
  await new Promise((ok,ko)=>{
    const css=document.createElement('link');css.rel='stylesheet';css.href='https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';document.head.appendChild(css);
    const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';s.onload=ok;s.onerror=()=>ko(new Error('Leaflet indisponible (réseau ?)'));document.head.appendChild(s);
  });
}
async function carteDonnees({annee,mois,agence,tech,retards}){
  const deb=mois===''||mois==null?`${annee}-01-01`:`${annee}-${String(+mois+1).padStart(2,'0')}-01`;
  const finD=mois===''||mois==null?new Date(annee,12,0):new Date(annee,+mois+1,0);
  const fin=`${finD.getFullYear()}-${String(finD.getMonth()+1).padStart(2,'0')}-${String(finD.getDate()).padStart(2,'0')}`;
  let q=db.from('vue_echeances').select('client_id,raison_sociale,ville,date_prochaine_echeance,statut_echeance,agence_code,tech_id,equipement_id').lte('date_prochaine_echeance',fin);
  if(!retards)q=q.gte('date_prochaine_echeance',deb);
  if(agence)q=q.eq('agence_code',agence);
  if(tech)q=q.eq('tech_id',tech);
  const {data,error}=await q;if(error)throw error;
  const g={};
  (data||[]).forEach(e=>{
    if(!e.client_id||!e.date_prochaine_echeance)return;
    const c=g[e.client_id]||(g[e.client_id]={id:e.client_id,nom:e.raison_sociale,ville:e.ville,agence:e.agence_code,items:[],nbEquip:0,statut:'à jour',echeance:null});
    c.items.push(e);c.nbEquip++;
    const d=new Date(e.date_prochaine_echeance+'T12:00:00');if(!c.echeance||d<c.echeance)c.echeance=d;
    const rang={'en retard':0,urgent:1,proche:2,'à jour':3};if((rang[e.statut_echeance]??3)<(rang[c.statut]??3))c.statut=e.statut_echeance;
  });
  const ids=Object.keys(g);const infos={};
  for(let i=0;i<ids.length;i+=150){
    const {data:cl}=await db.from('clients').select('id,adresse,code_postal,ville,lat,lng,geocode_adresse,contact_telephone').in('id',ids.slice(i,i+150));
    (cl||[]).forEach(c=>infos[c.id]=c);
  }
  return ids.map(id=>{const c=g[id],i=infos[id]||{};const adr=[i.adresse,i.code_postal,i.ville].filter(Boolean).join(' ');
    return {...c,adresse:adr,lat:i.lat,lng:i.lng,tel:i.contact_telephone,aGeocoder:!i.lat||!i.lng||i.geocode_adresse!==adr}});
}
async function carteGeocoder(liste,onProgress){
  let ok=0,i=0;
  for(const c of liste){
    i++;onProgress&&onProgress(i,liste.length);
    if(!c.adresse)continue;
    const g=await geocoderAdresse(c.adresse);
    if(g){const {error}=await db.rpc('enregistrer_geocodage_client',{p_id:c.id,p_lat:g.lat,p_lng:g.lon,p_adresse:c.adresse});
      if(!error){c.lat=g.lat;c.lng=g.lon;c.aGeocoder=false;ok++}}
    await new Promise(r=>setTimeout(r,60));
  }
  return ok;
}
// Création des RDV d'une tournée (un RDV par client, à la suite)
async function carteCreerRdvTournee(tournee,{date,techId,heure='08:30',duree=60}){
  const [h,m]=heure.split(':').map(Number);let t=h*60+m;const rows=[];
  tournee.clients.forEach(c=>{
    rows.push({client_id:c.id,technicien_id:techId||null,date_rdv:date,heure_debut:String(Math.floor(t/60)).padStart(2,'0')+':'+String(t%60).padStart(2,'0'),duree_minutes:duree,
      type_intervention:'vérification extincteurs',statut:'planifié',notes:'Tournée groupée '+CARTE_MOIS[tournee.moisNum]+' '+tournee.annee+' ('+tournee.id+')',cree_par:ME?.id||null});
    t+=duree+20;
  });
  const {error}=await db.from('rdv').insert(rows);if(error)throw error;return rows.length;
}

// ---------- Interface (identique bureau / terrain) ----------
const _escC=s=>String(s??'').replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
async function carteMonter(rootId,opts={}){
  _carte.opts=opts;_carte.root=rootId;
  const root=$(rootId);if(!root)return;
  const an=new Date().getFullYear(),moisC=new Date().getMonth();
  let techOpts='';
  if(opts.choixTech){const {data}=await db.from('profils').select('id,prenom,nom').eq('actif',true).order('nom');techOpts=(data||[]).map(p=>`<option value="${p.id}">${_escC((p.prenom||'')+' '+p.nom)}</option>`).join('');_carte.techs=data||[]}
  const sel='padding:7px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:13px;background:#fff';
  root.innerHTML=`
  <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:10px">
    <select id="cr-annee" style="${sel}">${[an-1,an,an+1,an+2].map(a=>`<option value="${a}"${a===an?' selected':''}>${a}</option>`).join('')}</select>
    <select id="cr-mois" style="${sel}"><option value="">Toute l'année</option>${CARTE_MOIS.map((m,i)=>`<option value="${i}"${i===moisC?' selected':''}>${m}</option>`).join('')}</select>
    ${opts.choixAgence?`<select id="cr-agence" style="${sel}"><option value="">Toutes agences</option><option value="briec">Briec</option><option value="sevremont">Sévremont</option></select>`:''}
    ${opts.choixTech?`<select id="cr-tech" style="${sel}"><option value="">Tous techniciens</option>${techOpts}</select>`:''}
    <label style="font-size:13px"><input type="checkbox" id="cr-retards" checked> inclure les retards</label>
    <button class="btn btn-p btn-sm" onclick="carteAfficher()">🔄 Afficher</button>
    <button class="btn btn-s btn-sm" id="cr-btn-geo" onclick="carteGeocoderTout()" style="display:none">📍 Localiser les adresses</button>
  </div>
  <div id="cr-info" style="font-size:12.5px;color:var(--txt-l);margin-bottom:8px"></div>
  <div id="cr-map" style="height:${opts.hauteur||420}px;border-radius:10px;border:1px solid #e5e7eb;background:#f3f4f6"></div>
  <div id="cr-legende" style="font-size:12px;margin:8px 0;display:flex;gap:12px;flex-wrap:wrap"></div>
  <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:10px 12px;margin-top:10px">
    <div style="font-weight:700;margin-bottom:6px">🧭 Regrouper les passages</div>
    <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;font-size:13px">
      <label>Rayon <input type="number" id="cr-rayon" value="15" min="3" max="80" style="width:60px;${sel}"> km</label>
      <label>Avancer jusqu'à <input type="number" id="cr-flex" value="1" min="0" max="3" style="width:50px;${sel}"> mois</label>
      <label>Clients / jour <input type="number" id="cr-cap" value="8" min="2" max="20" style="width:55px;${sel}"></label>
      <button class="btn btn-p btn-sm" onclick="carteSuggerer()">Suggérer des tournées</button>
    </div>
    <div style="font-size:11.5px;color:var(--txt-l);margin-top:6px">Chaque client reste vu au plus tard le mois de son échéance ; il peut être avancé de quelques mois pour rejoindre une tournée voisine. Distances routières estimées (à vol d'oiseau × 1,3).</div>
  </div>
  <div id="cr-tournees" style="margin-top:10px"></div>`;
  await carteAfficher();
}
function _carteFiltres(){
  return {annee:+$('cr-annee').value,mois:$('cr-mois').value,agence:$('cr-agence')?$('cr-agence').value:(_carte.opts.agenceFixe||''),tech:$('cr-tech')?$('cr-tech').value:(_carte.opts.techFixe||''),retards:$('cr-retards').checked};
}
async function carteAfficher(){
  const info=$('cr-info');info.textContent='Chargement…';
  try{
    await carteChargerLeaflet();
    _carte.clients=await carteDonnees(_carteFiltres());
  }catch(e){info.textContent='Erreur : '+(e.message||e);return}
  const nb=_carte.clients.length,aGeo=_carte.clients.filter(c=>c.aGeocoder).length;
  $('cr-btn-geo').style.display=aGeo?'inline-flex':'none';$('cr-btn-geo').textContent=`📍 Localiser ${aGeo} adresse${aGeo>1?'s':''}`;
  info.textContent=nb?`${nb} client${nb>1?'s':''} · ${_carte.clients.reduce((s,c)=>s+c.nbEquip,0)} équipements`+(aGeo?` · ${aGeo} à localiser`:''):'Aucune échéance sur cette période';
  carteDessiner();
}
async function carteGeocoderTout(){
  const l=_carte.clients.filter(c=>c.aGeocoder);const b=$('cr-btn-geo');b.disabled=true;
  const ok=await carteGeocoder(l,(i,n)=>{b.textContent=`📍 ${i}/${n}…`});
  b.disabled=false;toast(ok+' adresse(s) localisée(s)');carteAfficher();
}
function carteDessiner(tourneeSel){
  const el=$('cr-map');if(!window.L||!el)return;
  if(!_carte.map||_carte.map._container!==el){
    if(_carte.map)_carte.map.remove();
    _carte.map=L.map(el).setView([48.1,-3.9],8);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'© OpenStreetMap'}).addTo(_carte.map);
  }
  if(_carte.couche)_carte.couche.remove();if(_carte.traces)_carte.traces.remove();
  _carte.couche=L.layerGroup().addTo(_carte.map);_carte.traces=L.layerGroup().addTo(_carte.map);
  const moisChoisi=$('cr-mois').value!=='',pts=[];
  const couleurTournee={};(_carte.tournees||[]).forEach(t=>t.clients.forEach(c=>couleurTournee[c.id]={col:CARTE_PALETTE[(+t.id.slice(1)-1)%CARTE_PALETTE.length],t}));
  Object.values(CARTE_BASES).forEach(b=>L.marker([b.lat,b.lon],{title:b.nom}).addTo(_carte.couche).bindTooltip('🏢 '+b.nom));
  _carte.clients.filter(c=>c.lat!=null).forEach(c=>{
    const tt=couleurTournee[c.id];
    const col=tt?tt.col:(moisChoisi?(CARTE_COULEUR_STATUT[c.statut]||'#2563eb'):CARTE_PALETTE[c.echeance.getMonth()]);
    const m=L.circleMarker([c.lat,c.lng],{radius:8,color:'#fff',weight:2,fillColor:col,fillOpacity:.95}).addTo(_carte.couche);
    const tel=c.tel?`<br>📞 <a href="tel:${_escC(c.tel.replace(/\s/g,''))}">${_escC(c.tel)}</a>`:'';
    m.bindPopup(`<b>${_escC(c.nom)}</b><br>${_escC(c.adresse)}<br>${c.nbEquip} équip. · échéance ${fmt(c.echeance)}${tel}<br><a target="_blank" href="https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lng}">🧭 Itinéraire</a>${_carte.opts.ouvrirClient?`<br><a href="#" onclick="${_carte.opts.ouvrirClient}('${c.id}');return false">Ouvrir la fiche</a>`:''}`);
    pts.push([c.lat,c.lng]);
  });
  if(tourneeSel){const base=CARTE_BASES[tourneeSel.base]||CARTE_BASES.briec;
    const ligne=[[base.lat,base.lon],...tourneeSel.clients.map(c=>[c.lat,c.lng]),[base.lat,base.lon]];
    L.polyline(ligne,{color:'#111',weight:3,dashArray:'6 6'}).addTo(_carte.traces);
    tourneeSel.clients.forEach((c,i)=>L.marker([c.lat,c.lng],{icon:L.divIcon({className:'',html:`<div style="background:#111;color:#fff;border-radius:50%;width:20px;height:20px;text-align:center;font-size:11px;line-height:20px;margin:-10px 0 0 -10px">${i+1}</div>`})}).addTo(_carte.traces));
    _carte.map.fitBounds(ligne,{padding:[30,30]});
  }else if(pts.length)_carte.map.fitBounds(pts,{padding:[30,30],maxZoom:11});
  setTimeout(()=>_carte.map.invalidateSize(),150);
  $('cr-legende').innerHTML=moisChoisi&&!(_carte.tournees||[]).length
    ?Object.entries(CARTE_COULEUR_STATUT).map(([k,v])=>`<span><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${v}"></span> ${k}</span>`).join('')
    :(!moisChoisi&&!(_carte.tournees||[]).length?CARTE_MOIS.map((m,i)=>`<span><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${CARTE_PALETTE[i]}"></span> ${m.slice(0,4)}.</span>`).join(''):'<span>Couleur = tournée suggérée</span>');
}
function carteBaseDe(clients){
  const ag=(_carte.opts.agenceFixe||($('cr-agence')&&$('cr-agence').value)||clients[0]?.agence||'briec');
  return {code:ag,...(CARTE_BASES[ag]||CARTE_BASES.briec)};
}
function carteSuggerer(){
  const f=_carteFiltres();
  const cl=_carte.clients.filter(c=>c.lat!=null);
  if(!cl.length){toast('Aucun client localisé sur la carte','err');return}
  const base=carteBaseDe(cl);
  // Groupes par agence si « toutes agences » : une tournée part de la base de l'agence du client
  const parAg={};cl.forEach(c=>{(parAg[c.agence||base.code]=parAg[c.agence||base.code]||[]).push(c)});
  let tournees=[];
  Object.entries(parAg).forEach(([ag,liste])=>{
    const b=CARTE_BASES[ag]||CARTE_BASES.briec;
    carteProposerTournees(liste,{base:b,rayonKm:+$('cr-rayon').value||15,flexMois:+$('cr-flex').value||0,capacite:+$('cr-cap').value||8}).forEach(t=>{t.base=ag;tournees.push(t)});
  });
  tournees.sort((a,b)=>a.mois-b.mois);tournees.forEach((t,i)=>t.id='T'+(i+1));
  _carte.tournees=tournees;
  const totalGain=tournees.reduce((s,t)=>s+t.gain,0),totalIndiv=tournees.reduce((s,t)=>s+t.kmIndividuels,0);
  const techSel=_carte.opts.choixTech?`<select id="crt-tech" style="padding:6px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:12.5px">${(_carte.techs||[]).map(p=>`<option value="${p.id}">${_escC((p.prenom||'')+' '+p.nom)}</option>`).join('')}</select>`:'';
  $('cr-tournees').innerHTML=`<div style="font-weight:700;margin-bottom:6px">${tournees.length} tournée${tournees.length>1?'s':''} suggérée${tournees.length>1?'s':''} — environ <span style="color:#16a34a">${totalGain} km économisés</span> sur ${totalIndiv} km (${totalIndiv?Math.round(100*totalGain/totalIndiv):0} %)</div>
    ${tournees.map(t=>{const col=CARTE_PALETTE[(+t.id.slice(1)-1)%CARTE_PALETTE.length];return `<div style="border:1px solid #e5e7eb;border-left:5px solid ${col};border-radius:10px;padding:10px 12px;margin-bottom:8px;background:#fff">
      <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><b>${t.id} — ${CARTE_MOIS[t.moisNum]} ${t.annee}</b><span style="font-size:12.5px">${t.clients.length} clients · ${t.nbEquip} équip. · ~${t.km} km · <span style="color:#16a34a">−${t.gain} km</span></span></div>
      <ol style="margin:6px 0 8px 18px;font-size:12.5px">${t.clients.map(c=>`<li>${_escC(c.nom)} <span style="color:var(--txt-l)">(${_escC(c.ville||'')}${c.avance?` · avancé de ${c.avance} mois`:''}${c.statut==='en retard'?' · EN RETARD':''})</span></li>`).join('')}</ol>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><button class="btn btn-s btn-xs" onclick="carteVoirTournee('${t.id}')">🗺️ Voir</button>
        <input type="date" id="crt-date-${t.id}" style="padding:6px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:12.5px" value="${t.annee}-${String(t.moisNum+1).padStart(2,'0')}-${String(Math.min(new Date().getDate()+1,28)).padStart(2,'0')}">
        ${techSel}<button class="btn btn-p btn-xs" onclick="cartePlanifier('${t.id}')">📅 Planifier les RDV</button></div></div>`}).join('')}`;
  carteDessiner();
}
function carteVoirTournee(id){const t=_carte.tournees.find(x=>x.id===id);if(t)carteDessiner(t);window.scrollTo&&$('cr-map').scrollIntoView&&$('cr-map').scrollIntoView({behavior:'smooth',block:'center'})}
async function cartePlanifier(id){
  const t=_carte.tournees.find(x=>x.id===id);if(!t)return;
  const date=$('crt-date-'+id).value;if(!date){toast('Choisis une date','err');return}
  const techId=_carte.opts.choixTech?($('crt-tech')?.value||null):(ME?.id||null);
  if(!confirm(`Créer ${t.clients.length} RDV le ${fmt(date)} (un par client, à la suite) ?`))return;
  try{const n=await carteCreerRdvTournee(t,{date,techId});toast(n+' RDV créés ✓')}catch(e){toast('Erreur : '+(e.message||e),'err')}
}
