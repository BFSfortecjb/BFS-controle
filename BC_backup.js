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
// JOURNAL — historique consultable et partageable par mail
// ------------------------------------------------------------
async function _bfsJournaliser(type, resume, lignesDetail){
  try{
    const {data:{user}} = await db.auth.getUser();
    await db.from('journal_sauvegardes').insert({
      type,
      resume,
      detail: (lignesDetail||[]).join('\n'),
      utilisateur_id: user?.id || null
    });
  }catch(e){
    console.warn('Journalisation de la sauvegarde impossible :', e);
  }
  if(document.getElementById('page-sauvegarde')?.classList.contains('active')) loadSauvegarde();
}

const BFS_TYPE_LABEL = {
  export_excel: '📊 Export Excel',
  export_zip: '🗂️ Export fichiers (ZIP)',
  import_excel: '📥 Restauration Excel',
  import_zip: '📥 Restauration fichiers (ZIP)'
};

async function loadSauvegarde(){
  const el = $('tbl-historique-sauvegarde');
  if(!el) return;
  const {data, error} = await db.from('journal_sauvegardes')
    .select('*, profils(nom, prenom)')
    .order('created_at', {ascending:false})
    .limit(100);
  if(error){
    // Table pas encore créée côté base, ou droits manquants : on n'affiche rien de bloquant
    el.innerHTML = `<div class="t-empty">Historique indisponible (${error.message})</div>`;
    return;
  }
  const logs = data || [];
  window.__sauvegardeLogs = logs;
  if(!logs.length){ el.innerHTML = '<div class="t-empty">Aucune sauvegarde enregistrée pour le moment</div>'; return; }

  el.innerHTML = `<table><thead><tr><th>Date</th><th>Type</th><th>Par</th><th>Résumé</th><th>Actions</th></tr></thead><tbody>${logs.map((l,i)=>`<tr>
    <td style="white-space:nowrap;font-size:12px">${new Date(l.created_at).toLocaleString('fr-FR')}</td>
    <td style="font-size:13px">${BFS_TYPE_LABEL[l.type] || l.type}</td>
    <td style="font-size:12px">${l.profils ? (l.profils.prenom||'')+' '+(l.profils.nom||'') : '—'}</td>
    <td style="font-size:12px">${l.resume || '—'}</td>
    <td style="white-space:nowrap">
      <button class="btn btn-s btn-xs" title="Voir le détail" onclick="showSauvegardeDetail(${i})">👁</button>
      <button class="btn btn-s btn-xs" title="Copier" onclick="copierRapportSauvegarde(${i})">📋</button>
      <button class="btn btn-s btn-xs" title="Envoyer par email" onclick="emailRapportSauvegarde(${i})">✉️</button>
    </td>
  </tr>`).join('')}</tbody></table>`;
}

function _bfsTexteRapport(l){
  return `BFS Contrôle — ${BFS_TYPE_LABEL[l.type] || l.type}\n`
    + `Date : ${new Date(l.created_at).toLocaleString('fr-FR')}\n`
    + `Par : ${l.profils ? (l.profils.prenom||'')+' '+(l.profils.nom||'') : '—'}\n`
    + `Résumé : ${l.resume || '—'}\n\n`
    + `Détail :\n${l.detail || '(aucun détail)'}`;
}

function showSauvegardeDetail(idx){
  const l = window.__sauvegardeLogs?.[idx]; if(!l) return;
  const modal = document.createElement('div');
  modal.className = 'mo open';
  modal.innerHTML = `<div class="modal" style="max-width:600px"><div class="mh"><h3>${BFS_TYPE_LABEL[l.type] || l.type}</h3><button class="mclose" onclick="this.closest('.mo').remove()">✕</button></div><div class="mc">
    <div style="margin-bottom:8px;font-size:13px;color:var(--txt-l)">${new Date(l.created_at).toLocaleString('fr-FR')} · ${l.profils ? (l.profils.prenom||'')+' '+(l.profils.nom||'') : '—'}</div>
    <pre style="background:var(--bg);padding:10px;border-radius:8px;font-size:12px;overflow:auto;max-height:400px;white-space:pre-wrap">${(l.detail||'(aucun détail)').replace(/</g,'&lt;')}</pre>
    <div style="display:flex;gap:10px;margin-top:12px">
      <button class="btn btn-s" onclick="copierRapportSauvegarde(${idx})">📋 Copier</button>
      <button class="btn btn-s" onclick="emailRapportSauvegarde(${idx})">✉️ Envoyer par email</button>
    </div>
  </div></div>`;
  modal.addEventListener('click', e=>{ if(e.target===modal) modal.remove(); });
  document.body.appendChild(modal);
}

