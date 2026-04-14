"use client";

import type { ReactNode } from "react";
import { PageContextProvider } from "@/components/page-context-provider";

export function ClientProviders({ children }: { children: ReactNode }) {
  return <PageContextProvider>{children}</PageContextProvider>;
}
