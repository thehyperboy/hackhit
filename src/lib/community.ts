/**
 * HackhIt — Student Social Community Service Layer
 *
 * Provides typed data operations for student profiles, community feed posts,
 * likes, comments, and media uploads with Supabase Row-Level Security enforcement.
 */

import { getSupabase } from './supabase'

export interface Profile {
  id: string
  full_name: string
  avatar_url: string | null
  university: string | null
  bio: string | null
  skills: string[]
  interests: string[]
  created_at: string
  updated_at: string
}

export interface AuthorProfileSummary {
  id: string
  full_name: string
  avatar_url: string | null
  university: string | null
  bio?: string | null
  skills?: string[]
  interests?: string[]
  created_at?: string
  updated_at?: string
}

export interface PostLike {
  id: string
  post_id: string
  user_id: string
  created_at: string
}

export interface Comment {
  id: string
  post_id: string
  user_id: string
  content: string
  created_at: string
  updated_at?: string
  profile?: AuthorProfileSummary | null
}

export interface Post {
  id: string
  user_id: string
  content: string
  image_url: string | null
  created_at: string
  updated_at: string
  profile?: AuthorProfileSummary | null
  likes_count: number
  has_liked: boolean
  comments_count: number
  comments?: Comment[]
}

export type DatabaseSchemaState =
  | 'initialized'
  | 'uninitialized'
  | 'inaccessible'
  | 'unauthorized'
  | 'error'

export interface DatabaseSchemaReport {
  state: DatabaseSchemaState
  missingTables: string[]
  existingTables: string[]
  message: string
  details?: string
  checkedAt: string
}

export const REQUIRED_COMMUNITY_TABLES = [
  'profiles',
  'posts',
  'post_likes',
  'comments',
] as const

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Validates whether a value is a valid canonical PostgreSQL UUID string.
 */
export function isValidUuid(val: unknown): val is string {
  if (typeof val !== 'string') return false
  try {
    const cleaned = decodeURIComponent(val).trim()
    return UUID_REGEX.test(cleaned)
  } catch {
    return false
  }
}

/**
 * Normalizes and extracts a valid UUID from either a string or an object with an .id field.
 * Returns null if the value is missing, malformed, or an event object.
 */
export function normalizeUuid(val: unknown): string | null {
  if (!val) return null
  if (typeof val === 'string') {
    try {
      const cleaned = decodeURIComponent(val).trim()
      if (
        cleaned === '[object Object]' ||
        cleaned.includes('[object') ||
        cleaned === 'null' ||
        cleaned === 'undefined'
      ) {
        return null
      }
      return UUID_REGEX.test(cleaned) ? cleaned.toLowerCase() : null
    } catch {
      return null
    }
  }
  if (
    typeof val === 'object' &&
    val !== null &&
    !('nativeEvent' in val) &&
    !('target' in val && 'currentTarget' in val) &&
    'id' in val &&
    typeof (val as { id: unknown }).id === 'string'
  ) {
    return normalizeUuid((val as { id: string }).id)
  }
  return null
}

/**
 * Accurately checks the database schema status by probing each required table.
 * Accurately distinguishes between:
 * - initialized: All tables exist and respond.
 * - uninitialized: Specific tables return PGRST205 / 42P01 schema cache missing.
 * - inaccessible: Network failure, fetch failed, DNS failure.
 * - unauthorized: 401 API key invalid.
 */
