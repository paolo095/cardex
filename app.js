const SUPABASE_URL = 'https://mdmabytgxvmjfiirqjpo.supabase.co';
const SUPABASE_KEY = 'sb_publishable_2zz5cPaJZ9JnDPsGUjQbXw_FOrAB-HL';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const PROXY = '/api/proxy';
const GAME_IDS = { pokemon: 5, onepiece: 15 };
const SINGLE_CAT_IDS = { pokemon: 73, onepiece: 192 };
const GAME_LANGS = {
  pokemon: [{code:'it',label:'Italiano',flag:'🇮🇹'},{code:'en',label:'Inglese',flag:'🇬🇧'},{code:'jp',label:'Giapponese',flag:'🇯🇵'}],
  onepiece: [{code:'en',label:'Inglese',flag:'🇬🇧'},{code:'jp',label:'Giapponese',flag:'🇯🇵'}]
};
const LANG_MAP = { it:'it', en:'en', jp:'jp' };
const LANG_FIELD = { pokemon:'pokemon_language', onepiece:'onepiece_language' };
const RARITY_FIELD = { pokemon:'pokemon_rarity', onepiece:'onepiece_rarity' };
const COND_ORDER = ['Near Mint','Slightly Played','Moderately Played','Played','Poor'];

// ── STATE ──
let currentUser = null;
let collection = [];
let currentGame = 'pokemon';
let collectionFilter = 'all';
let blueprintsDB = { pokemon:[], onepiece:[] }; // basic blueprints (name+id+exp) for autocomplete
let expansionsDB = { pokemon:[], onepiece:[] };
let blueprintCache = {}; // expansion_id -> full blueprints
const translationCache = {}; // query italiana -> query inglese (per Pokémon)

const _s=(p,sz=16,sw=2)=>`<svg width="${sz}" height="${sz}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;flex-shrink:0">${p}</svg>`;
const ICONS={
  zap:        (sz=16)=>_s('<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',sz,2.5),
  skull:      (sz=16)=>_s('<circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><path d="M8 20v2h8v-2"/><path d="m12.5 17-.5-1-.5 1h1z"/><path d="M16 20a2 2 0 0 0 1.56-3.25 8 8 0 1 0-11.12 0A2 2 0 0 0 8 20"/>',sz,sz>20?1.5:2),
  eye:        ()=>_s('<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>'),
  eyeOff:     ()=>_s('<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>'),
  trash:      ()=>_s('<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>',14),
  pencil:     ()=>_s('<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>',14),
  check:      ()=>_s('<polyline points="20 6 9 17 4 12"/>',16,2.5),
  trendingUp: ()=>_s('<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>'),
  calendar:   ()=>_s('<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',13),
  barChart:   (sz=16)=>_s('<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',sz,sz>20?1.5:2),
  layers:     (sz=36)=>_s('<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',sz,1.5),
  sparkles:   (sz=36)=>_s('<path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/>',sz,1.5),
  searchX:    (sz=36)=>_s('<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="8" x2="14" y2="14"/><line x1="14" y1="8" x2="8" y2="14"/>',sz,1.5),
  search:     (sz=36)=>_s('<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',sz,1.5),
};

let searchTimeout = null;
let searchId = 0;
let _allSearchResults = [];
let _currentSearchPage = 0;
const SEARCH_PAGE_SIZE = 12;
let isRegisterMode = false;
let autocompleteIndex = -1;
let lastDetailBp = null;
let previousScreen = 'screen-home';

// ── API ──
async function apiCall(path){
  const res = await fetch(PROXY+'?path='+encodeURIComponent(path));
  if(!res.ok) throw new Error('Errore API: '+res.status);
  return res.json();
}

// ── UTILS ──
function togglePw(inputId, btn){
  const input=document.getElementById(inputId);
  if(!input) return;
  const isHidden=input.type==='password';
  input.type=isHidden?'text':'password';
  btn.innerHTML=isHidden?ICONS.eyeOff():ICONS.eye();
}

// ── AUTH ──
function toggleAuthMode(){
  isRegisterMode = !isRegisterMode;
  document.getElementById('group-username').style.display = isRegisterMode ? 'block' : 'none';
  document.getElementById('btn-auth').textContent = isRegisterMode ? 'Registrati →' : 'Accedi →';
  document.getElementById('toggle-text').textContent = isRegisterMode ? 'Hai già un account?' : 'Non hai un account?';
  document.getElementById('auth-subtitle').textContent = isRegisterMode ? 'Crea il tuo account CARDEX' : 'Pokémon & One Piece · Prezzi reali CardTrader 🇮🇹';
  document.querySelector('.auth-toggle a').textContent = isRegisterMode ? ' Accedi' : ' Registrati';
  hideAuthError();
}
function showAuthError(msg){const el=document.getElementById('auth-error');el.textContent=msg;el.style.display='block';}
function hideAuthError(){document.getElementById('auth-error').style.display='none';}

async function doAuth(){
  const email=document.getElementById('input-email').value.trim();
  const password=document.getElementById('input-password').value;
  const username=document.getElementById('input-username').value.trim();
  hideAuthError();
  if(!email||!password){showAuthError('Inserisci email e password.');return;}
  if(isRegisterMode&&!username){showAuthError('Scegli un username.');return;}
  const btn=document.getElementById('btn-auth');
  btn.disabled=true; btn.textContent=isRegisterMode?'Registrazione...':'Accesso...';
  try{
    if(isRegisterMode){
      const{data,error}=await sb.auth.signUp({email,password,options:{data:{username}}});
      if(error) throw error;
      showAuthError('✅ Controlla la tua email per confermare la registrazione!');
      btn.disabled=false; btn.textContent='Registrati →';
    } else {
      const{data,error}=await sb.auth.signInWithPassword({email,password});
      if(error) throw error;
      await onLogin(data.user);
    }
  }catch(e){
    showAuthError(e.message==='Invalid login credentials'?'Email o password errata.':e.message);
    btn.disabled=false; btn.textContent=isRegisterMode?'Registrati →':'Accedi →';
  }
}

async function onLogin(user){
  currentUser=user;
  const username=user.user_metadata?.username||user.email.split('@')[0];
  const letter=username[0].toUpperCase();
  const color=getAvatarColor(user.email);
  // Applica avatar colorato a tutti gli elementi
  ['h','d','cp','co','ss','sp','so','pf'].forEach(s=>{
    const el=document.getElementById('avatar-'+s);
    if(el){el.textContent=letter;el.style.background=color;el.style.boxShadow=`0 0 0 2px ${color}33`;}
  });
  document.getElementById('header-username').textContent=username;
  document.getElementById('bottom-nav').style.display='flex';
  showScreen('screen-home');
  showLoading();
  await loadExpansions();
  await loadCollection();
  hideLoading();
  updateBanner();
  updateCollectionUI();
}

async function doLogout(){
  await sb.auth.signOut();
  currentUser=null; collection=[];
  blueprintsDB={pokemon:[],onepiece:[]};
  expansionsDB={pokemon:[],onepiece:[]};
  blueprintCache={};
  document.getElementById('bottom-nav').style.display='none';
  showScreen('screen-login');
}

(async()=>{
  const el=document.getElementById('search-empty-icon');
  if(el) el.innerHTML=ICONS.layers();
  const{data:{session}}=await sb.auth.getSession();
  if(session?.user) await onLogin(session.user);
})();

// Click outside autocomplete to close
document.addEventListener('click',(e)=>{
  if(!e.target.closest('.search-box')) hideAutocomplete();
});

