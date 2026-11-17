-- ==============================================================================
-- HackhIt — Student Social Feed Database Migration
-- Version: 20260401000000
-- Description: Creates student profiles, posts, post_likes, comments tables,
--              Row-Level Security (RLS) policies, triggers, storage config,
--              and schema cache reload.
-- Safe and repeatable: Idempotent operations, preserves existing data.
-- ==============================================================================

-- 1. PROFILES TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  avatar_url text,
  university text,
  bio text,
  skills text[] DEFAULT '{}'::text[],
  interests text[] DEFAULT '{}'::text[],
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Enable Row Level Security (RLS) on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles RLS Policies:
-- Any user (anonymous or authenticated) can view student profiles
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone"
  ON public.profiles FOR SELECT
  USING (true);

-- Authenticated students can insert their own profile
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Authenticated students can update only their own profile
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 2. AUTOMATIC PROFILE CREATION TRIGGER & BACKFILL
-- ------------------------------------------------------------------------------
-- Function to automatically provision a profile record on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    new.id,
    COALESCE(
      new.raw_user_meta_data->>'full_name',
      split_part(COALESCE(new.email, 'student@campus.edu'), '@', 1),
      'Campus Student'
    ),
    COALESCE(new.raw_user_meta_data->>'avatar_url', NULL)
  )
  ON CONFLICT (id) DO UPDATE
  SET
    full_name = EXCLUDED.full_name,
    avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
    updated_at = now();

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger to maintain updated_at on profiles
CREATE OR REPLACE FUNCTION public.set_current_timestamp_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  new.updated_at = now();
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS tr_profiles_updated_at ON public.profiles;
CREATE TRIGGER tr_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- Safe backfill: If any users already exist in auth.users, ensure their profile exists
INSERT INTO public.profiles (id, full_name, avatar_url)
SELECT
  u.id,
  COALESCE(
    u.raw_user_meta_data->>'full_name',
    split_part(COALESCE(u.email, 'student@campus.edu'), '@', 1),
    'Campus Student'
  ),
  COALESCE(u.raw_user_meta_data->>'avatar_url', NULL)
FROM auth.users u
ON CONFLICT (id) DO NOTHING;

-- 3. POSTS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (char_length(trim(content)) > 0 AND char_length(content) <= 3000),
  image_url text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS on posts
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- Posts RLS Policies:
-- Anyone can view community posts
DROP POLICY IF EXISTS "Posts are viewable by everyone" ON public.posts;
CREATE POLICY "Posts are viewable by everyone"
  ON public.posts FOR SELECT
  USING (true);

-- Authenticated students can create posts under their own account
DROP POLICY IF EXISTS "Authenticated users can create posts" ON public.posts;
CREATE POLICY "Authenticated users can create posts"
  ON public.posts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Students can update only their own posts
DROP POLICY IF EXISTS "Users can update their own posts" ON public.posts;
CREATE POLICY "Users can update their own posts"
  ON public.posts FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Students can delete only their own posts
DROP POLICY IF EXISTS "Users can delete their own posts" ON public.posts;
CREATE POLICY "Users can delete their own posts"
  ON public.posts FOR DELETE
  USING (auth.uid() = user_id);

-- Performance indexes for feed sorting and user lookups
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON public.posts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON public.posts (user_id);

DROP TRIGGER IF EXISTS tr_posts_updated_at ON public.posts;
CREATE TRIGGER tr_posts_updated_at
  BEFORE UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- 4. POST LIKES TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.post_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT unique_post_user_like UNIQUE (post_id, user_id)
);

-- Enable RLS on post_likes
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;

-- Likes RLS Policies:
-- Anyone can view likes
DROP POLICY IF EXISTS "Likes are viewable by everyone" ON public.post_likes;
CREATE POLICY "Likes are viewable by everyone"
  ON public.post_likes FOR SELECT
  USING (true);

-- Authenticated students can like a post under their own account
DROP POLICY IF EXISTS "Authenticated users can like posts" ON public.post_likes;
CREATE POLICY "Authenticated users can like posts"
  ON public.post_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Students can remove only their own likes
DROP POLICY IF EXISTS "Users can remove their own likes" ON public.post_likes;
CREATE POLICY "Users can remove their own likes"
  ON public.post_likes FOR DELETE
  USING (auth.uid() = user_id);

-- Indexes for post likes
CREATE INDEX IF NOT EXISTS idx_post_likes_post_id ON public.post_likes (post_id);
CREATE INDEX IF NOT EXISTS idx_post_likes_user_id ON public.post_likes (user_id);

-- 5. COMMENTS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (char_length(trim(content)) > 0 AND char_length(content) <= 1000),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS on comments
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- Comments RLS Policies:
-- Anyone can view comments
DROP POLICY IF EXISTS "Comments are viewable by everyone" ON public.comments;
CREATE POLICY "Comments are viewable by everyone"
  ON public.comments FOR SELECT
  USING (true);

-- Authenticated students can create comments under their own account
DROP POLICY IF EXISTS "Authenticated users can create comments" ON public.comments;
CREATE POLICY "Authenticated users can create comments"
  ON public.comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Students can delete only their own comments
DROP POLICY IF EXISTS "Users can delete their own comments" ON public.comments;
CREATE POLICY "Users can delete their own comments"
  ON public.comments FOR DELETE
  USING (auth.uid() = user_id);

-- Indexes for comments
CREATE INDEX IF NOT EXISTS idx_comments_post_id ON public.comments (post_id);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON public.comments (created_at ASC);

DROP TRIGGER IF EXISTS tr_comments_updated_at ON public.comments;
CREATE TRIGGER tr_comments_updated_at
  BEFORE UPDATE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- 6. STORAGE BUCKET FOR MEDIA UPLOADS
-- ------------------------------------------------------------------------------
-- Create bucket 'community-media' if it does not already exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'community-media',
  'community-media',
  true,
  5242880, -- 5 MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE
SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];

-- Storage RLS Policies on storage.objects:
-- Anyone can view public community media
DROP POLICY IF EXISTS "Community media is publicly accessible" ON storage.objects;
CREATE POLICY "Community media is publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'community-media');

-- Authenticated students can upload files to community-media
DROP POLICY IF EXISTS "Authenticated users can upload community media" ON storage.objects;
CREATE POLICY "Authenticated users can upload community media"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'community-media' AND
    auth.role() = 'authenticated'
  );

-- Users can update their own uploaded files
DROP POLICY IF EXISTS "Users can update own community media" ON storage.objects;
CREATE POLICY "Users can update own community media"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'community-media' AND
    auth.uid()::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'community-media' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can delete their own uploaded files
DROP POLICY IF EXISTS "Users can delete own community media" ON storage.objects;
CREATE POLICY "Users can delete own community media"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'community-media' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- 7. RELOAD SCHEMA CACHE
-- ------------------------------------------------------------------------------
-- Instructs PostgREST to instantly refresh its schema cache
NOTIFY pgrst, 'reload schema';
