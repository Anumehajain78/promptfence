"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { CheckIcon, ChevronDownIcon } from "./icons";

export interface SelectOption {
  value: string;
  label: string;
}

interface Props {
  label: string;
  icon: ReactNode;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
}

/**
 * A select whose open list is part of the design. A native <select> hands its list to the operating system,
 * which draws it however it likes and cannot be styled, so this one draws its own.
 *
 * It keeps everything the native one gives you: a real label, full keyboard use (arrows, Home, End, Enter,
 * Space, Escape, and typing a letter to jump), closing on outside click or Tab, and the right roles so a
 * screen reader announces it as a list of options with one selected. Focus stays on the button throughout;
 * the highlighted option is reported through aria-activedescendant.
 */
export function Select({ label, icon, value, options, onChange, disabled = false }: Props) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const selectedIndex = Math.max(0, options.findIndex((o) => o.value === value));
  const selected = options[selectedIndex];

  // Close when the click lands anywhere else.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const show = () => {
    setActive(selectedIndex);
    setOpen(true);
  };
  const choose = (index: number) => {
    onChange(options[index].value);
    setOpen(false);
    button.current?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const { key } = event;
    if (!open) {
      if (key === "ArrowDown" || key === "ArrowUp" || key === "Enter" || key === " ") {
        event.preventDefault();
        show();
      }
      return;
    }
    if (key === "Escape") {
      event.preventDefault();
      setOpen(false);
    } else if (key === "Tab") {
      setOpen(false);
    } else if (key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => Math.min(options.length - 1, i + 1));
    } else if (key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (key === "Home") {
      event.preventDefault();
      setActive(0);
    } else if (key === "End") {
      event.preventDefault();
      setActive(options.length - 1);
    } else if (key === "Enter" || key === " ") {
      event.preventDefault();
      choose(active);
    } else if (key.length === 1) {
      const hit = options.findIndex((o) => o.label.toLowerCase().startsWith(key.toLowerCase()));
      if (hit >= 0) setActive(hit);
    }
  };

  return (
    <div ref={root} className="relative grid min-w-0 gap-2">
      <span id={`${id}-label`} className="text-[14px] font-medium text-grey-700">
        {label}
      </span>
      <button
        ref={button}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-labelledby={`${id}-label ${id}-value`}
        aria-activedescendant={open ? `${id}-option-${active}` : undefined}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onKeyDown}
        className={`flex h-[54px] w-full cursor-pointer items-center gap-3 rounded-[12px] border bg-white px-4 text-left text-ink transition-[border-color,box-shadow] duration-200 focus:outline-none focus-visible:border-ink focus-visible:shadow-[0_0_0_4px_rgba(184,242,39,0.35)] disabled:cursor-not-allowed disabled:opacity-45 ${
          open ? "border-ink shadow-[0_0_0_4px_rgba(184,242,39,0.35)]" : "border-grey-250 hover:border-grey-400"
        }`}
      >
        <span className="shrink-0 text-grey-700">{icon}</span>
        <span id={`${id}-value`} className="min-w-0 flex-1 truncate font-mono text-[16px]">
          {selected?.label}
        </span>
        <ChevronDownIcon className={`shrink-0 text-grey-700 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <ul
          id={`${id}-list`}
          role="listbox"
          aria-labelledby={`${id}-label`}
          className="pf-pop absolute left-0 top-full z-30 m-0 mt-2 w-full min-w-[240px] list-none rounded-[14px] border border-grey-200 bg-white p-1.5 shadow-[0_2px_4px_rgba(20,20,19,0.05),0_24px_48px_-16px_rgba(20,20,19,0.28)]"
        >
          {options.map((option, i) => {
            const isSelected = i === selectedIndex;
            const isActive = i === active;
            return (
              <li
                key={option.value}
                id={`${id}-option-${i}`}
                role="option"
                aria-selected={isSelected}
                onPointerEnter={() => setActive(i)}
                onClick={() => choose(i)}
                className={`flex min-h-[46px] cursor-pointer items-center gap-3 rounded-[10px] px-3 font-mono text-[16px] transition-colors duration-100 ${
                  isActive ? "bg-tint text-ink" : "text-grey-700"
                } ${isSelected ? "font-medium text-ink" : ""}`}
              >
                <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-[999px] transition-colors duration-150 ${isSelected ? "bg-ink text-lime" : "bg-transparent text-transparent"}`}>
                  <CheckIcon width={13} height={13} strokeWidth={2.6} />
                </span>
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