export async function checkDatabaseSchemaStatus(): Promise<DatabaseSchemaReport> {
  const checkedAt = new Date().toLocaleTimeString()

  try {
    const supabase = getSupabase()
    const missingTables: string[] = []
    const existingTables: string[] = []

    for (const table of REQUIRED_COMMUNITY_TABLES) {
      try {
        const { error, status } = await supabase
          .from(table)
          .select('id')
          .limit(1)

        // HTTP 200 or 206 confirms the table exists
        if (!error || status === 200 || status === 206) {
          existingTables.push(table)
          continue
        }

        const errCode = error.code || ''
        const errMsg = (error.message || '').toLowerCase()

        // 1. Network / connectivity error (status 0, fetch failed)
        if (
          status === 0 ||
          errMsg.includes('fetch failed') ||
          errMsg.includes('failed to fetch') ||
          errMsg.includes('networkerror')
        ) {
          return {
            state: 'inaccessible',
            missingTables: [],
            existingTables,
            message: 'Network connection error: Unable to reach the Supabase backend.',
            details: error.message || 'Check your internet connection and backend URL.',
            checkedAt,
          }
        }

        // 2. Authentication failure (HTTP 401 / bad key)
        if (
          status === 401 ||
          errMsg.includes('apikey') ||
          errMsg.includes('jwt') ||
          errMsg.includes('invalid api key')
        ) {
          return {
            state: 'unauthorized',
            missingTables: [],
            existingTables,
            message: 'Authentication key rejected: The Supabase publishable key was rejected.',
            details: error.message || 'Verify VITE_SUPABASE_PUBLISHABLE_KEY in .env.local.',
            checkedAt,
          }
        }

        // 3. Genuine missing relation in PostgREST schema cache (PGRST205 / 42P01)
        if (
          status === 404 &&
          (errCode === 'PGRST205' ||
            errCode === '42P01' ||
            errMsg.includes('could not find the table') ||
            errMsg.includes('relation "public.') ||
            errMsg.includes('schema cache'))
        ) {
          missingTables.push(table)
          continue
        }

        // 4. RLS permission denial (HTTP 403 / 42501) - Table EXISTS!
        if (
          status === 403 ||
          errCode === '42501' ||
          errMsg.includes('row-level security') ||
          errMsg.includes('permission denied')
        ) {
          existingTables.push(table)
          continue
        }

        // Unknown error
        return {
          state: 'error',
          missingTables,
          existingTables,
          message: `Backend returned HTTP ${status}: ${error.message}`,
          details: `Error code: ${errCode || 'N/A'}`,
          checkedAt,
        }
      } catch (innerErr) {
        const errorMsg = innerErr instanceof Error ? innerErr.message : String(innerErr)
        return {
          state: 'inaccessible',
          missingTables: [],
          existingTables,
          message: 'Network error: Failed to communicate with Supabase.',
          details: errorMsg,
          checkedAt,
        }
      }
    }

    if (missingTables.length > 0) {
      return {
        state: 'uninitialized',
        missingTables,
        existingTables,
        message: `Database tables missing from schema: ${missingTables.join(', ')}.`,
        details: 'The community migration script needs to be executed in the Supabase Dashboard SQL Editor.',
        checkedAt,
      }
    }

    return {
      state: 'initialized',
      missingTables: [],
      existingTables,
      message: 'All community database tables are initialized and reachable.',
      checkedAt,
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    return {
      state: 'inaccessible',
      missingTables: [],
      existingTables: [],
      message: 'Unable to initialize backend connection check.',
      details: errorMsg,
      checkedAt,
    }
  }
}

/**
 * Checks whether an error specifically indicates that the database schema / tables
 * have not yet been migrated into Supabase.
 * Strictly avoids treating network errors or permission errors as missing schema.
 */
export function isSchemaPendingError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const err = error as { code?: string; message?: string; status?: number }
  const code = err.code || ''
  const msg = (err.message || '').toLowerCase()

  // Guard: Network failure must NEVER be classified as missing schema
  if (
    err.status === 0 ||
    msg.includes('fetch failed') ||
    msg.includes('failed to fetch') ||
    msg.includes('networkerror')
  ) {
    return false
  }

  // Guard: Auth key rejection (401) must NEVER be classified as missing schema
  if (
    err.status === 401 ||
    msg.includes('apikey') ||
    msg.includes('jwt') ||
    msg.includes('invalid api key')
  ) {
    return false
  }

  // Guard: Permission denied / RLS restricted (403 / 42501) means table EXISTS
  if (
    err.status === 403 ||
    code === '42501' ||
    msg.includes('row-level security') ||
    msg.includes('permission denied')
  ) {
    return false
  }

  // Strictly check for PGRST205 or 42P01
  return (
    code === 'PGRST205' ||
    code === '42P01' ||
    (err.status === 404 &&
      (msg.includes('could not find the table') ||
        msg.includes('relation "public.') ||
        msg.includes('schema cache')))
  )
}

