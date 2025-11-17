"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Clock } from "lucide-react";

interface TimePickerProps {
  value?: string; // HH:mm format (24-hour)
  onChange: (time: string) => void;
  placeholder?: string;
  className?: string;
}

export function TimePicker({ value, onChange, placeholder = "Select time", className }: TimePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hour, setHour] = useState<number>(value ? parseInt(value.split(":")[0]) : 12);
  const [minute, setMinute] = useState<number>(value ? parseInt(value.split(":")[1]) : 0);
  const [period, setPeriod] = useState<"AM" | "PM">(value ? (parseInt(value.split(":")[0]) >= 12 ? "PM" : "AM") : "PM");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  useEffect(() => {
    if (value) {
      const [h, m] = value.split(":").map(Number);
      setHour(h > 12 ? h - 12 : h === 0 ? 12 : h);
      setMinute(m);
      setPeriod(h >= 12 ? "PM" : "AM");
    }
  }, [value]);

  const formatTime = (h: number, m: number, p: "AM" | "PM") => {
    const hour24 = p === "PM" ? (h === 12 ? 12 : h + 12) : (h === 12 ? 0 : h);
    return `${String(hour24).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };

  const handleTimeChange = (newHour: number, newMinute: number, newPeriod: "AM" | "PM") => {
    setHour(newHour);
    setMinute(newMinute);
    setPeriod(newPeriod);
    onChange(formatTime(newHour, newMinute, newPeriod));
  };

  const displayTime = value
    ? (() => {
        const [h, m] = value.split(":").map(Number);
        const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
        const p = h >= 12 ? "PM" : "AM";
        return `${String(h12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${p}`;
      })()
    : placeholder;

  const hours = Array.from({ length: 12 }, (_, i) => i + 1);
  const minutes = Array.from({ length: 60 }, (_, i) => i);
  const hourRefs = useRef<Record<number, HTMLButtonElement | null>>({});
  const minuteRefs = useRef<Record<number, HTMLButtonElement | null>>({});
  const periodRefs = useRef<Record<"AM" | "PM", HTMLButtonElement | null>>({ AM: null, PM: null });

  // Scroll to selected values when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        hourRefs.current[hour]?.scrollIntoView({ behavior: "smooth", block: "center" });
        minuteRefs.current[minute]?.scrollIntoView({ behavior: "smooth", block: "center" });
        periodRefs.current[period]?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
    }
  }, [isOpen, hour, minute, period]);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full flex items-center justify-between gap-2 border border-gray-300 dark:border-neutral-700 rounded-md px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 text-sm",
          !value && "text-gray-500 dark:text-neutral-400"
        )}
      >
        <span className="flex items-center gap-2">
          <Clock className="w-4 h-4" />
          {displayTime}
        </span>
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-lg shadow-lg p-4 min-w-[240px]">
          <div className="flex gap-3">
            {/* Hours */}
            <div className="flex-1">
              <div className="text-xs font-medium text-gray-500 dark:text-neutral-400 mb-2 text-center">Hour</div>
              <div className="h-48 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-neutral-700 scrollbar-track-transparent border-r border-gray-200 dark:border-neutral-700 pr-2">
                {hours.map((h) => (
                  <button
                    key={h}
                    ref={(el) => { hourRefs.current[h] = el; }}
                    type="button"
                    onClick={() => handleTimeChange(h, minute, period)}
                    className={cn(
                      "w-full py-2 text-center text-sm rounded transition-colors",
                      hour === h
                        ? "bg-gray-800 dark:bg-gray-700 text-white font-semibold border-2 border-gray-900 dark:border-gray-500"
                        : "text-gray-700 dark:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-800"
                    )}
                  >
                    {String(h).padStart(2, "0")}
                  </button>
                ))}
              </div>
            </div>

            {/* Minutes */}
            <div className="flex-1">
              <div className="text-xs font-medium text-gray-500 dark:text-neutral-400 mb-2 text-center">Minute</div>
              <div className="h-48 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-neutral-700 scrollbar-track-transparent border-r border-gray-200 dark:border-neutral-700 pr-2">
                {minutes.map((m) => (
                  <button
                    key={m}
                    ref={(el) => { minuteRefs.current[m] = el; }}
                    type="button"
                    onClick={() => handleTimeChange(hour, m, period)}
                    className={cn(
                      "w-full py-2 text-center text-sm rounded transition-colors",
                      minute === m
                        ? "bg-gray-200 dark:bg-gray-600 text-gray-900 dark:text-white font-semibold"
                        : "text-gray-700 dark:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-800"
                    )}
                  >
                    {String(m).padStart(2, "0")}
                  </button>
                ))}
              </div>
            </div>

            {/* AM/PM */}
            <div className="flex-1">
              <div className="text-xs font-medium text-gray-500 dark:text-neutral-400 mb-2 text-center">Period</div>
              <div className="h-48 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-neutral-700 scrollbar-track-transparent">
                {(["AM", "PM"] as const).map((p) => (
                  <button
                    key={p}
                    ref={(el) => { periodRefs.current[p] = el; }}
                    type="button"
                    onClick={() => handleTimeChange(hour, minute, p)}
                    className={cn(
                      "w-full py-2 text-center text-sm rounded transition-colors",
                      period === p
                        ? "bg-gray-200 dark:bg-gray-600 text-gray-900 dark:text-white font-semibold"
                        : "text-gray-700 dark:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-800"
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

