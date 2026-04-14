# MixPay — Documentación Técnica

## Qué es MixPay

MixPay es una app de optimización de pagos potenciada por inteligencia artificial. En lugar de pagar con una sola fuente (tarjeta, efectivo, crypto), MixPay analiza todas tus fuentes de pago y elige la **combinación óptima** considerando comisiones Y costo de oportunidad.

**Concepto clave (True Cost):** A veces es más barato pagar con tarjeta de crédito (2.5% de comisión) y mantener tus pesos invertidos en un FCI al 29% TNA, que gastar esos pesos directamente.

---

## Arquitectura Multi-Agente

MixPay usa un pipeline de 4 agentes de Claude coordinados por un orquestador en TypeScript:

```
┌─────────────────────────────────────────────────────────┐
│                    Orquestador                          │
│              (src/lib/agents/orchestrator.ts)            │
│                                                         │
│  Paso 1: Resolver tasas (caché → fetch → Rates Agent)   │
│  Paso 2: Optimización + Riesgo (en paralelo)            │
│  Paso 3: Explicación                                    │
└────────┬──────────────┬──────────────┬──────────────────┘
         │              │              │
         ▼              ▼              ▼
   ┌───────────┐  ┌───────────┐  ┌───────────┐
   │   Rates   │  │ Optimize  │  │   Risk    │
   │   Agent   │  │   Agent   │  │   Agent   │
   │  (Haiku)  │  │  (Opus)   │  │  (Haiku)  │
   │ tool_use  │  │ thinking  │  │   rápido  │
   └───────────┘  └───────────┘  └───────────┘
                        │
                        ▼
                  ┌───────────┐
                  │Explanation│
                  │   Agent   │
                  │ (Sonnet)  │
                  └───────────┘
```

---

## Agentes en detalle

### 1. Rates Agent — Datos de mercado en tiempo real

**Archivo:** `src/lib/agents/rates-agent.ts`
**Modelo:** `claude-haiku-4-5-20251001`
**Feature de Claude:** `tool_use` (uso de herramientas)

**Qué hace:** Obtiene datos financieros argentinos en tiempo real usando 3 herramientas:

| Herramienta | API externa | Dato que obtiene |
|-------------|------------|------------------|
| `get_ars_exchange_rate` | dolarapi.com (dólar blue) | Cotización ARS/USD (compra y venta) |
| `get_investment_yields` | API de mercado financiero | Rendimientos de FCI, cuentas remuneradas (TNA) |
| `get_inflation_data` | API del BCRA (CER) | Índice CER de inflación del BCRA |

**Flujo:** Claude Haiku recibe las 3 herramientas → decide llamarlas todas → recibe los resultados → devuelve un JSON con las tasas enriquecidas.

**Optimización:** Normalmente NO se ejecuta durante el pago porque las tasas se pre-cargan cuando el usuario abre la app (ver "Sistema de Caché" abajo).

**Valores de fallback** (si las APIs fallan): ARS=1400, TNA=40%, inflación=2.9%

---

### 2. Optimization Agent — El cerebro de la optimización

**Archivo:** `src/lib/agents/optimization-agent.ts`
**Modelo:** `claude-opus-4-6`
**Features de Claude:** `extended thinking` (pensamiento extendido) + `streaming`

**Configuración:**
```
thinking: { type: 'enabled', budget_tokens: 10000 }
maxTokens: 16000
```

**Qué hace:** Reemplaza el algoritmo greedy hardcodeado por razonamiento de IA. Considera el **costo verdadero** de cada fuente de pago:

```
Fórmula de Costo Verdadero (horizonte 1 mes):
  comisión          = monto × tasaComisión
  costoOportunidad  = monto × (tasaRendimiento / 12)
  costoVerdadero    = comisión + costoOportunidad
```

**Ejemplo de razonamiento:**
- ARS: comisión 0.5% + rendimiento perdido 29%/12 = **2.92% costo verdadero**
- Mastercard: comisión 2.5% + rendimiento perdido 0% = **2.5% costo verdadero**
- → Mastercard es MÁS BARATA que gastar los pesos

