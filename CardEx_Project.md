# CardEx — Progetto TCG Collection Manager

> Documento di contesto per continuare lo sviluppo in una nuova chat.
> Versione: 1.4 | Stato: Beta con utenti reali

---

## 🎯 Cos'è CardEx

App web per collezionisti italiani di carte TCG (Pokémon e One Piece). Risolve il problema principale delle app esistenti: **nessuna mostra prezzi da venditori italiani** né supporta carte in lingua italiana.

**URL live:** `https://cardex-eight.vercel.app`  
**GitHub:** `github.com/[utente]/cardex`  
**Stack:** HTML · CSS · JS · Supabase · Vercel · CardTrader API v2

---

## 🏗️ Architettura

```
cardex/
├── index.html      # HTML (~400 righe)
├── style.css       # CSS (~560 righe)
├── app.js          # JavaScript (~1200 righe)
├── reset.html      # Pagina dedicata reset password
└── api/
    └── proxy.js    # Proxy serverless Vercel → CardTrader API
```

### Flusso dati
```
Browser → /api/proxy?path=/... → proxy.js (aggiunge Bearer token) → CardTrader API
Browser ↔ Supabase (auth + collections + card_price_history + snapshots)
Email reset → reset.html?token_hash=XXX&type=recovery → verifyOtp → form password
```

---

## 🔑 Credenziali e Configurazione

### Supabase
```
URL:  https://mdmabytgxvmjfiirqjpo.supabase.co
KEY:  sb_publishable_2zz5cPaJZ9JnDPsGUjQbXw_FOrAB-HL  (public anon key)
```

### Vercel Environment Variables
```
CARDTRADER_TOKEN = [Bearer token CardTrader dell'owner]
```

### SMTP Email (Gmail SMTP)
```
Host:     smtp.gmail.com
Port:     465
Username: [tua email Gmail]
Password: [App Password 16 caratteri]
```
Configurato in: Supabase → Project Settings → Auth → Enable Custom SMTP

### URL Configuration (Supabase → Authentication → URL Configuration)
```
Site URL:      https://cardex-eight.vercel.app
Redirect URLs: https://cardex-eight.vercel.app/**
               https://cardex-eight.vercel.app/reset.html
```

> ⚠️ Il token CardTrader NON va mai messo nel codice. Sta solo su Vercel come env var.

---

## 🗄️ Database Supabase

### Tabella `collections`
```sql
id             uuid PRIMARY KEY DEFAULT gen_random_uuid()
user_id        uuid REFERENCES auth.users(id) ON DELETE CASCADE
bp_id          integer          -- blueprint ID CardTrader
name           text             -- nome carta
expansion      text             -- nome espansione
game           text             -- 'pokemon' | 'onepiece'
lang           text             -- 'it' | 'en' | 'jp'
lang_label     text             -- 'Italiano' | 'Inglese' | 'Giapponese'
lang_flag      text             -- emoji bandiera
price          numeric          -- prezzo di mercato CT attuale (aggiornato da refresh)
paid_price     numeric          -- prezzo effettivamente pagato dall'utente
purchase_date  date             -- data di acquisto
image          text             -- URL immagine CardTrader
condition      text DEFAULT 'Near Mint'
quantity       integer DEFAULT 1
notes          text             -- note personali (opzionale)
created_at     timestamp DEFAULT now()
```

### Tabella `card_price_history`
```sql
id             uuid PRIMARY KEY DEFAULT gen_random_uuid()
collection_id  uuid REFERENCES collections(id) ON DELETE CASCADE
user_id        uuid REFERENCES auth.users(id) ON DELETE CASCADE
price          numeric NOT NULL      -- prezzo CT in quel momento
snapshot_date  date NOT NULL
created_at     timestamp DEFAULT now()
UNIQUE(collection_id, snapshot_date)
```
> Un punto per carta per giorno. Si popola: (1) al momento dell'aggiunta, (2) ad ogni "Aggiorna prezzi".

### Tabella `collection_snapshots`
```sql
id             uuid PRIMARY KEY DEFAULT gen_random_uuid()
user_id        uuid REFERENCES auth.users(id) ON DELETE CASCADE
total_value    numeric
card_count     integer
pokemon_value  numeric DEFAULT 0
onepiece_value numeric DEFAULT 0
snapshot_date  date
created_at     timestamp DEFAULT now()
UNIQUE(user_id, snapshot_date)
```

