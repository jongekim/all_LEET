export interface Announcement {
  id: string;
  slug: string;
  title: string;
  content: string;
  banner_text: string;
  is_published: boolean;
  show_in_banner: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export type AnnouncementForm = Pick<
  Announcement,
  'title' | 'content' | 'banner_text' | 'is_published' | 'show_in_banner' | 'display_order'
>;
