// ============================================================
// BFS Contrôle — LOCATIONS d'extincteurs (stock tampon)
// Tables : locations, locations_lignes, grille_location
// ============================================================
let _locations=[],_locGrille=[],_locUnites=[],_grilleMode='mensuel',_locType='longue_duree';
const _GT=()=>_grilleMode==='jour'?'grille_location_evenement':'grille_location';
const _GF=()=>_grilleMode==='jour'?'prix_jour_ht':'loyer_mensuel_ht';
const STATUT_LOC={brouillon:'📝 À signer',en_cours:'🟢 En cours',terminee:'⚪ Terminée',annulee:'⛔ Annulée'};
const _eurL=n=>(+n||0).toLocaleString('fr-FR',{style:'currency',currency:'EUR'});
const _escL=s=>String(s??'').replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));

async function loadLocations(){
  const el=$('tbl-locations');if(!el)return;
  if(!clients.length)await loadClients();
  const {data,error}=await db.from('locations').select('*,clients(raison_sociale),agences(nom,code),locations_lignes(id,loyer_mensuel_ht,prix_jour_ht,date_retour)').order('created_at',{ascending:false});
  if(error){el.innerHTML='<div class="t-empty">Erreur : '+_escL(error.message)+'</div>';return}
  _locations=data||[];renderLocations();
}
function renderLocations(){
  const el=$('tbl-locations');if(!el)return;
  const q=($('q-locations')?.value||'').toLowerCase(),fs=$('f-statut-loc')?.value||'';
  const data=_locations.filter(l=>((l.numero||'')+(l.clients?.raison_sociale||'')).toLowerCase().includes(q)&&(!fs||l.statut===fs));
  if(!data.length){el.innerHTML='<div class="t-empty">Aucune location</div>';return}
  el.innerHTML=`<table><thead><tr><th>N°</th><th>Client</th><th>Début</th><th>Appareils</th><th>Montant HT</th><th>Statut</th><th>Actions</th></tr></thead><tbody>${data.map(l=>{
    const ls=l.locations_lignes||[],actifs=ls.filter(x=>!x.date_retour);
    const ev=l.type_location==='evenement',nj=ev?_nbJoursLoc(l):0;
    const loyer=ev?ls.reduce((s,x)=>s+(+x.prix_jour_ht||0)*nj,0)+(+l.livraison_ht||0)+(+l.technicien_jours||0)*(+l.technicien_tarif_jour_ht||0):actifs.reduce((s,x)=>s+(+x.loyer_mensuel_ht||0),0);
    return `<tr><td><b>${_escL(l.numero)}</b>${ev?'<br><span style="font-size:11px;color:var(--txt-l)">🎪 '+_escL(l.evenement_nom)+'</span>':''}</td><td>${_escL(l.clients?.raison_sociale)}</td><td>${fmt(l.date_debut)}</td>
    <td>${actifs.length}${ls.length!==actifs.length?` <span style="color:var(--txt-l)">(+${ls.length-actifs.length} rendu${ls.length-actifs.length>1?'s':''})</span>`:''}</td>
    <td style="text-align:right">${_eurL(loyer)}${ev?'':' /mois'}</td><td>${STATUT_LOC[l.statut]||l.statut}</td>
    <td><div class="ia"><button class="btn btn-s btn-xs" onclick="exportLocationPDF('${l.id}')" title="Contrat de location PDF">📄</button>
    <button class="btn btn-s btn-xs" onclick="ouvrirLocation('${l.id}')">Détail</button></div></td></tr>`}).join('')}</tbody></table>`;
}

const _nbJoursLoc=l=>l.date_fin_prevue?Math.round((new Date(l.date_fin_prevue)-new Date(l.date_debut))/864e5)+1:1;

