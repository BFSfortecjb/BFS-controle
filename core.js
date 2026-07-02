// ============================================================
// BFS Contrôle — CORE (core.js)
// ============================================================
// SOCLE de l'appli : Supabase, connexion/déconnexion, reset mot de passe,
// sidebar, navigation, chargement initial. NE PAS MODIFIER sans raison :
// c'est ce fichier qui garantit que la connexion marche toujours.
// Ordre de chargement : debug.js → (CDN) → core.js → app.js → pdf.js
// ============================================================

console.log('BFS Index: début du script');
// ============================================================
// SUPABASE
// ============================================================
const SURL='https://dqraobwozowtnrieitkp.supabase.co';
const SKEY='sb_publishable_UhkImOyooXPnAqTCNMJ4wA_VVqscCmK';
const db=supabase.createClient(SURL,SKEY);
console.log('BFS Index: Supabase OK');

// ============================================================
// ÉTAT GLOBAL
// ============================================================
let ME=null;
let clients=[],equipements=[],typesEquip=[],profils=[],contrats=[],rdvs=[];
let pointsControle=[];
let calDate=new Date();let calpDate=new Date();
let adminAgenceFilter='';

// ============================================================
// UTILS
// ============================================================
const $=id=>document.getElementById(id);
const fmt=d=>d?new Date(d).toLocaleDateString('fr-FR'):'—';
const fmtH=t=>t?t.slice(0,5):'—';
const ecClass=d=>{if(!d)return'';const j=(new Date(d)-new Date())/86400000;return j<0?'ec-retard':j<30?'ec-urgent':j<90?'ec-proche':'ec-ok'};
const badgeR=r=>({conforme:'<span class="badge bv">✓ Conforme</span>','non conforme':'<span class="badge br">✗ Non conforme</span>','à surveiller':'<span class="badge bo">⚡ À surveiller</span>'}[r]||'<span class="badge bg">—</span>');
const badgeSt=s=>({opérationnel:'<span class="badge bv">Opérationnel</span>','à remplacer':'<span class="badge br">À remplacer</span>','en révision':'<span class="badge bo">En révision</span>','hors service':'<span class="badge br">Hors service</span>',réformé:'<span class="badge bg">Réformé</span>',actif:'<span class="badge bv">Actif</span>',suspendu:'<span class="badge bo">Suspendu</span>',terminé:'<span class="badge bg">Terminé</span>'}[s]||'<span class="badge bg">'+s+'</span>');

function toast(msg,type='ok'){const t=$('toast');t.textContent=msg;t.className='show '+type;setTimeout(()=>t.className='',3000)}
function CM(id){$(id).classList.remove('open')}
function OM(id){$(id).classList.add('open')}
document.querySelectorAll('.mo').forEach(m=>m.addEventListener('click',e=>{if(e.target===m)m.classList.remove('open')}));

// ============================================================
// AUTH — ÉCRANS
// ============================================================
function showScreen(name){
  document.querySelectorAll('.auth-screen').forEach(s=>s.classList.remove('active'));
  const s=$(name);if(s)s.classList.add('active');
  $('app').style.display='none';
}
function showApp(){
  document.querySelectorAll('.auth-screen').forEach(s=>s.classList.remove('active'));
  $('app').style.display='flex';
}

// ============================================================
// CONNEXION
// ============================================================
async function doLogin(){
  const email=$('login-email').value.trim();
  const pwd=$('login-pwd').value;
  const err=$('login-err');err.style.display='none';
  if(!email||!pwd){err.textContent='Email et mot de passe requis.';err.style.display='block';return}
  window.__loginEnCours=true;
  try{
    const {data,error}=await db.auth.signInWithPassword({email,password:pwd});
    if(error){err.textContent='Email ou mot de passe incorrect.';err.style.display='block';return}
    await onLogin(data.user);
  }finally{window.__loginEnCours=false}
}
$('login-pwd').addEventListener('keydown',e=>{if(e.key==='Enter')doLogin()});

async function onLogin(user){
  showScreen('screen-login'); // sécurité
  const {data:profil,error}=await db.from('profils').select('*,agences(nom,code)').eq('id',user.id).single();
  if(error||!profil){
    await db.auth.signOut();
    const err=$('login-err');
    err.textContent='Profil introuvable. Contactez l\'administrateur BFS.';
    err.style.display='block';
    return;
  }
  ME=profil;
  updateSidebar();
  buildNav();
  await init();
  showApp();
}