### RLS Policies — stato attuale
```sql
-- collections:
-- "utenti vedono solo le proprie carte"  CMD: ALL   (USING: auth.uid()=user_id, WITH CHECK: NULL)
-- "Users can insert collections"         CMD: INSERT (WITH CHECK: auth.uid()=user_id)  ← aggiunta in v1.3
--
-- card_price_history: SELECT, INSERT, UPDATE, DELETE (tutte con auth.uid()=user_id)
--
-- NOTA: la policy ALL su collections aveva WITH CHECK = NULL, bloccando INSERT per nuovi utenti.
-- Fix applicato: aggiunta policy INSERT esplicita con WITH CHECK.
```

---

## 🃏 CardTrader API — ID Critici

```javascript
const GAME_IDS = { pokemon: 5, onepiece: 15 };
const SINGLE_CAT_IDS = { pokemon: 73, onepiece: 192 };
const LANG_FIELD = {
  pokemon:  'pokemon_language',   // valori: 'en','it','jp','kr','fr',...
  onepiece: 'onepiece_language',  // valori: 'en','jp','kr','fr'
};
const RARITY_FIELD = {
  pokemon:  'pokemon_rarity',
  onepiece: 'onepiece_rarity',
};
const COND_ORDER = ['Near Mint','Slightly Played','Moderately Played','Played','Poor'];
const RESET_REDIRECT = 'https://cardex-eight.vercel.app/reset.html';
```

---

## 📱 Schermate dell'App

| ID | Nome | Descrizione |
|----|------|-------------|
| `#screen-login` | Login | Email + password · toggle login/registrazione · password dimenticata |
| `#screen-home` | Home | Ricerca + banner valore + sidebar ultime 8 carte |
| `#screen-detail` | Dettaglio CT | Prezzi per lingua/condizione · versioni alternative |
| `#screen-collection-pokemon` | Collezione Pokémon | Griglia raggruppata · stacked cards · filtri · aggiorna prezzi |
| `#screen-collection-onepiece` | Collezione One Piece | Griglia raggruppata · stacked cards · filtri · aggiorna prezzi |
| `#screen-stats-select` | Selezione Stats | Scelta tra stats Pokémon e One Piece |
| `#screen-stats-pokemon` | Stats Pokémon | Top 5 · distribuzione lingue · valore totale |
| `#screen-stats-onepiece` | Stats One Piece | Top 5 · distribuzione lingue · valore totale |
| `#screen-profile` | Profilo | Cambio password · reset email · elimina account |
| `reset.html` | Reset Password | Pagina dedicata per il reset via link email |

### Modal overlay (z-index 200)
| ID | Trigger | Contenuto |
|----|---------|-----------|
| `#add-modal` | Click "+ Aggiungi" su screen-detail | Condizione + prezzo pagato + data + quantità + note |
| `#card-detail-modal` | Click carta in griglia collezione | Grafico storico + lista copie con delta + modifica/rimozione |

---

## 🆕 Funzionalità v1.3

### Modal aggiunta carta
- Si apre cliccando "+ Aggiungi" nel dettaglio carta (al posto di aggiunta diretta)
- **Condizione** dropdown: mostra condizioni disponibili CT con prezzo e numero copie
- **Prezzo pagato**: pre-compilato col prezzo CT della condizione scelta, editabile
- Feedback in tempo reale: delta vs mercato CT (verde = risparmio, rosso = paghi di più)
- **Data acquisto** (date picker, default oggi)
- **Quantità** + **Note** libere
- Al salvataggio: popola `condition`, `paid_price`, `purchase_date`, `quantity`, `notes`
- Crea automaticamente il primo punto in `card_price_history`

### Griglia collezione raggruppata
- Carte con stesso `bp_id + lang + condition` appaiono come **un solo elemento**
- **Effetto stack** visivo: 2 copie → una carta ruotata +10° dietro; 3+ → due carte a +10° e -8°
- **Badge ×N** in basso a destra quando ci sono più copie
- Tasto × di rimozione rapida solo per copie singole; per gruppi si gestisce dal modal dettaglio

