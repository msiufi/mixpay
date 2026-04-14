import { useEffect, useReducer, useRef } from 'react'
import type { PaymentSource, Transaction } from '../types'
import type {
  AgentEvent,
  AgentPipelineResult,
  OptimizationStreamState,
  StreamPhase,
} from '../lib/agents/types'
import { runOrchestrator } from '../lib/agents/orchestrator'

// ── State machine ────────────────────────────────────────────────────

type Action =
  | { type: 'SET_PHASE'; phase: StreamPhase; label: string }
  | { type: 'SET_THINKING'; snippet: string }
  | { type: 'SET_TOOL_CALL'; name: string | null }
  | { type: 'SET_RESULT'; result: AgentPipelineResult }
  | { type: 'SET_ERROR'; error: string }

const PHASE_ORDER: StreamPhase[] = [
  'idle',
  'fetching_rates',
  'optimizing',
  'assessing_risk',
  'generating_insight',
  'complete',
]

const initialState: OptimizationStreamState = {
  phase: 'idle',
  phaseLabel: 'Starting optimization...',
  thinkingSnippet: '',
  toolCallName: null,
  result: null,
  error: null,
}

function reducer(state: OptimizationStreamState, action: Action): OptimizationStreamState {
  switch (action.type) {
    case 'SET_PHASE': {
      // Only advance forward, never backward (handles parallel agent events)
      const currentIdx = PHASE_ORDER.indexOf(state.phase)
      const nextIdx = PHASE_ORDER.indexOf(action.phase)
      if (nextIdx <= currentIdx && action.phase !== 'error') return state
      return { ...state, phase: action.phase, phaseLabel: action.label, toolCallName: null }
    }
    case 'SET_THINKING':
      return { ...state, thinkingSnippet: action.snippet }
    case 'SET_TOOL_CALL':
      return { ...state, toolCallName: action.name }
    case 'SET_RESULT':
      return {
        ...state,
        phase: 'complete',
        phaseLabel: 'Optimization complete',
        result: action.result,
        toolCallName: null,
      }
    case 'SET_ERROR':
      return { ...state, phase: 'error', phaseLabel: 'Something went wrong', error: action.error }
  }
}

// ── Agent name → phase mapping ───────────────────────────────────────

const AGENT_PHASE_MAP: Record<string, { phase: StreamPhase; label: string }> = {
  RatesAgent: { phase: 'fetching_rates', label: 'Fetching live market rates...' },
  OptimizationAgent: { phase: 'optimizing', label: 'AI reasoning through best allocation...' },
  RiskAgent: { phase: 'assessing_risk', label: 'Checking transaction safety...' },
  ExplanationAgent: { phase: 'generating_insight', label: 'Building your insights...' },
}

// ── Hook ─────────────────────────────────────────────────────────────

export function useOptimizationStream(
  merchant: string,
  amount: number,
  sources: PaymentSource[],
  recentTransactions: Transaction[],
): OptimizationStreamState {
  const [state, dispatch] = useReducer(reducer, initialState)
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true

    const handleEvent = (event: AgentEvent) => {
      switch (event.kind) {
        case 'agent_start': {
          const mapped = AGENT_PHASE_MAP[event.agentName ?? '']
          if (mapped) dispatch({ type: 'SET_PHASE', phase: mapped.phase, label: mapped.label })
          break
        }
        case 'agent_thinking':
          dispatch({ type: 'SET_THINKING', snippet: event.thinkingSnippet ?? '' })
          break
        case 'agent_tool_call':
          dispatch({ type: 'SET_TOOL_CALL', name: event.toolName ?? null })
          break
        case 'agent_tool_result':
          dispatch({ type: 'SET_TOOL_CALL', name: null })
          break
        case 'agent_progress':
          // Update phase label without changing phase
          break
        case 'pipeline_complete':
          if (event.result) dispatch({ type: 'SET_RESULT', result: event.result })
          break
        case 'pipeline_error':
          dispatch({ type: 'SET_ERROR', error: event.error ?? 'Unknown error' })
          break
      }
    }

    runOrchestrator(merchant, amount, sources, recentTransactions, handleEvent)
      .catch(err => dispatch({ type: 'SET_ERROR', error: String(err) }))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return state
}
