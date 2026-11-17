/**
 * HackhIt — My Registrations Page Component
 *
 * Displays all hackathon registrations belonging to the currently authenticated student.
 * - Enforces database-level isolation and session identity (never client-supplied user IDs).
 * - Joins registration records with live hackathon event data.
 * - Displays event title, organizer, dates, registration ID, format, and real stored status.
 * - Full loading, empty, error, and retry states.
 * - Matches the HackhIt visual identity: Ivory (#E9E7D8), Ink Black (#050505), Lemon Yellow (#F5F04A).
 */

import { useState, useEffect, useCallback } from 'react'
import type { Session } from '@supabase/supabase-js'
import {
  Calendar,
  Building,
  MapPin,
  Users,
  User,
  ArrowRight,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  Sparkles,
  Ticket,
  Copy,
  Check,
  Compass,
  MessageSquare,
} from 'lucide-react'
import { TopNav } from './TopNav'
import { fetchMyRegistrations, formatEventDates } from '../lib/hackathons'
import type { UserRegistrationItem } from '../types/hackathons'

export interface MyRegistrationsProps {
  session?: Session | null
  onNavigateToHome: () => void
  onNavigateToCommunity: (prefill?: string) => void
  onNavigateToHackathons: () => void
  onNavigateToEventDetails: (id: string) => void
  onNavigateToLogin: () => void
  onNavigateToSignup: () => void
  onSignOut?: () => void
  onOpenProfile?: () => void
}