async function doLogout(){
  await db.auth.signOut();ME=null;
  showScreen('screen-login');
  $('login-pwd').value='';
}

// ============================================================
// RESET PASSWORD
// ============================================================
async function doResetPassword(){
  const pwd1=$('reset-pwd1').value;
  const pwd2=$('reset-pwd2').value;
  const err=$('reset-err');const ok=$('reset-ok');
  err.style.display='none';ok.style.display='none';
  if(pwd1.length<8){err.textContent='Minimum 8 caractères.';err.style.display='block';return}
  if(pwd1!==pwd2){err.textContent='Les mots de passe ne correspondent pas.';err.style.display='block';return}
  const {error}=await db.auth.updateUser({password:pwd1});
  if(error){err.textContent='Erreur: '+error.message;err.style.display='block';return}
  ok.textContent='✓ Mot de passe modifié ! Redirection…';ok.style.display='block';
  setTimeout(()=>{showScreen('screen-login');},2000);
}

// Écouter les events Supabase Auth
// ⚠️ RÈGLE SUPABASE : ne JAMAIS faire d'appel Supabase (db.from, db.auth…)
// directement dans ce callback → deadlock (la connexion se fige sans erreur).
// C'est pourquoi tout le corps est différé avec setTimeout.
db.auth.onAuthStateChange((event,session)=>{
  setTimeout(async()=>{
    if(event==='PASSWORD_RECOVERY'){
      showScreen('screen-reset');
      return;
    }
    if(event==='SIGNED_IN'&&session){
      if($('screen-reset').classList.contains('active'))return;
      if(!ME&&!window.__loginEnCours)await onLogin(session.user);
    }
    if(event==='SIGNED_OUT'){
      ME=null;showScreen('screen-login');
    }
  },0);
});

// Vérifier session existante au chargement
db.auth.getSession().then(async({data:{session}})=>{
  if(session&&!window.location.hash.includes('type=recovery')){
    await onLogin(session.user);
  }
});

// ============================================================
// SIDEBAR — UTILISATEUR
// ============================================================
function updateSidebar(){
  if(!ME)return;
  const initiales=((ME.prenom||'').charAt(0)+(ME.nom||'').charAt(0)).toUpperCase()||'?';
  $('sb-avatar').textContent=initiales;
  $('sb-nom').textContent=`${ME.prenom||''} ${ME.nom}`.trim();
  const roleLabel={admin:'Administrateur',secretariat:'Secrétariat',technicien:'Technicien'};
  $('sb-role-txt').textContent=roleLabel[ME.role]||ME.role;
  if(ME.agences){$('sb-agence').textContent=ME.agences.nom;$('sb-agence').style.display='inline-block'}
  else $('sb-agence').style.display='none';
  $('sud-nom').textContent=`${ME.prenom||''} ${ME.nom}`.trim();
  $('sud-email').textContent=ME.email||'';
  $('sud-badges').innerHTML=`<span class="badge bb">${roleLabel[ME.role]||ME.role}</span>${ME.agences?'<span class="badge bg">'+ME.agences.nom+'</span>':'<span class="badge bg">Briec + Sevremont</span>'}`;
}

function toggleUserDropdown(e){
  e.stopPropagation();
  const dd=$('user-dropdown');
  dd.classList.toggle('open');
  // Positionner verticalement au niveau du clic
  if(dd.classList.contains('open')){
    dd.style.top=Math.min(e.clientY - 20, window.innerHeight - dd.offsetHeight - 20)+'px';
  }
}
function closeDropdown(){
  const dd=$('user-dropdown');
  if(dd)dd.classList.remove('open');
}
document.addEventListener('click',e=>{
  const su=document.querySelector('.sb-user');
  const dd=$('user-dropdown');
  if(dd&&su&&!su.contains(e.target)&&!dd.contains(e.target))closeDropdown();
});

