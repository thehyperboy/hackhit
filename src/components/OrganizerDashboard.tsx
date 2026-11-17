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
  Megaphone,
  Search,
  Check,
  Loader2,
  Trophy,
} from 'lucide-react'

import { TopNav } from './TopNav'
import {
  checkOrganizerAccess,
  fetchOrganizerDashboardData,
  createOrganizerHackathon,
  fetchOrganizerParticipants,
} from '../lib/organizers'
import { createPost } from '../lib/community'
import type {
  OrganizerRoleCheckResult,
  OrganizerSummaryMetrics,
  OrganizerEventItem,
  OrganizerParticipantItem,
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
  const [activeTab, setActiveTab] = useState<
    'dashboard' | 'my-events' | 'create-event' | 'registrations' | 'updates'
  >('dashboard')

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

  // Create Event Form state
  const [createTitle, setCreateTitle] = useState('')
  const [createCategory, setCreateCategory] = useState<
    'AI/ML' | 'Web Development' | 'Blockchain' | 'Data Science' | 'Open Innovation'
  >('AI/ML')
  const [createMode, setCreateMode] = useState<'Online' | 'Offline' | 'Hybrid'>('Online')
  const [createLocation, setCreateLocation] = useState('')
  const [createPrizePool, setCreatePrizePool] = useState('')
  const [createDescription, setCreateDescription] = useState('')
  const [createCoverImage, setCreateCoverImage] = useState('')
  const [createDeadline, setCreateDeadline] = useState('')
  const [createStartDate, setCreateStartDate] = useState('')
  const [createEndDate, setCreateEndDate] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [createSuccess, setCreateSuccess] = useState<string | null>(null)

  // Participants Tracking state
  const [participants, setParticipants] = useState<OrganizerParticipantItem[]>([])
  const [isLoadingParticipants, setIsLoadingParticipants] = useState(false)
  const [participantSearch, setParticipantSearch] = useState('')
  const [participantsError, setParticipantsError] = useState<string | null>(null)

  // Campus Announcement state
  const [updateContent, setUpdateContent] = useState('')
  const [updateImage, setUpdateImage] = useState('')
  const [isPostingUpdate, setIsPostingUpdate] = useState(false)
  const [updateSuccess, setUpdateSuccess] = useState<string | null>(null)
  const [updateError, setUpdateError] = useState<string | null>(null)

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

  // Load participants for tracking
  const loadParticipants = useCallback(async () => {
    setIsLoadingParticipants(true)
    setParticipantsError(null)
    try {
      const res = await fetchOrganizerParticipants()
      if (res.error) {
        setParticipantsError(res.error)
      } else {
        setParticipants(res.participants)
      }
    } catch (err) {
      setParticipantsError(err instanceof Error ? err.message : 'Failed to load participants.')
    } finally {
      setIsLoadingParticipants(false)
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

  useEffect(() => {
    if (authResult.isOrganizer && activeTab === 'registrations') {
      loadParticipants()
    }
  }, [authResult.isOrganizer, activeTab, loadParticipants])

  // Handle Create Hackathon Submission
  const handleCreateHackathonSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!createTitle.trim()) {
      setCreateError('Please enter a hackathon title.')
      return
    }
    setIsCreating(true)
    setCreateError(null)
    setCreateSuccess(null)
    try {
      const res = await createOrganizerHackathon({
        title: createTitle,
        category: createCategory,
        mode: createMode,
        location: createLocation,
        prize_pool: createPrizePool,
        description: createDescription,
        cover_image_url: createCoverImage,
        start_date: createStartDate || undefined,
        end_date: createEndDate || undefined,
        registration_deadline: createDeadline || undefined,
      })
      if (res.error) {
        setCreateError(res.error)
      } else {
        setCreateSuccess(`Hackathon "${createTitle}" published successfully!`)
        setCreateTitle('')
        setCreateLocation('')
        setCreatePrizePool('')
        setCreateDescription('')
        setCreateCoverImage('')
        setCreateDeadline('')
        setCreateStartDate('')
        setCreateEndDate('')
        await loadDashboardData()
        setTimeout(() => {
          setActiveTab('my-events')
        }, 1200)
      }
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create hackathon.')
    } finally {
      setIsCreating(false)
    }
  }

  // Handle Post Campus Announcement
  const handlePostUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!updateContent.trim()) {
      setUpdateError('Please enter your announcement message.')
      return
    }
    setIsPostingUpdate(true)
    setUpdateError(null)
    setUpdateSuccess(null)
    try {
      const orgTag = authResult.organizationName
        ? `[${authResult.organizationName.toUpperCase()} OFFICIAL ANNOUNCEMENT]`
        : '[OFFICIAL UNIVERSITY ANNOUNCEMENT]'
      const fullText = `${orgTag}\n\n${updateContent.trim()}`
      const res = await createPost({ content: fullText, userId: session?.user?.id })
      if (res.error) {
        setUpdateError(res.error)
      } else {
        setUpdateSuccess('Official announcement published to the Community Feed!')
        setUpdateContent('')
        setUpdateImage('')
      }
    } catch (err) {
      setUpdateError(err instanceof Error ? err.message : 'Failed to post announcement.')
    } finally {
      setIsPostingUpdate(false)
    }
  }

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
            className="mt-8 pt-6 border-t border-[#050505]/10 flex flex-wrap items-center gap-2 sm:gap-3"
          >
            {/* Dashboard Tab */}
            <button
              type="button"
              onClick={() => setActiveTab('dashboard')}
              className={`cursor-pointer inline-flex items-center gap-2 rounded-xl border-[2px] px-3.5 py-2 text-xs font-black uppercase tracking-wider transition-all ${
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
              className={`cursor-pointer inline-flex items-center gap-2 rounded-xl border-[2px] px-3.5 py-2 text-xs font-black uppercase tracking-wider transition-all ${
                activeTab === 'my-events'
                  ? 'border-[#050505] bg-[#F5F04A] text-[#050505] shadow-[3px_3px_0_#050505]'
                  : 'border-[#050505]/20 bg-stone-50 text-[#050505]/70 hover:border-[#050505] hover:text-[#050505]'
              }`}
            >
              <CalendarDays size={14} />
              <span>My Events ({metrics.totalEventsCreated})</span>
            </button>

            {/* Create Event Tab */}
            <button
              type="button"
              onClick={() => setActiveTab('create-event')}
              className={`cursor-pointer inline-flex items-center gap-2 rounded-xl border-[2px] px-3.5 py-2 text-xs font-black uppercase tracking-wider transition-all ${
                activeTab === 'create-event'
                  ? 'border-[#050505] bg-[#F5F04A] text-[#050505] shadow-[3px_3px_0_#050505]'
                  : 'border-[#050505]/20 bg-stone-50 text-[#050505]/70 hover:border-[#050505] hover:text-[#050505]'
              }`}
            >
              <PlusCircle size={14} />
              <span>Create Hackathon</span>
            </button>

            {/* Registrations Tab */}
            <button
              type="button"
              onClick={() => setActiveTab('registrations')}
              className={`cursor-pointer inline-flex items-center gap-2 rounded-xl border-[2px] px-3.5 py-2 text-xs font-black uppercase tracking-wider transition-all ${
                activeTab === 'registrations'
                  ? 'border-[#050505] bg-[#F5F04A] text-[#050505] shadow-[3px_3px_0_#050505]'
                  : 'border-[#050505]/20 bg-stone-50 text-[#050505]/70 hover:border-[#050505] hover:text-[#050505]'
              }`}
            >
              <ClipboardList size={14} />
              <span>Track Participants ({participants.length || metrics.totalRegistrationsCount})</span>
            </button>

            {/* Campus Updates Tab */}
            <button
              type="button"
              onClick={() => setActiveTab('updates')}
              className={`cursor-pointer inline-flex items-center gap-2 rounded-xl border-[2px] px-3.5 py-2 text-xs font-black uppercase tracking-wider transition-all ${
                activeTab === 'updates'
                  ? 'border-[#050505] bg-[#F5F04A] text-[#050505] shadow-[3px_3px_0_#050505]'
                  : 'border-[#050505]/20 bg-stone-50 text-[#050505]/70 hover:border-[#050505] hover:text-[#050505]'
              }`}
            >
              <Megaphone size={14} />
              <span>Campus Updates</span>
            </button>
          </nav>
        </header>

        {/* ERROR STATE BANNER */}
        {isPendingSchema && (
          <div className="rounded-[24px] border-[2px] border-amber-600 bg-amber-50 p-4 text-xs font-bold text-amber-900 shadow-[3px_3px_0_#050505]">
            Schema initialization pending in database. Events will populate as tables are created.
          </div>
        )}

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

        {/* TAB 1: DASHBOARD OVERVIEW */}
        {activeTab === 'dashboard' && (
          <div className="space-y-8">
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
                    Hackathons created by your university
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
                    Live and accepting student registrations
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
                    Student participants tracked across events
                  </p>
                </div>
              </article>
            </section>

            {/* QUICK ACTIONS FOR UNIVERSITIES */}
            <section className="rounded-[28px] border-[2.5px] border-[#050505] bg-white p-6 sm:p-8 shadow-[5px_5px_0_#050505] space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="display-font text-2xl uppercase tracking-tight text-[#050505]">
                    Organizer Workflows
                  </h2>
                  <p className="text-xs text-[#050505]/70">
                    Tools exclusively available to verified college and university accounts
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('create-event')}
                  className="rounded-2xl border-2 border-[#050505] bg-[#F5F04A] p-5 text-left shadow-[3px_3px_0_#050505] hover:bg-white transition-all cursor-pointer space-y-2 group"
                >
                  <div className="grid h-10 w-10 place-items-center rounded-xl border-2 border-[#050505] bg-white shadow-[1.5px_1.5px_0_#050505]">
                    <PlusCircle size={20} className="text-[#050505]" />
                  </div>
                  <h3 className="font-extrabold text-sm uppercase text-[#050505]">
                    Create Hackathon
                  </h3>
                  <p className="text-xs text-[#050505]/80 leading-relaxed">
                    Publish an official university hackathon, configure prize pools, and open registrations.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('registrations')}
                  className="rounded-2xl border-2 border-[#050505] bg-[#E9E7D8] p-5 text-left shadow-[3px_3px_0_#050505] hover:bg-white transition-all cursor-pointer space-y-2 group"
                >
                  <div className="grid h-10 w-10 place-items-center rounded-xl border-2 border-[#050505] bg-white shadow-[1.5px_1.5px_0_#050505]">
                    <Users size={20} className="text-[#050505]" />
                  </div>
                  <h3 className="font-extrabold text-sm uppercase text-[#050505]">
                    Track Participants
                  </h3>
                  <p className="text-xs text-[#050505]/80 leading-relaxed">
                    Inspect verified student registrations, team formations, and contact information.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('updates')}
                  className="rounded-2xl border-2 border-[#050505] bg-white p-5 text-left shadow-[3px_3px_0_#050505] hover:bg-[#F5F04A] transition-all cursor-pointer space-y-2 group"
                >
                  <div className="grid h-10 w-10 place-items-center rounded-xl border-2 border-[#050505] bg-[#E9E7D8] shadow-[1.5px_1.5px_0_#050505]">
                    <Megaphone size={20} className="text-[#050505]" />
                  </div>
                  <h3 className="font-extrabold text-sm uppercase text-[#050505]">
                    Post Campus Update
                  </h3>
                  <p className="text-xs text-[#050505]/80 leading-relaxed">
                    Broadcast verified institutional announcements and timeline updates to Community.
                  </p>
                </button>
              </div>
            </section>
          </div>
        )}

        {/* TAB 2: MY EVENTS */}
        {activeTab === 'my-events' && (
          <section aria-labelledby="my-events-heading" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2
                  id="my-events-heading"
                  className="display-font text-2xl sm:text-3xl uppercase tracking-tight text-[#050505]"
                >
                  My Hackathons
                </h2>
                <p className="text-xs text-[#050505]/70">
                  Hackathons organized by your college/university
                </p>
              </div>

              <button
                type="button"
                onClick={() => setActiveTab('create-event')}
                className="inline-flex cursor-pointer items-center gap-2 rounded-full border-2 border-[#050505] bg-[#F5F04A] px-4 py-2 text-xs font-black uppercase tracking-wider text-[#050505] shadow-[2px_2px_0_#050505] hover:bg-white transition-all"
              >
                <PlusCircle size={14} />
                <span>Create New Hackathon</span>
              </button>
            </div>

            {/* EMPTY EVENTS STATE */}
            {!isLoadingData && !dataError && events.length === 0 && (
              <div className="rounded-[28px] border-[2.5px] border-[#050505] bg-white p-8 sm:p-14 text-center shadow-[6px_6px_0_#050505] space-y-6">
                <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border-[2px] border-[#050505] bg-[#F5F04A] shadow-[3px_3px_0_#050505]">
                  <Trophy size={30} className="text-[#050505]" />
                </div>

                <div className="space-y-2 max-w-md mx-auto">
                  <h3 className="display-font text-3xl uppercase text-[#050505] mt-2">
                    No Events Created Yet
                  </h3>
                  <p className="text-xs sm:text-sm text-[#050505]/75 leading-relaxed">
                    Your university has not created any hackathons yet. Click below to launch your first campus hackathon!
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('create-event')}
                    className="inline-flex min-h-[46px] cursor-pointer items-center gap-2 rounded-full border-[2px] border-[#050505] bg-[#F5F04A] px-7 text-xs font-black uppercase tracking-wider text-[#050505] shadow-[3px_3px_0_#050505] hover:bg-white hover:-translate-y-0.5 transition-all"
                  >
                    <PlusCircle size={14} />
                    <span>Create Your First Hackathon</span>
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
                          <span>View on Board</span>
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
        )}

        {/* TAB 3: CREATE HACKATHON FORM */}
        {activeTab === 'create-event' && (
          <section className="rounded-[28px] border-[2.5px] border-[#050505] bg-white p-6 sm:p-10 shadow-[6px_6px_0_#050505] space-y-6 max-w-3xl mx-auto">
            <div className="border-b border-[#050505]/15 pb-4">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-[#050505] bg-[#F5F04A] px-3 py-0.5 text-[10px] font-black uppercase text-[#050505] mb-2">
                <PlusCircle size={12} />
                <span>University Hackathon Authoring</span>
              </div>
              <h2 className="display-font text-3xl uppercase tracking-tight text-[#050505]">
                Create & Publish Hackathon
              </h2>
              <p className="text-xs text-[#050505]/70 mt-1">
                Launch a verified hackathon on the HackhIt campus discovery board. Only institutional representatives are authorized to publish competitions.
              </p>
            </div>

            {createSuccess && (
              <div className="rounded-xl border border-emerald-600 bg-emerald-50 p-4 text-xs text-emerald-950 font-bold flex items-center gap-2">
                <Check size={16} className="text-emerald-700 shrink-0" />
                <span>{createSuccess}</span>
              </div>
            )}

            {createError && (
              <div className="rounded-xl border border-red-600 bg-red-50 p-4 text-xs text-red-950 flex items-center gap-2">
                <AlertCircle size={16} className="text-red-600 shrink-0" />
                <span>{createError}</span>
              </div>
            )}

            <form onSubmit={handleCreateHackathonSubmit} className="space-y-4">
              {/* Title */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#050505] mb-1">
                  Hackathon Title *
                </label>
                <input
                  type="text"
                  required
                  value={createTitle}
                  onChange={(e) => setCreateTitle(e.target.value)}
                  placeholder="e.g. Malla Reddy AI Summit 2026"
                  className="w-full rounded-xl border border-[#050505] bg-white px-3.5 py-2.5 text-xs font-medium text-[#050505] outline-none focus:ring-2 focus:ring-[#F5F04A]"
                />
              </div>

              {/* Category & Mode */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#050505] mb-1">
                    Technical Category *
                  </label>
                  <select
                    value={createCategory}
                    onChange={(e) =>
                      setCreateCategory(
                        e.target.value as
                          | 'AI/ML'
                          | 'Web Development'
                          | 'Blockchain'
                          | 'Data Science'
                          | 'Open Innovation'
                      )
                    }
                    className="w-full rounded-xl border border-[#050505] bg-white px-3.5 py-2.5 text-xs font-medium text-[#050505] outline-none focus:ring-2 focus:ring-[#F5F04A]"
                  >
                    <option value="AI/ML">AI / Machine Learning</option>
                    <option value="Web Development">Web Development</option>
                    <option value="Blockchain">Blockchain & Web3</option>
                    <option value="Data Science">Data Science & Analytics</option>
                    <option value="Open Innovation">Open Innovation</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#050505] mb-1">
                    Participation Mode *
                  </label>
                  <select
                    value={createMode}
                    onChange={(e) =>
                      setCreateMode(e.target.value as 'Online' | 'Offline' | 'Hybrid')
                    }
                    className="w-full rounded-xl border border-[#050505] bg-white px-3.5 py-2.5 text-xs font-medium text-[#050505] outline-none focus:ring-2 focus:ring-[#F5F04A]"
                  >
                    <option value="Online">Online / Virtual</option>
                    <option value="Offline">Offline / In-Person</option>
                    <option value="Hybrid">Hybrid (Online & On-Campus)</option>
                  </select>
                </div>
              </div>

              {/* Location & Prize Pool */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#050505] mb-1">
                    Campus Venue / Location
                  </label>
                  <input
                    type="text"
                    value={createLocation}
                    onChange={(e) => setCreateLocation(e.target.value)}
                    placeholder="e.g. Hyderabad, Telangana or Main Auditorium"
                    className="w-full rounded-xl border border-[#050505] bg-white px-3.5 py-2.5 text-xs font-medium text-[#050505] outline-none focus:ring-2 focus:ring-[#F5F04A]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#050505] mb-1">
                    Prize Pool
                  </label>
                  <input
                    type="text"
                    value={createPrizePool}
                    onChange={(e) => setCreatePrizePool(e.target.value)}
                    placeholder="e.g. ₹1,00,000 INR in Prizes"
                    className="w-full rounded-xl border border-[#050505] bg-white px-3.5 py-2.5 text-xs font-medium text-[#050505] outline-none focus:ring-2 focus:ring-[#F5F04A]"
                  />
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#050505] mb-1">
                    Registration Deadline
                  </label>
                  <input
                    type="date"
                    value={createDeadline}
                    onChange={(e) => setCreateDeadline(e.target.value)}
                    className="w-full rounded-xl border border-[#050505] bg-white px-3.5 py-2.5 text-xs font-medium text-[#050505] outline-none focus:ring-2 focus:ring-[#F5F04A]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#050505] mb-1">
                    Event Start Date
                  </label>
                  <input
                    type="date"
                    value={createStartDate}
                    onChange={(e) => setCreateStartDate(e.target.value)}
                    className="w-full rounded-xl border border-[#050505] bg-white px-3.5 py-2.5 text-xs font-medium text-[#050505] outline-none focus:ring-2 focus:ring-[#F5F04A]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#050505] mb-1">
                    Event End Date
                  </label>
                  <input
                    type="date"
                    value={createEndDate}
                    onChange={(e) => setCreateEndDate(e.target.value)}
                    className="w-full rounded-xl border border-[#050505] bg-white px-3.5 py-2.5 text-xs font-medium text-[#050505] outline-none focus:ring-2 focus:ring-[#F5F04A]"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#050505] mb-1">
                  Hackathon Description
                </label>
                <textarea
                  rows={4}
                  value={createDescription}
                  onChange={(e) => setCreateDescription(e.target.value)}
                  placeholder="Outline the problem statements, eligible students, rules, and judging criteria..."
                  className="w-full rounded-xl border border-[#050505] bg-white px-3.5 py-2.5 text-xs font-medium text-[#050505] outline-none focus:ring-2 focus:ring-[#F5F04A] resize-y"
                />
              </div>

              {/* Cover Image URL */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#050505] mb-1">
                  Cover Image URL (Optional)
                </label>
                <input
                  type="url"
                  value={createCoverImage}
                  onChange={(e) => setCreateCoverImage(e.target.value)}
                  placeholder="https://images.unsplash.com/photo-..."
                  className="w-full rounded-xl border border-[#050505] bg-white px-3.5 py-2.5 text-xs font-medium text-[#050505] outline-none focus:ring-2 focus:ring-[#F5F04A]"
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setActiveTab('my-events')}
                  className="rounded-full border border-[#050505] bg-white px-5 py-2.5 text-xs font-bold uppercase text-[#050505] hover:bg-neutral-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="inline-flex items-center gap-2 rounded-full border-2 border-[#050505] bg-[#F5F04A] px-7 py-2.5 text-xs font-black uppercase tracking-wider text-[#050505] shadow-[3px_3px_0_#050505] hover:bg-white hover:-translate-y-0.5 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isCreating ? <Loader2 size={14} className="animate-spin" /> : <PlusCircle size={14} />}
                  <span>Publish Hackathon</span>
                </button>
              </div>
            </form>
          </section>
        )}

        {/* TAB 4: TRACK PARTICIPANTS & REGISTRATIONS */}
        {activeTab === 'registrations' && (
          <section className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="display-font text-2xl sm:text-3xl uppercase tracking-tight text-[#050505]">
                  Student Registrations & Tracking
                </h2>
                <p className="text-xs text-[#050505]/70">
                  Track students registered for your university hackathons
                </p>
              </div>

              <div className="relative min-w-[240px]">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#050505]/50" />
                <input
                  type="text"
                  value={participantSearch}
                  onChange={(e) => setParticipantSearch(e.target.value)}
                  placeholder="Filter student or hackathon..."
                  className="w-full rounded-full border border-[#050505] bg-white pl-9 pr-3.5 py-2 text-xs font-medium text-[#050505] outline-none"
                />
              </div>
            </div>

            {participantsError && (
              <div className="rounded-[20px] border-[2px] border-red-600 bg-red-50 p-4 text-xs font-bold text-red-900">
                {participantsError}
              </div>
            )}

            {isLoadingParticipants && (
              <div className="rounded-[24px] border-[2px] border-[#050505]/30 bg-white/70 p-10 text-center animate-pulse space-y-2">
                <p className="text-xs font-bold text-[#050505]/70">Loading verified student participants...</p>
              </div>
            )}

            {!isLoadingParticipants && participants.length === 0 && (
              <div className="rounded-[28px] border-[2.5px] border-[#050505] bg-white p-10 text-center shadow-[5px_5px_0_#050505] space-y-3">
                <Users size={32} className="mx-auto text-[#050505]/50" />
                <h3 className="font-extrabold text-base uppercase text-[#050505]">No Student Registrations Yet</h3>
                <p className="text-xs text-[#050505]/70 max-w-md mx-auto">
                  When students register for competitions created by your institution, their names, university affiliations, emails, and team structures will appear here in real time.
                </p>
              </div>
            )}

            {!isLoadingParticipants && participants.length > 0 && (
              <div className="rounded-[24px] border-[2.5px] border-[#050505] bg-white overflow-hidden shadow-[5px_5px_0_#050505]">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b-2 border-[#050505] bg-[#E9E7D8]/80 text-[10px] font-black uppercase tracking-wider text-[#050505]">
                        <th className="p-4">Student</th>
                        <th className="p-4">University</th>
                        <th className="p-4">Hackathon</th>
                        <th className="p-4">Email</th>
                        <th className="p-4">Registered Date</th>
                        <th className="p-4">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#050505]/10 text-xs">
                      {participants
                        .filter((p) => {
                          if (!participantSearch.trim()) return true
                          const q = participantSearch.toLowerCase()
                          return (
                            p.student_name.toLowerCase().includes(q) ||
                            p.student_email.toLowerCase().includes(q) ||
                            p.hackathon_title.toLowerCase().includes(q) ||
                            p.student_university.toLowerCase().includes(q)
                          )
                        })
                        .map((p) => (
                          <tr key={p.id} className="hover:bg-[#F5F04A]/10 transition-colors">
                            <td className="p-4 font-bold text-[#050505]">{p.student_name}</td>
                            <td className="p-4 text-[#050505]/80">{p.student_university}</td>
                            <td className="p-4 font-bold text-[#050505]">{p.hackathon_title}</td>
                            <td className="p-4 font-mono text-[11px] text-[#050505]/70">{p.student_email}</td>
                            <td className="p-4 text-[#050505]/70">
                              {new Date(p.registered_at).toLocaleDateString()}
                            </td>
                            <td className="p-4">
                              <span className="inline-block rounded-full border border-emerald-600 bg-emerald-100 px-2.5 py-0.5 text-[10px] font-black uppercase text-emerald-950">
                                {p.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        )}

        {/* TAB 5: CAMPUS ANNOUNCEMENTS & UPDATES */}
        {activeTab === 'updates' && (
          <section className="rounded-[28px] border-[2.5px] border-[#050505] bg-white p-6 sm:p-10 shadow-[6px_6px_0_#050505] space-y-6 max-w-2xl mx-auto">
            <div className="border-b border-[#050505]/15 pb-4">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-[#050505] bg-[#F5F04A] px-3 py-0.5 text-[10px] font-black uppercase text-[#050505] mb-2">
                <Megaphone size={12} />
                <span>Official Campus Broadcast</span>
              </div>
              <h2 className="display-font text-3xl uppercase tracking-tight text-[#050505]">
                Post University Update
              </h2>
              <p className="text-xs text-[#050505]/70 mt-1">
                Share competition milestones, schedule changes, or hackathon notices directly to the HackhIt community feed with your verified university credentials.
              </p>
            </div>

            {updateSuccess && (
              <div className="rounded-xl border border-emerald-600 bg-emerald-50 p-4 text-xs text-emerald-950 font-bold flex items-center gap-2">
                <Check size={16} className="text-emerald-700 shrink-0" />
                <span>{updateSuccess}</span>
              </div>
            )}

            {updateError && (
              <div className="rounded-xl border border-red-600 bg-red-50 p-4 text-xs text-red-950 flex items-center gap-2">
                <AlertCircle size={16} className="text-red-600 shrink-0" />
                <span>{updateError}</span>
              </div>
            )}

            <form onSubmit={handlePostUpdateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#050505] mb-1">
                  Official Announcement *
                </label>
                <textarea
                  required
                  rows={5}
                  value={updateContent}
                  onChange={(e) => setUpdateContent(e.target.value)}
                  placeholder="e.g. Greetings hackers! Registration for Malla Reddy Web Cup 2026 is closing in 48 hours. Ensure your team roster is confirmed..."
                  className="w-full rounded-xl border border-[#050505] bg-white px-3.5 py-2.5 text-xs font-medium text-[#050505] outline-none focus:ring-2 focus:ring-[#F5F04A] resize-y"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#050505] mb-1">
                  Banner / Attachment Image URL (Optional)
                </label>
                <input
                  type="url"
                  value={updateImage}
                  onChange={(e) => setUpdateImage(e.target.value)}
                  placeholder="https://..."
                  className="w-full rounded-xl border border-[#050505] bg-white px-3.5 py-2 text-xs font-medium text-[#050505] outline-none focus:ring-2 focus:ring-[#F5F04A]"
                />
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={isPostingUpdate}
                  className="inline-flex items-center gap-2 rounded-full border-2 border-[#050505] bg-[#F5F04A] px-7 py-2.5 text-xs font-black uppercase tracking-wider text-[#050505] shadow-[3px_3px_0_#050505] hover:bg-white hover:-translate-y-0.5 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isPostingUpdate ? <Loader2 size={14} className="animate-spin" /> : <Megaphone size={14} />}
                  <span>Post Official Announcement</span>
                </button>
              </div>
            </form>
          </section>
        )}
      </main>
    </div>
  )
}
