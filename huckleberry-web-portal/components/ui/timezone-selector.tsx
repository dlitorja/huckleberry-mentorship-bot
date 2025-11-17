"use client";

import { useState, useEffect } from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

// Major timezones organized by region
const MAJOR_TIMEZONES = [
  // Americas
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "America/Phoenix", label: "Arizona (MST)" },
  { value: "America/Anchorage", label: "Alaska Time (AKT)" },
  { value: "America/Toronto", label: "Toronto (ET)" },
  { value: "America/Vancouver", label: "Vancouver (PT)" },
  { value: "America/Mexico_City", label: "Mexico City (CST)" },
  { value: "America/Sao_Paulo", label: "São Paulo (BRT)" },
  { value: "America/Buenos_Aires", label: "Buenos Aires (ART)" },
  
  // Europe
  { value: "Europe/London", label: "London (GMT/BST)" },
  { value: "Europe/Paris", label: "Paris (CET/CEST)" },
  { value: "Europe/Berlin", label: "Berlin (CET/CEST)" },
  { value: "Europe/Rome", label: "Rome (CET/CEST)" },
  { value: "Europe/Madrid", label: "Madrid (CET/CEST)" },
  { value: "Europe/Amsterdam", label: "Amsterdam (CET/CEST)" },
  { value: "Europe/Stockholm", label: "Stockholm (CET/CEST)" },
  { value: "Europe/Moscow", label: "Moscow (MSK)" },
  { value: "Europe/Istanbul", label: "Istanbul (TRT)" },
  
  // Asia
  { value: "Asia/Dubai", label: "Dubai (GST)" },
  { value: "Asia/Kolkata", label: "Mumbai/New Delhi (IST)" },
  { value: "Asia/Bangkok", label: "Bangkok (ICT)" },
  { value: "Asia/Singapore", label: "Singapore (SGT)" },
  { value: "Asia/Hong_Kong", label: "Hong Kong (HKT)" },
  { value: "Asia/Shanghai", label: "Shanghai (CST)" },
  { value: "Asia/Tokyo", label: "Tokyo (JST)" },
  { value: "Asia/Seoul", label: "Seoul (KST)" },
  { value: "Asia/Sydney", label: "Sydney (AEDT/AEST)" },
  { value: "Asia/Melbourne", label: "Melbourne (AEDT/AEST)" },
  
  // Oceania
  { value: "Pacific/Auckland", label: "Auckland (NZDT/NZST)" },
  { value: "Pacific/Honolulu", label: "Honolulu (HST)" },
];

interface TimezoneSelectorProps {
  value?: string;
  onChange: (timezone: string) => void;
  className?: string;
}

export function TimezoneSelector({ value, onChange, className }: TimezoneSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTimezone, setSelectedTimezone] = useState<string>(value || "");

  // Try to detect user's timezone on mount
  useEffect(() => {
    if (!value) {
      try {
        const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
        // Check if detected timezone is in our list
        const found = MAJOR_TIMEZONES.find(tz => tz.value === detected);
        if (found) {
          setSelectedTimezone(detected);
          onChange(detected);
        } else {
          // If not in list, use a default (ET)
          setSelectedTimezone("America/New_York");
          onChange("America/New_York");
        }
      } catch {
        // Fallback to ET if detection fails
        setSelectedTimezone("America/New_York");
        onChange("America/New_York");
      }
    }
  }, []);

  useEffect(() => {
    if (value) {
      setSelectedTimezone(value);
    }
  }, [value]);

  const selectedLabel = MAJOR_TIMEZONES.find(tz => tz.value === selectedTimezone)?.label || selectedTimezone;

  return (
    <div className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full flex items-center justify-between gap-2 border border-gray-300 dark:border-neutral-700 rounded-md px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 text-sm"
        )}
      >
        <span className="flex items-center gap-2">
          <Clock className="w-4 h-4" />
          {selectedLabel || "Select timezone"}
        </span>
        <svg
          className={cn("w-4 h-4 transition-transform", isOpen && "rotate-180")}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute z-50 mt-1 w-full bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-lg shadow-lg max-h-64 overflow-y-auto">
            {MAJOR_TIMEZONES.map((tz) => (
              <button
                key={tz.value}
                type="button"
                onClick={() => {
                  setSelectedTimezone(tz.value);
                  onChange(tz.value);
                  setIsOpen(false);
                }}
                className={cn(
                  "w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors",
                  selectedTimezone === tz.value && "bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 font-medium"
                )}
              >
                {tz.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