// ---------- Grille de tarifs ----------
async function chargerGrilleLocation(){
  const {data}=await db.from(_GT()).select('*').order('agent_code').order('capacite_valeur');
  _locGrille=data||[];return _locGrille;
}
const _prixGrille=u=>_locGrille.find(g=>g.agent_code===u.agent_code&&+g.capacite_valeur===+u.capacite_valeur)||null;
async function ouvrirGrilleLocation(mode){
  _grilleMode=mode||'mensuel';
  OM('mo-grille-location');await chargerGrilleLocation();renderGrilleLocation();
}
function renderGrilleLocation(){
  const droit=peutGererTarifs();
  const lignes=_locGrille.map(g=>`<tr><td>${_escL(g.agent_code)}</td><td>${g.capacite_valeur}</td>
    <td style="text-align:right">${droit?`<input type="number" step="0.01" min="0" id="gl-l-${g.id}" value="${(+g[_GF()]).toFixed(2)}" style="width:80px;text-align:right">`:(+g[_GF()]).toFixed(2)} €</td>
    <td style="text-align:right">${droit?`<input type="number" step="0.01" min="0" id="gl-v-${g.id}" value="${g.valeur_remplacement_ht!=null?(+g.valeur_remplacement_ht).toFixed(2):''}" style="width:80px;text-align:right">`:(g.valeur_remplacement_ht!=null?(+g.valeur_remplacement_ht).toFixed(2):'—')} €</td>
    <td>${droit?`<button class="btn btn-s btn-xs" onclick="saveLigneGrilleLoc('${g.id}')">💾</button><button class="btn btn-s btn-xs" onclick="supprimerLigneGrilleLoc('${g.id}')">🗑</button>`:''}</td></tr>`).join('');
  const ajout=droit?`<tr><td><input id="gl-n-agent" list="gl-agents" placeholder="AB" style="width:70px;text-transform:uppercase"><datalist id="gl-agents">${[...new Set(uniteExtincteurs.map(u=>u.agent_code))].map(a=>`<option value="${a}">`).join('')}</datalist></td>
    <td><input id="gl-n-cap" type="number" step="0.1" min="0" placeholder="6" style="width:60px"></td>
    <td style="text-align:right"><input id="gl-n-loyer" type="number" step="0.01" min="0" style="width:80px;text-align:right"> €</td>
    <td style="text-align:right"><input id="gl-n-val" type="number" step="0.01" min="0" style="width:80px;text-align:right"> €</td>
    <td><button class="btn btn-p btn-xs" onclick="ajouterLigneGrilleLoc()">+ Ajouter</button></td></tr>`:'';
  const jour=_grilleMode==='jour';
  $('grille-location-corps').innerHTML=`<div style="display:flex;gap:8px;margin-bottom:10px"><button class="ag-tab ${jour?'':'active'}" onclick="ouvrirGrilleLocation('mensuel')">Location longue durée (€/mois)</button><button class="ag-tab ${jour?'active':''}" onclick="ouvrirGrilleLocation('jour')">Événementiel (€/jour)</button></div><table><thead><tr><th>Agent</th><th>Capacité</th><th style="text-align:right">${jour?'Prix HT / jour':'Loyer HT / mois'}</th><th style="text-align:right">Valeur de remplacement HT</th><th></th></tr></thead><tbody>${lignes||'<tr><td colspan="5" class="t-empty">Aucun tarif — ajoute le premier ci-dessous</td></tr>'}${ajout}</tbody></table>${droit?'':'<div style="font-size:12px;color:var(--txt-l);margin-top:8px">Modification réservée aux profils « gestion des tarifs ».</div>'}`;
}
async function saveLigneGrilleLoc(id){
  const l=parseFloat($('gl-l-'+id).value),v=$('gl-v-'+id).value===''?null:parseFloat($('gl-v-'+id).value);
  if(isNaN(l)||l<0){toast('Loyer invalide','err');return}
  const {error}=await db.from(_GT()).update({[_GF()]:l,valeur_remplacement_ht:v,updated_at:new Date().toISOString()}).eq('id',id);
  if(error){toast('Erreur : '+error.message,'err');return}
  toast('Tarif enregistré');await chargerGrilleLocation();renderGrilleLocation();
}
async function ajouterLigneGrilleLoc(){
  const agent=$('gl-n-agent').value.trim().toUpperCase(),cap=parseFloat($('gl-n-cap').value),l=parseFloat($('gl-n-loyer').value),v=$('gl-n-val').value===''?null:parseFloat($('gl-n-val').value);
  if(!agent||isNaN(cap)||isNaN(l)){toast('Agent, capacité et loyer obligatoires','err');return}
  const {error}=await db.from(_GT()).insert({agent_code:agent,capacite_valeur:cap,[_GF()]:l,valeur_remplacement_ht:v});
  if(error){toast(/duplicate|unique/i.test(error.message)?'Ce couple agent / capacité existe déjà':'Erreur : '+error.message,'err');return}
  await chargerGrilleLocation();renderGrilleLocation();
}
async function supprimerLigneGrilleLoc(id){
  if(!confirm('Supprimer ce tarif ? (les locations existantes gardent leur prix)'))return;
  const {error}=await db.from(_GT()).delete().eq('id',id);
  if(error){toast('Erreur : '+error.message,'err');return}
  await chargerGrilleLocation();renderGrilleLocation();
}

