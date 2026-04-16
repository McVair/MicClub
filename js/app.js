// ─────────────────────────────────────────────────────────────────────────────
//  MIC CLUB · Engine v4
// ─────────────────────────────────────────────────────────────────────────────

const ADMIN_PASS_DEFAULT = '3984';
const META = 150;

const SONG_CRITERIA = [
  { key: 'afinacion', label: 'Afinación',               desc: 'Precisión tonal y entonación', max: 10 },
  { key: 'emocional', label: 'Interp. Emocional',        desc: 'Transmisión de sentimiento', max: 10 },
  { key: 'conexion',  label: 'Conexión con el Público',  desc: 'Energía y respuesta del público', max: 10 },
  { key: 'tematica',  label: 'Coherencia Temática',      desc: 'Adecuación a la temática del evento', max: 10 },
];
const PERF_CRITERIA = [
  { key: 'vestuario', label: 'Vestuario',        desc: 'Originalidad y adecuación del look', max: 10 },
  { key: 'actitud',   label: 'Actitud Escénica', desc: 'Seguridad, soltura y carisma', max: 10 },
];
const HINCHADA_CRITERIA = [
  { key: 'pancartas', label: 'Pancartas y accesorios', desc: 'Creatividad y presencia visual de la hinchada', max: 10 },
  { key: 'energia',   label: 'Energía grupal',         desc: 'Volumen, entusiasmo y participación del grupo', max: 10 },
];

// ── METADATA DE CATEGORÍAS DEL JURADO ────────────────────────────────────────
const JURY_CAT_META = {
  song:     { title: '🎵 Canción',     desc: 'Afinación · Interpretación emocional · Conexión · Temática',       color: 'var(--purple-light)', totalLabel: 'PUNTOS CANCIÓN',      confirmClass: 'btn btn-gold'   },
  perf:     { title: '🎭 Performance', desc: 'Vestuario · Actitud escénica',                                      color: 'var(--gold)',          totalLabel: 'PUNTOS PERFORMANCE',  confirmClass: 'btn btn-purple' },
  hinchada: { title: '📣 Hinchada',    desc: 'Pancartas y accesorios · Energía grupal',                          color: 'var(--teal)',          totalLabel: 'PUNTOS HINCHADA',     confirmClass: 'btn btn-teal'   },
};
// ── JUROR ID (por navegador) ─────────────────────────────────────────────────
const JURY_ID = (() => {
  let id = localStorage.getItem('jury_id');
  if (!id) {
    id = 'j_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    localStorage.setItem('jury_id', id);
  }
  return id;
})();

// ── ESTADO GLOBAL ─────────────────────────────────────────────────────────────
let db, dbRef, dbSet, dbGet, dbOnValue, dbPush, dbUpdate, dbRemove;
let firebaseOk      = false;
let allParticipants = {};
let bonusActive     = false;
let adminLoggedIn   = false;
let currentPId      = null;
let votingOpen      = false;
let showRunning     = false;
let navStack        = [];
let juryCat         = 'song';
let jurySelectedId  = { song: null, perf: null, hinchada: null };
let juryCurrentScores = { song: {}, perf: {}, hinchada: {} };
let localState = {
  participants: {},
  settings: { adminPassword: ADMIN_PASS_DEFAULT, bonus: false, votingOpen: false, showRunning: false }
};

// ── URL ROUTING ──────────────────────────────────────────────────────────────
const urlParams = new URLSearchParams(window.location.search);
const MODE      = urlParams.get('mode') || 'home';
const URL_CODE  = (urlParams.get('code') || '').toUpperCase();
let currentPage = 'home';

function buildBaseURL() {
  return window.location.origin + window.location.pathname;
}

function nav(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const el = document.getElementById('page-' + page);
  if (el) el.classList.add('active');
  currentPage = page;
  renderNav();
  if (page === 'ranking')        updateRanking();
  if (page === 'show')           updateShowMode();
  if (page === 'config')         renderConfigParticipants();
  if (page === 'history')        renderHistoryPage();
  if (page === 'jury')           renderJurySelectors();
  if (page === 'register')       resetRegisterPage();
  if (page === 'admin' && adminLoggedIn) {
    document.getElementById('admin-login').style.display = 'none';
    document.getElementById('admin-panel').style.display = 'block';
    renderAdminParticipants();
    renderAdminJury();
  }
  updateBackBtn();
  window.scrollTo(0, 0);
}

function navPush(page) {
  navStack.push(currentPage);
  nav(page);
}

async function navBack() {
  if (currentPage === 'register') {
    // guardado ahora es explícito via confirmAllData
  }
  if (navStack.length > 0) {
    nav(navStack.pop());
  }
}

async function autoSaveSong() {
  if (!showRunning || !currentPId) return;
  const title  = document.getElementById('s-title')?.value.trim();
  const artist = document.getElementById('s-artist')?.value.trim();
  const link   = document.getElementById('s-link')?.value.trim();
  if (!title || !artist || !link) return;
  if (!link.startsWith('http')) return;
  const updates = { songTitle: title, songArtist: artist, song: `${title} — ${artist}`, karaokeLink: link, songConfirmed: true };
  try {
    if (firebaseOk) {
      await dbUpdate(dbRef(db, `participants/${currentPId}`), updates);
    } else {
      Object.assign(allParticipants[currentPId], updates);
      saveLocal();
    }
    if (allParticipants[currentPId]) Object.assign(allParticipants[currentPId], updates);
    const ck = document.getElementById('song-saved-check');
    if (ck) ck.style.display = 'inline';
  } catch(e) { console.error('autoSaveSong:', e); }
}

function updatePeopleCheck() {
  const val = parseInt(document.getElementById('prof-people-input')?.value) || 0;
  const ck  = document.getElementById('people-check');
  if (ck) ck.style.display = val > 0 ? 'flex' : 'none';
}

function updateSongCheck() {
  const title  = document.getElementById('s-title')?.value.trim();
  const artist = document.getElementById('s-artist')?.value.trim();
  const link   = document.getElementById('s-link')?.value.trim();
  const ck     = document.getElementById('song-saved-check');
  if (ck) ck.style.display = (title && artist && link) ? 'flex' : 'none';
}

async function saveAndExit() {
  if (!currentPId) return;
  const errEl = document.getElementById('confirm-all-err');
  const btn   = document.getElementById('confirm-all-btn');
  if (errEl) errEl.style.display = 'none';

  const name  = document.getElementById('prof-name-input')?.value.trim();
  const phone = document.getElementById('prof-phone-input')?.value.trim();
  if (!name)  { if (errEl) { errEl.textContent = 'Escribí tu nombre'; errEl.style.display = 'block'; } return; }
  if (!phone) { if (errEl) { errEl.textContent = 'El WhatsApp es obligatorio'; errEl.style.display = 'block'; } return; }

  const updates = { name, whatsapp: phone };

  if (showRunning) {
    const ppl    = parseInt(document.getElementById('prof-people-input')?.value) || 0;
    const title  = document.getElementById('s-title')?.value.trim();
    const artist = document.getElementById('s-artist')?.value.trim();
    const link   = document.getElementById('s-link')?.value.trim();
    if (ppl > 0) updates.people = ppl;
    // Guardar canción solo si los tres campos están completos
    if (title && artist && link && link.startsWith('http')) {
      updates.songTitle     = title;
      updates.songArtist    = artist;
      updates.song          = `${title} — ${artist}`;
      updates.karaokeLink   = link;
      updates.songConfirmed = true;
    } else if (title || artist || link) {
      // Campos parciales: guardar sin confirmar
      updates.songTitle     = title  || '';
      updates.songArtist    = artist || '';
      updates.karaokeLink   = link   || '';
      updates.songConfirmed = false;
    }
  }

  if (btn) { btn.innerHTML = '<span class="spinner"></span> GUARDANDO...'; btn.disabled = true; }
  try {
    if (firebaseOk) {
      await dbUpdate(dbRef(db, `participants/${currentPId}`), updates);
    } else {
      Object.assign(allParticipants[currentPId], updates);
      saveLocal();
    }
    if (allParticipants[currentPId]) Object.assign(allParticipants[currentPId], updates);
    updateUI();
    resetRegisterPage();
  } catch(e) {
    if (errEl) { errEl.textContent = 'Error al guardar. Intentá de nuevo.'; errEl.style.display = 'block'; }
    if (btn) { btn.innerHTML = '💾 GUARDAR Y SALIR'; btn.disabled = false; }
  }
}

function updateBackBtn() {
  const bar = document.getElementById('back-bar');
  if (!bar) return;
  bar.style.display = (MODE === 'home' && navStack.length > 0) ? 'block' : 'none';
}

function renderNav() { /* nav removed — navigation via buttons + back bar */ }

// ── FIREBASE ─────────────────────────────────────────────────────────────────
function initFirebase() {
  if (window._db) {
    db = window._db; dbRef = window._dbRef; dbSet = window._dbSet;
    dbGet = window._dbGet; dbOnValue = window._dbOnValue;
    dbPush = window._dbPush; dbUpdate = window._dbUpdate; dbRemove = window._dbRemove;
    firebaseOk = true;

    dbOnValue(dbRef(db, 'participants'), snap => {
      allParticipants = snap.val() || {};
      updateUI();
    });
    dbOnValue(dbRef(db, 'settings'), snap => {
      const s = snap.val() || {};
      bonusActive   = !!s.bonus;
      votingOpen    = !!s.votingOpen;
      showRunning   = !!s.showRunning;
      if (s.showRunning === undefined || s.showRunning === null) {
        showRunning = false;
      }
      localState.settings = { ...localState.settings, ...s };
      if (!showRunning) enforceNoShowState();
      updateBonusBanners();
      handleVotingState();
      updateDashboard();
    });
  } else {
    setupLocal();
  }
}

document.addEventListener('firebaseReady', initFirebase);
setTimeout(() => { if (!firebaseOk) setupLocal(); }, 3000);

function setupLocal() {
  const s = localStorage.getItem('micclub_data');
  if (s) { try { localState = JSON.parse(s); } catch(e) {} }
  allParticipants = localState.participants || {};
  bonusActive     = !!localState.settings?.bonus;
  votingOpen      = !!localState.settings?.votingOpen;
  showRunning     = !!localState.settings?.showRunning;
  if (!showRunning) enforceNoShowState();
  updateUI();
  setInterval(updateUI, 8000);
}

function saveLocal() {
  localState.participants = allParticipants;
  localStorage.setItem('micclub_data', JSON.stringify(localState));
  updateUI();
}

// ── MOTOR DE PUNTOS ──────────────────────────────────────────────────────────
function calcBaseScore(p) {
  const people = parseInt(p.people) || 0;
  let pts = 5;                        // inscribirse al show
  pts += people;                      // 1 pt por cada reserva
  if (p.songConfirmed) pts += 3;      // canción elegida
  pts += parseInt(p.extraPts) || 0;   // extra manual del admin
  return pts;
}

// Verifica si el campo referido contiene el email de un participante registrado
// Retorna [id, participante] del referidor, o null
function findReferrer(referrerText) {
  if (!referrerText) return null;
  const email = referrerText.trim().toLowerCase();
  if (!email.includes('@')) return null; // debe ser un email
  return Object.entries(allParticipants).find(([, rp]) =>
    rp.email && rp.email.toLowerCase() === email
  ) || null;
}

function calcScore(p) {
  let pts = calcBaseScore(p);
  if (p.prizeSong)     pts += 5;
  if (p.prizePerf)     pts += 5;
  if (p.prizeHinchada) pts += 8;
  if (p.prizePublicoSong) pts += 5;  // ganador votación pública canción
  if (p.prizePublicoPerf) pts += 5;  // ganador votación pública performance
  return pts;
}

function calcMicclubScore(p) {
  return calcBaseScore(p) + (parseInt(p.micclubPts) || 0);
}

function sorted() {
  return Object.entries(allParticipants)
    .map(([id, p]) => ({ ...p, id, score: calcScore(p) }))
    .sort((a, b) => b.score - a.score);
}

function sortedMicclub() {
  return Object.entries(allParticipants)
    .map(([id, p]) => ({ ...p, id, score: calcMicclubScore(p) }))
    .sort((a, b) => b.score - a.score);
}

// ── TOTALES DE JURADO (multi-jurado) ─────────────────────────────────────────
function getJuryTotal(pid, cat) {
  const p = allParticipants[pid];
  if (!p) return 0;
  let scores;
  if      (cat === 'song')     scores = p.juryScoresSong     || {};
  else if (cat === 'perf')     scores = p.juryScoresPerf     || {};
  else if (cat === 'hinchada') scores = p.juryScoresHinchada || {};
  else return 0;

  // All cats: { jurorId: { criteriaKey: val } } or legacy { criteriaKey: val }
  const vals = Object.values(scores);
  if (!vals.length) return 0;
  if (typeof vals[0] === 'object' && vals[0] !== null) {
    return vals.reduce((total, js) =>
      total + Object.values(js).reduce((s, v) => s + (parseInt(v) || 0), 0), 0);
  }
  return vals.reduce((s, v) => s + (parseInt(v) || 0), 0);
}

function getJuryLeader(cat) {
  const parts = Object.entries(allParticipants);
  if (!parts.length) return null;
  return parts
    .map(([id, p]) => ({ id, name: p.name, score: getJuryTotal(id, cat) }))
    .sort((a, b) => b.score - a.score)[0];
}

// ── UI CENTRAL ────────────────────────────────────────────────────────────────
function updateUI() {
  updateDashboard();
  updateStats();
  updateLeader();
  updateRanking();
  updateShowMode();
  updateBonusBanners();
  handleVotingState();
  updateEventInfoBanners();
  if (MODE === 'vote') loadPublicVoteOpts();
  if (adminLoggedIn) { renderAdminParticipants(); renderAdminJury(); }
  if (MODE === 'jury') { renderJurySelectors(); }
  if (currentPage === 'config') renderConfigParticipants();
  renderLinks();
}

