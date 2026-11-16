import React, { useMemo } from 'react';
import {
  BarChart3,
  CheckCircle2,
  Clock,
  Film,
  Layers,
  Plus,
  Send,
  Sparkles,
  Video,
} from 'lucide-react';
import { CATEGORY_STYLES, STATUS_STYLES } from '../data/mockPosts';
import { ContentPost, MediaFormat, PostStatus } from '../types/calendar';

interface CalendarGridProps {
  posts: ContentPost[];
  onDayClick: (day: number, post?: ContentPost) => void;
  todayDate?: number;
}

interface CalendarCell {
  day: number;
  inCurrentMonth: boolean;
  isWeekend: boolean;
  label: string;
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// November 2026 starts on Sunday (Nov 1).
// Monday-first grid: Oct 26–31 leading (6 cells), Nov 1–30 (30 cells), Dec 1–6 trailing (6 cells).
function buildNovember2026Grid(): CalendarCell[] {
  const cells: CalendarCell[] = [];
  for (let d = 26; d <= 31; d++) {
    const col = cells.length % 7;
    cells.push({
      day: d,
      inCurrentMonth: false,
      isWeekend: col >= 5,
      label: `Oct ${d}`,
    });
  }
  for (let d = 1; d <= 30; d++) {
    const col = cells.length % 7;
    cells.push({
      day: d,
      inCurrentMonth: true,
      isWeekend: col >= 5,
      label: `Nov ${d}`,
    });
  }
  for (let d = 1; d <= 6; d++) {
    const col = cells.length % 7;
    cells.push({
      day: d,
      inCurrentMonth: false,
      isWeekend: col >= 5,
      label: `Dec ${d}`,
    });
  }
  return cells;
}

export function FormatIcon({ format }: { format: MediaFormat }) {
  switch (format) {
    case MediaFormat.Carousel:
      return <Layers className="w-3 h-3 shrink-0" />;
    case MediaFormat.Video:
      return <Video className="w-3 h-3 shrink-0" />;
    case MediaFormat.Infographic:
      return <BarChart3 className="w-3 h-3 shrink-0" />;
    case MediaFormat.AestheticVideo:
      return <Sparkles className="w-3 h-3 shrink-0" />;
    default:
      return <Film className="w-3 h-3 shrink-0" />;
  }
}

function StatusMiniBadge({ status }: { status: PostStatus }) {
  const st = STATUS_STYLES[status];
  const Icon =
    status === PostStatus.Approved || status === PostStatus.Published
      ? CheckCircle2
      : status === PostStatus.ReadyToPublish
      ? Send
      : Clock;

  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[10px] font-semibold leading-none whitespace-nowrap ${st.bg} ${st.text} ${st.border}`}
    >
      <Icon className="w-2.5 h-2.5 shrink-0" />
      <span>{status}</span>
    </span>
  );
}

export const CalendarGrid: React.FC<CalendarGridProps> = ({
  posts,
  onDayClick,
  todayDate = 16,
}) => {
  const cells = useMemo(() => buildNovember2026Grid(), []);

  const postsByDay = useMemo(() => {
    const map = new Map<number, ContentPost[]>();
    for (const post of posts) {
      const existing = map.get(post.day) ?? [];
      existing.push(post);
      map.set(post.day, existing);
    }
    return map;
  }, [posts]);

  const novemberDays = useMemo(
    () => Array.from({ length: 30 }, (_, idx) => idx + 1),
    []
  );

  return (
    <>
      {/* Desktop & Tablet Full-Width Monthly Calendar Grid */}
      <div className="hidden md:block bg-white rounded-2xl border border-neutral-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.03)] overflow-hidden">
        <div className="grid grid-cols-7 border-b border-neutral-200/90 bg-neutral-50/70">
          {WEEKDAYS.map((dayName, idx) => (
            <div
              key={dayName}
              className={`px-3.5 py-3 text-xs font-semibold tracking-wide flex items-center justify-between ${
                idx >= 5 ? 'text-neutral-400' : 'text-neutral-600'
              } ${idx < 6 ? 'border-r border-neutral-200/70' : ''}`}
            >
              <span>{dayName}</span>
              {idx >= 5 && (
                <span className="text-[10px] font-normal text-neutral-400">
                  Weekend
                </span>
              )}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {cells.map((cell, idx) => {
            const colIndex = idx % 7;
            const rowIndex = Math.floor(idx / 7);
            const isLastCol = colIndex === 6;
            const isLastRow = rowIndex === 5;
            const dayPosts = cell.inCurrentMonth
              ? postsByDay.get(cell.day) ?? []
              : [];
            const isToday = cell.inCurrentMonth && cell.day === todayDate;

            if (!cell.inCurrentMonth) {
              return (
                <div
                  key={`${cell.label}-${idx}`}
                  className={`min-h-[154px] lg:min-h-[168px] p-2.5 bg-neutral-50/60 text-neutral-400 select-none ${
                    !isLastCol ? 'border-r border-neutral-200/70' : ''
                  } ${!isLastRow ? 'border-b border-neutral-200/70' : ''}`}
                >
                  <span className="text-xs font-mono tabular-nums font-medium">
                    {cell.label}
                  </span>
                </div>
              );
            }

            return (
              <div
                key={`nov-${cell.day}`}
                role="button"
                tabIndex={0}
                onClick={() => onDayClick(cell.day, dayPosts[0])}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onDayClick(cell.day, dayPosts[0]);
                  }
                }}
                aria-label={`November ${cell.day}${
                  dayPosts.length > 0
                    ? `, ${dayPosts.length} planned post: ${dayPosts[0].title}`
                    : ', click to plan a post'
                }`}
                className={`group relative min-h-[154px] lg:min-h-[168px] p-2.5 flex flex-col justify-between transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#111113] ${
                  cell.isWeekend && dayPosts.length === 0
                    ? 'bg-neutral-50/40 hover:bg-neutral-50'
                    : 'bg-white hover:bg-neutral-50/80'
                } ${!isLastCol ? 'border-r border-neutral-200/70' : ''} ${
                  !isLastRow ? 'border-b border-neutral-200/70' : ''
                }`}
              >
                {/* Day Number Header */}
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`inline-flex items-center justify-center text-xs font-mono tabular-nums font-semibold transition-colors ${
                      isToday
                        ? 'w-6 h-6 rounded-full bg-[#111113] text-white'
                        : cell.isWeekend
                        ? 'text-neutral-400'
                        : 'text-neutral-700 group-hover:text-[#111113]'
                    }`}
                  >
                    {cell.day}
                  </span>

                  {dayPosts.length === 0 && (
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 inline-flex items-center gap-1 text-[11px] font-medium text-neutral-400">
                      <Plus className="w-3 h-3" />
                      <span>Plan</span>
                    </span>
                  )}
                </div>

                {/* Planned Post Card with Visually Separated Format Badge, Category, Title & Status */}
                {dayPosts.length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    {dayPosts.map((post) => {
                      const catStyle = CATEGORY_STYLES[post.category];
                      return (
                        <button
                          key={post.id}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDayClick(cell.day, post);
                          }}
                          className={`w-full text-left rounded-xl p-2.5 border transition-all duration-150 cursor-pointer flex flex-col gap-2 ${catStyle.cardBg} ${catStyle.badgeBorder} ${catStyle.cardHoverBg} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111113]`}
                        >
                          {/* Row 1: Category label + Distinct Format Badge */}
                          <div className="flex items-center justify-between gap-1.5">
                            <span
                              className={`inline-flex items-center gap-1 text-[10px] font-semibold truncate ${catStyle.badgeText}`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-[2px] shrink-0 ${catStyle.swatchColor}`}
                              />
                              <span className="truncate">{post.category}</span>
                            </span>

                            {/* Visually Separated Format Badge */}
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white border border-neutral-300/90 text-[10px] font-bold text-[#111113] shadow-[0_1px_1px_rgba(0,0,0,0.04)] shrink-0">
                              <FormatIcon format={post.format} />
                              <span>{post.format}</span>
                            </span>
                          </div>

                          {/* Row 2: Post Title */}
                          <p className="text-xs font-bold leading-snug text-[#111113] line-clamp-2">
                            {post.title}
                          </p>

                          {/* Row 3: Workflow Status Badge */}
                          <div className="pt-1 border-t border-black/[0.06] flex items-center justify-between gap-1">
                            <StatusMiniBadge status={post.status} />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Mobile Responsive View */}
      <div className="md:hidden space-y-4">
        <div className="bg-white rounded-2xl border border-neutral-200/90 p-3.5 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
          <div className="grid grid-cols-7 mb-2 text-center">
            {WEEKDAYS.map((d) => (
              <span key={d} className="text-[11px] font-semibold text-neutral-400">
                {d}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={`pad-${i}`} className="h-11" />
            ))}
            {novemberDays.map((day) => {
              const dayPosts = postsByDay.get(day) ?? [];
              const hasPost = dayPosts.length > 0;
              const isToday = day === todayDate;
              const catStyle = hasPost
                ? CATEGORY_STYLES[dayPosts[0].category]
                : null;
              return (
                <button
                  key={`m-day-${day}`}
                  type="button"
                  onClick={() => onDayClick(day, dayPosts[0])}
                  className={`h-11 rounded-xl flex flex-col items-center justify-center gap-0.5 text-xs font-mono tabular-nums transition-colors cursor-pointer ${
                    hasPost && catStyle
                      ? `${catStyle.badgeBg} ${catStyle.badgeText} border ${catStyle.badgeBorder} font-bold`
                      : isToday
                      ? 'bg-[#111113] text-white font-bold'
                      : 'hover:bg-neutral-100 text-neutral-700'
                  }`}
                >
                  <span>{day}</span>
                  {hasPost && catStyle && (
                    <span
                      className={`w-3 h-1 rounded-[2px] ${catStyle.swatchColor}`}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Mobile Agenda List */}
        <div className="space-y-2.5">
          {posts
            .slice()
            .sort((a, b) => a.day - b.day)
            .map((post) => {
              const catStyle = CATEGORY_STYLES[post.category];
              return (
                <button
                  key={post.id}
                  type="button"
                  onClick={() => onDayClick(post.day, post)}
                  className="w-full text-left bg-white rounded-xl border border-neutral-200/90 p-3.5 flex items-start gap-3.5 hover:border-neutral-300 transition-colors cursor-pointer"
                >
                  <div className="w-12 h-12 rounded-lg bg-neutral-100 flex flex-col items-center justify-center shrink-0">
                    <span className="text-[10px] font-semibold text-neutral-500">
                      NOV
                    </span>
                    <span className="text-base font-mono tabular-nums font-bold text-[#111113]">
                      {post.day}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-semibold ${catStyle.badgeBg} ${catStyle.badgeText} ${catStyle.badgeBorder}`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-[2px] ${catStyle.swatchColor}`}
                        />
                        {post.category}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-neutral-300 text-[11px] font-bold text-[#111113]">
                        <FormatIcon format={post.format} />
                        <span>{post.format}</span>
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-[#111113] leading-snug">
                      {post.title}
                    </h3>
                    <div className="pt-0.5">
                      <StatusMiniBadge status={post.status} />
                    </div>
                  </div>
                </button>
              );
            })}
        </div>
      </div>
    </>
  );
};
