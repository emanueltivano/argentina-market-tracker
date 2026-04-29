# Argentina Market Tracker

Dashboard de mercado argentino construido con Next.js, React, TypeScript y Tailwind CSS.

El proyecto consume una API externa protegida por token, normaliza paneles de mercado
argentino y los muestra en una interfaz simple con estados de carga, error, vacio y datos.
Esta pensado como proyecto de portfolio: prioriza claridad, seguridad basica, buen tipado,
tests y una arquitectura facil de explicar en entrevista.

## Screenshots

> Las capturas deben agregarse en estas rutas antes de publicar el README final.

### Desktop

![Dashboard desktop](docs/screenshots/dashboard-desktop.png)

### Mobile

![Dashboard mobile](docs/screenshots/dashboard-mobile.png)

## Que demuestra tecnicamente

- Separacion entre frontend, API interna y cliente server-side.
- Credenciales y token de API externa solo en servidor.
- Proxy interno con `/api/panel` para no exponer la API externa al navegador.
- Cache server-side corto por panel para evitar llamadas repetidas durante una demo.
- Validacion y normalizacion de datos externos antes de llegar a la UI.
- TypeScript en modo strict.
- ESLint como barrera basica de calidad.
- Vitest para tests unitarios de logica critica.
- Estados de UI: loading, error, vacio y datos.

## Stack

- Next.js 16
- React 19
- TypeScript 6
- Tailwind CSS 4
- SWR
- ESLint
- Vitest

## Arquitectura

```txt
Browser
  Panel.tsx + SWR
        |
        | fetch /api/panel?type=lider|general|cedears
        v
Next API Route
  src/app/api/panel/route.ts
        |
        | cache corto por MarketPanelKey
        | normalizacion con normalizePanelData()
        v
Server-only client
  src/lib/server/iol.ts
        |
        | token cache + timeout + retry ante 401/403
        v
API externa
```

## Flujo de datos

1. El usuario abre el dashboard.
2. `Panel.tsx` consulta `/api/panel` usando SWR.
3. La API route valida el panel solicitado (`lider`, `general`, `cedears`).
4. Si existe cache vigente, responde desde memoria.
5. Si no existe cache, `iolFetch` obtiene/reutiliza token y consulta la API externa.
6. `normalizePanelData` valida el payload externo.
7. El frontend recibe solo datos normalizados.
8. La UI mapea cada titulo a una fila de mercado.

## Decisiones tecnicas

### API route como proxy

El navegador nunca llama directo a la API externa. Las credenciales (`API_USERNAME`,
`API_PASSWORD`) y el token viven solo del lado servidor.

### `server-only` para cliente externo

El cliente `iolFetch` esta en `src/lib/server/iol.ts` y usa `server-only` para evitar
imports accidentales desde componentes cliente.

### Cache en memoria de 30 segundos

`/api/panel` cachea respuestas exitosas por tipo de panel durante 30 segundos. Para un
proyecto de portfolio esto mantiene la solucion simple y evita golpear la API externa en
cada refresh. No se cachean errores ni respuestas raw de debug.

### Validacion de datos externos

`normalizePanelData` descarta items sin `simbolo` o `descripcion` validos y conserva solo
campos numericos finitos. El frontend trabaja con datos ya normalizados.

### Debug bloqueado en produccion

`/api/token` y `/api/panel?raw=1` solo pueden funcionar fuera de produccion si
`ENABLE_TOKEN_DEBUG=1`. En produccion quedan bloqueados por codigo.

## Estructura

```txt
src/
  app/
    api/
      panel/
      token/
    dashboard/
      components/
    globals.css
    layout.tsx
    page.tsx

  lib/
    market.ts
    panel.ts
    server/
      env.ts
      iol.ts
      tokenCache.ts
```

## Scripts

| Script | Descripcion |
| --- | --- |
| `npm run dev` | Levanta Next en desarrollo en el puerto 3000 |
| `npm run lint` | Ejecuta ESLint |
| `npm run type-check` | Valida TypeScript sin emitir archivos |
| `npm run test` | Corre tests unitarios con Vitest |
| `npm run build` | Genera build de produccion |
| `npm run start` | Sirve el build de produccion |
| `npm run deps:update` | Actualiza dependencias con npm-check-updates |