// ── DASHBOARD HOME ────────────────────────────────────────────────────────────
function updateDashboard() {
  if (!document.getElementById('home-dashboard')) return;

  // Stats
  const parts    = Object.values(allParticipants);
  const withSong = parts.filter(p => p.songConfirmed).length;
  const reservas = parts.reduce((s, p) => s + (parseInt(p.people) || 0), 0);
  const elP = document.getElementById('dash-parts');
  const elR = document.getElementById('dash-reservas');
  if (elP) elP.textContent = withSong;
  if (elR) elR.textContent = reservas;

  // Resultados label: nombre del evento si hay show activo
  const lbl = document.getElementById('dash-ranking-label');
  if (lbl) {
    const ce = localState.settings?.currentEvent;
    lbl.textContent = showRunning && ce?.name ? `Resultados · ${ce.name}` : 'Resultados';
  }

  // Botón INICIAR/TERMINAR EVENTO
  const showBtn = document.getElementById('dash-show-btn');
  if (showBtn) {
    if (showRunning) {
      showBtn.textContent       = 'TERMINAR EVENTO';
      showBtn.style.background  = 'linear-gradient(135deg,#aa3d50,#7a2535)';
      showBtn.style.color       = '#fff';
      showBtn.style.borderColor = '#aa3d50';
    } else {
      showBtn.textContent       = 'INICIAR EVENTO';
      showBtn.style.background  = 'linear-gradient(135deg,#4d9e6a,#2d6642)';
      showBtn.style.color       = '#0a0a0f';
      showBtn.style.borderColor = '#4d9e6a';
    }
  }

  // Título dinámico: sin evento vs con evento activo
  const ce      = localState.settings?.currentEvent;
  const noEvt   = document.getElementById('dash-no-event');
  const hasEvt  = document.getElementById('dash-has-event');
  const evtName = document.getElementById('dash-event-name');
  const evtDet  = document.getElementById('dash-event-details');
  if (ce && ce.name && showRunning) {
    if (noEvt)  noEvt.style.display  = 'none';
    if (hasEvt) hasEvt.style.display = 'block';
    if (evtName) evtName.textContent = ce.name;
    const det = [ce.date, ce.time, ce.venue].filter(Boolean).join(' · ');
    if (evtDet) evtDet.textContent = det;
  } else {
    if (noEvt)  noEvt.style.display  = 'block';
    if (hasEvt) hasEvt.style.display = 'none';
  }

  // Sección de votación: siempre visible, dim/lit según estado
  const voteSec = document.getElementById('dash-vote-section');
  if (voteSec) voteSec.style.display = 'grid';

  // Votación Pública: dim cuando no hay show o votación cerrada
  const votePubBtn = document.getElementById('dash-btn-vote-pub');
  if (votePubBtn) {
    const pubActive = showRunning && votingOpen;
    votePubBtn.classList.toggle('dim', !pubActive);
    votePubBtn.classList.toggle('lit', pubActive);
  }

  // Votación Jurado: dim cuando show no activo
  const voteJuryBtn = document.getElementById('dash-btn-vote-jury');
  if (voteJuryBtn) {
    voteJuryBtn.classList.toggle('dim', !showRunning);
    voteJuryBtn.classList.toggle('lit', showRunning);
  }

  // Ranquín: dim cuando show no activo
  const rankBtn = document.getElementById('dash-ranking-btn');
  if (rankBtn) {
    rankBtn.classList.toggle('dim', !showRunning);
    rankBtn.classList.toggle('lit', showRunning);
  }

  updateEventInfoBanners();
}

function updateEventInfoBanners() {
  const ce = localState.settings?.currentEvent;
  const allIds = [
    'event-banner-register', 'event-banner-vote', 'event-banner-ranking',
    'event-banner-jury', 'event-banner-show', 'event-banner-config', 'event-banner-history'
  ];
  // IDs where the event name should be extra-prominent (voting pages)
  const prominentIds = new Set(['event-banner-vote', 'event-banner-jury', 'event-banner-ranking']);

  allIds.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (ce && ce.name) {
      const det = [ce.date, ce.time, ce.venue].filter(Boolean).join(' · ');
      if (prominentIds.has(id)) {
        el.innerHTML = `<div style="font-family:'Bebas Neue',sans-serif;font-size:26px;letter-spacing:3px;color:var(--text);line-height:1">${esc(ce.name)}</div>${det ? `<div style="font-size:11px;color:var(--text2);margin-top:3px;letter-spacing:1px">${esc(det)}</div>` : ''}`;
        el.style.cssText = 'display:block;text-align:center;padding:10px 14px 8px;margin-bottom:10px';
      } else {
        el.innerHTML = `<span style="font-weight:700;color:var(--text)">${esc(ce.name)}</span>${det ? `<span style="color:var(--text2);margin-left:8px;font-size:11px">${esc(det)}</span>` : ''}`;
        el.style.cssText = 'display:block';
      }
    } else {
      el.style.display = 'none';
    }
  });
}

// ── MODAL PERSONALIZADO (sin ventanas del navegador) ──────────────────────────
let _cmOk = null, _cmCancel = null;

