# Auditoría de simplificación

## 1. Resumen ejecutivo

El proyecto no se ve sobreingenierizado de forma general para el objetivo que declara hoy: un dashboard portfolio con BFF interno, SSR inicial, modo demo/live, tests automatizados y cierta narrativa de hardening operativo.

La mayor parte de la complejidad relevante sí cumple una función real en runtime o en verificación:

- separación cliente/BFF/server
- normalización de contratos externos
- SSR inicial con revalidación cliente
- cachés y rate limiting proceso-local
- E2E diferenciados para dashboard y SSR
- modo `demo` para deploy público

Donde sí aparece inflación es en tres zonas:

- documentación duplicada y parcialmente desactualizada
- módulos muy finos alrededor de parsing/respuesta HTTP
- lógica cliente repetida entre panel principal, favoritos e histórico

Conclusión: la complejidad del dominio principal está mayormente justificada, pero hay margen claro para limpiar documentación, reducir wrappers pequeños y consolidar helpers repetidos.

## 2. Complejidad justificada

- `src/app/page.tsx` + `src/lib/server/panelCache.ts` + `src/app/dashboard/components/Panel.tsx`
  - El SSR inicial con `initialData` y revalidación posterior evita blank first paint y mantiene el navegador aislado del proveedor externo.

- `src/app/api/panel/route.ts`, `src/app/api/stocks/[symbol]/history/route.ts`, `src/app/api/favorites/route.ts`
  - La capa BFF no es decorativa: valida input, aplica rate limit, esconde credenciales y normaliza respuestas antes de llegar al cliente.

- `src/lib/panel.ts` y `src/lib/stockHistory.ts`
  - La normalización defensiva del upstream está justificada porque el proyecto depende de payloads externos variables.

- `src/lib/server/historyCache.ts`, `src/lib/server/panelCache.ts`, `src/lib/server/quoteCache.ts`
  - Los caches no son genéricos “por arquitectura”; se usan en rutas reales y cubren casos concretos: panel, histórico y favoritos.

- `src/lib/server/rateLimit.ts` y wrappers por ruta (`panelLimits`, `historyRateLimit`, `favoritesRateLimit`)
  - Hay complejidad, pero resuelve una necesidad real del repo actual: proteger refresh manual, histórico y fan-out de favoritos.

- `src/lib/server/favoritesService.ts`
  - La concurrencia acotada y el stale fallback no son ornamentales: la ruta `/api/favorites` hace fan-out real por símbolo y necesita control de burst.

- `middleware.ts` + `next.config.mjs` + `next.config.test.ts`
  - La política CSP por request con nonce y sus tests tienen sentido porque el proyecto vende explícitamente una postura de seguridad.

- `scripts/run-e2e.mjs`, `e2e/dashboard.spec.ts`, `e2e/dashboard-ssr.spec.ts`
  - La separación entre E2E de interacción y SSR boot coverage está alineada con el comportamiento que el repo quiere demostrar.

- `src/test/server-only.ts`
  - Es un archivo mínimo, pero útil: habilita tests de código server-only desde Vitest vía alias.

## 3. Posibles archivos innecesarios

### Archivo claramente innecesario

- Ruta: `docs/issues.md`
  - Por qué parece innecesario:
    Mantiene un backlog manual dentro del repo que ya quedó desfasado respecto del estado real del proyecto.
  - Evidencia encontrada:
    El archivo propone “Add a production-safe demo data mode” y “Evaluate global rate limiting”, pero el repo ya tiene `MARKET_DATA_SOURCE`, `demoMarketData.ts`, endpoints `health`/`debug`, variables `RATE_LIMIT_*` y documentación de eso en `README.md`.
  - Riesgo de eliminarlo:
    Bajo. No hay imports ni referencias operativas; sólo aparece mencionado por `ESTRUCTURA_PROYECTO.md`.
  - Recomendación:
    Eliminar o moverlo fuera del repo si la intención es usar GitHub Issues reales.

### Archivos posiblemente innecesarios

- Ruta: `ESTRUCTURA_PROYECTO.md`
  - Por qué parece innecesario:
    Duplica a gran escala información que ya está en `README.md` y parcialmente en `AGENTS.md`.
  - Evidencia encontrada:
    Ya está desactualizado: lista `src/styles/`, pero esa carpeta no existe. También duplica scripts, árbol, arquitectura y notas que ya viven en otros documentos.
  - Riesgo de eliminarlo:
    Medio-bajo. Puede servir como onboarding, pero hoy agrega riesgo de drift documental.
  - Recomendación:
    Revisar. Si se conserva, reducirlo fuerte y convertirlo en un mapa breve; si no, integrarlo al `README.md`.