## Variables de entorno

Crear `.env.local` a partir de `.env.local.example`.

| Variable | Requerida | Descripcion |
| --- | --- | --- |
| `API_URL` | Si | URL base de la API externa, sin slash final |
| `TOKEN_ENDPOINT` | No | Endpoint de token; default `token` |
| `API_USERNAME` | Si | Usuario de API externa |
| `API_PASSWORD` | Si | Password de API externa |
| `PANEL_LIDER_ENDPOINT` | Si | Endpoint del panel lider |
| `PANEL_GENERAL_ENDPOINT` | Si | Endpoint del panel general |
| `PANEL_CEDEARS_ENDPOINT` | Si | Endpoint de CEDEARs |
| `ENABLE_TOKEN_DEBUG` | No | Debug local. Debe quedar `0` o sin definir en produccion |
| `NEXT_PUBLIC_APP_ORIGIN` | No | Origen publico de la app si se usan Server Actions |

Ejemplo:

```env
API_URL="https://api.example.com"
TOKEN_ENDPOINT="token"
API_USERNAME="your_api_username"
API_PASSWORD="your_api_password"
PANEL_LIDER_ENDPOINT="api/v2/cotizaciones/acciones/merval/argentina"
PANEL_GENERAL_ENDPOINT="api/v2/cotizaciones/acciones/panel%20general/argentina"
PANEL_CEDEARS_ENDPOINT="api/v2/cotizaciones/acciones/cedears/argentina"
ENABLE_TOKEN_DEBUG=0
NEXT_PUBLIC_APP_ORIGIN="https://your-vercel-app.vercel.app"
```

## Puesta en marcha local

```bash
npm install
cp .env.local.example .env.local
npm run dev
```

Abrir:

```txt
http://localhost:3000
```

## Deploy en Vercel

1. Importar el repositorio en Vercel.
2. Configurar las variables de entorno requeridas.
3. No definir `ENABLE_TOKEN_DEBUG=1` en produccion.
4. Ejecutar el build con `npm run build`.

Notas:

- `/api/panel` corre en runtime Node.js.
- `/api/token` esta bloqueado en produccion.
- `/api/panel?raw=1` esta bloqueado en produccion.
- El cache en memoria es intencionalmente simple y suficiente para este proyecto.

## Tests

Los tests actuales cubren la logica critica de normalizacion y validacion:

- `src/lib/panel.test.ts`
- `src/lib/market.test.ts`

Comandos recomendados antes de publicar cambios:

```bash
npm run lint
npm run type-check
npm run test
npm run build
```

## Limitaciones conocidas

- No guarda historico de precios.
- No tiene autenticacion de usuarios.
- Depende de la disponibilidad de la API externa.
- El cache es en memoria y por instancia. Es una decision intencional para mantener simple
  el proyecto de portfolio.
- `npm audit` puede reportar una vulnerabilidad moderada transitiva de `postcss` dentro de
  Next. No usar `npm audit fix --force` si propone bajar o romper la version de Next.

## Que mejoraria si escalara

Estas mejoras no son necesarias para el objetivo actual de portfolio, pero son buenos puntos
para discutir en entrevista:

- Cache compartido externo si hubiera alto trafico o varias instancias.
- Rate limiting en API routes si el endpoint quedara abierto a mucho trafico.
- Tests de API routes para validar comportamiento de produccion.
- Monitoreo de errores y latencia.
- Persistencia de datos historicos.
- Tabla mas accesible usando semantica HTML de tabla o grid ARIA completo.

## Puntos para explicar en entrevista

- Por que usar una API route como proxy.
- Como se evita exponer credenciales al navegador.
- Para que sirve `server-only`.
- Como funciona el cache de token y el retry ante `401/403`.
- Por que se normalizan datos externos antes de renderizar.
- Que tradeoff implica usar cache en memoria en un proyecto de portfolio.
- Que cubren los tests y que tests agregaria despues.
- Que cambiaria si el proyecto tuviera trafico real.