function showCustomModal({ title = 'MIC CLUB', msg = '', input = false, inputType = 'password', inputPlaceholder = 'Contraseña', okText = 'Aceptar', cancelText = null, onOk = null, onCancel = null }) {
  const el = document.getElementById('custom-modal');
  if (!el) return;
  document.getElementById('cm-title').textContent = title;
  document.getElementById('cm-msg').innerHTML     = msg;
  const iw  = document.getElementById('cm-input-wrap');
  const inp = document.getElementById('cm-input');
  if (input) {
    iw.style.display  = 'block';
    inp.type          = inputType;
    inp.placeholder   = inputPlaceholder;
    inp.value         = '';
    inp.onkeyup = e => { if (e.key === 'Enter') _cmClickOk(); };
    setTimeout(() => inp.focus(), 120);
  } else {
    iw.style.display = 'none';
  }
  _cmOk     = onOk;
  _cmCancel = onCancel;
  const okBtn = `<button class="btn btn-gold" onclick="_cmClickOk()">${okText}</button>`;
  const btns  = document.getElementById('cm-btns');
  if (cancelText) {
    btns.innerHTML = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><button class="btn btn-outline" onclick="_cmClickCancel()">${cancelText}</button>${okBtn}</div>`;
  } else {
    btns.innerHTML = okBtn;
  }
  el.style.display = 'flex';
}

function _cmClickOk() {
  const val = document.getElementById('cm-input')?.value || '';
  closeCustomModal();
  if (_cmOk) _cmOk(val);
}
function _cmClickCancel() {
  closeCustomModal();
  if (_cmCancel) _cmCancel();
}
function closeCustomModal() {
  const el = document.getElementById('custom-modal');
  if (el) el.style.display = 'none';
}
function mcAlert(msg, onOk) {
  showCustomModal({ msg, okText: 'OK', onOk: onOk || null });
}
function mcConfirm(msg, onOk, onCancel) {
  showCustomModal({ msg, okText: 'Confirmar', cancelText: 'Cancelar', onOk, onCancel });
}
function mcPrompt(msg, onOk, inputType = 'password', placeholder = 'Contraseña') {
  showCustomModal({ msg, input: true, inputType, inputPlaceholder: placeholder, okText: 'Confirmar', cancelText: 'Cancelar', onOk });
}

// ── DESCARGA LISTA DE CANCIONES ──────────────────────────────────────────────
function downloadSongLinks() {
  const parts = Object.values(allParticipants)
    .filter(p => p.karaokeLink || p.songTitle)
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  if (!parts.length) { mcAlert('No hay canciones cargadas aún.'); return; }
  const lines = ['CANCIONES MIC CLUB\n' + new Date().toLocaleDateString('es-AR'), ''];
  parts.forEach(p => {
    lines.push(`${p.name || '(sin nombre)'}`);
    if (p.songTitle)  lines.push(`  Canción: ${p.songTitle}${p.songArtist ? ' — ' + p.songArtist : ''}`);
    if (p.karaokeLink) lines.push(`  Link: ${p.karaokeLink}`);
    lines.push('');
  });
  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = `canciones-micclub-${new Date().toISOString().slice(0,10)}.txt`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function homeLogin() {
  const input    = document.getElementById('home-pass');
  const pass     = (input?.value || '').trim();
  const adminPass = localState.settings?.adminPassword || ADMIN_PASS_DEFAULT;
  if (pass === adminPass) {
    adminLoggedIn = true;
    sessionStorage.setItem('mc_ok', '1');
    document.getElementById('home-login-gate').style.display  = 'none';
    document.getElementById('home-dashboard').style.display   = 'block';
    updateDashboard();
  } else {
    const err = document.getElementById('home-login-err');
    if (err) { err.style.display = 'block'; err.textContent = 'Contraseña incorrecta'; }
  }
}

function navToConfig() {
  renderConfigParticipants();
  navPush('config');
}

function renderConfigParticipants() {
  const parts = sorted();
  const el = document.getElementById('config-parts-list');
  if (!el) return;
  if (!parts.length) {
    el.innerHTML = '<div style="text-align:center;color:var(--text2);padding:20px">Sin participantes registrados</div>';
    return;
  }
  el.innerHTML = parts.map(p => {
    const mc      = calcMicclubScore(p);
    const song    = p.songTitle ? esc(p.songTitle) + (p.songArtist ? ' — ' + esc(p.songArtist) : '') : '—';
    const karLink = p.karaokeLink
      ? `<a href="${esc(p.karaokeLink)}" target="_blank" style="color:var(--purple-light);text-decoration:none;word-break:break-all">${esc(p.karaokeLink)}</a>`
      : '—';
    const eventLine = showRunning
      ? `<div style="font-size:12px;color:var(--text2);margin-bottom:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
           👥 ${p.people || 0} · 🎵 ${song}
         </div>
         <div style="font-size:11px;color:var(--text2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
           🔗 ${karLink}
         </div>`
      : '';
    return `<div style="display:flex;align-items:stretch;gap:6px;margin-bottom:5px">
      <div style="flex:1;min-width:0;background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:8px 11px">
        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:3px;gap:8px">
          <span style="font-weight:700;font-size:15px;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(p.name)}</span>
          <span style="font-size:13px;color:var(--gold);white-space:nowrap;font-weight:600">🎤 ${mc} pts</span>
        </div>
        <div style="font-size:12px;color:var(--text2);margin-bottom:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
          ${esc(p.whatsapp || '—')} · ${esc(p.email || '—')}
        </div>
        ${eventLine}
      </div>
      <div style="display:flex;flex-direction:row;gap:4px;flex-shrink:0;align-items:stretch">
        <button class="btn-dash btn-copy" onclick="openModal('${p.id}')">Editar</button>
        <button class="btn-dash btn-copy" onclick="delParticipantWithPass('${p.id}')" style="border-color:rgba(255,61,107,.4);color:rgba(255,61,107,.7)">Borrar</button>
      </div>
    </div>`;
  }).join('');
}

function delParticipantWithPass(id) {
  const name = allParticipants[id]?.name || 'este participante';
  mcPrompt(`Ingresá la contraseña para eliminar a <strong>${esc(name)}</strong>:`, async (pass) => {
    if (!pass) return;
    const adminPass = localState.settings?.adminPassword || ADMIN_PASS_DEFAULT;
    if (pass !== adminPass) { mcAlert('Contraseña incorrecta'); return; }
    try {
      if (firebaseOk) {
        await dbRemove(dbRef(db, `participants/${id}`));
      } else {
        delete allParticipants[id];
        saveLocal();
      }
      renderConfigParticipants();
      updateUI();
    } catch(e) { mcAlert('Error al eliminar participante.'); }
  }, 'password', 'Contraseña');
}

function nuevoEvento() {
  mcConfirm('¿Cerrar este evento e iniciar uno nuevo?<br><br>Se guardará el historial del evento actual y se limpiarán las canciones y reservas. Los participantes y sus puntos MicClub se conservan.', () => {
    mcPrompt('Ingresá la contraseña para confirmar:', async (pass) => {
      if (!pass) return;
      const adminPass = localState.settings?.adminPassword || ADMIN_PASS_DEFAULT;
      if (pass !== adminPass) { mcAlert('Contraseña incorrecta'); return; }
      await endShow();
      navBack();
    }, 'password', 'Contraseña');
  });
}

function showHistory() {
  renderHistoryPage();
  navPush('history');
}

let _historyData = {};

function renderHistoryPage() {
  const el = document.getElementById('history-list');
  if (!el) return;
  el.innerHTML = '<div style="text-align:center;color:var(--text2);padding:20px">Cargando...</div>';

  const render = (history) => {
    _historyData = history || {};
    const entries = Object.entries(_historyData).sort((a, b) => b[0] - a[0]);
    if (!entries.length) {
      el.innerHTML = '<div style="text-align:center;color:var(--text2);padding:20px">Sin eventos anteriores</div>';
      return;
    }
    el.innerHTML = entries.map(([key, h]) => {
      const ev    = h.eventInfo || {};
      const parts = Object.values(h.participants || {});
      const date  = h.closedDate || new Date(parseInt(key)).toLocaleDateString('es-AR');
      const det   = [date, ev.time, ev.venue].filter(Boolean).join(' · ');
      return `<button onclick="showHistoryDetail('${key}')" style="width:100%;text-align:left;background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:12px 14px;margin-bottom:6px;cursor:pointer;display:block">
        <div style="font-family:'Bebas Neue',sans-serif;font-size:18px;color:var(--text);letter-spacing:2px;line-height:1.1">${esc(ev.name || 'Evento sin nombre')}</div>
        <div style="font-size:11px;color:var(--text2);margin-top:3px">${esc(det)} · ${parts.length} participantes</div>
      </button>`;
    }).join('');
  };

  if (firebaseOk) {
    dbGet(dbRef(db, 'history'))
      .then(snap => render(snap.val()))
      .catch(e => {
        console.error('History load error:', e);
        el.innerHTML = '<div style="text-align:center;color:var(--red);padding:20px">Error al cargar historial. Verificá las reglas de Firebase.</div>';
      });
  } else {
    render(localState.history || {});
  }
}

function showHistoryDetail(key) {
  const h     = _historyData[key];
  if (!h) return;
  const ev    = h.eventInfo || {};
  const parts = Object.values(h.participants || {});
  const date  = h.closedDate || new Date(parseInt(key)).toLocaleDateString('es-AR');
  const det   = [date, ev.time, ev.venue].filter(Boolean).join(' · ');

  // Ranking por puntos base del evento
  const ranked = parts
    .map(p => {
      const base  = 5 + (parseInt(p.people) || 0) + (p.songConfirmed ? 3 : 0);
      const votes = (parseInt(p.voteSong) || 0) + (parseInt(p.votePerf) || 0);
      return { ...p, eventPts: base + votes };
    })
    .sort((a, b) => b.eventPts - a.eventPts);

  // Mejor Canción público
  const topSong = [...parts].sort((a, b) => (parseInt(b.voteSong) || 0) - (parseInt(a.voteSong) || 0));
  // Mejor Performance público
  const topPerf = [...parts].sort((a, b) => (parseInt(b.votePerf) || 0) - (parseInt(a.votePerf) || 0));

  const medals = ['🥇', '🥈', '🥉'];

  const rankRows = ranked.slice(0, 10).map((p, i) =>
    `<div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--border)">
      <span style="font-family:'Bebas Neue',sans-serif;font-size:20px;color:var(--text2);min-width:28px">${medals[i] || (i+1)}</span>
      <div style="flex:1;min-width:0">
        <div style="font-weight:700;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(p.name)}</div>
        ${p.songTitle ? `<div style="font-size:11px;color:var(--text2)">${esc(p.songTitle)}${p.songArtist ? ' · ' + esc(p.songArtist) : ''}</div>` : ''}
      </div>
      <span style="font-family:'Bebas Neue',sans-serif;font-size:20px;color:var(--gold)">${p.eventPts} pts</span>
    </div>`
  ).join('');

  const voteRow = (p, val, label) =>
    `<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.04);font-size:13px">
      <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1">${esc(p.name)}</span>
      <span style="color:var(--gold);font-family:'Bebas Neue',sans-serif;font-size:17px;margin-left:8px">${val} ${label}</span>
    </div>`;

  const el = document.getElementById('history-detail-content');
  if (el) {
    el.innerHTML = `
      <div style="text-align:center;padding:8px 0 14px">
        <div style="font-family:'Bebas Neue',sans-serif;font-size:28px;letter-spacing:3px;color:var(--text)">${esc(ev.name || 'Evento')}</div>
        <div style="font-size:11px;color:var(--text2);margin-top:2px">${esc(det)}</div>
      </div>

      <div style="font-size:10px;letter-spacing:2px;color:var(--text2);text-transform:uppercase;margin-bottom:8px">Ranking del evento</div>
      <div style="background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:10px 14px;margin-bottom:14px">
        ${rankRows || '<div style="color:var(--text2);font-size:13px">Sin datos</div>'}
      </div>

      <div style="font-size:10px;letter-spacing:2px;color:var(--text2);text-transform:uppercase;margin-bottom:8px">Votación del Público</div>
      <div style="background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:10px 14px;margin-bottom:14px">
        <div style="font-size:11px;color:var(--text2);margin-bottom:6px;letter-spacing:1px">MEJOR CANCIÓN</div>
        ${topSong.filter(p => (parseInt(p.voteSong)||0) > 0).slice(0,5).map(p => voteRow(p, parseInt(p.voteSong), 'votos')).join('') || '<div style="color:var(--text2);font-size:12px">Sin votos</div>'}
        <div style="font-size:11px;color:var(--text2);margin:10px 0 6px;letter-spacing:1px">MEJOR PERFORMANCE</div>
        ${topPerf.filter(p => (parseInt(p.votePerf)||0) > 0).slice(0,5).map(p => voteRow(p, parseInt(p.votePerf), 'votos')).join('') || '<div style="color:var(--text2);font-size:12px">Sin votos</div>'}
      </div>
    `;
  }
  navPush('history-detail');
}

function dashToggleShow() {
  if (showRunning) {
    mcPrompt('Ingresá la contraseña para terminar el evento:', async (pass) => {
      if (!pass) return;
      const adminPass = localState.settings?.adminPassword || ADMIN_PASS_DEFAULT;
      if (pass !== adminPass) { mcAlert('Contraseña incorrecta'); return; }
      await endShow();
    }, 'password', 'Contraseña');
  } else {
    showEventStartForm();
  }
}

function showEventStartForm() {
  const formHtml = `
    <div style="margin-bottom:12px">
      <label style="display:block;font-family:'Oswald',sans-serif;font-size:10px;letter-spacing:2px;color:var(--text2);margin-bottom:6px;text-transform:uppercase">Nombre del evento</label>
      <input id="ev-name" type="text" placeholder="Ej: Noche de Pop" style="width:100%;background:var(--bg3);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:15px;padding:12px 14px;outline:none;box-sizing:border-box">
    </div>
    <div style="margin-bottom:12px">
      <label style="display:block;font-family:'Oswald',sans-serif;font-size:10px;letter-spacing:2px;color:var(--text2);margin-bottom:6px;text-transform:uppercase">Fecha</label>
      <input id="ev-date" type="text" placeholder="Ej: 20/04/2025" style="width:100%;background:var(--bg3);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:15px;padding:12px 14px;outline:none;box-sizing:border-box">
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:4px">
      <div>
        <label style="display:block;font-family:'Oswald',sans-serif;font-size:10px;letter-spacing:2px;color:var(--text2);margin-bottom:6px;text-transform:uppercase">Hora</label>
        <input id="ev-time" type="text" placeholder="Ej: 21:00" style="width:100%;background:var(--bg3);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:15px;padding:12px 14px;outline:none;box-sizing:border-box">
      </div>
      <div>
        <label style="display:block;font-family:'Oswald',sans-serif;font-size:10px;letter-spacing:2px;color:var(--text2);margin-bottom:6px;text-transform:uppercase">Lugar</label>
        <input id="ev-venue" type="text" placeholder="Ej: El Bar" style="width:100%;background:var(--bg3);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:15px;padding:12px 14px;outline:none;box-sizing:border-box">
      </div>
    </div>`;
  showCustomModal({
    title: 'INICIAR EVENTO',
    msg: formHtml,
    okText: '▶️ INICIAR',
    cancelText: 'Cancelar',
    onOk: async () => {
      const name  = (document.getElementById('ev-name')?.value  || '').trim();
      const date  = (document.getElementById('ev-date')?.value  || '').trim();
      const time  = (document.getElementById('ev-time')?.value  || '').trim();
      const venue = (document.getElementById('ev-venue')?.value || '').trim();
      await startShow(name, date, time, venue);
    }
  });
}

async function startShow(name, date, time, venue) {
  try {
    showRunning = true;
    votingOpen  = false;
    const evData = { name, date, time, venue, startedAt: Date.now() };
    if (firebaseOk) {
      await dbUpdate(dbRef(db, 'settings'), {
        votingOpen: false, votingCloseAt: null, showRunning: true, currentEvent: evData
      });
    } else {
      localState.settings.votingOpen    = false;
      localState.settings.showRunning   = true;
      localState.settings.currentEvent  = evData;
      saveLocal();
    }
    handleVotingState();
    updateRanking();
    updateDashboard();
  } catch(e) { console.error(e); showRunning = false; updateDashboard(); }
}

function dashCopyLink(mode) {
  const urlMap = { vote: '?mode=vote', jury: '?mode=jury', ranking: '?mode=ranking', micclub: '?mode=micclub', register: '?mode=register' };
  const url = buildBaseURL() + (urlMap[mode] || ('?mode=' + mode));
  navigator.clipboard?.writeText(url)
    .then(() => mcAlert('✅ Link copiado al portapapeles'))
    .catch(() => showCustomModal({ msg: `Copiá este link:<br><br><span style="font-size:11px;word-break:break-all;color:var(--teal)">${url}</span>`, okText: 'OK' }));
}

async function saveDashEvento() {
  const inp = document.getElementById('dash-evento-input');
  const txt = inp?.value.trim() || '';
  try {
    if (firebaseOk) {
      await dbUpdate(dbRef(db, 'settings'), { nextEvent: txt });
    } else {
      if (!localState.settings) localState.settings = {};
      localState.settings.nextEvent = txt;
      saveLocal();
    }
    const el = document.getElementById('dash-evento-display');
    if (el) el.textContent = txt || '';
    if (inp) inp._dirty = false;
    mcAlert('✅ Próximo evento guardado');
  } catch(e) { console.error(e); mcAlert('Error al guardar'); }
}

function dashBorrarTodo() {
  mcPrompt('Ingresá la contraseña para borrar todo:', async (pass) => {
    if (!pass) return;
    const adminPass = localState.settings?.adminPassword || ADMIN_PASS_DEFAULT;
    if (pass !== adminPass) { mcAlert('Contraseña incorrecta'); return; }
    clearAllParticipants();
  }, 'password', 'Contraseña');
}

function updateStats() {
  const parts = sorted();
  const sp = document.getElementById('stat-p');
  const sv = document.getElementById('stat-v');
  if (sp) sp.textContent = parts.length;
  let tv = 0;
  Object.values(allParticipants).forEach(p => {
    tv += parseInt(p.voteSong) || 0;
    tv += parseInt(p.votePerf) || 0;
  });
  if (sv) sv.textContent = tv;
}

function updateLeader() {
  const parts = sorted();
  const el    = document.getElementById('leader-display');
  const hp    = document.getElementById('home-progress');
  if (!el) return;
  if (!parts.length) {
    el.innerHTML = '<div style="text-align:center;color:var(--text2);padding:16px;">Sin participantes aún</div>';
    if (hp) hp.innerHTML = '';
    return;
  }
  const L   = parts[0];
  const pct = Math.min(100, (L.score / META) * 100);
  const html = `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:11px">
      <div style="font-family:'Bebas Neue',sans-serif;font-size:44px;color:var(--gold);line-height:1">🏆</div>
      <div>
        <div style="font-family:'Oswald',sans-serif;font-weight:700;font-size:18px">${esc(L.name)}</div>
        <div style="font-size:12px;color:var(--text2)">${esc(L.song || 'Sin canción')}</div>
        <div style="font-family:'Bebas Neue',sans-serif;font-size:26px;color:var(--gold)">${L.score} pts</div>
      </div>
    </div>
    <div class="progress-wrap">
      <div class="progress-fill" style="width:${pct}%"></div>
      <div class="progress-label">${L.score} / ${META}</div>
    </div>`;
  el.innerHTML = html;
  if (hp) hp.innerHTML = html;
}

function updateRanking() {
  renderPublicVoteRanking();
  renderJuryRankingInRanking();
  renderVotingToggleBtn();
  renderRankVoteLink();
}

function renderRankVoteLink() {
  const qrContainer = document.getElementById('rank-vote-qr');
  const section     = document.getElementById('rank-qr-section');
  if (!qrContainer) return;
  if (!qrContainer._qrGenerated) {
    qrContainer.innerHTML = '';
    try {
      new QRCode(qrContainer, {
        text: buildBaseURL() + '?mode=vote',
        width: 180, height: 180,
        colorDark: '#0a0a0f', colorLight: '#ffffff'
      });
      qrContainer._qrGenerated = true;
    } catch(e) { console.warn('QR ranking:', e); }
  }
  // visibilidad controlada por handleVotingState
}

function copyRankVoteLink() {
  const url = buildBaseURL() + '?mode=vote';
  navigator.clipboard?.writeText(url)
    .then(() => mcAlert('✅ Link copiado'))
    .catch(() => mcAlert('Copiá este link:\n' + url));
}

function renderPublicVoteRanking() {
  const allParts = Object.entries(allParticipants).map(([id, p]) => ({ ...p, id })).filter(p => p.karaokeLink || p.songConfirmed);
  const medals   = ['🥇', '🥈', '🥉'];

  const renderList = (field, elId) => {
    const el = document.getElementById(elId);
    if (!el) return;
    const list = [...allParts]
      .sort((a, b) => (parseInt(b[field]) || 0) - (parseInt(a[field]) || 0))
      .filter(p => (parseInt(p[field]) || 0) > 0)
      .slice(0, 3);
    if (!list.length) {
      el.innerHTML = '<div style="color:var(--text2);font-size:11px;text-align:center;padding:10px 0">Sin votos aún</div>';
      return;
    }
    el.innerHTML = list.map((p, i) => {
      const isTop     = i < 3;
      const nameColor = isTop ? 'var(--text)'  : 'var(--text2)';
      const ptsColor  = isTop ? 'var(--gold)'  : 'var(--text2)';
      const pts       = parseInt(p[field]) || 0;
      const song      = esc(p.songTitle || p.song || '');
      return `<div style="padding:7px 0;border-bottom:1px solid rgba(255,255,255,.04)">
        <div style="display:flex;align-items:center;gap:7px">
          <div style="font-size:${isTop ? '18' : '13'}px;min-width:22px;text-align:center;line-height:1">${medals[i]}</div>
          <div style="flex:1;font-family:'Inter',sans-serif;font-weight:${isTop ? 700 : 500};font-size:13px;color:${nameColor};overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(p.name)}</div>
          <div style="font-family:'Inter',sans-serif;font-size:13px;font-weight:700;color:${ptsColor};white-space:nowrap">${pts}<span style="font-size:9px;font-weight:400;color:var(--text2)"> v</span></div>
        </div>
        ${song ? `<div style="font-size:10px;color:var(--text2);padding-left:29px;margin-top:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${song}</div>` : ''}
      </div>`;
    }).join('');
  };

  renderList('voteSong', 'rank-pub-song');
  renderList('votePerf', 'rank-pub-perf');
}

function renderJuryRankingInRanking() {
  const allParts = Object.entries(allParticipants).map(([id, p]) => ({ ...p, id }));
  const medals   = ['🥇', '🥈', '🥉'];
  [
    { cat: 'song',     elId: 'rank-jury-song',     layout: 'list' },
    { cat: 'perf',     elId: 'rank-jury-perf',     layout: 'list' },
    { cat: 'hinchada', elId: 'rank-jury-hinchada', layout: 'grid' },
  ].forEach(({ cat, elId, layout }) => {
    const el = document.getElementById(elId);
    if (!el) return;
    const list = [...allParts]
      .map(p => ({ ...p, total: getJuryTotal(p.id, cat) }))
      .sort((a, b) => b.total - a.total)
      .filter(p => p.total > 0)
      .slice(0, 3);
    if (!list.length) {
      el.innerHTML = '<div style="color:var(--text2);font-size:11px;text-align:center;padding:10px 0">Sin votos aún</div>';
      return;
    }
    if (layout === 'grid') {
      el.innerHTML = list.map((p, i) => {
        const isTop     = i < 3;
        const nameColor = isTop ? 'var(--text)'  : 'var(--text2)';
        const ptsColor  = isTop ? 'var(--gold)'  : 'var(--text2)';
        return `<div style="background:var(--bg3);border:1px solid ${isTop ? 'rgba(212,168,67,.25)' : 'var(--border)'};border-radius:8px;padding:8px 6px;text-align:center">
          <div style="font-size:${i === 0 ? '20' : '15'}px;line-height:1;margin-bottom:4px">${medals[i]}</div>
          <div style="font-family:'Inter',sans-serif;font-weight:${isTop ? 700 : 500};font-size:11px;color:${nameColor};overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(p.name)}</div>
          <div style="font-family:'Inter',sans-serif;font-size:13px;font-weight:700;color:${ptsColor};margin-top:3px">${p.total}<span style="font-size:9px;font-weight:400;color:var(--text2)"> pts</span></div>
        </div>`;
      }).join('');
    } else {
      el.innerHTML = list.map((p, i) => {
        const isTop     = i < 3;
        const nameColor = isTop ? 'var(--text)'  : 'var(--text2)';
        const ptsColor  = isTop ? 'var(--gold)'  : 'var(--text2)';
        return `<div style="padding:7px 0;border-bottom:1px solid rgba(255,255,255,.04)">
          <div style="display:flex;align-items:center;gap:7px">
            <div style="font-size:${i === 0 ? '18' : '14'}px;min-width:22px;text-align:center;line-height:1">${medals[i]}</div>
            <div style="flex:1;font-family:'Inter',sans-serif;font-weight:${isTop ? 700 : 500};font-size:13px;color:${nameColor};overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(p.name)}</div>
            <div style="font-family:'Inter',sans-serif;font-size:13px;font-weight:700;color:${ptsColor};white-space:nowrap">${p.total}<span style="font-size:9px;font-weight:400;color:var(--text2)"> pts</span></div>
          </div>
        </div>`;
      }).join('');
    }
  });
}

function updateShowMode() {
  const parts = sortedMicclub();
  const el    = document.getElementById('show-rows');
  if (!el) return;
  if (!parts.length) {
    el.innerHTML = '<div style="text-align:center;color:var(--text2);padding:32px">Esperando participantes...</div>';
    return;
  }
  const medals = ['🥇', '🥈', '🥉'];
  el.innerHTML = parts.map((p, i) => {
    const pct    = Math.min(100, (p.score / META) * 100);
    const isTop  = i < 3;
    const rank   = isTop ? medals[i] : `<span style="font-size:13px;color:var(--text2)">${i + 1}</span>`;
    const nameColor = isTop ? 'var(--text)' : 'var(--text2)';
    const ptsColor  = isTop ? 'var(--gold)' : 'var(--text2)';
    return `<div style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,.04)">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
        <div style="font-size:${isTop ? '20' : '14'}px;min-width:26px;text-align:center;line-height:1">${rank}</div>
        <div style="flex:1;font-family:'Inter',sans-serif;font-weight:${isTop ? '700' : '500'};font-size:${isTop ? '15' : '14'}px;color:${nameColor};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(p.name)}</div>
        <div style="font-family:'Inter',sans-serif;font-size:${isTop ? '17' : '15'}px;font-weight:700;color:${ptsColor};white-space:nowrap">${p.score} <span style="font-size:10px;font-weight:400;color:var(--text2)">pts</span></div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;padding-left:36px">
        <div style="flex:1;height:5px;background:var(--bg4);border-radius:99px;overflow:hidden">
          <div style="width:${pct}%;height:100%;background:${isTop ? 'linear-gradient(90deg,var(--gold-dark),var(--gold-light))' : 'rgba(160,144,112,.35)'};border-radius:99px;transition:width 1s ease"></div>
        </div>
        <span style="font-size:10px;color:var(--text2);white-space:nowrap">${META}</span>
      </div>
    </div>`;
  }).join('');
}

function updateBonusBanners() {
  ['bonus-banner-home', 'bonus-banner-rank'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = bonusActive ? 'block' : 'none';
  });
  const chk = document.getElementById('bonus-chk');
  if (chk) chk.checked = bonusActive;
  const sl = document.getElementById('bonus-slider');
  if (sl) sl.style.background = bonusActive ? 'var(--gold)' : 'var(--bg4)';
}

// ── ESTADO DE VOTACIÓN ────────────────────────────────────────────────────────
function handleVotingState() {
  const voteClosed = document.getElementById('vote-closed-banner');
  const qrSection  = document.getElementById('rank-qr-section');

  if (!votingOpen) {
    if (voteClosed) voteClosed.style.display = 'block';
    if (qrSection)  qrSection.style.display  = 'none';
    if (MODE === 'vote') {
      const voteArea = document.getElementById('vote-area');
      if (voteArea) voteArea.style.display = 'none';
    }
    renderVotingToggleBtn();
    return;
  }
  renderVotingToggleBtn();
  renderRankVoteLink();
  if (voteClosed) voteClosed.style.display = 'none';
  if (qrSection)  qrSection.style.display  = 'block';
}

// ── REGISTRO ──────────────────────────────────────────────────────────────────
function updateRegPreview() {
  const p   = parseInt(document.getElementById('r-people')?.value) || 1;
  let pts   = 5 + 3 + p;
  const d   = document.getElementById('prev-duo');
  if (d) d.style.display = 'none';
  const pl = document.getElementById('prev-ppl');
  const pp = document.getElementById('prev-pts');
  const pt = document.getElementById('prev-total');
  if (pl) pl.textContent = `Convocatoria (${p})`;
  if (pp) pp.textContent = `+${p}`;
  if (pt) pt.textContent = pts;
}

function makeCode() {
  return 'MC-' + String(Math.floor(1000 + Math.random() * 9000));
}

// ── REGISTRO CON EMAIL COMO IDENTIFICADOR ────────────────────────────────────
let _pendingEmail = null;   // email validado, aún sin perfil en DB

// Paso A: el usuario ingresa su email y pulsa Continuar
async function checkEmail() {
  const email = (document.getElementById('r-email').value || '').trim().toLowerCase();
  const errEl = document.getElementById('reg-err');
  const confirmEl = document.getElementById('reg-email-confirm');

  errEl.style.display     = 'none';
  confirmEl.style.display = 'none';

  if (!email) { showErr('reg-err', 'Ingresá tu email'); return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showErr('reg-err', 'Ingresá un email válido'); return; }

  const btn = document.getElementById('reg-email-btn');
  btn.innerHTML = '<span class="spinner"></span> BUSCANDO...';
  btn.disabled  = true;

  // Buscar email en la base
  let found = Object.entries(allParticipants).find(([, p]) => (p.email || '').toLowerCase() === email);
  if (!found && firebaseOk) {
    try {
      const snap = await dbGet(dbRef(db, 'participants'));
      const all  = snap.val() || {};
      found = Object.entries(all).find(([, p]) => (p.email || '').toLowerCase() === email);
    } catch(e) {}
  }

  btn.innerHTML = '🔍 BUSCAR / CONTINUAR';
  btn.disabled  = false;

  if (found) {
    // Email encontrado → mostrar perfil
    currentPId = found[0];
    showProfileView(currentPId, found[1]);
    return;
  }

  // Email no encontrado → preguntar si crear nuevo
  _pendingEmail = email;
  document.getElementById('reg-email-confirm-msg').textContent =
    `El email "${email}" no está registrado. ¿Querés crear un nuevo usuario?`;
  confirmEl.style.display = 'block';
}

function cancelEmailConfirm() {
  document.getElementById('reg-email-confirm').style.display = 'none';
  _pendingEmail = null;
  document.getElementById('r-email').focus();
}

// Paso A→B: usuario confirmó que quiere crear cuenta nueva
function showRegistrationForm() {
  document.getElementById('reg-email-confirm').style.display = 'none';
  document.getElementById('reg-email-gate').style.display    = 'none';
  document.getElementById('reg-main-form').style.display     = 'block';
  // Personas en reserva solo se carga cuando hay evento activo
  const peopleRow = document.getElementById('r-people-row');
  if (peopleRow) peopleRow.style.display = showRunning ? '' : 'none';
  document.getElementById('r-name').focus();
  updateRegPreview();
}

// Paso B: completa el formulario y confirma
async function createNewUser() {
  const email = _pendingEmail;
  if (!email) { showErr('reg-form-err', 'Sesión expirada, recargá la página.'); return; }

  const name = document.getElementById('r-name').value.trim();
  const wa   = document.getElementById('r-wa').value.trim();
  const ppl  = showRunning ? (parseInt(document.getElementById('r-people').value) || 1) : 0;
  const ref  = document.getElementById('r-ref').value.trim();

  if (!name) { showErr('reg-form-err', 'Escribí tu nombre'); return; }
  if (!wa)   { showErr('reg-form-err', 'El WhatsApp es obligatorio'); return; }

  const btn = document.getElementById('reg-btn');
  btn.innerHTML = '<span class="spinner"></span> CREANDO...';
  btn.disabled  = true;

  const participant = {
    name, people: ppl, whatsapp: wa, email, referrer: ref,
    song: '', songTitle: '', songArtist: '', karaokeLink: '', songConfirmed: false,
    timestamp: Date.now(),
    prizeSong: false, prizePerf: false, prizeHinchada: false, prizePublicoSong: false, prizePublicoPerf: false,
    juryScoresSong: {}, juryScoresPerf: {}, juryScoresHinchada: {}, juryScoresPublico: {},
    extraPts: 0, voteSong: 0, votePerf: 0, micclubPts: 0
  };

  try {
    if (firebaseOk) {
      const nr = dbPush(dbRef(db, 'participants'));
      await dbSet(nr, participant);
      currentPId = nr.key;
    } else {
      currentPId = 'p_' + Date.now();
      allParticipants[currentPId] = participant;
      saveLocal();
    }
    _pendingEmail = null;
    // Bonus por referido: si el campo referido contiene un email registrado, +10 pts al referidor (una sola vez)
    const referrerEntry = findReferrer(ref);
    if (referrerEntry) {
      const [rId, rp] = referrerEntry;
      const newMicPts = (parseInt(rp.micclubPts) || 0) + 5;
      if (firebaseOk) {
        dbUpdate(dbRef(db, `participants/${rId}`), { micclubPts: newMicPts });
      } else {
        if (allParticipants[rId]) allParticipants[rId].micclubPts = newMicPts;
      }
    }
    document.getElementById('reg-main-form').style.display = 'none';
    showProfileView(currentPId, participant);
    updateUI();
  } catch(e) {
    const msg = e?.message || e?.code || 'Intentá de nuevo';
    showErr('reg-form-err', `Error al registrar: ${msg}`);
    console.error('createNewUser error:', e);
    btn.innerHTML = '🎙️ CONFIRMAR';
    btn.disabled  = false;
  }
}

// submitReservation alias seguro
function submitReservation() { checkEmail(); }

// ── VISTA DE PERFIL ───────────────────────────────────────────────────────────
function resetRegisterPage() {
  currentPId = null;
  const gate = document.getElementById('reg-email-gate');
  const form = document.getElementById('reg-main-form');
  const prof = document.getElementById('reg-profile');
  if (gate) gate.style.display = 'block';
  if (form) form.style.display = 'none';
  if (prof) prof.style.display = 'none';
  const emailInput   = document.getElementById('r-email');
  const emailConfirm = document.getElementById('reg-email-confirm');
  if (emailInput)   emailInput.value        = '';
  if (emailConfirm) emailConfirm.style.display = 'none';
  // Limpiar formulario de nuevo usuario y restaurar botón
  const rName   = document.getElementById('r-name');
  const rWa     = document.getElementById('r-wa');
  const rRef    = document.getElementById('r-ref');
  const rPeople = document.getElementById('r-people');
  const regBtn  = document.getElementById('reg-btn');
  if (rName)   rName.value   = '';
  if (rWa)     rWa.value     = '';
  if (rRef)    rRef.value    = '';
  if (rPeople) rPeople.value = '';
  if (regBtn)  { regBtn.innerHTML = '🎙️ CONFIRMAR'; regBtn.disabled = false; }
  const regErr = document.getElementById('reg-form-err');
  if (regErr) regErr.style.display = 'none';
  // Limpiar campos de evento
  const ppi = document.getElementById('prof-people-input');
  const ti  = document.getElementById('s-title');
  const ai  = document.getElementById('s-artist');
  const li  = document.getElementById('s-link');
  if (ppi) ppi.value = '';
  if (ti)  ti.value  = '';
  if (ai)  ai.value  = '';
  if (li)  li.value  = '';
  const peopleCheck = document.getElementById('people-check');
  const songCheck   = document.getElementById('song-saved-check');
  if (peopleCheck) peopleCheck.style.display = 'none';
  if (songCheck)   songCheck.style.display   = 'none';
}

function showProfileView(id, p) {
  currentPId = id;
  document.getElementById('reg-email-gate').style.display = 'none';
  document.getElementById('reg-main-form').style.display  = 'none';
  const prof = document.getElementById('reg-profile');
  if (!prof) return;
  prof.style.display = 'block';

  // Título dinámico con nombre del evento
  const ce    = localState.settings?.currentEvent;
  const subEl = document.getElementById('register-page-sub');
  if (subEl) subEl.textContent = showRunning && ce?.name ? `Para ${ce.name}` : 'Tu perfil · Canción · Puntos';

  // Perfil — inputs inline siempre visibles
  const emailEl = document.getElementById('prof-email');
  if (emailEl) emailEl.textContent = p.email || '';
  const ni  = document.getElementById('prof-name-input');
  const phi = document.getElementById('prof-phone-input');
  const ppi = document.getElementById('prof-people-input');
  if (ni)  ni.value  = p.name     || '';
  if (phi) phi.value = p.whatsapp || '';
  const peopleRow = document.getElementById('prof-people-display-row');
  if (peopleRow) peopleRow.style.display = showRunning ? '' : 'none';
  if (ppi) {
    ppi.value    = showRunning && (parseInt(p.people) || 0) > 0 ? String(p.people) : '';
    ppi.disabled = !showRunning;
  }

  // Sección evento (personas + canción)
  const eventSection = document.getElementById('prof-event-section');
  if (eventSection) eventSection.style.display = showRunning ? 'block' : 'none';

  if (showRunning) {
    const ppi = document.getElementById('prof-people-input');
    const ti  = document.getElementById('s-title');
    const ai  = document.getElementById('s-artist');
    const li  = document.getElementById('s-link');
    if (ppi) ppi.value = (parseInt(p.people) || 0) > 0 ? String(p.people) : '';
    if (ti)  ti.value  = p.songTitle   || '';
    if (ai)  ai.value  = p.songArtist  || '';
    if (li)  li.value  = p.karaokeLink || '';
    updatePeopleCheck();
    updateSongCheck();
  }

  // Botón guardar
  const confirmBtn = document.getElementById('confirm-all-btn');
  const errEl      = document.getElementById('confirm-all-err');
  if (confirmBtn) { confirmBtn.innerHTML = '💾 GUARDAR Y SALIR'; confirmBtn.disabled = false; }
  if (errEl)      errEl.style.display = 'none';

  window.scrollTo(0, 0);
}

// Guarda nombre, WhatsApp y personas al perder el foco de cualquier campo de perfil
async function saveProfileField() {
  if (!currentPId) return;
  const name  = document.getElementById('prof-name-input')?.value.trim() || '';
  const phone = document.getElementById('prof-phone-input')?.value.trim() || '';
  if (!name) return;
  const updates = { name, whatsapp: phone };
  if (showRunning) {
    const ppl = parseInt(document.getElementById('prof-people-input')?.value) || 0;
    if (ppl > 0) updates.people = ppl;
  }
  try {
    if (firebaseOk) {
      await dbUpdate(dbRef(db, `participants/${currentPId}`), updates);
    } else {
      Object.assign(allParticipants[currentPId], updates);
      saveLocal();
    }
    if (allParticipants[currentPId]) Object.assign(allParticipants[currentPId], updates);
  } catch(e) { console.error('saveProfileField:', e); }
}

// ── VOTACIÓN PÚBLICA ─────────────────────────────────────────────────────────
function resetVoteForTesting() {
  localStorage.removeItem('voted_public');
  const voteArea = document.getElementById('vote-area');
  const voteDone = document.getElementById('vote-done');
  const container = document.getElementById('vote-cards-container');
  if (voteDone) { voteDone.style.display = 'none'; voteDone.textContent = ''; }
  if (voteArea) voteArea.style.display = 'block';
  if (container) container.innerHTML = '';
  loadPublicVoteOpts();
}

function loadPublicVoteOpts() {
  if (localStorage.getItem('voted_public')) {
    const voteArea = document.getElementById('vote-area');
    const voteDone = document.getElementById('vote-done');
    if (voteArea) voteArea.style.display = 'none';
    if (voteDone) { voteDone.style.display = 'block'; voteDone.innerHTML = '✅ ¡Ya votaste! Tu voto fue registrado. Gracias por participar. 🎤'; }
    return;
  }
  if (!votingOpen) {
    const voteArea   = document.getElementById('vote-area');
    const voteClosed = document.getElementById('vote-closed-banner');
    if (voteArea)   voteArea.style.display   = 'none';
    if (voteClosed) voteClosed.style.display = 'block';
    return;
  }

  const parts = sorted().filter(p => p.songConfirmed);
  const el    = document.getElementById('vote-cards-container');
  if (!el) return;

  // Si ya hay filas renderizadas, no re-renderizar para conservar estado.
  if (el.querySelector('.vote-row')) return;

  if (!parts.length) {
    el.innerHTML = '<div style="color:var(--text2);padding:16px;text-align:center">No hay participantes registrados aún</div>';
    return;
  }

  el.innerHTML = parts.map(p => {
    const song   = p.songTitle || p.song || '';
    const artist = p.songArtist || '';
    const detail = [song, artist].filter(Boolean).join(' · ');
    return `<div class="vote-row">
      <div class="vote-row-info">
        <div class="vote-row-name">${esc(p.name)}</div>
        ${detail ? `<div class="vote-row-song">${esc(detail)}</div>` : ''}
      </div>
      <div class="vote-row-btns">
        <button class="vote-pill" id="vb-song-${p.id}" onclick="toggleVoteBtn('song','${p.id}')">Mejor Canción</button>
        <button class="vote-pill" id="vb-perf-${p.id}" onclick="toggleVoteBtn('perf','${p.id}')">Mejor Performance</button>
      </div>
    </div>`;
  }).join('');
}

function toggleVoteBtn(type, pid) {
  const btn = document.getElementById(`vb-${type}-${pid}`);
  if (!btn) return;
  btn.classList.toggle('selected');
}

async function submitPublicVote() {
  if (localStorage.getItem('voted_public')) return;
  if (!votingOpen) { mcAlert('La votación está cerrada.'); return; }

  const songVotes = [...document.querySelectorAll('.vote-pill.selected[id^="vb-song-"]')].map(b => b.id.replace('vb-song-', ''));
  const perfVotes = [...document.querySelectorAll('.vote-pill.selected[id^="vb-perf-"]')].map(b => b.id.replace('vb-perf-', ''));

  if (!songVotes.length && !perfVotes.length) {
    mcAlert('Seleccioná al menos una opción para votar.');
    return;
  }

  const btn = document.getElementById('vote-btn');
  btn.innerHTML = '<span class="spinner"></span>';
  btn.disabled  = true;

  try {
    if (firebaseOk) {
      const updates = {};
      songVotes.forEach(pid => {
        if (allParticipants[pid]) {
          const cur = updates[`participants/${pid}/voteSong`] ?? (parseInt(allParticipants[pid].voteSong) || 0);
          updates[`participants/${pid}/voteSong`] = cur + 1;
        }
      });
      perfVotes.forEach(pid => {
        if (allParticipants[pid]) {
          const cur = updates[`participants/${pid}/votePerf`] ?? (parseInt(allParticipants[pid].votePerf) || 0);
          updates[`participants/${pid}/votePerf`] = cur + 1;
        }
      });
      if (Object.keys(updates).length) await dbUpdate(dbRef(db), updates);
    } else {
      songVotes.forEach(pid => { if (allParticipants[pid]) allParticipants[pid].voteSong = (parseInt(allParticipants[pid].voteSong) || 0) + 1; });
      perfVotes.forEach(pid => { if (allParticipants[pid]) allParticipants[pid].votePerf = (parseInt(allParticipants[pid].votePerf) || 0) + 1; });
      saveLocal();
    }
    localStorage.setItem('voted_public', '1');
    document.getElementById('vote-done').style.display = 'block';
    document.getElementById('vote-area').style.display  = 'none';
  } catch(e) {
    console.error(e);
    mcAlert('Error al enviar el voto. Intentá de nuevo.');
    btn.innerHTML = '✅ ENVIAR VOTOS';
    btn.disabled  = false;
    return;
  }

  btn.innerHTML = '✅ ENVIAR VOTOS';
  btn.disabled  = false;
}

// ── JURADO ────────────────────────────────────────────────────────────────────
let modalParticipantId = null;

function setJuryCat(cat) {
  juryCat = cat;
  renderJurySelectors();
}

function renderJurySelectors() {
  const hdr = document.getElementById('jury-page-header');
  const el  = document.getElementById('jury-select-grid');

  // Sin evento activo — bloquear todo
  if (!showRunning) {
    if (hdr) hdr.innerHTML = `
      <div style="font-family:'Bebas Neue',sans-serif;font-size:clamp(30px,9vw,52px);letter-spacing:4px;line-height:1;background:linear-gradient(135deg,var(--gold-light) 0%,var(--gold) 50%,var(--gold-dark) 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text">JURADO</div>
      <div style="font-family:'Inter',sans-serif;font-size:10px;font-weight:400;letter-spacing:3px;text-transform:uppercase;color:var(--text2);margin-top:6px">Votación del Jurado</div>`;
    if (el) el.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px 20px;color:var(--text2)">
      <div style="font-size:32px;margin-bottom:12px">🎬</div>
      <div style="font-family:'Oswald',sans-serif;font-size:16px;letter-spacing:1px;color:var(--text)">No hay evento activo</div>
      <div style="font-size:12px;margin-top:6px">La votación del jurado estará disponible cuando se inicie un evento.</div>
    </div>`;
    return;
  }

  // Encabezado dinámico con datos del evento
  if (hdr) {
    const ce  = localState.settings?.currentEvent;
    const det = ce ? [ce.date, ce.time, ce.venue].filter(Boolean).join(' · ') : '';
    hdr.innerHTML = ce && ce.name
      ? `<div style="font-family:'Bebas Neue',sans-serif;font-size:clamp(30px,9vw,52px);letter-spacing:4px;line-height:1;background:linear-gradient(135deg,var(--gold-light) 0%,var(--gold) 50%,var(--gold-dark) 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text">${esc(ce.name)}</div>
         ${det ? `<div style="font-size:11px;color:var(--text2);margin-top:4px;letter-spacing:1px">${esc(det)}</div>` : ''}
         <div style="font-family:'Inter',sans-serif;font-size:10px;font-weight:400;letter-spacing:3px;text-transform:uppercase;color:var(--text2);margin-top:8px">Votación del Jurado</div>`
      : `<div style="font-family:'Bebas Neue',sans-serif;font-size:clamp(30px,9vw,52px);letter-spacing:4px;line-height:1;background:linear-gradient(135deg,var(--gold-light) 0%,var(--gold) 50%,var(--gold-dark) 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text">JURADO</div>
         <div style="font-family:'Inter',sans-serif;font-size:10px;font-weight:400;letter-spacing:3px;text-transform:uppercase;color:var(--text2);margin-top:6px">Votación del Jurado</div>`;
  }

  // Lista de participantes — solo los que tienen canción confirmada para este evento
  const parts = sorted().filter(p => p.songConfirmed);
  if (!el) return;
  if (!parts.length) {
    el.innerHTML = '<div style="color:var(--text2);grid-column:1/-1;padding:12px;text-align:center;font-size:13px">Sin participantes con canción cargada</div>';
    return;
  }
  el.innerHTML = parts.map(p => {
    const scored = !!(
      (p.juryScoresSong     || {})[JURY_ID] ||
      (p.juryScoresPerf     || {})[JURY_ID] ||
      (p.juryScoresHinchada || {})[JURY_ID]
    );
    const song   = p.songTitle || p.song || '';
    const artist = p.songArtist ? ` · ${esc(p.songArtist)}` : '';
    return `<button class="jury-sel-btn ${scored ? 'scored' : ''}" onclick="selectJuryParticipant('${p.id}')">
      <div class="jury-sel-name">${esc(p.name)}${scored ? ' <span style="color:#00c864;font-size:12px">✓</span>' : ''}</div>
      ${song ? `<div class="jury-sel-song">${esc(song)}${artist}</div>` : ''}
    </button>`;
  }).join('');
}

