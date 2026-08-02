// ============================================================
// BFS Contrôle — PRÉCONISATIONS CONSTRUCTEUR (preconisations.js)
// ============================================================
// Périodicités de remplacement issues des documents fabricants
// (dossier « document fabricant/Reco entretien »). Utilisé par
// terrain.html pour proposer les pièces à changer selon la marque,
// le modèle et l'ÂGE de l'extincteur (date de fabrication).
// ans:1 = chaque année ; ans:N = tous les N ans ; note = cas particulier.
// POUR ENRICHIR : ajouter une entrée en suivant le même modèle.
// ============================================================

const PRECONISATIONS=[
// ---------------- ANDRIEU ----------------
{marque:'andrieu',gamme:'VULCAIN',source:'ANDR-RECOM-VULCAIN-V2',
 modeles:['VULCAIN','EP6','EP9','AA6','AA9','M9','PP4','P6','P9','B9'],
 regles:[{piece:'Scellé de sécurité',ans:1},{piece:'Joint de tête',ans:1},{piece:'Joint de lance',ans:1},
  {piece:'Charge en eau',ans:3},{piece:'Percuteur avec joint',ans:3},{piece:'Goupille de sécurité',ans:3},
  {piece:'Additif en pré-mélange (anciens modèles)',ans:3},{piece:'Cartouche CO2 (appareil poudre)',ans:10},
  {piece:'Cartouche CO2 (appareil eau)',ans:5},{piece:'Charge de poudre',ans:5},{piece:'Cartouche Zeon (CO2+additif)',ans:5},
  {piece:'Lance complète',ans:10},{piece:'Tête complète',ans:10,note:'ou selon NF S61-919'},{piece:'Réservoir',ans:10,note:'ou selon NF S61-919'}]},
{marque:'andrieu',gamme:'VULCAIN LITH\'OR',source:'ANDR-RECOM-VULCAIN-LITHOR (04/2024)',
 modeles:['LITHOR','LITH\'OR','EP9LITA'],
 regles:[{piece:'Scellé de sécurité',ans:1},{piece:'Joint de tête',ans:1},{piece:'Joint de lance',ans:1},
  {piece:'Percuteur avec joint',ans:3},{piece:'Ressort de percuteur',ans:3},{piece:'Goupille de sécurité',ans:3},
  {piece:'Charge additif NOFIRELITH',ans:3},{piece:'Cartouche CO2',ans:5},{piece:'Écrou borgne de tête',ans:5},
  {piece:'Lance complète',ans:10},{piece:'Tête complète',ans:10},{piece:'Réservoir EAU',ans:10}]},
{marque:'andrieu',gamme:'VULCAIN STARMOUSSE',source:'ANDR-RECOM-VULCAIN-STARMOUSSE (04/2024)',
 modeles:['STARMOUSSE','EP6SF','EP9SF'],
 regles:[{piece:'Scellé de sécurité',ans:1},{piece:'Joint de tête',ans:1},{piece:'Joint de lance',ans:1},
  {piece:'Charge en eau',ans:3},{piece:'Percuteur avec joint',ans:3},{piece:'Ressort de percuteur',ans:3},{piece:'Goupille de sécurité',ans:3},
  {piece:'Cartouche STARMOUSSE (CO2+additif)',ans:5,note:'3 à 5 ans selon état'},{piece:'Écrou borgne de tête',ans:5},
  {piece:'Lance complète',ans:10},{piece:'Tête complète',ans:10},{piece:'Réservoir EAU',ans:10}]},
{marque:'andrieu',gamme:'VULCAIN MOUSSE SPÉCIFIQUE',source:'ANDR-RECOM-MOUSSE-SPE',
 modeles:['M9-X1'],
 regles:[{piece:'Scellé de sécurité',ans:1},{piece:'Joint de tête',ans:1},{piece:'Joint de lance',ans:1},
  {piece:'Percuteur avec joint',ans:3},{piece:'Goupille de sécurité',ans:3},{piece:'Cartouche Zeon (CO2+additif)',ans:5},
  {piece:'Charge additif AFFF résistant alcool',ans:5},{piece:'Lance complète',ans:10},{piece:'Tête complète',ans:10},{piece:'Réservoir EAU',ans:10}]},
{marque:'andrieu',gamme:'ECO',source:'ANDR-RECOM-ECO-V2',
 modeles:['ECO','SEP6','SEP9','SAA9','SP4','SP6','SP9','SB9'],
 regles:[{piece:'Scellé de sécurité',ans:1},{piece:'Joint de tête',ans:1},{piece:'Joint de lance',ans:1},
  {piece:'Charge en eau',ans:3},{piece:'Percuteur avec joint',ans:3},{piece:'Goupille de sécurité',ans:3},
  {piece:'Additif en pré-mélange (anciens modèles)',ans:3},{piece:'Cartouche CO2 (appareil poudre)',ans:10},
  {piece:'Cartouche CO2 (appareil eau)',ans:5},{piece:'Charge de poudre',ans:5},{piece:'Cartouche Zeon (CO2+additif)',ans:5},
  {piece:'Lance complète',ans:10},{piece:'Tête complète',ans:10},{piece:'Réservoir',ans:10}]},
{marque:'andrieu',gamme:'BOZNY / EURO BZ',source:'ANDR-RECOM-BOZNY-V2',
 modeles:['BOZNY','EURO BZ','EURO-BZ','A6BZ','A9BZ','A6BZM','A9BZM','P4BZ','P6BZ','P9BZ'],
 regles:[{piece:'Scellé de sécurité',ans:1},{piece:'Joint de tête',ans:1},{piece:'Joint de lance',ans:1},
  {piece:'Charge en eau',ans:3},{piece:'Percuteur avec joint',ans:3},{piece:'Goupille de sécurité',ans:3},
  {piece:'Additif en pré-mélange (anciens modèles)',ans:3},{piece:'Cartouche CO2 (appareil poudre)',ans:10},
  {piece:'Charge de poudre',ans:5},{piece:'Cartouche Zeon (CO2+additif)',ans:5},
  {piece:'Lance complète',ans:10},{piece:'Tête complète',ans:10},{piece:'Réservoir',ans:10}]},
{marque:'andrieu',gamme:'PMZ',source:'ANDR-RECOM-PMZ-V2',
 modeles:['PMZ','A6PMZ','A9PMZ','AA9PMZ','P4PMZ','P6PMZ','P9PMZ'],
 regles:[{piece:'Scellé de sécurité',ans:1},{piece:'Joint de tête',ans:1},{piece:'Joint de lance',ans:1},
  {piece:'Charge en eau',ans:3},{piece:'Percuteur avec joint',ans:3},{piece:'Goupille de sécurité',ans:3},
  {piece:'Cartouche CO2 (appareil poudre)',ans:10},{piece:'Cartouche CO2 (appareil eau)',ans:5},
  {piece:'Charge de poudre',ans:5},{piece:'Cartouche Zeon (CO2+additif)',ans:5},
  {piece:'Lance complète',ans:10},{piece:'Tête complète',ans:10},{piece:'Réservoir',ans:10}]},
{marque:'andrieu',gamme:'EVOLITE',source:'ANDR-RECOM-EVOLITE-V2',
 modeles:['EVOLITE','EVO','A6BZM-EVO','A9BZM-EVO','P6BZ-EVO','P9BZ-EVO'],
 regles:[{piece:'Scellé de sécurité',ans:1},{piece:'Joint de tête',ans:1},{piece:'Joint de lance',ans:1},
  {piece:'Charge en eau',ans:3},{piece:'Percuteur avec joint',ans:3},{piece:'Goupille de sécurité',ans:3},
  {piece:'Cartouche CO2 (appareil poudre)',ans:10},{piece:'Charge de poudre',ans:5},{piece:'Cartouche Zeon (CO2+additif)',ans:5},
  {piece:'Lance complète',ans:10},{piece:'Tête complète',ans:10},{piece:'Réservoir',ans:10}]},
{marque:'andrieu',gamme:'PROBLOC',source:'ANDR-RECOM-PROBLOC-V2',
 modeles:['PROBLOC','E6PB','A6PB','A9PB','A6PBM','A9PBM','AA9PB','P4PB','P6PB','P9PB','B9PB'],
 regles:[{piece:'Scellé de sécurité',ans:1},{piece:'Joint de tête',ans:1},{piece:'Joint de lance',ans:1},
  {piece:'Charge en eau',ans:3},{piece:'Percuteur avec joint',ans:3},{piece:'Goupille de sécurité',ans:3},
  {piece:'Additif en pré-mélange (anciens modèles)',ans:3},{piece:'Cartouche CO2 (appareil poudre)',ans:10},
  {piece:'Cartouche CO2 (appareil eau)',ans:5},{piece:'Charge de poudre',ans:5},{piece:'Cartouche Zeon (CO2+additif)',ans:5},
  {piece:'Lance complète',ans:10},{piece:'Tête complète',ans:10},{piece:'Réservoir',ans:10}]},
{marque:'andrieu',gamme:'PRIMA',source:'ANDR-RECOM-PRIMA-V2',
 modeles:['PRIMA','A6PR','A9PR','P6PR','P9PR'],
 regles:[{piece:'Scellé de sécurité',ans:1},{piece:'Joint de tête',ans:1},{piece:'Joint de lance',ans:1},
  {piece:'Percuteur avec joint',ans:3},{piece:'Goupille de sécurité',ans:3},
  {piece:'Additif en pré-mélange',ans:3,note:'3 à 5 ans selon eau utilisée'},{piece:'Charge en eau',ans:3,note:'3 à 5 ans selon eau utilisée'},
  {piece:'Cartouche CO2 (appareil poudre)',ans:10},{piece:'Cartouche CO2 (appareil eau)',ans:5},
  {piece:'Charge de poudre',ans:5},{piece:'Écrou borgne de tête',ans:5},
  {piece:'Lance complète',ans:10},{piece:'Tête complète',ans:10},{piece:'Réservoir',ans:10}]},
{marque:'andrieu',gamme:'CPP MAX',source:'ANDR-RECOM-CPP-6-9-V2',
 modeles:['CPP MAX','CPP6','CPP9','CPP6L','CPP9L'],
 regles:[{piece:'Scellé de sécurité',ans:1},{piece:'Joint de tête',ans:3},{piece:'Joint de lance (eau)',ans:3},
  {piece:'Goupille de sécurité',ans:3},{piece:'Charge eau + additif (pré-mélange)',ans:3},{piece:'Charge de poudre',ans:5},
  {piece:'Manomètre',ans:10},{piece:'Lance complète',ans:10},{piece:'Tête complète',ans:10},{piece:'Réservoir',ans:10}]},
{marque:'andrieu',gamme:'CPP1 / SP2 / CPP2 / CPP2L',source:'ANDR-RECOM-CPP1-SP2-CPP2-CPP2L-V2',
 modeles:['CPP1','SP2','CPP2','CPP2L'],
 regles:[{piece:'Scellé de sécurité',ans:1},{piece:'Joint de tête',ans:1},{piece:'Goupille de sécurité',ans:3},
  {piece:'Charge eau + additif (CPP2L)',ans:5},{piece:'Charge de poudre',ans:5},
  {piece:'Manomètre',ans:10},{piece:'Tête complète',ans:10},{piece:'Réservoir',ans:10}]},
{marque:'andrieu',gamme:'CPP MOBILE',source:'ANDR-RECOM-CPP-MOBILE',
 modeles:['CPP MOBILE','CPPMOB'],
 regles:[{piece:'Scellé de sécurité',ans:1},{piece:'Graissage du train de roulement',ans:1},
  {piece:'Joint de tête',ans:3},{piece:'Joint de lance',ans:3},{piece:'Goupille de sécurité',ans:3},
  {piece:'Charge eau + additif (pré-mélange)',ans:3},{piece:'Charge de poudre',ans:5},
  {piece:'Manomètre',ans:10},{piece:'Lance complète (flexible et raccords)',ans:10},{piece:'Tête complète',ans:10},{piece:'Réservoir',ans:10}]},
{marque:'andrieu',gamme:'TITAN (mobile)',source:'ANDR-RECOM-TITAN-V2',
 modeles:['TITAN','TEP45','T45','T50'],
 regles:[{piece:'Scellé de sécurité sur BDC',ans:1},{piece:'Joint de couvercle',ans:1},{piece:'Joint de lance',ans:1},
  {piece:'Joint bouteille de chasse',ans:1},{piece:'Graissage du train de roulement',ans:1},
  {piece:'Opercule de sécurité',note:'à chaque utilisation'},{piece:'Réépreuve bouteille de chasse',note:'selon réglementation'},
  {piece:'Eau + additif en pré-mélange',ans:3},{piece:'Goupille de sécurité',ans:3},{piece:'Charge en eau (TEP45)',ans:3},
  {piece:'Charge de poudre',ans:5},{piece:'Lance complète (flexible et raccords)',ans:10},{piece:'Couvercle',ans:10},{piece:'Réservoir',ans:10}]},
{marque:'andrieu',gamme:'CO2 2/5 kg',source:'ANDR-RECOM-CO2-2-ET-5KG-V2a',
 modeles:['DC2','DC22','DC5','DC55','CO2'],
 regles:[{piece:'Scellé de sécurité',ans:1},{piece:'Joint de tromblon',ans:1},
  {piece:'Opercule de sécurité',note:'à chaque utilisation'},{piece:'Réépreuve de la bouteille',note:'selon réglementation'},
  {piece:'Goupille de sécurité',ans:3},{piece:'Tromblon (2 kg)',ans:10},{piece:'Tromblon et flexible (5 kg)',ans:10}]},
{marque:'andrieu',gamme:'CO2 sur roues',source:'ANDR-RECOM-CO2-SUR-ROUES-V2',
 modeles:['CO2 10','CO2 20','CO2 30','CO2 50','SUR ROUE'],
 regles:[{piece:'Scellé de sécurité',ans:1},{piece:'Joint de tromblon',ans:1},
  {piece:'Opercule de sécurité',note:'à chaque utilisation'},{piece:'Réépreuve de la bouteille',note:'selon réglementation'},
  {piece:'Goupille de sécurité',ans:3},{piece:'Tromblon et flexible',ans:10}]},

// ---------------- MOBIAK ----------------
{marque:'mobiak',gamme:'Pression permanente (eau/poudre/mousse)',source:'maintenance-instructions-stored-pressure rev13',
 modeles:[], // toutes gammes pression permanente
 regles:[{piece:'Scellé + goupille (repose après contrôle)',ans:1},
  {piece:'Dépressurisation + recharge agent extincteur',ans:5,note:'joints et tête vérifiés/remplacés à cette occasion'},
  {piece:'Contrôle minutieux (révision atelier)',ans:10},
  {piece:'Mise au rebut de l\'appareil',ans:20,note:'fin de vie constructeur'}]},
{marque:'mobiak',gamme:'CO2',source:'maintenance-instructions-CO2-F',
 modeles:['CO2','CA-'],
 regles:[{piece:'Scellé + goupille (repose après contrôle)',ans:1},
  {piece:'Réépreuve de la bouteille',note:'selon réglementation'},
  {piece:'Mise au rebut de l\'appareil',ans:20,note:'fin de vie constructeur'}]},

// ---------------- ANAF ----------------
{marque:'anaf',gamme:'Générale (FG6-F, PG9-F, CS2-AB…)',source:'Fiches maintenance Anaf',
 modeles:[],
 regles:[{piece:'Scellé / plombage (repose après contrôle)',ans:1},
  {piece:'Joint torique de vanne',note:'à chaque ouverture / recharge'},
  {piece:'Kit de recharge constructeur',note:'à chaque recharge — utiliser exclusivement les pièces Anaf'},
  {piece:'Goupille de sécurité',note:'remplacer si endommagée'}]}
];

