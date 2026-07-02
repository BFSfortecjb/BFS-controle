// ============================================================
// BFS Contrôle — MODULE PDF (pdf.js)
// ============================================================
// Ce fichier contient TOUTE la génération de PDF de l'appli bureau.
// Il est chargé par index.html APRÈS le script principal.
// Il utilise les variables globales de index.html :
//   db, ME, $, fmt, fmtH, toast, clients, equipements, typesEquip,
//   contrats, pointsControle, loadBons
// Librairies requises (chargées dans index.html) : jsPDF + autoTable.
//
// ⚠️ Une erreur ici ne casse QUE les PDF, jamais la connexion ni le
// reste de l'appli. On peut donc modifier ce fichier sans risque.
// ============================================================

// ============================================================
// PDF — RAPPORT DE VÉRIFICATION
// ============================================================
async function exportVerifPDF(verifId){
  const {data:v}=await db.from('verifications').select('*,equipements(*,clients(*)),types_equipements(libelle,icone),agences(nom)').eq('id',verifId).single();
  const {data:res}=await db.from('resultats_controle').select('*').eq('verification_id',verifId).order('libelle_snapshot');
  if(!v){toast('Données introuvables','err');return}
  const {jsPDF}=window.jspdf;const doc=new jsPDF();
  const eq=v.equipements;const cl=eq?.clients;
  doc.setFillColor(192,57,43);doc.rect(0,0,210,26,'F');
  doc.setTextColor(255);doc.setFontSize(13);doc.setFont('helvetica','bold');
  doc.text('BFS — Rapport de vérification',14,11);
  doc.setFontSize(9);doc.setFont('helvetica','normal');
  doc.text(`${v.types_equipements?.libelle||''} — ${eq?.numero_identification||'—'} — Agence ${v.agences?.nom||'—'}`,14,19);
  doc.text(`Édité le ${new Date().toLocaleDateString('fr-FR')}`,150,19);
  doc.setTextColor(30);let y=32;
  doc.autoTable({startY:y,margin:{left:14,right:14},head:[],body:[
    ['Client',cl?.raison_sociale||'—'],['Adresse',`${cl?.adresse||''} ${cl?.code_postal||''} ${cl?.ville||''}`.trim()],
    ['N° identification',eq?.numero_identification||'—'],['Marque / Modèle',`${eq?.marque||'—'} ${eq?.modele||''}`],
    ['Localisation',`${eq?.localisation||'—'}${eq?.etage_zone?' / '+eq.etage_zone:''}`],
    ['Date vérification',fmt(v.date_verification)],['Prochaine échéance',fmt(v.date_prochaine_echeance)],
    ['Technicien',v.technicien||'—'],['Résultat global',v.resultat?.toUpperCase()||'—'],
  ],styles:{fontSize:10},columnStyles:{0:{fontStyle:'bold',cellWidth:50}},headStyles:{fillColor:[192,57,43]}});
  y=doc.lastAutoTable.finalY+8;
  if(res?.length){
    doc.autoTable({startY:y,margin:{left:14,right:14},head:[['Point de contrôle','Résultat']],
      body:res.map(r=>{let val='—';if(r.type_reponse==='oui_non')val=r.valeur_oui_non===true?'✓ OK':r.valeur_oui_non===false?'✗ NON':'—';else if(r.type_reponse==='numerique')val=r.valeur_numerique!=null?String(r.valeur_numerique):'—';else if(r.type_reponse==='texte')val=r.valeur_texte||'—';else if(r.type_reponse==='date')val=fmt(r.valeur_date);return[r.libelle_snapshot,val]}),
      styles:{fontSize:9},headStyles:{fillColor:[192,57,43]},
      didParseCell:(d)=>{if(d.column.index===1){if(d.cell.text[0]==='✓ OK')d.cell.styles.textColor=[22,163,74];if(d.cell.text[0]==='✗ NON')d.cell.styles.textColor=[220,38,38]}}
    });y=doc.lastAutoTable.finalY+8;
  }
  if(v.observations){doc.setFontSize(10);doc.text('Observations: '+v.observations.slice(0,150),14,y);y+=10}
  doc.save(`BFS_verif_${eq?.numero_identification||verifId}_${v.date_verification}.pdf`);toast('PDF généré');
}

