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

console.log('✓ catalogue.js chargé');
