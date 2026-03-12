# Sentinel Demo — Guía de Deploy

## Estructura del proyecto

```
sentinel-demo/
├── index.html
├── package.json
├── vite.config.js
└── src/
    ├── main.jsx
    └── App.jsx        ← toda la lógica de Sentinel
```

---

## Opción A — Vercel (RECOMENDADO, 100% gratis, URL pública en 2 min)

### Paso 1 — Subir a GitHub

1. Entrá a **github.com** → "New repository"
2. Nombre: `sentinel-demo` → Create
3. En tu computadora, abrí una terminal en la carpeta del proyecto:

```bash
git init
git add .
git commit -m "Sentinel v2.0"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/sentinel-demo.git
git push -u origin main
```

### Paso 2 — Deploy en Vercel

1. Entrá a **vercel.com** → "Sign up with GitHub"
2. Click en **"Add New Project"**
3. Importá el repo `sentinel-demo`
4. Vercel detecta Vite automáticamente — click **"Deploy"**
5. En ~60 segundos obtenés una URL tipo:

```
https://sentinel-demo-tuusuario.vercel.app
```

¡Eso es todo! Compartís esa URL con el cliente.

---

## Opción B — Netlify (también gratis)

1. Entrá a **netlify.com** → "Sign up"
2. "Add new site" → "Import from Git" → conectá GitHub
3. Build command: `npm run build`
4. Publish directory: `dist`
5. Click Deploy → URL pública lista

---

## Opción C — Probar en local primero

```bash
# En la carpeta del proyecto:
npm install
npm run dev
# → http://localhost:5173
```

---

## ¿Cómo usa la demo el cliente?

1. El cliente entra a la URL
2. Ve la pantalla de **Groq API Key**
3. Va a **console.groq.com** → se registra gratis (solo email) → copia su key
4. Pega la key en Sentinel → click "Conectar"
5. Hace login con:
   - `retailco / client123` para ver el módulo de cliente
   - `admin / admin123` para ver el panel completo
   - `guest / guest` para el chat general

---

## Alternativa: Key de Groq pre-cargada (para demos sin fricción)

Si querés que el cliente **no tenga que generar su propia key** y entre directo al login,
podés hardcodear una key tuya en `src/App.jsx`:

Buscá la línea:
```javascript
const [groqKey, setGroqKey] = useState("");
```

Y cambiala por:
```javascript
const [groqKey, setGroqKey] = useState("gsk_TU_KEY_AQUI");
```

Así el cliente entra directo al login sin configuración.
⚠️ Usá esto solo para demos controladas — la key queda expuesta en el código.
