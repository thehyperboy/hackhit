/**
 * HackhIt — Hackathon Discovery Component
 *
 * Dedicated discovery view allowing students to browse, search, and filter
 * verified hackathons by category, participation mode, and registration deadline.
 * Powered by real Supabase backend data with RLS protection and safe error handling.
 */

import { useState, useMemo, useEffect, useCallback } from 'react'
import type { Session } from '@supabase/supabase-js'
import {
  Search,
  X,
  Trophy,
  Calendar,
  Clock,
  MapPin,
  ArrowRight,
  Sparkles,
  SlidersHorizontal,
  RotateCcw,
  Laptop,
  RefreshCw,
} from 'lucide-react'

import { TopNav } from './TopNav'
import {
  fetchHackathons,
  formatEventDates,
  formatDeadlineCountdown,
  REAL_WORLD_HACKATHONS,
} from '../lib/hackathons'
import type {
  Hackathon,
  HackathonCategory,
  ParticipationMode,
  DeadlineSort,
  HackathonFilterState,
} from '../types/hackathons'

interface HackathonDiscoveryProps {
  initialHackathons?: Hackathon[]
  filters?: HackathonFilterState
  onFiltersChange?: (filters: HackathonFilterState) => void
  session?: Session | null
  onNavigateToHome: () => void
  onNavigateToCommunity: () => void
  onNavigateToExplore?: () => void
  onNavigateToHackathons?: () => void
  onNavigateToMyRegistrations?: () => void
  onNavigateToLogin: () => void
  onNavigateToSignup: () => void
  onSignOut?: () => void
  onOpenProfile?: () => void
  onSelectHackathon?: (hackathon: Hackathon) => void
}

const CATEGORIES: HackathonCategory[] = [
  'All',
  'AI/ML',
  'Web Development',
  'Blockchain',
  'Data Science',
  'Open Innovation',
]

const MODES: { label: string; value: ParticipationMode }[] = [
  { label: 'All Modes', value: 'All' },
  { label: 'Online', value: 'Online' },
  { label: 'Offline', value: 'Offline' },
  { label: 'Hybrid', value: 'Hybrid' },
]

