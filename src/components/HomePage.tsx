/**
 * HackhIt — Home & Landing Page Component
 *
 * Serves as the primary landing page featuring:
 * 1. HackhIt editorial hero introducing the campus network
 * 2. Prominent real-time hackathon search bar & filters at the top
 * 3. Complete grid of real-world upcoming hackathons & competitions (zero mock/demo data)
 * 4. Coding Games Arena & Collegiate Leaderboard spotlight
 * 5. Community collaborator & teammate discovery callout
 * 6. 100% mobile & web responsive layout
 */

import { useState, useMemo } from 'react'
import type { Session } from '@supabase/supabase-js'
import {
  Search,
  X,
  Trophy,
  Calendar,
  Clock,
  MapPin,
  ArrowRight,
  ArrowUpRight,
  Sparkles,
  Laptop,
  Users,
  RotateCcw,
  SlidersHorizontal,
  Flame,
  CheckCircle2,
  Swords,
  Zap,
} from 'lucide-react'

import { TopNav } from './TopNav'
import {
  formatEventDates,
  formatDeadlineCountdown,
  REAL_WORLD_HACKATHONS,
} from '../lib/hackathons'
import type {
  Hackathon,
  HackathonCategory,
  ParticipationMode,
  DeadlineSort,
} from '../types/hackathons'

export interface HomePageProps {
  hackathons?: Hackathon[]
  session?: Session | null
  onNavigateToHome: () => void
  onNavigateToCommunity: () => void
  onNavigateToExplore?: () => void
  onNavigateToHackathons: () => void
  onNavigateToHackathonDetails: (id: string) => void
  onNavigateToHackathonRegister: (id: string) => void
  onNavigateToMyRegistrations: () => void
  onNavigateToProfile: () => void
  onNavigateToOrganizer?: () => void
  onNavigateToLogin: (redirect?: string) => void
  onNavigateToSignup: () => void
  onSignOut: () => void
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

export function HomePage({
  hackathons = REAL_WORLD_HACKATHONS,
  session,
  onNavigateToHome,
  onNavigateToCommunity,
  onNavigateToExplore,
  onNavigateToHackathons,
  onNavigateToHackathonDetails,
  onNavigateToHackathonRegister,
  onNavigateToMyRegistrations,
  onNavigateToProfile,
  onNavigateToOrganizer,
  onNavigateToLogin,
  onNavigateToSignup,
  onSignOut,
}: HomePageProps) {
  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<HackathonCategory>('All')
  const [selectedMode, setSelectedMode] = useState<ParticipationMode>('All')
  const [sortBy, setSortBy] = useState<DeadlineSort>('closing-soon')

  // Available hackathons pool (ensures only real-world hackathons are present)
  const allHackathons = useMemo(() => {
    return Array.isArray(hackathons) ? hackathons : []
  }, [hackathons])

  // Filtered and sorted hackathons
  const filteredHackathons = useMemo(() => {
    let result = [...allHackathons]

    // 1. Text Search across Title, Organizer, Category, Location, Description
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      result = result.filter(
        (h) =>
          h.title.toLowerCase().includes(q) ||
          h.organizer.toLowerCase().includes(q) ||
          h.category.toLowerCase().includes(q) ||
          (h.location && h.location.toLowerCase().includes(q)) ||
          (h.description && h.description.toLowerCase().includes(q))
      )
    }

    // 2. Category Filter
    if (selectedCategory !== 'All') {
      result = result.filter(
        (h) => h.category.toLowerCase() === selectedCategory.toLowerCase()
      )
    }

    // 3. Participation Mode Filter
    if (selectedMode !== 'All') {
      result = result.filter((h) => h.mode === selectedMode)
    }

    // 4. Sort by Registration Deadline
    result.sort((a, b) => {
      const timeA = a.registration_deadline ? new Date(a.registration_deadline).getTime() : Infinity
      const timeB = b.registration_deadline ? new Date(b.registration_deadline).getTime() : Infinity

      if (sortBy === 'closing-soon') {
        return timeA - timeB
      } else {
        return timeB - timeA
      }
    })

    return result
  }, [allHackathons, searchQuery, selectedCategory, selectedMode, sortBy])

  const hasActiveFilters = searchQuery !== '' || selectedCategory !== 'All' || selectedMode !== 'All'

  const handleResetFilters = () => {
    setSearchQuery('')
    setSelectedCategory('All')
    setSelectedMode('All')
    setSortBy('closing-soon')
  }

