import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Filter, Plus } from 'lucide-react';
import { ALL_CATEGORIES, CATEGORY_STYLES } from '../data/mockPosts';
import { ContentPost, PostCategory } from '../types/calendar';

interface HeaderProps {
  selectedCategory: PostCategory | 'ALL';
  onSelectCategory: (category: PostCategory | 'ALL') => void;
  posts: ContentPost[];
  onCreatePost: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  selectedCategory,
  onSelectCategory,
  posts,
  onCreatePost,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const countByCategory = (cat: PostCategory | 'ALL') => {
    if (cat === 'ALL') return posts.length;
    return posts.filter((p) => p.category === cat).length;
  };

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-neutral-200/80">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4 sm:gap-8">
        <div className="flex items-center min-w-0">
          <span className="text-base sm:text-lg font-bold tracking-tight text-[#111113] whitespace-nowrap shrink-0">
            Content Plan: November
          </span>
        </div>

        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setDropdownOpen((prev) => !prev)}
              aria-haspopup="listbox"
              aria-expanded={dropdownOpen}
              className="h-10 px-3 sm:px-3.5 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 text-xs sm:text-sm font-medium text-[#111113] flex items-center gap-2 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111113] whitespace-nowrap shrink-0"
            >
              <Filter className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
              <span className="max-w-[120px] sm:max-w-[180px] truncate">
                {selectedCategory === 'ALL' ? 'All Categories' : selectedCategory}
              </span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-neutral-400 transition-transform duration-150 shrink-0 ${
                  dropdownOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {dropdownOpen && (
              <div
                role="listbox"
                aria-label="Filter posts by category"
                className="absolute right-0 mt-2 w-64 rounded-xl bg-white border border-neutral-200 shadow-lg py-1.5 z-50"
              >
                <button
                  type="button"
                  role="option"
                  aria-selected={selectedCategory === 'ALL'}
                  onClick={() => {
                    onSelectCategory('ALL');
                    setDropdownOpen(false);
                  }}
                  className={`w-full px-3.5 py-2.5 text-left text-sm flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                    selectedCategory === 'ALL'
                      ? 'bg-neutral-100/80 text-[#111113] font-semibold'
                      : 'text-neutral-700 hover:bg-neutral-50'
                  }`}
                >
                  <span className="flex items-center gap-2.5 truncate">
                    <span className="w-2.5 h-2.5 rounded-[3px] bg-[#111113] shrink-0" />
                    <span>All Categories</span>
                  </span>
                  <span className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-mono tabular-nums text-neutral-500">
                      {countByCategory('ALL')}
                    </span>
                    {selectedCategory === 'ALL' && (
                      <Check className="w-3.5 h-3.5 text-[#111113]" />
                    )}
                  </span>
                </button>

                <div className="my-1 border-t border-neutral-100" />

                {ALL_CATEGORIES.map((category) => {
                  const style = CATEGORY_STYLES[category];
                  const isActive = selectedCategory === category;
                  return (
                    <button
                      key={category}
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      onClick={() => {
                        onSelectCategory(category);
                        setDropdownOpen(false);
                      }}
                      className={`w-full px-3.5 py-2.5 text-left text-sm flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-neutral-100/80 text-[#111113] font-semibold'
                          : 'text-neutral-700 hover:bg-neutral-50'
                      }`}
                    >
                      <span className="flex items-center gap-2.5 min-w-0">
                        <span
                          className={`w-2.5 h-2.5 rounded-[3px] shrink-0 ${style.swatchColor}`}
                        />
                        <span className="truncate">{category}</span>
                      </span>
                      <span className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-mono tabular-nums text-neutral-500">
                          {countByCategory(category)}
                        </span>
                        {isActive && (
                          <Check className="w-3.5 h-3.5 text-[#111113]" />
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onCreatePost}
            className="h-10 px-3.5 sm:px-4 rounded-lg bg-[#111113] hover:bg-neutral-800 text-white text-xs sm:text-sm font-medium flex items-center gap-1.5 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111113] focus-visible:ring-offset-2 whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>Add Post</span>
          </button>
        </div>
      </div>
    </header>
  );
};
