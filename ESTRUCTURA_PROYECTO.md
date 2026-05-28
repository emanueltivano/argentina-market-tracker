# Estructura del proyecto

## Índice

- [1. Resumen general](#1-resumen-general)
- [2. Árbol general de carpetas](#2-árbol-general-de-carpetas)
- [3. Mapa rápido para nuevos desarrolladores](#3-mapa-rápido-para-nuevos-desarrolladores)
- [4. Reglas importantes de arquitectura](#4-reglas-importantes-de-arquitectura)
- [5. Explicación de carpetas principales](#5-explicación-de-carpetas-principales)
- [6. Arquitectura y flujo de datos](#6-arquitectura-y-flujo-de-datos)
- [7. Guía rápida de cambios comunes](#7-guía-rápida-de-cambios-comunes)
- [8. Archivos clave de la raíz](#8-archivos-clave-de-la-raíz)
- [9. Scripts disponibles](#9-scripts-disponibles)
- [10. Dependencias importantes](#10-dependencias-importantes)
- [11. Convenciones del proyecto](#11-convenciones-del-proyecto)
- [12. Notas útiles para mantenimiento](#12-notas-útiles-para-mantenimiento)

## 1. Resumen general

`argentina-market-tracker` es una aplicación full-stack con Next.js App Router, React y TypeScript estricto. El proyecto está pensado como dashboard demo/portfolio sobre mercado argentino: el navegador consume rutas internas de Next.js y esas rutas validan, normalizan y protegen el acceso a datos demo o a un proveedor externo.

No es una plataforma real de trading. El repositorio busca mostrar SSR inicial, revalidación cliente con SWR, contratos validados, cachés en memoria, rate limiting, observabilidad y cobertura automatizada con Vitest y Playwright.

## 2. Árbol general de carpetas

```txt
argentina-market-tracker/
├─ .github/
│  └─ workflows/
│     └─ ci.yml
├─ docs/
│  ├─ RUNBOOK.md
│  ├─ issues.md
│  └─ screenshots/
├─ e2e/
│  ├─ dashboard.spec.ts
│  └─ dashboard-ssr.spec.ts
├─ public/
│  ├─ favicon.svg
│  └─ og-image.svg
├─ scripts/
│  ├─ run-e2e.mjs
│  └─ run-e2e-suite.mjs
├─ src/
│  ├─ app/
│  │  ├─ about/
│  │  ├─ api/
│  │  │  ├─ debug/metrics/
│  │  │  ├─ favorites/
│  │  │  ├─ health/
│  │  │  ├─ panel/
│  │  │  ├─ stocks/[symbol]/history/
│  │  │  └─ token/
│  │  ├─ dashboard/
│  │  │  ├─ components/
│  │  │  ├─ hooks/
│  │  │  └─ lib/
│  │  ├─ error.tsx
│  │  ├─ global-error.tsx
│  │  ├─ globals.css
│  │  ├─ layout.tsx
│  │  ├─ not-found.tsx
│  │  └─ page.tsx
│  ├─ lib/
│  │  ├─ server/
│  │  ├─ favorites.ts
│  │  ├─ formatters.ts
│  │  ├─ market.ts
│  │  ├─ panel.ts
│  │  ├─ stockHistory.ts
│  │  └─ theme.ts
│  ├─ styles/
│  └─ test/
├─ .env.local.example
├─ AGENTS.md
├─ middleware.ts
├─ next.config.mjs
├─ next.config.test.ts
├─ package.json
├─ playwright.config.ts
├─ README.md
├─ tailwind.config.ts
├─ tsconfig.json
└─ vitest.config.ts
```

## 3. Mapa rápido para nuevos desarrolladores

### Entender la app completa

Revisar primero:

- `README.md`
- `src/app/page.tsx`
- `src/app/dashboard/components/Panel.tsx`
- `src/app/api/panel/route.ts`
- `src/lib/panel.ts`
- `src/lib/server/panelCache.ts`
- `src/lib/server/iol.ts`

Con eso se entiende el flujo principal: SSR inicial, BFF interno, contrato compartido, caché y fetch upstream.

### Cambiar UI del dashboard

Revisar primero:

- `src/app/dashboard/components/Panel.tsx`
- `src/app/dashboard/components/PanelContent.tsx`
- `src/app/dashboard/components/StockTable.tsx`
- `src/app/dashboard/components/Stock.tsx`
- `src/app/dashboard/hooks/useMarketPanel.ts`
- `src/app/globals.css`

Si el cambio toca estados de carga, error, empty o stale, revisar también `src/app/dashboard/lib/panelState.ts` y tests vecinos de componentes.

### Cambiar endpoints internos

Revisar primero:

- `src/app/api/panel/route.ts`
- `src/app/api/favorites/route.ts`
- `src/app/api/stocks/[symbol]/history/route.ts`
- `src/app/api/health/route.ts`
- `src/app/api/debug/metrics/route.ts`
- `src/app/api/token/route.ts`

Después mirar los helpers usados por cada route en `src/lib/server/**` y los contratos en `src/lib/**`.

### Cambiar integración con proveedor externo

Revisar primero:

- `src/lib/server/iol.ts`
- `src/lib/server/env.ts`
- `src/lib/server/panelEndpoint.ts`
- `src/lib/server/historyEndpoint.ts`
- `src/lib/server/quoteEndpoint.ts`
- `src/lib/server/demoMarketData.ts`

Si cambia payload o endpoint upstream, revisar también `src/lib/panel.ts`, `src/lib/stockHistory.ts`, `src/lib/favorites.ts` y los tests asociados.

### Cambiar favoritos

Revisar primero:

- `src/app/dashboard/hooks/useFavoriteStocks.ts`
- `src/app/dashboard/hooks/useFavoritePanel.ts`
- `src/app/api/favorites/route.ts`
- `src/lib/favorites.ts`
- `src/lib/server/favoritesRequest.ts`
- `src/lib/server/favoritesService.ts`
- `src/lib/server/favoritesRateLimit.ts`

Ese flujo mezcla estado local (`localStorage`), validación de request y fan-out server-side.

### Cambiar histórico

Revisar primero:

- `src/app/dashboard/components/StockDetailsModal.tsx`
- `src/app/dashboard/components/LightweightStockChart.tsx`
- `src/app/dashboard/hooks/useStockHistory.ts`
- `src/app/api/stocks/[symbol]/history/route.ts`
- `src/lib/stockHistory.ts`
- `src/lib/server/historyRequest.ts`
- `src/lib/server/historyService.ts`
- `src/lib/server/historyCache.ts`

### Cambiar seguridad o CSP

Revisar primero:

- `middleware.ts`
- `next.config.mjs`
- `next.config.test.ts`
- `src/app/layout.tsx`
- `src/lib/server/debug.ts`

`middleware.ts` maneja CSP por request y nonce; `next.config.mjs` agrega headers globales.

### Cambiar tests o CI

Revisar primero:

- `.github/workflows/ci.yml`
- `package.json`
- `vitest.config.ts`
- `playwright.config.ts`
- `scripts/run-e2e.mjs`
- `scripts/run-e2e-suite.mjs`

Después ir a los tests co-localizados del área afectada: `*.test.ts` y `*.test.tsx`.

## 4. Reglas importantes de arquitectura

- El frontend no debe llamar directamente al proveedor externo. Todo acceso remoto va por `src/app/api/**`.
- Los contratos compartidos, tipos y normalizadores que cruzan UI/BFF deben vivir en `src/lib/**`.
- La lógica sensible del servidor debe vivir en `src/lib/server/**`. Ahí van credenciales, OAuth, cachés, rate limiting y acceso upstream.
- Los route handlers deben validar inputs antes de procesarlos. En este repo eso suele pasar con helpers como `panelRequest.ts`, `favoritesRequest.ts` e `historyRequest.ts`.
- Si cambia un payload upstream o un contrato del BFF, hay que actualizar normalizadores, consumidores y tests en el mismo cambio.
- Los endpoints debug deben seguir protegidos. `ENABLE_TOKEN_DEBUG` y `OBSERVABILITY_DEBUG_TOKEN` no se deben relajar sin revisar host permitido, entorno y exposición.
- Mantener `runtime = 'nodejs'` en handlers que dependen de integración server-side.
- No duplicar tipos ya existentes en `src/lib/market.ts`, `src/lib/panel.ts`, `src/lib/stockHistory.ts` o `src/lib/favorites.ts`.
- La UI debe consumir datos ya validados. No conviene empujar payloads upstream crudos hasta componentes.

## 5. Explicación de carpetas principales

### `.github/`

Contiene la automatización de CI.

- `.github/workflows/ci.yml` ejecuta `npm ci`, instala Chromium para Playwright y corre `npm run validate`.
- La validación de CI fuerza `MARKET_DATA_SOURCE=demo` y usa `NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3100`.

### `docs/`

Documentación operativa y material de soporte.

- `docs/RUNBOOK.md` documenta health checks, degradación, métricas y fallback entre demo/live.
- `docs/issues.md` funciona como registro auxiliar de notas o pendientes.
- `docs/screenshots/` contiene capturas para documentación y README.

### `e2e/`

Tests end-to-end con Playwright.

- `dashboard.spec.ts` cubre interacción principal del dashboard.
- `dashboard-ssr.spec.ts` cubre arranque SSR y render inicial.

### `scripts/`

Scripts Node para orquestar E2E.

- `run-e2e.mjs` levanta `next start` en puerto `3100`, espera disponibilidad y luego ejecuta Playwright.
- `run-e2e-suite.mjs` corre la suite SSR y luego la suite interactiva.

### `src/app/`

Es la capa App Router de Next.js: páginas, layout, estilos globales y route handlers internos.

- `page.tsx` hace SSR del panel inicial y pasa `initialData` al dashboard cliente.
- `layout.tsx` define metadata, estructura HTML y bootstrap de tema.
- `globals.css` concentra estilos globales.
- `error.tsx`, `global-error.tsx` y `not-found.tsx` manejan estados de error.
- `about/page.tsx` agrega una página estática de contexto del proyecto.

### `src/app/api/`

Es el BFF interno consumido por el browser.

- `panel/route.ts`: paneles `lider`, `general` y `cedears`, con validación, caché, rate limit, cooldown de refresh y modo demo/live.
- `favorites/route.ts`: valida favoritos y delega lookup fan-out al servicio server-side.
- `stocks/[symbol]/history/route.ts`: valida símbolo/rango/mercado y devuelve histórico con caché y fallback stale.
- `health/route.ts`: estado operativo y checks de configuración.
- `debug/metrics/route.ts`: métricas agregadas y datos de runtime; en producción depende de `OBSERVABILITY_DEBUG_TOKEN`.
- `token/route.ts`: debug local del token OAuth, con restricciones de entorno/host.

### `src/app/dashboard/`

Contiene la UI cliente del dashboard.

- `components/`: componentes visuales y de interacción.
- `hooks/`: fetching, estado local y comportamiento de UI.
- `lib/`: helpers específicos del dashboard, como sorting, panel state y mapeos a filas.

Archivos centrales:

- `components/Panel.tsx`: orquestador principal de la UI.
- `components/PanelContent.tsx`: shell visual, menú, acciones y theme toggle.
- `components/StockDetailsModal.tsx`: modal cargado dinámicamente con detalle e histórico.
- `hooks/useMarketPanel.ts`: SWR del panel de mercado.
- `hooks/useFavoritePanel.ts`: SWR del panel de favoritos.
- `hooks/useFavoriteStocks.ts`: persistencia local de favoritos y snapshots.
- `hooks/useStockHistory.ts`: SWR del histórico del modal.

### `src/lib/`

Contratos compartidos y utilidades comunes.

- `market.ts`: claves de panel y helpers asociados.
- `panel.ts`: contrato del panel, errores y normalización de payloads.
- `stockHistory.ts`: contrato del histórico, rangos válidos y normalización.
- `favorites.ts`: tipos y validación del flujo de favoritos.
- `formatters.ts`: formateo de moneda, enteros y porcentajes.
- `theme.ts`: nombres de cookie y storage, más el tipo `Theme`.

### `src/lib/server/`

Lógica server-only e integración externa.

- `env.ts`: normaliza variables de entorno y resume el runtime.
- `iol.ts`: cliente upstream con OAuth, timeout, retry único sobre `401/403` y `cache: 'no-store'`.
- `panelCache.ts`, `historyCache.ts`, `quoteCache.ts`, `tokenCache.ts`: cachés en memoria y deduplicación in-flight.
- `panelLimits.ts`, `historyRateLimit.ts`, `favoritesRateLimit.ts`, `rateLimit.ts`: rate limiting y cooldowns.
- `panelRequest.ts`, `historyRequest.ts`, `favoritesRequest.ts`: parsing y validación de inputs para handlers.
- `panelResponse.ts`, `historyResponse.ts`: helpers de respuestas tipadas.
- `historyService.ts`, `favoritesService.ts`: orquestación server-side de flujos de histórico y favoritos.
- `panelEndpoint.ts`, `historyEndpoint.ts`, `quoteEndpoint.ts`: resolución de endpoints upstream.
- `demoMarketData.ts`: dataset determinístico para modo demo.
- `observability.ts`: métricas, request IDs, logging y sanitización.
- `debug.ts`: reglas de protección para endpoints de debug.

### `src/test/`

Utilidades de test.

- `server-only.ts` reemplaza el módulo `server-only` en Vitest para poder importar código server-only en pruebas.

### `src/styles/`

Existe en el árbol, pero en el estado actual no concentra la hoja global principal. Los estilos globales activos están en `src/app/globals.css`.

## 6. Arquitectura y flujo de datos

### Flujo principal del dashboard

1. El usuario abre `/`.
2. `src/app/page.tsx` resuelve panel inicial y tema.
3. Si el prefetch SSR no está deshabilitado, llama a `getOrCreatePanelResponse`.
4. `src/lib/server/panelCache.ts` decide si servir cache, demo o fetch live.
5. Si hace falta fetch live, `src/lib/server/iol.ts` llama al proveedor externo.
6. `src/lib/panel.ts` normaliza el payload antes de llegar a UI.
7. `Panel.tsx` hidrata el dashboard cliente con `initialData`.
8. `useMarketPanel.ts` revalida `/api/panel?type=...` con SWR.

### Flujo del histórico

1. El usuario abre el detalle de una acción.
2. `StockDetailsModal.tsx` usa `useStockHistory`.
3. Ese hook consulta `/api/stocks/[symbol]/history`.
4. `src/app/api/stocks/[symbol]/history/route.ts` valida parámetros con `historyRequest.ts`.
5. `historyService.ts` resuelve datos demo/live, normaliza, cachea y puede devolver fallback stale.
6. `LightweightStockChart.tsx` renderiza la serie.

### Flujo de favoritos

1. El usuario marca favoritos desde tabla o modal.
2. `useFavoriteStocks.ts` persiste favoritos y snapshots en `localStorage`.
3. `useFavoritePanel.ts` consulta `/api/favorites`.
4. `src/app/api/favorites/route.ts` valida items con `favoritesRequest.ts`.
5. `favoritesService.ts` hace fan-out por símbolo con concurrencia acotada y caché.
6. La UI puede mezclar resultados frescos con snapshots locales stale.

## 7. Guía rápida de cambios comunes

### Cómo agregar un nuevo panel de mercado

Archivos probables a tocar:

- `src/lib/market.ts`
- `src/lib/panel.ts`
- `src/lib/server/panelEndpoint.ts`
- `src/lib/server/demoMarketData.ts`
- `src/app/api/panel/route.ts`
- `src/app/dashboard/lib/marketPanelOptions.ts`
- `src/app/dashboard/hooks/useMarketPanel.ts`
- `src/app/dashboard/components/PanelMenu.tsx`
- `src/app/page.tsx`

Archivos que conviene revisar antes:

- `src/lib/server/panelCache.ts`
- `src/lib/server/panelRequest.ts`
- `src/app/dashboard/lib/panelState.ts`
- `src/app/dashboard/components/Panel.tsx`

Tests a actualizar o agregar:

- `src/lib/panel.test.ts`
- `src/lib/market.test.ts`
- `src/app/api/panel/route.test.ts`
- `src/app/dashboard/components/PanelMenu.test.tsx`
- `src/app/dashboard/components/Panel.test.tsx`
- `src/app/dashboard/hooks/useMarketPanel.test.ts`

Riesgos:

- romper validación del tipo de panel
- olvidar soporte en modo demo
- desalinear contrato SSR inicial y fetch cliente
- omitir cooldown/rate limit del refresh manual

### Cómo agregar una nueva API route

Archivos probables a tocar:

- `src/app/api/<nueva-ruta>/route.ts`
- `src/lib/<contrato>.ts` o `src/lib/server/<request>.ts`
- `src/lib/server/<service>.ts` si hay lógica server-side

Archivos que conviene revisar antes:

- `src/app/api/panel/route.ts`
- `src/app/api/favorites/route.ts`
- `src/app/api/stocks/[symbol]/history/route.ts`
- `src/lib/server/observability.ts`
- `src/lib/server/rateLimit.ts`

Tests a actualizar o agregar:

- `src/app/api/<nueva-ruta>/route.test.ts`
- tests de contrato compartido en `src/lib/**`
- tests de servicio si la lógica vive en `src/lib/server/**`

Riesgos:

- exponer credenciales o payloads no sanitizados
- no validar inputs
- duplicar contratos ya existentes
- olvidar `runtime = 'nodejs'` si depende de integración server-side

### Cómo agregar un nuevo componente del dashboard

Archivos probables a tocar:

- `src/app/dashboard/components/<NuevoComponente>.tsx`
- `src/app/dashboard/components/Panel.tsx` o `PanelContent.tsx`
- `src/app/dashboard/hooks/*` si necesita estado o fetch
- `src/app/dashboard/lib/*` si necesita helpers propios

Archivos que conviene revisar antes:

- `src/app/dashboard/components/StockTable.tsx`
- `src/app/dashboard/components/PanelContent.tsx`
- `src/app/dashboard/components/PanelLoadingSkeleton.tsx`
- `src/app/dashboard/lib/panelState.ts`

Tests a actualizar o agregar:

- `src/app/dashboard/components/<NuevoComponente>.test.tsx`
- tests del contenedor que lo use

Riesgos:

- romper estados explícitos de loading/error/empty/stale
- mover lógica de datos a la UI cuando debería vivir en hooks o `src/lib`
- aumentar costo de render en el dashboard principal

### Cómo modificar el flujo de favoritos

Archivos probables a tocar:

- `src/app/dashboard/hooks/useFavoriteStocks.ts`
- `src/app/dashboard/hooks/useFavoritePanel.ts`
- `src/app/dashboard/hooks/favoritePanelClient.ts`
- `src/app/dashboard/hooks/favoritePanelValidation.ts`
- `src/app/api/favorites/route.ts`
- `src/lib/favorites.ts`
- `src/lib/server/favoritesRequest.ts`
- `src/lib/server/favoritesService.ts`

Archivos que conviene revisar antes:

- `src/app/dashboard/components/StockFavoriteButton.tsx`
- `src/app/dashboard/components/Panel.tsx`
- `src/lib/server/quoteCache.ts`
- `src/lib/server/favoritesRateLimit.ts`

Tests a actualizar o agregar:

- `src/app/dashboard/hooks/useFavoriteStocks.test.tsx`
- `src/app/dashboard/hooks/useFavoritePanel.test.tsx`
- `src/app/dashboard/hooks/favoritePanelClient.test.ts`
- `src/app/api/favorites/route.test.ts`
- `src/lib/server/favoritesService.test.ts`

Riesgos:

- romper compatibilidad con snapshots guardados en `localStorage`
- perder fallback stale para favoritos
- subir demasiado la concurrencia de quotes
- desalinear validación cliente y server

### Cómo modificar el histórico de una acción

Archivos probables a tocar:

- `src/app/dashboard/components/StockDetailsModal.tsx`
- `src/app/dashboard/components/LightweightStockChart.tsx`
- `src/app/dashboard/hooks/useStockHistory.ts`
- `src/app/dashboard/hooks/stockHistoryClient.ts`
- `src/app/api/stocks/[symbol]/history/route.ts`
- `src/lib/stockHistory.ts`
- `src/lib/server/historyRequest.ts`
- `src/lib/server/historyService.ts`
- `src/lib/server/historyCache.ts`

Archivos que conviene revisar antes:

- `src/lib/server/historyEndpoint.ts`
- `src/lib/server/historyRateLimit.ts`
- `src/app/dashboard/components/Panel.tsx`

Tests a actualizar o agregar:

- `src/lib/stockHistory.test.ts`
- `src/app/api/stocks/[symbol]/history/route.test.ts`
- `src/lib/server/historyService.test.ts`
- `src/app/dashboard/hooks/useStockHistory.test.tsx`
- `src/app/dashboard/hooks/stockHistoryClient.test.ts`
- `src/app/dashboard/components/StockDetailsModal.test.tsx`
- `src/app/dashboard/components/LightweightStockChart.test.tsx`

Riesgos:

- romper normalización de rangos o mercado
- eliminar fallback stale ante falla upstream
- afectar performance del modal por el peso del chart

### Cómo agregar o ajustar métricas

Archivos probables a tocar:

- `src/lib/server/observability.ts`
- `src/app/api/panel/route.ts`
- `src/app/api/favorites/route.ts`
- `src/app/api/stocks/[symbol]/history/route.ts`
- `src/app/api/health/route.ts`
- `src/app/api/debug/metrics/route.ts`
- `docs/RUNBOOK.md`

Archivos que conviene revisar antes:

- `src/lib/server/debug.ts`
- `src/lib/server/observability.test.ts`

Tests a actualizar o agregar:

- `src/lib/server/observability.test.ts`
- `src/app/api/debug/metrics/route.test.ts`
- tests de route del endpoint donde cambie la instrumentación, si afecta salida o headers

Riesgos:

- exponer información sensible en métricas o logs
- cambiar forma del endpoint debug sin actualizar su test
- introducir contadores inconsistentes entre rutas

### Cómo cambiar variables de entorno

Archivos probables a tocar:

- `.env.local.example`
- `src/lib/server/env.ts`
- `README.md`
- `docs/RUNBOOK.md`
- `.github/workflows/ci.yml` si la variable impacta CI

Archivos que conviene revisar antes:

- `src/lib/server/env.test.ts`
- handlers o servicios que consuman la variable

Tests a actualizar o agregar:

- `src/lib/server/env.test.ts`
- tests del servicio o route que dependa de esa variable

Riesgos:

- romper defaults entre demo y live
- asumir presencia de secretos en cliente
- cambiar una variable sin documentarla en ejemplos y runbook

## 8. Archivos clave de la raíz

### `package.json`

- define scripts de desarrollo, build, validación, Vitest y E2E
- usa `type: "module"`
- fija Node `>=24.15.0 <25`

### `.env.local.example`

- documenta `MARKET_DATA_SOURCE`, `API_URL`, `TOKEN_ENDPOINT`, credenciales upstream, endpoints de panel y flags de observabilidad/rate limit
- sirve como referencia canónica de variables esperadas

### `next.config.mjs`

- habilita `reactStrictMode`
- define `turbopack.root`
- agrega headers globales como `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` y `X-Frame-Options`
- agrega `Strict-Transport-Security` solo en producción

### `middleware.ts`

- genera nonce por request
- arma la Content Security Policy dinámica
- aplica la CSP a páginas no API

### `next.config.test.ts`

- contiene tests de seguridad y CSP; no es configuración de runtime

### `tsconfig.json`

- `strict: true`
- `moduleResolution: "bundler"`
- alias `@/* -> src/*`

### `vitest.config.ts`

- configura alias `@`
- reemplaza `server-only`
- excluye `e2e/**`

### `playwright.config.ts`

- base URL por defecto `http://localhost:3100`
- define proyectos de navegador
- ajusta retries en CI

### `README.md`

- es la documentación principal de alto nivel
- explica objetivo, modos demo/live, endpoints internos y estrategia operativa general

### `AGENTS.md`

- contiene reglas operativas específicas para mantenimiento automatizado del repo

## 9. Scripts disponibles

Según `package.json`, los scripts relevantes son:

- `npm run dev`: inicia Next.js en `http://localhost:3000`
- `npm run dev:e2e`: inicia Next.js en `http://localhost:3100`
- `npm run build`: genera el build de producción
- `npm run start`: inicia el build en puerto `3000`
- `npm run lint`: corre ESLint
- `npm run type-check`: ejecuta TypeScript con `--noEmit`
- `npm run test`: corre Vitest
- `npm run test:e2e`: hace `next build` y luego corre la suite E2E completa
- `npm run test:e2e:app`: hace `next build` y corre solo la parte interactiva no SSR
- `npm run test:e2e:app:run`: corre `scripts/run-e2e.mjs --grep-invert @ssr-boot`
- `npm run test:e2e:run`: corre `scripts/run-e2e-suite.mjs`
- `npm run test:e2e:ssr`: hace `next build` y corre solo la suite SSR
- `npm run test:e2e:ssr:run`: corre `scripts/run-e2e.mjs --mode=ssr e2e/dashboard-ssr.spec.ts`
- `npm run test:e2e:ui`: abre Playwright UI
- `npm run validate:local`: corre `lint`, `type-check`, `test` y `build`
- `npm run validate`: corre `validate:local` y luego `test:e2e:run`
- `npm run deps:update`: actualiza dependencias y lockfile; conviene usarlo solo bajo pedido explícito

## 10. Dependencias importantes

### Runtime

- `next`: framework principal, App Router, route handlers, SSR
- `react` y `react-dom`: UI y renderizado
- `swr`: revalidación cliente y manejo de caché remota
- `lightweight-charts`: gráfico histórico del modal

### Desarrollo

- `typescript`: tipado estático estricto
- `tailwindcss` y `@tailwindcss/postcss`: estilos
- `postcss` y `autoprefixer`: pipeline CSS
- `eslint` y `eslint-config-next`: linting
- `vitest`: tests unitarios, hooks, componentes y rutas
- `@testing-library/react` y `@testing-library/user-event`: testing de UI
- `jsdom`: entorno DOM para ciertos tests
- `@playwright/test`: pruebas E2E

## 11. Convenciones del proyecto

- `src/app/dashboard/**`: UI cliente y hooks del dashboard
- `src/lib/**`: contratos y utilidades compartidas
- `src/lib/server/**`: integración externa y lógica sensible
- `src/app/api/**`: BFF consumido por el navegador
- tests co-localizados cuando conviene: `route.ts` junto a `route.test.ts`, hooks y componentes con `*.test.ts(x)`
- alias `@/` hacia `src/`
- no hay store global de negocio: el estado se reparte entre SWR, hooks locales, `localStorage` y cookie de tema

## 12. Notas útiles para mantenimiento

- No se observa base de datos local ni ORM.
- El modo `demo` es parte del flujo normal del proyecto; no es solo un mock de tests.
- `src/styles/` existe, pero la hoja global usada por la app es `src/app/globals.css`.
- Si un cambio afecta contratos o payloads, conviene revisar en conjunto UI, route handlers, servicios y tests.
- Para cambios operativos o de observabilidad, `docs/RUNBOOK.md` suele ser el complemento natural de este documento.
