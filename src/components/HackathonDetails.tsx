/**
 * HackhIt — Hackathon Event Details Component
 *
 * Displays verified event details including dates, deadline, location, prizes,
 * eligibility criteria, rules, schedule, and verified external registration links.
 * Respects RLS and database permissions, safely handling drafts and missing fields.
 */

import { useState, useEffect, useCallback } from 'react'
import type { Session } from '@supabase/supabase-js'
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Clock,
  MapPin,
  Trophy,
  ExternalLink,
  Laptop,
  CheckCircle2,
  FileText,
  AlertCircle,
  RefreshCw,
  Sparkles,
  ShieldAlert,
  Database,
  Building,
} from 'lucide-react'

import { TopNav } from './TopNav'
import {
  fetchHackathonById,
  formatEventDates,
  formatDeadlineCountdown,
  isValidExternalUrl,
} from '../lib/hackathons'
import type { Hackathon } from '../types/hackathons'

interface HackathonDetailsProps {
  hackathonId: string
  session?: Session | null
  onNavigateBack: () => void
  onNavigateToHome: () => void
  onNavigateToCommunity: (eventContext?: string) => void
  onNavigateToHackathons: () => void
  onNavigateToMyRegistrations?: () => void
  onNavigateToLogin: () => void
  onNavigateToSignup: () => void
  onNavigateToRegister?: (hackathonId: string) => void
  onSignOut?: () => void
  onOpenProfile?: () => void
  // Optional preloaded event (e.g. from discovery click or unit testing)
  initialHackathon?: Hackathon | null
}

