/**
 * HackhIt — Explore Engine Component
 *
 * Unified campus discovery view allowing students and universities to search & explore:
 * 1. Hackathons: Campus ideathons, university competitions, collegiate coding challenges.
 * 2. Students & Peers: Registered student developers, campus teammates, skill profiles.
 * 3. Universities: Collegiate institutions, campus organizers, and hosted event directories.
 *
 * Powered by real Supabase backend data with RLS protection, clean filtering, and mobile-ready neo-brutalist UI.
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
  Users,
  GraduationCap,
  Building2,
  User,
  Compass,
} from 'lucide-react'

import { TopNav } from './TopNav'
import {
  fetchHackathons,
  formatEventDates,
  formatDeadlineCountdown,
  REAL_WORLD_HACKATHONS,
} from '../lib/hackathons'
import { fetchAllProfiles, type Profile } from '../lib/community'
import type {
  Hackathon,
  HackathonCategory,
  ParticipationMode,
  DeadlineSort,
  HackathonFilterState,
} from '../types/hackathons'

export type ExploreTab = 'all' | 'hackathons' | 'users' | 'universities'

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
  onNavigateToOrganizer?: () => void
  onNavigateToLogin: () => void
  onNavigateToSignup: () => void
  onSignOut?: () => void
  onOpenProfile?: (profileId?: string) => void
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

const POPULAR_SKILLS = [
  'All',
  'Python',
  'TypeScript',
  'React',
  'AI/ML',
  'Node.js',
  'Rust',
  'Solidity',
  'UI/UX',
  'Cloud',
]

interface UniversitySummary {
  name: string
  studentCount: number
  hackathonCount: number
  location?: string
}

const PREMIER_COLLEGIATE_HUBS: { name: string; location: string }[] = [
  { name: 'Malla Reddy University', location: 'Hyderabad, Telangana' },
  { name: 'IIT Hyderabad', location: 'Sangareddy, Telangana' },
  { name: 'BITS Pilani', location: 'Pilani, Rajasthan' },
  { name: 'NIT Warangal', location: 'Warangal, Telangana' },
  { name: 'IIIT Hyderabad', location: 'Gachibowli, Hyderabad' },
  { name: 'Osmania University', location: 'Hyderabad, Telangana' },
  { name: 'JNTU Hyderabad', location: 'Kukatpally, Hyderabad' },
  { name: 'IIT Madras', location: 'Chennai, Tamil Nadu' },
  { name: 'IIT Bombay', location: 'Mumbai, Maharashtra' },
  { name: 'Delhi Technological University', location: 'New Delhi, Delhi' },
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
  onNavigateToOrganizer,
  onNavigateToLogin,
  onNavigateToSignup,
  onSignOut,
  onOpenProfile,
  onSelectHackathon,
}: HackathonDiscoveryProps) {
  // Navigation tab state
  const [activeTab, setActiveTab] = useState<ExploreTab>('all')

  // Data state
  const [hackathons, setHackathons] = useState<Hackathon[]>(initialHackathons || REAL_WORLD_HACKATHONS)
  const [students, setStudents] = useState<Profile[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [isLoadingStudents, setIsLoadingStudents] = useState<boolean>(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false)

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState(filters?.searchQuery || '')
  const [selectedCategory, setSelectedCategory] = useState<HackathonCategory>(filters?.category || 'All')
  const [selectedMode, setSelectedMode] = useState<ParticipationMode>(filters?.mode || 'All')
  const [sortBy, setSortBy] = useState<DeadlineSort>(filters?.sortBy || 'closing-soon')
  const [selectedSkill, setSelectedSkill] = useState<string>('All')

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
    setSelectedSkill('All')
    setSortBy('closing-soon')
    onFiltersChange?.({ searchQuery: '', category: 'All', mode: 'All', sortBy: 'closing-soon' })
  }

  // Fetch hackathons
  const loadHackathons = useCallback(async () => {
    try {
      const result = await fetchHackathons()
      if (result.hackathons && result.hackathons.length > 0) {
        setHackathons(result.hackathons)
      } else if (result.error) {
        console.warn('[Explore] Error fetching hackathons:', result.error)
      }
    } catch (err) {
      console.warn('[Explore] Error loading hackathons:', err)
    }
  }, [])

  // Fetch students/users
  const loadStudents = useCallback(async () => {
    setIsLoadingStudents(true)
    try {
      const result = await fetchAllProfiles()
      if (result.profiles) {
        setStudents(result.profiles)
      }
    } catch (err) {
      console.warn('[Explore] Error fetching students:', err)
    } finally {
      setIsLoadingStudents(false)
    }
  }, [])

  // Combined refresh
  const handleRefreshAll = useCallback(async () => {
    setIsRefreshing(true)
    setIsLoading(true)
    setErrorMessage(null)
    try {
      await Promise.allSettled([loadHackathons(), loadStudents()])
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to refresh data.')
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [loadHackathons, loadStudents])

  // Initial load
  useEffect(() => {
    let cancelled = false
    setIsLoading(true)

    Promise.allSettled([loadHackathons(), loadStudents()]).finally(() => {
      if (!cancelled) {
        setIsLoading(false)
      }
    })

    return () => {
      cancelled = true
    }
  }, [loadHackathons, loadStudents])

  // Aggregate Universities list dynamically
  const universitiesList = useMemo<UniversitySummary[]>(() => {
    const map = new Map<string, { name: string; studentCount: number; hackathonCount: number; location?: string }>()

    // Seed with known collegiate hubs
    for (const hub of PREMIER_COLLEGIATE_HUBS) {
      map.set(hub.name.toLowerCase(), {
        name: hub.name,
        studentCount: 0,
        hackathonCount: 0,
        location: hub.location,
      })
    }

    // Count students per university
    for (const student of students) {
      if (student.university && student.university.trim()) {
        const uniName = student.university.trim()
        const key = uniName.toLowerCase()
        const existing = map.get(key)
        if (existing) {
          existing.studentCount += 1
        } else {
          map.set(key, {
            name: uniName,
            studentCount: 1,
            hackathonCount: 0,
            location: 'Collegiate Network',
          })
        }
      }
    }

    // Count hackathons per university organizer
    for (const h of hackathons) {
      if (h.organizer && h.organizer.trim()) {
        const orgName = h.organizer.trim()
        const key = orgName.toLowerCase()
        const existing = map.get(key)
        if (existing) {
          existing.hackathonCount += 1
          if (h.location && (!existing.location || existing.location === 'Collegiate Network')) {
            existing.location = h.location
          }
        } else {
          // Check substring match
          let matched = false
          for (const [k, v] of map.entries()) {
            if (key.includes(k) || k.includes(key)) {
              v.hackathonCount += 1
              matched = true
              break
            }
          }
          if (!matched) {
            map.set(key, {
              name: orgName,
              studentCount: 0,
              hackathonCount: 1,
              location: h.location || 'India',
            })
          }
        }
      }
    }

    return Array.from(map.values()).sort((a, b) => {
      const activityA = a.studentCount * 3 + a.hackathonCount * 5
      const activityB = b.studentCount * 3 + b.hackathonCount * 5
      if (activityB !== activityA) return activityB - activityA
      return a.name.localeCompare(b.name)
    })
  }, [students, hackathons])

  // Filtered Hackathons computation
  const filteredHackathons = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    return hackathons
      .filter((hackathon) => {
        if (q) {
          const matchesTitle = (hackathon.title || '').toLowerCase().includes(q)
          const matchesOrg = (hackathon.organizer || '').toLowerCase().includes(q)
          const matchesCat = (hackathon.category || '').toLowerCase().includes(q)
          const matchesDesc = (hackathon.description || '').toLowerCase().includes(q)
          const matchesLoc = (hackathon.location || '').toLowerCase().includes(q)
          if (!matchesTitle && !matchesOrg && !matchesCat && !matchesDesc && !matchesLoc) {
            return false
          }
        }

        if (selectedCategory !== 'All') {
          if ((hackathon.category || '').toLowerCase() !== selectedCategory.toLowerCase()) {
            return false
          }
        }

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

        if (!isValidA && !isValidB) return 0
        if (!isValidA) return 1
        if (!isValidB) return -1

        return sortBy === 'closing-soon' ? timeA - timeB : timeB - timeA
      })
  }, [hackathons, searchQuery, selectedCategory, selectedMode, sortBy])

  // Filtered Students computation
  const filteredStudents = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    return students.filter((student) => {
      if (selectedSkill !== 'All') {
        const hasSkill = (student.skills || []).some(
          (s) => s.toLowerCase() === selectedSkill.toLowerCase()
        )
        if (!hasSkill) return false
      }

      if (!q) return true

      const matchesName = (student.full_name || '').toLowerCase().includes(q)
      const matchesUni = (student.university || '').toLowerCase().includes(q)
      const matchesBio = (student.bio || '').toLowerCase().includes(q)
      const matchesSkills = (student.skills || []).some((s) => s.toLowerCase().includes(q))
      const matchesInterests = (student.interests || []).some((i) => i.toLowerCase().includes(q))

      return matchesName || matchesUni || matchesBio || matchesSkills || matchesInterests
    })
  }, [students, searchQuery, selectedSkill])

  // Filtered Universities computation
  const filteredUniversities = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    if (!q) return universitiesList

    return universitiesList.filter((uni) => {
      const matchesName = uni.name.toLowerCase().includes(q)
      const matchesLoc = (uni.location || '').toLowerCase().includes(q)
      return matchesName || matchesLoc
    })
  }, [universitiesList, searchQuery])

  const totalMatches =
    filteredHackathons.length + filteredStudents.length + filteredUniversities.length

  const hasActiveFilters =
    searchQuery.trim().length > 0 ||
    selectedCategory !== 'All' ||
    selectedMode !== 'All' ||
    selectedSkill !== 'All' ||
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
        onNavigateToOrganizer={onNavigateToOrganizer}
        onNavigateToLogin={onNavigateToLogin}
        onNavigateToSignup={onNavigateToSignup}
        onSignOut={onSignOut}
        onOpenProfile={() => onOpenProfile?.()}
      />

      {/* Main Container */}
      <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-20 flex-1">
        {/* Editorial Heading Section */}
        <section className="rounded-[28px] border-[2.5px] border-[#050505] bg-[#fffef8] p-6 sm:p-10 shadow-[6px_6px_0_#050505]">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-[#050505] bg-[#F5F04A] px-3.5 py-1 text-[11px] font-extrabold uppercase tracking-wider text-[#050505]">
                <Compass size={13} />
                <span>Collegiate Discovery Engine</span>
              </div>

              <h1 className="display-font mt-3.5 text-3xl sm:text-5xl lg:text-6xl text-[#050505] leading-none uppercase">
                Explore Campus Network
              </h1>

              <p className="mt-3 text-xs sm:text-sm text-[#39382f] leading-relaxed">
                Search verified hackathons, discover campus student developers & teammates, and explore universities hosting tech competitions across the network.
              </p>
            </div>

            {/* Quick Metrics Badges & Refresh */}
            <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
              <div className="rounded-2xl border border-[#050505] bg-[#E9E7D8] px-3.5 py-2.5 text-center min-w-[80px] shadow-[2px_2px_0_#050505]">
                <span className="block font-black text-lg sm:text-xl text-[#050505]">
                  {isLoading ? '...' : hackathons.length}
                </span>
                <span className="block text-[10px] font-extrabold uppercase tracking-wider text-[#050505]/70">
                  Hackathons
                </span>
              </div>

              <div className="rounded-2xl border border-[#050505] bg-white px-3.5 py-2.5 text-center min-w-[80px] shadow-[2px_2px_0_#050505]">
                <span className="block font-black text-lg sm:text-xl text-[#050505]">
                  {isLoadingStudents ? '...' : students.length}
                </span>
                <span className="block text-[10px] font-extrabold uppercase tracking-wider text-[#050505]/70">
                  Students
                </span>
              </div>

              <div className="rounded-2xl border border-[#050505] bg-[#F5F04A] px-3.5 py-2.5 text-center min-w-[80px] shadow-[2px_2px_0_#050505]">
                <span className="block font-black text-lg sm:text-xl text-[#050505]">
                  {universitiesList.length}
                </span>
                <span className="block text-[10px] font-extrabold uppercase tracking-wider text-[#050505]/70">
                  Colleges
                </span>
              </div>

              <button
                type="button"
                onClick={handleRefreshAll}
                disabled={isLoading || isRefreshing}
                className="grid h-12 w-12 place-items-center rounded-2xl border border-[#050505] bg-white text-[#050505] shadow-[2px_2px_0_#050505] hover:bg-[#F5F04A] transition-colors disabled:opacity-50 cursor-pointer shrink-0"
                title="Refresh All Data"
                aria-label="Refresh All Data"
              >
                <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {/* Unified Search Bar */}
          <div className="mt-8 border-t border-[#050505]/15 pt-6 space-y-4">
            <div className="relative">
              <Search
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-[#050505]/50 pointer-events-none"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search hackathons, student developers, skills (e.g. Python, React), or colleges..."
                className="w-full rounded-2xl border-[2px] border-[#050505] bg-white pl-11 pr-10 py-3.5 text-xs sm:text-sm font-semibold text-[#050505] placeholder-[#050505]/45 outline-none focus:ring-2 focus:ring-[#F5F04A] shadow-[2px_2px_0_#050505] transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => handleSearchChange('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#050505]/60 hover:text-[#050505] p-1 cursor-pointer"
                  title="Clear search query"
                  aria-label="Clear search query"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Explore Target Navigation Tabs */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Explore categories">
                {/* All Results Tab */}
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'all'}
                  onClick={() => setActiveTab('all')}
                  className={`cursor-pointer inline-flex items-center gap-2 rounded-xl border px-3.5 py-1.5 text-xs font-black uppercase tracking-wider transition-all ${
                    activeTab === 'all'
                      ? 'border-[#050505] bg-[#050505] text-[#E9E7D8] shadow-[2px_2px_0_#050505]'
                      : 'border-[#050505]/30 bg-white text-[#050505] hover:border-[#050505] hover:bg-[#F5F04A]/25'
                  }`}
                >
                  <Sparkles size={13} />
                  <span>All Results</span>
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                      activeTab === 'all' ? 'bg-[#F5F04A] text-[#050505]' : 'bg-[#E9E7D8] text-[#050505]'
                    }`}
                  >
                    {totalMatches}
                  </span>
                </button>

                {/* Hackathons Tab */}
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'hackathons'}
                  onClick={() => setActiveTab('hackathons')}
                  className={`cursor-pointer inline-flex items-center gap-2 rounded-xl border px-3.5 py-1.5 text-xs font-black uppercase tracking-wider transition-all ${
                    activeTab === 'hackathons'
                      ? 'border-[#050505] bg-[#050505] text-[#E9E7D8] shadow-[2px_2px_0_#050505]'
                      : 'border-[#050505]/30 bg-white text-[#050505] hover:border-[#050505] hover:bg-[#F5F04A]/25'
                  }`}
                >
                  <Laptop size={13} />
                  <span>Hackathons</span>
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                      activeTab === 'hackathons' ? 'bg-[#F5F04A] text-[#050505]' : 'bg-[#E9E7D8] text-[#050505]'
                    }`}
                  >
                    {filteredHackathons.length}
                  </span>
                </button>

                {/* Students & Peers Tab */}
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'users'}
                  onClick={() => setActiveTab('users')}
                  className={`cursor-pointer inline-flex items-center gap-2 rounded-xl border px-3.5 py-1.5 text-xs font-black uppercase tracking-wider transition-all ${
                    activeTab === 'users'
                      ? 'border-[#050505] bg-[#050505] text-[#E9E7D8] shadow-[2px_2px_0_#050505]'
                      : 'border-[#050505]/30 bg-white text-[#050505] hover:border-[#050505] hover:bg-[#F5F04A]/25'
                  }`}
                >
                  <Users size={13} />
                  <span>Students & Peers</span>
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                      activeTab === 'users' ? 'bg-[#F5F04A] text-[#050505]' : 'bg-[#E9E7D8] text-[#050505]'
                    }`}
                  >
                    {filteredStudents.length}
                  </span>
                </button>

                {/* Universities Tab */}
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'universities'}
                  onClick={() => setActiveTab('universities')}
                  className={`cursor-pointer inline-flex items-center gap-2 rounded-xl border px-3.5 py-1.5 text-xs font-black uppercase tracking-wider transition-all ${
                    activeTab === 'universities'
                      ? 'border-[#050505] bg-[#050505] text-[#E9E7D8] shadow-[2px_2px_0_#050505]'
                      : 'border-[#050505]/30 bg-white text-[#050505] hover:border-[#050505] hover:bg-[#F5F04A]/25'
                  }`}
                >
                  <Building2 size={13} />
                  <span>Universities</span>
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                      activeTab === 'universities' ? 'bg-[#F5F04A] text-[#050505]' : 'bg-[#E9E7D8] text-[#050505]'
                    }`}
                  >
                    {filteredUniversities.length}
                  </span>
                </button>
              </div>

              {/* Reset Filters Button */}
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-red-700 bg-red-50 px-3 py-1 text-xs font-bold text-red-800 shadow-[1.5px_1.5px_0_#050505] hover:bg-red-100 transition-all ml-auto"
                  title="Clear all search filters"
                >
                  <RotateCcw size={11} />
                  <span>Clear Filters</span>
                </button>
              )}
            </div>

            {/* Contextual Sub-Filters */}
            {activeTab === 'hackathons' && (
              <div className="pt-3 border-t border-[#050505]/10 space-y-3">
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
                      className={`cursor-pointer rounded-full border px-3 py-0.5 text-xs font-bold transition-all ${
                        selectedCategory === cat
                          ? 'border-[#050505] bg-[#050505] text-[#E9E7D8] shadow-[1.5px_1.5px_0_#050505]'
                          : 'border-[#050505]/30 bg-white text-[#050505] hover:border-[#050505]'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                {/* Mode & Sort Toolbar */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#050505]/60 mr-1">
                      Mode:
                    </span>
                    {MODES.map((m) => (
                      <button
                        key={m.value}
                        type="button"
                        onClick={() => handleModeChange(m.value)}
                        className={`cursor-pointer rounded-full border px-3 py-0.5 text-xs font-bold transition-all ${
                          selectedMode === m.value
                            ? 'border-[#050505] bg-[#F5F04A] text-[#050505] shadow-[1.5px_1.5px_0_#050505]'
                            : 'border-[#050505]/30 bg-white text-[#050505] hover:border-[#050505]'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-1.5 rounded-full border border-[#050505] bg-white px-3 py-1 text-xs font-bold text-[#050505] shadow-[1.5px_1.5px_0_#050505]">
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
                </div>
              </div>
            )}

            {/* Skills Sub-Filter for Students */}
            {(activeTab === 'users' || activeTab === 'all') && (
              <div className="pt-3 border-t border-[#050505]/10 flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#050505]/60 mr-1">
                  Filter by Skill:
                </span>
                {POPULAR_SKILLS.map((sk) => (
                  <button
                    key={sk}
                    type="button"
                    onClick={() => setSelectedSkill(sk)}
                    className={`cursor-pointer rounded-full border px-3 py-0.5 text-xs font-bold transition-all ${
                      selectedSkill === sk
                        ? 'border-[#050505] bg-[#F5F04A] text-[#050505] shadow-[1.5px_1.5px_0_#050505]'
                        : 'border-[#050505]/30 bg-white text-[#050505] hover:border-[#050505]'
                    }`}
                  >
                    {sk}
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Global Error Banner */}
        {errorMessage && (
          <div className="mt-6 rounded-2xl border-2 border-red-700 bg-red-50 p-4 text-xs font-bold text-red-900 shadow-[3px_3px_0_#050505] flex items-center justify-between gap-3">
            <span>{errorMessage}</span>
            <button
              type="button"
              onClick={handleRefreshAll}
              className="rounded-lg bg-red-700 px-3 py-1 text-white hover:bg-red-800 transition-colors cursor-pointer shrink-0"
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading Skeleton */}
        {isLoading && (
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" aria-label="Loading explore data">
            {[1, 2, 3, 4, 5, 6].map((idx) => (
              <div
                key={idx}
                className="rounded-[24px] border-[2px] border-[#050505] bg-[#fffef8] p-5 shadow-[4px_4px_0_#050505] animate-pulse space-y-4"
              >
                <div className="h-40 w-full rounded-xl bg-[#E9E7D8]/80 border border-[#050505]/10" />
                <div className="h-4 w-1/3 rounded bg-[#050505]/10" />
                <div className="h-6 w-3/4 rounded bg-[#050505]/15" />
                <div className="h-10 w-full rounded bg-[#050505]/5" />
              </div>
            ))}
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 1: ALL RESULTS (Unified view across all 3 pillars)   */}
        {/* ======================================================== */}
        {!isLoading && activeTab === 'all' && (
          <div className="mt-8 space-y-12">
            {/* 1. Hackathons Section */}
            <section aria-labelledby="section-hackathons">
              <div className="flex items-center justify-between gap-4 mb-5 border-b-2 border-[#050505] pb-3">
                <div className="flex items-center gap-2">
                  <Laptop size={20} className="text-[#050505]" />
                  <h2 id="section-hackathons" className="text-xl sm:text-2xl font-black uppercase tracking-tight text-[#050505]">
                    Campus Hackathons ({filteredHackathons.length})
                  </h2>
                </div>
                {filteredHackathons.length > 3 && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('hackathons')}
                    className="inline-flex items-center gap-1 text-xs font-black uppercase text-[#050505] hover:text-[#050505] hover:underline cursor-pointer"
                  >
                    <span>View all {filteredHackathons.length}</span>
                    <ArrowRight size={13} />
                  </button>
                )}
              </div>

              {filteredHackathons.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#050505]/30 bg-[#fffef8] p-8 text-center">
                  <p className="text-xs sm:text-sm text-[#050505]/70 font-medium">
                    No hackathons matched &ldquo;{searchQuery}&rdquo;. Try another keyword or check the Hackathons tab.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredHackathons.slice(0, 3).map((hackathon) => (
                    <HackathonCardItem
                      key={hackathon.id}
                      hackathon={hackathon}
                      onSelect={() => onSelectHackathon?.(hackathon)}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* 2. Students & Peers Section */}
            <section aria-labelledby="section-students">
              <div className="flex items-center justify-between gap-4 mb-5 border-b-2 border-[#050505] pb-3">
                <div className="flex items-center gap-2">
                  <Users size={20} className="text-[#050505]" />
                  <h2 id="section-students" className="text-xl sm:text-2xl font-black uppercase tracking-tight text-[#050505]">
                    Student Developers & Peers ({filteredStudents.length})
                  </h2>
                </div>
                {filteredStudents.length > 3 && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('users')}
                    className="inline-flex items-center gap-1 text-xs font-black uppercase text-[#050505] hover:underline cursor-pointer"
                  >
                    <span>View all {filteredStudents.length}</span>
                    <ArrowRight size={13} />
                  </button>
                )}
              </div>

              {filteredStudents.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#050505]/30 bg-[#fffef8] p-8 text-center">
                  <p className="text-xs sm:text-sm text-[#050505]/70 font-medium">
                    No students match your search. New students can register from the Create Account screen!
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredStudents.slice(0, 3).map((student) => (
                    <StudentCardItem
                      key={student.id}
                      student={student}
                      onOpenProfile={() => onOpenProfile?.(student.id)}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* 3. Universities Section */}
            <section aria-labelledby="section-universities">
              <div className="flex items-center justify-between gap-4 mb-5 border-b-2 border-[#050505] pb-3">
                <div className="flex items-center gap-2">
                  <Building2 size={20} className="text-[#050505]" />
                  <h2 id="section-universities" className="text-xl sm:text-2xl font-black uppercase tracking-tight text-[#050505]">
                    Colleges & Universities ({filteredUniversities.length})
                  </h2>
                </div>
                {filteredUniversities.length > 3 && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('universities')}
                    className="inline-flex items-center gap-1 text-xs font-black uppercase text-[#050505] hover:underline cursor-pointer"
                  >
                    <span>View all {filteredUniversities.length}</span>
                    <ArrowRight size={13} />
                  </button>
                )}
              </div>

              {filteredUniversities.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#050505]/30 bg-[#fffef8] p-8 text-center">
                  <p className="text-xs sm:text-sm text-[#050505]/70 font-medium">
                    No universities match your search query.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {filteredUniversities.slice(0, 6).map((uni) => (
                    <UniversityCardItem
                      key={uni.name}
                      university={uni}
                      onSearchStudents={() => {
                        setActiveTab('users')
                        setSearchQuery(uni.name)
                      }}
                      onSearchHackathons={() => {
                        setActiveTab('hackathons')
                        setSearchQuery(uni.name)
                      }}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* Zero State across all 3 */}
            {totalMatches === 0 && (
              <div className="rounded-[28px] border-[2.5px] border-[#050505] bg-[#fffef8] p-10 sm:p-14 text-center shadow-[6px_6px_0_#050505]">
                <div className="mx-auto grid h-16 w-16 place-items-center rounded-full border-2 border-[#050505] bg-[#E9E7D8] text-[#050505] shadow-[3px_3px_0_#050505]">
                  <Search size={28} />
                </div>
                <h3 className="mt-5 font-black text-xl text-[#050505] uppercase">
                  No Results Found for &ldquo;{searchQuery}&rdquo;
                </h3>
                <p className="mt-2 text-xs sm:text-sm text-[#050505]/70 max-w-md mx-auto leading-relaxed">
                  We couldn&apos;t find any hackathons, student developers, or universities matching your current query. Try searching for a different keyword or campus name.
                </p>
                <div className="mt-6">
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="inline-flex min-h-[40px] cursor-pointer items-center gap-2 rounded-full border border-[#050505] bg-[#F5F04A] px-6 text-xs font-bold uppercase text-[#050505] shadow-[2px_2px_0_#050505] hover:-translate-y-0.5 transition-transform"
                  >
                    <RotateCcw size={13} />
                    <span>Clear Search & Filters</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 2: HACKATHONS TAB                                   */}
        {/* ======================================================== */}
        {!isLoading && activeTab === 'hackathons' && (
          <section className="mt-8" aria-label="Hackathons list">
            {filteredHackathons.length === 0 ? (
              <div className="rounded-[28px] border-[2.5px] border-[#050505] bg-[#fffef8] p-10 sm:p-14 text-center shadow-[6px_6px_0_#050505]">
                <div className="mx-auto grid h-16 w-16 place-items-center rounded-full border-2 border-[#050505] bg-[#F5F04A] text-[#050505] shadow-[3px_3px_0_#050505]">
                  <Laptop size={28} />
                </div>
                <h2 className="mt-5 font-black text-xl sm:text-2xl text-[#050505] uppercase tracking-wide">
                  No Hackathons Match Your Filters
                </h2>
                <p className="mt-2 text-xs sm:text-sm text-[#050505]/75 max-w-md mx-auto leading-relaxed">
                  Collegiate hackathons and competitions appear here as university departments and organizers publish them.
                </p>
                <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="inline-flex min-h-[40px] cursor-pointer items-center gap-2 rounded-full border border-[#050505] bg-[#F5F04A] px-5 text-xs font-bold uppercase tracking-wider text-[#050505] shadow-[2px_2px_0_#050505]"
                  >
                    <RotateCcw size={13} />
                    <span>Reset Filters</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      window.location.hash = '#organizer'
                    }}
                    className="inline-flex min-h-[40px] cursor-pointer items-center gap-2 rounded-full border border-[#050505] bg-white px-5 text-xs font-bold uppercase tracking-wider text-[#050505] shadow-[2px_2px_0_#050505]"
                  >
                    <Building2 size={13} />
                    <span>University Portal</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredHackathons.map((hackathon) => (
                  <HackathonCardItem
                    key={hackathon.id}
                    hackathon={hackathon}
                    onSelect={() => onSelectHackathon?.(hackathon)}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {/* ======================================================== */}
        {/* TAB 3: STUDENTS & PEERS TAB                             */}
        {/* ======================================================== */}
        {!isLoading && activeTab === 'users' && (
          <section className="mt-8" aria-label="Student peers directory">
            {filteredStudents.length === 0 ? (
              <div className="rounded-[28px] border-[2.5px] border-[#050505] bg-[#fffef8] p-10 sm:p-14 text-center shadow-[6px_6px_0_#050505]">
                <div className="mx-auto grid h-16 w-16 place-items-center rounded-full border-2 border-[#050505] bg-[#E9E7D8] text-[#050505] shadow-[3px_3px_0_#050505]">
                  <Users size={28} />
                </div>
                <h2 className="mt-5 font-black text-xl sm:text-2xl text-[#050505] uppercase tracking-wide">
                  No Student Profiles Found
                </h2>
                <p className="mt-2 text-xs sm:text-sm text-[#050505]/75 max-w-md mx-auto leading-relaxed">
                  We couldn&apos;t find any students matching your criteria. Sign up or search by a different name, skill, or university!
                </p>
                <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="inline-flex min-h-[40px] cursor-pointer items-center gap-2 rounded-full border border-[#050505] bg-[#F5F04A] px-5 text-xs font-bold uppercase text-[#050505] shadow-[2px_2px_0_#050505]"
                  >
                    <RotateCcw size={13} />
                    <span>Reset Filter</span>
                  </button>
                  <button
                    type="button"
                    onClick={onNavigateToSignup}
                    className="inline-flex min-h-[40px] cursor-pointer items-center gap-2 rounded-full border border-[#050505] bg-white px-5 text-xs font-bold uppercase text-[#050505] shadow-[2px_2px_0_#050505]"
                  >
                    <User size={13} />
                    <span>Create Profile</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredStudents.map((student) => (
                  <StudentCardItem
                    key={student.id}
                    student={student}
                    onOpenProfile={() => onOpenProfile?.(student.id)}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {/* ======================================================== */}
        {/* TAB 4: UNIVERSITIES TAB                                 */}
        {/* ======================================================== */}
        {!isLoading && activeTab === 'universities' && (
          <section className="mt-8" aria-label="Universities directory">
            {filteredUniversities.length === 0 ? (
              <div className="rounded-[28px] border-[2.5px] border-[#050505] bg-[#fffef8] p-10 sm:p-14 text-center shadow-[6px_6px_0_#050505]">
                <div className="mx-auto grid h-16 w-16 place-items-center rounded-full border-2 border-[#050505] bg-[#F5F04A] text-[#050505] shadow-[3px_3px_0_#050505]">
                  <Building2 size={28} />
                </div>
                <h2 className="mt-5 font-black text-xl sm:text-2xl text-[#050505] uppercase tracking-wide">
                  No Universities Found
                </h2>
                <p className="mt-2 text-xs sm:text-sm text-[#050505]/75 max-w-md mx-auto leading-relaxed">
                  No collegiate institutions matched &ldquo;{searchQuery}&rdquo;. Clear your search query to see all partner universities.
                </p>
                <div className="mt-6">
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="inline-flex min-h-[40px] cursor-pointer items-center gap-2 rounded-full border border-[#050505] bg-[#F5F04A] px-5 text-xs font-bold uppercase text-[#050505] shadow-[2px_2px_0_#050505]"
                  >
                    <RotateCcw size={13} />
                    <span>Reset Search</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredUniversities.map((uni) => (
                  <UniversityCardItem
                    key={uni.name}
                    university={uni}
                    onSearchStudents={() => {
                      setActiveTab('users')
                      setSearchQuery(uni.name)
                    }}
                    onSearchHackathons={() => {
                      setActiveTab('hackathons')
                      setSearchQuery(uni.name)
                    }}
                  />
                ))}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  )
}

/* ========================================================================= */
/* SUBCOMPONENTS: CARDS                                                      */
/* ========================================================================= */

/**
 * Hackathon Card Item
 */
function HackathonCardItem({
  hackathon,
  onSelect,
}: {
  hackathon: Hackathon
  onSelect: () => void
}) {
  const countdown = formatDeadlineCountdown(hackathon.registration_deadline)
  const datesDisplay = formatEventDates(hackathon.start_date, hackathon.end_date)

  return (
    <article className="group flex flex-col justify-between rounded-[24px] border-[2px] border-[#050505] bg-[#fffef8] overflow-hidden shadow-[4px_4px_0_#050505] hover:shadow-[6px_6px_0_#050505] transition-all hover:-translate-y-1">
      <div>
        {/* Cover Artwork */}
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
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#050505]/60 flex items-center gap-1.5">
            <GraduationCap size={13} className="text-[#050505]/50" />
            <span className="truncate">{hackathon.organizer}</span>
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
            <div className="flex items-center gap-2 text-[11px]">
              <Calendar size={13} className="text-[#050505]/60 shrink-0" />
              <span>{datesDisplay}</span>
            </div>

            {hackathon.location && (
              <div className="flex items-center gap-2 text-[11px]">
                <MapPin size={13} className="text-[#050505]/60 shrink-0" />
                <span className="truncate">{hackathon.location}</span>
              </div>
            )}

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
          onClick={onSelect}
          className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-[#050505] bg-[#F5F04A] px-3.5 py-1 text-xs font-extrabold uppercase text-[#050505] shadow-[1.5px_1.5px_0_#050505] hover:bg-white transition-all"
        >
          <span>Details</span>
          <ArrowRight size={11} />
        </button>
      </div>
    </article>
  )
}

/**
 * Student / User Card Item
 */
function StudentCardItem({
  student,
  onOpenProfile,
}: {
  student: Profile
  onOpenProfile: () => void
}) {
  const initials = (student.full_name || 'Student')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')

  return (
    <article
      onClick={onOpenProfile}
      className="group flex flex-col justify-between rounded-[24px] border-[2px] border-[#050505] bg-[#fffef8] p-5 shadow-[4px_4px_0_#050505] hover:shadow-[6px_6px_0_#050505] transition-all hover:-translate-y-1 cursor-pointer"
    >
      <div>
        {/* Top Header: Avatar & Name */}
        <div className="flex items-start gap-3.5">
          {student.avatar_url ? (
            <img
              src={student.avatar_url}
              alt={student.full_name}
              className="h-12 w-12 rounded-2xl border-[1.5px] border-[#050505] object-cover shadow-[1.5px_1.5px_0_#050505] shrink-0"
            />
          ) : (
            <div className="grid h-12 w-12 place-items-center rounded-2xl border-[1.5px] border-[#050505] bg-[#F5F04A] text-sm font-black text-[#050505] shadow-[1.5px_1.5px_0_#050505] shrink-0">
              {initials || <User size={20} />}
            </div>
          )}

          <div className="flex-1 min-w-0">
            <h3 className="font-black text-base text-[#050505] truncate group-hover:underline">
              {student.full_name || 'Campus Student'}
            </h3>

            {student.university ? (
              <div className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-bold text-[#050505]/75 truncate max-w-full">
                <GraduationCap size={12} className="shrink-0 text-[#050505]/60" />
                <span className="truncate">{student.university}</span>
              </div>
            ) : (
              <span className="text-[11px] font-medium text-[#050505]/50">Student Developer</span>
            )}
          </div>
        </div>

        {/* Bio */}
        {student.bio ? (
          <p className="mt-3.5 text-xs text-[#050505]/80 line-clamp-2 leading-relaxed">
            {student.bio}
          </p>
        ) : (
          <p className="mt-3.5 text-xs text-[#050505]/45 italic">
            Collegiate developer active on HackhIt.
          </p>
        )}

        {/* Skills Pills */}
        {student.skills && student.skills.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {student.skills.slice(0, 4).map((skill, idx) => (
              <span
                key={idx}
                className="rounded-full border border-[#050505] bg-[#F5F04A]/60 px-2 py-0.5 text-[10px] font-bold text-[#050505]"
              >
                {skill}
              </span>
            ))}
            {student.skills.length > 4 && (
              <span className="rounded-full border border-[#050505]/30 bg-white px-2 py-0.5 text-[10px] font-bold text-[#050505]/60">
                +{student.skills.length - 4}
              </span>
            )}
          </div>
        )}

        {/* Interests Pills */}
        {student.interests && student.interests.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {student.interests.slice(0, 3).map((interest, idx) => (
              <span
                key={idx}
                className="rounded-full border border-[#050505]/20 bg-[#E9E7D8]/60 px-2 py-0.2 text-[9px] font-semibold text-[#050505]/70"
              >
                #{interest}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Card Footer Button */}
      <div className="mt-5 border-t border-[#050505]/10 pt-3 flex items-center justify-between">
        <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#050505]/50">
          Campus Peer
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onOpenProfile()
          }}
          className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-[#050505] bg-white px-3 py-1 text-[11px] font-black uppercase text-[#050505] shadow-[1.5px_1.5px_0_#050505] hover:bg-[#F5F04A] transition-all"
        >
          <span>View Profile</span>
          <ArrowRight size={11} />
        </button>
      </div>
    </article>
  )
}

/**
 * University Card Item
 */
function UniversityCardItem({
  university,
  onSearchStudents,
  onSearchHackathons,
}: {
  university: UniversitySummary
  onSearchStudents: () => void
  onSearchHackathons: () => void
}) {
  return (
    <article className="group flex flex-col justify-between rounded-[24px] border-[2px] border-[#050505] bg-[#fffef8] p-5 shadow-[4px_4px_0_#050505] hover:shadow-[6px_6px_0_#050505] transition-all hover:-translate-y-1">
      <div>
        <div className="flex items-start gap-3.5">
          <div className="grid h-12 w-12 place-items-center rounded-2xl border-[1.5px] border-[#050505] bg-[#F5F04A] text-[#050505] shadow-[1.5px_1.5px_0_#050505] shrink-0">
            <Building2 size={22} />
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="font-black text-base text-[#050505] leading-snug truncate group-hover:underline">
              {university.name}
            </h3>

            {university.location && (
              <div className="mt-0.5 flex items-center gap-1 text-[11px] text-[#050505]/70">
                <MapPin size={11} className="shrink-0 text-[#050505]/50" />
                <span className="truncate">{university.location}</span>
              </div>
            )}
          </div>
        </div>

        {/* Badges / Stats */}
        <div className="mt-5 grid grid-cols-2 gap-2 text-center">
          <div className="rounded-xl border border-[#050505]/30 bg-[#E9E7D8]/60 p-2">
            <span className="block font-black text-base text-[#050505]">
              {university.studentCount}
            </span>
            <span className="block text-[10px] font-bold uppercase tracking-wider text-[#050505]/70">
              {university.studentCount === 1 ? 'Student' : 'Students'}
            </span>
          </div>

          <div className="rounded-xl border border-[#050505]/30 bg-[#F5F04A]/30 p-2">
            <span className="block font-black text-base text-[#050505]">
              {university.hackathonCount}
            </span>
            <span className="block text-[10px] font-bold uppercase tracking-wider text-[#050505]/70">
              {university.hackathonCount === 1 ? 'Hackathon' : 'Hackathons'}
            </span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-5 border-t border-[#050505]/10 pt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={onSearchStudents}
          className="flex-1 inline-flex justify-center items-center gap-1 rounded-full border border-[#050505] bg-white py-1.5 text-[10px] font-black uppercase text-[#050505] shadow-[1.5px_1.5px_0_#050505] hover:bg-[#F5F04A] transition-all cursor-pointer"
        >
          <Users size={11} />
          <span>Students</span>
        </button>

        <button
          type="button"
          onClick={onSearchHackathons}
          className="flex-1 inline-flex justify-center items-center gap-1 rounded-full border border-[#050505] bg-[#F5F04A] py-1.5 text-[10px] font-black uppercase text-[#050505] shadow-[1.5px_1.5px_0_#050505] hover:bg-white transition-all cursor-pointer"
        >
          <Laptop size={11} />
          <span>Events</span>
        </button>
      </div>
    </article>
  )
}