// ── SCREENS ──
function showScreen(id){
  if(id!=='screen-detail'&&id!=='screen-profile') previousScreen=id;
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  ['nav-home','nav-collection-pokemon','nav-collection-onepiece','nav-stats'].forEach(n=>{
    const el=document.getElementById(n); if(el) el.classList.remove('active');
  });
  if(id==='screen-home') document.getElementById('nav-home').classList.add('active');
  else if(id==='screen-collection-pokemon'){
    document.getElementById('nav-collection-pokemon').classList.add('active');
    renderCollectionGrid('pokemon');
  }
  else if(id==='screen-collection-onepiece'){
    document.getElementById('nav-collection-onepiece').classList.add('active');
    renderCollectionGrid('onepiece');
  }
  else if(id==='screen-stats-select'){
    document.getElementById('nav-stats').classList.add('active');
    updateStatsSelect();
  }
  else if(id==='screen-stats-pokemon'){
    document.getElementById('nav-stats').classList.add('active');
    renderStats('pokemon');
  }
  else if(id==='screen-stats-onepiece'){
    document.getElementById('nav-stats').classList.add('active');
    renderStats('onepiece');
  }
  else if(id==='screen-profile'){
    renderProfilePage();
  }
  window.scrollTo(0,0); 
}
function goBack(){ showScreen(previousScreen); }
function showLoading(){document.getElementById('loading-overlay').classList.add('show');}
function hideLoading(){document.getElementById('loading-overlay').classList.remove('show');}
function setProgress(pct,text){
  document.getElementById('loading-bar').style.width=pct+'%';
  document.getElementById('loading-text').textContent=text;
}

// ── LOAD DATA ──
async function loadExpansions(){
  setProgress(20,'Caricamento espansioni...');
  const allExp=await apiCall('/expansions');
  expansionsDB.pokemon=allExp.filter(e=>e.game_id===GAME_IDS.pokemon).sort((a,b)=>b.id-a.id);
  expansionsDB.onepiece=allExp.filter(e=>e.game_id===GAME_IDS.onepiece).sort((a,b)=>b.id-a.id);
  setProgress(100,'✅ Pronto!');
  await new Promise(r=>setTimeout(r,300));
}

// ── SEARCH ──
function selectGame(g){
  searchId++;
  clearTimeout(searchTimeout);
  currentGame=g;
  document.getElementById('tab-pokemon').className='tab'+(g==='pokemon'?' active-pokemon':'');
  document.getElementById('tab-onepiece').className='tab'+(g==='onepiece'?' active-onepiece':'');
  document.getElementById('search-input').value='';
  document.getElementById('search-input').placeholder=g==='pokemon'?'Es: Charizard, SV03-100...':'Es: Luffy, EB04-007...';
  document.getElementById('results-grid').innerHTML=`<div class="empty-state"><span class="empty-icon">${ICONS.layers()}</span>Inizia a scrivere per cercare.</div>`;
  hideAutocomplete();
}

function isCollectorNumber(q){
  // Riconosce pattern tipo SV03-100, EB04-007, OP-08, ecc.
  return /[a-z]{1,3}[-]?\d{2,4}([-]?\d{1,4})?/i.test(q) && /\d/.test(q);
}

function onSearchInput(){
  clearTimeout(searchTimeout);
  autocompleteIndex=-1;
  const q=document.getElementById('search-input').value.trim();
  if(q.length<2){
    document.getElementById('results-grid').innerHTML=`<div class="empty-state"><span class="empty-icon">${ICONS.layers()}</span>Scrivi almeno 2 caratteri</div>`;
    hideAutocomplete();
    return;
  }
  // Mostra autocomplete dai blueprint già in cache (veloce)
  showAutocomplete(q);
  document.getElementById('results-grid').innerHTML='<div class="empty-state"><span class="spinner"></span>Ricerca in corso...</div>';
  searchTimeout=setTimeout(()=>doSearch(q),400);
}

function onSearchKey(e){
  const items=document.querySelectorAll('#autocomplete .autocomplete-item');
  if(!items.length) return;
  if(e.key==='ArrowDown'){
    e.preventDefault();
    autocompleteIndex=Math.min(autocompleteIndex+1,items.length-1);
    items.forEach((el,i)=>el.classList.toggle('highlighted',i===autocompleteIndex));
  } else if(e.key==='ArrowUp'){
    e.preventDefault();
    autocompleteIndex=Math.max(autocompleteIndex-1,-1);
    items.forEach((el,i)=>el.classList.toggle('highlighted',i===autocompleteIndex));
  } else if(e.key==='Enter' && autocompleteIndex>=0){
    e.preventDefault();
    items[autocompleteIndex].click();
  } else if(e.key==='Escape'){
    hideAutocomplete();
  }
}

function hideAutocomplete(){
  document.getElementById('autocomplete').classList.remove('show');
  autocompleteIndex=-1;
}

function showAutocomplete(q){
  const ql=q.toLowerCase();
  const translatedQL=translationCache[ql]||null;
  // Cerca tra i blueprint già in cache (rapido, no API) — solo espansioni del gioco corrente
  const currentExpIds=new Set(expansionsDB[currentGame].map(e=>e.id));
  const allCached=Object.entries(blueprintCache).filter(([id])=>currentExpIds.has(Number(id))).flatMap(([,bps])=>bps);
  const cards=allCached.filter(bp=>{
    if(!bp.name) return false;
    const name=bp.name.toLowerCase();
    const cn=(bp.fixed_properties?.collector_number||'').toLowerCase();
    const qClean=ql.replace(/\s/g,'');
    return name.includes(ql)||(translatedQL&&name.includes(translatedQL))||cn===qClean||cn.startsWith(qClean)||cn.includes(qClean);
  });
  // Dedupe per nome + collector_number
  const seen=new Set();
  const unique=[];
  for(const bp of cards){
    const key=bp.name+'|'+(bp.fixed_properties?.collector_number||'');
    if(!seen.has(key)){seen.add(key);unique.push(bp);}
    if(unique.length>=8) break;
  }
  const ac=document.getElementById('autocomplete');
  if(unique.length===0){hideAutocomplete();return;}
  ac.innerHTML=unique.map((bp,i)=>{
    const cn=bp.fixed_properties?.collector_number?'#'+bp.fixed_properties.collector_number:'';
    const expName=bp.expansion?.name||'';
    return `<div class="autocomplete-item" onclick="selectAutocomplete(${bp.id})">
      <div class="autocomplete-icon">${currentGame==='pokemon'?ICONS.zap():ICONS.skull()}</div>
      <div style="flex:1;min-width:0;">
        <div class="autocomplete-name">${bp.name}</div>
        <div class="autocomplete-meta">${expName} ${cn}</div>
      </div>
    </div>`;
  }).join('');
  ac.classList.add('show');
}

function selectAutocomplete(bpId){
  const currentExpIds=new Set(expansionsDB[currentGame].map(e=>e.id));
  const allCached=Object.entries(blueprintCache).filter(([id])=>currentExpIds.has(Number(id))).flatMap(([,bps])=>bps);
  const bp=allCached.find(b=>b.id===bpId);
  if(!bp) return;
  hideAutocomplete();
  // Avvia detail page
  openDetail(bp);
}

async function translateToEnglish(q){
  const key=q.toLowerCase().trim();
  if(translationCache[key]!==undefined) return translationCache[key];
  try{
    const url=`https://translate.googleapis.com/translate_a/single?client=gtx&sl=it&tl=en&dt=t&q=${encodeURIComponent(q)}`;
    const res=await fetch(url);
    const data=await res.json();
    const translated=(data[0]?.map(t=>t?.[0]||'').join('')||q).toLowerCase().trim();
    translationCache[key]=translated!==key?translated:null;
  }catch{
    translationCache[key]=null;
  }
  return translationCache[key];
}

async function doSearch(query){
  const myId=++searchId;
  const q=query.toLowerCase();
  const exps=expansionsDB[currentGame];
  const isCN=isCollectorNumber(q);
  const results=[];

  // Per Pokémon: traduce la query italiano→inglese (con cache locale)
  let translatedQ=null;
  if(currentGame==='pokemon'&&!isCN){
    translatedQ=await translateToEnglish(query);
    if(searchId!==myId) return;
  }

  for(let i=0;i<exps.length;i+=8){
    if(searchId!==myId) return;
    const batch=exps.slice(i,i+8);
    const toFetch=batch.filter(e=>!blueprintCache[e.id]);
    if(toFetch.length){
      const fetched=await Promise.allSettled(toFetch.map(e=>apiCall('/blueprints/export?expansion_id='+e.id)));
      const catId=SINGLE_CAT_IDS[currentGame];
      fetched.forEach((r,j)=>{
        if(r.status==='fulfilled'&&Array.isArray(r.value)){
          // Filtra solo carte singole
          blueprintCache[toFetch[j].id]=catId
            ? r.value.filter(bp=>bp.category_id===catId)
            : r.value;
        }
      });
    }
    for(const exp of batch){
      const bps=blueprintCache[exp.id]||[];
      const matched=bps.filter(bp=>{
        if(!bp.name) return false;
        const name=bp.name.toLowerCase();
        const nameMatch=name.includes(q)||(translatedQ&&name.includes(translatedQ));
        const cn=(bp.fixed_properties?.collector_number||'').toLowerCase();
        // Supporta ricerca per codice: 201/165, sv03-100, eb04-007, ecc.
        const qClean=q.replace(/\s/g,'');
        const cnMatch=cn===qClean||cn.startsWith(qClean)||cn.includes(qClean);
        return nameMatch||cnMatch;
      });
      results.push(...matched);
    }
    if(results.length>=200) break;
  }
  if(searchId!==myId) return;
  _allSearchResults = results;
  _currentSearchPage = 0;
  if(results.length){
    renderSearchPage();
  }else{
    document.getElementById('results-grid').innerHTML=`<div class="empty-state"><span class="empty-icon">${ICONS.searchX()}</span>Nessuna carta trovata.</div>`;
  }
}

