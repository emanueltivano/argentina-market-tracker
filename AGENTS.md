# AGENTS.md

## Descripción del proyecto

`argentina-market-tracker` es un dashboard demo/portfolio sobre mercado argentino.
Tratarlo como proyecto de muestra técnica: no como plataforma real de trading, broker ni asesor financiero.

El repo muestra una arquitectura Next.js con BFF interno, validación de contratos, SSR inicial, revalidación cliente y tests automatizados.

## Stack real

- Next.js 16.2.4 con App Router
- React 19.2.5
- TypeScript 6 en `strict`
- Tailwind CSS 4
- SWR 2 para revalidación cliente
- `lightweight-charts` para histórico
- Vitest + Testing Library para unit/component/hook/route tests
- Playwright para E2E
- GitHub Actions en `.github/workflows/ci.yml`
- Node `>=20`

## Comandos reales

Instalación:

```bash
npm install
```

Desarrollo:

```bash
npm run dev
npm run dev:e2e
```

Calidad:

```bash
npm run lint
npm run type-check
npm run test
npm run build
```

E2E:

```bash
npm run test:e2e
npm run test:e2e:run
npm run test:e2e:ssr
npm run test:e2e:ui
```

Validación completa:

```bash
npm run validate:local
npm run validate
```

Notas:

- `validate:local` corre `lint`, `type-check`, `test` y `build`.
- `validate` agrega E2E sobre build ya generado.
- `test:e2e` y `test:e2e:ssr` hacen `next build` antes de correr Playwright.

## Variables de entorno esperadas

Referencia: `.env.local.example`

- `API_URL`
- `NEXT_PUBLIC_SITE_URL`
- `TOKEN_ENDPOINT`
- `API_USERNAME`
- `API_PASSWORD`
- `PANEL_LIDER_ENDPOINT`
- `PANEL_GENERAL_ENDPOINT`
- `PANEL_CEDEARS_ENDPOINT`
- `ENABLE_TOKEN_DEBUG`

Variables usadas solo para testing/dev controlado:

- `PANEL_RESPONSE_FIXTURE_JSON`
- `DISABLE_SERVER_DASHBOARD_PREFETCH`
- `PLAYWRIGHT_TEST_BASE_URL`
- `PLAYWRIGHT_E2E_MODE`

No incluir secretos ni valores reales en commits, logs, issues ni snapshots.

## Estructura importante

```txt
src/
  app/
    page.tsx
    layout.tsx
    api/
      panel/route.ts
      stocks/[symbol]/history/route.ts
      token/route.ts
    dashboard/
      components/
      hooks/
      lib/
  lib/
    market.ts
    panel.ts
    stockHistory.ts
    server/
      env.ts
      iol.ts
      panelCache.ts
      panelLimits.ts
      historyCache.ts
      historyRateLimit.ts
      historyService.ts
e2e/
scripts/run-e2e.mjs
.github/workflows/ci.yml
```

## Reglas de arquitectura

- Mantener App Router. `src/app/page.tsx` hace SSR inicial del panel y entrega `initialData` al cliente.
- El browser no habla con el proveedor externo. Todo acceso pasa por route handlers internos.
- Conservar separación:
  - UI/hooks cliente en `src/app/dashboard/**`
  - contratos y normalización compartida en `src/lib/**`
  - integración externa y lógica sensible en `src/lib/server/**`
- No duplicar tipos de panel o histórico si ya existen en `src/lib/market.ts`, `src/lib/panel.ts` o `src/lib/stockHistory.ts`.
- El frontend debe consumir datos ya validados; no empujar payloads upstream crudos a componentes.

## BFF y datos externos

- Rutas internas verificadas:
  - `/api/panel?type=lider|general|cedears`
  - `/api/stocks/[symbol]/history?range=1W|1M|3M|6M|1Y&market=bCBA`
  - `/api/token` y `/api/panel?raw=1` solo debug local habilitado
