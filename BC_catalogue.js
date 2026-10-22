// ============================================================
// BFS Contrôle — CATALOGUE MARQUES / MODÈLES (catalogue.js)
// ============================================================
// Alimente les menus déroulants Marque / Modèle des lignes de
// contrat (bureau + commercial mobile).
// POUR AJOUTER une marque ou un modèle : modifier simplement les
// listes ci-dessous et re-uploader ce seul fichier.
// Sources : docs d'entretien fabricants (dossier "document fabricant")
// + gamme NF Mobiak (mobiakfire.com, juillet 2026).
// ============================================================

const CATALOGUE_MARQUES = {
  extincteur: {
    'Andrieu': [
      'VULCAIN','VULCAIN LITHOR','VULCAIN STARMOUSSE','ECO','BOZNY','PMZ',
      'EVOLITE','PRIMA','PROBLOC','TITAN','SP2','CPP1','CPP2','CPP2L',
      'CPP 6','CPP 9','CPP MOBILE','T45','T50','M9','MA4 PP','AT9',
      'DC','SR','MANOFEU','CO2 2 kg','CO2 5 kg','CO2 sur roues'
    ],
    'Anaf': ['FG6-F','PG9-F ABC','CS2-AB','CS2-ABM','CS5-AB','WS6-LH'],
    'Mobiak': [
      'MBK09-010PA-DF (poudre 1 kg)','MBK09-020PA-DF (poudre 2 kg)',
      'MBK09-060PA-P1F (poudre 6 kg)','MBK09-090PA-DF (poudre 9 kg)',
      'MBK13-060PA-P1LFR (poudre 6 kg cartouche)','MBK13-090PA-P1LFR (poudre 9 kg cartouche)',
      'MBK09-500PA-H1B (poudre 50 kg mobile)',
      'MBK07-060AF-P1E (eau additif 6 L)','MBK07-060AF-P1E-ECO (eau additif éco 6 L)',
      'MBK07-090AF-P1D (eau additif 9 L)','MBK07-090AF-P1D-ECO (eau additif éco 9 L)',
      'MBK13-060BSX-P1L (mousse 6 L cartouche)','MBK13-090BSX-P1L (mousse 9 L cartouche)',
      'MBK18-500AF-W1B (eau additif 50 L mobile)',
      'MBK19-020ABF-EXT (ABF 2 L)','MBK19-060ABF-EXT (ABF 6 L)','MBK19-090ABF-EXT (ABF 9 L)',
      'MBK12-020CA-P1A (CO2 2 kg)','MBK02-050CA-P1A (CO2 5 kg)'
    ],
    'Rot': ['FLY 6E','FLY 9E','FLY 6P','FLY 9P'],
    'Eurofeu': [
      'AFREX Eau','AFREX Poudre','AFREX Additif écologique','AREX Eau','AREX Poudre',
      'EXPER Eau','EXPER Poudre','PERFEX Eau','PERFEX Poudre','PERFEX II (Lith-Ex)',
      'EUREXTREM Eau+Additif','EUREXTREM Poudre','STARK Eau','STARK Poudre',
      'SPIT/EUROTOP/EUROTECH Eau','SPIT/EUROTOP/EUROTECH Poudre',
      'CO2 (aluminium)','CO2 (acier léger)','CO2 amagnétique',
      'Poudre D','Sur roues Poudre','Sur roues Eau','Sur roues CO2','Automatique'
    ],
    'Desautel': ['P6P','P6','P6M','P9FaM','P50P','PP1P','CO2 2 kg','E6A15FFT','E9A1FF','E6A6EVP','AL6F','AL6 LION','AL9 LION'],
    'Sicli': ['Silice 3E 6L','Silice 3E 6kg','Silice 3E 9kg','Indium','Intégral','Cristal'],
    'Gloria': ['PD 6 GA','PD 9 GA','P6 Premium','Eau 6L','CO2 2 kg','CO2 5 kg'],
    'Cordia': []
  },
  ria: {
    'Mobiak': [],
    'POK': [],
    'Selecta': []
  }
};

// Helpers communs
function marquesPour(type){return Object.keys(CATALOGUE_MARQUES[type]||{})}
function modelesPour(type,marque){return (CATALOGUE_MARQUES[type]||{})[marque]||[]}

