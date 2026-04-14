export type PageContext = {
  /** Machine-readable page identifier, e.g. "reports/profit-loss" */
  pageId: string;
  /** Human-readable page title, e.g. "Profit & Loss Report" */
  title: string;
  /** Plain-English description of what this page shows */
  description: string;
  /** Optional data summary the AI can reference */
  dataSummary?: string;
  /** Suggested questions for the user based on this page */
  suggestedQuestions?: string[];
};

/** Pre-defined page contexts for pages that always have the same structure */
export const PAGE_CONTEXTS: Record<string, Omit<PageContext, "dataSummary">> = {
  dashboard: {
    pageId: "dashboard",
    title: "Dashboard",
    description:
      "Overview of your business — revenue, cash, deadlines, and operations at a glance.",
    suggestedQuestions: [
      "What should I focus on this week?",
      "How is my business doing compared to last month?",
      "What deadlines are coming up?",
    ],
  },
  "reports/profit-loss": {
    pageId: "reports/profit-loss",
    title: "Profit & Loss Report",
    description:
      "Shows your business income and expenses over a period. Revenue minus expenses equals your net profit (or loss).",
    suggestedQuestions: [
      "Is my profit margin healthy for a NZ business?",
      "Which expenses are growing the fastest?",
      "How can I reduce my tax on this profit?",
    ],
  },
  "reports/balance-sheet": {
    pageId: "reports/balance-sheet",
    title: "Balance Sheet",
    description:
      "A snapshot of what your business owns (assets), owes (liabilities), and the difference (equity) at a point in time.",
    suggestedQuestions: [
      "What does this balance sheet tell me about my business health?",
      "Is my debt level okay?",
      "What does equity mean for me as the owner?",
    ],
  },
  "banking/reconcile": {
    pageId: "banking/reconcile",
    title: "Bank Reconciliation",
    description:
      "Matching your bank transactions to accounting entries. This ensures your books match what actually happened in your bank account.",
    suggestedQuestions: [
      "Why do I need to reconcile?",
      "What do I do with transactions that don't match?",
      "How often should I reconcile?",
    ],
  },
  "tax-prep/gst": {
    pageId: "tax-prep/gst",
    title: "GST Returns",
    description:
      "Goods and Services Tax — you collect GST on sales and pay GST on purchases. The difference is what you owe (or get back from) IRD.",
    suggestedQuestions: [
      "How is my GST calculated?",
      "What can I claim GST on?",
      "When is my next GST return due?",
    ],
  },
  snapshot: {
    pageId: "snapshot",
    title: "Business Snapshot",
    description:
      "A high-level summary of how your business is performing — key metrics, trends, and month-on-month changes.",
    suggestedQuestions: [
      "What does this snapshot tell me?",
      "Are these numbers good or bad?",
      "What should I do about the trends I see?",
    ],
  },
  shareholders: {
    pageId: "shareholders",
    title: "Shareholder Current Accounts",
    description:
      "Tracks money flowing between you (the shareholder) and your company. An overdrawn account means you owe the company money, which has tax implications.",
    suggestedQuestions: [
      "Is my shareholder account okay?",
      "What happens if my account is overdrawn?",
      "Should I take a salary or dividends?",
    ],
  },
  deadlines: {
    pageId: "deadlines",
    title: "Tax Deadlines",
    description:
      "Shows when your tax obligations are due — GST returns, provisional tax, income tax, and PAYE if you have employees. Missing deadlines can result in penalties from IRD.",
    suggestedQuestions: [
      "What happens if I miss a deadline?",
      "Can I get an extension from IRD?",
      "How do I prepare for my next GST return?",
    ],
  },
  "tax-savings": {
    pageId: "tax-savings",
    title: "Tax Savings Calculator",
    description:
      "Helps you figure out how much money to set aside each month for GST and income tax, so you're not caught short when payment is due.",
    suggestedQuestions: [
      "How much should I set aside for tax?",
      "What's the difference between GST and income tax?",
      "Can I reduce my tax bill?",
    ],
  },
  "settings/chart-of-accounts": {
    pageId: "settings/chart-of-accounts",
    title: "Chart of Accounts",
    description:
      "The list of categories your business uses to organise financial transactions — like folders for your money. Assets, liabilities, equity, revenue, and expenses.",
    suggestedQuestions: [
      "What is a chart of accounts?",
      "Do I need to change any of these?",
      "What do debit and credit mean?",
    ],
  },
};