function selectJuryParticipant(id) {
  const p = allParticipants[id];
  if (!p) return;
  openJuryModal(id);
}

function openJuryModal(id) {
  const p = allParticipants[id];
  if (!p) return;
  modalParticipantId = id;

  // Cargar puntajes previos de este jurado (si ya votó) o resetear
  const prevSong     = (p.juryScoresSong     || {})[JURY_ID] || {};
  const prevPerf     = (p.juryScoresPerf     || {})[JURY_ID] || {};
  const prevHinchada = (p.juryScoresHinchada || {})[JURY_ID] || {};
  SONG_CRITERIA.forEach(c => { juryCurrentScores.song[c.key]     = parseInt(prevSong[c.key])     || 0; });
  PERF_CRITERIA.forEach(c => { juryCurrentScores.perf[c.key]     = parseInt(prevPerf[c.key])     || 0; });
  HINCHADA_CRITERIA.forEach(c => { juryCurrentScores.hinchada[c.key] = parseInt(prevHinchada[c.key]) || 0; });

  const nameEl = document.getElementById('jury-modal-participant-name');
  if (nameEl) nameEl.innerHTML = `<span style="font-weight:700">${esc(p.name)}</span><span style="font-size:12px;color:var(--text2);margin-left:8px;font-weight:400">${esc(p.songTitle || p.song || '')}</span>`;

  const okEl = document.getElementById('jury-modal-ok');
  if (okEl) { okEl.style.display = 'none'; okEl.textContent = ''; }

  renderScoringPanel('song');
  renderScoringPanel('perf');
  renderScoringPanel('hinchada');
  updateJuryConfirmBtn();

  document.getElementById('jury-score-modal').classList.add('open');
}

