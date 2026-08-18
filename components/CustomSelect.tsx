"use client";

import { useState, useRef, useEffect } from "react";
import ChevronUpDownIcon from "@heroicons/react/24/outline/ChevronUpDownIcon";
import CheckIcon from "@heroicons/react/24/outline/CheckIcon";
import BookmarkIcon from "@heroicons/react/24/outline/BookmarkIcon";

export interface CustomSelectOption {
  value: string;
  label: string;
  sublabel?: string;
  logoUrl?: string;
}

interface CustomSelectProps {
  options: CustomSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function CustomSelect({
  options,
  value,
  onChange,
  placeholder = "Pilih opsi...",
  className = "",
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-border/70 bg-background/80 hover:bg-muted/40 backdrop-blur-md text-left flex items-center justify-between gap-2 shadow-sm transition-all focus-visible:ring-2 focus-visible:ring-primary active:scale-[0.99] cursor-pointer"
      >
        <div className="flex items-center gap-2.5 overflow-hidden">
          {selectedOption?.logoUrl ? (
            <div className="w-5 h-5 rounded-md bg-white p-0.5 border border-border/60 overflow-hidden shrink-0 flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={selectedOption.logoUrl}
                alt=""
                className="w-full h-full object-contain"
              />
            </div>
          ) : selectedOption?.value ? (
            <BookmarkIcon className="w-4 h-4 text-primary shrink-0" />
          ) : null}

          <span className="text-xs font-semibold text-foreground truncate">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>

        <ChevronUpDownIcon className="w-4 h-4 text-muted-foreground shrink-0" />
      </button>

      {/* Floating Dropdown Menu */}
      {isOpen && (
        <div
          role="listbox"
          className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-2xl border border-border/80 bg-card/95 backdrop-blur-2xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto p-1.5 flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-150 ring-1 ring-black/5 dark:ring-white/10"
        >
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value || "__empty__"}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => handleSelect(opt.value)}
                className={`min-h-[40px] px-3 py-2 rounded-xl text-left flex items-center justify-between gap-2.5 transition-all active:scale-[0.98] cursor-pointer ${
                  isSelected
                    ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                    : "text-foreground hover:bg-muted/70 font-medium"
                }`}
              >
                <div className="flex items-center gap-2.5 overflow-hidden">
                  {opt.logoUrl ? (
                    <div className="w-5 h-5 rounded-md bg-white p-0.5 border border-border/60 overflow-hidden shrink-0 flex items-center justify-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={opt.logoUrl}
                        alt=""
                        className="w-full h-full object-contain"
                      />
                    </div>
                  ) : opt.value ? (
                    <BookmarkIcon
                      className={`w-4 h-4 shrink-0 ${
                        isSelected ? "text-primary-foreground" : "text-primary"
                      }`}
                    />
                  ) : null}

                  <div className="flex flex-col overflow-hidden leading-tight">
                    <span className="text-xs truncate">{opt.label}</span>
                    {opt.sublabel && (
                      <span
                        className={`text-[10px] truncate ${
                          isSelected
                            ? "text-primary-foreground/80"
                            : "text-muted-foreground"
                        }`}
                      >
                        {opt.sublabel}
                      </span>
                    )}
                  </div>
                </div>

                {isSelected && (
                  <CheckIcon className="w-4 h-4 shrink-0 text-primary-foreground" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
