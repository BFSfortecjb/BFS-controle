// © 2026 Jérémy Bizeul — Vigie-lance, pour BFS Prévention. Tous droits réservés. [BFS-VL-d7e0b7f4]
// ============================================================
// BFS Contrôle — FICHE COMMERCIALE : tarifs de vente en vigueur (PDF à remettre au prospect)
// Partagé : bureau, terrain, commercial. Dépend de : db, toast, jsPDF + autotable.
// Les prix viennent TOUJOURS de la base (tarifs, grilles) : la fiche est donc à jour à chaque édition.
// ============================================================
const FICHE_TVA_NOTE="Prix en euros hors taxes, TVA au taux en vigueur en sus. Tarifs en vigueur à la date d'édition, sous réserve de modification. Frais de déplacement facturés en sus sauf mention contraire.";
const FICHE_LEGAL='B.F.S. — EURL au capital de 15 000 € — 794 817 437 R.C.S. La Roche-sur-Yon — TVA FR69 794817437';
const FICHE_PERIODES={annuelle:'1 visite / an',semestrielle:'2 visites / an',trimestrielle:'4 visites / an',mensuelle:'12 visites / an'};
const _eurF=n=>(+n||0).toLocaleString('fr-FR',{style:'currency',currency:'EUR'}).replace(/[  ]/g,' ');
const _fnum=n=>(+n||0).toLocaleString('fr-FR',{maximumFractionDigits:2});

async function ficheAssurerLogo(){
  if(window._bfsLogoB64||(typeof LOGO_BFS!=='undefined'&&LOGO_BFS))return;
  try{
    const blob=await (await fetch('https://bfsfortecjb.github.io/BFS-controle/icons/icon-512.png')).blob();
    window._bfsLogoB64=await new Promise(ok=>{const rd=new FileReader();rd.onload=e=>ok(e.target.result);rd.readAsDataURL(blob)});
  }catch(e){console.warn('Logo indisponible',e)}
}

// Chargement des tarifs de vente (uniquement ce qui a un prix)
async function ficheCharger(){
  const [t,g,ty,gl,ge]=await Promise.all([
    db.from('tarifs').select('code,designation,prix_ht,unite,categorie,code_galaxy').eq('actif',true).order('designation'),
    db.from('grille_tarifs_contrat').select('type_equipement_code,periodicite,prix_ref_5ans').eq('actif',true),
    db.from('types_equipements').select('code,libelle').eq('actif',true),
    db.from('grille_location').select('agent_code,capacite_valeur,loyer_mensuel_ht').order('capacite_valeur'),
    db.from('grille_location_evenement').select('agent_code,capacite_valeur,prix_jour_ht').order('capacite_valeur')]);
  return {tous:t.data||[],tarifs:(t.data||[]).filter(x=>x.prix_ht!=null&&+x.prix_ht>0),grille:g.data||[],types:ty.data||[],loc:gl.data||[],evt:ge.data||[]};
}
const _ficheUniteCap=a=>/^(AB|ABF|EAU)$/i.test(a||'')?'L':'kg';

