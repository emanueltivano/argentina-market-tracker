# AGENTS.md

## 🎯 Objetivo actual

Estamos en fase de **auditoría, mantenimiento y mejora incremental**.
No agregar features sin pedido explícito.

---

## 📏 Reglas generales

* No modificar archivos sin pedido explícito
* No instalar dependencias sin justificación clara
* No ejecutar comandos destructivos
* Priorizar problemas reales sobre sugerencias cosméticas
* Siempre citar archivos afectados
* Separar cambios en:

  * Quick wins
  * Mejoras medianas
  * Refactors grandes

---

## 🧠 Qué se considera problema real

* Riesgos de runtime (errores posibles)
* Inconsistencias de tipos
* Duplicación de lógica
* Código difícil de mantener o entender
* Contratos mal definidos entre frontend/backend

---

## 🚫 Qué NO priorizar

* Formateo
* Naming subjetivo (si no afecta claridad real)
* Micro-optimizaciones
* Cambios puramente estéticos

---

## 🔗 Contratos y tipos

* Evitar duplicar tipos entre cliente y servidor
* Preferir una sola fuente de verdad (ej: `MarketPanelKey`)
* Validar datos externos siempre (type guards)
* El frontend debe trabajar con datos ya validados

---

## ⚙️ Manejo de datos y errores

* Las APIs pueden devolver:

  * `{ ok: true, data: [...] }`
  * `{ ok: false, error, details }`
* El cliente debe:

  * trabajar solo con datos válidos
  * manejar errores vía `throw`
* No propagar estados inválidos al UI

---

## 🧪 Validación obligatoria

Antes de considerar un cambio como válido:

```bash
npm run type-check
npm run build
```

---

## 🧱 Niveles de riesgo

* **Bajo**

  * JSX
  * helpers
  * UI
* **Medio**

  * tipos
  * mappers
* **Alto**

  * lógica server (`iol.ts`)
  * autenticación
  * fetch / contratos

---

## 🔍 Qué revisar en auditorías

* `package.json` y scripts
* configuración (Next, Tailwind, TS)
* estructura de carpetas
* separación client/server
* consistencia de tipos
* manejo de errores

---

## 📊 Criterio de mejora

Siempre evaluar:

* impacto (alto / medio / bajo)
* esfuerzo (alto / medio / bajo)
* riesgo (alto / medio / bajo)

Priorizar cambios de **alto impacto y bajo riesgo**.

---