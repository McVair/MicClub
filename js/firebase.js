// ─────────────────────────────────────────────────────────────────────────────
//  MIC CLUB · Firebase Init + Configuración
//  ⚠️  PASO 1: Reemplazá los valores de firebaseConfig con los de tu proyecto
//  → https://console.firebase.google.com/ > Tu proyecto > Configuración > SDK
// ─────────────────────────────────────────────────────────────────────────────

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getDatabase, ref, set, get, onValue, push, update, remove
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

// ──────────────────────────────────────────────────
//  🔥 EDITÁ ESTOS VALORES — son los únicos que cambian entre proyectos
// ──────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyCbpxxFmEKNvEEvl471odiCs8w5X64_860",
  authDomain: "micclub-59d39.firebaseapp.com",
  databaseURL: "https://micclub-59d39-default-rtdb.firebaseio.com",
  projectId: "micclub-59d39",
  storageBucket: "micclub-59d39.firebasestorage.app",
  messagingSenderId: "964473645346",
  appId: "1:964473645346:web:cc1a834feb25441ee21d7b",
  measurementId: "G-E9HPHGVKR1"
};
// ──────────────────────────────────────────────────

const app = initializeApp(firebaseConfig);
const db  = getDatabase(app);

// Exponemos las funciones al scope global para que app.js las use
window._db        = db;
window._dbRef     = ref;
window._dbSet     = set;
window._dbGet     = get;
window._dbOnValue = onValue;
window._dbPush    = push;
window._dbUpdate  = update;
window._dbRemove  = remove;
window._firebaseReady = true;

document.dispatchEvent(new Event('firebaseReady'));
