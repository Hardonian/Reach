// Simple Slot component implementation
import * as React from "react";

type SlotProps = {
  children?: React.ReactNode;
};

export function Slot({ children, ...props }: SlotProps & Omit<React.HTMLAttributes<HTMLElement>, "children">) {
  if (React.isValidElement(children)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return React.cloneElement(children as React.ReactElement<any>, props);
  }
  return null;
}

export const SlotProvider = ({ children }: { children: React.ReactNode }) => {
  return <>{children}</>;
};
