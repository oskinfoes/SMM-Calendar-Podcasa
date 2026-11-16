export enum PostCategory {
  Expert = 'Експертний',
  Entertainment = 'Розважальний',
  BehindTheScenes = 'Закулісся',
  Sales = 'Продаючий',
}

export enum MediaFormat {
  Reels = 'Рілс',
  Video = 'Відео',
  Carousel = 'Карусель',
  Infographic = 'Інфографіка',
  AestheticVideo = 'Естетичне відео',
}

export enum PostStatus {
  PendingApproval = 'На затвердженні',
  Approved = 'Затверджено',
  Filmed = 'Знято',
  Editing = 'Редагується',
  ReadyToPublish = 'Чекає публікації',
  Published = 'Опубліковано',
}

export interface ContentPost {
  id: string;
  workspaceId: string;
  day: number;
  weekNumber: number;
  title: string;
  category: PostCategory;
  format: MediaFormat;
  status: PostStatus;
  durationOrSlides: string;
  publishTime: string;
  caption: string;
  script: string;
  referenceNote: string;
  referenceUrl: string;
  videoUrl: string;
  coverImage: string;
  authorId: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface PostComment {
  id: string;
  workspaceId: string;
  postId: string;
  authorId: string;
  authorName: string;
  authorPhotoUrl: string;
  text: string;
  createdAtMs: number;
}

export interface CategoryStyle {
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  swatchColor: string;
  cardBg: string;
  cardHoverBg: string;
}

export interface StatusStyle {
  bg: string;
  text: string;
  border: string;
}