// ============================================================
// PDF — CONTRAT
// ============================================================
async function exportContratPDF(id){
  const {data:c}=await db.from('contrats').select('*,clients(*),agences(nom)').eq('id',id).single();if(!c)return;
  const {jsPDF}=window.jspdf;const doc=new jsPDF();const cl=c.clients;
  doc.setFillColor(192,57,43);doc.rect(0,0,210,26,'F');doc.setTextColor(255);doc.setFontSize(12);doc.setFont('helvetica','bold');
  doc.text('BFS — Contrat de maintenance',14,11);doc.setFontSize(9);doc.setFont('helvetica','normal');
  doc.text(`N° ${c.numero_contrat||'—'} — Agence ${c.agences?.nom||'—'}`,14,19);doc.text(`Édité le ${new Date().toLocaleDateString('fr-FR')}`,155,19);
  doc.setTextColor(30);let y=32;
  doc.autoTable({startY:y,margin:{left:14,right:14},head:[],body:[['Prestataire','BFS — Bretagne Formation Sécurité'],['Agence',c.agences?.nom||'—'],['Client',cl?.raison_sociale||'—'],['Adresse',`${cl?.adresse||''} ${cl?.code_postal||''} ${cl?.ville||''}`.trim()],['SIRET',cl?.siret||'—'],['Contact',`${cl?.contact_nom||'—'} — ${cl?.contact_telephone||''}`],['Type',c.type_contrat],['Période',`${fmt(c.date_debut)} → ${fmt(c.date_fin)}`],['Périodicité',c.periodicite_visite||'—'],['Tarif HT',c.tarif_annuel?c.tarif_annuel.toLocaleString('fr-FR',{style:'currency',currency:'EUR'}):'—'],['Équipements couverts',(c.types_couverts||[]).join(', ')||'—']],styles:{fontSize:10},columnStyles:{0:{fontStyle:'bold',cellWidth:52}}});
  y=doc.lastAutoTable.finalY+8;if(c.notes){doc.setFontSize(10);doc.text('Conditions: '+doc.splitTextToSize(c.notes,182),14,y);}
  doc.save(`BFS_contrat_${c.numero_contrat||id}.pdf`);toast('PDF généré');
}

