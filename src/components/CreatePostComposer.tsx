/**
 * HackhIt — Create Post Composer Component
 *
 * Dedicated composer allowing authenticated students to publish updates, project milestones,
 * or questions to the campus community feed with optional media attachments.
 */

import { useState, useRef, type ChangeEvent, type FormEvent } from 'react'
import {
  Image as ImageIcon,
  X,
  Send,
  Loader2,
  AlertCircle,
  Sparkles,
} from 'lucide-react'
import type { Profile, Post } from '../lib/community'
import { createPost } from '../lib/community'

interface CreatePostComposerProps {
  currentUserId: string
  currentUserProfile?: Profile | null
  onPostCreated: (post: Post) => void
  initialDraft?: string
}

export function CreatePostComposer({
  currentUserId,
  currentUserProfile,
  onPostCreated,
  initialDraft = '',
}: CreatePostComposerProps) {
  const [content, setContent] = useState(initialDraft)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const isSubmittingRef = useRef(false)

  // Clean up object URL on unmount or preview change
  const handleRemoveImage = () => {
    setImageFile(null)
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview)
      setImagePreview(null)
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleImageSelect = (e: ChangeEvent<HTMLInputElement>) => {
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
      setErrorMessage('Please select a valid image file (JPG, PNG, WebP, GIF).')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage('Image size exceeds the 5MB limit.')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    // Revoke previous preview if any
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview)
    }

    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
    setErrorMessage(null)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    // Prevent duplicate submissions
    if (isSubmitting || isSubmittingRef.current) {
      return
    }

    const trimmed = content.trim()
    if (!trimmed) {
      setErrorMessage('Please enter some text before posting.')
      return
    }

    if (trimmed.length > 3000) {
      setErrorMessage('Post cannot exceed 3000 characters.')
      return
    }

    isSubmittingRef.current = true
    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      const { post, error } = await createPost({
        content: trimmed,
        imageFile,
        userId: currentUserId,
      })

      if (error || !post) {
        setErrorMessage(
          error?.toLowerCase().includes('violates row-level security')
            ? 'You must be signed in to publish posts. Please check your session.'
            : error || 'Failed to create post. Please try again.'
        )
      } else {
        // Reset composer upon successful publication
        setContent('')
        handleRemoveImage()
        onPostCreated(post)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setErrorMessage(`Unable to publish post: ${msg}`)
    } finally {
      setIsSubmitting(false)
      isSubmittingRef.current = false
    }
  }

  const userName = (currentUserProfile?.full_name && currentUserProfile.full_name.trim()) || 'Campus Student'
  const userAvatar = currentUserProfile?.avatar_url
  const userInitial = (userName.charAt(0) || 'S').toUpperCase()

  return (
    <div
      className="rounded-[24px] border-[2px] border-[#050505] bg-[#fffef8] p-5 sm:p-6 shadow-[5px_5px_0_#050505]"
      aria-label="Create a post"
    >
      <div className="flex items-center gap-2.5 mb-3">
        <span className="grid h-7 w-7 place-items-center rounded-full border border-[#050505] bg-[#F5F04A] text-[#050505]">
          <Sparkles size={14} />
        </span>
        <h3 className="font-extrabold text-xs uppercase tracking-wider text-[#050505]">
          Share with Your Campus Community
        </h3>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="flex items-start gap-3">
          {/* Current user avatar */}
          <div className="hidden sm:block shrink-0 mt-1">
            {userAvatar ? (
              <img
                src={userAvatar}
                alt={userName}
                className="h-10 w-10 rounded-full border border-[#050505] object-cover"
              />
            ) : (
              <div className="grid h-10 w-10 place-items-center rounded-full border border-[#050505] bg-[#F5F04A] text-xs font-black text-[#050505]">
                {userInitial}
              </div>
            )}
          </div>

          {/* Text input area */}
          <div className="flex-1">
            <textarea
              value={content}
              onChange={(e) => {
                setContent(e.target.value)
                if (errorMessage) setErrorMessage(null)
              }}
              disabled={isSubmitting}
              placeholder="What are you building, planning, or asking? Share with fellow students..."
              maxLength={3000}
              rows={3}
              className="w-full rounded-2xl border border-[#050505] bg-white p-3.5 text-xs text-[#050505] placeholder-[#050505]/40 outline-none focus:ring-2 focus:ring-[#F5F04A] transition-all resize-none disabled:opacity-60"
            />
          </div>
        </div>

        {/* Selected image preview */}
        {imagePreview && (
          <div className="relative mt-3 ml-0 sm:ml-13 inline-block">
            <img
              src={imagePreview}
              alt="Attachment preview"
              className="max-h-48 rounded-xl border border-[#050505] object-cover shadow-[2px_2px_0_#050505]"
            />
            <button
              type="button"
              onClick={handleRemoveImage}
              className="absolute -top-2 -right-2 grid h-6 w-6 place-items-center rounded-full border border-[#050505] bg-white text-[#050505] shadow hover:bg-red-50 hover:text-red-700 cursor-pointer"
              title="Remove image"
            >
              <X size={13} />
            </button>
          </div>
        )}

        {/* Error notification */}
        {errorMessage && (
          <div className="mt-3 ml-0 sm:ml-13 rounded-xl border border-red-600 bg-red-50 p-2.5 text-xs text-red-900 flex items-center gap-2">
            <AlertCircle size={14} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Composer bottom bar */}
        <div className="mt-3 ml-0 sm:ml-13 flex flex-wrap items-center justify-between gap-3 border-t border-[#050505]/10 pt-3">
          {/* Attachment button */}
          <div className="flex items-center gap-3">
            <label
              htmlFor="post-image-file"
              className={`inline-flex items-center gap-1.5 rounded-full border border-[#050505] bg-white px-3 py-1.5 text-xs font-bold text-[#050505] shadow-[2px_2px_0_#050505] transition-all ${
                isSubmitting
                  ? 'opacity-50 cursor-not-allowed'
                  : 'cursor-pointer hover:bg-[#F5F04A]'
              }`}
            >
              <ImageIcon size={14} />
              <span>{imageFile ? 'Change Image' : 'Add Image'}</span>
            </label>
            <input
              id="post-image-file"
              ref={fileInputRef}
              type="file"
              disabled={isSubmitting}
              accept="image/png, image/jpeg, image/webp, image/gif"
              onChange={handleImageSelect}
              className="hidden"
            />

            <span className="text-[11px] font-semibold text-[#050505]/50">
              {content.length} / 3000
            </span>
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={!content.trim() || isSubmitting}
            className="inline-flex min-h-[38px] cursor-pointer items-center justify-center gap-2 rounded-full border-[1.5px] border-[#050505] bg-[#F5F04A] px-5 text-xs font-extrabold uppercase tracking-wider text-[#050505] shadow-[2px_2px_0_#050505] hover:-translate-y-0.5 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                <span>Posting...</span>
              </>
            ) : (
              <>
                <span>Post Update</span>
                <Send size={13} />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
