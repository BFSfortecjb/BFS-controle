// ============================================================
// BFS Contrôle — OFFRE DE PRIX (le technicien propose, sans passer par le bureau)
// Partagé : terrain (création + signature) et bureau (liste, PDF, statuts).
// Dépend de : db, ME, $, toast, fmt, jsPDF + autotable ; terrain : currentClient, goTo, notifierSecretariatBon
// ============================================================
const OFFRE_TVA=0.20;
const OFFRE_AGENCES={
  briec:{nom:'Bretagne Formation Sécurité',adresse:['Zone industrielle du lumunoch','325 rue Pierre et Marie CURIE','29510 BRIEC'],siret:'794 817 437 00062'},
  sevremont:{nom:'Bocage Formation Sécurité',adresse:["Zone économique de l'épaud",'85700 SEVREMONT'],siret:'794 817 437 00054'}
};
// Conditions de règlement par défaut (document remis au client : aucun texte « à préciser » ne doit y figurer)
const OFFRE_PAIEMENT='Règlement à 30 jours à compter de la date de facture.';
const OFFRE_PASSAGES={annuelle:1,semestrielle:2,trimestrielle:4,mensuelle:12};
const OFFRE_STATUTS={brouillon:'📝 Brouillon',envoyee:'📨 Envoyée',acceptee:'✅ Acceptée',refusee:'❌ Refusée',expiree:'⌛ Expirée'};
const OFFRE_PERIODES={annuelle:'Annuelle (1 visite / an)',semestrielle:'Semestrielle (2 / an)',trimestrielle:'Trimestrielle (4 / an)',mensuelle:'Mensuelle (12 / an)'};
const _eurO=n=>(+n||0).toLocaleString('fr-FR',{style:'currency',currency:'EUR'}).replace(/[\u202f\u00a0]/g,' ')
const _escO=s=>String(s??'').replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
const _r2=n=>Math.round((+n||0)*100)/100;

// ---------- Calculs ----------
function offreTotaux(lignes){
  const ht=_r2((lignes||[]).reduce((s,l)=>s+(+l.quantite||0)*(+l.pu_ht||0),0));
  return {ht,tva:_r2(ht*OFFRE_TVA),ttc:_r2(ht*(1+OFFRE_TVA))};
}
function offreContratTotal(c){
  if(!c||!Array.isArray(c.lignes))return 0;
  return _r2(c.lignes.reduce((s,l)=>s+(+l.quantite||0)*(+l.pu_annuel||0),0));
}
const offreValiditeFin=o=>{const d=new Date((o.date_offre||new Date().toISOString().slice(0,10))+'T12:00:00');d.setDate(d.getDate()+(+o.validite_jours||30));return d};
function offreEstExpiree(o){return o.statut==='envoyee'&&offreValiditeFin(o)<new Date(new Date().toDateString())}

// ---------- Logo (bureau : LOGO_BFS de BC_pdf.js ; terrain : logo préchargé, sinon récupéré ici) ----------
async function offreAssurerLogo(){
  if(window._bfsLogoB64||(typeof LOGO_BFS!=='undefined'&&LOGO_BFS))return;
  try{
    const blob=await (await fetch('https://bfsfortecjb.github.io/BFS-controle/icons/icon-512.png')).blob();
    window._bfsLogoB64=await new Promise(ok=>{const rd=new FileReader();rd.onload=e=>ok(e.target.result);rd.readAsDataURL(blob)});
  }catch(e){console.warn('Logo indisponible',e)}
}

// ---------- Conditions générales de vente (verso) ----------
const OFFRE_CGV=[
['1. Champ d\'application','Les présentes conditions générales s\'appliquent à toute offre, vente de matériel et prestation de B.F.S. (enseignes Bretagne Formation Sécurité et Bocage Formation Sécurité), ci-après « BFS », auprès de clients professionnels. Elles prévalent sur les conditions d\'achat du client. La signature de l\'offre vaut acceptation sans réserve des présentes. Un contrat de maintenance distinct prévaut sur les présentes pour les points qu\'il traite.'],
['2. Offre et commande','L\'offre est valable pendant la durée indiquée au recto. La commande est ferme à la signature du client. Toute modification demandée après acceptation fait l\'objet d\'un accord écrit et peut entraîner un ajustement du prix et des délais.'],
['3. Prix','Les prix sont exprimés en euros hors taxes ; la TVA au taux en vigueur s\'ajoute. Les frais de déplacement sont facturés en sus, sauf mention contraire sur l\'offre. Les prix d\'un contrat de maintenance sont réévalués chaque 1er janvier selon la formule de révision prévue à ce contrat (indices IDFD et ICHTrev-TS, hausse annuelle minimale de 1 %).'],
['4. Paiement','Sauf mention contraire, les factures sont payables à 30 jours à compter de leur date, par virement. Tout retard entraîne de plein droit des pénalités égales à trois fois le taux d\'intérêt légal, ainsi qu\'une indemnité forfaitaire de 40 € pour frais de recouvrement (art. L.441-10 du Code de commerce), sans préjudice d\'une indemnisation complémentaire sur justificatifs. Aucun escompte n\'est accordé pour paiement anticipé. BFS peut suspendre ses prestations en cas de défaut de paiement.'],
['5. Interventions','Le client garantit l\'accès aux équipements et la présence d\'un interlocuteur le jour convenu. Les vérifications et opérations de maintenance sont réalisées selon les règles et normes en vigueur (notamment APSAD R4 et NF S 61-919). Tout report à moins de 48 heures ou toute intervention rendue impossible du fait du client peut donner lieu à facturation du déplacement, y compris lorsque les déplacements sont inclus dans un contrat de maintenance.'],
['6. Constats et préconisations','BFS signale les anomalies constatées et propose les remises en conformité. Leur réalisation reste à la décision et à la charge du client, qui demeure seul responsable de la sécurité incendie de son établissement. BFS ne répond pas des conséquences d\'une préconisation non suivie. Un matériel jugé non réparable ou dangereux est mis hors service ; son remplacement fait l\'objet d\'une offre.'],
['7. Matériel de remplacement','Le matériel éventuellement prêté pendant une intervention reste la propriété de BFS et doit être restitué à l\'issue de celle-ci. Il est placé sous la garde du client, qui répond de sa perte ou de sa dégradation.'],
['8. Livraison et réception','Les délais sont donnés à titre indicatif, sauf engagement exprès (par exemple le délai d\'intervention prévu par un contrat de maintenance, qui porte sur l\'intervention et non sur la remise en service) ; un retard ne donne droit ni à annulation ni à indemnité. Le client vérifie la conformité à la livraison ou à la fin de l\'intervention et notifie toute réserve par écrit sous 48 heures ; à défaut, la prestation est réputée acceptée.'],
['9. Garantie','Le matériel neuf bénéficie de la garantie légale et de celle du fabricant. Les pièces et opérations de recharge ou de réparation effectuées par BFS sont garanties 12 mois, hors usure normale, usage anormal, choc, déclenchement ou intervention d\'un tiers.'],
['10. Responsabilité','BFS est tenue d\'une obligation de moyens. Sa responsabilité est limitée aux dommages directs et plafonnée au montant hors taxes de la prestation à l\'origine du dommage, sauf faute lourde ou dolosive et dommage corporel. Les dommages indirects (perte d\'exploitation, de clientèle, de données ou d\'image) sont exclus. BFS est couverte par une assurance responsabilité civile professionnelle.'],
['11. Réserve de propriété','Le matériel vendu reste la propriété de BFS jusqu\'au paiement intégral du prix (loi n° 80-335 du 12 mai 1980). Le client en assume la garde et les risques dès la livraison et ne peut le revendre ni le donner en garantie avant paiement.'],
['12. Annulation et contrat de maintenance','En cas d\'annulation par le client après acceptation, les frais déjà engagés (matériel commandé ou spécifique, déplacements, temps passé) restent dus. La durée, la reconduction et la résiliation d\'un contrat de maintenance sont régies exclusivement par ce contrat.'],
['13. Déchets et reprise','Le matériel repris est traité par BFS dans une filière agréée. Le client reste détenteur du matériel jusqu\'à sa remise effective à BFS.'],
['14. Force majeure','BFS n\'est pas responsable d\'un manquement dû à un événement de force majeure au sens de l\'article 1218 du Code civil.'],
['15. Données personnelles','Les données du client sont traitées par BFS pour la gestion de la relation contractuelle, des interventions et de la facturation, et conservées pour la durée légale. Le client dispose d\'un droit d\'accès, de rectification et d\'opposition en écrivant à contact@bfs-prevention.fr.'],
['16. Droit applicable et litiges','Les présentes sont soumises au droit français. À défaut d\'accord amiable, tout litige relève du tribunal de commerce de La Roche-sur-Yon, y compris en cas de pluralité de défendeurs ou d\'appel en garantie.']
];
function offreAjouterCGV(doc,ag,numero,k=1){
  doc.addPage();
  try{const logo=window._bfsLogoB64||(typeof LOGO_BFS!=='undefined'?LOGO_BFS:null);if(logo)doc.addImage(logo,'PNG',12,8,12,12)}catch(e){}
  doc.setFont('helvetica','bold');doc.setFontSize(12);doc.setTextColor(230,120,20);doc.text('CONDITIONS GÉNÉRALES DE VENTE',28,14);
  doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(60);doc.text(`B.F.S. — ${ag.nom}`,28,19);
  doc.setDrawColor(230,120,20);doc.setLineWidth(.6);doc.line(15,23,195,23);
  const colW=87,x0=[15,108],top=29,bot=278;
  for(const sz of [9,8.6,8.2,7.8,7.4,7.2,7,6.8,6.6,6.4,6.2,6]){
    const lh=sz*0.43;let col=0,y=top,ok=true;const ops=[];
    for(const [t,txt] of CGV_ITER()){
      doc.setFontSize(sz);doc.setFont('helvetica','normal');const L=doc.splitTextToSize(txt,colW);
      const h=lh*1.1+L.length*lh+1.6;
      if(y+h>bot){if(col===1){ok=false;break}col=1;y=top}
      ops.push([x0[col],y,t,L,lh]);y+=h;
    }
    if(!ok)continue;
    for(const [x,yy,t,L,lh] of ops){doc.setFont('helvetica','bold');doc.setTextColor(40);doc.setFontSize(sz);doc.text(t,x,yy);
      doc.setFont('helvetica','normal');doc.setTextColor(30);doc.text(L,x,yy+lh*1.1)}
    break;
  }
  doc.setFontSize(7);doc.setTextColor(120);
  doc.text(OFFRE_LEGAL,105,286,{align:'center'});
  doc.text(`Offre de prix ${numero||''} — ${ag.nom}`,105,290.5,{align:'center'});
}
function CGV_ITER(){return OFFRE_CGV}