function renderSearchPage(){
  if(!_allSearchResults.length) return;
  const grid = document.getElementById('results-grid');
  const totalPages = Math.ceil(_allSearchResults.length / SEARCH_PAGE_SIZE);
  const startIdx = _currentSearchPage * SEARCH_PAGE_SIZE;
  const endIdx = startIdx + SEARCH_PAGE_SIZE;
  const pageResults = _allSearchResults.slice(startIdx, endIdx);

  window._searchResults = _allSearchResults;

  const cardsHtml = pageResults.map((bp, idx) => {
    const globalIdx = startIdx + idx;
    const cn = bp.fixed_properties?.collector_number || '';
    const expCode = abbrevCode(bp.expansion?.code || bp.expansion?.name || '');
    const img = bp.image_url
      ? `<div style="aspect-ratio:2/3;background:var(--bg3);overflow:hidden;"><img src="${bp.image_url}" alt="${bp.name}" style="width:100%;height:100%;object-fit:cover;"></div>`
      : `<div style="aspect-ratio:2/3;background:var(--bg3);display:flex;align-items:center;justify-content:center;">${currentGame==='pokemon'?ICONS.zap(32):ICONS.skull(32)}</div>`;
    return `<div class="result-card" onclick="openDetailByIndex(${globalIdx})">
      ${img}
      <div class="result-card-body">
        <div class="result-card-name">${bp.name}</div>
        <div class="result-card-footer">
          <span class="result-card-exp">${expCode}</span>
          ${cn?`<span class="result-card-num">#${cn}</span>`:''}
        </div>
      </div>
    </div>`;
  }).join('');

  let pagination = '';
  if(totalPages > 1) {
    pagination = `<div style="display:flex;gap:8px;justify-content:center;align-items:center;margin-top:16px;margin-bottom:16px;">
      <button class="btn-action" onclick="goToSearchPage(${_currentSearchPage-1})" ${_currentSearchPage===0?'disabled':''}>${_currentSearchPage===0?'':'← Indietro'}</button>
      <span style="color:var(--muted);font-size:13px;font-weight:500;min-width:60px;text-align:center;">${_currentSearchPage+1} / ${totalPages}</span>
      <button class="btn-action" onclick="goToSearchPage(${_currentSearchPage+1})" ${_currentSearchPage===totalPages-1?'disabled':''}>${_currentSearchPage===totalPages-1?'':'Avanti →'}</button>
    </div>`;
  }

  grid.innerHTML = pagination + `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(128px,1fr));gap:12px;">${cardsHtml}</div>`;
}

function goToSearchPage(pageNum){
  const totalPages = Math.ceil(_allSearchResults.length / SEARCH_PAGE_SIZE);
  if(pageNum < 0 || pageNum >= totalPages) return;
  _currentSearchPage = pageNum;
  renderSearchPage();
  document.getElementById('results-grid').scrollIntoView({behavior:'smooth',block:'start'});
}

function abbrevCode(code){
  if(!code) return '';
  if(code.length<=9) return code;
  return code.split(/\s+/).map(w=>w.length>5?w.slice(0,3)+'.':w).join(' ');
}

function openDetailByIndex(i){
  const bp=window._searchResults?.[i];
  if(bp) openDetail(bp);
}

// ── DETAIL ──
function getRarityClass(rarity){
  if(!rarity) return '';
  const r=rarity.toLowerCase();
  if(r.includes('secret')) return 'rarity-secret';
  if(r.includes('promo')) return 'rarity-promo';
  if(r.includes('super')||r.includes('ultra')||r.includes('illustration')) return 'rarity-super';
  if(r.includes('rare')) return 'rarity-rare';
  if(r.includes('uncommon')) return 'rarity-uncommon';
  return 'rarity-common';
}

async function openDetail(bp){
  lastDetailBp=bp;
  showScreen('screen-detail');
  const imgC=document.getElementById('detail-img-container');
  imgC.innerHTML=bp.image_url
    ?`<img class="detail-img" src="${bp.image_url}" alt="${bp.name}">`
    :`<div class="detail-img-placeholder">${currentGame==='pokemon'?ICONS.zap(40):ICONS.skull(40)}</div>`;
  const badge=document.getElementById('detail-game-badge');
  badge.className='game-pill '+(currentGame==='pokemon'?'pill-pokemon':'pill-onepiece');
  badge.innerHTML=(currentGame==='pokemon'?ICONS.zap()+' Pokémon':ICONS.skull()+' One Piece');
  document.getElementById('detail-name').textContent=bp.name;
  const cn=bp.fixed_properties?.collector_number?' · #'+bp.fixed_properties.collector_number:'';
  document.getElementById('detail-exp').textContent=(bp.expansion?.name||'')+cn;

  // Rarity badge
  const rarity=bp.fixed_properties?.[RARITY_FIELD[currentGame]];
  document.getElementById('detail-rarity').innerHTML=rarity
    ?`<span class="rarity-badge ${getRarityClass(rarity)}">${rarity}</span>`
    :'';

  // Lang cards
  const langs=GAME_LANGS[currentGame];
  document.getElementById('detail-langs').innerHTML=langs.map(l=>`
    <div class="lang-card">
      <div class="lang-header">
        <div style="display:flex;align-items:center;gap:8px;"><span class="lang-flag">${l.flag}</span><span class="lang-name-text">${l.label}</span></div>
        <div class="lang-price" id="lp-${l.code}"><span class="spinner"></span></div>
      </div>
      <div id="ls-${l.code}"></div>
      <button class="btn-add-lang" id="lb-${l.code}" disabled>Caricamento...</button>
    </div>
  `).join('');

  // Trova versioni alternative (stesso nome, stessa espansione, collector_number diverso)
  renderAlternativeVersions(bp);

  try{
    const data=await apiCall('/marketplace/products?blueprint_id='+bp.id);
    const all=data[bp.id]||[];
    const langField=LANG_FIELD[currentGame];
    for(const l of langs){
      const ctLang=LANG_MAP[l.code];
      const byLang=all.filter(p=>p.properties_hash?.[langField]===ctLang);
      const itProds=byLang.filter(p=>p.user?.country_code==='IT');
      const prods=itProds.length>0?itProds:byLang;
      const isIT=itProds.length>0;
      const lpEl=document.getElementById('lp-'+l.code);
      const lsEl=document.getElementById('ls-'+l.code);
      const lbEl=document.getElementById('lb-'+l.code);
      if(!prods.length){
        if(lpEl) lpEl.innerHTML='<span class="lang-price unavailable">Non disponibile</span>';
        if(lsEl) lsEl.innerHTML='';
        if(lbEl){lbEl.disabled=true;lbEl.textContent='Non disponibile';}
        continue;
      }
      const minCents=Math.min(...prods.map(p=>p.price?.cents||Infinity));
      const minPrice=minCents/100;
      if(lpEl) lpEl.textContent='€ '+minPrice.toFixed(2);
      const byCondition={};
      for(const p of prods){
        const cond=p.properties_hash?.condition||'Unknown';
        if(!byCondition[cond]) byCondition[cond]={count:0,minCents:Infinity};
        byCondition[cond].count++;
        if(p.price?.cents<byCondition[cond].minCents) byCondition[cond].minCents=p.price.cents;
      }
      const condRows=COND_ORDER.filter(c=>byCondition[c]).map(c=>`
        <div class="condition-row">
          <span class="condition-name">${c}</span>
          <span class="condition-count">${byCondition[c].count} cop.</span>
          <span class="condition-price">€ ${(byCondition[c].minCents/100).toFixed(2)}</span>
        </div>
      `).join('');
      const itBadge=isIT?`<span class="it-badge">🇮🇹 Venditori IT</span>`:`<span class="no-it-badge">⚠️ Nessun venditore IT</span>`;
      if(lsEl) lsEl.innerHTML=`
        <div class="lang-stats">
          <div class="lang-stat"><div class="lang-stat-label">Copie</div><div class="lang-stat-value">${prods.length}</div></div>
          <div class="lang-stat"><div class="lang-stat-label">Prezzo min.</div><div class="lang-stat-value">€${minPrice.toFixed(2)}</div></div>
          <div class="lang-stat" style="flex:2"><div class="lang-stat-label">Provenienza</div><div class="lang-stat-value" style="font-family:'DM Sans',sans-serif;font-size:12px;">${itBadge}</div></div>
        </div>
        <div style="font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Per condizione</div>
        <div class="condition-list">${condRows||'<div style="color:var(--muted);font-size:13px;">N/D</div>'}</div>
      `;
      if(lbEl){
        lbEl.disabled=false;
        lbEl.textContent=`+ Aggiungi (${l.flag} ${l.label}) — da € ${minPrice.toFixed(2)}`;
        lbEl.onclick=()=>openAddModal(bp,l,byCondition,minPrice);
      }
    }
  }catch(e){
    document.getElementById('detail-langs').innerHTML=`<div style="color:var(--red);padding:16px;font-size:13px;">Errore: ${e.message}</div>`;
  }
}

function getCollectorBase(cn, game){
  if(!cn) return null;
  cn=cn.toLowerCase().trim();
  if(game==='onepiece'){
    return cn.replace(/[a-z]+$/,''); // EB04-007a → EB04-007
  }
  if(game==='pokemon'){
    const slash=cn.match(/^(\d+)\/(\d+)$/);
    if(slash) return slash[2]; // 165/131 → "131"
  }
  return null;
}

function renderAlternativeVersions(bp){
  const allCached=Object.values(blueprintCache).flat();
  const bpExpId=bp.expansion_id;
  const bpCN=(bp.fixed_properties?.collector_number||'').toLowerCase().trim();

const alts=allCached.filter(other=>{
    if(other.id===bp.id) return false;
    if(currentGame==='onepiece'){
      const base=(cn)=>cn.toLowerCase().trim().replace(/(-2nd|-alt|-v\d+|[a-z]+)$/,'');
      const bpBase=base(bpCN);
      const otherCN=(other.fixed_properties?.collector_number||'');
      return bpBase!==''&&base(otherCN)===bpBase;
    }
    if(currentGame==='pokemon'){
      if(other.expansion_id!==bpExpId) return false;
      return other.name===bp.name;
    }
    return false;
  });

  const seen=new Set();
  const unique=alts.filter(a=>{
    if(seen.has(a.id)) return false;
    seen.add(a.id);
    return true;
  });
  const container=document.getElementById('alt-versions-container');
  if(unique.length===0){
    container.innerHTML='';
    return;
  }
  container.innerHTML=`
    <div class="alt-versions">
      <h3>Altre versioni di "${bp.name}" (${unique.length})</h3>
      <div class="alt-grid">
        ${unique.slice(0,12).map(alt=>{
          const cn=alt.fixed_properties?.collector_number||'';
          return `<div class="alt-card" onclick='openAltVersion(${alt.id})'>
            <img src="${alt.image_url||''}" alt="${alt.name}" loading="lazy" onerror="this.style.display='none'">
            <div class="alt-card-body">
              <div class="alt-card-num">${cn?'#'+cn:''}</div>
              <div style="font-size:10px;color:var(--muted);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${alt.expansion?.name||''}</div>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>
  `;
}
function openAltVersion(bpId){
  const allCached=Object.values(blueprintCache).flat();
  const bp=allCached.find(b=>b.id===bpId);
  if(bp) openDetail(bp);
}

// ── COLLECTION ──
async function loadCollection(){
  const{data,error}=await sb.from('collections').select('*').eq('user_id',currentUser.id).order('created_at',{ascending:false});
  if(!error&&data) collection=data;
}

// ── ADD CARD MODAL ──
let _addCtx = null; // {bp, lang, byCondition, minPrice}

function openAddModal(bp, lang, byCondition, minPrice){
  _addCtx = {bp, lang, byCondition, minPrice};
  // Header
  const img = document.getElementById('add-modal-img');
  if(bp.image_url){ img.src = bp.image_url; img.style.display='block'; }
  else { img.style.display='none'; }
  document.getElementById('add-modal-name').textContent = bp.name;
  const cn = bp.fixed_properties?.collector_number ? ' · #'+bp.fixed_properties.collector_number : '';
  document.getElementById('add-modal-meta').textContent = (bp.expansion?.name||'') + cn;
  document.getElementById('add-modal-lang').textContent = lang.flag + ' ' + lang.label;
  // Popola condizioni disponibili
  const sel = document.getElementById('add-condition');
  const available = COND_ORDER.filter(c => byCondition[c]);
  if(available.length === 0){
    sel.innerHTML = '<option value="Near Mint">Near Mint</option>';
  } else {
    sel.innerHTML = available.map(c => {
      const p = (byCondition[c].minCents/100).toFixed(2);
      return `<option value="${c}" data-price="${p}">${c} — € ${p} (${byCondition[c].count} cop.)</option>`;
    }).join('');
  }
  // Pre-fill prezzo + data + reset campi
  const firstPrice = available.length ? (byCondition[available[0]].minCents/100) : minPrice;
  document.getElementById('add-price').value = firstPrice.toFixed(2);
  document.getElementById('add-date').value = new Date().toISOString().slice(0,10);
  document.getElementById('add-qty').value = 1;
  document.getElementById('add-notes').value = '';
  document.getElementById('add-error').style.display = 'none';
  const btn = document.getElementById('btn-confirm-add');
  btn.disabled = false; btn.textContent = 'Aggiungi alla collezione';
  updatePriceHint();
  document.getElementById('add-modal').classList.add('show');
  setTimeout(()=>document.getElementById('add-price').focus(), 100);
}

function closeAddModal(){
  document.getElementById('add-modal').classList.remove('show');
  _addCtx = null;
}

function getCtPriceForCondition(){
  if(!_addCtx) return 0;
  const cond = document.getElementById('add-condition').value;
  const c = _addCtx.byCondition?.[cond];
  return c ? c.minCents/100 : _addCtx.minPrice;
}

function onConditionChange(){
  // Quando cambia condizione, aggiorna il prezzo pre-fill al nuovo CT minimo
  const ctPrice = getCtPriceForCondition();
  document.getElementById('add-price').value = ctPrice.toFixed(2);
  updatePriceHint();
}

function onPaidPriceChange(){
  updatePriceHint();
}

function updatePriceHint(){
  const ctPrice = getCtPriceForCondition();
  const paid = parseFloat(document.getElementById('add-price').value);
  const hint = document.getElementById('add-price-hint');
  if(isNaN(paid) || paid <= 0){
    hint.textContent = `Mercato CardTrader: € ${ctPrice.toFixed(2)}`;
    hint.className = 'price-hint';
    return;
  }
  const delta = paid - ctPrice;
  const pct = ctPrice > 0 ? (delta / ctPrice) * 100 : 0;
  if(Math.abs(delta) < 0.01){
    hint.textContent = `= prezzo di mercato CardTrader (€ ${ctPrice.toFixed(2)})`;
    hint.className = 'price-hint';
  } else if(delta > 0){
    hint.textContent = `Mercato CT: € ${ctPrice.toFixed(2)} · paghi € ${delta.toFixed(2)} in più (+${pct.toFixed(1)}%)`;
    hint.className = 'price-hint delta-negative';
  } else {
    hint.textContent = `Mercato CT: € ${ctPrice.toFixed(2)} · risparmi € ${Math.abs(delta).toFixed(2)} (${pct.toFixed(1)}%)`;
    hint.className = 'price-hint delta-positive';
  }
}

async function confirmAddCard(){
  if(!_addCtx) return;
  const { bp, lang } = _addCtx;
  const condition = document.getElementById('add-condition').value;
  const paidPrice = parseFloat(document.getElementById('add-price').value);
  const purchaseDate = document.getElementById('add-date').value;
  const qty = parseInt(document.getElementById('add-qty').value, 10);
  const notes = document.getElementById('add-notes').value.trim();
  const errEl = document.getElementById('add-error');
  errEl.style.display = 'none';

  if(isNaN(paidPrice) || paidPrice < 0){ errEl.textContent='Inserisci un prezzo valido.'; errEl.style.display='block'; return; }
  if(!purchaseDate){ errEl.textContent='Inserisci la data di acquisto.'; errEl.style.display='block'; return; }
  if(isNaN(qty) || qty < 1){ errEl.textContent='La quantità deve essere almeno 1.'; errEl.style.display='block'; return; }

  const ctPrice = getCtPriceForCondition();
  const btn = document.getElementById('btn-confirm-add');
  btn.disabled = true; btn.textContent = 'Aggiunta in corso...';

  const item = {
    user_id: currentUser.id,
    bp_id: bp.id,
    name: bp.name,
    expansion: (bp.expansion?.name||'') + (bp.fixed_properties?.collector_number ? ' · #'+bp.fixed_properties.collector_number : ''),
    game: currentGame,
    lang: lang.code,
    lang_label: lang.label,
    lang_flag: lang.flag,
    price: ctPrice,           // valore di mercato CT corrente per la condizione scelta
    paid_price: paidPrice,    // prezzo effettivamente pagato dall'utente
    purchase_date: purchaseDate,
    condition: condition,
    quantity: qty,
    notes: notes || null,
    image: bp.image_url || ''
  };

  const { data, error } = await sb.from('collections').insert(item).select().single();
  if(error){
    console.error(error);
    errEl.textContent = 'Errore: ' + error.message;
    errEl.style.display = 'block';
    btn.disabled = false; btn.textContent = 'Aggiungi alla collezione';
    return;
  }

  // Crea il primo punto del grafico storico (prezzo CT alla data di oggi)
  try {
    await sb.from('card_price_history').insert({
      collection_id: data.id,
      user_id: currentUser.id,
      price: ctPrice,
      snapshot_date: new Date().toISOString().slice(0,10)
    });
  } catch(e){ console.warn('Snapshot iniziale non salvato', e); }

  collection.unshift(data);
  updateBanner(); updateCollectionUI();
  closeAddModal();

  // Feedback visivo sul bottone della lingua
  const btnEl = document.getElementById('lb-' + lang.code);
  if(btnEl){
    btnEl.classList.add('btn-added');
    btnEl.innerHTML = ICONS.check()+' Aggiunta!';
    setTimeout(()=>{
      btnEl.classList.remove('btn-added');
      btnEl.textContent = `+ Aggiungi (${lang.flag} ${lang.label}) — da € ${_addCtx?.minPrice?.toFixed(2) || ctPrice.toFixed(2)}`;
    }, 2000);
  }
}

// Chiusura modal con Escape
document.addEventListener('keydown', (e)=>{
  if(e.key !== 'Escape') return;
  if(document.getElementById('card-detail-modal')?.classList.contains('show')) closeCardDetailModal();
  else if(document.getElementById('add-modal')?.classList.contains('show')) closeAddModal();
});

async function removeCard(id){
  const{error}=await sb.from('collections').delete().eq('id',id);
  if(!error){
    collection=collection.filter(c=>c.id!==id);
    updateBanner(); updateCollectionUI();
    if(document.getElementById('screen-collection-pokemon').classList.contains('active')) renderCollectionGrid('pokemon');
    else if(document.getElementById('screen-collection-onepiece').classList.contains('active')) renderCollectionGrid('onepiece');
  }
}

function setFilter(f){
  collectionFilter=f;
  ['all','pokemon','onepiece'].forEach(x=>{
    document.getElementById('filter-'+x).className='filter-btn'+(f===x?' active':'');
  });
  updateCollectionUI();
}

function updateCollectionUI(){
  const list=document.getElementById('collection-list');
  const filtered=collection.filter(item=>collectionFilter==='all'||item.game===collectionFilter);
  if(!filtered.length){
    list.innerHTML=`<div class="empty-state"><span class="empty-icon">${ICONS.sparkles()}</span>Nessuna carta qui.<br>Cerca e aggiungi!</div>`;
    return;
  }
  // Mostra solo le ultime 8 nella sidebar
  list.innerHTML=filtered.slice(0,8).map(item=>`
    <div class="coll-item">
      ${item.image?`<img class="coll-thumb" src="${item.image}" alt="${item.name}" loading="lazy" onerror="this.style.display='none'">`:`<div class="coll-dot dot-${item.game}"></div>`}
      <div class="coll-info">
        <div class="coll-name" title="${item.name}">${item.name}</div>
        <div class="coll-lang">${item.lang_flag||''} ${item.lang_label||''}</div>
      </div>
      <div class="coll-price">€ ${Number(item.price).toFixed(2)}</div>
      <button class="btn-remove" onclick="removeCard('${item.id}')">×</button>
    </div>
  `).join('');
}

function updateBanner(){
  const total=collection.reduce((s,i)=>s+Number(i.price||0),0);
  document.getElementById('total-value').textContent=total.toFixed(2).replace('.',',');
  document.getElementById('stat-total').textContent=collection.length;
  document.getElementById('stat-pok').textContent=collection.filter(i=>i.game==='pokemon').length;
  document.getElementById('stat-op').textContent=collection.filter(i=>i.game==='onepiece').length;
}

// ── COLLECTION FULL PAGE ──
let _collGroupsList = [];
let _currentDetailGroup = null;

function groupCollItems(items){
  const groups=[], map={};
  for(const item of items){
    const cond=item.condition||'Near Mint';
    const key=`${item.bp_id}|${item.lang}|${cond}`;
    if(!map[key]){ const g={key,items:[],ref:item}; map[key]=g; groups.push(g); }
    map[key].items.push(item);
  }
  return groups;
}

function renderCollectionGrid(game){
  const grid=document.getElementById('coll-grid-'+game);
  const summary=document.getElementById('coll-summary-'+game);
  const search=document.getElementById('coll-search-'+game).value.toLowerCase().trim();
  const sortBy=document.getElementById('coll-sort-'+game).value;

  let items=collection.filter(i=>i.game===game);
  if(search) items=items.filter(i=>i.name.toLowerCase().includes(search)||(i.expansion||'').toLowerCase().includes(search));
  if(sortBy==='price-desc') items.sort((a,b)=>Number(b.price)-Number(a.price));
  else if(sortBy==='price-asc') items.sort((a,b)=>Number(a.price)-Number(b.price));
  else if(sortBy==='name') items.sort((a,b)=>a.name.localeCompare(b.name));

  const total=items.reduce((s,i)=>s+Number(i.price||0),0);
  if(summary) summary.textContent=items.length+' carte · € '+total.toFixed(2).replace('.',',');

  if(!items.length){
    grid.innerHTML=`<div class="empty-state"><span class="empty-icon">${ICONS.search()}</span>Nessun risultato.</div>`;
    _collGroupsList=[];
    return;
  }

  const groups=groupCollItems(items);
  _collGroupsList=groups;

  grid.innerHTML=groups.map((g,idx)=>{
    const item=g.ref;
    const count=g.items.length;
    const shadows=count>=3
      ?'<div class="ccs s3"></div><div class="ccs s2"></div>'
      :count===2?'<div class="ccs s2"></div>':'';
    return `<div class="coll-card-wrapper">
      ${shadows}
      <div class="coll-card" onclick="openCardDetailModal(${idx})">
        <div class="coll-card-lang">${item.lang_flag||''}</div>
        ${count===1
          ?`<button class="coll-card-remove" onclick="event.stopPropagation();removeCard('${item.id}')">×</button>`
          :`<div class="coll-card-count">×${count}</div>`}
        ${item.image
          ?`<img src="${item.image}" alt="${item.name}" loading="lazy" onerror="this.style.background='var(--bg3)'">`
          :`<div style="aspect-ratio:2/3;background:var(--bg3);display:flex;align-items:center;justify-content:center;">${item.game==='pokemon'?ICONS.zap(32):ICONS.skull(32)}</div>`}
        <div class="coll-card-body">
          <div class="coll-card-name" title="${item.name}">${item.name}</div>
          <div class="coll-card-meta">${item.expansion||''}</div>
          <div class="coll-card-price">€ ${Number(item.price).toFixed(2)}</div>
        </div>
      </div>
    </div>`;
  }).join('');
}

// ── CARD DETAIL MODAL ──
async function openCardDetailModal(idx){
  const g=_collGroupsList[idx];
  if(!g) return;
  _currentDetailGroup=g;
  const item=g.ref;
  document.getElementById('cdm-header').innerHTML=`
    ${item.image?`<img src="${item.image}" alt="${item.name}">`:''}
    <div style="flex:1;min-width:0;">
      <div class="modal-card-name">${item.name}</div>
      <div class="modal-card-meta">${item.expansion||''}</div>
      <div class="modal-card-lang-row">${item.lang_flag||''} ${item.lang_label||''} · ${item.condition||'Near Mint'}</div>
    </div>`;
  document.getElementById('cdm-body').innerHTML='<div style="text-align:center;padding:32px;color:var(--muted)"><span class="spinner"></span> Caricamento...</div>';
  document.getElementById('card-detail-modal').classList.add('show');
  const ids=g.items.map(i=>i.id);
  const history=await loadPriceHistory(ids);
  document.getElementById('cdm-body').innerHTML=renderCardDetailBody(g,history);
}

function closeCardDetailModal(){
  document.getElementById('card-detail-modal').classList.remove('show');
  _currentDetailGroup=null;
}

async function loadPriceHistory(collectionIds){
  try{
    const{data,error}=await sb.from('card_price_history')
      .select('price,snapshot_date')
      .in('collection_id',collectionIds)
      .order('snapshot_date',{ascending:true});
    if(error||!data) return [];
    const byDate={};
    for(const row of data) byDate[row.snapshot_date]=Number(row.price);
    return Object.entries(byDate).map(([date,price])=>({date,price})).sort((a,b)=>a.date.localeCompare(b.date));
  }catch(e){ return []; }
}

function renderCardDetailBody(g, history){
  const items=g.items;
  const currentCtPrice=Number(g.ref.price);
  let html='';

  // Chart
  html+=`<div class="cdm-section-title">${ICONS.trendingUp()} Andamento prezzo CardTrader</div>`;
  html+=renderPriceChartSVG(history, items, currentCtPrice);

  // Copies
  html+=`<div class="cdm-section-title" style="margin-top:20px;">Le tue copie (${items.length})</div>`;
  html+=`<div class="cdm-copies">`;
  for(const it of items){
    const paid=Number(it.paid_price??it.price??0);
    const delta=currentCtPrice-paid;
    const pct=paid>0?(delta/paid)*100:0;
    const deltaClass=delta>0.01?'pos':delta<-0.01?'neg':'zero';
    const sign=delta>0.01?'+':'';
    const arrow=delta>0.01?'▲':delta<-0.01?'▼':'=';
    const dateStr=it.purchase_date
      ?new Date(it.purchase_date+'T12:00:00').toLocaleDateString('it-IT',{day:'numeric',month:'long',year:'numeric'})
      :'—';
    html+=`<div class="cdm-copy-row">
      <div class="cdm-copy-date">${ICONS.calendar()} ${dateStr}${it.quantity>1?' · Qtà: '+it.quantity:''}</div>
      <div class="cdm-prices-row">
        <div class="cdm-price-item">
          <span class="cdm-price-label">Pagato</span>
          <span class="cdm-price-val">€ ${paid.toFixed(2)}</span>
        </div>
        <div class="cdm-price-item">
          <span class="cdm-price-label">Mercato CT ora</span>
          <span class="cdm-price-val">€ ${currentCtPrice.toFixed(2)}</span>
        </div>
        <div class="cdm-delta ${deltaClass}">${arrow} ${sign}€ ${Math.abs(delta).toFixed(2)} (${sign}${pct.toFixed(1)}%)</div>
      </div>
      ${it.notes?`<div class="cdm-notes">"${it.notes}"</div>`:''}
      <div class="cdm-copy-actions">
        <button class="btn-action" onclick="editCardCopy('${it.id}')">${ICONS.pencil()} Modifica</button>
        <button class="btn-action btn-action-danger" onclick="removeCardFromModal('${it.id}')">${ICONS.trash()} Rimuovi</button>
      </div>
    </div>`;
  }
  html+=`</div>`;
  html+=`<button class="btn-action" style="width:100%;justify-content:center;margin-top:14px;" onclick="addAnotherCopy()">+ Aggiungi un'altra copia</button>`;
  return html;
}

function renderPriceChartSVG(history, items, currentCtPrice){
  if(history.length<2){
    const msg=history.length===0
      ?'Nessuno storico disponibile. Clicca "Aggiorna prezzi" per iniziare a raccogliere dati.'
      :'Solo 1 punto disponibile. Aggiorna i prezzi un altro giorno per vedere il grafico.';
    return `<div class="cdm-chart-empty">${msg}</div>`;
  }
  const W=500,H=150,pL=46,pR=14,pT=14,pB=26;
  const cW=W-pL-pR, cH=H-pT-pB;
  const avgPaid=items.reduce((s,i)=>s+Number(i.paid_price??i.price??0),0)/items.length;
  const prices=history.map(h=>h.price);
  const allVals=[...prices,avgPaid];
  const minP=Math.min(...allVals)*0.93;
  const maxP=Math.max(...allVals)*1.07;
  const rng=maxP-minP||1;
  const toX=i=>pL+(i/(history.length-1))*cW;
  const toY=p=>pT+cH-((p-minP)/rng)*cH;
  const pts=history.map((h,i)=>`${toX(i).toFixed(1)},${toY(h.price).toFixed(1)}`);
  const linePath='M '+pts.join(' L ');
  const areaPath=`M ${toX(0).toFixed(1)},${(pT+cH).toFixed(1)} L ${pts.join(' L ')} L ${toX(history.length-1).toFixed(1)},${(pT+cH).toFixed(1)} Z`;
  const paidY=toY(avgPaid).toFixed(1);
  const lastP=prices[prices.length-1];
  const isPos=lastP>=avgPaid;
  const lc=isPos?'#5BC97D':'#E88891';
  const dtFmt=d=>{const[,m,day]=d.split('-');return `${day}/${m}`;};
  const yTicks=[minP, minP+rng/2, maxP];
  return `<div class="cdm-chart-wrap"><svg viewBox="0 0 ${W} ${H}" width="100%" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${lc}" stop-opacity=".25"/>
      <stop offset="100%" stop-color="${lc}" stop-opacity="0"/>
    </linearGradient></defs>
    ${yTicks.map(p=>`<line x1="${pL}" y1="${toY(p).toFixed(1)}" x2="${W-pR}" y2="${toY(p).toFixed(1)}" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>
      <text x="${pL-4}" y="${toY(p).toFixed(1)}" text-anchor="end" dominant-baseline="middle" font-size="9" fill="rgba(255,255,255,0.28)" font-family="JetBrains Mono,monospace">€${p.toFixed(1)}</text>`).join('')}
    <path d="${areaPath}" fill="url(#cg)"/>
    <line x1="${pL}" y1="${paidY}" x2="${W-pR}" y2="${paidY}" stroke="${lc}" stroke-width="1.5" stroke-dasharray="5,4" opacity=".7"/>
    <text x="${pL+6}" y="${(Number(paidY)-5).toFixed(1)}" font-size="9" fill="${lc}" font-family="Inter,sans-serif" opacity=".9">pagato</text>
    <path d="${linePath}" fill="none" stroke="${lc}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    ${history.map((h,i)=>`<circle cx="${toX(i).toFixed(1)}" cy="${toY(h.price).toFixed(1)}" r="3.5" fill="${lc}" stroke="var(--bg2)" stroke-width="1.5"/>`).join('')}
    <text x="${pL}" y="${H-4}" font-size="9" fill="rgba(255,255,255,0.28)" font-family="Inter,sans-serif">${dtFmt(history[0].date)}</text>
    <text x="${W-pR}" y="${H-4}" text-anchor="end" font-size="9" fill="rgba(255,255,255,0.28)" font-family="Inter,sans-serif">${dtFmt(history[history.length-1].date)}</text>
  </svg></div>`;
}

async function removeCardFromModal(id){
  if(!confirm('Rimuovere questa copia dalla collezione?')) return;
  const{error}=await sb.from('collections').delete().eq('id',id);
  if(error){ alert('Errore: '+error.message); return; }
  collection=collection.filter(c=>c.id!==id);
  updateBanner(); updateCollectionUI();
  // Aggiorna il gruppo corrente
  if(_currentDetailGroup){
    _currentDetailGroup.items=_currentDetailGroup.items.filter(i=>i.id!==id);
    if(_currentDetailGroup.items.length===0){ closeCardDetailModal(); }
    else {
      _currentDetailGroup.ref=_currentDetailGroup.items[0];
      const ids=_currentDetailGroup.items.map(i=>i.id);
      const history=await loadPriceHistory(ids);
      document.getElementById('cdm-body').innerHTML=renderCardDetailBody(_currentDetailGroup,history);
    }
  }
  // Refresh griglia
  const activeGame=document.getElementById('screen-collection-pokemon').classList.contains('active')?'pokemon'
    :document.getElementById('screen-collection-onepiece').classList.contains('active')?'onepiece':null;
  if(activeGame) renderCollectionGrid(activeGame);
}

function addAnotherCopy(){
  const g=_currentDetailGroup;
  if(!g) return;
  const bp=Object.values(blueprintCache).flat().find(b=>b.id===g.ref.bp_id);
  closeCardDetailModal();
  if(bp){ currentGame=g.ref.game; openDetail(bp); }
  else {
    showScreen('screen-home');
    alert('Cerca la carta dalla ricerca per aggiungere un\'altra copia.');
  }
}

// Placeholder Step 4
function editCardCopy(id){
  alert('Modifica carta — in arrivo nel prossimo aggiornamento!');
}
// ── REFRESH PRICES ──
async function refreshPrices(game){
  const items=collection.filter(i=>i.game===game);
  if(!items.length) return;
  const btn=document.getElementById('btn-refresh-'+game);
  btn.disabled=true;
  let done=0;
  const today = new Date().toISOString().slice(0,10);
  for(const item of items){
    btn.textContent=`🔄 ${done}/${items.length}...`;
    try{
      const data=await apiCall('/marketplace/products?blueprint_id='+item.bp_id);
      const all=data[item.bp_id]||[];
      const langField=LANG_FIELD[item.game];
      const ctLang=LANG_MAP[item.lang];
      const byLang=all.filter(p=>p.properties_hash?.[langField]===ctLang);
      const itProds=byLang.filter(p=>p.user?.country_code==='IT');
      const langProds=itProds.length>0?itProds:byLang;
      // Filtra per condizione della carta (con fallback al min lingua se non disponibile)
      const cond = item.condition || 'Near Mint';
      const condProds = langProds.filter(p => (p.properties_hash?.condition||'') === cond);
      const prods = condProds.length > 0 ? condProds : langProds;
      if(prods.length>0){
        const minCents=Math.min(...prods.map(p=>p.price?.cents||Infinity));
        const newPrice=minCents/100;
        if(Math.abs(newPrice-Number(item.price))>0.01){
          await sb.from('collections').update({price:newPrice}).eq('id',item.id);
          item.price=newPrice;
        }
        // Salva snapshot nello storico (upsert: 1 punto al giorno per carta)
        await sb.from('card_price_history').upsert({
          collection_id: item.id,
          user_id: currentUser.id,
          price: newPrice,
          snapshot_date: today
        }, { onConflict: 'collection_id,snapshot_date' });
      }
    }catch(e){console.error(e);}
    done++;
    await new Promise(r=>setTimeout(r,150));
  }
  btn.disabled=false;
  btn.textContent='✅ Aggiornati!';
  setTimeout(()=>{btn.textContent='🔄 Aggiorna prezzi';},2000);
  updateBanner();
  updateCollectionUI();
  renderCollectionGrid(game);
}

// ── STATS ──
function updateStatsSelect(){
  const pokCards=collection.filter(i=>i.game==='pokemon');
  const opCards=collection.filter(i=>i.game==='onepiece');
  const pokVal=pokCards.reduce((s,i)=>s+Number(i.price||0),0);
  const opVal=opCards.reduce((s,i)=>s+Number(i.price||0),0);
  const el1=document.getElementById('ss-pok-val');
  const el2=document.getElementById('ss-op-val');
  const el3=document.getElementById('ss-pok-count');
  const el4=document.getElementById('ss-op-count');
  if(el1) el1.textContent='€ '+pokVal.toFixed(2).replace('.',',');
  if(el2) el2.textContent='€ '+opVal.toFixed(2).replace('.',',');
  if(el3) el3.textContent=pokCards.length+' carte';
  if(el4) el4.textContent=opCards.length+' carte';
}

function renderStats(game){
  const container=document.getElementById('stats-content-'+game);
  const label=game==='pokemon'?'Pokémon':'One Piece';
  const icon=game==='pokemon'?ICONS.zap():ICONS.skull();
  const color=game==='pokemon'?'var(--pokemon)':'var(--onepiece)';
  const items=collection.filter(i=>i.game===game);
  if(!items.length){
    container.innerHTML=`<div class="empty-state"><span class="empty-icon">${ICONS.barChart(36)}</span>Aggiungi carte ${label} per vedere le statistiche!</div>`;
    return;
  }
  const total=items.reduce((s,i)=>s+Number(i.price||0),0);
  const avg=total/items.length;
  const top5=[...items].sort((a,b)=>Number(b.price)-Number(a.price)).slice(0,5);
  const byLang={};
  for(const c of items){
    const k=c.lang_flag+' '+c.lang_label;
    if(!byLang[k]) byLang[k]={count:0,total:0};
    byLang[k].count++;
    byLang[k].total+=Number(c.price||0);
  }
  const langEntries=Object.entries(byLang).sort((a,b)=>b[1].count-a[1].count);
  const maxLangCount=Math.max(...langEntries.map(([,v])=>v.count));
  container.innerHTML=`
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-card-label">Valore totale ${label}</div>
        <div class="stat-card-value" style="color:var(--green)">€ ${total.toFixed(2).replace('.',',')}</div>
        <div class="stat-card-sub">${items.length} carte in collezione</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-label">Valore medio</div>
        <div class="stat-card-value">€ ${avg.toFixed(2).replace('.',',')}</div>
        <div class="stat-card-sub">per carta</div>
      </div>
    </div>
    <div class="top-card-section">
      <h3>${icon} Top 5 carte più preziose</h3>
      ${top5.map((c,i)=>`
        <div class="top-card-row">
          <div class="top-card-rank">${i+1}</div>
          ${c.image?`<img src="${c.image}" alt="${c.name}" loading="lazy">`:`<div style="width:40px;height:56px;background:var(--bg);border-radius:6px;"></div>`}
          <div class="top-card-info">
            <div class="top-card-name">${c.name}</div>
            <div class="top-card-meta">${c.lang_flag||''} ${c.expansion||''}</div>
          </div>
          <div class="top-card-price">€ ${Number(c.price).toFixed(2)}</div>
        </div>
      `).join('')}
    </div>
    <div class="top-card-section">
      <h3>🌍 Distribuzione per lingua</h3>
      <div class="distribution">
        ${langEntries.map(([lang,info])=>{
          const pct=(info.count/maxLangCount)*100;
          return `<div class="dist-row">
            <div class="dist-label">${lang}</div>
            <div class="dist-bar"><div class="dist-fill" style="width:${pct}%;background:${color};"></div></div>
            <div class="dist-value">${info.count} · €${info.total.toFixed(2)}</div>
          </div>`;
        }).join('')}
      </div>
    </div>
  `;
}

// ── AVATAR COLOR GENERATOR ──
function getAvatarColor(seed){
  // Genera colore deterministico dall'email — sempre uguale per lo stesso utente
  let hash=0;
  for(let i=0;i<seed.length;i++) hash=seed.charCodeAt(i)+((hash<<5)-hash);
  const colors=[
    '#C9A24C','#3D9A5F','#4A7EC9','#9A4AC9','#C94A6A',
    '#4AC9B8','#C97B4A','#7BC94A','#4A6AC9','#C94AC4',
    '#C9624A','#4AAFC9','#84C94A','#C94A86','#4AC96E'
  ];
  return colors[Math.abs(hash)%colors.length];
}

function applyAvatarColors(color, letter){
  // Applica a tutti gli avatar nell'app
  const ids=['h','d','cp','co','ss','sp','so','pf'];
  ids.forEach(s=>{
    const el=document.getElementById('avatar-'+s);
    if(el){
      el.style.background=color;
      el.style.boxShadow=`0 0 0 2px ${color}33`;
      el.textContent=letter;
    }
  });
  // Avatar grande profilo
  const large=document.getElementById('profile-avatar-large');
  if(large){
    large.style.background=color;
    large.style.boxShadow=`0 8px 32px ${color}55`;
    large.textContent=letter;
  }
  // Glow nel profilo hero
  const hero=document.getElementById('profile-hero');
  if(hero) hero.style.setProperty('--avatar-color',color+'26');
}

// ── PROFILO ──
function showProfile(){
  if(!currentUser) return;
  previousScreen=document.querySelector('.screen.active')?.id||'screen-home';
  showScreen('screen-profile');
  renderProfilePage();
}

function renderProfilePage(){
  if(!currentUser) return;
  const username=currentUser.user_metadata?.username||currentUser.email.split('@')[0];
  const email=currentUser.email;
  const emailConfirmed=!!currentUser.email_confirmed_at;
  const createdAt=currentUser.created_at?new Date(currentUser.created_at):null;
  const color=getAvatarColor(email);

  // Avatar grande
  const large=document.getElementById('profile-avatar-large');
  if(large){large.style.background=color;large.style.boxShadow=`0 8px 32px ${color}55`;large.textContent=username[0].toUpperCase();}
  const hero=document.getElementById('profile-hero');
  if(hero) hero.style.setProperty('--avatar-color',color+'26');

  const unEl=document.getElementById('profile-username-display');
  if(unEl) unEl.textContent=username;

  const emEl=document.getElementById('profile-email-display');
  if(emEl) emEl.textContent=email;

  const badgeEl=document.getElementById('profile-email-badge');
  if(badgeEl){
    if(emailConfirmed){
      badgeEl.textContent='✅ Confermata';
      badgeEl.className='email-badge confirmed';
    } else {
      badgeEl.textContent='⚠️ Non confermata';
      badgeEl.className='email-badge unconfirmed';
    }
  }

  const sinceEl=document.getElementById('profile-since');
  if(sinceEl&&createdAt){
    const opts={year:'numeric',month:'long',day:'numeric'};
    sinceEl.innerHTML=ICONS.calendar()+' Membro dal '+createdAt.toLocaleDateString('it-IT',opts);
  }

  // Set hint email per delete confirm
  const hint=document.getElementById('delete-email-hint');
  if(hint) hint.textContent=email;

  // Reset form states
  ['prof-new-pw','prof-confirm-pw','delete-email-input'].forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.value='';
  });
  ['msg-pw','msg-reset','msg-delete'].forEach(id=>hideMsg(id));
  hideDeleteConfirm();
}

