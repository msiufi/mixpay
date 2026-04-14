# MixPay — Documentación Técnica

## Qué es MixPay

MixPay es una app de optimización de pagos potenciada por inteligencia artificial. En lugar de pagar con una sola fuente (tarjeta, efectivo, crypto), MixPay analiza todas tus fuentes de pago y elige la **combinación óptima** considerando comisiones, rendimientos Y la inflación de cada moneda.

**Concepto clave (True Cost):** A veces es más barato pagar con tarjeta de crédito (2,5% de comisión) y mantener tus pesos invertidos, que gastar esos pesos que están perdiendo valor contra la inflación.

---

## Qué hace la IA vs. qué hace la matemática

La **matemática es siempre la misma** — con o sin API key de Claude. Lo que la IA agrega es la capa de explicación y personalización.

| Funcionalidad | Sin API key | Con API key |
|---------------|------------|-------------|
| **Tasas en vivo** | Fetch HTTP directo (dolarapi, INDEC, rendimientos) | Igual — el caché las resuelve |
| **Ranking de costo verdadero** | Math tools calculan el orden óptimo | Igual — mismas math tools |
| **Asignación de pago** | Math tools calculan montos exactos | Igual — mismas math tools |
| **Razonamiento** | Texto genérico ("Asignación por ranking de costo") | **Opus explica POR QUÉ** se eligió cada fuente |
| **Evaluación de riesgo** | Siempre "riesgo bajo" | **Haiku evalúa** si la transacción es inusual |
| **Insights de inversión** | Plantilla con datos de FCI | **Sonnet genera** recomendaciones personalizadas con nombres de productos y comparación vs inflación |

**Resumen:** La IA no hace las cuentas (las cuentas son determinísticas y precisas). La IA **explica, evalúa y recomienda**.

---

## Arquitectura Multi-Agente

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
   │ tool_use  │  │math+razón │  │   rápido  │
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
**Feature de Claude:** `tool_use`

**Cuándo se usa:** Solo como último recurso. Normalmente las tasas se obtienen por HTTP directo (sin Claude) y se cachean por 2 minutos.

**Herramientas:**

| Herramienta | Qué obtiene |
|-------------|-------------|
| `get_ars_exchange_rate` | Cotización oficial/MEP del dólar (dolarapi.com) |
| `get_investment_yields` | Rendimientos de FCI y cuentas remuneradas (rendimientos.co) |
| `get_inflation_data` | Índice CER del BCRA |

---

### 2. Optimization Agent — Matemática precisa + razonamiento de Claude

**Archivo:** `src/lib/agents/optimization-agent.ts`
**Modelo:** `claude-opus-4-6` (configurable en `config.ts`)

**Proceso en 2 pasos:**

**Paso 1 — Matemática determinística (sin LLM):**

Las math tools (`src/lib/agents/math-tools.ts`) calculan con precisión:

1. `calculate_true_costs()` — Ranking de costo verdadero por fuente
2. `allocate_payment(source_order)` — Asignación exacta de montos

**Fórmula de Costo Verdadero:**
```
rendimientoReal = tasaNominal - inflaciónDeLaMoneda

Para ARS: rendimientoReal = 29% TNA - 35% inflación argentina = -6%
Para USD: rendimientoReal = 4,2% - 3% inflación EEUU = +1,2%
Para USDC: rendimientoReal = 5,1% - 3% inflación EEUU = +2,1%
Para tarjetas: costoOportunidad = 0 (es plata prestada)

costoOportunidadMensual = rendimientoReal / 12
costoVerdadero = comisión + costoOportunidadMensual
```

**Ejemplo con datos reales:**
| Fuente | Comisión | Rendimiento Real | Costo Verdadero |
|--------|----------|-----------------|----------------|
| ARS | 0,5% | -6%/12 = -0,50% | **0,00%** (conviene gastarlos) |
| USD Cash | 0% | +1,2%/12 = +0,10% | **0,10%** |
| USDC | 0% | +2,1%/12 = +0,18% | **0,18%** |
| Mastercard | 2,5% | 0% | **2,50%** |
| Visa | 3,5% | 0% | **3,50%** |

**Orden óptimo:** ARS → USD → USDC → Mastercard → Visa

**Insight clave:** Los pesos argentinos se gastan primero porque su rendimiento real es negativo — pierden valor contra la inflación. Los dólares y USDC se guardan porque su rendimiento real es positivo.

**Paso 2 — Claude explica (solo con API key):**