/**
 * Ensures a profile record exists for the authenticated user,
 * creating one if necessary using session metadata.
 */
export async function ensureProfileExists(user: {
  id: string
  email?: string
  user_metadata?: Record<string, unknown>
}): Promise<Profile | null> {
  try {
    const validUserId = normalizeUuid(user?.id)
    if (!validUserId) return null

    const supabase = getSupabase()
    if (!supabase) return null

    const { data: existing, error: fetchErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', validUserId)
      .maybeSingle()

    if (fetchErr) {
      if (isSchemaPendingError(fetchErr)) return null
      console.warn('[Community] Error checking profile:', fetchErr.message)
      return null
    }

    if (existing) {
      return existing as Profile
    }

    // Auto-create profile using user metadata
    const rawName = user.user_metadata?.full_name as string | undefined
    const fullName =
      rawName && rawName.trim().length > 0
        ? rawName.trim()
        : user.email?.split('@')[0] || 'Campus Student'

    const avatarUrl = (user.user_metadata?.avatar_url as string) || null

    const { data: created, error: insertErr } = await supabase
      .from('profiles')
      .insert({
        id: user.id,
        full_name: fullName,
        avatar_url: avatarUrl,
        skills: [],
        interests: [],
      })
      .select()
      .single()

    if (insertErr) {
      console.warn('[Community] Could not auto-create profile:', insertErr.message)
      return null
    }

    return created as Profile
  } catch (err) {
    console.warn('[Community] ensureProfileExists failed:', err)
    return null
  }
}

/**
 * Fetches all community posts ordered by creation date descending.
 */
export async function fetchPosts(
  currentUserId?: string,
  options?: { signal?: AbortSignal }
): Promise<{ posts: Post[]; error: string | null; isPendingSchema: boolean }> {
  try {
    const supabase = getSupabase()

    let query = supabase
      .from('posts')
      .select(`
        id,
        user_id,
        content,
        image_url,
        created_at,
        updated_at,
        profiles:user_id (
          id,
          full_name,
          avatar_url,
          university,
          bio,
          skills,
          interests
        ),
        post_likes (
          id,
          user_id
        ),
        comments (
          id,
          post_id,
          user_id,
          content,
          created_at,
          profiles:user_id (
            id,
            full_name,
            avatar_url,
            university
          )
        )
      `)
      .order('created_at', { ascending: false })

    if (options?.signal) {
      query = query.abortSignal(options.signal)
    }

    const { data, error } = await query

    if (error) {
      if (options?.signal?.aborted || error.message?.toLowerCase().includes('aborted')) {
        return { posts: [], error: null, isPendingSchema: false }
      }
      const isPending = isSchemaPendingError(error)
      return {
        posts: [],
        error: error.message,
        isPendingSchema: isPending,
      }
    }

    interface RawComment {
      id: string
      post_id: string
      user_id: string
      content: string
      created_at: string
      profiles: AuthorProfileSummary | AuthorProfileSummary[] | null
    }

    interface RawPostRow {
      id: string
      user_id: string
      content: string
      image_url: string | null
      created_at: string
      updated_at: string
      profiles: AuthorProfileSummary | AuthorProfileSummary[] | null
      post_likes: { id: string; user_id: string }[] | null
      comments: RawComment[] | null
    }

    const posts: Post[] = ((data as unknown as RawPostRow[]) || []).map((row) => {
      const likes = row.post_likes || []
      const rawComments = row.comments || []

      const sortedComments: Comment[] = rawComments
        .map((c) => {
          const rawCProfile = Array.isArray(c.profiles)
            ? (c.profiles.length > 0 ? c.profiles[0] : null)
            : c.profiles

          const commentAuthor: AuthorProfileSummary | null = rawCProfile
            ? {
                id: rawCProfile.id || c.user_id,
                full_name:
                  typeof rawCProfile.full_name === 'string' && rawCProfile.full_name.trim().length > 0
                    ? rawCProfile.full_name.trim()
                    : 'Campus Student',
                avatar_url: rawCProfile.avatar_url || null,
                university: rawCProfile.university || null,
              }
            : null

          return {
            id: c.id,
            post_id: c.post_id,
            user_id: c.user_id,
            content: c.content || '',
            created_at: c.created_at || new Date().toISOString(),
            profile: commentAuthor,
          }
        })
        .sort((a, b) => {
          const timeA = a.created_at ? new Date(a.created_at).getTime() : 0
          const timeB = b.created_at ? new Date(b.created_at).getTime() : 0
          return timeA - timeB
        })

      const rawProfile = Array.isArray(row.profiles)
        ? (row.profiles.length > 0 ? row.profiles[0] : null)
        : row.profiles

      const postAuthor: AuthorProfileSummary | null = rawProfile
        ? {
            id: rawProfile.id || row.user_id,
            full_name:
              typeof rawProfile.full_name === 'string' && rawProfile.full_name.trim().length > 0
                ? rawProfile.full_name.trim()
                : 'Campus Student',
            avatar_url: rawProfile.avatar_url || null,
            university: rawProfile.university || null,
            bio: rawProfile.bio || null,
            skills: Array.isArray(rawProfile.skills) ? rawProfile.skills : [],
            interests: Array.isArray(rawProfile.interests) ? rawProfile.interests : [],
          }
        : null

      return {
        id: row.id,
        user_id: row.user_id,
        content: row.content || '',
        image_url: row.image_url || null,
        created_at: row.created_at || new Date().toISOString(),
        updated_at: row.updated_at || row.created_at || new Date().toISOString(),
        profile: postAuthor,
        likes_count: likes.length,
        has_liked: currentUserId
          ? likes.some((l) => l.user_id === currentUserId)
          : false,
        comments_count: sortedComments.length,
        comments: sortedComments,
      }
    })

    return { posts, error: null, isPendingSchema: false }
  } catch (err) {
    if (options?.signal?.aborted) {
      return { posts: [], error: null, isPendingSchema: false }
    }
    const errorMsg = err instanceof Error ? err.message : String(err)
    return {
      posts: [],
      error: errorMsg,
      isPendingSchema: isSchemaPendingError(err),
    }
  }
}

/**
 * Validates and uploads media to the 'community-media' storage bucket.
 * Uses authenticated user ID to enforce strict storage RLS ownership.
 */
export async function uploadPostMedia(
  file: File,
  _userId?: string
): Promise<{ url: string | null; filePath: string | null; error: string | null }> {
  const allowedMimeTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif',
  ]

  if (!file || !file.type || !allowedMimeTypes.includes(file.type.toLowerCase())) {
    return {
      url: null,
      filePath: null,
      error: 'Unsupported image format. Allowed formats: JPG, PNG, WebP, GIF.',
    }
  }

  // 5MB limit
  if (file.size > 5 * 1024 * 1024) {
    return {
      url: null,
      filePath: null,
      error: 'Image is too large. Maximum allowed size is 5MB.',
    }
  }

  try {
    const supabase = getSupabase()

    // Enforce that upload uses authenticated user's ID
    const { data: authData, error: authErr } = await supabase.auth.getUser()
    if (authErr || !authData?.user) {
      return {
        url: null,
        filePath: null,
        error: 'You must be signed in to upload media.',
      }
    }
    const verifiedUserId = authData.user.id

    const sanitizedExt = (file.name.split('.').pop() || 'jpg').toLowerCase()
    const uniqueId = Math.random().toString(36).substring(2, 9)
    const filePath = `${verifiedUserId}/${Date.now()}_${uniqueId}.${sanitizedExt}`

    const { error: uploadError } = await supabase.storage
      .from('community-media')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      })

    if (uploadError) {
      return { url: null, filePath: null, error: uploadError.message }
    }

    const { data: publicUrlData } = supabase.storage
      .from('community-media')
      .getPublicUrl(filePath)

    return { url: publicUrlData.publicUrl, filePath, error: null }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    return { url: null, filePath: null, error: errorMsg }
  }
}

