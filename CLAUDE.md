# Sistema - PWA de macros, peso y entrenamiento

## Que es
PWA personal (un solo usuario) para registrar comida por macros, peso, pasos, sueno y
entrenamiento de fuerza. Stack: React + TypeScript + Vite + Tailwind CSS + Framer Motion.

El objetivo de producto es **friccion minima al registrar**: agregar una comida debe costar
un tap. Todo lo que se le pide al usuario tiene que alimentar alguna decision o grafico; si un
campo no se lee en ningun lado, se elimina.

> Nota: el repo y la URL siguen llamandose "habitquest" por historia. La app ya no tiene XP,
> niveles, rachas, logros ni ligas: eso se elimino por completo.

## Deployment
- **Frontend**: Vercel (auto-deploy desde `main` en GitHub)
- **Repo**: `renzomontenegro/habitquest` en GitHub
- **URL**: https://habitquest-khaki.vercel.app
- **Env vars en Vercel** (build-time, prefijo `VITE_`):
  - `VITE_SYNC_URL` = URL del webhook de save (n8n)
  - `VITE_SYNC_TOKEN` = Bearer token para auth
  - `VITE_VAPID_PUBLIC_KEY` = clave publica para push

## Backend (n8n en Raspberry Pi)
- **SSH**: `ssh pi@100.114.111.15` (Tailscale) o `pi@192.168.18.36` (red local)
- **n8n URL**: https://raspberrypi.tail4656aa.ts.net:5678
- **n8n version**: 2.22.5
- **Docker Compose path**: `/srv/dev-disk-by-uuid-5ba54928-353f-4fdf-8073-54befd939b8a/n8n/`
- **Container**: `n8n-n8n-1`
- **HTTPS**: Cert de Tailscale, config en docker-compose.yml (NO tocar certs ni WEBHOOK_URL)
- **CORS**: `N8N_CORS_ALLOWED_ORIGINS=https://habitquest-khaki.vercel.app` en docker-compose.yml
- **Env vars van en el bloque `environment:` del compose** (NO en .env)

### Workflow: HabitQuest Sync (DataTable)
- **ID**: `SKgWUATLRuQsp8vt`
- **Webhooks** (los nombres siguen siendo los originales):
  - POST `/webhook/habitquest-save` — guarda estado completo
  - GET `/webhook/habitquest-load` — carga estado
- **Auth**: Bearer token via credential "Header Auth PWA" (id: `AQKgx9XV1nvU6bv0`)
- **Storage**: DataTable "HabitQuest State" (id: `T3kQZkvPbbdBZUk0`), columnas: key, data, lastUpdated
- **Nota**: La API publica de n8n 2.22 para DataTable rows solo soporta GET y POST (no PATCH/DELETE).
- **n8n API Key credential**: "n8n API Key (internal)" (id: `mFap4LinpRbFmxIY`), header `X-N8N-API-KEY`
- **API path correcto**: `/api/v1/data-tables/{id}/rows` (con guion, NO `/api/v1/datatable/`)

### Credenciales n8n
- `AQKgx9XV1nvU6bv0` — Header Auth PWA (Bearer token para webhooks)
- `mFap4LinpRbFmxIY` — n8n API Key (internal, para acceso a DataTable API)
- `egCycENJkHFji6p8` — Google Sheets OAuth2 (legacy, ya no se usa)

## MCP Config
El archivo `.mcp.json` en la raiz configura el MCP de n8n con la API key y URL.

## Modelo de datos (`src/types.ts`)

**La unidad de registro es la COMIDA, no el ingrediente.** Esto es una decision de producto
explicita: pesar arroz y pollo por separado es mas friccion, no menos. El usuario elige "Seco
de res" y esa opcion ya trae sus macros. No hay catalogo de alimentos ni composicion por
ingredientes; si alguna vez se reintroduce, tiene que ser *encima* de este modelo, nunca
reemplazandolo.

- `MealOption` — una opcion de comida con **sus propios macros** (`prot`/`carb`/`grasa` por
  porcion). `slots` dice en que comidas del dia aparece (puede estar en varias). `fav` la pone
  primero en el selector.