// ---------- Création ----------
async function ouvrirNouvelleLocation(type){
  _locType=type||'longue_duree';_grilleMode=_locType==='evenement'?'jour':'mensuel';
  if(!clients.length)await loadClients();
  await chargerGrilleLocation();
  if(typeof uniteExtincteurs==='undefined'||!uniteExtincteurs.length)await chargerUnitesExtincteurs();
  if(!(typeof _stockAgences!=='undefined'&&_stockAgences&&_stockAgences.length)){const {data:ags}=await db.from('agences').select('*');window._locAgences=ags||[]}else window._locAgences=_stockAgences;
  $('loc-ag').innerHTML=window._locAgences.map(a=>`<option value="${a.id}">${_escL(a.nom)}</option>`).join('');
  $('loc-client').innerHTML='<option value="">Sélectionner…</option>'+clients.map(c=>`<option value="${c.id}">${_escL(c.raison_sociale)}</option>`).join('');
  $('loc-debut').value=new Date().toISOString().slice(0,10);$('loc-duree').value=12;$('loc-depot').value=0;$('loc-notes').value='';
  $('loc-ag').value=ME?.agence_id||'';
  const ev=_locType==='evenement';
  $('mo-location-titre').textContent=ev?'🎪 Nouvelle location événementielle':'🔁 Nouvelle location';
  $('loc-bloc-long').style.display=ev?'none':'';$('loc-bloc-evt').style.display=ev?'':'none';
  ['loc-evt-nom','loc-evt-lieu'].forEach(i=>$(i).value='');$('loc-evt-fin').value=$('loc-debut').value;
  $('loc-evt-livraison').value=0;$('loc-evt-tech-j').value=0;$('loc-evt-tech-t').value=0;$('loc-evt-recharge').value=60;
  renderUnitesLouables();OM('mo-location');
}
function renderUnitesLouables(){
  const ag=$('loc-ag').value;
  _locUnites=uniteExtincteurs.filter(u=>u.statut==='en_atelier_revise'&&poolUnite(u)==='echange_location'&&(!ag||u.agence_id===ag));
  const el=$('loc-unites');
  if(!_locUnites.length){el.innerHTML='<div class="t-empty">Aucun extincteur tampon « révisé — prêt » disponible pour cette agence</div>';return}
  el.innerHTML=`<table><thead><tr><th></th><th>Identification</th><th>Appareil</th><th style="text-align:right">${_locType==='evenement'?'Prix HT / jour':'Loyer HT / mois'}</th></tr></thead><tbody>${_locUnites.map(u=>{
    const g=_prixGrille(u);
    return `<tr><td><input type="checkbox" class="loc-chk" value="${u.id}"></td><td><b>${_escL(u.identification)}</b></td>
    <td>${u.capacite_valeur} ${u.capacite_unite||''} · ${_escL(u.agent_code)}</td>
    <td style="text-align:right"><input type="number" step="0.01" min="0" id="loc-p-${u.id}" value="${g?(+g[_GF()]).toFixed(2):''}" placeholder="?" style="width:80px;text-align:right"${g?' readonly title="Tarif de la grille"':''}> €${g?'':' <span style="color:#b45309;font-size:11px">hors grille</span>'}</td></tr>`}).join('')}</tbody></table>`;
}
async function saveLocation(){
  const client=$('loc-client').value,ag=$('loc-ag').value;
  const ids=[...document.querySelectorAll('.loc-chk:checked')].map(c=>c.value);
  if(!client||!ag){toast('Client et agence obligatoires','err');return}
  if(!ids.length){toast('Coche au moins un extincteur','err');return}
  const lignes=[];
  for(const id of ids){
    const u=_locUnites.find(x=>x.id===id),p=parseFloat($('loc-p-'+id).value);
    if(isNaN(p)||p<0){toast('Loyer manquant pour '+u.identification,'err');return}
    const g=_prixGrille(u);
    lignes.push(_locType==='evenement'?{unite_id:id,loyer_mensuel_ht:0,prix_jour_ht:p,valeur_remplacement_ht:g?.valeur_remplacement_ht??null}:{unite_id:id,loyer_mensuel_ht:p,valeur_remplacement_ht:g?.valeur_remplacement_ht??null});
  }
  const ev=_locType==='evenement';
  if(ev&&(!$('loc-evt-nom').value.trim()||!$('loc-evt-fin').value||$('loc-evt-fin').value<$('loc-debut').value)){toast('Nom de l\'événement et dates valides obligatoires','err');return}
  const {data:num,error:en}=await db.rpc('prochain_numero_location');
  if(en){toast('Erreur numéro : '+en.message,'err');return}
  const {data:loc,error}=await db.from('locations').insert({numero:num,client_id:client,agence_id:ag,date_debut:$('loc-debut').value,duree_minimale_mois:ev?1:(parseInt($('loc-duree').value)||12),depot_garantie:parseFloat($('loc-depot').value)||0,notes:$('loc-notes').value.trim()||null,
    ...(ev?{type_location:'evenement',evenement_nom:$('loc-evt-nom').value.trim(),evenement_lieu:$('loc-evt-lieu').value.trim()||null,date_fin_prevue:$('loc-evt-fin').value,livraison_ht:parseFloat($('loc-evt-livraison').value)||0,technicien_jours:parseFloat($('loc-evt-tech-j').value)||0,technicien_tarif_jour_ht:parseFloat($('loc-evt-tech-t').value)||0,recharge_apres_usage_ht:parseFloat($('loc-evt-recharge').value)||null}:{})}).select().single();
  if(error){toast('Erreur : '+error.message,'err');return}
  const {error:el}=await db.from('locations_lignes').insert(lignes.map(l=>({...l,location_id:loc.id})));
  if(el){await db.from('locations').delete().eq('id',loc.id);toast('Erreur lignes : '+el.message,'err');return}
  CM('mo-location');toast('Location '+num+' créée — à faire signer');await loadLocations();exportLocationPDF(loc.id);
}