export function HackathonDetails({
  hackathonId,
  session,
  onNavigateBack,
  onNavigateToHome,
  onNavigateToCommunity,
  onNavigateToHackathons,
  onNavigateToMyRegistrations,
  onNavigateToLogin,
  onNavigateToSignup,
  onNavigateToRegister,
  onSignOut,
  onOpenProfile,
  initialHackathon,
}: HackathonDetailsProps) {
  const [hackathon, setHackathon] = useState<Hackathon | null>(initialHackathon || null)
  const [isLoading, setIsLoading] = useState<boolean>(!initialHackathon)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isNotFound, setIsNotFound] = useState<boolean>(false)
  const [isPendingSchema, setIsPendingSchema] = useState<boolean>(false)
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false)

  // Real backend loader
  const loadDetails = useCallback(
    async (isManual = false) => {
      if (!hackathonId) {
        setIsNotFound(true)
        setIsLoading(false)
        return
      }

      if (isManual) {
        setIsRefreshing(true)
      } else {
        setIsLoading(true)
      }
      setErrorMessage(null)
      setIsNotFound(false)
      setIsPendingSchema(false)

      try {
        const result = await fetchHackathonById(hackathonId)

        if (result.isPendingSchema) {
          setIsPendingSchema(true)
          setHackathon(null)
        } else if (result.isNotFound) {
          setIsNotFound(true)
          setHackathon(null)
        } else if (result.error) {
          setErrorMessage(result.error)
          setHackathon(null)
        } else {
          setHackathon(result.hackathon)
        }
      } catch (err) {
        setErrorMessage(
          err instanceof Error
            ? err.message
            : 'An unexpected error occurred while loading event details.'
        )
      } finally {
        setIsLoading(false)
        setIsRefreshing(false)
      }
    },
    [hackathonId]
  )

  useEffect(() => {
    if (initialHackathon) return

    let isCancelled = false
    const controller = new AbortController()

    fetchHackathonById(hackathonId, { signal: controller.signal })
      .then((result) => {
        if (isCancelled) return
        if (result.isPendingSchema) {
          setIsPendingSchema(true)
          setHackathon(null)
        } else if (result.isNotFound) {
          setIsNotFound(true)
          setHackathon(null)
        } else if (result.error) {
          setErrorMessage(result.error)
          setHackathon(null)
        } else {
          setHackathon(result.hackathon)
        }
      })
      .catch((err) => {
        if (isCancelled) return
        const msg = err instanceof Error ? err.message : String(err)
        if (!msg.toLowerCase().includes('abort')) {
          setErrorMessage('Unable to load hackathon details. Please try again.')
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

  const countdown = formatDeadlineCountdown(hackathon?.registration_deadline)
  const datesDisplay = formatEventDates(hackathon?.start_date, hackathon?.end_date)
  const isWebsiteValid = isValidExternalUrl(hackathon?.website_url)
  const isRegistrationClosed = countdown.isClosed || countdown.label === 'Registration Closed'

  return (
    <div className="min-h-screen bg-[#E9E7D8] text-[#050505] flex flex-col w-full">
      <TopNav
        currentView="hackathons"
        session={session}
        onNavigateToHome={onNavigateToHome}
        onNavigateToCommunity={onNavigateToCommunity}
        onNavigateToHackathons={onNavigateToHackathons}
        onNavigateToMyRegistrations={onNavigateToMyRegistrations}
        onNavigateToLogin={onNavigateToLogin}
        onNavigateToSignup={onNavigateToSignup}
        onSignOut={onSignOut}
        onOpenProfile={onOpenProfile}
      />

      <main className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-20 flex-1">
        {/* Navigation Action Bar */}
        <div className="flex items-center justify-between gap-4 mb-6">
          <button
            type="button"
            onClick={onNavigateBack}
            className="inline-flex cursor-pointer items-center gap-2 rounded-full border-[1.5px] border-[#050505] bg-white px-4 py-2 text-xs font-black uppercase tracking-wider text-[#050505] shadow-[2.5px_2.5px_0_#050505] hover:bg-[#F5F04A] hover:-translate-y-0.5 transition-all"
            aria-label="Back to Hackathons"
          >
            <ArrowLeft size={14} />
            <span>Back to Hackathons</span>
          </button>

          {hackathon && (
            <button
              type="button"
              onClick={() => loadDetails(true)}
              disabled={isLoading || isRefreshing}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-[#050505] bg-white px-3.5 py-1.5 text-xs font-bold text-[#050505] shadow-[2px_2px_0_#050505] hover:bg-neutral-100 disabled:opacity-50"
              title="Refresh Event Details"
              aria-label="Refresh Event Details"
            >
              <RefreshCw size={12} className={isRefreshing ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          )}
        </div>

        {/* 1. Loading Skeleton State */}
        {isLoading && (
          <div className="space-y-6 animate-pulse" aria-label="Loading hackathon details">
            <div className="h-64 sm:h-80 w-full rounded-[28px] border-[2.5px] border-[#050505] bg-white shadow-[6px_6px_0_#050505]" />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-4">
                <div className="h-44 rounded-[24px] border-[2px] border-[#050505] bg-white shadow-[4px_4px_0_#050505]" />
                <div className="h-44 rounded-[24px] border-[2px] border-[#050505] bg-white shadow-[4px_4px_0_#050505]" />
              </div>
              <div className="space-y-4">
                <div className="h-64 rounded-[24px] border-[2px] border-[#050505] bg-white shadow-[4px_4px_0_#050505]" />
              </div>
            </div>
          </div>
        )}

        {/* 2. Schema Setup Notice (When table is uninitialized) */}
        {isPendingSchema && !isLoading && (
          <section className="rounded-[28px] border-[2.5px] border-[#050505] bg-[#fffef8] p-8 sm:p-10 shadow-[6px_6px_0_#050505]">
            <div className="flex items-start gap-4">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border-2 border-[#050505] bg-[#F5F04A] text-[#050505] shadow-[2px_2px_0_#050505]">
                <Database size={24} />
              </div>
              <div className="flex-1">
                <span className="rounded-full border border-[#050505] bg-[#F5F04A] px-3 py-0.5 text-[10px] font-black uppercase text-[#050505]">
                  Database Setup Required
                </span>
                <h2 className="mt-2 text-2xl font-black uppercase text-[#050505]">
                  Hackathons Table Not Initialized
                </h2>
                <p className="mt-2 text-xs sm:text-sm text-[#39382f] leading-relaxed">
                  The <code className="rounded bg-[#E9E7D8] px-1.5 py-0.5 font-mono text-[11px] border border-[#050505]/30">public.hackathons</code> table has not been initialized in your Supabase database yet. Run the migration to enable hackathons and event details:
                </p>
                <div className="mt-2 font-mono text-xs bg-[#E9E7D8]/60 p-2.5 rounded-xl border border-[#050505]/20 text-[#050505] font-semibold">
                  supabase/migrations/20260402000000_hackathons_discovery.sql
                </div>
                <div className="mt-5 flex gap-3">
                  <button
                    type="button"
                    onClick={() => loadDetails(true)}
                    disabled={isRefreshing}
                    className="inline-flex min-h-[38px] cursor-pointer items-center gap-1.5 rounded-full border border-[#050505] bg-[#F5F04A] px-5 text-xs font-bold uppercase text-[#050505] shadow-[2px_2px_0_#050505] hover:bg-white"
                  >
                    <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
                    <span>Check Again</span>
                  </button>
                  <button
                    type="button"
                    onClick={onNavigateBack}
                    className="inline-flex min-h-[38px] cursor-pointer items-center gap-1.5 rounded-full border border-[#050505] bg-white px-5 text-xs font-bold uppercase text-[#050505] shadow-[2px_2px_0_#050505]"
                  >
                    Return to Discovery
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* 3. Not Found / Unpublished Draft State */}
        {isNotFound && !isLoading && !isPendingSchema && (
          <section className="rounded-[28px] border-[2.5px] border-[#050505] bg-[#fffef8] p-10 sm:p-14 text-center shadow-[6px_6px_0_#050505]">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full border-2 border-[#050505] bg-[#E9E7D8] text-[#050505] shadow-[3px_3px_0_#050505]">
              <ShieldAlert size={28} />
            </div>

            <h2 className="mt-5 font-black text-2xl text-[#050505] uppercase tracking-wide">
              Event Not Found or Unavailable
            </h2>

            <p className="mt-2 text-xs sm:text-sm text-[#050505]/75 max-w-md mx-auto leading-relaxed">
              This hackathon could not be found, may have expired, or is currently in draft mode and private to its organizer.
            </p>

            <div className="mt-6 flex justify-center gap-3">
              <button
                type="button"
                onClick={onNavigateBack}
                className="inline-flex min-h-[40px] cursor-pointer items-center gap-2 rounded-full border border-[#050505] bg-[#F5F04A] px-6 text-xs font-extrabold uppercase tracking-wider text-[#050505] shadow-[2.5px_2.5px_0_#050505] hover:-translate-y-0.5 transition-transform"
              >
                <ArrowLeft size={14} />
                <span>Explore Other Hackathons</span>
              </button>
            </div>
          </section>
        )}

        {/* 4. Recoverable Network / Backend Error State */}
        {errorMessage && !isLoading && !isNotFound && !isPendingSchema && (
          <section className="rounded-[28px] border-[2.5px] border-red-700 bg-red-50 p-8 sm:p-10 text-red-950 shadow-[6px_6px_0_#050505]">
            <div className="flex items-start gap-4">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border-2 border-red-700 bg-red-200 text-red-900 shadow-[2px_2px_0_#050505]">
                <AlertCircle size={22} />
              </div>
              <div className="flex-1">
                <span className="rounded-full border border-red-700 bg-red-200 px-3 py-0.5 text-[10px] font-black uppercase tracking-wider text-red-900">
                  Connection Error
                </span>
                <h2 className="mt-2 text-xl font-black uppercase text-red-950">
                  Unable to Load Hackathon
                </h2>
                <p className="mt-1.5 text-xs sm:text-sm text-red-900 leading-relaxed">
                  {errorMessage}
                </p>
                <div className="mt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => loadDetails(true)}
                    disabled={isRefreshing}
                    className="inline-flex min-h-[38px] cursor-pointer items-center gap-2 rounded-full border border-red-800 bg-white px-5 text-xs font-bold uppercase text-red-900 shadow-[2px_2px_0_#050505] hover:bg-red-100 disabled:opacity-60"
                  >
                    <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
                    <span>{isRefreshing ? 'Retrying...' : 'Retry'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={onNavigateBack}
                    className="inline-flex min-h-[38px] cursor-pointer items-center gap-2 rounded-full border border-[#050505] bg-white px-5 text-xs font-bold uppercase text-[#050505] shadow-[2px_2px_0_#050505]"
                  >
                    Back to List
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* 5. Live Hackathon Details Page */}
        {hackathon && !isLoading && !errorMessage && !isNotFound && (
          <div className="space-y-8">
            {/* Hero Card */}
            <article className="rounded-[28px] border-[2.5px] border-[#050505] bg-[#fffef8] overflow-hidden shadow-[6px_6px_0_#050505]">
              {/* Artwork Banner */}
              <div className="relative h-60 sm:h-80 w-full bg-[#E9E7D8] overflow-hidden border-b-[2.5px] border-[#050505]">
                {hackathon.cover_image_url ? (
                  <img
                    src={hackathon.cover_image_url}
                    alt={hackathon.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="grid h-full w-full place-items-center bg-gradient-to-br from-[#E9E7D8] to-[#F5F04A]/40 p-4 text-center">
                    <Laptop size={48} className="text-[#050505]/40" />
                  </div>
                )}

                {/* Badges Overlay */}
                <div className="absolute top-4 left-4 flex flex-wrap gap-2">
                  <span
                    className={`rounded-full border border-[#050505] px-3 py-1 text-xs font-black uppercase tracking-wide shadow-[2px_2px_0_#050505] ${
                      hackathon.mode === 'Online'
                        ? 'bg-[#F5F04A] text-[#050505]'
                        : hackathon.mode === 'Offline'
                          ? 'bg-[#050505] text-[#E9E7D8]'
                          : 'bg-white text-[#050505]'
                    }`}
                  >
                    {hackathon.mode}
                  </span>

                  <span className="rounded-full border border-[#050505] bg-white px-3 py-1 text-xs font-bold text-[#050505] shadow-[2px_2px_0_#050505]">
                    {hackathon.category}
                  </span>
                </div>

                {hackathon.featured && (
                  <div className="absolute top-4 right-4">
                    <span className="rounded-full border border-[#050505] bg-[#050505] px-3 py-1 text-xs font-black uppercase text-[#F5F04A] shadow-[2px_2px_0_#050505]">
                      ★ Featured Competition
                    </span>
                  </div>
                )}
              </div>

              {/* Event Header Information */}
              <div className="p-6 sm:p-10">
                <div className="flex flex-wrap items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-[#050505]/60">
                  <Building size={14} className="shrink-0" />
                  <span>Organized by</span>
                  <span className="text-[#050505] underline underline-offset-2">
                    {hackathon.organizer}
                  </span>
                </div>

                <h1 className="display-font mt-3 text-3xl sm:text-5xl uppercase text-[#050505] leading-tight">
                  {hackathon.title}
                </h1>

                {/* Key Metadata Pills Strip */}
                <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 border-y border-[#050505]/15 py-5 text-xs">
                  {/* Dates */}
                  <div className="flex items-center gap-3 rounded-2xl border border-[#050505] bg-[#E9E7D8]/60 p-3 shadow-[1.5px_1.5px_0_#050505]">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-[#050505] bg-white text-[#050505]">
                      <Calendar size={16} />
                    </div>
                    <div>
                      <span className="block text-[10px] font-bold uppercase text-[#050505]/60">
                        Event Dates
                      </span>
                      <span className="font-extrabold text-[#050505]">{datesDisplay}</span>
                    </div>
                  </div>

                  {/* Deadline Countdown */}
                  <div className="flex items-center gap-3 rounded-2xl border border-[#050505] bg-[#E9E7D8]/60 p-3 shadow-[1.5px_1.5px_0_#050505]">
                    <div
                      className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-[#050505] ${
                        countdown.isClosingSoon
                          ? 'bg-red-500 text-white'
                          : 'bg-white text-[#050505]'
                      }`}
                    >
                      <Clock size={16} />
                    </div>
                    <div>
                      <span className="block text-[10px] font-bold uppercase text-[#050505]/60">
                        Registration
                      </span>
                      <span
                        className={`font-extrabold ${
                          countdown.isClosingSoon ? 'text-red-700' : 'text-[#050505]'
                        }`}
                      >
                        {countdown.label}
                      </span>
                    </div>
                  </div>

                  {/* Prize Pool */}
                  <div className="flex items-center gap-3 rounded-2xl border border-[#050505] bg-[#E9E7D8]/60 p-3 shadow-[1.5px_1.5px_0_#050505]">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-[#050505] bg-[#F5F04A] text-[#050505]">
                      <Trophy size={16} />
                    </div>
                    <div>
                      <span className="block text-[10px] font-bold uppercase text-[#050505]/60">
                        Prize Pool
                      </span>
                      <span className="font-extrabold text-[#050505]">
                        {hackathon.prize_pool || 'Prizes & Certificates'}
                      </span>
                    </div>
                  </div>

                  {/* Location */}
                  <div className="flex items-center gap-3 rounded-2xl border border-[#050505] bg-[#E9E7D8]/60 p-3 shadow-[1.5px_1.5px_0_#050505]">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-[#050505] bg-white text-[#050505]">
                      <MapPin size={16} />
                    </div>
                    <div>
                      <span className="block text-[10px] font-bold uppercase text-[#050505]/60">
                        Venue / Location
                      </span>
                      <span className="font-extrabold text-[#050505] truncate">
                        {hackathon.location || (hackathon.mode === 'Online' ? 'Virtual / Online' : 'Campus Venue')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Call to Action Bar */}
                <div className="mt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#E9E7D8]/40 p-4 sm:p-5 rounded-2xl border border-[#050505]/20">
                  <div className="max-w-xl">
                    <h3 className="font-black text-sm uppercase text-[#050505]">
                      Event Participation & Registration
                    </h3>
                    <p className="text-xs text-[#050505]/75 mt-0.5">
                      {isRegistrationClosed
                        ? `Registration for this event closed on ${
                            hackathon.registration_deadline
                              ? new Date(hackathon.registration_deadline).toLocaleDateString(undefined, {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })
                              : 'the deadline'
                          }. New applications are no longer accepted.`
                        : 'Submit your student application online. Review eligibility and guidelines below before registering.'}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    {isRegistrationClosed ? (
                      <button
                        type="button"
                        disabled
                        aria-disabled="true"
                        className="inline-flex min-h-[44px] cursor-not-allowed items-center justify-center gap-2 rounded-full border border-[#050505]/30 bg-gray-200 px-6 text-xs font-bold uppercase tracking-wider text-gray-500"
                      >
                        <span>Registration Closed</span>
                      </button>
                    ) : onNavigateToRegister ? (
                      <button
                        type="button"
                        onClick={() => onNavigateToRegister(hackathon.id)}
                        className="inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-full border-[2px] border-[#050505] bg-[#F5F04A] px-6 text-xs font-black uppercase tracking-wider text-[#050505] shadow-[3px_3px_0_#050505] hover:bg-white hover:-translate-y-0.5 transition-all text-center"
                      >
                        <span>Register on HackhIt</span>
                        <ArrowRight size={14} />
                      </button>
                    ) : null}

                    {isWebsiteValid ? (
                      <a
                        href={hackathon.website_url!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-1.5 rounded-full border-[2px] border-[#050505] bg-white px-5 text-xs font-bold uppercase tracking-wider text-[#050505] shadow-[2px_2px_0_#050505] hover:bg-[#E9E7D8] hover:-translate-y-0.5 transition-all text-center"
                      >
                        <span>{isRegistrationClosed ? 'Visit Official Archive' : 'Register on Official Site'}</span>
                        <ExternalLink size={13} />
                      </a>
                    ) : !onNavigateToRegister && !isRegistrationClosed ? (
                      <span className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-full border border-[#050505]/40 bg-white/70 px-5 text-xs font-bold text-[#050505]/60">
                        <span>Registration Link Pending</span>
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            </article>

            {/* Event Content Sections Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left Column: Description, Eligibility, Rules */}
              <div className="lg:col-span-2 space-y-8">
                {/* 1. About the Hackathon */}
                <section className="rounded-[24px] border-[2px] border-[#050505] bg-[#fffef8] p-6 sm:p-8 shadow-[4px_4px_0_#050505]">
                  <div className="flex items-center gap-2 border-b border-[#050505]/15 pb-4">
                    <Sparkles size={18} className="text-[#050505]" />
                    <h2 className="font-black text-lg uppercase tracking-wide text-[#050505]">
                      About This Challenge
                    </h2>
                  </div>
                  <div className="mt-4 text-xs sm:text-sm text-[#39382f] leading-relaxed whitespace-pre-line">
                    {hackathon.description || 'No detailed overview has been provided by the organizer for this event.'}
                  </div>
                </section>

                {/* 2. Eligibility Requirements */}
                {hackathon.eligibility && (
                  <section className="rounded-[24px] border-[2px] border-[#050505] bg-[#fffef8] p-6 sm:p-8 shadow-[4px_4px_0_#050505]">
                    <div className="flex items-center gap-2 border-b border-[#050505]/15 pb-4">
                      <CheckCircle2 size={18} className="text-emerald-700" />
                      <h2 className="font-black text-lg uppercase tracking-wide text-[#050505]">
                        Eligibility Criteria
                      </h2>
                    </div>
                    <div className="mt-4 text-xs sm:text-sm text-[#39382f] leading-relaxed whitespace-pre-line">
                      {hackathon.eligibility}
                    </div>
                  </section>
                )}

                {/* 3. Rules & Guidelines */}
                {hackathon.rules && (
                  <section className="rounded-[24px] border-[2px] border-[#050505] bg-[#fffef8] p-6 sm:p-8 shadow-[4px_4px_0_#050505]">
                    <div className="flex items-center gap-2 border-b border-[#050505]/15 pb-4">
                      <FileText size={18} className="text-[#050505]" />
                      <h2 className="font-black text-lg uppercase tracking-wide text-[#050505]">
                        Rules & Submission Guidelines
                      </h2>
                    </div>
                    <div className="mt-4 text-xs sm:text-sm text-[#39382f] leading-relaxed whitespace-pre-line">
                      {hackathon.rules}
                    </div>
                  </section>
                )}
              </div>

              {/* Right Sidebar: Timeline & Schedule */}
              <div className="space-y-8">
                {/* Schedule & Milestones */}
                {hackathon.schedule && (
                  <aside className="rounded-[24px] border-[2px] border-[#050505] bg-[#fffef8] p-6 sm:p-8 shadow-[4px_4px_0_#050505]">
                    <div className="flex items-center gap-2 border-b border-[#050505]/15 pb-4">
                      <Clock size={18} className="text-[#050505]" />
                      <h2 className="font-black text-lg uppercase tracking-wide text-[#050505]">
                        Schedule & Timeline
                      </h2>
                    </div>
                    <div className="mt-4 text-xs sm:text-sm text-[#39382f] leading-relaxed whitespace-pre-line">
                      {hackathon.schedule}
                    </div>
                  </aside>
                )}

                {/* Quick Info Box */}
                <aside className="rounded-[24px] border-[2px] border-[#050505] bg-[#F5F04A]/30 p-6 shadow-[4px_4px_0_#050505] space-y-3 text-xs">
                  <h3 className="font-black uppercase text-[#050505] text-sm tracking-wide">
                    Student Checklist
                  </h3>
                  <ul className="space-y-2 text-[#050505]/85">
                    <li className="flex items-start gap-2">
                      <span className="font-black text-[#050505]">•</span>
                      <span>Review team size requirements before forming squads.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-black text-[#050505]">•</span>
                      <span>Ensure university identity cards are ready for verification.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-black text-[#050505]">•</span>
                      <span>Connect in HackhIt campus community to find project partners.</span>
                    </li>
                  </ul>
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() =>
                        onNavigateToCommunity(
                          hackathon
                            ? `Looking for teammates for ${hackathon.title}! Drop a reply if you'd like to collaborate.`
                            : undefined
                        )
                      }
                      className="w-full inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-full border border-[#050505] bg-white py-2 font-bold text-xs uppercase text-[#050505] shadow-[1.5px_1.5px_0_#050505] hover:bg-[#F5F04A] transition-all"
                    >
                      <span>Find Teammates in Community</span>
                    </button>
                  </div>
                </aside>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
