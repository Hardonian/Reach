// Simple Slot component implementation
import * as React from "react";

export function Slot({ children, ...props }: React.HTMLAttributes<HTMLElement> & { children?: React.ReactNode }) {
  if (React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<any>, props as any);
  }
  return null;
}

export const SlotProvider = ({ children }: { children: React.ReactNode }) => {
  return <>{children}</>;
};
