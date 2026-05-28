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

- `src/app/dashboard/components/Panel.tsx`
  - Orquestador principal del dashboard.
- `src/app/dashboard/components/PanelContent.tsx`
  - Shell visual, toolbar y navegación.
- `src/app/dashboard/components/StockTable.tsx`
  - Tabla, estados vacíos y errores.
- `src/app/dashboard/components/StockDetailsModal.tsx`
  - Modal con detalle e histórico.
- `src/app/dashboard/hooks/useMarketPanel.ts`
  - Fetch y refresh del panel principal.
- `src/app/dashboard/hooks/useFavoritePanel.ts`
  - Fetch y refresh del panel de favoritos.
- `src/app/dashboard/hooks/useFavoriteStocks.ts`
  - Persistencia cliente de favoritos y snapshots.
- `src/app/dashboard/hooks/useStockHistory.ts`
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

- `src/lib/server/env.ts`
  - Variables de entorno y resumen de runtime.
- `src/lib/server/iol.ts`
  - Cliente upstream con OAuth, retry y timeout.
- `src/lib/server/panelCache.ts`
  - Cache y dedupe del panel.
- `src/lib/server/historyService.ts`
  - Orquestación del histórico.
- `src/lib/server/favoritesService.ts`
  - Fan-out de favoritos.
- `src/lib/server/rateLimit.ts`
  - Base de rate limiting.
- `src/lib/server/observability.ts`
  - Métricas, request IDs y logging.
- `src/lib/server/demoMarketData.ts`
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

- `src/app/dashboard/components/Panel.tsx`
- `src/app/dashboard/components/PanelContent.tsx`
- `src/app/dashboard/components/StockTable.tsx`
- `src/app/dashboard/components/Stock.tsx`
- `src/app/globals.css`

Si cambia comportamiento de estado, revisar también:

- `src/app/dashboard/hooks/useMarketPanel.ts`
- `src/app/dashboard/lib/panelState.ts`
- tests vecinos `*.test.tsx`

### Cambiar paneles de mercado

Revisar primero:

- `src/app/api/panel/route.ts`
- `src/lib/panel.ts`
- `src/lib/market.ts`
- `src/lib/server/panelCache.ts`
- `src/lib/server/panelEndpoint.ts`
- `src/lib/server/demoMarketData.ts`
- `src/app/dashboard/lib/marketPanelOptions.ts`

### Cambiar favoritos

Revisar primero:

- `src/app/dashboard/hooks/useFavoriteStocks.ts`
- `src/app/dashboard/hooks/useFavoritePanel.ts`
- `src/app/api/favorites/route.ts`
- `src/lib/favorites.ts`
- `src/lib/server/favoritesRequest.ts`
- `src/lib/server/favoritesService.ts`
- `src/lib/server/quoteCache.ts`

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

### Cambiar integración upstream

Revisar primero:

- `src/lib/server/iol.ts`
- `src/lib/server/env.ts`
- `src/lib/server/panelEndpoint.ts`
- `src/lib/server/historyEndpoint.ts`
- `src/lib/server/quoteEndpoint.ts`
- `src/lib/panel.ts`
- `src/lib/stockHistory.ts`
- `src/lib/favorites.ts`

### Cambiar seguridad o CSP

Revisar primero:

- `middleware.ts`
- `next.config.mjs`
- `next.config.test.ts`
- `src/app/layout.tsx`
- `src/lib/server/debug.ts`

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
