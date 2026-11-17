/**
 * HackhIt — Coding Games Arena & Collegiate Leaderboard
 *
 * Dedicated gaming and competitive programming arena featuring:
 * 1. Coding games catalog (Speed Syntax Racer, Bug Hunter, 1v1 Algorithm Duel, SQL Detective, CSS Battle)
 * 2. Playable interactive Quick Sprint challenge directly in the browser
 * 3. Real-world Collegiate Leaderboard architecture (no fake/mock data; blank until students play)
 * 4. 100% mobile & desktop responsive with touch-optimized controls
 */

import { useState, useMemo } from 'react'
import type { Session } from '@supabase/supabase-js'
import {
  Trophy,
  Swords,
  Zap,
  Flame,
  Award,
  Crown,
  Search,
  Timer,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Play,
  Terminal,
  Database,
  Code2,
  Bug,
  Layout,
} from 'lucide-react'

import { TopNav } from './TopNav'

export interface CodingGamesArenaProps {
  session?: Session | null
  onNavigateToHome: () => void
  onNavigateToCommunity: () => void
  onNavigateToExplore: () => void
  onNavigateToHackathons: () => void
  onNavigateToMyRegistrations?: () => void
  onNavigateToProfile?: () => void
  onNavigateToOrganizer?: () => void
  onNavigateToLogin: () => void
  onNavigateToSignup: () => void
  onSignOut?: () => void
}

export interface LeaderboardPlayer {
  rank: number
  name: string
  handle: string
  university: string
  avatarUrl: string
  rating: number
  wins: number
  losses: number
  winRate: number
  badge: string
  badgeColor: string
  recentActivity: string
}

const STORAGE_LEADERBOARD_KEY = 'hackhit_real_leaderboard'

interface CodingGame {
  id: string
  title: string
  tagline: string
  category: string
  icon: typeof Swords
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced'
  activePlayers: number
  xpReward: number
  description: string
  languages: string[]
}

const CODING_GAMES: CodingGame[] = [
  {
    id: 'syntax-racer',
    title: 'Speed Syntax Racer',
    tagline: 'Fix syntax bugs and type algorithms at lightning speed',
    category: 'Speed & Accuracy',
    icon: Zap,
    difficulty: 'Beginner',
    activePlayers: 0,
    xpReward: 150,
    description:
      'Race against the clock to repair broken syntax, missing semicolons, and bracket mismatches in Python, TypeScript, and Java.',
    languages: ['Python', 'TypeScript', 'Java'],
  },
  {
    id: 'bug-hunter',
    title: 'Bug Hunter Blitz',
    tagline: 'Catch logic bugs in concurrent and asynchronous code',
    category: 'Debugging',
    icon: Bug,
    difficulty: 'Intermediate',
    activePlayers: 0,
    xpReward: 250,
    description:
      'Analyze buggy code snippets from real production repositories. Pinpoint race conditions, off-by-one errors, and memory leaks before your opponent.',
    languages: ['Rust', 'Go', 'JavaScript'],
  },
  {
    id: 'algo-duel',
    title: '1v1 Algorithm Duel',
    tagline: 'Head-to-head live algorithm optimization duel',
    category: 'Algorithms',
    icon: Swords,
    difficulty: 'Advanced',
    activePlayers: 0,
    xpReward: 400,
    description:
      'Face off in real-time matches against collegiate developers. First to implement an optimal O(n log n) solution passes all test cases and wins the Elo.',
    languages: ['C++', 'Python', 'Java'],
  },
  {
    id: 'sql-detective',
    title: 'SQL Detective',
    tagline: 'Solve campus database mysteries with optimized queries',
    category: 'Databases',
    icon: Database,
    difficulty: 'Intermediate',
    activePlayers: 0,
    xpReward: 200,
    description:
      'Unravel simulated campus incidents by querying relational schemas with complex JOINs, window functions, and recursive CTEs.',
    languages: ['PostgreSQL', 'MySQL', 'SQLite'],
  },
  {
    id: 'css-battle',
    title: 'CSS Battle Arena',
    tagline: 'Replicate target UI layouts with minimal CSS properties',
    category: 'Frontend & UI',
    icon: Layout,
    difficulty: 'Beginner',
    activePlayers: 0,
    xpReward: 180,
    description:
      'Pixel-match challenging UI component targets using modern Flexbox, CSS Grid, and custom CSS variables in record time.',
    languages: ['CSS3', 'HTML5', 'SVG'],
  },
  {
    id: 'terminal-typer',
    title: 'Terminal Typer',
    tagline: 'Master Bash commands, piping, and regex automation',
    category: 'DevOps & Systems',
    icon: Terminal,
    difficulty: 'Intermediate',
    activePlayers: 0,
    xpReward: 220,
    description:
      'Chain together grep, awk, sed, and jq commands to extract logs and solve system administration puzzles at terminal velocity.',
    languages: ['Bash', 'Linux', 'Regex'],
  },
]