/**
 * Creates a new post in the student community.
 * Enforces authenticated user ID from backend session and cleans up uploaded media
 * if post record insertion fails.
 */
export async function createPost({
  content,
  imageFile,
  userId: _clientUserId,
}: {
  content: string
  imageFile?: File | null
  userId?: string
}): Promise<{ post: Post | null; error: string | null }> {
  const trimmed = content.trim()
  if (!trimmed) {
    return { post: null, error: 'Post content cannot be empty.' }
  }
  if (trimmed.length > 3000) {
    return { post: null, error: 'Post content exceeds 3000 characters.' }
  }

  const supabase = getSupabase()

  // Requirement 7: Never trust user ID provided by client. Get verified ID from session.
  const { data: authData, error: authErr } = await supabase.auth.getUser()
  if (authErr || !authData?.user) {
    return { post: null, error: 'You must be signed in to publish a post.' }
  }
  const verifiedUserId = authData.user.id

  let imageUrl: string | null = null
  let uploadedFilePath: string | null = null

  if (imageFile) {
    const uploadRes = await uploadPostMedia(imageFile, verifiedUserId)
    if (uploadRes.error) {
      return { post: null, error: `Image upload failed: ${uploadRes.error}` }
    }
    imageUrl = uploadRes.url
    uploadedFilePath = uploadRes.filePath
  }

  try {
    const { data, error } = await supabase
      .from('posts')
      .insert({
        user_id: verifiedUserId,
        content: trimmed,
        image_url: imageUrl,
      })
      .select(`
        id,
        user_id,
        content,
        image_url,
        created_at,
        updated_at,
        profiles:user_id (
          id,
          full_name,
          avatar_url,
          university,
          bio,
          skills,
          interests
        )
      `)
      .single()

    if (error) {
      // Requirement 12: If upload succeeded but saving post failed, clean up storage safely
      if (uploadedFilePath) {
        try {
          await supabase.storage.from('community-media').remove([uploadedFilePath])
        } catch (cleanupErr) {
          console.warn('[Community] Failed to clean up orphaned media:', cleanupErr)
        }
      }
      return { post: null, error: error.message }
    }

    const rawProfile = Array.isArray(data.profiles)
      ? (data.profiles.length > 0 ? data.profiles[0] : null)
      : data.profiles

    const postAuthor: AuthorProfileSummary = rawProfile
      ? {
          id: rawProfile.id || verifiedUserId,
          full_name:
            typeof rawProfile.full_name === 'string' && rawProfile.full_name.trim().length > 0
              ? rawProfile.full_name.trim()
              : 'Campus Student',
          avatar_url: rawProfile.avatar_url || null,
          university: rawProfile.university || null,
          bio: rawProfile.bio || null,
          skills: Array.isArray(rawProfile.skills) ? rawProfile.skills : [],
          interests: Array.isArray(rawProfile.interests) ? rawProfile.interests : [],
        }
      : {
          id: verifiedUserId,
          full_name: 'Campus Student',
          avatar_url: null,
          university: null,
          skills: [],
          interests: [],
        }

    const newPost: Post = {
      id: data.id,
      user_id: data.user_id,
      content: data.content,
      image_url: data.image_url,
      created_at: data.created_at,
      updated_at: data.updated_at,
      profile: postAuthor,
      likes_count: 0,
      has_liked: false,
      comments_count: 0,
      comments: [],
    }

    return { post: newPost, error: null }
  } catch (err) {
    // Clean up uploaded media on unexpected catch
    if (uploadedFilePath) {
      try {
        await supabase.storage.from('community-media').remove([uploadedFilePath])
      } catch (cleanupErr) {
        console.warn('[Community] Failed to clean up orphaned media on catch:', cleanupErr)
      }
    }
    const errorMsg = err instanceof Error ? err.message : String(err)
    return { post: null, error: errorMsg }
  }
}

