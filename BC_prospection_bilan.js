// © 2026 Jérémy Bizeul — Vigie-lance, pour BFS Prévention. Tous droits réservés.
// Bilan de prospection (admin + secrétariat) : entonnoir par technicien, activité sur la période, motifs de refus, ERP, détail, export Excel / PDF.
const PB_STATUTS={a_demarcher:'À démarcher',visite:'Visité',rdv:'RDV pris',offre:'Offre envoyée',pas_interesse:'Pas intéressé',client:'Client'};
const PB_ACTIONS={appel:'Appels',visite:'Visites',mail:'Mails',rdv:'RDV',offre:'Offres',note:'Notes'};
const PB_MOTIFS={APSAD_R4R5:'APSAD R4/R5 à jour (contraint par son assureur)'};
let _pb={prospects:[],actions:[],lignes:[],debut:'',fin:''};
const _pbEsc=s=>String(s??'').replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
const _pbIso=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const _pbFr=d=>d?new Date(String(d).slice(0,10)+'T12:00:00').toLocaleDateString('fr-FR'):'—';

function prospectionBilanMonter(){
  const root=$('prospection-root');if(!root)return;
  const aujourdhui=new Date(),il30=new Date();il30.setDate(il30.getDate()-30);
  const techs=(profils||[]).filter(p=>p.role==='technicien'||p.role==='admin');
  const sel='padding:8px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:13px;background:#fff';
  root.innerHTML=`<div class="card" style="margin-bottom:14px"><div class="card-body" style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end">
    <div><label style="font-size:11px;display:block">Période</label><select id="pb-per" style="${sel}" onchange="prospectionBilanPeriode()"><option value="7">7 derniers jours</option><option value="30" selected>30 derniers jours</option><option value="mois">Mois en cours</option><option value="90">90 derniers jours</option><option value="tout">Depuis le début</option><option value="perso">Personnalisée…</option></select></div>
    <div><label style="font-size:11px;display:block">Du</label><input type="date" id="pb-d" value="${_pbIso(il30)}" style="${sel}"></div>
    <div><label style="font-size:11px;display:block">Au</label><input type="date" id="pb-f" value="${_pbIso(aujourdhui)}" style="${sel}"></div>
    <div><label style="font-size:11px;display:block">Technicien</label><select id="pb-tech" style="${sel}"><option value="">Tous</option>${techs.map(t=>`<option value="${t.id}">${_pbEsc((t.prenom||'')+' '+(t.nom||''))}</option>`).join('')}</select></div>
    <button class="btn btn-p" onclick="prospectionBilanCharger()">Actualiser</button>
    <button class="btn btn-s" onclick="prospectionBilanExcel()">📊 Excel</button>
    <button class="btn btn-s" onclick="prospectionBilanPDF()">📄 PDF</button>
  </div></div><div id="pb-corps"><div class="loading"><div class="spin spin-dark"></div></div></div>`;
  prospectionBilanCharger();
}
function prospectionBilanPeriode(){
  const v=$('pb-per').value,f=new Date(),d=new Date();
  if(v==='mois')d.setDate(1);else if(v==='tout')d.setFullYear(2020);else if(v!=='perso')d.setDate(d.getDate()-parseInt(v,10));
  if(v!=='perso'){$('pb-d').value=_pbIso(d);$('pb-f').value=_pbIso(f)}
  prospectionBilanCharger();
}
async function _pbToutCharger(table,cols,filtre){
  let out=[],from=0;
  for(;;){
    let q=db.from(table).select(cols).range(from,from+999);if(filtre)q=filtre(q);
    const {data,error}=await q;if(error)throw error;
    out=out.concat(data||[]);if(!data||data.length<1000)break;from+=1000;
  }
  return out;
}
async function prospectionBilanCharger(){
  const corps=$('pb-corps');corps.innerHTML='<div class="loading"><div class="spin spin-dark"></div></div>';
  try{
    const debut=$('pb-d').value,fin=$('pb-f').value,tech=$('pb-tech').value;
    _pb.debut=debut;_pb.fin=fin;
    const dFin=fin+'T23:59:59';
    const [pr,ac]=await Promise.all([
      _pbToutCharger('prospects','siret,nom,adresse,ville,statut,erp,motif_refus,technicien_id,derniere_action,created_at,prochain_rappel,rappel_motif,contact_nom,contact_tel,notes,naf',q=>{q=q.gte('derniere_action',debut).lte('derniere_action',dFin);if(tech)q=q.eq('technicien_id',tech);return q}),
      _pbToutCharger('prospect_actions','siret,type,resume,date_action,par',q=>{q=q.gte('date_action',debut).lte('date_action',dFin);if(tech)q=q.eq('par',tech);return q})
    ]);
    _pb.prospects=pr;_pb.actions=ac;
    prospectionBilanAfficher();
  }catch(e){corps.innerHTML='<div class="t-empty">Erreur : '+_pbEsc(e.message||e)+'</div>'}
}
function _pbNom(id){const p=(profils||[]).find(x=>x.id===id);return p?((p.prenom||'')+' '+(p.nom||'')).trim():'— non attribué —'}
function prospectionBilanAfficher(){
  const P=_pb.prospects,A=_pb.actions,auj=_pbIso(new Date());
  const par={};
  const L=id=>par[id||'?']||(par[id||'?']={id,nom:_pbNom(id),total:0,a_demarcher:0,visite:0,rdv:0,offre:0,pas_interesse:0,client:0,retard:0,erp:0,act:{}});
  P.forEach(p=>{const l=L(p.technicien_id);l.total++;l[p.statut]=(l[p.statut]||0)+1;if(p.erp)l.erp++;if(p.prochain_rappel&&p.prochain_rappel<=auj&&p.statut!=='client'&&p.statut!=='pas_interesse')l.retard++});
  A.forEach(a=>{const l=L(a.par);l.act[a.type]=(l.act[a.type]||0)+1});
  _pb.lignes=Object.values(par).sort((a,b)=>b.total-a.total);
  const tot=k=>_pb.lignes.reduce((s,l)=>s+(l[k]||0),0);
  const kpi=(v,l,c)=>`<div class="stat-card ${c||'bleu'}"><div class="val">${v}</div><div class="lab">${l}</div></div>`;
  const motifs={};P.filter(p=>p.statut==='pas_interesse').forEach(p=>{const m=p.motif_refus?(PB_MOTIFS[p.motif_refus]||p.motif_refus):'Sans motif renseigné';motifs[m]=(motifs[m]||0)+1});
  const th='style="text-align:center"';
  const tdn=v=>`<td style="text-align:center">${v||'<span style="color:#cbd5e1">0</span>'}</td>`;
  const dif=(a,b)=>b?Math.round(a/b*100)+' %':'—';
  $('pb-corps').innerHTML=`
    <div class="stats-grid" style="margin-bottom:14px">${kpi(tot('total'),'Prospects travaillés')}${kpi(tot('visite'),'Visités','orange')}${kpi(tot('rdv'),'RDV pris','vert')}${kpi(tot('offre'),'Offres envoyées','bleu')}${kpi(tot('client'),'Devenus clients','vert')}${kpi(tot('pas_interesse'),'Pas intéressés','orange')}${kpi(tot('erp'),'ERP repérés','bleu')}${kpi(tot('retard'),'Rappels en retard','orange')}</div>
    <div class="card" style="margin-bottom:14px"><div class="card-header"><h2>Entonnoir par technicien</h2><span style="font-size:12px;color:var(--txt-l)">${_pbFr(_pb.debut)} → ${_pbFr(_pb.fin)} (prospects touchés sur la période)</span></div><div class="table-wrap"><table><thead><tr><th>Technicien</th><th ${th}>Prospects</th><th ${th}>À démarcher</th><th ${th}>Visités</th><th ${th}>RDV</th><th ${th}>Offres</th><th ${th}>Clients</th><th ${th}>Pas intéressés</th><th ${th}>ERP</th><th ${th}>Rappels en retard</th><th ${th}>Transformation</th></tr></thead><tbody>${_pb.lignes.length?_pb.lignes.map(l=>`<tr><td><b>${_pbEsc(l.nom)}</b></td>${tdn(l.total)}${tdn(l.a_demarcher)}${tdn(l.visite)}${tdn(l.rdv)}${tdn(l.offre)}${tdn(l.client)}${tdn(l.pas_interesse)}${tdn(l.erp)}${tdn(l.retard)}<td style="text-align:center">${dif((l.rdv||0)+(l.offre||0)+(l.client||0),l.total)}</td></tr>`).join(''):'<tr><td colspan="11" class="t-empty">Aucune prospection sur la période</td></tr>'}</tbody></table></div></div>
    <div class="card" style="margin-bottom:14px"><div class="card-header"><h2>Activité sur la période</h2></div><div class="table-wrap"><table><thead><tr><th>Technicien</th>${Object.values(PB_ACTIONS).map(v=>`<th ${th}>${v}</th>`).join('')}</tr></thead><tbody>${_pb.lignes.some(l=>Object.keys(l.act).length)?_pb.lignes.map(l=>`<tr><td><b>${_pbEsc(l.nom)}</b></td>${Object.keys(PB_ACTIONS).map(k=>tdn(l.act[k])).join('')}</tr>`).join(''):'<tr><td colspan="7" class="t-empty">Aucune action enregistrée (appels, visites, RDV… se saisissent depuis la fiche du prospect)</td></tr>'}</tbody></table></div></div>
    <div class="card" style="margin-bottom:14px"><div class="card-header"><h2>Motifs de refus</h2></div><div class="card-body">${Object.keys(motifs).length?Object.entries(motifs).sort((a,b)=>b[1]-a[1]).map(([m,n])=>`<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f1f5f9"><span>${_pbEsc(m)}</span><b>${n}</b></div>`).join(''):'<span style="color:var(--txt-l)">Aucun refus sur la période.</span>'}</div></div>
    <div class="card"><div class="card-header"><h2>Détail des prospects (${P.length})</h2></div><div class="table-wrap"><table><thead><tr><th>Prospect</th><th>Ville</th><th>Technicien</th><th>Statut</th><th>Dernière action</th><th>Rappel</th><th>Contact</th><th>Note</th></tr></thead><tbody>${P.length?P.slice().sort((a,b)=>String(b.derniere_action).localeCompare(String(a.derniere_action))).slice(0,300).map(p=>`<tr><td><b>${_pbEsc(p.nom)}</b>${p.erp?' <span class="badge bo">ERP</span>':''}</td><td>${_pbEsc(p.ville||'')}</td><td>${_pbEsc(_pbNom(p.technicien_id))}</td><td>${_pbEsc(PB_STATUTS[p.statut]||p.statut)}${p.motif_refus?'<br><small style="color:var(--txt-l)">'+_pbEsc(PB_MOTIFS[p.motif_refus]||p.motif_refus)+'</small>':''}</td><td>${_pbFr(p.derniere_action)}</td><td>${p.prochain_rappel?_pbFr(p.prochain_rappel):'—'}</td><td>${_pbEsc([p.contact_nom,p.contact_tel].filter(Boolean).join(' · '))||'—'}</td><td style="max-width:240px">${_pbEsc(p.notes||'')}</td></tr>`).join(''):'<tr><td colspan="8" class="t-empty">Aucun prospect</td></tr>'}</tbody></table></div></div>`;
}
function prospectionBilanExcel(){
  if(!_pb.prospects.length&&!_pb.lignes.length){toast('Rien à exporter','err');return}
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(_pb.lignes.map(l=>({Technicien:l.nom,Prospects:l.total,'À démarcher':l.a_demarcher||0,Visités:l.visite||0,RDV:l.rdv||0,Offres:l.offre||0,Clients:l.client||0,'Pas intéressés':l.pas_interesse||0,ERP:l.erp||0,'Rappels en retard':l.retard||0,...Object.fromEntries(Object.entries(PB_ACTIONS).map(([k,v])=>['Actions — '+v,l.act[k]||0]))}))),'Par technicien');
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(_pb.prospects.map(p=>({Prospect:p.nom,Adresse:p.adresse||'',Ville:p.ville||'',NAF:p.naf||'',Technicien:_pbNom(p.technicien_id),Statut:PB_STATUTS[p.statut]||p.statut,ERP:p.erp?'Oui':'',Motif_refus:p.motif_refus?(PB_MOTIFS[p.motif_refus]||p.motif_refus):'','Dernière action':_pbFr(p.derniere_action),Rappel:p.prochain_rappel?_pbFr(p.prochain_rappel):'','Motif rappel':p.rappel_motif||'',Contact:p.contact_nom||'',Téléphone:p.contact_tel||'',Note:p.notes||''}))),'Prospects');
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(_pb.actions.map(a=>({Date:_pbFr(a.date_action),Technicien:_pbNom(a.par),Type:PB_ACTIONS[a.type+'s']||a.type,Prospect:(_pb.prospects.find(p=>p.siret===a.siret)||{}).nom||a.siret,Résumé:a.resume||''}))),'Actions');
  XLSX.writeFile(wb,`BFS_bilan_prospection_${_pb.debut}_${_pb.fin}.xlsx`);
}
function prospectionBilanPDF(){
  if(!_pb.lignes.length){toast('Rien à exporter','err');return}
  const {jsPDF}=window.jspdf;const doc=new jsPDF({orientation:'landscape'});
  try{doc.addImage(LOGO_BFS,'PNG',12,6,14,14)}catch(e){}
  doc.setFontSize(16);doc.setFont('helvetica','bold');doc.text('Bilan de prospection',30,14);
  doc.setFontSize(9);doc.setFont('helvetica','normal');doc.text(`Période : ${_pbFr(_pb.debut)} au ${_pbFr(_pb.fin)} — édité le ${new Date().toLocaleDateString('fr-FR')}`,30,19.5);
  const tot=k=>_pb.lignes.reduce((s,l)=>s+(l[k]||0),0);
  doc.autoTable({startY:26,head:[['Technicien','Prospects','À démarcher','Visités','RDV','Offres','Clients','Pas intéressés','ERP','Rappels en retard']],
    body:[..._pb.lignes.map(l=>[l.nom,l.total,l.a_demarcher||0,l.visite||0,l.rdv||0,l.offre||0,l.client||0,l.pas_interesse||0,l.erp||0,l.retard||0]),['TOTAL',tot('total'),tot('a_demarcher'),tot('visite'),tot('rdv'),tot('offre'),tot('client'),tot('pas_interesse'),tot('erp'),tot('retard')]],
    styles:{fontSize:9},headStyles:{fillColor:[230,100,40]},didParseCell:h=>{if(h.row.index===_pb.lignes.length&&h.section==='body')h.cell.styles.fontStyle='bold'}});
  let y=doc.lastAutoTable.finalY+8;
  doc.setFont('helvetica','bold');doc.setFontSize(11);doc.text('Activité sur la période',14,y);
  doc.autoTable({startY:y+2,head:[['Technicien',...Object.values(PB_ACTIONS)]],body:_pb.lignes.map(l=>[l.nom,...Object.keys(PB_ACTIONS).map(k=>l.act[k]||0)]),styles:{fontSize:9},headStyles:{fillColor:[60,60,60]}});
  y=doc.lastAutoTable.finalY+8;
  const motifs={};_pb.prospects.filter(p=>p.statut==='pas_interesse').forEach(p=>{const m=p.motif_refus?(PB_MOTIFS[p.motif_refus]||p.motif_refus):'Sans motif renseigné';motifs[m]=(motifs[m]||0)+1});
  if(Object.keys(motifs).length)doc.autoTable({startY:y,head:[['Motif de refus','Nombre']],body:Object.entries(motifs).sort((a,b)=>b[1]-a[1]),styles:{fontSize:9},headStyles:{fillColor:[60,60,60]},columnStyles:{1:{halign:'center',cellWidth:30}}});
  doc.save(`BFS_bilan_prospection_${_pb.debut}_${_pb.fin}.pdf`);
}