// ============================================================
// NAVIGATION
// ============================================================
function buildNav(){
  const nav=$('sb-nav');const role=ME.role;let html='';
  html+=`<div class="nav-sec">Tableau de bord</div>`;
  if(role==='admin'){
    html+=navA('dash-admin','📊','Vue globale');
    html+=navA('dash-tech','👤','Mon tableau de bord');
  }
  if(role==='secretariat')html+=navA('dash-sec','📊','Secrétariat');
  if(role==='technicien')html+=navA('dash-tech','📊','Mon tableau de bord');
  html+=`<div class="nav-sec">Gestion</div>`;
  html+=navA('clients','🏢','Clients');
  html+=navA('equipements','🔧','Équipements');
  html+=navA('verifications','✅','Vérifications');
  html+=navA('contrats','📋','Contrats');
  html+=navA('planning','📅','Planning');
  if(role==='admin'||role==='secretariat'){
    html+=navA('commandes','📦','Commandes à prévoir');
    html+=navA('bons','📝','Bons d\'intervention');
  }
  if(role==='admin'){
    html+=`<div class="nav-sec">Administration</div>`;
    html+=navA('utilisateurs','👥','Utilisateurs');
    html+=navA('audit','🔍','Journal d\'audit');
    html+=navA('config-points','⚙️','Points de contrôle');
  }
  nav.innerHTML=html;
  nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();navigate(a.dataset.page)}));
  const def={admin:'dash-admin',secretariat:'dash-sec',technicien:'dash-tech'}[ME.role]||'dash-tech';
  navigate(def);
}
const navA=(p,ico,label)=>`<a href="#" data-page="${p}"><span class="ico">${ico}</span><span>${label}</span></a>`;

function navigate(page){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('#sb nav a').forEach(a=>a.classList.remove('active'));
  const pg=$('page-'+page);if(!pg)return;
  pg.classList.add('active');
  const lnk=document.querySelector(`[data-page="${page}"]`);if(lnk)lnk.classList.add('active');
  const titles={
    'dash-admin':'Vue globale','dash-tech':'Mon tableau de bord','dash-sec':'Secrétariat',
    profil:'Mon profil',clients:'Clients',equipements:'Équipements',verifications:'Vérifications',
    contrats:'Contrats',planning:'Planning',utilisateurs:'Utilisateurs','config-points':'Points de contrôle',
    commandes:'Commandes à prévoir',bons:'Bons d\'intervention',audit:'Journal d\'audit'
  };
  $('page-title').textContent=titles[page]||page;
  if(page==='dash-admin')loadDashAdmin();
  if(page==='dash-tech')loadDashTech();
  if(page==='dash-sec')loadDashSec();
  if(page==='profil')loadProfil();
  if(page==='clients')loadClients();
  if(page==='equipements')loadEquipements();
  if(page==='verifications')loadVerifs();
  if(page==='contrats')loadContrats();
  if(page==='planning')loadPlanningPage();
  if(page==='utilisateurs')loadUsers();
  if(page==='audit')loadAudit();
  if(page==='commandes')loadCommandes();
  if(page==='bons')loadBons();
  if(page==='config-points')loadConfigPage();
}

// ============================================================
// INIT
// ============================================================
async function init(){
  const [{data:te},{data:pr},{data:ag}]=await Promise.all([
    db.from('types_equipements').select('*').eq('actif',true).order('categorie').order('libelle'),
    db.from('profils').select('*,agences(nom)').eq('actif',true).order('nom'),
    db.from('agences').select('*')
  ]);
  typesEquip=te||[];profils=pr||[];
  // Remplir filtres types
  [$('f-type-equip'),$('f-type-verif'),$('f-type-config')].forEach(el=>{if(!el)return;
    const prefix=el.id==='f-type-config'?'<option value="">Sélectionner…</option>':'<option value="">Tous types</option>';
    el.innerHTML=prefix+typesEquip.map(t=>`<option value="${t.code}">${t.icone} ${t.libelle}</option>`).join('');
  });
  // Select agences
  const agOpts='<option value="">— Toutes —</option>'+(ag||[]).map(a=>`<option value="${a.id}">${a.nom}</option>`).join('');
  [$('c-agence'),$('u-agence')].forEach(el=>{if(el)el.innerHTML=agOpts});
  // Select techniciens planning
  const ftp=$('f-tech-plan');if(ftp)ftp.innerHTML='<option value="">Tous techniciens</option>'+profils.map(p=>`<option value="${p.id}">${p.prenom||''} ${p.nom}</option>`).join('');
}


console.log('✓ core.js chargé');