// ---------- PDF (tient sur UNE page : mise à l'échelle automatique si le contenu déborde) ----------
const OFFRE_LEGAL='B.F.S. — EURL au capital de 15 000 € — 794 817 437 R.C.S. La Roche-sur-Yon — TVA FR69 794817437';
function construireOffrePDF(o,client,agenceCode,techNom){
  let doc;
  for(const k of [1,.92,.85,.78,.72,.66,.6]){doc=_offreDoc(o,client,agenceCode,techNom,k);if(doc.getNumberOfPages()<=1)break}
  // Recto = offre (1 page) ; verso = conditions générales de vente
  offreAjouterCGV(doc,OFFRE_AGENCES[agenceCode]||OFFRE_AGENCES.briec,o.numero);
  const n=doc.getNumberOfPages();doc.setFontSize(7);doc.setTextColor(120);
  for(let p=1;p<=n;p++){doc.setPage(p);doc.text(`Page ${p}/${n}`,195,290.5,{align:'right'})}
  return doc;
}
function _offreDoc(o,client,agenceCode,techNom,k){
  const {jsPDF}=window.jspdf;const doc=new jsPDF({unit:'mm',format:'a4'});doc.setProperties({author:'BFS Contrôle — Vigie-lance',keywords:'BFS-VL-b56dda56'});
  const ag=OFFRE_AGENCES[agenceCode]||OFFRE_AGENCES.briec,M=15,W=180;let y=0;
  const S=n=>Math.round(n*k*10)/10,LH=4.2*k;
  const logo=window._bfsLogoB64||(typeof LOGO_BFS!=='undefined'?LOGO_BFS:null);
  const entete=()=>{
    try{if(logo)doc.addImage(logo,'PNG',12,5,16,16)}catch(e){}
    doc.setFont('helvetica','bold');doc.setFontSize(10);doc.setTextColor(60);doc.text(ag.nom,32,11);
    doc.setFont('helvetica','normal');doc.setFontSize(8);doc.text(ag.adresse.join(' — ')+'  |  SIRET '+ag.siret,32,16);
    doc.setDrawColor(230,120,20);doc.setLineWidth(.6);doc.line(M,24,M+W,24);y=30;
  };
  const saut=h=>{if(y+h>278){doc.addPage();entete()}};
  const titre=t=>{saut(10);doc.setFont('helvetica','bold');doc.setFontSize(S(11));doc.setTextColor(230,120,20);doc.text(t,M,y);y+=5.5*k;doc.setTextColor(30)};
  const para=(t,sz=9)=>{doc.setFont('helvetica','normal');doc.setFontSize(S(sz));doc.setTextColor(30);const L=doc.splitTextToSize(t,W);saut(L.length*LH+2);doc.text(L,M,y);y+=L.length*LH+2*k};
  const cp=1.2*k,fs=S(8.5);
  entete();
  doc.setFont('helvetica','bold');doc.setFontSize(S(18));doc.setTextColor(230,120,20);doc.text('OFFRE DE PRIX',M,y);y+=7*k;
  doc.setFontSize(S(9.5));doc.setTextColor(60);doc.setFont('helvetica','normal');
  doc.text(`N° ${o.numero||'—'}  —  Du ${fmt(o.date_offre)}  —  Valable jusqu'au ${fmt(offreValiditeFin(o))}${techNom?'  —  Proposée par '+techNom:''}`,M,y);y+=6*k;
  titre('Client');
  const cl=client||{};
  para([cl.raison_sociale,[cl.adresse,[cl.code_postal,cl.ville].filter(Boolean).join(' ')].filter(Boolean).join(', '),cl.contact_nom?'À l\'attention de '+cl.contact_nom:''].filter(Boolean).join('\n'));
  if(o.objet){titre('Objet');para(o.objet)}
  const lignes=o.lignes||[];
  if(lignes.length){
    titre('Prestations et fournitures');
    doc.autoTable({startY:y,margin:{left:M,right:M},head:[['Désignation','Qté','Unité','PU HT','Total HT']],
      body:lignes.map(l=>[l.designation,String(l.quantite),l.unite||'',_eurO(l.pu_ht),_eurO((+l.quantite||0)*(+l.pu_ht||0))]),
      styles:{fontSize:fs,cellPadding:cp},headStyles:{fillColor:[230,120,20]},columnStyles:{0:{cellWidth:85},1:{halign:'right',cellWidth:14},3:{halign:'right'},4:{halign:'right'}}});
    y=doc.lastAutoTable.finalY+2*k;
    const t=offreTotaux(lignes);
    doc.autoTable({startY:y,margin:{left:M+90,right:M},body:[['Total HT',_eurO(t.ht)],[`TVA ${Math.round(OFFRE_TVA*100)} %`,_eurO(t.tva)],['Total TTC',_eurO(t.ttc)]],theme:'plain',
      styles:{fontSize:S(9.5),cellPadding:1.1*k},columnStyles:{1:{halign:'right'}},didParseCell:d=>{if(d.row.index===2)d.cell.styles.fontStyle='bold'}});
    y=doc.lastAutoTable.finalY+4*k;
  }
  const c=o.contrat_propose;
  if(c&&Array.isArray(c.lignes)&&c.lignes.length){
    titre('Contrat de maintenance proposé');
    const np=OFFRE_PASSAGES[c.periodicite]||1;
    para(`Durée d'engagement : ${c.duree} an${c.duree>1?'s':''} — ${np} passage${np>1?'s':''} par an (${(OFFRE_PERIODES[c.periodicite]||c.periodicite).split(' (')[0].toLowerCase()}). Le prix ci-dessous est le prix annuel par appareil, incluant ${np>1?'les '+np+' passages':'le passage'} de l'année ; TVA en sus.`,8.5);
    doc.autoTable({startY:y,margin:{left:M,right:M},head:[['Équipement','Qté','Prix annuel HT / appareil','Total annuel HT']],
      body:c.lignes.map(l=>[l.libelle||l.type,String(l.quantite),_eurO(l.pu_annuel),_eurO((+l.quantite||0)*(+l.pu_annuel||0))]),
      styles:{fontSize:fs,cellPadding:cp},headStyles:{fillColor:[120,120,120]},columnStyles:{1:{halign:'right'},2:{halign:'right'},3:{halign:'right'}}});
    y=doc.lastAutoTable.finalY+2*k;
    const ta=offreContratTotal(c),dureeAns=+c.duree||1,nbApp=c.lignes.reduce((n,l)=>n+(+l.quantite||0),0);
    doc.autoTable({startY:y,margin:{left:M+60,right:M},theme:'plain',styles:{fontSize:S(9.5),cellPadding:1.0*k},columnStyles:{1:{halign:'right'}},
      body:[[`Total annuel HT (${nbApp} appareil${nbApp>1?'s':''})`,_eurO(ta)],['Total annuel TTC',_eurO(ta*(1+OFFRE_TVA))],[`Engagement sur ${dureeAns} an${dureeAns>1?'s':''} (HT, hors réévaluation annuelle)`,_eurO(ta*dureeAns)]],
      didParseCell:d=>{if(d.row.index===0)d.cell.styles.fontStyle='bold'}});
    y=doc.lastAutoTable.finalY+2*k;
    if(c.reprise)para("Reprise de votre parc existant : les entretiens quinquennaux dus peuvent être réalisés dès la première année ; le prix annuel reste lissé sur la durée d'engagement.",8.5);
    para(`Frais de déplacement : ${c.deplacement||'facturés en sus à chaque passage, au tarif en vigueur'}. Le prix annuel est lissé sur la durée d'engagement afin de répartir le coût des opérations quinquennales ; il est réévalué chaque 1er janvier selon la formule P = Po x (0,15 + 0,30 x IDFD/IDFDo + 0,55 x ICHTrev-TS/ICHTrev-TSo), avec une hausse annuelle minimale de 1 % : le montant sur la durée d'engagement est donc un minimum. En cas de résiliation avant le terme, des frais peuvent être facturés au prorata de la durée restante (part non amortie des entretiens quinquennaux). Les conditions complètes (reconduction, résiliation) figureront dans le contrat de maintenance remis à la signature.`,8.5);
  }
  titre('Conditions');
  para(`Offre valable ${o.validite_jours||30} jours à compter de sa date d'émission. Prix en euros hors taxes, TVA au taux en vigueur. ${OFFRE_PAIEMENT} Cette offre n'engage les parties qu'après acceptation signée par le client. Votre signature vaut acceptation des prestations et fournitures ci-dessus${c&&c.lignes&&c.lignes.length?" et accord de principe sur le contrat de maintenance proposé, qui fera l'objet d'un contrat distinct":''}. Contact : contact@bfs-prevention.fr.`,8.5);
  if(o.notes)para('Remarques : '+o.notes,8.5);
  const bh=Math.max(24,30*k);
  saut(bh+10);
  doc.setFont('helvetica','bold');doc.setFontSize(S(10));doc.setTextColor(30);doc.text('Bon pour accord',M,y);y+=4.5*k;
  doc.setDrawColor(150);doc.setLineWidth(.2);doc.rect(M,y,87,bh);doc.rect(M+93,y,87,bh);
  doc.setFontSize(S(8.5));doc.text('Pour BFS'+(techNom?' — '+techNom:''),M+2,y+4.5);doc.text('Le Client (nom, qualité, date, signature)',M+95,y+4.5);
  doc.setFont('helvetica','normal');doc.setFontSize(7.5);doc.text('Mention « Bon pour accord » manuscrite',M+95,y+9);
  if(o.signature_data){try{doc.addImage(o.signature_data,'PNG',M+97,y+10,55,Math.max(10,bh-15))}catch(e){}
    doc.setFontSize(8);doc.text((o.signataire_nom||'')+(o.signe_le?' — '+fmt(o.signe_le):''),M+95,y+bh-1.5)}
  doc.setFontSize(7);doc.setTextColor(120);
  doc.text(OFFRE_LEGAL,105,286,{align:'center'});
  doc.text(`Offre de prix ${o.numero||''} — ${ag.nom}`,105,290.5,{align:'center'});
  return doc;
}

