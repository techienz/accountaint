"use client";

import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePageContext } from "@/components/page-context-provider";
import type { PageContext } from "@/lib/help/page-context";

type ExplainButtonProps = {
  context: Omit<PageContext, "suggestedQuestions"> & {
    suggestedQuestions?: string[];
  };
};

/**
 * Renders a help button that opens the chat panel with a pre-filled
 * "explain this page" question, using the current page context.
 */
export function ExplainButton({ context }: ExplainButtonProps) {
  const { setPageContext } = usePageContext();

  function handleClick() {
    setPageContext(context);

    window.dispatchEvent(
      new CustomEvent("explain-this", {
        detail: {
          message: `I'm looking at the ${context.title} page. Can you explain what I'm seeing in plain English?${
            context.dataSummary
              ? " Here's what's on screen: " + context.dataSummary
              : ""
          }`,
        },
      })
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      className="gap-1.5 text-muted-foreground hover:text-foreground"
    >
      <HelpCircle className="h-4 w-4" />
      Explain This
    </Button>
  );
}