// ---------- Détail / activation / retour ----------
async function ouvrirLocation(id){
  OM('mo-location-detail');
  $('loc-detail-corps').innerHTML='<div class="loading"><span class="spin"></span></div>';
  const {data:l}=await db.from('locations').select('*,clients(raison_sociale),locations_lignes(*,extincteurs_unites(identification,capacite_valeur,capacite_unite,agent_code))').eq('id',id).single();
  if(!l){$('loc-detail-corps').innerHTML='<div class="t-empty">Introuvable</div>';return}
  const ls=l.locations_lignes||[];
  $('loc-detail-titre').textContent=`Location ${l.numero} — ${l.clients?.raison_sociale||''}`;
  const actions=l.statut==='brouillon'
    ?`<button class="btn btn-p" onclick="activerLocation('${l.id}')">✅ Contrat signé — remettre le matériel</button> <button class="btn btn-s" onclick="annulerLocation('${l.id}')">Annuler</button>`
    :l.statut==='en_cours'?`<span style="font-size:12.5px;color:var(--txt-l)">Retour appareil par appareil ci-dessous.</span>`:'';
  $('loc-detail-corps').innerHTML=`<div style="font-size:13px;margin-bottom:10px">${l.type_location==='evenement'?`🎪 <b>${_escL(l.evenement_nom)}</b> · du <b>${fmt(l.date_debut)}</b> au <b>${fmt(l.date_fin_prevue)}</b> (${_nbJoursLoc(l)} j)`:`Début : <b>${fmt(l.date_debut)}</b> · Durée minimale : <b>${l.duree_minimale_mois} mois</b>`} · Dépôt de garantie : <b>${_eurL(l.depot_garantie)}</b> · ${STATUT_LOC[l.statut]}</div>
  <table><thead><tr><th>Identification</th><th>Appareil</th><th style="text-align:right">${l.type_location==='evenement'?'Prix HT / jour':'Loyer HT / mois'}</th><th>Retour</th></tr></thead><tbody>${ls.map(x=>`<tr><td><b>${_escL(x.extincteurs_unites?.identification)}</b></td>
    <td>${x.extincteurs_unites?.capacite_valeur||''} ${x.extincteurs_unites?.capacite_unite||''} · ${_escL(x.extincteurs_unites?.agent_code)}</td>
    <td style="text-align:right">${_eurL(l.type_location==='evenement'?x.prix_jour_ht:x.loyer_mensuel_ht)}</td>
    <td>${x.date_retour?`Rendu le ${fmt(x.date_retour)}${x.etat_retour?' — '+_escL(x.etat_retour):''}`:(l.statut==='en_cours'?`<button class="btn btn-s btn-xs" onclick="retourLocation('${l.id}','${x.id}','${x.unite_id}')">↩ Retour</button>`:'—')}</td></tr>`).join('')}</tbody></table>
  <div style="margin-top:12px">${actions}</div>`;
}
async function activerLocation(id){
  if(!confirm('Confirmer que le contrat est signé et le matériel remis au client ?'))return;
  const {data:l}=await db.from('locations').select('*,locations_lignes(unite_id)').eq('id',id).single();
  const ids=(l.locations_lignes||[]).map(x=>x.unite_id);
  const {data:chk}=await db.from('extincteurs_unites').select('id,identification,statut').in('id',ids);
  const ko=(chk||[]).filter(u=>u.statut!=='en_atelier_revise');
  if(ko.length){toast('Plus disponible(s) : '+ko.map(u=>u.identification).join(', '),'err');return}
  const today=new Date().toISOString().slice(0,10);
  const {error}=await db.from('extincteurs_unites').update({statut:'en_location',updated_at:new Date().toISOString()}).in('id',ids);
  if(error){toast('Erreur : '+error.message,'err');return}
  await db.from('locations').update({statut:'en_cours',signe_le:today}).eq('id',id);
  await db.from('extincteurs_mouvements').insert(ids.map(u=>({unite_id:u,type:'mise_en_location',technicien_id:ME.id,agence_id:l.agence_id,notes:'Location '+l.numero})));
  toast('Location activée');await loadLocations();ouvrirLocation(id);
}
async function annulerLocation(id){
  if(!confirm('Annuler ce brouillon de location ?'))return;
  await db.from('locations').update({statut:'annulee'}).eq('id',id);
  CM('mo-location-detail');loadLocations();
}
async function retourLocation(locId,ligneId,uniteId){
  const etat=prompt("État de l'appareil au retour (ex. : bon état / UTILISÉ → recharge à facturer / dégradé / manquant) :","bon état");
  if(etat===null)return;
  const today=new Date().toISOString().slice(0,10);
  const {data:l}=await db.from('locations').select('numero,agence_id').eq('id',locId).single();
  await db.from('locations_lignes').update({date_retour:today,etat_retour:etat.trim()||null}).eq('id',ligneId);
  await db.from('extincteurs_unites').update({statut:'en_atelier_a_reviser',updated_at:new Date().toISOString()}).eq('id',uniteId);
  await db.from('extincteurs_mouvements').insert({unite_id:uniteId,type:'retour_location',technicien_id:ME.id,agence_id:l.agence_id,notes:'Retour location '+l.numero+(etat?' — '+etat:'')});
  const {data:rest}=await db.from('locations_lignes').select('id').eq('location_id',locId).is('date_retour',null);
  if(!rest||!rest.length)await db.from('locations').update({statut:'terminee',date_fin_effective:today}).eq('id',locId);
  toast('Retour enregistré — appareil à réviser');await loadLocations();ouvrirLocation(locId);
}

