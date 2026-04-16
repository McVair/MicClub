# 🎤 MIC CLUB · Las Alas de Mi Voz

Karaoke gamificado con ranking en tiempo real, votación pública, panel de jurado y modo show para proyectar en TV.

---

## Estructura del proyecto

```
micclub/
├── index.html              ← App principal (único HTML)
├── manifest.json           ← PWA (instalable en Android/iOS)
├── vercel.json             ← Deploy en Vercel
├── css/
│   └── styles.css          ← Todos los estilos
├── js/
│   ├── firebase.js         ← ⚙️  EDITÁ ESTE ARCHIVO con tu config de Firebase
│   └── app.js              ← Lógica de la aplicación
└── firebase/
    ├── firebase.json       ← Firebase Hosting config
    └── database.rules.json ← Reglas de seguridad de la base de datos
```

---

## Setup en 3 pasos

### Paso 1 — Crear proyecto en Firebase

1. Ir a [console.firebase.google.com](https://console.firebase.google.com/)
2. **Crear proyecto** → dale un nombre (ej: `micclub-evento`)
3. En el panel, ir a **Realtime Database** → Crear base de datos → Modo **prueba** (para empezar)
4. Ir a **Configuración del proyecto** (ícono ⚙️) → **Tus apps** → **Web** (ícono `</>`)
5. Registrar la app → copiar el objeto `firebaseConfig`

### Paso 2 — Pegar la configuración en el proyecto

Abrir `js/firebase.js` y reemplazar los valores:

```javascript
const firebaseConfig = {
  apiKey:            "tu-api-key-aqui",
  authDomain:        "tu-proyecto.firebaseapp.com",
  databaseURL:       "https://tu-proyecto-default-rtdb.firebaseio.com",
  projectId:         "tu-proyecto",
  storageBucket:     "tu-proyecto.appspot.com",
  messagingSenderId: "000000000000",
  appId:             "1:000000000000:web:000000000000000"
};
```

### Paso 3 — Deploy en Vercel (gratis)

1. Crear cuenta en [vercel.com](https://vercel.com/) si no tenés
2. Instalar CLI: `npm i -g vercel`
3. En la carpeta del proyecto: `vercel --prod`
4. Seguir el wizard → en ~1 minuto tenés la URL pública

O hacerlo desde la web:
1. Subir el proyecto a un repositorio de GitHub
2. En Vercel → **Add New Project** → conectar el repo
3. Deploy automático en cada push a `main`

---

## Reglas de la base de datos (Firebase)

El archivo `firebase/database.rules.json` contiene las reglas de seguridad. Para aplicarlas:

```bash
# Instalar Firebase CLI
npm install -g firebase-tools

# Login
firebase login

# Entrar a la carpeta firebase/
cd firebase

# Vincular con tu proyecto
firebase use tu-proyecto-id

# Publicar las reglas
firebase deploy --only database
```

> **Para producción**: las reglas actuales son abiertas (ideales para un evento).
> Si necesitás más seguridad, podés restringir escritura por IP o agregar autenticación.

---

## URLs del evento

| URL | Quién la usa | Descripción |
|-----|-------------|-------------|
| `tuapp.vercel.app` | Todos | Home + Ranking |
| `tuapp.vercel.app?mode=register` | Participantes | Formulario de reserva |
| `tuapp.vercel.app?mode=vote` | Público | Votación (un QR único) |
| `tuapp.vercel.app?mode=jury` | Jurado | Panel de puntuación |
| `tuapp.vercel.app?mode=admin` | Organizador | Admin completo |
| `tuapp.vercel.app#show` | Proyector/TV | Modo pantalla grande |

---

## Sistema de puntos

| Concepto | Puntos |
|----------|--------|
| Asistencia | +5 |
| Canción confirmada | +3 |
| Dúo (exactamente 2 personas) | +2 |
| Convocatoria | +1 por persona |
| Referido | +10 |
| Premio Mejor Canción | +10 |
| Premio Mejor Performance | +10 |
| Premio Hinchada | +8 |
| Premio Mesa | +8 |
| Votos del público | +1 por voto |
| Bonus Temática activo | ×2 en premios |
| Puntos extra manuales | configurable |

---

## Acceso admin

- **Contraseña por defecto**: `micclub2025`
- Cambiarla desde **Admin → Control → Cambiar Contraseña** antes del evento

---

## Modo fallback (sin Firebase)

Si Firebase no está configurado o hay un error de conexión, la app funciona automáticamente en **modo local** usando `localStorage`. Los datos se guardan en el navegador — útil para probar antes del evento, pero no se sincronizan entre dispositivos.

---

## Instalar como PWA en Android

1. Abrir la URL en Chrome
2. Menú (3 puntos) → **"Agregar a pantalla de inicio"**
3. La app aparece como ícono nativo

---

## Stack técnico

- **Frontend**: HTML + CSS + JavaScript vanilla (sin frameworks)
- **Base de datos**: Firebase Realtime Database
- **Deploy**: Vercel (o Firebase Hosting)
- **QR**: qrcodejs (CDN)
- **Fuentes**: Google Fonts (Bebas Neue, Oswald, Inter)
- **PWA**: manifest.json

No requiere Node.js, npm ni build process — es un sitio estático puro.
