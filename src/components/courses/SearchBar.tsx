"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { useListMorph } from "@/hooks/useListMorph";

interface SearchBarProps {
  initialQuery?: string;
}

export function SearchBar({ initialQuery = "" }: SearchBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(initialQuery);
  const morph = useListMorph();

  const handleSearch = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value.trim()) {
        params.set("q", value.trim());
      } else {
        params.delete("q");
      }
      morph(() => router.push(`/courses?${params.toString()}`));
    },
    [router, searchParams, morph],
  );

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            handleSearch(query);
          }
        }}
        onBlur={() => {
          if (query !== initialQuery) {
            handleSearch(query);
          }
        }}
        placeholder="Search courses…"
        aria-label="Search courses"
        className="w-full sm:w-96 rounded-lg border border-border bg-surface text-base sm:text-sm text-foreground placeholder-foreground-subtle px-3.5 py-2.5 pl-9 focus:outline-none focus:ring-2 focus:ring-ring transition-all"
      />
      <svg
        className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-subtle"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 104.5 4.5a7.5 7.5 0 0012.15 12.15z"
        />
      </svg>
    </div>
  );
}