// Génère le couple de champs Marque/Modèle : menus déroulants si le
// catalogue connaît le type, sinon champs texte libres.
// prefix : préfixe des ids ('lk-' mobile, 'lc-' bureau)
function marqueModeleHTML(type,prefix){
  const marques=marquesPour(type);
  if(!marques.length){
    return `<div class="fg" style="margin-bottom:12px"><label>Marque</label><input type="text" id="${prefix}marque" placeholder="Ex : Eurofeu"></div>
      <div class="fg" style="margin-bottom:12px"><label>Modèle</label><input type="text" id="${prefix}modele" placeholder="Ex : PP6 ABC"></div>`;
  }
  return `<div class="fg" style="margin-bottom:12px"><label>Marque</label>
      <select id="${prefix}marque-sel" onchange="majModeleSel('${type}','${prefix}')"><option value=""></option>${marques.map(m=>`<option>${m}</option>`).join('')}<option value="__autre__">Autre…</option></select>
      <input type="text" id="${prefix}marque" placeholder="Saisir la marque" style="display:none;margin-top:6px"></div>
    <div class="fg" style="margin-bottom:12px"><label>Modèle</label>
      <select id="${prefix}modele-sel" onchange="majModeleAutre('${prefix}')"><option value=""></option><option value="__autre__">Autre…</option></select>
      <input type="text" id="${prefix}modele" placeholder="Saisir le modèle" style="display:none;margin-top:6px"></div>`;
}
function majModeleSel(type,prefix){
  const mSel=document.getElementById(prefix+'marque-sel');
  const mTxt=document.getElementById(prefix+'marque');
  mTxt.style.display=mSel.value==='__autre__'?'block':'none';
  const modeles=mSel.value&&mSel.value!=='__autre__'?modelesPour(type,mSel.value):[];
  const moSel=document.getElementById(prefix+'modele-sel');
  moSel.innerHTML='<option value=""></option>'+modeles.map(m=>`<option>${m}</option>`).join('')+'<option value="__autre__">Autre…</option>';
  document.getElementById(prefix+'modele').style.display='none';
}
function majModeleAutre(prefix){
  const moSel=document.getElementById(prefix+'modele-sel');
  document.getElementById(prefix+'modele').style.display=moSel.value==='__autre__'?'block':'none';
}
// Lit la valeur finale (select ou champ "Autre")
function lireMarqueModele(prefix){
  const g=id=>document.getElementById(id);
  let marque,modele;
  if(g(prefix+'marque-sel')){
    marque=g(prefix+'marque-sel').value==='__autre__'?g(prefix+'marque').value.trim():g(prefix+'marque-sel').value;
    modele=g(prefix+'modele-sel').value==='__autre__'?g(prefix+'modele').value.trim():g(prefix+'modele-sel').value;
  }else{
    marque=g(prefix+'marque')?g(prefix+'marque').value.trim():'';
    modele=g(prefix+'modele')?g(prefix+'modele').value.trim():'';
  }
  return {marque,modele};
}

// Restaure marque/modèle dans le couple de champs généré par marqueModeleHTML
function setMarqueModele(type,prefix,marque,modele){
  const g=id=>document.getElementById(id);
  const mSel=g(prefix+'marque-sel');
  if(!mSel){if(g(prefix+'marque'))g(prefix+'marque').value=marque||'';if(g(prefix+'modele'))g(prefix+'modele').value=modele||'';return}
  const marques=marquesPour(type);
  const mNorm=marques.find(x=>x.toLowerCase()===(marque||'').toLowerCase());
  if(marque&&!mNorm){mSel.value='__autre__';g(prefix+'marque').style.display='block';g(prefix+'marque').value=marque;}
  else{mSel.value=mNorm||'';g(prefix+'marque').style.display='none';}
  // reconstruire la liste des modèles sans passer par l'événement (pas de prompt)
  const modeles=mNorm?modelesPour(type,mNorm):[];
  const moSel=g(prefix+'modele-sel');
  moSel.innerHTML='<option value="">'+(mNorm?'Tous les modèles '+mNorm:'— Modèle —')+'</option>'+modeles.map(x=>`<option>${x}</option>`).join('')+'<option value="__autre__">Autre…</option>';
  const moNorm=modeles.find(x=>x.toLowerCase()===(modele||'').toLowerCase());
  if(modele&&!moNorm){moSel.value='__autre__';g(prefix+'modele').style.display='block';g(prefix+'modele').value=modele;}
  else{moSel.value=moNorm||'';g(prefix+'modele').style.display='none';}
}


