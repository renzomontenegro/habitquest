# Sistema (Traza) - PWA de cuenta regresiva y peso

## Que es
PWA personal (un solo usuario). Desde la v5.00 hace solo dos cosas: **peso diario** y una
**cuenta regresiva hacia la meta mas proxima** (evento + fecha + peso objetivo). La presion
real viene de las **notificaciones push diarias**: "te quedan N dias, si hoy la cagas es un dia
menos". Stack: React + TypeScript + Vite + Tailwind CSS + Framer Motion.

Se elimino por completo el registro de comidas (foto + IA), entrenamiento, pasos, sueno,
cintura, puntuacion semanal y el onboarding de macros: el usuario no los usaba y lo unico que lo
motiva es el tiempo que falta y ver bajar el peso. **No volver a agregar campos de registro
nuevos** salvo que alimenten la cuenta regresiva o las notificaciones.

> Nota: el repo y la URL siguen llamandose "habitquest" por historia.

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
- **Certs TLS**: n8n sirve con `n8n/certs/n8n.crt` (Let's Encrypt de Tailscale, vence cada 3 meses).
  Renovacion: `sudo tailscale cert raspberrypi.tail4656aa.ts.net` y copiar el .crt/.key al mount
  (`/srv/dev-disk-by-uuid-5ba54928-353f-4fdf-8073-54befd939b8a/n8n/certs/`) + `docker compose restart`.
  Si el cert vence, iPhone/Gmail del navegador da "Load failed" en Safari (no es la VPN) y el MCP
  reporta `CERT_HAS_EXPIRED`.
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

### Workflows de IA (ya no se usan)
"Estimar Comida (IA)" (`5lwcNn83WTAqecLh`, webhooks `habitquest-estimate` y
`habitquest-suggest`) quedo huerfano desde la v5.00: la app ya no lo llama. Se puede
desactivar/borrar en n8n; la credential "Opencode GO API" (`Ik3mnm12LdnGwAcv`) tambien.

### Credenciales n8n
- `AQKgx9XV1nvU6bv0` — Header Auth PWA (Bearer token para webhooks)
- `Ik3mnm12LdnGwAcv` — Opencode GO API (httpHeaderAuth, key de la IA, solo en n8n)
- `mFap4LinpRbFmxIY` — n8n API Key (internal, para acceso a DataTable API)
- `egCycENJkHFji6p8` — Google Sheets OAuth2 (legacy, ya no se usa)

## MCP Config
El MCP de n8n se define en **dos archivos** y opencode manda sobre el otro:

- `opencode.json` (raiz, schema `mcp[name].command` + `environment`): el que usa **opencode**.
  Si esta presente, gana sobre `.mcp.json`.
- `.mcp.json` (schema `mcpServers[name].env`): lo usan otras tools (Claude Code, etc.).

> El paquete `n8n-mcp` trae un guard SSRF: bloquea IPs privadas/CGNAT (100.x de Tailscale)
> con `WEBHOOK_SECURITY_MODE=strict` (default). Sin eso el MCP muere con
> "SSRF protection: Private IP addresses not allowed" aunque la Mac si conecte.
> El fix es la env `WEBHOOK_SECURITY_MODE=permissive` en **ambos** (sobre todo en
> `opencode.json`). Cambiar env del MCP requiere cerrar opencode por completo
> (Cmd+Q): el proceso viejo queda vivo y se siguen usando sus vars.
> NOTA: `.mcp.json` usa `env`, `opencode.json` usa `environment`; cambiar solo uno
> decepciona.

## Modelo de datos (`src/types.ts`)
- `DayLog` — `{ date, weight? }`. Solo el peso en ayunas.
- `Goal` — `{ id, name, date, targetWeight }`. La meta mas proxima sin pasar manda
  (`nearestGoal`).
- `AppSettings` — `{ goals, startDate }`.
- `goalStatus()` (`logic.ts`) calcula dias que faltan, kg que faltan, kg/semana necesarios,
  ritmo real (promedio 7 dias vs 7 anteriores) y proyeccion.

`storage.sanitize` **descarta** todo lo que no sea peso/metas al cargar (comidas, pasos, sueno,
entrenos, macros de versiones anteriores). El respaldo en JSON de Ajustes sigue disponible.
Las filas viejas de la DataTable siguen existiendo (la API no borra), solo cambia que la app ya
no las lee.

## Arquitectura de Sync (`src/lib/sync.ts`)
La app **nunca se bloquea** por un fallo de red. Reglas:

- Debounce de 1.5 s con techo de 8 s: escribir sin parar igual guarda.
- Reconciliacion periodica (30 s, al volver a la app y al reconectar): trae la nube y la mezcla
  respetando las fechas en edicion (`sistema_pending`). Sin esto, dos dispositivos abiertos se
  pisaban enteros al guardar (el ultimo ganaba y podia borrar campos del mismo dia). Un guard
  de igualdad evita re-guardar cuando no cambio nada.
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

## Notificaciones push (el corazon de la app)
El service worker (`src/sw.ts`) maneja `push` y `notificationclick`. El cliente pide permiso,
obtiene la suscripcion y la registra con `registerPushSubscription()` contra
**POST `/webhook/habitquest-push`**.

Backend: workflow **"Sistema Push"** (`XI555krGiKbDvH4F`). Cron a las **8:00** y **20:00**
(hora Lima). El Code node "Preparar mensaje" (copia en `scripts/push-countdown.js`, hay que
mantenerlas iguales) lee el ultimo estado de la DataTable y:
- **8:00**: "Quedan N dias · <meta>" + frase rotativa ("Mañana seran N-1...", "Si hoy la cagas,
  es un dia menos...") + peso actual, kg que faltan, kg/semana necesarios vs ritmo real. Si hoy
  no te pesaste agrega "Pesate hoy"; si el ultimo pesaje tiene 3+ dias lo dice.
- **20:00**: solo si hoy no hubo pesaje ("Hoy no te pesaste").
- Sin meta proxima no manda nada.
El envio usa un Code node con Web Push manual (JWT ES256 + aes128gcm) y el par VAPID embebido
(`VAPID_PUBLIC`/`VAPID_PRIVATE` en el propio Code node "Enviar push"). El webhook
`sistema-push-send` manda un push a mano ({ title, body }); el boton "Push de prueba" de Ajustes
lo usa. Si se cambia el par VAPID en el frontend, actualizar AMBAS claves en ese Code node.

> Ojo: las claves VAPID viven DENTRO del Code node del workflow, no en una credencial de n8n.
> Ojo 2: n8n separa borrador y publicado; tras editar con el MCP verificar con
> `n8n_get_workflow mode=active`.

## Refresh
- **Tap en la pestana ya activa** → `refreshFromCloud()`
- **Pull-to-refresh** → `refreshFromCloud()` (ya no recarga la pagina: perdia el scroll)
- **Boton "Sincronizar ahora"** en Ajustes → `refreshFromCloud()`

## Archivos clave
- `src/types.ts` — modelo de datos (peso + metas)
- `src/lib/config.ts` — `APP_VERSION`, dias del grafico
- `src/lib/logic.ts` — fechas, `nearestGoal`, `goalStatus`, ritmo de peso
- `src/lib/storage.ts` — localStorage y `sanitize`
- `src/lib/sync.ts` — cola de guardado, reintentos, flush, registro de push
- `src/lib/notifications.ts` — permiso y suscripcion push
- `src/hooks/useAppState.ts` — estado global, `setWeight`, metas, merge offline
- `src/screens/HomeScreen.tsx` — cuenta regresiva, pesaje, grafico, metas y editor de meta
- `src/screens/SettingsSheet.tsx` — sync, actualizaciones, push, respaldo
- `src/components/ui.tsx` — BottomSheet, Stepper, SaveDot, Toast, ConfirmButton, WeightWheel
- `src/components/charts.tsx` — LineChart (SVG a mano; huecos, nunca ceros)
- `scripts/push-countdown.js` — copia del Code node de los mensajes push
- `src/styles.css` — tema, app shell, safe areas iOS

## Reglas de desarrollo
- **Versionado**: Despues de cada cambio, incrementar `APP_VERSION` en `src/lib/config.ts`.
  El usuario lo lee en Ajustes para verificar que el deploy se aplico.
- **Deploy**: Despues de cada cambio completado, hacer commit y `git push origin main` automaticamente, salvo que el usuario pida explicitamente no pushear. Vercel hace auto-deploy. NO usar `vercel` CLI.
- **Docker Compose en Pi**: para aplicar env vars nuevas usar `sudo docker compose up -d`
  (NO `restart`). Backup antes: `sudo cp docker-compose.yml docker-compose.yml.bak-$(date +%Y%m%d-%H%M)`.
- **VITE_ env vars son build-time**: cambiarlas en Vercel requiere redeploy.
- **No hacer POST de prueba al webhook**: sobreescribe el estado real. Para probar, leer con
  GET. OJO: con `VITE_SYNC_URL` en `.env`, abrir el dev server YA sube el estado a la nube (el
  efecto de persistencia guarda tras cargar). Para previsualizar sin tocar la nube, arrancar con
  `env VITE_SYNC_URL= VITE_SYNC_TOKEN= npm run dev`.
- **El grafico es SVG a mano**, no `recharts`. Un dia sin registro se dibuja **hueco**, nunca como un cero.
- **Errores inline y no bloqueantes**: mostrar el problema donde ocurre, sin deshabilitar la UI.
- **Cada campo que se pide debe usarse**: si un dato no alimenta la cuenta regresiva, el grafico
  o una notificacion, se elimina.
- **Nada del plan del usuario se escribe en el codigo**: las metas viven en `AppSettings`.
- **UI en espanol** (sin tildes en el codigo por consistencia).

## Problemas conocidos
- **Service Worker en iOS**: se actualiza lento en Safari/PWA standalone (hasta 24 h) y antes no
  se soltaba (faltaba el handler de `SKIP_WAITING`), por eso la app quedaba en la version
  cacheada. Ahora `usePWAUpdate()` registra el SW con modo prompt: cuando hay una version nueva
  aparece el banner "Actualizar" y al tocarlo aplica y recarga. Tambien hay "Buscar
  actualizaciones" en Ajustes, y "Forzar actualizacion" (`pwa.force()`) que borra las caches del
  SW, activa la version nueva y recarga: sirve desde cualquier version, incluso una vieja sin el
  banner. La app ademas revisa por versiones nuevas en cada apertura. Si aun asi aparece pantalla
  blanca tras un deploy, limpiar datos del sitio en Safari.
- **DataTable acumula filas**: cada save inserta una fila nueva (la API no soporta PATCH/DELETE).
  El load toma la mas reciente (`sortBy=updatedAt:desc&limit=1`). Limpiar periodicamente via MCP
  (`n8n_manage_datatable` action `deleteRows`).

## Skills de diseno UI/UX (ux-ui-agent-skills)
Este proyecto incluye el kit `ux-ui-agent-skills` (v2.4.0). Los skills viven en
`.claude/skills/` y sus recursos de apoyo en la raiz (`accessibility/`, `tokens/`, `taste/`,
`components/`, `workflows/`, `scripts/`, `frameworks/`, `design-systems/`, `content/`).
Para tareas de UI (componentes, tokens, a11y, review, microcopy) cargar el skill que
corresponda: `design-component`, `design-tokens`, `a11y-audit`, `design-review`, `ux-writing`,
`design-qa`, `redesign`, `apply-aesthetic`. **El CLAUDE.md del kit no esta instalado a
proposito**: este documento es la fuente de verdad del producto y no debe pisarse; los skills
referencian sus recursos por ruta relativa y funcionan sin el persona del kit.