**Insight clave:** Las tarjetas de crédito tienen costoOportunidad = 0 porque usás plata prestada, no tu plata invertida.

**Streaming:** El pensamiento de Claude se muestra en tiempo real en la UI como un snippet en itálica gris mientras razona.

**Fallback:** Si el streaming falla o el JSON no parsea, usa el optimizador determinístico como respaldo.

---

### 3. Risk Agent — Evaluación de riesgo

**Archivo:** `src/lib/agents/risk-agent.ts`
**Modelo:** `claude-haiku-4-5-20251001`
**Feature de Claude:** llamada rápida (sin streaming, sin herramientas)

**Qué evalúa:**
- ¿El monto es inusualmente alto comparado con el historial reciente?
- ¿El comercio es sospechoso o potencialmente fraudulento?
- ¿El pago agotaría una gran parte de los fondos del usuario?

**Respuesta:**
```json
{
  "level": "low" | "medium" | "high",
  "flags": ["motivos específicos de preocupación"],
  "recommendation": "una oración de recomendación"
}
```

**Ejecución:** Corre en **paralelo** con el Optimization Agent (no depende de su resultado).

---

### 4. Explanation Agent — Insights inteligentes

**Archivo:** `src/lib/agents/explanation-agent.ts`
**Modelo:** `claude-sonnet-4-6`
**Feature de Claude:** llamada estándar con prompt rico

**Qué genera:** 3 insights específicos para el panel "Smart Insights" en la pantalla de éxito:

1. **savings** — Cuánto ahorraste vs. pagar todo con Visa (3.5% de comisión)
2. **opportunity_cost** — Si se mantuvieron fondos invertidos, cuánto ganás por no gastarlos
3. **invest_suggestion** — Recomendación de inversión **con nombre específico** del producto y su TNA (ej: "Invertí tus pesos en Ualá Plus 2 al 29% TNA")

**Datos que recibe:** Resultado de optimización completo + datos de FCI en vivo + evaluación de riesgo + fuentes enriquecidas con rendimientos.

---

### 5. Fallback — Modo sin API key

**Archivo:** `src/lib/agents/fallback.ts`

**Cuándo se usa:**
- No hay `VITE_CLAUDE_API_KEY` configurada
- Cualquier error inesperado en el pipeline

**Qué hace:**
- Usa el algoritmo determinístico original (`optimizePayment()`)
- Genera insights de plantilla (sin IA)
- Emite eventos falsos para que la animación de la UI funcione igual
- La app funciona completa sin API key — solo pierde la inteligencia de los agentes

---

## Sistema de Caché de Tasas

**Archivo:** `src/lib/rates-cache.ts`

**Problema:** No queremos que el usuario espere mientras se cargan las tasas al momento de pagar.

**Solución:** Pre-carga en background cuando el usuario abre la app.

```
Usuario abre Dashboard
        ↓
prefetchRates() se dispara (useEffect en SessionContext)
        ↓
3 requests en paralelo:
  ├── /api/rates?type=blue     → dólar blue
  ├── /api/yields?source=config → FCI/rendimientos
  └── /api/yields?source=cer-ultimo → inflación CER
        ↓
Datos cacheados en memoria (TTL: 2 minutos)
        ↓
Usuario hace un pago → tasas disponibles INSTANTÁNEAMENTE
```

**Estrategia de resolución (en orden):**
1. **Caché en memoria** — instantáneo, sin red
2. **Fetch directo** — HTTP paralelo, sin Claude
3. **Rates Agent** — Claude Haiku con tool_use (último recurso)

---

## Proxy de APIs (CORS)

Las APIs externas (dolarapi.com, APIs financieras) no permiten llamadas directas desde el browser (CORS). Se resuelve con:

### Desarrollo local (Vite proxy)
**Archivo:** `vite.config.mjs`

