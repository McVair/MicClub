// ─────────────────────────────────────────────────────────────────────────────
//  MIC CLUB · Engine v4 (v1.51)
// ─────────────────────────────────────────────────────────────────────────────
console.log("MIC CLUB v1.51 Loaded!");

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
let firebaseInitialized = false;
let firebaseSettingsLoaded = false;
let firebaseParticipantsLoaded = false;
let allParticipants = {};
let freeKaraokeList = {};
let bonusActive     = false;
let adminLoggedIn   = false;
let isSuperAdmin     = false;
let currentPId      = null;
let votingOpen      = false;
let showRunning     = false;
let projectionWindowRef = null;
let projectionCheckInterval = null;
let lastProjectionActive = false;
let navStack        = [];
let juryCat         = 'song';
let celebrationAnimationId = null;
let jurySelectedId  = { song: null, perf: null, hinchada: null };
let juryCurrentScores = { song: {}, perf: {}, hinchada: {} };
let localState = {
  participants: {},
  settings: { adminPassword: ADMIN_PASS_DEFAULT, bonus: false, votingOpen: false, showRunning: false }
};

let revealedCategories = {
  'rank-pub-song': false,
  'rank-pub-perf': false,
  'rank-jury-song': false,
  'rank-jury-perf': false,
  'rank-jury-hinchada': false
};
let lastEventName = null;
let showingReservationSuccess = false;

let tempSelections = null;
let tempSelectionsEventId = null;