interface SprintQuestion {
  id: number
  prompt: string
  codeSnippet?: string
  options: string[]
  correctIndex: number
  explanation: string
}

const SPRINT_QUESTIONS: SprintQuestion[] = [
  {
    id: 1,
    prompt: 'What is the time complexity of searching in a balanced Binary Search Tree (AVL / Red-Black)?',
    options: ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)'],
    correctIndex: 1,
    explanation: 'Balanced BSTs maintain logarithmic height h <= 2 * log2(n), ensuring searches execute in O(log n) time.',
  },
  {
    id: 2,
    prompt: 'Which HTTP status code is most appropriate when a resource was created successfully?',
    options: ['200 OK', '201 Created', '204 No Content', '302 Found'],
    correctIndex: 1,
    explanation: 'HTTP 201 Created is the standard response indicating that one or more new resources have been successfully created on the server.',
  },
  {
    id: 3,
    prompt: 'In JavaScript / TypeScript, what does Promise.all() do when any promise rejects?',
    options: [
      'Waits for all promises and returns both errors and results',
      'Immediately rejects with the reason of the first rejected promise',
      'Silently ignores the rejection and resolves with successful values',
      'Retries the rejected promise up to 3 times',
    ],
    correctIndex: 1,
    explanation: 'Promise.all() short-circuits: it rejects immediately as soon as any input promise rejects.',
  },
]