### Modal dettaglio carta (click sulla card in griglia)
- Header: immagine + nome + espansione + lingua + condizione
- **Grafico SVG** andamento prezzo CT nel tempo (verde = guadagno, rosso = perdita)
- Linea tratteggiata = prezzo medio pagato dall'utente
- **Lista copie**: data acquisto · prezzo pagato · valore CT attuale · **delta € e %** con ▲/▼
- Note per copia · tasto Modifica (Step 4) · tasto Rimuovi (con conferma)
- Bottone "+ Aggiungi un'altra copia" → rimanda al dettaglio CT della carta

### Aggiornamento prezzi migliorato
- `refreshPrices` ora filtra per **condizione** (non più solo per lingua)
- Ad ogni refresh salva uno snapshot in `card_price_history` (upsert, 1 punto/giorno/carta)

---

## 🔑 Funzioni principali in `app.js`

```javascript
// Modal aggiunta
openAddModal(bp, lang, byCondition, minPrice)  // apre modal con condizioni CT
closeAddModal()
onConditionChange()                             // aggiorna prezzo al cambio condizione
onPaidPriceChange()                             // aggiorna hint delta in tempo reale
confirmAddCard()                                // salva carta + snapshot iniziale

// Griglia collezione
groupCollItems(items)                           // raggruppa per bp_id+lang+condition
renderCollectionGrid(game)                      // renderizza con stacked effect

// Modal dettaglio
openCardDetailModal(idx)                        // idx in _collGroupsList
closeCardDetailModal()
loadPriceHistory(collectionIds)                 // carica da card_price_history
renderCardDetailBody(g, history)                // genera HTML dettaglio
renderPriceChartSVG(history, items, ctPrice)    // SVG grafico storico
removeCardFromModal(id)                         // rimuove copia con confirm + refresh modal
addAnotherCopy()                                // chiude modal → apre screen-detail CT

// Placeholder Step 4
editCardCopy(id)                                // TODO: modifica copia

// Ricerca
translateToEnglish(q)                           // Google Translate it→en (cache in translationCache)
showAutocomplete(q)                             // filtra blueprintCache per expansionsDB[currentGame]
doSearch(query)                                 // traduce query se Pokémon, poi cerca in cache CT
```

### Variabili di stato globali (nuove in v1.3)
```javascript
let _addCtx = null;          // contesto modal aggiunta {bp, lang, byCondition, minPrice}
let _collGroupsList = [];    // array gruppi per la griglia corrente
let _currentDetailGroup = null; // gruppo aperto nel modal dettaglio
```

### Costanti icone (v1.4)
```javascript
// ICONS — funzioni che restituiscono SVG string, usate nei template JS
// Esempi: ICONS.zap(16), ICONS.skull(32), ICONS.trash(), ICONS.eye()
// Per HTML statico: SVG symbols in index.html (<symbol id="i-zap" ...>)
//   usati come: <svg width="X" height="X"><use href="#i-zap"/></svg>
const ICONS = { zap, skull, eye, eyeOff, trash, pencil, check, trendingUp, calendar, barChart, layers, sparkles, searchX, search }
```

---

## 🚀 Funzionalità Completate

- [x] Auth email/password (Supabase)
- [x] Proxy serverless CardTrader (fix CORS)
- [x] Ricerca per nome con autocomplete
- [x] Ricerca per numero carta (201/165, EB04-007)
- [x] Filtro solo carte singole (category_id)
- [x] Filtro lingue per gioco (campo corretto)
- [x] Priorità venditori italiani
- [x] Esclusione caratteri coreani/cinesi
- [x] Versioni alternative (stessa exp + reprint)
- [x] Pagina collezione separata per gioco
- [x] Aggiornamento prezzi bulk (ora filtra per condizione)
- [x] Snapshot giornaliero valore totale
- [x] Top 5 carte + distribuzione lingue
- [x] Bottom navigation mobile
- [x] Conferma prima di rimozione
- [x] Profilo utente con avatar colorato generativo
- [x] Cambio password con feedback inline
- [x] Reset password via email (reset.html dedicata)
- [x] Elimina account con conferma email
- [x] Toggle visualizza/nascondi password
- [x] Refactoring: CSS, JS e HTML separati
- [x] **Modal aggiunta carta con condizione/prezzo/data/quantità/note**
- [x] **Prezzo pagato vs valore di mercato CT**
- [x] **Griglia collezione raggruppata con effetto stacked cards**
- [x] **Modal dettaglio carta: delta guadagno/perdita + grafico storico prezzi CT**
- [x] **Snapshot automatico prezzi per carta ad ogni refresh**
- [x] **Fix RLS INSERT policy per nuovi utenti**
- [x] **Fix refreshPrices: filtro per condizione della carta**
- [x] **Fix autocomplete: suggerimenti separati per Pokémon e One Piece** (blueprintCache filtrata per expansionsDB[currentGame])
- [x] **Ricerca per nome italiano Pokémon** (Google Translate API it→en con cache locale; solo Pokémon, One Piece non ha release italiana)
- [x] **UI: emoji sostituite con icone SVG bianche** (Lucide-style, definite come symbols in HTML + ICONS object in JS)

