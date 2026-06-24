# Estructura del proyecto

Guía breve de onboarding técnico. Para setup, scripts, variables de entorno, estrategia demo/live y operación general, la fuente principal sigue siendo `README.md`. Para observabilidad y troubleshooting, usar `docs/RUNBOOK.md`.

## 1. Mapa rápido

### Entrada principal

- `src/app/page.tsx`
  - Hace SSR del panel inicial y pasa `initialData` al dashboard cliente.
- `src/app/layout.tsx`
  - Metadata, bootstrap de tema y layout raíz.
- `src/app/globals.css`
  - Hoja global activa de la app.

### Dashboard cliente

- `src/features/dashboard/panel/Panel.tsx`
  - Orquestador principal del dashboard.
- `src/features/dashboard/panel/PanelContent.tsx`
  - Shell visual, toolbar y navegación.
- `src/features/dashboard/stocks/StockTable.tsx`
  - Tabla, estados vacíos y errores.
- `src/features/dashboard/history/StockDetailsModal.tsx`
  - Modal con detalle e histórico.
- `src/features/dashboard/panel/useMarketPanel.ts`
  - Fetch y refresh del panel principal.
- `src/features/dashboard/favorites/useFavoritePanel.ts`
  - Fetch y refresh del panel de favoritos.
- `src/features/dashboard/favorites/useFavoriteStocks.ts`
  - Persistencia cliente de favoritos y snapshots.
- `src/features/dashboard/history/useStockHistory.ts`
  - Fetch del histórico para el modal.

### BFF interno

- `src/app/api/panel/route.ts`
  - Paneles `lider`, `general` y `cedears`.
- `src/app/api/favorites/route.ts`
  - Batch lookup de favoritos.
- `src/app/api/stocks/[symbol]/history/route.ts`
  - Histórico por símbolo.
- `src/app/api/health/route.ts`
  - Estado operativo.
- `src/app/api/debug/metrics/route.ts`
  - Métricas y runtime debug.
- `src/app/api/token/route.ts`
  - Debug local del token.

### Contratos compartidos

- `src/lib/market.ts`
  - Claves de panel y helpers.
- `src/lib/panel.ts`
  - Contrato de panel y normalización de payloads.
- `src/lib/stockHistory.ts`
  - Contrato de histórico y normalización.
- `src/lib/favorites.ts`
  - Tipos y validación del flujo de favoritos.
- `src/lib/theme.ts`
  - Persistencia y tipo de tema.

### Server-only

- `src/lib/server/core/env.ts`
  - Variables de entorno y resumen de runtime.
- `src/lib/server/upstream/iol.ts`
  - Cliente upstream con OAuth, retry y timeout.
- `src/lib/server/panel/panelCache.ts`
  - Cache y dedupe del panel.
- `src/lib/server/history/historyService.ts`
  - Orquestación del histórico.
- `src/lib/server/favorites/favoritesService.ts`
  - Fan-out de favoritos.
- `src/lib/server/core/rateLimit.ts`
  - Base de rate limiting.
- `src/lib/server/core/observability.ts`
  - Métricas, request IDs y logging.
- `src/lib/server/demo/demoMarketData.ts`
  - Dataset determinístico para modo demo.

### Tooling y verificación

- `.github/workflows/ci.yml`
  - Pipeline principal.
- `vitest.config.ts`
  - Configuración de tests unitarios/componentes/hooks/routes.
- `playwright.config.ts`
  - Configuración E2E.
- `scripts/run-e2e.mjs`
  - Arranque de app built + Playwright.
- `scripts/run-e2e-suite.mjs`
  - Orquestación de suites SSR e interacción.

## 2. Reglas de arquitectura