- `src/lib/server/iol.ts` maneja OAuth, timeouts, retry único ante `401/403`, `cache: 'no-store'` y redacción básica de credenciales en mensajes.
- `src/lib/server/env.ts` normaliza base URL y paths de endpoints.
- `src/lib/server/panelCache.ts` usa cache en memoria por panel con TTL de `30s`.
- `src/lib/server/historyCache.ts` usa cache en memoria por `market:symbol:range` con TTL de `5m` y máximo `500` claves.
- `src/lib/server/panelLimits.ts` aplica rate limit de `120` requests por `60s` y cooldown de refresh manual de `15s` por cliente/panel.
- `src/lib/server/historyRateLimit.ts` aplica rate limit de `120` requests por `60s`.
- Estos límites son in-memory y proceso-locales. No tratarlos como protección distribuida real.
- Si cambia un contrato del BFF, actualizar validadores, tests de route handlers y consumidores cliente en el mismo cambio.

## Seguridad y credenciales

- Nunca mover `API_USERNAME`, `API_PASSWORD` ni token OAuth al cliente.
- No exponer token completo en respuestas, UI ni logs.
- `ENABLE_TOKEN_DEBUG=1` solo habilita debug fuera de producción y desde `localhost`/`127.0.0.1`/`::1`.
- Mantener `runtime = 'nodejs'` al tocar handlers con integración server-side; hoy está explícito en `panel` e `history`.
- Respetar headers de seguridad definidos en `next.config.mjs`.
- Si aparece una necesidad de observabilidad, evitar volcar payloads completos del proveedor cuando puedan contener datos sensibles.

## UI y dashboard

- El dashboard principal es cliente (`src/app/dashboard/components/Panel.tsx`) hidratado con datos SSR cuando existen.
- `useMarketPanel` usa SWR con polling de `60s`, pausa cuando la pestaña está oculta y permite refresh manual con `?refresh=1`.
- `StockDetailsModal` se carga con `next/dynamic` y `ssr: false`; no romper esa carga diferida salvo motivo claro.
- El histórico usa `lightweight-charts`; tratarlo como componente relativamente pesado.
- Mantener estados explícitos de loading, error, empty, stale y success. No propagar estados inválidos al UI.
- Favoritos, tema y orden viven del lado cliente; evitar mezclar esa lógica con server code.

## Testing

- Unit, component, hook y route tests corren con `npm run test` mediante Vitest.
- E2E corren con Playwright sobre `http://localhost:3100` por default vía `scripts/run-e2e.mjs`.
- Existe cobertura SSR específica con `npm run test:e2e:ssr`.
- Antes de dar por válido un cambio, correr como mínimo:

```bash
npm run type-check
npm run build
```

- Si el cambio toca lógica, contratos, hooks o handlers, preferir también `npm run test`.
- Si toca flujo dashboard, modal, histórico o SSR inicial, preferir además el E2E relevante.

## Git safety

- No hacer `commit`, `push`, `reset`, `checkout`, `rebase` ni comandos destructivos sin pedido explícito.
- No revertir cambios ajenos del worktree.
- Verificar siempre qué archivos quedaron modificados antes de cerrar.
- En PowerShell, usar `-LiteralPath` para rutas con corchetes como `src/app/api/stocks/[symbol]/history/route.ts`.
- Si hay cambios previos del usuario, trabajar alrededor de ellos y mencionarlos si afectan la tarea.

## Qué no hacer

- No agregar features sin pedido explícito.
- No inventar comandos, variables, endpoints ni arquitectura.
- No convertir esto en producto financiero real ni agregar copy de asesoramiento.
- No llamar al proveedor externo desde client components.
- No duplicar validaciones o tipos entre cliente y servidor si ya hay una fuente única.
- No relajar validaciones para “hacer que pase”.

## Criterio de terminado

Un trabajo queda terminado cuando:

- el cambio respeta la separación cliente/BFF/server existente
- los contratos externos quedan validados antes de llegar a UI
- no se exponen credenciales ni tokens
- se ejecutaron al menos `npm run type-check` y `npm run build` cuando hubo cambios de código
- el resumen final cita archivos tocados, validación ejecutada y riesgos/notas abiertas

Para tareas de documentación pura como esta, no hace falta correr build o type-check si no se modificó código.

## Formato de resumen final

Responder en este formato:

1. Cambios realizados.
2. Archivos afectados.
3. Validación ejecutada.
4. Riesgos o notas abiertas.

## Notas abiertas verificadas

- No encontré un script separado de “integration tests”; la cobertura intermedia actual vive en route tests/hook tests con Vitest y en E2E con Playwright.
- `deps:update` existe pero modifica lockfile y dependencias; no usarlo salvo pedido explícito.