- Ruta: `docs/screenshots/README.md`
  - Por qué parece innecesario:
    Sólo describe tres archivos PNG con nombres autoexplicativos.
  - Evidencia encontrada:
    El contenido no agrega contexto operativo ni técnico adicional; `README.md` ya embebe las capturas.
  - Riesgo de eliminarlo:
    Muy bajo.
  - Recomendación:
    Revisar. Es buen candidato para limpieza menor.

- Ruta: `tailwind.config.ts`
  - Por qué parece innecesario:
    Para Tailwind v4 este proyecto casi no parece depender de configuración custom real; el archivo sólo define `darkMode`, `content` y un `container` que no aparece como pieza central del CSS.
  - Evidencia encontrada:
    La mayor parte del estilo está en `src/app/globals.css`; no encontré referencias internas al archivo salvo la detección automática del tooling.
  - Riesgo de eliminarlo:
    Medio. Tailwind/Next pueden estar leyéndolo implícitamente, y `darkMode: 'class'` podría ser relevante si luego se introducen utilities `dark:`.
  - Recomendación:
    Revisar con cuidado, no eliminar sin prueba manual y build.

## 4. Posibles abstracciones excesivas

### Caso 1

- Archivos involucrados:
  `src/app/dashboard/hooks/useMarketPanel.ts`
  `src/app/dashboard/hooks/useFavoritePanel.ts`
- Qué problema resuelven:
  Encapsulan fetch SWR, refresh manual, auto-refresh cada 60s, pausa por pestaña oculta y exposición del estado de vista.
- Por qué podrían ser excesivos:
  La estructura es casi la misma en ambos hooks. Cambian la URL, el fetcher y algunos campos de salida, pero la máquina de estados y la lógica temporal están duplicadas.
- Alternativa más simple:
  Extraer un hook base tipo `useAutoRefreshingSWRResource` y dejar que cada caso sólo aporte fetcher, key y mapeo de salida.

### Caso 2

- Archivos involucrados:
  `src/app/dashboard/hooks/marketPanelClient.ts`
  `src/app/dashboard/hooks/favoritePanelClient.ts`
  `src/app/dashboard/hooks/stockHistoryClient.ts`
- Qué problema resuelven:
  Fetch de JSON, parseo de error y validación del contrato de respuesta.
- Por qué podrían ser excesivos:
  Repiten el mismo patrón con pequeñas diferencias: `fetch`, `response.ok`, parseo de JSON, contract assertion y armado de mensajes.
- Alternativa más simple:
  Un helper compartido de cliente para “fetch JSON validado” y módulos pequeños sólo para mensajes y guards específicos.

### Caso 3

- Archivos involucrados:
  `src/lib/server/panelRequest.ts`
  `src/lib/server/panelResponse.ts`
  `src/lib/server/historyRequest.ts`
  `src/lib/server/historyResponse.ts`
- Qué problema resuelven:
  Separan parsing del request y composición de respuestas JSON por dominio.
- Por qué podrían ser excesivos:
  Son módulos muy finos. Parte del valor existe, pero la separación termina fragmentando demasiado el flujo y además hay duplicación entre `panelResponse.ts` e `historyResponse.ts`.
- Alternativa más simple:
  Mantener los parsers si se quieren testear por separado, pero unificar respuestas JSON/no-store/request-id en un helper genérico con nombre neutral.

### Caso 4

- Archivos involucrados:
  `src/app/dashboard/hooks/marketPanelValidation.ts`
  `src/app/dashboard/hooks/favoritePanelValidation.ts`
- Qué problema resuelven:
  Validan contratos exitosos antes de exponerlos al cliente.
- Por qué podrían ser excesivos:
  Son wrappers muy pequeños alrededor de type guards ya existentes en `src/lib/panel.ts` y `src/lib/favorites.ts`.
- Alternativa más simple:
  Inlining en los fetch clients o centralización en un único módulo de validación de respuestas cliente.

### Caso 5

- Archivos involucrados:
  `scripts/run-e2e-suite.mjs`
- Qué problema resuelven:
  Ejecuta secuencialmente SSR E2E y dashboard E2E con logs.
- Por qué podrían ser excesivos:
  Es un wrapper alrededor de dos scripts ya existentes; no agrega mucha lógica más allá de secuenciar y loggear.
- Alternativa más simple:
  Resolverlo en `package.json` con un único comando o dejar explícito que el archivo existe sólo para secuenciar suites.