// ============================================================
// FRAIS DE DÉPLACEMENT — barème par zone de distance (agence -> client)
// Les prix vivent dans la table tarifs (codes DEPL_Z1…DEPL_Z5, catégorie « déplacement »)
// et se modifient dans la page Tarifs. La distance est estimée automatiquement à partir des
// adresses (API Adresse officielle data.gouv.fr) : à vol d'oiseau × 1,3 pour approcher la route.
// ============================================================
const ZONES_DEPLACEMENT=[
  {code:'Z1',max:15,lib:"jusqu'à 15 km"},{code:'Z2',max:30,lib:'15 à 30 km'},{code:'Z3',max:50,lib:'30 à 50 km'},
  {code:'Z4',max:80,lib:'50 à 80 km'},{code:'Z5',max:Infinity,lib:'plus de 80 km'}];
const COEF_ROUTE_DEPLACEMENT=1.3;
const GEO_AGENCE_DEPLACEMENT={briec:'Briec 29510',sevremont:'Saint-Michel-Mont-Mercure 85700'};
const _geoCacheDepl={};
async function geocoderAdresse(q){
  q=String(q||'').trim();if(!q)return null;
  if(_geoCacheDepl[q]!==undefined)return _geoCacheDepl[q];
  try{
    const r=await fetch('https://api-adresse.data.gouv.fr/search/?limit=1&q='+encodeURIComponent(q));
    const j=await r.json();const f=j.features&&j.features[0];
    return _geoCacheDepl[q]=f?{lon:f.geometry.coordinates[0],lat:f.geometry.coordinates[1]}:null;
  }catch(e){return null}
}
function distanceRouteKm(a,b){
  const R=6371,rad=x=>x*Math.PI/180,dLat=rad(b.lat-a.lat),dLon=rad(b.lon-a.lon);
  const s=Math.sin(dLat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dLon/2)**2;
  return Math.round(2*R*Math.asin(Math.sqrt(s))*COEF_ROUTE_DEPLACEMENT);
}
function zoneDepuisKm(km){return ZONES_DEPLACEMENT.find(z=>km<=z.max)||ZONES_DEPLACEMENT[ZONES_DEPLACEMENT.length-1]}
// Retourne {km,zone} ou null si les adresses ne sont pas exploitables
async function estimerDeplacement(client,agence){
  if(!client)return null;
  if(client.zone_deplacement&&client.distance_km!=null)return {km:+client.distance_km,zone:client.zone_deplacement,source:'fiche client'};
  const adr=[client.adresse,client.code_postal,client.ville].filter(Boolean).join(' ');
  const ag=GEO_AGENCE_DEPLACEMENT[agence?.code]||agence?.adresse||agence?.nom;
  if(!adr||!ag)return null;
  const [a,c]=await Promise.all([geocoderAdresse(ag),geocoderAdresse(adr)]);
  if(!a||!c)return null;
  const km=distanceRouteKm(a,c);return {km,zone:zoneDepuisKm(km).code,source:'estimation'};
}
let _prixZonesDepl=null;
async function chargerPrixZonesDeplacement(){
  if(_prixZonesDepl)return _prixZonesDepl;
  const {data}=await db.from('tarifs').select('code,prix_ht').like('code','DEPL\\_Z%').eq('actif',true);
  _prixZonesDepl={};(data||[]).forEach(t=>{_prixZonesDepl[t.code.replace('DEPL_','')]=+t.prix_ht});
  return _prixZonesDepl;
}
function zoneLibelle(code){const z=ZONES_DEPLACEMENT.find(x=>x.code===code);return z?'Zone '+code.slice(1)+' — '+z.lib:(code||'')}
// Texte pour le PDF du contrat
// Interrupteur : false = on mentionne seulement le statut des frais (facturés / inclus / offerts), sans zone ni tarif.
// Passer à true pour réactiver le zonage par distance et les prix DEPL_Z1..Z5.
const DEPLACEMENT_TARIF_ACTIF=false;
function libelleFraisDeplacement(c){
  if(!c||!c.frais_deplacement_mode)return null;
  if(!DEPLACEMENT_TARIF_ACTIF&&c.frais_deplacement_mode==='facture'&&!c.frais_deplacement_ht)return 'Facturés en sus à chaque passage, au tarif en vigueur (communiqué sur demande)';
  if(c.frais_deplacement_mode==='inclus')return 'Inclus dans le contrat';
  if(c.frais_deplacement_mode==='offert')return 'Offerts';
  const eur=(+c.frais_deplacement_ht||0).toLocaleString('fr-FR',{style:'currency',currency:'EUR'});
  return 'Facturés '+eur+' HT par passage'+(c.zone_deplacement?' ('+zoneLibelle(c.zone_deplacement)+(c.frais_deplacement_km!=null?', ~'+c.frais_deplacement_km+' km':'')+')':'');
}

console.log('✓ catalogue.js chargé');
