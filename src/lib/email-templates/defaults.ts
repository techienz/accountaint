// Default email templates + placeholder metadata per kind.
//
// Placeholders use {{variable}} syntax. Available variables are documented
// per kind and shown to the user in the Settings → Email Templates UI.

export type TemplateKind = "invoice" | "invoice_reminder" | "timesheet" | "payslip";

export type TemplateDefault = {
  label: string;
  description: string;
  subject: string;
  body: string; // HTML
  placeholders: Array<{ key: string; description: string }>;
  sampleData: Record<string, string>;
};

export const TEMPLATE_DEFAULTS: Record<TemplateKind, TemplateDefault> = {
  invoice: {
    label: "Invoice",
    description:
      "Sent when emailing a sales invoice or a bill from the invoice detail page.",
    subject: "{{document_kind}} {{invoice_number}} from {{business_name}}",
    body: `<p>Hi {{contact_name}},</p>
<p>Please find attached {{document_kind_lower}} {{invoice_number}}.</p>
<p><strong>Amount due:</strong> {{amount_due}}<br>
<strong>Due date:</strong> {{due_date}}</p>
{{payment_instructions}}
<p>Thanks,<br>
{{business_name}}</p>`,
    placeholders: [
      { key: "business_name", description: "Your business name" },
      { key: "contact_name", description: "Recipient's name" },
      { key: "invoice_number", description: "e.g. INV-0042 or BILL-0013" },
      { key: "document_kind", description: "'Invoice' or 'Bill' — capitalised" },
      { key: "document_kind_lower", description: "'invoice' or 'bill'" },
      { key: "amount_due", description: "Formatted $ amount" },
      { key: "due_date", description: "Due date, DD-MM-YYYY" },
      { key: "total_amount", description: "Invoice total (incl. GST)" },
      {
        key: "payment_instructions",
        description:
          "Your saved payment instructions (bank account etc.) wrapped in a paragraph. Blank if none set.",
      },
    ],
    sampleData: {
      business_name: "Acme Contracting Ltd",
      contact_name: "Jane Smith",
      invoice_number: "INV-0042",
      document_kind: "Invoice",
      document_kind_lower: "invoice",
      amount_due: "$2,415.00",
      due_date: "20-05-2026",
      total_amount: "$2,415.00",
      payment_instructions:
        "<p><strong>Payment details:</strong><br>Bank: 12-3456-7890123-00<br>Reference: INV-0042</p>",
    },
  },
  invoice_reminder: {
    label: "Invoice reminder",
    description:
      "Sent when chasing payment on an unpaid or overdue invoice. Triggered manually from the invoice detail page or automatically from the daily overdue check.",
    subject: "Reminder: invoice {{invoice_number}} is unpaid",
    body: `<p>Hi {{contact_name}},</p>
<p>This is a friendly reminder that invoice {{invoice_number}} for {{amount_due}} {{overdue_phrase}}.</p>
<p>I&rsquo;ve attached a copy for your reference.</p>
{{payment_instructions}}
<p>If you&rsquo;ve already paid, please ignore this — it can take a couple of days for the payment to land.</p>
<p>Thanks,<br>
{{business_name}}</p>`,
    placeholders: [
      { key: "business_name", description: "Your business name" },
      { key: "contact_name", description: "Recipient's name" },
      { key: "invoice_number", description: "e.g. INV-0042" },
      { key: "amount_due", description: "Outstanding amount, formatted $" },
      { key: "due_date", description: "Original due date, DD-MM-YYYY" },
      {
        key: "overdue_phrase",
        description:
          "'is now N days overdue (was due DD-MM-YYYY)' or 'is due on DD-MM-YYYY' depending on whether the due date has passed",
      },
      {
        key: "payment_instructions",
        description: "Saved payment instructions wrapped in a paragraph. Blank if none set.",
      },
    ],
    sampleData: {
      business_name: "Acme Contracting Ltd",
      contact_name: "Jane Smith",
      invoice_number: "INV-0042",
      amount_due: "$2,415.00",
      due_date: "20-04-2026",
      overdue_phrase: "is now 12 days overdue (was due 20-04-2026)",
      payment_instructions:
        "<p><strong>Payment details:</strong><br>Bank: 12-3456-7890123-00<br>Reference: INV-0042</p>",
    },
  },
  timesheet: {
    label: "Timesheet",
    description:
      "Sent when emailing a timesheet to a client or project contact.",
    subject: "Timesheet — {{project}} — {{period_start}} to {{period_end}}",
    body: `<p>Hi {{contact_name}},</p>
<p>Please find attached the timesheet for <strong>{{project}}</strong> covering {{period_start}} to {{period_end}}.</p>
<p><strong>Total hours:</strong> {{total_hours}}<br>
<strong>Total amount:</strong> {{total_amount}}<br>
<strong>Entries:</strong> {{entry_count}}</p>
<p>Thanks,<br>
{{business_name}}</p>`,
    placeholders: [
      { key: "business_name", description: "Your business name" },
      { key: "contact_name", description: "Recipient's name (may be blank)" },
      { key: "project", description: "Project / work contract name" },
      { key: "period_start", description: "Period start date, DD-MM-YYYY" },
      { key: "period_end", description: "Period end date, DD-MM-YYYY" },
      { key: "total_hours", description: "Total hours in period, e.g. 38.5" },
      { key: "total_amount", description: "Billable total, e.g. $3,850.00" },
      { key: "entry_count", description: "Number of timesheet entries" },
    ],
    sampleData: {
      business_name: "Acme Contracting Ltd",
      contact_name: "Sam Patel",
      project: "Project Phoenix",
      period_start: "13-04-2026",
      period_end: "19-04-2026",
      total_hours: "38.5",
      total_amount: "$3,850.00",
      entry_count: "5",
    },
  },
  payslip: {
    label: "Payslip",
    description:
      "Sent to each employee when distributing their payslip from a finalised pay run.",
    subject: "Payslip — {{period_start}} to {{period_end}}",
    body: `<p>Hi {{employee_name}},</p>
<p>Please find attached your payslip for the pay period {{period_start}} to {{period_end}}, paid on {{pay_date}}.</p>
<p><strong>Gross pay:</strong> {{gross_pay}}<br>
<strong>Net pay:</strong> {{net_pay}}</p>
<p>If anything looks wrong, let me know.</p>
<p>Thanks,<br>
{{business_name}}</p>`,
    placeholders: [
      { key: "business_name", description: "Your business name" },
      { key: "employee_name", description: "Employee's name" },
      { key: "period_start", description: "Pay period start DD-MM-YYYY" },
      { key: "period_end", description: "Pay period end DD-MM-YYYY" },
      { key: "pay_date", description: "Pay date DD-MM-YYYY" },
      { key: "gross_pay", description: "Gross pay amount" },
      { key: "net_pay", description: "Net pay amount" },
    ],
    sampleData: {
      business_name: "Acme Contracting Ltd",
      employee_name: "Alex Chen",
      period_start: "06-04-2026",
      period_end: "19-04-2026",
      pay_date: "22-04-2026",
      gross_pay: "$1,923.08",
      net_pay: "$1,447.56",
    },
  },
};
