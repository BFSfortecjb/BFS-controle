// ============================================================
// BFS Contrôle — Sauvegarde / Restauration
// Export Excel complet (toutes les tables) + fichiers de stockage (ZIP)
// Import en mode "fusion" (upsert) — ne supprime jamais rien
// ============================================================

// Ordre d'export/restauration (parents avant enfants, pour les clés étrangères)
const BFS_TABLE_ORDER = [
  'agences',
  'profils',
  'types_equipements',
  'clients',
  'affectations_client',
  'contrats',
  'tarifs',
  'tarifs_contrat',
  'equipements',
  'paliers_maintenance',
  'points_controle',
  'pieces_catalogue',
  'stock_inventaires',
  'stock_pieces',
  'stock_mouvements',
  'rdv',
  'sessions_controle',
  'verifications',
  'resultats_controle',
  'pieces_verif',
  'pieces_installees',
  'photos_verification',
  'interventions_ponctuelles',
  'pieces_intervention_ponctuelle',
  'bons_intervention',
  'lignes_facturation'
];

// Buckets de stockage utilisés par l'application
const BFS_BUCKETS = ['bons-intervention', 'photos-verification', 'stock-photos'];

function _bfsMajRapport(id, lignes){
  const el = $(id);
  if(el) el.textContent = lignes.join('\n');
}

// ------------------------------------------------------------
// EXPORT — Données (Excel, une feuille par table)
// ------------------------------------------------------------
async function bfsExporterExcel(){
  const btn = $('btn-export-excel');
  if(btn){btn.disabled = true; btn.textContent = '⏳ Export en cours…';}
  const rapport = [];
  try{
    if(typeof XLSX === 'undefined'){
      toast('Erreur : bibliothèque Excel non chargée', 'err');
      return;
    }
    const wb = XLSX.utils.book_new();
    let totalLignes = 0;

    for(const table of BFS_TABLE_ORDER){
      let allRows = [];
      let from = 0;
      const pageSize = 1000;
      let erreur = null;
      while(true){
        const {data, error} = await db.from(table).select('*').range(from, from + pageSize - 1);
        if(error){ erreur = error.message; break; }
        allRows = allRows.concat(data || []);
        if(!data || data.length < pageSize) break;
        from += pageSize;
      }

      if(erreur){
        rapport.push(`⚠️ ${table} : ERREUR (${erreur})`);
        _bfsMajRapport('sauvegarde-export-rapport', rapport);
        continue;
      }

      // Sérialisation des colonnes JSON/tableau en texte JSON (Excel ne stocke que du texte)
      const serialise = allRows.map(row => {
        const r = {};
        for(const k in row){
          const v = row[k];
          r[k] = (v !== null && typeof v === 'object') ? JSON.stringify(v) : v;
        }
        return r;
      });

      const ws = serialise.length
        ? XLSX.utils.json_to_sheet(serialise)
        : XLSX.utils.aoa_to_sheet([['(aucune donnée)']]);
      XLSX.utils.book_append_sheet(wb, ws, table.slice(0, 31));

      totalLignes += allRows.length;
      rapport.push(`${table} : ${allRows.length} ligne(s)`);
      _bfsMajRapport('sauvegarde-export-rapport', rapport);
    }

    const horodatage = new Date().toISOString().slice(0,19).replace(/[:T]/g,'-');
    const filename = `BFS_Sauvegarde_${horodatage}.xlsx`;
    XLSX.writeFile(wb, filename);
    toast(`Sauvegarde Excel générée ✓ (${totalLignes} lignes, ${BFS_TABLE_ORDER.length} tables)`);
  }catch(e){
    console.error('Erreur export Excel:', e);
    toast('Erreur pendant l\'export : ' + e.message, 'err');
  }finally{
    if(btn){btn.disabled = false; btn.textContent = '📊 Exporter les données (Excel)';}
  }
}

// ------------------------------------------------------------
// IMPORT — Données (upsert / fusion intelligente)
// ------------------------------------------------------------
async function bfsImporterExcel(){
  const inp = $('inp-import-excel');
  const file = inp && inp.files && inp.files[0];
  if(!file){ toast('Sélectionnez d\'abord un fichier .xlsx', 'err'); return; }

  if(!confirm(
    'La restauration va FUSIONNER les données du fichier avec la base actuelle ' +
    '(mise à jour des lignes existantes par id, ajout des lignes manquantes).\n\n' +
    'Aucune donnée existante ne sera supprimée.\n\nContinuer ?'
  )) return;

  const rapport = [];
  try{
    if(typeof XLSX === 'undefined'){
      toast('Erreur : bibliothèque Excel non chargée', 'err');
      return;
    }
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, {type:'array'});

    for(const table of BFS_TABLE_ORDER){
      const sheetName = table.slice(0,31);
      if(!wb.SheetNames.includes(sheetName)){
        continue; // table absente du fichier, on l'ignore
      }
      const ws = wb.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(ws, {defval:null});
      if(!rows.length || (rows.length===1 && rows[0]['(aucune donnée)']!==undefined)){
        rapport.push(`${table} : 0 ligne (ignoré)`);
        _bfsMajRapport('sauvegarde-import-rapport', rapport);
        continue;
      }

      // Désérialisation : toute chaîne ressemblant à du JSON est re-parsée
      const parsees = rows.map(row => {
        const r = {};
        for(const k in row){
          let v = row[k];
          if(typeof v === 'string' && v.length && (v[0]==='{' || v[0]==='[')){
            try{ v = JSON.parse(v); }catch(e){ /* laisser tel quel si ce n'est pas du JSON valide */ }
          }
          if(v === '') v = null;
          r[k] = v;
        }
        return r;
      });

      let ok = 0, erreurMsg = null;
      const taille = 500;
      for(let i=0; i<parsees.length; i+=taille){
        const chunk = parsees.slice(i, i+taille);
        const {error} = await db.from(table).upsert(chunk, {onConflict:'id'});
        if(error){ erreurMsg = error.message; break; }
        ok += chunk.length;
      }

      rapport.push(
        erreurMsg
          ? `${table} : ${ok}/${parsees.length} ligne(s) — ⚠️ ERREUR: ${erreurMsg}`
          : `${table} : ${ok}/${parsees.length} ligne(s) ✓`
      );
      _bfsMajRapport('sauvegarde-import-rapport', rapport);
    }

    toast('Restauration terminée — voir le détail ci-dessous');
  }catch(e){
    console.error('Erreur import Excel:', e);
    toast('Erreur pendant la restauration : ' + e.message, 'err');
  }
}