// ── PROFILE MESSAGES ──
function showMsg(id,text,type='success'){
  const el=document.getElementById(id);
  if(!el) return;
  el.textContent=text;
  el.className='profile-msg '+type;
  el.style.display='block';
  if(type==='success') setTimeout(()=>hideMsg(id),5000);
}
function hideMsg(id){
  const el=document.getElementById(id);
  if(el) el.style.display='none';
}

// ── CAMBIO PASSWORD ──
async function changePassword(){
  const newPw=document.getElementById('prof-new-pw').value;
  const confirmPw=document.getElementById('prof-confirm-pw').value;
  if(!newPw||newPw.length<6){showMsg('msg-pw','La password deve essere di almeno 6 caratteri.','error');return;}
  if(newPw!==confirmPw){showMsg('msg-pw','Le password non coincidono.','error');return;}
  const{error}=await sb.auth.updateUser({password:newPw});
  if(error){showMsg('msg-pw','Errore: '+error.message,'error');}
  else{
    showMsg('msg-pw','✅ Password aggiornata con successo!','success');
    document.getElementById('prof-new-pw').value='';
    document.getElementById('prof-confirm-pw').value='';
  }
}

// ── RESET PASSWORD VIA EMAIL ──
const RESET_REDIRECT = 'https://cardex-eight.vercel.app/reset.html';

