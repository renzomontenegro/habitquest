# HabitQuest - PWA Gamificada de Habitos

## Que es
PWA tipo Duolingo para tracking de habitos y metas, con sistema de XP, niveles, rachas, logros y ligas semanales. Stack: React + TypeScript + Vite + Tailwind CSS + Framer Motion.

## Deployment
- **Frontend**: Vercel (auto-deploy desde `main` en GitHub)
- **Repo**: `renzomontenegro/habitquest` en GitHub
- **URL**: https://habitquest-khaki.vercel.app
- **Env vars en Vercel** (build-time, prefijo `VITE_`):
  - `VITE_SYNC_URL` = URL del webhook de save (n8n)
  - `VITE_SYNC_TOKEN` = Bearer token para auth

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
- **Webhooks**:
  - POST `/webhook/habitquest-save` — guarda estado completo
  - GET `/webhook/habitquest-load` — carga estado
- **Auth**: Bearer token `hq_sync_2026_X9kMvPnR4wLjT8sQ` via credential "Header Auth PWA" (id: `AQKgx9XV1nvU6bv0`)
- **Storage**: DataTable "HabitQuest State" (id: `T3kQZkvPbbdBZUk0`), columnas: key, data, lastUpdated
- **Nota**: La API publica de n8n 2.22 para DataTable rows solo soporta GET y POST (no PATCH/DELETE). El workflow usa Code nodes con la n8n internal API para operaciones avanzadas.
- **n8n API Key credential**: "n8n API Key (internal)" (id: `mFap4LinpRbFmxIY`), header `X-N8N-API-KEY`
- **API path correcto**: `/api/v1/data-tables/{id}/rows` (con guion, NO `/api/v1/datatable/`)

### Credenciales n8n
- `AQKgx9XV1nvU6bv0` — Header Auth PWA (Bearer token para webhooks)
- `mFap4LinpRbFmxIY` — n8n API Key (internal, para acceso a DataTable API)
- `egCycENJkHFji6p8` — Google Sheets OAuth2 (legacy, ya no se usa para HabitQuest)

## MCP Config
El archivo `.mcp.json` en la raiz del proyecto configura el MCP de n8n con la API key y URL.

## Arquitectura de Sync (cloud-only)
- **No hay modo offline funcional**: si el backend no responde, la UI se bloquea (pointer-events-none + opacity)
- `src/lib/sync.ts` — lee `VITE_SYNC_URL` y `VITE_SYNC_TOKEN` de env vars en build time (NO de localStorage)
- `src/hooks/useAppState.ts` — al montar, carga de la nube; en cada cambio de estado, debounced save (3s) a la nube
- `src/lib/storage.ts` — localStorage es solo cache para carga inicial rapida
- Errores de red se mapean a mensajes amigables (ej: "Sin conexion a Tailscale. Activa la VPN para sincronizar.")
- El iPhone debe tener Tailscale activo para que la PWA pueda alcanzar el webhook en la Pi

## Refresh
- **Tap en "Hoy" estando en Hoy** → `refreshFromCloud()` (sync datos)
- **Pull-to-refresh** (tirar hacia abajo) → `window.location.reload()` (recarga completa)
- **Boton "Refrescar" en Ajustes** → `window.location.reload()`

## Archivos clave
- `src/hooks/useAppState.ts` — estado global, logica de XP/rachas/logros, sync
- `src/lib/sync.ts` — fetch al backend (save/load/debounce), mapeo de errores
- `src/lib/storage.ts` — localStorage cache + defaults
- `src/types.ts` — tipos TypeScript (AppState, Habit, Goal, etc.)
- `src/components/BottomNav.tsx` — tab bar (orden: Stats, Metas, Hoy, Ajustes)
- `src/screens/` — TodayScreen, GoalsScreen, StatsScreen, SettingsScreen
- `src/styles.css` — app shell CSS, safe areas iOS, botones 3D
- `vite.config.ts` — PWA config (registerType: autoUpdate)
- `index.html` — viewport-fit=cover, apple-mobile-web-app-capable

## Problemas conocidos
- **Service Worker en iOS**: el SW se actualiza lento en Safari/PWA standalone (hasta 24h). Si la app muestra pantalla blanca despues de un deploy, hay que limpiar datos del sitio en Safari.
- **Bottom nav safe area**: el tab bar usa `position: fixed; bottom: 0` con `padding-bottom: env(safe-area-inset-bottom)` pero en iOS PWA standalone puede no bajar hasta el borde absoluto — esto es una limitacion de WebKit.
- **DataTable acumula filas**: cada save inserta una nueva fila (la API no soporta PATCH/DELETE). El load toma la mas reciente (`sortBy=updatedAt:desc&limit=1`). Limpiar filas viejas periodicamente via MCP (`n8n_manage_datatable` action `deleteRows`).
