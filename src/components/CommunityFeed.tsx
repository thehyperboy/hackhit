/**
 * HackhIt — Student Social Community Feed Page
 *
 * Dedicated community page for authenticated students featuring recent posts,
 * create-post composer with media uploads, likes, comments, student profiles,
 * and editorial HackhIt aesthetics.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import type { Session } from '@supabase/supabase-js'
import {
  AlertCircle,
  ArrowRight,
  Database,
  ExternalLink,
  MessageSquare,
  RefreshCw,
  Sparkles,
  User,
  WifiOff,
  ShieldAlert,
} from 'lucide-react'
import type { Post, Profile, DatabaseSchemaReport } from '../lib/community'
import {
  fetchPosts,
  ensureProfileExists,
  checkDatabaseSchemaStatus,
} from '../lib/community'
import { PostCard } from './PostCard'
import { CreatePostComposer } from './CreatePostComposer'
import { StudentProfileModal } from './StudentProfileModal'
import { TopNav } from './TopNav'

interface CommunityFeedProps {
  session: Session | null
  onNavigateToHome: () => void
  onNavigateToLogin: (redirect?: string) => void
  onNavigateToSignup: () => void
  onSignOut: () => void
  onNavigateToHackathons?: () => void
  onNavigateToMyRegistrations?: () => void
  onNavigateToProfile?: (id?: string) => void
  initialDraft?: string
}

export function CommunityFeed({
  session,
  onNavigateToHome,
  onNavigateToLogin,
  onNavigateToSignup,
  onSignOut,
  onNavigateToHackathons,
  onNavigateToMyRegistrations,
  onNavigateToProfile,
  initialDraft,
}: CommunityFeedProps) {
  const [posts, setPosts] = useState<Post[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isCheckingSchema, setIsCheckingSchema] = useState(false)
  const [userProfile, setUserProfile] = useState<Profile | null>(null)
  const [schemaReport, setSchemaReport] = useState<DatabaseSchemaReport | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [activeFilter, setActiveFilter] = useState<'all' | 'mine'>('all')

  // In-flight request deduplication guard & cancellation controller
  const inFlightRef = useRef(false)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Profile modal state
  const [selectedProfileUserId, setSelectedProfileUserId] = useState<string | null>(null)
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)

  // SQL Migration helper dialog state
  const [showMigrationGuide, setShowMigrationGuide] = useState(false)

  const currentUserId = session?.user?.id

  // Load user profile on session change
  useEffect(() => {
    let isCancelled = false
    if (session?.user) {
      ensureProfileExists({
        id: session.user.id,
        email: session.user.email,
        user_metadata: session.user.user_metadata,
      }).then((prof) => {
        if (!isCancelled && prof) setUserProfile(prof)
      })
    }
    return () => {
      isCancelled = true
    }
  }, [session])

  // Data loading function for user interactions (Refresh / Retry)
  const loadPosts = useCallback(
    async (isBackground = false) => {
      if (inFlightRef.current && !isBackground) return

      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }

      const controller = new AbortController()
      abortControllerRef.current = controller
      inFlightRef.current = true

      if (isBackground) {
        setIsRefreshing(true)
      } else {
        setIsLoading(true)
      }

      try {
        const { posts: fetchedPosts, error, isPendingSchema } = await fetchPosts(currentUserId, {
          signal: controller.signal,
        })

        if (controller.signal.aborted) return

        if (isPendingSchema) {
          setIsCheckingSchema(true)
          const report = await checkDatabaseSchemaStatus()
          if (!controller.signal.aborted) {
            setSchemaReport(report)
            setPosts([])
            setErrorMessage(null)
          }
          return
        }

        if (error) {
          if (!controller.signal.aborted) {
            const isNetErr =
              error.toLowerCase().includes('fetch') ||
              error.toLowerCase().includes('network')
            setErrorMessage(
              isNetErr
                ? 'Unable to connect to the campus server. Please check your network and retry.'
                : error
            )
          }
        } else {
          if (!controller.signal.aborted) {
            setPosts(fetchedPosts)
            setErrorMessage(null)
            setSchemaReport((prev) =>
              prev?.state === 'initialized'
                ? prev
                : {
                    state: 'initialized',
                    missingTables: [],
                    existingTables: ['profiles', 'posts', 'post_likes', 'comments'],
                    message: 'Community tables ready.',
                    checkedAt: new Date().toLocaleTimeString(),
                  }
            )
          }
        }
      } catch (err) {
        if (controller.signal.aborted) return
        const msg = err instanceof Error ? err.message : String(err)
        if (!msg.toLowerCase().includes('abort')) {
          setErrorMessage('Unable to load campus posts right now. Please try again.')
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false)
          setIsRefreshing(false)
          setIsCheckingSchema(false)
        }
        inFlightRef.current = false
      }
    },
    [currentUserId]
  )

  // Initial load via subscription effect
  useEffect(() => {
    const controller = new AbortController()
    abortControllerRef.current = controller
    inFlightRef.current = true

    fetchPosts(currentUserId, { signal: controller.signal })
      .then(({ posts: fetchedPosts, error, isPendingSchema }) => {
        if (controller.signal.aborted) return

        if (isPendingSchema) {
          setIsCheckingSchema(true)
          checkDatabaseSchemaStatus().then((report) => {
            if (!controller.signal.aborted) {
              setSchemaReport(report)
              setPosts([])
              setErrorMessage(null)
            }
          })
          return
        }

        if (error) {
          const isNetErr =
            error.toLowerCase().includes('fetch') ||
            error.toLowerCase().includes('network')
          setErrorMessage(
            isNetErr
              ? 'Unable to connect to the campus server. Please check your network and retry.'
              : error
          )
        } else {
          setPosts(fetchedPosts)
          setErrorMessage(null)
          setSchemaReport((prev) =>
            prev?.state === 'initialized'
              ? prev
              : {
                  state: 'initialized',
                  missingTables: [],
                  existingTables: ['profiles', 'posts', 'post_likes', 'comments'],
                  message: 'Community tables ready.',
                  checkedAt: new Date().toLocaleTimeString(),
                }
          )
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          const msg = err instanceof Error ? err.message : String(err)
          if (!msg.toLowerCase().includes('abort')) {
            setErrorMessage('Unable to load campus posts right now. Please try again.')
          }
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false)
          setIsCheckingSchema(false)
        }
        inFlightRef.current = false
      })

    return () => {
      controller.abort()
    }
  }, [currentUserId])

  const handlePostCreated = (newPost: Post) => {
    setPosts((prev) => [newPost, ...prev])
  }

  const handlePostDeleted = (deletedPostId: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== deletedPostId))
  }

  const handleOpenAuthorProfile = (authorId: string) => {
    if (onNavigateToProfile) {
      onNavigateToProfile(authorId)
    } else {
      setSelectedProfileUserId(authorId)
      setIsProfileModalOpen(true)
    }
  }

  const handleOpenMyProfile = () => {
    if (!currentUserId) {
      onNavigateToLogin('community')
      return
    }
    if (onNavigateToProfile) {
      onNavigateToProfile(currentUserId)
    } else {
      setSelectedProfileUserId(currentUserId)
      setIsProfileModalOpen(true)
    }
  }

  const effectiveFilter = activeFilter === 'mine' && currentUserId ? 'mine' : 'all'

  const myPosts = currentUserId
    ? posts.filter((p) => p.user_id === currentUserId)
    : []

  const filteredPosts =
    effectiveFilter === 'mine' ? myPosts : posts

  return (
    <div className="community-feed-view min-h-screen bg-[#E9E7D8] text-[#050505] flex flex-col w-full">
      {/* Topbar navigation */}
      <TopNav
        currentView="community"
        session={session}
        userDisplayName={userProfile?.full_name}
        onNavigateToHome={onNavigateToHome}
        onNavigateToCommunity={() => {}}
        onNavigateToHackathons={onNavigateToHackathons || (() => { window.location.hash = '#hackathons' })}
        onNavigateToMyRegistrations={onNavigateToMyRegistrations}
        onNavigateToLogin={() => onNavigateToLogin('community')}
        onNavigateToSignup={onNavigateToSignup}
        onSignOut={onSignOut}
        onNavigateToProfile={onNavigateToProfile || handleOpenMyProfile}
        onOpenProfile={onNavigateToProfile || handleOpenMyProfile}
      />

      {/* Main Community Container */}
      <main className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 flex-1">
        {/* Editorial Community Header Banner */}
        <section className="reveal">
          <div className="rounded-[28px] border-[2.5px] border-[#050505] bg-[#fffef8] p-6 sm:p-8 shadow-[6px_6px_0_#050505]">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-[#050505] bg-[#F5F04A] px-3 py-1 text-[11px] font-extrabold uppercase tracking-widest text-[#050505] shadow-[2px_2px_0_#050505]">
                  <Sparkles size={12} />
                  Campus Social Feed
                </div>

                <h1 className="display-font mt-3 text-4xl sm:text-5xl text-[#050505] leading-none">
                  STUDENT COMMUNITY
                </h1>

                <p className="mt-2 text-xs sm:text-sm text-[#39382f] max-w-lg leading-relaxed">
                  Connect with fellow builders, share project milestones, discuss hackathons,
                  and showcase what you are creating on campus.
                </p>
              </div>

              {/* Quick Actions */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => loadPosts(true)}
                  disabled={isRefreshing}
                  className="inline-flex min-h-[38px] cursor-pointer items-center gap-2 rounded-full border border-[#050505] bg-white px-3.5 text-xs font-bold text-[#050505] shadow-[2px_2px_0_#050505] hover:bg-[#F5F04A] transition-all"
                  title="Refresh posts"
                >
                  <RefreshCw
                    size={13}
                    className={isRefreshing ? 'animate-spin' : ''}
                  />
                  <span>Refresh</span>
                </button>

                {session && (
                  <button
                    type="button"
                    onClick={handleOpenMyProfile}
                    className="inline-flex min-h-[38px] cursor-pointer items-center gap-2 rounded-full border border-[#050505] bg-[#F5F04A] px-4 text-xs font-extrabold text-[#050505] shadow-[2px_2px_0_#050505] hover:-translate-y-0.5 transition-transform"
                  >
                    <User size={13} />
                    <span>My Profile</span>
                  </button>
                )}
              </div>
            </div>

            {/* Filter pills */}
            <div className="mt-6 flex items-center justify-between border-t border-[#050505]/15 pt-4 text-xs">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveFilter('all')}
                  className={`cursor-pointer rounded-full border px-3.5 py-1 text-xs font-bold transition-all ${
                    effectiveFilter === 'all'
                      ? 'border-[#050505] bg-[#050505] text-[#E9E7D8] shadow-[2px_2px_0_#050505]'
                      : 'border-[#050505]/30 bg-white text-[#050505] hover:border-[#050505]'
                  }`}
                >
                  All Campus Posts ({posts.length})
                </button>

                {session && (
                  <button
                    type="button"
                    onClick={() => setActiveFilter('mine')}
                    className={`cursor-pointer rounded-full border px-3.5 py-1 text-xs font-bold transition-all ${
                      effectiveFilter === 'mine'
                        ? 'border-[#050505] bg-[#050505] text-[#E9E7D8] shadow-[2px_2px_0_#050505]'
                        : 'border-[#050505]/30 bg-white text-[#050505] hover:border-[#050505]'
                    }`}
                  >
                    My Posts ({myPosts.length})
                  </button>
                )}
              </div>

              <span className="text-[11px] font-semibold text-[#050505]/60 hidden sm:inline-block">
                Showing newest first
              </span>
            </div>
          </div>
        </section>

        {/* 1. Database Migration Pending Notice (specifically when tables are missing from schema) */}
        {schemaReport?.state === 'uninitialized' && (
          <section className="rounded-[24px] border-[2px] border-[#050505] bg-[#fffef8] p-6 shadow-[5px_5px_0_#050505]">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[#050505] bg-[#F5F04A] text-[#050505]">
                <Database size={18} />
              </span>
              <div className="flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-sm uppercase tracking-wide text-[#050505]">
                      Database Setup Notice
                    </h3>
                    <span className="rounded-full border border-[#050505] bg-[#050505] px-2 py-0.5 text-[10px] font-bold text-[#E9E7D8] uppercase">
                      Schema Initialization
                    </span>
                  </div>

                  <span className="font-mono text-[10px] text-[#050505]/60">
                    Checked: {schemaReport.checkedAt}
                  </span>
                </div>

                <p className="mt-2 text-xs text-[#050505]/80 leading-relaxed">
                  The backend connection to Supabase is active, but the following required community tables are not yet present in the schema cache:
                </p>

                {/* Missing tables list */}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {schemaReport.missingTables.map((tbl) => (
                    <span
                      key={tbl}
                      className="rounded-md border border-[#050505]/30 bg-[#E9E7D8] px-2 py-0.5 font-mono text-[11px] font-bold text-[#050505]"
                    >
                      public.{tbl}
                    </span>
                  ))}
                </div>

                <p className="mt-3 text-xs text-[#050505]/80 leading-relaxed">
                  A safe, repeatable migration file is available at{' '}
                  <code className="rounded bg-[#E9E7D8] px-1.5 py-0.5 font-mono text-[11px] border border-[#050505]/30">
                    supabase/migrations/20260401000000_student_social_feed.sql
                  </code>.
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShowMigrationGuide(!showMigrationGuide)}
                    className="inline-flex min-h-[36px] cursor-pointer items-center gap-1.5 rounded-full border border-[#050505] bg-[#F5F04A] px-4 text-xs font-bold uppercase tracking-wider text-[#050505] shadow-[2px_2px_0_#050505] hover:-translate-y-0.5 transition-transform"
                  >
                    <span>{showMigrationGuide ? 'Hide Instructions' : 'View Migration Instructions'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => loadPosts()}
                    disabled={isCheckingSchema}
                    className="inline-flex min-h-[36px] cursor-pointer items-center gap-1.5 rounded-full border border-[#050505] bg-white px-4 text-xs font-bold uppercase text-[#050505] shadow-[2px_2px_0_#050505] hover:bg-neutral-100 disabled:opacity-60"
                  >
                    <RefreshCw size={12} className={isCheckingSchema ? 'animate-spin' : ''} />
                    <span>{isCheckingSchema ? 'Checking Backend...' : 'Check Again'}</span>
                  </button>
                </div>

                {showMigrationGuide && (
                  <div className="mt-4 rounded-xl border border-dashed border-[#050505]/40 bg-[#E9E7D8]/60 p-4 text-xs text-[#050505]/90 space-y-2.5">
                    <p className="font-bold uppercase tracking-wider">
                      How to execute the migration in your Supabase Dashboard:
                    </p>
                    <ol className="list-decimal pl-5 space-y-1.5">
                      <li>
                        Log in to your{' '}
                        <a
                          href="https://supabase.com/dashboard"
                          target="_blank"
                          rel="noreferrer"
                          className="font-bold underline inline-flex items-center gap-0.5 text-[#050505]"
                        >
                          Supabase Dashboard <ExternalLink size={10} />
                        </a>{' '}
                        and select your HackhIt project.
                      </li>
                      <li>
                        Click on <strong>SQL Editor</strong> in the left sidebar.
                      </li>
                      <li>
                        Click <strong>New query</strong>.
                      </li>
                      <li>
                        Open the file <code className="rounded bg-white px-1 font-mono">supabase/migrations/20260401000000_student_social_feed.sql</code> in your editor, copy the entire SQL script, and paste it into the query window.
                      </li>
                      <li>
                        Click <strong>Run</strong> (or press Ctrl+Enter). The script creates the tables, foreign keys, triggers, storage bucket, and strict Row-Level Security policies safely.
                      </li>
                      <li>
                        Return to this page and click <strong>Check Again</strong> above. The feed will activate immediately.
                      </li>
                    </ol>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* 2. Network Inaccessible Banner (specifically when network or host is unreachable) */}
        {schemaReport?.state === 'inaccessible' && (
          <section className="rounded-[24px] border-[2px] border-red-700 bg-red-50 p-6 text-red-950 shadow-[5px_5px_0_#050505]">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-red-700 bg-red-200 text-red-900">
                <WifiOff size={18} />
              </span>
              <div className="flex-1">
                <h3 className="font-extrabold text-sm uppercase tracking-wide">
                  Backend Service Inaccessible
                </h3>
                <p className="mt-1 text-xs text-red-900/80 leading-relaxed">
                  {schemaReport.message}
                </p>
                {schemaReport.details && (
                  <p className="mt-1 text-[11px] font-mono text-red-800">
                    {schemaReport.details}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => loadPosts()}
                  disabled={isCheckingSchema}
                  className="mt-3 inline-flex min-h-[34px] cursor-pointer items-center gap-1.5 rounded-full border border-red-900 bg-white px-4 text-xs font-bold uppercase text-red-950 shadow hover:bg-neutral-100"
                >
                  <RefreshCw size={12} className={isCheckingSchema ? 'animate-spin' : ''} />
                  <span>Retry Connection</span>
                </button>
              </div>
            </div>
          </section>
        )}

        {/* 3. Unauthorized API Key Banner */}
        {schemaReport?.state === 'unauthorized' && (
          <section className="rounded-[24px] border-[2px] border-amber-800 bg-amber-50 p-6 text-amber-950 shadow-[5px_5px_0_#050505]">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-amber-800 bg-amber-200 text-amber-950">
                <ShieldAlert size={18} />
              </span>
              <div className="flex-1">
                <h3 className="font-extrabold text-sm uppercase tracking-wide">
                  Backend Authentication Error (HTTP 401)
                </h3>
                <p className="mt-1 text-xs text-amber-900/80 leading-relaxed">
                  {schemaReport.message}
                </p>
                {schemaReport.details && (
                  <p className="mt-1 text-[11px] font-mono text-amber-850">
                    {schemaReport.details}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => loadPosts()}
                  disabled={isCheckingSchema}
                  className="mt-3 inline-flex min-h-[34px] cursor-pointer items-center gap-1.5 rounded-full border border-amber-900 bg-white px-4 text-xs font-bold uppercase text-amber-950 shadow hover:bg-neutral-100"
                >
                  <RefreshCw size={12} className={isCheckingSchema ? 'animate-spin' : ''} />
                  <span>Recheck Credentials</span>
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Create Post Composer (when student is logged in and schema is not in failed/uninitialized state) */}
        {session && currentUserId && schemaReport?.state !== 'uninitialized' && schemaReport?.state !== 'inaccessible' && schemaReport?.state !== 'unauthorized' && (
          <section className="reveal reveal-delay-1">
            <CreatePostComposer
              currentUserId={currentUserId}
              currentUserProfile={userProfile}
              onPostCreated={handlePostCreated}
              initialDraft={initialDraft}
            />
          </section>
        )}

        {/* Not Logged In Callout */}
        {!session && (
          <section className="rounded-[24px] border-[2px] border-[#050505] bg-[#fffef8] p-6 text-center shadow-[4px_4px_0_#050505]">
            <h3 className="font-extrabold text-sm uppercase tracking-wider text-[#050505]">
              Join the HackhIt Student Community
            </h3>
            <p className="mt-1 text-xs text-[#050505]/70 max-w-md mx-auto">
              Sign in with your registered campus account to publish posts, share build logs,
              like updates, and reply to fellow students.
            </p>
            <div className="mt-4 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => onNavigateToLogin('community')}
                className="inline-flex min-h-[38px] cursor-pointer items-center gap-2 rounded-full border border-[#050505] bg-[#F5F04A] px-5 text-xs font-extrabold uppercase tracking-wider text-[#050505] shadow-[2px_2px_0_#050505] hover:-translate-y-0.5 transition-transform"
              >
                Sign In <ArrowRight size={13} />
              </button>
              <button
                type="button"
                onClick={onNavigateToSignup}
                className="inline-flex min-h-[38px] cursor-pointer items-center gap-2 rounded-full border border-[#050505] bg-white px-5 text-xs font-bold uppercase tracking-wider text-[#050505] shadow-[2px_2px_0_#050505] hover:bg-neutral-100"
              >
                Create Account
              </button>
            </div>
          </section>
        )}

        {/* Posts Feed List */}
        <section className="space-y-4" aria-label="Campus feed posts">
          {isLoading ? (
            <div className="space-y-4" role="status" aria-label="Loading campus feed">
              {[1, 2].map((idx) => (
                <div
                  key={idx}
                  className="rounded-[24px] border-[2px] border-[#050505] bg-[#fffef8] p-5 sm:p-6 shadow-[4px_4px_0_#050505] animate-pulse space-y-4"
                >
                  <div className="flex items-center gap-3 border-b border-[#050505]/10 pb-3.5">
                    <div className="h-11 w-11 rounded-full border border-[#050505] bg-[#E9E7D8]" />
                    <div className="space-y-1.5 flex-1">
                      <div className="h-3.5 w-32 bg-[#050505]/20 rounded-md" />
                      <div className="h-2.5 w-20 bg-[#050505]/10 rounded-md" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="h-3 w-full bg-[#050505]/15 rounded-md" />
                    <div className="h-3 w-4/5 bg-[#050505]/10 rounded-md" />
                  </div>
                  <div className="flex items-center gap-2 pt-2 border-t border-[#050505]/10">
                    <div className="h-7 w-16 rounded-full border border-[#050505]/30 bg-[#E9E7D8]/60" />
                    <div className="h-7 w-16 rounded-full border border-[#050505]/30 bg-[#E9E7D8]/60" />
                  </div>
                </div>
              ))}
              <div className="text-center py-2">
                <p className="text-xs font-bold uppercase tracking-wider text-[#050505]/70">
                  Loading campus feed...
                </p>
              </div>
            </div>
          ) : errorMessage ? (
            <div className="rounded-[24px] border-[2px] border-[#050505] bg-[#fffef8] p-8 sm:p-10 text-center shadow-[4px_4px_0_#050505]">
              <span className="grid h-12 w-12 mx-auto place-items-center rounded-full border border-[#050505] bg-[#F5F04A] text-[#050505]">
                <AlertCircle size={22} />
              </span>
              <h3 className="mt-3 font-extrabold text-sm uppercase tracking-wide text-[#050505]">
                Unable to Load Campus Posts
              </h3>
              <p className="mt-1.5 text-xs text-[#050505]/75 max-w-sm mx-auto leading-relaxed">
                {errorMessage}
              </p>
              <div className="mt-5">
                <button
                  type="button"
                  onClick={() => loadPosts(false)}
                  className="inline-flex min-h-[38px] cursor-pointer items-center gap-2 rounded-full border border-[#050505] bg-[#F5F04A] px-5 text-xs font-extrabold uppercase tracking-wider text-[#050505] shadow-[2px_2px_0_#050505] hover:-translate-y-0.5 transition-transform"
                >
                  <RefreshCw size={13} />
                  <span>Retry Loading Feed</span>
                </button>
              </div>
            </div>
          ) : filteredPosts.length === 0 ? (
            <div className="rounded-[24px] border-[2px] border-[#050505] bg-[#fffef8] p-10 text-center shadow-[4px_4px_0_#050505]">
              <span className="grid h-12 w-12 mx-auto place-items-center rounded-full border border-[#050505] bg-[#F5F04A] text-[#050505]">
                {effectiveFilter === 'mine' ? <User size={20} /> : <MessageSquare size={20} />}
              </span>
              <h3 className="mt-3 font-extrabold text-sm uppercase tracking-wide text-[#050505]">
                {effectiveFilter === 'mine'
                  ? "You haven't posted anything yet"
                  : 'No posts in the campus feed yet'}
              </h3>
              <p className="mt-1.5 text-xs text-[#050505]/70 max-w-sm mx-auto leading-relaxed">
                {effectiveFilter === 'mine'
                  ? 'Your published updates, build logs, and project announcements will appear here.'
                  : 'Be the first student to publish an update, share a project milestone, or find hackathon teammates!'}
              </p>
              {effectiveFilter === 'mine' && (
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => setActiveFilter('all')}
                    className="inline-flex min-h-[36px] cursor-pointer items-center gap-1.5 rounded-full border border-[#050505] bg-white px-4 text-xs font-bold uppercase text-[#050505] shadow-[2px_2px_0_#050505] hover:bg-[#F5F04A] transition-all"
                  >
                    <span>View All Campus Posts</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            filteredPosts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                currentUserId={currentUserId}
                onPostDeleted={handlePostDeleted}
                onAuthorClick={handleOpenAuthorProfile}
                onRequestSignIn={() => onNavigateToLogin('community')}
              />
            ))
          )}
        </section>
      </main>

      {/* Student Profile Modal */}
      {selectedProfileUserId && (
        <StudentProfileModal
          userId={selectedProfileUserId}
          currentUserId={currentUserId}
          isOpen={isProfileModalOpen}
          onClose={() => {
            setIsProfileModalOpen(false)
            setSelectedProfileUserId(null)
          }}
          onProfileUpdated={(updated) => {
            if (updated.id === currentUserId) {
              setUserProfile(updated)
            }
            // Update author metadata across existing posts in memory
            setPosts((prev) =>
              prev.map((p) =>
                p.user_id === updated.id
                  ? { ...p, profile: updated }
                  : p
              )
            )
          }}
        />
      )}
    </div>
  )
}