// ---------- Enregistrement ----------
async function offreEnregistrer(o,{notifier}={}){
  const tot=offreTotaux(o.lignes);
  const {data:num,error:en}=await db.rpc('prochain_numero_offre');if(en)throw en;
  const payload={numero:num,client_id:o.client_id,agence_id:o.agence_id||null,technicien_id:ME.id,date_offre:o.date_offre,validite_jours:o.validite_jours,objet:o.objet||null,lignes:o.lignes,
    contrat_propose:o.contrat_propose||null,total_ht:tot.ht,total_ttc:tot.ttc,statut:o.signature_data?'acceptee':'envoyee',signataire_nom:o.signataire_nom||null,
    signature_data:o.signature_data||null,signe_le:o.signature_data?new Date().toISOString():null,notes:o.notes||null,hors_tarif:!!o.hors_tarif};
  const {data,error}=await db.from('offres').insert(payload).select().single();if(error)throw error;
  return data;
}
// ---------- Mail de facturation au secrétariat (à l'ACCEPTATION de l'offre, avec les codes Galaxy) ----------
// Le contrat est la matérialisation commerciale ; ce qu'on facture, ce sont les articles (ici la vérification / maintenance par type d'équipement)
const OFFRE_ARTICLE_CONTRAT={extincteur:'VAP-POUDRE',baes:'BAES-VERIF',alarme_t4:'MAINT-ALARME-T4'};
const OFFRE_EMAIL_FACTURATION='contact@bfs-prevention.fr';
function _offreBlobB64(blob){return new Promise((ok,ko)=>{const r=new FileReader();r.onload=()=>ok(String(r.result).split(',')[1]||'');r.onerror=ko;r.readAsDataURL(blob)})}
async function offreNotifierFacturation(o,client,techNom,blob,extra={}){
  try{
    if(o.mail_facturation_le)return true; // déjà envoyé : jamais deux fois
    const cl=client||{};
    // Codes Galaxy : ceux enregistrés sur la ligne, sinon relus dans les tarifs (offres créées avant l'ajout du code)
    const codes=[...new Set((o.lignes||[]).filter(l=>l.code&&!l.code_galaxy).map(l=>l.code).concat(Object.values(OFFRE_ARTICLE_CONTRAT)))];
    const gx={};const {data:tf}=await db.from('tarifs').select('code,code_galaxy').in('code',codes);(tf||[]).forEach(t=>gx[t.code]=t.code_galaxy);
    const g=l=>l.code_galaxy||gx[l.code]||null;
    const ligneT=l=>`- ${l.designation} — ${l.quantite} x ${_eurO(l.pu_ht)} HT = ${_eurO((+l.quantite||0)*(+l.pu_ht||0))} HT — Code Galaxy : ${l.code?(g(l)||'NON RENSEIGNÉ (à compléter dans les tarifs)'):'ligne libre (hors tarif) : article à choisir'}`;
    const lignes=o.lignes||[],t=offreTotaux(lignes);
    let txt=`Bonjour Lesli,\n\nL'offre de prix ${o.numero} est ACCEPTÉE par le client${extra.contrat?' et son contrat de maintenance est SIGNÉ':''} : merci de la facturer via Galaxy.\n\nClient : ${cl.raison_sociale||'—'}${cl.ville?' ('+cl.ville+')':''}${cl.siret?'\nSIRET client : '+cl.siret:''}\nOffre du ${fmt(o.date_offre)}${o.signataire_nom?' — signée par '+o.signataire_nom:''}${o.signe_le?' le '+fmt(o.signe_le):''}\nProposée par : ${techNom||'—'}${o.objet?'\nObjet : '+o.objet:''}\n`;
    if(lignes.length)txt+=`\nPRESTATIONS ET FOURNITURES — à facturer :\n${lignes.map(ligneT).join('\n')}\nTotal : ${_eurO(t.ht)} HT / ${_eurO(t.ttc)} TTC\n`;
    const c=o.contrat_propose;
    if(c&&Array.isArray(c.lignes)&&c.lignes.length){
      const np=OFFRE_PASSAGES[c.periodicite]||1;
      txt+=`\nCONTRAT DE MAINTENANCE${c.reprise?' (reprise d\'un parc / contrat existant)':''} — ${extra.contrat?'contrat n° '+(extra.contrat.numero_contrat||'')+' signé sur place par le client (PDF joint)':'contrat distinct à établir et à faire signer'}. Il n'est pas facturé en tant que tel : on facture les articles de vérification / maintenance, par site, à chaque visite.\nDurée ${c.duree} an(s) — ${np} visite(s) par an. À facturer à chaque visite :\n${c.lignes.map(l=>{const ac=OFFRE_ARTICLE_CONTRAT[l.type],ar=ac?(tf||[]).find(t=>t.code===ac):null;const visite=_r2((+l.quantite||0)*(+l.pu_annuel||0)/np);return `- ${l.libelle||l.type} : ${l.quantite} appareil(s) x ${_eurO(l.pu_annuel)} HT/an = ${_eurO(visite)} HT par visite — Code Galaxy : ${ar&&ar.code_galaxy?ar.code_galaxy+' ('+ac+')':'à renseigner (article vérification de ce type d\'équipement)'}`}).join('\n')}\nTotal annuel : ${_eurO(offreContratTotal(c))} HT. Frais de déplacement : ${c.deplacement||'en sus à chaque passage, au tarif en vigueur'}.\n`;
    }
    if(o.notes)txt+=`\nRemarques : ${o.notes}\n`;
    txt+=`\n${extra.clientMailOk===true?'Le client a reçu ses documents par mail ('+extra.email+').':extra.clientMailOk===false?'⚠️ Le mail au client n\'a pas pu être envoyé : à lui transmettre.':'Aucune adresse mail client : les documents ne lui ont pas été envoyés par mail.'}\n\nL'offre signée${extra.contrat?' et le contrat signé sont':' est'} en pièce jointe.\n\nBFS Contrôle`;
    const body={a:[OFFRE_EMAIL_FACTURATION],sujet:`BFS — Offre acceptée à facturer ${o.numero} — ${cl.raison_sociale||''}`.trim(),texte:txt};
    const pjs=[];
    if(blob&&blob.size<=15*1024*1024)pjs.push({nom:`Offre_${o.numero}.pdf`.replace(/[^\w.-]+/g,'_'),base64:await _offreBlobB64(blob)});
    if(extra.contratBlob&&extra.contratBlob.size<=15*1024*1024)pjs.push({nom:`Contrat_${extra.contrat?.numero_contrat||'maintenance'}.pdf`.replace(/[^\w.-]+/g,'_'),base64:await _offreBlobB64(extra.contratBlob)});
    if(pjs.length)body.pieces_jointes=pjs;
    const {data,error}=await db.functions.invoke('envoyer-mail',{body});
    if(error||!data?.envoye){console.warn('Mail facturation offre non envoyé',error||data);return false}
    await db.from('offres').update({mail_facturation_le:new Date().toISOString()}).eq('id',o.id);
    o.mail_facturation_le=new Date().toISOString();
    return true;
  }catch(e){console.warn('Mail facturation offre',e);return false}
}


