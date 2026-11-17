/**
 * HackhIt — Dedicated Full-Page Student Profile Component
 *
 * Full-page route for viewing and editing student campus profiles.
 * - Occupies the full available browser viewport in the HackhIt editorial layout.
 * - Full direct URL navigation and refresh persistence (#profile, #profile/:id).
 * - Preserves viewing, inline editing, avatar upload/management, and registrations summary.
 * - Matches the HackhIt visual identity: Ivory (#E9E7D8), Ink Black (#050505), Lemon Yellow (#F5F04A).
 */

import { useState, useEffect, useCallback, useRef, type ChangeEvent, type FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import {
  User,
  GraduationCap,
  Sparkles,
  BookOpen,
  Edit3,
  Check,
  Loader2,
  Calendar,
  AlertCircle,
  Upload,
  Trash2,
  MessageSquare,
  Ticket,
  ArrowRight,
  ExternalLink,
  RefreshCw,
  Heart,
  MessageCircle,
  Crop,
} from 'lucide-react'
import { TopNav } from './TopNav'
import { ImageCropModal } from './ImageCropModal'
import type { Profile, Post } from '../lib/community'
import {
  fetchProfileWithPosts,
  updateProfile,
  uploadAvatar,
  normalizeUuid,
} from '../lib/community'
import { fetchMyRegistrations } from '../lib/hackathons'
import type { UserRegistrationItem } from '../types/hackathons'

export interface StudentProfilePageProps {
  userId?: string | null
  session?: Session | null
  onNavigateToHome: () => void
  onNavigateToCommunity: () => void
  onNavigateToHackathons: () => void
  onNavigateToMyRegistrations: () => void
  onNavigateToProfile: (id?: string) => void
  onNavigateToLogin: () => void
  onNavigateToSignup: () => void
  onSignOut?: () => void
}

export function StudentProfilePage({
  userId,
  session,
  onNavigateToHome,
  onNavigateToCommunity,
  onNavigateToHackathons,
  onNavigateToMyRegistrations,
  onNavigateToProfile,
  onNavigateToLogin,
  onNavigateToSignup,
  onSignOut,
}: StudentProfilePageProps) {
  // Normalize and validate target identifier and authenticated session user ID
  const rawTarget = typeof userId === 'string' ? userId.trim() : userId ? String(userId) : ''
  const validatedTargetUuid = normalizeUuid(userId)
  const currentUserId = normalizeUuid(session?.user?.id)

  // Explicitly identify if a supplied identifier was malformed/invalid
  const isMalformedId = Boolean(rawTarget && !validatedTargetUuid)

  // Determine target user ID (validated target UUID or fallback to authenticated session UUID)
  const effectiveUserId = isMalformedId
    ? null
    : validatedTargetUuid || currentUserId || null

  const isOwnProfile = Boolean(currentUserId && effectiveUserId && currentUserId === effectiveUserId)

  // Profile data states
  const [profile, setProfile] = useState<Profile | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [registrations, setRegistrations] = useState<UserRegistrationItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [avatarError, setAvatarError] = useState(false)

  // Inline edit states
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const isSavingRef = useRef(false)
  const [editFullName, setEditFullName] = useState('')
  const [editUniversity, setEditUniversity] = useState('')
  const [editBio, setEditBio] = useState('')
  const [editSkills, setEditSkills] = useState('')
  const [editInterests, setEditInterests] = useState('')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [removeAvatar, setRemoveAvatar] = useState(false)
  const [cropperOpen, setCropperOpen] = useState(false)
  const [rawImageSrc, setRawImageSrc] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadProfile = useCallback(async (isManualRefresh = false) => {
    // If an invalid target identifier was provided, do not issue malformed SQL queries
    if (isMalformedId) {
      setIsLoading(false)
      setIsRefreshing(false)
      setError('Invalid student profile identifier. The specified profile does not exist.')
      return
    }

    if (!effectiveUserId) {
      setIsLoading(false)
      setIsRefreshing(false)
      return
    }

    if (isManualRefresh) {
      setIsRefreshing(true)
    } else {
      setIsLoading(true)
    }
    setError(null)
    setSuccessMessage(null)

    try {
      const { profile: p, posts: pts, error: err } = await fetchProfileWithPosts(
        effectiveUserId,
        currentUserId || undefined
      )

      if (err) {
        setError(err)
      } else if (p) {
        setProfile(p)
        setPosts(pts)
        setEditFullName(p.full_name || '')
        setEditUniversity(p.university || '')
        setEditBio(p.bio || '')
        setEditSkills((p.skills || []).join(', '))
        setEditInterests((p.interests || []).join(', '))
      }

      // If viewing own profile, also load registrations summary
      if (isOwnProfile) {
        try {
          const regResult = await fetchMyRegistrations()
          if (!regResult.error) {
            setRegistrations(regResult.registrations)
          }
        } catch {
          // Non-critical background failure
        }
      }
    } catch (fetchErr) {
      setError(fetchErr instanceof Error ? fetchErr.message : 'Failed to load profile.')
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [effectiveUserId, currentUserId, isOwnProfile, isMalformedId])

  useEffect(() => {
    loadProfile()
  }, [loadProfile])

  const handleStartEdit = () => {
    if (!profile) return
    setIsEditing(true)
    setError(null)
    setSuccessMessage(null)
    setEditFullName(profile.full_name || '')
    setEditUniversity(profile.university || '')
    setEditBio(profile.bio || '')
    setEditSkills((profile.skills || []).join(', '))
    setEditInterests((profile.interests || []).join(', '))
    setAvatarFile(null)
    setAvatarPreview(null)
    setRemoveAvatar(false)
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setError(null)
    setRemoveAvatar(false)
    if (avatarPreview) {
      URL.revokeObjectURL(avatarPreview)
      setAvatarPreview(null)
    }
    if (rawImageSrc) {
      URL.revokeObjectURL(rawImageSrc)
      setRawImageSrc(null)
    }
    setAvatarFile(null)
    setCropperOpen(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleAvatarChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const allowedMimeTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'image/gif',
    ]

    if (!file.type || !allowedMimeTypes.includes(file.type.toLowerCase())) {
      setError('Please select a valid image file (JPG, PNG, WebP, GIF).')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('Image must be under 10MB.')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    if (rawImageSrc) {
      URL.revokeObjectURL(rawImageSrc)
    }

    // Generate object URL and open the 1:1 cropper modal
    const objectUrl = URL.createObjectURL(file)
    setRawImageSrc(objectUrl)
    setCropperOpen(true)
    setError(null)

    // Reset input so re-picking same file triggers onChange
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleCropComplete = (croppedFile: File, previewUrl: string) => {
    if (avatarPreview) {
      URL.revokeObjectURL(avatarPreview)
    }
    setAvatarFile(croppedFile)
    setAvatarPreview(previewUrl)
    setRemoveAvatar(false)
    setAvatarError(false)
    setCropperOpen(false)
    setError(null)
  }

  const handleCropCancel = () => {
    setCropperOpen(false)
    if (rawImageSrc) {
      URL.revokeObjectURL(rawImageSrc)
      setRawImageSrc(null)
    }
  }

  const handleAdjustCurrentAvatar = () => {
    const srcToCrop = avatarPreview || profile?.avatar_url
    if (!srcToCrop) return
    setRawImageSrc(srcToCrop)
    setCropperOpen(true)
  }

  const handleRemoveAvatar = () => {
    if (avatarPreview) {
      URL.revokeObjectURL(avatarPreview)
      setAvatarPreview(null)
    }
    if (rawImageSrc) {
      URL.revokeObjectURL(rawImageSrc)
      setRawImageSrc(null)
    }
    setAvatarFile(null)
    setRemoveAvatar(true)
    setCropperOpen(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    setError(null)
  }

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault()
    if (!profile || isSaving || isSavingRef.current) return

    const trimmedName = editFullName.trim()
    if (!trimmedName) {
      setError('Full name is required.')
      return
    }
    if (trimmedName.length > 100) {
      setError('Full name cannot exceed 100 characters.')
      return
    }

    if (editBio.trim().length > 500) {
      setError('Bio cannot exceed 500 characters.')
      return
    }

    if (editUniversity.trim().length > 120) {
      setError('University name cannot exceed 120 characters.')
      return
    }

    isSavingRef.current = true
    setIsSaving(true)
    setError(null)
    setSuccessMessage(null)

    try {
      let finalAvatarUrl = profile.avatar_url

      if (removeAvatar) {
        finalAvatarUrl = null
      } else if (avatarFile) {
        const { url: uploadedUrl, error: uploadErr } = await uploadAvatar(avatarFile)
        if (uploadErr) {
          setError(`Avatar upload failed: ${uploadErr}`)
          isSavingRef.current = false
          setIsSaving(false)
          return
        }
        finalAvatarUrl = uploadedUrl
      }

      const parsedSkills = editSkills
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
        .slice(0, 15)

      const parsedInterests = editInterests
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
        .slice(0, 15)

      const { profile: updated, error: updateErr } = await updateProfile(profile.id, {
        full_name: trimmedName,
        avatar_url: finalAvatarUrl,
        university: editUniversity.trim() || null,
        bio: editBio.trim() || null,
        skills: parsedSkills,
        interests: parsedInterests,
      })

      if (updateErr) {
        setError(updateErr)
      } else if (updated) {
        setProfile(updated)
        setSuccessMessage('Profile updated successfully!')
        setIsEditing(false)
        setAvatarFile(null)
        setAvatarPreview(null)
        setRemoveAvatar(false)
      }
    } catch (saveErr) {
      setError(saveErr instanceof Error ? saveErr.message : 'Failed to save profile.')
    } finally {
      isSavingRef.current = false
      setIsSaving(false)
    }
  }

  return (
    <div className="site-shell min-h-screen bg-[#E9E7D8] text-[#050505] flex flex-col w-full">
      <TopNav
        currentView="profile"
        session={session}
        userDisplayName={profile?.full_name}
        onNavigateToHome={onNavigateToHome}
        onNavigateToCommunity={onNavigateToCommunity}
        onNavigateToHackathons={onNavigateToHackathons}
        onNavigateToMyRegistrations={onNavigateToMyRegistrations}
        onNavigateToProfile={onNavigateToProfile}
        onNavigateToLogin={onNavigateToLogin}
        onNavigateToSignup={onNavigateToSignup}
        onSignOut={onSignOut}
      />

      <main className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 flex-1">
        {/* 1. UNAUTHENTICATED GUARD (when no session and trying to view own profile) */}
        {!session && !rawTarget && (
          <div className="rounded-[28px] border-[2.5px] border-[#050505] bg-white p-8 sm:p-14 text-center shadow-[6px_6px_0_#050505] space-y-6">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border-[2px] border-[#050505] bg-[#F5F04A] shadow-[3px_3px_0_#050505]">
              <User size={32} className="text-[#050505]" />
            </div>

            <div className="space-y-2 max-w-lg mx-auto">
              <h1 className="display-font text-3xl sm:text-5xl uppercase text-[#050505]">
                Student Sign In Required
              </h1>
              <p className="text-xs sm:text-sm text-[#050505]/75 leading-relaxed">
                Your campus profile is securely connected to your student account. Sign in to view and customize your bio, skills, portfolio, and hackathon passes.
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

        {/* 2. LOADING SKELETON */}
        {isLoading && !isRefreshing && (
          <div className="space-y-6 animate-pulse">
            <div className="rounded-[28px] border-[2.5px] border-[#050505] bg-white p-8 shadow-[6px_6px_0_#050505] space-y-6">
              <div className="flex items-center gap-5">
                <div className="h-24 w-24 rounded-2xl bg-stone-200 border-2 border-[#050505]/20" />
                <div className="space-y-3 flex-1">
                  <div className="h-8 w-64 bg-stone-200 rounded-lg" />
                  <div className="h-5 w-40 bg-stone-200 rounded-lg" />
                </div>
              </div>
              <div className="h-16 bg-stone-100 rounded-xl border border-stone-200" />
            </div>
            <div className="h-48 rounded-[24px] border-[2px] border-[#050505] bg-white shadow-[4px_4px_0_#050505]" />
          </div>
        )}

        {/* 3. INVALID IDENTIFIER / NOT FOUND FRIENDLY STATE */}
        {!isLoading && (isMalformedId || (!profile && Boolean(rawTarget || session))) && (
          <div className="rounded-[28px] border-[2.5px] border-[#050505] bg-white p-8 sm:p-14 text-center shadow-[6px_6px_0_#050505] space-y-6">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border-[2px] border-[#050505] bg-[#F5F04A] shadow-[3px_3px_0_#050505]">
              <AlertCircle size={32} className="text-[#050505]" />
            </div>

            <div className="space-y-2 max-w-lg mx-auto">
              <h1 className="display-font text-3xl sm:text-5xl uppercase text-[#050505]">
                Student Profile Not Found
              </h1>
              <p className="text-xs sm:text-sm text-[#050505]/75 leading-relaxed">
                {isMalformedId
                  ? 'The provided student profile link or identifier is invalid. Please verify the URL or explore students in the campus community.'
                  : error || 'We could not find the requested student profile on HackhIt.'}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={onNavigateToCommunity}
                className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full border-[2px] border-[#050505] bg-[#F5F04A] px-6 text-xs font-black uppercase tracking-wider text-[#050505] shadow-[3px_3px_0_#050505] hover:bg-white transition-colors"
              >
                <span>Explore Community</span>
                <ArrowRight size={14} />
              </button>
              {session && (
                <button
                  type="button"
                  onClick={() => onNavigateToProfile()}
                  className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full border-[2px] border-[#050505] bg-white px-6 text-xs font-bold uppercase tracking-wider text-[#050505] shadow-[2px_2px_0_#050505] hover:bg-[#E9E7D8] transition-colors"
                >
                  <User size={14} />
                  <span>View My Profile</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* 4. ERROR BANNER (FOR MUTATION/REFRESH FAILURES ONCE PROFILE IS LOADED) */}
        {error && !isLoading && profile && !isMalformedId && (
          <div
            role="alert"
            className="mb-6 rounded-[24px] border-[2.5px] border-red-600 bg-red-50 p-6 sm:p-8 text-center shadow-[5px_5px_0_#dc2626] space-y-4"
          >
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border-2 border-red-600 bg-white text-red-600 shadow-[2px_2px_0_#dc2626]">
              <AlertCircle size={24} />
            </div>
            <div className="space-y-1 max-w-lg mx-auto">
              <h2 className="display-font text-xl sm:text-2xl uppercase text-red-900">
                Notice
              </h2>
              <p className="text-xs sm:text-sm text-red-800">{error}</p>
            </div>
            <button
              type="button"
              onClick={() => loadProfile(true)}
              className="inline-flex min-h-[40px] cursor-pointer items-center gap-2 rounded-full border-2 border-red-900 bg-red-900 px-5 text-xs font-bold uppercase tracking-wider text-white shadow-[2px_2px_0_#000] hover:bg-red-800 transition-colors"
            >
              <RefreshCw size={13} />
              <span>Retry</span>
            </button>
          </div>
        )}

        {/* 4. SUCCESS BANNER */}
        {successMessage && (
          <div
            role="status"
            className="mb-6 rounded-2xl border-[2px] border-emerald-800 bg-emerald-50 p-4 text-xs font-bold text-emerald-900 shadow-[3px_3px_0_#065f46] flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-2">
              <Check size={16} className="text-emerald-800 shrink-0" />
              <span>{successMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setSuccessMessage(null)}
              className="text-emerald-800 hover:underline cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* 5. MAIN PROFILE CARD (VIEW MODE & EDIT MODE) */}
        {!isLoading && profile && (
          <div className="space-y-8">
            {/* Header Hero Card */}
            <article className="rounded-[28px] border-[2.5px] border-[#050505] bg-[#fffef8] p-6 sm:p-10 shadow-[6px_6px_0_#050505]">
              {/* Badge & Quick Action Row */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#050505]/15 pb-5">
                <div className="inline-flex items-center gap-1.5 rounded-full border border-[#050505] bg-[#F5F04A] px-3.5 py-1 text-[11px] font-extrabold uppercase tracking-wider text-[#050505]">
                  <Sparkles size={12} />
                  <span>Campus Student Profile</span>
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => loadProfile(true)}
                    disabled={isRefreshing}
                    className="grid h-9 w-9 place-items-center rounded-xl border border-[#050505] bg-white text-[#050505] shadow-[1.5px_1.5px_0_#050505] hover:bg-[#F5F04A] transition-colors disabled:opacity-50 cursor-pointer"
                    title="Refresh Profile"
                    aria-label="Refresh Profile"
                  >
                    <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
                  </button>

                  {isOwnProfile && !isEditing && (
                    <button
                      type="button"
                      onClick={handleStartEdit}
                      className="inline-flex min-h-[38px] cursor-pointer items-center gap-1.5 rounded-full border-[2px] border-[#050505] bg-[#F5F04A] px-4 text-xs font-black uppercase tracking-wider text-[#050505] shadow-[2px_2px_0_#050505] hover:bg-white hover:-translate-y-0.5 transition-all"
                    >
                      <Edit3 size={13} />
                      <span>Edit Profile</span>
                    </button>
                  )}
                </div>
              </div>

              {/* INLINE EDIT MODE FORM */}
              {isEditing ? (
                <form onSubmit={handleSaveProfile} className="mt-6 space-y-6">
                  <div className="border-b border-[#050505]/10 pb-4">
                    <h2 className="display-font text-2xl sm:text-3xl uppercase text-[#050505]">
                      Edit Your Student Profile
                    </h2>
                    <p className="mt-1 text-xs text-[#050505]/70">
                      Update your campus identity, avatar, institution, and project interests.
                    </p>
                  </div>

                  {/* Photo Avatar Section */}
                  <div className="rounded-2xl border border-[#050505]/20 bg-white p-5 space-y-3">
                    <label className="block text-xs font-black uppercase tracking-wider text-[#050505]">
                      Profile Photo
                    </label>

                    <div className="flex flex-wrap items-center gap-5">
                      <div className="relative grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-2xl border-2 border-[#050505] bg-[#E9E7D8] shadow-[2px_2px_0_#050505]">
                        {avatarPreview ? (
                          <img
                            src={avatarPreview}
                            alt="Avatar preview"
                            className="h-full w-full object-cover"
                          />
                        ) : !removeAvatar && profile.avatar_url && !avatarError ? (
                          <img
                            src={profile.avatar_url}
                            alt={profile.full_name}
                            onError={() => setAvatarError(true)}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <User size={32} className="text-[#050505]/60" />
                        )}
                      </div>

                      <div className="space-y-2">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif"
                          onChange={handleAvatarChange}
                          className="hidden"
                          id="avatar-upload-input"
                        />
                        <div className="flex flex-wrap items-center gap-2">
                          <label
                            htmlFor="avatar-upload-input"
                            className="inline-flex min-h-[36px] cursor-pointer items-center gap-1.5 rounded-full border border-[#050505] bg-white px-3.5 text-xs font-bold uppercase tracking-wider text-[#050505] shadow-[1.5px_1.5px_0_#050505] hover:bg-[#F5F04A] transition-colors"
                          >
                            <Upload size={12} />
                            <span>Upload New Photo</span>
                          </label>

                          {(avatarPreview || (!removeAvatar && profile.avatar_url)) && (
                            <>
                              <button
                                type="button"
                                onClick={handleAdjustCurrentAvatar}
                                className="inline-flex min-h-[36px] cursor-pointer items-center gap-1.5 rounded-full border border-[#050505] bg-[#E9E7D8] px-3.5 text-xs font-bold uppercase tracking-wider text-[#050505] shadow-[1.5px_1.5px_0_#050505] hover:bg-[#F5F04A] transition-colors"
                              >
                                <Crop size={12} />
                                <span>Adjust Crop 1:1</span>
                              </button>

                              <button
                                type="button"
                                onClick={handleRemoveAvatar}
                                className="inline-flex min-h-[36px] cursor-pointer items-center gap-1.5 rounded-full border border-red-300 bg-red-50 px-3 text-xs font-bold text-red-700 hover:bg-red-100 transition-colors"
                              >
                                <Trash2 size={12} />
                                <span>Remove</span>
                              </button>
                            </>
                          )}
                        </div>
                        <p className="text-[11px] text-[#050505]/60">
                          Supports JPG, PNG, WebP up to 10MB. Automatically framed to 1:1 ratio.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Text Inputs */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-black uppercase tracking-wider text-[#050505] mb-1.5">
                        Full Name <span className="text-red-600">*</span>
                      </label>
                      <input
                        type="text"
                        value={editFullName}
                        onChange={(e) => setEditFullName(e.target.value)}
                        maxLength={100}
                        required
                        className="w-full rounded-xl border-2 border-[#050505] bg-white px-3.5 py-2.5 text-sm font-semibold text-[#050505] shadow-[2px_2px_0_#050505] focus:outline-none focus:ring-2 focus:ring-[#F5F04A]"
                        placeholder="e.g. Alex Chen"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-black uppercase tracking-wider text-[#050505] mb-1.5">
                        University / Institution
                      </label>
                      <input
                        type="text"
                        value={editUniversity}
                        onChange={(e) => setEditUniversity(e.target.value)}
                        maxLength={120}
                        className="w-full rounded-xl border-2 border-[#050505] bg-white px-3.5 py-2.5 text-sm font-semibold text-[#050505] shadow-[2px_2px_0_#050505] focus:outline-none focus:ring-2 focus:ring-[#F5F04A]"
                        placeholder="e.g. Stanford University"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-black uppercase tracking-wider text-[#050505]">
                        Bio
                      </label>
                      <span className="text-[11px] font-mono text-[#050505]/60">
                        {editBio.length} / 500
                      </span>
                    </div>
                    <textarea
                      value={editBio}
                      onChange={(e) => setEditBio(e.target.value)}
                      maxLength={500}
                      rows={3}
                      className="w-full rounded-xl border-2 border-[#050505] bg-white px-3.5 py-2.5 text-sm font-medium text-[#050505] shadow-[2px_2px_0_#050505] focus:outline-none focus:ring-2 focus:ring-[#F5F04A]"
                      placeholder="Share your interests, engineering passion, and campus background..."
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-black uppercase tracking-wider text-[#050505] mb-1.5">
                        Skills (comma-separated)
                      </label>
                      <input
                        type="text"
                        value={editSkills}
                        onChange={(e) => setEditSkills(e.target.value)}
                        className="w-full rounded-xl border-2 border-[#050505] bg-white px-3.5 py-2.5 text-sm font-medium text-[#050505] shadow-[2px_2px_0_#050505] focus:outline-none focus:ring-2 focus:ring-[#F5F04A]"
                        placeholder="e.g. React, Python, PyTorch, Figma"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-black uppercase tracking-wider text-[#050505] mb-1.5">
                        Interests (comma-separated)
                      </label>
                      <input
                        type="text"
                        value={editInterests}
                        onChange={(e) => setEditInterests(e.target.value)}
                        className="w-full rounded-xl border-2 border-[#050505] bg-white px-3.5 py-2.5 text-sm font-medium text-[#050505] shadow-[2px_2px_0_#050505] focus:outline-none focus:ring-2 focus:ring-[#F5F04A]"
                        placeholder="e.g. Generative AI, Web3, Climate Tech"
                      />
                    </div>
                  </div>

                  {/* Form Action Buttons */}
                  <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-[#050505]/15">
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      disabled={isSaving}
                      className="inline-flex min-h-[42px] cursor-pointer items-center gap-1.5 rounded-full border border-[#050505] bg-white px-5 text-xs font-bold uppercase tracking-wider text-[#050505] hover:bg-[#E9E7D8] transition-colors disabled:opacity-50"
                    >
                      <span>Cancel</span>
                    </button>

                    <button
                      type="submit"
                      disabled={isSaving}
                      className="inline-flex min-h-[42px] cursor-pointer items-center gap-2 rounded-full border-[2px] border-[#050505] bg-[#F5F04A] px-7 text-xs font-black uppercase tracking-wider text-[#050505] shadow-[3px_3px_0_#050505] hover:bg-white hover:-translate-y-0.5 transition-all disabled:opacity-50"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          <span>Saving Profile...</span>
                        </>
                      ) : (
                        <>
                          <Check size={14} />
                          <span>Save Changes</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              ) : (
                /* VIEW MODE PROFILE DISPLAY */
                <div className="mt-6 space-y-6">
                  {/* Avatar & Title Row */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-6">
                    <div className="relative grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-[22px] border-[2.5px] border-[#050505] bg-[#F5F04A] shadow-[4px_4px_0_#050505]">
                      {profile.avatar_url && !avatarError ? (
                        <img
                          src={profile.avatar_url}
                          alt={profile.full_name}
                          onError={() => setAvatarError(true)}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <User size={44} className="text-[#050505]" />
                      )}
                    </div>

                    <div className="space-y-1.5 flex-1">
                      <h1 className="display-font text-3xl sm:text-5xl uppercase text-[#050505] leading-none">
                        {profile.full_name}
                      </h1>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-[#050505]/75 pt-1">
                        {profile.university ? (
                          <span className="inline-flex items-center gap-1.5 font-bold text-[#050505]">
                            <GraduationCap size={15} />
                            <span>{profile.university}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-[#050505]/60 italic">
                            <GraduationCap size={15} />
                            <span>Campus Student</span>
                          </span>
                        )}

                        <span className="text-[#050505]/40">•</span>

                        <span className="inline-flex items-center gap-1 text-[11px] text-[#050505]/65">
                          <Calendar size={13} />
                          <span>
                            Member since {new Date(profile.created_at).toLocaleDateString(undefined, {
                              month: 'short',
                              year: 'numeric',
                            })}
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Bio */}
                  {profile.bio && (
                    <div className="rounded-2xl border border-[#050505]/15 bg-white p-5 shadow-[2px_2px_0_#050505]">
                      <span className="block text-[10px] font-black uppercase text-[#050505]/50 mb-1">
                        About
                      </span>
                      <p className="text-xs sm:text-sm text-[#050505]/85 leading-relaxed whitespace-pre-wrap">
                        {profile.bio}
                      </p>
                    </div>
                  )}

                  {/* Skills & Interests Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Skills */}
                    <div className="rounded-2xl border border-[#050505]/15 bg-white p-5 space-y-2.5 shadow-[2px_2px_0_#050505]">
                      <div className="flex items-center gap-2 text-xs font-black uppercase text-[#050505]">
                        <BookOpen size={14} />
                        <span>Skills & Technologies</span>
                      </div>
                      {profile.skills && profile.skills.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {profile.skills.map((skill, idx) => (
                            <span
                              key={idx}
                              className="rounded-full border border-[#050505] bg-[#F5F04A] px-3 py-0.5 text-xs font-bold text-[#050505] shadow-[1px_1px_0_#050505]"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-[#050505]/50 italic">
                          No skills listed yet.
                        </p>
                      )}
                    </div>

                    {/* Interests */}
                    <div className="rounded-2xl border border-[#050505]/15 bg-white p-5 space-y-2.5 shadow-[2px_2px_0_#050505]">
                      <div className="flex items-center gap-2 text-xs font-black uppercase text-[#050505]">
                        <Sparkles size={14} />
                        <span>Interests & Domains</span>
                      </div>
                      {profile.interests && profile.interests.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {profile.interests.map((interest, idx) => (
                            <span
                              key={idx}
                              className="rounded-full border border-[#050505]/30 bg-[#E9E7D8] px-3 py-0.5 text-xs font-semibold text-[#050505]"
                            >
                              {interest}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-[#050505]/50 italic">
                          No interests specified yet.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </article>

            {/* 6. HACKATHON REGISTRATIONS SUMMARY (when viewing own profile) */}
            {isOwnProfile && (
              <section className="rounded-[28px] border-[2.5px] border-[#050505] bg-white p-6 sm:p-8 shadow-[5px_5px_0_#050505] space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#050505]/15 pb-4">
                  <div className="flex items-center gap-2 text-sm font-black uppercase text-[#050505]">
                    <Ticket size={16} />
                    <span>My Hackathon Registrations ({registrations.length})</span>
                  </div>

                  <button
                    type="button"
                    onClick={onNavigateToMyRegistrations}
                    className="inline-flex min-h-[36px] cursor-pointer items-center gap-1.5 rounded-full border border-[#050505] bg-[#F5F04A] px-4 text-xs font-bold uppercase tracking-wider text-[#050505] shadow-[1.5px_1.5px_0_#050505] hover:bg-white transition-colors"
                  >
                    <span>View All Passes</span>
                    <ArrowRight size={13} />
                  </button>
                </div>

                {registrations.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
                    {registrations.slice(0, 4).map((reg) => (
                      <div
                        key={reg.id}
                        className="rounded-2xl border border-[#050505]/20 bg-[#fffef8] p-4 text-xs space-y-2 shadow-[2px_2px_0_#050505]"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-black text-[#050505] truncate">
                            {reg.hackathon?.title || 'Hackathon Event'}
                          </span>
                          <span className="rounded-full border border-emerald-800 bg-emerald-100 px-2.5 py-0.5 text-[10px] font-black uppercase text-emerald-800 shrink-0">
                            {reg.status}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#050505]/70">
                          Format: {reg.participation_type === 'team' ? `Team "${reg.team_name}"` : 'Solo Hacker'}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-4 text-center text-xs text-[#050505]/60 space-y-2">
                    <p>You have not registered for any hackathons yet.</p>
                    <button
                      type="button"
                      onClick={onNavigateToHackathons}
                      className="inline-flex items-center gap-1 text-xs font-bold text-[#050505] underline hover:text-[#050505]/80 cursor-pointer"
                    >
                      <span>Explore upcoming challenges</span>
                      <ArrowRight size={12} />
                    </button>
                  </div>
                )}
              </section>
            )}

            {/* 7. PUBLISHED POSTS BY STUDENT */}
            <section className="rounded-[28px] border-[2.5px] border-[#050505] bg-white p-6 sm:p-8 shadow-[5px_5px_0_#050505] space-y-4">
              <div className="flex items-center justify-between border-b border-[#050505]/15 pb-4">
                <div className="flex items-center gap-2 text-sm font-black uppercase text-[#050505]">
                  <MessageSquare size={16} />
                  <span>Campus Posts ({posts.length})</span>
                </div>

                <button
                  type="button"
                  onClick={onNavigateToCommunity}
                  className="inline-flex min-h-[34px] cursor-pointer items-center gap-1 rounded-full border border-[#050505]/40 bg-white px-3.5 text-xs font-bold text-[#050505] hover:bg-[#E9E7D8] transition-colors"
                >
                  <span>Open Feed</span>
                  <ExternalLink size={12} />
                </button>
              </div>

              {posts.length > 0 ? (
                <div className="space-y-4 pt-2">
                  {posts.map((post) => (
                    <div
                      key={post.id}
                      className="rounded-2xl border border-[#050505]/20 bg-[#fffef8] p-5 text-xs space-y-3 shadow-[2px_2px_0_#050505]"
                    >
                      <p className="text-xs sm:text-sm text-[#050505] leading-relaxed whitespace-pre-wrap">
                        {post.content}
                      </p>

                      {post.image_url && (
                        <div className="overflow-hidden rounded-xl border border-[#050505]/20 max-h-72">
                          <img
                            src={post.image_url}
                            alt="Post attachment"
                            className="w-full object-cover"
                          />
                        </div>
                      )}

                      <div className="flex items-center justify-between text-[11px] text-[#050505]/60 pt-2 border-t border-[#050505]/10">
                        <span>
                          {new Date(post.created_at).toLocaleDateString(undefined, {
                            dateStyle: 'medium',
                          })}
                        </span>
                        <div className="flex items-center gap-3">
                          <span className="inline-flex items-center gap-1 font-bold text-[#050505]/80">
                            <Heart size={12} />
                            <span>{post.likes_count}</span>
                          </span>
                          <span className="inline-flex items-center gap-1 font-bold text-[#050505]/80">
                            <MessageCircle size={12} />
                            <span>{post.comments_count}</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-[#050505]/60 space-y-2">
                  <p>No community posts published yet.</p>
                  {isOwnProfile && (
                    <button
                      type="button"
                      onClick={onNavigateToCommunity}
                      className="inline-flex items-center gap-1 font-bold text-[#050505] underline hover:text-[#050505]/80 cursor-pointer"
                    >
                      <span>Share your first update in Community</span>
                      <ArrowRight size={12} />
                    </button>
                  )}
                </div>
              )}
            </section>
          </div>
        )}
      </main>

      {/* Interactive 1:1 Profile Photo Cropper Modal */}
      <ImageCropModal
        isOpen={cropperOpen}
        imageSrc={rawImageSrc}
        onCropComplete={handleCropComplete}
        onCancel={handleCropCancel}
      />
    </div>
  )
}
