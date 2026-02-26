"use client";

import React, { useState, useRef, useEffect } from "react";

interface SelectProps {
  value?: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
  className?: string;
}

export function Select({ value, onValueChange, children, className = "" }: SelectProps) {
  return (
    <div className={className}>
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child as React.ReactElement<any>, { value, onValueChange });
        }
        return child;
      })}
    </div>
  );
}

interface SelectTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  value?: string;
  onValueChange?: (value: string) => void;
}

export function SelectTrigger({ children, className = "", value, onValueChange, ...props }: SelectTriggerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className={`flex h-10 w-full items-center justify-between rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm ${className}`}
        onClick={() => setIsOpen(!isOpen)}
        {...props}
      >
        {children}
        <span>▼</span>
      </button>
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-gray-600 bg-gray-800 shadow-lg">
          {React.Children.map(children, (child) => {
            if (React.isValidElement(child) && child.type === SelectContent) {
              return React.cloneElement(child as React.ReactElement<any>, { 
                onValueChange: (v: string) => {
                  onValueChange?.(v);
                  setIsOpen(false);
                } 
              });
            }
            return null;
          })}
        </div>
      )}
    </div>
  );
}

interface SelectValueProps {
  placeholder?: string;
}

export function SelectValue({ placeholder = "Select..." }: SelectValueProps) {
  return <span className="text-gray-400">{placeholder}</span>;
}

interface SelectContentProps {
  children: React.ReactNode;
  onValueChange?: (value: string) => void;
}

export function SelectContent({ children, onValueChange }: SelectContentProps) {
  return (
    <div className="max-h-60 overflow-auto py-1">
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child as React.ReactElement<any>, { onValueChange });
        }
        return child;
      })}
    </div>
  );
}

interface SelectItemProps {
  value: string;
  children: React.ReactNode;
  onValueChange?: (value: string) => void;
}

export function SelectItem({ value, children, onValueChange }: SelectItemProps) {
  return (
    <div
      className="relative flex cursor-pointer select-none items-center rounded-sm py-1.5 px-2 text-sm hover:bg-gray-700"
      onClick={() => onValueChange?.(value)}
    >
      {children}
    </div>
  );
}