async function copierRapportSauvegarde(idx){
  const l = window.__sauvegardeLogs?.[idx]; if(!l) return;
  try{
    await navigator.clipboard.writeText(_bfsTexteRapport(l));
    toast('Rapport copié ✓ — collez-le où vous voulez (mail, note…)');
  }catch(e){
    toast('Impossible de copier automatiquement, sélectionnez le texte manuellement', 'err');
  }
}

function emailRapportSauvegarde(idx){
  const l = window.__sauvegardeLogs?.[idx]; if(!l) return;
  const sujet = `BFS Contrôle — ${BFS_TYPE_LABEL[l.type] || l.type} du ${new Date(l.created_at).toLocaleDateString('fr-FR')}`;
  let corps = _bfsTexteRapport(l);
  // Les liens mailto: ont une limite pratique (~2000 caractères) selon les clients mail
  if(corps.length > 1800) corps = corps.slice(0, 1800) + '\n\n[…rapport tronqué — utilisez "Copier" pour le texte complet]';
  window.location.href = `mailto:?subject=${encodeURIComponent(sujet)}&body=${encodeURIComponent(corps)}`;
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
    await _bfsJournaliser('export_excel', `${totalLignes} lignes, ${BFS_TABLE_ORDER.length} tables (${filename})`, rapport);
  }catch(e){
    console.error('Erreur export Excel:', e);
    toast('Erreur pendant l\'export : ' + e.message, 'err');
    await _bfsJournaliser('export_excel', '⚠️ Interrompu par une erreur : ' + e.message, rapport);
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
    await _bfsJournaliser('import_excel', `Fichier : ${file.name}`, rapport);
  }catch(e){
    console.error('Erreur import Excel:', e);
    toast('Erreur pendant la restauration : ' + e.message, 'err');
    await _bfsJournaliser('import_excel', `⚠️ Interrompu par une erreur : ${e.message} (fichier : ${file.name})`, rapport);
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
  const rapport = [];
  let filename = null;
  try{
    const zip = new JSZip();
    let total = 0;
    for(const bucket of BFS_BUCKETS){
      const n = await _bfsListerRecursif(zip, bucket, '');
      total += n;
      rapport.push(`${bucket} : ${n} fichier(s)`);
      _bfsMajRapport('sauvegarde-export-rapport', rapport);
    }
    if(!total){
      toast('Aucun fichier trouvé dans le stockage', 'err');
      await _bfsJournaliser('export_zip', 'Aucun fichier trouvé', rapport);
      return;
    }
    if(btn) btn.textContent = '⏳ Compression…';
    const blob = await zip.generateAsync({type:'blob'});
    const horodatage = new Date().toISOString().slice(0,19).replace(/[:T]/g,'-');
    filename = `BFS_Fichiers_${horodatage}.zip`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    toast(`Archive ZIP générée ✓ (${total} fichier(s))`);
    await _bfsJournaliser('export_zip', `${total} fichier(s) (${filename})`, rapport);
  }catch(e){
    console.error('Erreur export ZIP:', e);
    toast('Erreur pendant l\'export des fichiers : ' + e.message, 'err');
    await _bfsJournaliser('export_zip', '⚠️ Interrompu par une erreur : ' + e.message, rapport);
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
    await _bfsJournaliser('import_zip', `${ok}/${entrees.length} fichier(s) (${file.name})`, rapport);
  }catch(e){
    console.error('Erreur import ZIP:', e);
    toast('Erreur pendant la restauration des fichiers : ' + e.message, 'err');
    await _bfsJournaliser('import_zip', `⚠️ Interrompu par une erreur : ${e.message} (fichier : ${file.name})`, rapport);
  }
}