function construireFichePDF(d,opt={}){
  const GX=!!opt.galaxy,manquants=[];
  const {jsPDF}=window.jspdf;const doc=new jsPDF({unit:'mm',format:'a4'});
  doc.setProperties({title:'BFS — Fiche commerciale — Tarifs de vente',author:'BFS Contrôle — Vigie-lance',keywords:'BFS-VL-562ee89e'});
  const M=15,W=180,logo=window._bfsLogoB64||(typeof LOGO_BFS!=='undefined'?LOGO_BFS:null);let y=0;
  const entete=()=>{
    try{if(logo)doc.addImage(logo,'PNG',12,5,16,16)}catch(e){}
    doc.setFont('helvetica','bold');doc.setFontSize(11);doc.setTextColor(60);doc.text('Bretagne Formation Sécurité  |  Bocage Formation Sécurité',32,11);
    doc.setFont('helvetica','normal');doc.setFontSize(8);
    doc.text('325 rue Pierre et Marie Curie, ZI du Lumunoch, 29510 BRIEC  —  Zone économique de l\'Épaud, 85700 SÉVREMONT',32,16);
    doc.text('contact@bfs-prevention.fr  —  www.bfs-prevention.fr',32,20);
    doc.setDrawColor(230,120,20);doc.setLineWidth(.6);doc.line(M,24,M+W,24);y=31;
  };
  const saut=h=>{if(y+h>278){doc.addPage();entete()}};
  const titre=t=>{saut(20);doc.setFont('helvetica','bold');doc.setFontSize(11.5);doc.setTextColor(230,120,20);doc.text(t,M,y);y+=5;doc.setTextColor(30)};
  const note=(t,sz=8)=>{doc.setFont('helvetica','normal');doc.setFontSize(sz);doc.setTextColor(90);const L=doc.splitTextToSize(t,W);saut(L.length*3.6+2);doc.text(L,M,y);y+=L.length*3.6+3;doc.setTextColor(30)};
  const tableau=(head,body,opts={})=>{if(!body.length)return;
    doc.autoTable({startY:y,margin:{left:M,right:M,top:30},head:[head],body,styles:{fontSize:8.5,cellPadding:1.3},headStyles:{fillColor:opts.fill||[230,120,20]},
      columnStyles:opts.cols||{1:{halign:'right',cellWidth:42}},theme:'striped',didParseCell:h=>{if(h.section==='body'&&h.cell.raw==='À CRÉER'){h.cell.styles.textColor=[200,30,30];h.cell.styles.fontStyle='bold'}}});
    y=doc.lastAutoTable.finalY+5;};
  entete();
  doc.setFont('helvetica','bold');doc.setFontSize(18);doc.setTextColor(230,120,20);doc.text(GX?'FICHE TARIFAIRE INTERNE — CODES GALAXY':'FICHE COMMERCIALE',M,y);y+=7;
  doc.setFont('helvetica','normal');doc.setFontSize(10);doc.setTextColor(60);
  doc.text(`Tarifs de vente en vigueur au ${new Date().toLocaleDateString('fr-FR')}`,M,y);y+=6;
  note(GX?"Document interne (ne pas remettre aux clients). Chaque article indique son code Galaxy ; « À CRÉER » = article absent de Galaxy, à créer avec le code BFS et le prix indiqués.":FICHE_TVA_NOTE,8.5);

  const T=GX?d.tous:d.tarifs,fam=(f)=>T.filter(f);
  const cg=t=>{const c=(t.code_galaxy||'').toString().trim();if(!c)manquants.push([t.code,t.designation,t.prix_ht]);return c||'À CRÉER'};
  const ligneG=t=>[t.designation,cg(t),t.prix_ht!=null&&+t.prix_ht>0?_eurF(t.prix_ht)+(t.unite&&!/^(unité|u)$/i.test(t.unite)?' / '+t.unite:''):'prix à définir'];
  const L=t=>GX?ligneG(t):ligne(t);
  const HD=GX?['Désignation','Code Galaxy','Prix HT']:['Désignation','Prix HT'];
  const COLS=GX?{1:{halign:'center',cellWidth:30},2:{halign:'right',cellWidth:34}}:undefined;
  const T2=(titreS,rows)=>{if(!rows.length)return;titre(titreS);tableau(HD,rows.map(L),{cols:COLS})};
  const ligne=t=>[t.designation,_eurF(t.prix_ht)+(t.unite&&!/^(unité|u)$/i.test(t.unite)?' / '+t.unite:'')];
  // 1. Matériel à la vente
  T2('Extincteurs et équipements neufs',fam(t=>t.categorie==='equipement'));
  T2('Accessoires',fam(t=>t.categorie==='accessoire'));
  // 2. Prestations (version client : hors lignes internes au contrat)
  T2('Prestations',fam(t=>t.categorie==='prestation'&&(GX?!/^CONTRAT-/.test(t.code||''):!/^(CONTRAT-|MAA-|MAINT-PP-|DEPL)/.test(t.code||''))));
  T2('Pièces détachées courantes',fam(t=>t.categorie==='piece'));
  // 3. Déplacement
  const dep=fam(t=>t.categorie==='déplacement').sort((a,b)=>String(a.code).localeCompare(String(b.code)));
  if(dep.length){if(GX)T2('Frais de déplacement',dep);else{titre('Frais de déplacement');tableau(['Zone','Prix HT par déplacement'],dep.map(t=>[t.designation.replace(/^Déplacement\s*/,''),_eurF(t.prix_ht)]))}}
  // 4. Contrat de maintenance
  if(GX){
    const art={extincteur:'VAP-POUDRE',baes:'BAES-VERIF',alarme_t4:'MAINT-ALARME-T4'};
    titre('Contrat de maintenance — articles facturés à chaque visite');
    note("Le contrat n'est pas un article : on facture, à chaque visite et par site, l'article de vérification / maintenance du type d'équipement (prix annuel ÷ nombre de visites).");
    tableau(['Équipement du contrat','Code Galaxy','Article BFS'],Object.entries(art).map(([ty,code])=>{const t=d.tous.find(x=>x.code===code)||{};return [((d.types.find(x=>x.code===ty)||{}).libelle||ty),cg(t.code?t:{code,designation:code}),code]}),{fill:[120,120,120],cols:{1:{halign:'center',cellWidth:30},2:{cellWidth:48}}});
  }
  // 4b. Prix annuel par appareil selon durée d'engagement
  if(!GX&&d.grille.length){
    titre('Contrat de maintenance — prix annuel HT par appareil');
    const lib=c=>(d.types.find(t=>t.code===c)||{}).libelle||c;
    const ordre=['annuelle','semestrielle','trimestrielle','mensuelle'];
    const rows=d.grille.slice().sort((a,b)=>String(a.type_equipement_code).localeCompare(String(b.type_equipement_code))||ordre.indexOf(a.periodicite)-ordre.indexOf(b.periodicite))
      .map(g=>[lib(g.type_equipement_code),FICHE_PERIODES[g.periodicite]||g.periodicite,...[1,2,3,4,5].map(n=>_eurF(g.prix_ref_5ans*5/n))]);
    tableau(['Équipement','Périodicité','1 an','2 ans','3 ans','4 ans','5 ans'],rows,{fill:[120,120,120],cols:{2:{halign:'right'},3:{halign:'right'},4:{halign:'right'},5:{halign:'right'},6:{halign:'right'}}});
    note("Le contrat comprend la vérification, la maintenance préventive, les pièces et charges, le traitement des déchets et les frais de gestion des rapports ; le prix annuel est lissé sur la durée d'engagement (plus l'engagement est long, plus le prix est bas), réévalué chaque 1er janvier selon la formule de révision du contrat (hausse minimale de 1 %). Intervention sous 72 h sur demande écrite pour la maintenance corrective. Frais de déplacement en sus sauf mention contraire au contrat.");
  }
  // 5. Location
  if(GX&&(d.loc.length||d.evt.length)){
    titre('Location — articles à prévoir dans Galaxy');
    note("Aucun code Galaxy n'est enregistré pour la location : un article par type d'appareil (loyer mensuel) et par type d'appareil événementiel (prix au jour).");
    const rl=d.loc.map(g=>[`Location longue durée — ${g.agent_code} ${_fnum(g.capacite_valeur)} ${_ficheUniteCap(g.agent_code)} (par mois)`,'À CRÉER',_eurF(g.loyer_mensuel_ht)]);
    const re=d.evt.map(g=>[`Location événementielle — ${g.agent_code} ${_fnum(g.capacite_valeur)} ${_ficheUniteCap(g.agent_code)} (par jour)`,'À CRÉER',_eurF(g.prix_jour_ht)]);
    d.loc.forEach((g,i)=>manquants.push(['LOCATION-'+g.agent_code+'-'+_fnum(g.capacite_valeur),rl[i][0],g.loyer_mensuel_ht]));d.evt.forEach((g,i)=>manquants.push(['LOC-EVT-'+g.agent_code+'-'+_fnum(g.capacite_valeur),re[i][0],g.prix_jour_ht]));
    tableau(['Désignation','Code Galaxy','Prix HT'],[...rl,...re],{fill:[120,120,120],cols:COLS});
  }
  if(!GX&&d.loc.length){
    titre('Location d\'extincteurs — formule tout inclus (contrat séparé)');
    tableau(['Appareil','Loyer mensuel HT / appareil'],d.loc.map(g=>[`Extincteur ${g.agent_code} ${_fnum(g.capacite_valeur)} ${_ficheUniteCap(g.agent_code)}`,_eurF(g.loyer_mensuel_ht)]),{fill:[120,120,120]});
    note("Location longue durée : livraison, frais de déplacement, recharge, échange en fin de vie et dépollution inclus (conditions détaillées au contrat de location).");
  }
  if(!GX&&d.evt.length){
    titre('Location événementielle (festivals, manifestations)');
    tableau(['Appareil','Prix HT par jour et par appareil'],d.evt.map(g=>[`Extincteur ${g.agent_code} ${_fnum(g.capacite_valeur)} ${_ficheUniteCap(g.agent_code)}`,_eurF(g.prix_jour_ht)]),{fill:[120,120,120]});
    note("Livraison et reprise, vérification avant l'événement, recharge après usage et technicien sur site sur devis.");
  }
  if(GX){
    const uniq=[];manquants.forEach(m=>{if(!uniq.find(u=>u[0]===m[0]&&u[1]===m[1]))uniq.push(m)});
    titre(`Récapitulatif — ${uniq.length} article${uniq.length>1?'s':''} à créer dans Galaxy`);
    if(uniq.length)tableau(['Code BFS','Désignation','Prix HT'],uniq.map(m=>[m[0],m[1],m[2]!=null&&+m[2]>0?_eurF(m[2]):'à définir']),{fill:[200,30,30],cols:{0:{cellWidth:66},2:{halign:'right',cellWidth:28}}});
    else note('Tous les articles ont un code Galaxy.');
  }
  const n=doc.getNumberOfPages();
  for(let p=1;p<=n;p++){doc.setPage(p);doc.setFontSize(7);doc.setTextColor(120);doc.text(FICHE_LEGAL,105,286,{align:'center'});doc.text(`${GX?'Fiche tarifaire interne (Galaxy)':'Fiche commerciale'} BFS — Page ${p}/${n}`,105,290.5,{align:'center'})}
  return doc;
}

async function ficheCommercialeGenerer(opt={}){
  try{
    if(typeof toast==='function')toast('Préparation de la fiche commerciale…');
    await ficheAssurerLogo();
    const d=await ficheCharger();
    const doc=construireFichePDF(d,opt);
    const blob=doc.output('blob'),nom=`BFS_fiche_${opt.galaxy?'tarifs_galaxy':'commerciale'}_${new Date().toISOString().slice(0,10)}.pdf`;
    const f=new File([blob],nom,{type:'application/pdf'});
    if(navigator.canShare&&navigator.canShare({files:[f]})){navigator.share({files:[f],title:nom}).catch(()=>{})}
    else{const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=nom;document.body.appendChild(a);a.click();a.remove()}
    if(typeof toast==='function')toast('Fiche commerciale générée ✓');
  }catch(e){console.error(e);if(typeof toast==='function')toast('Erreur : '+(e.message||e),'err')}
}