function closeJuryModal() {
  document.getElementById('jury-score-modal').classList.remove('open');
  modalParticipantId = null;
}

async function confirmJuryModal() {
  if (!modalParticipantId) return;
  await submitAllJuryCategories(modalParticipantId);
}

function renderScoringPanel(cat) {
  const criteria = cat === 'song' ? SONG_CRITERIA : cat === 'perf' ? PERF_CRITERIA : HINCHADA_CRITERIA;
  const scores   = juryCurrentScores[cat];
  const el       = document.getElementById(`jury-modal-${cat}-criteria`);
  if (!el) return;

  el.innerHTML = criteria.map(c => {
    const val  = scores[c.key] || 0;
    const btns = [1,2,3,4,5].map(n =>
      `<button class="score-btn ${val === n ? 'active' : ''}" onclick="updateCriteriaScore('${cat}','${c.key}',${n})">${n}</button>`
    ).join('');
    return `<div class="criteria-inline" id="criteria-wrap-${cat}-${c.key}">
      <span class="criteria-name">${c.label}</span>
      <div class="score-btns">${btns}</div>
    </div>`; // score-val hidden: total shown in section label
  }).join('');

  updateJuryCatTotal(cat);
}

function renderSimpleScoring(cat) {
  const el  = document.getElementById(`jury-modal-${cat}-inner`);
  if (!el) return;
  const val = parseInt(juryCurrentScores[cat]) || 0;
  el.innerHTML = [1,2,3,4,5].map(n =>
    `<button class="score-btn ${val === n ? 'active' : ''}" id="sbtn-${cat}-${n}" onclick="updateSimpleScore('${cat}',${n})">${n}</button>`
  ).join('');
  updateJuryCatTotal(cat);
}

function updateCriteriaScore(cat, key, value) {
  const val  = parseInt(value);
  juryCurrentScores[cat][key] = val;
  const wrap = document.getElementById(`criteria-wrap-${cat}-${key}`);
  if (wrap) wrap.querySelectorAll('.score-btn').forEach(b => b.classList.toggle('active', parseInt(b.textContent) === val));
  updateJuryCatTotal(cat);
  updateJuryConfirmBtn();
}

function updateSimpleScore(cat, value) {
  const val = parseInt(value);
  juryCurrentScores[cat] = val;
  [1,2,3,4,5].forEach(n => {
    const b = document.getElementById(`sbtn-${cat}-${n}`);
    if (b) b.classList.toggle('active', n === val);
  });
  updateJuryCatTotal(cat);
  updateJuryConfirmBtn();
}

function updateJuryCatTotal(cat) {
  const scores = juryCurrentScores[cat];
  const total  = typeof scores === 'object'
    ? Object.values(scores).reduce((a, v) => a + (parseInt(v) || 0), 0)
    : (parseInt(scores) || 0);
  const el = document.getElementById(`jury-modal-${cat}-total`);
  if (el) el.textContent = total;
}

// Alias mantenido por si algún path antiguo lo llama
function updateJuryTotal(cat) { updateJuryCatTotal(cat); }

function updateJuryConfirmBtn() {
  const btn = document.getElementById('jury-modal-confirm-btn');
  if (!btn) return;
  const songValid = SONG_CRITERIA.every(c => (parseInt(juryCurrentScores.song[c.key]) || 0) > 0);
  const perfValid = PERF_CRITERIA.every(c => (parseInt(juryCurrentScores.perf[c.key]) || 0) > 0);
  const hValid    = HINCHADA_CRITERIA.every(c => (parseInt(juryCurrentScores.hinchada[c.key]) || 0) > 0);
  const valid     = songValid && perfValid && hValid;
  btn.disabled      = !valid;
  btn.style.opacity = valid ? '1' : '0.4';
}

