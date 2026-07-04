// ============================================================
// BFS Contrôle — MÉTIER (app.js)
// ============================================================
// Pages métier : profil, dashboards, clients, équipements, vérifications,
// contrats, planning/RDV, commandes, bons, utilisateurs, audit, config.
// Ordre de chargement : debug.js → (CDN) → core.js → app.js → pdf.js
// ============================================================

// ============================================================
// MON PROFIL
// ============================================================
function loadProfil(){
  if(!ME)return;
  const rl={admin:'Administrateur',secretariat:'Secrétariat',technicien:'Technicien'};
  $('p-prenom').value=ME.prenom||'';
  $('p-nom').value=ME.nom||'';
  $('p-email').value=ME.email||'';
  $('p-role').value=rl[ME.role]||ME.role;
  $('p-agence').value=ME.agences?.nom||'Briec + Sevremont';
  $('p-pwd1').value='';$('p-pwd2').value='';
  $('p-pwd-err').style.display='none';$('p-pwd-ok').style.display='none';
}
async function saveProfilInfos(){
  const prenom=$('p-prenom').value.trim();const nom=$('p-nom').value.trim();
  if(!nom){toast('Le nom est obligatoire','err');return}
  const {error}=await db.from('profils').update({prenom,nom,updated_at:new Date().toISOString()}).eq('id',ME.id);
  if(error){toast('Erreur: '+error.message,'err');return}
  ME.prenom=prenom;ME.nom=nom;updateSidebar();toast('Profil mis à jour ✓');
}
async function saveProfilPwd(){
  const p1=$('p-pwd1').value;const p2=$('p-pwd2').value;
  const err=$('p-pwd-err');const ok=$('p-pwd-ok');
  err.style.display='none';ok.style.display='none';
  if(p1.length<8){err.textContent='Minimum 8 caractères.';err.style.display='block';return}
  if(p1!==p2){err.textContent='Les mots de passe ne correspondent pas.';err.style.display='block';return}
  const {error}=await db.auth.updateUser({password:p1});
  if(error){err.textContent='Erreur: '+error.message;err.style.display='block';return}
  ok.textContent='✓ Mot de passe modifié avec succès';ok.style.display='block';
  $('p-pwd1').value='';$('p-pwd2').value='';
}

// Changement rapide mot de passe
function openChangePwd(){$('cp-pwd1').value='';$('cp-pwd2').value='';$('cp-err').style.display='none';$('cp-ok').style.display='none';OM('mo-changepwd')}
async function saveChangePwd(){
  const p1=$('cp-pwd1').value;const p2=$('cp-pwd2').value;
  const err=$('cp-err');const ok=$('cp-ok');err.style.display='none';ok.style.display='none';
  if(p1.length<8){err.textContent='Minimum 8 caractères.';err.style.display='block';return}
  if(p1!==p2){err.textContent='Les mots de passe ne correspondent pas.';err.style.display='block';return}
  const {error}=await db.auth.updateUser({password:p1});
  if(error){err.textContent='Erreur: '+error.message;err.style.display='block';return}
  ok.textContent='✓ Mot de passe modifié';ok.style.display='block';
  setTimeout(()=>CM('mo-changepwd'),1500);
}

// ============================================================
// DASHBOARD TECHNICIEN
// ============================================================
async function loadDashTech(){
  const vis=ME.visibilite||'perso';
  const tabs=$('dash-tech-tabs');tabs.innerHTML='';tabs.style.display='none';
  let q=db.from('vue_echeances').select('*').order('date_prochaine_echeance');
  const {data:mesequip}=await db.from('equipements').select('id').eq('technicien_id',ME.id);
  const myIds=new Set((mesequip||[]).map(e=>e.client_id));

  if(vis==='perso'){
    q=q.eq('technicien_id',ME.id);$('dash-tech-title').textContent='Mes échéances';
  } else if(vis==='perso_agence'){
    tabs.style.display='flex';tabs.innerHTML=`<button class="ag-tab active" onclick="dashTechTab(this,'perso')">👤 Mes équipements</button><button class="ag-tab" onclick="dashTechTab(this,'${ME.agences?.code||'briec'}')">📍 ${ME.agences?.nom||'Agence'}</button>`;
    q=q.eq('technicien_id',ME.id);$('dash-tech-title').textContent='Mes échéances';
  } else {
    tabs.style.display='flex';tabs.innerHTML=`<button class="ag-tab active" onclick="dashTechTab(this,'perso')">👤 Mes équipements</button><button class="ag-tab" onclick="dashTechTab(this,'briec')">📍 Briec</button><button class="ag-tab" onclick="dashTechTab(this,'sevremont')">📍 Sevremont</button>`;
    q=q.eq('technicien_id',ME.id);$('dash-tech-title').textContent='Mes échéances';
  }
  const {data:ech}=await q;const ec=ech||[];
  const retard=ec.filter(e=>e.statut_echeance==='en retard').length;
  const urgent=ec.filter(e=>e.statut_echeance==='urgent').length;
  const proche=ec.filter(e=>e.statut_echeance==='proche').length;
  $('dash-tech-stats').innerHTML=`
    <div class="stat-card bleu"><div class="val">${mesequip?.length??0}</div><div class="lab">Mes équipements</div></div>
    <div class="stat-card rouge"><div class="val">${retard}</div><div class="lab">En retard</div></div>
    <div class="stat-card orange"><div class="val">${urgent}</div><div class="lab">Urgent &lt;30j</div></div>
    <div class="stat-card vert"><div class="val">${proche}</div><div class="lab">Proche &lt;90j</div></div>`;

  // Mes prochains RDV (30 prochains jours)
  const {data:rdvData,error:rdvErr}=await db.from('vue_planning').select('*')
    .eq('technicien_id',ME.id)
    .gte('date_rdv',dateLocale(new Date()))
    .lte('date_rdv',dateLocale(new Date(Date.now()+30*86400000)))
    .order('date_rdv').order('heure_debut');
  if(rdvErr)console.error('Erreur RDV dashboard:',rdvErr);
  const rdvList=rdvData||[];
  $('dash-tech-rdv').innerHTML = rdvList.length
    ? `<table><thead><tr><th>Date</th><th>Heure</th><th>Client</th><th>Intervention</th><th>Statut</th></tr></thead><tbody>${rdvList.map(r=>`<tr style="cursor:pointer" onclick="navigate('planning')">
        <td>${fmt(r.date_rdv)}</td><td>${fmtH(r.heure_debut)}</td><td>${r.raison_sociale}</td>
        <td>${r.type_intervention||'—'}</td>
        <td><span class="badge ${r.statut==='confirmé'?'bv':r.statut==='annulé'?'br':'bb'}">${r.statut}</span></td>
      </tr>`).join('')}</tbody></table>`
    : '<div class="t-empty">Aucun RDV planifié dans les 30 prochains jours</div>';

  renderEcheancesTable(ec.filter(e=>e.statut_echeance!=='ok'),$('dash-tech-table'));
}
window.dashTechTab=async function(btn,scope){
  document.querySelectorAll('#dash-tech-tabs .ag-tab').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  let q=db.from('vue_echeances').select('*').order('date_prochaine_echeance');
  if(scope==='perso'){q=q.eq('technicien_id',ME.id);$('dash-tech-title').textContent='Mes échéances';}
  else{q=q.eq('agence_code',scope);$('dash-tech-title').textContent='Échéances agence';}
  const {data}=await q;
  renderEcheancesTable((data||[]).filter(e=>e.statut_echeance!=='ok'),$('dash-tech-table'));
};

// ============================================================
// DASHBOARD ADMIN
// ============================================================
async function loadDashAdmin(){
  let q=db.from('vue_echeances').select('*');
  if(adminAgenceFilter)q=q.eq('agence_code',adminAgenceFilter);
  let qRetard=db.from('vue_operations_en_retard').select('*');
  if(adminAgenceFilter)qRetard=qRetard.eq('agence_code',adminAgenceFilter);
  const [{data:ec},{data:cl},{data:eq},{data:retardOps}]=await Promise.all([q,db.from('clients').select('id'),db.from('equipements').select('id'),qRetard]);
  const e=ec||[];
  $('admin-stats').innerHTML=`
    <div class="stat-card bleu"><div class="val">${cl?.length??0}</div><div class="lab">Clients</div></div>
    <div class="stat-card bleu"><div class="val">${eq?.length??0}</div><div class="lab">Équipements</div></div>
    <div class="stat-card rouge"><div class="val">${e.filter(x=>x.statut_echeance==='en retard').length}</div><div class="lab">En retard</div></div>
    <div class="stat-card orange"><div class="val">${e.filter(x=>x.statut_echeance==='urgent').length}</div><div class="lab">Urgent &lt;30j</div></div>
    <div class="stat-card vert"><div class="val">${e.filter(x=>x.statut_echeance==='ok').length}</div><div class="lab">À jour</div></div>`;

  // RDV des 7 prochains jours
  let qRdv=db.from('vue_planning').select('*').gte('date_rdv',dateLocale(new Date())).lte('date_rdv',dateLocale(new Date(Date.now()+7*86400000))).order('date_rdv').order('heure_debut');
  if(adminAgenceFilter)qRdv=qRdv.eq('agence_code',adminAgenceFilter);
  const {data:rdvData,error:rdvErr}=await qRdv;
  if(rdvErr)console.error('Erreur RDV admin:',rdvErr);
  const rdvList=rdvData||[];
  $('admin-rdv').innerHTML = rdvList.length
    ? `<table><thead><tr><th>Date</th><th>Heure</th><th>Client</th><th>Technicien</th><th>Intervention</th><th>Statut</th></tr></thead><tbody>${rdvList.map(r=>`<tr style="cursor:pointer" onclick="navigate('planning')">
        <td>${fmt(r.date_rdv)}</td><td>${fmtH(r.heure_debut)}</td><td>${r.raison_sociale}</td>
        <td>${r.tech_prenom||''} ${r.tech_nom||'—'}</td><td>${r.type_intervention||'—'}</td>
        <td><span class="badge ${r.statut==='confirmé'?'bv':r.statut==='annulé'?'br':'bb'}">${r.statut}</span></td>
      </tr>`).join('')}</tbody></table>`
    : '<div class="t-empty">Aucun RDV planifié cette semaine</div>';

  const retard = retardOps||[];
  const cardRetard = $('card-retard-operations');
  if(retard.length){
    cardRetard.style.display='block';
    $('admin-retard-operations').innerHTML = `<table><thead><tr><th>Client</th><th>Agence</th><th>Équipement</th><th>Type</th><th>Opération due</th><th>Retard</th></tr></thead><tbody>${retard.map(r=>`<tr>
      <td><strong>${r.raison_sociale}</strong><br><small style="color:var(--txt-l)">${r.ville||''}</small></td>
      <td><span class="badge bg">${r.agence_nom||'—'}</span></td>
      <td>${r.icone||''} ${r.numero_identification||'—'}<br><small>${r.localisation||''}</small></td>
      <td>${r.type_libelle||'—'}</td>
      <td><strong>${r.palier_libelle}</strong><br><small style="color:var(--txt-l)">${r.reference_normative||''}</small></td>
      <td><span class="badge br">+${r.annees_retard} an(s)</span></td>
    </tr>`).join('')}</tbody></table>`;
  } else {
    cardRetard.style.display='none';
  }

  renderEcheancesTable(e.filter(x=>x.statut_echeance!=='ok'),$('admin-echeances'));
}
window.adminSetAgence=function(btn,ag){
  document.querySelectorAll('#admin-tabs .ag-tab').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');adminAgenceFilter=ag;loadDashAdmin();
};

// ============================================================
// DASHBOARD SECRÉTARIAT
// ============================================================
async function loadDashSec(){
  const [{data:ec},{data:rdvSem}]=await Promise.all([
    db.from('vue_echeances').select('*'),
    db.from('vue_planning').select('*').gte('date_rdv',dateLocale(new Date())).lte('date_rdv',dateLocale(new Date(Date.now()+7*86400000)))
  ]);
  const e=ec||[];
  $('sec-stats').innerHTML=`
    <div class="stat-card rouge"><div class="val">${e.filter(x=>x.statut_echeance==='en retard').length}</div><div class="lab">En retard</div></div>
    <div class="stat-card orange"><div class="val">${e.filter(x=>x.statut_echeance==='urgent').length}</div><div class="lab">Urgent &lt;30j</div></div>
    <div class="stat-card bleu"><div class="val">${rdvSem?.length??0}</div><div class="lab">RDV cette semaine</div></div>
    <div class="stat-card violet"><div class="val">${e.filter(x=>x.statut_echeance==='proche').length}</div><div class="lab">Proche &lt;90j</div></div>`;
  const urgentes=e.filter(x=>['en retard','urgent'].includes(x.statut_echeance)).slice(0,6);
  $('sec-urgences').innerHTML=urgentes.length?'<div style="padding:8px">'+urgentes.map(x=>`<div style="padding:7px 12px;border-left:3px solid ${x.statut_echeance==='en retard'?'#dc2626':'#d97706'};margin-bottom:5px;background:#fafafa;border-radius:0 6px 6px 0;font-size:12px"><strong>${x.raison_sociale}</strong> — ${x.icone} ${x.type_libelle}<br><span class="${ecClass(x.date_prochaine_echeance)}">${fmt(x.date_prochaine_echeance)}</span></div>`).join('')+'</div>':'<div class="t-empty">✅ Aucune urgence</div>';

  // Widget commandes
  const {data:cmdData} = await db.from('vue_commandes_a_prevoir').select('*').order('date_echeance').limit(6);
  const cmdUrgentes = (cmdData||[]).filter(c=>['expirée','à_commander'].includes(c.statut_commande));
  $('sec-commandes-widget').innerHTML = cmdUrgentes.length
    ? '<div style="padding:8px">'+cmdUrgentes.map(c=>`<div style="padding:7px 12px;border-left:3px solid ${c.statut_commande==='expirée'?'#dc2626':'#d97706'};margin-bottom:5px;background:#fafafa;border-radius:0 6px 6px 0;font-size:12px"><strong>${c.libelle}</strong><br><span style="color:var(--txt-l)">${c.raison_sociale} — ${c.numero_identification||''}</span><br><span class="${ecClass(c.date_echeance)}">${fmt(c.date_echeance)}</span></div>`).join('')+'</div>'
    : '<div class="t-empty">✅ Aucune commande urgente</div>';

  renderCal('calendrier',calDate);
}

function renderEcheancesTable(data,el){
  if(!data.length){el.innerHTML='<div class="t-empty">✅ Tout est à jour</div>';return}

  // Regroupement par client
  const groupes = {};
  data.forEach(e=>{
    const key = e.client_id || e.raison_sociale;
    if(!groupes[key]) groupes[key] = {raison_sociale:e.raison_sociale, ville:e.ville, agence_nom:e.agence_nom, items:[]};
    groupes[key].items.push(e);
  });
  const clientsList = Object.entries(groupes).sort((a,b)=>{
    const pireA = a[1].items.some(i=>i.statut_echeance==='en retard')?0:a[1].items.some(i=>i.statut_echeance==='urgent')?1:2;
    const pireB = b[1].items.some(i=>i.statut_echeance==='en retard')?0:b[1].items.some(i=>i.statut_echeance==='urgent')?1:2;
    return pireA-pireB;
  });

  el.innerHTML = `<table><thead><tr><th></th><th>Client</th><th>Agence</th><th>Équipements concernés</th><th>Plus proche échéance</th></tr></thead><tbody>${clientsList.map(([key,g],idx)=>{
    const plusProche = g.items.reduce((min,i)=>!min||i.date_prochaine_echeance<min?i.date_prochaine_echeance:min,null);
    const nbRetard = g.items.filter(i=>i.statut_echeance==='en retard').length;
    const nbUrgent = g.items.filter(i=>i.statut_echeance==='urgent').length;
    return `<tr style="cursor:pointer" onclick="toggleClientEcheances('${idx}')">
      <td style="width:24px"><span id="chev-${idx}">▸</span></td>
      <td><strong>${g.raison_sociale}</strong><br><small style="color:var(--txt-l)">${g.ville||''}</small></td>
      <td><span class="badge bg">${g.agence_nom||'—'}</span></td>
      <td>${g.items.length} équip.${nbRetard?' · <span style="color:#dc2626;font-weight:600">'+nbRetard+' en retard</span>':''}${nbUrgent?' · <span style="color:#d97706;font-weight:600">'+nbUrgent+' urgent</span>':''}</td>
      <td class="${ecClass(plusProche)}">${fmt(plusProche)}</td>
    </tr>
    <tr id="detail-${idx}" style="display:none"><td></td><td colspan="4" style="padding:0">
      <table style="width:100%;background:var(--bg)"><tbody>${g.items.map(e=>`<tr>
        <td style="width:30%">${e.icone||''} ${e.numero_identification||'—'}<br><small>${e.marque||''} ${e.modele||''}</small></td>
        <td style="width:20%">${e.type_libelle||'—'}</td>
        <td style="width:20%">${e.tech_prenom||''} ${e.tech_nom||'—'}</td>
        <td style="width:15%">${fmt(e.date_verification)}</td>
        <td style="width:15%" class="${ecClass(e.date_prochaine_echeance)}">${fmt(e.date_prochaine_echeance)}</td>
      </tr>`).join('')}</tbody></table>
    </td></tr>`;
  }).join('')}</tbody></table>`;
}
function toggleClientEcheances(idx){
  const row = $('detail-'+idx);
  const chev = $('chev-'+idx);
  if(row.style.display==='none'){row.style.display='table-row';chev.textContent='▾'}
  else{row.style.display='none';chev.textContent='▸'}
}
async function exportEcheancesXLS(scope){
  let q=db.from('vue_echeances').select('*').order('date_prochaine_echeance');
  if(scope==='tech')q=q.eq('technicien_id',ME.id);
  const {data}=await q;if(!data?.length){toast('Aucune donnée','err');return}
  const rows=data.map(e=>({'Client':e.raison_sociale,'Agence':e.agence_nom,'Type':e.type_libelle,'Identification':e.numero_identification,'Localisation':e.localisation,'Technicien':`${e.tech_prenom||''} ${e.tech_nom||''}`.trim(),'Dernière vérif.':fmt(e.date_verification),'Prochaine échéance':fmt(e.date_prochaine_echeance),'Statut':e.statut_echeance}));
  const ws=XLSX.utils.json_to_sheet(rows);const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,'Échéances');
  XLSX.writeFile(wb,`BFS_echeances_${new Date().toISOString().slice(0,10)}.xlsx`);toast('Export généré');
}