// ---------- PDF contrat de location ----------
async function construireLocationPDF(id){
  const {data:l}=await db.from('locations').select('*,clients(*),agences(nom,code),locations_lignes(*,extincteurs_unites(identification,capacite_valeur,capacite_unite,agent_code,marque,modele,date_fabrication))').eq('id',id).single();
  if(!l)return null;
  const {jsPDF}=window.jspdf;const doc=new jsPDF({unit:'mm',format:'a4'});
  const cl=l.clients||{},ag=AGENCES_PDF[l.agences?.code]||AGENCES_PDF.briec;
  const ls=l.locations_lignes||[];
  const total=ls.reduce((s,x)=>s+(+x.loyer_mensuel_ht||0),0);
  const M=15,W=180;let y=0;
  const entete=()=>{
    try{doc.addImage(LOGO_BFS,'PNG',12,5,16,16)}catch(e){}
    doc.setFont('helvetica','bold');doc.setFontSize(10);doc.setTextColor(60);doc.text(ag.nom,32,11);
    doc.setFont('helvetica','normal');doc.setFontSize(8);doc.text(ag.adresse.join(' — ')+'  |  SIRET '+ag.siret,32,16);
    doc.setDrawColor(230,120,20);doc.setLineWidth(.6);doc.line(M,24,M+W,24);y=32;
  };
  const pied=()=>{const n=doc.getNumberOfPages();for(let p=1;p<=n;p++){doc.setPage(p);doc.setFontSize(7.5);doc.setTextColor(120);
    doc.text(`Contrat de location ${l.numero} — ${ag.nom} — Page ${p}/${n}`,105,290,{align:'center'});
    doc.text('Paraphe client : ________',M+W,290,{align:'right'})}};
  const saut=h=>{if(y+h>278){doc.addPage();entete()}};
  const titre=t=>{saut(12);doc.setFont('helvetica','bold');doc.setFontSize(11);doc.setTextColor(230,120,20);doc.text(t,M,y);y+=6;doc.setTextColor(30)};
  const para=t=>{doc.setFont('helvetica','normal');doc.setFontSize(9);doc.setTextColor(30);const lines=doc.splitTextToSize(t,W);saut(lines.length*4.2+2);doc.text(lines,M,y);y+=lines.length*4.2+2};
  entete();
  doc.setFont('helvetica','bold');doc.setFontSize(16);doc.setTextColor(230,120,20);doc.text(l.type_location==='evenement'?'LOCATION D\'EXTINCTEURS — ÉVÉNEMENT':'CONTRAT DE LOCATION D\'EXTINCTEURS',M,y);y+=7;
  doc.setFontSize(9.5);doc.setTextColor(60);doc.text(`N° ${l.numero}  —  Édité le ${fmt(new Date())}`,M,y);y+=8;
  titre('Parties');
  para(`Le bailleur : ${ag.nom}, ${ag.adresse.join(', ')}, SIRET ${ag.siret} (ci-après « BFS »).`);
  para(`Le locataire : ${cl.raison_sociale||''}${cl.adresse?', '+cl.adresse:''}${cl.code_postal||cl.ville?', '+[cl.code_postal,cl.ville].filter(Boolean).join(' '):''}${cl.siret?', SIRET '+cl.siret:''} (ci-après « le Client »).`);
  if(l.type_location==='evenement'){
    const nj=_nbJoursLoc(l),tot=ls.reduce((t,x)=>t+(+x.prix_jour_ht||0)*nj,0),tech=(+l.technicien_jours||0)*(+l.technicien_tarif_jour_ht||0),ttl=tot+(+l.livraison_ht||0)+tech;
    titre('Article 1 — Objet');
    para(`BFS loue au Client, organisateur de l'événement « ${l.evenement_nom||''} »${l.evenement_lieu?' ('+l.evenement_lieu+')':''}, les extincteurs ci-dessous pour la période du ${fmt(l.date_debut)} au ${fmt(l.date_fin_prevue)} inclus (${nj} jour${nj>1?'s':''}).`);
    doc.autoTable({startY:y,margin:{left:M,right:M},head:[['N° identification','Appareil','Prix HT / jour',`Total HT (${nj} j)`]],
      body:ls.map(x=>{const u=x.extincteurs_unites||{};return [u.identification||'',`${u.capacite_valeur||''} ${u.capacite_unite||''} ${u.agent_code||''}${u.marque?' — '+u.marque+(u.modele?' '+u.modele:''):''}`,_eurL(x.prix_jour_ht),_eurL((+x.prix_jour_ht||0)*nj)]}),
      styles:{fontSize:8.5,cellPadding:1.6},headStyles:{fillColor:[230,120,20]},columnStyles:{2:{halign:'right'},3:{halign:'right'}}});
    y=doc.lastAutoTable.finalY+7;
    titre('Article 2 — Prix et paiement');
    const recap=[['Location de '+ls.length+' extincteur'+(ls.length>1?'s':'')+' — '+nj+' jour'+(nj>1?'s':''),_eurL(tot)]];
    if(+l.livraison_ht>0)recap.push(['Livraison et reprise du matériel (forfait)',_eurL(l.livraison_ht)]);
    if(tech>0)recap.push([`Technicien sur site — ${l.technicien_jours} jour(s) × ${_eurL(l.technicien_tarif_jour_ht)}`,_eurL(tech)]);
    recap.push(['TOTAL HT ESTIMÉ (TVA en sus)',_eurL(ttl)]);
    doc.autoTable({startY:y,margin:{left:M,right:M},body:recap,styles:{fontSize:9,cellPadding:1.6},columnStyles:{1:{halign:'right'}},didParseCell:d=>{if(d.row.index===recap.length-1)d.cell.styles.fontStyle='bold'}});
    y=doc.lastAutoTable.finalY+4;
    para(`Le montant est payable [à l'avance / à réception de facture — à préciser]${l.depot_garantie>0?`, après versement d'un dépôt de garantie de ${_eurL(l.depot_garantie)} restitué après contrôle du matériel au retour`:''}. Les prestations complémentaires de l'article 3 sont facturées en sus. À défaut de paiement à l'échéance, des pénalités de retard sont dues de plein droit, au taux de [3 fois le taux d'intérêt légal — à confirmer], ainsi que l'indemnité forfaitaire de 40 € pour frais de recouvrement (articles L441-10 et D441-5 du Code de commerce).`);
    titre('Article 3 — Prestations');
    para(`Sont comprises dans le prix : la vérification de chaque appareil avant sa remise, avec consignation de son état.${+l.livraison_ht>0?' La livraison et la reprise sont facturées au forfait ci-dessus.':' La livraison et la reprise sont [incluses / facturées en sus — à préciser].'} Tout appareil utilisé, percuté ou déchargé pendant l'événement doit être signalé et fait l'objet d'une recharge facturée ${l.recharge_apres_usage_ht>0?_eurL(l.recharge_apres_usage_ht)+' HT par appareil':'au tarif en vigueur'}. ${tech>0?'La présence d\'un technicien sur site est assurée aux jours et tarifs indiqués à l\'article 2.':'Un technicien de BFS peut être présent sur site, en option et sur devis.'}`);
    titre('Article 4 — Propriété, usage et garde');
    para('Le matériel reste la propriété de BFS. Pendant la période de location, le Client en a la garde : il le met en place aux emplacements prévus par son dispositif de sécurité, le maintient visible, accessible et signalé, ne le modifie pas, n\'en retire ni la plaque ni l\'étiquette BFS, et le tient à l\'abri des dégradations et du vol. Il informe BFS dans les 24 heures de toute utilisation, dégradation, perte ou vol.');
    titre('Article 5 — Perte, vol, destruction');
    para('En cas de perte, vol ou destruction, le Client est redevable de la valeur de remplacement HT ci-dessous. Il lui appartient de s\'assurer pour ce risque.');
    doc.autoTable({startY:y,margin:{left:M,right:M},head:[['N° identification','Valeur de remplacement HT']],body:ls.map(x=>[x.extincteurs_unites?.identification||'',x.valeur_remplacement_ht!=null?_eurL(x.valeur_remplacement_ht):'À définir']),styles:{fontSize:8.5,cellPadding:1.5},headStyles:{fillColor:[120,120,120]},columnStyles:{1:{halign:'right'}}});
    y=doc.lastAutoTable.finalY+7;
    titre('Article 6 — Responsabilité');
    para('Le Client, organisateur, reste seul responsable de la sécurité de son événement : analyse des risques, dispositif et effectifs de sécurité incendie, respect des prescriptions de la commission de sécurité. BFS garantit uniquement le bon état de fonctionnement des appareils à la remise ; sa responsabilité est limitée aux dommages directs et, sauf faute lourde ou dol, plafonnée à [montant — à définir]. Le Client déclare être couvert par une assurance adaptée à l\'événement.');
    titre('Article 7 — Annulation et modification');
    para('[Conditions d\'annulation ou de réduction du nombre d\'appareils — à définir : par exemple, acompte conservé en cas d\'annulation à moins de __ jours de l\'événement.]');
    titre('Article 8 — Restitution');
    para(`Le Client restitue le matériel au plus tard le ${fmt(l.date_fin_prevue)}${+l.livraison_ht>0?' ou à la date convenue pour la reprise par BFS':''}. BFS établit un état de retour contradictoire. Tout jour de retard est facturé au prix journalier de l'article 1, sans préjudice de l'article 5.`);
    titre('Article 9 — Données personnelles et droit applicable');
    para('Les données du Client sont traitées par BFS pour la gestion du contrat et la facturation ; droits d\'accès, de rectification et d\'opposition auprès de contact@bfs-prevention.fr. Le contrat est soumis au droit français ; à défaut de résolution amiable, le tribunal compétent est [tribunal de commerce de ____ — à préciser].');
  }else{
  titre('Article 1 — Objet et matériel loué');
  para('BFS loue au Client, qui accepte, les extincteurs désignés ci-dessous, en bon état de fonctionnement et vérifiés avant remise.');
  doc.autoTable({startY:y,margin:{left:M,right:M},head:[['N° identification','Appareil','Loyer HT / mois']],
    body:ls.map(x=>{const u=x.extincteurs_unites||{};return [u.identification||'',`${u.capacite_valeur||''} ${u.capacite_unite||''} ${u.agent_code||''}${u.marque?' — '+u.marque+(u.modele?' '+u.modele:''):''}`,_eurL(x.loyer_mensuel_ht)]}).concat([['','Total loyer HT / mois',_eurL(total)]]),
    styles:{fontSize:8.5,cellPadding:1.6},headStyles:{fillColor:[230,120,20]},columnStyles:{2:{halign:'right'}},
    didParseCell:d=>{if(d.row.index===ls.length)d.cell.styles.fontStyle='bold'}});
  y=doc.lastAutoTable.finalY+7;
  titre('Article 2 — Durée');
  para(`La location prend effet le ${fmt(l.date_debut)} pour une durée minimale de ${l.duree_minimale_mois} mois. Elle se poursuit ensuite par tacite reconduction de mois en mois, chaque partie pouvant y mettre fin dans les conditions de l'article 9.`);
  titre('Article 3 — Loyer « tout inclus », facturation et paiement');
  para(`Le loyer est de ${_eurL(total)} HT par mois pour l'ensemble du matériel (TVA en sus au taux en vigueur) et comprend les prestations de l'article 6. Il est facturé [mensuellement / trimestriellement — à préciser] à terme à échoir et payable à [30 jours / à réception — à préciser]. Le loyer court à compter de la remise du matériel. À défaut de paiement à l'échéance, des pénalités de retard sont dues de plein droit, au taux de [3 fois le taux d'intérêt légal — à confirmer], ainsi que l'indemnité forfaitaire pour frais de recouvrement de 40 € (articles L441-10 et D441-5 du Code de commerce).`);
  titre('Article 4 — Dépôt de garantie');
  para(l.depot_garantie>0?`Le Client verse un dépôt de garantie de ${_eurL(l.depot_garantie)}, non productif d'intérêts, restitué dans un délai de [30 jours — à confirmer] après la restitution du matériel, déduction faite des sommes restant dues et des frais de remise en état.`:'Aucun dépôt de garantie n\'est demandé pour cette location.');
  titre('Article 5 — Propriété, usage et garde du matériel');
  para('Le matériel reste la propriété exclusive de BFS. Le Client s\'interdit de le vendre, le céder, le sous-louer, le nantir, le modifier, le déplacer hors du site déclaré, ou d\'en retirer la plaque d\'identification et l\'étiquette BFS. Le Client en a la garde et en répond pendant toute la durée de la location ; il l\'utilise conformément à sa destination et aux consignes d\'utilisation, et informe BFS sans délai de toute utilisation, dégradation, perte ou vol. En cas de saisie ou de procédure collective, le Client informe les tiers de la propriété de BFS.');
  titre('Article 6 — Formule tout inclus');
  para('Le loyer comprend, pour chaque appareil loué et pendant toute la durée de la location :');
  doc.setFont('helvetica','normal');doc.setFontSize(9);
  ['les frais de déplacement de BFS pour l\'ensemble des interventions liées à la location ;','une recharge offerte par appareil, à compter de 12 mois d\'ancienneté de location (recharge après utilisation ou remise en conformité) ; toute recharge avant ce terme, ou au-delà de la recharge offerte, est facturée au tarif en vigueur ;','la vérification périodique de l\'appareil ;','l\'échange de l\'appareil en fin de vie, sans frais ;','la dépollution et le traitement des appareils et agents extincteurs en fin de vie.'].forEach(t=>{const L=doc.splitTextToSize('•  '+t,W-6);saut(L.length*4.2+1);doc.text(L,M+4,y);y+=L.length*4.2+1});
  y+=2;
  para('Les prestations incluses ne sont ni reportables d\'une période à l\'autre, ni remboursables si elles ne sont pas utilisées. Sont à la charge du Client : les dégradations, le vandalisme et les dommages résultant d\'un mauvais usage. Le Client permet l\'accès au matériel pour les interventions. La location d\'un extincteur ne constitue pas une garantie de conformité du site à la réglementation incendie.');
  titre('Article 7 — Perte, vol, destruction');
  para('En cas de perte, vol ou destruction du matériel, le Client est redevable de sa valeur de remplacement HT figurant ci-dessous, sans préjudice des loyers échus. Il lui appartient de s\'assurer pour ce risque.');
  doc.autoTable({startY:y,margin:{left:M,right:M},head:[['N° identification','Valeur de remplacement HT']],
    body:ls.map(x=>[x.extincteurs_unites?.identification||'',x.valeur_remplacement_ht!=null?_eurL(x.valeur_remplacement_ht):'À définir']),
    styles:{fontSize:8.5,cellPadding:1.5},headStyles:{fillColor:[120,120,120]},columnStyles:{1:{halign:'right'}}});
  y=doc.lastAutoTable.finalY+7;
  titre('Article 8 — Assurance et responsabilité');
  para('Le Client est responsable des dommages causés au matériel et par le matériel pendant la location, et déclare être couvert par une assurance adaptée. BFS n\'est pas responsable des conséquences d\'un défaut de mise en œuvre ou d\'utilisation du matériel par le Client ; sa responsabilité est limitée aux dommages directs et, sauf faute lourde ou dol, plafonnée à [montant — à définir].');
  titre('Article 9 — Résiliation et restitution');
  para(`Après la durée minimale, chaque partie peut résilier par lettre recommandée ou courriel avec accusé de réception, moyennant un préavis de [1 mois — à confirmer]. Une résiliation à l'initiative du Client avant le terme de la durée minimale rend exigibles les loyers restant à courir jusqu'à ce terme [— à confirmer]. BFS peut résilier de plein droit, après mise en demeure restée sans effet pendant 8 jours, en cas de non-paiement ou de manquement du Client à ses obligations. À la fin de la location, le Client restitue le matériel à BFS en bon état d'usage normal ; BFS établit un état de retour. Tout retard de restitution donne lieu à facturation du loyer jusqu'à la restitution effective.`);
  titre('Article 10 — Données personnelles');
  para('Les données du Client sont traitées par BFS pour la gestion du contrat, la facturation et le suivi réglementaire du matériel. Le Client dispose des droits d\'accès, de rectification et d\'opposition en écrivant à contact@bfs-prevention.fr.');
  titre('Article 11 — Droit applicable et litiges');
  para('Le présent contrat est soumis au droit français. À défaut de résolution amiable, tout litige relève du tribunal compétent [tribunal de commerce de ____ — à préciser].');
  }
  saut(48);
  doc.setFont('helvetica','bold');doc.setFontSize(9.5);doc.setTextColor(30);doc.text(`Fait à __________________, le ${l.signe_le?fmt(l.signe_le):'__ / __ / ____'}, en deux exemplaires.`,M,y);y+=7;
  doc.setDrawColor(150);doc.rect(M,y,87,32);doc.rect(M+93,y,87,32);
  doc.setFontSize(8.5);doc.text('Pour BFS (nom, signature, cachet)',M+2,y+5);doc.text('Pour le Client (nom, qualité, signature)',M+95,y+5);
  doc.setFont('helvetica','normal');doc.setFontSize(7.5);doc.text('Mention « Lu et approuvé » manuscrite',M+95,y+10);
  pied();
  return {l,doc};
}
async function exportLocationPDF(id){
  const res=await construireLocationPDF(id);
  if(!res){toast('Location introuvable','err');return}
  res.doc.save(`BFS_location_${res.l.numero}.pdf`);toast('Contrat de location PDF généré');
}