- `MealLog` — una comida registrada: `slot`, `optionId`, `portion` (1 = porcion normal) y
  `at`. Si fue algo fuera del plan, `optionId` es `null` y los macros van en `custom`.
- `DayLog` — `weight`, `steps`, `waist`, `bedTime`, `wakeTime`, `meals[]`,
  `workoutId` (id de `SplitDay`, `null` = descanso), `sets` (por **id** de ejercicio).
- `SplitDay` / `Exercise` — el split es **data editable por el usuario**, no constantes.
  `weekday` 0-6 fija el dia; `null` = solo aparece si se elige a mano.
- `AppSettings` — `targets`, `slotShare`, `options`, `split`, `sleepTarget`, `tolerance`,
  `startDate`, `setupDone`.

### El plan NO vive en el codigo
`config.ts` no contiene comidas ni rutina del usuario. Una instalacion nueva arranca con
`options: []` y `split: []`, y pasa por `SetupScreen` (solo objetivos). Todo lo demas se crea
desde Mi plan. Si algun dia hace falta un valor de plan nuevo, va a `AppSettings`, no a una
constante.

Lo que queda en `config.ts` es de dos tipos, separados a proposito:
- **Arranques neutros** (`DEFAULT_*`): el punto de partida antes del onboarding. No son un
  plan: son objetivos genericos y un reparto por comida, ambos editables.
- **`RULES`**: umbrales del algoritmo del veredicto y rangos de los graficos. Son reglas, no
  preferencias; viven juntas para que no haya numeros magicos sueltos en la logica.

No hay nombres de comidas en el codigo. La unica excepcion es `ROUTINE_TEMPLATE`: la rutina
Upper/Lower del usuario (4 dias: Upper A, Lower A, Upper B, Lower B), que **no se siembra** y
solo se materializa cuando toca "Cargar rutina" en Mi plan → Entrenamiento
(`loadRoutineTemplate()`). Se agrega a lo que ya exista, saltando los dias cuyo nombre ya este,
asi que tocarlo dos veces no duplica.

Los ejercicios de la plantilla usan **el nombre como id** a proposito: el historial de series
del modelo viejo estaba indexado por nombre, asi que cargarla reconecta esos pesos. El efecto
secundario es que un ejercicio repetido en dos dias (Cable Row en Upper y Pull) comparte id e
historial; `strengthDrops()` lo deduplica.

`slotReference(settings, slot)` deriva los macros de referencia de una comida como
`targets × slotShare[slot]`. Es lo que precarga una opcion nueva y un "comi otra cosa", asi
que sale de los numeros del usuario. `slotShare` es editable en Mi plan → Objetivo diario.

Cuando un texto de la UI menciona un umbral (p. ej. "±12%"), debe leerlo del ajuste, nunca
repetirlo escrito: si no, se desincroniza en cuanto el usuario lo cambia.

### Que pasa con el estado del modelo viejo
`storage.ts` **no reconstruye el plan** a partir del formato anterior. Se conserva solo lo que
eran numeros reales escritos por el usuario:

- Se conservan: `weight`, `steps`, `waist`, `bedTime`, `wakeTime` y `sets`.
- Se descartan: `recipeLists` / `selectedRecipes` (la rutina y las recetas estaban quemadas en
  el codigo, no las eligio el usuario), `meals` en formato `'sí'/'otra'/'no'` (no tenian macros
  detras), `mealSeverity`, `carbSources`, `walkAfterLunch`, `sugaryOrAlcohol` y `lastMealTime`.
- `setupDone` solo es true si se definio en esta version, asi que un estado viejo pasa por el
  onboarding y arranca con Mis comidas y Entrenamiento vacios.
- Las series viejas quedan indexadas por **nombre** de ejercicio. Vuelven a aparecer en cuanto
  se cree un ejercicio con ese mismo nombre; hasta entonces siguen guardadas sin mostrarse.

No hay constantes `LEGACY_*`: sembrar el plan viejo era exactamente el hardcodeo que habia
que eliminar.

