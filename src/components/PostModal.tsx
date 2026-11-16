import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  Calendar as CalendarIcon,
  Check,
  ChevronDown,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Film,
  Info,
  Link2,
  MessageSquare,
  Pause,
  Play,
  Send,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import {
  ALL_CATEGORIES,
  ALL_FORMATS,
  ALL_STATUSES,
  CATEGORY_STYLES,
  STATUS_STYLES,
  WORKSPACE_ID,
} from '../data/mockPosts';
import {
  addPostComment,
  getOrCreateClientSessionId,
  getSavedClientName,
  subscribeToComments,
  updatePostStatus,
  updatePostVideoUrl,
} from '../services/calendarService';
import {
  ContentPost,
  MediaFormat,
  PostCategory,
  PostComment,
  PostStatus,
} from '../types/calendar';
import { formatEmbedInputUrl, parseVideoUrl } from '../utils/videoEmbed';
import { FormatIcon } from './CalendarGrid';

interface PostModalProps {
  post: ContentPost | null;
  selectedDay: number;
  isNewPost: boolean;
  onClose: () => void;
  onSave: (post: ContentPost, isNew: boolean) => Promise<void>;
  onDelete: (postId: string) => Promise<void>;
}

type ModalTab = 'caption' | 'script' | 'reference';

const DEFAULT_FALLBACK_COVER =
  '/src/assets/images/post_services_carousel_1794827536776.jpg';

function formatCommentTime(ms: number): string {
  try {
    return new Intl.DateTimeFormat('uk-UA', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(ms));
  } catch {
    return '';
  }
}

