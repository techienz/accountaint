"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import type { PageContext } from "@/lib/help/page-context";

type PageContextState = {
  current: PageContext | null;
  setPageContext: (ctx: PageContext) => void;
  clearPageContext: () => void;
};

const PageCtx = createContext<PageContextState>({
  current: null,
  setPageContext: () => {},
  clearPageContext: () => {},
});

export function PageContextProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<PageContext | null>(null);

  const setPageContext = useCallback((ctx: PageContext) => setCurrent(ctx), []);
  const clearPageContext = useCallback(() => setCurrent(null), []);

  return (
    <PageCtx.Provider value={{ current, setPageContext, clearPageContext }}>
      {children}
    </PageCtx.Provider>
  );
}

export function usePageContext() {
  return useContext(PageCtx);
}

/**
 * Drop this into any server-rendered page to set the page context for the chat panel.
 * Renders nothing visible.
 */
export function SetPageContext({ context }: { context: PageContext }) {
  const { setPageContext } = usePageContext();

  useEffect(() => {
    setPageContext(context);
  }, [context.pageId]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