```
/api/rates?type=blue    → proxy a dolarapi.com/v1/dolares/blue
/api/yields?source=config → proxy a API de mercado financiero
```

### Producción (Vercel serverless functions)
**Archivos:** `api/yields.ts`, `api/rates.ts`

| Ruta | API externa | Caché servidor |
|------|------------|----------------|
| `/api/rates?type=blue` | dolarapi.com/v1/dolares/blue | 1 min |
| `/api/rates?type=mep` | dolarapi.com/v1/dolares/bolsa | 1 min |
| `/api/yields?source=config` | API de mercado financiero | 2 min |
| `/api/yields?source=cer-ultimo` | API del BCRA (CER) | 2 min |
| `/api/yields?source=lecaps` | APIs financieras/api/lecaps | 2 min |

---

## MCP Server — Argentina Finance

**Directorio:** `mcp-servers/argentina-finance/`

Server MCP (Model Context Protocol) independiente para usar con Claude Desktop o Claude Code. Expone las mismas APIs financieras como herramientas:

| Herramienta | Fuente | Datos |
|-------------|--------|-------|
| `get_dollar_rates` | dolarapi.com | Todas las cotizaciones (blue, oficial, MEP, CCL, tarjeta, cripto) |
| `get_fci_yields` | APIs financieras | Rendimientos de FCI con TNA |
| `get_inflation_rate` | BCRA vía APIs financieras | Índice CER |
| `get_market_data` | APIs financieras | Indicadores globales (S&P, Bitcoin, Oro) |
| `get_lecap_rates` | APIs financieras | LECAPs/BONCAPs con TIR/TNA |

**Instalación:**
```bash
cd mcp-servers/argentina-finance
npm install
npm start
```

**Configuración en Claude Desktop** (`claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "argentina-finance": {
      "command": "node",
      "args": ["ruta/a/mcp-servers/argentina-finance/index.js"]
    }
  }
}
```

---

## Features de Claude API utilizadas

| Feature | Dónde se usa | Por qué |
|---------|-------------|---------|
| **Extended Thinking** | Optimization Agent (Opus) | Razonamiento profundo sobre asignación óptima |
| **Streaming SSE** | Optimization Agent | Muestra el pensamiento en tiempo real en la UI |
| **Tool Use** | Rates Agent (Haiku) | Consulta APIs externas de forma autónoma |
| **Multi-modelo** | Haiku (rápido), Opus (razonamiento), Sonnet (explicación) | Cada agente usa el modelo óptimo para su tarea |
| **MCP** | Server standalone | Herramientas financieras para Claude Desktop/Code |

---

## Stack Tecnológico

| Componente | Tecnología |
|-----------|-----------|
| Frontend | React 19 + TypeScript |
| Routing | React Router 7 |
| Estilos | Tailwind CSS 4 |
| Build | Vite 8 |
| Deploy | Vercel |
| IA | Claude API (Opus 4.6, Sonnet 4.6, Haiku 4.5) |
| APIs financieras | dolarapi.com, APIs financieras, BCRA |

---

## Flujo completo del usuario

```
1. Dashboard (/)
   └── prefetchRates() carga tasas en background
   └── Muestra saldos, tarjetas, historial

2. Checkout (/checkout)
   └── Usuario elige comercio y monto

3. Optimizing (/optimizing)
   └── useOptimizationStream hook activa el orquestador
   └── Fases de animación en tiempo real:
       "Usando datos de mercado cacheados" → instantáneo
       "IA razonando la mejor combinación..." → Opus piensa
       "Verificando seguridad..." → Haiku evalúa riesgo
       "Construyendo insights..." → Sonnet genera insights
   └── Botón "Confirmar Pago" aparece al completar

4. Success (/success)
   └── Desglose del pago
   └── Ahorro vs Visa tradicional
   └── Panel "Smart Insights" con 3 insights:
       - Ahorro en comisiones
       - Costo de oportunidad (por qué no gastó ARS)
       - Recomendación de inversión con producto específico
```
