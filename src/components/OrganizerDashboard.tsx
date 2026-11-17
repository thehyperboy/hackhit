/**
 * HackhIt — Organizer Dashboard Foundation Component
 *
 * Dedicated, responsive dashboard for campus hackathon organizers:
 * - Secure server-side authorization check (RLS & organizer_roles verification)
 * - Access-denied states for ordinary students and unauthenticated visitors
 * - Real summary metrics: Events Created, Published Events, Registrations
 * - My Events section with clean empty state when no events exist
 * - Section navigation for Dashboard, My Events, Create Event (Step 9.2), Registrations (Step 9.4)
 * - Adheres strictly to HackhIt design tokens: Ivory #E9E7D8, Ink #050505, Lemon #F5F04A
 */

import { useState, useEffect, useCallback } from 'react'
import type { Session } from '@supabase/supabase-js'
import {
  CalendarDays,
  CheckCircle2,
  Users,
  Compass,
  AlertCircle,
  RefreshCw,
  Lock,
  ArrowRight,
  PlusCircle,
  ClipboardList,
  LayoutDashboard,
  Calendar,
  MapPin,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react'

import { TopNav } from './TopNav'
import { checkOrganizerAccess, fetchOrganizerDashboardData } from '../lib/organizers'
import type {
  OrganizerRoleCheckResult,
  OrganizerSummaryMetrics,
  OrganizerEventItem,
} from '../types/organizers'

export interface OrganizerDashboardProps {
  session?: Session | null
  onNavigateToHome: () => void
  onNavigateToCommunity: () => void
  onNavigateToHackathons: () => void
  onNavigateToMyRegistrations: () => void
  onNavigateToProfile: () => void
  onNavigateToLogin: (redirect?: string) => void
  onNavigateToSignup: () => void
  onNavigateToEventDetails?: (id: string) => void
  onSignOut: () => void
  /**
   * Optional prop for verification and testing
   */
  forcedRoleCheck?: OrganizerRoleCheckResult
}

export function OrganizerDashboard({
  session,
  onNavigateToHome,
  onNavigateToCommunity,
  onNavigateToHackathons,
  onNavigateToMyRegistrations,
  onNavigateToProfile,
  onNavigateToLogin,
  onNavigateToSignup,
  onNavigateToEventDetails,
  onSignOut,
  forcedRoleCheck,
}: OrganizerDashboardProps) {
  // Navigation / Tab state within dashboard
  const [activeTab, setActiveTab] = useState<'dashboard' | 'my-events'>('dashboard')

  // Authorization check state
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const [authResult, setAuthResult] = useState<OrganizerRoleCheckResult>({
    isOrganizer: false,
    roleState: 'unauthenticated',
  })

  // Dashboard data state
  const [isLoadingData, setIsLoadingData] = useState(false)
  const [dataError, setDataError] = useState<string | null>(null)
  const [isPendingSchema, setIsPendingSchema] = useState(false)
  const [metrics, setMetrics] = useState<OrganizerSummaryMetrics>({
    totalEventsCreated: 0,
    publishedEventsCount: 0,
    totalRegistrationsCount: 0,
  })
  const [events, setEvents] = useState<OrganizerEventItem[]>([])

  // Verify organizer authorization
  const verifyAuthorization = useCallback(async () => {
    setIsCheckingAuth(true)
    try {
      if (forcedRoleCheck) {
        setAuthResult(forcedRoleCheck)
        setIsCheckingAuth(false)
        return
      }

      const res = await checkOrganizerAccess()
      setAuthResult(res)
    } catch (err) {
      setAuthResult({
        isOrganizer: false,
        roleState: 'error',
        error: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setIsCheckingAuth(false)
    }
  }, [forcedRoleCheck])

  // Load real metrics and events for authorized organizer
  const loadDashboardData = useCallback(async () => {
    setIsLoadingData(true)
    setDataError(null)
    setIsPendingSchema(false)

    try {
      const res = await fetchOrganizerDashboardData()
      if (res.error) {
        setDataError(res.error)
        setIsPendingSchema(res.isPendingSchema)
      } else {
        setMetrics(res.metrics)
        setEvents(res.events)
      }
    } catch (err) {
      setDataError(err instanceof Error ? err.message : 'Failed to load organizer dashboard data.')
    } finally {
      setIsLoadingData(false)
    }
  }, [])

  useEffect(() => {
    verifyAuthorization()
  }, [verifyAuthorization, session])

  useEffect(() => {
    if (authResult.isOrganizer) {
      loadDashboardData()
    }
  }, [authResult.isOrganizer, loadDashboardData])

  // Format date helper
  const formatDateRange = (start?: string | null, end?: string | null) => {
    if (!start && !end) return 'Dates TBA'
    if (start && !end) {
      return new Date(start).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    }
    if (start && end) {
      const s = new Date(start).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      })
      const e = new Date(end).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
      return `${s} – ${e}`
    }
    return 'Dates TBA'
  }

  // ---------------------------------------------------------------------------
  // 1. LOADING AUTHENTICATION STATE
  // ---------------------------------------------------------------------------
  if (isCheckingAuth) {
    return (
      <div className="site-shell min-h-screen bg-[#E9E7D8] text-[#050505] flex flex-col w-full">
        <TopNav
          session={session}
          onNavigateToHome={onNavigateToHome}
          onNavigateToCommunity={onNavigateToCommunity}
          onNavigateToHackathons={onNavigateToHackathons}
          onNavigateToMyRegistrations={onNavigateToMyRegistrations}
          onNavigateToProfile={onNavigateToProfile}
          onNavigateToLogin={() => onNavigateToLogin('organizer')}
          onNavigateToSignup={onNavigateToSignup}
          onSignOut={onSignOut}
        />
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="rounded-[28px] border-[2.5px] border-[#050505] bg-white p-8 sm:p-12 text-center shadow-[6px_6px_0_#050505] max-w-md w-full space-y-4">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border-[2px] border-[#050505] bg-[#F5F04A] shadow-[3px_3px_0_#050505] animate-pulse">
              <RefreshCw size={24} className="text-[#050505] animate-spin" />
            </div>
            <h2 className="display-font text-2xl uppercase text-[#050505]">
              Verifying Organizer Credentials
            </h2>
            <p className="text-xs sm:text-sm text-[#050505]/75">
              Confirming authorized permissions against campus security policies...
            </p>
          </div>
        </main>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // 2. UNAUTHENTICATED ACCESS STATE
  // ---------------------------------------------------------------------------
  if (authResult.roleState === 'unauthenticated' || !session) {
    return (
      <div className="site-shell min-h-screen bg-[#E9E7D8] text-[#050505] flex flex-col w-full">
        <TopNav
          session={session}
          onNavigateToHome={onNavigateToHome}
          onNavigateToCommunity={onNavigateToCommunity}
          onNavigateToHackathons={onNavigateToHackathons}
          onNavigateToMyRegistrations={onNavigateToMyRegistrations}
          onNavigateToProfile={onNavigateToProfile}
          onNavigateToLogin={() => onNavigateToLogin('organizer')}
          onNavigateToSignup={onNavigateToSignup}
          onSignOut={onSignOut}
        />
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="rounded-[28px] border-[2.5px] border-[#050505] bg-white p-8 sm:p-12 text-center shadow-[6px_6px_0_#050505] max-w-lg w-full space-y-6">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border-[2px] border-[#050505] bg-[#F5F04A] shadow-[3px_3px_0_#050505]">
              <Lock size={30} className="text-[#050505]" />
            </div>

            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-[#050505] bg-[#E9E7D8] px-3 py-0.5 text-[10px] font-black uppercase text-[#050505]">
                <span>Authentication Required</span>
              </div>
              <h1 className="display-font text-3xl sm:text-4xl uppercase text-[#050505]">
                Organizer Portal Sign-In
              </h1>
              <p className="text-xs sm:text-sm text-[#050505]/80 leading-relaxed">
                Please sign in with your campus organizer account to view your dashboard, manage event listings, and track student registrations.
              </p>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => onNavigateToLogin('organizer')}
                className="w-full sm:w-auto min-h-[46px] cursor-pointer inline-flex items-center justify-center gap-2 rounded-full border-[2px] border-[#050505] bg-[#F5F04A] px-6 text-xs font-black uppercase tracking-wider text-[#050505] shadow-[3px_3px_0_#050505] hover:bg-white hover:-translate-y-0.5 transition-all"
              >
                <span>Sign In to Continue</span>
                <ArrowRight size={14} />
              </button>
              <button
                type="button"
                onClick={onNavigateToHome}
                className="w-full sm:w-auto min-h-[46px] cursor-pointer inline-flex items-center justify-center gap-2 rounded-full border-[2px] border-[#050505] bg-[#E9E7D8] px-6 text-xs font-bold uppercase tracking-wider text-[#050505] shadow-[2px_2px_0_#050505] hover:bg-white transition-all"
              >
                <span>Back to Home</span>
              </button>
            </div>
          </div>
        </main>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // 3. ACCESS DENIED / UNAUTHORIZED STUDENT STATE
  // ---------------------------------------------------------------------------
  if (!authResult.isOrganizer) {
    const isUninitialized = authResult.roleState === 'uninitialized'

    return (
      <div className="site-shell min-h-screen bg-[#E9E7D8] text-[#050505] flex flex-col w-full">
        <TopNav
          session={session}
          onNavigateToHome={onNavigateToHome}
          onNavigateToCommunity={onNavigateToCommunity}
          onNavigateToHackathons={onNavigateToHackathons}
          onNavigateToMyRegistrations={onNavigateToMyRegistrations}
          onNavigateToProfile={onNavigateToProfile}
          onNavigateToLogin={() => onNavigateToLogin('organizer')}
          onNavigateToSignup={onNavigateToSignup}
          onSignOut={onSignOut}
        />
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="rounded-[28px] border-[2.5px] border-[#050505] bg-white p-8 sm:p-12 text-center shadow-[6px_6px_0_#050505] max-w-lg w-full space-y-6">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border-[2px] border-[#050505] bg-amber-100 text-amber-900 shadow-[3px_3px_0_#050505]">
              <ShieldAlert size={32} />
            </div>

            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-[#050505] bg-amber-50 px-3 py-0.5 text-[10px] font-black uppercase text-amber-950">
                <span>Access Restricted</span>
              </div>
              <h1 className="display-font text-3xl sm:text-4xl uppercase text-[#050505]">
                Organizer Access Required
              </h1>
              <p className="text-xs sm:text-sm text-[#050505]/80 leading-relaxed">
                {isUninitialized
                  ? 'The organizer authorization registry is currently awaiting administrative setup. Student accounts cannot access the organizer hub at this time.'
                  : 'This portal is reserved for verified campus hackathon organizers. Your account is currently registered as a student participant.'}
              </p>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={onNavigateToHackathons}
                className="w-full sm:w-auto min-h-[46px] cursor-pointer inline-flex items-center justify-center gap-2 rounded-full border-[2px] border-[#050505] bg-[#F5F04A] px-6 text-xs font-black uppercase tracking-wider text-[#050505] shadow-[3px_3px_0_#050505] hover:bg-white hover:-translate-y-0.5 transition-all"
              >
                <Compass size={14} />
                <span>Explore Hackathons</span>
              </button>
              <button
                type="button"
                onClick={onNavigateToCommunity}
                className="w-full sm:w-auto min-h-[46px] cursor-pointer inline-flex items-center justify-center gap-2 rounded-full border-[2px] border-[#050505] bg-[#E9E7D8] px-6 text-xs font-bold uppercase tracking-wider text-[#050505] shadow-[2px_2px_0_#050505] hover:bg-white transition-all"
              >
                <Users size={14} />
                <span>Campus Community</span>
              </button>
            </div>
          </div>
        </main>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // 4. AUTHORIZED ORGANIZER DASHBOARD
  // ---------------------------------------------------------------------------
  return (
    <div className="site-shell min-h-screen bg-[#E9E7D8] text-[#050505] flex flex-col w-full">
      <TopNav
        session={session}
        onNavigateToHome={onNavigateToHome}
        onNavigateToCommunity={onNavigateToCommunity}
        onNavigateToHackathons={onNavigateToHackathons}
        onNavigateToMyRegistrations={onNavigateToMyRegistrations}
        onNavigateToProfile={onNavigateToProfile}
        onNavigateToLogin={() => onNavigateToLogin('organizer')}
        onNavigateToSignup={onNavigateToSignup}
        onSignOut={onSignOut}
      />

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* DASHBOARD HEADER */}
        <header className="rounded-[28px] border-[2.5px] border-[#050505] bg-white p-6 sm:p-10 shadow-[6px_6px_0_#050505] relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#050505] bg-[#F5F04A] px-3 py-0.5 text-[10px] font-black uppercase text-[#050505] shadow-[1.5px_1.5px_0_#050505]">
                  <CheckCircle2 size={11} className="text-[#050505]" />
                  <span>Verified Organizer</span>
                </span>
                {authResult.organizationName && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[#050505] bg-[#E9E7D8] px-3 py-0.5 text-[10px] font-bold text-[#050505]">
                    {authResult.organizationName}
                  </span>
                )}
              </div>

              <h1 className="display-font text-3xl sm:text-5xl uppercase tracking-tight text-[#050505]">
                Organizer Dashboard
              </h1>
              <p className="text-xs sm:text-sm text-[#050505]/75 leading-relaxed">
                Oversee campus hackathons, track student registrations, and manage competition milestones with real-time backend updates.
              </p>
            </div>

            {/* Refresh Action */}
            <div className="shrink-0 flex items-center gap-3">
              <button
                type="button"
                onClick={loadDashboardData}
                disabled={isLoadingData}
                className="cursor-pointer inline-flex items-center gap-2 rounded-full border-[2px] border-[#050505] bg-[#E9E7D8] px-4 py-2 text-xs font-bold uppercase tracking-wider text-[#050505] shadow-[2px_2px_0_#050505] hover:bg-white hover:-translate-y-0.5 transition-all disabled:opacity-50"
                title="Refresh Metrics"
              >
                <RefreshCw size={13} className={isLoadingData ? 'animate-spin' : ''} />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {/* DASHBOARD NAVIGATION BAR */}
          <nav
            aria-label="Organizer navigation"
            className="mt-8 pt-6 border-t border-[#050505]/10 flex flex-wrap items-center gap-2.5 sm:gap-3"
          >
            {/* Dashboard Tab */}
            <button
              type="button"
              onClick={() => setActiveTab('dashboard')}
              className={`cursor-pointer inline-flex items-center gap-2 rounded-xl border-[2px] px-4 py-2 text-xs font-black uppercase tracking-wider transition-all ${
                activeTab === 'dashboard'
                  ? 'border-[#050505] bg-[#F5F04A] text-[#050505] shadow-[3px_3px_0_#050505]'
                  : 'border-[#050505]/20 bg-stone-50 text-[#050505]/70 hover:border-[#050505] hover:text-[#050505]'
              }`}
            >
              <LayoutDashboard size={14} />
              <span>Dashboard</span>
            </button>

            {/* My Events Tab */}
            <button
              type="button"
              onClick={() => setActiveTab('my-events')}
              className={`cursor-pointer inline-flex items-center gap-2 rounded-xl border-[2px] px-4 py-2 text-xs font-black uppercase tracking-wider transition-all ${
                activeTab === 'my-events'
                  ? 'border-[#050505] bg-[#F5F04A] text-[#050505] shadow-[3px_3px_0_#050505]'
                  : 'border-[#050505]/20 bg-stone-50 text-[#050505]/70 hover:border-[#050505] hover:text-[#050505]'
              }`}
            >
              <CalendarDays size={14} />
              <span>My Events ({metrics.totalEventsCreated})</span>
            </button>

            {/* Create Event (Disabled until Step 9.2) */}
            <div className="relative group">
              <button
                type="button"
                disabled
                className="cursor-not-allowed inline-flex items-center gap-2 rounded-xl border-[2px] border-stone-300 bg-stone-100 px-4 py-2 text-xs font-bold uppercase tracking-wider text-stone-400"
                aria-disabled="true"
              >
                <PlusCircle size={14} />
                <span>Create Event</span>
                <span className="rounded-full bg-stone-200 px-2 py-0.2 text-[9px] font-black text-stone-500 uppercase">
                  Available in Step 9.2
                </span>
              </button>
            </div>

            {/* Registrations (Disabled until Step 9.4) */}
            <div className="relative group">
              <button
                type="button"
                disabled
                className="cursor-not-allowed inline-flex items-center gap-2 rounded-xl border-[2px] border-stone-300 bg-stone-100 px-4 py-2 text-xs font-bold uppercase tracking-wider text-stone-400"
                aria-disabled="true"
              >
                <ClipboardList size={14} />
                <span>Registrations</span>
                <span className="rounded-full bg-stone-200 px-2 py-0.2 text-[9px] font-black text-stone-500 uppercase">
                  Available in Step 9.4
                </span>
              </button>
            </div>
          </nav>
        </header>

        {/* ERROR STATE BANNER */}
        {dataError && !isLoadingData && (
          <div
            role="alert"
            className="rounded-[24px] border-[2.5px] border-red-600 bg-red-50 p-6 text-center shadow-[5px_5px_0_#dc2626] space-y-3"
          >
            <div className="mx-auto grid h-10 w-10 place-items-center rounded-xl border-2 border-red-600 bg-white text-red-600 shadow-[2px_2px_0_#dc2626]">
              <AlertCircle size={20} />
            </div>
            <div className="space-y-1 max-w-lg mx-auto">
              <h2 className="display-font text-lg uppercase text-red-900">
                Failed to Load Dashboard Metrics
              </h2>
              <p className="text-xs text-red-800">{dataError}</p>
              {isPendingSchema && (
                <p className="text-[11px] text-red-700 font-mono mt-1">
                  Database schema migration may be pending.
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={loadDashboardData}
              className="inline-flex cursor-pointer items-center gap-2 rounded-full border-2 border-red-900 bg-red-900 px-5 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-[2px_2px_0_#000] hover:bg-red-800 transition-colors"
            >
              <RefreshCw size={12} />
              <span>Retry Query</span>
            </button>
          </div>
        )}

        {/* SUMMARY METRICS CARDS */}
        <section aria-label="Key metrics" className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* 1. Events Created */}
          <article className="rounded-[24px] border-[2.5px] border-[#050505] bg-white p-6 shadow-[5px_5px_0_#050505] flex flex-col justify-between space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-[#050505]/60">
                Total Events Created
              </span>
              <div className="grid h-10 w-10 place-items-center rounded-xl border-[2px] border-[#050505] bg-[#E9E7D8] shadow-[2px_2px_0_#050505]">
                <CalendarDays size={18} className="text-[#050505]" />
              </div>
            </div>
            <div>
              <p className="display-font text-4xl sm:text-5xl font-black text-[#050505]">
                {isLoadingData ? '...' : metrics.totalEventsCreated}
              </p>
              <p className="text-[11px] text-[#050505]/70 mt-1">
                Competitions created under your account
              </p>
            </div>
          </article>

          {/* 2. Published Events */}
          <article className="rounded-[24px] border-[2.5px] border-[#050505] bg-white p-6 shadow-[5px_5px_0_#050505] flex flex-col justify-between space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-[#050505]/60">
                Published Events
              </span>
              <div className="grid h-10 w-10 place-items-center rounded-xl border-[2px] border-[#050505] bg-[#F5F04A] shadow-[2px_2px_0_#050505]">
                <CheckCircle2 size={18} className="text-[#050505]" />
              </div>
            </div>
            <div>
              <p className="display-font text-4xl sm:text-5xl font-black text-[#050505]">
                {isLoadingData ? '...' : metrics.publishedEventsCount}
              </p>
              <p className="text-[11px] text-[#050505]/70 mt-1">
                Publicly active on the discovery board
              </p>
            </div>
          </article>

          {/* 3. Registrations */}
          <article className="rounded-[24px] border-[2.5px] border-[#050505] bg-white p-6 shadow-[5px_5px_0_#050505] flex flex-col justify-between space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-[#050505]/60">
                Total Registrations
              </span>
              <div className="grid h-10 w-10 place-items-center rounded-xl border-[2px] border-[#050505] bg-[#E9E7D8] shadow-[2px_2px_0_#050505]">
                <Users size={18} className="text-[#050505]" />
              </div>
            </div>
            <div>
              <p className="display-font text-4xl sm:text-5xl font-black text-[#050505]">
                {isLoadingData ? '...' : metrics.totalRegistrationsCount}
              </p>
              <p className="text-[11px] text-[#050505]/70 mt-1">
                Verified hacker and team registrations
              </p>
            </div>
          </article>
        </section>

        {/* MY EVENTS SECTION */}
        <section aria-labelledby="my-events-heading" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2
                id="my-events-heading"
                className="display-font text-2xl sm:text-3xl uppercase tracking-tight text-[#050505]"
              >
                My Events
              </h2>
              <p className="text-xs text-[#050505]/70">
                Hackathons and competitions registered under your organizer profile
              </p>
            </div>
          </div>

          {/* LOADING EVENTS STATE */}
          {isLoadingData && (
            <div className="space-y-4" role="status" aria-label="Loading events">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="rounded-[24px] border-[2px] border-[#050505]/30 bg-white/70 p-6 animate-pulse space-y-3"
                >
                  <div className="h-5 w-1/3 bg-stone-200 rounded" />
                  <div className="h-4 w-1/2 bg-stone-200 rounded" />
                </div>
              ))}
            </div>
          )}

          {/* EMPTY EVENTS STATE */}
          {!isLoadingData && !dataError && events.length === 0 && (
            <div className="rounded-[28px] border-[2.5px] border-[#050505] bg-white p-8 sm:p-14 text-center shadow-[6px_6px_0_#050505] space-y-6">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border-[2px] border-[#050505] bg-[#F5F04A] shadow-[3px_3px_0_#050505]">
                <CalendarDays size={30} className="text-[#050505]" />
              </div>

              <div className="space-y-2 max-w-md mx-auto">
                <div className="inline-flex items-center gap-1.5 rounded-full border border-[#050505] bg-[#E9E7D8] px-3 py-0.5 text-[10px] font-black uppercase text-[#050505]">
                  <span>No Events Registered</span>
                </div>
                <h3 className="display-font text-3xl uppercase text-[#050505] mt-2">
                  No Events Created Yet
                </h3>
                <p className="text-xs sm:text-sm text-[#050505]/75 leading-relaxed">
                  You haven't created any hackathons under this organizer account yet. Once published, your event details and live hacker registration roster will be accessible right here.
                </p>
                <p className="text-[11px] font-bold text-[#050505]/60 uppercase tracking-wider pt-2">
                  Event creation workflow will be available in the upcoming release.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={onNavigateToHackathons}
                  className="inline-flex min-h-[46px] cursor-pointer items-center gap-2 rounded-full border-[2px] border-[#050505] bg-[#F5F04A] px-7 text-xs font-black uppercase tracking-wider text-[#050505] shadow-[3px_3px_0_#050505] hover:bg-white hover:-translate-y-0.5 transition-all"
                >
                  <Compass size={14} />
                  <span>View Student Discovery Page</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* REAL EVENTS LIST */}
          {!isLoadingData && !dataError && events.length > 0 && (
            <div className="grid grid-cols-1 gap-4">
              {events.map((event) => (
                <article
                  key={event.id}
                  className="rounded-[24px] border-[2.5px] border-[#050505] bg-white p-6 shadow-[5px_5px_0_#050505] space-y-4 hover:translate-x-0.5 transition-all"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full border border-[#050505] px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                            event.status === 'published'
                              ? 'bg-emerald-100 text-emerald-950'
                              : 'bg-amber-100 text-amber-950'
                          }`}
                        >
                          {event.status}
                        </span>
                        <span className="rounded-full border border-[#050505]/30 bg-stone-100 px-2.5 py-0.5 text-[10px] font-bold uppercase text-[#050505]/70">
                          {event.category}
                        </span>
                        <span className="rounded-full border border-[#050505]/30 bg-stone-100 px-2.5 py-0.5 text-[10px] font-bold uppercase text-[#050505]/70">
                          {event.mode}
                        </span>
                      </div>
                      <h3 className="display-font text-xl sm:text-2xl uppercase text-[#050505] pt-1">
                        {event.title}
                      </h3>
                    </div>

                    {onNavigateToEventDetails && (
                      <button
                        type="button"
                        onClick={() => onNavigateToEventDetails(event.id)}
                        className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-[#050505] bg-[#E9E7D8] px-4 py-2 text-xs font-bold uppercase text-[#050505] shadow-[1.5px_1.5px_0_#050505] hover:bg-white cursor-pointer"
                      >
                        <span>View Details</span>
                        <ExternalLink size={12} />
                      </button>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-[#050505]/80 pt-2 border-t border-[#050505]/10">
                    <span className="inline-flex items-center gap-1.5">
                      <Calendar size={13} />
                      <span>{formatDateRange(event.start_date, event.end_date)}</span>
                    </span>
                    {event.location && (
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin size={13} />
                        <span>{event.location}</span>
                      </span>
                    )}
                    {event.registration_deadline && (
                      <span className="inline-flex items-center gap-1.5">
                        <span>Deadline: {new Date(event.registration_deadline).toLocaleDateString()}</span>
                      </span>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