/**
 * Deletes a post belonging to the authenticated student.
 * Enforces session user ID to prevent trusting client-provided user IDs.
 * Automatically cleans up any attached media file from community-media storage.
 */
export async function deletePost(
  postId: string,
  _clientUserId?: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    const supabase = getSupabase()

    // Enforce server session user ID - Never trust client-supplied ID
    const { data: authData, error: authErr } = await supabase.auth.getUser()
    if (authErr || !authData?.user) {
      return { success: false, error: 'You must be signed in to delete a post.' }
    }
    const verifiedUserId = authData.user.id

    // Fetch post to check for attached media before deletion
    const { data: postData } = await supabase
      .from('posts')
      .select('image_url')
      .eq('id', postId)
      .eq('user_id', verifiedUserId)
      .maybeSingle()

    const { error } = await supabase
      .from('posts')
      .delete()
      .eq('id', postId)
      .eq('user_id', verifiedUserId)

    if (error) {
      return { success: false, error: error.message }
    }

    // Clean up attached image from storage if present
    if (postData?.image_url && postData.image_url.includes('community-media/')) {
      try {
        const parts = postData.image_url.split('community-media/')
        if (parts.length > 1) {
          const filePath = decodeURIComponent(parts[1])
          await supabase.storage.from('community-media').remove([filePath])
        }
      } catch (cleanupErr) {
        console.warn('[Community] Failed to clean up post media on delete:', cleanupErr)
      }
    }

    return { success: true, error: null }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    return { success: false, error: errorMsg }
  }
}