Opus recibe el resultado de las math tools y genera:
- `reasoning`: "Se eligió Mastercard sobre Visa porque 2,5% < 3,5%. Los pesos se gastaron primero porque pierden valor real al 6% anual."
- `alternativeConsidered`: "Usar solo tarjetas hubiera costado 3,5% en fees pero preservaba los pesos."

---

### 3. Risk Agent — Evaluación de riesgo

**Archivo:** `src/lib/agents/risk-agent.ts`
**Modelo:** `claude-haiku-4-5-20251001`
**Feature de Claude:** llamada rápida (sin herramientas)

**Qué evalúa:**
- ¿El monto es inusualmente alto comparado con el historial?
- ¿El comercio es sospechoso?
- ¿El pago agotaría una gran parte de los fondos?

**Sin API key:** Siempre devuelve "riesgo bajo".

**Con API key:** Haiku analiza en tiempo real. Corre en **paralelo** con el Optimization Agent.

---

### 4. Explanation Agent — Insights inteligentes

**Archivo:** `src/lib/agents/explanation-agent.ts`
**Modelo:** `claude-sonnet-4-6`

**Genera exactamente 3 insights:**

| # | Tipo | Qué muestra |
|---|------|-------------|
| 1 | `savings` | Ahorro en comisiones vs Visa 3,5% |
| 2 | `opportunity_cost` | Análisis de rendimiento ajustado por inflación. ARS vs inflación argentina, USD vs inflación EEUU |
| 3 | `invest_suggestion` | Recomendación de productos específicos por nombre y TNA (ej: "Ualá Plus 2 al 29% TNA") |

**Reglas estrictas del prompt:**
- Nunca comparar USD/USDC con inflación argentina (son monedas distintas)
- Nunca sugerir "invertir" el límite de tarjeta de crédito (es plata prestada)
- Siempre mencionar productos de inversión por nombre y TNA
- Solo usar los números exactos provistos

**Sin API key:** Genera insights de plantilla con los mismos datos.

---

## Math Tools — Las herramientas de cálculo

**Archivo:** `src/lib/agents/math-tools.ts`

Estas herramientas hacen TODA la matemática. Ni Claude ni ningún LLM hace cuentas.

| Herramienta | Input | Output |
|-------------|-------|--------|
| `calculate_true_costs` | (nada) | Ranking de fuentes por costo verdadero + `optimalOrder` |
| `allocate_payment` | `source_order: string[]` | Asignación precisa: montos, fees, costo oportunidad |
| `compare_strategies` | Dos órdenes distintos | Comparación lado a lado, ganador, diferencia |

Estas mismas herramientas se usan tanto en el pipeline con IA como en el fallback sin IA.

---

## Sistema de Caché y Datos en Vivo

**Archivo:** `src/lib/rates-cache.ts`

**Datos que obtiene (en paralelo al cargar la app):**

| Fuente | API | Dato |
|--------|-----|------|
| Dólar oficial | dolarapi.com/v1/dolares/oficial | Cotización compra/venta |
| Dólar MEP | dolarapi.com/v1/dolares/bolsa | Cotización compra/venta |
| FCI/Rendimientos | rendimientos.co/api/config | Nombre, TNA, tipo de producto |
| CER | rendimientos.co/api/cer-ultimo | Índice CER del BCRA |
| IPC (inflación) | datos.gob.ar (INDEC) | Últimos 2 valores del IPC → calcula inflación mensual |

**Cómo calcula la inflación:**
```
inflación mensual = (IPC actual - IPC anterior) / IPC anterior
Ejemplo: (10.991 - 10.683) / 10.683 = 2,88%
```

**Cómo elige el tipo de cambio:**
```
arsExchangeRate = max(oficial.venta, mep.venta)
```

**TTL del caché:** 2 minutos. Se pre-carga cuando el usuario abre el Dashboard.

---

## Proxy de APIs (CORS)

### Desarrollo local (Vite proxy en `vite.config.mjs`)

| Ruta local | API externa |
|------------|------------|
| `/api/rates?type=oficial` | dolarapi.com/v1/dolares/oficial |
| `/api/rates?type=mep` | dolarapi.com/v1/dolares/bolsa |
| `/api/yields?source=config` | rendimientos.co/api/config |
| `/api/yields?source=cer-ultimo` | rendimientos.co/api/cer-ultimo |
| `/api/ipc` | datos.gob.ar (INDEC IPC) |

### Producción (Vercel serverless en `api/`)

| Archivo | Caché servidor |
|---------|---------------|
| `api/rates.ts` | 1 min |
| `api/yields.ts` | 2 min |
| `api/ipc.ts` | 1 hora |

---

## MCP Server — Argentina Finance