function getOrCreateVoterId() {
  try {
    let voterId = localStorage.getItem('voter_id_v3');
    if (!voterId || voterId === 'undefined' || voterId === 'null') {
      voterId = 'voter_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      localStorage.setItem('voter_id_v3', voterId);
      try { localStorage.removeItem('voter_id'); } catch (err) {}
    }
    return voterId;
  } catch (e) {
    if (!window._voterIdMem || window._voterIdMem === 'undefined' || window._voterIdMem === 'null') {
      window._voterIdMem = 'voter_mem_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    }
    return window._voterIdMem;
  }
}

function getDeviceVotesFromDB(voterId, eventId) {
  const votes = { song: [], perf: [] };
  if (!allParticipants || !eventId) return votes;
  Object.entries(allParticipants).forEach(([pid, p]) => {
    const res = p.reservations?.[eventId] || {};
    const isMigratedActive = (eventId === 'event1' && (!p.reservations || !p.reservations.event1) && (p.songConfirmed || (p.people && p.people > 0)));
    const target = isMigratedActive ? p : res;
    const v = target.publicVotes?.[voterId];
    if (v) {
      if (v.song) votes.song.push(pid);
      if (v.perf) votes.perf.push(pid);
    }
  });
  return votes;
}

function showTemporaryAlert(text, duration = 2000, callback = null) {
  const alertDiv = document.createElement('div');
  alertDiv.style.position = 'fixed';
  alertDiv.style.top = '50%';
  alertDiv.style.left = '50%';
  alertDiv.style.transform = 'translate(-50%, -50%)';
  alertDiv.style.background = 'rgba(10, 10, 15, 0.95)';
  alertDiv.style.border = '1px solid var(--gold)';
  alertDiv.style.borderRadius = '12px';
  alertDiv.style.padding = '20px 30px';
  alertDiv.style.color = 'var(--gold)';
  alertDiv.style.fontFamily = "'Inter', sans-serif";
  alertDiv.style.fontSize = '18px';
  alertDiv.style.fontWeight = 'bold';
  alertDiv.style.zIndex = '99999';
  alertDiv.style.textAlign = 'center';
  alertDiv.style.boxShadow = '0 0 20px rgba(223, 172, 74, 0.3)';
  alertDiv.style.animation = 'fadeIn 0.3s ease';
  alertDiv.textContent = text;
  
  document.body.appendChild(alertDiv);
  
  setTimeout(() => {
    alertDiv.style.transition = 'opacity 0.3s ease';
    alertDiv.style.opacity = '0';
    setTimeout(() => {
      alertDiv.remove();
      if (callback) callback();
    }, 300);
  }, duration);
}

let pantallaTab = 'artistas';

function resetRevealedCategories() {
  revealedCategories = {
    'rank-pub-song': false,
    'rank-pub-perf': false,
    'rank-jury-song': false,
    'rank-jury-perf': false,
    'rank-jury-hinchada': false
  };
}

window.revealCategory = function(elId) {
  revealedCategories[elId] = true;
  updateRanking();
};

// ── URL ROUTING ──────────────────────────────────────────────────────────────
const urlParams = new URLSearchParams(window.location.search);
let MODE        = urlParams.get('mode') || 'home';
if (window.location.pathname === '/pantalla') {
  MODE = 'pantalla';
}
const IS_BAR_PROJECTION = (urlParams.get('source') === 'bar');
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

  if (page === 'home' || page === 'admin') {
    switchMobileSection('admin');
  }

  // Move YouTube sidebar to correct grid container based on active page
  const sidebar = document.getElementById('admin-video-sidebar');
  if (sidebar) {
    if (page === 'home') {
      const homeGrid = document.getElementById('home-grid-container');
      if (homeGrid) {
        homeGrid.appendChild(sidebar);
        sidebar.style.display = ''; // let stylesheet default control visibility
      }
    } else if (page === 'admin') {
      const adminGrid = document.getElementById('admin-grid-container');
      if (adminGrid) {
        adminGrid.appendChild(sidebar);
      }
    }
  }

  renderNav();
  if (page === 'ranking')        { updateRanking(); startCelebration(); }
  if (page === 'show')           { updateShowMode(); startCelebration(); }
  if (page === 'pantalla')       { updatePantallaContent(); setPantallaTab(pantallaTab || 'artistas'); updatePantallaSponsors(); }
  if (page === 'config')         renderConfigParticipants();
  if (page === 'admin-micclub-participants') renderAdminMicClubParticipants();
  if (page === 'history')        renderHistoryPage();
  if (page === 'jury')           renderJurySelectors();
  if (page === 'register')       resetRegisterPage();
  if (page === 'vote-public')    loadPublicVoteOpts();
  if (page === 'program')        updateProgramPage();
  if (page === 'admin' && adminLoggedIn) {
    document.getElementById('admin-login').style.display = 'none';
    document.getElementById('admin-panel').style.display = 'block';
    const urlParams = new URLSearchParams(window.location.search);
    const startTab = urlParams.get('tab') || 'ctrl';
    setAdminTab(startTab);
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
  if (!currentPId || !selectedEventId) return;
  const title  = document.getElementById('s-title')?.value.trim();
  const artist = document.getElementById('s-artist')?.value.trim();
  const link   = document.getElementById('s-link')?.value.trim();
  if (!title || !artist || !link) return;
  
  let isLinkOk = false;
  try {
    const parsed = new URL(link);
    isLinkOk = parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch(e) {}
  if (!isLinkOk) return;

  const updates = { updatedAt: Date.now() };
  const oldRes = allParticipants[currentPId]?.reservations?.[selectedEventId] || {};
  const reservationUpdate = {
    ...oldRes,
    songTitle: title,
    songArtist: artist,
    song: `${title} — ${artist}`,
    karaokeLink: link,
    songConfirmed: true
  };
  updates[`reservations/${selectedEventId}`] = reservationUpdate;
  
  if (selectedEventId === 'event1') {
    updates.songTitle = '';
    updates.songArtist = '';
    updates.song = '';
    updates.karaokeLink = '';
    updates.songConfirmed = false;
  }
  
  try {
    if (firebaseOk) {
      await dbUpdate(dbRef(db, `participants/${currentPId}`), updates);
    } else {
      const p = allParticipants[currentPId];
      p.updatedAt = Date.now();
      if (!p.reservations) p.reservations = {};
      p.reservations[selectedEventId] = reservationUpdate;
      if (selectedEventId === 'event1') {
        p.songTitle = '';
        p.songArtist = '';
        p.song = '';
        p.karaokeLink = '';
        p.songConfirmed = false;
      }
      saveLocal();
    }
    
    if (allParticipants[currentPId]) {
      allParticipants[currentPId].updatedAt = Date.now();
      if (!allParticipants[currentPId].reservations) allParticipants[currentPId].reservations = {};
      allParticipants[currentPId].reservations[selectedEventId] = reservationUpdate;
      if (selectedEventId === 'event1') {
        allParticipants[currentPId].songTitle = '';
        allParticipants[currentPId].songArtist = '';
        allParticipants[currentPId].song = '';
        allParticipants[currentPId].karaokeLink = '';
        allParticipants[currentPId].songConfirmed = false;
      }
    }
    
    const ck = document.getElementById('song-saved-check');
    if (ck) ck.style.display = 'inline';
    
    updateRegistrationCupoBanner();
  } catch(e) { console.error('autoSaveSong:', e); }
}

function updatePeopleCheck() {
  const val = parseInt(document.getElementById('prof-people-input')?.value) || 0;
  const ck  = document.getElementById('people-check');
  if (ck) ck.style.display = val > 0 ? 'flex' : 'none';
}

function updateSongCheck() {
  const name   = document.getElementById('prof-name-input')?.value.trim();
  const phone  = document.getElementById('prof-phone-input')?.value.trim();
  const title  = document.getElementById('s-title')?.value.trim();
  const artist = document.getElementById('s-artist')?.value.trim();
  const link   = document.getElementById('s-link')?.value.trim();
  const ck     = document.getElementById('song-saved-check');
  const btn    = document.getElementById('confirm-all-btn');
  const errEl  = document.getElementById('confirm-all-err');

  let isLinkOk = false;
  if (link) {
    try {
      const parsed = new URL(link);
      isLinkOk = parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch (e) {
      isLinkOk = false;
    }
  }

  let songValid = true;
  if (selectedEventId) {
    const allSongEmpty = !title && !artist && !link;
    const allSongFilled = !!(title && artist && link && isLinkOk);
    songValid = allSongEmpty || allSongFilled;
  }

  const namePhoneValid = !!(name && phone);

  let isValid = false;
  let errorMsg = '';

  if (!namePhoneValid) {
    errorMsg = 'Escribí tu nombre y WhatsApp (son obligatorios).';
  } else if (!songValid) {
    if (!title || !artist || !link) {
      errorMsg = 'Si completás la canción, debés llenar todos los campos (Canción, Artista y Link Karaoke).';
    } else if (!isLinkOk) {
      errorMsg = 'El link de karaoke debe ser una dirección web válida (ej: https://youtube.com/...).';
    }
  } else {
    isValid = true;
  }

  if (ck) {
    ck.style.display = (selectedEventId && title && artist && link && isLinkOk) ? 'flex' : 'none';
  }

  if (btn) {
    btn.disabled = !isValid;
  }

  if (errEl) {
    if (errorMsg) {
      errEl.textContent = errorMsg;
      errEl.style.display = 'block';
    } else {
      errEl.style.display = 'none';
    }
  }
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

  const updates = { name, whatsapp: phone, updatedAt: Date.now() };

  let ppl = 0;
  if (selectedEventId) {
    ppl    = parseInt(document.getElementById('prof-people-input')?.value) || 0;
    const title  = document.getElementById('s-title')?.value.trim();
    const artist = document.getElementById('s-artist')?.value.trim();
    const link   = document.getElementById('s-link')?.value.trim();
    
    // Validar capacidad
    const spots = getEventSpots(selectedEventId);
    const currentRes = allParticipants[currentPId]?.reservations?.[selectedEventId] || {};
    const isMigratedActive = (selectedEventId === 'event1' && (!allParticipants[currentPId]?.reservations || !allParticipants[currentPId]?.reservations.event1) && (allParticipants[currentPId]?.songConfirmed || (allParticipants[currentPId]?.people && allParticipants[currentPId]?.people > 0)));
    const currentPpl = isMigratedActive ? (allParticipants[currentPId]?.people || 0) : (currentRes.people || 0);
    const capacityLimit = spots.isLimited ? (spots.remaining + currentPpl) : 999999;
    
    if (spots.isLimited && ppl > capacityLimit) {
      if (errEl) {
        errEl.textContent = `Solo quedan ${capacityLimit} lugares disponibles. Modificá tu cantidad de invitados.`;
        errEl.style.display = 'block';
      }
      return;
    }
    
    let isLinkOk = false;
    if (link) {
      try {
        const parsed = new URL(link);
        isLinkOk = parsed.protocol === 'http:' || parsed.protocol === 'https:';
      } catch (e) {
        isLinkOk = false;
      }
    }

    const reservationUpdate = {
      people: ppl,
      songTitle: '',
      songArtist: '',
      song: '',
      karaokeLink: '',
      songConfirmed: false
    };

    if (title && artist && link && isLinkOk) {
      reservationUpdate.songTitle     = title;
      reservationUpdate.songArtist    = artist;
      reservationUpdate.song          = `${title} — ${artist}`;
      reservationUpdate.karaokeLink   = link;
      reservationUpdate.songConfirmed = true;
    }

    const oldRes = allParticipants[currentPId]?.reservations?.[selectedEventId] || {};
    Object.assign(reservationUpdate, {
      voteSong: oldRes.voteSong || 0,
      votePerf: oldRes.votePerf || 0,
      juryScoresSong: oldRes.juryScoresSong || {},
      juryScoresPerf: oldRes.juryScoresPerf || {},
      juryScoresHinchada: oldRes.juryScoresHinchada || {},
      juryScoresPublico: oldRes.juryScoresPublico || {},
      prizeSong: !!oldRes.prizeSong,
      prizePerf: !!oldRes.prizePerf,
      prizeHinchada: !!oldRes.prizeHinchada,
      prizePublicoSong: !!oldRes.prizePublicoSong,
      prizePublicoPerf: !!oldRes.prizePublicoPerf
    });

    updates[`reservations/${selectedEventId}`] = reservationUpdate;
    
    if (selectedEventId === 'event1') {
      updates.people        = 0;
      updates.songTitle     = '';
      updates.songArtist    = '';
      updates.karaokeLink   = '';
      updates.song          = '';
      updates.songConfirmed = false;
    }
  }

  if (btn) { btn.innerHTML = '<span class="spinner"></span> GUARDANDO...'; btn.disabled = true; }
  try {
    if (firebaseOk) {
      await dbUpdate(dbRef(db, `participants/${currentPId}`), updates);
    } else {
      const p = allParticipants[currentPId];
      p.name = name;
      p.whatsapp = phone;
      p.updatedAt = Date.now();
      if (selectedEventId) {
        if (!p.reservations) p.reservations = {};
        p.reservations[selectedEventId] = updates[`reservations/${selectedEventId}`];
        if (selectedEventId === 'event1') {
          p.people = 0;
          p.songTitle = '';
          p.songArtist = '';
          p.song = '';
          p.karaokeLink = '';
          p.songConfirmed = false;
        }
      }
      saveLocal();
    }
    if (allParticipants[currentPId]) {
      allParticipants[currentPId].name = name;
      allParticipants[currentPId].whatsapp = phone;
      if (selectedEventId) {
        if (!allParticipants[currentPId].reservations) allParticipants[currentPId].reservations = {};
        allParticipants[currentPId].reservations[selectedEventId] = updates[`reservations/${selectedEventId}`];
        if (selectedEventId === 'event1') {
          allParticipants[currentPId].people = 0;
          allParticipants[currentPId].songTitle = '';
          allParticipants[currentPId].songArtist = '';
          allParticipants[currentPId].song = '';
          allParticipants[currentPId].karaokeLink = '';
          allParticipants[currentPId].songConfirmed = false;
        }
      }
    }
    updateUI();
    if (selectedEventId && ppl > 0) {
      showReservationSuccess(ppl, selectedEventId);
    } else {
      resetRegisterPage();
    }
  } catch(e) {
    if (errEl) { errEl.textContent = 'Error al guardar. Intentá de nuevo.'; errEl.style.display = 'block'; }
    if (btn) { btn.innerHTML = '💾 GUARDAR Y SALIR'; btn.disabled = false; }
  }
}

function updateBackBtn() {
  const bar = document.getElementById('back-bar');
  if (!bar) return;
  const isShown = (MODE === 'home' && navStack.length > 0 && currentPage !== 'pantalla');
  bar.style.display = isShown ? 'block' : 'none';
  
  const bottomNavToggle = document.getElementById('mobile-nav-toggle-container');
  const isToggleVisible = bottomNavToggle && bottomNavToggle.style.display !== 'none';
  if (window.innerWidth < 992 && isToggleVisible) {
    bar.style.bottom = '56px';
  } else {
    bar.style.bottom = '0';
  }
}

function renderNav() { /* nav removed — navigation via buttons + back bar */ }

// ── FIREBASE ─────────────────────────────────────────────────────────────────
function initFirebase() {
  if (firebaseInitialized) return;
  if (window._db) {
    firebaseInitialized = true;
    db = window._db; dbRef = window._dbRef; dbSet = window._dbSet;
    dbGet = window._dbGet; dbOnValue = window._dbOnValue;
    dbPush = window._dbPush; dbUpdate = window._dbUpdate; dbRemove = window._dbRemove;
    firebaseOk = true;

    dbOnValue(dbRef(db, 'participants'), snap => {
      allParticipants = snap.val() || {};
      firebaseParticipantsLoaded = true;
      updateUI();
    });
    dbOnValue(dbRef(db, 'freeKaraoke'), snap => {
      freeKaraokeList = snap.val() || {};
      updateUI();
    });
    dbOnValue(dbRef(db, 'settings'), snap => {
      const s = snap.val() || {};
      firebaseSettingsLoaded = true;
      const ce = s.currentEvent || {};
      const currentEventName = ce.name || '';
      if (currentEventName !== lastEventName) {
        resetRevealedCategories();
        lastEventName = currentEventName;
      }
      bonusActive   = !!s.bonus;
      votingOpen    = !!s.votingOpen;
      showRunning   = !!s.showRunning;
      if (s.showRunning === undefined || s.showRunning === null) {
        showRunning = false;
      }

      const projectionActive = !!s.projectionActive;
      const isPC = window.innerWidth >= 992;
      if (isPC && MODE !== 'bar') {
        if (projectionActive && !lastProjectionActive) {
          if (!projectionWindowRef || projectionWindowRef.closed) {
            openProjectionWindow();
          }
        } else if (!projectionActive && lastProjectionActive) {
          if (projectionWindowRef && !projectionWindowRef.closed) {
            projectionWindowRef.close();
            projectionWindowRef = null;
          }
          if (projectionCheckInterval) {
            clearInterval(projectionCheckInterval);
            projectionCheckInterval = null;
          }
        }
      }
      if (MODE !== 'bar') {
        lastProjectionActive = projectionActive;
        updateProjectionButtonUI();
      }
      if (s.castYtVideo) {
        activeYtVideo = s.castYtVideo;
        if (MODE === 'admin' || MODE === 'home') {
          const titleEl = document.getElementById('yt-remote-title');
          const singerEl = document.getElementById('yt-remote-singer');
          const thumbEl = document.getElementById('yt-remote-thumb');
          if (titleEl) titleEl.textContent = s.castYtVideo.song;
          if (singerEl) singerEl.textContent = s.castYtVideo.title || s.castYtVideo.name;
          if (thumbEl) {
            thumbEl.innerHTML = `<img src="https://img.youtube.com/vi/${s.castYtVideo.ytId}/default.jpg" style="width:100%;height:100%;object-fit:cover">`;
          }
        }
      }

      if (MODE === 'admin' || MODE === 'home') {
        updatePlaybackModeUI();
        if (s.playerState) {
          isYtPlaying = (s.playerState === 'playing');
          updatePlayBtnIcon();
          renderPlaylistQueue();
        }
        
        const progressEl = document.getElementById('yt-remote-progress');
        const timeCurrentEl = document.getElementById('yt-remote-time-current');
        const timeDurationEl = document.getElementById('yt-remote-time-duration');
        
        if (s.playerDuration !== undefined && progressEl) {
          progressEl.max = Math.floor(s.playerDuration);
          if (timeDurationEl) timeDurationEl.textContent = formatTime(s.playerDuration);
        }
        if (s.playerTime !== undefined && progressEl) {
          progressEl.value = Math.floor(s.playerTime);
          if (timeCurrentEl) timeCurrentEl.textContent = formatTime(s.playerTime);
        }
      }

      if (s.customQueueItems) {
        const currentStr = JSON.stringify(customQueueItems);
        const newStr = JSON.stringify(s.customQueueItems);
        if (currentStr !== newStr) {
          customQueueItems = s.customQueueItems;
          if (adminLoggedIn) {
            renderPlaylistQueue();
          }
        }
      } else {
        if (customQueueItems.length > 0) {
          customQueueItems = [];
          if (adminLoggedIn) {
            renderPlaylistQueue();
          }
        }
      }

      localState.settings = { ...localState.settings, ...s };

      if (s.castLayout !== undefined) {
        const layoutChanged = (currentCastLayout !== s.castLayout);
        currentCastLayout = s.castLayout;
        if (MODE === 'admin' || MODE === 'home') {
          updateCastButtonsHighlight(s.castLayout);
        }
        if (MODE === 'pantalla' && !IS_BAR_PROJECTION && layoutChanged) {
          applyProyectorLayout(s.castLayout);
        }
      }

      if (s.screensaverActive !== undefined) {
        const changed = (screensaverActive !== !!s.screensaverActive);
        screensaverActive = !!s.screensaverActive;
        if (changed) {
          updateScreensaverUIState();
          if (MODE === 'pantalla' && !IS_BAR_PROJECTION) {
            if (screensaverActive) {
              startScreensaverTimer();
            } else {
              stopScreensaverTimer();
              if (s.castLayout) {
                applyProyectorLayout(s.castLayout);
              }
            }
          }
        }
      }

      // Fallback de Sincronización para Monitor Extendido (Pantalla)
      if (MODE === 'pantalla' && !IS_BAR_PROJECTION) {
        if (s.castYtVideo && s.castYtVideo.timestamp !== lastCastYtVideoTimestamp) {
          lastCastYtVideoTimestamp = s.castYtVideo.timestamp;
          if (projectionPlayer && projectionPlayerReady) {
            if (lastLoadedVideoId !== s.castYtVideo.ytId) {
              lastLoadedVideoId = s.castYtVideo.ytId;
              if (s.castYtVideo.autoPlay !== false) {
                projectionPlayer.loadVideoById(s.castYtVideo.ytId);
              } else {
                projectionPlayer.cueVideoById(s.castYtVideo.ytId);
              }
            }
          }
        }
        if (s.castYtCommand && s.castYtCommand.timestamp !== lastCastYtCommandTimestamp) {
          lastCastYtCommandTimestamp = s.castYtCommand.timestamp;
          const cmd = s.castYtCommand;
          if (projectionPlayer && projectionPlayerReady) {
            if (cmd.type === 'yt_play') {
              projectionPlayer.playVideo();
            } else if (cmd.type === 'yt_pause') {
              projectionPlayer.pauseVideo();
            } else if (cmd.type === 'yt_seek') {
              projectionPlayer.seekTo(cmd.time, true);
            }
          }
        }
        if (s.castYtVolume !== undefined && s.castYtVolume !== lastCastYtVolume) {
          lastCastYtVolume = s.castYtVolume;
          if (projectionPlayer && projectionPlayerReady) {
            projectionPlayer.setVolume(s.castYtVolume);
          }
        }
      }



      if (!showRunning) enforceNoShowState();
      checkAndMigrate();
      updateBonusBanners();
      handleVotingState();
      updateDashboard();
      updateUI();
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
  freeKaraokeList = localState.freeKaraoke || {};
  bonusActive     = !!localState.settings?.bonus;
  votingOpen      = !!localState.settings?.votingOpen;
  showRunning     = !!localState.settings?.showRunning;
  
  const ce = localState.settings?.currentEvent || {};
  const currentEventName = ce.name || '';
  if (currentEventName !== lastEventName) {
    resetRevealedCategories();
    lastEventName = currentEventName;
  }

  if (!showRunning) enforceNoShowState();
  checkAndMigrate();
  updateUI();
  setInterval(updateUI, 8000);
}

function saveLocal() {
  localState.participants = allParticipants;
  localState.freeKaraoke = freeKaraokeList;
  localStorage.setItem('micclub_data', JSON.stringify(localState));
  updateUI();
}

// ── MOTOR DE PUNTOS ──────────────────────────────────────────────────────────
function calcBaseScore(p) {
  const people = parseInt(p.people) || 0;
  const extra = parseInt(p.extraPts) || 0;
  const hasSong = !!p.songConfirmed;
  const hasPrizes = p.prizeSong || p.prizePerf || p.prizeHinchada || p.prizeMesa || p.prizePublicoSong || p.prizePublicoPerf;

  // Si no confirmó canción, no reservó lugares, no tiene extras ni premios, NO asistió a este show.
  if (!hasSong && people === 0 && extra === 0 && !hasPrizes) {
    return 0;
  }

  let pts = 5;                        // inscribirse al show
  pts += people;                      // 1 pt por cada reserva
  if (p.songConfirmed) pts += 3;      // canción elegida
  pts += extra;                       // extra manual del admin
  if (p.prizeSong) pts += 10;
  if (p.prizePerf) pts += 10;
  if (p.prizeHinchada) pts += 8;
  if (p.prizeMesa) pts += 8;
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

// ── MIGRACION & HELPER MULTI-EVENTO ──────────────────────────────────────────
let selectedEventId = null;
let eventSelectedManually = false;

function parseEventDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return 0;
  const parts = dateStr.split('/');
  if (parts.length !== 3) return 0;
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1; // 0-based
  const year = parseInt(parts[2], 10);
  return new Date(year, month, day).getTime();
}

function getClosestEvent(ev1, ev2) {
  if (!ev1 && !ev2) return null;
  if (ev1 && !ev2) return { ...ev1, id: 'event1' };
  if (!ev1 && ev2) return { ...ev2, id: 'event2' };
  
  const now = Date.now();
  const t1 = parseEventDate(ev1.date);
  const t2 = parseEventDate(ev2.date);
  
  const diff1 = Math.abs(t1 - now);
  const diff2 = Math.abs(t2 - now);
  
  if (diff1 <= diff2) {
    return { ...ev1, id: 'event1' };
  } else {
    return { ...ev2, id: 'event2' };
  }
}

let adminSelectedEventSlot = null;
function getAdminActiveEventId() {
  if (adminSelectedEventSlot === 'event1' || adminSelectedEventSlot === 'event2') {
    return adminSelectedEventSlot;
  }
  return getCurrentEventId();
}

function getCurrentEventId() {
  const manualActiveSlot = localState.settings?.activeEventSlot;
  if (manualActiveSlot === 'event1' || manualActiveSlot === 'event2') {
    if (localState.settings?.events?.[manualActiveSlot]) {
      return manualActiveSlot;
    }
  }
  const ev1 = localState.settings?.events?.event1;
  const ev2 = localState.settings?.events?.event2;
  const closest = getClosestEvent(ev1, ev2);
  return closest ? closest.id : null;
}

function getParticipantForEvent(p, eventId) {
  if (!p) return p;
  const res = p.reservations?.[eventId] || {};
  const isMigratedActive = (eventId === 'event1' && (!p.reservations || !p.reservations.event1) && (p.songConfirmed || (p.people && p.people > 0)));
  
  const targetRes = isMigratedActive ? p : res;
  const publicVotes = targetRes.publicVotes || {};
  let calculatedVoteSong = 0;
  let calculatedVotePerf = 0;
  let hasPublicVotes = false;
  Object.values(publicVotes).forEach(v => {
    hasPublicVotes = true;
    if (v.song) calculatedVoteSong++;
    if (v.perf) calculatedVotePerf++;
  });
  
  const voteSongVal = hasPublicVotes ? calculatedVoteSong : (targetRes.voteSong ?? 0);
  const votePerfVal = hasPublicVotes ? calculatedVotePerf : (targetRes.votePerf ?? 0);

  if (isMigratedActive) {
    return {
      ...p,
      voteSong: voteSongVal,
      votePerf: votePerfVal
    };
  }
  
  return {
    ...p,
    people: res.people ?? 0,
    songTitle: res.songTitle || '',
    songArtist: res.songArtist || '',
    song: res.song || '',
    karaokeLink: res.karaokeLink || '',
    songConfirmed: !!res.songConfirmed,
    voteSong: voteSongVal,
    votePerf: votePerfVal,
    juryScoresSong: res.juryScoresSong || {},
    juryScoresPerf: res.juryScoresPerf || {},
    juryScoresHinchada: res.juryScoresHinchada || {},
    prizeSong: !!res.prizeSong,
    prizePerf: !!res.prizePerf,
    prizeHinchada: !!res.prizeHinchada,
    prizeMesa: !!res.prizeMesa,
    prizePublicoSong: !!res.prizePublicoSong,
    prizePublicoPerf: !!res.prizePublicoPerf
  };
}

function getEnrichedParticipantsList(eventId) {
  if (!allParticipants) return [];
  return Object.entries(allParticipants).map(([id, p]) => {
    return getParticipantForEvent({ ...p, id }, eventId);
  });
}

function getEventSpots(eventId) {
  const ev = localState.settings?.events?.[eventId];
  if (!ev) {
    return { isLimited: false, remaining: 999999, total: 0, reserved: 0 };
  }
  
  const capacity = parseInt(ev.capacity) || 0;
  const isLimited = capacity > 0;
  
  let reserved = 0;
  Object.values(allParticipants).forEach(p => {
    const res = p.reservations?.[eventId] || {};
    const isMigratedActive = (eventId === 'event1' && (!p.reservations || !p.reservations.event1) && (p.songConfirmed || (p.people && p.people > 0)));
    const pPpl = isMigratedActive ? (p.people || 0) : (res.people || 0);
    reserved += parseInt(pPpl) || 0;
  });
  
  const remaining = isLimited ? Math.max(0, capacity - reserved) : 999999;
  
  return {
    isLimited,
    total: capacity,
    reserved,
    remaining
  };
}

let migrationChecked = false;
async function checkAndMigrate() {
  if (migrationChecked) return;
  migrationChecked = true;
  
  const currentEvent = localState.settings?.currentEvent;
  const events = localState.settings?.events;
  
  if (currentEvent && currentEvent.name && (!events || !events.event1)) {
    console.log("Starting legacy event migration to event1 slot...");
    const ev1 = {
      ...currentEvent,
      id: 'event1',
      capacity: parseInt(currentEvent.capacity) || 0
    };
    
    const updates = {};
    updates['settings/events/event1'] = ev1;
    
    Object.keys(allParticipants).forEach(id => {
      const p = allParticipants[id];
      if ((p.songConfirmed || (p.people && p.people > 0) || p.prizeSong || p.prizePerf || p.prizeHinchada || p.prizeMesa) && (!p.reservations || !p.reservations.event1)) {
        const res = {
          people: p.people || 0,
          songTitle: p.songTitle || '',
          songArtist: p.songArtist || '',
          song: p.song || '',
          karaokeLink: p.karaokeLink || '',
          songConfirmed: !!p.songConfirmed,
          voteSong: p.voteSong || 0,
          votePerf: p.votePerf || 0,
          juryScoresSong: p.juryScoresSong || {},
          juryScoresPerf: p.juryScoresPerf || {},
          juryScoresHinchada: p.juryScoresHinchada || {},
          prizeSong: !!p.prizeSong,
          prizePerf: !!p.prizePerf,
          prizeHinchada: !!p.prizeHinchada,
          prizeMesa: !!p.prizeMesa,
          prizePublicoSong: !!p.prizePublicoSong,
          prizePublicoPerf: !!p.prizePublicoPerf
        };
        updates[`participants/${id}/reservations/event1`] = res;
      }
    });
    
    if (firebaseOk) {
      try {
        await dbUpdate(dbRef(db), updates);
        console.log("Migration to event1 successfully written to Firebase.");
      } catch(e) {
        console.error("Migration failed:", e);
      }
    } else {
      if (!localState.settings) localState.settings = {};
      localState.settings.events = { event1: ev1 };
      Object.keys(allParticipants).forEach(id => {
        const p = allParticipants[id];
        if ((p.songConfirmed || (p.people && p.people > 0) || p.prizeSong || p.prizePerf || p.prizeHinchada || p.prizeMesa) && (!p.reservations || !p.reservations.event1)) {
          if (!p.reservations) p.reservations = {};
          p.reservations.event1 = {
            people: p.people || 0,
            songTitle: p.songTitle || '',
            songArtist: p.songArtist || '',
            song: p.song || '',
            karaokeLink: p.karaokeLink || '',
            songConfirmed: !!p.songConfirmed,
            voteSong: p.voteSong || 0,
            votePerf: p.votePerf || 0,
            juryScoresSong: p.juryScoresSong || {},
            juryScoresPerf: p.juryScoresPerf || {},
            juryScoresHinchada: p.juryScoresHinchada || {},
            prizeSong: !!p.prizeSong,
            prizePerf: !!p.prizePerf,
            prizeHinchada: !!p.prizeHinchada,
            prizeMesa: !!p.prizeMesa,
            prizePublicoSong: !!p.prizePublicoSong,
            prizePublicoPerf: !!p.prizePublicoPerf
          };
        }
      });
      saveLocal();
      console.log("Local migration to event1 complete.");
    }
  }
}

function getJuryTotalForPart(p, cat) {
  if (!p) return 0;
  let scores;
  if      (cat === 'song')     scores = p.juryScoresSong     || {};
  else if (cat === 'perf')     scores = p.juryScoresPerf     || {};
  else if (cat === 'hinchada') scores = p.juryScoresHinchada || {};
  else return 0;

  const vals = Object.values(scores);
  if (!vals.length) return 0;
  if (typeof vals[0] === 'object' && vals[0] !== null) {
    return vals.reduce((total, js) =>
      total + Object.values(js).reduce((s, v) => s + (parseInt(v) || 0), 0), 0);
  }
  return vals.reduce((s, v) => s + (parseInt(v) || 0), 0);
}

function getJuryTotal(pid, cat, eventId = null) {
  const activeEventId = eventId || getCurrentEventId();
  const p = allParticipants[pid];
  if (!p) return 0;
  const pEvent = activeEventId ? getParticipantForEvent(p, activeEventId) : p;
  return getJuryTotalForPart(pEvent, cat);
}

function getPodiumRanksAndPoints(parts, scoreGetter) {
  const items = parts
    .map(p => ({ id: p.id, name: p.name, score: scoreGetter(p), song: p.songTitle || p.song || '' }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score);

  const results = [];
  let currentRank = 0;
  let currentScore = -1;
  
  items.forEach((item, index) => {
    if (item.score !== currentScore) {
      currentRank = index + 1;
      currentScore = item.score;
    }
    
    let pts = 0;
    if (currentRank === 1) pts = 5;
    else if (currentRank === 2) pts = 3;
    else if (currentRank === 3) pts = 2;
    
    results.push({ ...item, rank: currentRank, podiumPts: pts });
  });
  
  return results;
}

function getEventScores(partsObjOrArr) {
  const parts = Array.isArray(partsObjOrArr)
    ? partsObjOrArr
    : Object.entries(partsObjOrArr).map(([id, p]) => ({ ...p, id }));
  
  // Calculate podiums
  const pubSongPodium = getPodiumRanksAndPoints(parts, p => parseInt(p.voteSong) || 0);
  const pubPerfPodium = getPodiumRanksAndPoints(parts, p => parseInt(p.votePerf) || 0);
  const jurySongPodium = getPodiumRanksAndPoints(parts, p => getJuryTotalForPart(p, 'song'));
  const juryPerfPodium = getPodiumRanksAndPoints(parts, p => getJuryTotalForPart(p, 'perf'));
  const juryHinchadaPodium = getPodiumRanksAndPoints(parts, p => getJuryTotalForPart(p, 'hinchada'));
  
  const scores = {};
  
  parts.forEach(p => {
    scores[p.id] = {
      base: calcBaseScore(p),
      votes: (parseInt(p.voteSong) || 0) + (parseInt(p.votePerf) || 0),
      pubSongPts: 0,
      pubPerfPts: 0,
      jurySongPts: 0,
      juryPerfPts: 0,
      juryHinchadaPts: 0,
      total: 0
    };
  });
  
  pubSongPodium.forEach(x => { scores[x.id].pubSongPts = x.podiumPts; });
  pubPerfPodium.forEach(x => { scores[x.id].pubPerfPts = x.podiumPts; });
  jurySongPodium.forEach(x => { scores[x.id].jurySongPts = x.podiumPts; });
  juryPerfPodium.forEach(x => { scores[x.id].juryPerfPts = x.podiumPts; });
  juryHinchadaPodium.forEach(x => { scores[x.id].juryHinchadaPts = x.podiumPts; });
  
  parts.forEach(p => {
    const s = scores[p.id];
    s.total = s.base + s.pubSongPts + s.pubPerfPts + s.jurySongPts + s.juryPerfPts + s.juryHinchadaPts;
  });
  
  return scores;
}

function enrichHistorySnapshot(snap) {
  const eventScores = getEventScores(snap);
  Object.keys(snap).forEach(id => {
    const p = snap[id];
    const s = eventScores[id] || {};
    p.eventVotesPublico = (parseInt(p.voteSong) || 0) + (parseInt(p.votePerf) || 0);
    p.eventJuryTotal = getJuryTotalForPart(p, 'song') + getJuryTotalForPart(p, 'perf') + getJuryTotalForPart(p, 'hinchada');
    p.eventMicclubPts = s.total || calcBaseScore(p);
  });
  return snap;
}

let lastScoresCache = {};
let lastScoresCacheTime = 0;

function getCachedEventScores(eventId) {
  const now = Date.now();
  const cacheKey = eventId + '_' + Object.keys(allParticipants || {}).length;
  if (lastScoresCache[cacheKey] && now - lastScoresCacheTime < 100) {
    return lastScoresCache[cacheKey];
  }
  const parts = getEnrichedParticipantsList(eventId);
  const scores = getEventScores(parts);
  lastScoresCache[cacheKey] = scores;
  lastScoresCacheTime = now;
  return scores;
}

function calcScore(p, eventId = null) {
  const pid = p.id || Object.keys(allParticipants).find(k => allParticipants[k] === p);
  if (!pid) return calcBaseScore(p);
  const activeEventId = eventId || getCurrentEventId();
  if (!activeEventId) return calcBaseScore(p);
  const scores = getCachedEventScores(activeEventId);
  return scores[pid]?.total ?? calcBaseScore(p);
}

function calcMicclubScore(p) {
  let score = parseInt(p.micclubPts) || 0;
  if (localState.settings?.events?.event1) {
    score += calcScore(p, 'event1');
  }
  if (localState.settings?.events?.event2) {
    score += calcScore(p, 'event2');
  }
  return score;
}

function sorted(eventId = null) {
  const activeEventId = eventId || getCurrentEventId();
  if (!activeEventId) return [];
  return getEnrichedParticipantsList(activeEventId)
    .map(p => {
      p.score = calcScore(p, activeEventId);
      return p;
    })
    .sort((a, b) => b.score - a.score);
}

function sortedMicclub(eventId = null) {
  const activeEventId = eventId || getCurrentEventId();
  return Object.entries(allParticipants)
    .map(([id, p]) => {
      const pEvent = activeEventId ? getParticipantForEvent(p, activeEventId) : p;
      const enriched = { ...pEvent, id };
      enriched.score = calcMicclubScore(enriched, activeEventId);
      return enriched;
    })
    .sort((a, b) => b.score - a.score);
}


function getJuryLeader(cat, eventId = null) {
  const activeEventId = eventId || getCurrentEventId();
  if (!activeEventId) return null;
  const parts = getEnrichedParticipantsList(activeEventId);
  if (!parts.length) return null;
  return parts
    .map(p => ({ id: p.id, name: p.name, score: getJuryTotal(p.id, cat, activeEventId) }))
    .sort((a, b) => b.score - a.score)[0];
}

function updateRegistrationPageUI() {
  if (currentPage !== 'register') return;
  if (showingReservationSuccess) return;
  
  const gate = document.getElementById('reg-email-gate');
  const selector = document.getElementById('reg-event-selector');
  const banner = document.getElementById('reg-cupo-banner');
  const gateTitle = document.getElementById('register-page-title');
  const gateSub = document.getElementById('register-page-sub');
  const rEmailBtn = document.getElementById('reg-email-btn');
  
  const ev1 = localState.settings?.events?.event1;
  const ev2 = localState.settings?.events?.event2;

  // Si Firebase está activo y ya cargó sus settings, y además detectamos que hay
  // múltiples eventos activos en la base de datos real, pero el selectedEventId
  // se había auto-seleccionado (no manual), reseteamos para mostrar el selector.
  if (firebaseOk && firebaseSettingsLoaded) {
    if (ev1 && ev2 && selectedEventId && !eventSelectedManually) {
      selectedEventId = null;
    }
  }
  
  if (selectedEventId) {
    if (selector) selector.style.display = 'none';
    if (gate) {
      gate.style.display = 'block';
      if (gateTitle) {
        gateTitle.textContent = 'RESERVA';
      }
      if (gateSub) {
        gateSub.textContent = 'Tu perfil · Canción · Puntos';
      }
      if (rEmailBtn) rEmailBtn.disabled = false;
    }
    updateRegistrationCupoBanner();
  } else {
    if (ev1 && ev2) {
      if (selector) selector.style.display = 'block';
      if (gate) gate.style.display = 'none';
      if (banner) banner.style.display = 'none';
      if (gateTitle) {
        gateTitle.textContent = 'RESERVA';
      }
      if (gateSub) {
        gateSub.textContent = 'Tu perfil · Canción · Puntos';
      }
      renderRegistrationEventSelectorList(ev1, ev2);
    } else if (ev1) {
      if (!firebaseOk || firebaseSettingsLoaded) {
        selectRegistrationEvent('event1', false);
      }
    } else if (ev2) {
      if (!firebaseOk || firebaseSettingsLoaded) {
        selectRegistrationEvent('event2', false);
      }
    } else {
      const hasLoadedSettings = firebaseOk ? firebaseSettingsLoaded : (localState.settings && Object.keys(localState.settings).length > 0);
      if (hasLoadedSettings && !ev1 && !ev2) {
        if (selector) selector.style.display = 'none';
        if (gate) {
          gate.style.display = 'block';
          if (gateTitle) gateTitle.textContent = 'NO HAY EVENTOS';
          if (gateSub) gateSub.textContent = 'No hay shows activos en curso en este momento';
          if (rEmailBtn) rEmailBtn.disabled = true;
        }
      } else {
        if (selector) selector.style.display = 'none';
        if (gate) {
          gate.style.display = 'block';
          if (gateTitle) gateTitle.textContent = 'CARGANDO...';
          if (gateSub) gateSub.textContent = 'Buscando eventos activos...';
          if (rEmailBtn) rEmailBtn.disabled = true;
        }
      }
    }
  }

  // Renderizar auspiciantes en la página de reserva
  const sponsors = localState.settings?.sponsors || [];
  const sponsorsHtml = sponsors.map(sp => `
    <a href="${esc(sp.link || '#')}" target="_blank" style="display:inline-block">
      <img src="${sp.img}" style="width:62px;height:62px;object-fit:cover;border-radius:6px;border:1px solid rgba(255,255,255,0.1)">
    </a>
  `).join('');
  const elSponsorsReg = document.getElementById('register-sponsors');
  if (elSponsorsReg) {
    elSponsorsReg.innerHTML = sponsorsHtml || '<div style="font-size:11px;color:var(--text2);text-align:center;width:100%;padding:10px">Sin auspiciantes cargados</div>';
  }
}

let lastPantallaStateHash = '';
function getPantallaStateHash() {
  const activeEventId = getCurrentEventId();
  const ev = activeEventId ? (localState.settings?.events?.[activeEventId] || null) : null;
  const guestArtists = ev?.guestArtists || [];
  
  // Participantes del evento actual con sus votos e información
  const parts = getEnrichedParticipantsList(activeEventId)
    .map(p => `${p.id}:${p.name}:${p.song}:${p.songConfirmed}:${p.micclubPts}:${p.voteSong || 0}:${p.votePerf || 0}:${JSON.stringify(p.votes || {})}:${JSON.stringify(p.juryVotes || {})}`);

  // Ranking general (participantes y sus puntos acumulados)
  const allParts = Object.values(allParticipants || {})
    .map(p => `${p.id}:${p.name}:${calcMicclubScore(p)}`)
    .sort()
    .join('|');
  
  const votingCols = JSON.stringify(localState.settings?.votingVisibleColumns || {});
  const nextEventImg = localState.settings?.nextEventImage || '';
  const freeList = JSON.stringify(activeEventId ? (freeKaraokeList[activeEventId] || {}) : {});
  
  return [
    pantallaTab,
    JSON.stringify(guestArtists),
    parts.join('|'),
    allParts,
    votingCols,
    nextEventImg,
    freeList,
    screensaverActive
  ].join('##');
}

// ── UI CENTRAL ────────────────────────────────────────────────────────────────
function updateUI() {
  updateCastButtonsHighlight(currentCastLayout);
  updateVotingVisibleColumnsButtonsUI();
  updateDashboard();
  updateProgramPage();
  updateStats();
  updateLeader();
  updateRanking();
  updateShowMode();
  updateBonusBanners();
  handleVotingState();
  updateEventInfoBanners();
  if (MODE === 'vote') loadPublicVoteOpts();
  if (adminLoggedIn) { 
    renderAdminParticipants(); 
    renderAdminJury(); 
    updateAdminNextEventPreview();
    renderPlaylistQueue();
    renderAdminEventSelectorBar();
  }
  if (MODE === 'jury') { renderJurySelectors(); }
  if (currentPage === 'config') renderConfigParticipants();
  if (currentPage === 'register') updateRegistrationPageUI();
  if (currentPage === 'admin-micclub-participants') renderAdminMicClubParticipants();
  if (currentPage === 'pantalla' || MODE === 'pantalla') {
    const currentHash = getPantallaStateHash();
    if (currentHash !== lastPantallaStateHash) {
      lastPantallaStateHash = currentHash;
      renderPantallaContent();
      updatePantallaSponsors();
    }
  }
  renderLinks();
  updateFreeKaraokePages();
  updatePlaybackModeUI();

  // Renderizar auspiciantes en la página de reserva
  const sponsors = localState.settings?.sponsors || [];
  const sponsorsHtml = sponsors.map(sp => `
    <a href="${esc(sp.link || '#')}" target="_blank" style="display:inline-block">
      <img src="${sp.img}" style="width:62px;height:62px;object-fit:cover;border-radius:6px;border:1px solid rgba(255,255,255,0.1)">
    </a>
  `).join('');
  const elSponsorsReg = document.getElementById('register-sponsors');
  if (elSponsorsReg) {
    elSponsorsReg.innerHTML = sponsorsHtml || '<div style="font-size:11px;color:var(--text2);text-align:center;width:100%;padding:10px">Sin auspiciantes cargados</div>';
  }

  // Renderizar auspiciantes en la página de administración (columna derecha)
  const elSponsorsAdmin = document.getElementById('admin-page-sponsors');
  if (elSponsorsAdmin) {
    const adminSponsorsHtml = sponsors.map(sp => `
      <a href="${esc(sp.link || '#')}" target="_blank" style="display:inline-block;margin-bottom:6px">
        <img src="${sp.img}" style="width:75px;height:75px;object-fit:cover;border-radius:6px;border:1px solid rgba(255,255,255,0.1)">
      </a>
    `).join('');
    elSponsorsAdmin.innerHTML = adminSponsorsHtml || '<div style="font-size:11px;color:var(--text2)">Sin auspiciantes</div>';
  }

  // Controlar barra de navegación inferior móvil
  updateMobileLayout();
  updateBackBtn();
}

let programSelectedEventId = null;
function setProgramEventTab(slot) {
  programSelectedEventId = slot;
  updateProgramPage();
}
window.setProgramEventTab = setProgramEventTab;

function handleProgramVoteClick() {
  if (votingOpen) {
    navPush('vote-public');
  } else {
    showTemporaryAlert("La votación aún no está abierta", 2000);
  }
}
window.handleProgramVoteClick = handleProgramVoteClick;

function updateProgramPage() {
  const nameEl = document.getElementById('program-event-name');
  const detailsEl = document.getElementById('program-event-details');
  const voteBtn = document.getElementById('program-vote-btn');
  
  if (voteBtn) {
    if (votingOpen) {
      voteBtn.className = 'btn btn-green';
      voteBtn.textContent = 'VOTACIÓN ABIERTA - VOTAR AHORA';
    } else {
      voteBtn.className = 'btn btn-red';
      voteBtn.textContent = 'VOTACIÓN CERRADA';
    }
  }
  
  const ev1 = localState.settings?.events?.event1;
  const ev2 = localState.settings?.events?.event2;
  
  // Mostrar u ocultar el selector según si hay 2 eventos activos
  const toggleWrap = document.getElementById('program-event-toggle-wrap');
  if (toggleWrap) {
    if (ev1 && ev2) {
      toggleWrap.style.display = 'flex';
    } else {
      toggleWrap.style.display = 'none';
    }
  }

  // Inicializar el slot seleccionado si está vacío o inactivo
  const currentActiveId = getCurrentEventId();
  if (!programSelectedEventId || !localState.settings?.events?.[programSelectedEventId]) {
    programSelectedEventId = currentActiveId;
  }
  
  // Actualizar estados visuales de los botones de pestañas del selector de programa
  const btn1 = document.getElementById('program-tab-ev1');
  const btn2 = document.getElementById('program-tab-ev2');
  if (btn1) {
    btn1.classList.toggle('active', programSelectedEventId === 'event1');
    btn1.textContent = ev1 ? (ev1.name || 'Evento 1') : 'Evento 1';
  }
  if (btn2) {
    btn2.classList.toggle('active', programSelectedEventId === 'event2');
    btn2.textContent = ev2 ? (ev2.name || 'Evento 2') : 'Evento 2';
  }

  const ev = programSelectedEventId ? (localState.settings?.events?.[programSelectedEventId] || null) : null;
  const eventDate = ev?.date || '';
  if (nameEl) nameEl.textContent = ev?.name ? ev.name : 'Próximo Evento';
  if (detailsEl) {
    detailsEl.style.display = 'block';
    detailsEl.textContent = ev
      ? [eventDate, ev.time, ev.venue].filter(Boolean).join(' · ')
      : 'No hay show activo en curso';
  }
  
  const listWrap = document.getElementById('program-participants-list-wrap');
  const countEl  = document.getElementById('program-participants-count');
  const regBtn   = document.getElementById('program-register-btn');
  
  if (showRunning && programSelectedEventId === currentActiveId) {
    if (regBtn) regBtn.style.display = 'flex';
    const dateEl = document.getElementById('program-reg-event-date');
    if (dateEl) dateEl.textContent = eventDate ? `(${eventDate})` : '';
  } else {
    if (regBtn) regBtn.style.display = 'none';
  }

  const queue = getConsolidatedQueue(programSelectedEventId);
  const queueIds = queue.filter(item => item.source === 'micclub').map(item => item.id);

  const parts = getEnrichedParticipantsList(programSelectedEventId)
    .filter(p => p.songConfirmed)
    .sort((a, b) => {
      let idxA = queueIds.indexOf(a.id);
      let idxB = queueIds.indexOf(b.id);
      if (idxA === -1) idxA = 9999;
      if (idxB === -1) idxB = 9999;
      if (idxA !== idxB) return idxA - idxB;
      const tA = a.timestamp || 0;
      const tB = b.timestamp || 0;
      if (tA !== tB) return tA - tB;
      return a.id.localeCompare(b.id);
    });

  if (listWrap) listWrap.style.display = (parts.length > 0) ? 'block' : 'none';
  if (countEl) countEl.textContent = parts.length;

  const partsHtml = parts.map((p, index) => {
    const songLabel = p.songTitle ? `${esc(p.songTitle)}${p.songArtist ? ' — ' + esc(p.songArtist) : ''}` : '—';
    const isLast = index === parts.length - 1;
    const borderStyle = isLast ? '' : 'border-bottom:1px solid rgba(255,255,255,.03);';
    return `<div style="padding:8px 0;${borderStyle}font-size:13px;display:flex;justify-content:space-between;align-items:center">
      <span style="font-weight:600;color:var(--text)">${index + 1}. ${esc(p.name)}</span>
      <span style="color:var(--text2);font-size:11px;text-align:right;max-width:60%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${songLabel}</span>
    </div>`;
  }).join('');
  const elParts = document.getElementById('program-participants-list');
  if (elParts) elParts.innerHTML = partsHtml || '<div style="font-size:12px;color:var(--text2);text-align:center;padding:10px">Esperando confirmación de participantes...</div>';

  // Renderizar Auspiciantes (sponsors) en el portal público del programa (grilla superior e inferior)
  const sponsors = localState.settings?.sponsors || [];
  const sponsorsHtml = sponsors.map(sp => `
    <a href="${esc(sp.link || '#')}" target="_blank" style="display:inline-block">
      <img src="${sp.img}" style="width:62px;height:62px;object-fit:cover;border-radius:6px;border:1px solid rgba(255,255,255,0.1)">
    </a>
  `).join('');
  const elSponsors = document.getElementById('program-sponsors-top');
  if (elSponsors) elSponsors.innerHTML = sponsorsHtml || '<div style="font-size:11px;color:var(--text2);text-align:center;width:100%;padding:10px">Sin auspiciantes cargados</div>';
  const elSponsorsBottom = document.getElementById('program-sponsors-bottom');
  if (elSponsorsBottom) elSponsorsBottom.innerHTML = sponsorsHtml || '<div style="font-size:11px;color:var(--text2);text-align:center;width:100%;padding:10px">Sin auspiciantes cargados</div>';

  // Renderizar Artistas Invitados en el portal público del programa
  const artists = ev?.guestArtists || [];
  const elArtists = document.getElementById('program-guest-artists');
  if (elArtists) {
    if (artists.length > 0) {
      elArtists.innerHTML = artists.map(art => {
        const name = typeof art === 'object' ? art.name : art;
        const song = typeof art === 'object' ? art.song : '';
        return `
          <div style="padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.03); display: flex; justify-content: space-between; align-items: center; font-size: 13px;">
            <span style="font-weight: 600; color: var(--text)">${esc(name)}</span>
            <span style="color: var(--gold); font-size: 11px; font-weight: 500">${esc(song || 'Repertorio Especial')}</span>
          </div>
        `;
      }).join('');
    } else {
      elArtists.innerHTML = '<div style="font-size:12px;color:var(--text2);text-align:center;padding:10px">No hay artistas invitados cargados aún...</div>';
    }
  }

  updateFreeKaraokePages();
  renderProgramAdminPanel();
}

function renderProgramAdminPanel() {
  const panel = document.getElementById('program-admin-panel');
  if (!panel) return;
  if (!adminLoggedIn) {
    panel.style.display = 'none';
    return;
  }
  panel.style.display = 'block';
  
  const eventId = programSelectedEventId || getCurrentEventId();
  const ev = eventId ? (localState.settings?.events?.[eventId] || null) : null;
  
  const sponsors = localState.settings?.sponsors || [];
  const artists = ev?.guestArtists || [];
  
  const sponsorsHtml = sponsors.map((sp, idx) => `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;background:var(--bg3);padding:6px;border-radius:6px;border:1px solid rgba(255,255,255,0.02)">
      <img src="${sp.img}" style="width:40px;height:40px;object-fit:cover;border-radius:4px">
      <span style="flex:1;font-size:11px;color:var(--text2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(sp.link || 'Sin link')}</span>
      <button class="btn btn-sm btn-outline" style="border-color:var(--red);color:var(--red);padding:4px 8px;min-height:auto;font-size:11px;margin-left:auto" onclick="deleteSponsorAdmin(${idx})">Eliminar</button>
    </div>
  `).join('');
  
  const artistsHtml = artists.map((art, idx) => {
    const name = typeof art === 'object' ? art.name : art;
    const song = typeof art === 'object' ? art.song : '';
    const display = song ? `${name} - ${song}` : name;
    return `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;background:var(--bg3);padding:6px;border-radius:6px;border:1px solid rgba(255,255,255,0.02)">
        <span style="flex:1;font-size:12px;color:var(--text)">${esc(display)}</span>
        <button class="btn btn-sm btn-outline" style="border-color:var(--red);color:var(--red);padding:4px 8px;min-height:auto;font-size:11px;margin-left:auto" onclick="deleteGuestArtistAdmin(${idx})">Eliminar</button>
      </div>
    `;
  }).join('');
  
  document.getElementById('admin-sponsors-list').innerHTML = sponsorsHtml || '<div style="font-size:11px;color:var(--text2);text-align:center;padding:10px">Sin auspiciantes</div>';
  document.getElementById('admin-artists-list').innerHTML = artistsHtml || '<div style="font-size:11px;color:var(--text2);text-align:center;padding:10px">Sin artistas invitados</div>';
}

function addSponsorAdmin() {
  const fileIn = document.getElementById('sponsor-file');
  const linkIn = document.getElementById('sponsor-link');
  const link = (linkIn?.value || '').trim();
  
  if (!fileIn || !fileIn.files || !fileIn.files[0]) {
    mcAlert('Por favor selecciona una imagen.');
    return;
  }
  
  const file = fileIn.files[0];
  const reader = new FileReader();
  reader.onload = function(e) {
    const img = new Image();
    img.src = e.target.result;
    img.onload = async function() {
      const canvas = document.createElement('canvas');
      const maxDim = 256;
      let w = img.width;
      let h = img.height;
      if (w > h) {
        if (w > maxDim) { h = Math.round(h * maxDim / w); w = maxDim; }
      } else {
        if (h > maxDim) { w = Math.round(w * maxDim / h); h = maxDim; }
      }
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
      
      const sponsors = localState.settings?.sponsors || [];
      sponsors.push({ img: compressedBase64, link });
      
      try {
        if (firebaseOk) {
          await dbUpdate(dbRef(db, 'settings'), { sponsors });
        } else {
          localState.settings.sponsors = sponsors;
          saveLocal();
        }
        fileIn.value = '';
        if (linkIn) linkIn.value = '';
        updateProgramPage();
        mcAlert('Auspiciante agregado con éxito.');
      } catch(err) {
        console.error(err);
        mcAlert('Error al guardar.');
      }
    };
  };
  reader.readAsDataURL(file);
}

async function deleteSponsorAdmin(idx) {
  const sponsors = localState.settings?.sponsors || [];
  sponsors.splice(idx, 1);
  try {
    if (firebaseOk) {
      await dbUpdate(dbRef(db, 'settings'), { sponsors });
    } else {
      localState.settings.sponsors = sponsors;
      saveLocal();
    }
    updateProgramPage();
  } catch(err) {
    console.error(err);
  }
}

async function addGuestArtistAdmin() {
  const nameInp = document.getElementById('artist-name-input');
  const songInp = document.getElementById('artist-songs-input');
  const linkInp = document.getElementById('artist-link-input');
  const name = (nameInp?.value || '').trim();
  const song = (songInp?.value || '').trim();
  const link = (linkInp?.value || '').trim();
  if (!name) return;
  
  const eventId = programSelectedEventId || getCurrentEventId();
  if (!eventId) return;
  const ev = localState.settings?.events?.[eventId];
  if (!ev) return;
  
  const artists = ev.guestArtists || [];
  artists.push({ name, song, link });
  try {
    if (firebaseOk) {
      await dbUpdate(dbRef(db, `settings/events/${eventId}`), { guestArtists: artists });
    } else {
      ev.guestArtists = artists;
      saveLocal();
    }
    nameInp.value = '';
    if (songInp) songInp.value = '';
    if (linkInp) linkInp.value = '';
    updateProgramPage();
    mcAlert('Artista agregado.');
  } catch(err) {
    console.error(err);
  }
}

async function deleteGuestArtistAdmin(idx) {
  const eventId = programSelectedEventId || getCurrentEventId();
  if (!eventId) return;
  const ev = localState.settings?.events?.[eventId];
  if (!ev) return;
  
  const artists = ev.guestArtists || [];
  artists.splice(idx, 1);
  try {
    if (firebaseOk) {
      await dbUpdate(dbRef(db, `settings/events/${eventId}`), { guestArtists: artists });
    } else {
      ev.guestArtists = artists;
      saveLocal();
    }
    updateProgramPage();
  } catch(err) {
    console.error(err);
  }
}

async function uploadNextEventImage() {
  const fileIn = document.getElementById('next-event-file');
  if (!fileIn || !fileIn.files || !fileIn.files[0]) {
    mcAlert('Por favor selecciona una imagen.');
    return;
  }
  
  const file = fileIn.files[0];
  const reader = new FileReader();
  reader.onload = function(e) {
    const img = new Image();
    img.src = e.target.result;
    img.onload = async function() {
      const canvas = document.createElement('canvas');
      const maxDim = 800;
      let w = img.width;
      let h = img.height;
      if (w > h) {
        if (w > maxDim) { h = Math.round(h * maxDim / w); w = maxDim; }
      } else {
        if (h > maxDim) { w = Math.round(w * maxDim / h); h = maxDim; }
      }
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
      
      try {
        if (firebaseOk) {
          await dbUpdate(dbRef(db, 'settings'), { nextEventImage: compressedBase64 });
        } else {
          if (!localState.settings) localState.settings = {};
          localState.settings.nextEventImage = compressedBase64;
          saveLocal();
        }
        fileIn.value = '';
        updateAdminNextEventPreview();
        if (currentPage === 'pantalla') renderPantallaContent();
        mcAlert('✅ Imagen del próximo evento cargada con éxito.');
      } catch(err) {
        console.error(err);
        mcAlert('Error al guardar la imagen.');
      }
    };
  };
  reader.readAsDataURL(file);
}

async function deleteNextEventImage() {
  mcConfirm('¿Eliminar la imagen del próximo evento?', async () => {
    try {
      if (firebaseOk) {
        await dbUpdate(dbRef(db, 'settings'), { nextEventImage: null });
      } else {
        if (localState.settings) {
          localState.settings.nextEventImage = null;
        }
        saveLocal();
      }
      updateAdminNextEventPreview();
      if (currentPage === 'pantalla') renderPantallaContent();
      mcAlert('✅ Imagen del próximo evento eliminada.');
    } catch(err) {
      console.error(err);
      mcAlert('Error al eliminar la imagen.');
    }
  });
}

function updateAdminNextEventPreview() {
  const imgUrl = localState.settings?.nextEventImage || null;
  const container = document.getElementById('admin-next-event-preview-container');
  const img = document.getElementById('admin-next-event-preview');
  if (imgUrl) {
    if (img) img.src = imgUrl;
    if (container) container.style.display = 'block';
  } else {
    if (img) img.src = '';
    if (container) container.style.display = 'none';
  }
}

window.addSponsorAdmin = addSponsorAdmin;
window.deleteSponsorAdmin = deleteSponsorAdmin;
window.addGuestArtistAdmin = addGuestArtistAdmin;
window.deleteGuestArtistAdmin = deleteGuestArtistAdmin;
window.uploadNextEventImage = uploadNextEventImage;
window.deleteNextEventImage = deleteNextEventImage;

// ── DASHBOARD HOME ────────────────────────────────────────────────────────────
function updateDashboard() {
  if (!document.getElementById('home-dashboard')) return;

  const ev1 = localState.settings?.events?.event1;
  const ev2 = localState.settings?.events?.event2;
  const closest = getClosestEvent(ev1, ev2);

  // Calcular estadísticas Evento 1
  let ev1Reserved = 0;
  let ev1WithSong = 0;
  let ev1PartsCount = 0;
  if (ev1) {
    Object.values(allParticipants).forEach(p => {
      const res = p.reservations?.event1 || {};
      const isMigratedActive = (!p.reservations || !p.reservations.event1) && (p.songConfirmed || (p.people && p.people > 0));
      const pPpl = isMigratedActive ? (p.people || 0) : (res.people || 0);
      const pSong = isMigratedActive ? p.songConfirmed : res.songConfirmed;
      ev1Reserved += parseInt(pPpl) || 0;
      if (pSong) ev1WithSong++;
      if (parseInt(pPpl) > 0 || pSong) {
        ev1PartsCount++;
      }
    });
  }

  // Calcular estadísticas Evento 2
  let ev2Reserved = 0;
  let ev2WithSong = 0;
  let ev2PartsCount = 0;
  if (ev2) {
    Object.values(allParticipants).forEach(p => {
      const res = p.reservations?.event2 || {};
      const isMigratedActive = false;
      const pPpl = isMigratedActive ? (p.people || 0) : (res.people || 0);
      const pSong = isMigratedActive ? p.songConfirmed : res.songConfirmed;
      ev2Reserved += parseInt(pPpl) || 0;
      if (pSong) ev2WithSong++;
      if (parseInt(pPpl) > 0 || pSong) {
        ev2PartsCount++;
      }
    });
  }

  // Renderizar dinámicamente el listado de eventos en paralelo ordenado (más próximo primero)
  const elPanel = document.getElementById('events-control-panel');
  if (elPanel) {
    const list = [
      { slot: 'event1', data: ev1, reserved: ev1Reserved, withSong: ev1WithSong, partsCount: ev1PartsCount },
      { slot: 'event2', data: ev2, reserved: ev2Reserved, withSong: ev2WithSong, partsCount: ev2PartsCount }
    ];

    const activeEvents = list.filter(item => item.data);
    const inactiveEvents = list.filter(item => !item.data);

    activeEvents.sort((a, b) => {
      const tA = parseEventDate(a.data.date);
      const tB = parseEventDate(b.data.date);
      return tA - tB;
    });

    const sortedList = [...activeEvents, ...inactiveEvents];

    let html = '';
    sortedList.forEach((item, index) => {
      const orderNum = index + 1;
      const slot = item.slot;
      const ev = item.data;
      
      if (ev) {
        // Activo: nombre del evento - fecha, hora y lugar [TERMINAR EVENTO] n/n reservados
        const name = ev.name || '';
        const details = `${ev.date}, ${ev.time} y ${ev.venue}`;
        const btnText = 'Terminar';
        const btnBg = 'linear-gradient(135deg,#e74c3c,#9a1f15)';
        const btnColor = '#fff';
        const btnBorder = '#e74c3c';
        
        const currentActiveId = getCurrentEventId();
        const spots = getEventSpots(slot);
        html += `
          <div class="dash-event-row" style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 0;border-bottom:1px solid var(--border)">
            <!-- 1. Botón / Badge ACTIVO (Izquierda) -->
            <div style="width:80px;height:54px;flex-shrink:0;display:flex;align-items:center;justify-content:center;box-sizing:border-box">
              ${slot === currentActiveId ? `
                <button class="btn btn-gold" style="width:100%;height:100%;min-height:54px;padding:0;font-size:12px;border-radius:8px;font-weight:bold;font-family:'Inter',sans-serif;letter-spacing:1px;margin:0;display:flex;align-items:center;justify-content:center;box-sizing:border-box;cursor:default">ACTIVO</button>
              ` : `
                <button onclick="setActiveEvent('${slot}')" class="btn btn-outline" style="width:100%;height:100%;min-height:54px;padding:0;font-size:12px;border-radius:8px;cursor:pointer;font-family:'Inter',sans-serif;letter-spacing:1px;border-color:var(--gold);color:#fff;background:transparent;margin:0;display:flex;align-items:center;justify-content:center;box-sizing:border-box">ACTIVAR</button>
              `}
            </div>

            <!-- 2. Estadísticas del Evento Activo (Centro) -->
            <div style="display:flex;flex-direction:column;justify-content:center;text-align:left;flex:1;font-size:11px;font-weight:600;line-height:1.3;padding-left:12px;min-width:0">
              <div style="font-family:'Inter',sans-serif;font-size:13px;color:var(--gold);font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-bottom:2px">${esc(name)}</div>
              <div style="font-size:10px;color:rgba(255,255,255,0.45);font-weight:normal;margin-bottom:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(details)}</div>
              <div style="display:flex;gap:8px;font-size:10px;color:rgba(255,255,255,0.6);flex-wrap:wrap">
                <span style="color:var(--teal)">${item.partsCount} part.</span>
                <span>·</span>
                <span style="color:#fff">${item.reserved} res.</span>
                <span>·</span>
                <span style="color:var(--gold)">${spots.isLimited ? `${spots.remaining} lib.` : 'Ilimitado'}</span>
              </div>
            </div>

            <!-- 3. Botón Terminar Evento (Derecha) -->
            <button onclick="dashToggleShow('${slot}')" class="btn" style="background:${btnBg};color:${btnColor};border:1px solid ${btnBorder};height:54px;min-height:54px;padding:0 12px;font-size:11px;font-family:'Inter',sans-serif;letter-spacing:1px;width:auto;border-radius:8px;cursor:pointer;margin:0;box-sizing:border-box;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-weight:700;white-space:nowrap">
              ${btnText}
            </button>
          </div>
        `;
      } else {
        // Inactivo
        const slotLabel = slot === 'event1' ? 'Evento 1' : 'Evento 2';
        const btnText = `▶️ INICIAR EVENTO`;
        const btnBg = 'linear-gradient(135deg,#4d9e6a,#2d6642)';
        const btnColor = '#0a0a0f';
        const btnBorder = '#4d9e6a';
        
        html += `
          <div class="dash-event-row" style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 0;border-bottom:1px solid var(--border)">
            <!-- 1. Placeholder ACTIVO (Izquierda) -->
            <div style="width:80px;height:54px;flex-shrink:0"></div>

            <!-- 2. Estadísticas Evento Inactivo (Centro) -->
            <div style="display:flex;flex-direction:column;justify-content:center;height:54px;text-align:left;flex:1;font-size:11px;font-weight:600;line-height:1.3;padding-left:12px;color:var(--text2)">
              <div>Sin evento activo (${slotLabel})</div>
              <div style="font-size:10px;font-weight:400;color:rgba(255,255,255,0.2)">Crea un evento para comenzar</div>
            </div>

            <!-- 3. Botón Iniciar Evento (Derecha) -->
            <button onclick="dashToggleShow('${slot}')" class="btn" style="background:${btnBg};color:${btnColor};border:1px solid ${btnBorder};height:54px;min-height:54px;padding:0 12px;font-size:11px;font-family:'Inter',sans-serif;letter-spacing:1px;width:auto;border-radius:8px;cursor:pointer;margin:0;box-sizing:border-box;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-weight:700;white-space:nowrap">
              ${btnText}
            </button>
          </div>
        `;
      }
    });
    elPanel.innerHTML = html;
  }

  // Actualizar nombre de evento activo en el header del dashboard
  const activeEventId = getCurrentEventId();
  const activeEvent = activeEventId ? (localState.settings?.events?.[activeEventId] || null) : null;
  const elActiveName = document.getElementById('dash-active-event-name');
  const elActiveDetails = document.getElementById('dash-active-event-details');
  if (elActiveName) {
    elActiveName.textContent = activeEvent ? activeEvent.name : 'Sin evento activo';
  }
  if (elActiveDetails) {
    elActiveDetails.textContent = activeEvent 
      ? `${activeEvent.date} · ${activeEvent.time} · ${activeEvent.venue}`
      : '';
  }
  const elBarActiveName = document.getElementById('bar-active-event-name');
  const elBarActiveDetails = document.getElementById('bar-active-event-details');
  if (elBarActiveName) {
    elBarActiveName.textContent = activeEvent ? activeEvent.name : 'Sin evento activo';
  }
  if (elBarActiveDetails) {
    elBarActiveDetails.textContent = activeEvent 
      ? `${activeEvent.date} · ${activeEvent.time} · ${activeEvent.venue}`
      : '';
  }

  // Resultados label: nombre del evento si hay show activo
  const lbl = document.getElementById('dash-ranking-label');
  if (lbl) {
    const activeEvent = activeEventId ? (localState.settings?.events?.[activeEventId] || null) : null;
    lbl.textContent = showRunning && activeEvent?.name ? `Resultados · ${activeEvent.name}` : 'Resultados';
  }

  // Botón KARAOKE LIBRE (Amarillo/Gold)
  const freeBtn = document.getElementById('dash-free-karaoke-btn');
  if (freeBtn) {
    if (showRunning) {
      freeBtn.style.opacity       = '1';
      freeBtn.style.pointerEvents = 'auto';
      freeBtn.style.background    = 'linear-gradient(135deg,var(--gold),#8a640f)';
      freeBtn.style.color         = '#fff';
    } else {
      freeBtn.style.background    = 'linear-gradient(135deg,#16151a,#0d0c10)';
      freeBtn.style.color         = '#fff';
      freeBtn.style.opacity       = '0.55';
      freeBtn.style.pointerEvents = 'none';
    }
  }

  // Botón PARTICIPANTES MIC CLUB (Amarillo/Gold)
  const partsBtn = document.getElementById('dash-participants-btn');
  if (partsBtn) {
    if (showRunning) {
      partsBtn.style.opacity       = '1';
      partsBtn.style.pointerEvents = 'auto';
      partsBtn.style.background    = 'linear-gradient(135deg,var(--gold),#8a640f)';
      partsBtn.style.color         = '#fff';
    } else {
      partsBtn.style.background    = 'linear-gradient(135deg,#16151a,#0d0c10)';
      partsBtn.style.color         = '#fff';
      partsBtn.style.opacity       = '0.55';
      partsBtn.style.pointerEvents = 'none';
    }
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

  const btnSim = document.getElementById('btn-sim-votos');
  if (btnSim) btnSim.disabled = !showRunning;

  const pruebasCard = document.getElementById('dash-pruebas-card');
  if (pruebasCard) {
    pruebasCard.style.display = isSuperAdmin ? 'block' : 'none';
  }

  updateEventInfoBanners();
}

function updateEventInfoBanners() {
  const ce = localState.settings?.currentEvent;
  const allIds = [
    'event-banner-register', 'event-banner-vote', 'event-banner-ranking',
    'event-banner-jury', 'event-banner-show', 'event-banner-config', 'event-banner-history'
  ];
  // IDs where we want the prominent gold-gradient header
  const prominentIds = new Set(['event-banner-vote', 'event-banner-jury', 'event-banner-ranking']);

  allIds.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;

    if (prominentIds.has(id)) {
      let topText = '';
      let mainTitle = '';
      let subText = '';
      
      const det = ce && ce.name ? [ce.name, ce.date, ce.time, ce.venue].filter(Boolean).join(' · ') : '';

      if (id === 'event-banner-vote') {
        topText = 'Votá a tus favoritos';
        mainTitle = 'VOTACIÓN PÚBLICA';
        subText = det;
      } else if (id === 'event-banner-ranking') {
        topText = 'RESULTADOS DE VOTACIÓN';
        mainTitle = ce && ce.name ? ce.name : 'MIC CLUB';
        subText = ce ? [ce.date, ce.time, ce.venue].filter(Boolean).join(' · ') : '';
      } else if (id === 'event-banner-jury') {
        topText = 'PANEL JURADO';
        mainTitle = 'VOTACIÓN JURADO';
        subText = det;
      }

      el.innerHTML = `
        <div class="hero" style="padding: 14px 0 10px; text-align: center;">
          <div style="font-family:'Inter',sans-serif;font-size:12px;letter-spacing:4px;color:var(--gold);text-transform:uppercase;margin-bottom:8px;opacity:0.9">${esc(topText)}</div>
          <div class="hero-title">${esc(mainTitle)}</div>
          ${subText ? `<div class="hero-sub" style="margin-top: 6px;">${esc(subText)}</div>` : ''}
        </div>
      `;
      el.style.cssText = 'display:block;';
    } else {
      if (ce && ce.name) {
        const det = [ce.date, ce.time, ce.venue].filter(Boolean).join(' · ');
        el.innerHTML = `<span style="font-weight:700;color:var(--text)">${esc(ce.name)}</span>${det ? `<span style="color:var(--text2);margin-left:8px;font-size:11px">${esc(det)}</span>` : ''}`;
        el.style.cssText = 'display:block';
      } else {
        el.style.display = 'none';
      }
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
function downloadCombinedSongLinks() {
  const activeEventId = getCurrentEventId();
  
  // 1. Canciones Mic Club (Participantes)
  const parts = Object.values(allParticipants)
    .filter(p => p.karaokeLink || p.songTitle)
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    
  // 2. Karaoke Libre
  const currentEventFreeList = activeEventId ? (freeKaraokeList[activeEventId] || {}) : {};
  const freeItems = Object.values(currentEventFreeList)
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  // 3. Artistas Invitados
  const ev = activeEventId ? (localState.settings?.events?.[activeEventId] || {}) : {};
  const guestArtists = ev.guestArtists || [];

  if (!parts.length && !freeItems.length && !guestArtists.length) {
    mcAlert('No hay canciones cargadas aún.');
    return;
  }
  
  const lines = ['CANCIONES Y KARAOKE MIC CLUB\n' + new Date().toLocaleDateString('es-AR'), ''];
  
  if (parts.length) {
    lines.push('========================================');
    lines.push('🎤 CANCIONES DE PARTICIPANTES MIC CLUB');
    lines.push('========================================');
    parts.forEach(p => {
      lines.push(`${p.name || '(sin nombre)'}`);
      if (p.songTitle) lines.push(`  Canción: ${p.songTitle}${p.songArtist ? ' — ' + p.songArtist : ''}`);
      if (p.karaokeLink) lines.push(`  Link: ${p.karaokeLink}`);
      lines.push('');
    });
  }
  
  if (freeItems.length) {
    lines.push('========================================');
    lines.push('🎵 TEMAS DE KARAOKE LIBRE');
    lines.push('========================================');
    freeItems.forEach(item => {
      lines.push(`${item.name || '(sin nombre)'}`);
      if (item.songTitle) lines.push(`  Canción: ${item.songTitle}${item.songArtist ? ' — ' + item.songArtist : ''}`);
      if (item.link) lines.push(`  Link: ${item.link}`);
      lines.push('');
    });
  }

  if (guestArtists.length) {
    lines.push('========================================');
    lines.push('🌟 ARTISTAS INVITADOS');
    lines.push('========================================');
    guestArtists.forEach(art => {
      lines.push(`${art.name || '(sin nombre)'}`);
      lines.push(`  Canción: ${art.song || 'Repertorio Especial'}`);
      if (art.link || art.url) lines.push(`  Link: ${art.link || art.url}`);
      lines.push('');
    });
  }
  
  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = `lista-completa-canciones-${new Date().toISOString().slice(0,10)}.txt`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function triggerUploadPlaylist() {
  const input = document.getElementById('playlist-file-input');
  if (input) input.click();
}

async function handlePlaylistUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = async function(e) {
    const text = e.target.result;
    const lines = text.split('\n');
    
    let currentSection = null; // 'participants', 'libre', 'guest'
    let currentItem = { name: '', song: '', link: '' };
    
    const parsedParticipants = [];
    const parsedLibre = [];
    const parsedGuest = [];
    
    function commitItem() {
      if (currentItem.name || currentItem.song || currentItem.link) {
        if (currentSection === 'participants') {
          parsedParticipants.push({ ...currentItem });
        } else if (currentSection === 'libre') {
          parsedLibre.push({ ...currentItem });
        } else if (currentSection === 'guest') {
          parsedGuest.push({ ...currentItem });
        }
      }
      currentItem = { name: '', song: '', link: '' };
    }
    
    for (let line of lines) {
      line = line.trim();
      if (!line) continue;
      
      const upperLine = line.toUpperCase();
      if (upperLine.includes('PARTICIPANTES') || upperLine.includes('MIC CLUB')) {
        commitItem();
        currentSection = 'participants';
        continue;
      } else if (upperLine.includes('KARAOKE LIBRE') || upperLine.includes('TEMAS DE KARAOKE')) {
        commitItem();
        currentSection = 'libre';
        continue;
      } else if (upperLine.includes('ARTISTAS INVITADOS') || upperLine.includes('INVITADOS')) {
        commitItem();
        currentSection = 'guest';
        continue;
      } else if (line.startsWith('===')) {
        continue;
      }
      
      if (line.startsWith('Canción:') || line.startsWith('Cancion:')) {
        currentItem.song = line.replace(/Canció?n:\s*/i, '').trim();
      } else if (line.startsWith('Link:')) {
        currentItem.link = line.replace(/Link:\s*/i, '').trim();
      } else {
        commitItem();
        currentItem.name = line;
      }
    }
    commitItem();
    
    const eventId = getCurrentEventId();
    if (!eventId) {
      mcAlert('No hay un evento activo seleccionado.');
      return;
    }
    
    try {
      // 1. Participantes
      for (const item of parsedParticipants) {
        let foundKey = null;
        for (const [key, part] of Object.entries(allParticipants)) {
          if ((part.name || '').trim().toLowerCase() === item.name.toLowerCase()) {
            foundKey = key;
            break;
          }
        }
        
        let splitSong = item.song.split(' — ');
        let title = splitSong[0] || '';
        let artist = splitSong[1] || '';
        
        if (foundKey) {
          if (firebaseOk) {
            await dbUpdate(dbRef(db, `events/${eventId}/participants/${foundKey}`), {
              songTitle: title,
              songArtist: artist,
              karaokeLink: item.link
            });
          } else {
            allParticipants[foundKey].songTitle = title;
            allParticipants[foundKey].songArtist = artist;
            allParticipants[foundKey].karaokeLink = item.link;
          }
        } else {
          const newId = 'imported_' + Math.random().toString(36).substr(2, 9);
          const newPart = {
            name: item.name,
            people: 1,
            attended: true,
            songTitle: title,
            songArtist: artist,
            karaokeLink: item.link,
            points: 0,
            hasVoted: false
          };
          if (firebaseOk) {
            await dbUpdate(dbRef(db, `events/${eventId}/participants/${newId}`), newPart);
          } else {
            allParticipants[newId] = newPart;
          }
        }
      }
      
      // 2. Karaoke Libre
      for (const item of parsedLibre) {
        let splitSong = item.song.split(' — ');
        let title = splitSong[0] || '';
        let artist = splitSong[1] || '';
        const newId = 'free_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        const freeItemObj = {
          id: newId,
          name: item.name,
          songTitle: title,
          songArtist: artist,
          link: item.link,
          played: false
        };
        if (firebaseOk) {
          await dbUpdate(dbRef(db, `events/${eventId}/freeKaraokeList/${newId}`), freeItemObj);
        } else {
          if (!freeKaraokeList[eventId]) freeKaraokeList[eventId] = {};
          freeKaraokeList[eventId][newId] = freeItemObj;
        }
      }
      
      // 3. Artistas Invitados
      const evObj = localState.settings?.events?.[eventId];
      if (evObj) {
        const existingGuests = evObj.guestArtists || [];
        for (const item of parsedGuest) {
          let splitSong = item.song.split(' — ');
          let title = splitSong[0] || '';
          let artist = splitSong[1] || '';
          const exists = existingGuests.some(g => g.name.toLowerCase() === item.name.toLowerCase() && (g.song || '').toLowerCase() === title.toLowerCase());
          if (!exists) {
            existingGuests.push({
              name: item.name,
              song: title || 'Repertorio Especial',
              link: item.link
            });
          }
        }
        if (firebaseOk) {
          await dbUpdate(dbRef(db, `settings/events/${eventId}`), { guestArtists: existingGuests });
        } else {
          evObj.guestArtists = existingGuests;
        }
      }
      
      if (!firebaseOk) {
        saveLocal();
      }
      
      mcAlert(`Playlist subida con éxito:\n- ${parsedParticipants.length} Participantes\n- ${parsedLibre.length} Karaoke Libre\n- ${parsedGuest.length} Artistas Invitados`);
      updateUI();
    } catch (err) {
      console.error(err);
      mcAlert('Error al guardar la playlist: ' + err.message);
    }
  };
  reader.readAsText(file);
}

window.triggerUploadPlaylist = triggerUploadPlaylist;
window.handlePlaylistUpload = handlePlaylistUpload;

function downloadReservations() {
  const parts = Object.values(allParticipants)
    .filter(p => (parseInt(p.people) || 0) > 0)
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  if (!parts.length) { mcAlert('No hay reservas activas en este momento.'); return; }
  
  const lines = ['RESERVAS MIC CLUB\n' + new Date().toLocaleDateString('es-AR'), ''];
  parts.forEach(p => {
    const reservations = parseInt(p.people) || 0;
    lines.push(`${p.name || '(sin nombre)'}: ${reservations}`);
  });
  
  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = `reservas-micclub-${new Date().toISOString().slice(0,10)}.txt`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function homeLogin() {
  const input    = document.getElementById('home-pass');
  const pass     = (input?.value || '').trim();
  const adminPass = localState.settings?.adminPassword || ADMIN_PASS_DEFAULT;
  if (pass === '1450') {
    adminLoggedIn = true;
    isSuperAdmin = true;
    sessionStorage.setItem('mc_ok', '1450');
    document.getElementById('home-login-gate').style.display  = 'none';
    document.getElementById('home-dashboard').style.display   = 'block';
    updateDashboard();
  } else if (pass === adminPass) {
    adminLoggedIn = true;
    isSuperAdmin = false;
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
    const formatTime = (ts) => {
      if (!ts) return '—';
      const d = new Date(ts);
      return d.toLocaleDateString('es-AR') + ' ' + d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    };
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
        <div style="font-size:10px;color:var(--text2);margin-top:4px;opacity:0.8">
          📅 Alta: ${formatTime(p.timestamp)} · 📝 Modif: ${formatTime(p.updatedAt || p.timestamp)}
        </div>
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
  const activeEventId = getAdminActiveEventId();
  if (!activeEventId) {
    mcAlert('No hay evento activo para finalizar.');
    return;
  }
  mcConfirm('¿Cerrar este evento e iniciar uno nuevo?<br><br>Se guardará el historial del evento actual y se limpiarán las canciones y reservas. Los participantes y sus puntos MicClub se conservan.', () => {
    mcPrompt('Ingresá la contraseña para confirmar:', async (pass) => {
      if (!pass) return;
      const adminPass = localState.settings?.adminPassword || ADMIN_PASS_DEFAULT;
      if (pass !== adminPass) { mcAlert('Contraseña incorrecta'); return; }
      await endShow(activeEventId);
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
      const parts = Object.entries(h.participants || {}).map(([id, p]) => ({ ...p, id }));
      const date  = h.closedDate || new Date(parseInt(key)).toLocaleDateString('es-AR');
      const det   = [date, ev.time, ev.venue].filter(Boolean).join(' · ');
      return `<button onclick="showHistoryDetail('${key}')" style="width:100%;text-align:left;background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:12px 14px;margin-bottom:6px;cursor:pointer;display:block">
        <div style="font-family:'Inter',sans-serif;font-size:18px;color:var(--text);letter-spacing:2px;line-height:1.1">${esc(ev.name || 'Evento sin nombre')}</div>
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
  const parts = Object.entries(h.participants || {}).map(([id, p]) => ({ ...p, id }));
  const date  = h.closedDate || new Date(parseInt(key)).toLocaleDateString('es-AR');
  const det   = [date, ev.time, ev.venue].filter(Boolean).join(' · ');

  const scores = getEventScores(parts);
  const ranked = parts
    .map(p => ({ ...p, eventPts: scores[p.id]?.total || 0 }))
    .sort((a, b) => b.eventPts - a.eventPts);

  const medals = ['🥇', '🥈', '🥉'];

  const rankRows = ranked.map((p, i) => {
    const votes = p.eventVotesPublico !== undefined ? p.eventVotesPublico : ((parseInt(p.voteSong) || 0) + (parseInt(p.votePerf) || 0));
    const jury = p.eventJuryTotal !== undefined ? p.eventJuryTotal : (getJuryTotalForPart(p, 'song') + getJuryTotalForPart(p, 'perf') + getJuryTotalForPart(p, 'hinchada'));
    const micclub = p.eventMicclubPts !== undefined ? p.eventMicclubPts : (scores[p.id]?.total || calcBaseScore(p));
    
    const songTitleVal = p.songTitle || (p.song && p.song.includes(' — ') ? p.song.split(' — ')[0] : p.song || '');
    const songArtistVal = p.songArtist || (p.song && p.song.includes(' — ') ? p.song.split(' — ')[1] : '');
    const songLine = songTitleVal ? `<div style="font-size:11px;color:var(--text2);margin-bottom:2px">${esc(songTitleVal)}${songArtistVal ? ' · ' + esc(songArtistVal) : ''}</div>` : '';
    
    return `<div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--border)">
      <span style="font-family:'Inter',sans-serif;font-size:20px;color:var(--text2);min-width:28px">${medals[i] || (i+1)}</span>
      <div style="flex:1;min-width:0">
        <div style="font-weight:700;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(p.name)}</div>
        ${songLine}
        <div style="font-size:11px;color:var(--text2);opacity:0.85">
          🗳️ Votos: <strong>${votes}</strong> · ⭐ Jurado: <strong>${jury} pts</strong> · 🎤 MicClub: <strong>+${micclub} pts</strong>
        </div>
      </div>
      <span style="font-family:'Inter',sans-serif;font-size:20px;color:var(--gold)">${micclub} pts</span>
    </div>`;
  }).join('');

  const partsWithSong = parts.filter(p => p.songConfirmed || p.songTitle || p.song);

  const getRankPill = (rank) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `<span style="font-family:'Inter',sans-serif;font-size:11px;color:var(--text2)">${rank}</span>`;
  };

  const renderHistoryCategoryList = (sortedParts, scoreGetter, unit) => {
    let currentRank = 0;
    let currentScore = -1;
    
    return sortedParts.map((p, index) => {
      const score = scoreGetter(p);
      if (score !== currentScore) {
        currentRank = index + 1;
        currentScore = score;
      }
      const medal = getRankPill(currentRank);
      const isTop = currentRank <= 3;
      const nameColor = isTop ? 'var(--text)' : 'var(--text2)';
      const sizeClass = currentRank === 1 ? '14' : '12';
      
      return `<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.04)">
        <div style="display:flex;align-items:center;gap:6px;min-width:0;flex:1">
          <div style="font-size:14px;min-width:20px;text-align:center">${medal}</div>
          <div style="font-family:'Inter',sans-serif;font-weight:${isTop ? 600 : 400};font-size:${sizeClass}px;color:${nameColor};overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(p.name)}</div>
        </div>
        <div style="font-family:'Inter',sans-serif;font-size:${sizeClass}px;font-weight:600;color:${nameColor};white-space:nowrap;margin-left:8px">
          ${score} <span style="font-size:9px;font-weight:400;color:var(--text2)">${unit}</span>
        </div>
      </div>`;
    }).join('') || '<div style="color:var(--text2);font-size:12px;text-align:center;padding:10px 0">Sin participantes</div>';
  };

  const pubSongSorted = [...partsWithSong].sort((a, b) => (parseInt(b.voteSong) || 0) - (parseInt(a.voteSong) || 0));
  const partsSongSortedHTML = renderHistoryCategoryList(pubSongSorted, p => parseInt(p.voteSong) || 0, 'votos');

  const pubPerfSorted = [...partsWithSong].sort((a, b) => (parseInt(b.votePerf) || 0) - (parseInt(a.votePerf) || 0));
  const partsPerfSortedHTML = renderHistoryCategoryList(pubPerfSorted, p => parseInt(p.votePerf) || 0, 'votos');

  const jurySongSorted = [...partsWithSong].sort((a, b) => getJuryTotalForPart(b, 'song') - getJuryTotalForPart(a, 'song'));
  const jurySongSortedHTML = renderHistoryCategoryList(jurySongSorted, p => getJuryTotalForPart(p, 'song'), 'pts');

  const juryPerfSorted = [...partsWithSong].sort((a, b) => getJuryTotalForPart(b, 'perf') - getJuryTotalForPart(a, 'perf'));
  const juryPerfSortedHTML = renderHistoryCategoryList(juryPerfSorted, p => getJuryTotalForPart(p, 'perf'), 'pts');

  const juryHinchadaSorted = [...partsWithSong].sort((a, b) => getJuryTotalForPart(b, 'hinchada') - getJuryTotalForPart(a, 'hinchada'));
  const juryHinchadaSortedHTML = renderHistoryCategoryList(juryHinchadaSorted, p => getJuryTotalForPart(p, 'hinchada'), 'pts');

  const el = document.getElementById('history-detail-content');
  if (el) {
    el.innerHTML = `
      <div style="text-align:center;padding:8px 0 14px">
        <div style="font-family:'Inter',sans-serif;font-size:28px;letter-spacing:3px;color:var(--text)">${esc(ev.name || 'Evento')}</div>
        <div style="font-size:11px;color:var(--text2);margin-top:2px">${esc(det)}</div>
      </div>

      <div style="font-size:10px;letter-spacing:2px;color:var(--text2);text-transform:uppercase;margin-bottom:8px">Ranking del evento</div>
      <div style="background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:10px 14px;margin-bottom:14px">
        ${rankRows || '<div style="color:var(--text2);font-size:13px">Sin datos</div>'}
      </div>

      <div style="font-size:10px;letter-spacing:2px;color:var(--text2);text-transform:uppercase;margin-bottom:8px">Categorías y Votaciones</div>
      <div class="results-layout-container" style="margin-top:10px">
        
        <!-- 1. Público: Mejor Canción -->
        <div class="result-column-card">
          <div class="result-column-header">
            <div class="column-category-title" style="font-size:16px;letter-spacing:1px">MEJOR<br>CANCIÓN</div>
            <div class="column-source-tag source-public">🗳️ PÚBLICO</div>
          </div>
          <div style="display:grid;gap:6px">
            ${partsSongSortedHTML}
          </div>
        </div>

        <!-- 2. Público: Mejor Performance -->
        <div class="result-column-card">
          <div class="result-column-header">
            <div class="column-category-title" style="font-size:16px;letter-spacing:1px">MEJOR<br>PERFORMANCE</div>
            <div class="column-source-tag source-public">🗳️ PÚBLICO</div>
          </div>
          <div style="display:grid;gap:6px">
            ${partsPerfSortedHTML}
          </div>
        </div>

        <!-- 3. Jurado: Canción -->
        <div class="result-column-card">
          <div class="result-column-header">
            <div class="column-category-title" style="font-size:16px;letter-spacing:1px">CANCIÓN</div>
            <div class="column-source-tag source-jury">⭐ JURADO</div>
          </div>
          <div style="display:grid;gap:6px">
            ${jurySongSortedHTML}
          </div>
        </div>

        <!-- 4. Jurado: Performance -->
        <div class="result-column-card">
          <div class="result-column-header">
            <div class="column-category-title" style="font-size:16px;letter-spacing:1px">PERFORMANCE</div>
            <div class="column-source-tag source-jury">⭐ JURADO</div>
          </div>
          <div style="display:grid;gap:6px">
            ${juryPerfSortedHTML}
          </div>
        </div>

        <!-- 5. Jurado: Hinchada -->
        <div class="result-column-card">
          <div class="result-column-header">
            <div class="column-category-title" style="font-size:16px;letter-spacing:1px">HINCHADA</div>
            <div class="column-source-tag source-jury">📣 JURADO</div>
          </div>
          <div style="display:grid;gap:6px">
            ${juryHinchadaSortedHTML}
          </div>
        </div>

      </div>
    `;
  }
  navPush('history-detail');
}

function dashToggleShow(slot) {
  if (!slot) {
    // Hidden button fallback
    return;
  }
  const ev = localState.settings?.events?.[slot];
  if (ev) {
    mcPrompt(`Ingresá la contraseña para terminar el ${slot === 'event1' ? 'Evento 1' : 'Evento 2'}:`, async (pass) => {
      if (!pass) return;
      const adminPass = localState.settings?.adminPassword || ADMIN_PASS_DEFAULT;
      if (pass !== adminPass) { mcAlert('Contraseña incorrecta'); return; }
      await endShow(slot);
    }, 'password', 'Contraseña');
  } else {
    showEventStartForm(slot);
  }
}

function showEventStartForm(slot) {
  const formHtml = `
    <div style="margin-bottom:12px">
      <label style="display:block;font-family:'Inter',sans-serif;font-size:10px;letter-spacing:2px;color:var(--text2);margin-bottom:6px;text-transform:uppercase">Nombre del evento</label>
      <input id="ev-name" type="text" placeholder="Ej: Noche de Pop" style="width:100%;background:var(--bg3);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:15px;padding:12px 14px;outline:none;box-sizing:border-box">
    </div>
    <div style="margin-bottom:12px">
      <label style="display:block;font-family:'Inter',sans-serif;font-size:10px;letter-spacing:2px;color:var(--text2);margin-bottom:6px;text-transform:uppercase">Fecha</label>
      <input id="ev-date" type="text" placeholder="Ej: 20/04/2025" style="width:100%;background:var(--bg3);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:15px;padding:12px 14px;outline:none;box-sizing:border-box">
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
      <div>
        <label style="display:block;font-family:'Inter',sans-serif;font-size:10px;letter-spacing:2px;color:var(--text2);margin-bottom:6px;text-transform:uppercase">Hora</label>
        <input id="ev-time" type="text" placeholder="Ej: 21:00" style="width:100%;background:var(--bg3);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:15px;padding:12px 14px;outline:none;box-sizing:border-box">
      </div>
      <div>
        <label style="display:block;font-family:'Inter',sans-serif;font-size:10px;letter-spacing:2px;color:var(--text2);margin-bottom:6px;text-transform:uppercase">Lugar</label>
        <input id="ev-venue" type="text" placeholder="Ej: El Bar" style="width:100%;background:var(--bg3);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:15px;padding:12px 14px;outline:none;box-sizing:border-box">
      </div>
    </div>
    <div style="margin-bottom:4px">
      <label style="display:block;font-family:'Inter',sans-serif;font-size:10px;letter-spacing:2px;color:var(--text2);margin-bottom:6px;text-transform:uppercase">Capacidad / Cupo de reservas (0 o vacío para ilimitado)</label>
      <input id="ev-capacity" type="number" placeholder="Ej: 50" min="0" style="width:100%;background:var(--bg3);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:15px;padding:12px 14px;outline:none;box-sizing:border-box">
    </div>`;
  showCustomModal({
    title: 'INICIAR EVENTO',
    msg: formHtml,
    okText: '▶️ INICIAR',
    cancelText: 'Cancelar',
    onOk: async () => {
      const name     = (document.getElementById('ev-name')?.value  || '').trim();
      const date     = (document.getElementById('ev-date')?.value  || '').trim();
      const time     = (document.getElementById('ev-time')?.value  || '').trim();
      const venue    = (document.getElementById('ev-venue')?.value || '').trim();
      const capacity = parseInt(document.getElementById('ev-capacity')?.value) || 0;
      await startShow(slot, name, date, time, venue, capacity);
    }
  });
}

async function startShow(slot, name, date, time, venue, capacity) {
  try {
    const evData = { id: slot, name, date, time, venue, capacity, startedAt: Date.now() };
    
    if (!localState.settings) localState.settings = {};
    if (!localState.settings.events) localState.settings.events = {};
    localState.settings.events[slot] = evData;
    
    const ev1 = localState.settings.events.event1;
    const ev2 = localState.settings.events.event2;
    const closest = getClosestEvent(ev1, ev2);
    const activeSlot = closest ? closest.id : slot;
    
    showRunning = true;
    votingOpen  = false;
    
    const settingsUpdate = {
      'settings/showRunning': true,
      'settings/votingOpen': false,
      'settings/votingCloseAt': null,
      [`settings/events/${slot}`]: evData,
      'settings/currentEvent': closest,
      'settings/activeEventSlot': activeSlot
    };
    
    if (firebaseOk) {
      await dbUpdate(dbRef(db), settingsUpdate);
    } else {
      localState.settings.showRunning = true;
      localState.settings.votingOpen = false;
      localState.settings.votingCloseAt = null;
      localState.settings.currentEvent = closest;
      localState.settings.activeEventSlot = activeSlot;
      saveLocal();
    }
    
    handleVotingState();
    updateRanking();
    updateDashboard();
    mcAlert(`✅ Evento iniciado correctamente en la ranura ${slot === 'event1' ? 'Evento 1' : 'Evento 2'}.`);
  } catch(e) {
    console.error(e);
    mcAlert('Error al iniciar el evento: ' + e.message);
  }
}

function dashCopyLink(mode) {
  const urlMap = { vote: '?mode=vote', jury: '?mode=jury', ranking: '?mode=ranking', micclub: '?mode=micclub', register: '?mode=register', pantalla: '?mode=pantalla', bar: '?mode=bar' };
  const url = buildBaseURL() + (urlMap[mode] || ('?mode=' + mode));
  const modeNames = { jury: 'Jurado', register: 'Reservas', vote: 'Programa', ranking: 'Ranking', pantalla: 'Pantalla', bar: 'Bar' };
  const label = modeNames[mode] || 'Evento';

  const activeEventId = getCurrentEventId();
  const activeEvent = activeEventId ? (localState.settings?.events?.[activeEventId] || null) : null;
  const eventName = activeEvent ? activeEvent.name : 'MicClub';

  const shareTexts = {
    jury: 'Panel de votación del jurado',
    register: 'Participa del Mic Club, reservá tu lugar.',
    vote: `Mirá el programa de ${eventName}`,
    bar: 'Panel de Emision - Mic Club'
  };
  const shareText = shareTexts[mode] || `Ingresá al enlace de ${label}:`;

  const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);

  if (isMobile && navigator.share) {
    navigator.share({
      title: 'MIC CLUB',
      text: shareText,
      url: url
    }).catch(err => {
      console.log('Compartir cancelado o fallido', err);
    });
  } else {
    navigator.clipboard?.writeText(url)
      .then(() => mcAlert('✅ Link copiado al portapapeles'))
      .catch(() => showCustomModal({ msg: `${shareText}<br><br><span style="font-size:11px;word-break:break-all;color:var(--teal)">${url}</span>`, okText: 'OK' }));
  }
}
window.dashCopyLink = dashCopyLink;

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
  const activeEventId = getCurrentEventId();
  if (activeEventId) {
    getEnrichedParticipantsList(activeEventId).forEach(p => {
      tv += parseInt(p.voteSong) || 0;
      tv += parseInt(p.votePerf) || 0;
    });
  }
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
      <div style="font-family:'Inter',sans-serif;font-size:44px;color:var(--gold);line-height:1">🏆</div>
      <div>
        <div style="font-family:'Inter',sans-serif;font-weight:700;font-size:18px">${esc(L.name)}</div>
        <div style="font-size:12px;color:var(--text2)">${esc(L.song || 'Sin canción')}</div>
        <div style="font-family:'Inter',sans-serif;font-size:26px;color:var(--gold)">${L.score} pts</div>
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

function startCelebration() {
  let canvasId = 'show-celebration-canvas';
  if (MODE === 'pantalla') {
    canvasId = 'pantalla-celebration-canvas';
  } else if (currentPage === 'ranking') {
    canvasId = 'ranking-celebration-canvas';
  }
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  
  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);
  
  const particles = [];
  const fireworks = [];
  
  class Firework {
    constructor() {
      this.x = Math.random() * canvas.width;
      this.y = canvas.height;
      this.tx = Math.random() * canvas.width;
      this.ty = Math.random() * (canvas.height * 0.3) + canvas.height * 0.05; // detonate at upper 5%-35% of screen
      this.speed = Math.random() * 3 + 2.5; // speed reduced by 50%
      this.angle = Math.atan2(this.ty - this.y, this.tx - this.x);
      this.dist = Math.hypot(this.tx - this.x, this.ty - this.y);
      this.distTraveled = 0;
      this.hue = Math.random() * 360;
    }
    update(index) {
      const vx = Math.cos(this.angle) * this.speed;
      const vy = Math.sin(this.angle) * this.speed;
      this.x += vx;
      this.y += vy;
      this.distTraveled += Math.hypot(vx, vy);
      
      if (this.distTraveled >= this.dist) {
        createExplosion(this.tx, this.ty, this.hue);
        fireworks.splice(index, 1);
      }
    }
    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = `hsl(${this.hue}, 100%, 75%)`;
      ctx.fill();
    }
  }
  
  class Particle {
    constructor(x, y, hue) {
      this.x = x;
      this.y = y;
      this.angle = Math.random() * Math.PI * 2;
      this.speed = Math.random() * 5 + 1.2; // speed reduced by 50%
      this.friction = 0.94;
      this.gravity = 0.12; // gravity reduced by 50%
      this.hue = hue + (Math.random() * 40 - 20);
      this.alpha = 1;
      this.decay = Math.random() * 0.015 + 0.007;
    }
    update(index) {
      this.speed *= this.friction;
      this.x += Math.cos(this.angle) * this.speed;
      this.y += Math.sin(this.angle) * this.speed + this.gravity;
      this.alpha -= this.decay;
      if (this.alpha <= 0) {
        particles.splice(index, 1);
      }
    }
    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, Math.random() * 2.8 + 1.2, 0, Math.PI * 2); // slightly larger particles for better brightness
      ctx.fillStyle = `hsla(${this.hue}, 100%, 80%, ${this.alpha})`; // brighter particles
      ctx.fill();
    }
  }
  
  function createExplosion(x, y, hue) {
    const count = 50;
    for (let i = 0; i < count; i++) {
      particles.push(new Particle(x, y, hue));
    }
  }
  
  function loop() {
    if (MODE === 'pantalla') {
      if (pantallaTab !== 'votos' && pantallaTab !== 'ranking') {
        window.removeEventListener('resize', resize);
        celebrationAnimationId = null;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
      }
    } else {
      if (currentPage !== 'ranking' && currentPage !== 'show') {
        window.removeEventListener('resize', resize);
        celebrationAnimationId = null;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
      }
    }
    
    celebrationAnimationId = requestAnimationFrame(loop);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Additive blending for highly illuminated realistic fireworks
    ctx.globalCompositeOperation = 'lighter';
    
    if (Math.random() < 0.08 && fireworks.length < 10) {
      fireworks.push(new Firework());
    }
    
    fireworks.forEach((fw, i) => {
      fw.update(i);
      fw.draw();
    });
    
    particles.forEach((p, i) => {
      p.update(i);
      p.draw();
    });
    
    // Reset blend mode
    ctx.globalCompositeOperation = 'source-over';
  }
  
  if (celebrationAnimationId) cancelAnimationFrame(celebrationAnimationId);
  loop();
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

function getMedalHTML(rank) {
  if (rank === 1) {
    return `<div style="display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;background:#B38B45;color:#000000;font-size:12px;font-weight:700;font-family:'Inter',sans-serif;box-shadow:0 0 8px rgba(179, 139, 69, 0.5)">1</div>`;
  } else if (rank === 2) {
    return `<div style="display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;background:#3B5870;color:#F4EAD0;font-size:12px;font-weight:700;font-family:'Inter',sans-serif;box-shadow:0 0 8px rgba(59, 88, 112, 0.5)">2</div>`;
  } else if (rank === 3) {
    return `<div style="display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;background:#3B5870;color:#F4EAD0;font-size:12px;font-weight:700;font-family:'Inter',sans-serif;box-shadow:0 0 8px rgba(59, 88, 112, 0.5)">3</div>`;
  }
  return `<span style="font-family:'Inter',sans-serif;font-size:15px;color:var(--text2);font-weight:500">${rank}</span>`;
}

function renderPodiumList(podiumData, elId, scoreSuffix) {
  const el = document.getElementById(elId);
  if (!el) return;
  
  const stateKey = elId.replace('pantalla-', '');
  const mapStateKeyToConfig = {
    'rank-pub-song': 'pubSong',
    'rank-pub-perf': 'pubPerf',
    'rank-jury-song': 'jurySong',
    'rank-jury-perf': 'juryPerf',
    'rank-jury-hinchada': 'juryHinchada'
  };
  const configKey = mapStateKeyToConfig[stateKey] || stateKey;
  const isRevealed = !elId.startsWith('pantalla-') || !!localState.settings?.votingVisibleColumns?.[configKey];

  if (!isRevealed) {
    el.innerHTML = `
      <div class="reveal-podium-card" style="text-align:center; padding: 35px 10px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 15px;">
        <div style="font-family:'Inter',sans-serif; font-size: 26px; letter-spacing: 1px; background: linear-gradient(135deg, #FCE0AD 0%, #DFAC4A 45%, #C68B29 85%, #8E5B12 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; text-fill-color: transparent; color: transparent; text-shadow: 0 0 12px rgba(223, 172, 74, 0.25); line-height: 1.2;">Los ganadores son...</div>
      </div>`;
    return;
  }
  
  if (!podiumData.length) {
    el.innerHTML = '<div style="color:#ffffff; font-size:12px; font-family:\'Inter\',sans-serif; text-align:center; padding:15px 0; opacity:0.85; letter-spacing:0.5px">Esperando la votación</div>';
    return;
  }
  
  const contentHtml = podiumData.map(item => {
    const isTop = item.rank <= 3;
    const nameColor = isTop ? 'var(--text)' : 'var(--text2)';
    const ptsColor = nameColor; // same color as name
    const medal = getMedalHTML(item.rank);
    
    // Bajar 25% el nombre de los participantes: 1.er lugar en 20px, otros en 15px
    const sizeClass = item.rank === 1 ? '20' : '15';
    
    const nameGlow = isTop ? 'text-shadow:0 0 6px rgba(255,255,255,0.35);' : '';
    const ptsGlow = '';
    
    // MC Puntos no tienen negrita (weight 400) y son 25% menores (10px) con el mismo glow
    const mcPtsLabel = item.podiumPts > 0 ? `<span style="font-family:'Inter',sans-serif;font-size:10px;font-weight:400;color:#ffffff;text-shadow:0 0 8px rgba(255,255,255,0.65);white-space:nowrap">+${item.podiumPts} MC</span>` : '';
    const songLabel = item.song ? `<span style="font-size:13px;color:var(--text2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(item.song)}</span>` : '<span></span>';
    
    // Canción alineada al principio (padding-left: 0px)
    const row2Html = (item.song || item.podiumPts > 0) ? `
      <div style="display:flex;justify-content:space-between;align-items:center;padding-left:0px;margin-top:4px;font-size:13px;">
        ${songLabel}
        ${mcPtsLabel}
      </div>` : '';
      
    // Los puntos se achican proporcionalmente (sizeClass: 20px o 15px)
    const suffixSize = sizeClass === '20' ? '12' : '9';
    return `<div style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,.04)">
      <div style="display:flex;align-items:center;gap:10px">
        <div style="font-size:${sizeClass}px;min-width:30px;text-align:center;line-height:1">${medal}</div>
        <div style="flex:1;font-family:'Inter',sans-serif;font-weight:${isTop ? 700 : 500};font-size:${sizeClass}px;color:${nameColor};${nameGlow}overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(item.name)}</div>
        <div style="font-family:'Inter',sans-serif;font-size:${sizeClass}px;font-weight:700;color:${ptsColor};${ptsGlow}white-space:nowrap">${item.score}<span style="font-size:${suffixSize}px;font-weight:400;color:var(--text2);opacity:0.85;text-shadow:none"> ${scoreSuffix}</span></div>
      </div>
      ${row2Html}
    </div>`;
  }).join('');

  el.innerHTML = `<div style="animation: fadeUp 0.6s ease-out forwards;">${contentHtml}</div>`;
}

function renderPublicVoteRanking() {
  const parts = getEnrichedParticipantsList(getCurrentEventId()).filter(p => p.songConfirmed);
  
  const pubSongPodium = getPodiumRanksAndPoints(parts, p => parseInt(p.voteSong) || 0).filter(x => x.rank <= 3);
  const pubPerfPodium = getPodiumRanksAndPoints(parts, p => parseInt(p.votePerf) || 0).filter(x => x.rank <= 3);
  
  renderPodiumList(pubSongPodium, 'rank-pub-song', 'votos');
  renderPodiumList(pubPerfPodium, 'rank-pub-perf', 'votos');
  
  renderPodiumList(pubSongPodium, 'pantalla-rank-pub-song', 'votos');
  renderPodiumList(pubPerfPodium, 'pantalla-rank-pub-perf', 'votos');
}

function renderJuryRankingInRanking() {
  const parts = getEnrichedParticipantsList(getCurrentEventId()).filter(p => p.songConfirmed);
  
  const jurySongPodium = getPodiumRanksAndPoints(parts, p => getJuryTotalForPart(p, 'song')).filter(x => x.rank <= 3);
  const juryPerfPodium = getPodiumRanksAndPoints(parts, p => getJuryTotalForPart(p, 'perf')).filter(x => x.rank <= 3);
  const juryHinchadaPodium = getPodiumRanksAndPoints(parts, p => getJuryTotalForPart(p, 'hinchada')).filter(x => x.rank <= 3);
  
  renderPodiumList(jurySongPodium, 'rank-jury-song', 'pts');
  renderPodiumList(juryPerfPodium, 'rank-jury-perf', 'pts');
  renderPodiumList(juryHinchadaPodium, 'rank-jury-hinchada', 'pts');
  
  renderPodiumList(jurySongPodium, 'pantalla-rank-jury-song', 'pts');
  renderPodiumList(juryPerfPodium, 'pantalla-rank-jury-perf', 'pts');
  renderPodiumList(juryHinchadaPodium, 'pantalla-rank-jury-hinchada', 'pts');
}

function updateShowMode() {
  const parts = sortedMicclub();
  
  // Separate Consagrados (>150 pts) from active parts
  const consagradosData = parts.filter(p => p.score > 150);
  const activeParts = parts.filter(p => p.score <= 150);

  // Render HTML strings
  const consagradosHtml = consagradosData.map((p) => {
    const badge = `👑`;
    return `<div style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,.04);display:flex;align-items:center;gap:10px">
      <div style="font-size:20px;min-width:30px;text-align:center;line-height:1">${badge}</div>
      <div style="flex:1;font-family:'Inter',sans-serif;font-weight:700;font-size:20px;color:var(--text);text-shadow:0 0 6px rgba(255,255,255,0.35);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(p.name)}</div>
      <div style="font-family:'Inter',sans-serif;font-size:20px;font-weight:700;color:var(--text);white-space:nowrap">${p.score}<span style="font-size:12px;font-weight:400;color:var(--text2);opacity:0.85;text-shadow:none"> pts</span></div>
    </div>`;
  }).join('');

  let currentRank = 0;
  let currentScore = -1;
  const activeHtml = activeParts.map((p, i) => {
    if (p.score !== currentScore) {
      currentRank = i + 1;
      currentScore = p.score;
    }
    const pct    = Math.min(100, (p.score / META) * 100);
    const isTop  = currentRank <= 3;
    const rank   = getMedalHTML(currentRank);
    const nameColor = 'var(--text)'; // All names are cream white
    
    const sizeClass = (currentRank === 1) ? '20' : '15';
    const nameGlow = isTop ? 'text-shadow:0 0 6px rgba(255,255,255,0.35);' : '';
    const ptsGlow = ''; // All scores have yellow glow
    const suffixSize = sizeClass === '20' ? '12' : '9';
    
    return `<div style="padding:12px 0;border-bottom:1px solid rgba(255,255,255,.04)">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
        <div style="font-size:${sizeClass}px;min-width:30px;text-align:center;line-height:1">${rank}</div>
        <div style="flex:1;font-family:'Inter',sans-serif;font-weight:${isTop ? '700' : '500'};font-size:${sizeClass}px;color:${nameColor};${nameGlow}white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(p.name)}</div>
        <div style="font-family:'Inter',sans-serif;font-size:${sizeClass}px;font-weight:700;color:${nameColor};${ptsGlow}white-space:nowrap">${p.score}<span style="font-size:${suffixSize}px;font-weight:400;color:var(--text2);opacity:0.85;text-shadow:none"> pts</span></div>
      </div>
      <div style="padding-left:40px;margin-top:2px">
        <div style="width:100%;height:4px;background:var(--bg4);border-radius:99px;overflow:hidden">
          <div style="width:${pct}%;height:100%;background:${isTop ? 'linear-gradient(90deg,var(--gold-dark),var(--gold-light))' : 'rgba(160,144,112,.35)'};border-radius:99px;transition:width 1s ease"></div>
        </div>
      </div>
    </div>`;
  }).join('');

  // 1. Render on original show page
  const consagradosCard = document.getElementById('consagrados-card');
  const consagradosRows = document.getElementById('consagrados-rows');
  const showLayoutContainer = document.querySelector('.show-layout-container');

  if (consagradosCard && consagradosRows) {
    if (consagradosData.length > 0) {
      consagradosCard.style.display = 'block';
      if (showLayoutContainer) showLayoutContainer.classList.add('two-columns');
      consagradosRows.innerHTML = consagradosHtml;
    } else {
      consagradosCard.style.display = 'none';
      if (showLayoutContainer) showLayoutContainer.classList.remove('two-columns');
    }
  }

  const el = document.getElementById('show-rows');
  if (el) {
    if (!activeParts.length) {
      el.innerHTML = '<div style="text-align:center;color:var(--text2);padding:32px">Esperando participantes...</div>';
    } else {
      el.innerHTML = activeHtml;
    }
  }

  // 2. Render on public monitor screen (pantalla)
  const pConsagradosCard = document.getElementById('pantalla-consagrados-card');
  const pConsagradosRows = document.getElementById('pantalla-consagrados-rows');
  const pShowRows = document.getElementById('pantalla-show-rows');
  const pContainer = pShowRows?.closest('.show-layout-container');

  if (pConsagradosCard && pConsagradosRows) {
    if (consagradosData.length > 0) {
      pConsagradosCard.style.display = 'block';
      pConsagradosRows.innerHTML = consagradosHtml;
      if (pContainer) {
        pContainer.style.display = 'grid';
        pContainer.style.gridTemplateColumns = '1fr 1fr';
        pContainer.style.gap = '20px';
      }
    } else {
      pConsagradosCard.style.display = 'none';
      if (pContainer) {
        pContainer.style.display = 'block';
      }
    }
  }

  if (pShowRows) {
    if (!activeParts.length) {
      pShowRows.innerHTML = '<div style="text-align:center;color:var(--text2);padding:32px">Esperando participantes...</div>';
    } else {
      pShowRows.innerHTML = activeHtml;
    }
  }
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
  if (MODE === 'vote' || currentPage === 'vote-public') loadPublicVoteOpts();
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
  if (peopleRow) peopleRow.style.display = selectedEventId ? '' : 'none';
  document.getElementById('r-name').focus();
  updateRegPreview();
}

// Paso B: completa el formulario y confirma
async function createNewUser() {
  const email = _pendingEmail;
  if (!email) { showErr('reg-form-err', 'Sesión expirada, recargá la página.'); return; }

  const name = document.getElementById('r-name').value.trim();
  const wa   = document.getElementById('r-wa').value.trim();
  const ppl  = selectedEventId ? (parseInt(document.getElementById('r-people').value) || 1) : 0;
  const ref  = document.getElementById('r-ref').value.trim();

  if (!name) { showErr('reg-form-err', 'Escribí tu nombre'); return; }
  if (!wa)   { showErr('reg-form-err', 'El WhatsApp es obligatorio'); return; }

  if (selectedEventId) {
    const spots = getEventSpots(selectedEventId);
    if (spots.isLimited && ppl > spots.remaining) {
      showErr('reg-form-err', `Solo quedan ${spots.remaining} lugares disponibles. Modificá tu cantidad de invitados.`);
      return;
    }
  }

  const btn = document.getElementById('reg-btn');
  btn.innerHTML = '<span class="spinner"></span> CREANDO...';
  btn.disabled  = true;

  const participant = {
    name, whatsapp: wa, email, referrer: ref,
    timestamp: Date.now(),
    updatedAt: Date.now(),
    extraPts: 0, micclubPts: 0,
    reservations: {}
  };

  if (selectedEventId) {
    participant.reservations[selectedEventId] = {
      people: ppl,
      song: '', songTitle: '', songArtist: '', karaokeLink: '', songConfirmed: false,
      voteSong: 0, votePerf: 0,
      juryScoresSong: {}, juryScoresPerf: {}, juryScoresHinchada: {}, juryScoresPublico: {},
      prizeSong: false, prizePerf: false, prizeHinchada: false, prizeMesa: false,
      prizePublicoSong: false, prizePublicoPerf: false
    };
    if (selectedEventId === 'event1') {
      participant.people = 0;
      participant.songTitle = '';
      participant.songArtist = '';
      participant.song = '';
      participant.karaokeLink = '';
      participant.songConfirmed = false;
    }
  }

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
    const referrerEntry = findReferrer(ref);
    if (referrerEntry) {
      const [rId, rp] = referrerEntry;
      const newMicPts = (parseInt(rp.micclubPts) || 0) + 10;
      if (firebaseOk) {
        dbUpdate(dbRef(db, `participants/${rId}`), { micclubPts: newMicPts });
      } else {
        if (allParticipants[rId]) allParticipants[rId].micclubPts = newMicPts;
      }
    }
    document.getElementById('reg-main-form').style.display = 'none';
    updateUI();
    if (selectedEventId && ppl > 0) {
      showReservationSuccess(ppl, selectedEventId);
    } else {
      showProfileView(currentPId, participant);
    }
  } catch(e) {
    const msg = e?.message || e?.code || 'Intentá de nuevo';
    showErr('reg-form-err', `Error al registrar: ${msg}`);
    console.error('createNewUser error:', e);
    btn.innerHTML = 'CONFIRMAR';
    btn.disabled  = false;
  }
}

// submitReservation alias seguro
function submitReservation() { checkEmail(); }

// ── VISTA DE PERFIL ───────────────────────────────────────────────────────────
function resetRegisterPage() {
  currentPId = null;
  selectedEventId = null;
  eventSelectedManually = false;
  showingReservationSuccess = false;
  
  const gate = document.getElementById('reg-email-gate');
  const form = document.getElementById('reg-main-form');
  const prof = document.getElementById('reg-profile');
  const selector = document.getElementById('reg-event-selector');
  const banner = document.getElementById('reg-cupo-banner');
  const success = document.getElementById('reg-success-view');
  
  if (gate) gate.style.display = 'none';
  if (form) form.style.display = 'none';
  if (prof) prof.style.display = 'none';
  if (selector) selector.style.display = 'none';
  if (banner) banner.style.display = 'none';
  if (success) success.style.display = 'none';
  
  const emailInput   = document.getElementById('r-email');
  const emailConfirm = document.getElementById('reg-email-confirm');
  if (emailInput)   emailInput.value        = '';
  if (emailConfirm) emailConfirm.style.display = 'none';
  
  const rName   = document.getElementById('r-name');
  const rWa     = document.getElementById('r-wa');
  const rRef    = document.getElementById('r-ref');
  const rPeople = document.getElementById('r-people');
  const regBtn  = document.getElementById('reg-btn');
  if (rName)   rName.value   = '';
  if (rWa)     rWa.value     = '';
  if (rRef)    rRef.value    = '';
  if (rPeople) rPeople.value = '';
  if (regBtn)  { regBtn.innerHTML = 'CONFIRMAR'; regBtn.disabled = false; }
  const regErr = document.getElementById('reg-form-err');
  if (regErr) regErr.style.display = 'none';
  
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

  updateRegistrationPageUI();
}

function showReservationSuccess(ppl, eventId) {
  showingReservationSuccess = true;
  const ev = localState.settings?.events?.[eventId] || {};
  const eventName = ev.name || 'Próximo Evento';
  const eventDate = ev.date || '';
  const eventTime = ev.time || '';
  const eventVenue = ev.venue || '';
  
  const spotsText = ppl === 1 ? '1 lugar' : `${ppl} lugares`;
  const totalAmount = ppl * 6000;
  const summaryText = ppl === 1 ? '1 persona' : `${ppl} personas`;
  
  const countEl = document.getElementById('success-spots-count');
  const nameEl = document.getElementById('success-event-name');
  const metaEl = document.getElementById('success-event-meta');
  const totalEl = document.getElementById('success-total-amount');
  const summaryEl = document.getElementById('success-spots-summary');
  const waLink = document.getElementById('success-wa-link');
  
  if (countEl) countEl.textContent = spotsText;
  if (nameEl) nameEl.textContent = eventName;
  
  let metaText = '';
  const metaParts = [];
  if (eventDate) metaParts.push(eventDate);
  if (eventTime) metaParts.push(`a las ${eventTime}`);
  if (eventVenue) metaParts.push(`en ${eventVenue}`);
  if (metaParts.length > 0) {
    metaText = `(${metaParts.join(' ')})`;
  }
  if (metaEl) metaEl.textContent = metaText;
  
  if (totalEl) totalEl.textContent = `$${totalAmount}`;
  if (summaryEl) summaryEl.textContent = summaryText;
  
  if (waLink) {
    const waParts = [];
    if (eventDate) waParts.push(eventDate);
    if (eventVenue) waParts.push(eventVenue);
    const waDetails = waParts.length > 0 ? ` (${waParts.join(' - ')})` : '';
    const textMsg = `¡Hola! Realicé una reserva de ${spotsText} para el evento "${eventName}"${waDetails}. Acá está mi comprobante de transferencia.`;
    waLink.href = `https://wa.me/5493624834753?text=${encodeURIComponent(textMsg)}`;
  }
  
  const gate = document.getElementById('reg-email-gate');
  const form = document.getElementById('reg-main-form');
  const prof = document.getElementById('reg-profile');
  const selector = document.getElementById('reg-event-selector');
  const banner = document.getElementById('reg-cupo-banner');
  const successView = document.getElementById('reg-success-view');
  
  if (gate) gate.style.display = 'none';
  if (form) form.style.display = 'none';
  if (prof) prof.style.display = 'none';
  if (selector) selector.style.display = 'none';
  if (banner) banner.style.display = 'none';
  
  if (successView) successView.style.display = 'block';
  window.scrollTo(0, 0);
}

function copyAliasToClipboard() {
  const alias = "lasalasdemivoz";
  navigator.clipboard.writeText(alias).then(() => {
    const el = document.getElementById('success-alias-copy');
    if (el) {
      const originalText = el.textContent;
      el.textContent = "¡Copiado!";
      el.style.color = "var(--teal)";
      setTimeout(() => {
        el.textContent = originalText;
        el.style.color = "var(--gold)";
      }, 1500);
    }
  }).catch(err => {
    console.error('Error al copiar al portapapeles:', err);
  });
}

function renderRegistrationEventSelectorList(ev1, ev2) {
  const listEl = document.getElementById('reg-event-selector-list');
  if (!listEl) return;
  
  const spots1 = getEventSpots('event1');
  const spots2 = getEventSpots('event2');
  
  const desc1 = spots1.isLimited ? `${spots1.remaining} lugares disponibles de ${spots1.total}` : 'Sin límite de cupo';
  const desc2 = spots2.isLimited ? `${spots2.remaining} lugares disponibles de ${spots2.total}` : 'Sin límite de cupo';
  
  listEl.innerHTML = `
    <div class="p-item" onclick="selectRegistrationEvent('event1', true)" style="padding:16px;background:var(--bg3);border:1px solid var(--border);border-radius:10px;cursor:pointer;transition:all 0.2s">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span style="font-family:'Inter',sans-serif;font-size:24px;color:var(--gold)">${esc(ev1.name)}</span>
        <span style="font-size:12px;color:var(--teal);font-weight:bold">${desc1}</span>
      </div>
      <div style="font-size:13px;color:var(--text2);margin-top:4px">
        📅 ${esc(ev1.date)} &middot; 🕒 ${esc(ev1.time)} &middot; 📍 ${esc(ev1.venue)}
      </div>
    </div>
    <div class="p-item" onclick="selectRegistrationEvent('event2', true)" style="padding:16px;background:var(--bg3);border:1px solid var(--border);border-radius:10px;cursor:pointer;transition:all 0.2s">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span style="font-family:'Inter',sans-serif;font-size:24px;color:var(--gold)">${esc(ev2.name)}</span>
        <span style="font-size:12px;color:var(--teal);font-weight:bold">${desc2}</span>
      </div>
      <div style="font-size:13px;color:var(--text2);margin-top:4px">
        📅 ${esc(ev2.date)} &middot; 🕒 ${esc(ev2.time)} &middot; 📍 ${esc(ev2.venue)}
      </div>
    </div>
  `;
}

function selectRegistrationEvent(eventId, isManual = false) {
  selectedEventId = eventId;
  eventSelectedManually = isManual;
  
  const selector = document.getElementById('reg-event-selector');
  if (selector) selector.style.display = 'none';
  
  const gate = document.getElementById('reg-email-gate');
  if (gate) gate.style.display = 'block';
  
  const gateTitle = document.getElementById('register-page-title');
  if (gateTitle) gateTitle.textContent = 'RESERVA';
  const gateSub = document.getElementById('register-page-sub');
  if (gateSub) gateSub.textContent = 'Tu perfil · Canción · Puntos';
  const rEmailBtn = document.getElementById('reg-email-btn');
  if (rEmailBtn) rEmailBtn.disabled = false;
  
  updateRegistrationCupoBanner();
}

function updateRegistrationCupoBanner() {
  const banner = document.getElementById('reg-cupo-banner');
  if (!banner || !selectedEventId) return;
  
  const ev = localState.settings?.events?.[selectedEventId];
  if (!ev) {
    banner.style.display = 'none';
    return;
  }
  
  banner.style.display = 'block';
  
  const nameEl = document.getElementById('cupo-banner-event-name');
  const detEl = document.getElementById('cupo-banner-event-details');
  const spotsEl = document.getElementById('cupo-banner-spots');
  const changeBtn = document.getElementById('cupo-banner-change-btn');
  
  if (nameEl) nameEl.textContent = ev.name;
  if (detEl) detEl.textContent = [ev.date, ev.time, ev.venue].filter(Boolean).join(' · ');
  
  const spots = getEventSpots(selectedEventId);
  if (spotsEl) {
    spotsEl.textContent = spots.isLimited ? `Plazas libres: ${spots.remaining} (de ${spots.total})` : 'Plazas ilimitadas';
  }
  
  const ev1 = localState.settings?.events?.event1;
  const ev2 = localState.settings?.events?.event2;
  if (changeBtn) {
    changeBtn.style.display = (ev1 && ev2) ? 'inline-block' : 'none';
  }
}

function showProfileView(id, p) {
  currentPId = id;
  document.getElementById('reg-email-gate').style.display = 'none';
  document.getElementById('reg-main-form').style.display  = 'none';
  const prof = document.getElementById('reg-profile');
  if (!prof) return;
  prof.style.display = 'block';

  const pEvent = selectedEventId ? getParticipantForEvent(p, selectedEventId) : p;

  const ce    = selectedEventId ? localState.settings?.events?.[selectedEventId] : localState.settings?.currentEvent;
  const subEl = document.getElementById('register-page-sub');
  if (subEl) subEl.textContent = ce?.name ? `Para ${ce.name}` : 'Tu perfil · Canción · Puntos';

  const emailEl = document.getElementById('prof-email');
  if (emailEl) emailEl.textContent = p.email || '';
  const ni  = document.getElementById('prof-name-input');
  const phi = document.getElementById('prof-phone-input');
  const ppi = document.getElementById('prof-people-input');
  if (ni)  ni.value  = p.name     || '';
  if (phi) phi.value = p.whatsapp || '';
  const peopleRow = document.getElementById('prof-people-display-row');
  if (peopleRow) peopleRow.style.display = selectedEventId ? '' : 'none';
  if (ppi) {
    ppi.value    = selectedEventId && (parseInt(pEvent.people) || 0) > 0 ? String(pEvent.people) : '';
    ppi.disabled = !selectedEventId;
  }

  const eventSection = document.getElementById('prof-event-section');
  if (eventSection) eventSection.style.display = selectedEventId ? 'block' : 'none';

  if (selectedEventId) {
    const ppi = document.getElementById('prof-people-input');
    const ti  = document.getElementById('s-title');
    const ai  = document.getElementById('s-artist');
    const li  = document.getElementById('s-link');
    if (ppi) ppi.value = (parseInt(pEvent.people) || 0) > 0 ? String(pEvent.people) : '';
    if (ti)  ti.value  = pEvent.songTitle   || '';
    if (ai)  ai.value  = pEvent.songArtist  || '';
    if (li)  li.value  = pEvent.karaokeLink || '';
    updatePeopleCheck();
    updateSongCheck();
  }

  const confirmBtn = document.getElementById('confirm-all-btn');
  const errEl      = document.getElementById('confirm-all-err');
  if (confirmBtn) { confirmBtn.innerHTML = '💾 GUARDAR Y SALIR'; confirmBtn.disabled = false; }
  if (errEl)      errEl.style.display = 'none';

  window.scrollTo(0, 0);
  
  // Update banner spots in real-time
  updateRegistrationCupoBanner();
}

// Guarda nombre, WhatsApp y personas al perder el foco de cualquier campo de perfil
async function saveProfileField() {
  if (!currentPId) return;
  const name  = document.getElementById('prof-name-input')?.value.trim() || '';
  const phone = document.getElementById('prof-phone-input')?.value.trim() || '';
  if (!name) return;
  const updates = { name, whatsapp: phone, updatedAt: Date.now() };
  if (showRunning && selectedEventId) {
    const ppl = parseInt(document.getElementById('prof-people-input')?.value) || 0;
    
    // Validar capacidad
    const spots = getEventSpots(selectedEventId);
    const currentRes = allParticipants[currentPId]?.reservations?.[selectedEventId] || {};
    const isMigratedActive = (selectedEventId === 'event1' && (!allParticipants[currentPId]?.reservations || !allParticipants[currentPId]?.reservations.event1) && (allParticipants[currentPId]?.songConfirmed || (allParticipants[currentPId]?.people && allParticipants[currentPId]?.people > 0)));
    const currentPpl = isMigratedActive ? (allParticipants[currentPId]?.people || 0) : (currentRes.people || 0);
    const capacityLimit = spots.isLimited ? (spots.remaining + currentPpl) : 999999;
    
    if (spots.isLimited && ppl > capacityLimit) {
      return;
    }
    
    updates[`reservations/${selectedEventId}/people`] = ppl;
    if (selectedEventId === 'event1') {
      updates.people = 0;
    }
  }
  try {
    if (firebaseOk) {
      await dbUpdate(dbRef(db, `participants/${currentPId}`), updates);
    } else {
      const p = allParticipants[currentPId];
      p.name = name;
      p.whatsapp = phone;
      p.updatedAt = Date.now();
      if (showRunning && selectedEventId) {
        if (!p.reservations) p.reservations = {};
        if (!p.reservations[selectedEventId]) p.reservations[selectedEventId] = {};
        p.reservations[selectedEventId].people = updates[`reservations/${selectedEventId}/people`];
        if (selectedEventId === 'event1') {
          p.people = 0;
        }
      }
      saveLocal();
    }
    if (allParticipants[currentPId]) {
      allParticipants[currentPId].name = name;
      allParticipants[currentPId].whatsapp = phone;
      if (showRunning && selectedEventId) {
        if (!allParticipants[currentPId].reservations) allParticipants[currentPId].reservations = {};
        if (!allParticipants[currentPId].reservations[selectedEventId]) allParticipants[currentPId].reservations[selectedEventId] = {};
        allParticipants[currentPId].reservations[selectedEventId].people = parseInt(document.getElementById('prof-people-input')?.value) || 0;
        if (selectedEventId === 'event1') {
          allParticipants[currentPId].people = 0;
        }
      }
    }
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
  const voteArea   = document.getElementById('vote-area');
  const voteDone   = document.getElementById('vote-done');
  const voteClosed = document.getElementById('vote-closed-banner');
  const voteBtn    = document.getElementById('vote-btn');

  // Ocultar todo primero
  if (voteClosed) voteClosed.style.display = 'none';
  if (voteDone)   voteDone.style.display   = 'none';

  if (!votingOpen) {
    // Votación cerrada — mensaje de despedida o próximo evento
    if (voteArea)   voteArea.style.display   = 'none';
    if (voteClosed) voteClosed.style.display = 'block';
    const msgEl = document.getElementById('vote-closed-msg');
    if (msgEl) {
      const ce = localState.settings?.currentEvent;
      if (showRunning && ce?.name) {
        msgEl.innerHTML = `¡Gracias por participar!<br><br>
          <span style="color:var(--gold);font-family:'Inter',sans-serif;font-size:20px;letter-spacing:2px">${esc(ce.name)}</span><br>
          ${ce.date ? `<span style="font-size:13px">${esc(ce.date)}${ce.venue ? ' · ' + esc(ce.venue) : ''}</span>` : ''}`;
      } else {
        msgEl.textContent = '¡Gracias por participar! Te esperamos en nuestro próximo evento.';
      }
    }
    return;
  }

  // Votación abierta — mostrar formulario
  if (voteArea) voteArea.style.display = 'block';

  const activeEventId = getCurrentEventId();
  const voterId = getOrCreateVoterId();

  if (tempSelectionsEventId !== activeEventId) {
    tempSelections = null;
    tempSelectionsEventId = activeEventId;
  }

  if (!tempSelections && activeEventId) {
    tempSelections = getDeviceVotesFromDB(voterId, activeEventId);
  }

  const dbVotes = getDeviceVotesFromDB(voterId, activeEventId);
  const hasVoted = dbVotes.song.length > 0 || dbVotes.perf.length > 0;

  if (hasVoted) {
    // Ya votó — mostrar banner editable
    if (voteDone) { voteDone.style.display = 'block'; voteDone.innerHTML = '✅ ¡Ya votaste! Podés modificar tu voto antes de que cierre la votación.'; }
    if (voteBtn)  voteBtn.textContent = 'ACTUALIZAR VOTO';
  } else {
    if (voteBtn) voteBtn.textContent = 'ENVIAR VOTOS';
  }

  const queue = getConsolidatedQueue(activeEventId);
  const queueIds = queue.filter(item => item.source === 'micclub').map(item => item.id);

  const parts = getEnrichedParticipantsList(activeEventId)
    .filter(p => p.songConfirmed)
    .sort((a, b) => {
      let idxA = queueIds.indexOf(a.id);
      let idxB = queueIds.indexOf(b.id);
      if (idxA === -1) idxA = 9999;
      if (idxB === -1) idxB = 9999;
      if (idxA !== idxB) return idxA - idxB;
      const tA = a.timestamp || 0;
      const tB = b.timestamp || 0;
      if (tA !== tB) return tA - tB;
      return a.id.localeCompare(b.id);
    });
  const el    = document.getElementById('vote-cards-container');
  if (!el) return;

  if (!parts.length) {
    el.innerHTML = '<div style="color:var(--text2);padding:16px;text-align:center">No hay participantes registrados aún</div>';
    return;
  }

  el.innerHTML = parts.map(p => {
    const song   = p.songTitle || p.song || '';
    const artist = p.songArtist || '';
    const detail = [song, artist].filter(Boolean).join(' · ');
    const wasSong = tempSelections?.song?.includes(p.id);
    const wasPerf = tempSelections?.perf?.includes(p.id);
    return `<div class="vote-row">
      <div class="vote-row-info">
        <div class="vote-row-name">${esc(p.name)}</div>
        ${detail ? `<div class="vote-row-song">${esc(detail)}</div>` : ''}
      </div>
      <div class="vote-row-btns">
        <button class="vote-pill${wasSong ? ' selected' : ''}" id="vb-song-${p.id}" onclick="toggleVoteBtn('song','${p.id}')">Mejor Canción</button>
        <button class="vote-pill${wasPerf ? ' selected' : ''}" id="vb-perf-${p.id}" onclick="toggleVoteBtn('perf','${p.id}')">Mejor Performance</button>
      </div>
    </div>`;
  }).join('');
}

function toggleVoteBtn(type, pid) {
  const btn = document.getElementById(`vb-${type}-${pid}`);
  if (!btn) return;
  btn.classList.toggle('selected');
  
  const activeEventId = getCurrentEventId();
  if (!tempSelections && activeEventId) {
    const voterId = getOrCreateVoterId();
    tempSelections = getDeviceVotesFromDB(voterId, activeEventId);
  }
  
  if (tempSelections) {
    const list = tempSelections[type];
    const index = list.indexOf(pid);
    if (index > -1) {
      list.splice(index, 1);
    } else {
      list.push(pid);
    }
  }
}

async function submitPublicVote() {
  const btn = document.getElementById('vote-btn');
  if (btn) {
    btn.innerHTML = 'ENVIANDO...';
    btn.disabled = true;
  }

  const songButtons = document.querySelectorAll('.vote-pill.selected[id^="vb-song-"]');
  const perfButtons = document.querySelectorAll('.vote-pill.selected[id^="vb-perf-"]');
  const songVotes = Array.from(songButtons).map(btn => btn.id.replace('vb-song-', ''));
  const perfVotes = Array.from(perfButtons).map(btn => btn.id.replace('vb-perf-', ''));

  const activeEventId = getCurrentEventId();
  if (!activeEventId) { 
    mcAlert('No hay evento activo'); 
    if (btn) { btn.innerHTML = 'ENVIAR VOTOS'; btn.disabled = false; }
    return; 
  }

  const voterId = getOrCreateVoterId();
  const prevVote = getDeviceVotesFromDB(voterId, activeEventId);

  try {
    if (firebaseOk) {
      const updates = {};
      Object.keys(allParticipants).forEach(pid => {
        const p = allParticipants[pid];
        const isMigratedActive = (activeEventId === 'event1' && (!p.reservations || !p.reservations.event1) && (p.songConfirmed || (p.people && p.people > 0)));
        const pathPrefix = isMigratedActive ? `participants/${pid}/` : `participants/${pid}/reservations/${activeEventId}/`;
        
        const isSongSelected = songVotes.includes(pid);
        const wasSongSelected = prevVote.song.includes(pid);
        
        const isPerfSelected = perfVotes.includes(pid);
        const wasPerfSelected = prevVote.perf.includes(pid);
        
        if (isSongSelected !== wasSongSelected) {
          updates[`${pathPrefix}publicVotes/${voterId}/song`] = isSongSelected ? true : null;
        }
        if (isPerfSelected !== wasPerfSelected) {
          updates[`${pathPrefix}publicVotes/${voterId}/perf`] = isPerfSelected ? true : null;
        }
      });

      if (Object.keys(updates).length) {
        await dbUpdate(dbRef(db), updates);
      }
    } else {
      Object.keys(allParticipants).forEach(pid => {
        const p = allParticipants[pid];
        const isMigratedActive = (activeEventId === 'event1' && (!p.reservations || !p.reservations.event1) && (p.songConfirmed || (p.people && p.people > 0)));
        if (!isMigratedActive) {
          if (!p.reservations) p.reservations = {};
          if (!p.reservations[activeEventId]) p.reservations[activeEventId] = {};
        }
        const target = isMigratedActive ? p : p.reservations[activeEventId];
        
        if (!target.publicVotes) target.publicVotes = {};
        
        const isSongSelected = songVotes.includes(pid);
        if (isSongSelected) {
          if (!target.publicVotes[voterId]) target.publicVotes[voterId] = {};
          target.publicVotes[voterId].song = true;
        } else if (target.publicVotes[voterId]) {
          delete target.publicVotes[voterId].song;
        }
        
        const isPerfSelected = perfVotes.includes(pid);
        if (isPerfSelected) {
          if (!target.publicVotes[voterId]) target.publicVotes[voterId] = {};
          target.publicVotes[voterId].perf = true;
        } else if (target.publicVotes[voterId]) {
          delete target.publicVotes[voterId].perf;
        }
        
        // Limpiar objeto de votante vacío
        if (target.publicVotes[voterId] && Object.keys(target.publicVotes[voterId]).length === 0) {
          delete target.publicVotes[voterId];
        }
      });
      saveLocal();
    }

    localStorage.setItem('voted_public', JSON.stringify({ song: songVotes, perf: perfVotes }));

    if (btn) {
      btn.innerHTML = (songVotes.length > 0 || perfVotes.length > 0) ? 'ACTUALIZAR VOTO' : 'ENVIAR VOTOS';
      btn.disabled = false;
    }

    showTemporaryAlert("¡Gracias por votar!", 2000, () => {
      tempSelections = null;
      tempSelectionsEventId = null;
      nav('program');
    });

  } catch(e) {
    console.error(e);
    mcAlert('Error al registrar voto: ' + e.message);
    if (btn) { 
      btn.innerHTML = (prevVote.song.length > 0 || prevVote.perf.length > 0) ? 'ACTUALIZAR VOTO' : 'ENVIAR VOTOS'; 
      btn.disabled = false; 
    }
  }
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

  const ce  = localState.settings?.currentEvent;
  const det = ce && ce.name ? [ce.name, ce.date, ce.time, ce.venue].filter(Boolean).join(' · ') : '';
  const sub = det ? `${det} · Panel Jurado` : 'Panel Jurado';

  // Sin evento activo — bloquear todo
  if (!showRunning) {
    if (hdr) hdr.innerHTML = `
      <div class="hero" style="padding: 8px 0 10px; text-align: center;">
        <div style="font-family:'Inter',sans-serif;font-size:12px;letter-spacing:4px;color:var(--gold);text-transform:uppercase;margin-bottom:8px;opacity:0.9">PANEL JURADO</div>
        <div class="hero-title">VOTACIÓN JURADO</div>
        <div class="hero-sub" style="margin-top: 6px;">Panel Jurado</div>
      </div>`;
    if (el) el.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px 20px;color:var(--text2)">
      <div style="font-size:32px;margin-bottom:12px">🎬</div>
      <div style="font-family:'Inter',sans-serif;font-size:16px;letter-spacing:1px;color:var(--text)">No hay evento activo</div>
      <div style="font-size:12px;margin-top:6px">La votación del jurado estará disponible cuando se inicie un evento.</div>
    </div>`;
    return;
  }

  // Encabezado dinámico con datos del evento
  if (hdr) {
    hdr.innerHTML = `
      <div class="hero" style="padding: 8px 0 10px; text-align: center;">
        <div style="font-family:'Inter',sans-serif;font-size:12px;letter-spacing:4px;color:var(--gold);text-transform:uppercase;margin-bottom:8px;opacity:0.9">PANEL JURADO</div>
        <div class="hero-title">VOTACIÓN JURADO</div>
        ${det ? `<div class="hero-sub" style="margin-top: 6px;">${esc(det)}</div>` : ''}
      </div>
    `;
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

  const activeEventId = getCurrentEventId();
  const pEvent = activeEventId ? getParticipantForEvent(p, activeEventId) : p;

  // Cargar puntajes previos de este jurado (si ya votó) o resetear
  const prevSong     = (pEvent.juryScoresSong     || {})[JURY_ID] || {};
  const prevPerf     = (pEvent.juryScoresPerf     || {})[JURY_ID] || {};
  const prevHinchada = (pEvent.juryScoresHinchada || {})[JURY_ID] || {};
  SONG_CRITERIA.forEach(c => { juryCurrentScores.song[c.key]     = parseInt(prevSong[c.key])     || 0; });
  PERF_CRITERIA.forEach(c => { juryCurrentScores.perf[c.key]     = parseInt(prevPerf[c.key])     || 0; });
  HINCHADA_CRITERIA.forEach(c => { juryCurrentScores.hinchada[c.key] = parseInt(prevHinchada[c.key]) || 0; });

  const nameEl = document.getElementById('jury-modal-participant-name');
  if (nameEl) nameEl.innerHTML = `<span style="font-weight:700">${esc(pEvent.name)}</span><span style="font-size:12px;color:var(--text2);margin-left:8px;font-weight:400">${esc(pEvent.songTitle || pEvent.song || '')}</span>`;

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

  const activeEventId = getCurrentEventId();

  try {
    if (firebaseOk) {
      const update = {};
      const prefix = activeEventId ? `reservations/${activeEventId}/` : '';
      
      // Canción
      Object.entries(juryCurrentScores.song).forEach(([k, v]) => {
        update[`${prefix}juryScoresSong/${JURY_ID}/${k}`] = v;
      });
      // Performance
      Object.entries(juryCurrentScores.perf).forEach(([k, v]) => {
        update[`${prefix}juryScoresPerf/${JURY_ID}/${k}`] = v;
      });
      // Hinchada
      Object.entries(juryCurrentScores.hinchada).forEach(([k, v]) => {
        update[`${prefix}juryScoresHinchada/${JURY_ID}/${k}`] = v;
      });
      
      if (activeEventId === 'event1') {
        update['juryScoresSong'] = null;
        update['juryScoresPerf'] = null;
        update['juryScoresHinchada'] = null;
      }
      
      await dbUpdate(dbRef(db, `participants/${id}`), update);
    } else {
      const p = allParticipants[id];
      if (activeEventId) {
        if (!p.reservations) p.reservations = {};
        if (!p.reservations[activeEventId]) p.reservations[activeEventId] = {};
        const res = p.reservations[activeEventId];
        if (!res.juryScoresSong) res.juryScoresSong = {};
        if (!res.juryScoresPerf) res.juryScoresPerf = {};
        if (!res.juryScoresHinchada) res.juryScoresHinchada = {};
        res.juryScoresSong[JURY_ID] = { ...juryCurrentScores.song };
        res.juryScoresPerf[JURY_ID] = { ...juryCurrentScores.perf };
        res.juryScoresHinchada[JURY_ID] = { ...juryCurrentScores.hinchada };
        
        if (activeEventId === 'event1') {
          p.juryScoresSong = {};
          p.juryScoresPerf = {};
          p.juryScoresHinchada = {};
        }
      } else {
        if (!p.juryScoresSong)     p.juryScoresSong     = {};
        if (!p.juryScoresPerf)     p.juryScoresPerf     = {};
        if (!p.juryScoresHinchada) p.juryScoresHinchada = {};
        p.juryScoresSong[JURY_ID]     = { ...juryCurrentScores.song };
        p.juryScoresPerf[JURY_ID]     = { ...juryCurrentScores.perf };
        p.juryScoresHinchada[JURY_ID] = { ...juryCurrentScores.hinchada };
      }
      saveLocal();
    }
  } catch(e) {
    console.error(e);
    if (btn) { btn.disabled = false; btn.innerHTML = '⭐ CONFIRMAR TODO'; }
  }
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
  if (pass === '1450') {
    adminLoggedIn = true;
    isSuperAdmin = true;
    document.getElementById('admin-login').style.display = 'none';
    document.getElementById('admin-panel').style.display  = 'block';
    setAdminTab('ctrl');
    updateDashboard();
  } else if (pass === stored) {
    adminLoggedIn = true;
    isSuperAdmin = false;
    document.getElementById('admin-login').style.display = 'none';
    document.getElementById('admin-panel').style.display  = 'block';
    setAdminTab('ctrl');
    updateDashboard();
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
function switchMobileSection(section) {
  const adminCols = document.querySelectorAll('.admin-main-column');
  const videoCols = document.querySelectorAll('.admin-video-column');
  
  const btnAdmin = document.getElementById('mob-nav-admin');
  const btnEmision = document.getElementById('mob-nav-emision');
  
  if (btnAdmin) btnAdmin.classList.toggle('active', section === 'admin');
  if (btnEmision) btnEmision.classList.toggle('active', section === 'reproduccion' || section === 'emision');
  
  adminCols.forEach(col => {
    col.style.display = (section === 'admin') ? 'block' : 'none';
  });
  
  videoCols.forEach(col => {
    col.style.display = (section === 'reproduccion' || section === 'emision') ? 'block' : 'none';
  });
  
  if (section === 'reproduccion' || section === 'emision') {
    renderPlaylistQueue();
  }
}
window.switchMobileSection = switchMobileSection;

function setAdminTab(tab) {
  adminTab = tab;
  renderAdminEventSelectorBar();
  ['ctrl', 'parts', 'jury', 'links', 'video'].forEach(t => {
    const btn = document.getElementById(`atab-${t}-btn`);
    if (btn) btn.classList.toggle('active', t === tab);
    const el = document.getElementById(`atab-${t}`);
    if (el) el.style.display = t === tab ? 'block' : 'none';
  });

  const sidebar = document.getElementById('admin-video-sidebar');
  if (sidebar) {
    if (window.innerWidth < 992) {
      sidebar.style.display = (tab === 'video') ? 'block' : 'none';
    } else {
      sidebar.style.display = 'block';
    }
  }

  if (tab === 'parts') renderAdminParticipants();
  if (tab === 'jury')  renderAdminJury();
  if (tab === 'links') renderLinks();
  if (tab === 'video' || tab === 'ctrl') renderPlaylistQueue();
}

function renderAdminEventSelectorBar() {
  const container = document.getElementById('admin-event-selector-bar');
  if (!container) return;

  const ev1 = localState.settings?.events?.event1;
  const ev2 = localState.settings?.events?.event2;

  if (!ev1 && !ev2) {
    container.style.display = 'none';
    return;
  }
  container.style.display = 'flex';

  const currentActiveId = getCurrentEventId();

  let html = `
    <div style="font-family:'Inter',sans-serif;font-size:11px;letter-spacing:1px;color:var(--text2);text-transform:uppercase;display:flex;align-items:center;gap:6px">
      <span>🛠️ Gestionar:</span>
    </div>
    <div style="display:flex;gap:8px;flex:1;min-width:0;justify-content:flex-start;flex-wrap:wrap">
  `;

  const slots = [];
  if (ev1) slots.push({ id: 'event1', data: ev1 });
  if (ev2) slots.push({ id: 'event2', data: ev2 });

  slots.forEach(slotItem => {
    const isGlobalActive = slotItem.id === currentActiveId;
    const name = slotItem.data.name || '';
    const dateText = slotItem.data.date ? ` (${slotItem.data.date})` : '';

    html += `
      <div style="display:flex;align-items:center;gap:8px;background:var(--bg2);border:1px solid ${isGlobalActive ? 'var(--gold)' : 'var(--border)'};border-radius:8px;padding:6px 12px;box-sizing:border-box;min-height:38px">
        <span style="font-size:13px;color:var(--text);font-weight:600">${esc(name)}${dateText}</span>
        ${isGlobalActive ? `
          <button class="btn btn-sm btn-gold" style="min-height:26px;padding:0 10px;font-size:10px;width:auto;border-radius:6px;font-family:'Inter',sans-serif;letter-spacing:1px;margin:0;cursor:default">ACTIVO</button>
        ` : `
          <button onclick="setActiveEvent('${slotItem.id}')" class="btn btn-sm btn-outline" style="min-height:26px;padding:0 10px;font-size:10px;width:auto;border-radius:6px;cursor:pointer;font-family:'Inter',sans-serif;letter-spacing:1px;border-color:var(--gold);color:var(--gold);background:transparent;margin:0">ACTIVAR</button>
        `}
      </div>
    `;
  });

  html += `</div>`;

  container.innerHTML = html;
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
  const isMobile = window.innerWidth < 992;
  const closedLabel = isMobile ? 'Votar' : 'Abrir votación';
  const openLabel = isMobile ? 'Cerrar' : 'Cerrar votación';

  // Botón config
  const cfgBtn = document.getElementById('config-vote-toggle-btn');
  if (cfgBtn) {
    cfgBtn.classList.remove('btn-teal', 'btn-vote-open', 'btn-vote-closed', 'btn-vote-disabled');
    if (votingOpen) {
      cfgBtn.textContent = 'Cerrar votación';
      cfgBtn.classList.add('btn-vote-open');
    } else {
      cfgBtn.textContent = 'Abrir votación';
      cfgBtn.classList.add('btn-vote-closed');
    }
  }
  // Botón del dashboard
  const dashBtn = document.getElementById('dash-vote-toggle-btn');
  if (dashBtn) {
    dashBtn.classList.remove('btn-outline', 'btn-vote-open', 'btn-vote-closed', 'btn-vote-disabled');
    if (showRunning) {
      if (votingOpen) {
        dashBtn.textContent = openLabel;
        dashBtn.classList.add('btn-vote-open');
      } else {
        dashBtn.textContent = closedLabel;
        dashBtn.classList.add('btn-vote-closed');
      }
    } else {
      dashBtn.textContent = closedLabel;
      dashBtn.classList.add('btn-vote-disabled');
    }
  }
}

function toggleVoting() {
  if (votingOpen) { closeVoting(); } else { openVoting(); }
}

function resetVotingVisibleColumns() {
  if (!localState.settings) localState.settings = {};
  localState.settings.votingVisibleColumns = {
    pubSong: false,
    pubPerf: false,
    jurySong: false,
    juryPerf: false,
    juryHinchada: false
  };
  if (firebaseOk) {
    dbUpdate(dbRef(db, 'settings'), { votingVisibleColumns: localState.settings.votingVisibleColumns });
  }
  if (castChannel) {
    castChannel.postMessage({
      type: 'sync_voting_columns',
      votingVisibleColumns: localState.settings.votingVisibleColumns
    });
  }
  updateUI();
}

async function openVoting() {
  try {
    resetVotingVisibleColumns();
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
  const updates = { 'settings/votingOpen': false, 'settings/votingCloseAt': null };
  try {
    if (firebaseOk) {
      await dbUpdate(dbRef(db), updates);
    } else {
      localState.settings.votingOpen    = false;
      localState.settings.votingCloseAt = null;
      votingOpen = false;
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
      resetRevealedCategories();
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

  const activeEventId = getAdminActiveEventId();
  if (activeEventId) {
    const spots = getEventSpots(activeEventId);
    if (spots.isLimited && ppl > spots.remaining) {
      mcAlert(`No se puede agregar: supera la capacidad. Quedan ${spots.remaining} lugares.`);
      return;
    }
  }

  const code  = makeCode();
  const sLink = buildBaseURL() + `?mode=register&code=${code}`;
  const p = {
    name, whatsapp: wa, email: '', referrer: '',
    reservationCode: code, songLink: sLink,
    timestamp: Date.now(),
    updatedAt: Date.now(),
    extraPts: 0, micclubPts: 0,
    reservations: {}
  };
  
  if (activeEventId) {
    p.reservations[activeEventId] = {
      people: ppl,
      song: '', songTitle: '', songArtist: '', karaokeLink: '', songConfirmed: false,
      voteSong: 0, votePerf: 0,
      juryScoresSong: {}, juryScoresPerf: {}, juryScoresHinchada: {}, juryScoresPublico: {},
      prizeSong: false, prizePerf: false, prizeHinchada: false, prizeMesa: false,
      prizePublicoSong: false, prizePublicoPerf: false
    };
    if (activeEventId === 'event1') {
      p.people = 0;
      p.songTitle = '';
      p.songArtist = '';
      p.song = '';
      p.karaokeLink = '';
      p.songConfirmed = false;
    }
  }

  if (firebaseOk) {
    const r = dbPush(dbRef(db, 'participants'));
    await dbSet(r, p);
  } else {
    allParticipants['p_' + Date.now()] = p;
    saveLocal();
  }
  ['a-name', 'a-wa'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('a-ppl').value = '1';
}

function renderAdminParticipants() {
  const activeEventId = getAdminActiveEventId();
  const parts = sorted(activeEventId);
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
    if (p.prizeMesa)        badges.push('<span class="badge badge-teal">🪑</span>');
    if (p.prizePublicoSong) badges.push('<span class="badge badge-gold">🎤</span>');
    if (p.prizePublicoPerf) badges.push('<span class="badge badge-purple">🏆</span>');
    const sStatus = p.songConfirmed
      ? `<span style="color:var(--teal);font-size:10px">✅ Canción OK</span>`
      : `<span style="color:var(--red);font-size:10px">⚠️ Sin canción</span>`;
    const karLink  = p.karaokeLink ? `<div class="p-info">🎬 <a href="${esc(p.karaokeLink)}" target="_blank" onclick="setAdminTab('video')" style="color:var(--purple-light);font-size:10px">Ver karaoke →</a></div>` : '';
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
        <button class="btn btn-outline btn-sm" onclick="openModal('${p.id}')">Editar</button>
        <button class="btn btn-danger btn-sm"  onclick="delParticipant('${p.id}')" style="display:inline-flex;align-items:center;justify-content:center;padding:0;width:34px;height:34px;min-height:auto"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg></button>
      </div>
    </div>`;
  }).join('');
}

function renderAdminMicClubParticipants() {
  const activeEventId = getAdminActiveEventId();
  const parts = sorted(activeEventId).filter(p => p.songConfirmed || p.songTitle || p.song);
  const countEl = document.getElementById('admin-micclub-participants-count');
  if (countEl) countEl.textContent = parts.length;

  const el = document.getElementById('admin-micclub-participants-list');
  if (!el) return;
  if (!parts.length) {
    el.innerHTML = '<div style="text-align:center;color:var(--text2);padding:20px;font-style:italic">No hay participantes inscriptos al karaoke.</div>';
    return;
  }

  el.innerHTML = parts.map((p, index) => {
    const songText = p.songTitle && p.songArtist 
      ? `${esc(p.songTitle)} — ${esc(p.songArtist)}` 
      : (p.song ? esc(p.song) : '<span style="color:var(--red);font-style:italic">Sin canción registrada</span>');

    const ytButton = p.karaokeLink ? `
      <a href="${esc(p.karaokeLink)}" target="_blank" onclick="setAdminTab('video')" class="btn btn-sm btn-outline" style="border-color:#ff0000;color:#ff0000;font-size:11px;padding:6px 10px;min-height:auto;display:inline-flex;align-items:center;gap:4px;text-decoration:none">
        🎬 YouTube
      </a>
    ` : '';

    return `<div style="padding:10px;background:var(--bg3);border:1px solid var(--border);border-radius:8px;display:flex;flex-direction:column;gap:8px">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span style="font-weight:700;color:var(--gold);font-family:'Inter',sans-serif;font-size:14px">${index + 1}. ${esc(p.name)}</span>
        <span style="font-size:11px;color:var(--text2)">${new Date(p.timestamp || Date.now()).toLocaleTimeString('es-AR', {hour: '2-digit', minute:'2-digit'})}</span>
      </div>
      <div style="font-size:13px;color:var(--text)">
        <strong>Canción:</strong> ${songText}
      </div>
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:4px">
        ${ytButton}
        <button class="btn btn-sm btn-outline" onclick="openModal('${p.id}')" style="font-size:11px;padding:6px 10px;min-height:auto;background:transparent;cursor:pointer">
          Editar
        </button>
        <button class="btn btn-sm" onclick="delParticipant('${p.id}')" style="border-color:rgba(255,61,107,.4);color:rgba(255,61,107,.7);font-size:11px;padding:6px 10px;min-height:auto;background:transparent;cursor:pointer">
          Borrar
        </button>
      </div>
    </div>`;
  }).join('');
}

function renderAdminJury() {
  const activeEventId = getAdminActiveEventId();
  const parts = sorted(activeEventId).filter(p => p.karaokeLink || p.songConfirmed);

  const renderCriteriaTable = (cat, elId) => {
    const el = document.getElementById(elId);
    if (!el) return;
    const rows = parts.map(p => ({
      name: p.name, id: p.id,
      total:  getJuryTotal(p.id, cat, activeEventId),
      scores: cat === 'song' ? (p.juryScoresSong || {}) : (cat === 'perf' ? (p.juryScoresPerf || {}) : (p.juryScoresHinchada || {}))
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
          <td style="padding:7px;text-align:right;font-family:'Inter',sans-serif;font-size:18px;color:var(--gold)">${r.total}</td>
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
      { key: 'prizeSong',     label: '🎵 Mejor Canción (Jurado) +10 pts',    cat: 'song'     },
      { key: 'prizePerf',     label: '🎭 Mejor Performance (Jurado) +10 pts', cat: 'perf'     },
      { key: 'prizeHinchada', label: '📣 Mejor Hinchada (Jurado) +8 pts',    cat: 'hinchada' },
      { key: 'prizeMesa',     label: '🪑 Mejor Mesa (Jurado) +8 pts',        cat: null       },
    ];
    const partsList = sorted(activeEventId);
    prizesEl.innerHTML = prizeItems.map(pr => {
      const juryLeader = pr.cat ? getJuryLeader(pr.cat, activeEventId) : null;
      const opts = partsList.map(p =>
        `<option value="${p.id}" ${p[pr.key] ? 'selected' : ''}>${esc(p.name)}${p[pr.key] ? ' ✅' : ''}</option>`
      ).join('');
      const leaderNote = juryLeader && juryLeader.score > 0
        ? `<div style="font-size:10px;color:var(--gold);margin-top:3px">👑 Líder jurado: <strong>${esc(juryLeader.name)}</strong> (${juryLeader.score} pts)</div>` : '';
      return `<div style="background:var(--bg3);border-radius:8px;padding:12px;margin-bottom:8px;border:1px solid var(--border)">
        <div style="font-family:'Inter',sans-serif;font-weight:600;font-size:13px;margin-bottom:4px">${pr.label}</div>
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
  const activeEventId = getAdminActiveEventId();
  if (!activeEventId) { mcAlert('No hay evento activo'); return; }
  
  try {
    if (firebaseOk) {
      const batch = Object.entries(allParticipants).map(([id]) => {
        const updates = { [`reservations/${activeEventId}/${prizeKey}`]: false };
        if (activeEventId === 'event1') {
          updates[prizeKey] = false;
        }
        return dbUpdate(dbRef(db, `participants/${id}`), updates);
      });
      await Promise.all(batch);
      if (targetId) {
        const updates = { [`reservations/${activeEventId}/${prizeKey}`]: true };
        if (activeEventId === 'event1') {
          updates[prizeKey] = false;
        }
        await dbUpdate(dbRef(db, `participants/${targetId}`), updates);
      }
    } else {
      Object.keys(allParticipants).forEach(id => {
        const p = allParticipants[id];
        if (!p.reservations) p.reservations = {};
        if (!p.reservations[activeEventId]) p.reservations[activeEventId] = {};
        p.reservations[activeEventId][prizeKey] = false;
        if (activeEventId === 'event1') {
          p[prizeKey] = false;
        }
      });
      if (targetId) {
        const p = allParticipants[targetId];
        if (!p.reservations) p.reservations = {};
        if (!p.reservations[activeEventId]) p.reservations[activeEventId] = {};
        p.reservations[activeEventId][prizeKey] = true;
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
    const activeEventId = getCurrentEventId();
    const pEvent = activeEventId ? getParticipantForEvent(p, activeEventId) : p;
    document.getElementById('edit-ppl').value      = pEvent.people      || 0;
    document.getElementById('edit-song').value     = pEvent.songTitle   || pEvent.song || '';
    document.getElementById('edit-artist').value   = pEvent.songArtist  || '';
    document.getElementById('edit-karlink').value  = pEvent.karaokeLink || '';
    const epSong = document.getElementById('ep-song');
    const epPerf = document.getElementById('ep-perf');
    const epHinchada = document.getElementById('ep-hinchada');
    const epMesa = document.getElementById('ep-mesa');
    if (epSong)     epSong.checked     = !!pEvent.prizeSong;
    if (epPerf)     epPerf.checked     = !!pEvent.prizePerf;
    if (epHinchada) epHinchada.checked = !!pEvent.prizeHinchada;
    if (epMesa)     epMesa.checked     = !!pEvent.prizeMesa;
  }
  document.getElementById('edit-modal').classList.add('open');
  validateAdminForm();
}

function closeModal() {
  document.getElementById('edit-modal').classList.remove('open');
}

function validateAdminForm() {
  const name   = document.getElementById('edit-name')?.value.trim();
  const phone  = document.getElementById('edit-wa')?.value.trim();
  const title  = document.getElementById('edit-song')?.value.trim();
  const artist = document.getElementById('edit-artist')?.value.trim();
  const link   = document.getElementById('edit-karlink')?.value.trim();
  
  const btn    = document.getElementById('edit-save-btn');
  const errEl  = document.getElementById('edit-modal-err');

  let isLinkOk = false;
  if (link) {
    try {
      const parsed = new URL(link);
      isLinkOk = parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch (e) {
      isLinkOk = false;
    }
  }

  let songValid = true;
  if (showRunning) {
    const allSongEmpty = !title && !artist && !link;
    const allSongFilled = !!(title && artist && link && isLinkOk);
    songValid = allSongEmpty || allSongFilled;
  }

  const namePhoneValid = !!(name && phone);

  let isValid = false;
  let errorMsg = '';

  if (!namePhoneValid) {
    errorMsg = 'Nombre y WhatsApp son obligatorios.';
  } else if (!songValid) {
    if (!title || !artist || !link) {
      errorMsg = 'Si completás la canción, debés llenar todos los campos (Canción, Artista y Link Karaoke).';
    } else if (!isLinkOk) {
      errorMsg = 'El link de karaoke debe ser una dirección web válida (ej: https://youtube.com/...).';
    }
  } else {
    isValid = true;
  }

  if (btn) {
    btn.disabled = !isValid;
  }

  if (errEl) {
    if (errorMsg) {
      errEl.textContent = errorMsg;
      errEl.style.display = 'block';
    } else {
      errEl.style.display = 'none';
    }
  }
}

async function saveParticipant() {
  const id = document.getElementById('edit-id').value;
  const upd = {
    name:     document.getElementById('edit-name').value.trim(),
    whatsapp: document.getElementById('edit-wa').value.trim(),
    email:    document.getElementById('edit-email').value.trim(),
    extraPts: parseInt(document.getElementById('edit-extra').value) || 0,
    updatedAt: Date.now(),
  };
  const activeEventId = getAdminActiveEventId();
  if (showRunning && activeEventId) {
    const st = document.getElementById('edit-song').value.trim();
    const sa = document.getElementById('edit-artist').value.trim();
    const kl = document.getElementById('edit-karlink').value.trim();
    const ppl = parseInt(document.getElementById('edit-ppl').value) || 0;
    
    // Validar capacidad
    const spots = getEventSpots(activeEventId);
    const p = allParticipants[id] || {};
    const res = p.reservations?.[activeEventId] || {};
    const isMigratedActive = (activeEventId === 'event1' && (!p.reservations || !p.reservations.event1) && (p.songConfirmed || (p.people && p.people > 0)));
    const currentPpl = isMigratedActive ? (p.people || 0) : (res.people || 0);
    const limit = spots.isLimited ? (spots.remaining + currentPpl) : 999999;
    if (spots.isLimited && ppl > limit) {
      mcAlert(`No se puede guardar: supera la capacidad. Quedan ${limit} lugares.`);
      return;
    }
    
    let isLinkOk = false;
    if (kl) {
      try {
        const parsed = new URL(kl);
        isLinkOk = parsed.protocol === 'http:' || parsed.protocol === 'https:';
      } catch (e) {
        isLinkOk = false;
      }
    }

    const oldRes = allParticipants[id]?.reservations?.[activeEventId] || {};
    const epSong = document.getElementById('ep-song')?.checked || false;
    const epPerf = document.getElementById('ep-perf')?.checked || false;
    const epHinchada = document.getElementById('ep-hinchada')?.checked || false;
    const epMesa = document.getElementById('ep-mesa')?.checked || false;

    const resUpdate = {
      ...oldRes,
      people: ppl,
      songTitle: st || '',
      songArtist: sa || '',
      karaokeLink: kl || '',
      song: (st && sa) ? `${st} — ${sa}` : '',
      songConfirmed: !!(st && sa && kl && isLinkOk),
      prizeSong: epSong,
      prizePerf: epPerf,
      prizeHinchada: epHinchada,
      prizeMesa: epMesa
    };
    
    upd[`reservations/${activeEventId}`] = resUpdate;
    
    if (activeEventId === 'event1') {
      upd.people        = 0;
      upd.songTitle     = '';
      upd.songArtist    = '';
      upd.karaokeLink   = '';
      upd.song          = '';
      upd.songConfirmed = false;
      upd.prizeSong     = false;
      upd.prizePerf     = false;
      upd.prizeHinchada = false;
      upd.prizeMesa     = false;
    }
  }
  if (firebaseOk) {
    await dbUpdate(dbRef(db, `participants/${id}`), upd);
  } else {
    const p = allParticipants[id];
    Object.assign(p, upd);
    if (showRunning && activeEventId) {
      if (!p.reservations) p.reservations = {};
      p.reservations[activeEventId] = upd[`reservations/${activeEventId}`];
      if (activeEventId === 'event1') {
        p.people = 0;
        p.songTitle = '';
        p.songArtist = '';
        p.song = '';
        p.karaokeLink = '';
        p.songConfirmed = false;
        p.prizeSong = false;
        p.prizePerf = false;
        p.prizeHinchada = false;
        p.prizeMesa = false;
      }
    }
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

async function endShow(slot) {
  try {
    const closedAt   = Date.now();
    const closedDate = new Date(closedAt).toLocaleDateString('es-AR');
    
    const eventInfo = localState.settings?.events?.[slot] || {};
    const partsArr = getEnrichedParticipantsList(slot);
    
    const songLeaderEntry = [...partsArr]
      .filter(p => (parseInt(p.voteSong) || 0) > 0)
      .sort((a, b) => (parseInt(b.voteSong) || 0) - (parseInt(a.voteSong) || 0))[0];
    const perfLeaderEntry = [...partsArr]
      .filter(p => (parseInt(p.votePerf) || 0) > 0)
      .sort((a, b) => (parseInt(b.votePerf) || 0) - (parseInt(a.votePerf) || 0))[0];
      
    if (songLeaderEntry) {
      const pId = songLeaderEntry.id;
      if (allParticipants[pId]) {
        if (!allParticipants[pId].reservations) allParticipants[pId].reservations = {};
        if (!allParticipants[pId].reservations[slot]) allParticipants[pId].reservations[slot] = {};
        allParticipants[pId].reservations[slot].prizePublicoSong = true;
        const idx = partsArr.findIndex(x => x.id === pId);
        if (idx !== -1) partsArr[idx].prizePublicoSong = true;
      }
    }
    if (perfLeaderEntry) {
      const pId = perfLeaderEntry.id;
      if (allParticipants[pId]) {
        if (!allParticipants[pId].reservations) allParticipants[pId].reservations = {};
        if (!allParticipants[pId].reservations[slot]) allParticipants[pId].reservations[slot] = {};
        allParticipants[pId].reservations[slot].prizePublicoPerf = true;
        const idx = partsArr.findIndex(x => x.id === pId);
        if (idx !== -1) partsArr[idx].prizePublicoPerf = true;
      }
    }
    
    const snap = {};
    partsArr.forEach(p => {
      if (p.songConfirmed || p.people > 0 || p.prizeSong || p.prizePerf || p.prizeHinchada || p.prizeMesa || p.prizePublicoSong || p.prizePublicoPerf) {
        snap[p.id] = p;
      }
    });
    
    enrichHistorySnapshot(snap);
    
    const historyEntry = {
      closedAt,
      closedDate,
      eventInfo: eventInfo,
      participants: snap
    };
    
    const scores = getEventScores(partsArr);
    const updates = {};
    
    updates[`settings/events/${slot}`] = null;
    updates[`freeKaraoke/${slot}`] = null;
    
    Object.keys(allParticipants).forEach(id => {
      const p = allParticipants[id];
      const eventPts = scores[id]?.total || 0;
      updates[`participants/${id}/micclubPts`] = (parseInt(p.micclubPts) || 0) + eventPts;
      updates[`participants/${id}/reservations/${slot}`] = null;
      updates[`participants/${id}/extraPts`] = 0;
      p.extraPts = 0;
      
      if (slot === 'event1') {
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
        updates[`participants/${id}/prizeMesa`]           = false;
        updates[`participants/${id}/people`]              = 0;
      }
    });
    
    if (!localState.settings) localState.settings = {};
    if (!localState.settings.events) localState.settings.events = {};
    localState.settings.events[slot] = null;
    
    const ev1 = localState.settings.events.event1;
    const ev2 = localState.settings.events.event2;
    const closest = getClosestEvent(ev1, ev2);
    
    if (adminSelectedEventSlot === slot) {
      adminSelectedEventSlot = null;
    }
    
    if (closest) {
      updates['settings/currentEvent'] = closest;
      updates['settings/activeEventSlot'] = closest.id;
    } else {
      updates['settings/currentEvent'] = null;
      updates['settings/activeEventSlot'] = null;
      updates['settings/showRunning'] = false;
      updates['settings/votingOpen'] = false;
      updates['settings/votingCloseAt'] = null;
    }
    updates['settings/votingVisibleColumns'] = null;
    if (!localState.settings) localState.settings = {};
    localState.settings.votingVisibleColumns = null;
    if (castChannel) {
      castChannel.postMessage({
        type: 'sync_voting_columns',
        votingVisibleColumns: {}
      });
    }
    
    if (firebaseOk) {
      try {
        await dbSet(dbRef(db, `history/${closedAt}`), historyEntry);
      } catch(he) {
        console.warn('Historial no guardado:', he.message);
      }
      await dbUpdate(dbRef(db), updates);
    } else {
      Object.keys(allParticipants).forEach(id => {
        const p = allParticipants[id];
        const eventPts = scores[id]?.total || 0;
        p.micclubPts = (parseInt(p.micclubPts) || 0) + eventPts;
        
        if (p.reservations) {
          delete p.reservations[slot];
        }
        if (slot === 'event1') {
          Object.assign(p, {
            voteSong: 0, votePerf: 0,
            prizePublicoSong: false, prizePublicoPerf: false,
            juryScoresSong: {}, juryScoresPerf: {}, juryScoresHinchada: {}, juryScoresPublico: {},
            songConfirmed: false, songTitle: '', songArtist: '', song: '', karaokeLink: '',
            prizeSong: false, prizePerf: false, prizeHinchada: false, prizeMesa: false,
            people: 0,
          });
        }
      });
      
      if (closest) {
        localState.settings.currentEvent = closest;
        localState.settings.activeEventSlot = closest.id;
      } else {
        localState.settings.currentEvent = null;
        localState.settings.activeEventSlot = null;
        localState.settings.showRunning = false;
        localState.settings.votingOpen = false;
        localState.settings.votingCloseAt = null;
        showRunning = false;
        votingOpen = false;
      }
      
      if (!localState.history) localState.history = {};
      localState.history[closedAt] = historyEntry;
      if (localState.freeKaraoke) {
        delete localState.freeKaraoke[slot];
      }
      freeKaraokeList[slot] = {};
      saveLocal();
    }
    
    updateUI();
    mcAlert(`✅ Evento finalizado y puntos guardados.`);
  } catch(e) {
    console.error(e);
    mcAlert('Error al finalizar el evento: ' + e.message);
  }
}

// Garantiza que no queden canciones ni reservas si no hay evento activo.
// Se llama automáticamente al cargar datos cuando showRunning === false.
async function enforceNoShowState() {
  if (showRunning) return; // solo actúa cuando no hay evento
  
  if (Object.keys(freeKaraokeList).length > 0) {
    try {
      if (firebaseOk) {
        await dbUpdate(dbRef(db), { freeKaraoke: null });
      } else {
        freeKaraokeList = {};
        localState.freeKaraoke = {};
        saveLocal();
      }
    } catch(e) { console.error('enforceNoShowState freeKaraoke cleanup error:', e); }
  }

  const dirty = Object.entries(allParticipants).filter(([, p]) =>
    p.songConfirmed || p.songTitle || p.karaokeLink || (parseInt(p.people) || 0) > 0 ||
    (parseInt(p.voteSong) || 0) > 0 || (parseInt(p.votePerf) || 0) > 0 ||
    p.juryScoresSong || p.juryScoresPerf || p.juryScoresHinchada ||
    p.prizeSong || p.prizePerf || p.prizeHinchada || p.prizeMesa
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
    updates[`participants/${id}/prizeMesa`]          = false;
    updates[`participants/${id}/prizePublicoSong`]   = false;
    updates[`participants/${id}/prizePublicoPerf`]   = false;
    // Actualiza también la copia local inmediatamente
    Object.assign(allParticipants[id], {
      songConfirmed: false, songTitle: '', songArtist: '', song: '', karaokeLink: '',
      people: 0, voteSong: 0, votePerf: 0,
      juryScoresSong: null, juryScoresPerf: null, juryScoresHinchada: null, juryScoresPublico: null,
      prizeSong: false, prizePerf: false, prizeHinchada: false, prizeMesa: false,
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
      if (showRunning) {
        const closedAt = Date.now();
        const snap = JSON.parse(JSON.stringify(allParticipants));
        enrichHistorySnapshot(snap);
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
      await dbSet(dbRef(db, 'freeKaraoke'), null);
      await dbUpdate(dbRef(db, 'settings'), {
        votingOpen: false, votingCloseAt: null, bonus: false,
        showRunning: false, currentEvent: null, events: null
      });
    } else {
      allParticipants = {};
      freeKaraokeList = {};
      localState.participants = {};
      localState.freeKaraoke = {};
      localState.history = {};
      localState.settings.votingOpen    = false;
      localState.settings.votingCloseAt = null;
      localState.settings.bonus         = false;
      localState.settings.showRunning   = false;
      localState.settings.currentEvent  = null;
      localState.settings.events        = null;
      saveLocal();
    }
    bonusActive = false; votingOpen = false; showRunning = false;
    localStorage.removeItem('voted_public');
    mcAlert('✅ Se borró la base de datos completa.');
    updateUI();
  } catch(e) { console.error(e); mcAlert('Error al borrar base: ' + e.message); }
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
          prizeSong: false, prizePerf: false, prizeHinchada: false, prizeMesa: false, prizePublicoSong: false, prizePublicoPerf: false,
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
    { icon: '🎤', label: 'Link de Reserva',          url: base + '?mode=register', desc: 'Para que los participantes se inscriban', btnText: '↗ Abrir' },
    { icon: '🗳️', label: 'Link de Votación Pública', url: base + '?mode=vote',     desc: 'Un solo QR/link para votar. Compartí durante el evento.', btnText: '↗ Abrir' },
    { icon: '⭐', label: 'Panel de Jurado',           url: base + '?mode=jury',     desc: 'Solo para los jurados.', btnText: '↗ Abrir' },
    { icon: '📺', label: 'Pantalla Pública',          url: base + '?mode=pantalla', desc: 'Para proyectar en la TV/proyector.', btnText: 'Mostrar' },
  ];
  el.innerHTML = links.map(l => `
    <div style="background:var(--bg3);border-radius:9px;padding:12px;margin-bottom:10px;border:1px solid var(--border)">
      <div style="font-family:'Inter',sans-serif;font-weight:600;font-size:13px;margin-bottom:3px">${l.icon} ${l.label}</div>
      <div style="font-size:10px;color:var(--text2);margin-bottom:7px">${l.desc}</div>
      <div style="background:var(--bg4);border-radius:6px;padding:8px;font-size:10px;word-break:break-all;color:var(--teal);margin-bottom:7px">${esc(l.url)}</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn btn-outline btn-sm" onclick="copyLink('${esc(l.url)}')">📋 Copiar</button>
        ${l.btnText === 'Mostrar' ? `
          <button class="btn btn-outline btn-sm" onclick="openProjectionWindow()">${esc(l.btnText)}</button>
        ` : `
          <a href="${esc(l.url)}" target="_blank" style="text-decoration:none">
            <button class="btn btn-outline btn-sm">${esc(l.btnText || '↗ Abrir')}</button>
          </a>
        `}
      </div>
    </div>`).join('');

  if (!document.getElementById('vote-qr-admin') && el) {
    const qrDiv = document.createElement('div');
    qrDiv.style.cssText = 'text-align:center;margin-top:14px';
    qrDiv.innerHTML = `
      <div class="card-sub mb-8">QR Votación Pública</div>
      <div class="qr-box" style="display:inline-block"><div id="vote-qr-admin"></div></div>
      <div style="font-size:10px;color:var(--text2);margin-top:8px;letter-spacing:2px;font-family:'Inter',sans-serif">ESCANEÁ PARA VOTAR</div>`;
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

// ── PRUEBAS Y SIMULACIÓN ──────────────────────────────────────────────────────
async function simularEvento() {
  const names = ['Ana', 'Carlos', 'Diego', 'Elena', 'Fernando', 'Gabriela', 'Hugo', 'Isabel', 'Juan', 'Laura', 'Martín', 'Natalia', 'Óscar', 'Patricia', 'Ramiro', 'Sofía'];
  
  const demoSongs = [
    { title: "De Música Ligera", artist: "Soda Stereo" },
    { title: "Como Alí", artist: "Los Piojos" },
    { title: "Persiana Americana", artist: "Soda Stereo" },
    { title: "La Bifurcada", artist: "Memphis La Blusera" },
    { title: "Ji Ji Ji", artist: "Patricio Rey" },
    { title: "Mil Horas", artist: "Los Abuelos de la Nada" },
    { title: "Seguir Viviendo Sin Tu Amor", artist: "Luis Alberto Spinetta" },
    { title: "Flaca", artist: "Andrés Calamaro" },
    { title: "Tratame Suavemente", artist: "Soda Stereo" },
    { title: "Un Vestido y un Amor", artist: "Fito Páez" },
    { title: "Mariposa Tecknicolor", artist: "Fito Páez" },
    { title: "11 y 6", artist: "Fito Páez" },
    { title: "Crimen", artist: "Gustavo Cerati" },
    { title: "Seminare", artist: "Charly García" },
    { title: "Rezo por Vos", artist: "Charly García" },
    { title: "Costumbres Argentinas", artist: "Los Abuelos de la Nada" }
  ];

  const newParticipants = {};
  
  names.forEach((name, i) => {
    const id = `demo_p${String(i+1).padStart(2, '0')}`;
    const song = demoSongs[i];
    newParticipants[id] = {
      id: id,
      name: name,
      people: Math.floor(Math.random() * 8) + 1,
      whatsapp: `11${Math.floor(10000000 + Math.random() * 90000000)}`,
      email: `${name.toLowerCase()}@micclub.com`,
      referrer: '',
      reservationCode: `DEMO${Math.floor(1000 + Math.random() * 9000)}`,
      song: `${song.title} — ${song.artist}`,
      songTitle: song.title,
      songArtist: song.artist,
      karaokeLink: 'https://youtube.com/watch?v=demo',
      songConfirmed: true,
      timestamp: Date.now(),
      updatedAt: Date.now(),
      prizeSong: false, prizePerf: false, prizeHinchada: false, prizeMesa: false, prizePublicoSong: false, prizePublicoPerf: false,
      juryScoresSong: {}, juryScoresPerf: {}, juryScoresHinchada: {}, juryScoresPublico: {},
      extraPts: 0, voteSong: 0, votePerf: 0, micclubPts: 0
    };
  });

  try {
    const evData = {
      name: 'Edición Demo Especial',
      date: new Date().toLocaleDateString('es-AR'),
      venue: 'Mic Club Stage',
      startedAt: Date.now()
    };

    // Respaldar datos activos existentes si son reales (IDs que no empiezan con demo_)
    const currentParts = allParticipants || {};
    const currentEvent = localState.settings?.currentEvent || null;
    const currentShowRunning = localState.settings?.showRunning || false;
    const currentVotingOpen = localState.settings?.votingOpen || false;

    const hasRealData = Object.keys(currentParts).length > 0 &&
                        !Object.keys(currentParts).every(id => id.startsWith('demo_'));

    if (hasRealData) {
      const backupData = {
        participants: currentParts,
        currentEvent: currentEvent,
        showRunning: currentShowRunning,
        votingOpen: currentVotingOpen
      };
      if (firebaseOk) {
        await dbSet(dbRef(db, 'settings/backup_before_demo'), backupData);
      } else {
        localState.backup_before_demo = backupData;
      }
    }

    if (firebaseOk) {
      await dbSet(dbRef(db, 'participants'), newParticipants);
      await dbUpdate(dbRef(db, 'settings'), {
        votingOpen: false,
        votingCloseAt: null,
        showRunning: true,
        currentEvent: evData
      });
    } else {
      localState.participants = newParticipants;
      localState.settings.showRunning = true;
      localState.settings.votingOpen = false;
      localState.settings.votingCloseAt = null;
      localState.settings.currentEvent = evData;
      allParticipants = newParticipants;
      showRunning = true;
      votingOpen = false;
      saveLocal();
    }
    
    allParticipants = newParticipants;
    showRunning = true;
    votingOpen = false;
    
    updateUI();
    mcAlert('✅ Evento Demo creado con 16 participantes y canciones.');
  } catch(e) {
    console.error(e);
    mcAlert('Error al iniciar el evento demo.');
  }
}

async function simularVotacion() {
  const pIds = Object.keys(allParticipants);
  if (!pIds.length) {
    mcAlert('No hay participantes para simular la votación. Iniciá el Evento Demo primero.');
    return;
  }

  pIds.forEach(id => {
    allParticipants[id].voteSong = 0;
    allParticipants[id].votePerf = 0;
    allParticipants[id].juryScoresSong = {};
    allParticipants[id].juryScoresPerf = {};
    allParticipants[id].juryScoresHinchada = {};
  });

  for (let i = 0; i < 50; i++) {
    const rIdSong = pIds[Math.floor(Math.random() * pIds.length)];
    const rIdPerf = pIds[Math.floor(Math.random() * pIds.length)];
    allParticipants[rIdSong].voteSong++;
    allParticipants[rIdPerf].votePerf++;
  }

  const jurors = ['jurado_1', 'jurado_2', 'jurado_3', 'jurado_4', 'jurado_5'];
  
  pIds.forEach(id => {
    const p = allParticipants[id];
    jurors.forEach(jId => {
      p.juryScoresSong[jId] = {
        afinacion: Math.floor(Math.random() * 5) + 6,
        emocional: Math.floor(Math.random() * 5) + 6,
        conexion: Math.floor(Math.random() * 5) + 6,
        tematica: Math.floor(Math.random() * 5) + 6
      };
      
      p.juryScoresPerf[jId] = {
        vestuario: Math.floor(Math.random() * 5) + 6,
        actitud: Math.floor(Math.random() * 5) + 6
      };
      
      p.juryScoresHinchada[jId] = {
        pancartas: Math.floor(Math.random() * 5) + 6,
        energia: Math.floor(Math.random() * 5) + 6
      };
    });
  });

  try {
    const updates = {};
    if (firebaseOk) {
      pIds.forEach(id => {
        const p = allParticipants[id];
        updates[`participants/${id}/voteSong`] = p.voteSong;
        updates[`participants/${id}/votePerf`] = p.votePerf;
        updates[`participants/${id}/juryScoresSong`] = p.juryScoresSong;
        updates[`participants/${id}/juryScoresPerf`] = p.juryScoresPerf;
        updates[`participants/${id}/juryScoresHinchada`] = p.juryScoresHinchada;
      });
      updates['settings/votingOpen'] = false;
      updates['settings/votingCloseAt'] = null;
      
      await dbUpdate(dbRef(db), updates);
    } else {
      localState.settings.votingOpen = false;
      localState.settings.votingCloseAt = null;
      votingOpen = false;
      saveLocal();
    }
    
    votingOpen = false;
    updateUI();
    navPush('ranking');
    mcAlert('✅ Simulación de 100 votos de público y calificaciones de 5 jurados completada. Mostrando resultados...');
  } catch(e) {
    console.error(e);
    mcAlert('Error al guardar la simulación.');
  }
}

async function limpiarSimulacion() {
  mcConfirm('¿Querés limpiar todos los datos de prueba y resetear el sistema (sin guardar en el historial)?', async () => {
    try {
      let backup = null;
      if (firebaseOk) {
        const snap = await dbGet(dbRef(db, 'settings/backup_before_demo'));
        backup = snap.val();
      } else {
        backup = localState.backup_before_demo;
      }

      if (backup) {
        // Restaurar datos reales respaldados
        if (firebaseOk) {
          await dbSet(dbRef(db, 'participants'), backup.participants);
          await dbUpdate(dbRef(db, 'settings'), {
            votingOpen: backup.votingOpen || false,
            votingCloseAt: null,
            showRunning: backup.showRunning || false,
            currentEvent: backup.currentEvent || null
          });
          await dbSet(dbRef(db, 'settings/backup_before_demo'), null);
        } else {
          localState.participants = backup.participants;
          localState.settings.showRunning = backup.showRunning || false;
          localState.settings.votingOpen = backup.votingOpen || false;
          localState.settings.votingCloseAt = null;
          localState.settings.currentEvent = backup.currentEvent || null;
          delete localState.backup_before_demo;
          saveLocal();
        }
        allParticipants = backup.participants || {};
        showRunning = backup.showRunning || false;
        votingOpen = backup.votingOpen || false;
        localStorage.removeItem('voted_public');
        updateUI();
        nav('home');
        mcAlert('✅ Datos de simulación limpiados. Tu evento activo original y los participantes registrados han sido restaurados exitosamente.');
      } else {
        // Limpieza normal sin respaldo
        if (firebaseOk) {
          await dbSet(dbRef(db, 'participants'), null);
          await dbUpdate(dbRef(db, 'settings'), {
            votingOpen: false,
            votingCloseAt: null,
            showRunning: false,
            currentEvent: null
          });
        } else {
          localState.participants = {};
          localState.settings.showRunning = false;
          localState.settings.votingOpen = false;
          localState.settings.votingCloseAt = null;
          localState.settings.currentEvent = null;
          saveLocal();
        }
        allParticipants = {};
        showRunning = false;
        votingOpen = false;
        localStorage.removeItem('voted_public');
        updateUI();
        nav('home');
        mcAlert('✅ Datos de simulación limpiados. El sistema volvió a estar vacío y en espera.');
      }
    } catch(e) {
      console.error(e);
      mcAlert('Error al limpiar los datos demo.');
    }
  });
}

window.simularEvento = simularEvento;
window.simularVotacion = simularVotacion;
window.limpiarSimulacion = limpiarSimulacion;

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

  // Restore session login globally if token is present
  const mcSession = sessionStorage.getItem('mc_ok');
  if (mcSession) {
    adminLoggedIn = true;
    isSuperAdmin = mcSession === '1450';
  }

  if (MODE === 'home') {
    // Default mode: no tab menu
    document.body.classList.add('no-tabs');
    if (adminLoggedIn) {
      document.getElementById('home-login-gate').style.display = 'none';
      document.getElementById('home-dashboard').style.display  = 'block';
    }
    nav('home');
  } else if (MODE === 'bar') {
    nav('bar');
  } else if (MODE === 'register') {
    nav('register');
  } else if (MODE === 'vote') {
    nav('program');
  } else if (MODE === 'jury') {
    nav('jury');
  } else if (MODE === 'admin') {
    if (adminLoggedIn) {
      const loginGate = document.getElementById('admin-login');
      if (loginGate) loginGate.style.display = 'none';
      const panel = document.getElementById('admin-panel');
      if (panel) panel.style.display = 'block';
    }
    nav('admin');
  } else if (MODE === 'ranking') {
    nav('ranking');
  } else if (MODE === 'micclub') {
    nav('show');
  } else if (MODE === 'pantalla') {
    nav('pantalla');
  } else {
    nav('home');
  }


  if (window._firebaseReady) initFirebase();
  if (window.location.hash === '#show') nav('show');
  updateMobileLayout();
  setInterval(() => { if (!firebaseOk) updateUI(); }, 10000);
});

// ── KARAOKE LIBRE ─────────────────────────────────────────────────────────────
function updateFreeKaraokePages() {
  const currentEvent = localState.settings?.currentEvent;
  const eventDate = currentEvent?.date || '';
  const activeEventId = getCurrentEventId();
  const currentEventFreeList = activeEventId ? (freeKaraokeList[activeEventId] || {}) : {};
  const sortedFreeItems = Object.entries(currentEventFreeList)
    .map(([id, item]) => ({ id, ...item }))
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  const isFull = sortedFreeItems.length >= 20;

  // 1. Programa Público
  const progSection = document.getElementById('program-free-karaoke-section');
  if (progSection) {
    if (showRunning) {
      progSection.style.display = 'block';
      
      // Para el programa público, mostramos la lista según el evento seleccionado en el programa
      const viewEventId = programSelectedEventId || activeEventId;
      const viewEventFreeList = viewEventId ? (freeKaraokeList[viewEventId] || {}) : {};
      const viewSortedFreeItems = Object.entries(viewEventFreeList)
        .map(([id, item]) => ({ id, ...item }))
        .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      const viewIsFull = viewSortedFreeItems.length >= 20;
      const viewEventDate = viewEventId ? (localState.settings?.events?.[viewEventId]?.date || '') : '';

      const dateEl = document.getElementById('program-free-karaoke-date');
      if (dateEl) dateEl.textContent = viewEventDate ? `(${viewEventDate})` : '';

      const regBtn = document.getElementById('program-free-karaoke-reg-btn');
      const fullBanner = document.getElementById('program-free-karaoke-full-banner');
      
      // Permitir inscripción solo si es el evento activo corriendo
      if (viewEventId === activeEventId) {
        if (viewIsFull) {
          if (regBtn) regBtn.style.display = 'none';
          if (fullBanner) fullBanner.style.display = 'block';
        } else {
          if (regBtn) regBtn.style.display = 'flex';
          if (fullBanner) fullBanner.style.display = 'none';
        }
      } else {
        if (regBtn) regBtn.style.display = 'none';
        if (fullBanner) fullBanner.style.display = 'none';
      }

      const listWrap = document.getElementById('program-free-karaoke-list-wrap');
      const countEl = document.getElementById('program-free-karaoke-count');
      const listEl = document.getElementById('program-free-karaoke-list');
      
      if (listWrap) listWrap.style.display = viewSortedFreeItems.length > 0 ? 'block' : 'none';
      if (countEl) countEl.textContent = `${viewSortedFreeItems.length}/20`;
      if (listEl) {
        listEl.innerHTML = viewSortedFreeItems.map((item, index) => {
          const isLast = index === viewSortedFreeItems.length - 1;
          const borderStyle = isLast ? '' : 'border-bottom:1px solid rgba(255,255,255,.03);';
          return `<div style="padding:8px 0;${borderStyle}font-size:13px;display:flex;justify-content:space-between;align-items:center">
            <span style="font-weight:600;color:var(--text)">${index + 1}. ${esc(item.name)}</span>
            <span style="color:var(--text2);font-size:11px;text-align:right;max-width:60%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(item.songTitle)} — ${esc(item.songArtist)}</span>
          </div>`;
        }).join('');
      }
    } else {
      progSection.style.display = 'none';
    }
  }

  // 2. Registro Público
  const freeSub = document.getElementById('free-karaoke-sub');
  if (freeSub) freeSub.textContent = 'Quiero participar del karaoke ' + (eventDate ? `(${eventDate})` : '');

  const registerFullBanner = document.getElementById('free-karaoke-full-banner');
  const registerFormCard = document.getElementById('free-karaoke-form-card');
  if (registerFullBanner && registerFormCard) {
    if (isFull) {
      registerFullBanner.style.display = 'block';
      registerFormCard.style.display = 'none';
    } else {
      registerFullBanner.style.display = 'none';
      registerFormCard.style.display = 'block';
    }
  }

  const badgeEl = document.getElementById('free-karaoke-count-badge');
  if (badgeEl) badgeEl.textContent = `${sortedFreeItems.length}/20`;

  const pubListEl = document.getElementById('free-karaoke-public-list');
  if (pubListEl) {
    pubListEl.innerHTML = sortedFreeItems.map((item, index) => {
      const isLast = index === sortedFreeItems.length - 1;
      const borderStyle = isLast ? '' : 'border-bottom:1px solid rgba(255,255,255,.03);';
      return `<div style="padding:8px 0;${borderStyle}font-size:13px;display:flex;justify-content:space-between;align-items:center">
        <span style="font-weight:600;color:var(--text)">${index + 1}. ${esc(item.name)}</span>
        <span style="color:var(--text2);font-size:11px;text-align:right;max-width:60%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(item.songTitle)} — ${esc(item.songArtist)}</span>
      </div>`;
    }).join('') || '<div style="font-size:12px;color:var(--text2);text-align:center;padding:10px;font-style:italic">¡Sé el primero en inscribirte!</div>';
  }

  // 3. Panel de Administración
  const adminCountEl = document.getElementById('admin-free-karaoke-count');
  if (adminCountEl) adminCountEl.textContent = `${sortedFreeItems.length}/20`;

  const adminListEl = document.getElementById('admin-free-karaoke-list');
  if (adminListEl) {
    adminListEl.innerHTML = sortedFreeItems.map((item, index) => {
      const ytButton = item.youtubeLink ? `
        <a href="${esc(item.youtubeLink)}" target="_blank" onclick="setAdminTab('video')" class="btn btn-sm btn-outline" style="border-color:#ff0000;color:#ff0000;font-size:11px;padding:6px 10px;min-height:auto;display:inline-flex;align-items:center;gap:4px;text-decoration:none">
          🎬 YouTube
        </a>
      ` : '';
      
      return `<div style="padding:10px;background:var(--bg3);border:1px solid var(--border);border-radius:8px;display:flex;flex-direction:column;gap:8px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="font-weight:700;color:var(--gold);font-family:'Inter',sans-serif;font-size:14px">&nbsp;${index + 1}. ${esc(item.name)}</span>
          <span style="font-size:11px;color:var(--text2)">${new Date(item.createdAt || Date.now()).toLocaleTimeString('es-AR', {hour: '2-digit', minute:'2-digit'})}</span>
        </div>
        <div style="font-size:13px;color:var(--text)">
          <strong>Canción:</strong> ${esc(item.songTitle)}<br>
          <strong>Artista:</strong> ${esc(item.songArtist)}
        </div>
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:4px">
          ${ytButton}
          <button class="btn btn-sm" onclick="deleteFreeKaraokeItem('${item.id}')" style="border-color:rgba(255,61,107,.4);color:rgba(255,61,107,.7);font-size:11px;padding:6px 10px;min-height:auto;background:transparent;cursor:pointer">
            Borrar
          </button>
        </div>
      </div>`;
    }).join('') || '<div style="font-size:13px;color:var(--text2);text-align:center;padding:20px;font-style:italic">No hay inscripciones registradas para esta fecha.</div>';
  }
}

async function submitFreeKaraoke() {
  const name = (document.getElementById('fk-name')?.value || '').trim();
  const song = (document.getElementById('fk-song')?.value || '').trim();
  const artist = (document.getElementById('fk-artist')?.value || '').trim();
  const youtube = (document.getElementById('fk-youtube')?.value || '').trim();
  const errEl = document.getElementById('free-karaoke-form-err');

  if (errEl) {
    errEl.style.display = 'none';
    errEl.textContent = '';
  }

  if (!name || !song || !artist) {
    if (errEl) {
      errEl.textContent = 'Por favor, completá todos los campos obligatorios (*).';
      errEl.style.display = 'block';
    }
    return;
  }

  const activeEventId = getCurrentEventId();
  const currentEventFreeList = activeEventId ? (freeKaraokeList[activeEventId] || {}) : {};
  const count = Object.keys(currentEventFreeList).length;
  if (count >= 20) {
    mcAlert('Lo sentimos, el cupo de 20 canciones para el Karaoke Libre de esta fecha ya está completo.');
    return;
  }

  if (youtube && !youtube.startsWith('http://') && !youtube.startsWith('https://')) {
    if (errEl) {
      errEl.textContent = 'El enlace de YouTube debe comenzar con http:// o https://';
      errEl.style.display = 'block';
    }
    return;
  }

  const entry = {
    name,
    songTitle: song,
    songArtist: artist,
    youtubeLink: youtube || null,
    createdAt: Date.now()
  };

  try {
    if (firebaseOk) {
      const parentNode = activeEventId ? `freeKaraoke/${activeEventId}` : 'freeKaraoke';
      const newRef = dbPush(dbRef(db, parentNode));
      await dbSet(newRef, entry);
    } else {
      const localId = 'fk_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
      if (activeEventId) {
        if (!freeKaraokeList[activeEventId]) freeKaraokeList[activeEventId] = {};
        freeKaraokeList[activeEventId][localId] = entry;
      } else {
        freeKaraokeList[localId] = entry;
      }
      saveLocal();
    }

    const inputName = document.getElementById('fk-name');
    const inputSong = document.getElementById('fk-song');
    const inputArtist = document.getElementById('fk-artist');
    const inputYt = document.getElementById('fk-youtube');
    if (inputName)  inputName.value = '';
    if (inputSong)  inputSong.value = '';
    if (inputArtist) inputArtist.value = '';
    if (inputYt)     inputYt.value = '';

    mcAlert('✅ ¡Te inscribiste correctamente al Karaoke Libre!');
    navBack();
  } catch(e) {
    console.error(e);
    if (errEl) {
      errEl.textContent = 'Error al procesar la inscripción: ' + e.message;
      errEl.style.display = 'block';
    }
  }
}

async function deleteFreeKaraokeItem(itemId) {
  const activeEventId = getCurrentEventId();
  mcConfirm('¿Estás seguro de que querés borrar esta inscripción?', async () => {
    try {
      if (firebaseOk) {
        const path = activeEventId ? `freeKaraoke/${activeEventId}/${itemId}` : `freeKaraoke/${itemId}`;
        await dbRemove(dbRef(db, path));
      } else {
        if (activeEventId && freeKaraokeList[activeEventId]) {
          delete freeKaraokeList[activeEventId][itemId];
        } else {
          delete freeKaraokeList[itemId];
        }
        saveLocal();
        updateUI();
      }
      mcAlert('✅ Inscripción eliminada correctamente.');
    } catch(e) {
      console.error(e);
      mcAlert('Error al borrar la inscripción: ' + e.message);
    }
  });
}

// ── PANTALLA PÚBLICA DE PRESENTACIÓN ──────────────────────────────────────────
function setPantallaTab(tab) {
  pantallaTab = tab;
  
  // Actualizar estilos de los botones en el sidebar
  const buttons = document.querySelectorAll('#page-pantalla .pantalla-sidebar button');
  if (buttons.length >= 6) {
    buttons.forEach(btn => {
      btn.style.background = 'linear-gradient(135deg, #16151A 0%, #0D0C10 100%)';
      btn.style.borderColor = 'rgba(252, 224, 173, 0.35)';
      btn.style.color = '#ffffff';
    });
    
    const tabBtnMap = {
      artistas: 0,
      participantes: 1,
      votos: 2,
      ranking: 3,
      proximo: 4,
      karaoke: 5
    };
    const activeBtn = buttons[tabBtnMap[tab]];
    if (activeBtn) {
      activeBtn.style.background = 'linear-gradient(135deg, var(--gold) 0%, var(--gold-dark) 100%)';
      activeBtn.style.color = 'var(--bg)';
      activeBtn.style.borderColor = 'var(--gold)';
    }
  }
  
  // Fuegos artificiales en pestaña de Resultados Votación
  const canvas = document.getElementById('pantalla-celebration-canvas');
  if (canvas) {
    if (tab === 'votos') {
      canvas.style.display = 'block';
      startCelebration();
    } else {
      canvas.style.display = 'none';
    }
  }
  
  renderPantallaContent();
}

function renderPantallaContent() {
  const container = document.getElementById('pantalla-tab-content');
  if (!container) return;
  
  const activeEventId = getCurrentEventId();
  const ev = activeEventId ? (localState.settings?.events?.[activeEventId] || null) : null;

  // Actualizar cabecera con el título de la vista activa en el proyector
  const elName = document.getElementById('pantalla-event-name');
  const elDetails = document.getElementById('pantalla-event-details');
  if (pantallaTab === 'ranking') {
    if (elName) elName.textContent = 'Mic Club';
    if (elDetails) elDetails.textContent = 'Puntos Acumulados';
  } else if (pantallaTab === 'votos') {
    if (elName) elName.textContent = ev ? ev.name : 'VOTACIÓN';
    if (elDetails) elDetails.textContent = 'resultados de la votacion';
  } else {
    const layoutTitles = {
      artistas: 'ARTISTAS INVITADOS',
      participantes: 'PARTICIPANTES',
      proximo: 'PRÓXIMO EVENTO',
      karaoke: 'KARAOKE'
    };
    if (elName) elName.textContent = layoutTitles[pantallaTab] || 'MIC CLUB';
    if (elDetails) elDetails.textContent = ev ? `${ev.name} · ${ev.date || ''}` : '';
  }

  // Ocultar auspiciantes en pie de página si es ranking (se muestran a la derecha en columna)
  const sponsorsFooter = document.getElementById('pantalla-sponsors-footer');
  if (sponsorsFooter) {
    sponsorsFooter.style.display = (pantallaTab === 'ranking') ? 'none' : 'block';
  }
  
  if (pantallaTab === 'artistas') {
    const artists = ev?.guestArtists || [];
    container.innerHTML = renderProjectionQueueLayout('En Escena', artists, 'No hay artistas invitados cargados aún para este evento.');
  }
  else if (pantallaTab === 'participantes') {
    const parts = getEnrichedParticipantsList(activeEventId)
      .filter(p => p.songConfirmed)
      .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    container.innerHTML = renderProjectionQueueLayout('En Escena', parts, 'Esperando confirmación de participantes...');
  }
  else if (pantallaTab === 'votos') {
    container.innerHTML = `
      <div class="results-layout-container" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; width: 100%; animation: fadeUp 0.5s ease-out forwards;">
        <div class="result-column-card" style="margin:0;">
          <div class="result-column-header">
            <div class="column-category-title">MEJOR<br>CANCIÓN</div>
            <div class="column-source-tag source-public">🗳️ PÚBLICO</div>
          </div>
          <div id="pantalla-rank-pub-song"></div>
        </div>
        <div class="result-column-card" style="margin:0;">
          <div class="result-column-header">
            <div class="column-category-title">MEJOR<br>PERFORMANCE</div>
            <div class="column-source-tag source-public">🗳️ PÚBLICO</div>
          </div>
          <div id="pantalla-rank-pub-perf"></div>
        </div>
        <div class="result-column-card" style="margin:0;">
          <div class="result-column-header">
            <div class="column-category-title">MEJOR<br>CANCIÓN</div>
            <div class="column-source-tag source-jury">⭐ JURADO</div>
          </div>
          <div id="pantalla-rank-jury-song"></div>
        </div>
        <div class="result-column-card" style="margin:0;">
          <div class="result-column-header">
            <div class="column-category-title">MEJOR<br>PERFORMANCE</div>
            <div class="column-source-tag source-jury">⭐ JURADO</div>
          </div>
          <div id="pantalla-rank-jury-perf"></div>
        </div>
        <div class="result-column-card" style="margin:0;">
          <div class="result-column-header">
            <div class="column-category-title">MEJOR<br>HINCHADA</div>
            <div class="column-source-tag source-jury">📣 JURADO</div>
          </div>
          <div id="pantalla-rank-jury-hinchada"></div>
        </div>
      </div>
    `;
    // Populate
    renderPublicVoteRanking();
    renderJuryRankingInRanking();
  }
  else if (pantallaTab === 'ranking') {
    container.innerHTML = `
      <div class="show-layout-container" style="display: grid; gap: 20px; animation: fadeUp 0.5s ease-out forwards; width: 100%;">
        <div class="result-column-card" style="margin: 0;">
          <div class="result-column-header">
            <div class="column-category-title">🏆 PUNTOS ACUMULADOS</div>
          </div>
          <div id="pantalla-show-rows" style="padding:10px 14px"></div>
        </div>
        <div id="pantalla-consagrados-card" class="result-column-card" style="margin: 0; display: none; background: rgba(212, 168, 67, 0.03) !important;">
          <div class="result-column-header">
            <div class="column-category-title">👑 CONSAGRADOS (>150 pts)</div>
          </div>
          <div id="pantalla-consagrados-rows" style="padding:10px 14px"></div>
        </div>
      </div>
    `;
    updateShowMode();
  }
  else if (pantallaTab === 'proximo') {
    const imgUrl = localState.settings?.nextEventImage || null;
    if (!imgUrl) {
      container.innerHTML = `<div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding: 60px 20px; gap: 20px; animation: fadeUp 0.5s ease-out forwards; height:100%; box-sizing:border-box">
        <div style="font-size: 48px;">📅</div>
        <div style="font-family:'Inter',sans-serif; font-size: 32px; color: var(--gold); letter-spacing: 1px;">Próximo Evento</div>
        <div style="color: var(--text2); font-size: 15px; text-align: center; max-width: 500px; line-height: 1.6;">Estad atentos, próximamente confirmaremos la fecha del siguiente encuentro.</div>
      </div>`;
      return;
    }
    container.innerHTML = `<div style="display:flex; justify-content:center; align-items:center; width:100%; height:100%; max-height: calc(100vh - 160px); overflow:hidden; animation: fadeUp 0.5s ease-out forwards;">
      <img src="${imgUrl}" style="max-width:100%; max-height:100%; object-fit:contain; border-radius:12px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.05);">
    </div>`;
  }
  else if (pantallaTab === 'karaoke') {
    const activeEventId = getCurrentEventId();
    const currentEventFreeList = activeEventId ? (freeKaraokeList[activeEventId] || {}) : {};
    const sortedFreeItems = Object.entries(currentEventFreeList)
      .map(([id, p]) => ({ ...p, id }))
      .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    container.innerHTML = renderProjectionQueueLayout('En Escena', sortedFreeItems, 'No hay inscriptos en Karaoke Libre aún.');
  }
  else if (pantallaTab === 'intro_tema') {
    const singer = activeYtVideo?.name || 'Mic Club';
    const song = activeYtVideo?.song || 'Siguiente Tema';
    container.innerHTML = `
      <div class="intro-tema-container" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; min-height: calc(100vh - 240px); padding: 40px 20px; box-sizing: border-box; text-align: center; animation: fadeUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;">
        <div class="intro-tema-disc-wrapper" style="position: relative; width: 180px; height: 180px; margin-bottom: 40px; display: flex; align-items: center; justify-content: center;">
          <div style="position: absolute; width: 220px; height: 220px; background: radial-gradient(circle, rgba(212, 168, 67, 0.15) 0%, rgba(212, 168, 67, 0) 70%); filter: blur(20px); animation: pulseGlow 4s ease-in-out infinite;"></div>
          <div class="spinning-disc" style="width: 100%; height: 100%; border-radius: 50%; background: radial-gradient(circle, #1e1d24 0%, #0d0c10 100%); border: 6px solid #d4a843; box-shadow: 0 15px 45px rgba(0, 0, 0, 0.8), inset 0 0 40px rgba(212, 168, 67, 0.2); display: flex; align-items: center; justify-content: center; animation: spin 20s linear infinite; position: relative;">
            <div style="position: absolute; width: 80%; height: 80%; border-radius: 50%; border: 1px dashed rgba(212, 168, 67, 0.15);"></div>
            <div style="position: absolute; width: 60%; height: 60%; border-radius: 50%; border: 1px solid rgba(255, 255, 255, 0.05);"></div>
            <div style="position: absolute; width: 40%; height: 40%; border-radius: 50%; border: 1px dashed rgba(212, 168, 67, 0.1);"></div>
            <div style="width: 50px; height: 50px; border-radius: 50%; background: #d4a843; display: flex; align-items: center; justify-content: center; box-shadow: inset 0 0 10px rgba(0,0,0,0.5); z-index: 2;">
              <span style="font-size: 24px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));">🎵</span>
            </div>
          </div>
        </div>
        <div style="font-family: 'Inter', sans-serif; text-transform: uppercase; font-size: 14px; color: rgba(252, 224, 173, 0.6); letter-spacing: 4px; margin-bottom: 16px; font-weight: 600;">A continuación en escena</div>
        <h1 style="font-family: 'Inter', sans-serif; font-size: clamp(36px, 5vw, 64px); font-weight: 800; color: #d4a843; margin: 0 0 12px 0; letter-spacing: 0.5px; text-shadow: 0 0 30px rgba(212, 168, 67, 0.25); line-height: 1.1;">${esc(singer)}</h1>
        <p style="font-family: 'Inter', sans-serif; font-size: clamp(20px, 2.5vw, 32px); font-weight: 500; color: rgba(255, 255, 255, 0.85); margin: 0; letter-spacing: 0.5px; max-width: 800px; line-height: 1.3;">${esc(song)}</p>
      </div>
    `;
  }
}

function updatePantallaContent() {
  const container = document.getElementById('pantalla-main-content');
  if (!container) return;

  const activeEventId = getCurrentEventId();
  const ev = activeEventId ? (localState.settings?.events?.[activeEventId] || null) : null;

  // Actualizar cabecera con el título de la vista activa en el proyector
  const elName = document.getElementById('pantalla-event-name');
  const elDetails = document.getElementById('pantalla-event-details');
  if (pantallaTab === 'ranking') {
    if (elName) elName.textContent = 'Mic Club';
    if (elDetails) elDetails.textContent = 'Puntos Acumulados';
  } else if (pantallaTab === 'votos') {
    if (elName) elName.textContent = ev ? ev.name : 'VOTACIÓN';
    if (elDetails) elDetails.textContent = 'resultados de la votacion';
  } else {
    const layoutTitles = {
      artistas: 'ARTISTAS INVITADOS',
      participantes: 'PARTICIPANTES',
      proximo: 'PRÓXIMO EVENTO',
      karaoke: 'KARAOKE'
    };
    if (elName) elName.textContent = layoutTitles[pantallaTab] || 'MIC CLUB';
    if (elDetails) elDetails.textContent = ev ? `${ev.name} · ${ev.date || ''}` : '';
  }

  // Ocultar auspiciantes en pie de página si es ranking (se muestran a la derecha en columna)
  const sponsorsFooter = document.getElementById('pantalla-sponsors-footer');
  if (sponsorsFooter) {
    sponsorsFooter.style.display = (pantallaTab === 'ranking') ? 'none' : 'block';
  }

  const sponsors = localState.settings?.sponsors || [];
  const artists = ev?.guestArtists || [];
  const nextEventImage = localState.settings?.nextEventImage || null;

  if (pantallaTab === 'artistas') {
    if (!artists.length) {
      container.innerHTML = `<div style="color:var(--text2);font-style:italic;text-align:center;padding:20px;font-size:14px">No hay artistas invitados cargados...</div>`;
      return;
    }
    container.innerHTML = `<div style="max-width: 800px; margin: 0 auto; animation: fadeUp 0.5s ease-out forwards;">
${
      artists.map((art, idx) => {
        const name = typeof art === 'object' ? art.name : art;
        const song = typeof art === 'object' ? art.song : '';
        return `
          <div style="padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,0.04); display: flex; justify-content: space-between; align-items: center;">
            <span style="font-family:'Inter',sans-serif; font-size: 24px; color: #ffffff; letter-spacing: 1px;">${esc(name)}</span>
            <span style="font-family:'Inter',sans-serif; font-size: 17px; color: var(--gold); font-weight: 500;">${esc(song || 'Repertorio Especial')}</span>
          </div>
        `;
      }).join('')
    }</div>`;
  }
  else if (pantallaTab === 'participantes') {
    const activeEventId = getCurrentEventId();
    const queue = getConsolidatedQueue(activeEventId);
    if (!queue.length) {
      container.innerHTML = `<div style="color:var(--text2);font-style:italic;text-align:center;padding:20px;font-size:14px">Esperando confirmación de participantes...</div>`;
      return;
    }
    
    // Encontrar al cantante actual basado en activeYtVideo
    let currentIdx = 0;
    if (activeYtVideo) {
      const idx = queue.findIndex(x => x.source === activeYtVideo.source && x.id === activeYtVideo.id);
      if (idx !== -1) {
        currentIdx = idx;
      }
    }
    
    const currentSinger = queue[currentIdx];
    const nextSinger = queue[currentIdx + 1] || null;
    
    // Generar HTML de los siguientes 3
    let upcomingHtml = '';
    for (let i = 0; i < 3; i++) {
      const p = queue[currentIdx + 2 + i];
      if (p) {
        upcomingHtml += `
          <div style="border-left:3px solid var(--gold); padding-left:16px">
            <div style="font-family:'Inter',sans-serif; font-size:clamp(20px, 2.2vw, 36px); color:#ffffff; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; letter-spacing:0.5px">${esc(p.name)}</div>
            <div style="font-family:'Inter',sans-serif; font-size:clamp(14px, 1.4vw, 20px); color:var(--text2); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-top:4px">${esc(p.songTitle || '—')}</div>
          </div>
        `;
      } else {
        upcomingHtml += `
          <div style="opacity:0.3; border-left:3px solid rgba(255,255,255,0.1); padding-left:16px">
            <div style="font-family:'Inter',sans-serif; font-size:15px; color:var(--text2); font-style:italic">—</div>
          </div>
        `;
      }
    }
    
    container.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:36px; max-width:1100px; margin:0 auto; animation:fadeUp 0.5s ease-out forwards; padding:20px 10px; justify-content:center">
        
        <!-- Fila Principal: Cantando y Por Cantar -->
        <div style="display:grid; grid-template-columns:1.20fr 0.80fr; gap:36px; align-items:stretch">
          
          <!-- Bloque 1: Cantando Ahora (Dorado y Grande) -->
          <div class="card" style="border:2px solid var(--gold); background:rgba(201,154,66,0.06); padding:36px 40px; border-radius:16px; display:flex; flex-direction:column; justify-content:center; text-align:left; position:relative; box-shadow:0 8px 32px rgba(0,0,0,0.5)">
            <div style="font-family:'Inter',sans-serif; font-size:14px; letter-spacing:4px; color:var(--gold); font-weight:700; text-transform:uppercase; margin-bottom:12px">🎤 CANTANDO AHORA</div>
            <div style="font-family:'Inter',sans-serif; font-size:clamp(60px, 6.5vw, 110px); color:var(--gold); letter-spacing:2px; line-height:1.0">${esc(currentSinger.name)}</div>
            <div style="font-family:'Inter',sans-serif; font-size:clamp(26px, 2.8vw, 44px); color:#ffffff; font-weight:400; margin-top:16px; line-height:1.2">${esc(currentSinger.songTitle || '—')}</div>
            <div style="font-family:'Inter',sans-serif; font-size:clamp(16px, 1.6vw, 24px); color:#ffffff; margin-top:6px; opacity:0.8">${esc(currentSinger.songArtist || '')}</div>
          </div>
          
          <!-- Bloque 2: Por Cantar / Siguiente (Blanco/Plata y Mediano) -->
          <div class="card" style="border:1px solid rgba(255,255,255,0.12); background:rgba(255,255,255,0.02); padding:36px 32px; border-radius:16px; display:flex; flex-direction:column; justify-content:center; text-align:left; box-shadow:0 8px 32px rgba(0,0,0,0.3)">
            <div style="font-family:'Inter',sans-serif; font-size:14px; letter-spacing:4px; color:var(--text2); font-weight:700; text-transform:uppercase; margin-bottom:12px">⏭️ SIGUIENTE EN COLA</div>
            ${nextSinger ? `
              <div style="font-family:'Inter',sans-serif; font-size:clamp(40px, 4.5vw, 75px); color:#ffffff; letter-spacing:1px; line-height:1.0">${esc(nextSinger.name)}</div>
              <div style="font-family:'Inter',sans-serif; font-size:clamp(20px, 2.2vw, 32px); color:var(--gold); font-weight:400; margin-top:12px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:100%">${esc(nextSinger.songTitle || '—')}</div>
              <div style="font-family:'Inter',sans-serif; font-size:clamp(14px, 1.4vw, 20px); color:#ffffff; margin-top:4px; opacity:0.7">${esc(nextSinger.songArtist || '')}</div>
            ` : `
              <div style="font-family:'Inter',sans-serif; font-size:16px; color:var(--text2); font-style:italic">Fin de la lista de participantes</div>
            `}
          </div>
          
        </div>
        
        <!-- Bloque 3: Siguientes 3 (Lista compacta horizontal) -->
        <div class="card" style="padding:24px 32px; border:1px solid rgba(255,255,255,0.08); background:rgba(255,255,255,0.01); border-radius:16px; text-align:left; box-shadow:0 4px 20px rgba(0,0,0,0.2)">
          <div style="font-family:'Inter',sans-serif; font-size:12px; letter-spacing:3px; color:var(--text2); font-weight:600; text-transform:uppercase; margin-bottom:18px">📋 PRÓXIMOS EN LA LISTA</div>
          <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:32px">
            ${upcomingHtml}
          </div>
        </div>

      </div>
    `;
  }
  else if (pantallaTab === 'votos') {
    container.innerHTML = `
      <div class="results-layout-container" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; width: 100%; margin: 0; animation: fadeUp 0.5s ease-out forwards;">
        <div class="result-column-card" style="margin:0">
          <div class="result-column-header">
            <div class="column-category-title">MEJOR<br>CANCIÓN</div>
            <div class="column-source-tag source-public">🗳️ PÚBLICO</div>
          </div>
          <div id="pantalla-rank-pub-song"></div>
        </div>
        <div class="result-column-card" style="margin:0">
          <div class="result-column-header">
            <div class="column-category-title">MEJOR<br>PERFORMANCE</div>
            <div class="column-source-tag source-public">🗳️ PÚBLICO</div>
          </div>
          <div id="pantalla-rank-pub-perf"></div>
        </div>
        <div class="result-column-card" style="margin:0">
          <div class="result-column-header">
            <div class="column-category-title">MEJOR<br>CANCIÓN</div>
            <div class="column-source-tag source-jury">⭐ JURADO</div>
          </div>
          <div id="pantalla-rank-jury-song"></div>
        </div>
        <div class="result-column-card" style="margin:0">
          <div class="result-column-header">
            <div class="column-category-title">MEJOR<br>PERFORMANCE</div>
            <div class="column-source-tag source-jury">⭐ JURADO</div>
          </div>
          <div id="pantalla-rank-jury-perf"></div>
        </div>
        <div class="result-column-card" style="margin:0">
          <div class="result-column-header">
            <div class="column-category-title">MEJOR<br>HINCHADA</div>
            <div class="column-source-tag source-jury">📣 JURADO</div>
          </div>
          <div id="pantalla-rank-jury-hinchada"></div>
        </div>
      </div>
    `;
    renderPublicVoteRanking();
    renderJuryRankingInRanking();
  }
  else if (pantallaTab === 'ranking') {
    container.innerHTML = `
      <div class="show-layout-container" style="display: grid; grid-template-columns: 1fr auto; gap: 16px; animation: fadeUp 0.5s ease-out forwards; width: 100%; height: 100%;">
        <div style="display: grid; gap: 12px; grid-template-columns: 1fr;" id="pantalla-ranking-lists-wrapper">
          <div class="result-column-card" style="margin: 0;">
            <div class="result-column-header">
              <div class="column-category-title">RANKING DE PARTICIPANTES</div>
            </div>
            <div id="pantalla-show-rows" style="padding:8px 12px"></div>
          </div>
          <div id="pantalla-consagrados-card" class="result-column-card" style="margin: 0; display: none; background: rgba(212, 168, 67, 0.03) !important;">
            <div class="result-column-header">
              <div class="column-category-title">ARTISTAS CONSAGRADOS</div>
            </div>
            <div id="pantalla-consagrados-rows" style="padding:8px 12px"></div>
          </div>
        </div>
        <!-- Columna de auspiciantes en la derecha -->
        <div id="pantalla-ranking-sponsors-col" style="display: flex; flex-direction: column; gap: 8px; justify-content: flex-start; align-items: center; border-left: 1px solid rgba(255,255,255,0.05); padding-left: 14px;">
          <div style="font-family:'Inter',sans-serif; font-size: 10px; letter-spacing: 2px; color: var(--text2); text-transform: uppercase; margin-bottom: 4px; opacity: 0.8;">Auspiciantes</div>
          <div id="pantalla-ranking-sponsors-list" style="display: flex; flex-direction: column; gap: 8px; align-items: center;"></div>
        </div>
      </div>
    `;
    updateShowMode();
    updatePantallaSponsors();
  }
  else if (pantallaTab === 'proximo') {
    if (!nextEventImage) {
      container.innerHTML = `<div style="color:var(--text2);font-style:italic;text-align:center;padding:20px;font-size:14px">No hay imagen cargada para el próximo evento...</div>`;
      return;
    }
    container.innerHTML = `
      <div style="width: 100%; display: flex; justify-content: center; align-items: center; min-height: 50vh; animation: zoomIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;">
        <img src="${nextEventImage}" style="max-width: 100%; max-height: 80vh; border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.5); border: 2px solid var(--border-gold);" />
      </div>
    `;
  }
  else if (pantallaTab === 'karaoke') {
    const activeEventId = getCurrentEventId();
    const currentEventFreeList = activeEventId ? (freeKaraokeList[activeEventId] || {}) : {};
    const sortedFreeItems = Object.entries(currentEventFreeList)
      .map(([id, item]) => ({ id, ...item }))
      .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    if (!sortedFreeItems.length) {
      container.innerHTML = `<div style="color:var(--text2);font-style:italic;text-align:center;padding:20px;font-size:14px">Esperando inscripciones al Karaoke Libre...</div>`;
      return;
    }
    container.innerHTML = `<div style="max-width: 900px; margin: 0 auto; animation: fadeUp 0.5s ease-out forwards;">${
      sortedFreeItems.map((item, index) => {
        return `
          <div style="padding: 6px 8px; border-bottom: 1px solid rgba(255,255,255,0.04); display: flex; justify-content: space-between; align-items: center;">
            <span style="font-family:'Inter',sans-serif; font-size: 20px; color: #ffffff; letter-spacing: 0.5px;">${index + 1}. ${esc(item.name)}</span>
            <span style="font-family:'Inter',sans-serif; font-size: 14px; color: var(--gold); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:60%;">${esc(item.songTitle)} — ${esc(item.songArtist)}</span>
          </div>
        `;
      }).join('')
    }</div>`;
  }
}

function updatePantallaSponsors() {
  const sponsors = localState.settings?.sponsors || [];
  const sponsorsHtml = sponsors.map(sp => `
    <a href="${esc(sp.link || '#')}" target="_blank" style="display:inline-block">
      <img src="${sp.img}" style="width:62px;height:62px;object-fit:cover;border-radius:6px;border:1px solid rgba(255,255,255,0.1)">
    </a>
  `).join('');
  
  const elSponsors = document.getElementById('pantalla-sponsors-list');
  if (elSponsors) {
    elSponsors.innerHTML = sponsorsHtml || '<div style="font-size: 11px; color: var(--text2); text-align: center; width: 100%;">Sin auspiciantes cargados</div>';
  }

  const elSponsorsRanking = document.getElementById('pantalla-ranking-sponsors-list');
  if (elSponsorsRanking) {
    const rankingSponsorsHtml = sponsors.map(sp => `
      <a href="${esc(sp.link || '#')}" target="_blank" style="display:inline-block;margin-bottom:2px">
        <img src="${sp.img}" style="width:62px;height:62px;object-fit:cover;border-radius:6px;border:1px solid rgba(255,255,255,0.1)">
      </a>
    `).join('');
    elSponsorsRanking.innerHTML = rankingSponsorsHtml || '';
  }
}

window.setPantallaTab = setPantallaTab;

let customQueueItems = [];
function saveCustomQueueItems() {
  if (firebaseOk) {
    dbUpdate(dbRef(db, 'settings'), { customQueueItems: customQueueItems });
  } else {
    saveLocal();
  }
}
let activeYtVideo = null;
let isYtPlaying = false;
let castChannel = null;
let currentCastLayout = 'blank';
let lastCastLayoutBeforeVote = 'video';
let projectionPlayer = null;
let projectionPlayerReady = false;
let projectionPlayerInitialized = false;
let lastLoadedVideoId = null;
let isSeeking = false;
let lastCastYtVideoTimestamp = 0;
let lastCastYtCommandTimestamp = 0;
let lastCastYtVolume = 100;

function updatePlayBtnIcon() {
  const playBtn = document.getElementById('yt-remote-play-btn');
  if (playBtn) {
    const mode = localState.settings?.playbackMode || 'theme';
    playBtn.classList.remove('play-btn-continuous', 'play-btn-theme-paused', 'play-btn-paused-state');
    
    if (isYtPlaying) {
      // Estado de pausa (reproduciendo, botón ROJO con ícono de pausa SVG)
      playBtn.classList.add('play-btn-paused-state');
      playBtn.innerHTML = '<svg viewBox="0 0 24 24" width="21" height="21" fill="currentColor" style="display:inline-block;vertical-align:middle"><path d="M6 19H10V5H6V19ZM14 5V19H18V5H14Z"/></svg>';
    } else {
      if (mode === 'continuous') {
        playBtn.classList.add('play-btn-continuous');
        playBtn.innerHTML = '<svg viewBox="0 0 24 24" width="21" height="21" fill="currentColor" style="display:inline-block;vertical-align:middle"><path d="M8 5V19L19 12L8 5Z"/></svg>';
      } else {
        playBtn.classList.add('play-btn-theme-paused');
        playBtn.innerHTML = '<svg viewBox="0 0 24 24" width="21" height="21" fill="currentColor" style="display:inline-block;vertical-align:middle"><path d="M6 19L17 12L6 5V19Z M18 5H20V19H18V5Z"/></svg>';
      }
    }
  }
}

// Extractor robusto de ID de video de YouTube
function getYouTubeId(url) {
  if (!url) return '';
  url = url.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(url)) {
    return url;
  }
  try {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    if (match && match[2].length === 11) {
      return match[2];
    }
  } catch (e) {}
  return '';
}

// Consolidar cola de reproducción (automatica + manual)
function getConsolidatedQueue(eventId = null) {
  const activeEventId = eventId || (MODE === 'admin' ? getAdminActiveEventId() : getCurrentEventId());
  if (!activeEventId) return [];

  const list = [];
  
  // 1. Participantes con canción confirmada
  const mcParts = getEnrichedParticipantsList(activeEventId)
    .filter(p => {
      const pe = getParticipantForEvent(p, activeEventId);
      return pe.songConfirmed && pe.karaokeLink;
    })
    .map(p => {
      const pe = getParticipantForEvent(p, activeEventId);
      return {
        source: 'micclub',
        id: p.id,
        name: p.name,
        song: pe.songTitle && pe.songArtist ? `${pe.songTitle} — ${pe.songArtist}` : (pe.song || 'Sin título'),
        songTitle: pe.songTitle || pe.song || 'Sin título',
        songArtist: pe.songArtist || '',
        url: pe.karaokeLink,
        ytId: getYouTubeId(pe.karaokeLink)
      };
    });
  list.push(...mcParts);

  // 2. Karaoke Libre
  const currentEventFreeList = freeKaraokeList[activeEventId] || {};
  const sortedFreeItems = Object.entries(currentEventFreeList)
    .map(([id, item]) => ({ id, ...item }))
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
    .filter(item => item.youtubeLink || item.link)
    .map(item => ({
      source: 'libre',
      id: item.id,
      name: item.name,
      song: item.songTitle && item.songArtist ? `${item.songTitle} — ${item.songArtist}` : (item.song || 'Sin título'),
      songTitle: item.songTitle || item.song || 'Sin título',
      songArtist: item.songArtist || '',
      url: item.youtubeLink || item.link,
      ytId: getYouTubeId(item.youtubeLink || item.link)
    }));
  list.push(...sortedFreeItems);

  // 3. Ítems cargados de forma manual
  const manualItems = customQueueItems.map((item, idx) => ({
    source: 'manual',
    id: `manual-${idx}`,
    name: item.name,
    song: item.song,
    songTitle: item.song,
    songArtist: '',
    url: item.url,
    ytId: getYouTubeId(item.url),
    targetList: item.targetList || 'micclub'
  }));
  list.push(...manualItems);

  // 4. Artistas Invitados (Invitados)
  const event = activeEventId ? (localState.settings?.events?.[activeEventId] || {}) : {};
  const guestArtists = event.guestArtists || [];
  const guestItems = guestArtists
    .filter(art => art.link || art.url)
    .map((art, idx) => ({
      source: 'guest',
      id: `guest-${idx}`,
      name: art.name,
      song: art.song || 'Repertorio Especial',
      songTitle: art.song || 'Repertorio Especial',
      songArtist: art.name,
      url: art.link || art.url,
      ytId: getYouTubeId(art.link || art.url)
    }));
  list.push(...guestItems);

  // Filtrar solo los ítems que tengan un ID de YouTube válido
  const validItems = list.filter(item => item.ytId);

  // Aplicar orden personalizado si existe en settings
  const customOrder = localState.settings?.queueOrder || [];
  if (customOrder.length > 0) {
    validItems.sort((a, b) => {
      const keyA = `${a.source}-${a.id}`;
      const keyB = `${b.source}-${b.id}`;
      let idxA = customOrder.indexOf(keyA);
      let idxB = customOrder.indexOf(keyB);
      if (idxA === -1) idxA = 9999;
      if (idxB === -1) idxB = 9999;
      return idxA - idxB;
    });
  }

  return validItems;
}

let currentPlaylistFilter = 'micclub';
function setPlaylistFilter(filter) {
  currentPlaylistFilter = filter;
  // Actualizar clases activas de los botones de filtro
  ['micclub', 'libre', 'guest'].forEach(f => {
    const btn = document.getElementById(`pl-filter-${f}`);
    if (btn) btn.classList.toggle('active', f === filter);
  });
  
  // Actualizar título dinámico de la cola
  const nameEl = document.getElementById('yt-playlist-list-name');
  if (nameEl) {
    if (filter === 'micclub') {
      nameEl.textContent = 'Cola de Participantes Mic Club';
    } else if (filter === 'libre') {
      nameEl.textContent = 'Cola de Karaoke Libre';
    } else if (filter === 'guest') {
      nameEl.textContent = 'Cola de Artistas Invitados';
    }
  }
  
  renderPlaylistQueue();
}

// Variables de drag and drop nativo
let dragSourceIndex = null;
function drag(ev, index) {
  dragSourceIndex = index;
  ev.dataTransfer.effectAllowed = "move";
}
function allowDrop(ev) {
  ev.preventDefault();
}
function drop(ev, targetIndex) {
  ev.preventDefault();
  if (dragSourceIndex === null || dragSourceIndex === targetIndex) return;
  moveQueueItemDirect(dragSourceIndex, targetIndex);
  dragSourceIndex = null;
}

// Renderizar cola de reproducción
function renderPlaylistQueue() {
  const countEl = document.getElementById('yt-playlist-count');
  const itemsContainer = document.getElementById('yt-playlist-items');
  if (!itemsContainer) return;

  let queue = getConsolidatedQueue();
  
  // Aplicar filtro de visualización según pestaña activa
  if (currentPlaylistFilter === 'micclub') {
    queue = queue.filter(item => item.source === 'micclub' || (item.source === 'manual' && item.targetList === 'micclub'));
  } else if (currentPlaylistFilter === 'libre') {
    queue = queue.filter(item => item.source === 'libre' || (item.source === 'manual' && item.targetList === 'libre'));
  } else if (currentPlaylistFilter === 'guest') {
    queue = queue.filter(item => item.source === 'guest' || (item.source === 'manual' && item.targetList === 'guest'));
  }

  if (countEl) countEl.textContent = `${queue.length} temas`;

  if (!queue.length) {
    itemsContainer.innerHTML = `<div style="color:var(--text2);font-style:italic;font-size:12px;text-align:center;padding:16px">La cola de reproducción está vacía</div>`;
    return;
  }

  itemsContainer.innerHTML = queue.map((item, idx) => {
    const isCurrent = activeYtVideo && activeYtVideo.source === item.source && activeYtVideo.id === item.id;
    const badgeText = item.source === 'micclub' ? 'MC' : (item.source === 'libre' ? 'LIBRE' : (item.source === 'guest' ? 'INVITADOS' : 'MANUAL'));
    const badgeColorClass = item.source === 'micclub' ? 'badge-gold' : (item.source === 'libre' ? 'badge-teal' : (item.source === 'guest' ? 'badge-purple' : 'badge-purple'));
    const badgeHtml = item.source === 'micclub' ? '' : `<span class="badge ${badgeColorClass}" style="font-size:8px;padding:2px 4px">${badgeText}</span>`;
    
    return `
      <div class="draggable-queue-item" draggable="true" ondragstart="drag(event, ${idx})" ondragover="allowDrop(event)" ondrop="drop(event, ${idx})" style="background:var(--bg3);border:1px solid ${isCurrent ? 'var(--gold)' : 'var(--border)'};border-radius:8px;padding:8px 10px;display:flex;align-items:center;justify-content:space-between;gap:8px;transition:border-color 0.2s">
        <div style="display:flex;align-items:center;gap:8px;min-width:0;flex:1">
          <!-- Drag Handle -->
          <div style="cursor:grab;color:var(--text2);font-size:14px;padding-right:4px;user-select:none" title="Arrastrar para reordenar">☰</div>
          
          <div style="min-width:0;flex:1">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px">
              ${badgeHtml}
              <span style="font-size:10px;color:var(--text2)">${idx + 1}. ${esc(item.name)}</span>
            </div>
            <div style="font-size:12px;font-weight:600;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(item.song)}">
              ${esc(item.song)}
            </div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:4px;flex-shrink:0">
          <!-- Tocar -->
          <button class="playlist-item-btn ${isCurrent && isYtPlaying ? 'paused-state' : ''}" onclick="playQueueItem('${item.source}', '${item.id}')">
            ${isCurrent && isYtPlaying 
              ? '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style="display:inline-block;vertical-align:middle"><path d="M6 19H10V5H6V19ZM14 5V19H18V5H14Z"/></svg>' 
              : '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style="display:inline-block;vertical-align:middle"><path d="M8 5V19L19 12L8 5Z"/></svg>'
            }
          </button>
          
          <!-- Borrar -->
          <button class="playlist-item-delete-btn" onclick="deleteQueueItem('${item.source}', '${item.id}')" style="display:inline-flex;align-items:center;justify-content:center;padding:0"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg></button>
        </div>
      </div>
    `;
  }).join('');
}

async function deleteQueueItem(source, id) {
  if (!confirm('¿Estás seguro de que querés borrar este tema de la cola?')) return;
  const activeEventId = getAdminActiveEventId();
  if (!activeEventId) return;

  if (source === 'manual') {
    // Buscar el índice del ítem manual en customQueueItems
    const idx = parseInt(id.replace('manual-', ''), 10);
    if (!isNaN(idx)) {
      customQueueItems.splice(idx, 1);
      saveCustomQueueItems();
      renderPlaylistQueue();
    }
  } else if (source === 'libre') {
    if (firebaseOk) {
      await dbRemove(dbRef(db, `freeKaraoke/${activeEventId}/${id}`));
    } else {
      if (freeKaraokeList[activeEventId]) {
        delete freeKaraokeList[activeEventId][id];
        saveLocal();
      }
    }
  } else if (source === 'micclub') {
    if (firebaseOk) {
      await dbUpdate(dbRef(db), {
        [`participants/${id}/songConfirmed`]: false,
        [`participants/${id}/reservations/${activeEventId}/songConfirmed`]: false
      });
    } else {
      const p = allParticipants[id];
      if (p) {
        p.songConfirmed = false;
        if (p.reservations && p.reservations[activeEventId]) {
          p.reservations[activeEventId].songConfirmed = false;
        }
        saveLocal();
      }
    }
  }
  updateUI();
}

async function moveQueueItemDirect(fromIndex, toIndex) {
  let queue = getConsolidatedQueue();
  
  if (currentPlaylistFilter === 'micclub') {
    queue = queue.filter(item => item.source === 'micclub' || (item.source === 'manual' && item.targetList === 'micclub'));
  } else if (currentPlaylistFilter === 'libre') {
    queue = queue.filter(item => item.source === 'libre' || (item.source === 'manual' && item.targetList === 'libre'));
  }

  if (fromIndex < 0 || fromIndex >= queue.length || toIndex < 0 || toIndex >= queue.length) return;

  // Mover el elemento de fromIndex a toIndex
  const [movedItem] = queue.splice(fromIndex, 1);
  queue.splice(toIndex, 0, movedItem);

  // Generar lista completa ordenada combinada con los ítems filtrados
  const newOrder = queue.map(item => `${item.source}-${item.id}`);

  // Agregar los ítems que no estaban en la vista actual (si los hay)
  const fullQueue = getConsolidatedQueue();
  fullQueue.forEach(item => {
    const key = `${item.source}-${item.id}`;
    if (!newOrder.includes(key)) {
      newOrder.push(key);
    }
  });

  if (firebaseOk) {
    await dbUpdate(dbRef(db, 'settings'), { queueOrder: newOrder });
  } else {
    localState.settings.queueOrder = newOrder;
    saveLocal();
    updateUI();
  }
}

// Modal para agregar canciones manuales
function openAddSongModal() {
  const modal = document.getElementById('modal-add-song');
  const err = document.getElementById('add-song-err');
  if (err) err.style.display = 'none';
  
  const singer = document.getElementById('add-song-singer');
  const title = document.getElementById('add-song-title');
  const url = document.getElementById('add-song-url');
  if (singer) singer.value = '';
  if (title) title.value = '';
  if (url) url.value = '';
  
  if (modal) modal.style.display = 'flex';
}

function closeAddSongModal() {
  const modal = document.getElementById('modal-add-song');
  if (modal) modal.style.display = 'none';
}

async function submitAddSongModal() {
  const singer = document.getElementById('add-song-singer')?.value.trim();
  const title = document.getElementById('add-song-title')?.value.trim();
  const url = document.getElementById('add-song-url')?.value.trim();
  const err = document.getElementById('add-song-err');

  if (!singer || !title || !url) {
    if (err) {
      err.textContent = 'Por favor, completá todos los campos';
      err.style.display = 'block';
    }
    return;
  }

  const ytId = getYouTubeId(url);
  if (!ytId) {
    if (err) {
      err.textContent = 'Enlace de YouTube o ID no válido';
      err.style.display = 'block';
    }
    return;
  }

  const activeFilter = currentPlaylistFilter || 'micclub';
  customQueueItems.push({
    name: singer,
    song: title,
    url: url,
    targetList: activeFilter
  });
  saveCustomQueueItems();

  closeAddSongModal();
  updateUI();
}

// Reproducir ítem específico de la cola
function playQueueItem(source, id, autoPlay = true) {
  const queue = getConsolidatedQueue();
  const item = queue.find(x => x.source === source && x.id === id);
  if (!item) return;

  if (activeYtVideo && activeYtVideo.source === source && activeYtVideo.id === id) {
    // Si ya es el ítem activo, alternar reproducción
    ytRemoteTogglePlay();
    return;
  }

  activeYtVideo = item;
  isYtPlaying = autoPlay;
  
  // Actualizar el UI del reproductor remoto
  const titleEl = document.getElementById('yt-remote-title');
  const singerEl = document.getElementById('yt-remote-singer');
  const thumbEl = document.getElementById('yt-remote-thumb');
  const playBtn = document.getElementById('yt-remote-play-btn');

  if (titleEl) titleEl.textContent = item.song;
  if (singerEl) singerEl.textContent = item.name;
  if (thumbEl) {
    thumbEl.innerHTML = `<img src="https://img.youtube.com/vi/${item.ytId}/default.jpg" style="width:100%;height:100%;object-fit:cover">`;
  }
  if (playBtn) {
    updatePlayBtnIcon();
  }

  // Enviar comando de carga a la pantalla de proyección
  if (castChannel) {
    castChannel.postMessage({
      type: autoPlay ? 'yt_load' : 'yt_cue',
      ytId: item.ytId,
      title: item.name,
      song: item.song
    });
  }
  if (firebaseOk && MODE !== 'bar') {
    dbUpdate(dbRef(db, 'settings'), {
      castYtVideo: {
        ytId: item.ytId,
        title: item.name,
        song: item.song,
        autoPlay: autoPlay,
        timestamp: Date.now()
      },
      playerState: autoPlay ? 'playing' : 'paused',
      playerTime: 0
    });
  }

  // Auto-seleccionar la vista según el modo de reproducción
  const mode = localState.settings?.playbackMode || 'theme';
  if (mode === 'continuous') {
    setCastLayout('video');
  } else {
    setCastLayout('intro_tema');
  }
  
  renderPlaylistQueue();
}

// Quitar un ítem manual de la cola
function removeQueueItem(id) {
  if (id.startsWith('manual-')) {
    const idx = parseInt(id.replace('manual-', ''), 10);
    if (!isNaN(idx)) {
      customQueueItems.splice(idx, 1);
      saveCustomQueueItems();
      renderPlaylistQueue();
    }
  }
}

// Agregar canción manual
function ytAddManualItem() {
  const singerInput = document.getElementById('yt-add-singer');
  const songInput = document.getElementById('yt-add-song');
  const urlInput = document.getElementById('yt-add-url');
  
  if (!urlInput) return;
  const url = urlInput.value.trim();
  if (!url) {
    mcAlert('⚠️ Por favor, ingresá una URL o ID de YouTube');
    return;
  }
  
  const ytId = getYouTubeId(url);
  if (!ytId) {
    mcAlert('⚠️ Enlace de YouTube inválido');
    return;
  }

  const singer = (singerInput?.value || '').trim() || 'Invitado';
  const song = (songInput?.value || '').trim() || 'Canción Manual';

  customQueueItems.push({ name: singer, song: song, url: url });
  saveCustomQueueItems();
  
  if (singerInput) singerInput.value = '';
  if (songInput) songInput.value = '';
  if (urlInput) urlInput.value = '';

  renderPlaylistQueue();
}

function togglePlaybackMode() {
  const currentMode = localState.settings?.playbackMode || 'theme';
  const newMode = (currentMode === 'theme') ? 'continuous' : 'theme';
  
  if (!localState.settings) localState.settings = {};
  localState.settings.playbackMode = newMode;
  saveLocal();

  if (firebaseOk && MODE !== 'bar') {
    dbUpdate(dbRef(db, 'settings'), { playbackMode: newMode });
  }
  
  updatePlaybackModeUI();
}

function updatePlaybackModeUI() {
  const btn = document.getElementById('playback-mode-btn');
  if (!btn) return;
  
  
  const mode = localState.settings?.playbackMode || 'theme';
  
  // Limpiar estilos inline previos para que use las clases CSS estándar
  btn.style.cssText = '';
  
  if (mode === 'continuous') {
    btn.textContent = 'lista';
    btn.className = 'btn btn-sm btn-playback-lista';
  } else {
    btn.textContent = 'tema';
    btn.className = 'btn btn-sm btn-playback-tema';
  }
  updatePlayBtnIcon();
}

window.togglePlaybackMode = togglePlaybackMode;
window.updatePlaybackModeUI = updatePlaybackModeUI;

// Alternar reproducción (Play / Pause)
function ytRemoteTogglePlay() {
  if (!activeYtVideo) {
    // Si no hay video activo, iniciar el primero de la cola
    const queue = getConsolidatedQueue();
    if (queue.length > 0) {
      playQueueItem(queue[0].source, queue[0].id);
    }
    return;
  }

  isYtPlaying = !isYtPlaying;
  updatePlayBtnIcon();

  if (isYtPlaying && currentCastLayout === 'intro_tema') {
    setCastLayout('video');
  }

  if (castChannel) {
    castChannel.postMessage({ type: isYtPlaying ? 'yt_play' : 'yt_pause' });
  }
  if (firebaseOk && MODE !== 'bar') {
    dbUpdate(dbRef(db, 'settings'), {
      castYtCommand: {
        type: isYtPlaying ? 'yt_play' : 'yt_pause',
        timestamp: Date.now()
      },
      playerState: isYtPlaying ? 'playing' : 'paused'
    });
  }
}

// Siguiente tema
function ytRemoteNext(autoPlay = true) {
  const queue = getConsolidatedQueue();
  if (!queue.length) return;
  
  let nextIdx = 0;
  if (activeYtVideo) {
    const currIdx = queue.findIndex(x => x.source === activeYtVideo.source && x.id === activeYtVideo.id);
    if (currIdx !== -1 && currIdx < queue.length - 1) {
      nextIdx = currIdx + 1;
    }
  }
  
  playQueueItem(queue[nextIdx].source, queue[nextIdx].id, autoPlay);
}

// Tema anterior
function ytRemotePrev() {
  const queue = getConsolidatedQueue();
  if (!queue.length) return;

  let prevIdx = 0;
  if (activeYtVideo) {
    const currIdx = queue.findIndex(x => x.source === activeYtVideo.source && x.id === activeYtVideo.id);
    if (currIdx > 0) {
      prevIdx = currIdx - 1;
    }
  }

  playQueueItem(queue[prevIdx].source, queue[prevIdx].id);
}

// Controladores de rango de Progreso del Admin
function ytRemoteProgressInput(val) {
  isSeeking = true;
  const timeCurrentEl = document.getElementById('yt-remote-time-current');
  if (timeCurrentEl) timeCurrentEl.textContent = formatTime(val);
}

function ytRemoteProgressChange(val) {
  isSeeking = false;
  if (castChannel) {
    castChannel.postMessage({ type: 'yt_seek', time: parseFloat(val) });
  }
  if (firebaseOk && MODE !== 'bar') {
    dbUpdate(dbRef(db, 'settings/castYtCommand'), {
      type: 'yt_seek',
      time: parseFloat(val),
      timestamp: Date.now()
    });
  }
}

// Control remoto de volumen
function ytRemoteVolumeChange(val) {
  if (castChannel) {
    castChannel.postMessage({ type: 'yt_set_volume', volume: parseInt(val, 10) });
  }
  if (firebaseOk && MODE !== 'bar') {
    dbUpdate(dbRef(db, 'settings'), {
      castYtVolume: parseInt(val, 10)
    });
  }
}

// Seleccionar diseño de emisión a pantalla secundaria
function setCastLayout(layout) {
  currentCastLayout = layout;
  updateCastButtonsHighlight(layout);
  
  if (screensaverActive) {
    screensaverActive = false;
    updateScreensaverUIState();
    stopScreensaverTimer();
    if (firebaseOk && MODE !== 'bar') {
      dbUpdate(dbRef(db, 'settings'), { screensaverActive: false });
    }
  }

  if (castChannel) {
    castChannel.postMessage({ type: 'cast_layout', layout: layout });
  }
  if (firebaseOk && MODE !== 'bar') {
    dbUpdate(dbRef(db, 'settings'), { castLayout: layout });
  }
}

// Destacar el botón del diseño activo en el admin
function updateCastButtonsHighlight(layout) {
  const layouts = ['video', 'ranking', 'parts', 'free', 'flyer', 'blank', 'vote', 'guests'];
  layouts.forEach(l => {
    const btn = document.getElementById(`cast-btn-${l}`);
    if (btn) btn.classList.toggle('active', l === layout);
    const btnBar = document.getElementById(`bar-cast-btn-${l}`);
    if (btnBar) btnBar.classList.toggle('active', l === layout);
  });
  
  const votingContainer = document.getElementById('voting-reveal-buttons-container');
  if (votingContainer) {
    if (layout === 'vote') {
      votingContainer.style.setProperty('display', 'grid', 'important');
    } else {
      votingContainer.style.setProperty('display', 'none', 'important');
    }
  }
}

// Dar formato de mm:ss a un número de segundos
function formatTime(secs) {
  if (isNaN(secs) || secs === undefined) return '00:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// ── LÓGICA DE PROYECCIÓN (PROYECTOR WINDOW) ──

let proyectorStatusInterval = null;

function startProyectorStatusLoop() {
  let tickCount = 0;
  if (proyectorStatusInterval) clearInterval(proyectorStatusInterval);
  proyectorStatusInterval = setInterval(() => {
    if (projectionPlayer && projectionPlayerReady && typeof projectionPlayer.getCurrentTime === 'function') {
      const stateMap = {
        '-1': 'unstarted',
        '0': 'ended',
        '1': 'playing',
        '2': 'paused',
        '3': 'buffering',
        '5': 'cued'
      };
      const playerState = projectionPlayer.getPlayerState();
      const currentTime = projectionPlayer.getCurrentTime();
      const duration = projectionPlayer.getDuration();
      const status = {
        type: 'yt_status',
        state: stateMap[playerState] || 'unknown',
        currentTime: currentTime,
        duration: duration
      };
      if (castChannel) castChannel.postMessage(status);
      
      tickCount++;
      if (tickCount >= 4) { // Cada 2 segundos
        tickCount = 0;
        if (firebaseOk) {
          dbUpdate(dbRef(db, 'settings'), {
            playerState: stateMap[playerState] || 'unknown',
            playerTime: currentTime,
            playerDuration: duration,
            playerTimestamp: Date.now()
          });
        }
      }
    }
  }, 500);
}

function stopProyectorStatusLoop() {
  if (proyectorStatusInterval) {
    clearInterval(proyectorStatusInterval);
    proyectorStatusInterval = null;
  }
}

function initProjectionPlayer() {
  if (projectionPlayerInitialized) return;
  projectionPlayerInitialized = true;
  const startVideoId = localState.settings?.castYtVideo?.ytId || 'M7lc1UVf-VE';
  lastLoadedVideoId = startVideoId;
  projectionPlayer = new YT.Player('pantalla-player', {
    width: '100%',
    height: '100%',
    videoId: startVideoId,
    playerVars: {
      autoplay: 1,
      controls: 0,
      disablekb: 1,
      fs: 0,
      modestbranding: 1,
      rel: 0,
      showinfo: 0
    },
    events: {
      onReady: onPlayerReady,
      onStateChange: onPlayerStateChange
    }
  });
}

function onPlayerReady(event) {
  projectionPlayerReady = true;
  if (IS_BAR_PROJECTION && projectionPlayer && typeof projectionPlayer.mute === 'function') {
    projectionPlayer.mute();
  }
  if (castChannel) {
    castChannel.postMessage({ type: 'projection_ready' });
  }
  // Auto-sincronizar al estar listo leyendo de Firebase (solo si no es proyeccion de bar)
  const s = localState.settings || {};
  if (IS_BAR_PROJECTION) {
    applyProyectorLayout('ranking');
    if (s.castYtVideo) {
      lastCastYtVideoTimestamp = s.castYtVideo.timestamp;
      if (lastLoadedVideoId !== s.castYtVideo.ytId) {
        lastLoadedVideoId = s.castYtVideo.ytId;
        projectionPlayer.loadVideoById(s.castYtVideo.ytId);
      }
      projectionPlayer.mute();
      if (s.castYtCommand) {
        lastCastYtCommandTimestamp = s.castYtCommand.timestamp;
      }
      if (s.playerState === 'playing' || (s.castYtCommand && s.castYtCommand.type === 'yt_play')) {
        projectionPlayer.playVideo();
      }
    }
  } else {
    if (s.castLayout) {
      applyProyectorLayout(s.castLayout);
    }
    if (s.castYtVideo) {
      lastCastYtVideoTimestamp = s.castYtVideo.timestamp;
      if (lastLoadedVideoId !== s.castYtVideo.ytId) {
        lastLoadedVideoId = s.castYtVideo.ytId;
        if (s.castYtVideo.autoPlay !== false) {
          projectionPlayer.loadVideoById(s.castYtVideo.ytId);
        } else {
          projectionPlayer.cueVideoById(s.castYtVideo.ytId);
        }
      }
    }
    if (s.castYtVolume !== undefined) {
      projectionPlayer.setVolume(s.castYtVolume);
    }
    if (s.castYtCommand) {
      lastCastYtCommandTimestamp = s.castYtCommand.timestamp;
    }
    if ((s.castYtCommand && s.castYtCommand.type === 'yt_play') || s.playerState === 'playing') {
      projectionPlayer.playVideo();
    }
  }
}

function onPlayerStateChange(event) {
  const stateMap = {
    '0': 'ended',
    '1': 'playing',
    '2': 'paused',
    '3': 'buffering'
  };
  const st = stateMap[event.data] || 'unknown';

  if (IS_BAR_PROJECTION && projectionPlayer && projectionPlayerReady && typeof projectionPlayer.mute === 'function') {
    projectionPlayer.mute();
  }

  if (event.data === YT.PlayerState.PLAYING) {
    startProyectorStatusLoop();
    
    if (currentCastLayout === 'intro_tema') {
      if (firebaseOk && !IS_BAR_PROJECTION) {
        dbUpdate(dbRef(db, 'settings'), { castLayout: 'video' });
      } else {
        currentCastLayout = 'video';
        applyProyectorLayout('video');
        if (castChannel) {
          castChannel.postMessage({ type: 'cast_layout', layout: 'video' });
        }
      }
    }

    if (firebaseOk && !IS_BAR_PROJECTION) {
      dbUpdate(dbRef(db, 'settings'), {
        playerState: 'playing',
        playerTime: projectionPlayer.getCurrentTime(),
        playerDuration: projectionPlayer.getDuration(),
        playerTimestamp: Date.now()
      });
    }
  } else {
    stopProyectorStatusLoop();
    if (typeof projectionPlayer.getCurrentTime === 'function') {
      if (castChannel) {
        castChannel.postMessage({
          type: 'yt_status',
          state: st,
          currentTime: projectionPlayer.getCurrentTime(),
          duration: projectionPlayer.getDuration()
        });
      }
      if (firebaseOk && !IS_BAR_PROJECTION) {
        dbUpdate(dbRef(db, 'settings'), {
          playerState: st,
          playerTime: projectionPlayer.getCurrentTime(),
          playerDuration: projectionPlayer.getDuration(),
          playerTimestamp: Date.now()
        });
      }
    }
  }
  
  if (event.data === YT.PlayerState.ENDED) {
    lastLoadedVideoId = null; // PERMITIR REPLAY DE LA MISMA CANCIÓN
    if (castChannel) {
      castChannel.postMessage({ type: 'yt_ended' });
    }
    const mode = localState.settings?.playbackMode || 'theme';
    if (mode === 'continuous') {
      ytRemoteNext(true);
    } else {
      ytRemoteNext(false);
    }
  }
}

function applyProyectorLayout(layout) {
  const ytContainer = document.getElementById('pantalla-yt-container');
  const layoutContainer = document.querySelector('.pantalla-layout');

  if (layout === 'video') {
    if (ytContainer) {
      ytContainer.style.display = 'block';
      ytContainer.style.position = 'absolute';
      ytContainer.style.top = '0';
      ytContainer.style.left = '0';
      ytContainer.style.width = '100%';
      ytContainer.style.height = '100%';
      ytContainer.style.opacity = '1';
      ytContainer.style.zIndex = '9999';
      ytContainer.style.pointerEvents = 'auto';
    }
    if (layoutContainer) layoutContainer.style.display = 'none';


  } else if (layout === 'blank') {
    if (ytContainer) {
      ytContainer.style.display = 'block';
      ytContainer.style.position = 'absolute';
      ytContainer.style.top = '0';
      ytContainer.style.left = '0';
      ytContainer.style.width = '100%';
      ytContainer.style.height = '100%';
      ytContainer.style.opacity = '0';
      ytContainer.style.zIndex = '-9999';
      ytContainer.style.pointerEvents = 'none';
    }
    if (layoutContainer) layoutContainer.style.display = 'none';
    if (projectionPlayer && projectionPlayerReady) projectionPlayer.pauseVideo();
  } else {
    if (ytContainer) {
      ytContainer.style.display = 'block';
      ytContainer.style.position = 'absolute';
      ytContainer.style.top = '0';
      ytContainer.style.left = '0';
      ytContainer.style.width = '100%';
      ytContainer.style.height = '100%';
      ytContainer.style.opacity = '0.001';
      ytContainer.style.zIndex = '1';
      ytContainer.style.pointerEvents = 'none';
    }
    if (layoutContainer) {
      layoutContainer.style.display = (window.innerWidth < 768) ? 'block' : 'grid';
    }
    // No pausamos el video en otros layouts para permitir reproducción en segundo plano.
    
    if (layout === 'ranking') setPantallaTab('ranking');
    else if (layout === 'parts') setPantallaTab('participantes');
    else if (layout === 'free') setPantallaTab('karaoke');
    else if (layout === 'flyer') setPantallaTab('proximo');
    else if (layout === 'vote') setPantallaTab('votos');
    else if (layout === 'guests') setPantallaTab('artistas');
    else if (layout === 'intro_tema') setPantallaTab('intro_tema');
  }
}

function handleProyectorMessage(data) {
  if (MODE !== 'pantalla') return;

  if (data.type === 'cast_layout') {
    currentCastLayout = data.layout;
    applyProyectorLayout(data.layout);
  } else if (data.type === 'sync_voting_columns') {
    if (!localState.settings) localState.settings = {};
    localState.settings.votingVisibleColumns = data.votingVisibleColumns;
    if (pantallaTab === 'votos') {
      renderPantallaContent();
    }
  } else if (data.type === 'yt_load') {
    if (projectionPlayer && projectionPlayerReady) {
      if (lastLoadedVideoId !== data.ytId) {
        lastLoadedVideoId = data.ytId;
        projectionPlayer.loadVideoById(data.ytId);
      }
    }
  } else if (data.type === 'yt_cue') {
    if (projectionPlayer && projectionPlayerReady) {
      if (lastLoadedVideoId !== data.ytId) {
        lastLoadedVideoId = data.ytId;
        projectionPlayer.cueVideoById(data.ytId);
      }
    }
  } else if (data.type === 'yt_play') {
    if (projectionPlayer && projectionPlayerReady) {
      projectionPlayer.playVideo();
    }
  } else if (data.type === 'yt_pause') {
    if (projectionPlayer && projectionPlayerReady) {
      projectionPlayer.pauseVideo();
    }
  } else if (data.type === 'yt_seek') {
    if (projectionPlayer && projectionPlayerReady) {
      projectionPlayer.seekTo(data.time, true);
    }
  } else if (data.type === 'yt_set_volume') {
    if (projectionPlayer && projectionPlayerReady) {
      projectionPlayer.setVolume(data.volume);
    }
  } else if (data.type === 'sync_request') {
    const playerState = (projectionPlayer && projectionPlayerReady) ? projectionPlayer.getPlayerState() : -1;
    if (castChannel) {
      castChannel.postMessage({
        type: 'sync_response',
        layout: currentCastLayout,
        currentVideoId: (projectionPlayer && projectionPlayerReady) ? projectionPlayer.getVideoData()?.video_id : null,
        isPlaying: playerState === 1,
        currentTime: (projectionPlayer && projectionPlayerReady && typeof projectionPlayer.getCurrentTime === 'function') ? projectionPlayer.getCurrentTime() : 0,
        volume: (projectionPlayer && projectionPlayerReady && typeof projectionPlayer.getVolume === 'function') ? projectionPlayer.getVolume() : 100
      });
    }
  }
}

function handleCastMessage(data) {
  if (data.type === 'yt_status') {
    const progressEl = document.getElementById('yt-remote-progress');
    const timeCurrentEl = document.getElementById('yt-remote-time-current');
    const timeDurationEl = document.getElementById('yt-remote-time-duration');

    const activeStates = ['playing', 'buffering'];
    const isActive = activeStates.includes(data.state);

    isYtPlaying = isActive;
    updatePlayBtnIcon();
    renderPlaylistQueue();

    if (!isSeeking && progressEl) {
      progressEl.max = Math.floor(data.duration || 0);
      progressEl.value = Math.floor(data.currentTime || 0);
    }
    
    if (timeCurrentEl) timeCurrentEl.textContent = formatTime(data.currentTime);
    if (timeDurationEl) timeDurationEl.textContent = formatTime(data.duration);
    
  } else if (data.type === 'yt_ended') {
    isYtPlaying = false;
    updatePlayBtnIcon();
    renderPlaylistQueue();
    if (!firebaseOk) {
      const mode = localState.settings?.playbackMode || 'theme';
      if (mode === 'continuous') {
        ytRemoteNext(true);
      } else {
        ytRemoteNext(false);
      }
    }
  } else if (data.type === 'sync_request') {
    if (MODE === 'pantalla') {
      const playerState = (projectionPlayer && projectionPlayerReady) ? projectionPlayer.getPlayerState() : -1;
      if (castChannel) {
        castChannel.postMessage({
          type: 'sync_response',
          layout: currentCastLayout,
          currentVideoId: (projectionPlayer && projectionPlayerReady) ? projectionPlayer.getVideoData()?.video_id : null,
          isPlaying: playerState === 1,
          currentTime: (projectionPlayer && projectionPlayerReady && typeof projectionPlayer.getCurrentTime === 'function') ? projectionPlayer.getCurrentTime() : 0,
          volume: (projectionPlayer && projectionPlayerReady && typeof projectionPlayer.getVolume === 'function') ? projectionPlayer.getVolume() : 100
        });
      }
    }
  } else if (data.type === 'sync_response') {
    if (MODE === 'admin' || MODE === 'home' || MODE === 'bar') {
      currentCastLayout = data.layout;
      updateCastButtonsHighlight(data.layout);
      
      isYtPlaying = data.isPlaying;
      updatePlayBtnIcon();
      
      const volEl = document.getElementById('yt-remote-volume');
      if (volEl) volEl.value = data.volume;
    }
  } else if (data.type === 'projection_ready') {
    if (MODE === 'admin' || MODE === 'home' || MODE === 'bar') {
      setCastLayout(currentCastLayout);
      if (castChannel) {
        castChannel.postMessage({
          type: 'sync_voting_columns',
          votingVisibleColumns: localState.settings?.votingVisibleColumns || {}
        });
      }
      if (activeYtVideo) {
        if (castChannel) {
          castChannel.postMessage({
            type: 'yt_load',
            ytId: activeYtVideo.ytId,
            title: activeYtVideo.name,
            song: activeYtVideo.song
          });
        }
      }
    }
  }
}

// Inicializar el canal de comunicación
if (window.BroadcastChannel) {
  const channelName = (MODE === 'bar' || (MODE === 'pantalla' && IS_BAR_PROJECTION)) ? 'micclub_cast_bar' : 'micclub_cast';
  castChannel = new BroadcastChannel(channelName);
  castChannel.onmessage = (event) => {
    if (MODE === 'pantalla') {
      handleProyectorMessage(event.data);
    } else {
      handleCastMessage(event.data);
    }
  };
}

// Cargar la API de IFrame de YouTube si estamos en el Monitor
if (MODE === 'pantalla') {
  // Añadir clase para ocultar scrollbars en el monitor
  document.body.classList.add('mode-pantalla');

  // Definir el callback antes de inyectar el script para evitar race conditions
  window.onYouTubeIframeAPIReady = function() {
    initProjectionPlayer();
  };

  const tag = document.createElement('script');
  tag.src = "https://www.youtube.com/iframe_api";
  const firstScriptTag = document.getElementsByTagName('script')[0];
  if (firstScriptTag) {
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
  } else {
    document.head.appendChild(tag);
  }

  // Si por alguna razón ya estuviera cargado previamente
  if (window.YT && window.YT.Player) {
    initProjectionPlayer();
  }
}

// Solicitar sincronización inicial
if (MODE === 'admin' || MODE === 'home') {
  setTimeout(() => {
    if (castChannel) castChannel.postMessage({ type: 'sync_request' });
  }, 1000);
}

// Registrar funciones globales para invocarlas desde el HTML
window.setCastLayout = setCastLayout;
window.ytRemoteTogglePlay = ytRemoteTogglePlay;
window.ytRemoteNext = ytRemoteNext;
window.ytRemotePrev = ytRemotePrev;
window.ytRemoteProgressInput = ytRemoteProgressInput;
window.ytRemoteProgressChange = ytRemoteProgressChange;
window.ytRemoteVolumeChange = ytRemoteVolumeChange;
window.ytAddManualItem = ytAddManualItem;
window.playQueueItem = playQueueItem;
window.removeQueueItem = removeQueueItem;
window.deleteQueueItem = deleteQueueItem;
window.moveQueueItemDirect = moveQueueItemDirect;
window.setPlaylistFilter = setPlaylistFilter;
window.openAddSongModal = openAddSongModal;
window.closeAddSongModal = closeAddSongModal;
window.submitAddSongModal = submitAddSongModal;
window.drag = drag;
window.allowDrop = allowDrop;
window.drop = drop;

async function setActiveEvent(slot) {
  try {
    const evData = localState.settings?.events?.[slot] || null;
    const updates = {
      'settings/activeEventSlot': slot,
      'settings/currentEvent': evData
    };
    if (firebaseOk) {
      await dbUpdate(dbRef(db), updates);
    } else {
      localState.settings.activeEventSlot = slot;
      localState.settings.currentEvent = evData;
      saveLocal();
    }
    adminSelectedEventSlot = slot;
    updateUI();
  } catch(e) {
    console.error(e);
  }
}

function setAdminSelectedEventSlot(slot) {
  setActiveEvent(slot);
}

window.setActiveEvent = setActiveEvent;
window.setAdminSelectedEventSlot = setAdminSelectedEventSlot;

function activateAutoplay() {
  const el = document.getElementById('pantalla-autoplay-overlay');
  if (el) el.style.display = 'none';
  if (projectionPlayer && projectionPlayerReady && typeof projectionPlayer.playVideo === 'function') {
    projectionPlayer.playVideo();
  }
}
window.activateAutoplay = activateAutoplay;

function checkProjectionWindowClosed() {
  if (projectionWindowRef && projectionWindowRef.closed) {
    projectionWindowRef = null;
    if (firebaseOk && MODE !== 'bar') {
      dbUpdate(dbRef(db, 'settings'), { projectionActive: false });
    } else {
      lastProjectionActive = false;
      updateProjectionButtonUI();
    }
    if (projectionCheckInterval) {
      clearInterval(projectionCheckInterval);
      projectionCheckInterval = null;
    }
  }
}

function openProjectionWindow() {
  const url = (MODE === 'bar') ? '?mode=pantalla&source=bar' : '?mode=pantalla';
  const name = (MODE === 'bar') ? 'micclub_projection_bar' : 'micclub_projection';
  const w = window.screen.width || 1920;
  const h = window.screen.height || 1080;
  
  // Abrir como ventana popup limpia (sin barras de URL o pestañas)
  // E intentar posicionarla en el segundo monitor a la derecha (coordenada left = w)
  const features = `width=${w},height=${h},left=${w},top=0,menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=no`;
  projectionWindowRef = window.open(url, name, features);
  if (projectionWindowRef) {
    projectionWindowRef.focus();
  } else {
    // Si el navegador bloquea los popups, usar fallback normal en nueva pestaña
    projectionWindowRef = window.open(url, '_blank');
  }
  
  if (projectionCheckInterval) clearInterval(projectionCheckInterval);
  projectionCheckInterval = setInterval(checkProjectionWindowClosed, 1000);
}
window.openProjectionWindow = openProjectionWindow;

function toggleProjectionState() {
  if (window.innerWidth < 992) return; // Prevent projection toggling on mobile
  if (lastProjectionActive) {
    if (projectionWindowRef && !projectionWindowRef.closed) {
      projectionWindowRef.close();
      projectionWindowRef = null;
    }
    if (firebaseOk && MODE !== 'bar') {
      dbUpdate(dbRef(db, 'settings'), { projectionActive: false });
    } else {
      lastProjectionActive = false;
      updateProjectionButtonUI();
    }
    if (projectionCheckInterval) {
      clearInterval(projectionCheckInterval);
      projectionCheckInterval = null;
    }
    return;
  }

  const startLayout = (MODE === 'bar') ? 'ranking' : 'video';
  openProjectionWindow();
  setCastLayout(startLayout);
  
  if (firebaseOk && MODE !== 'bar') {
    dbUpdate(dbRef(db, 'settings'), { projectionActive: true, castLayout: startLayout });
  } else {
    lastProjectionActive = true;
    updateProjectionButtonUI();
  }
}
window.toggleProjectionState = toggleProjectionState;

function updateProjectionButtonUI() {
  const btn = document.getElementById('cast-btn-emitir');
  const btnBar = document.getElementById('bar-cast-btn-emitir');
  const btns = [btn, btnBar].filter(Boolean);
  
  const isMobile = window.innerWidth < 992;
  
  btns.forEach(b => {
    b.classList.remove('btn-gold', 'btn-green-emitting', 'btn-emit-mobile-active', 'btn-emit-mobile-inactive');
    b.style.pointerEvents = '';
    
    if (isMobile) {
      if (lastProjectionActive) {
        b.textContent = 'Emitiendo';
        b.classList.add('btn-emit-mobile-active');
      } else {
        b.textContent = 'Sin emisión';
        b.classList.add('btn-emit-mobile-inactive');
      }
    } else {
      if (lastProjectionActive) {
        b.textContent = 'Emitiendo';
        b.classList.add('btn-green-emitting');
      } else {
        b.textContent = 'Emitir';
        b.classList.add('btn-gold');
      }
    }
  });
}
window.updateProjectionButtonUI = updateProjectionButtonUI;

// ── LÓGICA DE NAVEGACIÓN MÓVIL Y SALVAPANTALLAS ──
let activeMobileSection = 'admin'; // 'admin' o 'reproduccion'

function toggleMobileSection() {
  if (activeMobileSection === 'admin') {
    activeMobileSection = 'reproduccion';
  } else {
    activeMobileSection = 'admin';
  }
  updateMobileLayout();
}
window.toggleMobileSection = toggleMobileSection;

function updateMobileLayout() {
  const adminMainCols = document.querySelectorAll('.admin-main-column');
  const videoCol = document.getElementById('admin-video-sidebar');
  const toggleBtn = document.getElementById('mobile-nav-toggle-btn');
  const container = document.getElementById('mobile-nav-toggle-container');
  
  const isMobile = window.innerWidth < 992;
  const isDashboardVisible = isMobile && (currentPage === 'home' || currentPage === 'admin') && adminLoggedIn;
  
  if (isMobile) {
    if (container) {
      container.style.display = isDashboardVisible ? 'block' : 'none';
    }
    
    if (isDashboardVisible) {
      adminMainCols.forEach(col => {
        col.classList.toggle('active-mobile', activeMobileSection === 'admin');
      });
      if (videoCol) {
        videoCol.classList.toggle('active-mobile', activeMobileSection === 'reproduccion');
      }
      
      if (toggleBtn) {
        if (activeMobileSection === 'admin') {
          toggleBtn.innerHTML = 'Ir a Playlist';
          toggleBtn.className = 'btn btn-gold';
        } else {
          toggleBtn.innerHTML = 'Ir a administración';
          toggleBtn.className = 'btn btn-outline';
          toggleBtn.style.color = 'var(--text)';
        }
      }
      if (activeMobileSection === 'reproduccion') {
        renderPlaylistQueue();
      }
    } else {
      adminMainCols.forEach(col => {
        col.classList.remove('active-mobile');
      });
      if (videoCol) {
        videoCol.classList.remove('active-mobile');
      }
    }
  } else {
    // Escritorio
    if (container) container.style.display = 'none';
    adminMainCols.forEach(col => {
      col.style.display = 'block';
      col.classList.remove('active-mobile');
    });
    if (videoCol) {
      videoCol.style.display = 'block';
      videoCol.classList.remove('active-mobile');
    }
  }
}
window.updateMobileLayout = updateMobileLayout;

// Escuchar cambios de tamaño para recalcular el layout
window.addEventListener('resize', () => {
  updateMobileLayout();
  renderVotingToggleBtn();
});

// Lógica de Salvapantallas
let screensaverTimeoutId = null;
let screensaverActive = false;
let screensaverCurrentView = 'ranking';

function updateScreensaverUIState() {
  const btn = document.getElementById('screensaver-toggle-btn');
  const btnBar = document.getElementById('bar-screensaver-toggle-btn');
  const btns = [btn, btnBar].filter(Boolean);
  
  btns.forEach(b => {
    b.textContent = 'Salvapantallas';
    if (screensaverActive) {
      b.style.borderColor = 'var(--red)';
      b.style.color = 'var(--red)';
      b.style.background = 'rgba(255, 61, 107, 0.1)';
    } else {
      b.style.borderColor = '';
      b.style.color = '';
      b.style.background = '';
    }
  });
}
window.updateScreensaverUIState = updateScreensaverUIState;

function toggleScreensaver() {
  const targetState = !screensaverActive;
  if (firebaseOk && MODE !== 'bar') {
    dbUpdate(dbRef(db, 'settings'), { screensaverActive: targetState });
  } else {
    screensaverActive = targetState;
    updateScreensaverUIState();
    if (screensaverActive) {
      startScreensaverTimer();
    } else {
      stopScreensaverTimer();
    }
  }
}
window.toggleScreensaver = toggleScreensaver;

function startScreensaverTimer() {
  if (screensaverTimeoutId) clearTimeout(screensaverTimeoutId);
  runScreensaverStep();
}

function stopScreensaverTimer() {
  if (screensaverTimeoutId) {
    clearTimeout(screensaverTimeoutId);
    screensaverTimeoutId = null;
  }
}

function runScreensaverStep() {
  if (!screensaverActive) return;
  
  const isFreeMode = (localState.settings?.playbackMode === 'free');
  const isVotingClosed = !localState.settings?.votingOpen;
  
  // Instancia 2: Votación cerrada y Karaoke libre activo
  const isInstance2 = isVotingClosed && isFreeMode;
  
  let nextLayout = 'ranking';
  let nextDuration = 20000;
  
  if (isInstance2) {
    const sequence = ['free', 'vote', 'ranking', 'flyer'];
    let idx = sequence.indexOf(screensaverCurrentView);
    if (idx === -1) idx = 0;
    
    idx = (idx + 1) % sequence.length;
    nextLayout = sequence[idx];
    nextDuration = 20000; // 20s para todos
  } else {
    // Instancia 1: Cantante (según modo) -> ranking -> cantante...
    let singerLayout = 'parts';
    const currentMode = localState.settings?.playbackMode || 'theme';
    if (currentMode === 'guests') singerLayout = 'guests';
    else if (currentMode === 'free') singerLayout = 'free';
    
    if (screensaverCurrentView === singerLayout) {
      nextLayout = 'ranking';
      nextDuration = 10000; // 10s para ranking
    } else {
      nextLayout = singerLayout;
      nextDuration = 20000; // 20s para cantante
    }
  }
  
  screensaverCurrentView = nextLayout;
  
  if (MODE === 'pantalla') {
    applyProyectorLayout(nextLayout);
  } else if (!firebaseOk || MODE === 'bar') {
    setCastLayout(nextLayout);
  }
  
  if (screensaverActive) {
    screensaverTimeoutId = setTimeout(runScreensaverStep, nextDuration);
  }
}

// ── CONTROL DE REVELADO DE COLUMNAS DE VOTACIÓN ──
function toggleVotingColumn(columnKey) {
  if (!localState.settings) localState.settings = {};
  if (!localState.settings.votingVisibleColumns) localState.settings.votingVisibleColumns = {};
  
  const currentCols = localState.settings.votingVisibleColumns;
  const nextVal = !currentCols[columnKey];
  currentCols[columnKey] = nextVal;
  
  if (firebaseOk) {
    dbUpdate(dbRef(db, 'settings/votingVisibleColumns'), { [columnKey]: nextVal });
    setCastLayout('vote');
  } else {
    updateUI();
    setCastLayout('vote');
    if (projectionWindowRef && !projectionWindowRef.closed) {
      try {
        projectionWindowRef.applyProyectorLayout(currentCastLayout || 'vote');
      } catch (err) { console.error('Error applying proyector layout offline:', err); }
    }
  }
  
  if (castChannel) {
    castChannel.postMessage({
      type: 'sync_voting_columns',
      votingVisibleColumns: localState.settings.votingVisibleColumns
    });
  }
}
window.toggleVotingColumn = toggleVotingColumn;

function updateVotingVisibleColumnsButtonsUI() {
  const cols = localState.settings?.votingVisibleColumns || {};
  const map = {
    pubSong: 'btn-vote-col-pubSong',
    pubPerf: 'btn-vote-col-pubPerf',
    jurySong: 'btn-vote-col-jurySong',
    juryPerf: 'btn-vote-col-juryPerf',
    juryHinchada: 'btn-vote-col-juryHinchada'
  };
  
  Object.entries(map).forEach(([key, id]) => {
    const isVisible = !!cols[key];
    const btn = document.getElementById(id);
    if (btn) {
      btn.classList.toggle('active', isVisible);
    }
  });
}
window.updateVotingVisibleColumnsButtonsUI = updateVotingVisibleColumnsButtonsUI;

// ── LAYOUT UNIFICADO DE COLA DE REPRODUCCIÓN ──
function renderProjectionQueueLayout(title, items, emptyText) {
  if (!items || !items.length) {
    return `<div style="color:var(--text2);font-style:italic;text-align:center;padding:40px;font-size:15px">${esc(emptyText)}</div>`;
  }
  
  const activeItem = items[0];
  let songLabel = '';
  if (activeItem.songTitle || activeItem.song) {
    const sTitle = activeItem.songTitle || activeItem.song || '';
    const sArtist = activeItem.songArtist || '';
    songLabel = sTitle + (sArtist ? ' — ' + sArtist : '');
  } else {
    songLabel = 'Repertorio Especial';
  }
  
  let html = `
    <div style="width: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px 0; box-sizing: border-box; animation: fadeUp 0.5s ease-out forwards;">
      
      <!-- Cantando Ahora Block -->
      <div style="width: 100%; text-align: center; margin-bottom: 20px;">
        <div style="font-size: 14px; letter-spacing: 4px; color: var(--gold); font-weight: bold; margin-bottom: 8px; text-transform: uppercase;">
          🎤 ${esc(title)}
        </div>
        <div style="font-family: 'Oswald', sans-serif; font-size: 80px; font-weight: 700; color: #ffffff; text-shadow: 0 0 24px rgba(223, 172, 74, 0.5); line-height: 1.1; width: 80%; margin: 0 auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
          ${esc(activeItem.name)}
        </div>
        <div style="font-family: 'Inter', sans-serif; font-size: 24px; color: var(--gold); font-weight: 500; margin-top: 12px; margin-bottom: 12px; letter-spacing: 0.5px; opacity: 0.9;">
          ${esc(songLabel)}
        </div>
      </div>
  `;
  
  const nextList = items.slice(1);
  if (nextList.length > 0) {
    html += `
      <!-- Divisor -->
      <div style="width: 80%; height: 1px; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent); margin: 20px 0 30px 0;"></div>
      
      <!-- Siguientes en la cola -->
      <div style="width: 100%; max-width: 800px; margin: 0 auto;">
        <div style="font-size: 12px; letter-spacing: 3px; color: var(--text2); font-weight: bold; margin-bottom: 16px; text-transform: uppercase; text-align: center;">
          A Continuación...
        </div>
        <div style="display: flex; flex-direction: column; gap: 8px; max-height: 380px; overflow-y: auto; padding-right: 6px;">
          ${nextList.map((p, idx) => {
            let pSongLabel = '';
            if (p.songTitle || p.song) {
              const psTitle = p.songTitle || p.song || '';
              const psArtist = p.songArtist || '';
              pSongLabel = psTitle + (psArtist ? ' — ' + psArtist : '');
            } else {
              pSongLabel = 'Repertorio Especial';
            }
            return `
              <div style="padding: 10px 16px; background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.04); border-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
                <span style="font-family:'Inter',sans-serif; font-size: 18px; color: #ffffff; letter-spacing: 0.5px; font-weight: 500;">
                  ${idx + 2}. ${esc(p.name)}
                </span>
                <span style="font-family:'Inter',sans-serif; font-size: 14px; color: var(--gold); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:55%;">
                  ${esc(pSongLabel)}
                </span>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }
  
  html += `</div>`;
  return html;
}
window.renderProjectionQueueLayout = renderProjectionQueueLayout;

window.addEventListener('resize', () => {
  updateProjectionButtonUI();
});