async function submitAllJuryCategories(id) {
  if (!id) return;
  const btn = document.getElementById('jury-modal-confirm-btn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>'; }

  try {
    if (firebaseOk) {
      const update = {};
      // Canción
      Object.entries(juryCurrentScores.song).forEach(([k, v]) => {
        update[`juryScoresSong/${JURY_ID}/${k}`] = v;
      });
      // Performance
      Object.entries(juryCurrentScores.perf).forEach(([k, v]) => {
        update[`juryScoresPerf/${JURY_ID}/${k}`] = v;
      });
      // Hinchada
      Object.entries(juryCurrentScores.hinchada).forEach(([k, v]) => {
        update[`juryScoresHinchada/${JURY_ID}/${k}`] = v;
      });
      await dbUpdate(dbRef(db, `participants/${id}`), update);
    } else {
      const p = allParticipants[id];
      if (!p.juryScoresSong)     p.juryScoresSong     = {};
      if (!p.juryScoresPerf)     p.juryScoresPerf     = {};
      if (!p.juryScoresHinchada) p.juryScoresHinchada = {};
      p.juryScoresSong[JURY_ID]     = { ...juryCurrentScores.song };
      p.juryScoresPerf[JURY_ID]     = { ...juryCurrentScores.perf };
      p.juryScoresHinchada[JURY_ID] = { ...juryCurrentScores.hinchada };
      saveLocal();
    }
  } catch(e) {
    console.error(e);
    if (btn) { btn.disabled = false; btn.innerHTML = '⭐ CONFIRMAR TODO'; }
    return;
  }

  // Marcar todos los campos como "votados" para este participante
  ['song', 'perf', 'hinchada'].forEach(cat => { jurySelectedId[cat] = id; });


  if (btn) { btn.innerHTML = 'CONFIRMAR'; btn.disabled = false; }
  setTimeout(() => closeJuryModal(), 400);
  renderJurySelectors();
  updateUI();
}

// Mantener compatibilidad si algo llama submitJuryCategory
function submitJuryCategory() {
  if (modalParticipantId) submitAllJuryCategories(modalParticipantId);
}

function renderJuryLB() {
  const parts = sorted().filter(p => p.karaokeLink || p.songConfirmed);
  [
    { cat: 'song',     elId: 'jury-lb-song-rows'     },
    { cat: 'perf',     elId: 'jury-lb-perf-rows'     },
    { cat: 'hinchada', elId: 'jury-lb-hinchada-rows' },
  ].forEach(({ cat, elId }) => {
    const el = document.getElementById(elId);
    if (!el) return;
    const rows = parts
      .map(p => ({ name: p.name, id: p.id, total: getJuryTotal(p.id, cat) }))
      .sort((a, b) => b.total - a.total);
    if (!rows.length) { el.innerHTML = '<div style="color:var(--text2);font-size:12px;padding:8px">Sin datos aún</div>'; return; }
    el.innerHTML = rows.map((r, i) => `
      <div class="jury-lb-row ${i === 0 && r.total > 0 ? 'leader' : ''}">
        <div class="jury-lb-pos">${i + 1}</div>
        <div class="jury-lb-info"><div class="jury-lb-name">${esc(r.name)}</div></div>
        <div class="jury-lb-pts">${r.total}</div>
        ${i === 0 && r.total > 0 ? '<span class="badge badge-gold">LÍDER</span>' : ''}
      </div>`).join('');
  });
}

// ── ADMIN ─────────────────────────────────────────────────────────────────────
function doAdminLogin() {
  const pass   = document.getElementById('admin-pass').value;
  const stored = localState.settings?.adminPassword || ADMIN_PASS_DEFAULT;
  if (pass === stored) {
    adminLoggedIn = true;
    document.getElementById('admin-login').style.display = 'none';
    document.getElementById('admin-panel').style.display  = 'block';
    renderAdminParticipants();
    renderAdminJury();
    renderLinks();
  } else {
    const e = document.getElementById('admin-err');
    e.style.display = 'block';
    setTimeout(() => e.style.display = 'none', 3000);
  }
}

function changePass() {
  const np = document.getElementById('new-pass').value.trim();
  if (!np) return;
  if (firebaseOk) dbUpdate(dbRef(db, 'settings'), { adminPassword: np });
  localState.settings.adminPassword = np;
  localStorage.setItem('micclub_data', JSON.stringify(localState));
  mcAlert('✅ Contraseña actualizada');
}

let adminTab = 'ctrl';
function setAdminTab(tab) {
  adminTab = tab;
  ['ctrl', 'parts', 'jury', 'links'].forEach(t => {
    const btn = document.getElementById(`atab-${t}-btn`);
    if (btn) btn.classList.toggle('active', t === tab);
    const el = document.getElementById(`atab-${t}`);
    if (el) el.style.display = t === tab ? 'block' : 'none';
  });
  if (tab === 'parts') renderAdminParticipants();
  if (tab === 'jury')  renderAdminJury();
  if (tab === 'links') renderLinks();
}

async function toggleBonus(val) {
  bonusActive = val;
  if (firebaseOk) {
    await dbUpdate(dbRef(db, 'settings'), { bonus: val });
  } else {
    localState.settings.bonus = val;
    saveLocal();
  }
  updateBonusBanners();
  updateUI();
}

function renderVotingToggleBtn() {
  // Botón config
  const cfgBtn = document.getElementById('config-vote-toggle-btn');
  if (cfgBtn) {
    if (votingOpen) {
      cfgBtn.textContent = 'CERRAR VOTACIÓN';
      cfgBtn.className   = 'btn btn-danger btn-sm';
    } else {
      cfgBtn.textContent = 'ABRIR VOTACIÓN';
      cfgBtn.className   = 'btn btn-teal btn-sm';
    }
  }
  // Botón del dashboard
  const dashBtn = document.getElementById('dash-vote-toggle-btn');
  if (dashBtn) {
    if (showRunning) {
      dashBtn.style.opacity       = '1';
      dashBtn.style.pointerEvents = 'auto';
      if (votingOpen) {
        dashBtn.textContent      = 'CERRAR VOTACIÓN';
        dashBtn.style.background = 'linear-gradient(135deg,#aa3d50,#7a2535)';
        dashBtn.style.color      = '#fff';
      } else {
        dashBtn.textContent      = 'ABRIR VOTACIÓN';
        dashBtn.style.background = 'linear-gradient(135deg,#4d9e6a,#2d6642)';
        dashBtn.style.color      = '#0a0a0f';
      }
    } else {
      dashBtn.textContent         = 'ABRIR VOTACIÓN';
      dashBtn.style.background    = 'linear-gradient(135deg,#1a3324,#101e16)';
      dashBtn.style.color         = '#3a6648';
      dashBtn.style.opacity       = '0.55';
      dashBtn.style.pointerEvents = 'none';
    }
  }
}

function toggleVoting() {
  if (votingOpen) { closeVoting(); } else { openVoting(); }
}

async function openVoting() {
  try {
    if (firebaseOk) {
      await dbUpdate(dbRef(db, 'settings'), { votingOpen: true, votingCloseAt: null });
    } else {
      localState.settings.votingOpen    = true;
      localState.settings.votingCloseAt = null;
      saveLocal();
    }
    votingOpen = true;
    handleVotingState();
    updateRanking();
  } catch(e) { console.error(e); }
}

function closeVoting() {
  mcConfirm('¿Cerrar la votación del público?', async () => {
    try { await finalizeVoting(); } catch(e) { console.error(e); }
  });
}

async function finalizeVoting() {
  const parts      = Object.entries(allParticipants).map(([id, p]) => ({ ...p, id }));
  const songLeader = [...parts].sort((a, b) => (parseInt(b.voteSong) || 0) - (parseInt(a.voteSong) || 0))[0];
  const perfLeader = [...parts].sort((a, b) => (parseInt(b.votePerf) || 0) - (parseInt(a.votePerf) || 0))[0];
  const updates    = { 'settings/votingOpen': false, 'settings/votingCloseAt': null };

  // Marcar ganadores con flag y resetear votos para que endShow no duplique
  Object.keys(allParticipants).forEach(id => {
    updates[`participants/${id}/voteSong`] = 0;
    updates[`participants/${id}/votePerf`] = 0;
    updates[`participants/${id}/prizePublicoSong`] = false;
    updates[`participants/${id}/prizePublicoPerf`] = false;
  });
  if (songLeader && (parseInt(songLeader.voteSong) || 0) > 0) {
    updates[`participants/${songLeader.id}/prizePublicoSong`] = true;
  }
  if (perfLeader && (parseInt(perfLeader.votePerf) || 0) > 0) {
    updates[`participants/${perfLeader.id}/prizePublicoPerf`] = true;
  }

  try {
    if (firebaseOk) {
      await dbUpdate(dbRef(db), updates);
    } else {
      localState.settings.votingOpen    = false;
      localState.settings.votingCloseAt = null;
      votingOpen = false;
      Object.keys(allParticipants).forEach(id => {
        allParticipants[id].voteSong = 0;
        allParticipants[id].votePerf = 0;
        allParticipants[id].prizePublicoSong = false;
        allParticipants[id].prizePublicoPerf = false;
      });
      if (songLeader && (parseInt(songLeader.voteSong) || 0) > 0)
        allParticipants[songLeader.id].prizePublicoSong = true;
      if (perfLeader && (parseInt(perfLeader.votePerf) || 0) > 0)
        allParticipants[perfLeader.id].prizePublicoPerf = true;
      saveLocal();
    }
  } catch(e) { console.error(e); }
}

function resetEvent() {
  mcConfirm('¿Resetear el evento?\n\n• Se borran votos del público y puntajes del jurado\n• Se borran las canciones confirmadas (los participantes podrán inscribir nuevas)\n• Los puntos MicClub acumulados se mantienen', async () => {
    try {
      const updates = { 'settings/votingOpen': true, 'settings/votingCloseAt': null };
      Object.keys(allParticipants).forEach(id => {
        updates[`participants/${id}/voteSong`]           = 0;
        updates[`participants/${id}/votePerf`]           = 0;
        updates[`participants/${id}/juryScoresSong`]     = {};
        updates[`participants/${id}/juryScoresPerf`]     = {};
        updates[`participants/${id}/juryScoresHinchada`] = {};
        updates[`participants/${id}/juryScoresPublico`]  = {};
        updates[`participants/${id}/songConfirmed`]      = false;
        updates[`participants/${id}/songTitle`]          = '';
        updates[`participants/${id}/songArtist`]         = '';
        updates[`participants/${id}/song`]               = '';
        updates[`participants/${id}/karaokeLink`]        = '';
        updates[`participants/${id}/prizeSong`]          = false;
        updates[`participants/${id}/prizePerf`]          = false;
        updates[`participants/${id}/prizeHinchada`]      = false;
        updates[`participants/${id}/prizePublicoSong`]   = false;
        updates[`participants/${id}/prizePublicoPerf`]   = false;
      });
      if (firebaseOk) {
        await dbUpdate(dbRef(db), updates);
      } else {
        Object.keys(allParticipants).forEach(id => {
          allParticipants[id].voteSong           = 0;
          allParticipants[id].votePerf           = 0;
          allParticipants[id].juryScoresSong     = {};
          allParticipants[id].juryScoresPerf     = {};
          allParticipants[id].juryScoresHinchada = {};
          allParticipants[id].juryScoresPublico  = {};
          allParticipants[id].songConfirmed      = false;
          allParticipants[id].songTitle          = '';
          allParticipants[id].songArtist         = '';
          allParticipants[id].song               = '';
          allParticipants[id].karaokeLink        = '';
          allParticipants[id].prizeSong          = false;
          allParticipants[id].prizePerf          = false;
          allParticipants[id].prizeHinchada      = false;
          allParticipants[id].prizePublicoSong   = false;
          allParticipants[id].prizePublicoPerf   = false;
        });
        localState.settings.votingOpen    = true;
        localState.settings.votingCloseAt = null;
        saveLocal();
      }
      votingOpen = true;
      mcAlert('✅ Evento reseteado. Los participantes ya pueden inscribir nuevas canciones.');
      updateUI();
    } catch(e) { console.error(e); mcAlert('Error al resetear.'); }
  });
}

