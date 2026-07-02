// ============================================================
// BFS Contrôle — DEBUG (debug.js)
// ============================================================
// Affiche un bandeau rouge en bas de l'écran si une erreur JS survient,
// avec le fichier et la ligne en cause. Aucun effet s'il n'y a pas d'erreur.
// ============================================================
(function(){
  function box(){
    var b=document.getElementById('bfs-debug');
    if(!b){
      b=document.createElement('div');b.id='bfs-debug';
      b.style.cssText='position:fixed;bottom:0;left:0;right:0;max-height:45vh;overflow:auto;background:#7f1d1d;color:#fff;font:12px/1.6 monospace;padding:10px 14px;z-index:999999;white-space:pre-wrap';
      if(document.body)document.body.appendChild(b);
      else document.addEventListener('DOMContentLoaded',function(){document.body.appendChild(b)});
    }
    return b;
  }
  window.__bfsLog=function(m){try{box().textContent+=m+'\n'}catch(e){}};
  window.addEventListener('error',function(e){
    __bfsLog('❌ ERREUR : '+e.message+'   ['+((e.filename||'?').split('/').pop())+' ligne '+e.lineno+']');
  },true);
  window.addEventListener('unhandledrejection',function(e){
    __bfsLog('❌ PROMESSE : '+(e.reason&&e.reason.message?e.reason.message:e.reason));
  });
  // Vérifie que tous les modules sont bien chargés
  window.addEventListener('load',function(){
    var attendu={'core.js':'doLogin','app.js':'loadClients','pdf.js':'exportContratPDF'};
    for(var f in attendu){
      if(typeof window[attendu[f]]!=='function')__bfsLog('❌ MODULE MANQUANT : '+f+' non chargé (ou erreur dedans)');
    }
  });
})();
console.log('✓ debug.js chargé');
