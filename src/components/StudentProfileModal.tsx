/**
 * HackhIt — Student Profile Modal Component
 *
 * Allows viewing any student's public campus profile (bio, university, skills, interests, published posts)
 * and allows authenticated students to edit their own profile details with full photo management.
 */

import { useState, useEffect, useRef, type ChangeEvent, type FormEvent } from 'react'
import {
  X,
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
} from 'lucide-react'
import { ImageCropModal } from './ImageCropModal'
import type { Profile, Post } from '../lib/community'
import {
  fetchProfileWithPosts,
  updateProfile,
  uploadAvatar,
} from '../lib/community'

interface StudentProfileModalProps {
  userId: string
  currentUserId?: string
  isOpen: boolean
  onClose: () => void
  onProfileUpdated?: (updated: Profile) => void
}

export function StudentProfileModal({
  userId,
  currentUserId,
  isOpen,
  onClose,
  onProfileUpdated,
}: StudentProfileModalProps) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const isSavingRef = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [avatarError, setAvatarError] = useState(false)

  // Edit form state
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

  const isOwnProfile = Boolean(currentUserId && currentUserId === userId)

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown)
    }
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  const [prevUserId, setPrevUserId] = useState<string | null>(null)
  if (isOpen && userId && userId !== prevUserId) {
    setPrevUserId(userId)
    setIsLoading(true)
    setError(null)
    setSuccessMessage(null)
    setIsEditing(false)
    setRemoveAvatar(false)
    setAvatarFile(null)
    setAvatarPreview(null)
    setAvatarError(false)
    setCropperOpen(false)
    setRawImageSrc(null)
  }

  useEffect(() => {
    if (!isOpen || !userId) return

    let isMounted = true

    fetchProfileWithPosts(userId, currentUserId).then(({ profile: p, posts: pts, error: err }) => {
      if (!isMounted) return
      setIsLoading(false)
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
    })

    return () => {
      isMounted = false
    }
  }, [isOpen, userId, currentUserId])

  if (!isOpen) return null

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
    setAvatarFile(null)
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

    const objectUrl = URL.createObjectURL(file)
    setRawImageSrc(objectUrl)
    setCropperOpen(true)
    setError(null)

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

  const handleRemoveAvatar = () => {
    if (avatarPreview) {
      URL.revokeObjectURL(avatarPreview)
      setAvatarPreview(null)
    }
    setAvatarFile(null)
    setRemoveAvatar(true)
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
      let finalAvatarUrl: string | null = profile.avatar_url

      if (removeAvatar) {
        finalAvatarUrl = null
      } else if (avatarFile && currentUserId) {
        const uploadRes = await uploadAvatar(avatarFile)
        if (uploadRes.error) {
          setError(`Avatar upload failed: ${uploadRes.error}`)
          setIsSaving(false)
          isSavingRef.current = false
          return
        }
        finalAvatarUrl = uploadRes.url
      }

      const parsedSkills = editSkills
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0)

      const parsedInterests = editInterests
        .split(',')
        .map((i) => i.trim())
        .filter((i) => i.length > 0)

      const { profile: updated, error: updateErr } = await updateProfile(userId, {
        full_name: trimmedName,
        university: editUniversity.trim() || null,
        bio: editBio.trim() || null,
        avatar_url: finalAvatarUrl,
        skills: parsedSkills,
        interests: parsedInterests,
      })

      if (updateErr || !updated) {
        setError(updateErr || 'Failed to update profile.')
      } else {
        setProfile(updated)
        setIsEditing(false)
        setRemoveAvatar(false)
        setAvatarFile(null)
        setAvatarPreview(null)
        setAvatarError(false)
        setSuccessMessage('Profile updated successfully!')
        onProfileUpdated?.(updated)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(`Failed to update profile: ${msg}`)
    } finally {
      setIsSaving(false)
      isSavingRef.current = false
    }
  }

  // Active avatar preview during editing
  const currentEditAvatarUrl = removeAvatar
    ? null
    : avatarPreview || profile?.avatar_url || null

  const profileInitial = ((profile?.full_name && profile.full_name.trim().charAt(0)) || 'S').toUpperCase()

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="student-profile-title"
    >
      <div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-[28px] border-[2.5px] border-[#050505] bg-[#E9E7D8] p-6 sm:p-8 shadow-[8px_8px_0_#050505]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close profile modal"
          className="absolute top-5 right-5 grid h-9 w-9 place-items-center rounded-full border border-[#050505] bg-white text-[#050505] shadow-[2px_2px_0_#050505] transition-transform hover:scale-105 hover:bg-[#F5F04A] cursor-pointer z-10"
        >
          <X size={18} />
        </button>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Loader2 size={32} className="animate-spin text-[#050505]" />
            <p className="mt-3 text-xs font-bold uppercase tracking-wider text-[#050505]/70">
              Loading student profile...
            </p>
          </div>
        ) : error && !profile ? (
          <div className="py-12 text-center">
            <AlertCircle size={36} className="mx-auto text-red-600" />
            <h3 className="mt-2 text-base font-bold text-[#050505]">
              Profile Not Available
            </h3>
            <p className="mt-1 text-xs text-[#050505]/70">{error}</p>
            <button
              type="button"
              onClick={onClose}
              className="mt-5 inline-flex min-h-[38px] cursor-pointer items-center justify-center rounded-full border border-[#050505] bg-[#F5F04A] px-5 text-xs font-bold uppercase tracking-wider text-[#050505] shadow-[2px_2px_0_#050505]"
            >
              Close
            </button>
          </div>
        ) : profile ? (
          <div>
            {/* Header info */}
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 border-b border-[#050505]/20 pb-6">
              {/* Avatar display */}
              <div className="relative shrink-0">
                {profile.avatar_url && !avatarError ? (
                  <img
                    src={profile.avatar_url}
                    alt={profile.full_name}
                    onError={() => setAvatarError(true)}
                    className="h-24 w-24 rounded-full border-[2.5px] border-[#050505] object-cover shadow-[3px_3px_0_#050505]"
                  />
                ) : (
                  <div className="grid h-24 w-24 place-items-center rounded-full border-[2.5px] border-[#050505] bg-[#F5F04A] text-2xl font-black text-[#050505] shadow-[3px_3px_0_#050505]">
                    {profileInitial}
                  </div>
                )}
              </div>

              {/* Names and info */}
              <div className="flex-1 text-center sm:text-left min-w-0">
                <div className="flex flex-wrap items-center justify-center sm:justify-between gap-2">
                  <h2
                    id="student-profile-title"
                    className="display-font text-2xl sm:text-3xl text-[#050505] truncate"
                  >
                    {profile.full_name}
                  </h2>

                  {isOwnProfile && !isEditing && (
                    <button
                      type="button"
                      onClick={handleStartEdit}
                      className="inline-flex items-center gap-1.5 rounded-full border border-[#050505] bg-white px-3.5 py-1 text-xs font-bold text-[#050505] shadow-[2px_2px_0_#050505] hover:bg-[#F5F04A] cursor-pointer transition-transform hover:-translate-y-0.5"
                    >
                      <Edit3 size={12} /> Edit Profile
                    </button>
                  )}
                </div>

                {profile.university ? (
                  <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-full border border-[#050505] bg-white px-3 py-0.5 text-xs font-semibold text-[#050505]">
                    <GraduationCap size={13} />
                    <span className="truncate max-w-[280px]">{profile.university}</span>
                  </div>
                ) : (
                  <div className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-[#050505]/60">
                    <User size={12} /> Campus Student
                  </div>
                )}

                {profile.bio ? (
                  <p className="mt-3 text-xs leading-relaxed text-[#050505]/85 whitespace-pre-wrap break-words">
                    {profile.bio}
                  </p>
                ) : (
                  <p className="mt-2 text-xs italic text-[#050505]/50">
                    {isOwnProfile
                      ? 'Add a bio to introduce yourself to peers and teammates.'
                      : 'No bio shared yet.'}
                  </p>
                )}

                <div className="mt-3 flex items-center justify-center sm:justify-start gap-4 text-[11px] text-[#050505]/60">
                  <span className="inline-flex items-center gap-1">
                    <Calendar size={12} /> Member since{' '}
                    {new Date(profile.created_at).toLocaleDateString(undefined, {
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                  <span>•</span>
                  <span>
                    <strong>{posts.length}</strong>{' '}
                    {posts.length === 1 ? 'post' : 'posts'}
                  </span>
                </div>
              </div>
            </div>

            {/* Success notification */}
            {successMessage && (
              <div className="mt-4 rounded-xl border border-emerald-600 bg-emerald-50 p-3 text-xs font-bold text-emerald-900 flex items-center gap-2">
                <Check size={16} />
                <span>{successMessage}</span>
              </div>
            )}

            {/* Edit Profile Form */}
            {isEditing ? (
              <form onSubmit={handleSaveProfile} className="mt-6 space-y-4">
                <div className="rounded-[20px] border-[1.5px] border-[#050505] bg-[#fffef8] p-5 sm:p-6 shadow-[4px_4px_0_#050505]">
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <h3 className="font-extrabold text-sm uppercase tracking-wider text-[#050505]">
                      Edit Your Student Profile
                    </h3>
                    <span className="text-[11px] font-semibold text-[#050505]/50">
                      * Required fields
                    </span>
                  </div>

                  {error && (
                    <div className="mb-4 rounded-xl border border-red-600 bg-red-50 p-3 text-xs text-red-900 flex items-center gap-2">
                      <AlertCircle size={15} />
                      <span>{error}</span>
                    </div>
                  )}

                  <div className="space-y-4">
                    {/* Profile Picture Controls */}
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[#050505]/70 mb-1.5">
                        Profile Photo
                      </label>
                      <div className="flex flex-wrap items-center gap-3">
                        {currentEditAvatarUrl ? (
                          <img
                            src={currentEditAvatarUrl}
                            alt="Avatar preview"
                            className="h-14 w-14 rounded-full border-2 border-[#050505] object-cover shadow-[2px_2px_0_#050505]"
                          />
                        ) : (
                          <div className="grid h-14 w-14 place-items-center rounded-full border-2 border-[#050505] bg-[#F5F04A] font-black text-sm text-[#050505] shadow-[2px_2px_0_#050505]">
                            {profileInitial}
                          </div>
                        )}

                        <div className="flex items-center gap-2">
                          <label
                            htmlFor="edit-avatar-input"
                            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-[#050505] bg-white px-3.5 py-1.5 text-xs font-bold text-[#050505] shadow-[2px_2px_0_#050505] hover:bg-[#F5F04A] transition-all"
                          >
                            <Upload size={13} />
                            <span>
                              {currentEditAvatarUrl ? 'Change Photo' : 'Upload Photo'}
                            </span>
                          </label>
                          <input
                            id="edit-avatar-input"
                            ref={fileInputRef}
                            type="file"
                            accept="image/png, image/jpeg, image/webp, image/gif"
                            onChange={handleAvatarChange}
                            className="hidden"
                          />

                          {currentEditAvatarUrl && (
                            <button
                              type="button"
                              onClick={handleRemoveAvatar}
                              className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-red-600 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100 transition-all"
                              title="Remove profile photo"
                            >
                              <Trash2 size={12} />
                              <span>Remove</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Full Name */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label
                          htmlFor="edit-fullname"
                          className="block text-xs font-bold uppercase tracking-wider text-[#050505]/70"
                        >
                          Full Name *
                        </label>
                        <span className="text-[10px] text-[#050505]/40">
                          {editFullName.length} / 100
                        </span>
                      </div>
                      <input
                        id="edit-fullname"
                        type="text"
                        value={editFullName}
                        onChange={(e) => setEditFullName(e.target.value)}
                        maxLength={100}
                        required
                        className="w-full rounded-xl border border-[#050505] bg-white px-3.5 py-2 text-xs font-medium text-[#050505] outline-none focus:ring-2 focus:ring-[#F5F04A]"
                        placeholder="e.g. Alex Chen"
                      />
                    </div>

                    {/* University */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label
                          htmlFor="edit-university"
                          className="block text-xs font-bold uppercase tracking-wider text-[#050505]/70"
                        >
                          University / College
                        </label>
                        <span className="text-[10px] text-[#050505]/40">
                          {editUniversity.length} / 120
                        </span>
                      </div>
                      <input
                        id="edit-university"
                        type="text"
                        value={editUniversity}
                        onChange={(e) => setEditUniversity(e.target.value)}
                        maxLength={120}
                        className="w-full rounded-xl border border-[#050505] bg-white px-3.5 py-2 text-xs font-medium text-[#050505] outline-none focus:ring-2 focus:ring-[#F5F04A]"
                        placeholder="e.g. UC Berkeley, Stanford, Malla Reddy University"
                      />
                    </div>

                    {/* Short Bio */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label
                          htmlFor="edit-bio"
                          className="block text-xs font-bold uppercase tracking-wider text-[#050505]/70"
                        >
                          Short Bio
                        </label>
                        <span className="text-[10px] text-[#050505]/40">
                          {editBio.length} / 500
                        </span>
                      </div>
                      <textarea
                        id="edit-bio"
                        value={editBio}
                        onChange={(e) => setEditBio(e.target.value)}
                        maxLength={500}
                        rows={3}
                        className="w-full rounded-xl border border-[#050505] bg-white p-3 text-xs font-medium text-[#050505] outline-none focus:ring-2 focus:ring-[#F5F04A] resize-none"
                        placeholder="Tell fellow students what you are building, hackathons you like, or teammates you seek..."
                      />
                    </div>

                    {/* Skills */}
                    <div>
                      <label
                        htmlFor="edit-skills"
                        className="block text-xs font-bold uppercase tracking-wider text-[#050505]/70 mb-1"
                      >
                        Skills (comma separated)
                      </label>
                      <input
                        id="edit-skills"
                        type="text"
                        value={editSkills}
                        onChange={(e) => setEditSkills(e.target.value)}
                        className="w-full rounded-xl border border-[#050505] bg-white px-3.5 py-2 text-xs font-medium text-[#050505] outline-none focus:ring-2 focus:ring-[#F5F04A]"
                        placeholder="e.g. TypeScript, React, Python, UI Design, Rust"
                      />
                    </div>

                    {/* Interests */}
                    <div>
                      <label
                        htmlFor="edit-interests"
                        className="block text-xs font-bold uppercase tracking-wider text-[#050505]/70 mb-1"
                      >
                        Interests (comma separated)
                      </label>
                      <input
                        id="edit-interests"
                        type="text"
                        value={editInterests}
                        onChange={(e) => setEditInterests(e.target.value)}
                        className="w-full rounded-xl border border-[#050505] bg-white px-3.5 py-2 text-xs font-medium text-[#050505] outline-none focus:ring-2 focus:ring-[#F5F04A]"
                        placeholder="e.g. AI Hackathons, Open Source, Robotics, FinTech"
                      />
                    </div>
                  </div>

                  {/* Form Action buttons */}
                  <div className="mt-6 flex flex-wrap items-center justify-end gap-3 pt-3 border-t border-[#050505]/10">
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      disabled={isSaving}
                      className="rounded-full border border-[#050505] bg-white px-4 py-2 text-xs font-bold uppercase text-[#050505] cursor-pointer hover:bg-neutral-100 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSaving || !editFullName.trim()}
                      className="inline-flex min-h-[38px] cursor-pointer items-center justify-center gap-2 rounded-full border-[1.5px] border-[#050505] bg-[#F5F04A] px-6 text-xs font-extrabold uppercase tracking-wider text-[#050505] shadow-[2px_2px_0_#050505] hover:-translate-y-0.5 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 size={13} className="animate-spin" /> Saving...
                        </>
                      ) : (
                        'Save Profile'
                      )}
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              <div className="mt-6 space-y-6">
                {/* Skills & Interests sections */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Skills */}
                  <div className="rounded-[20px] border-[1.5px] border-[#050505] bg-[#fffef8] p-4 shadow-[3px_3px_0_#050505]">
                    <div className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-[#050505] mb-2.5">
                      <Sparkles size={14} /> Skills
                    </div>
                    {profile.skills && profile.skills.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {profile.skills.map((skill, idx) => (
                          <span
                            key={idx}
                            className="rounded-full border border-[#050505] bg-[#E9E7D8] px-2.5 py-0.5 text-[11px] font-bold text-[#050505]"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs italic text-[#050505]/50">
                        No skills listed yet.
                      </p>
                    )}
                  </div>

                  {/* Interests */}
                  <div className="rounded-[20px] border-[1.5px] border-[#050505] bg-[#fffef8] p-4 shadow-[3px_3px_0_#050505]">
                    <div className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-[#050505] mb-2.5">
                      <BookOpen size={14} /> Interests
                    </div>
                    {profile.interests && profile.interests.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {profile.interests.map((interest, idx) => (
                          <span
                            key={idx}
                            className="rounded-full border border-[#050505] bg-[#F5F04A]/60 px-2.5 py-0.5 text-[11px] font-bold text-[#050505]"
                          >
                            {interest}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs italic text-[#050505]/50">
                        No interests listed yet.
                      </p>
                    )}
                  </div>
                </div>

                {/* Published Posts by this student */}
                <div>
                  <h3 className="font-extrabold text-sm uppercase tracking-wider text-[#050505] mb-3">
                    Posts by {profile.full_name} ({posts.length})
                  </h3>

                  {posts.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-[#050505]/30 bg-white/50 p-6 text-center text-xs text-[#050505]/60">
                      No posts published by this student yet.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {posts.map((post) => (
                        <div
                          key={post.id}
                          className="rounded-xl border border-[#050505] bg-[#fffef8] p-4 shadow-[2px_2px_0_#050505]"
                        >
                          <div className="flex items-center justify-between text-[11px] text-[#050505]/60 mb-2">
                            <span>
                              {new Date(post.created_at).toLocaleString(undefined, {
                                dateStyle: 'medium',
                                timeStyle: 'short',
                              })}
                            </span>
                            <span>
                              ❤️ {post.likes_count} • 💬 {post.comments_count}
                            </span>
                          </div>
                          <p className="text-xs text-[#050505] whitespace-pre-wrap leading-relaxed break-words">
                            {post.content}
                          </p>
                          {post.image_url && (
                            <img
                              src={post.image_url}
                              alt="Post attachment"
                              className="mt-2.5 max-h-48 w-full rounded-lg border border-[#050505] object-cover"
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>

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