- El browser no habla con el proveedor externo. Todo acceso remoto pasa por `src/app/api/**`.
- Los contratos compartidos y normalizadores viven en `src/lib/**`.
- La lógica sensible del servidor vive en `src/lib/server/**`.
- Si cambia un payload upstream o un contrato BFF, actualizar normalizadores, consumidores y tests en el mismo cambio.
- Mantener `runtime = 'nodejs'` en handlers con integración server-side.
- No duplicar tipos existentes en `src/lib/market.ts`, `src/lib/panel.ts`, `src/lib/stockHistory.ts` o `src/lib/favorites.ts`.
- La UI debe consumir datos ya validados; no pasar payloads crudos del upstream a componentes.
- Los endpoints de debug deben seguir protegidos por entorno y host/token.

## 3. Dónde tocar para cambios comunes

### Cambiar UI del dashboard

Revisar primero:

- `src/features/dashboard/panel/Panel.tsx`
- `src/features/dashboard/panel/PanelContent.tsx`
- `src/features/dashboard/stocks/StockTable.tsx`
- `src/features/dashboard/stocks/Stock.tsx`
- `src/app/globals.css`

Si cambia comportamiento de estado, revisar también:

- `src/features/dashboard/panel/useMarketPanel.ts`
- `src/features/dashboard/panel/panelState.ts`
- tests vecinos `*.test.tsx`

### Cambiar paneles de mercado

Revisar primero:

- `src/app/api/panel/route.ts`
- `src/lib/panel.ts`
- `src/lib/market.ts`
- `src/lib/server/panel/panelCache.ts`
- `src/lib/server/panel/panelEndpoint.ts`
- `src/lib/server/demo/demoMarketData.ts`
- `src/features/dashboard/panel/marketPanelOptions.ts`

### Cambiar favoritos

Revisar primero:

- `src/features/dashboard/favorites/useFavoriteStocks.ts`
- `src/features/dashboard/favorites/useFavoritePanel.ts`
- `src/app/api/favorites/route.ts`
- `src/lib/favorites.ts`
- `src/lib/server/favorites/favoritesRequest.ts`
- `src/lib/server/favorites/favoritesService.ts`
- `src/lib/server/upstream/quoteCache.ts`

### Cambiar histórico

Revisar primero:

- `src/features/dashboard/history/StockDetailsModal.tsx`
- `src/features/dashboard/charts/LightweightStockChart.tsx`
- `src/features/dashboard/history/useStockHistory.ts`
- `src/app/api/stocks/[symbol]/history/route.ts`
- `src/lib/stockHistory.ts`
- `src/lib/server/history/historyRequest.ts`
- `src/lib/server/history/historyService.ts`
- `src/lib/server/history/historyCache.ts`

### Cambiar integración upstream

Revisar primero:

- `src/lib/server/upstream/iol.ts`
- `src/lib/server/core/env.ts`
- `src/lib/server/panel/panelEndpoint.ts`
- `src/lib/server/history/historyEndpoint.ts`
- `src/lib/server/upstream/quoteEndpoint.ts`
- `src/lib/panel.ts`
- `src/lib/stockHistory.ts`
- `src/lib/favorites.ts`

### Cambiar seguridad o CSP

Revisar primero:

- `middleware.ts`
- `next.config.mjs`
- `next.config.test.ts`
- `src/app/layout.tsx`
- `src/lib/server/core/debug.ts`

### Cambiar CI o tests

Revisar primero:

- `.github/workflows/ci.yml`
- `package.json`
- `vitest.config.ts`
- `playwright.config.ts`
- `scripts/run-e2e.mjs`
- `scripts/run-e2e-suite.mjs`

## 4. Notas de mantenimiento

- `README.md` es la documentación principal de producto, setup y operación general.
- `docs/RUNBOOK.md` es el complemento natural cuando el cambio toca health, degradación, métricas o troubleshooting.
- No existe `src/styles/` en el estado actual del repo; los estilos globales activos están en `src/app/globals.css`.
- El modo `demo` es parte del flujo normal del proyecto, no sólo un fixture de tests.
- Los tests suelen estar co-localizados por área: `route.ts` junto a `route.test.ts`, hooks y componentes con `*.test.ts(x)`.