// ---------- Vente sur place : contrat signé + mails client / Lesli ----------
const VENTE_EMAIL_RE=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
async function venteCreerContrat(offre,client,{debut,sig,nom}){
  const c=offre.contrat_propose;if(!c||!Array.isArray(c.lignes)||!c.lignes.length)return null;
  const duree=+c.duree||1,d0=debut||new Date().toISOString().slice(0,10);
  const df=new Date(d0+'T12:00:00');df.setFullYear(df.getFullYear()+duree);
  let numero=null;{const {data,error}=await db.rpc('prochain_numero_contrat');if(!error&&data)numero=data}
  if(!numero){const pre='CT-'+new Date().getFullYear()+'-';const {data:d2}=await db.from('contrats').select('numero_contrat').like('numero_contrat',pre+'%');
    let max=0;(d2||[]).forEach(x=>{const n=parseInt((x.numero_contrat||'').slice(pre.length),10);if(n>max)max=n});numero=pre+String(max+1).padStart(3,'0')}
  const lignes=c.lignes.map(l=>{const g=(typeof _of!=='undefined'&&_of.grille||[]).find(x=>x.type_equipement_code===l.type&&x.periodicite===c.periodicite);
    return {type:l.type,marque:'',modele:'',quantite:+l.quantite||1,pu:g?+g.prix_ref_5ans:_r2((+l.pu_annuel||0)*duree/5),pu_source:'grille',resume:''}});
  const total=_r2(c.lignes.reduce((t,l)=>t+(+l.quantite||0)*(+l.pu_annuel||0),0));
  const {data:ct,error}=await db.from('contrats').insert({
    client_id:client.id,agence_id:client.agence_id||ME.agence_id||null,numero_contrat:numero,type_contrat:duree>1?'pluriannuel':'annuel',
    types_couverts:[...new Set(lignes.map(l=>l.type))],lignes,date_debut:d0,date_fin:df.toISOString().slice(0,10),duree_engagement:duree,
    tarif_annuel:total||null,periodicite_visite:c.periodicite,tarif_verifie_le:new Date().toISOString(),lignes_hors_grille:0,statut:'actif',
    notes:`Contrat signé sur place — issu de l'offre ${offre.numero}${c.reprise?' (reprise de parc / contrat existant)':''}`,
    frais_deplacement_mode:'facture',zone_deplacement:null,frais_deplacement_km:null,frais_deplacement_ht:null,
    signature_data:sig,signataire_nom:nom,signe_le:new Date().toISOString()
  }).select('*').single();
  if(error)throw error;
  await db.from('offres').update({contrat_id:ct.id}).eq('id',offre.id);
  // PDF du contrat (exemplaire d'origine, figé à la signature)
  let blob=null;
  try{
    if(typeof construireContratPDF==='function'){
      const res=await construireContratPDF(ct.id);
      if(res){const ab=res.doc.output('arraybuffer');blob=new Blob([ab],{type:'application/pdf'});
        if(typeof figerPdfContratSigne==='function')try{await figerPdfContratSigne(ct.id,ab)}catch(e){console.warn('Archivage contrat',e)}}
    }
  }catch(e){console.warn('PDF contrat',e)}
  return {contrat:ct,blob};
}
async function venteMailClient(offre,client,{email,contrat,offreBlob,contratBlob,agenceNom}){
  if(!email||!VENTE_EMAIL_RE.test(email))return null;
  try{
    const pjs=[{nom:`Offre_${offre.numero}.pdf`.replace(/[^\w.-]+/g,'_'),base64:await _offreBlobB64(offreBlob)}];
    if(contratBlob)pjs.push({nom:`Contrat_${contrat.numero_contrat||'maintenance'}.pdf`.replace(/[^\w.-]+/g,'_'),base64:await _offreBlobB64(contratBlob)});
    const texte=`Bonjour,\n\nMerci pour votre confiance. Vous trouverez ci-joint :\n- votre offre de prix n° ${offre.numero}, signée${contrat?'\n- votre contrat de maintenance n° '+contrat.numero_contrat+', signé':''}.\n\nNous restons à votre disposition pour toute question.\n\nCordialement,\n${agenceNom||'BFS'}\ncontact@bfs-prevention.fr`;
    const {data,error}=await db.functions.invoke('envoyer-mail',{body:{a:[email],sujet:`${agenceNom||'BFS'} — Votre offre n° ${offre.numero}${contrat?' et votre contrat n° '+contrat.numero_contrat:''}`,texte,pieces_jointes:pjs}});
    if(error||!data?.envoye){console.warn('Mail client non envoyé',error||data);return false}
    await db.from('offres').update({mail_client_le:new Date().toISOString(),email_client:email}).eq('id',offre.id);
    return true;
  }catch(e){console.warn('Mail client',e);return false}
}
// Mail du bon d'intervention au client (appelé par le terrain à la validation du bon, avec le contrat signé le jour même s'il existe)
async function venteMailClientBon(pdfBlob,{titre,numero,client,docs,sansContrat}){
  try{
    const email=(client&&client.contact_email||'').trim();if(!email||!VENTE_EMAIL_RE.test(email)||!pdfBlob)return null;
    const pjs=[{nom:`${titre}_${numero||Date.now()}.pdf`.replace(/[^\w.-]+/g,'_'),base64:await _offreBlobB64(pdfBlob)}];
    let tot=pdfBlob.size,docTxt='';
    for(const [nom,b,lib] of [['Bulletin',docs?.bulletin,'bulletin d\'intervention'],['Bulletin_detaille',docs?.detail,'bulletin détaillé de vérification']]){
      if(b&&tot+b.size<=15*1024*1024){tot+=b.size;pjs.push({nom:`${nom}_${numero||Date.now()}.pdf`.replace(/[^\w.-]+/g,'_'),base64:await _offreBlobB64(b)});docTxt+=`\n- votre ${lib}`}
    }
    let ctTxt=docTxt;
    if(!sansContrat)try{ // contrat signé aujourd'hui pour ce client : joint au même mail
      const since=new Date(Date.now()-24*3600*1000).toISOString();
      const {data:cts}=await db.from('contrats').select('id,numero_contrat,signe_le').eq('client_id',client.id).gte('signe_le',since).order('signe_le',{ascending:false}).limit(1);
      if(cts&&cts[0]&&typeof pdfContratFige==='function'){const ab=await pdfContratFige(cts[0].id);
        if(ab){pjs.push({nom:`Contrat_${cts[0].numero_contrat||'maintenance'}.pdf`.replace(/[^\w.-]+/g,'_'),base64:arrayBufferVersB64Vente(ab)});ctTxt+=`\n- votre contrat de maintenance n° ${cts[0].numero_contrat}, signé`}}
    }catch(e){console.warn('Contrat joint au bon',e)}
    const texte=`Bonjour,\n\nVous trouverez ci-joint, suite à notre intervention du ${new Date().toLocaleDateString('fr-FR')} :\n- votre ${titre.toLowerCase()}${numero?' n° '+numero:''}${ctTxt}.\n\nNous restons à votre disposition pour toute question.\n\nCordialement,\nBFS\ncontact@bfs-prevention.fr`;
    const {data,error}=await db.functions.invoke('envoyer-mail',{body:{a:[email],sujet:`BFS — Votre ${titre.toLowerCase()}${numero?' n° '+numero:''}`,texte,pieces_jointes:pjs}});
    return !(error||!data?.envoye);
  }catch(e){console.warn('Mail client bon',e);return false}
}
function arrayBufferVersB64Vente(buf){const b=new Uint8Array(buf);let s='';for(let i=0;i<b.length;i+=0x8000)s+=String.fromCharCode.apply(null,b.subarray(i,i+0x8000));return btoa(s)}