  const scrollToSearch = () => {
    const el = document.getElementById('events-search')
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <div className="site-shell min-h-screen bg-[#E9E7D8] text-[#050505] flex flex-col w-full pb-20 md:pb-6">
      <TopNav
        currentView="landing"
        session={session}
        onNavigateToHome={onNavigateToHome}
        onNavigateToCommunity={onNavigateToCommunity}
        onNavigateToExplore={onNavigateToExplore}
        onNavigateToHackathons={onNavigateToHackathons}
        onNavigateToMyRegistrations={onNavigateToMyRegistrations}
        onNavigateToProfile={onNavigateToProfile}
        onNavigateToOrganizer={onNavigateToOrganizer}
        onNavigateToLogin={() => onNavigateToLogin()}
        onNavigateToSignup={onNavigateToSignup}
        onSignOut={onSignOut}
        onOpenProfile={onNavigateToProfile}
      />

      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 flex-1 flex flex-col gap-10 sm:gap-16">
        {/* ========================================================================= */}
        {/* 1. HERO SECTION */}
        {/* ========================================================================= */}
        <section className="hero" id="home">
          <div className="reveal">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#050505] bg-[#F5F04A] px-3.5 py-1 text-[11px] font-extrabold uppercase tracking-widest text-[#050505] shadow-[2px_2px_0_#050505] mb-4">
              <Sparkles size={13} />
              Collegiate Hackathons & Competitions 2026
            </div>

            <h1 className="display-font hero-title">
              YOUR CAMPUS.
              <br />
              YOUR NEXT
              <br />
              BIG THING.
            </h1>

            <p className="hero-copy">
              Discover verified student hackathons, battle in fast-paced coding games, and recruit top
              teammates across collegiate challenges. Build real-world solutions that matter.
            </p>

            <div className="hero-actions flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  if (onNavigateToExplore) onNavigateToExplore()
                  else scrollToSearch()
                }}
                className="primary-button cursor-pointer"
              >
                Explore Hackathons <ArrowRight size={16} />
              </button>

              <button
                type="button"
                onClick={onNavigateToHackathons}
                className="inline-flex min-h-[46px] cursor-pointer items-center gap-2 rounded-full border-[2px] border-[#050505] bg-[#F5F04A] px-5 text-xs font-black uppercase tracking-wider text-[#050505] shadow-[3px_3px_0_#050505] hover:-translate-y-0.5 hover:shadow-[4px_4px_0_#050505] transition-all"
              >
                <Swords size={15} />
                <span>Play Coding Games</span>
              </button>

              <button
                type="button"
                onClick={onNavigateToCommunity}
                className="outline-button cursor-pointer"
              >
                Community Feed
              </button>
            </div>

            {/* Quick Metrics Bar */}
            <div className="mt-8 flex flex-wrap items-center gap-4 pt-6 border-t border-[#050505]/15">
              <div className="flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-lg border border-[#050505] bg-white text-[#050505] shadow-[1.5px_1.5px_0_#050505]">
                  <Trophy size={14} />
                </span>
                <span className="text-xs font-bold text-[#050505]">
                  <strong>{allHackathons.length}</strong> Campus Events
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-lg border border-[#050505] bg-[#F5F04A] text-[#050505] shadow-[1.5px_1.5px_0_#050505]">
                  <Flame size={14} />
                </span>
                <span className="text-xs font-bold text-[#050505]">
                  <strong>6+</strong> Coding Game Modes
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-lg border border-[#050505] bg-emerald-300 text-[#050505] shadow-[1.5px_1.5px_0_#050505]">
                  <CheckCircle2 size={14} />
                </span>
                <span className="text-xs font-bold text-[#050505]">
                  <strong>100%</strong> Verified Student Access
                </span>
              </div>
            </div>
          </div>

          <div className="hero-art reveal reveal-delay-1">
            <img
              src="https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=900&q=85"
              alt="University students collaborating on campus"
            />

            <div className="yellow-tab" aria-label="Student community">
              <span>✳</span>
              <small>BUILD YOUR FUTURE</small>
              <ArrowUpRight size={15} />
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 2. SPOTLIGHT: CODING GAMES ARENA & LEADERBOARD */}
        {/* ========================================================================= */}
        <section
          className="rounded-[32px] border-[2.5px] border-[#050505] bg-[#050505] text-[#E9E7D8] p-6 sm:p-10 shadow-[6px_6px_0_#F5F04A] relative overflow-hidden"
          aria-label="Coding Games Arena Spotlight"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#F5F04A] bg-[#F5F04A] px-3.5 py-1 text-[11px] font-black uppercase tracking-widest text-[#050505] mb-3">
                <Swords size={13} />
                Arena & Collegiate Leaderboard
              </div>

              <h2 className="display-font text-3xl sm:text-4xl uppercase text-[#E9E7D8]">
                Play Coding Games & Win Campus Glory
              </h2>

              <p className="mt-2 text-xs sm:text-sm text-[#E9E7D8]/80 leading-relaxed">
                Test your algorithmic speed in 1v1 duels, catch sneaky syntax defects in Bug Hunter Blitz,
                and rack up Elo points on our verified collegiate leaderboard featuring players from Malla Reddy,
                IIT Hyderabad, BITS Pilani, and more.
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] font-bold text-white">
                  ⚡ Speed Syntax Racer
                </span>
                <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] font-bold text-white">
                  🐛 Bug Hunter Blitz
                </span>
                <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] font-bold text-white">
                  ⚔️ 1v1 Algorithm Duel
                </span>
                <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] font-bold text-white">
                  🔍 SQL Detective
                </span>
              </div>
            </div>

            <div className="shrink-0 flex flex-col sm:flex-row md:flex-col gap-3">
              <button
                type="button"
                onClick={onNavigateToHackathons}
                className="inline-flex min-h-[46px] cursor-pointer items-center justify-center gap-2 rounded-full border-[2px] border-[#050505] bg-[#F5F04A] px-6 text-xs font-black uppercase tracking-wider text-[#050505] shadow-[3px_3px_0_#fff] hover:-translate-y-0.5 transition-transform"
              >
                <Zap size={15} />
                <span>Enter Arena & Play</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  window.location.hash = '#hackathons'
                  onNavigateToHackathons()
                }}
                className="inline-flex min-h-[42px] cursor-pointer items-center justify-center gap-1.5 rounded-full border border-white/30 bg-transparent px-5 text-xs font-bold uppercase text-[#E9E7D8] hover:bg-white/10 transition-colors"
              >
                <Trophy size={13} />
                <span>View Collegiate Leaderboard</span>
              </button>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 3. UPCOMING HACKATHONS WITH PROMINENT SEARCH AT TOP */}
        {/* ========================================================================= */}
        <section
          id="events-search"
          className="rounded-[32px] border-[2.5px] border-[#050505] bg-[#fffef8] p-6 sm:p-8 md:p-10 shadow-[6px_6px_0_#050505] scroll-mt-20"
          aria-label="Upcoming Hackathons and Search"
        >
          {/* Section Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#050505]/15 pb-6">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#050505] bg-[#F5F04A] px-3 py-0.5 text-[10px] font-black uppercase tracking-wider text-[#050505]">
                <Calendar size={12} />
                Campus Hackathons
              </div>
              <h2 className="display-font mt-2 text-3xl sm:text-4xl md:text-5xl uppercase tracking-tight text-[#050505]">
                Upcoming Hackathons
              </h2>
              <p className="mt-2 text-xs sm:text-sm text-[#39382f] max-w-2xl leading-relaxed">
                Discover genuine collegiate hackathons and open innovation sprints.
                Search below by competition name, technology domain, organizer, or location.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="rounded-full border border-[#050505] bg-[#E9E7D8] px-3.5 py-1 text-xs font-black uppercase text-[#050505]">
                {filteredHackathons.length} {filteredHackathons.length === 1 ? 'Event' : 'Events'} Available
              </span>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* SEARCH BAR (PROMINENT AT TOP) */}
          {/* ========================================================================= */}
          <div className="mt-8 space-y-4">
            <div className="relative">
              <Search
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-[#050505]/60"
              />
              <input
                id="hackathon-search-input"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search campus hackathons by title, university, tech domain (AI/ML, Web, Mobile), or city..."
                className="w-full rounded-2xl border-[2px] border-[#050505] bg-white pl-12 pr-11 py-3.5 text-xs sm:text-sm font-semibold text-[#050505] placeholder-[#050505]/45 outline-none focus:ring-2 focus:ring-[#F5F04A] shadow-[3px_3px_0_#050505] transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#050505]/60 hover:text-[#050505] p-1 cursor-pointer"
                  title="Clear search"
                  aria-label="Clear search"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Filter Pills & Controls */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pt-2">
              {/* Category Pills */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-[#050505]/60 mr-1">
                  Category:
                </span>
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-bold transition-all ${
                      selectedCategory === cat
                        ? 'border-[#050505] bg-[#050505] text-[#E9E7D8] shadow-[2px_2px_0_#050505]'
                        : 'border-[#050505]/30 bg-white text-[#050505] hover:border-[#050505] hover:bg-[#F5F04A]/40'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Mode & Sort Toolbar */}
              <div className="flex flex-wrap items-center gap-3">
                {/* Participation Mode */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-black uppercase tracking-wider text-[#050505]/60 mr-1">
                    Mode:
                  </span>
                  {MODES.map((m) => (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => setSelectedMode(m.value)}
                      className={`cursor-pointer rounded-full border px-2.5 py-0.5 text-xs font-bold transition-all ${
                        selectedMode === m.value
                          ? 'border-[#050505] bg-[#F5F04A] text-[#050505] shadow-[1.5px_1.5px_0_#050505]'
                          : 'border-[#050505]/30 bg-white text-[#050505]/80 hover:border-[#050505]'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>

                {/* Deadline Sort */}
                <div className="flex items-center gap-1.5 pl-2 border-l border-[#050505]/20">
                  <SlidersHorizontal size={13} className="text-[#050505]/60" />
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as DeadlineSort)}
                    aria-label="Sort hackathons by deadline"
                    className="cursor-pointer rounded-lg border border-[#050505] bg-white px-2.5 py-1 text-xs font-bold text-[#050505] outline-none shadow-[1.5px_1.5px_0_#050505]"
                  >
                    <option value="closing-soon">Closing Soonest</option>
                    <option value="closing-later">Closing Later</option>
                  </select>
                </div>

                {/* Reset Filters */}
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="inline-flex items-center gap-1 rounded-full border border-[#050505]/40 bg-white px-2.5 py-1 text-xs font-bold text-[#050505] hover:bg-neutral-100 cursor-pointer"
                  >
                    <RotateCcw size={11} />
                    Reset
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* HACKATHONS GRID / CLEAN ZERO-DEMO STATE */}
          {/* ========================================================================= */}
          <div className="mt-8">
            {allHackathons.length === 0 ? (
              /* Clean Zero-Demo State (Genuine University Hackathons only) */
              <div className="rounded-[28px] border-[2px] border-dashed border-[#050505]/40 bg-[#fffef8] p-8 sm:p-12 text-center">
                <span className="grid h-14 w-14 mx-auto place-items-center rounded-full border-2 border-[#050505] bg-[#F5F04A] text-[#050505] shadow-[3px_3px_0_#050505]">
                  <Laptop size={24} />
                </span>

                <h3 className="mt-4 text-lg sm:text-xl font-black uppercase text-[#050505]">
                  No Campus Hackathons Published Yet
                </h3>

                <p className="mt-2 text-xs sm:text-sm text-[#050505]/75 max-w-lg mx-auto leading-relaxed">
                  We have removed all placeholder demo hackathons to ensure every competition on HackhIt is 100% authentic.
                  Campus clubs, tech societies, and universities are currently scheduling their official hackathons.
                </p>

                <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                  {onNavigateToOrganizer && (
                    <button
                      type="button"
                      onClick={onNavigateToOrganizer}
                      className="inline-flex min-h-[42px] cursor-pointer items-center gap-2 rounded-full border border-[#050505] bg-[#F5F04A] px-5 text-xs font-black uppercase tracking-wider text-[#050505] shadow-[2px_2px_0_#050505] hover:-translate-y-0.5 transition-transform"
                    >
                      <Sparkles size={14} />
                      <span>Host a Campus Hackathon</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={onNavigateToHackathons}
                    className="inline-flex min-h-[42px] cursor-pointer items-center gap-2 rounded-full border border-[#050505] bg-white px-5 text-xs font-bold uppercase tracking-wider text-[#050505] shadow-[2px_2px_0_#050505] hover:bg-neutral-100 transition-colors"
                  >
                    <Swords size={14} />
                    <span>Play Coding Games & View Rankings</span>
                  </button>

                  <button
                    type="button"
                    onClick={onNavigateToCommunity}
                    className="inline-flex min-h-[42px] cursor-pointer items-center gap-2 rounded-full border border-[#050505] bg-[#E9E7D8] px-5 text-xs font-bold uppercase tracking-wider text-[#050505] shadow-[2px_2px_0_#050505] hover:bg-white transition-colors"
                  >
                    <Users size={14} />
                    <span>Find Teammates on Feed</span>
                  </button>
                </div>
              </div>
            ) : filteredHackathons.length === 0 ? (
              /* Search/Filter empty state */
              <div className="rounded-2xl border-[2px] border-dashed border-[#050505]/30 bg-[#E9E7D8]/40 p-10 text-center">
                <span className="grid h-12 w-12 mx-auto place-items-center rounded-full border border-[#050505] bg-white text-[#050505] shadow-[2px_2px_0_#050505]">
                  <Search size={20} />
                </span>
                <h3 className="mt-3 text-base font-black uppercase text-[#050505]">
                  No Hackathons Match Your Search
                </h3>
                <p className="mt-1 text-xs text-[#050505]/70 max-w-sm mx-auto">
                  We couldn&apos;t find any hackathons matching &ldquo;{searchQuery}&rdquo;. Try adjusting your keywords or clearing the category and mode filters.
                </p>
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-[#050505] bg-[#F5F04A] px-4 py-2 text-xs font-black uppercase text-[#050505] shadow-[2px_2px_0_#050505] hover:-translate-y-0.5 transition-transform cursor-pointer"
                >
                  <RotateCcw size={13} />
                  Clear Filters & Show All
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredHackathons.map((h) => {
                  const deadlineInfo = formatDeadlineCountdown(h.registration_deadline)
                  const datesStr = formatEventDates(h.start_date, h.end_date)

                  return (
                    <article
                      key={h.id}
                      className="group flex flex-col justify-between rounded-[24px] border-[2px] border-[#050505] bg-white p-5 shadow-[4px_4px_0_#050505] transition-all hover:-translate-y-1 hover:shadow-[6px_6px_0_#050505]"
                    >
                      <div>
                        {/* Cover Image & Mode Badge */}
                        <div className="relative h-44 w-full overflow-hidden rounded-xl border border-[#050505] bg-[#E9E7D8]">
                          <img
                            src={
                              h.cover_image_url ||
                              'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=800&q=80'
                            }
                            alt={h.title}
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                            loading="lazy"
                          />

                          {/* Mode Badge Top-Left */}
                          <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 rounded-full border border-[#050505] bg-white px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-[#050505] shadow-[1.5px_1.5px_0_#050505]">
                            {h.mode === 'Online' ? (
                              <Laptop size={11} />
                            ) : h.mode === 'Offline' ? (
                              <MapPin size={11} />
                            ) : (
                              <Users size={11} />
                            )}
                            {h.mode}
                          </div>

                          {/* Category Badge Top-Right */}
                          <div className="absolute top-2.5 right-2.5 rounded-full border border-[#050505] bg-[#F5F04A] px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-[#050505] shadow-[1.5px_1.5px_0_#050505]">
                            {h.category}
                          </div>

                          {/* Featured Pill */}
                          {h.featured && (
                            <div className="absolute bottom-2.5 left-2.5 rounded-full border border-[#050505] bg-emerald-400 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-[#050505] shadow-[1px_1px_0_#050505]">
                              ★ Featured
                            </div>
                          )}
                        </div>

                        {/* Title & Organizer */}
                        <div className="mt-4">
                          <h3
                            onClick={() => onNavigateToHackathonDetails(h.id)}
                            className="text-base sm:text-lg font-black uppercase leading-tight text-[#050505] hover:text-[#050505]/70 cursor-pointer line-clamp-2"
                          >
                            {h.title}
                          </h3>
                          <p className="mt-1 text-xs font-bold uppercase tracking-wider text-[#050505]/60">
                            {h.organizer}
                          </p>
                        </div>

                        {/* Description */}
                        {h.description && (
                          <p className="mt-2 text-xs text-[#39382f] line-clamp-2 leading-relaxed">
                            {h.description}
                          </p>
                        )}

                        {/* Meta Tags (Prizes, Location, Dates) */}
                        <div className="mt-4 space-y-2 border-t border-[#050505]/10 pt-3 text-xs">
                          {h.prize_pool && (
                            <div className="flex items-center gap-2 text-[#050505]">
                              <Trophy size={14} className="shrink-0 text-[#050505]" />
                              <span className="font-extrabold text-[#050505] truncate">
                                {h.prize_pool}
                              </span>
                            </div>
                          )}

                          <div className="flex items-center gap-2 text-[#050505]/80">
                            <Calendar size={13} className="shrink-0 text-[#050505]/60" />
                            <span className="font-medium text-[11px] truncate">{datesStr}</span>
                          </div>

                          {h.location && (
                            <div className="flex items-center gap-2 text-[#050505]/80">
                              <MapPin size={13} className="shrink-0 text-[#050505]/60" />
                              <span className="font-medium text-[11px] truncate">{h.location}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Footer Actions */}
                      <div className="mt-5 border-t border-[#050505]/15 pt-3.5 space-y-2.5">
                        {/* Countdown Badge */}
                        <div
                          className={`flex items-center justify-between rounded-lg px-2.5 py-1 text-[11px] font-bold ${
                            deadlineInfo.isClosed
                              ? 'bg-neutral-200 text-neutral-700'
                              : deadlineInfo.isClosingSoon
                              ? 'bg-red-100 text-red-950 font-black'
                              : 'bg-[#E9E7D8] text-[#050505]'
                          }`}
                        >
                          <div className="flex items-center gap-1.5">
                            <Clock size={12} />
                            <span>{deadlineInfo.label}</span>
                          </div>
                          {!deadlineInfo.isClosed && (
                            <span className="text-[10px] uppercase font-extrabold tracking-wider">
                              Open
                            </span>
                          )}
                        </div>

                        {/* CTA Buttons */}
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => onNavigateToHackathonRegister(h.id)}
                            className="flex-1 inline-flex min-h-[40px] cursor-pointer items-center justify-center gap-1.5 rounded-full border-[1.5px] border-[#050505] bg-[#F5F04A] px-3 text-xs font-black uppercase tracking-wider text-[#050505] shadow-[2px_2px_0_#050505] hover:-translate-y-0.5 hover:shadow-[3px_3px_0_#050505] active:translate-y-0 transition-all"
                          >
                            Register Now <ArrowRight size={13} />
                          </button>

                          <button
                            type="button"
                            onClick={() => onNavigateToHackathonDetails(h.id)}
                            className="inline-flex min-h-[40px] cursor-pointer items-center justify-center gap-1 rounded-full border-[1.5px] border-[#050505] bg-white px-3.5 text-xs font-bold uppercase tracking-wider text-[#050505] shadow-[2px_2px_0_#050505] hover:bg-neutral-100 transition-colors"
                          >
                            Details
                          </button>
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 4. CAMPUS COMMUNITY CALLOUT */}
        {/* ========================================================================= */}
        <section
          className="rounded-[32px] border-[2.5px] border-[#050505] bg-[#050505] text-[#E9E7D8] p-8 sm:p-12 shadow-[6px_6px_0_#F5F04A]"
          aria-label="Community team finder"
        >
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#F5F04A] bg-[#F5F04A] px-3.5 py-1 text-[11px] font-black uppercase tracking-widest text-[#050505] mb-4">
              <Users size={13} />
              Find Your Teammates
            </div>

            <h2 className="display-font text-3xl sm:text-4xl md:text-5xl uppercase leading-tight text-[#E9E7D8]">
              Need Teammates for an Upcoming Hackathon?
            </h2>

            <p className="mt-3 text-sm sm:text-base text-[#E9E7D8]/80 leading-relaxed">
              Connect with frontend engineers, AI researchers, backend architects, and UI/UX designers
              across university campuses. Share your project ideas, recruit team members, and build together.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={onNavigateToCommunity}
                className="inline-flex min-h-[46px] cursor-pointer items-center gap-2 rounded-full border-[2px] border-[#050505] bg-[#F5F04A] px-6 text-xs font-black uppercase tracking-wider text-[#050505] shadow-[3px_3px_0_#fff] hover:-translate-y-0.5 hover:shadow-[4px_4px_0_#fff] transition-all"
              >
                Go to Community Feed <ArrowRight size={14} />
              </button>

              <button
                type="button"
                onClick={onNavigateToSignup}
                className="inline-flex min-h-[46px] cursor-pointer items-center gap-2 rounded-full border-[1.5px] border-[#E9E7D8] bg-transparent px-6 text-xs font-bold uppercase tracking-wider text-[#E9E7D8] hover:bg-white/10 transition-colors"
              >
                Join Student Network
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