---

## 📋 TODO — Prossimi Sviluppi

### Alta priorità
- [ ] **Step 4: Modifica carta** — editare condizione, prezzo pagato, data, note di una copia già in collezione
- [ ] **Bug da beta test** — da raccogliere e fixare (sessione in corso)
- [ ] **Notifiche prezzo**: alert quando carta supera/scende sotto soglia
- [ ] **Export PDF/CSV**: scarica la collezione completa

### Media priorità
- [ ] **Condivisione collezione**: link pubblico read-only
- [ ] **Lista desideri**: carte cercate con price alert
- [ ] **Username nel profilo**: possibilità di modificarlo
- [ ] **SMTP professionale con dominio proprio**

### Futuro
- [ ] **Scansione barcode**: aggiunta carta con fotocamera
- [ ] **App mobile nativa** (React Native/Expo)
- [ ] **Altri TCG** (Dragon Ball, Lorcana, Digimon)

---

## 🐛 Bug Noti / Risolti

| Problema | Stato | Soluzione |
|----------|-------|-----------|
| INSERT bloccato per nuovi utenti | ✅ Risolto | Aggiunta policy INSERT esplicita su collections |
| refreshPrices non filtrava per condizione | ✅ Risolto | Aggiunto filtro condition nei prodotti CT |
| removeCard referenziava screen-collection inesistente | ✅ Risolto | Corretti gli ID schermata |
| Modal add: pulsante grigio alla riapertura | ✅ Risolto | Reset stato btn in openAddModal |
| Autocomplete One Piece mostrava carte Pokémon | ✅ Risolto | showAutocomplete e selectAutocomplete filtrano per expansionsDB[currentGame] |
| Ricerca nome italiano non funzionava (es. "Monte Gravità") | ✅ Risolto | translateToEnglish() chiama Google Translate it→en prima del loop di ricerca; cache locale in translationCache |
| Grafico non visibile | ℹ️ By design | Serve min. 2 snapshot (giorni diversi o refresh) |
| Ricerca lenta (prima volta) | ℹ️ By design | Espansioni non in cache, dalla seconda è istantanea |
| Token CardTrader scaduto | ⚠️ Manuale | Rinnova su CardTrader → Settings → API → aggiorna env var Vercel |

---

## 🔧 Come Deployare una Modifica

```bash
# Modifica i file localmente, poi:
git add index.html style.css app.js
git commit -m "descrizione modifica"
git push
# Vercel autodeploya in ~30 secondi
```

---

## 📝 Note per la prossima sessione

- **Struttura multi-file**: index.html + style.css + app.js + reset.html
- **Due modal overlay**: `#add-modal` (aggiunta) e `#card-detail-modal` (dettaglio con grafico)
- Il raggruppamento carte usa `bp_id|lang|condition` come chiave — `_collGroupsList` tiene i gruppi della griglia corrente
- `price` = valore mercato CT aggiornato; `paid_price` = quanto ha pagato l'utente
- Il grafico storico legge da `card_price_history` (1 punto/giorno/carta)
- `editCardCopy(id)` è un placeholder — Step 4 da implementare
- La policy RLS ALL su `collections` aveva `with_check = NULL` → fix con policy INSERT separata
- Per aggiungere nuove schermate: HTML in `index.html` + logica in `showScreen()` in `app.js`
- `reset.html` è completamente autonomo (script inline con Supabase)
- Avatar colorato: `getAvatarColor(email)` — deterministico, nessun DB

---

*Documento aggiornato — CardEx v1.3*