/**
 * Toggles like / unlike for a post by the authenticated user.
 * Resolves session user ID to enforce server-side authentication (never trusts client userId).
 * Returns fresh, accurate likes count and hasLiked status to prevent count drift.
 */
export async function togglePostLike(
  postId: string,
  _clientUserId?: string,
  currentlyLiked?: boolean
): Promise<{
  success: boolean
  likesCount?: number
  hasLiked?: boolean
  error: string | null
}> {
  try {
    const supabase = getSupabase()

    // Enforce server session user ID - Never trust client-supplied ID
    const { data: authData, error: authErr } = await supabase.auth.getUser()
    if (authErr || !authData?.user) {
      return { success: false, error: 'You must be signed in to like a post.' }
    }
    const verifiedUserId = authData.user.id

    // Determine current status if not provided
    let isCurrentlyLiked = currentlyLiked
    if (isCurrentlyLiked === undefined) {
      const { data: existingLike } = await supabase
        .from('post_likes')
        .select('id')
        .eq('post_id', postId)
        .eq('user_id', verifiedUserId)
        .maybeSingle()
      isCurrentlyLiked = !!existingLike
    }

    if (isCurrentlyLiked) {
      // Unlike post
      const { error } = await supabase
        .from('post_likes')
        .delete()
        .eq('post_id', postId)
        .eq('user_id', verifiedUserId)

      if (error) {
        return { success: false, error: error.message }
      }
    } else {
      // Like post
      const { error } = await supabase
        .from('post_likes')
        .insert({
          post_id: postId,
          user_id: verifiedUserId,
        })

      // If duplicate key (23505), it is already liked, which is idempotent success
      if (error && error.code !== '23505') {
        return { success: false, error: error.message }
      }
    }

    // Query exact fresh count from database to prevent race conditions & count drift
    const { count } = await supabase
      .from('post_likes')
      .select('id', { count: 'exact', head: true })
      .eq('post_id', postId)

    const finalCount = typeof count === 'number' ? count : 0
    const finalHasLiked = !isCurrentlyLiked

    return {
      success: true,
      likesCount: finalCount,
      hasLiked: finalHasLiked,
      error: null,
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    return { success: false, error: errorMsg }
  }
}

/**
 * Submits a new comment on a post.
 * Resolves session user ID to enforce server-side authentication (never trusts client userId).
 * Validates text length and whitespace.
 */
export async function addComment({
  postId,
  userId: _clientProvidedId,
  content,
}: {
  postId: string
  userId?: string
  content: string
}): Promise<{ comment: Comment | null; error: string | null }> {
  const trimmed = content.trim()
  if (!trimmed) {
    return { comment: null, error: 'Comment content cannot be empty.' }
  }
  if (trimmed.length > 1000) {
    return { comment: null, error: 'Comment cannot exceed 1000 characters.' }
  }

  try {
    const supabase = getSupabase()

    // Enforce server session user ID - Never trust client-supplied ID
    const { data: authData, error: authErr } = await supabase.auth.getUser()
    if (authErr || !authData?.user) {
      return { comment: null, error: 'You must be signed in to post a comment.' }
    }
    const verifiedUserId = authData.user.id

    const { data, error } = await supabase
      .from('comments')
      .insert({
        post_id: postId,
        user_id: verifiedUserId,
        content: trimmed,
      })
      .select(`
        id,
        post_id,
        user_id,
        content,
        created_at,
        profiles:user_id (
          id,
          full_name,
          avatar_url,
          university
        )
      `)
      .single()

    if (error) {
      return { comment: null, error: error.message }
    }

    const rawProfile = Array.isArray(data.profiles)
      ? (data.profiles.length > 0 ? data.profiles[0] : null)
      : data.profiles

    const commentAuthor: AuthorProfileSummary = rawProfile
      ? {
          id: rawProfile.id || verifiedUserId,
          full_name:
            typeof rawProfile.full_name === 'string' && rawProfile.full_name.trim().length > 0
              ? rawProfile.full_name.trim()
              : 'Campus Student',
          avatar_url: rawProfile.avatar_url || null,
          university: rawProfile.university || null,
        }
      : {
          id: verifiedUserId,
          full_name: 'Campus Student',
          avatar_url: null,
          university: null,
        }

    const newComment: Comment = {
      id: data.id,
      post_id: data.post_id,
      user_id: data.user_id,
      content: data.content,
      created_at: data.created_at,
      profile: commentAuthor,
    }

    return { comment: newComment, error: null }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    return { comment: null, error: errorMsg }
  }
}

/**
 * Deletes a comment belonging to the authenticated student.
 * Enforces ownership via auth.getUser() and RLS policy (auth.uid() = user_id).
 */
export async function deleteComment(
  commentId: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    const supabase = getSupabase()

    // Enforce server session user ID
    const { data: authData, error: authErr } = await supabase.auth.getUser()
    if (authErr || !authData?.user) {
      return { success: false, error: 'You must be signed in to delete a comment.' }
    }
    const verifiedUserId = authData.user.id

    const { error } = await supabase
      .from('comments')
      .delete()
      .eq('id', commentId)
      .eq('user_id', verifiedUserId)

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, error: null }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    return { success: false, error: errorMsg }
  }
}

