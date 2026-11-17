/**
 * HackhIt — Community Post Card Component
 *
 * Renders an individual student post with author metadata, rich text content,
 * optional media, real-time likes counter, comments list, comment submission,
 * and author-only post deletion.
 */

import { useState, useRef, type FormEvent } from 'react'
import {
  Heart,
  MessageCircle,
  Trash2,
  Send,
  Loader2,
  GraduationCap,
  Clock,
  AlertCircle,
} from 'lucide-react'
import type { Post, Comment } from '../lib/community'
import {
  togglePostLike,
  addComment,
  deleteComment,
  deletePost,
} from '../lib/community'

interface PostCardProps {
  post: Post
  currentUserId?: string
  onPostDeleted: (postId: string) => void
  onAuthorClick: (authorId: string) => void
  onRequestSignIn?: () => void
}

function formatRelativeTime(dateString?: string | null): string {
  if (!dateString) return 'Just now'
  try {
    const postDate = new Date(dateString)
    if (isNaN(postDate.getTime())) return 'Just now'
    const now = new Date()
    const diffSec = Math.floor((now.getTime() - postDate.getTime()) / 1000)

    if (diffSec < 60) return 'Just now'
    const diffMin = Math.floor(diffSec / 60)
    if (diffMin < 60) return `${diffMin}m ago`
    const diffHour = Math.floor(diffMin / 60)
    if (diffHour < 24) return `${diffHour}h ago`
    const diffDay = Math.floor(diffHour / 24)
    if (diffDay < 7) return `${diffDay}d ago`

    return postDate.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return 'Recent'
  }
}