export const PostModal: React.FC<PostModalProps> = ({
  post,
  selectedDay,
  isNewPost,
  onClose,
  onSave,
  onDelete,
}) => {
  const sessionId = useMemo(() => getOrCreateClientSessionId(), []);

  const initialDraft: ContentPost = useMemo(() => {
    if (post) return { ...post };
    const weekNumber = Math.min(4, Math.max(1, Math.ceil(selectedDay / 7)));
    return {
      id: `post-nov-${selectedDay}-${Date.now()}`,
      workspaceId: WORKSPACE_ID,
      day: selectedDay,
      weekNumber,
      title: '',
      category: PostCategory.Expert,
      format: MediaFormat.Reels,
      status: PostStatus.PendingApproval,
      durationOrSlides: '0:40',
      publishTime: '18:00',
      coverImage: DEFAULT_FALLBACK_COVER,
      videoUrl: '',
      referenceUrl: 'https://www.instagram.com/',
      referenceNote:
        'Додайте візуальний референс, опис кадрування або посилання на приклад для команди.',
      caption: '',
      script:
        '00:00 – 00:03 | ХУК\nПерша фраза або візуальний тригер.\n\n00:03 – 00:30 | ОСНОВНА ЧАСТИНА\nКлючові тези.\n\n00:30 – 00:40 | CTA\nЗаклик до дії.',
      authorId: sessionId,
    };
  }, [post, selectedDay, sessionId]);

  const [draft, setDraft] = useState<ContentPost>(initialDraft);
  const [createdInSession, setCreatedInSession] = useState<boolean>(!isNewPost);
  const [activeTab, setActiveTab] = useState<ModalTab>('caption');
  const [videoInput, setVideoInput] = useState<string>(initialDraft.videoUrl);
  const [isPlayingPreview, setIsPlayingPreview] = useState<boolean>(
    Boolean(initialDraft.videoUrl)
  );
  const [imageError, setImageError] = useState<boolean>(false);
  const [copiedCaption, setCopiedCaption] = useState<boolean>(false);
  const [downloadedNotice, setDownloadedNotice] = useState<boolean>(false);
  const [confirmDelete, setConfirmDelete] = useState<boolean>(false);
  const [previewProgress, setPreviewProgress] = useState<number>(28);
  const [savingStatus, setSavingStatus] = useState<boolean>(false);
  const [savingPost, setSavingPost] = useState<boolean>(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [mediaSavedNotice, setMediaSavedNotice] = useState<string | null>(null);

  // Real-time comments state
  const [comments, setComments] = useState<PostComment[]>([]);
  const [authorName, setAuthorName] = useState<string>(
    () => getSavedClientName() || 'Client'
  );
  const [commentText, setCommentText] = useState<string>('');
  const [sendingComment, setSendingComment] = useState<boolean>(false);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDraft(initialDraft);
    setCreatedInSession(!isNewPost);
    setVideoInput(initialDraft.videoUrl);
    setIsPlayingPreview(Boolean(initialDraft.videoUrl));
    setImageError(false);
    setActiveTab('caption');
    setConfirmDelete(false);
    setMediaError(null);
    setMediaSavedNotice(null);
  }, [initialDraft, isNewPost]);

  // Keep synced with real-time updates from other browsers/devices
  useEffect(() => {
    if (post) {
      setDraft((prev) => ({
        ...prev,
        status: post.status,
        videoUrl: post.videoUrl,
      }));
      setVideoInput(post.videoUrl);
      if (post.videoUrl) {
        setIsPlayingPreview(true);
      }
    }
  }, [post, post?.status, post?.videoUrl]);

  const activePostId = post?.id ?? (createdInSession ? draft.id : null);

  useEffect(() => {
    if (!activePostId) {
      setComments([]);
      return;
    }
    setCommentsError(null);
    const unsub = subscribeToComments(
      activePostId,
      (nextComments) => {
        setComments(nextComments);
      },
      (err) => {
        setCommentsError(err.message);
      }
    );
    return () => unsub();
  }, [activePostId]);

  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments.length]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (!isPlayingPreview) return;
    const interval = window.setInterval(() => {
      setPreviewProgress((prev) => (prev >= 100 ? 0 : prev + 2));
    }, 350);
    return () => window.clearInterval(interval);
  }, [isPlayingPreview]);

  const parsedEmbed = useMemo(() => parseVideoUrl(draft.videoUrl), [draft.videoUrl]);
  const liveInputPreview = useMemo(() => parseVideoUrl(videoInput), [videoInput]);
  const categoryStyle = CATEGORY_STYLES[draft.category];
  const statusStyle = STATUS_STYLES[draft.status];

  const handleStatusChange = async (newStatus: PostStatus) => {
    setDraft((prev) => ({ ...prev, status: newStatus }));
    if (createdInSession) {
      setSavingStatus(true);
      try {
        await updatePostStatus(draft.id, newStatus);
      } finally {
        setSavingStatus(false);
      }
    }
  };

  const handleApplyVideoUrl = async () => {
    setMediaError(null);
    const trimmed = videoInput.trim();
    if (!trimmed) {
      await handleClearExternalLink();
      return;
    }

    const parsed = parseVideoUrl(trimmed);
    if (!parsed.embedUrl) {
      setMediaError(
        'Please paste a valid Instagram (/p/ or /reel/), YouTube, Google Drive, Vimeo, or direct video/image URL.'
      );
      return;
    }

    const formatted = formatEmbedInputUrl(trimmed);
    setVideoInput(formatted);
    setDraft((prev) => ({ ...prev, videoUrl: formatted }));
    setIsPlayingPreview(true);

    if (createdInSession) {
      try {
        await updatePostVideoUrl(draft.id, formatted);
        setMediaSavedNotice(
          parsed.isInstagram
            ? 'Instagram /embed/ link saved'
            : parsed.isGoogleDrive
            ? 'Google Drive /preview link saved'
            : `${parsed.providerLabel} link saved`
        );
        window.setTimeout(() => setMediaSavedNotice(null), 2800);
      } catch (err) {
        setMediaError(err instanceof Error ? err.message : 'Could not save URL');
      }
    }
  };

  const handleClearExternalLink = async () => {
    setMediaError(null);
    setIsPlayingPreview(false);
    setVideoInput('');
    setDraft((prev) => ({ ...prev, videoUrl: '' }));
    if (createdInSession) {
      await updatePostVideoUrl(draft.id, '');
    }
  };

  const handleCopyCaption = async () => {
    const textToCopy =
      activeTab === 'script'
        ? draft.script
        : `${draft.title}\n\n${draft.caption}`;
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopiedCaption(true);
      window.setTimeout(() => setCopiedCaption(false), 1800);
    } catch {
      setCopiedCaption(false);
    }
  };

  const handleDownloadAsset = () => {
    const assetSummary = [
      `PODCASA CONTENT BRIEF — NOVEMBER ${draft.day}, 2026`,
      `Title: ${draft.title || 'Untitled Post'}`,
      `Category: ${draft.category}`,
      `Format: ${draft.format} (${draft.durationOrSlides})`,
      `Status: ${draft.status}`,
      `Publish Time: ${draft.publishTime}`,
      draft.videoUrl ? `External Media URL: ${draft.videoUrl}` : '',
      ``,
      `--- CAPTION / COPY ---`,
      draft.caption || '(No caption provided)',
      ``,
      `--- FULL SCRIPT ---`,
      draft.script || '(No script provided)',
    ]
      .filter(Boolean)
      .join('\n');

    const blob = new Blob([assetSummary], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const safeSlug = (draft.title || `november-${draft.day}`)
      .toLowerCase()
      .replace(/[^a-zа-яіїєґ0-9]+/gi, '-')
      .replace(/^-|-$/g, '');
    link.download = `podcasa-nov-${draft.day}-${safeSlug || 'asset'}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setDownloadedNotice(true);
    window.setTimeout(() => setDownloadedNotice(false), 2200);
  };

  const handleSaveAndClose = async () => {
    setSavingPost(true);
    try {
      const formattedVideoUrl = draft.videoUrl
        ? formatEmbedInputUrl(draft.videoUrl)
        : '';
      const finalPost: ContentPost = {
        ...draft,
        videoUrl: formattedVideoUrl,
        title: draft.title.trim() || `Новий пост (${draft.day} листопада)`,
      };
      await onSave(finalPost, !createdInSession);
      onClose();
    } finally {
      setSavingPost(false);
    }
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = commentText.trim();
    if (!trimmed || !activePostId || sendingComment) return;

    setSendingComment(true);
    setCommentsError(null);
    try {
      await addPostComment(activePostId, trimmed, authorName);
      setCommentText('');
    } catch (err) {
      setCommentsError(
        err instanceof Error ? err.message : 'Failed to send comment'
      );
    } finally {
      setSendingComment(false);
    }
  };

  const showExternalEmbed = Boolean(parsedEmbed.embedUrl) && isPlayingPreview;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/55 backdrop-blur-sm overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-post-title"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: 8 }}
        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-5xl bg-white rounded-2xl border border-neutral-200 shadow-2xl overflow-hidden my-auto flex flex-col max-h-[92vh]"
      >
        {/* Top Modal Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-neutral-200/80 flex flex-wrap items-center justify-between gap-3 bg-neutral-50/70 shrink-0">
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
            <div className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[#111113] font-mono tabular-nums">
              <CalendarIcon className="w-4 h-4 text-neutral-500 shrink-0" />
              <span>November {draft.day}, 2026</span>
            </div>

            <span className="text-neutral-300" aria-hidden="true">
              /
            </span>

            <div className="relative">
              <select
                aria-label="Category"
                value={draft.category}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    category: e.target.value as PostCategory,
                  }))
                }
                className={`h-8 pl-2.5 pr-7 rounded-lg border text-xs font-semibold cursor-pointer appearance-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111113] ${categoryStyle.badgeBg} ${categoryStyle.badgeText} ${categoryStyle.badgeBorder}`}
              >
                {ALL_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 opacity-70" />
            </div>

            <div className="relative inline-flex items-center">
              <span className="pointer-events-none absolute left-2.5 text-[#111113]">
                <FormatIcon format={draft.format} />
              </span>
              <select
                aria-label="Format"
                value={draft.format}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    format: e.target.value as MediaFormat,
                  }))
                }
                className="h-8 pl-7 pr-7 rounded-lg border border-neutral-300 bg-white text-xs font-bold text-[#111113] shadow-[0_1px_1px_rgba(0,0,0,0.04)] cursor-pointer appearance-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111113]"
              >
                {ALL_FORMATS.map((fmt) => (
                  <option key={fmt} value={fmt}>
                    {fmt}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 text-neutral-500" />
            </div>
          </div>

          <div className="flex items-center gap-2.5 ml-auto">
            <div className="flex items-center gap-2">
              <label
                htmlFor="post-status-select"
                className="hidden sm:inline text-xs font-medium text-neutral-500"
              >
                Status:
              </label>
              <div className="relative">
                <select
                  id="post-status-select"
                  value={draft.status}
                  disabled={savingStatus}
                  onChange={(e) =>
                    void handleStatusChange(e.target.value as PostStatus)
                  }
                  className={`h-9 pl-3 pr-8 rounded-lg border text-xs font-semibold cursor-pointer appearance-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111113] ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}
                >
                  {ALL_STATUSES.map((st) => (
                    <option key={st} value={st} className="bg-white text-[#111113]">
                      {st}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 opacity-75" />
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close modal"
              className="w-9 h-9 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-100 text-neutral-600 hover:text-[#111113] flex items-center justify-center transition-colors cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Modal Body */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 border-b border-neutral-200/80">
            {/* Left Column: Sleek Vertical 9:16 Media Player & External Link Bar */}
            <div className="lg:col-span-5 p-5 sm:p-6 border-b lg:border-b-0 lg:border-r border-neutral-200/80 flex flex-col gap-4 bg-white">
              {/* Vertical 9:16 Mobile Video / Reels Player Container */}
              <div className="w-full flex justify-center bg-neutral-100/70 rounded-2xl py-3 px-4 border border-neutral-200/70">
                {showExternalEmbed && parsedEmbed.embedUrl ? (
                  parsedEmbed.type === 'direct' ? (
                    <div className="relative aspect-[9/16] w-full max-w-[260px] max-h-[460px] rounded-xl overflow-hidden bg-black border border-neutral-900/15 shadow-md">
                      <video
                        src={parsedEmbed.embedUrl}
                        controls
                        autoPlay
                        playsInline
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : parsedEmbed.type === 'image' ? (
                    <div className="relative aspect-[9/16] w-full max-w-[260px] max-h-[460px] rounded-xl overflow-hidden bg-[#0E0E11] border border-neutral-900/15 shadow-md">
                      <img
                        src={parsedEmbed.embedUrl}
                        alt={draft.title || 'External Media Preview'}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : parsedEmbed.type === 'instagram' ? (
                    <div className="relative aspect-[9/16] w-full max-w-[330px] max-h-[520px] rounded-xl overflow-hidden bg-white border border-neutral-200 shadow-md flex flex-col">
                      <div className="px-3 py-1.5 bg-[#111113] text-white flex items-center justify-between gap-2 text-[11px] shrink-0">
                        <span className="font-medium truncate">Instagram</span>
                        {parsedEmbed.canonicalUrl && (
                          <a
                            href={parsedEmbed.canonicalUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-white/85 hover:text-white font-semibold shrink-0"
                          >
                            <span>Open</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                      <iframe
                        src={parsedEmbed.embedUrl}
                        title={draft.title || 'Instagram Embed'}
                        className="w-full flex-1 border-0 bg-white pointer-events-auto relative z-10"
                        allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
                        referrerPolicy="strict-origin-when-cross-origin"
                        allowFullScreen
                      />
                    </div>
                  ) : parsedEmbed.type === 'drive' ? (
                    <div className="relative aspect-[9/16] w-full max-w-[260px] max-h-[460px] rounded-xl overflow-hidden bg-black border border-neutral-200 shadow-md flex flex-col">
                      <div className="px-3 py-1.5 bg-[#111113] text-white flex items-center justify-between gap-2 text-[11px] shrink-0">
                        <span className="font-medium truncate">Google Drive</span>
                        {parsedEmbed.canonicalUrl && (
                          <a
                            href={parsedEmbed.canonicalUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-white/85 hover:text-white font-semibold shrink-0"
                          >
                            <span>Open</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                      <iframe
                        src={parsedEmbed.embedUrl}
                        title={draft.title || 'Google Drive Media'}
                        className="w-full flex-1 border-0 bg-black"
                        allow="autoplay; fullscreen"
                        allowFullScreen
                      />
                    </div>
                  ) : (
                    <div className="relative aspect-[9/16] w-full max-w-[260px] max-h-[460px] rounded-xl overflow-hidden bg-black border border-neutral-900/15 shadow-md">
                      <iframe
                        src={parsedEmbed.embedUrl}
                        title={draft.title || 'Embedded Media Player'}
                        className="w-full h-full border-0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  )
                ) : (
                  <div className="relative aspect-[9/16] w-full max-w-[260px] max-h-[460px] rounded-xl overflow-hidden bg-[#0E0E11] border border-neutral-900/15 shadow-md group">
                    {!imageError && draft.coverImage ? (
                      <img
                        src={draft.coverImage}
                        alt={
                          draft.title ||
                          `Media preview for November ${draft.day}`
                        }
                        referrerPolicy="no-referrer"
                        onError={() => setImageError(true)}
                        className={`w-full h-full object-cover transition-transform duration-500 ${
                          isPlayingPreview
                            ? 'scale-[1.03]'
                            : 'group-hover:scale-[1.02]'
                        }`}
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-[#17171B] via-[#1F1F26] to-[#111113] flex flex-col items-center justify-center p-5 text-center">
                        <Film className="w-8 h-8 text-neutral-400 mb-2" />
                        <p className="text-sm font-semibold text-white">
                          {draft.title || 'Studio Media Preview'}
                        </p>
                        <p className="text-xs text-neutral-400 mt-1">
                          {draft.format} · {draft.durationOrSlides}
                        </p>
                      </div>
                    )}

                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/25 pointer-events-none" />

                    <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-1.5 text-[11px] text-white/95">
                      <span className="px-2 py-1 rounded-md bg-black/55 backdrop-blur-md font-mono tabular-nums border border-white/10 inline-flex items-center gap-1">
                        <FormatIcon format={draft.format} />
                        <span>{draft.format}</span>
                      </span>
                      <span className="px-2 py-1 rounded-md bg-black/55 backdrop-blur-md font-mono tabular-nums border border-white/10">
                        {draft.durationOrSlides}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsPlayingPreview((prev) => !prev)}
                      aria-label={
                        isPlayingPreview
                          ? 'Pause media preview'
                          : 'Play media preview'
                      }
                      className="absolute inset-0 flex items-center justify-center cursor-pointer group/play focus-visible:outline-none"
                    >
                      <span className="w-12 h-12 rounded-full bg-white/95 hover:bg-white text-[#111113] shadow-xl flex items-center justify-center transition-transform duration-150 group-hover/play:scale-105">
                        {isPlayingPreview ? (
                          <Pause className="w-4 h-4 fill-current" />
                        ) : (
                          <Play className="w-4 h-4 fill-current ml-0.5" />
                        )}
                      </span>
                    </button>

                    <div className="absolute bottom-0 inset-x-0 px-3 py-3 flex flex-col gap-1.5">
                      <div className="flex items-center justify-between text-[10px] font-mono tabular-nums text-white/85">
                        <span>
                          {isPlayingPreview ? 'Playing Preview' : '9:16 Vertical Preview'}
                        </span>
                        <span>{draft.publishTime}</span>
                      </div>
                      <div className="w-full h-1 rounded-full bg-white/25 overflow-hidden">
                        <div
                          className="h-full bg-white transition-all duration-300"
                          style={{
                            width: `${isPlayingPreview ? previewProgress : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* External Media Link Input Box + Disclaimer */}
              <div className="rounded-xl border border-neutral-200 bg-neutral-50/70 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="video-embed-input"
                    className="text-xs font-semibold text-[#111113]"
                  >
                    External Media Link
                  </label>
                  <span className="text-[11px] text-neutral-500">
                    Drive · Shorts · Reels
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Link2 className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="video-embed-input"
                      type="url"
                      value={videoInput}
                      onChange={(e) => {
                        setVideoInput(e.target.value);
                        setMediaError(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          void handleApplyVideoUrl();
                        }
                      }}
                      placeholder="Paste Google Drive, YouTube Shorts, or Instagram URL..."
                      className="w-full h-10 pl-8 pr-3 rounded-lg border border-neutral-200 bg-white text-xs text-[#111113] placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-[#111113]"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleApplyVideoUrl()}
                    className="h-10 px-4 rounded-lg bg-[#111113] hover:bg-neutral-800 text-white text-xs font-semibold transition-colors cursor-pointer shrink-0"
                  >
                    Embed
                  </button>
                  {draft.videoUrl && (
                    <button
                      type="button"
                      onClick={() => void handleClearExternalLink()}
                      className="h-10 px-3 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-100 text-xs font-medium text-neutral-600 cursor-pointer shrink-0"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Elegant Media Disclaimer Hint */}
                <p className="text-[11px] leading-relaxed text-neutral-500 flex items-start gap-1.5">
                  <Info className="w-3.5 h-3.5 text-neutral-400 shrink-0 mt-0.5" />
                  <span>
                    For seamless client preview without Instagram login blocks, use public Google Drive or YouTube Shorts links.
                  </span>
                </p>

                {liveInputPreview.isInstagram && liveInputPreview.embedUrl && (
                  <p className="text-[11px] text-emerald-700 font-medium">
                    Instagram link formatted:{' '}
                    <span className="font-mono break-all">
                      {liveInputPreview.embedUrl}
                    </span>
                  </p>
                )}

                {liveInputPreview.isGoogleDrive && liveInputPreview.embedUrl && (
                  <p className="text-[11px] text-emerald-700 font-medium">
                    Google Drive link formatted:{' '}
                    <span className="font-mono break-all">
                      {liveInputPreview.embedUrl}
                    </span>
                  </p>
                )}

                {mediaError && (
                  <p className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                    {mediaError}
                  </p>
                )}
                {mediaSavedNotice && (
                  <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 shrink-0" />
                    <span>{mediaSavedNotice}</span>
                  </p>
                )}
              </div>

              {/* Assets Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={handleDownloadAsset}
                  className="h-10 px-3 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 text-xs font-semibold text-[#111113] flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                >
                  {downloadedNotice ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span className="text-emerald-700">Downloaded</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-3.5 h-3.5 text-neutral-600 shrink-0" />
                      <span>Download Brief</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setActiveTab((prev) =>
                      prev === 'reference' ? 'caption' : 'reference'
                    )
                  }
                  className={`h-10 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                    activeTab === 'reference'
                      ? 'bg-[#111113] text-white border-[#111113]'
                      : 'border-neutral-200 bg-white hover:bg-neutral-50 text-[#111113]'
                  }`}
                >
                  <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                  <span>View Reference</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setActiveTab((prev) =>
                      prev === 'script' ? 'caption' : 'script'
                    )
                  }
                  className={`h-10 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                    activeTab === 'script'
                      ? 'bg-[#111113] text-white border-[#111113]'
                      : 'border-neutral-200 bg-white hover:bg-neutral-50 text-[#111113]'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5 shrink-0" />
                  <span>Read Full Script</span>
                </button>
              </div>
            </div>

            {/* Right Column: Title, Copy, Script, Reference, Save */}
            <div className="lg:col-span-7 p-5 sm:p-6 flex flex-col justify-between gap-4 bg-white">
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="modal-post-title"
                    className="block text-xs font-semibold text-neutral-500 mb-1"
                  >
                    Post Topic / Title
                  </label>
                  <input
                    id="modal-post-title"
                    type="text"
                    value={draft.title}
                    onChange={(e) =>
                      setDraft((prev) => ({ ...prev, title: e.target.value }))
                    }
                    placeholder="Напр.: 5 причин записувати подкаст"
                    className="w-full text-lg sm:text-xl font-bold tracking-tight text-[#111113] bg-transparent border-b border-neutral-200 pb-2 focus:border-[#111113] focus:outline-none placeholder:text-neutral-300"
                  />
                </div>

                <div className="flex items-center justify-between gap-2 border-b border-neutral-200/80 pb-2">
                  <div className="flex items-center gap-1 p-1 rounded-lg bg-neutral-100">
                    <button
                      type="button"
                      onClick={() => setActiveTab('caption')}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                        activeTab === 'caption'
                          ? 'bg-white text-[#111113] shadow-sm'
                          : 'text-neutral-600 hover:text-[#111113]'
                      }`}
                    >
                      Post Copy
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('script')}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                        activeTab === 'script'
                          ? 'bg-white text-[#111113] shadow-sm'
                          : 'text-neutral-600 hover:text-[#111113]'
                      }`}
                    >
                      Full Script
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('reference')}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                        activeTab === 'reference'
                          ? 'bg-white text-[#111113] shadow-sm'
                          : 'text-neutral-600 hover:text-[#111113]'
                      }`}
                    >
                      Reference
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleCopyCaption}
                    className="h-8 px-2.5 rounded-md text-xs font-medium text-neutral-600 hover:text-[#111113] hover:bg-neutral-100 flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                  >
                    {copiedCaption ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-700">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>

                {activeTab === 'caption' && (
                  <div className="space-y-1.5">
                    <textarea
                      aria-label="Post caption and description"
                      rows={11}
                      value={draft.caption}
                      onChange={(e) =>
                        setDraft((prev) => ({ ...prev, caption: e.target.value }))
                      }
                      placeholder="Напишіть текст посту або опис..."
                      className="w-full rounded-xl border border-neutral-200 bg-neutral-50/50 focus:bg-white p-3.5 text-sm leading-relaxed text-[#111113] placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-[#111113] resize-none"
                    />
                    <div className="flex items-center justify-between text-[11px] text-neutral-400 font-mono tabular-nums">
                      <span>Caption / Copy</span>
                      <span>{draft.caption.length} chars</span>
                    </div>
                  </div>
                )}

                {activeTab === 'script' && (
                  <textarea
                    aria-label="Full shooting script"
                    rows={12}
                    value={draft.script}
                    onChange={(e) =>
                      setDraft((prev) => ({ ...prev, script: e.target.value }))
                    }
                    placeholder="Таймкоди, хук, основна частина та CTA..."
                    className="w-full rounded-xl border border-neutral-200 bg-neutral-50/50 focus:bg-white p-3.5 text-xs sm:text-sm font-mono leading-relaxed text-[#111113] placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-[#111113] resize-none"
                  />
                )}

                {activeTab === 'reference' && (
                  <div className="rounded-xl border border-neutral-200 bg-neutral-50/60 p-4 space-y-3">
                    <div className="flex items-center gap-2 text-xs font-semibold text-[#111113]">
                      <Sparkles className="w-4 h-4 text-neutral-600" />
                      <span>Visual & Pacing Reference</span>
                    </div>
                    <textarea
                      aria-label="Reference notes"
                      rows={7}
                      value={draft.referenceNote}
                      onChange={(e) =>
                        setDraft((prev) => ({
                          ...prev,
                          referenceNote: e.target.value,
                        }))
                      }
                      className="w-full rounded-lg border border-neutral-200 bg-white p-3 text-sm leading-relaxed text-neutral-800 focus:outline-none focus:ring-2 focus:ring-[#111113] resize-none"
                    />
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <input
                        type="url"
                        aria-label="Reference source URL"
                        value={draft.referenceUrl}
                        onChange={(e) =>
                          setDraft((prev) => ({
                            ...prev,
                            referenceUrl: e.target.value,
                          }))
                        }
                        placeholder="https://instagram.com/..."
                        className="flex-1 h-9 px-3 rounded-lg border border-neutral-200 bg-white text-xs text-[#111113] focus:outline-none focus:ring-2 focus:ring-[#111113]"
                      />
                      {draft.referenceUrl && (
                        <a
                          href={draft.referenceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="h-9 px-3.5 rounded-lg bg-[#111113] hover:bg-neutral-800 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
                        >
                          <span>Open Link</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Post Save / Remove Bar */}
              <div className="pt-3 border-t border-neutral-100 flex items-center justify-between gap-3">
                {createdInSession ? (
                  confirmDelete ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          await onDelete(draft.id);
                          onClose();
                        }}
                        className="h-9 px-3 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition-colors cursor-pointer"
                      >
                        Confirm Delete
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(false)}
                        className="h-9 px-2.5 rounded-lg text-xs font-medium text-neutral-500 hover:text-[#111113] cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(true)}
                      className="h-9 px-3 rounded-lg text-xs font-medium text-neutral-500 hover:text-rose-600 hover:bg-rose-50 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove</span>
                    </button>
                  )
                ) : (
                  <span className="text-xs text-neutral-400">
                    Planning for Nov {draft.day}
                  </span>
                )}

                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={handleSaveAndClose}
                    disabled={savingPost}
                    className="h-10 px-5 rounded-lg bg-[#111113] hover:bg-neutral-800 disabled:opacity-60 text-white text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
                  >
                    {savingPost
                      ? 'Saving...'
                      : createdInSession
                      ? 'Save Changes'
                      : 'Add to Calendar'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Full-Width Real-Time Comments Section */}
          <div className="p-5 sm:p-6 bg-neutral-50/60 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-[#111113]" />
                <h3 className="text-sm font-bold text-[#111113]">
                  Client & Team Comments
                </h3>
                <span className="text-xs font-mono tabular-nums text-neutral-500">
                  ({comments.length})
                </span>
              </div>
              <span className="text-xs text-neutral-500">
                Real-time sync across all devices
              </span>
            </div>

            {commentsError && (
              <p className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                {commentsError}
              </p>
            )}

            {!createdInSession ? (
              <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-4 text-xs text-neutral-500 text-center">
                Click «Add to Calendar» above to save this post first, then start a real-time comment thread.
              </div>
            ) : (
              <>
                <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                  {comments.length === 0 ? (
                    <div className="rounded-xl border border-neutral-200/80 bg-white px-4 py-5 text-center text-xs text-neutral-500">
                      Поки немає коментарів. Залиште перший відгук або правку нижче.
                    </div>
                  ) : (
                    comments.map((comment) => {
                      const initials = comment.authorName
                        .split(' ')
                        .map((part) => part[0])
                        .join('')
                        .slice(0, 2)
                        .toUpperCase();
                      const isMine = comment.authorId === sessionId;
                      return (
                        <div
                          key={comment.id}
                          className={`rounded-xl border px-3.5 py-2.5 flex items-start gap-3 ${
                            isMine
                              ? 'bg-white border-neutral-300'
                              : 'bg-white border-neutral-200/80'
                          }`}
                        >
                          <div className="w-7 h-7 rounded-full bg-[#111113] text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                            {initials || 'C'}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-bold text-[#111113] truncate">
                                {comment.authorName}
                              </span>
                              <span className="text-[11px] font-mono tabular-nums text-neutral-400 shrink-0">
                                {formatCommentTime(comment.createdAtMs)}
                              </span>
                            </div>
                            <p className="text-sm text-neutral-700 leading-relaxed mt-0.5 whitespace-pre-wrap break-words">
                              {comment.text}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={commentsEndRef} />
                </div>

                <form
                  onSubmit={handleSubmitComment}
                  className="flex flex-col sm:flex-row sm:items-center gap-2 pt-1"
                >
                  <input
                    type="text"
                    aria-label="Your name"
                    value={authorName}
                    onChange={(e) => setAuthorName(e.target.value)}
                    placeholder="Your name"
                    maxLength={60}
                    className="w-full sm:w-36 h-10 px-3 rounded-xl border border-neutral-200 bg-white text-xs font-semibold text-[#111113] placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-[#111113]"
                  />
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="text"
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder="Напишіть коментар або зауваження щодо посту..."
                      maxLength={2000}
                      className="flex-1 h-10 px-3.5 rounded-xl border border-neutral-200 bg-white text-sm text-[#111113] placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-[#111113]"
                    />
                    <button
                      type="submit"
                      disabled={!commentText.trim() || sendingComment}
                      className="h-10 px-4 rounded-xl bg-[#111113] hover:bg-neutral-800 disabled:opacity-45 text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{sendingComment ? 'Sending...' : 'Send'}</span>
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};