// ============================================================
// PDF — BON D'INTERVENTION (régénération)
// ============================================================
async function regenererBon(bonId){
  if(!confirm("Êtes-vous sûr de vouloir régénérer ce bon d'intervention ?\nL'ancien PDF sera supprimé et remplacé.")) return;
  toast('Chargement des données…');

  // Récupérer le bon + infos session
  const {data:bon}=await db.from('bons_intervention').select('*').eq('id',bonId).single();
  if(!bon){toast('Bon introuvable','err');return}

  // Récupérer les infos client
  const {data:client}=await db.from('clients').select('*,agences(nom,code)').eq('id',bon.client_id).single();

  // Récupérer le technicien
  const {data:tech}=await db.from('profils').select('nom,prenom').eq('id',bon.technicien_id).single();
  const techNom=tech?`${tech.prenom||''} ${tech.nom}`.trim():'—';

  // Récupérer les vérifications de la session avec TOUS les champs équipement
  const {data:verifs}=await db.from('verifications')
    .select('*,equipements(numero_identification,localisation,marque,modele,capacite_valeur,capacite_unite,type_equipement_code,donnees_specifiques,types_equipements(libelle,icone))')
    .eq('session_id',bon.session_id)
    .order('created_at');

  if(!verifs||!verifs.length){toast('Aucune vérification trouvée pour cette session','err');return}

  // Récupérer le numéro de session
  const {data:sess}=await db.from('sessions_controle').select('numero').eq('id',bon.session_id).single();

  // Générer le PDF côté bureau avec jsPDF
  const {jsPDF}=window.jspdf;
  const doc=new jsPDF({unit:'mm',format:'a4'});
  // (filigrane logo désactivé)
  const dateStr=new Date(bon.date_intervention).toLocaleDateString('fr-FR');
  const numSession=sess?.numero||bon.numero_session||'—';
  const adresse=[client?.adresse,client?.code_postal,client?.ville].filter(Boolean).join(', ');

  // En-tête
  const raisonSocBFS = client?.agences?.code === 'sevremont' ? 'Bocage Formation Sécurité' : 'Bretagne Formation Sécurité';
  doc.setFontSize(20);doc.setFont('helvetica','bold');doc.setTextColor(50,50,50);doc.text('BFS',14,18);
  doc.setFontSize(7);doc.setTextColor(80);doc.setFont('helvetica','normal');doc.text(raisonSocBFS,14,22);
  doc.setFillColor(230,100,40);doc.rect(65,8,130,10,'F');
  doc.setTextColor(255);doc.setFont('helvetica','bold');doc.setFontSize(12);
  doc.text('BULLETIN D\'INTERVENTION INCENDIE',130,15,{align:'center'});
  doc.setTextColor(0);doc.setFont('helvetica','normal');doc.setFontSize(9);
  doc.text('Transmis pour facturation le :',65,26);
  doc.setDrawColor(0);doc.rect(120,22,55,6);
  doc.setFont('helvetica','bold');doc.text(dateStr,147,27,{align:'center'});

  // Cases type intervention — alignées à droite
  const drawCB=(x,y,v)=>{doc.setDrawColor(0);doc.rect(x,y,3.5,3.5);if(v){doc.setFont('helvetica','bold');doc.setFontSize(8);doc.setTextColor(192,57,43);doc.text('X',x+0.5,y+3);doc.setTextColor(0);}};
  doc.setFont('helvetica','normal');doc.setFontSize(8);
  drawCB(155,30,true);doc.text('Contrôle',160,33);drawCB(155,36,false);doc.text('Installation',160,39);

  // Matériel coché
  const mats=['Extincteur / RIA','Plan / Signalétique','BAES','Système de désenfumage','Alarme incendie'];
  const hasExt=verifs.some(v=>v.equipements?.type_equipement_code==='extincteur'||v.equipements?.type_equipement_code==='ria');
  let my=44;
  mats.forEach((m,i)=>{drawCB(155,my,i===0&&hasExt);doc.setFontSize(7.5);doc.text(m,160,my+3);my+=5;});

  // Infos intervention — adresse sur 2 lignes
  let y=31;
  doc.setFontSize(9);
  doc.text('Date de l\'intervention :',14,y);doc.setFont('helvetica','bold');doc.text(dateStr,65,y);
  y+=6;doc.setFont('helvetica','normal');doc.text('Nom du Client :',14,y);doc.setFont('helvetica','bold');doc.text(client?.raison_sociale||'—',65,y);
  y+=6;doc.setFont('helvetica','normal');doc.text('Lieu d\'intervention :',14,y);
  const adresseLines=doc.splitTextToSize(adresse||client?.ville||'—',85);
  doc.text(adresseLines,65,y);
  // Réserver 2 lignes pour l'adresse même si une seule
  y+=12;
  doc.text('N° bon :',14,y);doc.setFont('helvetica','bold');doc.setTextColor(192,57,43);doc.text(numSession,65,y);doc.setTextColor(0);
  y+=6;doc.setFont('helvetica','normal');doc.text('Technicien :',14,y);doc.text(techNom,65,y);

  // Tableau équipements
  // Colonnes : Désig=52, Cap=20, Loc=28, puis "TYPE DE VÉRIFICATION" regroupée=72 (5 sous-col de ~14)
  y=Math.max(y+8,74);
  const cT={desig:14,cap:66,loc:86,tv:113,v1:113,v2:129,v3:145,v4:161,v5:177,end:196};
  // Largeurs sous-colonnes : 14 chacune, total=70

  // En-tête : ligne 1 — titres principaux
  doc.setFillColor(240,240,240);doc.rect(14,y,182,14,'F');
  doc.setDrawColor(180);doc.setFont('helvetica','bold');doc.setFontSize(7);
  doc.text('DÉSIGNATION',cB.desig+1,y+5);
  doc.text('TYPE/CAP.',cB.cap+1,y+5);
  doc.text('EMPLACEMENT',cB.loc+1,y+5);
  // Titre regroupé "TYPE DE VÉRIFICATION"
  doc.setFillColor(210,210,210);doc.rect(cB.tv,y,cB.end-cB.tv,14,'F');
  doc.setFontSize(7.5);doc.text('TYPE DE VÉRIFICATION',(cB.tv+cB.end)/2,y+5,{align:'center'});
  // Séparateurs principaux
  [cB.cap,cB.loc,cB.tv,cB.end].forEach(x=>doc.line(x,y,x,y+14));
  // Ligne de séparation entre titre et sous-colonnes
  doc.line(cB.tv,y+8,cB.end,y+8);
  // Sous-colonnes
  doc.setFontSize(5.8);
  [
    [cB.v1,'Vérif.'],[cB.v2,'MES'],[cB.v3,'MAA'],[cB.v4,'Réforme'],[cB.v5,'Interv.']
  ].forEach(([x,label])=>{
    doc.text(label,x+7,y+12.5,{align:'center'});
    doc.line(x,y+8,x,y+14);
  });
  doc.line(cB.end,y+8,cB.end,y+14);
  y+=14;

  // Lignes équipements (max 14, hauteur 7 pour avoir de la place)
  const rowH=7;const lignesMax=14;
  doc.setFont('helvetica','normal');doc.setFontSize(7.5);
  for(let idx=0;idx<lignesMax;idx++){
    const v=verifs[idx];
    doc.setDrawColor(200);doc.line(14,y,196,y);
    [cB.cap,cB.loc,cB.tv,cB.v2,cB.v3,cB.v4,cB.v5,cB.end].forEach(x=>doc.line(x,y,x,y+rowH));
    if(v){
      const eq=v.equipements;
      const agent=eq?.donnees_specifiques?.['ef-agent']||eq?.donnees_specifiques?.['e-agent']||'';
      const desig=`${idx+1} - ${eq?.types_equipements?.libelle||'—'}${agent?' '+agent:''}`;
      const cap=eq?.capacite_valeur?(eq.capacite_valeur+' '+(eq.capacite_unite||'')):'—';
      // Adresse emplacement sur 2 lignes si besoin
      const locLines=doc.splitTextToSize(eq?.localisation||'—',26);
      doc.text(desig.slice(0,30),cB.desig+1,y+4.5);
      doc.text(cap.slice(0,12),cB.cap+1,y+4.5);
      doc.text(locLines,cB.loc+1,y+(locLines.length>1?2.5:4.5));
      // Cocher la bonne colonne selon le palier
      const palierCode=v.palier_code||'';
      doc.setFont('helvetica','bold');doc.setTextColor(0,100,0);
      if(palierCode==='mise_en_service')doc.text('X',cB.v2+7,y+4.5,{align:'center'});
      else if(palierCode==='approfondie'||palierCode==='maa')doc.text('X',cB.v3+7,y+4.5,{align:'center'});
      else if(palierCode==='reforme'||palierCode==='revision')doc.text('X',cB.v4+7,y+4.5,{align:'center'});
      else if(palierCode==='intervention')doc.text('X',cB.v5+7,y+4.5,{align:'center'});
      else doc.text('X',cB.v1+7,y+4.5,{align:'center'}); // Vérification simple par défaut
      doc.setTextColor(0);doc.setFont('helvetica','normal');
    }
    y+=rowH;
  }
  doc.setDrawColor(200);doc.line(14,y,196,y);
  y+=1;doc.setFont('helvetica','bold');doc.setFontSize(8);
  doc.text('TOTAL',cB.loc+22,y+3.5,{align:'right'});
  doc.text(String(verifs.length),cB.v1+7,y+3.5,{align:'center'});
  y+=8;

  // Zone OUI/NON vide (à compléter manuellement si régénéré sans checklist)
  const reglItems=['Registre de sécurité signé','Plan d\'évacuation existant','Consignes de sécurité existantes','Panneaux extincteur existant','Boîtier d\'alarme incendie existant'];
  const startX=100;
  doc.rect(startX,y,96,reglItems.length*5+2);
  doc.setFillColor(230,230,230);doc.rect(startX+75,y,10,4,'F');doc.rect(startX+85,y,10,4,'F');
  doc.setFont('helvetica','bold');doc.setFontSize(7.5);doc.text('OUI',startX+80,y+3,{align:'center'});doc.text('NON',startX+90,y+3,{align:'center'});
  y+=4;
  reglItems.forEach(item=>{
    doc.setFont('helvetica','normal');doc.text(item,startX+1,y+3.5);
    doc.setDrawColor(200);doc.line(startX,y+5,startX+96,y+5);y+=5;
  });
  y+=4;

  // Observations
  doc.setFont('helvetica','bolditalic');doc.setFontSize(8);doc.text('OBSERVATIONS :',14,y+4);
  doc.setFont('helvetica','normal');
  const obsText=verifs.map(v=>v.observations).filter(Boolean).join(' · ')||'—';
  const obsLines=doc.splitTextToSize(obsText,178);
  doc.text(obsLines,14,y+9);
  y+=9+obsLines.length*4+4;

  // Signatures
  const sigY=Math.max(y+6,250);
  doc.setDrawColor(150);doc.rect(14,sigY,85,28);doc.rect(110,sigY,82,28);
  doc.setFont('helvetica','normal');doc.setFontSize(8);
  doc.text('NOM, signature et cachet du CLIENT',14+42,sigY+4,{align:'center'});
  doc.text('NOM et signature du technicien',110+41,sigY+4,{align:'center'});
  if(bon.signataire_nom)doc.text(bon.signataire_nom,14+42,sigY+26,{align:'center'});
  doc.setFontSize(7);doc.setTextColor(150);const genTS=new Date().toLocaleString('fr-FR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
  doc.text('Généré le '+genTS,105,290,{align:'center'});

  // Sauvegarder le PDF et uploader
  const nomFichier=`BFS_bon_${numSession}_${(client?.raison_sociale||'').replace(/[^a-zA-Z0-9]/g,'_')}.pdf`;
  const fileName=`bon_regen_${bonId}_${Date.now()}.pdf`;

  // Téléchargement direct via jsPDF (méthode la plus fiable)
  doc.save(nomFichier);

  // Supprimer l'ancien et uploader le nouveau en arrière-plan
  const pdfBlob=doc.output('blob');
  if(bon.pdf_path){
    await db.storage.from('bons-intervention').remove([bon.pdf_path]);
  }
  const {error:upErr}=await db.storage.from('bons-intervention').upload(fileName,pdfBlob,{contentType:'application/pdf'});
  if(!upErr){
    const {data:urlData}=db.storage.from('bons-intervention').getPublicUrl(fileName);
    await db.from('bons_intervention').update({pdf_url:urlData.publicUrl,pdf_path:fileName}).eq('id',bonId);
    toast('PDF sauvegardé ✓');
  } else {
    toast('PDF téléchargé localement (erreur Storage)','err');
  }
  loadBons();
}

console.log('✓ pdf.js chargé');
