"use client";
import { useState, useCallback, useEffect } from "react";
import { Search, X } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

type SearchResult = {
  sessions: Array<{
    id: string;
    mentorship_id: string;
    notes: string | null;
    session_date: string | null;
    created_at: string;
  }>;
  images: Array<{
    id: string;
    image_url: string;
    thumbnail_url: string | null;
    caption: string | null;
    session_note_id: string | null;
    mentorship_id: string;
    created_at: string;
  }>;
};

export function SearchBar({ className }: { className?: string }) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState<SearchResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const params = new URLSearchParams({ q: searchQuery });
      const response = await fetch(`/api/search?${params}`);
      
      if (response.ok) {
        const data = await response.json();
        setResults(data);
      } else {
        console.error("Search failed:", await response.text());
        setResults({ sessions: [], images: [] });
      }
    } catch (error) {
      console.error("Search error:", error);
      setResults({ sessions: [], images: [] });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let timer: NodeJS.Timeout;

    if (query.trim()) {
      setIsOpen(true);
      timer = setTimeout(() => {
        performSearch(query);
      }, 300); // 300ms debounce
    } else {
      setResults(null);
      setIsOpen(false);
    }

    return () => {
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [query, performSearch]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
  };

  const handleClear = () => {
    setQuery("");
    setResults(null);
    setIsOpen(false);
  };

  const stripHtml = (html: string | null) => {
    if (!html) return "";
    return html.replace(/<[^>]*>/g, "").trim();
  };

  const totalResults = (results?.sessions.length || 0) + (results?.images.length || 0);

  return (
    <div className={cn("relative", className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-neutral-500" size={18} />
        <input
          type="text"
          placeholder="Search notes and images..."
          value={query}
          onChange={handleInputChange}
          onFocus={() => query.trim() && setIsOpen(true)}
          className="w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-neutral-700 rounded-md bg-white dark:bg-neutral-900 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400"
        />
        {query && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-neutral-500 hover:text-gray-600 dark:hover:text-neutral-300"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Results dropdown */}
          <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-md shadow-lg z-50 max-h-96 overflow-y-auto">
            {isLoading ? (
              <div className="p-4 text-center text-gray-500 dark:text-neutral-400">
                Searching...
              </div>
            ) : query.trim() && results ? (
              totalResults > 0 ? (
                <div className="divide-y divide-gray-200 dark:divide-neutral-800">
                  {/* Sessions */}
                  {results.sessions.length > 0 && (
                    <div>
                      <div className="px-4 py-2 bg-gray-50 dark:bg-neutral-800 text-xs font-semibold text-gray-700 dark:text-neutral-300 uppercase">
                        Sessions ({results.sessions.length})
                      </div>
                      {results.sessions.slice(0, 5).map((session) => (
                        <Link
                          key={session.id}
                          href={`/sessions/${session.id}`}
                          onClick={() => setIsOpen(false)}
                          className="block px-4 py-3 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
                        >
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {session.session_date
                              ? new Date(session.session_date).toLocaleDateString()
                              : new Date(session.created_at).toLocaleDateString()}
                          </div>
                          <div className="text-xs text-gray-600 dark:text-neutral-400 mt-1 line-clamp-2">
                            {stripHtml(session.notes) || "No notes"}
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}

                  {/* Images */}
                  {results.images.length > 0 && (
                    <div>
                      <div className="px-4 py-2 bg-gray-50 dark:bg-neutral-800 text-xs font-semibold text-gray-700 dark:text-neutral-300 uppercase">
                        Images ({results.images.length})
                      </div>
                      {results.images.slice(0, 5).map((image) => (
                        <Link
                          key={image.id}
                          href={image.session_note_id ? `/sessions/${image.session_note_id}` : "/sessions"}
                          onClick={() => setIsOpen(false)}
                          className="block px-4 py-3 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
                        >
                          <div className="flex items-start gap-3">
                            {image.thumbnail_url && (
                              <img
                                src={image.thumbnail_url}
                                alt={image.caption || "Image"}
                                className="w-12 h-12 object-cover rounded"
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="text-xs text-gray-500 dark:text-neutral-400">
                                {new Date(image.created_at).toLocaleDateString()}
                              </div>
                              <div className="text-sm text-gray-900 dark:text-white mt-1 line-clamp-2">
                                {image.caption || "No caption"}
                              </div>
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}

                  {/* View all results */}
                  {totalResults > 10 && (
                    <div className="px-4 py-2 border-t border-gray-200 dark:border-neutral-800">
                      <Link
                        href={`/search?q=${encodeURIComponent(query)}`}
                        onClick={() => setIsOpen(false)}
                        className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
                      >
                        View all {totalResults} results →
                      </Link>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-4 text-center text-gray-500 dark:text-neutral-400">
                  No results found for &quot;{query}&quot;
                </div>
              )
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}

