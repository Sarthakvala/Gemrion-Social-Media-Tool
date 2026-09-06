export type Platform = 'IG' | 'FB' | 'X' | 'LI' | 'TT';

export const PLATFORMS: Platform[] = ['IG', 'FB', 'X', 'LI', 'TT'];

export const PLATFORM_NAMES: Record<Platform, string> = {
  IG: 'Instagram',
  FB: 'Facebook',
  X: 'X',
  LI: 'LinkedIn',
  TT: 'TikTok',
};

export type PostStatus = 'draft' | 'scheduled' | 'published' | 'failed';
export type Approval = 'pending' | 'approved' | 'changes_requested';
export type Role = 'agency' | 'client';

export interface Profile {
  id: string;
  email: string | null;
  full_name: string;
  role: Role;
}

export interface Client {
  id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface Post {
  id: string;
  client_id: string;
  title: string;
  copy: string;
  caption: string;
  hashtags: string;
  link: string;
  platforms: Platform[];
  scheduled_at: string | null;
  status: PostStatus;
  approval: Approval;
  enabled: boolean;
  image_url: string;
  slides: string[];
  video_url: string;
  published_at: string | null;
  publish_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface PostComment {
  id: string;
  post_id: string;
  user_id: string | null;
  body: string;
  created_at: string;
}

/**
 * Columns a client-role user may change. Mirrors the column GRANTs in
 * supabase/schema.sql - the database rejects anything outside this list, so
 * this constant is a convenience, not the enforcement.
 */
export const CLIENT_EDITABLE_FIELDS = [
  'caption',
  'copy',
  'hashtags',
  'approval',
] as const;
export type ClientEditableField = (typeof CLIENT_EDITABLE_FIELDS)[number];