// ------------------------------------------------------------
// EXPORT — Fichiers de stockage (ZIP)
// ------------------------------------------------------------
async function _bfsListerRecursif(zip, bucket, dossier){
  const {data, error} = await db.storage.from(bucket).list(dossier, {limit:1000});
  if(error || !data) return 0;
  let count = 0;
  for(const item of data){
    const chemin = dossier ? `${dossier}/${item.name}` : item.name;
    // Dans supabase-js v2, un "dossier" n'a pas de métadonnées (id/metadata = null)
    if(item.id === null && item.metadata === null){
      count += await _bfsListerRecursif(zip, bucket, chemin);
    }else{
      const {data: blob, error: dlErr} = await db.storage.from(bucket).download(chemin);
      if(dlErr || !blob) continue;
      zip.file(`${bucket}/${chemin}`, blob);
      count++;
    }
  }
  return count;
}

async function bfsExporterFichiersZip(){
  const btn = $('btn-export-zip');
  if(typeof JSZip === 'undefined'){
    toast('Erreur : bibliothèque ZIP non chargée', 'err');
    return;
  }
  if(btn){btn.disabled = true; btn.textContent = '⏳ Récupération des fichiers…';}
  try{
    const zip = new JSZip();
    let total = 0;
    for(const bucket of BFS_BUCKETS){
      const n = await _bfsListerRecursif(zip, bucket, '');
      total += n;
      _bfsMajRapport('sauvegarde-export-rapport', [`${bucket} : ${n} fichier(s)`]);
    }
    if(!total){
      toast('Aucun fichier trouvé dans le stockage', 'err');
      return;
    }
    if(btn) btn.textContent = '⏳ Compression…';
    const blob = await zip.generateAsync({type:'blob'});
    const horodatage = new Date().toISOString().slice(0,19).replace(/[:T]/g,'-');
    const filename = `BFS_Fichiers_${horodatage}.zip`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    toast(`Archive ZIP générée ✓ (${total} fichier(s))`);
  }catch(e){
    console.error('Erreur export ZIP:', e);
    toast('Erreur pendant l\'export des fichiers : ' + e.message, 'err');
  }finally{
    if(btn){btn.disabled = false; btn.textContent = '🗂️ Exporter les fichiers (ZIP)';}
  }
}

// ------------------------------------------------------------
// IMPORT — Fichiers de stockage (ZIP)
// ------------------------------------------------------------
async function bfsImporterFichiersZip(){
  const inp = $('inp-import-zip');
  const file = inp && inp.files && inp.files[0];
  if(!file){ toast('Sélectionnez d\'abord un fichier .zip', 'err'); return; }
  if(typeof JSZip === 'undefined'){
    toast('Erreur : bibliothèque ZIP non chargée', 'err');
    return;
  }
  if(!confirm(
    'La restauration va ré-uploader les fichiers de l\'archive dans le stockage ' +
    '(un fichier de même nom sera écrasé). Continuer ?'
  )) return;

  const rapport = [];
  try{
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const entrees = Object.values(zip.files).filter(f => !f.dir);
    let ok = 0;
    const compteurs = {};
    for(const entree of entrees){
      const parts = entree.name.split('/');
      const bucket = parts[0];
      const chemin = parts.slice(1).join('/');
      if(!BFS_BUCKETS.includes(bucket) || !chemin) continue;
      const blob = await entree.async('blob');
      const {error} = await db.storage.from(bucket).upload(chemin, blob, {upsert:true});
      compteurs[bucket] = compteurs[bucket] || {ok:0, total:0};
      compteurs[bucket].total++;
      if(!error){ ok++; compteurs[bucket].ok++; }
    }
    for(const bucket in compteurs){
      rapport.push(`${bucket} : ${compteurs[bucket].ok}/${compteurs[bucket].total} fichier(s) ✓`);
    }
    _bfsMajRapport('sauvegarde-import-rapport', rapport);
    toast(`Fichiers restaurés : ${ok}/${entrees.length} ✓`);
  }catch(e){
    console.error('Erreur import ZIP:', e);
    toast('Erreur pendant la restauration des fichiers : ' + e.message, 'err');
  }
}
