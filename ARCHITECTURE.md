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
| **Razonamiento** | Texto genérico | **Opus explica POR QUÉ** se eligió cada fuente |
| **Evaluación de riesgo** | Siempre "riesgo bajo" | **Haiku evalúa** si la transacción es inusual |
| **Insights de inversión** | Plantilla con datos de FCI | **Sonnet genera** recomendaciones personalizadas con nombres de productos y comparación vs inflación |
| **Explicación en Dashboard** | Plantilla de texto | **Claude genera** explicación personalizada por transacción |

**Resumen:** La IA no hace las cuentas (son determinísticas y precisas). La IA **explica, evalúa y recomienda**.

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

Adicionalmente, en el Dashboard cada transacción tiene un botón **"AI Explanation"** que llama a Claude directamente (`src/lib/ai-explanation.ts`) para generar una explicación personalizada de esa transacción específica.

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
| `get_ars_exchange_rate` | Cotización oficial/MEP del dólar |
| `get_investment_yields` | Rendimientos de FCI y cuentas remuneradas |
| `get_inflation_data` | Índice CER del BCRA |

---

### 2. Optimization Agent — Matemática precisa + razonamiento de Claude

**Archivo:** `src/lib/agents/optimization-agent.ts`
**Modelo:** `claude-opus-4-6` (configurable en `config.ts`)

**Proceso en 2 pasos:**

**Paso 1 — Matemática determinística (sin LLM):**

Las math tools (`src/lib/agents/math-tools.ts`) calculan con precisión:

1. `calculate_true_costs()` — Ranking de costo verdadero por fuente, devuelve `optimalOrder`
2. `allocate_payment(source_order)` — Asignación exacta de montos usando ese orden

**Fórmula de Costo Verdadero (por dólar gastado):**
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
| Fuente | Comisión | Rend. Real | Costo Verdadero |
|--------|----------|------------|-----------------|
| ARS | 0,5% | -6%/12 = -0,50% | **0,00%** (conviene gastarlos) |
| USD Cash | 0% | +1,2%/12 = +0,10% | **0,10%** |
| USDC | 0% | +2,1%/12 = +0,18% | **0,18%** |
| Mastercard | 2,5% | 0% | **2,50%** |
| Visa | 3,5% | 0% | **3,50%** |

**Orden óptimo:** ARS → USD → USDC → Mastercard → Visa

**Insight clave:** Los pesos argentinos se gastan primero porque su rendimiento real es negativo — pierden valor contra la inflación más rápido de lo que rinden en un FCI.

**Paso 2 — Claude explica (solo con API key):**

Opus recibe el resultado de las math tools y genera:
- `reasoning`: "Se eligió Mastercard sobre Visa porque 2,5% < 3,5%. Los pesos se gastaron primero porque pierden valor real."
- `alternativeConsidered`: "Guardar los pesos y usar solo tarjeta hubiera costado más en fees."

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

**Genera exactamente 3 insights con reglas estrictas:**

| # | Tipo | Qué muestra |
|---|------|-------------|
| 1 | `savings` | Ahorro en comisiones vs Visa 3,5% |
| 2 | `opportunity_cost` | Rendimiento real ajustado por inflación (ARS vs inflación argentina, USD vs inflación EEUU — nunca mezclar) |
| 3 | `invest_suggestion` | Recomendación de productos específicos por nombre y TNA vs inflación |

**Reglas del prompt:**
- Nunca comparar USD/USDC con inflación argentina
- Nunca sugerir "invertir" el límite de tarjeta de crédito
- Solo usar los números exactos provistos
- deltaUSD siempre debe ser un número

---

### 5. AI Explanation (Dashboard)

**Archivo:** `src/lib/ai-explanation.ts`

Cuando el usuario toca **"AI Explanation"** en una transacción del historial, se hace una llamada directa a Claude (no pasa por el pipeline de agentes) para generar una explicación personalizada de esa transacción.

**Con API key:** Claude genera 2-3 oraciones explicando por qué se eligió esa combinación.
**Sin API key:** Texto de plantilla generado localmente.

---

### 6. Fallback — Modo sin API key

**Archivo:** `src/lib/agents/fallback.ts`

**Cuándo se usa:**
- No hay `VITE_CLAUDE_API_KEY` configurada
- Cualquier error inesperado en el pipeline

**Qué hace:**
- Usa las **mismas math tools** que el pipeline con IA (mismo ranking, misma asignación)
- Genera insights de plantilla (sin IA)
- Emite eventos para que la animación de la UI funcione igual
- Si el pago excede los fondos disponibles, el botón se deshabilita

---

## Math Tools — Las herramientas de cálculo

**Archivo:** `src/lib/agents/math-tools.ts`

Estas herramientas hacen TODA la matemática. Ni Claude ni ningún LLM hace cuentas.

| Herramienta | Input | Output |
|-------------|-------|--------|
| `calculate_true_costs` | (nada) | Ranking de fuentes por costo verdadero + `optimalOrder` |
| `allocate_payment` | `source_order: string[]` | Asignación precisa: montos, fees, costo oportunidad |
| `compare_strategies` | Dos órdenes distintos | Comparación lado a lado, ganador, diferencia |

---

## Sistema de Caché y Datos en Vivo

**Archivo:** `src/lib/rates-cache.ts`

**Datos que obtiene (en paralelo al cargar la app):**