## 5. Duplicaciones

- `useMarketPanel.ts` y `useFavoritePanel.ts`
  - Duplican refresh manual, auto-refresh, tracking de refresh en vuelo y lógica de visibilidad.

- `marketPanelClient.ts`, `favoritePanelClient.ts` y `stockHistoryClient.ts`
  - Repiten fetch JSON validado, parseo de error de servidor y mensajes de error.

- `panelResponse.ts` y `historyResponse.ts`
  - Repiten el patrón `NextResponse.json` + `Cache-Control: no-store` + `requestId`.

- `marketPanelValidation.ts` y `favoritePanelValidation.ts`
  - Ambas son capas finas de validación de contrato exitoso.

- Documentación:
  - `README.md`, `AGENTS.md` y `ESTRUCTURA_PROYECTO.md` repiten stack, arquitectura, scripts y estructura.

## 6. Configuración posiblemente sobrante

- `tailwind.config.ts`
  - Posible sobrante, pero no hay evidencia suficiente para removerlo sin probar build/UI.

- `next.config.test.ts`
  - No sobra, pero el nombre confunde: no es una config, es un archivo de tests sobre seguridad.

- `scripts/run-e2e-suite.mjs`
  - Más que sobrante, es simplificable.

- `docs/issues.md`
  - Funciona como tooling documental paralelo a GitHub Issues y hoy parece obsoleto.

- `AGENTS.md`
  - No sobra, pero está desactualizado como fuente técnica:
    - declara Next `16.2.4` y React `19.2.5`, mientras `package.json` tiene `16.2.6` y `19.2.6`
    - declara Node `>=20`, mientras `package.json` exige `>=24.15.0 <25`
    - no refleja variables actuales como `MARKET_DATA_SOURCE`, `APP_VERSION`, `OBSERVABILITY_DEBUG_TOKEN`, `RATE_LIMIT_*` ni `FAVORITES_QUOTE_CONCURRENCY`
    - no refleja endpoints actuales como `/api/favorites`, `/api/health` y `/api/debug/metrics`

## 7. Recomendaciones priorizadas

### Seguro para limpiar ahora

- `docs/issues.md`
- `docs/screenshots/README.md`
- consolidar o recortar `ESTRUCTURA_PROYECTO.md` si se decide mantener un solo documento principal
- renombrar conceptualmente `next.config.test.ts` en una futura limpieza para evitar ambigüedad

### Revisar con cuidado

- consolidar `useMarketPanel.ts` y `useFavoritePanel.ts`
- consolidar `marketPanelClient.ts`, `favoritePanelClient.ts` y `stockHistoryClient.ts`
- unificar `panelResponse.ts` e `historyResponse.ts`
- revisar si `tailwind.config.ts` realmente aporta algo en este setup Tailwind v4
- evaluar si `scripts/run-e2e-suite.mjs` merece existir como archivo propio

### No tocar por ahora

- `src/lib/server/observability.ts`
- `src/lib/server/rateLimit.ts`
- `src/lib/server/favoritesService.ts`
- `src/lib/server/historyService.ts`
- `middleware.ts`
- `src/test/server-only.ts`

Estas piezas agregan complejidad, pero hoy están respaldadas por uso real, tests y valor demostrable para el tipo de proyecto que el repo busca mostrar.

## 8. Próximos pasos sugeridos

1. Hacer un commit de documentación solamente:
   - eliminar `docs/issues.md`
   - eliminar `docs/screenshots/README.md`
   - decidir si `ESTRUCTURA_PROYECTO.md` se borra o se reduce a una página breve

2. Hacer un commit de documentación técnica:
   - actualizar `AGENTS.md` para que refleje versiones, Node, variables y endpoints reales
   - evitar triple fuente de verdad entre `README.md`, `AGENTS.md` y `ESTRUCTURA_PROYECTO.md`

3. Hacer un commit de simplificación cliente:
   - extraer un hook compartido para refresh/auto-refresh/visibility con SWR

4. Hacer un commit de simplificación de fetch clients:
   - crear helper común para fetch JSON validado y mensajes de error base

5. Hacer un commit de simplificación server HTTP:
   - unificar helpers de respuesta JSON con `requestId` y `Cache-Control`

6. Recién después evaluar configuración:
   - probar si `tailwind.config.ts` puede desaparecer sin afectar build o dark mode

## Observaciones adicionales

- No encontré carpetas vacías.
- No encontré archivos runtime claramente muertos dentro de `src/`.
- Sí encontré documentación con drift y módulos pequeños que pueden reducirse sin perder comportamiento.