/**
 * Fetches all comments for a post in chronological order (oldest first).
 */
export async function fetchPostComments(
  postId: string
): Promise<{ comments: Comment[]; error: string | null }> {
  try {
    const supabase = getSupabase()

    const { data, error } = await supabase
      .from('comments')
      .select(`
        id,
        post_id,
        user_id,
        content,
        created_at,
        profiles:user_id (
          id,
          full_name,
          avatar_url,
          university
        )
      `)
      .eq('post_id', postId)
      .order('created_at', { ascending: true })

    if (error) {
      return { comments: [], error: error.message }
    }

    interface RawCommentQuery {
      id: string
      post_id: string
      user_id: string
      content: string
      created_at: string
      profiles: AuthorProfileSummary | AuthorProfileSummary[] | null
    }

    const comments: Comment[] = ((data as unknown as RawCommentQuery[]) || []).map((c) => {
      const rawCProfile = Array.isArray(c.profiles)
        ? (c.profiles.length > 0 ? c.profiles[0] : null)
        : c.profiles

      const commentAuthor: AuthorProfileSummary | null = rawCProfile
        ? {
            id: rawCProfile.id || c.user_id,
            full_name:
              typeof rawCProfile.full_name === 'string' && rawCProfile.full_name.trim().length > 0
                ? rawCProfile.full_name.trim()
                : 'Campus Student',
            avatar_url: rawCProfile.avatar_url || null,
            university: rawCProfile.university || null,
          }
        : null

      return {
        id: c.id,
        post_id: c.post_id,
        user_id: c.user_id,
        content: c.content || '',
        created_at: c.created_at || new Date().toISOString(),
        profile: commentAuthor,
      }
    })

    return { comments, error: null }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    return { comments: [], error: errorMsg }
  }
}

/**
 * Fetches a student profile and their published posts.
 * If viewing own profile and record is missing, auto-ensures profile initialization.
 */