### Purga de la siembra de las versiones 2.0-2.2
Esas versiones si sembraban comidas y rutina de ejemplo, y **eso quedo guardado en el estado
del usuario y en la DataTable**. Quitar las constantes del codigo no las borra: `sanitize` ya
las lee como datos suyos. Por eso `isSeededId()` las descarta al cargar.

La regla es el id: la app los escribia a mano con guion bajo (`o_muffins`, `s_upper`,
`e_bench`), mientras que `uid()` genera `<prefijo><base36><random>` sin guion bajo. Nada
creado por el usuario cae en el filtro. **Si algun dia se generan ids con guion bajo, esta
purga empezaria a borrar datos reales.**

Ajustes tiene ademas "Vaciar mi plan" (`clearPlan()`), que limpia `options` y `split` sin
tocar `records`.

## Arquitectura de Sync (`src/lib/sync.ts`)
La app **nunca se bloquea** por un fallo de red. Reglas:

- Debounce de 1.5 s con techo de 8 s: escribir sin parar igual guarda.
- Un fallo **no descarta el cambio**: queda en cola y se reintenta con backoff (4/10/30/60 s).
- `flushSave()` con `keepalive: true` en `pagehide` y `visibilitychange` — iOS mata los timers
  al mandar la PWA a segundo plano y sin esto se perdia el ultimo dato escrito.
- `subscribeSync()` expone el estado (`idle`/`pending`/`saving`/`saved`/`error`) al indicador
  de la cabecera. El usuario siempre ve si su dato esta a salvo.

### Offline y merge (`src/hooks/useAppState.ts`)
- Si el **load** inicial falla, `cloudReady` queda en false: se registra igual, todo va a
  localStorage, y NO se sube nada (para no pisar la nube con un estado incompleto).
- Las fechas editadas offline se marcan en `localStorage['sistema_pending']`.
- Al reconectar, `mergeStates` toma la nube como base y **gana lo local solo en las fechas
  marcadas**. Luego se sube. Las marcas se limpian cuando la nube confirma.

## Notificaciones push
El service worker (`src/sw.ts`) ya maneja `push` y `notificationclick`. El cliente pide
permiso, obtiene la suscripcion y la registra con `registerPushSubscription()` contra
**POST `/webhook/habitquest-push`**.

El backend ya existe: el workflow **"Sistema Push"** (`XI555krGiKbDvH4F`) registra la
suscripcion (webhook `habitquest-push`, upsert en DataTable `e1410wlZvquWmkLD` con key
`push_sub`) y envía recordatorios con un Cron a las **9:00, 12:00 y 21:00**. El envio usa un
Code node con la implementacion manual del protocolo Web Push (JWT ES256 + aes128gcm) con el
par VAPID embebido (`VAPID_PUBLIC`/`VAPID_PRIVATE` en el propio Code node). El webhook
`sistema-push-send` permite enviar a mano para probar. Si se cambia el par VAPID en el
frontend, hay que actualizar AMBAS claves en ese Code node.

> Ojo: las claves VAPID viven DENTRO del Code node del workflow, no en una credencial de n8n.

## Refresh
- **Tap en la pestana ya activa** → `refreshFromCloud()`
- **Pull-to-refresh** → `refreshFromCloud()` (ya no recarga la pagina: perdia el scroll)
- **Boton "Sincronizar ahora"** en Ajustes → `refreshFromCloud()`

## Archivos clave
- `src/types.ts` — modelo de datos
- `src/lib/config.ts` — `APP_VERSION`, slots, `SLOT_REFERENCE` + semillas (opciones, split, targets)
- `src/lib/logic.ts` — fechas, sumas de macros, adherencia, veredicto, helpers de split
- `src/lib/storage.ts` — localStorage, `sanitize` y la migracion del modelo viejo
- `src/lib/sync.ts` — cola de guardado, reintentos, flush
- `src/hooks/useAppState.ts` — estado global, acciones, merge offline (`AppController`)
- `src/components/ui.tsx` — BottomSheet, Stepper, MacroBar, SaveDot, Toast, ConfirmButton
- `src/components/MealPicker.tsx` — el selector: un tap registra la comida
- `src/components/charts.tsx` — LineChart, DayBars, PaceBar, Stat (SVG a mano)
- `src/screens/` — SetupScreen (primer arranque), TodayScreen, WeekScreen, PlanScreen, SettingsSheet
- `src/styles.css` — tema, app shell, safe areas iOS