async function offreMajStatut(id,statut){
  const {error}=await db.from('offres').update({statut,updated_at:new Date().toISOString()}).eq('id',id);
  if(error){toast('Erreur : '+error.message,'err');return false}return true;
}

// ---------- Interface terrain : écran de création ----------
let _of={lignes:[],tarifs:[],grille:[],contrat:{actif:false,duree:5,periodicite:'annuelle',lignes:[]},types:[],sig:null};
async function offreOuvrir(){
  if(typeof currentClient==='undefined'||!currentClient){toast('Ouvre d\'abord un client','err');return}
  const root=$('of-root');if(!root)return;
  root.innerHTML='<div class="loading">Chargement…</div>';goTo('s-offre');
  const [t,g,ty]=await Promise.all([
    db.from('tarifs').select('id,code,designation,prix_ht,unite,categorie,code_galaxy').eq('actif',true).order('categorie').order('designation'),
    db.from('grille_tarifs_contrat').select('*').eq('actif',true),
    db.from('types_equipements').select('code,libelle,icone').eq('actif',true)]);
  if(typeof typesEquip==='undefined')window.typesEquip=ty.data||[];
  _of={lignes:[],tarifs:t.data||[],grille:g.data||[],types:ty.data||[],contrat:{actif:false,duree:5,periodicite:'annuelle',lignes:[]},sig:null};
  offreRendre();offreChargerListe();
}
function offreGrillePrix(type,periodicite,duree){
  const g=_of.grille.find(x=>x.type_equipement_code===type&&x.periodicite===periodicite);
  return g?_r2(g.prix_ref_5ans*5/duree):null;
}
function offreRendre(){
  const root=$('of-root');if(!root)return;
  const inp='padding:9px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:14px;width:100%';
  const t=offreTotaux(_of.lignes),c=_of.contrat,ta=offreContratTotal(c);
  const gardeVals={objet:$('of-objet')?.value||'',valid:$('of-valid')?.value||'30',notes:$('of-notes')?.value||'',nom:$('of-nom')?.value||'',q:$('of-q')?.value||'',mail:$('of-mail')?.value??((typeof currentClient!=='undefined'&&currentClient&&currentClient.contact_email)||''),debut:$('of-debut')?.value||new Date().toISOString().slice(0,10)};
  const resultats=gardeVals.q.trim().length>=2?_of.tarifs.filter(x=>(x.designation+' '+x.code).toLowerCase().includes(gardeVals.q.trim().toLowerCase())).slice(0,8):[];
  root.innerHTML=`
  <div style="padding:14px">
    <div style="font-weight:700;font-size:15px;margin-bottom:8px">${_escO(currentClient.raison_sociale)}</div>
    <label style="font-size:12px;font-weight:600">Objet de l'offre</label>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin:4px 0 6px">
      <button class="btn btn-s btn-xs" onclick="offreObjetType('installation')">🧯 Nouvelle installation</button>
      <button class="btn btn-s btn-xs" onclick="offreObjetType('reprise')">🔄 Reprise de contrat</button>
      <button class="btn btn-s btn-xs" onclick="offreObjetType('remplacement')">♻️ Remplacement</button></div>
    <input id="of-objet" style="${inp};margin-bottom:12px" placeholder="Ex. Fourniture et installation de 5 extincteurs" value="${_escO(gardeVals.objet)}">
    <div style="font-weight:700;margin:8px 0 4px">Prestations / fournitures</div>
    <div style="font-size:12px;font-weight:600;margin:2px 0 4px">🧯 Extincteurs et équipements à vendre <span style="font-weight:400;color:var(--txt-l)">(touche pour ajouter)</span></div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">${_of.tarifs.filter(x=>x.categorie==='equipement'&&x.prix_ht!=null).map(x=>`<button class="btn btn-s btn-xs" style="text-align:left;line-height:1.25" onclick="offreAjouterTarif('${x.id}')">${_escO(x.designation.replace(/^Extincteur /,''))}<br><b>${_eurO(x.prix_ht)}</b></button>`).join('')||'<span style="font-size:12px;color:var(--txt-l)">Aucun équipement tarifé</span>'}</div>
    <input id="of-q" style="${inp}" placeholder="🔎 Chercher dans le tarif : accessoires, pièces, prestations… (2 lettres min.)" oninput="offreRendre();setTimeout(()=>{const e=$('of-q');e.focus();e.setSelectionRange(e.value.length,e.value.length)},0)" value="${_escO(gardeVals.q)}">
    ${resultats.map(r=>`<div onclick="offreAjouterTarif('${r.id}')" style="padding:9px 10px;border-bottom:1px solid #eee;font-size:13px;cursor:pointer"><b>${_escO(r.designation)}</b><br><span style="color:var(--txt-l)">${_escO(r.code)} · ${_eurO(r.prix_ht)} / ${_escO(r.unite||'u')}</span> <span style="color:var(--rouge);float:right">＋ ajouter</span></div>`).join('')}
    <button class="btn btn-s btn-sm" style="margin:6px 0" onclick="offreAjouterLibre()">＋ Ligne libre</button>
    ${_of.lignes.map((l,i)=>`<div style="border:1px solid #e5e7eb;border-radius:10px;padding:8px 10px;margin:6px 0;background:#fff">
      <div style="font-size:13px;font-weight:600">${_escO(l.designation)}${l.hors_tarif?' <span style="color:#b45309;font-size:11px">· hors tarif</span>':''}</div>
      <div style="display:flex;gap:8px;align-items:center;margin-top:6px">
        <label style="font-size:11px">Qté <input type="number" min="0" step="1" value="${l.quantite}" onchange="offreMajLigne(${i},'quantite',this.value)" style="width:60px;padding:7px;border:1.5px solid #e5e7eb;border-radius:8px"></label>
        <label style="font-size:11px">PU HT <input type="number" min="0" step="0.01" value="${l.pu_ht}" onchange="offreMajLigne(${i},'pu_ht',this.value)" style="width:85px;padding:7px;border:1.5px solid #e5e7eb;border-radius:8px"></label>
        <span style="margin-left:auto;font-weight:700">${_eurO(l.quantite*l.pu_ht)}</span>
        <button class="btn btn-s btn-xs" onclick="offreSuppr(${i})">✕</button></div></div>`).join('')}
    <div style="text-align:right;font-size:13px;margin:6px 0">Total HT <b>${_eurO(t.ht)}</b> · TTC <b>${_eurO(t.ttc)}</b></div>

    <label style="display:flex;gap:8px;align-items:center;margin:14px 0 6px;font-weight:700"><input type="checkbox" ${c.actif?'checked':''} onchange="offreBasculerContrat(this.checked)"> Proposer aussi un contrat de maintenance</label>
    ${c.actif?`<div style="border:1.5px solid #fed7aa;background:#fff7ed;border-radius:10px;padding:10px">
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <label style="font-size:12px">Durée <select onchange="offreMajContrat('duree',this.value)" style="padding:8px;border-radius:8px;border:1.5px solid #e5e7eb">${[1,2,3,4,5].map(n=>`<option value="${n}"${+c.duree===n?' selected':''}>${n} an${n>1?'s':''}</option>`).join('')}</select></label>
        <label style="font-size:12px">Périodicité <select onchange="offreMajContrat('periodicite',this.value)" style="padding:8px;border-radius:8px;border:1.5px solid #e5e7eb">${Object.entries(OFFRE_PERIODES).map(([k,v])=>`<option value="${k}"${c.periodicite===k?' selected':''}>${v}</option>`).join('')}</select></label>
      </div>
      <label style="display:flex;gap:8px;align-items:center;font-size:12.5px;margin-top:8px"><input type="checkbox" ${c.reprise?'checked':''} onchange="_of.contrat.reprise=this.checked;offreRendre()"> Reprise d'un parc / d'un contrat existant (autre prestataire)</label>
      <div style="font-size:11.5px;color:var(--txt-l);margin:6px 0">Prix annuel par appareil issu de la grille tarifaire, selon la durée et la périodicité (plus l'engagement est long, plus le prix est bas).</div>
      ${c.lignes.map((l,i)=>`<div style="display:flex;gap:8px;align-items:center;margin:5px 0;font-size:13px"><span style="flex:1">${_escO(l.libelle)}</span>
        <input type="number" min="1" value="${l.quantite}" onchange="offreMajLigneContrat(${i},this.value)" style="width:55px;padding:7px;border:1.5px solid #e5e7eb;border-radius:8px">
        <span style="width:90px;text-align:right">${l.pu_annuel!=null?_eurO(l.pu_annuel):'<span style="color:#b45309">hors grille</span>'}</span>
        <button class="btn btn-s btn-xs" onclick="offreSupprContrat(${i})">✕</button></div>`).join('')}
      <select id="of-ctype" style="${inp};margin-top:6px"><option value="">＋ Ajouter un type d'équipement…</option>${_of.types.map(t=>`<option value="${t.code}">${_escO((t.icone||'')+' '+t.libelle)}</option>`).join('')}</select>
      <div style="text-align:right;margin-top:6px;font-size:13px">Total <b>${_eurO(ta)}</b> HT / an</div></div>`:''}

    <div style="display:flex;gap:10px;margin-top:14px"><div style="flex:1"><label style="font-size:12px;font-weight:600">Validité (jours)</label><input id="of-valid" type="number" min="1" style="${inp}" value="${_escO(gardeVals.valid)}"></div></div>
    <label style="font-size:12px;font-weight:600;display:block;margin-top:10px">Remarques</label>
    <textarea id="of-notes" style="${inp}" rows="2">${_escO(gardeVals.notes)}</textarea>

    <div style="font-weight:700;margin:14px 0 4px">Accord du client <span style="font-weight:400;color:var(--txt-l)">(facultatif — signer maintenant si le client accepte)</span></div>
    <input id="of-nom" style="${inp};margin-bottom:6px" placeholder="Nom du signataire" value="${_escO(gardeVals.nom)}">
    <canvas id="of-sig" style="width:100%;height:130px;border:2px dashed #cbd5e1;border-radius:10px;background:#fff;touch-action:none"></canvas>
    <button class="btn btn-s btn-xs" onclick="offreEffacerSig()" style="margin-top:4px">Effacer la signature</button>
    ${c.actif&&c.lignes.length?`<div style="font-weight:700;margin:16px 0 4px">Signature du contrat de maintenance <span style="font-weight:400;color:var(--txt-l)">(facultatif — pour que le client signe son contrat tout de suite)</span></div>
      <label style="font-size:12px;font-weight:600">Début du contrat</label><input id="of-debut" type="date" style="${inp};margin-bottom:6px" value="${_escO(gardeVals.debut)}">
      <canvas id="of-sig2" style="width:100%;height:130px;border:2px dashed #fdba74;border-radius:10px;background:#fff;touch-action:none"></canvas>
      <button class="btn btn-s btn-xs" onclick="offreEffacerSig('2')" style="margin-top:4px">Effacer la signature du contrat</button>`:''}
    <label style="font-size:12px;font-weight:600;display:block;margin-top:14px">✉️ Email du client <span style="font-weight:400;color:var(--txt-l)">(il reçoit l'offre${c.actif&&c.lignes.length?' et le contrat':''} signé${c.actif&&c.lignes.length?'s':''} dès la validation)</span></label>
    <input id="of-mail" type="email" style="${inp}" placeholder="client@entreprise.fr" value="${_escO(gardeVals.mail)}">
    <button class="btn btn-p" style="width:100%;margin-top:16px;padding:14px" id="of-btn" onclick="offreValider()">📄 Créer l'offre de prix</button>
    <div id="of-liste" style="margin-top:22px"></div>
  </div>`;
  offreInitSig();if($('of-sig2'))offreInitPad('of-sig2','2');
  const ct=$('of-ctype');if(ct)ct.onchange=()=>{if(ct.value)offreAjouterTypeContrat(ct.value)};
}
function offreObjetType(k){
  const o={installation:"Fourniture et installation d'extincteurs",reprise:"Reprise de votre contrat de maintenance des extincteurs",remplacement:"Remplacement d'extincteurs"}[k];
  const el=$('of-objet');if(el)el.value=o;
  if(k==='reprise'){_of.contrat.actif=true;_of.contrat.reprise=true}
  offreRendre();
}
function offreAjouterTarif(id){
  const t=_of.tarifs.find(x=>x.id===id);if(!t)return;
  const ex=_of.lignes.find(l=>l.code===t.code&&!l.hors_tarif);if(ex){ex.quantite+=1;const q0=$('of-q');if(q0)q0.value='';offreRendre();return}
  _of.lignes.push({code:t.code,code_galaxy:t.code_galaxy||null,designation:t.designation,quantite:1,pu_ht:+t.prix_ht,unite:t.unite||'',tarif_pu:+t.prix_ht,hors_tarif:false});
  const q=$('of-q');if(q)q.value='';offreRendre();
}
function offreAjouterLibre(){
  const d=prompt('Désignation de la ligne :');if(!d)return;
  const p=parseFloat(String(prompt('Prix unitaire HT (€) :','0')).replace(',','.'));if(isNaN(p))return;
  _of.lignes.push({code:null,designation:d,quantite:1,pu_ht:p,unite:'',tarif_pu:null,hors_tarif:true});offreRendre();
}
function offreMajLigne(i,k,v){
  const l=_of.lignes[i];if(!l)return;const n=parseFloat(String(v).replace(',','.'));l[k]=isNaN(n)?0:n;
  if(k==='pu_ht'&&l.tarif_pu!=null)l.hors_tarif=_r2(l.pu_ht)!==_r2(l.tarif_pu);offreRendre();
}
function offreSuppr(i){_of.lignes.splice(i,1);offreRendre()}
function offreBasculerContrat(v){_of.contrat.actif=v;offreRendre()}
function offreMajContrat(k,v){_of.contrat[k]=k==='duree'?+v:v;_of.contrat.lignes.forEach(l=>l.pu_annuel=offreGrillePrix(l.type,_of.contrat.periodicite,_of.contrat.duree));offreRendre()}
function offreAjouterTypeContrat(code){
  const t=_of.types.find(x=>x.code===code);
  _of.contrat.lignes.push({type:code,libelle:t?t.libelle:code,quantite:1,pu_annuel:offreGrillePrix(code,_of.contrat.periodicite,_of.contrat.duree)});offreRendre();
}
function offreMajLigneContrat(i,v){const l=_of.contrat.lignes[i];if(l){l.quantite=Math.max(1,parseInt(v)||1);offreRendre()}}
function offreSupprContrat(i){_of.contrat.lignes.splice(i,1);offreRendre()}
// Signature client (pavé tactile simple)
function offreInitSig(){offreInitPad('of-sig','')}
function offreInitPad(cvId,k){
  const cv=$(cvId);if(!cv)return;
  const r=cv.getBoundingClientRect(),dpr=window.devicePixelRatio||1;cv.width=Math.max(1,r.width*dpr);cv.height=Math.max(1,r.height*dpr);
  const ctx=cv.getContext('2d');ctx.scale(dpr,dpr);ctx.lineWidth=2.5;ctx.lineCap='round';ctx.strokeStyle='#1a1a2e';
  const st=_of['sig'+k]={cv,ctx,has:!!(_of['sigData'+k]),drawing:false};
  if(_of['sigData'+k]){const im=new Image();im.onload=()=>ctx.drawImage(im,0,0,r.width,r.height);im.src=_of['sigData'+k]}
  const pos=e=>{const b=cv.getBoundingClientRect(),t=e.touches?e.touches[0]:e;return{x:t.clientX-b.left,y:t.clientY-b.top}};
  const start=e=>{e.preventDefault();st.drawing=true;st.has=true;const p=pos(e);ctx.beginPath();ctx.moveTo(p.x,p.y)};
  const move=e=>{if(!st.drawing)return;e.preventDefault();const p=pos(e);ctx.lineTo(p.x,p.y);ctx.stroke()};
  const end=()=>{st.drawing=false;if(st.has)_of['sigData'+k]=cv.toDataURL('image/png')};
  cv.ontouchstart=start;cv.ontouchmove=move;cv.ontouchend=end;cv.onmousedown=start;cv.onmousemove=move;cv.onmouseup=end;cv.onmouseleave=end;
}
function offreEffacerSig(k=''){_of['sigData'+k]=null;offreInitPad(k==='2'?'of-sig2':'of-sig',k);if(_of['sig'+k]){_of['sig'+k].has=false;_of['sig'+k].ctx.clearRect(0,0,9999,9999)}}
async function offreValider(){
  const lignes=_of.lignes.filter(l=>l.quantite>0);
  const c=_of.contrat;
  const contratOk=c.actif&&c.lignes.length;
  if(!lignes.length&&!contratOk){toast('Ajoute au moins une ligne ou un contrat','err');return}
  if(c.actif&&c.lignes.some(l=>l.pu_annuel==null)&&!confirm('Certains types du contrat n\'ont pas de prix dans la grille (affichés « hors grille »). Continuer sans leur prix ?'))return;
  const signe=!!(_of.sig&&_of.sig.has);const nom=$('of-nom').value.trim();
  const signeContrat=!!(contratOk&&_of.sig2&&_of.sig2.has);
  if((signe||signeContrat)&&!nom){toast('Nom du signataire obligatoire pour une offre signée','err');return}
  if(signeContrat&&!signe){toast("Le client doit aussi signer l'offre (première signature)",'err');return}
  const emailClient=($('of-mail')?.value||'').trim();
  if(emailClient&&!VENTE_EMAIL_RE.test(emailClient)){toast("L'adresse mail du client semble incorrecte",'err');return}
  const btn=$('of-btn');btn.disabled=true;btn.textContent='⏳ Création…';
  try{
    await offreAssurerLogo();
    const o={client_id:currentClient.id,agence_id:currentClient.agence_id,date_offre:new Date().toISOString().slice(0,10),validite_jours:parseInt($('of-valid').value)||30,
      objet:$('of-objet').value.trim(),lignes,notes:$('of-notes').value.trim(),hors_tarif:lignes.some(l=>l.hors_tarif),
      contrat_propose:contratOk?{duree:c.duree,periodicite:c.periodicite,reprise:!!c.reprise,lignes:c.lignes.filter(l=>l.pu_annuel!=null),total_annuel_ht:offreContratTotal(c)}:null,
      signature_data:signe?_of.sigData||_of.sig.cv.toDataURL('image/png'):null,signataire_nom:signe?nom:null};
    const saved=await offreEnregistrer(o);
    const tech=((ME.prenom||'')+' '+(ME.nom||'')).trim();
    const doc=construireOffrePDF(saved,currentClient,currentClient.agences?.code||ME.agences?.code,tech);
    const blob=doc.output('blob');
    try{await db.storage.from('bons-intervention').upload(`offre_${saved.numero}.pdf`,blob,{contentType:'application/pdf',upsert:true})}catch(e){console.warn('Upload offre',e)}
    let ctRes=null;
    if(signeContrat){
      try{ctRes=await venteCreerContrat(saved,currentClient,{debut:$('of-debut')?.value||null,sig:_of.sigData2||_of.sig2.cv.toDataURL('image/png'),nom})}
      catch(e){console.warn('Contrat',e);toast('⚠️ Offre créée mais contrat non créé : '+(e.message||e),'err')}
    }
    if(saved.statut==='acceptee'){
      const agNom=(OFFRE_AGENCES[currentClient.agences?.code||ME.agences?.code]||OFFRE_AGENCES.briec).nom;
      let okC=null;
      if(emailClient){
        if(!currentClient.contact_email)try{await db.from('clients').update({contact_email:emailClient}).eq('id',currentClient.id);currentClient.contact_email=emailClient}catch(e){}
        okC=await venteMailClient(saved,currentClient,{email:emailClient,contrat:ctRes?.contrat,offreBlob:blob,contratBlob:ctRes?.blob,agenceNom:agNom});
      }
      const okM=await offreNotifierFacturation(saved,currentClient,tech,blob,{contrat:ctRes?.contrat,contratBlob:ctRes?.blob,clientMailOk:okC,email:emailClient});
      toast((okC?'📨 Documents envoyés au client. ':emailClient?'⚠️ Mail client non envoyé. ':'')+(okM?'📨 Secrétariat prévenu pour facturation.':'⚠️ Mail secrétariat non envoyé — relance depuis la liste des offres.'),okM&&okC!==false?'ok':'err');
    }
    try{offreTelecharger(blob,`BFS_offre_${saved.numero}.pdf`)}catch(e){console.warn('Téléchargement offre',e)}
    toast('Offre '+saved.numero+' créée ✓'+(ctRes?' — contrat '+ctRes.contrat.numero_contrat+' signé ✓':''));
    try{if(typeof demApresOffre==='function')demApresOffre(currentClient,!!ctRes)}catch(e){console.warn('CRM',e)}
    _of.lignes=[];_of.contrat={actif:false,duree:5,periodicite:'annuelle',lignes:[],reprise:false};_of.sigData=null;_of.sigData2=null;offreRendre();offreChargerListe();
  }catch(e){toast('Erreur : '+(e.message||e),'err');btn.disabled=false;btn.textContent='📄 Créer l\'offre de prix'}
}
function offreTelecharger(blob,nom){
  const f=new File([blob],nom,{type:'application/pdf'});
  if(navigator.canShare&&navigator.canShare({files:[f]})){navigator.share({files:[f],title:nom}).catch(()=>{})}
  else{const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=nom;document.body.appendChild(a);a.click();a.remove()}
}
async function offreChargerListe(){
  const el=$('of-liste');if(!el||typeof currentClient==='undefined')return;
  const {data}=await db.from('offres').select('*').eq('client_id',currentClient.id).order('created_at',{ascending:false}).limit(20);
  const l=data||[];
  el.innerHTML=l.length?`<div style="font-weight:700;margin-bottom:6px">Offres de ce client</div>${l.map(o=>{const st=offreEstExpiree(o)?'expiree':o.statut;return `<div style="border:1px solid #e5e7eb;border-radius:10px;padding:8px 10px;margin-bottom:6px;background:#fff;font-size:13px">
    <div style="display:flex;justify-content:space-between"><b>${_escO(o.numero)}</b><span>${OFFRE_STATUTS[st]||st}</span></div>
    <div style="color:var(--txt-l)">${fmt(o.date_offre)} · ${_eurO(o.total_ht)} HT${o.contrat_propose?' · contrat '+_eurO(offreContratTotal(o.contrat_propose))+'/an':''}</div>
    <div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap"><button class="btn btn-s btn-xs" onclick="offreTelechargerId('${o.id}')">📄 PDF</button>
    ${o.statut==='envoyee'?`<button class="btn btn-s btn-xs" onclick="offreChangerStatut('${o.id}','acceptee')">✅ Acceptée</button><button class="btn btn-s btn-xs" onclick="offreChangerStatut('${o.id}','refusee')">❌ Refusée</button>`:''}
    ${o.statut==='acceptee'&&!o.mail_facturation_le?`<button class="btn btn-p btn-xs" onclick="offreFacturerId('${o.id}')">📨 Envoyer au secrétariat</button>`:''}</div></div>`}).join('')}`:'';
}
async function offreFacturerId(id){
  const {data:o}=await db.from('offres').select('*,clients(*,agences(code)),profils(prenom,nom)').eq('id',id).single();
  if(!o||o.mail_facturation_le)return;
  await offreAssurerLogo();
  const tech=o.profils?((o.profils.prenom||'')+' '+(o.profils.nom||'')).trim():'';
  const doc=construireOffrePDF(o,o.clients,o.clients?.agences?.code,tech);
  let extra={};
  if(o.contrat_id){try{const {data:ct}=await db.from('contrats').select('id,numero_contrat').eq('id',o.contrat_id).single();
    if(ct){extra.contrat=ct;if(typeof pdfContratFige==='function'){const ab=await pdfContratFige(ct.id);if(ab)extra.contratBlob=new Blob([ab],{type:'application/pdf'})}}}catch(e){}}
  const okM=await offreNotifierFacturation(o,o.clients,tech,doc.output('blob'),extra);
  toast(okM?'📨 Mail de facturation envoyé au secrétariat':'⚠️ Mail de facturation non envoyé',okM?'ok':'err');
  if($('of-liste'))offreChargerListe();if($('tbl-offres'))offresListeBureau();
}
async function offreChangerStatut(id,s){if(await offreMajStatut(id,s)){toast('Statut mis à jour');
  if(s==='acceptee')await offreFacturerId(id);
  if($('of-liste'))offreChargerListe();if($('tbl-offres'))offresListeBureau()}}
async function offreTelechargerId(id){
  const {data:o}=await db.from('offres').select('*,clients(*,agences(code)),profils(prenom,nom)').eq('id',id).single();
  if(!o){toast('Offre introuvable','err');return}
  await offreAssurerLogo();
  const doc=construireOffrePDF(o,o.clients,o.clients?.agences?.code,o.profils?((o.profils.prenom||'')+' '+o.profils.nom).trim():'');
  offreTelecharger(doc.output('blob'),`BFS_offre_${o.numero}.pdf`);
}

// ---------- Bureau : liste des offres ----------
let _offresBureau=[];
async function offresListeBureau(){
  const el=$('tbl-offres');if(!el)return;
  const {data,error}=await db.from('offres').select('*,clients(raison_sociale),profils(prenom,nom)').order('created_at',{ascending:false});
  if(error){el.innerHTML='<div class="t-empty">Erreur : '+_escO(error.message)+'</div>';return}
  _offresBureau=data||[];offresRendreBureau();
}
function offresRendreBureau(){
  const el=$('tbl-offres');if(!el)return;
  const q=($('q-offres')?.value||'').toLowerCase(),fs=$('f-statut-offre')?.value||'';
  const d=_offresBureau.filter(o=>((o.numero||'')+(o.clients?.raison_sociale||'')).toLowerCase().includes(q)&&(!fs||(offreEstExpiree(o)?'expiree':o.statut)===fs));
  if(!d.length){el.innerHTML='<div class="t-empty">Aucune offre</div>';return}
  el.innerHTML=`<table><thead><tr><th>N°</th><th>Client</th><th>Date</th><th>Technicien</th><th>Total HT</th><th>Contrat / an</th><th>Statut</th><th>Actions</th></tr></thead><tbody>${d.map(o=>{const st=offreEstExpiree(o)?'expiree':o.statut;return `<tr>
    <td><b>${_escO(o.numero)}</b>${o.hors_tarif?' <span title="Prix modifiés hors tarif" style="color:#b45309">⚠</span>':''}</td><td>${_escO(o.clients?.raison_sociale)}</td><td>${fmt(o.date_offre)}</td>
    <td>${_escO(o.profils?((o.profils.prenom||'')+' '+o.profils.nom):'—')}</td><td style="text-align:right">${_eurO(o.total_ht)}</td>
    <td style="text-align:right">${o.contrat_propose?_eurO(offreContratTotal(o.contrat_propose)):'—'}</td><td>${OFFRE_STATUTS[st]||st}</td>
    <td><div class="ia"><button class="btn btn-s btn-xs" onclick="offreTelechargerId('${o.id}')" title="PDF">📄</button>
    ${o.statut==='envoyee'?`<button class="btn btn-s btn-xs" onclick="offreChangerStatut('${o.id}','acceptee')" title="Marquer acceptée">✅</button><button class="btn btn-s btn-xs" onclick="offreChangerStatut('${o.id}','refusee')" title="Marquer refusée">❌</button>`:''}${o.statut==='acceptee'?(o.mail_facturation_le?`<span title="Mail de facturation envoyé le ${fmt(o.mail_facturation_le)}" style="font-size:12px">📨 ✓</span>`:`<button class="btn btn-p btn-xs" onclick="offreFacturerId('${o.id}')" title="Envoyer au secrétariat pour facturation">📨</button>`):''}</div></td></tr>`}).join('')}</tbody></table>`;
}

// =====================================================================
// SUIVI DE MES OFFRES (technicien : ses offres ; admin / secrétariat : toutes)
// Envoyée → à relancer après 7 jours, acceptée / refusée, expirée. Utilisable depuis l'outil commercial et le terrain.
// =====================================================================
let _osv={liste:[],filtre:'actives'};
async function offresSuiviOuvrir(){
  let ov=document.getElementById('of-suivi');if(ov)ov.remove();
  ov=document.createElement('div');ov.id='of-suivi';
  ov.style.cssText='position:fixed;inset:0;background:#f3f4f6;z-index:9000;overflow:auto;-webkit-overflow-scrolling:touch';
  ov.innerHTML=`<div style="background:linear-gradient(135deg,#7c3aed,#5b21b6);color:#fff;padding:12px 14px;display:flex;align-items:center;gap:10px;position:sticky;top:0;z-index:2"><button onclick="document.getElementById('of-suivi').remove()" style="background:rgba(255,255,255,.2);border:none;color:#fff;padding:6px 12px;border-radius:8px;font-size:16px;cursor:pointer">←</button><b style="font-size:16px">💶 Suivi de mes offres</b></div><div id="osv-corps" style="padding:12px"><div class="loading"><div class="spin spin-dark"></div></div></div>`;
  document.body.appendChild(ov);
  let q=db.from('offres').select('*,clients(raison_sociale,ville,contact_telephone,contact_email),profils(prenom,nom)').order('created_at',{ascending:false}).limit(300);
  if(ME&&ME.role==='technicien')q=q.eq('technicien_id',ME.id);
  const {data,error}=await q;
  if(error){document.getElementById('osv-corps').innerHTML='<div style="padding:16px;color:#6b7280">Erreur : '+_escO(error.message)+'</div>';return}
  _osv.liste=data||[];_osv.filtre='actives';offresSuiviRendre();
}
function _osvStatut(o){return offreEstExpiree(o)?'expiree':o.statut}
function _osvAge(o){return Math.floor((Date.now()-new Date((o.date_offre||o.created_at).toString().slice(0,10)+'T12:00:00'))/86400000)}
function offresSuiviFiltre(f){_osv.filtre=f;offresSuiviRendre()}
function offresSuiviRendre(){
  const L=_osv.liste;const st=o=>_osvStatut(o);
  const aRelancer=o=>st(o)==='envoyee'&&_osvAge(o)>=7;
  const compte={actives:L.filter(o=>['envoyee','brouillon'].includes(st(o))).length,relancer:L.filter(aRelancer).length,acceptee:L.filter(o=>st(o)==='acceptee').length,refusee:L.filter(o=>st(o)==='refusee').length,expiree:L.filter(o=>st(o)==='expiree').length,toutes:L.length};
  const somme=l=>l.reduce((s,o)=>s+(+o.total_ht||0)+(o.contrat_propose?offreContratTotal(o.contrat_propose):0),0);
  const f=_osv.filtre;
  const vue=L.filter(o=>f==='toutes'?true:f==='actives'?['envoyee','brouillon'].includes(st(o)):f==='relancer'?aRelancer(o):st(o)===f);
  const chip=(k,l)=>`<button class="btn ${f===k?'btn-p':'btn-s'} btn-xs" onclick="offresSuiviFiltre('${k}')">${l} (${compte[k]})</button>`;
  const colSt={envoyee:'#7c3aed',acceptee:'#16a34a',refusee:'#9ca3af',expiree:'#d97706',brouillon:'#2563eb'};
  document.getElementById('osv-corps').innerHTML=`
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
      <div style="background:#fff;border-radius:10px;padding:10px"><div style="font-size:11px;color:#6b7280">En attente de réponse</div><div style="font-size:20px;font-weight:800;color:#7c3aed">${_eurO(somme(L.filter(o=>st(o)==='envoyee')))}</div></div>
      <div style="background:#fff;border-radius:10px;padding:10px"><div style="font-size:11px;color:#6b7280">Acceptées</div><div style="font-size:20px;font-weight:800;color:#16a34a">${_eurO(somme(L.filter(o=>st(o)==='acceptee')))}</div></div></div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">${chip('actives','En cours')}${chip('relancer','⏰ À relancer')}${chip('acceptee','Acceptées')}${chip('refusee','Refusées')}${chip('expiree','Expirées')}${chip('toutes','Toutes')}</div>
    ${vue.length?vue.map(o=>{const s=st(o),age=_osvAge(o),c=o.clients||{};
      const fin=offreValiditeFin(o);const reste=Math.ceil((fin-new Date(new Date().toDateString()))/86400000);
      return `<div style="background:#fff;border-radius:10px;border-left:5px solid ${colSt[s]||'#9ca3af'};padding:10px 12px;margin-bottom:8px;font-size:13px">
        <div style="display:flex;justify-content:space-between;gap:8px"><b>${_escO(c.raison_sociale||'—')}</b><span style="white-space:nowrap">${OFFRE_STATUTS[s]||s}</span></div>
        <div style="color:#6b7280">${_escO(o.numero)} · ${fmt(o.date_offre)} · il y a ${age} j${c.ville?' · '+_escO(c.ville):''}${ME&&ME.role!=='technicien'&&o.profils?' · '+_escO((o.profils.prenom||'')+' '+(o.profils.nom||'')):''}</div>
        <div style="margin-top:2px"><b>${_eurO(o.total_ht)}</b> HT${o.contrat_propose?' · contrat '+_eurO(offreContratTotal(o.contrat_propose))+'/an':''}${s==='envoyee'?` · <span style="color:${reste<=7?'#dc2626':'#6b7280'}">${reste>=0?'valable encore '+reste+' j':'expirée'}</span>`:''}</div>
        ${s==='envoyee'&&age>=7?'<div style="color:#b45309;font-weight:600;margin-top:2px">⏰ À relancer (envoyée il y a '+age+' jours)</div>':''}
        <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap"><button class="btn btn-s btn-xs" onclick="offreTelechargerId('${o.id}')">📄 PDF</button>
        ${c.contact_telephone?`<a class="btn btn-s btn-xs" style="text-decoration:none" href="tel:${_escO(c.contact_telephone)}">📞 Appeler</a>`:''}
        ${c.contact_email?`<a class="btn btn-s btn-xs" style="text-decoration:none" href="mailto:${_escO(c.contact_email)}?subject=${encodeURIComponent('Offre de prix '+o.numero)}">✉️ Relancer</a>`:''}
        ${o.statut==='envoyee'?`<button class="btn btn-s btn-xs" onclick="offresSuiviStatut('${o.id}','acceptee')">✅ Acceptée</button><button class="btn btn-s btn-xs" onclick="offresSuiviStatut('${o.id}','refusee')">❌ Refusée</button>`:''}</div></div>`}).join(''):'<div style="text-align:center;color:#6b7280;padding:24px">Aucune offre dans cette catégorie</div>'}`;
}
async function offresSuiviStatut(id,s){
  if(s==='acceptee'&&!confirm("Marquer l'offre comme acceptée ? Le secrétariat sera prévenu pour la facturation."))return;
  if(await offreMajStatut(id,s)){
    const o=_osv.liste.find(x=>x.id===id);if(o)o.statut=s;
    toast('Statut mis à jour');
    if(s==='acceptee')await offreFacturerId(id);
    offresSuiviRendre();
  }
}