**Directorio:** `mcp-servers/argentina-finance/`

Server independiente para Claude Desktop o Claude Code con 7 herramientas:

| Herramienta | Datos |
|-------------|-------|
| `get_dollar_rates` | Todas las cotizaciones (oficial, blue, MEP, CCL, tarjeta, cripto) |
| `get_fci_yields` | Rendimientos de FCI |
| `get_inflation_rate` | Índice CER del BCRA |
| `get_market_data` | Indicadores globales (S&P, Bitcoin, Oro) |
| `get_lecap_rates` | LECAPs/BONCAPs con TIR/TNA |
| `calculate_true_costs` | Ranking de costo verdadero por fuente |
| `allocate_payment` | Asignación óptima de un pago |

---

## Modelo de Monetización

**Comisión:** 10% del ahorro generado (configurable en `config.ts`)

| Plan | Precio | Comisión | Features |
|------|--------|----------|----------|
| Free | $0/mes | 10% | Optimización AI, hasta 5 fuentes, insights básicos |
| Pro | $4,99/mes | 0% | Fuentes ilimitadas, insights avanzados, prioridad AI, exportar historial |
| Business | $19,99/mes | 0% | Todo de Pro + cuentas de equipo, acceso API, estrategias custom |

**Ejemplo:** Pago de $200 → ahorro de $4,50 vs Visa → comisión MixPay = $0,45 → usuario ahorra $4,05 neto.

---

## Configuración (`src/lib/config.ts`)

| Variable | Valor | Descripción |
|----------|-------|-------------|
| `COMMISSION_RATE` | 0.10 | 10% del ahorro |
| `OPTIMIZATION_MODEL` | `claude-opus-4-6` | Modelo para el agente de optimización |
| `EXPLANATION_MODEL` | `claude-sonnet-4-6` | Modelo para el agente de explicación |
| `RISK_MODEL` | `claude-haiku-4-5-20251001` | Modelo para el agente de riesgo |
| `RATES_MODEL` | `claude-haiku-4-5-20251001` | Modelo para el agente de tasas |
| `WORST_CASE_FEE_RATE` | 0.035 | Visa 3,5% (benchmark) |
| `ARG_MONTHLY_INFLATION` | 0.029 | Inflación mensual argentina (fallback) |
| `US_ANNUAL_INFLATION` | 0.03 | Inflación anual EEUU |

Para producción, cambiar `OPTIMIZATION_MODEL` a `claude-sonnet-4-6` reduce el costo de $0,17 a $0,04 por pago.

---

## Features de Claude API utilizadas

| Feature | Agente | Para qué |
|---------|--------|----------|
| **Tool Use** | Rates Agent (3 herramientas financieras) | Consultar APIs de mercado |
| **Tool Use** | Optimization Agent (3 math tools) | Cálculos precisos de asignación |
| **Multi-modelo** | Opus (razonamiento), Sonnet (explicación), Haiku (tasas, riesgo) | Cada agente usa el modelo óptimo para su tarea |
| **Streaming SSE** | Optimizing page | Animación en tiempo real con progreso de agentes |
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
| Datos ARS | dolarapi.com, INDEC (datos.gob.ar), rendimientos.co |
| Formato numérico | es-AR (. miles, , decimales) |

---

## Flujo completo del usuario

```
1. Dashboard (/)
   └── prefetchRates() carga tasas en background (dólar, FCI, IPC)
   └── Strip de tasas en vivo: USD/ARS · Mejor FCI · Inflación
   └── Muestra saldos, tarjetas, historial

2. Checkout (/checkout)
   └── Usuario elige comercio y monto (input formateado es-AR)

3. Optimizing (/optimizing)
   └── Stepper: ● Rates → ● Optimize → ● Risk → ● Insight
   └── Math tools calculan asignación óptima (determinístico)
   └── Claude Opus explica el razonamiento (si hay API key)
   └── Claude Haiku evalúa riesgo (en paralelo)
   └── Claude Sonnet genera insights personalizados
   └── Badge de tool calls: ⚡ calculate_true_costs()
   └── Botón "Confirmar Pago" aparece al completar

4. Success (/success)
   └── Desglose del pago (formato es-AR)
   └── Ahorro vs Visa + comisión MixPay (10% del ahorro)
   └── Botón "Eliminar comisión → Pro"
   └── Panel "Smart Insights" con 3 insights:
       - Ahorro en comisiones
       - Rendimiento real vs inflación (por moneda)
       - Recomendación de inversión con producto específico

5. Pro (/pro)
   └── 3 planes: Free / Pro / Business
   └── CTA para upgrade
```
