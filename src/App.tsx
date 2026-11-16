import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { RefreshCw } from 'lucide-react';
import { CalendarGrid } from './components/CalendarGrid';
import { Header } from './components/Header';
import { PostModal } from './components/PostModal';
import {
  ALL_CATEGORIES,
  ALL_STATUSES,
  CATEGORY_STYLES,
} from './data/mockPosts';
import {
  deletePostFromFirestore,
  initializeWorkspaceAndSeed,
  savePostToFirestore,
  subscribeToPosts,
} from './services/calendarService';
import { ContentPost, PostCategory, PostStatus } from './types/calendar';

interface ModalState {
  isOpen: boolean;
  day: number;
  postId: string | null;
  isNewPost: boolean;
}

export default function App() {
  const [posts, setPosts] = useState<ContentPost[]>([]);
  const [dbLoading, setDbLoading] = useState<boolean>(true);
  const [dbError, setDbError] = useState<string | null>(null);

  const [selectedCategory, setSelectedCategory] = useState<
    PostCategory | 'ALL'
  >('ALL');
  const [selectedStatus, setSelectedStatus] = useState<PostStatus | 'ALL'>(
    'ALL'
  );
  const [modalState, setModalState] = useState<ModalState>({
    isOpen: false,
    day: 2,
    postId: null,
    isNewPost: false,
  });

  useEffect(() => {
    let unsubPosts: (() => void) | null = null;
    let cancelled = false;

    async function bootWorkspace() {
      setDbLoading(true);
      setDbError(null);
      try {
        await initializeWorkspaceAndSeed();
        if (cancelled) return;
        unsubPosts = subscribeToPosts(
          (syncedPosts) => {
            setPosts(syncedPosts);
            setDbLoading(false);
          },
          (err) => {
            setDbError(err.message);
            setDbLoading(false);
          }
        );
      } catch (err) {
        if (!cancelled) {
          setDbError(
            err instanceof Error
              ? err.message
              : 'Failed to connect to real-time database.'
          );
          setDbLoading(false);
        }
      }
    }

    void bootWorkspace();

    return () => {
      cancelled = true;
      if (unsubPosts) unsubPosts();
    };
  }, []);

  const filteredPosts = useMemo(() => {
    return posts.filter((post) => {
      const catMatch =
        selectedCategory === 'ALL' || post.category === selectedCategory;
      const statusMatch =
        selectedStatus === 'ALL' || post.status === selectedStatus;
      return catMatch && statusMatch;
    });
  }, [posts, selectedCategory, selectedStatus]);

  const statusCounts = useMemo(() => {
    const counts: Record<PostStatus, number> = {
      [PostStatus.PendingApproval]: 0,
      [PostStatus.Approved]: 0,
      [PostStatus.Filmed]: 0,
      [PostStatus.Editing]: 0,
      [PostStatus.ReadyToPublish]: 0,
      [PostStatus.Published]: 0,
    };
    for (const post of posts) {
      if (counts[post.status] !== undefined) {
        counts[post.status] += 1;
      }
    }
    return counts;
  }, [posts]);

  const activeModalPost = useMemo(() => {
    if (!modalState.postId) return null;
    return posts.find((p) => p.id === modalState.postId) ?? null;
  }, [posts, modalState.postId]);

  const handleDayClick = (day: number, post?: ContentPost) => {
    if (post) {
      setModalState({
        isOpen: true,
        day,
        postId: post.id,
        isNewPost: false,
      });
    } else {
      setModalState({
        isOpen: true,
        day,
        postId: null,
        isNewPost: true,
      });
    }
  };

  const handleCreatePostClick = () => {
    const occupiedDays = new Set(posts.map((p) => p.day));
    let nextOpenDay = 28;
    for (let d = 1; d <= 30; d++) {
      if (!occupiedDays.has(d)) {
        nextOpenDay = d;
        break;
      }
    }
    setModalState({
      isOpen: true,
      day: nextOpenDay,
      postId: null,
      isNewPost: true,
    });
  };

  const handleSavePost = async (updatedPost: ContentPost, isNew: boolean) => {
    await savePostToFirestore(updatedPost, isNew);
  };

  const handleDeletePost = async (postId: string) => {
    await deletePostFromFirestore(postId);
  };

  const handleCloseModal = () => {
    setModalState((prev) => ({ ...prev, isOpen: false }));
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F7F8] text-[#111113]">
      <Header
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
        posts={posts}
        onCreatePost={handleCreatePostClick}
      />

      <main className="flex-1 w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-5">
        {/* Editorial Context Sub-Bar: Metadata & Category Legend */}
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs sm:text-sm text-neutral-500">
            <span className="font-semibold text-[#111113]">November 2026</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              {filteredPosts.length}{' '}
              {filteredPosts.length === 1 ? 'Post' : 'Posts'}
            </span>
            <span aria-hidden="true">·</span>
            <span>Client Presentation</span>
          </div>

          {/* Interactive Category Legend */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {ALL_CATEGORIES.map((category) => {
              const style = CATEGORY_STYLES[category];
              const isSelected = selectedCategory === category;
              return (
                <button
                  key={category}
                  type="button"
                  onClick={() =>
                    setSelectedCategory((prev) =>
                      prev === category ? 'ALL' : category
                    )
                  }
                  className={`inline-flex items-center gap-1.5 text-xs transition-opacity cursor-pointer whitespace-nowrap ${
                    selectedCategory !== 'ALL' && !isSelected
                      ? 'opacity-45 hover:opacity-80'
                      : 'opacity-100'
                  } ${
                    isSelected
                      ? 'font-bold text-[#111113] underline underline-offset-4'
                      : 'font-medium text-neutral-600 hover:text-[#111113]'
                  }`}
                >
                  <span
                    className={`w-2.5 h-2.5 rounded-[3px] shrink-0 ${style.swatchColor}`}
                  />
                  <span>{category}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Strict 6-State Workflow Status Filter Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setSelectedStatus('ALL')}
            className={`h-8 px-3 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              selectedStatus === 'ALL'
                ? 'bg-[#111113] text-white'
                : 'bg-white border border-neutral-200 text-neutral-600 hover:text-[#111113]'
            }`}
          >
            All Statuses ({posts.length})
          </button>
          {ALL_STATUSES.map((status) => {
            const active = selectedStatus === status;
            return (
              <button
                key={status}
                type="button"
                onClick={() =>
                  setSelectedStatus((prev) => (prev === status ? 'ALL' : status))
                }
                className={`h-8 px-3 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 font-mono tabular-nums ${
                  active
                    ? 'bg-[#111113] text-white'
                    : 'bg-white border border-neutral-200 text-neutral-600 hover:text-[#111113]'
                }`}
              >
                {status} ({statusCounts[status]})
              </button>
            );
          })}
        </div>

        {dbError && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-xs text-rose-700">
            Database connection warning: {dbError}
          </div>
        )}

        {dbLoading ? (
          <div className="bg-white rounded-2xl border border-neutral-200/90 p-12 flex flex-col items-center justify-center gap-3 text-sm text-neutral-500">
            <RefreshCw className="w-5 h-5 animate-spin text-[#111113]" />
            <span>Syncing 4-week calendar from Firestore...</span>
          </div>
        ) : (
          <>
            {filteredPosts.length === 0 && (
              <div className="bg-white rounded-xl border border-neutral-200 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[#111113]">
                    No posts match the active filters
                  </p>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Reset filters or click any day on the calendar to plan a new post.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategory('ALL');
                    setSelectedStatus('ALL');
                  }}
                  className="h-9 px-4 rounded-lg bg-[#111113] text-white text-xs font-semibold hover:bg-neutral-800 transition-colors cursor-pointer self-start sm:self-auto whitespace-nowrap"
                >
                  Reset Filters
                </button>
              </div>
            )}

            <CalendarGrid
              posts={filteredPosts}
              onDayClick={handleDayClick}
              todayDate={16}
            />
          </>
        )}
      </main>

      <footer className="max-w-[1440px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 border-t border-neutral-200/70 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-neutral-400">
        <span>Podcasa Real-Time Content Calendar · November 2026</span>
        <span>All status updates and comments sync automatically via Firestore</span>
      </footer>

      <AnimatePresence>
        {modalState.isOpen && (
          <PostModal
            post={activeModalPost}
            selectedDay={modalState.day}
            isNewPost={modalState.isNewPost}
            onClose={handleCloseModal}
            onSave={handleSavePost}
            onDelete={handleDeletePost}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