export function MyRegistrations({
  session,
  onNavigateToHome,
  onNavigateToCommunity,
  onNavigateToHackathons,
  onNavigateToEventDetails,
  onNavigateToLogin,
  onNavigateToSignup,
  onSignOut,
  onOpenProfile,
}: MyRegistrationsProps) {
  const [registrations, setRegistrations] = useState<UserRegistrationItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPendingSchema, setIsPendingSchema] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const loadRegistrations = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setIsRefreshing(true)
    } else {
      setIsLoading(true)
    }
    setError(null)

    try {
      const result = await fetchMyRegistrations()
      if (result.error) {
        setError(result.error)
        setIsPendingSchema(result.isPendingSchema)
        setRegistrations([])
      } else {
        setRegistrations(result.registrations)
        setIsPendingSchema(false)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.')
      setRegistrations([])
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  useEffect(() => {
    loadRegistrations()
  }, [loadRegistrations, session?.user?.id])

  const copyRegistrationId = (id: string) => {
    navigator.clipboard.writeText(id).then(() => {
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    })
  }

  // Format status badge text and color based on real database status
  const renderStatusBadge = (status: string) => {
    const normalized = (status || '').toLowerCase()
    switch (normalized) {
      case 'confirmed':
      case 'registered':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-800 bg-emerald-100 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-emerald-800 shadow-[1.5px_1.5px_0_#065f46]">
            <CheckCircle2 size={13} />
            <span>{normalized === 'confirmed' ? 'Confirmed' : 'Registered'}</span>
          </span>
        )
      case 'waitlisted':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#050505] bg-[#F5F04A] px-3 py-1 text-[11px] font-black uppercase tracking-wider text-[#050505] shadow-[1.5px_1.5px_0_#050505]">
            <Clock size={13} />
            <span>Waitlisted</span>
          </span>
        )
      case 'withdrawn':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-stone-400 bg-stone-200 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-stone-700 shadow-[1.5px_1.5px_0_#78716c]">
            <AlertCircle size={13} />
            <span>Withdrawn</span>
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#050505] bg-white px-3 py-1 text-[11px] font-black uppercase tracking-wider text-[#050505] shadow-[1.5px_1.5px_0_#050505]">
            <span>{status || 'Submitted'}</span>
          </span>
        )
    }
  }

  return (
    <div className="site-shell min-h-screen bg-[#E9E7D8] text-[#050505] flex flex-col w-full">
      <TopNav
        currentView="my-registrations"
        session={session}
        onNavigateToHome={onNavigateToHome}
        onNavigateToCommunity={() => onNavigateToCommunity()}
        onNavigateToHackathons={onNavigateToHackathons}
        onNavigateToMyRegistrations={() => {}}
        onNavigateToLogin={onNavigateToLogin}
        onNavigateToSignup={onNavigateToSignup}
        onSignOut={onSignOut}
        onOpenProfile={onOpenProfile}
      />

      <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-20 flex-1">
        {/* Header Editorial Section */}
        <section className="rounded-[28px] border-[2.5px] border-[#050505] bg-[#fffef8] p-6 sm:p-10 shadow-[6px_6px_0_#050505] mb-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-[#050505] bg-[#F5F04A] px-3.5 py-1 text-[11px] font-extrabold uppercase tracking-wider text-[#050505]">
                <Ticket size={12} />
                <span>Student Dashboard</span>
              </div>

              <h1 className="display-font mt-3.5 text-4xl sm:text-6xl text-[#050505] leading-none uppercase">
                My Registrations
              </h1>

              <p className="mt-3 text-xs sm:text-sm text-[#39382f] leading-relaxed">
                Review your registered hackathons, confirmed roster details, competition dates, and official registration passes.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-[#050505] bg-[#E9E7D8] p-3 text-center min-w-[100px] shadow-[2px_2px_0_#050505]">
                <span className="block font-black text-xl text-[#050505]">
                  {isLoading ? '...' : registrations.length}
                </span>
                <span className="block text-[10px] font-bold uppercase tracking-wider text-[#050505]/70">
                  Registered
                </span>
              </div>

              <button
                type="button"
                onClick={() => loadRegistrations(true)}
                disabled={isLoading || isRefreshing}
                className="grid h-12 w-12 place-items-center rounded-2xl border border-[#050505] bg-white text-[#050505] shadow-[2px_2px_0_#050505] hover:bg-[#F5F04A] transition-colors disabled:opacity-50 cursor-pointer"
                title="Refresh registrations"
                aria-label="Refresh registrations"
              >
                <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>
        </section>

        {/* 1. UNAUTHENTICATED STATE */}
        {!session && (
          <div className="rounded-[28px] border-[2.5px] border-[#050505] bg-white p-8 sm:p-12 text-center shadow-[6px_6px_0_#050505] space-y-6">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border-[2px] border-[#050505] bg-[#F5F04A] shadow-[3px_3px_0_#050505]">
              <User size={32} className="text-[#050505]" />
            </div>

            <div className="space-y-2 max-w-lg mx-auto">
              <h2 className="display-font text-2xl sm:text-4xl uppercase text-[#050505]">
                Student Sign In Required
              </h2>
              <p className="text-xs sm:text-sm text-[#050505]/75">
                Your registrations are securely linked to your student account. Sign in to view your applications, team rosters, and event passes.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={onNavigateToLogin}
                className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full border-[2px] border-[#050505] bg-[#F5F04A] px-6 text-xs font-black uppercase tracking-wider text-[#050505] shadow-[3px_3px_0_#050505] hover:bg-white transition-colors"
              >
                <span>Sign In</span>
                <ArrowRight size={14} />
              </button>
              <button
                type="button"
                onClick={onNavigateToSignup}
                className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full border-[2px] border-[#050505] bg-white px-6 text-xs font-bold uppercase tracking-wider text-[#050505] shadow-[2px_2px_0_#050505] hover:bg-[#E9E7D8] transition-colors"
              >
                <span>Create Student Account</span>
              </button>
            </div>
          </div>
        )}

        {/* 2. LOADING SKELETON STATE */}
        {session && isLoading && !isRefreshing && (
          <div className="space-y-6">
            {[1, 2].map((n) => (
              <div
                key={n}
                className="rounded-[24px] border-[2.5px] border-[#050505] bg-white p-6 sm:p-8 shadow-[4px_4px_0_#050505] animate-pulse space-y-4"
              >
                <div className="flex items-center justify-between border-b border-[#050505]/10 pb-4">
                  <div className="h-5 w-48 bg-stone-200 rounded-full" />
                  <div className="h-6 w-24 bg-stone-200 rounded-full" />
                </div>
                <div className="h-8 w-3/4 bg-stone-200 rounded-xl" />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                  <div className="h-16 bg-stone-100 rounded-xl border border-stone-200" />
                  <div className="h-16 bg-stone-100 rounded-xl border border-stone-200" />
                  <div className="h-16 bg-stone-100 rounded-xl border border-stone-200" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 3. ERROR & RETRY STATE */}
        {session && error && !isLoading && (
          <div
            role="alert"
            className="rounded-[24px] border-[2.5px] border-red-600 bg-red-50 p-6 sm:p-8 text-center shadow-[5px_5px_0_#dc2626] space-y-4"
          >
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border-2 border-red-600 bg-white text-red-600 shadow-[2px_2px_0_#dc2626]">
              <AlertCircle size={24} />
            </div>

            <div className="space-y-1 max-w-lg mx-auto">
              <h2 className="display-font text-xl sm:text-2xl uppercase text-red-900">
                Failed to Load Registrations
              </h2>
              <p className="text-xs sm:text-sm text-red-800">
                {error}
              </p>
              {isPendingSchema && (
                <p className="text-[11px] text-red-700 mt-2 font-mono">
                  Database table <code className="bg-red-100 px-1 py-0.5 rounded">public.hackathon_registrations</code> migration may be pending.
                </p>
              )}
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => loadRegistrations()}
                className="inline-flex min-h-[42px] cursor-pointer items-center gap-2 rounded-full border-2 border-red-900 bg-red-900 px-5 text-xs font-bold uppercase tracking-wider text-white shadow-[2px_2px_0_#000] hover:bg-red-800 transition-colors"
              >
                <RefreshCw size={13} />
                <span>Retry Loading</span>
              </button>
            </div>
          </div>
        )}

        {/* 4. EMPTY STATE */}
        {session && !isLoading && !error && registrations.length === 0 && (
          <div className="rounded-[28px] border-[2.5px] border-[#050505] bg-white p-8 sm:p-14 text-center shadow-[6px_6px_0_#050505] space-y-6">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border-[2px] border-[#050505] bg-[#F5F04A] shadow-[3px_3px_0_#050505]">
              <Compass size={32} className="text-[#050505]" />
            </div>

            <div className="space-y-2 max-w-md mx-auto">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-[#050505] bg-[#E9E7D8] px-3 py-0.5 text-[10px] font-black uppercase text-[#050505]">
                <span>No Registrations Found</span>
              </div>
              <h2 className="display-font text-3xl sm:text-4xl uppercase text-[#050505] mt-2">
                No Applications Yet
              </h2>
              <p className="text-xs sm:text-sm text-[#050505]/75 leading-relaxed">
                You haven't registered for any hackathons yet. Explore current challenges, assemble your team, and submit your registration!
              </p>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={onNavigateToHackathons}
                className="inline-flex min-h-[46px] cursor-pointer items-center gap-2 rounded-full border-[2px] border-[#050505] bg-[#F5F04A] px-7 text-xs font-black uppercase tracking-wider text-[#050505] shadow-[3px_3px_0_#050505] hover:bg-white hover:-translate-y-0.5 transition-all"
              >
                <Sparkles size={14} />
                <span>Explore Upcoming Hackathons</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* 5. ACTIVE REGISTRATIONS LIST */}
        {session && !isLoading && !error && registrations.length > 0 && (
          <div className="space-y-6">
            {registrations.map((item) => {
              const eventTitle = item.hackathon?.title || 'Hackathon Event'
              const organizer = item.hackathon?.organizer || 'Campus Organizer'
              const eventDates = formatEventDates(item.hackathon?.start_date, item.hackathon?.end_date)
              const venue = item.hackathon?.location || (item.hackathon?.mode === 'Online' ? 'Virtual / Online' : 'Campus Venue')
              const regDate = item.created_at
                ? new Date(item.created_at).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : 'Recently'

              const isTeam = item.participation_type === 'team'
              const totalTeamSize = (item.teammates?.length || 0) + 1

              return (
                <article
                  key={item.id}
                  className="rounded-[26px] border-[2.5px] border-[#050505] bg-white p-6 sm:p-8 shadow-[5px_5px_0_#050505] transition-all hover:shadow-[7px_7px_0_#050505]"
                >
                  {/* Card Header: Organizer, Mode, Status */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#050505]/15 pb-4">
                    <div className="flex items-center gap-2 text-xs font-bold text-[#050505]/75">
                      <Building size={14} className="text-[#050505]" />
                      <span>Organized by <strong>{organizer}</strong></span>
                    </div>

                    <div className="flex items-center gap-2.5">
                      {item.hackathon?.mode && (
                        <span className="rounded-full border border-[#050505] bg-[#E9E7D8] px-2.5 py-0.5 text-[11px] font-bold text-[#050505] shadow-[1px_1px_0_#050505]">
                          {item.hackathon.mode}
                        </span>
                      )}
                      {item.hackathon?.category && (
                        <span className="rounded-full border border-[#050505] bg-white px-2.5 py-0.5 text-[11px] font-bold text-[#050505] shadow-[1px_1px_0_#050505]">
                          {item.hackathon.category}
                        </span>
                      )}
                      {renderStatusBadge(item.status)}
                    </div>
                  </div>

                  {/* Event Title & Dates */}
                  <div className="mt-4 flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="space-y-1.5 max-w-3xl">
                      <h2 className="display-font text-2xl sm:text-3xl uppercase text-[#050505]">
                        <a
                          href={`#hackathons/${item.hackathon_id}`}
                          onClick={(e) => {
                            e.preventDefault()
                            onNavigateToEventDetails(item.hackathon_id)
                          }}
                          className="hover:underline hover:text-[#050505]/80 cursor-pointer"
                        >
                          {eventTitle}
                        </a>
                      </h2>

                      <div className="flex flex-wrap items-center gap-4 text-xs text-[#050505]/80 pt-1">
                        <span className="inline-flex items-center gap-1.5 font-bold">
                          <Calendar size={13} className="text-[#050505]" />
                          <span>Event Dates: {eventDates}</span>
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin size={13} className="text-[#050505]" />
                          <span>{venue}</span>
                        </span>
                      </div>
                    </div>

                    {/* Registration ID Badge */}
                    <div className="shrink-0 rounded-2xl border border-[#050505] bg-[#E9E7D8]/80 p-3 shadow-[1.5px_1.5px_0_#050505]">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-[10px] font-black uppercase text-[#050505]/60">
                          Registration ID
                        </span>
                        <button
                          type="button"
                          onClick={() => copyRegistrationId(item.id)}
                          className="text-[#050505]/60 hover:text-[#050505] cursor-pointer p-0.5"
                          title="Copy Registration ID"
                          aria-label="Copy Registration ID"
                        >
                          {copiedId === item.id ? <Check size={12} className="text-emerald-700" /> : <Copy size={12} />}
                        </button>
                      </div>
                      <span className="block font-mono text-xs font-black text-[#050505]">
                        {item.id.slice(0, 13)}...
                      </span>
                    </div>
                  </div>

                  {/* Registration Details Grid */}
                  <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-4 border-t border-[#050505]/10 text-xs">
                    {/* Participation Format */}
                    <div className="rounded-xl border border-[#050505]/20 bg-[#fffef8] p-3.5 space-y-1">
                      <span className="block text-[10px] font-black uppercase text-[#050505]/60">
                        Format
                      </span>
                      <div className="flex items-center gap-2">
                        {isTeam ? (
                          <>
                            <Users size={15} className="text-[#050505] shrink-0" />
                            <span className="font-bold text-[#050505]">
                              Team: "{item.team_name}" ({totalTeamSize} members)
                            </span>
                          </>
                        ) : (
                          <>
                            <User size={15} className="text-[#050505] shrink-0" />
                            <span className="font-bold text-[#050505]">
                              Individual Hacker (Solo)
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Applicant Info */}
                    <div className="rounded-xl border border-[#050505]/20 bg-[#fffef8] p-3.5 space-y-1">
                      <span className="block text-[10px] font-black uppercase text-[#050505]/60">
                        Lead Applicant
                      </span>
                      <p className="font-bold text-[#050505] truncate">
                        {item.full_name}
                      </p>
                      <p className="text-[11px] text-[#050505]/70 truncate">
                        {item.email} {item.university ? `• ${item.university}` : ''}
                      </p>
                    </div>

                    {/* Registration Timestamp */}
                    <div className="rounded-xl border border-[#050505]/20 bg-[#fffef8] p-3.5 space-y-1">
                      <span className="block text-[10px] font-black uppercase text-[#050505]/60">
                        Registered On
                      </span>
                      <p className="font-bold text-[#050505]">
                        {regDate}
                      </p>
                      <p className="text-[11px] text-emerald-800 font-bold">
                        Eligibility & Rules Accepted
                      </p>
                    </div>
                  </div>

                  {/* Teammate Roster (if team format) */}
                  {isTeam && item.teammates && item.teammates.length > 0 && (
                    <div className="mt-4 rounded-xl border border-[#050505]/15 bg-[#E9E7D8]/40 p-4">
                      <span className="block text-[11px] font-black uppercase text-[#050505]/70 mb-2">
                        Team Members on Roster:
                      </span>
                      <div className="flex flex-wrap gap-2">
                        <div className="rounded-full border border-[#050505] bg-white px-3 py-1 text-xs font-bold text-[#050505] shadow-[1px_1px_0_#050505]">
                          <span>{item.full_name} (Lead)</span>
                        </div>
                        {item.teammates.map((tm, idx) => (
                          <div
                            key={idx}
                            className="rounded-full border border-[#050505]/30 bg-white/80 px-3 py-1 text-xs text-[#050505]"
                          >
                            <span className="font-semibold">{tm.name}</span>
                            <span className="text-[#050505]/60 text-[11px] ml-1.5">({tm.email})</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions Footer */}
                  <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[#050505]/15 pt-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => onNavigateToEventDetails(item.hackathon_id)}
                        className="inline-flex min-h-[38px] cursor-pointer items-center gap-1.5 rounded-full border border-[#050505] bg-[#F5F04A] px-4 text-xs font-black uppercase tracking-wider text-[#050505] shadow-[2px_2px_0_#050505] hover:bg-white transition-colors"
                      >
                        <span>View Event Details</span>
                        <ArrowRight size={13} />
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          onNavigateToCommunity(
                            `Registered for ${eventTitle}! Looking to connect with fellow hackers and exchange ideas.`
                          )
                        }
                        className="inline-flex min-h-[38px] cursor-pointer items-center gap-1.5 rounded-full border border-[#050505] bg-white px-4 text-xs font-bold uppercase tracking-wider text-[#050505] shadow-[1.5px_1.5px_0_#050505] hover:bg-[#E9E7D8] transition-colors"
                      >
                        <MessageSquare size={13} />
                        <span>Find Teammates</span>
                      </button>
                    </div>

                    {item.hackathon?.website_url && (
                      <a
                        href={item.hackathon.website_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-bold text-[#050505]/70 hover:text-[#050505] hover:underline"
                      >
                        <span>Official Website</span>
                        <ExternalLink size={12} />
                      </a>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
