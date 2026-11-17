/**
 * HackhIt — Supabase Connection Test Component
 *
 * Isolated temporary diagnostic component for Phase 2, Step 1.
 * Tests service connectivity and distinguishes between configuration presence,
 * network reachability, and authorized table queries without weakening database security.
 */

import { useState } from 'react'
import {
  CheckCircle2,
  Database,
  ExternalLink,
  Info,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Wifi,
  WifiOff,
} from 'lucide-react'
import { getSupabaseConfigStatus, supabase } from './supabase'

type TestResultStatus =
  | 'idle'
  | 'testing'
  | 'unconfigured'
  | 'connected_table_ready'
  | 'connected_table_pending'
  | 'connected_rls_protected'
  | 'auth_key_invalid'
  | 'network_error'

interface TestDiagnostics {
  status: TestResultStatus
  httpStatus?: number
  message: string
  details?: string
  latencyMs?: number
  timestamp?: string
  queriedTarget?: string
}

export function SupabaseConnectionTest() {
  const [diagnostics, setDiagnostics] = useState<TestDiagnostics>({
    status: 'idle',
    message: 'Click "Test Supabase" to verify backend connectivity.',
  })
  const [customTable, setCustomTable] = useState<string>('')
  const [isOpen, setIsOpen] = useState<boolean>(true)

  const configStatus = getSupabaseConfigStatus()

  const runConnectionTest = async () => {
    // Step 1: Validate environment configuration
    const currentConfig = getSupabaseConfigStatus()
    if (!currentConfig.isConfigured || !supabase) {
      setDiagnostics({
        status: 'unconfigured',
        message: 'Supabase configuration is missing or invalid.',
        details:
          currentConfig.errors.join(' ') ||
          'Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY are set in .env.local.',
        timestamp: new Date().toLocaleTimeString(),
      })
      return
    }

    setDiagnostics({
      status: 'testing',
      message: 'Connecting to Supabase service...',
    })

    const startTime = performance.now()
    const targetTable = customTable.trim() || '_connection_test_'

    try {
      // Step 2: Test PostgREST API connectivity via minimal read request (head/limit: 1)
      const { error, status, statusText } = await supabase
        .from(targetTable)
        .select('*', { count: 'exact', head: true })

      const latencyMs = Math.round(performance.now() - startTime)
      const timestamp = new Date().toLocaleTimeString()

      // Step 3: Analyze PostgREST response
      if (!error && (status === 200 || status === 206)) {
        // Table exists and query succeeded
        setDiagnostics({
          status: 'connected_table_ready',
          httpStatus: status,
          latencyMs,
          timestamp,
          queriedTarget: targetTable,
          message: `Connected & Authorized: Table "${targetTable}" read succeeded.`,
          details: `PostgREST returned HTTP ${status} (${latencyMs}ms). Database is ready for queries.`,
        })
        return
      }

      // Check specific error codes from Supabase PostgREST
      if (error) {
        const errorMsg = error.message || ''
        const errorCode = error.code || ''
        // Network / Fetch failure returned inside Supabase error object
        if (
          status === 0 ||
          errorMsg.toLowerCase().includes('fetch failed') ||
          errorMsg.toLowerCase().includes('failed to fetch') ||
          errorMsg.toLowerCase().includes('networkerror')
        ) {
          setDiagnostics({
            status: 'network_error',
            httpStatus: 0,
            latencyMs,
            timestamp,
            queriedTarget: targetTable,
            message: 'Network / Connection Error: Failed to reach Supabase.',
            details: `${errorMsg}. Check internet connection and verify VITE_SUPABASE_URL in .env.local.`,
          })
          return
        }

        // HTTP 401 / Invalid API Key
        if (
          status === 401 ||
          errorMsg.toLowerCase().includes('apikey') ||
          errorMsg.toLowerCase().includes('jwt') ||
          errorMsg.toLowerCase().includes('invalid api key')
        ) {
          setDiagnostics({
            status: 'auth_key_invalid',
            httpStatus: status || 401,
            latencyMs,
            timestamp,
            queriedTarget: targetTable,
            message: 'Supabase reached, but publishable key was rejected.',
            details: `HTTP ${status}: ${errorMsg}. Please verify VITE_SUPABASE_PUBLISHABLE_KEY matches your project API settings.`,
          })
          return
        }

        // RLS restriction (Permission denied / 42501 / 401 / 403)
        if (
          status === 403 ||
          errorCode === '42501' ||
          errorMsg.toLowerCase().includes('row-level security') ||
          errorMsg.toLowerCase().includes('permission denied')
        ) {
          setDiagnostics({
            status: 'connected_rls_protected',
            httpStatus: status || 403,
            latencyMs,
            timestamp,
            queriedTarget: targetTable,
            message: 'Service Connected: Row Level Security (RLS) is active.',
            details: `Supabase reached successfully in ${latencyMs}ms. The query on "${targetTable}" was restricted by RLS (expected behavior for secure tables without public read policies).`,
          })
          return
        }

        // Table not found (PGRST205 / 404 / 42P01)
        // This confirms the service is reachable, authenticated, and communicating!
        if (
          status === 404 ||
          errorCode === 'PGRST205' ||
          errorCode === '42P01' ||
          errorMsg.toLowerCase().includes('does not exist') ||
          errorMsg.toLowerCase().includes('relation')
        ) {
          setDiagnostics({
            status: 'connected_table_pending',
            httpStatus: status || 404,
            latencyMs,
            timestamp,
            queriedTarget: targetTable,
            message: 'Service Connection Verified: Supabase PostgREST responded.',
            details: `The Supabase service is reachable and authenticated (${latencyMs}ms). Table "${targetTable}" does not exist yet in your database. Application tables will be created in future schema phases.`,
          })
          return
        }

        // Other PostgREST response with error
        setDiagnostics({
          status: 'connected_table_pending',
          httpStatus: status,
          latencyMs,
          timestamp,
          queriedTarget: targetTable,
          message: `Service Responded (${status || 'API Error'}): ${errorMsg}`,
          details: `Error code: ${errorCode || statusText || 'N/A'}. PostgREST is online.`,
        })
        return
      }

      // Default fallback
      setDiagnostics({
        status: 'connected_table_ready',
        httpStatus: status,
        latencyMs,
        timestamp,
        queriedTarget: targetTable,
        message: 'Connected to Supabase service.',
        details: `Service returned HTTP ${status} in ${latencyMs}ms.`,
      })
    } catch (err: unknown) {
      const latencyMs = Math.round(performance.now() - startTime)
      const errorStr = err instanceof Error ? err.message : String(err)

      // Network / Fetch error
      setDiagnostics({
        status: 'network_error',
        latencyMs,
        timestamp: new Date().toLocaleTimeString(),
        queriedTarget: targetTable,
        message: 'Network / Connection Error: Failed to reach Supabase.',
        details: `${errorStr}. Check internet connection and verify VITE_SUPABASE_URL in .env.local.`,
      })
    }
  }

  return (
    <section
      aria-label="Supabase Connection Diagnostic"
      className="my-8 rounded-[20px] border-[2.5px] border-[#050505] bg-[#fffef8] p-5 shadow-[4px_4px_0_#050505] transition-all"
    >
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#050505]/15 pb-4">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-full border border-[#050505] bg-[#F5F04A] text-[#050505]">
            <Database size={16} />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold tracking-tight text-[#050505] text-sm uppercase">
                Supabase Connection Test
              </h3>
              <span className="rounded-full border border-[#050505] bg-[#050505] px-2 py-0.5 font-bold text-[10px] text-[#E9E7D8] tracking-widest uppercase">
                Phase 2 • Step 1
              </span>
            </div>
            <p className="text-[#050505]/70 text-xs">
              Backend connectivity and environment verification
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="rounded-full border border-[#050505] bg-white px-3 py-1 font-semibold text-[#050505] text-xs transition-colors hover:bg-[#F5F04A]"
          aria-expanded={isOpen}
        >
          {isOpen ? 'Minimize' : 'Expand'}
        </button>
      </div>

      {isOpen && (
        <div className="mt-4 space-y-4">
          {/* Configuration status card */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-[#050505]/20 bg-[#E9E7D8]/40 p-3">
              <span className="block font-bold text-[11px] text-[#050505]/60 tracking-wider uppercase">
                Target URL
              </span>
              <p className="mt-1 truncate font-mono text-xs">
                {configStatus.url ? (
                  <span className="font-bold text-[#050505]">
                    {configStatus.url}
                  </span>
                ) : (
                  <span className="font-semibold text-amber-800">
                    Not configured (VITE_SUPABASE_URL)
                  </span>
                )}
              </p>
            </div>

            <div className="rounded-xl border border-[#050505]/20 bg-[#E9E7D8]/40 p-3">
              <span className="block font-bold text-[11px] text-[#050505]/60 tracking-wider uppercase">
                Publishable Key
              </span>
              <p className="mt-1 font-mono text-xs">
                {configStatus.maskedKey ? (
                  <span className="font-semibold text-emerald-800">
                    Configured ({configStatus.maskedKey})
                  </span>
                ) : (
                  <span className="font-semibold text-amber-800">
                    Missing (VITE_SUPABASE_PUBLISHABLE_KEY)
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Test Action Controls */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              id="test-supabase-button"
              onClick={runConnectionTest}
              disabled={diagnostics.status === 'testing'}
              className="inline-flex min-h-[42px] cursor-pointer items-center justify-center gap-2 rounded-full border-[1.5px] border-[#050505] bg-[#F5F04A] px-6 font-extrabold text-[#050505] text-xs uppercase tracking-wider shadow-[2px_2px_0_#050505] transition-all hover:-translate-y-0.5 hover:shadow-[3px_3px_0_#050505] active:translate-y-0 active:shadow-none disabled:cursor-not-allowed disabled:opacity-60"
            >
              {diagnostics.status === 'testing' ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <RefreshCw size={14} />
                  Test Supabase
                </>
              )}
            </button>

            {/* Optional custom table input to test specific table */}
            <div className="flex items-center gap-2 text-xs">
              <label
                htmlFor="target-table-input"
                className="font-medium text-[#050505]/70"
              >
                Table to probe (optional):
              </label>
              <input
                id="target-table-input"
                type="text"
                placeholder="_connection_test_"
                value={customTable}
                onChange={(e) => setCustomTable(e.target.value)}
                className="h-[36px] w-[160px] rounded-lg border border-[#050505] bg-white px-2.5 font-mono text-xs text-[#050505] placeholder-[#050505]/40 outline-none focus:border-[#050505] focus:ring-2 focus:ring-[#F5F04A]"
              />
            </div>
          </div>

          {/* Diagnostic Result Banner */}
          <div
            className={`rounded-xl border-[1.5px] p-4 transition-all ${
              diagnostics.status === 'testing'
                ? 'border-[#050505] bg-[#F5F04A]/25'
                : diagnostics.status === 'connected_table_ready'
                  ? 'border-emerald-700 bg-emerald-50 text-emerald-950'
                  : diagnostics.status === 'connected_table_pending' ||
                      diagnostics.status === 'connected_rls_protected'
                    ? 'border-[#050505] bg-[#F5F04A]/40 text-[#050505]'
                    : diagnostics.status === 'unconfigured' ||
                        diagnostics.status === 'auth_key_invalid' ||
                        diagnostics.status === 'network_error'
                      ? 'border-red-600 bg-red-50 text-red-950'
                      : 'border-[#050505]/20 bg-white text-[#050505]'
            }`}
          >
            <div className="flex items-start gap-3">
              <span className="mt-0.5">
                {diagnostics.status === 'testing' && (
                  <Loader2 size={18} className="animate-spin text-[#050505]" />
                )}
                {diagnostics.status === 'connected_table_ready' && (
                  <CheckCircle2 size={18} className="text-emerald-700" />
                )}
                {(diagnostics.status === 'connected_table_pending' ||
                  diagnostics.status === 'connected_rls_protected') && (
                  <Wifi size={18} className="text-[#050505]" />
                )}
                {(diagnostics.status === 'unconfigured' ||
                  diagnostics.status === 'auth_key_invalid' ||
                  diagnostics.status === 'network_error') && (
                  <WifiOff size={18} className="text-red-600" />
                )}
                {diagnostics.status === 'idle' && (
                  <Info size={18} className="text-[#050505]/60" />
                )}
              </span>

              <div className="flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="font-bold text-xs uppercase tracking-wide">
                    {diagnostics.status === 'idle' && 'Status: Ready to Test'}
                    {diagnostics.status === 'testing' &&
                      'Status: Request In Flight...'}
                    {diagnostics.status === 'connected_table_ready' &&
                      'Status: Service & Table Query Verified (HTTP 200)'}
                    {diagnostics.status === 'connected_table_pending' &&
                      'Status: Service Reachable (PostgREST Online)'}
                    {diagnostics.status === 'connected_rls_protected' &&
                      'Status: Service Connected (RLS Protected)'}
                    {diagnostics.status === 'unconfigured' &&
                      'Status: Configuration Required'}
                    {diagnostics.status === 'auth_key_invalid' &&
                      'Status: Authentication Key Rejected (HTTP 401)'}
                    {diagnostics.status === 'network_error' &&
                      'Status: Network / Host Unreachable'}
                  </h4>

                  {diagnostics.latencyMs !== undefined && (
                    <span className="rounded-full border border-current px-2 py-0.5 font-mono text-[10px]">
                      {diagnostics.latencyMs}ms
                    </span>
                  )}
                </div>

                <p className="mt-1 font-semibold text-xs leading-relaxed">
                  {diagnostics.message}
                </p>

                {diagnostics.details && (
                  <p className="mt-1 text-[#050505]/75 text-xs leading-relaxed">
                    {diagnostics.details}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Setup Instructions for Missing Configuration */}
          {!configStatus.isConfigured && (
            <div className="rounded-xl border border-dashed border-[#050505]/40 bg-[#E9E7D8]/60 p-4">
              <div className="flex items-center gap-2 font-bold text-xs text-[#050505] uppercase">
                <ShieldAlert size={15} />
                <span>How to configure Supabase for HackhIt</span>
              </div>
              <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-xs text-[#050505]/80">
                <li>
                  Open your{' '}
                  <a
                    href="https://supabase.com/dashboard"
                    target="_blank"
                    rel="noreferrer"
                    className="font-bold text-[#050505] underline inline-flex items-center gap-0.5"
                  >
                    Supabase Dashboard <ExternalLink size={10} />
                  </a>{' '}
                  and select your HackhIt project.
                </li>
                <li>
                  Navigate to <strong>Project Settings (gear icon)</strong> &gt;{' '}
                  <strong>API</strong>.
                </li>
                <li>
                  Copy the <strong>Project URL</strong> and paste into{' '}
                  <code className="rounded bg-white px-1.5 py-0.5 font-mono text-[#050505] border border-[#050505]/20">
                    VITE_SUPABASE_URL
                  </code>{' '}
                  in <code className="font-mono">.env.local</code>.
                </li>
                <li>
                  Copy the <strong>Project API key</strong> (the public{' '}
                  <em>anon / publishable</em> key) and paste into{' '}
                  <code className="rounded bg-white px-1.5 py-0.5 font-mono text-[#050505] border border-[#050505]/20">
                    VITE_SUPABASE_PUBLISHABLE_KEY
                  </code>{' '}
                  in <code className="font-mono">.env.local</code>.
                </li>
                <li>
                  Restart Vite with <code className="font-mono">npm run dev</code>{' '}
                  and click <strong>Test Supabase</strong> above.
                </li>
              </ol>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
