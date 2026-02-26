import React from "react";

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "destructive" | "outline";
  children: React.ReactNode;
}

export function Badge({ 
  className = "", 
  variant = "default",
  children, 
  ...props 
}: BadgeProps) {
  const baseStyles = "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2";
  
  const variants = {
    default: "border-transparent bg-blue-600 text-white",
    secondary: "border-transparent bg-gray-700 text-gray-100",
    destructive: "border-transparent bg-red-600 text-white",
    outline: "text-gray-300 border-gray-600",
  };

  return (
    <div 
      className={`${baseStyles} ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