async function adminAddParticipant() {
  const name = document.getElementById('a-name').value.trim();
  const ppl  = parseInt(document.getElementById('a-ppl').value) || 1;
  const wa   = document.getElementById('a-wa').value.trim();
  if (!name) { mcAlert('El nombre es obligatorio'); return; }

  const code  = makeCode();
  const sLink = buildBaseURL() + `?mode=register&code=${code}`;
  const p = {
    name, people: ppl, whatsapp: wa, email: '', referrer: '',
    reservationCode: code, songLink: sLink,
    song: '', songTitle: '', songArtist: '', karaokeLink: '', songConfirmed: false,
    timestamp: Date.now(),
    prizeSong: false, prizePerf: false, prizeHinchada: false, prizePublicoSong: false, prizePublicoPerf: false,
    juryScoresSong: {}, juryScoresPerf: {}, juryScoresHinchada: {}, juryScoresPublico: {},
    extraPts: 0, voteSong: 0, votePerf: 0, micclubPts: 0
  };

  if (firebaseOk) {
    const r = dbPush(dbRef(db, 'participants'));
    await dbSet(r, p);
  } else {
    allParticipants['p_' + Date.now()] = p;
    saveLocal();
  }
  ['a-name', 'a-wa'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('a-ppl').value = '1';
  renderAdminParticipants();
  updateUI();
}

function renderAdminParticipants() {
  const parts = sorted();
  const el    = document.getElementById('admin-parts-list');
  if (!el) return;
  if (!parts.length) {
    el.innerHTML = '<div style="text-align:center;color:var(--text2);padding:18px">Sin participantes</div>';
    return;
  }
  el.innerHTML = parts.map(p => {
    const badges = [];
    if (p.prizeSong)        badges.push('<span class="badge badge-gold">🎵</span>');
    if (p.prizePerf)        badges.push('<span class="badge badge-purple">🎭</span>');
    if (p.prizeHinchada)    badges.push('<span class="badge badge-teal">📣</span>');
    if (p.prizePublicoSong) badges.push('<span class="badge badge-gold">🎤</span>');
    if (p.prizePublicoPerf) badges.push('<span class="badge badge-purple">🏆</span>');
    const sStatus = p.songConfirmed
      ? `<span style="color:var(--teal);font-size:10px">✅ Canción OK</span>`
      : `<span style="color:var(--red);font-size:10px">⚠️ Sin canción</span>`;
    const karLink  = p.karaokeLink ? `<div class="p-info">🎬 <a href="${esc(p.karaokeLink)}" target="_blank" style="color:var(--purple-light);font-size:10px">Ver karaoke →</a></div>` : '';
    const songLink = p.songLink    ? `<div class="p-info">🔗 <a href="${esc(p.songLink)}"    target="_blank" style="color:var(--teal);font-size:10px">Link canción →</a></div>` : '';
    return `<div class="p-item">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
        <div style="flex:1">
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:3px">
            <div class="p-name">${esc(p.name)}</div>${sStatus}
          </div>
          <div class="p-info">🎵 ${p.song ? esc(p.song) : '<span style="color:var(--red)">Sin canción</span>'}</div>
          ${karLink}${songLink}
          <div class="p-info">👥 ${p.people} · ⭐ ${p.score} pts · 🎤 MC:${p.micclubPts || 0} · 🔑 ${esc(p.reservationCode || '—')}</div>
          ${p.whatsapp ? `<div class="p-info">📱 ${esc(p.whatsapp)}</div>` : ''}
          ${badges.length ? `<div style="display:flex;gap:3px;flex-wrap:wrap;margin-top:5px">${badges.join('')}</div>` : ''}
        </div>
      </div>
      <div class="p-actions">
        <button class="btn btn-outline btn-sm" onclick="openModal('${p.id}')">✏️ Editar</button>
        <button class="btn btn-danger btn-sm"  onclick="delParticipant('${p.id}')">🗑️</button>
      </div>
    </div>`;
  }).join('');
}

function renderAdminJury() {
  const parts = sorted().filter(p => p.karaokeLink || p.songConfirmed);

  const renderCriteriaTable = (cat, elId) => {
    const el = document.getElementById(elId);
    if (!el) return;
    const rows = parts.map(p => ({
      name: p.name, id: p.id,
      total:  getJuryTotal(p.id, cat),
      scores: cat === 'song' ? (p.juryScoresSong || {}) : (p.juryScoresPerf || {})
    })).sort((a, b) => b.total - a.total);
    if (!rows.length) { el.innerHTML = '<div style="color:var(--text2);font-size:12px;padding:8px">Sin datos</div>'; return; }
    const criteria = cat === 'song' ? SONG_CRITERIA : cat === 'perf' ? PERF_CRITERIA : HINCHADA_CRITERIA;
    el.innerHTML = `<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:11px">
      <tr style="border-bottom:1px solid var(--border)">
        <th style="text-align:left;padding:6px;color:var(--text2)">Participante</th>
        ${criteria.map(c => `<th style="padding:6px;color:var(--text2);text-align:center">${c.label.split(' ')[0]}</th>`).join('')}
        <th style="padding:6px;color:var(--gold);text-align:right">TOTAL</th>
      </tr>
      ${rows.map((r, i) => {
        const vals    = Object.values(r.scores);
        const isMulti = vals.length > 0 && typeof vals[0] === 'object';
        const cv = {};
        criteria.forEach(c => {
          cv[c.key] = isMulti
            ? vals.reduce((s, js) => s + (parseInt(js?.[c.key]) || 0), 0)
            : (parseInt(r.scores[c.key]) || 0);
        });
        return `<tr style="border-bottom:1px solid rgba(255,255,255,.03);background:${i === 0 ? 'rgba(212,168,67,.06)' : ''}">
          <td style="padding:7px;font-weight:600">${esc(r.name)}${i === 0 && r.total > 0 ? ' 👑' : ''}</td>
          ${criteria.map(c => `<td style="padding:7px;text-align:center;color:var(--text2)">${cv[c.key] || '—'}</td>`).join('')}
          <td style="padding:7px;text-align:right;font-family:'Bebas Neue',sans-serif;font-size:18px;color:var(--gold)">${r.total}</td>
        </tr>`;
      }).join('')}
    </table></div>`;
  };

  renderCriteriaTable('song',     'admin-jury-song-table');
  renderCriteriaTable('perf',     'admin-jury-perf-table');
  renderCriteriaTable('hinchada', 'admin-jury-hinchada-table');

  const prizesEl = document.getElementById('admin-prizes-list');
  if (prizesEl) {
    const prizeItems = [
      { key: 'prizeSong',     label: '🎵 Mejor Canción (Jurado) +5 pts',     cat: 'song'     },
      { key: 'prizePerf',     label: '🎭 Mejor Performance (Jurado) +5 pts', cat: 'perf'     },
      { key: 'prizeHinchada', label: '📣 Mejor Hinchada (Jurado) +8 pts',    cat: 'hinchada' },
    ];
    const partsList = sorted();
    prizesEl.innerHTML = prizeItems.map(pr => {
      const juryLeader = pr.cat ? getJuryLeader(pr.cat) : null;
      const opts = partsList.map(p =>
        `<option value="${p.id}" ${p[pr.key] ? 'selected' : ''}>${esc(p.name)}${p[pr.key] ? ' ✅' : ''}</option>`
      ).join('');
      const leaderNote = juryLeader && juryLeader.score > 0
        ? `<div style="font-size:10px;color:var(--gold);margin-top:3px">👑 Líder jurado: <strong>${esc(juryLeader.name)}</strong> (${juryLeader.score} pts)</div>` : '';
      return `<div style="background:var(--bg3);border-radius:8px;padding:12px;margin-bottom:8px;border:1px solid var(--border)">
        <div style="font-family:'Oswald',sans-serif;font-weight:600;font-size:13px;margin-bottom:4px">${pr.label}</div>
        ${leaderNote}
        <select id="prize-sel-${pr.key}" style="margin-top:8px;margin-bottom:6px">
          <option value="">— Sin asignar —</option>${opts}
        </select>
        <button class="btn btn-gold btn-sm" onclick="assignPrize('${pr.key}','prize-sel-${pr.key}','${pr.cat}')">Asignar Premio</button>
      </div>`;
    }).join('');
  }
}

async function assignPrize(prizeKey, selId, juryCat) {
  const sel = document.getElementById(selId);
  if (!sel) return;
  const targetId = sel.value;
  try {
    if (firebaseOk) {
      const batch = Object.entries(allParticipants).map(([id]) =>
        dbUpdate(dbRef(db, `participants/${id}`), { [prizeKey]: false })
      );
      await Promise.all(batch);
      if (targetId) {
        const updates = { [prizeKey]: true };
        if (juryCat) {
          const cur = parseInt(allParticipants[targetId]?.micclubPts) || 0;
          updates.micclubPts = cur + 5;
        }
        await dbUpdate(dbRef(db, `participants/${targetId}`), updates);
      }
    } else {
      Object.keys(allParticipants).forEach(id => allParticipants[id][prizeKey] = false);
      if (targetId) {
        allParticipants[targetId][prizeKey] = true;
        if (juryCat) allParticipants[targetId].micclubPts = (parseInt(allParticipants[targetId].micclubPts) || 0) + 5;
      }
      saveLocal();
    }
    updateUI();
    renderAdminJury();
  } catch(e) { console.error(e); }
}

function openModal(id) {
  const p = allParticipants[id];
  if (!p) return;
  document.getElementById('edit-id').value    = id;
  document.getElementById('edit-name').value  = p.name     || '';
  document.getElementById('edit-wa').value    = p.whatsapp || '';
  document.getElementById('edit-email').value = p.email    || '';
  document.getElementById('edit-extra').value = p.extraPts || 0;

  // Sección de evento: visible solo cuando hay evento activo
  const evtSection = document.getElementById('edit-event-section');
  if (evtSection) evtSection.style.display = showRunning ? 'block' : 'none';

  if (showRunning) {
    document.getElementById('edit-ppl').value      = p.people      || 0;
    document.getElementById('edit-song').value     = p.songTitle   || p.song || '';
    document.getElementById('edit-artist').value   = p.songArtist  || '';
    document.getElementById('edit-karlink').value  = p.karaokeLink || '';
    const epSong = document.getElementById('ep-song');
    const epPerf = document.getElementById('ep-perf');
    const epHinchada = document.getElementById('ep-hinchada');
    const epMesa = document.getElementById('ep-mesa');
    if (epSong)     epSong.checked     = !!p.prizeSong;
    if (epPerf)     epPerf.checked     = !!p.prizePerf;
    if (epHinchada) epHinchada.checked = !!p.prizeHinchada;
    if (epMesa)     epMesa.checked     = !!p.prizeMesa;
  }
  document.getElementById('edit-modal').classList.add('open');
}

function closeModal() {
  document.getElementById('edit-modal').classList.remove('open');
}

async function saveParticipant() {
  const id = document.getElementById('edit-id').value;
  const upd = {
    name:     document.getElementById('edit-name').value.trim(),
    whatsapp: document.getElementById('edit-wa').value.trim(),
    email:    document.getElementById('edit-email').value.trim(),
    extraPts: parseInt(document.getElementById('edit-extra').value) || 0,
  };
  if (showRunning) {
    const st = document.getElementById('edit-song').value.trim();
    const sa = document.getElementById('edit-artist').value.trim();
    const kl = document.getElementById('edit-karlink').value.trim();
    upd.songTitle    = st;
    upd.songArtist   = sa;
    upd.karaokeLink  = kl;
    upd.song         = st && sa ? `${st} — ${sa}` : (st || '');
    upd.songConfirmed = !!(st && sa && kl);
    upd.people        = parseInt(document.getElementById('edit-ppl').value) || 0;
  }
  if (firebaseOk) {
    await dbUpdate(dbRef(db, `participants/${id}`), upd);
  } else {
    allParticipants[id] = { ...allParticipants[id], ...upd };
    saveLocal();
  }
  closeModal();
  updateUI();
}

function delParticipant(id) {
  const name = allParticipants[id]?.name || 'este participante';
  mcConfirm(`¿Eliminar a <strong>${name}</strong>?`, async () => {
    if (firebaseOk) {
      await dbRemove(dbRef(db, `participants/${id}`));
    } else {
      delete allParticipants[id];
      saveLocal();
    }
    updateUI();
  });
}

async function endShow() {
  try {
    const closedAt   = Date.now();
    const closedDate = new Date(closedAt).toLocaleDateString('es-AR');

    // Snapshot BEFORE clearing (captured now)
    const snap = JSON.parse(JSON.stringify(allParticipants));
    const historyEntry = {
      closedAt,
      closedDate,
      eventInfo: localState.settings?.currentEvent || {},
      participants: snap
    };

    // Si quedan votos sin procesar, determinar ganadores antes de resetear
    const parts = Object.values(allParticipants).map((p, _, arr) => p);
    const partsArr = Object.entries(allParticipants).map(([id, p]) => ({ ...p, id }));
    const songLeaderEntry = [...partsArr]
      .filter(p => (parseInt(p.voteSong) || 0) > 0)
      .sort((a, b) => (parseInt(b.voteSong) || 0) - (parseInt(a.voteSong) || 0))[0];
    const perfLeaderEntry = [...partsArr]
      .filter(p => (parseInt(p.votePerf) || 0) > 0)
      .sort((a, b) => (parseInt(b.votePerf) || 0) - (parseInt(a.votePerf) || 0))[0];
    if (songLeaderEntry) allParticipants[songLeaderEntry.id].prizePublicoSong = true;
    if (perfLeaderEntry) allParticipants[perfLeaderEntry.id].prizePublicoPerf = true;

    // Build main update (participants + settings only — no nested objects)
    const updates = {
      'settings/votingOpen':    false,
      'settings/votingCloseAt': null,
      'settings/showRunning':   false,
      'settings/currentEvent':  null,
    };

    Object.keys(allParticipants).forEach(id => {
      const p        = allParticipants[id];
      const eventPts = calcScore(p);
      updates[`participants/${id}/micclubPts`]          = (parseInt(p.micclubPts) || 0) + eventPts;
      updates[`participants/${id}/voteSong`]            = 0;
      updates[`participants/${id}/votePerf`]            = 0;
      updates[`participants/${id}/prizePublicoSong`]    = false;
      updates[`participants/${id}/prizePublicoPerf`]    = false;
      updates[`participants/${id}/juryScoresSong`]      = null;
      updates[`participants/${id}/juryScoresPerf`]      = null;
      updates[`participants/${id}/juryScoresHinchada`]  = null;
      updates[`participants/${id}/juryScoresPublico`]   = null;
      updates[`participants/${id}/songConfirmed`]       = false;
      updates[`participants/${id}/songTitle`]           = null;
      updates[`participants/${id}/songArtist`]          = null;
      updates[`participants/${id}/song`]                = null;
      updates[`participants/${id}/karaokeLink`]         = null;
      updates[`participants/${id}/prizeSong`]           = false;
      updates[`participants/${id}/prizePerf`]           = false;
      updates[`participants/${id}/prizeHinchada`]       = false;
      updates[`participants/${id}/people`]              = 0;
    });

    if (firebaseOk) {
      // Guardar historial por separado (puede fallar sin bloquear el resto)
      try {
        await dbSet(dbRef(db, `history/${closedAt}`), historyEntry);
      } catch(he) {
        console.warn('Historial no guardado (revisar reglas Firebase):', he.message);
      }
      await dbUpdate(dbRef(db), updates);
    } else {
      Object.keys(allParticipants).forEach(id => {
        Object.assign(allParticipants[id], {
          voteSong: 0, votePerf: 0,
          prizePublicoSong: false, prizePublicoPerf: false,
          juryScoresSong: {}, juryScoresPerf: {}, juryScoresHinchada: {}, juryScoresPublico: {},
          songConfirmed: false, songTitle: '', songArtist: '', song: '', karaokeLink: '',
          prizeSong: false, prizePerf: false, prizeHinchada: false,
          people: 0,
        });
      });
      localState.settings.votingOpen    = false;
      localState.settings.votingCloseAt = null;
      localState.settings.showRunning   = false;
      localState.settings.currentEvent  = null;
      if (!localState.history) localState.history = {};
      localState.history[closedAt] = historyEntry;
      saveLocal();
    }
    votingOpen = false; showRunning = false;
    localStorage.removeItem('voted_public');
    mcAlert('✅ Evento terminado. Los puntos fueron acumulados al MicClub.');
    updateUI();
  } catch(e) { console.error(e); mcAlert('Error al terminar el evento: ' + e.message); }
}

// Garantiza que no queden canciones ni reservas si no hay evento activo.
// Se llama automáticamente al cargar datos cuando showRunning === false.
async function enforceNoShowState() {
  if (showRunning) return; // solo actúa cuando no hay evento
  const dirty = Object.entries(allParticipants).filter(([, p]) =>
    p.songConfirmed || p.songTitle || p.karaokeLink || (parseInt(p.people) || 0) > 0 ||
    (parseInt(p.voteSong) || 0) > 0 || (parseInt(p.votePerf) || 0) > 0 ||
    p.juryScoresSong || p.juryScoresPerf || p.juryScoresHinchada
  );
  if (!dirty.length) return;
  const updates = {};
  dirty.forEach(([id]) => {
    updates[`participants/${id}/songConfirmed`]      = false;
    updates[`participants/${id}/songTitle`]          = null;
    updates[`participants/${id}/songArtist`]         = null;
    updates[`participants/${id}/song`]               = null;
    updates[`participants/${id}/karaokeLink`]        = null;
    updates[`participants/${id}/people`]             = 0;
    updates[`participants/${id}/voteSong`]           = 0;
    updates[`participants/${id}/votePerf`]           = 0;
    updates[`participants/${id}/juryScoresSong`]     = null;
    updates[`participants/${id}/juryScoresPerf`]     = null;
    updates[`participants/${id}/juryScoresHinchada`] = null;
    updates[`participants/${id}/juryScoresPublico`]  = null;
    updates[`participants/${id}/prizeSong`]          = false;
    updates[`participants/${id}/prizePerf`]          = false;
    updates[`participants/${id}/prizeHinchada`]      = false;
    updates[`participants/${id}/prizePublicoSong`]   = false;
    updates[`participants/${id}/prizePublicoPerf`]   = false;
    // Actualiza también la copia local inmediatamente
    Object.assign(allParticipants[id], {
      songConfirmed: false, songTitle: '', songArtist: '', song: '', karaokeLink: '',
      people: 0, voteSong: 0, votePerf: 0,
      juryScoresSong: null, juryScoresPerf: null, juryScoresHinchada: null, juryScoresPublico: null,
      prizeSong: false, prizePerf: false, prizeHinchada: false,
      prizePublicoSong: false, prizePublicoPerf: false,
    });
  });
  try {
    if (firebaseOk) {
      await dbUpdate(dbRef(db), updates);
    } else {
      saveLocal();
    }
    updateUI();
  } catch(e) { console.error('enforceNoShowState error:', e); }
}

function recalcAll() { updateUI(); }

function clearAllParticipants() {
  const showMsg = showRunning
    ? '<br><br>⚡ Hay un show en curso — se finalizará antes de borrar.'
    : '';
  mcConfirm(`⚠️ ¿Borrar TODOS los participantes y el historial de eventos?<br><br>Esto elimina todo de la base de datos. No se puede deshacer.${showMsg}`, async () => {
  try {
    if (firebaseOk) {
      // Si hay show activo, guardar historial antes de borrar todo
      if (showRunning) {
        const closedAt = Date.now();
        const snap = JSON.parse(JSON.stringify(allParticipants));
        try {
          await dbSet(dbRef(db, `history/${closedAt}`), {
            closedAt,
            closedDate: new Date(closedAt).toLocaleDateString('es-AR'),
            eventInfo: localState.settings?.currentEvent || {},
            participants: snap
          });
        } catch(he) { console.warn('Historial no guardado:', he.message); }
      }
      await dbSet(dbRef(db, 'participants'), null);
      await dbSet(dbRef(db, 'history'), null);
      await dbUpdate(dbRef(db, 'settings'), {
        votingOpen: false, votingCloseAt: null, bonus: false,
        showRunning: false, currentEvent: null
      });
    } else {
      allParticipants = {};
      localState.participants = {};
      localState.history = {};
      localState.settings.votingOpen    = false;
      localState.settings.votingCloseAt = null;
      localState.settings.bonus         = false;
      localState.settings.showRunning   = false;
      localState.settings.currentEvent  = null;
      saveLocal();
    }
    bonusActive = false; votingOpen = false; showRunning = false;
    allParticipants = {};
    localStorage.removeItem('voted_public');
    updateUI();
    mcAlert('✅ Base de datos vaciada. El sistema está limpio.');
  } catch(e) { console.error(e); mcAlert('Error al borrar los datos.'); }
  });
}

function seedTestData() {
  mcConfirm('⚠️ Cargar 16 participantes de prueba (borra los actuales)?\n\n¿Continuar?', async () => {
    const FAKE = [
      { name: 'Valentina Sosa',     wa: '+5491144231001', ppl: 2, ref: '',               song: 'Yo Soy El Fuego',             artist: 'Ke Personajes',     link: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
      { name: 'Matías Ferreyra',    wa: '+5491155342102', ppl: 1, ref: '',               song: 'Bohemian Rhapsody',           artist: 'Queen',             link: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
      { name: 'Lucía Mendoza',      wa: '+5491166453203', ppl: 3, ref: 'Valentina Sosa', song: 'Mi Gente',                   artist: 'J Balvin',          link: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
      { name: 'Rodrigo Blanco',     wa: '+5491177564304', ppl: 1, ref: '',               song: 'Shallow',                    artist: 'Lady Gaga',         link: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
      { name: 'Camila Torres',      wa: '+5491188675405', ppl: 4, ref: '',               song: 'Con Calma',                  artist: 'Daddy Yankee',      link: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
      { name: 'Ezequiel Ríos',      wa: '+5491199786506', ppl: 1, ref: 'Rodrigo Blanco', song: 'Someone Like You',           artist: 'Adele',             link: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
      { name: 'Florencia Gutiérrez',wa: '+5491111897607', ppl: 2, ref: '',               song: 'Tusa',                       artist: 'Karol G',           link: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
      { name: 'Nicolás Paredes',    wa: '+5491122908708', ppl: 1, ref: '',               song: 'Por Siempre',                artist: 'Los Ángeles Azules',link: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
      { name: 'Agustina Leiva',     wa: '+5491133019809', ppl: 3, ref: 'Camila Torres',  song: 'Defying Gravity',            artist: 'Wicked',            link: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
      { name: 'Tomás Acosta',       wa: '+5491144120900', ppl: 1, ref: '',               song: 'Sobreviviré',                artist: 'Mónica Naranjo',    link: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
      { name: 'Sofía Ramírez',      wa: '+5491155231001', ppl: 2, ref: 'Lucía Mendoza',  song: 'Total Eclipse of the Heart', artist: 'Bonnie Tyler',      link: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
      { name: 'Ignacio Medina',     wa: '+5491166342102', ppl: 1, ref: '',               song: 'Believer',                   artist: 'Imagine Dragons',   link: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
      { name: 'Rocío Castellano',   wa: '+5491177453203', ppl: 5, ref: '',               song: 'Quiero Más',                 artist: 'Thalía',            link: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
      { name: 'Bruno Salvatore',    wa: '+5491188564304', ppl: 1, ref: 'Ezequiel Ríos',  song: 'Piano Man',                  artist: 'Billy Joel',        link: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
      { name: 'Antonella Vega',     wa: '+5491199675405', ppl: 2, ref: '',               song: 'Amor Gitano',                artist: 'Beyoncé',           link: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
      { name: 'Sebastián Cruz',     wa: '+5491111786506', ppl: 1, ref: '',               song: "Don't Stop Me Now",          artist: 'Queen',             link: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
    ];

    const btn = document.getElementById('seed-btn');
    if (btn) { btn.innerHTML = '<span class="spinner"></span> CARGANDO...'; btn.disabled = true; }

    try {
      if (firebaseOk) {
        await dbSet(dbRef(db, 'participants'), null);
        await dbUpdate(dbRef(db, 'settings'), { votingOpen: true, votingCloseAt: null, bonus: false });
      } else {
        allParticipants = {};
        localState.participants = {};
        localState.settings.votingOpen    = true;
        localState.settings.votingCloseAt = null;
        localState.settings.bonus         = false;
      }
      bonusActive = false; votingOpen = true;

      for (const f of FAKE) {
        const code     = makeCode();
        const songLink = buildBaseURL() + `?mode=register&code=${code}`;
        const p = {
          name: f.name, people: f.ppl, whatsapp: f.wa, email: '', referrer: f.ref,
          reservationCode: code, songLink,
          song: `${f.song} — ${f.artist}`, songTitle: f.song, songArtist: f.artist,
          karaokeLink: f.link, songConfirmed: true,
          timestamp: Date.now() + Math.floor(Math.random() * 1000),
          prizeSong: false, prizePerf: false, prizeHinchada: false, prizePublicoSong: false, prizePublicoPerf: false,
          juryScoresSong: {}, juryScoresPerf: {}, juryScoresHinchada: {}, juryScoresPublico: {},
          extraPts: 0, voteSong: 0, votePerf: 0, micclubPts: 0
        };
        if (firebaseOk) {
          const r = dbPush(dbRef(db, 'participants'));
          await dbSet(r, p);
        } else {
          allParticipants['p_' + Date.now() + '_' + Math.random().toString(36).slice(2)] = p;
        }
      }

      if (!firebaseOk) saveLocal();
      if (btn) { btn.innerHTML = '✅ CARGADOS'; btn.disabled = false; }
      updateUI();
      mcAlert('✅ 16 participantes cargados con canciones confirmadas. ¡Listos para votar!');
    } catch(e) {
      console.error(e);
      if (btn) { btn.innerHTML = '🧪 CARGAR 16 PARTICIPANTES DE PRUEBA'; btn.disabled = false; }
      mcAlert('Error al cargar los datos de prueba.');
    }
  });
}

function exportCSV() {
  const parts = sorted();
  const rows  = [['Pos','Nombre','Cancion','Artista','LinkKaraoke','Personas','WA','Pts','MicClub','Codigo']];
  parts.forEach((p, i) => rows.push([
    i + 1, p.name, p.songTitle || p.song, p.songArtist || '', p.karaokeLink || '',
    p.people, p.whatsapp || '', p.score, calcMicclubScore(p), p.reservationCode || ''
  ]));
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const a   = document.createElement('a');
  a.href    = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = 'micclub_ranking.csv';
  a.click();
}

// ── LINKS / QR ────────────────────────────────────────────────────────────────
function generateQRs() {
  const base   = buildBaseURL();
  const regUrl = base + '?mode=register';
  try {
    new QRCode(document.getElementById('qr-reg'), {
      text: regUrl, width: 148, height: 148,
      colorDark: '#0a0a0f', colorLight: '#ffffff'
    });
  } catch(e) {}
}

function renderLinks() {
  const el = document.getElementById('links-content');
  if (!el || !adminLoggedIn) return;
  const base  = buildBaseURL();
  const links = [
    { icon: '🎤', label: 'Link de Reserva',          url: base + '?mode=register', desc: 'Para que los participantes se inscriban' },
    { icon: '🗳️', label: 'Link de Votación Pública', url: base + '?mode=vote',     desc: 'Un solo QR/link para votar. Compartí durante el evento.' },
    { icon: '⭐', label: 'Panel de Jurado',           url: base + '?mode=jury',     desc: 'Solo para los jurados.' },
  ];
  el.innerHTML = links.map(l => `
    <div style="background:var(--bg3);border-radius:9px;padding:12px;margin-bottom:10px;border:1px solid var(--border)">
      <div style="font-family:'Oswald',sans-serif;font-weight:600;font-size:13px;margin-bottom:3px">${l.icon} ${l.label}</div>
      <div style="font-size:10px;color:var(--text2);margin-bottom:7px">${l.desc}</div>
      <div style="background:var(--bg4);border-radius:6px;padding:8px;font-size:10px;word-break:break-all;color:var(--teal);margin-bottom:7px">${esc(l.url)}</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn btn-outline btn-sm" onclick="copyLink('${esc(l.url)}')">📋 Copiar</button>
        <a href="${esc(l.url)}" target="_blank" style="text-decoration:none">
          <button class="btn btn-outline btn-sm">↗ Abrir</button>
        </a>
      </div>
    </div>`).join('');

  if (!document.getElementById('vote-qr-admin') && el) {
    const qrDiv = document.createElement('div');
    qrDiv.style.cssText = 'text-align:center;margin-top:14px';
    qrDiv.innerHTML = `
      <div class="card-sub mb-8">QR Votación Pública</div>
      <div class="qr-box" style="display:inline-block"><div id="vote-qr-admin"></div></div>
      <div style="font-size:10px;color:var(--text2);margin-top:8px;letter-spacing:2px;font-family:'Oswald',sans-serif">ESCANEÁ PARA VOTAR</div>`;
    el.appendChild(qrDiv);
    try {
      new QRCode(document.getElementById('vote-qr-admin'), {
        text: base + '?mode=vote', width: 148, height: 148,
        colorDark: '#0a0a0f', colorLight: '#ffffff'
      });
    } catch(e) {}
  }
}

function copyLink(url) {
  navigator.clipboard?.writeText(url)
    .then(() => mcAlert('✅ Link copiado'))
    .catch(() => mcAlert('Copiá este link:\n' + url));
}

// ── UTILS ─────────────────────────────────────────────────────────────────────
function esc(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function showErr(id, msg) {
  const e = document.getElementById(id);
  if (!e) return;
  e.textContent   = '⚠️ ' + msg;
  e.style.display = 'block';
  setTimeout(() => e.style.display = 'none', 5000);
}

// ── INIT ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('r-people')?.addEventListener('input', updateRegPreview);
  updateRegPreview();
  generateQRs();

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      const modal = document.getElementById('jury-score-modal');
      if (modal && modal.style.display !== 'none') closeJuryModal();
    }
  });

  if (MODE === 'home') {
    // Default mode: no tab menu
    document.body.classList.add('no-tabs');
    // Restore session login
    if (sessionStorage.getItem('mc_ok')) {
      adminLoggedIn = true;
      document.getElementById('home-login-gate').style.display = 'none';
      document.getElementById('home-dashboard').style.display  = 'block';
    }
    nav('home');
  } else if (MODE === 'register') {
    nav('register');
  } else if (MODE === 'vote') {
    nav('vote-public');
    loadPublicVoteOpts();
  } else if (MODE === 'jury') {
    nav('jury');
  } else if (MODE === 'admin') {
    nav('admin');
  } else if (MODE === 'ranking') {
    nav('ranking');
  } else if (MODE === 'micclub') {
    nav('show');
  } else {
    nav('home');
  }


  if (window._firebaseReady) initFirebase();
  if (window.location.hash === '#show') nav('show');
  setInterval(() => { if (!firebaseOk) updateUI(); }, 10000);
});