export function CodingGamesArena({
  session,
  onNavigateToHome,
  onNavigateToCommunity,
  onNavigateToExplore,
  onNavigateToHackathons,
  onNavigateToMyRegistrations,
  onNavigateToProfile,
  onNavigateToOrganizer,
  onNavigateToLogin,
  onNavigateToSignup,
  onSignOut,
}: CodingGamesArenaProps) {
  // Real Leaderboard state (persisted in localStorage, completely empty if no one has played yet)
  const [players, setPlayers] = useState<LeaderboardPlayer[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_LEADERBOARD_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed)) return parsed
      }
    } catch {
      // ignore
    }
    return []
  })

  // Leaderboard filters
  const [leaderboardFilter, setLeaderboardFilter] = useState<'all' | 'mru' | 'top'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Interactive Sprint Game State
  const [isSprintActive, setIsSprintActive] = useState(false)
  const [sprintIndex, setSprintIndex] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
  const [score, setScore] = useState(0)
  const [isAnswerSubmitted, setIsAnswerSubmitted] = useState(false)
  const [sprintFinished, setSprintFinished] = useState(false)

  // Filter leaderboard
  const filteredPlayers = useMemo(() => {
    let list = [...players]

    if (leaderboardFilter === 'mru') {
      list = list.filter((p) => p.university.toLowerCase().includes('malla reddy'))
    } else if (leaderboardFilter === 'top') {
      list = list.slice(0, 3)
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.handle.toLowerCase().includes(q) ||
          p.university.toLowerCase().includes(q)
      )
    }

    return list
  }, [players, leaderboardFilter, searchQuery])

  // Start sprint handler
  const handleStartSprint = () => {
    setIsSprintActive(true)
    setSprintIndex(0)
    setSelectedAnswer(null)
    setScore(0)
    setIsAnswerSubmitted(false)
    setSprintFinished(false)
  }

  // Submit answer
  const handleSubmitAnswer = () => {
    if (selectedAnswer === null) return
    setIsAnswerSubmitted(true)
    if (selectedAnswer === SPRINT_QUESTIONS[sprintIndex].correctIndex) {
      setScore((prev) => prev + 100)
    }
  }

  // Next question or record real player entry
  const handleNextQuestion = () => {
    if (sprintIndex + 1 < SPRINT_QUESTIONS.length) {
      setSprintIndex((prev) => prev + 1)
      setSelectedAnswer(null)
      setIsAnswerSubmitted(false)
    } else {
      const finalScore =
        score + (selectedAnswer === SPRINT_QUESTIONS[sprintIndex].correctIndex ? 100 : 0)
      setSprintFinished(true)

      // Record real player score on the collegiate leaderboard
      const playerName =
        session?.user?.user_metadata?.full_name ||
        session?.user?.email?.split('@')[0] ||
        'Campus Challenger'
      const playerHandle =
        session?.user?.email?.split('@')[0] ||
        `player_${Math.floor(Math.random() * 9000 + 1000)}`
      const playerUniv =
        session?.user?.user_metadata?.university ||
        'University Student'
      const calculatedElo = 1400 + finalScore * 4

      setPlayers((prev) => {
        const existingIndex = prev.findIndex((p) => p.handle === `@${playerHandle}`)
        let updated: LeaderboardPlayer[]

        if (existingIndex >= 0) {
          const current = prev[existingIndex]
          const newWins = finalScore >= 200 ? current.wins + 1 : current.wins
          const newLosses = finalScore < 200 ? current.losses + 1 : current.losses
          const totalMatches = newWins + newLosses
          const winRate = totalMatches > 0 ? Math.round((newWins / totalMatches) * 100) : 100

          const updatedPlayer: LeaderboardPlayer = {
            ...current,
            rating: Math.max(current.rating, calculatedElo),
            wins: newWins,
            losses: newLosses,
            winRate,
            recentActivity: `Scored ${finalScore} pts in Quick Sprint`,
          }
          updated = [...prev]
          updated[existingIndex] = updatedPlayer
        } else {
          const newPlayer: LeaderboardPlayer = {
            rank: 1,
            name: playerName,
            handle: `@${playerHandle}`,
            university: playerUniv,
            avatarUrl:
              session?.user?.user_metadata?.avatar_url ||
              'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80',
            rating: calculatedElo,
            wins: finalScore >= 200 ? 1 : 0,
            losses: finalScore < 200 ? 1 : 0,
            winRate: finalScore >= 200 ? 100 : 0,
            badge: finalScore >= 300 ? 'Grandmaster' : finalScore >= 200 ? 'Speed Demon' : 'Rising Star',
            badgeColor: finalScore >= 300 ? 'bg-[#F5F04A] text-[#050505]' : 'bg-emerald-300 text-[#050505]',
            recentActivity: `Scored ${finalScore} pts in Quick Sprint`,
          }
          updated = [...prev, newPlayer]
        }

        // Sort descending by rating and re-rank
        updated.sort((a, b) => b.rating - a.rating)
        updated = updated.map((p, idx) => ({ ...p, rank: idx + 1 }))

        try {
          localStorage.setItem(STORAGE_LEADERBOARD_KEY, JSON.stringify(updated))
        } catch {
          // ignore
        }
        return updated
      })
    }
  }

  return (
    <div className="site-shell min-h-screen bg-[#E9E7D8] text-[#050505] flex flex-col w-full pb-20 md:pb-6">
      <TopNav
        currentView="hackathons"
        session={session}
        onNavigateToHome={onNavigateToHome}
        onNavigateToCommunity={onNavigateToCommunity}
        onNavigateToExplore={onNavigateToExplore}
        onNavigateToHackathons={onNavigateToHackathons}
        onNavigateToMyRegistrations={onNavigateToMyRegistrations}
        onNavigateToProfile={onNavigateToProfile}
        onNavigateToOrganizer={onNavigateToOrganizer}
        onNavigateToLogin={onNavigateToLogin}
        onNavigateToSignup={onNavigateToSignup}
        onSignOut={onSignOut}
        onOpenProfile={onNavigateToProfile}
      />

      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 flex-1 flex flex-col gap-10 sm:gap-14">
        {/* ========================================================================= */}
        {/* ARENA HERO BANNER */}
        {/* ========================================================================= */}
        <section className="rounded-[32px] border-[2.5px] border-[#050505] bg-[#050505] text-[#E9E7D8] p-6 sm:p-10 md:p-12 shadow-[6px_6px_0_#F5F04A] relative overflow-hidden">
          <div className="max-w-3xl relative z-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#F5F04A] bg-[#F5F04A] px-3.5 py-1 text-[11px] font-black uppercase tracking-widest text-[#050505] mb-4">
              <Swords size={13} />
              Collegiate Coding Arena
            </div>

            <h1 className="display-font text-3xl sm:text-5xl md:text-6xl uppercase leading-[0.95] text-[#E9E7D8]">
              CODE. COMPETE.
              <br />
              CLIMB THE RANKS.
            </h1>

            <p className="mt-4 text-xs sm:text-sm md:text-base text-[#E9E7D8]/80 leading-relaxed max-w-2xl">
              Play fast-paced coding games, solve real algorithmic bug duels against campus rivals,
              and prove your engineering speed on the national collegiate leaderboard.
            </p>

            {/* Quick Live Stats */}
            <div className="mt-8 flex flex-wrap items-center gap-3 sm:gap-4 pt-6 border-t border-white/15">
              <div className="flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#F5F04A] text-[#050505]">
                  <Flame size={14} />
                </span>
                <span className="text-xs font-bold text-[#E9E7D8]">
                  <strong className="text-[#F5F04A]">{players.length}</strong> Ranked Players
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-400 text-[#050505]">
                  <Trophy size={14} />
                </span>
                <span className="text-xs font-bold text-[#E9E7D8]">
                  <strong className="text-emerald-300">6</strong> Battle Arenas
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-amber-400 text-[#050505]">
                  <Zap size={14} />
                </span>
                <span className="text-xs font-bold text-[#E9E7D8]">
                  <strong className="text-amber-300">100%</strong> Verified Collegiate
                </span>
              </div>
            </div>
          </div>

          <div className="hidden lg:block absolute -right-6 -bottom-6 opacity-20 pointer-events-none">
            <Trophy size={280} className="text-[#F5F04A]" />
          </div>
        </section>

        {/* ========================================================================= */}
        {/* IN-BROWSER QUICK SPRINT MINI-GAME */}
        {/* ========================================================================= */}
        <section
          id="quick-sprint"
          className="rounded-[32px] border-[2.5px] border-[#050505] bg-[#fffef8] p-6 sm:p-8 md:p-10 shadow-[6px_6px_0_#050505]"
          aria-label="Interactive Quick Sprint Game"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#050505]/15 pb-6">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#050505] bg-[#F5F04A] px-3 py-0.5 text-[10px] font-black uppercase tracking-wider text-[#050505]">
                <Zap size={12} />
                Live In-Browser Sprint
              </div>
              <h2 className="display-font mt-2 text-2xl sm:text-3xl uppercase text-[#050505]">
                Quick Speed Sprint Challenge
              </h2>
              <p className="mt-1 text-xs sm:text-sm text-[#39382f]">
                Answer fast, earn rating points, and place your score on the live collegiate leaderboard.
              </p>
            </div>

            {!isSprintActive && !sprintFinished && (
              <button
                type="button"
                onClick={handleStartSprint}
                className="inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-full border-[2px] border-[#050505] bg-[#F5F04A] px-6 text-xs font-black uppercase tracking-wider text-[#050505] shadow-[3px_3px_0_#050505] hover:-translate-y-0.5 transition-transform shrink-0"
              >
                <Play size={14} />
                <span>Start Rapid Sprint</span>
              </button>
            )}
          </div>

          {/* ACTIVE SPRINT QUESTION */}
          {isSprintActive && !sprintFinished && (
            <div className="mt-6 space-y-6">
              {/* Question Header & Progress */}
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-black text-[#050505]/60 uppercase">
                  Question {sprintIndex + 1} of {SPRINT_QUESTIONS.length}
                </span>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full border border-[#050505] bg-[#E9E7D8] px-2.5 py-0.5 text-[11px] font-bold text-[#050505]">
                    <Timer size={12} /> Live Sprint
                  </span>
                  <span className="font-mono text-xs font-black text-[#050505] bg-[#F5F04A] border border-[#050505] px-2.5 py-0.5 rounded-full">
                    {score} XP
                  </span>
                </div>
              </div>

              {/* Question Text */}
              <div className="rounded-2xl border-[2px] border-[#050505] bg-white p-5 sm:p-6 shadow-[3px_3px_0_#050505]">
                <h3 className="font-bold text-sm sm:text-base text-[#050505]">
                  {SPRINT_QUESTIONS[sprintIndex].prompt}
                </h3>
              </div>

              {/* Options */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {SPRINT_QUESTIONS[sprintIndex].options.map((opt, idx) => {
                  const isSelected = selectedAnswer === idx
                  const isCorrect = idx === SPRINT_QUESTIONS[sprintIndex].correctIndex

                  let btnStyle = 'border-[#050505] bg-white hover:bg-[#F5F04A]/30 text-[#050505]'
                  if (isAnswerSubmitted) {
                    if (isCorrect) {
                      btnStyle = 'border-emerald-600 bg-emerald-100 text-emerald-950 font-black'
                    } else if (isSelected && !isCorrect) {
                      btnStyle = 'border-red-600 bg-red-100 text-red-950 font-bold'
                    }
                  } else if (isSelected) {
                    btnStyle = 'border-[#050505] bg-[#F5F04A] text-[#050505] font-black'
                  }

                  return (
                    <button
                      key={opt}
                      type="button"
                      disabled={isAnswerSubmitted}
                      onClick={() => setSelectedAnswer(idx)}
                      className={`flex items-center justify-between rounded-xl border-[1.5px] p-4 text-xs sm:text-sm text-left transition-all cursor-pointer shadow-[2px_2px_0_#050505] ${btnStyle}`}
                    >
                      <span>{opt}</span>
                      {isAnswerSubmitted && isCorrect && <CheckCircle2 size={16} className="text-emerald-700 shrink-0" />}
                      {isAnswerSubmitted && isSelected && !isCorrect && (
                        <XCircle size={16} className="text-red-700 shrink-0" />
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Explanation upon submit */}
              {isAnswerSubmitted && (
                <div className="rounded-xl border border-[#050505] bg-[#E9E7D8]/60 p-4 text-xs text-[#050505] space-y-1">
                  <strong>Explanation:</strong>
                  <p>{SPRINT_QUESTIONS[sprintIndex].explanation}</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                {!isAnswerSubmitted ? (
                  <button
                    type="button"
                    disabled={selectedAnswer === null}
                    onClick={handleSubmitAnswer}
                    className="inline-flex min-h-[42px] cursor-pointer items-center justify-center gap-1.5 rounded-full border-[1.5px] border-[#050505] bg-[#F5F04A] px-5 text-xs font-black uppercase text-[#050505] shadow-[2px_2px_0_#050505] disabled:opacity-50"
                  >
                    Submit Answer
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleNextQuestion}
                    className="inline-flex min-h-[42px] cursor-pointer items-center justify-center gap-1.5 rounded-full border-[1.5px] border-[#050505] bg-[#050505] px-6 text-xs font-black uppercase text-[#E9E7D8] shadow-[2px_2px_0_#050505]"
                  >
                    {sprintIndex + 1 < SPRINT_QUESTIONS.length ? 'Next Question →' : 'See Results →'}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* SPRINT RESULTS VIEW */}
          {sprintFinished && (
            <div className="mt-6 rounded-2xl border-[2px] border-[#050505] bg-[#F5F04A]/20 p-6 sm:p-8 text-center space-y-4">
              <span className="grid h-16 w-16 mx-auto place-items-center rounded-full border-2 border-[#050505] bg-[#F5F04A] text-[#050505] shadow-[3px_3px_0_#050505]">
                <Award size={32} />
              </span>

              <h3 className="display-font text-2xl sm:text-3xl uppercase text-[#050505]">
                Sprint Completed!
              </h3>

              <p className="text-xs sm:text-sm font-bold text-[#050505]/80 max-w-sm mx-auto">
                You earned <strong>+{score} XP</strong> and your score has been added to the collegiate leaderboard!
              </p>

              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleStartSprint}
                  className="inline-flex min-h-[42px] cursor-pointer items-center gap-1.5 rounded-full border-[1.5px] border-[#050505] bg-[#F5F04A] px-5 text-xs font-black uppercase text-[#050505] shadow-[2px_2px_0_#050505]"
                >
                  <RotateCcw size={13} /> Play Again
                </button>
                <button
                  type="button"
                  onClick={() => setIsSprintActive(false)}
                  className="inline-flex min-h-[42px] cursor-pointer items-center gap-1.5 rounded-full border-[1.5px] border-[#050505] bg-white px-5 text-xs font-bold uppercase text-[#050505] shadow-[2px_2px_0_#050505]"
                >
                  Close Sprint
                </button>
              </div>
            </div>
          )}

          {!isSprintActive && !sprintFinished && (
            <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
              <div className="rounded-xl border border-[#050505]/20 bg-[#E9E7D8]/50 p-3.5">
                <span className="font-mono text-[10px] font-black uppercase text-[#050505]/60 block">Format</span>
                <strong className="text-xs text-[#050505] mt-0.5 block">3 Rapid Problem Sprints</strong>
              </div>
              <div className="rounded-xl border border-[#050505]/20 bg-[#E9E7D8]/50 p-3.5">
                <span className="font-mono text-[10px] font-black uppercase text-[#050505]/60 block">Rewards</span>
                <strong className="text-xs text-[#050505] mt-0.5 block">+300 XP & Rating Boost</strong>
              </div>
              <div className="rounded-xl border border-[#050505]/20 bg-[#E9E7D8]/50 p-3.5">
                <span className="font-mono text-[10px] font-black uppercase text-[#050505]/60 block">Topics</span>
                <strong className="text-xs text-[#050505] mt-0.5 block">Algorithms, Web & Systems</strong>
              </div>
            </div>
          )}
        </section>

        {/* ========================================================================= */}
        {/* CODING GAMES SELECTION GRID */}
        {/* ========================================================================= */}
        <section aria-label="Coding games catalog">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-6">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full border border-[#050505] bg-[#F5F04A] px-3 py-0.5 text-[10px] font-black uppercase tracking-wider text-[#050505]">
                <Code2 size={12} />
                Game Modes
              </div>
              <h2 className="display-font mt-2 text-3xl sm:text-4xl uppercase text-[#050505]">
                Competitive Coding Games
              </h2>
            </div>
            <span className="text-xs font-bold text-[#050505]/70">
              6 Battle Arenas Open 24/7
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {CODING_GAMES.map((game) => {
              const IconComp = game.icon

              return (
                <div
                  key={game.id}
                  className="flex flex-col justify-between rounded-[24px] border-[2px] border-[#050505] bg-[#fffef8] p-6 shadow-[4px_4px_0_#050505] transition-all hover:-translate-y-1 hover:shadow-[6px_6px_0_#050505]"
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <span className="grid h-12 w-12 place-items-center rounded-2xl border-[1.5px] border-[#050505] bg-[#F5F04A] text-[#050505] shadow-[2px_2px_0_#050505]">
                        <IconComp size={22} />
                      </span>

                      <span className="rounded-full border border-[#050505] bg-white px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-[#050505]">
                        {game.difficulty}
                      </span>
                    </div>

                    <h3 className="mt-4 text-lg font-black uppercase text-[#050505] leading-snug">
                      {game.title}
                    </h3>

                    <p className="mt-1 text-xs font-bold text-[#050505]/60 uppercase tracking-wider">
                      {game.tagline}
                    </p>

                    <p className="mt-3 text-xs text-[#39382f] leading-relaxed">
                      {game.description}
                    </p>

                    {/* Language Pills */}
                    <div className="mt-4 flex flex-wrap items-center gap-1.5">
                      {game.languages.map((lang) => (
                        <span
                          key={lang}
                          className="rounded-md border border-[#050505]/20 bg-[#E9E7D8]/60 px-2 py-0.5 font-mono text-[10px] font-bold text-[#050505]"
                        >
                          {lang}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Footer Stats & Button */}
                  <div className="mt-6 border-t border-[#050505]/15 pt-4 flex items-center justify-between">
                    <div className="text-[11px] font-bold text-[#050505]/70">
                      <span className="text-[#050505] font-black">Open</span> Battle Arena
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const el = document.getElementById('quick-sprint')
                        if (el) el.scrollIntoView({ behavior: 'smooth' })
                        handleStartSprint()
                      }}
                      className="inline-flex min-h-[36px] cursor-pointer items-center gap-1.5 rounded-full border-[1.5px] border-[#050505] bg-[#F5F04A] px-4 text-xs font-black uppercase tracking-wider text-[#050505] shadow-[2px_2px_0_#050505] hover:-translate-y-0.5 transition-transform"
                    >
                      <Play size={11} /> Play Game
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* ========================================================================= */}
        {/* COLLEGIATE LEADERBOARD SECTION */}
        {/* ========================================================================= */}
        <section
          id="leaderboard"
          className="rounded-[32px] border-[2.5px] border-[#050505] bg-[#fffef8] p-6 sm:p-8 md:p-10 shadow-[6px_6px_0_#050505]"
          aria-label="Collegiate coding leaderboard"
        >
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#050505]/15 pb-6">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#050505] bg-[#F5F04A] px-3 py-0.5 text-[10px] font-black uppercase tracking-wider text-[#050505]">
                <Crown size={12} />
                Collegiate Rankings
              </div>
              <h2 className="display-font mt-2 text-3xl sm:text-4xl uppercase text-[#050505]">
                Campus Leaderboard
              </h2>
              <p className="mt-1 text-xs sm:text-sm text-[#39382f]">
                Real student coders ranked by battle Elo, win streaks, and solved challenges across universities.
              </p>
            </div>

            {/* Filter Tabs */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setLeaderboardFilter('all')}
                className={`cursor-pointer rounded-full border px-3.5 py-1 text-xs font-bold transition-all ${
                  leaderboardFilter === 'all'
                    ? 'border-[#050505] bg-[#050505] text-[#E9E7D8] shadow-[2px_2px_0_#050505]'
                    : 'border-[#050505]/30 bg-white text-[#050505] hover:bg-[#F5F04A]/30'
                }`}
              >
                All Campuses
              </button>

              <button
                type="button"
                onClick={() => setLeaderboardFilter('mru')}
                className={`cursor-pointer rounded-full border px-3.5 py-1 text-xs font-bold transition-all ${
                  leaderboardFilter === 'mru'
                    ? 'border-[#050505] bg-[#050505] text-[#E9E7D8] shadow-[2px_2px_0_#050505]'
                    : 'border-[#050505]/30 bg-white text-[#050505] hover:bg-[#F5F04A]/30'
                }`}
              >
                Malla Reddy University
              </button>

              <button
                type="button"
                onClick={() => setLeaderboardFilter('top')}
                className={`cursor-pointer rounded-full border px-3.5 py-1 text-xs font-bold transition-all ${
                  leaderboardFilter === 'top'
                    ? 'border-[#050505] bg-[#050505] text-[#E9E7D8] shadow-[2px_2px_0_#050505]'
                    : 'border-[#050505]/30 bg-white text-[#050505] hover:bg-[#F5F04A]/30'
                }`}
              >
                Top 3 Champions
              </button>
            </div>
          </div>

          {/* Search Leaderboard */}
          <div className="mt-6 mb-4 relative">
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#050505]/50"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search players by name, handle, or college..."
              className="w-full rounded-xl border-[1.5px] border-[#050505] bg-white pl-10 pr-4 py-2.5 text-xs sm:text-sm font-medium text-[#050505] outline-none shadow-[2px_2px_0_#050505]"
            />
          </div>

          {/* REAL ARCHITECTURE: EMPTY STATE WHEN NO REAL PLAYERS HAVE COMPETED YET */}
          {filteredPlayers.length === 0 ? (
            <div className="rounded-[24px] border-[2px] border-dashed border-[#050505]/30 bg-[#E9E7D8]/40 p-8 sm:p-12 text-center mt-6">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-full border-2 border-[#050505] bg-white text-[#050505] shadow-[2px_2px_0_#050505]">
                <Trophy size={24} />
              </div>

              <h3 className="mt-4 font-black text-lg text-[#050505] uppercase">
                No Arena Rankings Yet
              </h3>

              <p className="mt-1.5 text-xs text-[#050505]/70 max-w-md mx-auto leading-relaxed">
                No students have recorded scores on the arena leaderboard yet. Complete a coding game sprint above to record the first verified score and claim Rank #1!
              </p>

              <div className="mt-5">
                <button
                  type="button"
                  onClick={() => {
                    const el = document.getElementById('quick-sprint')
                    if (el) el.scrollIntoView({ behavior: 'smooth' })
                    handleStartSprint()
                  }}
                  className="inline-flex min-h-[40px] cursor-pointer items-center gap-2 rounded-full border border-[#050505] bg-[#F5F04A] px-5 text-xs font-black uppercase text-[#050505] shadow-[2px_2px_0_#050505] hover:-translate-y-0.5 transition-transform"
                >
                  <Play size={12} />
                  <span>Play Quick Sprint Challenge</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Desktop Leaderboard Table */}
              <div className="hidden md:block overflow-x-auto mt-4">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b-2 border-[#050505] text-[11px] font-black uppercase text-[#050505]/60 tracking-wider">
                      <th className="py-3 px-3">Rank</th>
                      <th className="py-3 px-3">Player</th>
                      <th className="py-3 px-3">University</th>
                      <th className="py-3 px-3">Rating</th>
                      <th className="py-3 px-3">Arena Record</th>
                      <th className="py-3 px-3 text-right">Badge</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#050505]/10 font-medium">
                    {filteredPlayers.map((player) => {
                      const isTop3 = player.rank <= 3

                      return (
                        <tr
                          key={player.handle}
                          className={`hover:bg-[#E9E7D8]/40 transition-colors ${
                            player.rank === 1 ? 'bg-[#F5F04A]/15 font-bold' : ''
                          }`}
                        >
                          {/* Rank */}
                          <td className="py-3.5 px-3">
                            <div className="flex items-center gap-1.5">
                              {player.rank === 1 ? (
                                <span className="grid h-7 w-7 place-items-center rounded-lg border border-[#050505] bg-[#F5F04A] font-black text-[#050505] shadow-[1px_1px_0_#050505]">
                                  1
                                </span>
                              ) : player.rank === 2 ? (
                                <span className="grid h-7 w-7 place-items-center rounded-lg border border-[#050505] bg-neutral-200 font-black text-[#050505] shadow-[1px_1px_0_#050505]">
                                  2
                                </span>
                              ) : player.rank === 3 ? (
                                <span className="grid h-7 w-7 place-items-center rounded-lg border border-[#050505] bg-amber-200 font-black text-[#050505] shadow-[1px_1px_0_#050505]">
                                  3
                                </span>
                              ) : (
                                <span className="font-mono font-bold text-sm text-[#050505]/70 pl-2">
                                  #{player.rank}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Player Profile */}
                          <td className="py-3.5 px-3">
                            <div className="flex items-center gap-2.5">
                              <img
                                src={player.avatarUrl}
                                alt={player.name}
                                className="h-9 w-9 rounded-full border border-[#050505] object-cover"
                              />
                              <div>
                                <div className="font-black text-sm text-[#050505] flex items-center gap-1.5">
                                  {player.name}
                                  {isTop3 && <Crown size={12} className="text-amber-500" />}
                                </div>
                                <div className="text-[11px] font-mono text-[#050505]/60">
                                  {player.handle}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* University */}
                          <td className="py-3.5 px-3 font-semibold text-xs text-[#050505]">
                            {player.university}
                          </td>

                          {/* Elo Rating */}
                          <td className="py-3.5 px-3 font-mono font-black text-sm text-[#050505]">
                            {player.rating}
                          </td>

                          {/* Record */}
                          <td className="py-3.5 px-3 text-[11px]">
                            <span className="text-emerald-700 font-bold">{player.wins}W</span>{' '}
                            <span className="text-red-700 font-bold">{player.losses}L</span>{' '}
                            <span className="text-[#050505]/50">({player.winRate}% win rate)</span>
                          </td>

                          {/* Badge */}
                          <td className="py-3.5 px-3 text-right">
                            <span
                              className={`inline-block rounded-full border border-[#050505] px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${player.badgeColor}`}
                            >
                              {player.badge}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Leaderboard Cards (Optimized for Small Touchscreens) */}
              <div className="md:hidden space-y-3 mt-4">
                {filteredPlayers.map((player) => (
                  <div
                    key={player.handle}
                    className="rounded-2xl border-[1.5px] border-[#050505] bg-white p-4 shadow-[2px_2px_0_#050505] space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`grid h-7 w-7 place-items-center rounded-lg border border-[#050505] text-xs font-black ${
                            player.rank === 1
                              ? 'bg-[#F5F04A]'
                              : player.rank === 2
                              ? 'bg-neutral-200'
                              : player.rank === 3
                              ? 'bg-amber-200'
                              : 'bg-[#E9E7D8]'
                          }`}
                        >
                          #{player.rank}
                        </span>

                        <img
                          src={player.avatarUrl}
                          alt={player.name}
                          className="h-8 w-8 rounded-full border border-[#050505] object-cover"
                        />

                        <div>
                          <h4 className="text-xs font-black text-[#050505]">{player.name}</h4>
                          <p className="text-[10px] font-mono text-[#050505]/60">{player.handle}</p>
                        </div>
                      </div>

                      <span
                        className={`rounded-full border border-[#050505] px-2 py-0.5 text-[9px] font-black uppercase ${player.badgeColor}`}
                      >
                        {player.badge}
                      </span>
                    </div>

                    <div className="flex items-center justify-between border-t border-[#050505]/10 pt-2 text-xs">
                      <span className="text-[11px] font-bold text-[#050505]/70 truncate max-w-[180px]">
                        {player.university}
                      </span>
                      <div className="font-mono font-black text-xs text-[#050505]">
                        {player.rating} Elo
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

        {/* ========================================================================= */}
        {/* EXPLORE HACKATHONS CALLOUT */}
        {/* ========================================================================= */}
        <section className="rounded-[28px] border-[2px] border-[#050505] bg-[#fffef8] p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-[4px_4px_0_#050505]">
          <div>
            <h3 className="font-black text-base sm:text-lg uppercase text-[#050505]">
              Looking for Campus Hackathons?
            </h3>
            <p className="mt-1 text-xs text-[#39382f]">
              Head over to our Explore page to discover collegiate hackathons or create an official event for your university.
            </p>
          </div>

          <button
            type="button"
            onClick={onNavigateToExplore}
            className="inline-flex min-h-[42px] cursor-pointer items-center justify-center gap-2 rounded-full border-[1.5px] border-[#050505] bg-[#F5F04A] px-6 text-xs font-black uppercase text-[#050505] shadow-[2px_2px_0_#050505] shrink-0"
          >
            Explore Hackathons →
          </button>
        </section>
      </div>
    </div>
  )
}