export async function fetchProfileWithPosts(
  userId: string | unknown,
  currentUserId?: string
): Promise<{
  profile: Profile | null
  posts: Post[]
  error: string | null
}> {
  try {
    const validUserId = normalizeUuid(userId)
    if (!validUserId) {
      return {
        profile: null,
        posts: [],
        error: 'Invalid student profile identifier. The specified profile does not exist.',
      }
    }

    const supabase = getSupabase()
    if (!supabase) {
      return {
        profile: null,
        posts: [],
        error: 'Backend client is not configured.',
      }
    }

    let { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', validUserId)
      .maybeSingle()

    // If viewing own profile and not found in table, ensure it exists from session
    const validCurrentUserId = normalizeUuid(currentUserId)
    if (!profileData && validCurrentUserId && validUserId === validCurrentUserId) {
      const { data: authData } = await supabase.auth.getUser()
      if (authData?.user) {
        profileData = await ensureProfileExists(authData.user)
        if (profileData) {
          profileError = null
        }
      }
    }

    if (profileError) {
      return { profile: null, posts: [], error: profileError.message }
    }

    if (!profileData) {
      return { profile: null, posts: [], error: 'Student profile not found.' }
    }

    // Fetch published posts by this student
    const { posts: allPosts } = await fetchPosts(validCurrentUserId || undefined)
    const userPosts = allPosts.filter((p) => p.user_id === validUserId)

    return {
      profile: profileData as Profile,
      posts: userPosts,
      error: null,
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    return { profile: null, posts: [], error: errorMsg }
  }
}

/**
 * Uploads a profile avatar photo to 'community-media' under the authenticated user's storage folder.
 * Enforces file types (JPG, PNG, WebP, GIF) and 5MB limit.
 */
export async function uploadAvatar(
  file: File
): Promise<{ url: string | null; filePath: string | null; error: string | null }> {
  return uploadPostMedia(file)
}

/**
 * Updates the authenticated user's profile information.
 * Enforces server-side authentication (never trusts client userId).
 * Validates text bounds: full_name (required, <=100), bio (<=500), university (<=120).
 */
export async function updateProfile(
  userId: string,
  updates: {
    full_name: string
    avatar_url?: string | null
    university?: string | null
    bio?: string | null
    skills?: string[]
    interests?: string[]
  }
): Promise<{ profile: Profile | null; error: string | null }> {
  try {
    const supabase = getSupabase()

    // Enforce server session user ID - Never trust client-supplied ID
    const { data: authData, error: authErr } = await supabase.auth.getUser()
    if (authErr || !authData?.user) {
      return { profile: null, error: 'You must be signed in to edit your profile.' }
    }
    const verifiedUserId = authData.user.id

    // Prevent unauthorized edits to another student's profile
    if (userId && userId !== verifiedUserId) {
      return {
        profile: null,
        error: "You are not authorized to edit another student's profile.",
      }
    }

    const trimmedName = updates.full_name.trim()
    if (!trimmedName) {
      return { profile: null, error: 'Full name cannot be empty.' }
    }
    if (trimmedName.length > 100) {
      return { profile: null, error: 'Full name cannot exceed 100 characters.' }
    }

    if (updates.bio && updates.bio.length > 500) {
      return { profile: null, error: 'Bio cannot exceed 500 characters.' }
    }

    if (updates.university && updates.university.length > 120) {
      return { profile: null, error: 'University name cannot exceed 120 characters.' }
    }

    const { data, error } = await supabase
      .from('profiles')
      .update({
        full_name: trimmedName,
        avatar_url: updates.avatar_url ?? null,
        university: updates.university ? updates.university.trim() : null,
        bio: updates.bio ? updates.bio.trim() : null,
        skills: updates.skills || [],
        interests: updates.interests || [],
        updated_at: new Date().toISOString(),
      })
      .eq('id', verifiedUserId)
      .select()
      .single()

    if (error) {
      return { profile: null, error: error.message }
    }

    return { profile: data as Profile, error: null }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    return { profile: null, error: errorMsg }
  }
}

/**
 * Fetches all student profiles for directory and search exploration.
 */
export async function fetchAllProfiles(): Promise<{ profiles: Profile[]; error: string | null }> {
  try {
    const supabase = getSupabase()
    if (!supabase) {
      return { profiles: [], error: 'Backend client is not configured.' }
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      return { profiles: [], error: error.message }
    }

    return { profiles: (data || []) as Profile[], error: null }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    return { profiles: [], error: errorMsg }
  }
}