// Renvoie les préconisations applicables à un équipement + son âge
function preconisationsPour(equip){
  const m=(equip.marque||'').toLowerCase();
  const mo=((equip.modele||'')+' '+(equip.numero_serie||'')).toUpperCase();
  let age=null;
  if(equip.date_fabrication)age=Math.floor((Date.now()-new Date(equip.date_fabrication).getTime())/31557600000);
  const out=[];
  PRECONISATIONS.forEach(g=>{
    if(!m||!m.includes(g.marque))return;
    if(g.modeles&&g.modeles.length&&!g.modeles.some(x=>mo.includes(x.toUpperCase())))return;
    g.regles.forEach(r=>{
      let due=false,info='';
      if(r.ans===1){due=true;info='chaque année'}
      else if(r.ans&&age!==null){due=age>0&&age%r.ans===0;info='tous les '+r.ans+' ans — âge : '+age+' an'+(age>1?'s':'')}
      else if(r.ans){info='tous les '+r.ans+' ans (date de fabrication inconnue)'}
      else info=r.note||'';
      out.push({piece:r.piece,due,info:info+(r.note&&r.ans?' · '+r.note:''),gamme:g.gamme,source:g.source});
    });
  });
  return {age,regles:out};
}
console.log('✓ preconisations.js chargé');
