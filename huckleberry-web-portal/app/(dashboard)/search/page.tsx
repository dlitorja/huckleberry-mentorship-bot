"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

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
  query?: string;
  dateFrom?: string;
  dateTo?: string;
  tags?: string[];
};

export default function SearchResultsPage() {
  const searchParams = useSearchParams();
  const [results, setResults] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(true);
  const query = searchParams.get("q") || "";
  const dateFrom = searchParams.get("dateFrom") || "";
  const dateTo = searchParams.get("dateTo") || "";
  const tags = searchParams.get("tags")?.split(",").filter(Boolean) || [];

  useEffect(() => {
    async function performSearch() {
      if (!query && !dateFrom && !dateTo && tags.length === 0) {
        setResults({ sessions: [], images: [] });
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (query) params.append("q", query);
        if (dateFrom) params.append("dateFrom", dateFrom);
        if (dateTo) params.append("dateTo", dateTo);
        if (tags.length > 0) params.append("tags", tags.join(","));

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
        setLoading(false);
      }
    }

    performSearch();
  }, [query, dateFrom, dateTo, tags.join(",")]);

  const stripHtml = (html: string | null) => {
    if (!html) return "";
    return html.replace(/<[^>]*>/g, "").trim();
  };

  const totalResults = (results?.sessions.length || 0) + (results?.images.length || 0);

  if (loading) {
    return (
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Search Results</h1>
        <p className="text-sm text-gray-600 dark:text-neutral-400">Searching...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Search Results</h1>
        {(query || dateFrom || dateTo || tags.length > 0) && (
          <div className="text-sm text-gray-600 dark:text-neutral-400">
            {query && <span>Query: "{query}"</span>}
            {dateFrom && <span>{query ? " • " : ""}From: {dateFrom}</span>}
            {dateTo && <span> • To: {dateTo}</span>}
            {tags.length > 0 && <span> • Tags: {tags.join(", ")}</span>}
          </div>
        )}
        <p className="text-sm text-gray-600 dark:text-neutral-400 mt-1">
          Found {totalResults} result{totalResults !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Sessions */}
      {results && results.sessions.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
            Sessions ({results.sessions.length})
          </h2>
          <ul className="space-y-3">
            {results.sessions.map((session) => (
              <li
                key={session.id}
                className="p-4 rounded-md border border-gray-200 dark:border-neutral-900 bg-white dark:bg-neutral-950 hover:shadow-sm transition-shadow"
              >
                <Link
                  href={`/sessions/${session.id}`}
                  className="font-medium text-gray-900 dark:text-white hover:underline"
                >
                  {session.session_date
                    ? new Date(session.session_date).toLocaleDateString()
                    : new Date(session.created_at).toLocaleDateString()}
                </Link>
                <p className="text-sm text-gray-600 dark:text-neutral-400 line-clamp-3 mt-1">
                  {stripHtml(session.notes) || "No notes"}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Images */}
      {results && results.images.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
            Images ({results.images.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {results.images.map((image) => (
              <Link
                key={image.id}
                href={image.session_note_id ? `/sessions/${image.session_note_id}` : "/sessions"}
                className="p-4 rounded-md border border-gray-200 dark:border-neutral-900 bg-white dark:bg-neutral-950 hover:shadow-sm transition-shadow"
              >
                {image.thumbnail_url && (
                  <img
                    src={image.thumbnail_url}
                    alt={image.caption || "Image"}
                    className="w-full h-48 object-cover rounded mb-2"
                  />
                )}
                <div className="text-xs text-gray-500 dark:text-neutral-400">
                  {new Date(image.created_at).toLocaleDateString()}
                </div>
                <div className="text-sm text-gray-900 dark:text-white mt-1 line-clamp-2">
                  {image.caption || "No caption"}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* No Results */}
      {results && totalResults === 0 && (
        <div className="p-4 rounded-md border border-gray-200 dark:border-neutral-900 bg-white dark:bg-neutral-950">
          <div className="font-medium text-gray-900 dark:text-white">No results found</div>
          <p className="text-sm text-gray-600 dark:text-neutral-400 mt-1">
            Try adjusting your search query or filters.
          </p>
        </div>
      )}
    </div>
  );
}