## Reglas de desarrollo
- **Versionado**: Despues de cada cambio, incrementar `APP_VERSION` en `src/lib/config.ts`.
  El usuario lo lee en Ajustes para verificar que el deploy se aplico.
- **Deploy**: Solo `git push origin main`. Vercel hace auto-deploy. NO usar `vercel` CLI.
- **Docker Compose en Pi**: para aplicar env vars nuevas usar `sudo docker compose up -d`
  (NO `restart`). Backup antes: `sudo cp docker-compose.yml docker-compose.yml.bak-$(date +%Y%m%d-%H%M)`.
- **VITE_ env vars son build-time**: cambiarlas en Vercel requiere redeploy.
- **No hacer POST de prueba al webhook**: sobreescribe el estado real. Para probar, leer con
  GET. En local el sync queda desactivado solo si NO existe `VITE_SYNC_URL` en `.env`.
- **Los graficos son SVG a mano**, no `recharts`: el lenguaje visual es mono + hairlines y las
  librerias genericas no encajan. Un dia sin registro se dibuja **hueco**, nunca como un cero.
- **Errores inline y no bloqueantes**: mostrar el problema donde ocurre, sin deshabilitar la UI.
- **Cada campo que se pide debe usarse**: si un dato del registro diario no alimenta un calculo
  ni un grafico, se elimina. Es la regla que mata la friccion.
- **Registrar una comida = un tap.** Cualquier cambio que agregue pasos (elegir ingredientes,
  pesar, confirmar) va en contra del objetivo del producto. La porcion y "comi otra cosa" son
  atajos opcionales, nunca pasos obligatorios.
- **Nada del plan del usuario se escribe en el codigo.** Si aparece la tentacion de poner una
  comida, una rutina o un objetivo "por defecto" en `config.ts`, va en `AppSettings` y se
  edita desde la app. Sin excepciones: tampoco "de ejemplo" ni "para migrar".
- **UI en espanol** (sin tildes en el codigo por consistencia).

## Problemas conocidos
- **Service Worker en iOS**: se actualiza lento en Safari/PWA standalone (hasta 24 h) y antes no
  se soltaba (faltaba el handler de `SKIP_WAITING`), por eso la app quedaba en la version
  cacheada. Ahora `usePWAUpdate()` registra el SW con modo prompt: cuando hay una version nueva
  aparece el banner "Actualizar" y al tocarlo aplica y recarga. Tambien hay "Buscar
  actualizaciones" en Ajustes. Si aun asi aparece pantalla blanca tras un deploy, limpiar
  datos del sitio en Safari.
- **DataTable acumula filas**: cada save inserta una fila nueva (la API no soporta PATCH/DELETE).
  El load toma la mas reciente (`sortBy=updatedAt:desc&limit=1`). Limpiar periodicamente via MCP
  (`n8n_manage_datatable` action `deleteRows`).
- **Nombres de ejercicio repetidos en la migracion**: si un ejercicio existia en dos dias del
  split viejo (p. ej. "Cable Row" en Upper y Pull), sus series historicas se atribuyen al primero.
  No habia forma de desambiguar.

## Skills de diseno UI/UX (ux-ui-agent-skills)
Este proyecto incluye el kit `ux-ui-agent-skills` (v2.4.0). Los skills viven en
`.claude/skills/` y sus recursos de apoyo en la raiz (`accessibility/`, `tokens/`, `taste/`,
`components/`, `workflows/`, `scripts/`, `frameworks/`, `design-systems/`, `content/`).
Para tareas de UI (componentes, tokens, a11y, review, microcopy) cargar el skill que
corresponda: `design-component`, `design-tokens`, `a11y-audit`, `design-review`, `ux-writing`,
`design-qa`, `redesign`, `apply-aesthetic`. **El CLAUDE.md del kit no esta instalado a
proposito**: este documento es la fuente de verdad del producto y no debe pisarse; los skills
referencian sus recursos por ruta relativa y funcionan sin el persona del kit.