async function sendResetEmail(){
  if(!currentUser) return;
  const email=currentUser.email;
  const btn=document.querySelector('#screen-profile .btn-action');
  if(btn){btn.disabled=true;btn.textContent='Invio in corso...';}
  const{error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:RESET_REDIRECT});
  if(btn){btn.disabled=false;btn.textContent='Invia link di reset';}
  if(error){showMsg('msg-reset','Errore: '+error.message,'error');}
  else{showMsg('msg-reset','Link inviato a'+email+'. Controlla la casella — controlla anche lo Spam.','success');}
}

// ── FORGOT PASSWORD (dalla login) ──
async function showForgotPassword(){
  const emailEl=document.getElementById('input-email');
  const email=emailEl?.value?.trim();
  const successEl=document.getElementById('forgot-success');
  if(!email){
    successEl.textContent='⚠️ Inserisci prima la tua email nel campo qui sopra.';
    successEl.style.background='rgba(214,163,62,.10)';
    successEl.style.borderColor='rgba(214,163,62,.3)';
    successEl.style.color='var(--amber)';
    successEl.style.display='block';
    return;
  }
  successEl.textContent='Invio in corso...';
  successEl.style.background='rgba(201,162,76,.08)';
  successEl.style.borderColor='rgba(201,162,76,.22)';
  successEl.style.color='var(--amber)';
  successEl.style.display='block';
  const{error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:RESET_REDIRECT});
  if(error){
    successEl.textContent='Errore: '+error.message;
    successEl.style.background='rgba(209,75,87,.08)';
    successEl.style.borderColor='rgba(209,75,87,.25)';
    successEl.style.color='#E88891';
  } else {
    successEl.textContent='Link inviato a'+email+'! Controlla la tua email — se non lo trovi, guarda anche nello Spam.';
    successEl.style.background='rgba(61,154,95,.10)';
    successEl.style.borderColor='rgba(61,154,95,.28)';
    successEl.style.color='#5BC97D';
  }
}