export function PostCard({
  post,
  currentUserId,
  onPostDeleted,
  onAuthorClick,
  onRequestSignIn,
}: PostCardProps) {
  const [avatarError, setAvatarError] = useState(false)
  const [hasLiked, setHasLiked] = useState(post.has_liked)
  const [likesCount, setLikesCount] = useState(post.likes_count)
  const [isLiking, setIsLiking] = useState(false)
  const isLikingRef = useRef(false)

  const [showComments, setShowComments] = useState(false)
  const [comments, setComments] = useState<Comment[]>(post.comments || [])
  const [newCommentText, setNewCommentText] = useState('')
  const [isSubmittingComment, setIsSubmittingComment] = useState(false)
  const isSubmittingCommentRef = useRef(false)
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null)

  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const [prevPost, setPrevPost] = useState(post)
  if (post !== prevPost) {
    setPrevPost(post)
    setHasLiked(post.has_liked)
    setLikesCount(post.likes_count)
    if (post.comments) {
      setComments(post.comments)
    }
  }

  const isAuthor = currentUserId && currentUserId === post.user_id

  // Handle like toggle with race condition lock & optimistic rollback
  const handleLikeToggle = async () => {
    if (!currentUserId) {
      onRequestSignIn?.()
      return
    }

    // Synchronous guard against rapid clicks
    if (isLiking || isLikingRef.current) return
    isLikingRef.current = true
    setIsLiking(true)

    // Optimistic UI update
    const previousState = hasLiked
    const previousCount = likesCount
    const nextState = !previousState
    const nextCount = nextState ? previousCount + 1 : Math.max(0, previousCount - 1)

    setHasLiked(nextState)
    setLikesCount(nextCount)
    setErrorMessage(null)

    try {
      const res = await togglePostLike(post.id, currentUserId, previousState)
      if (!res.success || res.error) {
        // Rollback on failure
        setHasLiked(previousState)
        setLikesCount(previousCount)
        setErrorMessage(res.error || 'Failed to update like status.')
      } else {
        // Synchronize with verified database count and state
        if (typeof res.likesCount === 'number') {
          setLikesCount(res.likesCount)
        }
        if (typeof res.hasLiked === 'boolean') {
          setHasLiked(res.hasLiked)
        }
      }
    } catch {
      setHasLiked(previousState)
      setLikesCount(previousCount)
      setErrorMessage('Network error while updating like.')
    } finally {
      setIsLiking(false)
      isLikingRef.current = false
    }
  }

  // Handle comment submit with duplicate guard and validation
  const handleCommentSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!currentUserId) {
      onRequestSignIn?.()
      return
    }

    const trimmed = newCommentText.trim()
    if (!trimmed) {
      setErrorMessage('Please enter a comment before submitting.')
      return
    }

    if (trimmed.length > 1000) {
      setErrorMessage('Comment cannot exceed 1000 characters.')
      return
    }

    if (isSubmittingComment || isSubmittingCommentRef.current) return
    isSubmittingCommentRef.current = true
    setIsSubmittingComment(true)
    setErrorMessage(null)

    try {
      const { comment, error } = await addComment({
        postId: post.id,
        userId: currentUserId,
        content: trimmed,
      })

      if (error || !comment) {
        setErrorMessage(error || 'Could not post comment.')
      } else {
        setComments((prev) => [...prev, comment])
        setNewCommentText('')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setErrorMessage(`Error: ${msg}`)
    } finally {
      setIsSubmittingComment(false)
      isSubmittingCommentRef.current = false
    }
  }

  // Handle deleting individual comments (only for comment author)
  const handleDeleteComment = async (commentId: string) => {
    if (deletingCommentId) return
    setDeletingCommentId(commentId)
    setErrorMessage(null)

    try {
      const { success, error } = await deleteComment(commentId)
      if (success) {
        setComments((prev) => prev.filter((c) => c.id !== commentId))
      } else {
        setErrorMessage(error || 'Failed to delete comment.')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setErrorMessage(`Error: ${msg}`)
    } finally {
      setDeletingCommentId(null)
    }
  }

  // Handle post delete
  const handleDeletePost = async () => {
    if (!currentUserId || !isAuthor || isDeleting) return

    setIsDeleting(true)
    setErrorMessage(null)

    try {
      const { success, error } = await deletePost(post.id, currentUserId)
      if (error || !success) {
        setErrorMessage(error || 'Failed to delete post.')
        setIsDeleting(false)
      } else {
        onPostDeleted(post.id)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setErrorMessage(`Error deleting post: ${msg}`)
      setIsDeleting(false)
    }
  }

  const authorName = (post.profile?.full_name && post.profile.full_name.trim()) || 'Campus Student'
  const authorAvatar = post.profile?.avatar_url
  const authorUniversity = post.profile?.university
  const authorInitial = (authorName.trim().charAt(0) || 'S').toUpperCase()

  return (
    <article
      className="rounded-[24px] border-[2px] border-[#050505] bg-[#fffef8] p-5 sm:p-6 shadow-[4px_4px_0_#050505] transition-all hover:shadow-[5px_5px_0_#050505]"
      aria-label={`Post by ${authorName}`}
    >
      {/* Post Header: Author info & Actions */}
      <div className="flex items-start justify-between gap-3 border-b border-[#050505]/10 pb-3.5">
        <div className="flex items-center gap-3">
          {/* Author avatar */}
          <button
            type="button"
            onClick={() => onAuthorClick(post.user_id)}
            className="group relative cursor-pointer"
            title={`View ${authorName}'s profile`}
          >
            {authorAvatar && !avatarError ? (
              <img
                src={authorAvatar}
                alt={authorName}
                onError={() => setAvatarError(true)}
                className="h-11 w-11 rounded-full border border-[#050505] object-cover transition-transform group-hover:scale-105"
              />
            ) : (
              <div className="grid h-11 w-11 place-items-center rounded-full border border-[#050505] bg-[#F5F04A] font-black text-sm text-[#050505] transition-transform group-hover:scale-105">
                {authorInitial}
              </div>
            )}
          </button>

          {/* Author details */}
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => onAuthorClick(post.user_id)}
                className="font-extrabold text-sm text-[#050505] hover:underline cursor-pointer tracking-tight"
              >
                {authorName}
              </button>

              {authorUniversity && (
                <span className="inline-flex items-center gap-1 rounded-full border border-[#050505] bg-[#E9E7D8] px-2 py-0.5 text-[10px] font-bold text-[#050505]">
                  <GraduationCap size={11} />
                  <span className="truncate max-w-[150px]">{authorUniversity}</span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-1 text-[11px] text-[#050505]/60 mt-0.5">
              <Clock size={11} />
              <span>{formatRelativeTime(post.created_at)}</span>
            </div>
          </div>
        </div>

        {/* Delete post button (only for author) */}
        {isAuthor && (
          <div className="relative">
            {showDeleteConfirm ? (
              <div className="flex items-center gap-1.5 rounded-full border border-red-600 bg-red-50 p-1 text-[11px] font-bold text-red-950">
                <span className="pl-2 pr-1">Delete post?</span>
                <button
                  type="button"
                  onClick={handleDeletePost}
                  disabled={isDeleting}
                  className="rounded-full bg-red-600 px-2 py-0.5 text-white hover:bg-red-700 cursor-pointer disabled:opacity-60"
                >
                  {isDeleting ? <Loader2 size={12} className="animate-spin" /> : 'Yes'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="rounded-full bg-white px-2 py-0.5 text-[#050505] border border-[#050505]/30 hover:bg-neutral-100 cursor-pointer"
                >
                  No
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="grid h-8 w-8 place-items-center rounded-full border border-transparent text-[#050505]/60 hover:border-[#050505] hover:bg-red-50 hover:text-red-700 transition-colors cursor-pointer"
                title="Delete this post"
                aria-label="Delete this post"
              >
                <Trash2 size={15} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Error alert */}
      {errorMessage && (
        <div className="mt-3 rounded-xl border border-red-600 bg-red-50 p-2.5 text-xs text-red-900 flex items-center gap-2">
          <AlertCircle size={14} />
          <span className="flex-1">{errorMessage}</span>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-red-700 hover:text-red-900 font-bold px-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Post Text Content */}
      <div className="mt-3.5 text-sm leading-relaxed text-[#050505] whitespace-pre-wrap">
        {post.content}
      </div>

      {/* Post Image Attachment */}
      {post.image_url && (
        <div className="mt-3.5 overflow-hidden rounded-[16px] border-[1.5px] border-[#050505] bg-[#E9E7D8]/30">
          <img
            src={post.image_url}
            alt="Attached to post"
            loading="lazy"
            className="w-full max-h-[460px] object-cover transition-transform hover:scale-[1.01]"
          />
        </div>
      )}

      {/* Interaction Bar: Likes & Comments count */}
      <div className="mt-4 flex items-center gap-3 border-t border-[#050505]/10 pt-3">
        {/* Like Button */}
        <button
          type="button"
          onClick={handleLikeToggle}
          disabled={isLiking}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer ${
            hasLiked
              ? 'border-[#050505] bg-[#F5F04A] text-[#050505] shadow-[2px_2px_0_#050505]'
              : 'border-[#050505]/30 bg-white text-[#050505] hover:border-[#050505] hover:bg-[#F5F04A]/30'
          } ${isLiking ? 'opacity-70' : ''}`}
          title={hasLiked ? 'Unlike this post' : 'Like this post'}
          aria-label={hasLiked ? 'Unlike post' : 'Like post'}
        >
          <Heart
            size={14}
            className={hasLiked ? 'fill-[#050505] text-[#050505]' : 'text-[#050505]'}
          />
          <span>{likesCount}</span>
        </button>

        {/* Comment Toggle Button */}
        <button
          type="button"
          onClick={() => setShowComments(!showComments)}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer ${
            showComments
              ? 'border-[#050505] bg-white text-[#050505] shadow-[2px_2px_0_#050505]'
              : 'border-[#050505]/30 bg-white text-[#050505] hover:border-[#050505]'
          }`}
          title={showComments ? 'Hide comments' : 'View comments'}
          aria-expanded={showComments}
        >
          <MessageCircle size={14} />
          <span>{comments.length}</span>
        </button>
      </div>

      {/* Expandable Comments Section */}
      {showComments && (
        <div className="mt-4 border-t border-[#050505]/10 pt-4 space-y-3.5 animate-in fade-in duration-200">
          {/* List of existing comments */}
          {comments.length === 0 ? (
            <p className="text-xs italic text-[#050505]/60 py-1">
              No replies yet. Be the first to join the conversation!
            </p>
          ) : (
            <div className="space-y-2.5">
              {comments.map((comment) => {
                const cAuthorName =
                  (comment.profile?.full_name && comment.profile.full_name.trim()) ||
                  'Campus Student'
                const cAuthorAvatar = comment.profile?.avatar_url
                const cAuthorInitial = (cAuthorName.trim().charAt(0) || 'S').toUpperCase()
                const isCommentAuthor = currentUserId && currentUserId === comment.user_id
                const isDeletingThis = deletingCommentId === comment.id

                return (
                  <div
                    key={comment.id}
                    className="group relative flex items-start gap-2.5 rounded-xl border border-[#050505]/15 bg-[#E9E7D8]/40 p-3"
                  >
                    <button
                      type="button"
                      onClick={() => onAuthorClick(comment.user_id)}
                      className="cursor-pointer shrink-0 mt-0.5"
                    >
                      {cAuthorAvatar ? (
                        <img
                          src={cAuthorAvatar}
                          alt={cAuthorName}
                          onError={(e) => {
                            e.currentTarget.style.display = 'none'
                          }}
                          className="h-7 w-7 rounded-full border border-[#050505] object-cover"
                        />
                      ) : (
                        <div className="grid h-7 w-7 place-items-center rounded-full border border-[#050505] bg-[#F5F04A] text-xs font-black text-[#050505]">
                          {cAuthorInitial}
                        </div>
                      )}
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => onAuthorClick(comment.user_id)}
                          className="font-bold text-xs text-[#050505] hover:underline cursor-pointer truncate"
                        >
                          {cAuthorName}
                        </button>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[10px] text-[#050505]/50">
                            {formatRelativeTime(comment.created_at)}
                          </span>

                          {/* Delete comment action (only for comment owner) */}
                          {isCommentAuthor && (
                            <button
                              type="button"
                              onClick={() => handleDeleteComment(comment.id)}
                              disabled={isDeletingThis}
                              className="text-[#050505]/40 hover:text-red-700 hover:bg-red-50 p-0.5 rounded cursor-pointer transition-colors"
                              title="Delete your comment"
                              aria-label="Delete comment"
                            >
                              {isDeletingThis ? (
                                <Loader2 size={11} className="animate-spin text-red-600" />
                              ) : (
                                <Trash2 size={11} />
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="mt-1 text-xs text-[#050505]/90 whitespace-pre-wrap leading-relaxed break-words">
                        {comment.content}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Comment Composer or Sign-In Prompt */}
          {!currentUserId ? (
            <div className="rounded-xl border border-[#050505]/15 bg-[#fffef8] p-3 text-center">
              <p className="text-xs text-[#050505]/70">
                Sign in with your campus account to join the conversation.
              </p>
              <button
                type="button"
                onClick={onRequestSignIn}
                className="mt-2 inline-flex min-h-[30px] cursor-pointer items-center gap-1.5 rounded-full border border-[#050505] bg-[#F5F04A] px-4 text-xs font-extrabold uppercase text-[#050505] shadow-[1.5px_1.5px_0_#050505] hover:bg-[#F5F04A]/90"
              >
                Sign In to Reply
              </button>
            </div>
          ) : (
            <form onSubmit={handleCommentSubmit} className="space-y-1.5 pt-1">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newCommentText}
                  onChange={(e) => {
                    setNewCommentText(e.target.value)
                    if (errorMessage) setErrorMessage(null)
                  }}
                  disabled={isSubmittingComment}
                  placeholder="Write a comment..."
                  maxLength={1000}
                  className="flex-1 h-9 rounded-full border border-[#050505] bg-white px-3.5 text-xs text-[#050505] placeholder-[#050505]/40 outline-none focus:ring-2 focus:ring-[#F5F04A] disabled:opacity-60"
                />
                <button
                  type="submit"
                  disabled={!newCommentText.trim() || isSubmittingComment}
                  className="inline-flex h-9 min-w-[36px] items-center justify-center rounded-full border border-[#050505] bg-[#F5F04A] px-3 font-bold text-xs text-[#050505] shadow-[2px_2px_0_#050505] hover:-translate-y-0.5 transition-transform disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  title="Post comment"
                >
                  {isSubmittingComment ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Send size={13} />
                  )}
                </button>
              </div>
              {newCommentText.length > 700 && (
                <div className="text-right text-[10px] font-semibold text-[#050505]/50 pr-2">
                  {newCommentText.length} / 1000
                </div>
              )}
            </form>
          )}
        </div>
      )}
    </article>
  )
}
