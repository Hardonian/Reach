import { ReactNode } from "react";

interface CalloutProps {
  children: ReactNode;
  type?: "info" | "warning" | "error" | "success";
  title?: string;
}

export function Callout({ children, type = "info", title }: CalloutProps) {
  const styles = {
    info: "bg-blue-50 border-blue-200 text-blue-900",
    warning: "bg-amber-50 border-amber-200 text-amber-900",
    error: "bg-red-50 border-red-200 text-red-900",
    success: "bg-emerald-50 border-emerald-200 text-emerald-900",
  };

  const icons = {
    info: "ℹ️",
    warning: "⚠️",
    error: "❌",
    success: "✅",
  };

  return (
    <div className={`p-4 rounded-lg border my-6 ${styles[type]}`}>
      <div className="flex gap-3">
        <span className="text-xl" role="img" aria-hidden="true">
          {icons[type]}
        </span>
        <div>
          {title && <p className="font-bold mb-1">{title}</p>}
          <div className="text-sm leading-relaxed">{children}</div>
        </div>
      </div>
    </div>
  );
}