export function HackathonDiscovery({
  initialHackathons,
  filters,
  onFiltersChange,
  session,
  onNavigateToHome,
  onNavigateToCommunity,
  onNavigateToExplore,
  onNavigateToHackathons,
  onNavigateToMyRegistrations,
  onNavigateToLogin,
  onNavigateToSignup,
  onSignOut,
  onOpenProfile,
  onSelectHackathon,
}: HackathonDiscoveryProps) {
  // Data state
  const [hackathons, setHackathons] = useState<Hackathon[]>(initialHackathons || REAL_WORLD_HACKATHONS)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isPendingSchema, setIsPendingSchema] = useState<boolean>(false)
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false)

  // Search & Filter state (initialized with preserved filter state if provided)
  const [searchQuery, setSearchQuery] = useState(filters?.searchQuery || '')
  const [selectedCategory, setSelectedCategory] = useState<HackathonCategory>(filters?.category || 'All')
  const [selectedMode, setSelectedMode] = useState<ParticipationMode>(filters?.mode || 'All')
  const [sortBy, setSortBy] = useState<DeadlineSort>(filters?.sortBy || 'closing-soon')

  const handleSearchChange = (q: string) => {
    setSearchQuery(q)
    onFiltersChange?.({ searchQuery: q, category: selectedCategory, mode: selectedMode, sortBy })
  }

  const handleCategoryChange = (cat: HackathonCategory) => {
    setSelectedCategory(cat)
    onFiltersChange?.({ searchQuery, category: cat, mode: selectedMode, sortBy })
  }

  const handleModeChange = (m: ParticipationMode) => {
    setSelectedMode(m)
    onFiltersChange?.({ searchQuery, category: selectedCategory, mode: m, sortBy })
  }

  const handleSortChange = (s: DeadlineSort) => {
    setSortBy(s)
    onFiltersChange?.({ searchQuery, category: selectedCategory, mode: selectedMode, sortBy: s })
  }

  const handleResetFilters = () => {
    setSearchQuery('')
    setSelectedCategory('All')
    setSelectedMode('All')
    setSortBy('closing-soon')
    onFiltersChange?.({ searchQuery: '', category: 'All', mode: 'All', sortBy: 'closing-soon' })
  }

  // Real data fetching function for manual reload/retry
  const loadHackathons = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setIsRefreshing(true)
    } else {
      setIsLoading(true)
    }
    setErrorMessage(null)

    try {
      const result = await fetchHackathons()

      if (result.hackathons && result.hackathons.length > 0) {
        setIsPendingSchema(false)
        setErrorMessage(null)
        setHackathons(result.hackathons)
      } else if (result.error) {
        setIsPendingSchema(false)
        setErrorMessage(result.error)
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'An unexpected error occurred while loading hackathons.'
      )
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  // Initial load effect with async cancellation and abort controller
  useEffect(() => {
    if (initialHackathons) return

    let cancelled = false
    const controller = new AbortController()

    fetchHackathons({ signal: controller.signal })
      .then((result) => {
        if (cancelled) return
        if (result.hackathons && result.hackathons.length > 0) {
          setIsPendingSchema(false)
          setErrorMessage(null)
          setHackathons(result.hackathons)
        } else if (result.error) {
          setIsPendingSchema(false)
          setErrorMessage(result.error)
        }
      })
      .catch((err) => {
        if (cancelled) return
        setErrorMessage(
          err instanceof Error ? err.message : 'An unexpected error occurred while loading hackathons.'
        )
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false)
        }
      })

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [initialHackathons])

  // Search, Filter & Sort computation with safe null handling
  const filteredHackathons = useMemo(() => {
    return hackathons
      .filter((hackathon) => {
        // 1. Search Query (checks title, organizer, category, description, location)
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim()
          const matchesTitle = (hackathon.title || '').toLowerCase().includes(q)
          const matchesOrg = (hackathon.organizer || '').toLowerCase().includes(q)
          const matchesCat = (hackathon.category || '').toLowerCase().includes(q)
          const matchesDesc = (hackathon.description || '').toLowerCase().includes(q)
          const matchesLoc = (hackathon.location || '').toLowerCase().includes(q)

          if (!matchesTitle && !matchesOrg && !matchesCat && !matchesDesc && !matchesLoc) {
            return false
          }
        }

        // 2. Category Filter
        if (selectedCategory !== 'All') {
          if ((hackathon.category || '').toLowerCase() !== selectedCategory.toLowerCase()) {
            return false
          }
        }

        // 3. Mode Filter
        if (selectedMode !== 'All') {
          if ((hackathon.mode || '').toLowerCase() !== selectedMode.toLowerCase()) {
            return false
          }
        }

        return true
      })
      .sort((a, b) => {
        const timeA = a.registration_deadline ? new Date(a.registration_deadline).getTime() : NaN
        const timeB = b.registration_deadline ? new Date(b.registration_deadline).getTime() : NaN

        const isValidA = !isNaN(timeA)
        const isValidB = !isNaN(timeB)

        // Always put items without valid deadlines at the end
        if (!isValidA && !isValidB) return 0
        if (!isValidA) return 1
        if (!isValidB) return -1

        if (sortBy === 'closing-soon') {
          return timeA - timeB
        } else {
          return timeB - timeA
        }
      })
  }, [hackathons, searchQuery, selectedCategory, selectedMode, sortBy])

  const hasActiveFilters =
    searchQuery.trim().length > 0 ||
    selectedCategory !== 'All' ||
    selectedMode !== 'All' ||
    sortBy !== 'closing-soon'

  return (
    <div className="min-h-screen bg-[#E9E7D8] text-[#050505] flex flex-col w-full pb-20 md:pb-6">
      <TopNav
        currentView="explore"
        session={session}
        onNavigateToHome={onNavigateToHome}
        onNavigateToCommunity={onNavigateToCommunity}
        onNavigateToExplore={onNavigateToExplore}
        onNavigateToHackathons={onNavigateToHackathons || (() => { window.location.hash = '#hackathons' })}
        onNavigateToMyRegistrations={onNavigateToMyRegistrations}
        onNavigateToLogin={onNavigateToLogin}
        onNavigateToSignup={onNavigateToSignup}
        onSignOut={onSignOut}
        onOpenProfile={onOpenProfile}
      />

      {/* Main Container */}
      <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-20 flex-1">
        {/* Editorial Heading Section */}
        <section className="rounded-[28px] border-[2.5px] border-[#050505] bg-[#fffef8] p-6 sm:p-10 shadow-[6px_6px_0_#050505] reveal">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-[#050505] bg-[#F5F04A] px-3.5 py-1 text-[11px] font-extrabold uppercase tracking-wider text-[#050505]">
                <Sparkles size={12} />
                <span>Explore Campus Competitions</span>
              </div>

              <h1 className="display-font mt-3.5 text-4xl sm:text-6xl text-[#050505] leading-none uppercase">
                Explore Hackathons
              </h1>

              <p className="mt-3 text-xs sm:text-sm text-[#39382f] leading-relaxed">
                Discover university-hosted hackathons, campus ideathons, and collegiate coding competitions.
                Search below by competition name, technical domain, organizer, or city.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-[#050505] bg-[#E9E7D8] p-3 text-center min-w-[90px] shadow-[2px_2px_0_#050505]">
                <span className="block font-black text-xl text-[#050505]">
                  {isLoading ? '...' : hackathons.length}
                </span>
                <span className="block text-[10px] font-bold uppercase tracking-wider text-[#050505]/70">
                  Listed
                </span>
              </div>
              <div className="rounded-2xl border border-[#050505] bg-[#F5F04A] p-3 text-center min-w-[90px] shadow-[2px_2px_0_#050505]">
                <span className="block font-black text-xl text-[#050505]">
                  {isLoading ? '...' : filteredHackathons.length}
                </span>
                <span className="block text-[10px] font-bold uppercase tracking-wider text-[#050505]/70">
                  Matches
                </span>
              </div>
              <button
                type="button"
                onClick={() => loadHackathons(true)}
                disabled={isLoading || isRefreshing}
                className="grid h-12 w-12 place-items-center rounded-2xl border border-[#050505] bg-white text-[#050505] shadow-[2px_2px_0_#050505] hover:bg-[#F5F04A] transition-colors disabled:opacity-50 cursor-pointer"
                title="Refresh Hackathons"
                aria-label="Refresh Hackathons"
              >
                <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {/* Search and Filters Controls */}
          <div className="mt-8 border-t border-[#050505]/15 pt-6 space-y-4">
            {/* Search Input Bar */}
            <div className="relative">
              <Search
                size={17}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-[#050505]/50"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search hackathons by name, organizer, technology, or location..."
                className="w-full rounded-2xl border-[1.5px] border-[#050505] bg-white pl-11 pr-10 py-3 text-xs sm:text-sm font-medium text-[#050505] placeholder-[#050505]/40 outline-none focus:ring-2 focus:ring-[#F5F04A] shadow-[2px_2px_0_#050505] transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => handleSearchChange('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#050505]/60 hover:text-[#050505] p-1 cursor-pointer"
                  title="Clear search query"
                  aria-label="Clear search query"
                >
                  <X size={15} />
                </button>
              )}
            </div>

            {/* Category Filter Pills */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#050505]/60 mr-1">
                Category:
              </span>
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => handleCategoryChange(cat)}
                  className={`cursor-pointer rounded-full border px-3.5 py-1 text-xs font-bold transition-all ${
                    selectedCategory === cat
                      ? 'border-[#050505] bg-[#050505] text-[#E9E7D8] shadow-[2px_2px_0_#050505]'
                      : 'border-[#050505]/30 bg-white text-[#050505] hover:border-[#050505] hover:bg-[#F5F04A]/30'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Mode & Sort Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              {/* Participation Mode */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#050505]/60 mr-1">
                  Mode:
                </span>
                {MODES.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => handleModeChange(m.value)}
                    className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-bold transition-all ${
                      selectedMode === m.value
                        ? 'border-[#050505] bg-[#F5F04A] text-[#050505] shadow-[2px_2px_0_#050505]'
                        : 'border-[#050505]/30 bg-white text-[#050505] hover:border-[#050505]'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              {/* Sorting and Clear Controls */}
              <div className="flex items-center gap-2.5">
                <div className="flex items-center gap-1.5 rounded-full border border-[#050505] bg-white px-3 py-1 text-xs font-bold text-[#050505] shadow-[2px_2px_0_#050505]">
                  <SlidersHorizontal size={12} className="text-[#050505]/70" />
                  <span className="text-[11px] text-[#050505]/60">Sort:</span>
                  <select
                    value={sortBy}
                    onChange={(e) => handleSortChange(e.target.value as DeadlineSort)}
                    className="bg-transparent font-bold outline-none cursor-pointer pr-1"
                  >
                    <option value="closing-soon">Closing Soonest</option>
                    <option value="closing-later">Closing Later</option>
                  </select>
                </div>

                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-red-700 bg-red-50 px-3 py-1 text-xs font-bold text-red-800 shadow-[1.5px_1.5px_0_#050505] hover:bg-red-100 transition-all"
                    title="Clear all search filters"
                  >
                    <RotateCcw size={11} />
                    <span>Clear Filters</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Hackathons Grid or Polished States */}
        <section className="mt-8" aria-label="Hackathons list">
          {isLoading ? (
            /* Loading Skeleton Grid */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" aria-label="Loading hackathons">
              {[1, 2, 3, 4, 5, 6].map((idx) => (
                <div
                  key={idx}
                  className="rounded-[24px] border-[2px] border-[#050505] bg-[#fffef8] p-5 shadow-[4px_4px_0_#050505] animate-pulse space-y-4"
                >
                  <div className="h-40 w-full rounded-xl bg-[#E9E7D8]/80 border border-[#050505]/10" />
                  <div className="h-4 w-1/3 rounded bg-[#050505]/10" />
                  <div className="h-6 w-3/4 rounded bg-[#050505]/15" />
                  <div className="h-12 w-full rounded bg-[#050505]/5" />
                  <div className="h-4 w-1/2 rounded bg-[#050505]/10" />
                </div>
              ))}
            </div>
          ) : hackathons.length === 0 ? (
            /* Clean Zero-Demo State (Universities will publish hackathons) */
            <div className="rounded-[28px] border-[2.5px] border-[#050505] bg-[#fffef8] p-10 sm:p-14 text-center shadow-[6px_6px_0_#050505]">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-full border-2 border-[#050505] bg-[#F5F04A] text-[#050505] shadow-[3px_3px_0_#050505]">
                <Laptop size={28} />
              </div>

              <h2 className="mt-5 font-black text-xl sm:text-2xl text-[#050505] uppercase tracking-wide">
                No Campus Hackathons Published Yet
              </h2>

              <p className="mt-2 text-xs sm:text-sm text-[#050505]/75 max-w-md mx-auto leading-relaxed">
                Collegiate hackathons and competitions will appear here as soon as university departments, tech clubs, and campus organizers create them.
              </p>

              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    window.location.hash = '#organizer'
                  }}
                  className="inline-flex min-h-[42px] cursor-pointer items-center gap-2 rounded-full border border-[#050505] bg-[#F5F04A] px-6 text-xs font-black uppercase tracking-wider text-[#050505] shadow-[2.5px_2.5px_0_#050505] hover:-translate-y-0.5 transition-transform"
                >
                  <Sparkles size={14} />
                  <span>Host a Campus Hackathon</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    window.location.hash = '#hackathons'
                  }}
                  className="inline-flex min-h-[42px] cursor-pointer items-center gap-2 rounded-full border border-[#050505] bg-white px-5 text-xs font-bold uppercase tracking-wider text-[#050505] shadow-[2px_2px_0_#050505] hover:bg-neutral-100"
                >
                  <Trophy size={14} />
                  <span>Play Coding Games</span>
                </button>
              </div>
            </div>
          ) : !isPendingSchema && filteredHackathons.length === 0 && !errorMessage ? (
            /* Filter Empty State (Items exist, but none match current search/filter criteria) */
            <div className="rounded-[28px] border-[2.5px] border-[#050505] bg-[#fffef8] p-10 sm:p-12 text-center shadow-[6px_6px_0_#050505]">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-full border-2 border-[#050505] bg-[#E9E7D8] text-[#050505] shadow-[2px_2px_0_#050505]">
                <Search size={22} />
              </div>

              <h3 className="mt-4 font-black text-lg text-[#050505] uppercase">
                No Hackathons Match Your Filters
              </h3>

              <p className="mt-1.5 text-xs text-[#050505]/70 max-w-sm mx-auto leading-relaxed">
                We couldn&apos;t find any hackathons matching your search query or selected criteria.
                Try adjusting your keyword or resetting filters.
              </p>

              <div className="mt-5">
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="inline-flex min-h-[38px] cursor-pointer items-center gap-1.5 rounded-full border border-[#050505] bg-[#F5F04A] px-5 text-xs font-bold uppercase text-[#050505] shadow-[2px_2px_0_#050505] hover:-translate-y-0.5 transition-transform"
                >
                  <RotateCcw size={12} />
                  <span>Reset All Filters</span>
                </button>
              </div>
            </div>
          ) : (
            /* Responsive Card Grid */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredHackathons.map((hackathon) => {
                const countdown = formatDeadlineCountdown(hackathon.registration_deadline)
                const datesDisplay = formatEventDates(hackathon.start_date, hackathon.end_date)

                return (
                  <article
                    key={hackathon.id}
                    className="group flex flex-col justify-between rounded-[24px] border-[2px] border-[#050505] bg-[#fffef8] overflow-hidden shadow-[4px_4px_0_#050505] hover:shadow-[6px_6px_0_#050505] transition-all hover:-translate-y-1"
                  >
                    <div>
                      {/* Cover Image / Artwork */}
                      <div className="relative h-44 w-full bg-[#E9E7D8] overflow-hidden border-b-[2px] border-[#050505]">
                        {hackathon.cover_image_url ? (
                          <img
                            src={hackathon.cover_image_url}
                            alt={hackathon.title}
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                        ) : (
                          <div className="grid h-full w-full place-items-center bg-gradient-to-br from-[#E9E7D8] to-[#F5F04A]/40 p-4 text-center">
                            <Laptop size={36} className="text-[#050505]/50" />
                          </div>
                        )}

                        {/* Badges on artwork */}
                        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
                          <span
                            className={`rounded-full border border-[#050505] px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide shadow-[1.5px_1.5px_0_#050505] ${
                              hackathon.mode === 'Online'
                                ? 'bg-[#F5F04A] text-[#050505]'
                                : hackathon.mode === 'Offline'
                                  ? 'bg-[#050505] text-[#E9E7D8]'
                                  : 'bg-white text-[#050505]'
                            }`}
                          >
                            {hackathon.mode}
                          </span>

                          <span className="rounded-full border border-[#050505] bg-white px-2.5 py-0.5 text-[10px] font-bold text-[#050505] shadow-[1.5px_1.5px_0_#050505]">
                            {hackathon.category}
                          </span>
                        </div>

                        {hackathon.featured && (
                          <div className="absolute top-3 right-3">
                            <span className="rounded-full border border-[#050505] bg-[#050505] px-2.5 py-0.5 text-[10px] font-black uppercase text-[#F5F04A] shadow-[1.5px_1.5px_0_#050505]">
                              ★ Featured
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Card Content Body */}
                      <div className="p-5">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-[#050505]/60">
                          {hackathon.organizer}
                        </div>

                        <h3 className="mt-1 font-black text-lg text-[#050505] leading-snug group-hover:underline">
                          {hackathon.title}
                        </h3>

                        {hackathon.description && (
                          <p className="mt-2 text-xs text-[#050505]/80 line-clamp-2 leading-relaxed">
                            {hackathon.description}
                          </p>
                        )}

                        {/* Metadata Details */}
                        <div className="mt-4 space-y-2 border-t border-[#050505]/10 pt-3 text-xs text-[#050505]/80">
                          {/* Event Dates */}
                          <div className="flex items-center gap-2 text-[11px]">
                            <Calendar size={13} className="text-[#050505]/60 shrink-0" />
                            <span>{datesDisplay}</span>
                          </div>

                          {/* Location for offline/hybrid */}
                          {hackathon.location && (
                            <div className="flex items-center gap-2 text-[11px]">
                              <MapPin size={13} className="text-[#050505]/60 shrink-0" />
                              <span className="truncate">{hackathon.location}</span>
                            </div>
                          )}

                          {/* Prize Pool */}
                          {hackathon.prize_pool && (
                            <div className="flex items-center gap-2 text-[11px] font-bold text-[#050505]">
                              <Trophy size={13} className="text-amber-600 shrink-0" />
                              <span>{hackathon.prize_pool} in Prizes</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Card Footer */}
                    <div className="border-t border-[#050505]/15 bg-[#E9E7D8]/30 p-4 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-[11px]">
                        <Clock
                          size={12}
                          className={countdown.isClosingSoon ? 'text-red-600' : 'text-[#050505]/60'}
                        />
                        <span
                          className={`font-semibold ${
                            countdown.isClosingSoon ? 'text-red-700 font-bold' : 'text-[#050505]/70'
                          }`}
                        >
                          {countdown.label}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => onSelectHackathon?.(hackathon)}
                        className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-[#050505] bg-[#F5F04A] px-3.5 py-1 text-xs font-extrabold uppercase text-[#050505] shadow-[1.5px_1.5px_0_#050505] hover:bg-white transition-all"
                      >
                        <span>Details</span>
                        <ArrowRight size={11} />
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
