/**
 * HackhIt — Hackathon Registration Form Component (Phase 8, Step 8.1)
 *
 * Implements the registration form UI, data prefilling from student profile/session,
 * real-data participation constraints, validation, review section, and confirmation flow.
 * Respects RLS and database boundaries without fake persistence.
 */

import { useState, useEffect, useRef, useCallback, type FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import {
  ArrowLeft,
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  Users,
  User,
  Plus,
  Trash2,
  ShieldCheck,
  Building,
  Check,
  Loader2,
  RefreshCw,
  Ticket,
} from 'lucide-react'

import { TopNav } from './TopNav'
import {
  fetchHackathonById,
  formatEventDates,
  formatDeadlineCountdown,
  determineParticipationSupport,
  validateRegistrationForm,
  submitHackathonRegistration,
  fetchUserHackathonRegistration,
  checkRegistrationsSchemaStatus,
} from '../lib/hackathons'
import { getSupabase } from '../lib/supabase'
import type {
  Hackathon,
  ParticipationType,
  TeammateInfo,
  RegistrationFormData,
  RegistrationFieldErrors,
  HackathonRegistrationRecord,
} from '../types/hackathons'

interface HackathonRegistrationProps {
  hackathonId: string
  session?: Session | null
  onNavigateBack: () => void
  onNavigateToEventDetails: (hackathonId: string) => void
  onNavigateToHackathons: () => void
  onNavigateToCommunity: (eventContext?: string) => void
  onNavigateToLogin: () => void
  onNavigateToSignup: () => void
  onNavigateToHome: () => void
  onNavigateToMyRegistrations?: () => void
  onSignOut?: () => void
  onOpenProfile?: () => void
  // Optional preloaded event (e.g. for testing)
  initialHackathon?: Hackathon | null
}

export function HackathonRegistration({
  hackathonId,
  session,
  onNavigateBack,
  onNavigateToEventDetails,
  onNavigateToHackathons,
  onNavigateToCommunity,
  onNavigateToLogin,
  onNavigateToSignup,
  onNavigateToHome,
  onNavigateToMyRegistrations,
  onSignOut,
  onOpenProfile,
  initialHackathon,
}: HackathonRegistrationProps) {
  const [hackathon, setHackathon] = useState<Hackathon | null>(initialHackathon || null)
  const [isLoading, setIsLoading] = useState<boolean>(!initialHackathon)
  const [isNotFound, setIsNotFound] = useState<boolean>(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Step Mode: 'form' -> 'review' -> 'confirmed'
  const [stepMode, setStepMode] = useState<'form' | 'review' | 'confirmed'>('form')

  // Form Fields
  const [fullName, setFullName] = useState<string>('')
  const [email, setEmail] = useState<string>('')
  const [university, setUniversity] = useState<string>('')
  const [participationType, setParticipationType] = useState<ParticipationType>(
    () => (initialHackathon ? determineParticipationSupport(initialHackathon).defaultType : 'individual')
  )
  const [teamName, setTeamName] = useState<string>('')
  const [teammates, setTeammates] = useState<TeammateInfo[]>([{ name: '', email: '' }])
  const [confirmedEligibility, setConfirmedEligibility] = useState<boolean>(false)
  const [acceptedRules, setAcceptedRules] = useState<boolean>(false)

  // Validation State
  const [errors, setErrors] = useState<RegistrationFieldErrors>({})
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const isSubmittingRef = useRef<boolean>(false)

  // Registration Persistence State (Step 8.2)
  const [isPendingSchema, setIsPendingSchema] = useState<boolean>(false)
  const [savedRegistration, setSavedRegistration] = useState<HackathonRegistrationRecord | null>(null)
  const [isAlreadyRegistered, setIsAlreadyRegistered] = useState<boolean>(false)
  const [submissionError, setSubmissionError] = useState<string | null>(null)
  const [showFormAnyway, setShowFormAnyway] = useState<boolean>(false)

  // Profile prefill flag to avoid overwriting user edits
  const hasPrefilledRef = useRef<boolean>(false)

  // Manual reload handler
  const loadEvent = useCallback(async () => {
    if (!hackathonId) {
      setIsNotFound(true)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setIsNotFound(false)
    setErrorMessage(null)

    try {
      const result = await fetchHackathonById(hackathonId)
      if (result.isNotFound) {
        setIsNotFound(true)
        setHackathon(null)
      } else if (result.error) {
        setErrorMessage(result.error)
        setHackathon(null)
      } else if (result.hackathon) {
        setHackathon(result.hackathon)
        const support = determineParticipationSupport(result.hackathon)
        setParticipationType(support.defaultType)
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to load hackathon data.')
    } finally {
      setIsLoading(false)
    }
  }, [hackathonId])

  useEffect(() => {
    if (initialHackathon) return

    let isCancelled = false
    const controller = new AbortController()

    fetchHackathonById(hackathonId, { signal: controller.signal })
      .then((result) => {
        if (isCancelled) return
        if (result.isNotFound) {
          setIsNotFound(true)
          setHackathon(null)
        } else if (result.error) {
          setErrorMessage(result.error)
          setHackathon(null)
        } else if (result.hackathon) {
          setHackathon(result.hackathon)
          const support = determineParticipationSupport(result.hackathon)
          setParticipationType(support.defaultType)
        }
      })
      .catch((err) => {
        if (isCancelled) return
        const msg = err instanceof Error ? err.message : String(err)
        if (!msg.toLowerCase().includes('abort')) {
          setErrorMessage('Unable to load hackathon data. Please try again.')
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoading(false)
        }
      })

    return () => {
      isCancelled = true
      controller.abort()
    }
  }, [hackathonId, initialHackathon])

  // Prefill student details from profile & auth session
  useEffect(() => {
    if (hasPrefilledRef.current) return

    async function prefillProfile() {
      if (!session?.user) return

      let prefilledName = (session.user.user_metadata?.full_name as string) || ''
      const prefilledEmail = session.user.email || ''
      let prefilledUni = ''

      try {
        const supabase = getSupabase()
        if (supabase) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, university')
            .eq('id', session.user.id)
            .maybeSingle()

          if (profile) {
            if (profile.full_name) prefilledName = profile.full_name
            if (profile.university) prefilledUni = profile.university
          }
        }
      } catch (err) {
        console.warn('Failed to prefetch profile data for registration:', err)
      }

      setFullName((prev) => (prev ? prev : prefilledName))
      setEmail((prev) => (prev ? prev : prefilledEmail))
      setUniversity((prev) => (prev ? prev : prefilledUni))
      hasPrefilledRef.current = true
    }

    prefillProfile()
  }, [session])

  // Check if authenticated user already has a registration for this event
  useEffect(() => {
    if (!session?.user || !hackathonId) return

    let isCancelled = false
    const controller = new AbortController()

    fetchUserHackathonRegistration(hackathonId, { signal: controller.signal })
      .then((res) => {
        if (isCancelled) return
        if (res.isPendingSchema) {
          setIsPendingSchema(true)
        } else if (res.registration) {
          setSavedRegistration(res.registration)
          setIsAlreadyRegistered(true)
        }
      })
      .catch((err) => {
        if (!isCancelled) {
          console.warn('Could not inspect existing registration:', err)
        }
      })

    return () => {
      isCancelled = true
      controller.abort()
    }
  }, [session, hackathonId])

  // Participation constraints based on actual hackathon rules
  const participationSupport = hackathon
    ? determineParticipationSupport(hackathon)
    : {
        allowsIndividual: true,
        allowsTeam: true,
        defaultType: 'individual' as ParticipationType,
        isTeamOnly: false,
        isIndividualOnly: false,
      }

  // Teammate handlers
  const handleAddTeammate = () => {
    setTeammates((prev) => [...prev, { name: '', email: '' }])
  }

  const handleRemoveTeammate = (index: number) => {
    setTeammates((prev) => prev.filter((_, i) => i !== index))
  }

  const handleTeammateChange = (index: number, field: 'name' | 'email', value: string) => {
    setTeammates((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })

    // Clear specific teammate error when user edits
    if (errors.teammates?.[index]?.[field]) {
      setErrors((prev) => {
        const updatedTmErrors = { ...prev.teammates }
        if (updatedTmErrors[index]) {
          delete updatedTmErrors[index][field]
          if (Object.keys(updatedTmErrors[index]).length === 0) {
            delete updatedTmErrors[index]
          }
        }
        return { ...prev, teammates: updatedTmErrors }
      })
    }
  }

  // Advance from Form to Review
  const handleProceedToReview = (e: FormEvent) => {
    e.preventDefault()
    if (!hackathon) return

    if (!session?.user) {
      setErrors({
        general:
          'You must be signed in with your student account to register for this event. Please sign in to link your registration.',
      })
      window.scrollTo({ top: 120, behavior: 'smooth' })
      return
    }

    const formData: RegistrationFormData = {
      fullName,
      email,
      university,
      participationType,
      teamName,
      teammates: participationType === 'team' ? teammates : [],
      confirmedEligibility,
      acceptedRules,
    }

    const validation = validateRegistrationForm(formData, hackathon)
    if (!validation.isValid) {
      setErrors(validation.errors)
      window.scrollTo({ top: 120, behavior: 'smooth' })
      return
    }

    setErrors({})
    setSubmissionError(null)
    setStepMode('review')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Final Confirmation Handler (duplicate click prevention & real backend persistence)
  const handleConfirmSubmission = async () => {
    if (isSubmittingRef.current || !hackathon) return

    if (!session?.user) {
      setSubmissionError(
        'You must be signed in to submit your registration. Please sign in to link your registration to your verified student account.'
      )
      return
    }

    isSubmittingRef.current = true
    setIsSubmitting(true)
    setSubmissionError(null)

    try {
      const result = await submitHackathonRegistration({
        hackathonId: hackathon.id,
        formData: {
          fullName,
          email,
          university,
          participationType,
          teamName,
          teammates: participationType === 'team' ? teammates : [],
          confirmedEligibility,
          acceptedRules,
        },
      })

      if (result.isPendingSchema) {
        setIsPendingSchema(true)
        setSubmissionError(result.error)
      } else if (result.isDuplicate) {
        setIsAlreadyRegistered(true)
        if (result.registration) {
          setSavedRegistration(result.registration)
        }
        setSubmissionError('You have already registered for this hackathon.')
      } else if (result.isClosed) {
        setSubmissionError(result.error || 'Registration for this competition has closed.')
      } else if (!result.success || !result.registration) {
        setSubmissionError(
          result.error || 'Failed to submit registration. Please check your network and try again.'
        )
      } else {
        setSavedRegistration(result.registration)
        setStepMode('confirmed')
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
    } catch (err) {
      setSubmissionError(
        err instanceof Error ? err.message : 'An unexpected error occurred during submission.'
      )
    } finally {
      isSubmittingRef.current = false
      setIsSubmitting(false)
    }
  }

  // Check deadline expiration
  const countdown = formatDeadlineCountdown(hackathon?.registration_deadline)
  const isRegistrationClosed = countdown.isClosed

  return (
    <div className="site-shell min-h-screen bg-[#E9E7D8] text-[#050505] flex flex-col w-full">
      <TopNav
        currentView="hackathons"
        session={session}
        onNavigateToHome={onNavigateToHome}
        onNavigateToCommunity={() => onNavigateToCommunity()}
        onNavigateToHackathons={onNavigateToHackathons}
        onNavigateToMyRegistrations={onNavigateToMyRegistrations}
        onNavigateToLogin={onNavigateToLogin}
        onNavigateToSignup={onNavigateToSignup}
        onSignOut={onSignOut}
        onOpenProfile={onOpenProfile}
      />

      <main className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 flex-1">
        {/* Navigation Breadcrumb Bar */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <button
            type="button"
            onClick={onNavigateBack}
            className="inline-flex min-h-[40px] cursor-pointer items-center gap-2 rounded-full border-[2px] border-[#050505] bg-white px-4 py-1.5 text-xs font-black uppercase tracking-wider text-[#050505] shadow-[2px_2px_0_#050505] hover:bg-[#F5F04A] hover:-translate-y-0.5 transition-all"
          >
            <ArrowLeft size={16} />
            <span>Back to event details</span>
          </button>

          {hackathon && (
            <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-[#050505]/70">
              <span>Event:</span>
              <span className="text-[#050505] font-black underline underline-offset-2">
                {hackathon.title}
              </span>
            </div>
          )}
        </div>

        {/* 1. Loading Skeleton */}
        {isLoading && (
          <div className="space-y-6">
            <div className="rounded-[28px] border-[2.5px] border-[#050505] bg-white p-8 shadow-[6px_6px_0_#050505] animate-pulse">
              <div className="h-6 w-1/3 bg-gray-200 rounded mb-4" />
              <div className="h-10 w-3/4 bg-gray-200 rounded mb-8" />
              <div className="space-y-4">
                <div className="h-12 bg-gray-100 rounded-xl" />
                <div className="h-12 bg-gray-100 rounded-xl" />
                <div className="h-12 bg-gray-100 rounded-xl" />
              </div>
            </div>
          </div>
        )}

        {/* 2. Not Found / Unavailable State */}
        {!isLoading && isNotFound && (
          <div className="rounded-[28px] border-[2.5px] border-[#050505] bg-white p-8 sm:p-12 text-center shadow-[6px_6px_0_#050505]">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border-[2px] border-[#050505] bg-[#F5F04A] shadow-[3px_3px_0_#050505]">
              <AlertCircle size={32} className="text-[#050505]" />
            </div>
            <h2 className="display-font mt-6 text-2xl sm:text-4xl uppercase text-[#050505]">
              Event Not Found
            </h2>
            <p className="mx-auto mt-2 max-w-md text-xs sm:text-sm text-[#050505]/70">
              The competition you are attempting to register for could not be located, or registration has been withdrawn.
            </p>
            <div className="mt-8 flex justify-center">
              <button
                type="button"
                onClick={onNavigateToHackathons}
                className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full border-[2px] border-[#050505] bg-[#F5F04A] px-6 text-xs font-black uppercase tracking-wider text-[#050505] shadow-[3px_3px_0_#050505] hover:bg-white transition-all"
              >
                <span>Browse Available Hackathons</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* 2b. Error State with Retry */}
        {!isLoading && errorMessage && !isNotFound && (
          <div className="rounded-[28px] border-[2.5px] border-[#050505] bg-white p-8 sm:p-12 text-center shadow-[6px_6px_0_#050505]">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border-[2px] border-[#050505] bg-red-100 shadow-[3px_3px_0_#050505]">
              <AlertCircle size={32} className="text-red-700" />
            </div>
            <h2 className="display-font mt-6 text-2xl sm:text-4xl uppercase text-[#050505]">
              Failed to Load Event
            </h2>
            <p className="mx-auto mt-2 max-w-md text-xs sm:text-sm text-[#050505]/70">
              {errorMessage}
            </p>
            <div className="mt-8 flex justify-center gap-4">
              <button
                type="button"
                onClick={() => loadEvent()}
                className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full border-[2px] border-[#050505] bg-[#F5F04A] px-6 text-xs font-black uppercase tracking-wider text-[#050505] shadow-[3px_3px_0_#050505] hover:bg-white transition-all"
              >
                <RefreshCw size={14} />
                <span>Try Again</span>
              </button>
            </div>
          </div>
        )}

        {/* 3. Expired / Registration Closed State */}
        {!isLoading && hackathon && isRegistrationClosed && (
          <div className="rounded-[28px] border-[2.5px] border-[#050505] bg-white p-8 sm:p-12 text-center shadow-[6px_6px_0_#050505]">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border-[2px] border-[#050505] bg-red-100 shadow-[3px_3px_0_#050505]">
              <Clock size={32} className="text-red-700" />
            </div>
            <h2 className="display-font mt-6 text-2xl sm:text-4xl uppercase text-[#050505]">
              Registration Closed
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-xs sm:text-sm text-[#050505]/80 leading-relaxed">
              Registration for <strong>{hackathon.title}</strong> closed on{' '}
              {hackathon.registration_deadline
                ? new Date(hackathon.registration_deadline).toLocaleDateString(undefined, {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })
                : 'the official deadline'}
              . Submissions are no longer accepted.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <button
                type="button"
                onClick={() => onNavigateToEventDetails(hackathon.id)}
                className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full border-[2px] border-[#050505] bg-[#F5F04A] px-6 text-xs font-black uppercase tracking-wider text-[#050505] shadow-[3px_3px_0_#050505] hover:bg-white transition-all"
              >
                <span>View Event Details & Rules</span>
              </button>
              <button
                type="button"
                onClick={onNavigateToHackathons}
                className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full border-[2px] border-[#050505] bg-white px-6 text-xs font-bold uppercase tracking-wider text-[#050505] shadow-[2px_2px_0_#050505] hover:bg-[#E9E7D8] transition-all"
              >
                <span>Browse Other Events</span>
              </button>
            </div>
          </div>
        )}

        {/* 3b. Already Registered State Card */}
        {!isLoading && hackathon && !isRegistrationClosed && isAlreadyRegistered && savedRegistration && !showFormAnyway && stepMode !== 'confirmed' && (
          <div className="rounded-[28px] border-[2.5px] border-[#050505] bg-white p-8 sm:p-12 text-center shadow-[6px_6px_0_#050505] space-y-6">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border-[2px] border-[#050505] bg-[#F5F04A] shadow-[3px_3px_0_#050505]">
              <CheckCircle2 size={36} className="text-[#050505]" />
            </div>

            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-800 bg-emerald-100 px-3 py-1 text-xs font-black uppercase tracking-wider text-emerald-800 shadow-[1.5px_1.5px_0_#065f46]">
                <Check size={13} />
                <span>Registered Participant</span>
              </div>
              <h2 className="display-font text-3xl sm:text-5xl uppercase text-[#050505] mt-2">
                You Are Already Registered
              </h2>
              <p className="mx-auto max-w-lg text-xs sm:text-sm text-[#050505]/75">
                You have already registered for <strong>{hackathon.title}</strong> with your student account. Duplicate registrations are not permitted under event rules.
              </p>
            </div>

            {/* Existing Registration Summary */}
            <div className="mx-auto max-w-lg rounded-2xl border border-[#050505] bg-[#E9E7D8]/60 p-5 text-xs text-left space-y-2.5 shadow-[2px_2px_0_#050505]">
              <div className="flex items-center justify-between border-b border-[#050505]/15 pb-2">
                <span className="font-black uppercase text-[#050505]">Registration Summary</span>
                <span className="font-mono text-[11px] font-bold text-[#050505]/80 bg-white px-2 py-0.5 rounded border border-[#050505]/20">
                  ID: {savedRegistration.id ? savedRegistration.id.slice(0, 8) + '...' : 'Verified'}
                </span>
              </div>

              <p className="text-[#050505]/80">
                <strong>Lead Hacker:</strong> {savedRegistration.full_name} ({savedRegistration.email})
              </p>
              {savedRegistration.university && (
                <p className="text-[#050505]/80">
                  <strong>Institution:</strong> {savedRegistration.university}
                </p>
              )}
              <p className="text-[#050505]/80">
                <strong>Format:</strong>{' '}
                {savedRegistration.participation_type === 'team'
                  ? `Team "${savedRegistration.team_name}" (${(Array.isArray(savedRegistration.teammates) ? savedRegistration.teammates.length : 0) + 1} members)`
                  : 'Individual Solo Hacker'}
              </p>

              <div className="pt-2 border-t border-[#050505]/15 flex items-center justify-between text-[11px] text-[#050505]/70">
                <span>
                  Registered on{' '}
                  {new Date(savedRegistration.created_at).toLocaleDateString(undefined, {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
                <span className="font-black text-emerald-800 uppercase">Status: Confirmed</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
              {onNavigateToMyRegistrations && (
                <button
                  type="button"
                  onClick={onNavigateToMyRegistrations}
                  className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full border-[2px] border-[#050505] bg-[#F5F04A] px-6 text-xs font-black uppercase tracking-wider text-[#050505] shadow-[3px_3px_0_#050505] hover:bg-white transition-all"
                >
                  <Ticket size={14} />
                  <span>View in My Registrations</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => onNavigateToEventDetails(hackathon.id)}
                className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full border-[2px] border-[#050505] bg-white px-6 text-xs font-bold uppercase tracking-wider text-[#050505] shadow-[2px_2px_0_#050505] hover:bg-[#E9E7D8] transition-all"
              >
                <span>Back to Event Details</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  onNavigateToCommunity(
                    `Registered for ${hackathon.title}! Looking for project collaborators and idea feedback.`
                  )
                }
                className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full border-[2px] border-[#050505] bg-white px-6 text-xs font-bold uppercase tracking-wider text-[#050505] shadow-[2px_2px_0_#050505] hover:bg-[#E9E7D8] transition-all"
              >
                <span>Find Teammates in Community</span>
              </button>

              <button
                type="button"
                onClick={() => setShowFormAnyway(true)}
                className="inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-full border border-[#050505]/40 bg-white px-5 text-xs font-bold uppercase tracking-wider text-[#050505]/80 hover:bg-[#E9E7D8] transition-all"
              >
                <span>View Form Entries</span>
              </button>

              <button
                type="button"
                onClick={onNavigateToHackathons}
                className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full border border-[#050505] bg-white px-5 text-xs font-bold uppercase tracking-wider text-[#050505] hover:bg-[#E9E7D8] transition-all"
              >
                <span>Browse More Events</span>
              </button>
            </div>
          </div>
        )}

        {/* 4. Active Registration Flow */}
        {!isLoading && hackathon && !isRegistrationClosed && (!isAlreadyRegistered || showFormAnyway || stepMode === 'confirmed') && (
          <div className="space-y-8">
            {/* If user opted to inspect form despite already being registered */}
            {isAlreadyRegistered && showFormAnyway && stepMode !== 'confirmed' && (
              <div className="flex items-center justify-between rounded-2xl border-[2px] border-[#050505] bg-emerald-100 p-4 text-xs shadow-[2px_2px_0_#050505]">
                <div className="flex items-center gap-2 text-emerald-950 font-bold">
                  <Check size={16} />
                  <span>Viewing form in review mode. You already have an active registration for this event.</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowFormAnyway(false)}
                  className="font-black underline uppercase text-emerald-950 hover:text-emerald-800"
                >
                  Return to Summary
                </button>
              </div>
            )}

            {/* Event Header Banner Card */}
            <div className="rounded-[24px] border-[2.5px] border-[#050505] bg-[#fffef8] p-6 sm:p-8 shadow-[4px_4px_0_#050505]">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#050505]/15 pb-4">
                <div className="flex items-center gap-2 text-xs font-bold uppercase text-[#050505]/70">
                  <Building size={14} />
                  <span>Organized by {hackathon.organizer}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-[#050505] bg-[#F5F04A] px-3 py-0.5 text-xs font-black uppercase text-[#050505] shadow-[1.5px_1.5px_0_#050505]">
                    {hackathon.mode}
                  </span>
                  <span className="rounded-full border border-[#050505] bg-white px-3 py-0.5 text-xs font-bold text-[#050505] shadow-[1.5px_1.5px_0_#050505]">
                    {hackathon.category}
                  </span>
                </div>
              </div>

              <div className="mt-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h1 className="display-font text-2xl sm:text-4xl uppercase text-[#050505]">
                    {hackathon.title}
                  </h1>
                  <p className="mt-1 text-xs text-[#050505]/75">
                    Dates: {formatEventDates(hackathon.start_date, hackathon.end_date)} • Venue: {hackathon.location || (hackathon.mode === 'Online' ? 'Virtual / Online' : 'Campus Venue')}
                  </p>
                </div>

                <div className="shrink-0 rounded-2xl border border-[#050505] bg-[#E9E7D8] p-3 text-right shadow-[1.5px_1.5px_0_#050505]">
                  <span className="block text-[10px] font-bold uppercase text-[#050505]/60">
                    Registration Closes
                  </span>
                  <span className="font-black text-xs sm:text-sm text-[#050505]">
                    {countdown.label}
                  </span>
                </div>
              </div>

              {/* Step Flow Tabs */}
              <div className="mt-6 flex items-center gap-2 border-t border-[#050505]/15 pt-5 text-xs font-bold uppercase tracking-wider">
                <div
                  className={`flex items-center gap-2 rounded-full border px-4 py-1.5 ${
                    stepMode === 'form'
                      ? 'border-[#050505] bg-[#050505] text-[#F5F04A] shadow-[2px_2px_0_#050505]'
                      : 'border-[#050505]/30 bg-white text-[#050505]'
                  }`}
                >
                  <span className="grid h-4 w-4 place-items-center rounded-full bg-[#F5F04A] text-[10px] font-black text-[#050505]">
                    1
                  </span>
                  <span>Fill Details</span>
                </div>

                <span className="text-[#050505]/40 font-black">→</span>

                <div
                  className={`flex items-center gap-2 rounded-full border px-4 py-1.5 ${
                    stepMode === 'review'
                      ? 'border-[#050505] bg-[#050505] text-[#F5F04A] shadow-[2px_2px_0_#050505]'
                      : stepMode === 'confirmed'
                        ? 'border-[#050505] bg-white text-emerald-800'
                        : 'border-[#050505]/30 bg-white/60 text-[#050505]/60'
                  }`}
                >
                  <span className="grid h-4 w-4 place-items-center rounded-full bg-[#F5F04A] text-[10px] font-black text-[#050505]">
                    2
                  </span>
                  <span>Review & Confirm</span>
                </div>

                <span className="text-[#050505]/40 font-black">→</span>

                <div
                  className={`flex items-center gap-2 rounded-full border px-4 py-1.5 ${
                    stepMode === 'confirmed'
                      ? 'border-[#050505] bg-[#050505] text-[#F5F04A] shadow-[2px_2px_0_#050505]'
                      : 'border-[#050505]/30 bg-white/60 text-[#050505]/60'
                  }`}
                >
                  <span className="grid h-4 w-4 place-items-center rounded-full bg-[#F5F04A] text-[10px] font-black text-[#050505]">
                    3
                  </span>
                  <span>Confirmation</span>
                </div>
              </div>
            </div>

            {/* Error Banner */}
            {errors.general && (
              <div
                role="alert"
                className="rounded-2xl border-[2px] border-red-600 bg-red-50 p-4 text-xs font-bold text-red-800 shadow-[3px_3px_0_#dc2626] flex items-center gap-2"
              >
                <AlertCircle size={16} className="shrink-0 text-red-600" />
                <span>{errors.general}</span>
              </div>
            )}

            {/* STAGE 1: FORM FILLING */}
            {stepMode === 'form' && (
              <form onSubmit={handleProceedToReview} className="space-y-8" noValidate>
                {/* Auth status notification */}
                {session?.user ? (
                  <div className="flex items-center justify-between rounded-2xl border border-[#050505] bg-[#F5F04A]/30 p-4 text-xs shadow-[2px_2px_0_#050505]">
                    <div className="flex items-center gap-2">
                      <User size={16} className="text-[#050505]" />
                      <span>
                        Logged in as <strong>{session.user.email}</strong>. Details prefilled from your account.
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border-[2px] border-amber-600 bg-amber-50 p-4 text-xs shadow-[3px_3px_0_#d97706]">
                    <div className="flex items-center gap-2 text-amber-950 font-bold">
                      <AlertCircle size={16} className="shrink-0 text-amber-700" />
                      <span>
                        Student authentication is required to submit event registrations. Please sign in to link your registration to your verified account.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={onNavigateToLogin}
                      className="shrink-0 inline-flex cursor-pointer items-center justify-center gap-1.5 font-black uppercase text-[#050505] bg-[#F5F04A] px-4 py-2 rounded-full border border-[#050505] shadow-[2px_2px_0_#050505] hover:bg-white transition-all text-xs"
                    >
                      <span>Sign In with Student Account</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>
                )}

                {/* Section 1: Lead Hacker Information */}
                <section className="rounded-[24px] border-[2px] border-[#050505] bg-[#fffef8] p-6 sm:p-8 shadow-[4px_4px_0_#050505] space-y-6">
                  <div className="border-b border-[#050505]/15 pb-3">
                    <h2 className="font-black text-lg uppercase tracking-wide text-[#050505]">
                      1. Applicant Details
                    </h2>
                    <p className="text-xs text-[#050505]/70 mt-0.5">
                      Your primary identity and verified contact details for event communication.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Full Name */}
                    <div>
                      <label htmlFor="reg-fullname" className="block text-xs font-black uppercase text-[#050505] mb-2">
                        Full Name <span className="text-red-600">*</span>
                      </label>
                      <input
                        id="reg-fullname"
                        type="text"
                        value={fullName}
                        onChange={(e) => {
                          setFullName(e.target.value)
                          if (errors.fullName) setErrors((prev) => ({ ...prev, fullName: undefined }))
                        }}
                        maxLength={100}
                        placeholder="Enter your full name"
                        aria-invalid={!!errors.fullName}
                        aria-describedby={errors.fullName ? 'fullname-error' : undefined}
                        className={`w-full rounded-xl border-[2px] bg-white px-4 py-3 text-xs font-medium text-[#050505] placeholder-[#050505]/40 outline-none transition-all shadow-[2px_2px_0_#050505] focus:-translate-y-0.5 focus:shadow-[3px_3px_0_#050505] ${
                          errors.fullName ? 'border-red-600 bg-red-50/50' : 'border-[#050505]'
                        }`}
                      />
                      {errors.fullName && (
                        <p id="fullname-error" className="mt-1.5 text-[11px] font-bold text-red-600">
                          {errors.fullName}
                        </p>
                      )}
                    </div>

                    {/* Email */}
                    <div>
                      <label htmlFor="reg-email" className="block text-xs font-black uppercase text-[#050505] mb-2">
                        Contact Email <span className="text-red-600">*</span>
                      </label>
                      <input
                        id="reg-email"
                        type="email"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value)
                          if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }))
                        }}
                        placeholder="student@university.edu"
                        aria-invalid={!!errors.email}
                        aria-describedby={errors.email ? 'email-error' : undefined}
                        className={`w-full rounded-xl border-[2px] bg-white px-4 py-3 text-xs font-medium text-[#050505] placeholder-[#050505]/40 outline-none transition-all shadow-[2px_2px_0_#050505] focus:-translate-y-0.5 focus:shadow-[3px_3px_0_#050505] ${
                          errors.email ? 'border-red-600 bg-red-50/50' : 'border-[#050505]'
                        }`}
                      />
                      {errors.email && (
                        <p id="email-error" className="mt-1.5 text-[11px] font-bold text-red-600">
                          {errors.email}
                        </p>
                      )}
                    </div>

                    {/* University / College */}
                    <div className="md:col-span-2">
                      <label htmlFor="reg-university" className="block text-xs font-black uppercase text-[#050505] mb-2">
                        University / Institute <span className="text-[#050505]/50 font-medium">(Optional)</span>
                      </label>
                      <input
                        id="reg-university"
                        type="text"
                        value={university}
                        onChange={(e) => {
                          setUniversity(e.target.value)
                          if (errors.university) setErrors((prev) => ({ ...prev, university: undefined }))
                        }}
                        maxLength={120}
                        placeholder="e.g. Malla Reddy University"
                        aria-invalid={!!errors.university}
                        className="w-full rounded-xl border-[2px] border-[#050505] bg-white px-4 py-3 text-xs font-medium text-[#050505] placeholder-[#050505]/40 outline-none transition-all shadow-[2px_2px_0_#050505] focus:-translate-y-0.5 focus:shadow-[3px_3px_0_#050505]"
                      />
                      {errors.university && (
                        <p className="mt-1.5 text-[11px] font-bold text-red-600">
                          {errors.university}
                        </p>
                      )}
                    </div>
                  </div>
                </section>

                {/* Section 2: Participation Type */}
                <section className="rounded-[24px] border-[2px] border-[#050505] bg-[#fffef8] p-6 sm:p-8 shadow-[4px_4px_0_#050505] space-y-6">
                  <div className="border-b border-[#050505]/15 pb-3">
                    <h2 className="font-black text-lg uppercase tracking-wide text-[#050505]">
                      2. Participation Format
                    </h2>
                    <p className="text-xs text-[#050505]/70 mt-0.5">
                      {participationSupport.guidance || 'Select whether you are participating solo or registering as a squad.'}
                    </p>
                  </div>

                  {participationSupport.isTeamOnly ? (
                    <div className="rounded-2xl border-[2px] border-[#050505] bg-[#F5F04A]/30 p-4 text-xs font-bold text-[#050505] shadow-[2px_2px_0_#050505]">
                      <div className="flex items-center gap-2">
                        <Users size={18} />
                        <span>Team Registration Required by Organizer Rules</span>
                      </div>
                      <p className="mt-1 text-[11px] font-normal text-[#050505]/80">
                        {hackathon.rules || 'This competition requires team participation according to event rules.'}
                      </p>
                    </div>
                  ) : participationSupport.isIndividualOnly ? (
                    <div className="rounded-2xl border-[2px] border-[#050505] bg-white p-4 text-xs font-bold text-[#050505] shadow-[2px_2px_0_#050505]">
                      <div className="flex items-center gap-2">
                        <User size={18} />
                        <span>Individual Hackers Only</span>
                      </div>
                      <p className="mt-1 text-[11px] font-normal text-[#050505]/80">
                        Team registrations are not enabled for this competition format.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Individual Option */}
                      <label
                        className={`flex cursor-pointer items-start gap-3 rounded-2xl border-[2px] p-4 transition-all shadow-[2px_2px_0_#050505] ${
                          participationType === 'individual'
                            ? 'border-[#050505] bg-[#F5F04A] -translate-y-0.5 shadow-[4px_4px_0_#050505]'
                            : 'border-[#050505] bg-white hover:bg-[#E9E7D8]/40'
                        }`}
                      >
                        <input
                          type="radio"
                          name="participationType"
                          value="individual"
                          checked={participationType === 'individual'}
                          onChange={() => setParticipationType('individual')}
                          className="mt-1 h-4 w-4 accent-[#050505]"
                        />
                        <div>
                          <span className="block font-black text-xs uppercase text-[#050505]">
                            Individual (Solo Hacker)
                          </span>
                          <span className="block text-[11px] text-[#050505]/70 mt-0.5">
                            Participate and submit projects on your own.
                          </span>
                        </div>
                      </label>

                      {/* Team Option */}
                      <label
                        className={`flex cursor-pointer items-start gap-3 rounded-2xl border-[2px] p-4 transition-all shadow-[2px_2px_0_#050505] ${
                          participationType === 'team'
                            ? 'border-[#050505] bg-[#F5F04A] -translate-y-0.5 shadow-[4px_4px_0_#050505]'
                            : 'border-[#050505] bg-white hover:bg-[#E9E7D8]/40'
                        }`}
                      >
                        <input
                          type="radio"
                          name="participationType"
                          value="team"
                          checked={participationType === 'team'}
                          onChange={() => setParticipationType('team')}
                          className="mt-1 h-4 w-4 accent-[#050505]"
                        />
                        <div>
                          <span className="block font-black text-xs uppercase text-[#050505]">
                            Team Registration
                          </span>
                          <span className="block text-[11px] text-[#050505]/70 mt-0.5">
                            Register with your project team and squad members.
                          </span>
                        </div>
                      </label>
                    </div>
                  )}

                  {errors.participationType && (
                    <p className="text-xs font-bold text-red-600">{errors.participationType}</p>
                  )}
                </section>

                {/* Section 3: Team Details (Conditional on Team Participation) */}
                {participationType === 'team' && (
                  <section className="rounded-[24px] border-[2px] border-[#050505] bg-[#fffef8] p-6 sm:p-8 shadow-[4px_4px_0_#050505] space-y-6">
                    <div className="border-b border-[#050505]/15 pb-3">
                      <h2 className="font-black text-lg uppercase tracking-wide text-[#050505]">
                        3. Squad Details & Teammates
                      </h2>
                      <p className="text-xs text-[#050505]/70 mt-0.5">
                        Provide your team name and add contact details for each teammate.
                      </p>
                    </div>

                    {/* Team Name */}
                    <div>
                      <label htmlFor="reg-teamname" className="block text-xs font-black uppercase text-[#050505] mb-2">
                        Team / Squad Name <span className="text-red-600">*</span>
                      </label>
                      <input
                        id="reg-teamname"
                        type="text"
                        value={teamName}
                        onChange={(e) => {
                          setTeamName(e.target.value)
                          if (errors.teamName) setErrors((prev) => ({ ...prev, teamName: undefined }))
                        }}
                        maxLength={80}
                        placeholder="e.g. ByteForce Innovators"
                        aria-invalid={!!errors.teamName}
                        className={`w-full rounded-xl border-[2px] bg-white px-4 py-3 text-xs font-medium text-[#050505] placeholder-[#050505]/40 outline-none transition-all shadow-[2px_2px_0_#050505] focus:-translate-y-0.5 focus:shadow-[3px_3px_0_#050505] ${
                          errors.teamName ? 'border-red-600 bg-red-50/50' : 'border-[#050505]'
                        }`}
                      />
                      {errors.teamName && (
                        <p className="mt-1.5 text-[11px] font-bold text-red-600">
                          {errors.teamName}
                        </p>
                      )}
                    </div>

                    {/* Teammates Dynamic List */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black uppercase tracking-wider text-[#050505]">
                          Teammates ({teammates.length})
                        </span>
                        <button
                          type="button"
                          onClick={handleAddTeammate}
                          className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-[#050505] bg-white px-3 py-1 text-xs font-bold uppercase text-[#050505] shadow-[1.5px_1.5px_0_#050505] hover:bg-[#F5F04A] transition-all"
                        >
                          <Plus size={14} />
                          <span>Add Teammate</span>
                        </button>
                      </div>

                      {teammates.map((tm, idx) => {
                        const tmError = errors.teammates?.[idx]
                        return (
                          <div
                            key={idx}
                            className="rounded-2xl border-[2px] border-[#050505] bg-white p-4 shadow-[2px_2px_0_#050505]"
                          >
                            <div className="flex items-center justify-between mb-3">
                              <span className="text-xs font-black uppercase text-[#050505]/70">
                                Teammate #{idx + 1}
                              </span>
                              {teammates.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveTeammate(idx)}
                                  className="text-[#050505]/50 hover:text-red-600 p-1 cursor-pointer transition-colors"
                                  title="Remove teammate"
                                  aria-label={`Remove teammate ${idx + 1}`}
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-[11px] font-bold uppercase text-[#050505] mb-1">
                                  Teammate Name <span className="text-red-600">*</span>
                                </label>
                                <input
                                  type="text"
                                  value={tm.name}
                                  onChange={(e) => handleTeammateChange(idx, 'name', e.target.value)}
                                  placeholder="Full Name"
                                  className={`w-full rounded-lg border-[1.5px] bg-[#fffef8] px-3 py-2 text-xs font-medium text-[#050505] outline-none ${
                                    tmError?.name ? 'border-red-600 bg-red-50/50' : 'border-[#050505]'
                                  }`}
                                />
                                {tmError?.name && (
                                  <p className="mt-1 text-[10px] font-bold text-red-600">
                                    {tmError.name}
                                  </p>
                                )}
                              </div>

                              <div>
                                <label className="block text-[11px] font-bold uppercase text-[#050505] mb-1">
                                  Teammate Email <span className="text-red-600">*</span>
                                </label>
                                <input
                                  type="email"
                                  value={tm.email}
                                  onChange={(e) => handleTeammateChange(idx, 'email', e.target.value)}
                                  placeholder="teammate@college.edu"
                                  className={`w-full rounded-lg border-[1.5px] bg-[#fffef8] px-3 py-2 text-xs font-medium text-[#050505] outline-none ${
                                    tmError?.email ? 'border-red-600 bg-red-50/50' : 'border-[#050505]'
                                  }`}
                                />
                                {tmError?.email && (
                                  <p className="mt-1 text-[10px] font-bold text-red-600">
                                    {tmError.email}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </section>
                )}

                {/* Section 4: Eligibility & Rules Acknowledgement */}
                <section className="rounded-[24px] border-[2px] border-[#050505] bg-[#fffef8] p-6 sm:p-8 shadow-[4px_4px_0_#050505] space-y-5">
                  <div className="border-b border-[#050505]/15 pb-3">
                    <h2 className="font-black text-lg uppercase tracking-wide text-[#050505]">
                      4. Eligibility & Agreement
                    </h2>
                  </div>

                  {/* Real Event Eligibility Confirmation (displayed only if defined in event record) */}
                  {hackathon.eligibility && (
                    <div className="rounded-2xl border-[1.5px] border-[#050505] bg-[#E9E7D8]/50 p-4">
                      <span className="block text-[10px] font-black uppercase text-[#050505]/60 mb-1">
                        Stated Eligibility Criteria
                      </span>
                      <p className="text-xs text-[#050505] mb-3 leading-relaxed">
                        {hackathon.eligibility}
                      </p>
                      <label className="flex cursor-pointer items-start gap-3">
                        <input
                          type="checkbox"
                          checked={confirmedEligibility}
                          onChange={(e) => {
                            setConfirmedEligibility(e.target.checked)
                            if (errors.confirmedEligibility) {
                              setErrors((prev) => ({ ...prev, confirmedEligibility: undefined }))
                            }
                          }}
                          className="mt-0.5 h-4 w-4 accent-[#050505] rounded"
                        />
                        <span className="text-xs font-bold text-[#050505]">
                          I confirm that I and my teammates satisfy all stated eligibility criteria. <span className="text-red-600">*</span>
                        </span>
                      </label>
                      {errors.confirmedEligibility && (
                        <p className="mt-1.5 text-[11px] font-bold text-red-600">
                          {errors.confirmedEligibility}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Rules Acceptance */}
                  <div>
                    <label className="flex cursor-pointer items-start gap-3">
                      <input
                        type="checkbox"
                        checked={acceptedRules}
                        onChange={(e) => {
                          setAcceptedRules(e.target.checked)
                          if (errors.acceptedRules) {
                            setErrors((prev) => ({ ...prev, acceptedRules: undefined }))
                          }
                        }}
                        className="mt-0.5 h-4 w-4 accent-[#050505] rounded"
                      />
                      <span className="text-xs font-bold text-[#050505]">
                        I agree to abide by the official hackathon rules, fair play guidelines, and event code of conduct. <span className="text-red-600">*</span>
                      </span>
                    </label>
                    {errors.acceptedRules && (
                      <p className="mt-1.5 text-[11px] font-bold text-red-600">
                        {errors.acceptedRules}
                      </p>
                    )}
                  </div>
                </section>

                {/* Submit / Proceed Bar */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4">
                  <button
                    type="button"
                    onClick={onNavigateBack}
                    className="w-full sm:w-auto inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-full border border-[#050505] bg-white px-6 text-xs font-bold uppercase tracking-wider text-[#050505] shadow-[2px_2px_0_#050505] hover:bg-[#E9E7D8] transition-all"
                  >
                    <span>Cancel</span>
                  </button>

                  <button
                    type="submit"
                    className="w-full sm:w-auto inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-full border-[2px] border-[#050505] bg-[#F5F04A] px-8 text-xs font-black uppercase tracking-wider text-[#050505] shadow-[4px_4px_0_#050505] hover:bg-white hover:-translate-y-0.5 transition-all"
                  >
                    <span>Review Registration Details</span>
                    <ArrowRight size={16} />
                  </button>
                </div>
              </form>
            )}

            {/* STAGE 2: REVIEW & CONFIRMATION SECTION */}
            {stepMode === 'review' && (
              <div className="space-y-6">
                <div className="rounded-[24px] border-[2.5px] border-[#050505] bg-white p-6 sm:p-10 shadow-[6px_6px_0_#050505] space-y-6">
                  <div className="flex items-center gap-3 border-b border-[#050505]/15 pb-4">
                    <ShieldCheck size={24} className="text-[#050505]" />
                    <div>
                      <h2 className="font-black text-xl uppercase tracking-wide text-[#050505]">
                        Review Your Registration Entry
                      </h2>
                      <p className="text-xs text-[#050505]/70">
                        Please verify that all entered student information and teammate details are accurate before confirming.
                      </p>
                    </div>
                  </div>

                  {/* Summary Details Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                    {/* Event Summary */}
                    <div className="rounded-2xl border border-[#050505] bg-[#E9E7D8]/60 p-4 space-y-2">
                      <span className="block text-[10px] font-black uppercase text-[#050505]/60">
                        Target Competition
                      </span>
                      <h3 className="font-black text-sm text-[#050505] uppercase">
                        {hackathon.title}
                      </h3>
                      <p className="text-[11px] text-[#050505]/80">
                        Organized by {hackathon.organizer}
                      </p>
                      <p className="text-[11px] text-[#050505]/80">
                        Mode: {hackathon.mode} • Venue: {hackathon.location || 'Virtual'}
                      </p>
                    </div>

                    {/* Applicant Summary */}
                    <div className="rounded-2xl border border-[#050505] bg-[#E9E7D8]/60 p-4 space-y-2">
                      <span className="block text-[10px] font-black uppercase text-[#050505]/60">
                        Lead Applicant
                      </span>
                      <h3 className="font-black text-sm text-[#050505]">
                        {fullName}
                      </h3>
                      <p className="text-[11px] text-[#050505]/80">
                        Email: {email}
                      </p>
                      <p className="text-[11px] text-[#050505]/80">
                        Institution: {university || 'Not specified'}
                      </p>
                    </div>

                    {/* Participation Summary */}
                    <div className="md:col-span-2 rounded-2xl border border-[#050505] bg-white p-4 space-y-3">
                      <div className="flex items-center justify-between border-b border-[#050505]/10 pb-2">
                        <span className="text-[10px] font-black uppercase text-[#050505]/60">
                          Participation Format
                        </span>
                        <span className="rounded-full border border-[#050505] bg-[#F5F04A] px-2.5 py-0.5 text-[10px] font-black uppercase text-[#050505]">
                          {participationType === 'individual' ? 'Solo Hacker' : 'Squad / Team'}
                        </span>
                      </div>

                      {participationType === 'team' ? (
                        <div className="space-y-2">
                          <p className="font-bold text-xs text-[#050505]">
                            Team Name: <span className="font-black underline">{teamName}</span>
                          </p>
                          <div className="mt-2 space-y-1">
                            <span className="block text-[10px] font-bold uppercase text-[#050505]/60">
                              Registered Teammates:
                            </span>
                            <ul className="divide-y divide-[#050505]/10 border border-[#050505]/15 rounded-xl overflow-hidden">
                              {teammates.map((tm, idx) => (
                                <li key={idx} className="flex justify-between px-3 py-2 text-xs bg-[#fffef8]">
                                  <span className="font-bold text-[#050505]">{tm.name}</span>
                                  <span className="text-[#050505]/70">{tm.email}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-[#050505]/80">
                          Individual participation: You will be registered as a solo entrant for this competition.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Official Entry Notice Box */}
                  <div className="rounded-2xl border border-[#050505] bg-[#F5F04A]/30 p-4 text-xs space-y-1">
                    <span className="font-black uppercase text-[#050505]">Official Event Entry</span>
                    <p className="text-[#050505]/85 leading-relaxed">
                      By submitting, your registration will be officially saved and linked to your verified student account (<strong>{session?.user?.email || email}</strong>).
                    </p>
                  </div>

                  {/* Submission Error Banner */}
                  {submissionError && (
                    <div
                      role="alert"
                      className="rounded-2xl border-[2px] border-red-600 bg-red-50 p-4 text-xs font-bold text-red-800 shadow-[3px_3px_0_#dc2626] flex items-start gap-3"
                    >
                      <AlertCircle size={18} className="shrink-0 text-red-600 mt-0.5" />
                      <div className="flex-1 space-y-1">
                        <span className="block font-black uppercase text-red-900">Registration Notice</span>
                        <p className="text-red-800">{submissionError}</p>
                        {isPendingSchema && (
                          <div className="pt-2 space-y-2">
                            <p className="text-[11px] text-red-900 font-medium">
                              To initialize registrations, apply the migration file in your Supabase Dashboard SQL Editor:
                              <br />
                              <code className="inline-block mt-1 bg-white px-2 py-0.5 rounded border border-red-300 font-mono text-[11px] text-[#050505]">
                                supabase/migrations/20260403000000_hackathon_registrations.sql
                              </code>
                            </p>
                            <div className="pt-1">
                              <button
                                type="button"
                                onClick={async () => {
                                  setIsSubmitting(true)
                                  const report = await checkRegistrationsSchemaStatus()
                                  setIsSubmitting(false)
                                  if (report.state === 'initialized') {
                                    setIsPendingSchema(false)
                                    setSubmissionError(null)
                                  } else {
                                    setSubmissionError(
                                      "Table 'public.hackathon_registrations' is not yet detected in the schema cache. Please ensure the migration was run in the Supabase SQL Editor and try again."
                                    )
                                  }
                                }}
                                className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-[#050505] bg-white px-3.5 py-1.5 text-[11px] font-black uppercase text-[#050505] shadow-[1.5px_1.5px_0_#050505] hover:bg-[#F5F04A] transition-colors"
                              >
                                <RefreshCw size={12} className={isSubmitting ? 'animate-spin' : ''} />
                                <span>Re-check System Status</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Review Actions */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-[#050505]/15">
                    <button
                      type="button"
                      onClick={() => setStepMode('form')}
                      disabled={isSubmitting}
                      className="w-full sm:w-auto inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-full border border-[#050505] bg-white px-6 text-xs font-bold uppercase tracking-wider text-[#050505] shadow-[2px_2px_0_#050505] hover:bg-[#E9E7D8] transition-all disabled:opacity-50"
                    >
                      <ArrowLeft size={16} />
                      <span>Edit Details</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleConfirmSubmission}
                      disabled={isSubmitting}
                      className="w-full sm:w-auto inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-full border-[2px] border-[#050505] bg-[#F5F04A] px-8 text-xs font-black uppercase tracking-wider text-[#050505] shadow-[4px_4px_0_#050505] hover:bg-white hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 size={16} className="animate-spin text-[#050505]" />
                          <span>Saving Registration...</span>
                        </>
                      ) : (
                        <>
                          <Check size={16} />
                          <span>Confirm & Submit Registration</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* STAGE 3: CONFIRMATION SCREEN (REAL PERSISTENCE CONFIRMED) */}
            {stepMode === 'confirmed' && (
              <div className="rounded-[28px] border-[2.5px] border-[#050505] bg-white p-8 sm:p-12 text-center shadow-[6px_6px_0_#050505] space-y-6">
                <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border-[2px] border-[#050505] bg-[#F5F04A] shadow-[3px_3px_0_#050505]">
                  <CheckCircle2 size={36} className="text-[#050505]" />
                </div>

                <div className="space-y-2">
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-800 bg-emerald-100 px-3 py-1 text-xs font-black uppercase tracking-wider text-emerald-800 shadow-[1.5px_1.5px_0_#065f46]">
                    <Check size={13} />
                    <span>Official Registration Confirmed</span>
                  </div>
                  <h2 className="display-font text-3xl sm:text-5xl uppercase text-[#050505] mt-2">
                    You Are Registered!
                  </h2>
                  <p className="mx-auto max-w-lg text-xs sm:text-sm text-[#050505]/75">
                    Your official registration record for <strong>{hackathon.title}</strong> has been saved and linked to your student account.
                  </p>
                </div>

                {/* Confirmed Registration Details */}
                <div className="mx-auto max-w-lg rounded-2xl border border-[#050505] bg-[#E9E7D8]/60 p-5 text-xs text-left space-y-2.5 shadow-[2px_2px_0_#050505]">
                  <div className="flex items-center justify-between border-b border-[#050505]/15 pb-2">
                    <span className="font-black uppercase text-[#050505]">Registration Summary</span>
                    <span className="font-mono text-[11px] font-bold text-[#050505]/80 bg-white px-2 py-0.5 rounded border border-[#050505]/20">
                      ID: {savedRegistration?.id ? savedRegistration.id.slice(0, 8) + '...' : 'Verified'}
                    </span>
                  </div>

                  <p className="text-[#050505]/80">
                    <strong>Lead Hacker:</strong> {fullName} ({email})
                  </p>
                  {university && (
                    <p className="text-[#050505]/80">
                      <strong>Institution:</strong> {university}
                    </p>
                  )}
                  <p className="text-[#050505]/80">
                    <strong>Format:</strong>{' '}
                    {participationType === 'team'
                      ? `Team "${teamName}" (${teammates.length + 1} members)`
                      : 'Individual Solo Hacker'}
                  </p>

                  {participationType === 'team' && teammates.length > 0 && (
                    <div className="pt-1">
                      <span className="block text-[10px] font-bold uppercase text-[#050505]/60 mb-1">
                        Teammates on Roster:
                      </span>
                      <ul className="divide-y divide-[#050505]/10 border border-[#050505]/15 rounded-xl overflow-hidden bg-white text-[11px]">
                        {teammates.map((tm, idx) => (
                          <li key={idx} className="flex justify-between px-3 py-1.5">
                            <span className="font-bold text-[#050505]">{tm.name}</span>
                            <span className="text-[#050505]/70">{tm.email}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="pt-2 border-t border-[#050505]/15 flex items-center justify-between text-[11px] text-[#050505]/70">
                    <span>
                      Registered on{' '}
                      {savedRegistration?.created_at
                        ? new Date(savedRegistration.created_at).toLocaleString(undefined, {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })
                        : 'Recently'}
                    </span>
                    <span className="font-black text-emerald-800 uppercase">Status: Confirmed</span>
                  </div>
                </div>

                {/* Next Action Buttons */}
                <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
                  {onNavigateToMyRegistrations && (
                    <button
                      type="button"
                      onClick={onNavigateToMyRegistrations}
                      className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full border-[2px] border-[#050505] bg-[#F5F04A] px-6 text-xs font-black uppercase tracking-wider text-[#050505] shadow-[3px_3px_0_#050505] hover:bg-white transition-all"
                    >
                      <Ticket size={14} />
                      <span>View in My Registrations</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => onNavigateToEventDetails(hackathon.id)}
                    className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full border-[2px] border-[#050505] bg-white px-6 text-xs font-black uppercase tracking-wider text-[#050505] shadow-[2px_2px_0_#050505] hover:bg-[#E9E7D8] transition-all"
                  >
                    <span>Back to Event Details</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      onNavigateToCommunity(
                        `Registered for ${hackathon.title}! Looking for project collaborators and idea feedback.`
                      )
                    }
                    className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full border-[2px] border-[#050505] bg-white px-6 text-xs font-bold uppercase tracking-wider text-[#050505] shadow-[2px_2px_0_#050505] hover:bg-[#E9E7D8] transition-all"
                  >
                    <span>Connect in Community</span>
                  </button>

                  <button
                    type="button"
                    onClick={onNavigateToHackathons}
                    className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full border border-[#050505] bg-white px-5 text-xs font-bold uppercase tracking-wider text-[#050505] hover:bg-[#E9E7D8] transition-all"
                  >
                    <span>Browse More Events</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