| Fuente | Proxy | API externa | Dato |
|--------|-------|-------------|------|
| Dólar oficial | `/api/rates?type=oficial` | dolarapi.com | Cotización compra/venta |
| Dólar MEP | `/api/rates?type=mep` | dolarapi.com | Cotización compra/venta |
| FCI/Rendimientos | `/api/yields?source=config` | rendimientos.co | Nombre, TNA, tipo |
| CER | `/api/yields?source=cer-ultimo` | rendimientos.co | Índice CER del BCRA |
| IPC (inflación) | `/api/ipc` | datos.gob.ar (INDEC) | Últimos 2 valores del IPC |

**Cómo calcula la inflación:**
```
inflación mensual = (IPC actual - IPC anterior) / IPC anterior
Ejemplo: (10.991 - 10.683) / 10.683 = 2,88%
```

**Cómo elige el tipo de cambio:**
```
arsExchangeRate = max(oficial.venta, mep.venta) || 1400
```

**TTL del caché:** 2 minutos. Se pre-carga cuando el usuario abre el Dashboard.

**Valores de fallback** (si todas las APIs fallan):
- ARS/USD: 1400
- FCI: Bank Money Market (est.) al 20% TNA
- Inflación: 2,9% mensual
- Inflación EEUU: 3% anual

---

## Persistencia de Datos

**Archivo:** `src/context/SessionContext.tsx`

Los datos sobreviven al refresco del browser (F5):

| Dato | Storage Key | Qué guarda |
|------|------------|------------|
| Fuentes (saldos + tarjetas) | `mixpay_sources` | Array completo de PaymentSource |
| Transacciones | `mixpay_transactions` | Historial de pagos |
| Tarjetas (legacy) | `mixpay_cards` | Solo tarjetas de crédito |

El botón **Reset** (↩ en el header) borra todo y restaura los valores por defecto.

---

## Proxy de APIs (CORS)

### Desarrollo local (Vite proxy en `vite.config.mjs`)

| Ruta local | API externa |
|------------|------------|
| `/api/rates?type=oficial` | dolarapi.com/v1/dolares/oficial |
| `/api/rates?type=mep` | dolarapi.com/v1/dolares/bolsa |
| `/api/yields?source=config` | rendimientos.co/api/config |
| `/api/yields?source=cer-ultimo` | rendimientos.co/api/cer-ultimo |
| `/api/ipc` | datos.gob.ar (INDEC IPC serie 103.1) |

### Producción (Vercel serverless en `api/`)

| Archivo | Rutas | Caché servidor |
|---------|-------|---------------|
| `api/rates.ts` | `all`, `blue`, `oficial`, `mep`, `ccl`, `tarjeta`, `cripto` | 60s |
| `api/yields.ts` | `fci`, `config`, `cer`, `cer-ultimo`, `lecaps`, `mundo` | 120s |
| `api/ipc.ts` | Serie IPC de INDEC | 1 hora |

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

---

## Configuración (`src/lib/config.ts`)

| Variable | Valor | Descripción |
|----------|-------|-------------|
| `COMMISSION_RATE` | 0.10 | 10% del ahorro |
| `OPTIMIZATION_MODEL` | `claude-opus-4-6` | Modelo para optimización (demo) |
| `EXPLANATION_MODEL` | `claude-sonnet-4-6` | Modelo para explicación |
| `RISK_MODEL` | `claude-haiku-4-5-20251001` | Modelo para riesgo |
| `RATES_MODEL` | `claude-haiku-4-5-20251001` | Modelo para tasas |
| `WORST_CASE_FEE_RATE` | 0.035 | Visa 3,5% (benchmark) |
| `ARG_MONTHLY_INFLATION` | 0.029 | Inflación mensual argentina (fallback) |
| `US_ANNUAL_INFLATION` | 0.03 | Inflación anual EEUU |

Para producción, cambiar `OPTIMIZATION_MODEL` a `claude-sonnet-4-6` reduce el costo de ~$0,17 a ~$0,04 por pago.

---

## Features de Claude API utilizadas

| Feature | Dónde | Para qué |
|---------|-------|----------|
| **Tool Use** | Rates Agent (3 herramientas financieras) | Consultar APIs de mercado |
| **Tool Use** | Optimization Agent (3 math tools) | Cálculos precisos de asignación |
| **Multi-modelo** | Opus, Sonnet, Haiku | Cada agente usa el modelo óptimo |
| **Streaming SSE** | Optimizing page | Animación en tiempo real |
| **MCP** | Server standalone | Herramientas para Claude Desktop/Code |

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
| Datos financieros | dolarapi.com, datos.gob.ar (INDEC), rendimientos.co |
| Persistencia | localStorage |
| Formato numérico | es-AR (. miles, , decimales) |

---

## Flujo completo del usuario

```
1. Dashboard (/)
   └── prefetchRates() carga tasas en background (dólar, FCI, IPC)
   └── Strip de tasas en vivo: USD/ARS · Mejor FCI · Inflación
   └── Badge "Saved $X" con ahorro total acumulado
   └── Muestra saldos, tarjetas (agregar/editar/eliminar), historial
   └── Botón "AI Explanation" por transacción (Claude directo)
   └── Estado persiste en localStorage (sobrevive F5)

2. Checkout (/checkout)
   └── Usuario elige comercio y monto (sin límite, formato es-AR)

3. Optimizing (/optimizing)
   └── Stepper: ● Rates → ● Optimize → ● Risk → ● Insight
   └── Math tools calculan asignación óptima (determinístico)
   └── Claude Opus explica el razonamiento (si hay API key)
   └── Claude Haiku evalúa riesgo (en paralelo)
   └── Claude Sonnet genera insights personalizados
   └── Badge de tool calls: ⚡ calculate_true_costs()
   └── Si fondos insuficientes: warning rojo + botón deshabilitado
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
