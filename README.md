# Argentina Market Tracker — MVP

Panel en Next.js que consume una API protegida por token, normaliza distintos paneles de mercado (Líder, General y CEDEARs) y los muestra en una UI simple con estados de carga, error, vacío y datos.

---

## ✨ Highlights

* **Stack**: Next.js 16 · React 19 · Tailwind 4 · TypeScript 6
* **Seguridad**: credenciales y token solo en servidor
* **Cliente server-only**: `iolFetch` con cache de token, timeout y retry ante `401/403`
* **API interna**: `/api/panel` como proxy/normalizador
* **UI**: componentes reutilizables (`Panel`, `NavStocks`, `Stock`, `PageTitle`)
* **DX**: configuración mínima, sin tooling pesado

---

## 🗺️ Arquitectura

```txt
Client
  Panel.tsx + SWR
        │
        │ fetch /api/panel?type=lider|general|cedears
        ▼
Next API route
  /api/panel
        │
        │ normaliza payload
        ▼
{ ok: true, data: [] }
        │
        │ usa iolFetch(path)
        ▼
Server lib
  lib/server/iol.ts
        │
        ├─ tokenCache.ts
        ├─ fetchToken()
        └─ callWithToken()
```

---

## 🔁 Flujo general

1. El cliente renderiza `Panel`
2. `Panel` usa SWR para consultar `/api/panel?type=...`
3. La route interna llama a `iolFetch`
4. `iolFetch` obtiene o reutiliza un token
5. La respuesta del upstream se normaliza con `normalizePanelData`
6. El cliente recibe `{ ok: true, data: [...] }`
7. La UI mapea cada título a props de `Stock`

---

## 🧩 Componentes principales

### `Panel`

* consulta `/api/panel` con SWR
* maneja estados de carga, error, vacío y éxito
* cambia entre paneles (`lider`, `general`, `cedears`)
* mapea datos a props de `Stock`

### `NavStocks`

Encabezado de columnas. Comparte la grilla con `Stock`.

### `Stock`

Fila memoizada que formatea:

* precios
* cantidades
* volumen
* operaciones
* variación porcentual
* color según variación

### `PageTitle`

Renderiza el título principal.

---

## ⚙️ Variables de entorno

### Requeridas

```env
API_URL=https://api.example.com
API_USERNAME=usuario
API_PASSWORD=password

PANEL_LIDER_ENDPOINT=api/v2/...
PANEL_GENERAL_ENDPOINT=api/v2/...
PANEL_CEDEARS_ENDPOINT=api/v2/...
```

### Opcionales

```env
TOKEN_ENDPOINT=token
ENABLE_TOKEN_DEBUG=0
NEXT_PUBLIC_APP_ORIGIN=https://tu-dominio.com
```

---

## 🚀 Puesta en marcha

```bash
npm install
```

Crear archivo de entorno:

```bash
cp .env.local.example .env.local
```

Completar:

```env
API_URL=
API_USERNAME=
API_PASSWORD=
PANEL_LIDER_ENDPOINT=
PANEL_GENERAL_ENDPOINT=
PANEL_CEDEARS_ENDPOINT=
```

Levantar:

```bash
npm run dev
```

Abrir:

```txt
http://localhost:3000
```

---

## 📜 Scripts

```json
{
  "dev": "next dev -p 3000",
  "build": "next build",
  "start": "next start -p 3000",
  "type-check": "tsc --noEmit",
  "deps:update": "npx npm-check-updates -u && npm install"
}
```

---

## 🔒 Seguridad

* Credenciales solo en servidor (`server-only`)
* Token cacheado en memoria
* Retry automático ante `401/403`
* `/api/panel` actúa como proxy
* `/api/token` bloqueado en producción
* `/api/token` está bloqueado por defecto. Solo se habilita fuera de producción si `ENABLE_TOKEN_DEBUG=1`.

---

## 🌐 API interna

### `GET /api/panel?type=lider|general|cedears`

```json
{
  "ok": true,
  "data": []
}
```

### `GET /api/panel?type=lider&raw=1`

Modo debug (solo desarrollo):

```json
{
  "ok": true,
  "type": "lider",
  "data": {}
}
```

---

## 📁 Estructura

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
    panel.ts
    market.ts
    server/
```

---

## 🧪 Validación

```bash
npm run type-check
npm run build
```

---

## ⚠️ Consideraciones

* El frontend **solo consume respuestas exitosas (`ok: true`)**
* Los errores del backend se manejan vía `throw`
* Respuestas inválidas del upstream generan error (no estado vacío)
* Los errores detallados solo se exponen en desarrollo

---