"use client";

import { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { Sidebar } from "./sidebar";

type Props = {
  userName: string;
  businesses: { id: string; name: string }[];
  activeBusinessId: string | null;
  hasEmployees?: boolean;
};

export function MobileNav(props: Props) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const prevPathRef = useRef(pathname);

  // Close sidebar on navigation
  useEffect(() => {
    if (prevPathRef.current !== pathname && open) {
      setOpen(false);
    }
    prevPathRef.current = pathname;
  }, [pathname, open]);

  return (
    <div className="md:hidden">
      <button
        onClick={() => setOpen(true)}
        className="p-1.5 -ml-1.5 rounded-lg text-foreground/60 hover:text-foreground hover:bg-accent transition-colors"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Slide-out sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-[70] w-[280px] transform transition-transform duration-200 ease-out shadow-2xl ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="relative h-full bg-sidebar overflow-hidden">
          <Sidebar {...props} />
          <button
            onClick={() => setOpen(false)}
            className="absolute top-4 right-3 z-10 p-1.5 rounded-lg text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