// ============================================================
// CALENDRIER
// ============================================================
const JOURS=['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];
const MOIS=['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
function dateLocale(d){
  const pad=n=>String(n).padStart(2,'0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}

async function renderCal(containerId,date,rdvList){
  const el=$(containerId);if(!el)return;
  if(!rdvList){
    const d=new Date(date.getFullYear(),date.getMonth(),1);
    const f=new Date(date.getFullYear(),date.getMonth()+1,0);
    const {data}=await db.from('vue_planning').select('*').gte('date_rdv',dateLocale(d)).lte('date_rdv',dateLocale(f));
    rdvList=data||[];
  }
  const lb=containerId==='calendrier'?$('cal-label'):$('calp-label');
  if(lb)lb.textContent=`${MOIS[date.getMonth()]} ${date.getFullYear()}`;
  const today=new Date();today.setHours(0,0,0,0);
  let dow=new Date(date.getFullYear(),date.getMonth(),1).getDay();dow=dow===0?6:dow-1;
  const last=new Date(date.getFullYear(),date.getMonth()+1,0).getDate();
  let html=`<div class="cal-grid">${JOURS.map(j=>`<div class="cal-head">${j}</div>`).join('')}`;
  let day=1-dow;
  for(let r=0;r<6;r++){
    for(let c=0;c<7;c++,day++){
      const d2=new Date(date.getFullYear(),date.getMonth(),day);
      const cur=day>=1&&day<=last;
      const isToday=d2.getTime()===today.getTime();
      const ds=dateLocale(d2);
      const dr=rdvList.filter(x=>x.date_rdv===ds);
      html+=`<div class="cal-day${!cur?' other-month':''}${isToday?' today':''}" onclick="onCalClick('${ds}')">
        <div class="cal-num">${cur?day:''}</div>
        ${dr.map(x=>`<div class="rdv-chip rdv-${(x.statut||'planifie').replace('é','e').replace('î','i')}" onclick="event.stopPropagation();editRdv('${x.id}')" title="${x.raison_sociale}">${fmtH(x.heure_debut)} ${x.raison_sociale}</div>`).join('')}
      </div>`;
    }
  }
  html+='</div>';el.innerHTML=html;
}
window.calNav=d=>{calDate=new Date(calDate.getFullYear(),calDate.getMonth()+d,1);renderCal('calendrier',calDate)};
window.calPNav=d=>{calpDate=new Date(calpDate.getFullYear(),calpDate.getMonth()+d,1);loadPlanningPage()};
window.onCalClick=ds=>{$('rdv-date').value=ds;openRdvModal()};

// ============================================================
// PLANNING
// ============================================================
async function loadPlanningPage(){
  const tid=$('f-tech-plan')?.value;const ag=$('f-ag-plan')?.value;
  const y=calpDate.getFullYear(),m=calpDate.getMonth();
  const pad=n=>String(n).padStart(2,'0');
  const dStr=`${y}-${pad(m+1)}-01`;
  const lastDay=new Date(y,m+1,0).getDate();
  const fStr=`${y}-${pad(m+1)}-${pad(lastDay)}`;
  let q=db.from('vue_planning').select('*').gte('date_rdv',dStr).lte('date_rdv',fStr);
  if(tid)q=q.eq('technicien_id',tid);if(ag)q=q.eq('agence_code',ag);
  const {data,error}=await q;
  if(error)console.error('Erreur planning:',error);
  rdvs=data||[];
  renderCal('cal-planning',calpDate,rdvs);
}

// ============================================================
// RDV
// ============================================================
async function openRdvModal(prefill=null){
  if(!clients.length)await loadClients();
  $('rdv-client').innerHTML=clients.map(c=>`<option value="${c.id}">${c.raison_sociale}</option>`).join('');
  $('rdv-tech').innerHTML=profils.map(p=>`<option value="${p.id}">${p.prenom||''} ${p.nom}</option>`).join('');
  ['rdv-id','rdv-notes'].forEach(id=>$(id).value='');
  $('rdv-date').value=dateLocale(new Date());$('rdv-heure').value='09:00';
  $('rdv-duree').value=60;$('rdv-statut').value='planifié';$('mo-rdv-t').textContent='Nouveau RDV';
  $('btn-delete-rdv').style.display='none';
  if(ME.role==='technicien')$('rdv-tech').value=ME.id;
  if(prefill){Object.assign($,{});$('rdv-id').value=prefill.id||'';$('rdv-client').value=prefill.client_id||'';$('rdv-tech').value=prefill.technicien_id||'';$('rdv-date').value=prefill.date_rdv||'';$('rdv-heure').value=prefill.heure_debut?.slice(0,5)||'';$('rdv-duree').value=prefill.duree_minutes||60;$('rdv-type-int').value=prefill.type_intervention||'';$('rdv-statut').value=prefill.statut||'planifié';$('rdv-notes').value=prefill.notes||'';$('mo-rdv-t').textContent='Modifier le RDV';
    if(prefill.id)$('btn-delete-rdv').style.display='inline-flex';
  }
  OM('mo-rdv');
}
window.editRdv=function(id){const r=rdvs.find(x=>x.id===id);if(r)openRdvModal(r)};
async function saveRdv(){
  const id=$('rdv-id').value;
  const p={client_id:$('rdv-client').value,technicien_id:$('rdv-tech').value||null,date_rdv:$('rdv-date').value,heure_debut:$('rdv-heure').value||null,duree_minutes:parseInt($('rdv-duree').value)||60,type_intervention:$('rdv-type-int').value,statut:$('rdv-statut').value,notes:$('rdv-notes').value.trim(),cree_par:ME.id,updated_at:new Date().toISOString()};
  if(!p.client_id||!p.date_rdv){toast('Client et date obligatoires','err');return}
  const {error}=id?await db.from('rdv').update(p).eq('id',id):await db.from('rdv').insert(p);
  if(error){toast('Erreur: '+error.message,'err');return}
  toast(id?'RDV modifié':'RDV créé');CM('mo-rdv');
  if($('page-dash-sec').classList.contains('active'))loadDashSec();else loadPlanningPage();
}
async function deleteRdv(){
  const id=$('rdv-id').value;
  if(!id)return;
  if(!confirm('Supprimer ce RDV ?'))return;
  const {error}=await db.from('rdv').delete().eq('id',id);
  if(error){toast('Erreur: '+error.message,'err');return}
  toast('RDV supprimé');CM('mo-rdv');
  if($('page-dash-sec').classList.contains('active'))loadDashSec();else loadPlanningPage();
}

// ============================================================
// CLIENTS
// ============================================================
async function loadClients(){
  const {data}=await db.from('clients').select('*,agences(nom,code)').order('raison_sociale');
  clients=data||[];renderClients();
  [$('f-cl-verif'),$('ct-client'),$('rdv-client')].forEach(el=>{if(!el)return;
    const cur=el.value;
    el.innerHTML='<option value="">—</option>'+clients.map(c=>`<option value="${c.id}">${c.raison_sociale}</option>`).join('');
    if(cur)el.value=cur;
  });
}
function renderClients(){
  const q=$('q-clients').value.toLowerCase();const ag=$('f-ag-clients').value;
  const data=clients.filter(c=>(c.raison_sociale+c.ville+c.siret).toLowerCase().includes(q)&&(!ag||c.agences?.code===ag));
  const el=$('tbl-clients');
  if(!data.length){el.innerHTML='<div class="t-empty">Aucun client</div>';return}
  el.innerHTML=`<table><thead><tr><th>Raison sociale</th><th>Agence</th><th>Ville</th><th>Contact</th><th>Téléphone</th><th>Actions</th></tr></thead><tbody>${data.map(c=>`<tr>
    <td><strong>${c.raison_sociale}</strong></td><td><span class="badge bg">${c.agences?.nom||'—'}</span></td>
    <td>${c.ville||'—'}</td><td>${c.contact_nom||'—'}</td><td>${c.contact_telephone||'—'}</td>
    <td><div class="ia"><button class="btn btn-s btn-xs" onclick="editClient('${c.id}')">✏️</button><button class="btn btn-s btn-xs" onclick="voirContratsClient('${c.raison_sociale.replace(/'/g,"\\'")}')" title="Voir les contrats de ce client">📋</button><button class="btn btn-s btn-xs" onclick="deleteClient('${c.id}')">🗑</button></div></td>
  </tr>`).join('')}</tbody></table>`;
}
async function openClientModal(prefill=null){
  const {data:ag}=await db.from('agences').select('*');
  $('c-agence').innerHTML='<option value="">—</option>'+(ag||[]).map(a=>`<option value="${a.id}">${a.nom}</option>`).join('');
  ['c-id','c-rs','c-adr','c-cp','c-ville','c-siret','c-contact','c-tel','c-email','c-notes'].forEach(id=>$(id).value='');
  $('mo-cl-t').textContent='Nouveau client';
  $('c-affectations-section').style.display='none';
  $('c-affectations-list').style.display='none';
  $('c-btn-affectation').style.display='none';
  _affectationsClient=[];
  if(prefill){
    $('c-id').value=prefill.id;$('c-agence').value=prefill.agence_id||'';$('c-rs').value=prefill.raison_sociale||'';
    $('c-adr').value=prefill.adresse||'';$('c-cp').value=prefill.code_postal||'';$('c-ville').value=prefill.ville||'';
    $('c-siret').value=prefill.siret||'';$('c-contact').value=prefill.contact_nom||'';
    $('c-tel').value=prefill.contact_telephone||'';$('c-email').value=prefill.contact_email||'';$('c-notes').value=prefill.notes||'';
    $('mo-cl-t').textContent='Modifier le client';
    $('c-affectations-section').style.display='block';
    $('c-affectations-list').style.display='block';
    $('c-btn-affectation').style.display='inline-flex';
    const {data:aff}=await db.from('vue_affectations').select('*').eq('client_id',prefill.id);
    _affectationsClient=aff||[];
    renderAffectations();
  }
  OM('mo-client');
}
function editClient(id){openClientModal(clients.find(c=>c.id===id))}

// ============================================================
// AFFECTATIONS TECHNICIENS
// ============================================================
let _affectationsClient=[];

function renderAffectations(){
  const el=$('c-affectations-list');
  if(!el)return;
  if(!_affectationsClient.length){
    el.innerHTML='<div style="font-size:12px;color:var(--txt-l);padding:8px 0">Aucune affectation — tous les techniciens de l\'agence voient ce client.</div>';
    return;
  }
  el.innerHTML=_affectationsClient.map(a=>`
    <div style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:var(--bg);border-radius:8px;margin-bottom:6px">
      <div style="flex:1;font-size:13px">
        <strong>${a.tech_prenom||''} ${a.tech_nom||''}</strong>
        <span style="color:var(--txt-l)"> → ${a.icone||''} ${a.type_libelle||'Tous types'}</span>
      </div>
      <button type="button" onclick="supprimerAffectation('${a.id}')" style="background:#fee2e2;color:#dc2626;border:none;border-radius:6px;padding:4px 8px;cursor:pointer;font-size:12px">✕</button>
    </div>
  `).join('');
}

async function ajouterAffectation(){
  if(!profils.length)await loadUsers();
  const techs=profils.filter(p=>p.role==='technicien');
  const modal=document.createElement('div');
  modal.className='mo open';
  modal.innerHTML=`<div class="modal" style="max-width:380px"><div class="mh"><h3>Affecter un technicien</h3><button class="mclose" onclick="this.closest('.mo').remove()">✕</button></div>
  <div class="mc">
    <div class="fg"><label>Technicien *</label>
      <select id="aff-tech">${techs.map(t=>`<option value="${t.id}">${t.prenom||''} ${t.nom}</option>`).join('')}</select>
    </div>
    <div class="fg"><label>Type d'équipement *</label>
      <select id="aff-type">
        <option value="">Tous les types</option>
        ${typesEquip.map(t=>`<option value="${t.code}">${t.icone||''} ${t.libelle}</option>`).join('')}
      </select>
    </div>
    <div class="fa">
      <button class="btn btn-s" onclick="this.closest('.mo').remove()">Annuler</button>
      <button class="btn btn-p" onclick="confirmerAffectation(this)">Ajouter</button>
    </div>
  </div></div>`;
  modal.addEventListener('click',e=>{if(e.target===modal)modal.remove()});
  document.body.appendChild(modal);
}

async function confirmerAffectation(btn){
  const clientId=$('c-id').value;
  if(!clientId){toast('Enregistrez d\'abord le client','err');return}
  const techId=document.getElementById('aff-tech').value;
  const typeCode=document.getElementById('aff-type').value||null;
  const {error}=await db.from('affectations_client').insert({client_id:clientId,technicien_id:techId,type_equipement_code:typeCode});
  if(error){toast(error.code==='23505'?'Déjà affecté':error.message,'err');return}
  btn.closest('.mo').remove();
  const {data:aff}=await db.from('vue_affectations').select('*').eq('client_id',clientId);
  _affectationsClient=aff||[];
  renderAffectations();
  toast('Affectation ajoutée ✓');
}

async function supprimerAffectation(affId){
  await db.from('affectations_client').delete().eq('id',affId);
  _affectationsClient=_affectationsClient.filter(a=>a.id!==affId);
  renderAffectations();
}


async function saveClient(){
  const id=$('c-id').value;const rs=$('c-rs').value.trim();
  if(!rs){toast('Raison sociale obligatoire','err');return}
  const p={raison_sociale:rs,agence_id:$('c-agence').value||null,adresse:$('c-adr').value.trim(),code_postal:$('c-cp').value.trim(),ville:$('c-ville').value.trim(),siret:$('c-siret').value.trim(),contact_nom:$('c-contact').value.trim(),contact_telephone:$('c-tel').value.trim(),contact_email:$('c-email').value.trim(),notes:$('c-notes').value.trim(),updated_at:new Date().toISOString()};
  const {error}=id?await db.from('clients').update(p).eq('id',id):await db.from('clients').insert(p);
  if(error){toast('Erreur: '+error.message,'err');return}
  toast(id?'Client modifié':'Client créé');CM('mo-client');loadClients();
}
async function deleteClient(id){if(!confirm('Supprimer ce client ?'))return;await db.from('clients').delete().eq('id',id);toast('Supprimé');loadClients()}

// ============================================================
// ÉQUIPEMENTS
// ============================================================
async function loadEquipements(){
  const {data}=await db.from('equipements').select('*,clients(raison_sociale),agences(nom,code),profils(nom,prenom),types_equipements(libelle,icone)').order('created_at',{ascending:false});
  equipements=data||[];renderEquip();
}
function renderEquip(){
  const q=$('q-equip').value.toLowerCase();const ft=$('f-type-equip').value;const ag=$('f-ag-equip').value;
  const data=equipements.filter(e=>(e.clients?.raison_sociale+e.numero_identification+e.marque+e.modele+e.localisation).toLowerCase().includes(q)&&(!ft||e.type_equipement_code===ft)&&(!ag||e.agences?.code===ag));
  const el=$('tbl-equip');
  if(!data.length){el.innerHTML='<div class="t-empty">Aucun équipement</div>';return}
  el.innerHTML=`<table><thead><tr><th>Client</th><th>Agence</th><th>Type</th><th>Identification</th><th>Marque/Modèle</th><th>Technicien</th><th>Localisation</th><th>Statut</th><th>Actions</th></tr></thead><tbody>${data.map(e=>`<tr>
    <td><strong>${e.clients?.raison_sociale||'—'}</strong></td><td><span class="badge bg">${e.agences?.nom||'—'}</span></td>
    <td>${e.types_equipements?.icone||''} ${e.types_equipements?.libelle||'—'}</td>
    <td>${e.numero_identification||'—'}${e.numero_entreprise?' / <span style="color:var(--txt-l)">N°'+e.numero_entreprise+'</span>':''}<br><small style='color:var(--txt-l)'>${e.emplacement||''}</small></td><td>${e.marque||'—'}${e.modele?' / '+e.modele:''}</td>
    <td>${e.profils?.prenom||''} ${e.profils?.nom||'—'}</td>
    <td>${e.localisation||'—'}</td><td>${badgeSt(e.statut)}</td>
    <td><div class="ia"><button class="btn btn-s btn-xs" onclick="editEquip('${e.id}')">✏️</button><button class="btn btn-s btn-xs" onclick="showQR('${e.id}','${e.numero_identification||e.id}','${e.clients?.raison_sociale||''}','${e.types_equipements?.libelle||''}')">QR</button><button class="btn btn-s btn-xs" onclick="verifierEquip('${e.id}')">✅</button><button class="btn btn-s btn-xs" onclick="deleteEquip('${e.id}')">🗑</button></div></td>
  </tr>`).join('')}</tbody></table>`;
}
async function openEquipModal(prefill=null){
  if(!clients.length)await loadClients();
  $('e-client').innerHTML=clients.map(c=>`<option value="${c.id}">${c.raison_sociale}</option>`).join('');
  $('e-type').innerHTML=typesEquip.map(t=>`<option value="${t.code}">${t.icone} ${t.libelle}</option>`).join('');
  $('e-tech').innerHTML='<option value="">— Non affecté —</option>'+profils.map(p=>`<option value="${p.id}">${p.prenom||''} ${p.nom}</option>`).join('');
  ['e-id','e-num','e-serie','e-lot','e-num-ent','e-emplacement','e-loc','e-zone','e-notes'].forEach(id=>$(id).value='');
  _equipRestoreData={};
  $('e-statut').value='opérationnel';
  $('mo-eq-t').textContent='Nouvel équipement';

  if(prefill){
    $('e-id').value=prefill.id;
    $('e-client').value=prefill.client_id;
    $('e-type').value=prefill.type_equipement_code;
    $('e-tech').value=prefill.technicien_id||'';
    $('e-num').value=prefill.numero_identification||'';
    $('e-serie').value=prefill.numero_serie||'';
    $('e-lot').value=prefill.numero_lot||'';
    $('e-num-ent').value=prefill.numero_entreprise||'';
    $('e-emplacement').value=prefill.emplacement||'';
    setTimeout(()=>setMarqueModele(prefill.type_equipement_code||$('e-type').value,'e-',prefill.marque||'',prefill.modele||''),50);
    $('e-loc').value=prefill.localisation||'';
    $('e-zone').value=prefill.etage_zone||'';
    $('e-statut').value=prefill.statut||'opérationnel';
    $('e-notes').value=prefill.notes||'';
    $('mo-eq-t').textContent='Modifier l\'équipement';
    // Préparer la restauration des champs spécifiques
    _equipRestoreData={
      ...(prefill.donnees_specifiques||{}),
      'e-cap':String(prefill.capacite_valeur||''),
      'e-unite':prefill.capacite_unite||'',
      'e-fab':prefill.date_fabrication||'',
      'e-mis':prefill.date_mise_en_service||''
    };
    _historiqueEquip = Array.isArray(prefill.historique) ? [...prefill.historique] : [];
  } else {
    _historiqueEquip = [];
  }
  renderHistoriqueEquip();
  // Toujours appeler APRÈS avoir défini la valeur du select
  onEquipTypeChange();
  OM('mo-equip');
}
function editEquip(id){openEquipModal(equipements.find(e=>e.id===id))}

// ============================================================
// HISTORIQUE INFORMATIF ÉQUIPEMENT
// ============================================================
let _historiqueEquip = [];
const TYPES_OPERATION_HISTORIQUE = [
  'Mise en service','Vérification annuelle','Maintenance approfondie (MAA)',
  'Révision atelier','Recharge','Remplacement pièce','Percussion / incident',
  'Réparation','Contrôle réglementaire','Autre'
];

function renderHistoriqueEquip(){
  const el = $('e-historique-list');
  if(!el) return;
  if(!_historiqueEquip.length){
    el.innerHTML = '<div style="font-size:12px;color:var(--txt-l);padding:8px 0">Aucune ligne d\'historique.</div>';
    return;
  }
  // Trier par date décroissante pour l'affichage
  const sorted = [..._historiqueEquip].map((h,i)=>({...h,_idx:i})).sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  el.innerHTML = sorted.map(h=>`
    <div style="display:grid;grid-template-columns:130px 1fr auto;gap:8px;align-items:center;padding:8px 10px;background:var(--bg);border-radius:8px;margin-bottom:6px">
      <div style="font-size:13px;font-weight:600">${fmt(h.date)}</div>
      <div style="font-size:13px">${h.type}${h.commentaire?' — <span style="color:var(--txt-l)">'+h.commentaire+'</span>':''}</div>
      <button type="button" onclick="supprimerLigneHistorique(${h._idx})" style="background:#fee2e2;color:#dc2626;border:none;border-radius:6px;padding:4px 8px;cursor:pointer;font-size:12px">✕</button>
    </div>
  `).join('');
}

function ajouterLigneHistorique(){
  const modal = document.createElement('div');
  modal.className = 'mo open';
  modal.style.zIndex = '300';
  modal.innerHTML = `<div class="modal" style="max-width:420px">
    <div class="mh"><h3>Ajouter une ligne d'historique</h3><button class="mclose" onclick="this.closest('.mo').remove()">✕</button></div>
    <div class="mc">
      <div class="fg" style="margin-bottom:12px"><label>Date *</label><input type="date" id="hist-date"></div>
      <div class="fg" style="margin-bottom:12px"><label>Type d'opération *</label>
        <select id="hist-type">${TYPES_OPERATION_HISTORIQUE.map(t=>`<option value="${t}">${t}</option>`).join('')}</select>
      </div>
      <div class="fg" style="margin-bottom:12px"><label>Commentaire</label><input type="text" id="hist-commentaire" placeholder="Précisions (optionnel)"></div>
      <div class="fa">
        <button class="btn btn-s" onclick="this.closest('.mo').remove()">Annuler</button>
        <button class="btn btn-p" onclick="confirmerLigneHistorique(this)">Ajouter</button>
      </div>
    </div>
  </div>`;
  modal.addEventListener('click', e=>{ if(e.target===modal) modal.remove(); });
  document.body.appendChild(modal);
}

function confirmerLigneHistorique(btn){
  const date = document.getElementById('hist-date').value;
  const type = document.getElementById('hist-type').value;
  const commentaire = document.getElementById('hist-commentaire').value.trim();
  if(!date){ toast('Date obligatoire','err'); return; }
  _historiqueEquip.push({date, type, commentaire});
  btn.closest('.mo').remove();
  renderHistoriqueEquip();
}

function supprimerLigneHistorique(idx){
  _historiqueEquip.splice(idx,1);
  renderHistoriqueEquip();
}

async function saveEquip(){
  const id=$('e-id').value;
  const p={client_id:$('e-client').value,technicien_id:$('e-tech').value||null,type_equipement_code:$('e-type').value,numero_identification:$('e-num').value.trim(),numero_serie:$('e-serie').value.trim()||null,numero_lot:$('e-lot').value.trim()||null,numero_entreprise:$('e-num-ent').value.trim()||null,emplacement:$('e-emplacement').value.trim()||null,marque:(lireMarqueModele('e-').marque||'').trim(),modele:(lireMarqueModele('e-').modele||'').trim(),capacite_valeur:parseFloat($('e-cap')?.value)||null,capacite_unite:$('e-unite')?.value?.trim()||null,donnees_specifiques:getEquipSpecificData(),date_fabrication:$('e-fab')?.value||null,date_mise_en_service:$('e-mis')?.value||null,localisation:$('e-loc').value.trim(),etage_zone:$('e-zone').value.trim(),statut:$('e-statut').value,notes:$('e-notes').value.trim(),historique:_historiqueEquip,updated_at:new Date().toISOString()};
  const {error}=id?await db.from('equipements').update(p).eq('id',id):await db.from('equipements').insert(p);
  if(error){toast('Erreur: '+error.message,'err');return}
  toast(id?'Modifié':'Créé');CM('mo-equip');loadEquipements();
}
async function deleteEquip(id){if(!confirm('Supprimer ?'))return;await db.from('equipements').delete().eq('id',id);toast('Supprimé');loadEquipements()}
async function verifierEquip(id){const e=equipements.find(x=>x.id===id);if(e){navigate('verifications');setTimeout(()=>openVerifModal({client_id:e.client_id,equipement_id:id}),200)}}

// ============================================================
// VÉRIFICATIONS
// ============================================================
async function loadVerifs(){
  if(!clients.length)await loadClients();
  const cid=$('f-cl-verif').value;const tid=$('f-type-verif').value;
  const el=$('tbl-verifs');
  el.innerHTML='<div class="loading"><span class="spin"></span></div>';

  // Charger les sessions avec leurs vérifications
  let qSess=db.from('sessions_controle')
    .select('*,clients(raison_sociale,ville),agences(nom),profils(nom,prenom)')
    .order('created_at',{ascending:false}).limit(100);
  if(cid) qSess=qSess.eq('client_id',cid);

  // Charger aussi les vérifications sans session (historiques, saisies bureau)
  let qVerifs=db.from('verifications')
    .select('*,equipements(numero_identification,marque,modele,localisation,type_equipement_code),clients(raison_sociale),types_equipements(libelle,icone),agences(nom)')
    .order('date_verification',{ascending:false}).limit(500);
  if(cid) qVerifs=qVerifs.eq('client_id',cid);
  if(tid) qVerifs=qVerifs.eq('type_equipement_code',tid);

  const [{data:sessions},{data:verifs}]=await Promise.all([qSess,qVerifs]);

  if((!sessions||!sessions.length)&&(!verifs||!verifs.length)){
    el.innerHTML='<div class="t-empty">Aucune vérification</div>';return;
  }

  // Grouper les vérifications par session_id
  const verifsBySess={};
  const verifsOrphelines=[];
  (verifs||[]).forEach(v=>{
    if(v.session_id){
      if(!verifsBySess[v.session_id]) verifsBySess[v.session_id]=[];
      verifsBySess[v.session_id].push(v);
    } else {
      verifsOrphelines.push(v);
    }
  });

  let html='';

  // Rendu par session
  (sessions||[]).forEach((sess,si)=>{
    const vs=verifsBySess[sess.id]||[];
    if(tid && vs.length && !vs.some(v=>v.type_equipement_code===tid)) return;
    const nbConf=vs.filter(v=>v.resultat==='conforme').length;
    const nbNC=vs.filter(v=>v.resultat==='non conforme').length;
    const nbHS=vs.filter(v=>v.resultat==='hors service').length;
    const statutBadge=sess.statut==='terminée'?'<span class="badge bv">✓ Terminée</span>':sess.statut==='en_cours'?'<span class="badge bo">⏳ En cours</span>':'<span class="badge bg">Abandonnée</span>';
    const tech=sess.profils?`${sess.profils.prenom||''} ${sess.profils.nom}`:'—';
    const actionsSession = sess.statut==='en_cours'?`
      <div style="display:flex;gap:6px;padding:8px 16px;background:#fffbeb;border-top:1px solid #fde68a">
        <button class="btn btn-s btn-sm" onclick="cloturerSessionAdmin('${sess.id}')" style="background:#dcfce7;color:#16a34a">✓ Clôturer cette session</button>
        <button class="btn btn-s btn-sm" onclick="supprimerSessionAdmin('${sess.id}')" style="background:#fee2e2;color:#dc2626">🗑 Supprimer (vide/doublon)</button>
      </div>`:'';

    html+=`<div style="border:1px solid #e5e7eb;border-radius:12px;margin-bottom:12px;overflow:hidden">
      <div style="display:flex;align-items:center;gap:12px;padding:12px 16px;background:#f9fafb;cursor:pointer" onclick="toggleSessionVerifs('sv-${si}','chev-${si}')">
        <span id="chev-${si}" style="font-size:16px;flex-shrink:0">▸</span>
        <div style="flex:1;min-width:0">
          <div style="font-weight:700;font-size:14px">${sess.clients?.raison_sociale||'—'} <span style="font-weight:400;color:var(--txt-l);font-size:12px">· ${sess.clients?.ville||''}</span></div>
          <div style="font-size:12px;color:var(--txt-l)">${sess.numero?`<span style="font-weight:600;color:var(--rouge)">N° ${sess.numero}</span> · `:''}${fmt(sess.date_session)} · ${tech} · <span class="badge bg" style="font-size:10px">${sess.agences?.nom||'—'}</span></div>
        </div>
        <div style="display:flex;gap:6px;align-items:center;flex-shrink:0">
          ${statutBadge}
          <span style="font-size:12px;color:var(--txt-l)">${vs.length} équip.</span>
          ${nbConf?`<span class="badge bv" style="font-size:11px">${nbConf} ✓</span>`:''}
          ${nbNC?`<span class="badge bo" style="font-size:11px">${nbNC} ⚠</span>`:''}
          ${nbHS?`<span class="badge br" style="font-size:11px">${nbHS} HS</span>`:''}
        </div>
      </div>
      ${actionsSession}
      <div id="sv-${si}" style="display:none">
        ${vs.length?`<table style="width:100%"><thead><tr><th>Équipement</th><th>Type</th><th>Résultat</th><th>Prochaine échéance</th><th>Technicien</th><th>Ext.</th><th></th></tr></thead><tbody>${vs.map(v=>`<tr${v.realisee_par_bfs===false?' style="opacity:.7"':''}>
          <td>${v.equipements?.numero_identification||'—'}<br><small style="color:var(--txt-l)">${v.equipements?.marque||''} ${v.equipements?.localisation?'· '+v.equipements.localisation:''}</small></td>
          <td>${v.types_equipements?.icone||''} ${v.types_equipements?.libelle||'—'}</td>
          <td>${badgeR(v.resultat)}</td>
          <td class="${ecClass(v.date_prochaine_echeance)}">${fmt(v.date_prochaine_echeance)}</td>
          <td style="font-size:12px">${v.technicien||'—'}</td>
          <td>${v.realisee_par_bfs===false?`<span class="badge bg" style="font-size:10px">⚠ Ext.</span>`:''}</td>
          <td><div class="ia"><button class="btn btn-s btn-xs" onclick="exportVerifPDF('${v.id}')" title="Télécharger le rapport PDF de cette vérification">📄</button><button class="btn btn-s btn-xs" onclick="deleteVerifAvecMotif('${v.id}')">🗑</button></div></td>
        </tr>`).join('')}</tbody></table>`:'<div class="t-empty" style="padding:12px">Aucun équipement vérifié dans cette session</div>'}
      </div>
    </div>`;
  });

  // Vérifications orphelines (sans session)
  if(verifsOrphelines.length){
    html+=`<div style="border:1px solid #e5e7eb;border-radius:12px;margin-bottom:12px;overflow:hidden">
      <div style="display:flex;align-items:center;gap:12px;padding:12px 16px;background:#f9fafb;cursor:pointer" onclick="toggleSessionVerifs('sv-orph','chev-orph')">
        <span id="chev-orph" style="font-size:16px">▸</span>
        <div style="flex:1"><div style="font-weight:700;font-size:14px">Vérifications sans session</div>
        <div style="font-size:12px;color:var(--txt-l)">Saisies individuelles ou historiques repris</div></div>
        <span style="font-size:12px;color:var(--txt-l)">${verifsOrphelines.length} vérif.</span>
      </div>
      <div id="sv-orph" style="display:none">
        <table style="width:100%"><thead><tr><th>Client</th><th>Équipement</th><th>Type</th><th>Date</th><th>Résultat</th><th>Technicien</th><th></th></tr></thead><tbody>
        ${verifsOrphelines.map(v=>`<tr${v.realisee_par_bfs===false?' style="opacity:.7"':''}>
          <td>${v.clients?.raison_sociale||'—'}</td>
          <td>${v.equipements?.numero_identification||'—'}<br><small>${v.equipements?.marque||''}</small></td>
          <td>${v.types_equipements?.icone||''} ${v.types_equipements?.libelle||'—'}</td>
          <td>${fmt(v.date_verification)}</td>
          <td>${badgeR(v.resultat)}</td>
          <td>${v.technicien||'—'}${v.realisee_par_bfs===false?'<br><small class="badge bg" style="font-size:10px">⚠ Ext.</small>':''}</td>
          <td><div class="ia"><button class="btn btn-s btn-xs" onclick="exportVerifPDF('${v.id}')" title="Télécharger le rapport PDF de cette vérification">📄</button><button class="btn btn-s btn-xs" onclick="deleteVerifAvecMotif('${v.id}')">🗑</button></div></td>
        </tr>`).join('')}
        </tbody></table>
      </div>
    </div>`;
  }

  el.innerHTML=html||'<div class="t-empty">Aucune vérification</div>';
}

function toggleSessionVerifs(contentId, chevId){
  const el=document.getElementById(contentId);
  const chev=document.getElementById(chevId);
  if(!el)return;
  const open=el.style.display==='none';
  el.style.display=open?'block':'none';
  if(chev)chev.textContent=open?'▾':'▸';
}

async function deleteVerifAvecMotif(id){
  const modal=document.createElement('div');
  modal.className='mo open';
  modal.innerHTML=`<div class="modal" style="max-width:420px"><div class="mh"><h3>🗑 Supprimer cette vérification</h3><button class="mclose" onclick="this.closest('.mo').remove()">✕</button></div>
  <div class="mc">
    <div style="background:#fee2e2;border-radius:8px;padding:10px 12px;margin-bottom:14px;font-size:13px;color:#dc2626">⚠️ Cette action est définitive. Elle sera tracée dans le journal d'audit.</div>
    <div class="fg"><label>Motif de suppression *</label>
      <select id="motif-suppr-sel" onchange="document.getElementById('motif-suppr-autre').style.display=this.value==='autre'?'block':'none'">
        <option value="">-- Choisir un motif --</option>
        <option value="doublon">Doublon (saisie en double)</option>
        <option value="erreur_saisie">Erreur de saisie</option>
        <option value="mauvais_equipement">Mauvais équipement sélectionné</option>
        <option value="test">Vérification de test</option>
        <option value="autre">Autre motif</option>
      </select>
    </div>
    <div class="fg" id="motif-suppr-autre" style="display:none"><label>Préciser</label><input type="text" id="motif-suppr-texte" placeholder="Expliquer le motif…"></div>
    <div class="fa">
      <button class="btn btn-s" onclick="this.closest('.mo').remove()">Annuler</button>
      <button class="btn" style="background:#dc2626;color:#fff" onclick="confirmerSupprVerif('${id}',this)">Confirmer la suppression</button>
    </div>
  </div></div>`;
  modal.addEventListener('click',e=>{if(e.target===modal)modal.remove()});
  document.body.appendChild(modal);
}

async function confirmerSupprVerif(id, btn){
  const sel=document.getElementById('motif-suppr-sel').value;
  if(!sel){toast('Motif obligatoire','err');return}
  const autre=document.getElementById('motif-suppr-texte')?.value?.trim();
  const motif=sel==='autre'?autre:sel;
  if(!motif){toast('Précisez le motif','err');return}

  btn.disabled=true;btn.textContent='Suppression…';

  // Ajouter le motif dans l'audit avant de supprimer
  // (le trigger va capturer la suppression automatiquement)
  // On stocke le motif dans une note temporaire via update puis delete
  await db.from('verifications').update({observations:(await db.from('verifications').select('observations').eq('id',id).single()).data?.observations||''}).eq('id',id);

  const {error}=await db.from('verifications').delete().eq('id',id);
  if(error){toast('Erreur: '+error.message,'err');btn.disabled=false;btn.textContent='Confirmer';return}

  // Enregistrer le motif manuellement dans audit_log
  await db.from('audit_log').insert({
    table_name:'verifications',
    action:'DELETE',
    record_id:id,
    user_id:ME.id,
    user_role:ME.role,
    new_data:JSON.stringify({motif_suppression:motif})
  }).catch(()=>{});

  btn.closest('.mo').remove();
  toast('Vérification supprimée');
  loadVerifs();
}

async function deleteVerif(id){deleteVerifAvecMotif(id)}

async function cloturerSessionAdmin(sessionId){
  if(!confirm('Clôturer cette session ? Les vérifications déjà enregistrées seront conservées.')) return;
  const {error}=await db.from('sessions_controle').update({statut:'terminée',updated_at:new Date().toISOString()}).eq('id',sessionId);
  if(error){toast('Erreur: '+error.message,'err');return}
  toast('Session clôturée ✓');
  loadVerifs();
}

async function supprimerSessionAdmin(sessionId){
  const modal=document.createElement('div');
  modal.className='mo open';
  modal.innerHTML=`<div class="modal" style="max-width:420px"><div class="mh"><h3>🗑 Supprimer cette session</h3><button class="mclose" onclick="this.closest('.mo').remove()">✕</button></div>
  <div class="mc">
    <div style="background:#fee2e2;border-radius:8px;padding:10px 12px;margin-bottom:14px;font-size:13px;color:#dc2626">
      ⚠️ La session sera supprimée. Les vérifications déjà enregistrées dans cette session seront conservées mais dissociées.
    </div>
    <div class="fg"><label>Motif *</label>
      <select id="motif-sess-sel">
        <option value="">-- Choisir --</option>
        <option value="doublon">Session en doublon (test ou erreur)</option>
        <option value="vide">Session vide créée par erreur</option>
        <option value="autre">Autre</option>
      </select>
    </div>
    <div class="fa">
      <button class="btn btn-s" onclick="this.closest('.mo').remove()">Annuler</button>
      <button class="btn" style="background:#dc2626;color:#fff" onclick="confirmerSupprSession('${sessionId}',this)">Supprimer</button>
    </div>
  </div></div>`;
  modal.addEventListener('click',e=>{if(e.target===modal)modal.remove()});
  document.body.appendChild(modal);
}

async function confirmerSupprSession(sessionId, btn){
  const motif=document.getElementById('motif-sess-sel').value;
  if(!motif){toast('Motif obligatoire','err');return}
  btn.disabled=true;btn.textContent='Suppression…';

  // Dissocier les vérifications de cette session
  const {error:e1}=await db.from('verifications').update({session_id:null}).eq('session_id',sessionId);
  if(e1){toast('Erreur dissociation verifs: '+e1.message,'err');btn.disabled=false;btn.textContent='Supprimer';return}

  // Supprimer la session
  const {error:e2,count}=await db.from('sessions_controle').delete().eq('id',sessionId).select();
  if(e2){toast('Erreur suppression: '+e2.message,'err');btn.disabled=false;btn.textContent='Supprimer';return}

  // Vérifier que la suppression a bien eu lieu
  const {data:check}=await db.from('sessions_controle').select('id').eq('id',sessionId).single();
  if(check){
    toast('Suppression bloquée — vérifiez les droits Supabase (RLS)','err');
    btn.disabled=false;btn.textContent='Supprimer';
    return;
  }

  btn.closest('.mo').remove();
  toast('Session supprimée ✓');
  loadVerifs();
}

async function openVerifModal(prefill=null){
  if(!clients.length)await loadClients();
  $('v-client').innerHTML=clients.map(c=>`<option value="${c.id}">${c.raison_sociale}</option>`).join('');
  $('v-id').value='';$('v-date').value=dateLocale(new Date());
  $('v-echeance').value='';$('v-tech').value=`${ME.prenom||''} ${ME.nom}`.trim();
  $('v-resultat').value='conforme';$('v-obs').value='';$('pc-list').innerHTML='';
  if(prefill?.client_id)$('v-client').value=prefill.client_id;
  await onVerifClientChange(prefill);OM('mo-verif');
}
async function onVerifClientChange(prefill=null){
  const cid=$('v-client').value;$('v-equip').innerHTML='<option>Chargement…</option>';$('pc-list').innerHTML='';
  if(!cid)return;
  const {data}=await db.from('equipements').select('id,numero_identification,marque,modele,type_equipement_code,types_equipements(libelle,icone)').eq('client_id',cid).neq('statut','réformé');
  $('v-equip').innerHTML=(data||[]).map(e=>`<option value="${e.id}" data-type="${e.type_equipement_code}">${e.types_equipements?.icone||''} ${e.numero_identification||'?'} — ${e.marque||''} (${e.types_equipements?.libelle||''})</option>`).join('');
  if(prefill?.equipement_id)$('v-equip').value=prefill.equipement_id;
  await onVerifEquipChange();
}
async function onVerifEquipChange(){
  const sel=$('v-equip');const opt=sel.options[sel.selectedIndex];
  if(!opt?.value)return;
  const typeCode=opt.dataset.type;const equipId=sel.value;
  const equip=equipements.find(e=>e.id===equipId);
  $('pc-loading').style.display='block';$('pc-list').innerHTML='';

  const [{data:pts},{data:paliers}]=await Promise.all([
    db.from('points_controle').select('*').eq('type_equipement_code',typeCode).eq('actif',true).order('ordre'),
    db.from('paliers_maintenance').select('*').eq('type_equipement_code',typeCode).eq('actif',true).order('ordre')
  ]);
  $('pc-loading').style.display='none';

  // Calcul et affichage du palier suggéré
  const palierZone = $('palier-zone');
  if(palierZone){
    if(paliers && paliers.length){
      const palierSuggere = calculerPalierSuggereBureau(equip, paliers);
      palierZone.style.display = 'block';
      palierZone.innerHTML = `
        ${palierSuggere?.enRetard ? `<div style="background:#1a1a2e;color:#fff;border-radius:8px;padding:10px 12px;margin-bottom:8px">
          <div style="font-weight:700;font-size:13px">⚠️ OPÉRATION EN RETARD</div>
          <div style="font-size:11px;opacity:.85">${palierSuggere.libelle} aurait dû être faite il y a ${palierSuggere.anneesRetard} an(s)</div>
        </div>` : ''}
        <label>Type d'opération</label>
        <select id="v-palier" style="width:100%;border-color:${palierSuggere?.enRetard?'#1a1a2e':'var(--rouge)'};background:${palierSuggere?.enRetard?'#f3f4f6':'#fdf5f4'};font-weight:600">
          ${paliers.map(p=>`<option value="${p.id}" data-code="${p.code}" data-reinit="${p.reinitialise_compteur}" ${palierSuggere&&p.id===palierSuggere.id?'selected':''}>${p.libelle}${palierSuggere&&p.id===palierSuggere.id?(palierSuggere.enRetard?' (EN RETARD)':' (suggéré)'):''}</option>`).join('')}
        </select>
        ${palierSuggere?.reference_normative?`<div style="font-size:11px;color:var(--txt-l);margin-top:3px">📋 ${palierSuggere.reference_normative}</div>`:''}
      `;
    } else {
      palierZone.style.display = 'none';
      palierZone.innerHTML = '';
    }
  }

  const marque=(equip?.marque||'').toLowerCase();const modele=(equip?.modele||'').toLowerCase();
  const filtered=(pts||[]).filter(p=>{if(!p.marque&&!p.modele)return true;if(p.marque&&marque&&p.marque.toLowerCase()===marque){if(!p.modele)return true;if(p.modele&&modele&&p.modele.toLowerCase()===modele)return true;return false}return false});
  $('pc-list').innerHTML=filtered.map(p=>{
    let inp='';
    if(p.type_reponse==='oui_non')inp=`<div class="pc-radio"><label onclick="selPC(this,'ok','pc-${p.id}')"><input type="radio" name="pc-${p.id}" value="oui">✓ OK</label><label onclick="selPC(this,'nok','pc-${p.id}')"><input type="radio" name="pc-${p.id}" value="non">✗ NON</label></div>`;
    else if(p.type_reponse==='numerique')inp=`<input type="number" step="0.01" id="pcv-${p.id}" class="pc-val-input" placeholder="${p.unite||'valeur'}">`;
    else if(p.type_reponse==='texte')inp=`<input type="text" id="pcv-${p.id}" class="pc-val-input" placeholder="Saisir…">`;
    else if(p.type_reponse==='date')inp=`<input type="date" id="pcv-${p.id}" class="pc-val-input">`;
    return`<div class="pc-item" id="pci-${p.id}" data-id="${p.id}" data-type="${p.type_reponse}"><div class="pc-label">${p.libelle}${p.obligatoire?'<span style="color:var(--rouge)">*</span>':''}</div><div>${inp}</div></div>`;
  }).join('');
}

function calculerPalierSuggereBureau(equip, paliers){
  if(!paliers || !paliers.length) return null;
  const dateRef = equip?.date_derniere_reinitialisation || equip?.date_mise_en_service || equip?.date_fabrication;
  if(!dateRef){
    const p = paliers.find(p => !p.reinitialise_compteur) || paliers[0];
    return {...p, enRetard:false};
  }
  const ageAnnees = (new Date() - new Date(dateRef)) / (365.25 * 86400000);

  const reinitialisants = paliers.filter(p => p.reinitialise_compteur).sort((a,b) => b.intervalle_annees - a.intervalle_annees);
  for(const p of reinitialisants){
    if(ageAnnees >= p.intervalle_annees + 0.17){
      const anneesRetard = ageAnnees - p.intervalle_annees;
      return {...p, enRetard:true, anneesRetard:Math.round(anneesRetard*10)/10};
    }
  }

  const triesDesc = [...paliers].sort((a,b) => b.intervalle_annees - a.intervalle_annees);
  for(const p of triesDesc){
    const ratio = ageAnnees / p.intervalle_annees;
    const resteEntier = Math.abs(ratio - Math.round(ratio));
    if(ratio >= 0.85 && resteEntier <= 0.2 && Math.round(ratio) >= 1){
      return {...p, enRetard:false};
    }
  }
  const simples = paliers.filter(p => !p.reinitialise_compteur);
  if(simples.length) return {...simples.sort((a,b)=>a.intervalle_annees-b.intervalle_annees)[0], enRetard:false};
  return {...paliers[0], enRetard:false};
}

window.selPC=function(lbl,type,name){lbl.closest('.pc-radio').querySelectorAll('label').forEach(l=>l.classList.remove('ok-sel','nok-sel'));lbl.classList.add(type==='ok'?'ok-sel':'nok-sel');const item=lbl.closest('.pc-item');item.classList.remove('ok','nc');item.classList.add(type==='ok'?'ok':'nc')};
async function saveVerif(){
  const cid=$('v-client').value;const eid=$('v-equip').value;const date=$('v-date').value;
  if(!eid||!date){toast('Champs obligatoires manquants','err');return}
  const opt=$('v-equip').options[$('v-equip').selectedIndex];const typeCode=opt?.dataset?.type||'';

  const palierSel=$('v-palier');
  const palierId=palierSel?palierSel.value:null;
  const palierOpt=palierSel?palierSel.options[palierSel.selectedIndex]:null;
  const palierCode=palierOpt?palierOpt.dataset.code:null;
  const reinitialise=palierOpt?palierOpt.dataset.reinit==='true':false;

  const {data:vData,error}=await db.from('verifications').insert({equipement_id:eid,client_id:cid,type_equipement_code:typeCode,date_verification:date,date_prochaine_echeance:$('v-echeance').value||null,technicien:$('v-tech').value.trim(),technicien_id:ME.id,resultat:$('v-resultat').value,observations:$('v-obs').value.trim(),palier_id:palierId||null,palier_code:palierCode||null,reinitialise_compteur:reinitialise}).select().single();
  if(error){toast('Erreur: '+error.message,'err');return}

  if(reinitialise){
    await db.from('equipements').update({date_derniere_reinitialisation:date}).eq('id',eid);
  }

  const items=document.querySelectorAll('.pc-item[data-id]');const resultats=[];
  items.forEach(item=>{
    const pid=item.dataset.id;const tt=item.dataset.type;
    const r={verification_id:vData.id,point_controle_id:pid,libelle_snapshot:item.querySelector('.pc-label').textContent.replace('*','').trim(),type_reponse:tt};
    if(tt==='oui_non'){const s=item.querySelector('label.ok-sel,label.nok-sel');if(s){r.valeur_oui_non=s.classList.contains('ok-sel');r.conforme=r.valeur_oui_non}}
    else if(tt==='numerique'){const v=item.querySelector('input')?.value;if(v)r.valeur_numerique=parseFloat(v)}
    else if(tt==='texte')r.valeur_texte=item.querySelector('input')?.value||'';
    else if(tt==='date')r.valeur_date=item.querySelector('input')?.value||null;
    resultats.push(r);
  });
  if(resultats.length)await db.from('resultats_controle').insert(resultats);

  // Auto-valider le RDV du jour pour ce client si la vérification a lieu aujourd'hui
  if(date===dateLocale(new Date())){
    const {data:rdvDuJour}=await db.from('rdv').select('id').eq('client_id',cid).eq('technicien_id',ME.id).eq('date_rdv',date).neq('statut','annulé').neq('statut','effectué');
    if(rdvDuJour&&rdvDuJour.length){
      await db.from('rdv').update({statut:'effectué',updated_at:new Date().toISOString()}).in('id',rdvDuJour.map(r=>r.id));
    }
  }

  toast('Vérification enregistrée');CM('mo-verif');loadVerifs();
}
async function deleteVerif(id){if(!confirm('Supprimer ?'))return;await db.from('verifications').delete().eq('id',id);toast('Supprimé');loadVerifs()}


// ============================================================
// CONTRATS
// ============================================================
async function loadContrats(){
  if(!clients.length)await loadClients();
  const {data}=await db.from('contrats').select('*,clients(raison_sociale),agences(nom)').order('date_debut',{ascending:false});
  contrats=data||[];renderContrats();
}
function renderContrats(){
  const q=$('q-contrats').value.toLowerCase();
  const fag=$('f-ag-contrats')?$('f-ag-contrats').value:'';
  const data=contrats.filter(c=>(c.numero_contrat+c.clients?.raison_sociale).toLowerCase().includes(q)&&(!fag||c.agences?.code===fag));
  const el=$('tbl-contrats');
  if(!data.length){el.innerHTML='<div class="t-empty">Aucun contrat</div>';return}
  el.innerHTML=`<table><thead><tr><th>N° contrat</th><th>Client</th><th>Agence</th><th>Type</th><th>Fin</th><th>Tarif</th><th>Statut</th><th>Actions</th></tr></thead><tbody>${data.map(c=>`<tr>
    <td><strong>${c.numero_contrat||'—'}</strong></td><td>${c.clients?.raison_sociale||'—'}</td>
    <td><span class="badge bg">${c.agences?.nom||'—'}</span></td><td>${c.type_contrat}</td>
    <td class="${ecClass(c.date_fin)}">${fmt(c.date_fin)}</td>
    <td>${c.tarif_annuel?c.tarif_annuel.toLocaleString('fr-FR',{style:'currency',currency:'EUR'}):'—'}</td>
    <td>${badgeSt(c.statut)}${c.signature_data?` <span class="badge bv" title="Signé le ${fmt(c.signe_le)}">✍</span>`:''}${Array.isArray(c.avenants)&&c.avenants.length?` <span class="badge bb" title="${c.avenants.length} avenant(s)">+${c.avenants.length}</span>`:''}</td>
    <td><div class="ia"><button class="btn btn-s btn-xs" onclick="editContrat('${c.id}')">✏️</button>${!c.signature_data?`<button class="btn btn-s btn-xs" onclick="openSignContrat('${c.id}')" title="Faire signer le client">✍ Signer</button>`:''}<button class="btn btn-s btn-xs" onclick="exportContratPDF('${c.id}')" title="Télécharger le contrat PDF">📄</button><button class="btn btn-s btn-xs" onclick="deleteContrat('${c.id}')">🗑</button></div></td>
  </tr>`).join('')}</tbody></table>`;
}
async function openContratModal(prefill=null){
  if(!clients.length)await loadClients();
  $('ct-client').innerHTML=clients.map(c=>`<option value="${c.id}">${c.raison_sociale}</option>`).join('');
  $('ct-types-grid').innerHTML=typesEquip.map(t=>`<div style="display:flex;align-items:center;gap:8px;font-size:12px;cursor:pointer;padding:8px 10px;border:1px solid #e5e7eb;border-radius:8px;line-height:1.3" onclick="if(event.target.tagName!=='INPUT')this.querySelector('input').click()"><input type="checkbox" name="ct-type" value="${t.code}" style="flex-shrink:0;margin:0;width:16px;height:16px" ${prefill?.types_couverts?.includes(t.code)?'checked':''}><span style="text-transform:none;font-weight:400;color:var(--txt);letter-spacing:normal">${t.icone} ${t.libelle}</span></div>`).join('');
  ['ct-id','ct-num','ct-tarif','ct-notes'].forEach(id=>$(id).value='');$('ct-debut').value='';$('ct-fin').value='';$('ct-type').value='annuel';$('ct-period').value='annuelle';$('ct-statut').value='actif';$('mo-ct-t').textContent='Nouveau contrat';
  if(prefill){$('ct-id').value=prefill.id;$('ct-client').value=prefill.client_id;$('ct-num').value=prefill.numero_contrat||'';$('ct-type').value=prefill.type_contrat||'annuel';$('ct-debut').value=prefill.date_debut||'';$('ct-fin').value=prefill.date_fin||'';$('ct-tarif').value=prefill.tarif_annuel||'';$('ct-period').value=prefill.periodicite_visite||'annuelle';$('ct-statut').value=prefill.statut||'actif';$('ct-notes').value=prefill.notes||'';$('mo-ct-t').textContent='Modifier';}
  _lignesContrat=(prefill&&Array.isArray(prefill.lignes))?[...prefill.lignes]:[];
  renderLignesContrat();
  OM('mo-contrat');
}
function editContrat(id){openContratModal(contrats.find(c=>c.id===id))}

function voirContratsClient(raisonSociale){
  navigate('contrats');
  setTimeout(()=>{$('q-contrats').value=raisonSociale;if($('f-ag-contrats'))$('f-ag-contrats').value='';renderContrats()},300);
}


// Numéro de contrat automatique : CT-<année>-<compteur>
async function prochainNumeroContrat(){
  const prefixe='CT-'+new Date().getFullYear()+'-';
  const {data}=await db.from('contrats').select('numero_contrat').like('numero_contrat',prefixe+'%');
  let max=0;(data||[]).forEach(x=>{const n=parseInt((x.numero_contrat||'').slice(prefixe.length),10);if(n>max)max=n});
  return prefixe+String(max+1).padStart(3,'0');
}

async function saveContrat(){
  const id=$('ct-id').value;
  const coches=Array.from(document.querySelectorAll('input[name="ct-type"]:checked')).map(c=>c.value);
  // Les types présents dans le chiffrage sont automatiquement couverts
  const types=[...new Set([...coches,..._lignesContrat.map(l=>l.type)])];
  const numAuto=$('ct-num').value.trim()||await prochainNumeroContrat();
  const p={client_id:$('ct-client').value,numero_contrat:numAuto,type_contrat:$('ct-type').value,types_couverts:types,lignes:_lignesContrat,date_debut:$('ct-debut').value||null,date_fin:$('ct-fin').value||null,tarif_annuel:parseFloat($('ct-tarif').value)||null,periodicite_visite:$('ct-period').value,statut:$('ct-statut').value,notes:$('ct-notes').value.trim(),updated_at:new Date().toISOString()};
  let error,nouveauContrat=null;
  if(id){({error}=await db.from('contrats').update(p).eq('id',id));}
  else{const r=await db.from('contrats').insert(p).select().single();error=r.error;nouveauContrat=r.data;}
  if(error){toast('Erreur: '+error.message,'err');return}
  let nb=0;
  if(nouveauContrat)nb=await creerEquipementsDepuisContrat(nouveauContrat,_lignesContrat,p.client_id);
  toast(id?'Contrat modifié':'Contrat créé'+(nb?' — '+nb+' équipement(s) ajouté(s) au client':''));
  CM('mo-contrat');loadContrats();
}
async function deleteContrat(id){
  if(!confirm('Supprimer ?'))return;
  const {data,error}=await db.from('contrats').delete().eq('id',id).select();
  if(error){toast('Erreur: '+error.message,'err');return}
  if(!data||!data.length){toast('Suppression refusée par les droits (RLS)','err');return}
  toast('Supprimé');loadContrats();
}



// Unité automatique selon l'agent extincteur : CO2/BC/ABC/D → kg, autres → L
const AGENTS_KG=['CO2','BC','ABC','D'];
document.addEventListener('change',e=>{
  if(!e.target||!e.target.id)return;
  if(e.target.id.endsWith('e-agent')){
    const prefix=e.target.id.slice(0,-'e-agent'.length);
    const u=document.getElementById(prefix+'e-unite');
    const a=e.target.value;
    if(u&&a&&a!=='Autre')u.value=AGENTS_KG.includes(a)?'kg':'L';
  }
});

// ---- Caractéristiques dans les lignes de contrat (bureau) ----
function champsLigneHTML(type,prefix){
  return (CHAMPS_TYPE[type]||[]).map(ch=>{
    const id=prefix+ch.id;
    if(ch.type==='select')return `<div class="fg" style="margin-bottom:12px"><label>${ch.label}</label><select id="${id}"><option value=""></option>${ch.opts.map(o=>`<option>${o}</option>`).join('')}</select></div>`;
    return `<div class="fg" style="margin-bottom:12px"><label>${ch.label}</label><input type="${ch.type==='number'?'number':'text'}" id="${id}" ${ch.step?'step="'+ch.step+'"':''} placeholder="${ch.placeholder||''}"></div>`;
  }).join('');
}
function collecteChampsLigne(type,prefix){
  const caract={};
  (CHAMPS_TYPE[type]||[]).forEach(ch=>{const el=document.getElementById(prefix+ch.id);if(el&&el.value)caract[ch.id]=el.value});
  return caract;
}
function resumeCaract(type,caract){
  caract=caract||{};const out=[];
  (CHAMPS_TYPE[type]||[]).forEach(ch=>{
    if(ch.id==='e-unite')return;
    const v=caract[ch.id];if(!v)return;
    out.push(ch.id==='e-cap'?v+' '+(caract['e-unite']||''):String(v));
  });
  return out.join(' · ');
}
// ---- Création automatique des équipements du client depuis un nouveau contrat ----
async function creerEquipementsDepuisContrat(contrat,lignes,clientId){
  const rows=[];const lignePourRow=[];
  const dateTag=new Date().toISOString().slice(2,10).replace(/-/g,'');
  (lignes||[]).forEach(l=>{
    const q=parseInt(l.quantite,10)||0;const caract=l.caract||{};
    const hist=[];
    if(l.d_verif)hist.push({date:l.d_verif,type:'Vérification annuelle',commentaire:'Constaté à la prise en contrat'});
    if(l.d_maa)hist.push({date:l.d_maa,type:'Maintenance approfondie (MAA)',commentaire:'Constaté à la prise en contrat'});
    if(l.d_rev)hist.push({date:l.d_rev,type:'Révision atelier',commentaire:'Constaté à la prise en contrat'});
    for(let i=0;i<q;i++){
      const num=`${(l.type||'EQ').slice(0,3).toUpperCase()}-${dateTag}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;
      const ds={...caract};delete ds['e-cap'];delete ds['e-unite'];
      rows.push({client_id:clientId,type_equipement_code:l.type,numero_identification:num,
        marque:l.marque||null,modele:l.modele||null,
        capacite_valeur:caract['e-cap']?parseFloat(caract['e-cap']):null,capacite_unite:caract['e-unite']||null,
        donnees_specifiques:ds,statut:'opérationnel',localisation:'',
        date_fabrication:l.annee_fab?l.annee_fab+'-01-01':null,
        historique:hist,
        notes:'Créé depuis le contrat '+(contrat.numero_contrat||'')});
      lignePourRow.push(l);
    }
  });
  if(!rows.length)return 0;
  const {data:crees,error}=await db.from('equipements').insert(rows).select('id');
  if(error){toast('Contrat créé mais erreur équipements : '+error.message,'err');return 0}
  // Vérification antérieure → alimente le calcul des échéances
  const verifs=[];
  (crees||[]).forEach((eq,i)=>{
    const l=lignePourRow[i];
    if(!l||!l.d_verif)return;
    const proch=new Date(l.d_verif);proch.setFullYear(proch.getFullYear()+1);
    verifs.push({equipement_id:eq.id,client_id:clientId,type_equipement_code:l.type,
      date_verification:l.d_verif,date_prochaine_echeance:proch.toISOString().slice(0,10),
      technicien:'Antérieur (prise en contrat)',technicien_id:ME.id,resultat:'conforme',
      realisee_par_bfs:false,observations:'Vérification antérieure constatée à la prise en contrat'});
  });
  if(verifs.length){
    const {error:ev}=await db.from('verifications').insert(verifs);
    if(ev)toast('Équipements créés, mais erreur échéances : '+ev.message,'err');
  }
  return rows.length;
}

// ============================================================
// CONTRAT — LIGNES DE CHIFFRAGE
// ============================================================
let _lignesContrat=[];
function renderLignesContrat(){
  const el=$('ct-lignes-list');if(!el)return;
  if(!_lignesContrat.length){el.innerHTML='<div style="font-size:12px;color:var(--txt-l);padding:4px 0">Aucun équipement chiffré — le repérage se saisit ici.</div>';majTotalContrat();return}
  el.innerHTML='<table style="width:100%;font-size:12px"><thead><tr><th>Équipement</th><th>Marque</th><th>Modèle</th><th style="text-align:center">Qté</th><th style="text-align:right">PU HT</th><th style="text-align:right">Total HT</th><th></th></tr></thead><tbody>'
    +_lignesContrat.map((l,i)=>{
      const t=typesEquip.find(t=>t.code===l.type);
      return `<tr><td>${t?t.icone+' '+t.libelle:l.type}</td><td>${l.marque||'—'}</td><td>${l.modele||'—'}${l.resume?'<br><small style="color:var(--txt-l)">'+l.resume+'</small>':''}</td><td style="text-align:center">${l.quantite}</td><td style="text-align:right">${(+l.pu||0).toFixed(2)} €</td><td style="text-align:right;font-weight:600">${((+l.quantite||0)*(+l.pu||0)).toFixed(2)} €</td><td><button type="button" onclick="supprimerLigneContrat(${i})" style="background:#fee2e2;color:#dc2626;border:none;border-radius:6px;padding:2px 7px;cursor:pointer;font-size:12px">✕</button></td></tr>`;
    }).join('')+'</tbody></table>';
  majTotalContrat();
}
function majTotalContrat(){
  const tot=_lignesContrat.reduce((s,l)=>s+(+l.quantite||0)*(+l.pu||0),0);
  $('ct-total').textContent=_lignesContrat.length?'Total HT : '+tot.toLocaleString('fr-FR',{style:'currency',currency:'EUR'}):'';
  if(_lignesContrat.length)$('ct-tarif').value=tot.toFixed(2);
}
function supprimerLigneContrat(i){_lignesContrat.splice(i,1);renderLignesContrat()}
function ajouterLigneContrat(){
  const modal=document.createElement('div');
  modal.className='mo open';modal.style.zIndex='300';
  modal.innerHTML=`<div class="modal" style="max-width:440px">
    <div class="mh"><h3>Ajouter un équipement au contrat</h3><button class="mclose" onclick="this.closest('.mo').remove()">✕</button></div>
    <div class="mc">
      <div class="fg" style="margin-bottom:12px"><label>Type d'équipement *</label>
        <select id="lc-type" onchange="document.getElementById('lc-marque-modele').innerHTML=marqueModeleHTML(this.value,'lc-');document.getElementById('lc-champs').innerHTML=champsLigneHTML(this.value,'lc-')">${typesEquip.map(t=>`<option value="${t.code}">${t.icone} ${t.libelle}</option>`).join('')}</select></div>
      <div id="lc-marque-modele">${marqueModeleHTML(typesEquip[0]?.code,'lc-')}</div>
      <div id="lc-champs">${champsLigneHTML(typesEquip[0]?.code,'lc-')}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div class="fg"><label>Quantité *</label><input type="number" id="lc-qte" min="1" value="1"></div>
        <div class="fg"><label>Prix unitaire HT (€) *</label><input type="number" id="lc-pu" step="0.01" min="0"></div>
      </div>
      <div style="font-weight:700;font-size:12px;margin:14px 0 8px;text-transform:uppercase;color:var(--txt-l)">Prise en contrat — état constaté</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div class="fg"><label>Année de fabrication</label><input type="number" id="lc-annee" min="1980" max="2100" placeholder="2021"></div>
        <div class="fg"><label>Dernière vérification annuelle</label><input type="date" id="lc-dverif"></div>
        <div class="fg"><label>Dernière MAA</label><input type="date" id="lc-dmaa"></div>
        <div class="fg"><label>Dernière révision / recharge</label><input type="date" id="lc-drev"></div>
      </div>
      <div class="fa" style="margin-top:12px">
        <button class="btn btn-s" onclick="this.closest('.mo').remove()">Annuler</button>
        <button class="btn btn-p" onclick="confirmerLigneContrat(this)">Ajouter</button>
      </div>
    </div>
  </div>`;
  modal.addEventListener('click',e=>{if(e.target===modal)modal.remove()});
  document.body.appendChild(modal);
}
function confirmerLigneContrat(btn){
  const qte=parseInt(document.getElementById('lc-qte').value,10);
  const pu=parseFloat(document.getElementById('lc-pu').value);
  if(!qte||qte<1){toast('Quantité invalide','err');return}
  if(isNaN(pu)||pu<0){toast('Prix unitaire invalide','err');return}
  const typeL=document.getElementById('lc-type').value;
  const caract=collecteChampsLigne(typeL,'lc-');
  const {marque,modele}=lireMarqueModele('lc-');
  const annee=parseInt(document.getElementById('lc-annee').value,10)||null;
  const resume=[resumeCaract(typeL,caract),annee?'fab. '+annee:''].filter(Boolean).join(' · ');
  _lignesContrat.push({type:typeL,marque,modele,quantite:qte,pu:pu,caract,resume,
    annee_fab:annee,d_verif:document.getElementById('lc-dverif').value||null,d_maa:document.getElementById('lc-dmaa').value||null,d_rev:document.getElementById('lc-drev').value||null});
  btn.closest('.mo').remove();renderLignesContrat();
}

// ============================================================
// CONTRAT — SIGNATURE NUMÉRIQUE SUR PLACE
// ============================================================
let _signContratId=null,_sgVide=true;
function openSignContrat(id){
  _signContratId=id;_sgVide=true;$('sg-nom').value='';
  const cv=$('sg-canvas');const ctx=cv.getContext('2d');
  ctx.clearRect(0,0,cv.width,cv.height);
  initSgCanvas();OM('mo-sign-ct');
}
function initSgCanvas(){
  const cv=$('sg-canvas');if(cv._init)return;cv._init=true;
  const ctx=cv.getContext('2d');ctx.lineWidth=2.2;ctx.lineCap='round';ctx.strokeStyle='#1e293b';
  let dessin=false;
  const pos=e=>{const r=cv.getBoundingClientRect();return[(e.clientX-r.left)*cv.width/r.width,(e.clientY-r.top)*cv.height/r.height]};
  cv.addEventListener('pointerdown',e=>{dessin=true;_sgVide=false;const [x,y]=pos(e);ctx.beginPath();ctx.moveTo(x,y);cv.setPointerCapture(e.pointerId)});
  cv.addEventListener('pointermove',e=>{if(!dessin)return;const [x,y]=pos(e);ctx.lineTo(x,y);ctx.stroke()});
  cv.addEventListener('pointerup',()=>dessin=false);
  cv.addEventListener('pointercancel',()=>dessin=false);
}
function effacerSignatureCt(){
  const cv=$('sg-canvas');cv.getContext('2d').clearRect(0,0,cv.width,cv.height);_sgVide=true;
}
async function validerSignatureCt(){
  const nom=$('sg-nom').value.trim();
  if(!nom){toast('Nom du signataire obligatoire','err');return}
  if(_sgVide){toast('Le client doit signer dans le cadre','err');return}
  const dataUrl=$('sg-canvas').toDataURL('image/png');
  const {error}=await db.from('contrats').update({signature_data:dataUrl,signataire_nom:nom,signe_le:new Date().toISOString()}).eq('id',_signContratId);
  if(error){toast('Erreur: '+error.message,'err');return}
  toast('Contrat signé ✓');CM('mo-sign-ct');
  await loadContrats();
  exportContratPDF(_signContratId); // télécharge aussitôt le contrat signé
}


// ============================================================
// UTILISATEURS (admin)
// ============================================================
let users=[];
// ============================================================
// COMMANDES À PRÉVOIR
// ============================================================
async function loadCommandes(){
  const statutFiltre = $('f-statut-cmd').value;

  let q = db.from('vue_anticipation_pieces').select('*').order('date_echeance_calculee');
  const {data: all, error} = await q;
  if(error){console.error('Erreur anticipation:',error);}
  const data = all || [];

  const expirees = data.filter(d => d.statut_anticipation === 'expirée');
  const aCommander = data.filter(d => d.statut_anticipation === 'à_commander');
  const aSurveiller = data.filter(d => d.statut_anticipation === 'à_surveiller');

  $('commandes-stats').innerHTML = `
    <div class="stat-card rouge"><div class="val">${expirees.length}</div><div class="lab">⛔ Expirées</div></div>
    <div class="stat-card orange"><div class="val">${aCommander.length}</div><div class="lab">🔴 À commander</div></div>
    <div class="stat-card bleu"><div class="val">${aSurveiller.length}</div><div class="lab">🟠 À surveiller (90j)</div></div>
  `;

  // Commandes groupées par référence
  const {data: groupees} = await db.from('vue_anticipation_groupee').select('*');
  const elG = $('commandes-groupees');
  if(!groupees || !groupees.length){
    elG.innerHTML = '<div class="t-empty">✅ Aucune commande urgente à prévoir</div>';
  } else {
    elG.innerHTML = `<table><thead><tr><th>Pièce</th><th>Marque</th><th>Référence</th><th>Quantité</th><th>Échéance la plus proche</th><th>Statut</th><th>Clients concernés</th></tr></thead><tbody>${groupees.map(g=>`<tr>
      <td><strong>${g.piece_libelle}</strong></td>
      <td>${g.marque||'—'}</td>
      <td>${g.reference||'—'}</td>
      <td><span class="badge bb">${g.quantite_necessaire}</span></td>
      <td class="${ecClass(g.echeance_la_plus_proche)}">${fmt(g.echeance_la_plus_proche)}</td>
      <td>${g.statut_anticipation==='expirée'?'<span class="badge br">⛔ Expirée</span>':'<span class="badge bo">🔴 À commander</span>'}</td>
      <td style="font-size:12px;color:var(--txt-l)">${(g.clients_concernes||[]).slice(0,3).join(', ')}${(g.clients_concernes||[]).length>3?' +'+((g.clients_concernes||[]).length-3):''}</td>
    </tr>`).join('')}</tbody></table>`;
  }

  // Détail filtré
  const filtered = statutFiltre ? data.filter(d=>d.statut_anticipation===statutFiltre) : data.filter(d=>d.statut_anticipation!=='ok');
  const elD = $('commandes-detail');
  if(!filtered.length){
    elD.innerHTML = '<div class="t-empty">Aucune pièce dans cette catégorie</div>';
  } else {
    elD.innerHTML = `<table><thead><tr><th>Statut</th><th>Pièce</th><th>Équipement</th><th>Client</th><th>Agence</th><th>Réf. depuis</th><th>Échéance</th></tr></thead><tbody>${filtered.map(d=>{
      const badge = d.statut_anticipation==='expirée'?'<span class="badge br">⛔ Expirée</span>':d.statut_anticipation==='à_commander'?'<span class="badge bo">🔴 À commander</span>':'<span class="badge bb">🟠 Surveiller</span>';
      return `<tr${!d.deja_trackee_reellement?' style="opacity:.8"':''}>
        <td>${badge}</td>
        <td><strong>${d.piece_libelle}</strong>${d.reference?'<br><small style="color:var(--txt-l)">'+d.reference+'</small>':''}${!d.deja_trackee_reellement?'<br><small style="color:var(--orange)">estimation</small>':''}</td>
        <td>${d.icone||''} ${d.numero_identification||'—'}<br><small>${d.localisation||''}</small></td>
        <td>${d.raison_sociale}</td>
        <td><span class="badge bg">${d.agence_nom||'—'}</span></td>
        <td>${fmt(d.date_reference)}</td>
        <td class="${ecClass(d.date_echeance_calculee)}">${fmt(d.date_echeance_calculee)}</td>
      </tr>`;
    }).join('')}</tbody></table>`;
  }
}

async function exportCommandesXLS(){
  const {data} = await db.from('vue_commandes_a_prevoir').select('*').order('date_echeance');
  const filtered = (data||[]).filter(d=>d.statut_commande!=='ok');
  if(!filtered.length){toast('Aucune commande à exporter','err');return}
  const rows = filtered.map(d=>({
    'Statut':d.statut_commande,'Pièce':d.libelle,'Référence':d.reference,
    'Équipement':d.numero_identification,'Localisation':d.localisation,
    'Client':d.raison_sociale,'Agence':d.agence_nom,
    'Date pose':fmt(d.date_pose),'Date échéance':fmt(d.date_echeance)
  }));
  const ws=XLSX.utils.json_to_sheet(rows);const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,'Commandes');
  XLSX.writeFile(wb,`BFS_commandes_${new Date().toISOString().slice(0,10)}.xlsx`);
  toast('Export généré');
}

// ============================================================
// BONS D'INTERVENTION
// ============================================================
async function loadBons(){
  const statut = $('f-statut-bons').value;
  let q = db.from('vue_bons_intervention').select('*');
  if(statut) q = q.eq('statut_facturation', statut);
  const {data, error} = await q;
  if(error){console.error('Erreur bons:',error);}
  const bons = data || [];

  const {data:allBons} = await db.from('bons_intervention').select('statut_facturation');
  const aFacturer = (allBons||[]).filter(b=>b.statut_facturation==='à_facturer').length;
  const factures = (allBons||[]).filter(b=>b.statut_facturation==='facturé').length;
  $('bons-stats').innerHTML = `
    <div class="stat-card orange"><div class="val">${aFacturer}</div><div class="lab">À facturer</div></div>
    <div class="stat-card vert"><div class="val">${factures}</div><div class="lab">Facturés</div></div>
    <div class="stat-card bleu"><div class="val">${(allBons||[]).length}</div><div class="lab">Total</div></div>
  `;

  // Fichiers archivés dans Storage :
  //  - bulletin_<bonId>_<ts>.pdf : bulletin simple régénéré
  //  - rapport_<bonId>_<ts>.pdf  : bulletin détaillé
  //  (le PDF signé d'origine reste pointé par pdf_url et n'est jamais touché)
  const {data:archFiles}=await db.storage.from('bons-intervention').list('',{limit:1000});
  const rapports={},bulletins={};
  (archFiles||[]).forEach(f=>{
    if(f.name.startsWith('rapport_'))rapports[f.name.slice(8,44)]=f.name;
    if(f.name.startsWith('bulletin_'))bulletins[f.name.slice(9,45)]=f.name;
  });
  const urlArch=n=>db.storage.from('bons-intervention').getPublicUrl(n).data.publicUrl;

  const el = $('bons-list');
  if(!bons.length){el.innerHTML='<div class="t-empty">Aucun bon d\'intervention</div>';return}
  el.innerHTML = `<table><thead><tr><th>N° Session</th><th>Date</th><th>Client</th><th>Agence</th><th>Technicien</th><th>Équip.</th><th>Signataire</th><th>Statut</th><th>Actions</th></tr></thead><tbody>${bons.map(b=>`<tr>
    <td style="font-weight:700;color:var(--rouge);white-space:nowrap">${b.numero_session||'—'}</td>
    <td>${fmt(b.date_intervention)}</td>
    <td><strong>${b.raison_sociale}</strong><br><small style="color:var(--txt-l)">${b.ville||''}</small></td>
    <td><span class="badge bg">${b.agence_nom||'—'}</span></td>
    <td>${b.tech_prenom||''} ${b.tech_nom||''}</td>
    <td>${b.nb_equipements_verifies}</td>
    <td>${b.signataire_nom||'—'}</td>
    <td>${b.statut_facturation==='facturé'?'<span class="badge bv">Facturé</span>':'<span class="badge bo">À facturer</span>'}</td>
    <td><div class="ia">
      ${b.pdf_url&&!(b.pdf_url.includes('bon_regen_')||b.pdf_url.includes('bulletin_'))?`<a class="btn btn-s btn-xs" href="${b.pdf_url}" target="_blank" title="PDF d'origine signé sur le terrain — jamais modifié">✍ Signé</a>`:''}
      ${bulletins[b.id]?`<a class="btn btn-s btn-xs" href="${urlArch(bulletins[b.id])}" target="_blank">📄 Bulletin</a>`:(b.pdf_url&&b.pdf_url.includes('bon_regen_')?`<a class="btn btn-s btn-xs" href="${b.pdf_url}" target="_blank">📄 Bulletin</a>`:'')}
      ${rapports[b.id]?`<a class="btn btn-s btn-xs" href="${urlArch(rapports[b.id])}" target="_blank">📋 Détaillé</a>`:''}
      <button class="btn btn-s btn-xs" onclick="actualiserBon('${b.id}')" title="(Re)générer le bulletin simple ET le bulletin détaillé — ne touche pas au PDF signé">🔄</button>
      ${b.statut_facturation==='à_facturer'?`<button class="btn btn-s btn-xs" onclick="marquerFacture('${b.id}')">✓ Facturé</button>`:''}
    </div></td>
  </tr>`).join('')}</tbody></table>`;
}



// ---- Export facturation : bons à facturer + pièces/accessoires posés ----
async function exportFacturationXLS(){
  toast('Préparation de l\'export…');
  const {data:bons,error}=await db.from('bons_intervention')
    .select('*,clients(raison_sociale,ville,agences(nom)),profils(nom,prenom)')
    .eq('statut_facturation','à_facturer').order('date_intervention');
  if(error){toast('Erreur : '+error.message,'err');return}
  const sessIds=(bons||[]).map(b=>b.session_id).filter(Boolean);
  let lignesPieces=[];
  if(sessIds.length){
    const {data:verifs}=await db.from('verifications')
      .select('session_id,pieces_utilisees,equipements(numero_identification)')
      .in('session_id',sessIds).not('pieces_utilisees','is',null);
    const bonParSession={};(bons||[]).forEach(b=>{if(b.session_id)bonParSession[b.session_id]=b});
    const {data:sp}=await db.from('stock_pieces').select('id,prix_vente');
    const prix={};(sp||[]).forEach(x=>prix[x.id]=parseFloat(x.prix_vente)||null);
    (verifs||[]).forEach(v=>{
      const bon=bonParSession[v.session_id];if(!bon)return;
      (Array.isArray(v.pieces_utilisees)?v.pieces_utilisees:[]).forEach(u=>{
        const pu=prix[u.piece_id];
        lignesPieces.push({
          'N° bon':bon.numero_session||'','Client':bon.clients?.raison_sociale||'',
          'Équipement':v.equipements?.numero_identification||'',
          'Code pièce':u.code,'Désignation':u.designation,
          'Type':u.accessoire?'Accessoire (facturé en +)':'Pièce détachée',
          'Quantité':u.quantite,'PU vente HT':pu??'à renseigner',
          'Total HT':pu!=null?+(pu*u.quantite).toFixed(2):''
        });
      });
    });
  }
  const ws1=XLSX.utils.json_to_sheet((bons||[]).map(b=>({
    'N° bon':b.numero_session||'','Date':fmt(b.date_intervention),
    'Client':b.clients?.raison_sociale||'','Ville':b.clients?.ville||'',
    'Agence':b.clients?.agences?.nom||'','Technicien':`${b.profils?.prenom||''} ${b.profils?.nom||''}`.trim(),
    'Équipements vérifiés':b.nb_equipements_verifies,'Signataire':b.signataire_nom||''
  })));
  const ws2=XLSX.utils.json_to_sheet(lignesPieces.length?lignesPieces:[{'Info':'Aucune pièce/accessoire posé sur les bons à facturer'}]);
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws1,'Bons à facturer');
  XLSX.utils.book_append_sheet(wb,ws2,'Pièces & accessoires');
  XLSX.writeFile(wb,'BFS_facturation_'+new Date().toISOString().slice(0,10)+'.xlsx');
  toast((bons||[]).length+' bon(s) exportés pour facturation');
}

async function marquerFacture(id){
  await db.from('bons_intervention').update({statut_facturation:'facturé',facture_le:new Date().toISOString(),facture_par:ME.id}).eq('id',id);
  toast('Marqué comme facturé');
  loadBons();
}

async function loadAudit(){
  const table=$('f-audit-table').value;
  const action=$('f-audit-action').value;
  let q=db.from('vue_audit_log').select('*').limit(200);
  if(table) q=q.eq('table_name',table);
  if(action) q=q.eq('action',action);
  const {data,error}=await q;
  const el=$('tbl-audit');
  if(error){el.innerHTML=`<div class="t-empty">Erreur: ${error.message}</div>`;return}
  const logs=data||[];
  if(!logs.length){el.innerHTML='<div class="t-empty">Aucune action enregistrée</div>';return}
  window.__auditLogs=logs;

  const badgeAction=a=>a==='DELETE'?'<span class="badge br">🗑 Suppression</span>':a==='INSERT'?'<span class="badge bv">✚ Création</span>':'<span class="badge bo">✎ Modification</span>';

  el.innerHTML=`<table><thead><tr><th>Date</th><th>Action</th><th>Table</th><th>Utilisateur</th><th>Résumé</th><th>Détail</th></tr></thead><tbody>${logs.map((l,i)=>`<tr>
    <td style="white-space:nowrap;font-size:12px">${new Date(l.created_at).toLocaleString('fr-FR')}</td>
    <td>${badgeAction(l.action)}</td>
    <td style="font-size:12px;color:var(--txt-l)">${l.table_name}</td>
    <td>${l.utilisateur||'—'}<br><small style="color:var(--txt-l)">${l.user_role||''}</small></td>
    <td style="font-size:12px">${l.resume||'—'}</td>
    <td><button class="btn btn-s btn-xs" onclick="showAuditDetail(${i})">👁</button></td>
  </tr>`).join('')}</tbody></table>`;
}

function showAuditDetail(idx){
  const l=window.__auditLogs[idx];if(!l)return;
  // old_data / new_data : Supabase renvoie du jsonb déjà parsé (objet),
  // mais certaines lignes peuvent contenir une chaîne → on gère les deux.
  const asObj=d=>{if(!d)return null;if(typeof d==='string'){try{return JSON.parse(d)}catch(e){return {valeur:d}}}return d};
  const modal=document.createElement('div');
  modal.className='mo open';
  modal.innerHTML=`<div class="modal" style="max-width:600px"><div class="mh"><h3>Détail de l'action</h3><button class="mclose" onclick="this.closest('.mo').remove()">✕</button></div><div class="mc">
    <div style="margin-bottom:8px"><strong>Table :</strong> ${l.table_name} · <strong>Action :</strong> ${l.action} · <strong>Par :</strong> ${l.utilisateur||'?'} (${l.user_role||'?'})</div>
    ${l.old_data?`<div class="sec">Avant</div><pre style="background:var(--bg);padding:10px;border-radius:8px;font-size:11px;overflow:auto;max-height:200px">${JSON.stringify(asObj(l.old_data),null,2)}</pre>`:''}
    ${l.new_data?`<div class="sec">Après</div><pre style="background:var(--bg);padding:10px;border-radius:8px;font-size:11px;overflow:auto;max-height:200px">${JSON.stringify(asObj(l.new_data),null,2)}</pre>`:''}
  </div></div>`;
  modal.addEventListener('click',e=>{if(e.target===modal)modal.remove()});
  document.body.appendChild(modal);
}

async function loadUsers(){
  const {data}=await db.from('profils').select('*,agences(nom)').order('nom');
  users=data||[];renderUsers();
}
function renderUsers(){
  const q=$('q-users').value.toLowerCase();
  const data=users.filter(u=>(u.nom+u.prenom+u.email).toLowerCase().includes(q));
  const el=$('tbl-users');if(!data.length){el.innerHTML='<div class="t-empty">Aucun utilisateur</div>';return}
  const rl={admin:'Administrateur',secretariat:'Secrétariat',technicien:'Technicien'};
  const vb={perso:'<span class="badge bg">Perso</span>',perso_agence:'<span class="badge bb">Perso+agence</span>',tout:'<span class="badge bvi">Tout</span>'};
  el.innerHTML=`<table><thead><tr><th>Nom</th><th>Email</th><th>Rôle</th><th>Agence</th><th>Visibilité</th><th>Actif</th><th>Actions</th></tr></thead><tbody>${data.map(u=>`<tr>
    <td><strong>${u.prenom||''} ${u.nom}</strong></td><td>${u.email||'—'}</td>
    <td><span class="badge ${u.role==='admin'?'br':u.role==='secretariat'?'bvi':'bb'}">${rl[u.role]||u.role}</span></td>
    <td>${u.agences?.nom||'—'}</td><td>${u.role==='technicien'?vb[u.visibilite]||'—':'—'}</td>
    <td>${u.actif?'<span class="badge bv">Oui</span>':'<span class="badge bg">Non</span>'}</td>
    <td><div class="ia"><button class="btn btn-s btn-xs" onclick="editUser('${u.id}')">✏️</button><button class="btn btn-s btn-xs" onclick="toggleUser('${u.id}',${u.actif})">${u.actif?'⏸':'▶'}</button></div></td>
  </tr>`).join('')}</tbody></table>`;
}
function openUserModal(prefill=null){
  ['u-id','u-prenom','u-nom','u-email'].forEach(id=>$(id).value='');
  $('u-role').value='technicien';$('u-agence').value='';$('u-visibilite').value='perso';
  $('mo-u-t').textContent='Inviter un utilisateur';$('btn-save-user').textContent='Inviter';
  toggleVisibilite();if(prefill){$('u-id').value=prefill.id;$('u-prenom').value=prefill.prenom||'';$('u-nom').value=prefill.nom||'';$('u-email').value=prefill.email||'';$('u-role').value=prefill.role;$('u-agence').value=prefill.agence_id||'';$('u-visibilite').value=prefill.visibilite||'perso';$('mo-u-t').textContent='Modifier l\'utilisateur';$('btn-save-user').textContent='Enregistrer';toggleVisibilite();}
  OM('mo-user');
}
function editUser(id){openUserModal(users.find(u=>u.id===id))}
function toggleVisibilite(){$('fg-visibilite').style.display=$('u-role').value==='technicien'?'flex':'none'}
async function saveUser(){
  const id=$('u-id').value;const nom=$('u-nom').value.trim();
  if(!nom){toast('Nom obligatoire','err');return}
  const p={nom,prenom:$('u-prenom').value.trim(),role:$('u-role').value,agence_id:$('u-agence').value||null,visibilite:$('u-visibilite').value,updated_at:new Date().toISOString()};
  const {error}=await db.from('profils').update(p).eq('id',id);
  if(error){toast('Erreur: '+error.message,'err');return}
  toast('Utilisateur modifié');CM('mo-user');loadUsers();
}
async function toggleUser(id,actif){await db.from('profils').update({actif:!actif}).eq('id',id);toast(actif?'Désactivé':'Activé');loadUsers()}

// ============================================================
// CONFIG POINTS DE CONTRÔLE
// ============================================================
async function loadConfigPage(){
  const tc=$('f-type-config').value;const marque=$('f-marque-config').value.trim();
  $('btn-add-pt').style.display=tc?'inline-flex':'none';
  if(!tc){$('tbl-points').innerHTML='<div class="t-empty">Sélectionnez un type</div>';return}
  $('tbl-points').innerHTML='<div class="loading"><span class="spin"></span></div>';
  const {data}=await db.from('points_controle').select('*').eq('type_equipement_code',tc).order('ordre');
  pointsControle=data||[];
  const filtered=marque?pointsControle.filter(p=>!p.marque||(p.marque.toLowerCase().includes(marque.toLowerCase()))):pointsControle;
  const tl={oui_non:'Oui/Non',numerique:'Numérique',texte:'Texte',date:'Date'};const el=$('tbl-points');
  if(!filtered.length){el.innerHTML='<div class="t-empty">Aucun point. Cliquez "+ Ajouter".</div>';return}
  el.innerHTML=`<table><thead><tr><th>Ordre</th><th>Libellé</th><th>Type</th><th>Unité</th><th>Marque</th><th>Modèle</th><th>Oblig.</th><th>Actif</th><th>Actions</th></tr></thead><tbody>${filtered.map(p=>`<tr style="${!p.actif?'opacity:.5':''}">
    <td>${p.ordre}</td><td><strong>${p.libelle}</strong></td><td><span class="badge bb">${tl[p.type_reponse]||p.type_reponse}</span></td>
    <td>${p.unite||'—'}</td><td>${p.marque||'<span style="color:var(--txt-l)">tous</span>'}</td>
    <td>${p.modele||'<span style="color:var(--txt-l)">tous</span>'}</td>
    <td>${p.obligatoire?'<span class="badge bv">Oui</span>':'<span class="badge bg">Non</span>'}</td>
    <td>${p.actif?'<span class="badge bv">Oui</span>':'<span class="badge bg">Non</span>'}</td>
    <td><div class="ia"><button class="btn btn-s btn-xs" onclick="editPoint('${p.id}')">✏️</button><button class="btn btn-s btn-xs" onclick="togglePoint('${p.id}',${p.actif})">${p.actif?'⏸':'▶'}</button><button class="btn btn-s btn-xs" onclick="deletePoint('${p.id}')">🗑</button></div></td>
  </tr>`).join('')}</tbody></table>`;
}
function openPointModal(prefill=null){
  const tc=$('f-type-config').value;if(!tc){toast('Sélectionnez un type','err');return}
  ['pt-id','pt-libelle','pt-unite','pt-marque','pt-modele'].forEach(id=>$(id).value='');
  $('pt-type-rep').value='oui_non';$('pt-ordre').value=99;$('pt-oblig').value='true';$('mo-pt-t').textContent='Nouveau point';toggleUnite();
  if(prefill){$('pt-id').value=prefill.id;$('pt-libelle').value=prefill.libelle||'';$('pt-type-rep').value=prefill.type_reponse;$('pt-unite').value=prefill.unite||'';$('pt-marque').value=prefill.marque||'';$('pt-modele').value=prefill.modele||'';$('pt-ordre').value=prefill.ordre||99;$('pt-oblig').value=String(prefill.obligatoire);$('mo-pt-t').textContent='Modifier';toggleUnite();}
  OM('mo-point');
}
function editPoint(id){openPointModal(pointsControle.find(p=>p.id===id))}
function toggleUnite(){$('fg-unite-pt').style.display=$('pt-type-rep').value==='numerique'?'flex':'none'}
async function savePoint(){
  const id=$('pt-id').value;const tc=$('f-type-config').value;
  const p={type_equipement_code:tc,libelle:$('pt-libelle').value.trim(),type_reponse:$('pt-type-rep').value,unite:$('pt-unite').value.trim()||null,marque:$('pt-marque').value.trim()||null,modele:$('pt-modele').value.trim()||null,ordre:parseInt($('pt-ordre').value)||99,obligatoire:$('pt-oblig').value==='true',actif:true};
  if(!p.libelle){toast('Libellé obligatoire','err');return}
  const {error}=id?await db.from('points_controle').update(p).eq('id',id):await db.from('points_controle').insert(p);
  if(error){toast('Erreur: '+error.message,'err');return}
  toast(id?'Modifié':'Ajouté');CM('mo-point');loadConfigPage();
}
async function togglePoint(id,actif){await db.from('points_controle').update({actif:!actif}).eq('id',id);toast(actif?'Désactivé':'Activé');loadConfigPage()}
async function deletePoint(id){if(!confirm('Supprimer ?'))return;await db.from('points_controle').delete().eq('id',id);toast('Supprimé');loadConfigPage()}

// ============================================================
// CHAMPS CONDITIONNELS PAR TYPE D'ÉQUIPEMENT
// ============================================================
const CHAMPS_TYPE = {
  extincteur: [
    {id:'e-agent',label:'Agent extincteur',type:'select',opts:['CO2','BC','ABC','D','A','AB','ABF','A lith','Autre']},
    {id:'e-cap',label:'Capacité',type:'number',placeholder:'6',step:'0.5'},
    {id:'e-unite',label:'Unité',type:'select',opts:['kg','L']},
    {id:'e-pression',label:'Pression nominale (bar)',type:'number',placeholder:'15',step:'0.5'},
  ],
  ria: [
    {id:'e-diametre',label:'Diamètre tuyau (mm)',type:'select',opts:['19','25','33']},
    {id:'e-longueur',label:'Longueur tuyau (m)',type:'select',opts:['20','30']},
    {id:'e-dmf',label:'Type de DMF',type:'select',opts:['A','B','A/HT','Sans DMF']},
    {id:'e-pression-stat',label:'Pression statique (bar)',type:'number',placeholder:'3.5',step:'0.1'},
    {id:'e-pression-dyn',label:'Pression dynamique (bar)',type:'number',placeholder:'2.5',step:'0.1'},
  ],
  baes: [
    {id:'e-type-baes',label:'Type BAES',type:'select',opts:['BAES standard','BAEH (habitation)','BAES SA (autotest)','Bloc de secours']},
    {id:'e-autonomie',label:'Autonomie',type:'select',opts:['1h','3h','8h']},
    {id:'e-type-batt',label:'Type batterie',type:'select',opts:['NiCd','NiMH','Li-Ion','Pb']},
    {id:'e-flux',label:'Flux lumineux (lm)',type:'number',placeholder:'80',step:'10'},
  ],
  alarme_t4: [
    {id:'e-alim',label:'Alimentation',type:'select',opts:['Piles','Accumulateurs','Secteur + piles','Secteur + accus']},
    {id:'e-nb-declencheurs',label:'Nb déclencheurs manuels',type:'number',placeholder:'1',step:'1'},
    {id:'e-nb-sirenes',label:'Nb sirènes / avertisseurs',type:'number',placeholder:'1',step:'1'},
  ],
  detecteur: [
    {id:'e-type-det',label:'Type détecteur',type:'select',opts:['Optique fumée','Ionique fumée','Thermique fixe','Thermo-vélocimétrique','Gaz','Flamme','Multi-critères']},
    {id:'e-num-centrale',label:'N° adresse centrale',type:'text',placeholder:'Zone 1 - Détect. 03'},
  ],
  pco: [
    {id:'e-classement',label:'Classement coupe-feu',type:'select',opts:['EI15','EI30','EI45','EI60','EI90','EI120','EI180','EI240','E30','E60','REI60','REI120']},
    {id:'e-type-porte',label:'Type',type:'select',opts:['Porte pivotante 1 vantail','Porte pivotante 2 vantaux','Porte coulissante','Trappe de désenfumage','Volet coupe-feu','Cloison CF']},
    {id:'e-ferme-auto',label:'Fermeture automatique',type:'select',opts:['Électromagnétique','À ressort','Motorisée','Non']},
  ],
  vgp_nacelle: [
    {id:'e-type-nacelle',label:'Type de nacelle',type:'select',opts:['Ciseaux électrique','Ciseaux diesel','Articulée électrique','Articulée diesel','Télescopique','Sur camion','Sur remorque']},
    {id:'e-hauteur',label:'Hauteur de travail max (m)',type:'number',placeholder:'12',step:'0.5'},
    {id:'e-cap',label:'Charge max (kg)',type:'number',placeholder:'200',step:'10'},
    {id:'e-energie',label:'Énergie',type:'select',opts:['Électrique','Diesel','Hybride','GPL']},
  ],
  vgp_engin: [
    {id:'e-type-engin',label:"Type d'engin",type:'select',opts:['Chariot élévateur frontal','Chariot télescopique','Pelle hydraulique','Mini-pelle','Chargeuse','Tombereau','Compacteur','Autre']},
    {id:'e-ptac',label:'PTAC (tonnes)',type:'number',placeholder:'3.5',step:'0.5'},
    {id:'e-cap',label:'Capacité de levage (t)',type:'number',placeholder:'1.5',step:'0.1'},
    {id:'e-energie',label:'Énergie',type:'select',opts:['Diesel','Électrique','Gaz','Hybride']},
  ],
  vgp_antichute: [
    {id:'e-type-ac',label:"Type d'équipement",type:'select',opts:['Harnais complet','Longe double absorbeur','Longe simple','Absorbeur énergie','Enrouleur rappel auto','Ligne de vie horizontale','Connecteur / Mousqueton']},
    {id:'e-norme',label:'Norme CE',type:'select',opts:['EN 361 (harnais)','EN 358 (maintien)','EN 354 (longe)','EN 355 (absorbeur)','EN 360 (enrouleur)','EN 362 (connecteur)','EN 363 (système)']},
    {id:'e-date-limite',label:'Date limite utilisation',type:'date'},
  ],
};

let _equipRestoreData = {};
let _champPersoCount = 0;

function onEquipTypeChange(){
  const code = document.getElementById('e-type').value;
  const mmDiv=document.getElementById('e-marque-modele');
  if(mmDiv){
    const {marque:mAv,modele:moAv}=mmDiv.innerHTML?lireMarqueModele('e-'):{marque:'',modele:''};
    mmDiv.innerHTML=marqueModeleHTML(code,'e-');
    if(mAv||moAv)setMarqueModele(code,'e-',mAv,moAv);
  }
  const container = document.getElementById('e-champs-specifiques');
  if(!container) return;
  container.innerHTML = '';
  _champPersoCount = 0;
  const champs = CHAMPS_TYPE[code] || [
    {id:'e-cap',label:'Capacité',type:'number',placeholder:'',step:'1'},
    {id:'e-unite',label:'Unité',type:'text',placeholder:'kg, L, m…'},
  ];
  champs.forEach(c => {
    const div = document.createElement('div');
    div.className = 'fg';
    let input = '';
    if(c.type === 'select'){
      input = '<select id="'+c.id+'"><option value="">— Sélectionner —</option>'+(c.opts||[]).map(o=>'<option value="'+o+'">'+o+'</option>').join('')+'</select>';
    } else {
      input = '<input type="'+c.type+'" id="'+c.id+'" placeholder="'+(c.placeholder||'')+'" '+(c.step?'step="'+c.step+'"':'')+'>';
    }
    div.innerHTML = '<label>'+c.label+'</label>'+input;
    container.appendChild(div);
  });
  // Zone champs personnalisés
  const zonePerso = document.createElement('div');
  zonePerso.style.cssText = 'grid-column:1/-1;border-top:1px dashed #e5e7eb;padding-top:12px;margin-top:4px';
  zonePerso.innerHTML = '<div style="font-size:11px;font-weight:700;color:var(--txt-l);text-transform:uppercase;letter-spacing:.4px;margin-bottom:8px">Champs personnalisés</div><div id="e-champs-perso"></div><button type="button" onclick="ajouterChampPerso()" class="btn btn-s btn-sm" style="margin-top:6px">+ Ajouter un champ</button>';
  container.appendChild(zonePerso);
  restoreEquipValues();
  if(_equipRestoreData['_perso']){
    try{((_equipRestoreData['_perso'])||[]).forEach(p=>ajouterChampPerso(p.label,p.value));}catch(e){}
  }
}

function ajouterChampPerso(label, value){
  label = label||''; value = value||'';
  const zone = document.getElementById('e-champs-perso');
  if(!zone) return;
  const i = ++_champPersoCount;
  const div = document.createElement('div');
  div.id = 'cp-row-'+i;
  div.style.cssText = 'display:grid;grid-template-columns:1fr 2fr auto;gap:8px;align-items:center;margin-bottom:6px';
  div.innerHTML = `<input type="text" id="cp-label-${i}" placeholder="Libellé (ex: Couleur)" value="${label}" style="padding:6px 10px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:13px"><input type="text" id="cp-value-${i}" placeholder="Valeur" value="${value}" style="padding:6px 10px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:13px"><button type="button" onclick="document.getElementById('cp-row-${i}').remove()" style="padding:5px 8px;background:#fee2e2;color:#dc2626;border:none;border-radius:6px;cursor:pointer;font-size:16px">✕</button>`;
  zone.appendChild(div);
}

function getChampsPerso(){
  const result = [];
  document.querySelectorAll('[id^="cp-row-"]').forEach(row => {
    const i = row.id.split('-')[2];
    const lbl = document.getElementById('cp-label-'+i);
    const val = document.getElementById('cp-value-'+i);
    if(lbl && lbl.value.trim()) result.push({label:lbl.value.trim(), value:(val?val.value.trim():'')});
  });
  return result;
}

function restoreEquipValues(){
  const d = _equipRestoreData;
  if(!d || !Object.keys(d).length) return;
  const ids = ['e-cap','e-unite','e-fab','e-mis','e-agent','e-pression','e-longueur',
    'e-diametre','e-dmf','e-autonomie','e-type-batt','e-flux','e-alim',
    'e-nb-declencheurs','e-nb-sirenes','e-type-det','e-num-centrale',
    'e-classement','e-type-porte','e-ferme-auto','e-type-nacelle','e-hauteur',
    'e-energie','e-type-engin','e-ptac','e-type-ac','e-norme',
    'e-date-limite','e-type-baes'];
  ids.forEach(id=>{const el=document.getElementById(id);if(el&&d[id])el.value=d[id];});
}

function getEquipSpecificData(){
  const data = {};
  const ids = ['e-cap','e-unite','e-fab','e-mis','e-agent','e-pression','e-longueur',
    'e-diametre','e-dmf','e-autonomie','e-type-batt','e-flux','e-alim',
    'e-nb-declencheurs','e-nb-sirenes','e-type-det','e-num-centrale',
    'e-classement','e-type-porte','e-ferme-auto','e-type-nacelle','e-hauteur',
    'e-energie','e-type-engin','e-ptac','e-type-ac','e-norme',
    'e-date-limite','e-type-baes'];
  ids.forEach(id=>{const el=document.getElementById(id);if(el&&el.value)data[id]=el.value;});
  const perso = getChampsPerso();
  if(perso.length) data['_perso'] = perso;
  return data;
}



// ============================================================
// STOCK PIÈCES — CONSULTATION, IMPORT EXCEL, CASSE, RAPPORTS
// ============================================================
let stockPieces=[],_stockInventaires=[],_stockMouvements=[],_stockAgences=[],_stockAgFiltre='';

async function loadStock(){
  const ftype=$('f-type-mvt')?$('f-type-mvt').value:'';
  let qm=db.from('stock_mouvements').select('*,stock_pieces(code,designation),profils(nom,prenom),agences!stock_mouvements_agence_id_fkey(nom)').order('created_at',{ascending:false}).limit(80);
  if(ftype)qm=qm.eq('type',ftype);
  const [{data:p,error:e1},{data:inv},{data:mv},{data:ags}]=await Promise.all([
    db.from('stock_pieces').select('*,agences(nom,code)').order('designation'),
    db.from('stock_inventaires').select('*,profils(nom,prenom),agences(nom)').order('demarre_le',{ascending:false}).limit(20),
    qm,
    db.from('agences').select('*').order('nom')
  ]);
  if(e1){$('tbl-stock').innerHTML='<div class="t-empty">Erreur : '+e1.message+'<br><small>Les tables de stock ont-elles été créées dans Supabase ?</small></div>';return}
  stockPieces=p||[];_stockInventaires=inv||[];_stockMouvements=mv||[];_stockAgences=ags||[];
  // Onglets agences
  const tabs=$('stock-ag-tabs');
  if(tabs)tabs.innerHTML=`<button class="ag-tab ${_stockAgFiltre===''?'active':''}" onclick="stockSetAgence(this,'')">🌍 Toutes</button>`+_stockAgences.map(a=>`<button class="ag-tab ${_stockAgFiltre===a.id?'active':''}" onclick="stockSetAgence(this,'${a.id}')">📍 ${a.nom}</button>`).join('');
  // Select agence du modal pièce + transfert
  const opts='<option value="">— Sans agence —</option>'+_stockAgences.map(a=>`<option value="${a.id}">${a.nom}</option>`).join('');
  if($('pc-agence'))$('pc-agence').innerHTML=opts;
  if($('tf-dest'))$('tf-dest').innerHTML=_stockAgences.map(a=>`<option value="${a.id}">${a.nom}</option>`).join('');
  renderStock();renderInventaires();renderMouvements();
  chargerPrevision();
}
window.stockSetAgence=function(btn,id){
  _stockAgFiltre=id;
  btn.parentElement.querySelectorAll('.ag-tab').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  renderStock();renderPrevision();
}

function compatTxt(p){
  if(p.categorie==='accessoire')return '🏷 Accessoire';
  if(p.compatible_tous)return '✅ Tous extincteurs';
  const comp=Array.isArray(p.compatibilites)?p.compatibilites:[];
  const base=[p.marque,p.modele].filter(Boolean).join(' ');
  const all=[base,...comp.map(x=>x.marque+(x.modele?' '+x.modele:' (tous)'))].filter(Boolean);
  return all.length?all.join(' · '):'—';
}
function renderStock(){
  const q=($('q-stock').value||'').toLowerCase();
  const data=stockPieces.filter(p=>
    (!_stockAgFiltre||p.agence_id===_stockAgFiltre)&&
    (p.code+' '+p.designation+' '+compatTxt(p)).toLowerCase().includes(q));
  const el=$('tbl-stock');
  if(!data.length){el.innerHTML='<div class="t-empty">Aucune pièce — importe un fichier Excel ou ajoute une pièce.</div>';return}
  el.innerHTML=`<table><thead><tr><th>Code</th><th>Désignation</th><th>Compatible avec</th><th>Agence</th><th style="text-align:center">Quantité</th><th>Dernière maj</th><th>Actions</th></tr></thead><tbody>${data.map(p=>{
    const alerte=(+p.seuil_alerte||0)>0&&(+p.quantite)<=(+p.seuil_alerte);
    return `<tr>
    <td><strong>${p.code}</strong></td>
    <td style="display:flex;align-items:center;gap:8px">${p.photo_url?`<img src="${p.photo_url}" style="width:36px;height:36px;object-fit:cover;border-radius:6px;cursor:zoom-in" onclick="window.open('${p.photo_url}','_blank')">`:''}${p.designation}</td>
    <td style="font-size:12px;color:var(--txt-l)">${compatTxt(p)}</td>
    <td><span class="badge bg">${p.agences?.nom||'—'}</span></td>
    <td style="text-align:center;font-weight:700;${alerte?'color:#dc2626':''}">${p.quantite}${alerte?' ⚠':''}
      ${p.gestion_peremption&&Array.isArray(p.lots)&&p.lots.length?'<div style="font-weight:400;font-size:11px;margin-top:2px">'+p.lots.map(l=>{const e=lotEtat(l.peremption);return `<div style="color:${lotCouleur[e]}">${e==='perime'?'⛔':e==='proche'?'⏰':''} ${fmtLot(l.peremption)} : ${l.quantite}</div>`}).join('')+'</div>':''}
    </td>
    <td style="font-size:12px">${fmt(p.updated_at)}</td>
    <td><div class="ia">
      <button class="btn btn-s btn-xs" onclick="editPiece('${p.id}')">✏️</button>
      <button class="btn btn-s btn-xs" onclick="showQR('${p.id}','${p.code}','${(p.designation||'').replace(/'/g,"\\'")}','Pièce détachée')" title="QR code à imprimer et coller sur le bac">QR</button>
      <button class="btn btn-s btn-xs" onclick="openTransfertModal('${p.id}')" title="Transférer vers une autre agence">⇄</button>
      <button class="btn btn-s btn-xs" onclick="openCasseModal('${p.id}')" title="Sortir du matériel périmé ou inutilisable">🔻 Casse</button>
      <button class="btn btn-s btn-xs" onclick="deletePiece('${p.id}')">🗑</button>
    </div></td></tr>`}).join('')}</tbody></table>`;
}

let _compatPiece=[];


// ---- Photo de pièce (compressée puis stockée dans le bucket stock-photos) ----
let _photoPiece=null,_photoPieceSupprimee=false;
function compresserPhoto(file,maxDim=800){
  return new Promise((res,rej)=>{
    const img=new Image();
    img.onload=()=>{
      const r=Math.min(1,maxDim/Math.max(img.width,img.height));
      const cv=document.createElement('canvas');
      cv.width=Math.round(img.width*r);cv.height=Math.round(img.height*r);
      cv.getContext('2d').drawImage(img,0,0,cv.width,cv.height);
      cv.toBlob(b=>b?res(b):rej('compression échouée'),'image/jpeg',0.82);
    };
    img.onerror=()=>rej('image illisible');
    img.src=URL.createObjectURL(file);
  });
}
function initCompatSelectsPC(){
  const marques=marquesPour('extincteur');
  $('pc-cp-marque').innerHTML='<option value="">— Marque —</option>'+marques.map(m=>`<option>${m}</option>`).join('')+'<option value="__autre__">Autre…</option>';
  $('pc-cp-modele').innerHTML='<option value="">— Modèle —</option>';
}
function majModelesPC(){
  let m=$('pc-cp-marque').value;
  if(m==='__autre__'){m=prompt('Marque :')||'';if(!m){$('pc-cp-marque').value='';return}
    const o=document.createElement('option');o.textContent=m;$('pc-cp-marque').appendChild(o);$('pc-cp-marque').value=m;}
  const modeles=modelesPour('extincteur',m);
  $('pc-cp-modele').innerHTML='<option value="">Tous les modèles '+(m||'')+'</option>'+modeles.map(x=>`<option>${x}</option>`).join('')+'<option value="__autre__">Autre…</option>';
}
async function choisirPhotoPiece(input){
  const f=input.files[0];input.value='';
  if(!f)return;
  try{
    _photoPiece=await compresserPhoto(f);
    _photoPieceSupprimee=false;
    const ap=$('pc-photo-apercu');
    ap.src=URL.createObjectURL(_photoPiece);ap.style.display='block';
    $('pc-photo-suppr').style.display='inline-block';
  }catch(e){toast('Photo illisible','err')}
}
function supprimerPhotoPiece(){
  _photoPiece=null;_photoPieceSupprimee=true;
  $('pc-photo-apercu').style.display='none';
  $('pc-photo-suppr').style.display='none';
}
async function uploaderPhotoPiece(code,ancienPath){
  if(!_photoPiece)return null;
  const path='piece_'+code.replace(/[^a-zA-Z0-9-]/g,'_')+'_'+Date.now()+'.jpg';
  if(ancienPath)await db.storage.from('stock-photos').remove([ancienPath]).catch?.(()=>{});
  const {error}=await db.storage.from('stock-photos').upload(path,_photoPiece,{contentType:'image/jpeg'});
  if(error){toast('Photo non enregistrée : '+error.message,'err');return null}
  return {photo_path:path,photo_url:db.storage.from('stock-photos').getPublicUrl(path).data.publicUrl};
}

// ---- Lots par date de péremption ----
let _lotsPiece=[];
const lotEtat=d=>{ // d = 'AAAA-MM'
  if(!d)return'';
  const fin=new Date(d+'-01');fin.setMonth(fin.getMonth()+1);
  const j=(fin-new Date())/86400000;
  return j<0?'perime':j<90?'proche':'ok';
};
const lotCouleur={perime:'#dc2626',proche:'#d97706',ok:'var(--txt)'};
const fmtLot=d=>{if(!d)return'—';const [a,m]=d.split('-');return m+'/'+a};
function togglePeremption(){
  const on=$('pc-peremption').checked;
  $('pc-lots-bloc').style.display=on?'block':'none';
  $('pc-qte').disabled=on;
  if(on)majQteLots();
}
function renderLotsPiece(){
  const el=$('pc-lots-list');
  el.innerHTML=_lotsPiece.length?_lotsPiece.map((l,i)=>{
    const e=lotEtat(l.peremption);
    return `<span style="display:inline-flex;align-items:center;gap:6px;background:var(--bg);border-radius:8px;padding:4px 8px;margin:0 6px 6px 0;font-size:12px;color:${lotCouleur[e]}">${e==='perime'?'⛔ ':e==='proche'?'⏰ ':''}${fmtLot(l.peremption)} : <strong>${l.quantite}</strong><button type="button" onclick="_lotsPiece.splice(${i},1);renderLotsPiece()" style="background:none;border:none;color:#dc2626;cursor:pointer;padding:0">✕</button></span>`;
  }).join(''):'<span style="font-size:12px;color:var(--txt-l)">Aucun lot.</span>';
  majQteLots();
}
function majQteLots(){
  if($('pc-peremption').checked)$('pc-qte').value=_lotsPiece.reduce((s,l)=>s+(+l.quantite||0),0);
}
function ajouterLot(){
  const d=$('pc-lot-date').value;const q=parseInt($('pc-lot-qte').value,10);
  if(!d){toast('Date de péremption requise','err');return}
  if(!q||q<1){toast('Quantité invalide','err');return}
  const ex=_lotsPiece.find(l=>l.peremption===d);
  if(ex)ex.quantite=(+ex.quantite)+q;else _lotsPiece.push({peremption:d,quantite:q});
  _lotsPiece.sort((a,b)=>a.peremption.localeCompare(b.peremption));
  $('pc-lot-date').value='';$('pc-lot-qte').value='';
  renderLotsPiece();
}

function openPieceModal(prefill=null){
  ['pc-id','pc-code','pc-designation','pc-marque','pc-modele'].forEach(id=>$(id).value='');
  $('pc-qte').value='0';$('pc-seuil').value='0';$('pc-prix').value='';$('mo-pc-t').textContent='Nouvelle pièce';
  $('pc-qte').disabled=false;
  $('pc-agence').value=_stockAgFiltre||'';
  _compatPiece=[];_lotsPiece=[];
  _photoPiece=null;_photoPieceSupprimee=false;
  $('pc-photo-apercu').style.display='none';$('pc-photo-suppr').style.display='none';
  $('pc-peremption').checked=false;$('pc-lots-bloc').style.display='none';
  $('pc-categorie').value='piece';$('pc-tous').checked=false;$('pc-conso').checked=false;
  $('pc-compat-bloc').style.display='block';$('pc-compat-editeur').style.display='block';
  initCompatSelectsPC();
  if(prefill){$('pc-id').value=prefill.id;$('pc-code').value=prefill.code;$('pc-designation').value=prefill.designation;$('pc-marque').value=prefill.marque||'';$('pc-modele').value=prefill.modele||'';$('pc-qte').value=prefill.quantite;$('pc-qte').disabled=true;$('pc-seuil').value=prefill.seuil_alerte||0;$('pc-prix').value=prefill.prix_vente||'';$('pc-agence').value=prefill.agence_id||'';_compatPiece=Array.isArray(prefill.compatibilites)?[...prefill.compatibilites]:[];
    _lotsPiece=Array.isArray(prefill.lots)?prefill.lots.map(l=>({...l})):[];
    $('pc-peremption').checked=!!prefill.gestion_peremption;
    $('pc-lots-bloc').style.display=prefill.gestion_peremption?'block':'none';
    $('pc-qte').disabled=$('pc-qte').disabled||prefill.gestion_peremption;
    $('pc-categorie').value=prefill.categorie||'piece';
    $('pc-tous').checked=!!prefill.compatible_tous;
    $('pc-conso').checked=!!prefill.conso_par_controle;
    $('pc-compat-bloc').style.display=(prefill.categorie||'piece')==='piece'?'block':'none';
    $('pc-compat-editeur').style.display=prefill.compatible_tous?'none':'block';
    if(prefill.photo_url){$('pc-photo-apercu').src=prefill.photo_url;$('pc-photo-apercu').style.display='block';$('pc-photo-suppr').style.display='inline-block';}
    $('mo-pc-t').textContent='Modifier la pièce';}
  renderCompatPiece();renderLotsPiece();
  OM('mo-piece');
}
function renderCompatPiece(){
  const el=$('pc-compat-list');if(!el)return;
  el.innerHTML=_compatPiece.length?_compatPiece.map((x,i)=>`<span style="display:inline-flex;align-items:center;gap:6px;background:var(--bg);border-radius:8px;padding:4px 8px;margin:0 6px 6px 0;font-size:12px">${x.marque}${x.modele?' '+x.modele:' (tous modèles)'}<button type="button" onclick="_compatPiece.splice(${i},1);renderCompatPiece()" style="background:none;border:none;color:#dc2626;cursor:pointer;padding:0">✕</button></span>`).join('')
    :'<span style="font-size:12px;color:var(--txt-l)">Aucune autre compatibilité.</span>';
}
function ajouterCompat(){
  let m=$('pc-cp-marque').value;let mo=$('pc-cp-modele').value;
  if(!m||m==='__autre__'){toast('Choisis une marque','err');return}
  if(mo==='__autre__'){mo=prompt('Modèle :')||'';if(!mo)return}
  if(_compatPiece.find(x=>x.marque===m&&(x.modele||'')===(mo||''))){toast('Déjà dans la liste','err');return}
  _compatPiece.push({marque:m,modele:mo||''});
  renderCompatPiece();
}
function editPiece(id){openPieceModal(stockPieces.find(p=>p.id===id))}
async function savePiece(){
  const id=$('pc-id').value;
  const code=$('pc-code').value.trim();const des=$('pc-designation').value.trim();
  if(!code||!des){toast('Code et désignation obligatoires','err');return}
  const gPer=$('pc-peremption').checked;
  const cat=$('pc-categorie').value;
  const p={code,designation:des,marque:$('pc-marque').value.trim(),modele:$('pc-modele').value.trim(),seuil_alerte:parseFloat($('pc-seuil').value)||0,prix_vente:parseFloat($('pc-prix').value)||null,agence_id:$('pc-agence').value||null,
    categorie:cat,compatible_tous:cat==='piece'&&$('pc-tous').checked,conso_par_controle:cat==='piece'&&$('pc-conso').checked,
    compatibilites:cat==='piece'&&!$('pc-tous').checked?_compatPiece:[],gestion_peremption:gPer,lots:gPer?_lotsPiece:[],updated_at:new Date().toISOString()};
  const avantP=id?stockPieces.find(x=>x.id===id):null;
  if(_photoPiece){const ph=await uploaderPhotoPiece(code,avantP?.photo_path);if(ph)Object.assign(p,ph)}
  else if(_photoPieceSupprimee&&avantP?.photo_path){await db.storage.from('stock-photos').remove([avantP.photo_path]);p.photo_url=null;p.photo_path=null}
  if(id){
    const avant=stockPieces.find(x=>x.id===id);
    if(gPer)p.quantite=_lotsPiece.reduce((s,l)=>s+(+l.quantite||0),0);
    const {error}=await db.from('stock_pieces').update(p).eq('id',id);
    if(error){toast('Erreur: '+error.message,'err');return}
    if(gPer&&avant&&(+avant.quantite)!==p.quantite){
      await db.from('stock_mouvements').insert({piece_id:id,type:'rectification',quantite_avant:avant.quantite,quantite_apres:p.quantite,delta:p.quantite-(+avant.quantite),motif:'Modification des lots (bureau)',par:ME.id,agence_id:p.agence_id});
    }
    toast('Pièce modifiée');
  }else{
    p.quantite=parseFloat($('pc-qte').value)||0;
    const {data:np,error}=await db.from('stock_pieces').insert(p).select().single();
    if(error){toast('Erreur: '+error.message,'err');return}
    if(p.quantite>0)await db.from('stock_mouvements').insert({piece_id:np.id,type:'entree',quantite_avant:0,quantite_apres:p.quantite,delta:p.quantite,motif:'Création de la pièce',par:ME.id,agence_id:p.agence_id});
    toast('Pièce créée');
  }
  CM('mo-piece');loadStock();
}
async function deletePiece(id){
  if(!confirm('Supprimer cette pièce et son historique de mouvements ?'))return;
  await db.from('stock_pieces').delete().eq('id',id);toast('Supprimé');loadStock();
}

// ---- Sortie casse ----
function openCasseModal(id){
  const p=stockPieces.find(p=>p.id===id);if(!p)return;
  $('cs-piece-id').value=id;$('cs-qte').value='1';$('cs-detail').value='';
  $('cs-info').innerHTML=`<strong>${p.designation}</strong> (${p.code}) — en stock : <strong>${p.quantite}</strong>`;
  const bloc=$('cs-lot-bloc');
  if(p.gestion_peremption&&Array.isArray(p.lots)&&p.lots.length){
    bloc.style.display='block';
    $('cs-lot').innerHTML=p.lots.map((l,i)=>{const e=lotEtat(l.peremption);return `<option value="${i}">${e==='perime'?'⛔ PÉRIMÉ — ':e==='proche'?'⏰ ':''}${fmtLot(l.peremption)} (${l.quantite} en stock)</option>`}).join('');
  }else bloc.style.display='none';
  OM('mo-casse');
}
async function saveCasse(){
  const p=stockPieces.find(x=>x.id===$('cs-piece-id').value);if(!p)return;
  const q=parseFloat($('cs-qte').value);
  if(!q||q<1){toast('Quantité invalide','err');return}
  let motif=$('cs-motif').value+($('cs-detail').value.trim()?' — '+$('cs-detail').value.trim():'');
  const maj={updated_at:new Date().toISOString()};
  if(p.gestion_peremption&&Array.isArray(p.lots)&&p.lots.length){
    const li=parseInt($('cs-lot').value,10);const lot=p.lots[li];
    if(!lot){toast('Choisis un lot','err');return}
    if(q>+lot.quantite){toast('Ce lot ne contient que '+lot.quantite+' pièce(s)','err');return}
    const lots=p.lots.map(l=>({...l}));
    lots[li].quantite=(+lots[li].quantite)-q;
    maj.lots=lots.filter(l=>(+l.quantite)>0);
    maj.quantite=maj.lots.reduce((s,l)=>s+(+l.quantite),0);
    motif+=' — lot '+fmtLot(lot.peremption);
  }else{
    if(q>+p.quantite){toast('Stock insuffisant ('+p.quantite+' en stock)','err');return}
    maj.quantite=(+p.quantite)-q;
  }
  const {error}=await db.from('stock_pieces').update(maj).eq('id',p.id);
  if(error){toast('Erreur: '+error.message,'err');return}
  await db.from('stock_mouvements').insert({piece_id:p.id,type:'casse',quantite_avant:p.quantite,quantite_apres:maj.quantite,delta:-q,motif,par:ME.id,agence_id:p.agence_id});
  toast('Sortie casse enregistrée');CM('mo-casse');loadStock();
}


// ---- Transfert entre agences ----
function openTransfertModal(id){
  const p=stockPieces.find(x=>x.id===id);if(!p)return;
  if(!p.agence_id){toast("Affecte d'abord cette pièce à une agence (✏️)",'err');return}
  $('tf-piece-id').value=id;$('tf-qte').value='1';
  $('tf-info').innerHTML=`<strong>${p.designation}</strong> (${p.code})<br>Depuis <strong>${p.agences?.nom||'—'}</strong> — en stock : <strong>${p.quantite}</strong>`;
  // Destination : toutes sauf l'agence source
  $('tf-dest').innerHTML=_stockAgences.filter(a=>a.id!==p.agence_id).map(a=>`<option value="${a.id}">${a.nom}</option>`).join('');
  OM('mo-transfert');
}
async function saveTransfert(){
  const p=stockPieces.find(x=>x.id===$('tf-piece-id').value);if(!p)return;
  const q=parseFloat($('tf-qte').value);const destId=$('tf-dest').value;
  if(!q||q<1){toast('Quantité invalide','err');return}
  if(q>+p.quantite){toast('Stock insuffisant ('+p.quantite+' en stock)','err');return}
  if(!destId){toast('Choisis une agence de destination','err');return}
  const destNom=(_stockAgences.find(a=>a.id===destId)||{}).nom||'?';
  const srcNom=p.agences?.nom||'?';
  // 1. Sortie côté agence source
  const apresSrc=(+p.quantite)-q;
  const {error:e1}=await db.from('stock_pieces').update({quantite:apresSrc,updated_at:new Date().toISOString()}).eq('id',p.id);
  if(e1){toast('Erreur: '+e1.message,'err');return}
  await db.from('stock_mouvements').insert({piece_id:p.id,type:'transfert',quantite_avant:p.quantite,quantite_apres:apresSrc,delta:-q,motif:'Transfert vers '+destNom,par:ME.id,agence_id:p.agence_id,agence_dest_id:destId});
  // 2. Entrée côté agence destination (créer la pièce si absente)
  let dest=stockPieces.find(x=>x.code===p.code&&x.agence_id===destId);
  if(!dest){
    const {data:nd,error:e2}=await db.from('stock_pieces').insert({code:p.code,designation:p.designation,marque:p.marque,modele:p.modele,compatibilites:p.compatibilites||[],seuil_alerte:p.seuil_alerte||0,quantite:0,agence_id:destId}).select().single();
    if(e2){toast('Erreur création côté destination: '+e2.message,'err');return}
    dest=nd;
  }
  const apresDest=(+dest.quantite)+q;
  await db.from('stock_pieces').update({quantite:apresDest,updated_at:new Date().toISOString()}).eq('id',dest.id);
  await db.from('stock_mouvements').insert({piece_id:dest.id,type:'transfert',quantite_avant:dest.quantite,quantite_apres:apresDest,delta:q,motif:'Transfert depuis '+srcNom,par:ME.id,agence_id:destId});
  toast(`Transfert de ${q} × ${p.code} : ${srcNom} → ${destNom} ✓`);
  CM('mo-transfert');loadStock();
}

// ---- Import / export Excel ----
async function importStockExcel(input){
  const file=input.files[0];if(!file)return;input.value='';
  toast('Import en cours…');
  try{
    const wb=XLSX.read(await file.arrayBuffer());
    const rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:''});
    const col=(r,...noms)=>{for(const n of noms){for(const k of Object.keys(r)){if(k.toLowerCase().trim()===n)return r[k]}}return ''};
    let crees=0,inc=0,err=0;
    for(const r of rows){
      const code=String(col(r,'code')).trim();
      const qte=parseFloat(col(r,'quantité','quantite','qté','qte'))||0;
      if(!code){err++;continue}
      const agNom=String(col(r,'agence')).trim().toLowerCase();
      const agId=agNom?((_stockAgences.find(a=>a.nom.toLowerCase()===agNom||a.code===agNom)||{}).id||null):(_stockAgFiltre||null);
      const exist=stockPieces.find(p=>p.code.toLowerCase()===code.toLowerCase()&&(p.agence_id||null)===(agId||null));
      if(exist){
        const apres=(+exist.quantite)+qte;
        await db.from('stock_pieces').update({quantite:apres,updated_at:new Date().toISOString()}).eq('id',exist.id);
        await db.from('stock_mouvements').insert({piece_id:exist.id,type:'import',quantite_avant:exist.quantite,quantite_apres:apres,delta:qte,motif:'Import '+file.name,par:ME.id,agence_id:exist.agence_id});
        inc++;
      }else{
        const compRaw=String(col(r,'compatibilités','compatibilites','compatible'));
        const comp=compRaw?compRaw.split(';').map(s=>{const t=s.trim().split(/\s+/);return{marque:t[0]||'',modele:t.slice(1).join(' ')}}).filter(x=>x.marque):[];
        const {data:np,error}=await db.from('stock_pieces').insert({code,designation:String(col(r,'désignation','designation'))||code,marque:String(col(r,'marque')),modele:String(col(r,'modèle','modele')),quantite:qte,seuil_alerte:parseFloat(col(r,'seuil','seuil d\'alerte'))||0,agence_id:agId,compatibilites:comp}).select().single();
        if(error){err++;continue}
        await db.from('stock_mouvements').insert({piece_id:np.id,type:'import',quantite_avant:0,quantite_apres:qte,delta:qte,motif:'Import '+file.name,par:ME.id,agence_id:agId});
        crees++;
      }
    }
    toast(`Import : ${crees} pièce(s) créée(s), ${inc} incrémentée(s)${err?', '+err+' ligne(s) ignorée(s)':''}`);
  }catch(e){toast('Fichier illisible : '+e.message,'err')}
  loadStock();
}
function exportStockXLS(){
  const ws=XLSX.utils.json_to_sheet(stockPieces.map(p=>({Code:p.code,'Désignation':p.designation,Marque:p.marque||'','Modèle':p.modele||'','Compatibilités':(Array.isArray(p.compatibilites)?p.compatibilites:[]).map(x=>[x.marque,x.modele].filter(Boolean).join(' ')).join('; '),Agence:p.agences?.nom||'','Quantité':+p.quantite,'Seuil':+p.seuil_alerte||0,'Dernière maj':fmt(p.updated_at)})));
  const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Stock');
  XLSX.writeFile(wb,'BFS_stock_'+new Date().toISOString().slice(0,10)+'.xlsx');
}


// ---- Prévision du besoin de pièces (échéances à venir × pièces consommables) ----
let _echeancesPrev=[];
async function chargerPrevision(){
  const {data}=await db.from('verifications')
    .select('equipement_id,date_prochaine_echeance,created_at,equipements(marque,modele,type_equipement_code,statut,clients(agence_id))')
    .not('date_prochaine_echeance','is',null)
    .order('created_at',{ascending:false}).limit(2000);
  // Ne garder que la vérification la plus récente de chaque équipement
  const parEquip={};
  (data||[]).forEach(v=>{if(v.equipement_id&&!parEquip[v.equipement_id])parEquip[v.equipement_id]=v});
  _echeancesPrev=Object.values(parEquip).filter(v=>v.equipements&&v.equipements.statut!=='réformé');
  renderPrevision();
}
function renderPrevision(){
  const el=$('tbl-prevision');if(!el)return;
  const jours=parseInt($('f-horizon-prev').value,10)||90;
  const limite=new Date();limite.setDate(limite.getDate()+jours);
  const auj=new Date();auj.setHours(0,0,0,0);
  const consommables=stockPieces.filter(p=>p.categorie!=='accessoire'&&p.conso_par_controle&&(!_stockAgFiltre||p.agence_id===_stockAgFiltre));
  if(!consommables.length){el.innerHTML='<div class="t-empty">Aucune pièce marquée « consommée à chaque contrôle » — coche cette case sur les scellés, joints, etc. pour activer la prévision.</div>';return}
  const compatible=(p,eq)=>{
    if(p.compatible_tous)return true;
    const comp=Array.isArray(p.compatibilites)?p.compatibilites:[];
    const em=(eq.marque||'').toLowerCase(),emo=(eq.modele||'').toLowerCase();
    return comp.some(x=>{
      if((x.marque||'').toLowerCase()!==em||!em)return false;
      if(!x.modele)return true;
      const xm=x.modele.toLowerCase();
      return emo.includes(xm)||xm.includes(emo);
    });
  };
  const lignes=consommables.map(p=>{
    const controles=_echeancesPrev.filter(v=>{
      const d=new Date(v.date_prochaine_echeance);
      if(d>limite)return false;
      if(p.agence_id&&v.equipements.clients?.agence_id&&v.equipements.clients.agence_id!==p.agence_id)return false;
      return compatible(p,v.equipements);
    });
    const besoin=controles.length;
    const manque=Math.max(0,besoin-(+p.quantite));
    return {p,besoin,manque};
  }).filter(l=>l.besoin>0).sort((a,b)=>b.manque-a.manque);
  if(!lignes.length){el.innerHTML='<div class="t-empty">Aucun contrôle à venir sous '+jours+' jours ne consomme ces pièces.</div>';return}
  el.innerHTML=`<table><thead><tr><th>Pièce</th><th>Agence</th><th style="text-align:center">Contrôles à venir</th><th style="text-align:center">En stock</th><th style="text-align:center">Manque</th></tr></thead><tbody>${lignes.map(l=>`<tr>
    <td><strong>${l.p.code}</strong><br><small style="color:var(--txt-l)">${l.p.designation}</small></td>
    <td><span class="badge bg">${l.p.agences?.nom||'—'}</span></td>
    <td style="text-align:center">${l.besoin}</td>
    <td style="text-align:center;font-weight:700">${l.p.quantite}</td>
    <td style="text-align:center;font-weight:700;color:${l.manque>0?'#dc2626':'#16a34a'}">${l.manque>0?'⚠ '+l.manque+' à commander':'✓ OK'}</td>
  </tr>`).join('')}</tbody></table>
  <div style="font-size:11px;color:var(--txt-l);padding:8px 12px">Hypothèse : 1 pièce consommée par contrôle. Horizon : échéances sous ${jours} jours (retards inclus).</div>`;
}

// ---- Inventaires & mouvements ----
const badgeMvt=t=>({entree:'<span class="badge bv">➕ Entrée</span>',rectification:'<span class="badge bo">✎ Rectification</span>',casse:'<span class="badge br">🔻 Casse</span>',import:'<span class="badge bb">⬆ Import</span>',transfert:'<span class="badge bb">⇄ Transfert</span>',utilisation:'<span class="badge bo">🔧 Utilisée au contrôle</span>'}[t]||t);

function renderInventaires(){
  const el=$('tbl-inventaires');
  if(!_stockInventaires.length){el.innerHTML='<div class="t-empty">Aucun inventaire — se lance depuis le téléphone (onglet Stock).</div>';return}
  el.innerHTML=`<table><thead><tr><th>Démarré le</th><th>Agence</th><th>Par</th><th>Statut</th><th>Terminé le</th><th></th></tr></thead><tbody>${_stockInventaires.map(i=>`<tr>
    <td>${new Date(i.demarre_le).toLocaleString('fr-FR')}</td>
    <td><span class="badge bg">${i.agences?.nom||'—'}</span></td>
    <td>${i.profils?`${i.profils.prenom||''} ${i.profils.nom}`:'—'}</td>
    <td>${i.statut==='terminé'?'<span class="badge bv">✓ Terminé</span>':'<span class="badge bo">⏳ En cours</span>'}</td>
    <td>${i.termine_le?new Date(i.termine_le).toLocaleString('fr-FR'):'—'}</td>
    <td><button class="btn btn-s btn-xs" onclick="rapportInventairePDF('${i.id}')" title="Rapport PDF : entrées et rectifications">📄 Rapport</button></td>
  </tr>`).join('')}</tbody></table>`;
}

function renderMouvements(){
  const el=$('tbl-mouvements');
  if(!_stockMouvements.length){el.innerHTML='<div class="t-empty">Aucun mouvement</div>';return}
  el.innerHTML=`<table><thead><tr><th>Date</th><th>Pièce</th><th>Agence</th><th>Type</th><th style="text-align:center">Avant → Après</th><th style="text-align:center">Écart</th><th>Motif</th><th>Par</th></tr></thead><tbody>${_stockMouvements.map(m=>`<tr>
    <td style="white-space:nowrap;font-size:12px">${new Date(m.created_at).toLocaleString('fr-FR')}</td>
    <td>${m.stock_pieces?`<strong>${m.stock_pieces.code}</strong><br><small style="color:var(--txt-l)">${m.stock_pieces.designation}</small>`:'—'}</td>
    <td><span class="badge bg">${m.agences?.nom||'—'}</span></td>
    <td>${badgeMvt(m.type)}</td>
    <td style="text-align:center">${m.quantite_avant} → ${m.quantite_apres}</td>
    <td style="text-align:center;font-weight:700;color:${(+m.delta)>0?'#16a34a':(+m.delta)<0?'#dc2626':'var(--txt-l)'}">${(+m.delta)>0?'+':''}${m.delta}</td>
    <td style="font-size:12px">${m.motif||'—'}</td>
    <td style="font-size:12px">${m.profils?`${m.profils.prenom||''} ${m.profils.nom}`:'—'}</td>
  </tr>`).join('')}</tbody></table>`;
}

// ============================================================
// QR CODES ÉQUIPEMENTS
// ============================================================
// Le QR encode le numero_identification : c'est ce que le scanner
// de terrain.html recherche (fallback UUID géré côté terrain).
window.showQR=function(id,numero,client,type){
  $('qr-info').innerHTML=[type,client].filter(Boolean).join('<br>');
  $('qr-numero').textContent=numero||'';
  const c=$('qrcode-container');c.innerHTML='';
  new QRCode(c,{text:String(numero||id),width:200,height:200,correctLevel:QRCode.CorrectLevel.M});
  OM('mo-qr');
};

// Étiquette PNG 40×30 mm (400×300 px) pour imprimante Niimbot :
// télécharger puis imprimer comme image depuis l'appli Niimbot.
function telechargerEtiquette(){
  const src=$('qrcode-container').querySelector('img,canvas');
  if(!src){toast('QR non généré','err');return}
  const code=$('qr-numero').textContent||'';
  const info=($('qr-info').textContent||'').trim();
  const cv=document.createElement('canvas');cv.width=400;cv.height=300;
  const ctx=cv.getContext('2d');
  ctx.fillStyle='#fff';ctx.fillRect(0,0,400,300);
  // QR à gauche
  const img=src.tagName==='IMG'?src:null;
  const draw=()=>{
    ctx.imageSmoothingEnabled=false;
    ctx.drawImage(img||src,15,35,230,230);
    // Textes à droite
    ctx.fillStyle='#000';ctx.textAlign='center';
    const cx=322;
    ctx.font='bold 26px Arial';
    // Code sur 1-2 lignes
    const lignes=[];let mot=code;
    while(mot.length>10){lignes.push(mot.slice(0,10));mot=mot.slice(10)}
    lignes.push(mot);
    let ty=110;
    lignes.forEach(l=>{ctx.fillText(l,cx,ty);ty+=30});
    ctx.font='16px Arial';
    // Désignation (max 3 lignes de ~14 caractères)
    const mots=info.split(/\s+/);let ligne='';const dls=[];
    mots.forEach(m=>{if((ligne+' '+m).trim().length>14){dls.push(ligne.trim());ligne=m}else ligne+=' '+m});
    if(ligne.trim())dls.push(ligne.trim());
    ty+=6;
    dls.slice(0,3).forEach(l=>{ctx.fillText(l,cx,ty);ty+=20});
    const a=document.createElement('a');
    a.download='etiquette_'+code.replace(/[^a-zA-Z0-9-]/g,'_')+'.png';
    a.href=cv.toDataURL('image/png');
    a.click();
    toast('Étiquette téléchargée — à imprimer depuis l\'appli Niimbot');
  };
  if(img&&!img.complete)img.onload=draw;else draw();
}

window.printQR=function(){
  const el=$('qrcode-container').querySelector('img,canvas');
  if(!el){toast('QR non généré','err');return}
  const src=el.tagName==='IMG'?el.src:el.toDataURL();
  const w=window.open('','_blank','width=420,height=540');
  w.document.write('<html><head><title>Étiquette '+$('qr-numero').textContent+'</title></head>'
    +'<body style="font-family:sans-serif;text-align:center;padding:24px">'
    +'<div style="font-size:12px;color:#555">'+$('qr-info').innerHTML+'</div>'
    +'<img src="'+src+'" style="width:200px;height:200px;margin:12px 0">'
    +'<div style="font-size:18px;font-weight:700;letter-spacing:1px">'+$('qr-numero').textContent+'</div>'
    +'<scr'+'ipt>window.onload=function(){window.print();window.close()}</scr'+'ipt></body></html>');
  w.document.close();
};

console.log('✓ app.js chargé');