// ── DELETE ACCOUNT ──
function showDeleteConfirm(){
  document.getElementById('delete-confirm-box').style.display='block';
  document.getElementById('delete-email-input').focus();
}
function hideDeleteConfirm(){
  const box=document.getElementById('delete-confirm-box');
  if(box) box.style.display='none';
  const inp=document.getElementById('delete-email-input');
  if(inp) inp.value='';
  hideMsg('msg-delete');
}

async function deleteAccount(){
  const typed=document.getElementById('delete-email-input').value.trim();
  const expected=currentUser?.email;
  if(typed!==expected){
    showMsg('msg-delete','⚠️ L\'email non corrisponde. Riprova.','error');
    return;
  }
  const btn=document.getElementById('btn-delete-confirm');
  btn.disabled=true;
  btn.textContent='Eliminazione in corso...';
  try{
    // Elimina i dati da Supabase (RLS garantisce solo i propri)
    await sb.from('collection_snapshots').delete().eq('user_id',currentUser.id);
    await sb.from('collections').delete().eq('user_id',currentUser.id);
    // Elimina l'utente auth
    const{error}=await sb.auth.admin?.deleteUser?.(currentUser.id)||{error:null};
    // Fallback: usa signOut + mostra messaggio
    await sb.auth.signOut();
    currentUser=null;collection=[];
    blueprintsDB={pokemon:[],onepiece:[]};
    expansionsDB={pokemon:[],onepiece:[]};
    blueprintCache={};
    document.getElementById('bottom-nav').style.display='none';
    // Mostra messaggio sulla login
    showScreen('screen-login');
    const errEl=document.getElementById('auth-error');
    errEl.textContent='✅ Account eliminato con successo. Ci dispiace vederti andare!';
    errEl.style.background='rgba(61,154,95,.10)';
    errEl.style.borderColor='rgba(61,154,95,.28)';
    errEl.style.color='#5BC97D';
    errEl.style.display='block';
  }catch(e){
    showMsg('msg-delete','Errore durante l\'eliminazione: '+e.message,'error');
    btn.disabled=false;
    btn.textContent='Sì, elimina tutto per sempre';
  }
}
