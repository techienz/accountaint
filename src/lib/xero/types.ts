// Xero cached data types

export interface XeroReportRow {
  RowType: string;
  Title?: string;
  Cells?: Array<{
    Value: string;
    Attributes?: Array<{ Value: string; Id: string }>;
  }>;
  Rows?: XeroReportRow[];
}

export interface XeroReport {
  ReportID: string;
  ReportName: string;
  ReportType: string;
  ReportDate?: string;
  UpdatedDateUTC?: string;
  Rows: XeroReportRow[];
}

export interface XeroBankAccount {
  AccountID: string;
  Code: string;
  Name: string;
  Type: string;
  BankAccountNumber?: string;
  Status: string;
  CurrencyCode: string;
  Description?: string;
}

export interface XeroInvoice {
  InvoiceID: string;
  InvoiceNumber: string;
  Type: "ACCREC" | "ACCPAY";
  Status: string;
  Contact: {
    ContactID: string;
    Name: string;
  };
  Date: string;
  DueDate: string;
  Total: number;
  AmountDue: number;
  AmountPaid: number;
  CurrencyCode: string;
  LineItems?: Array<{
    Description: string;
    Quantity: number;
    UnitAmount: number;
    AccountCode: string;
    TaxType: string;
    LineAmount: number;
  }>;
}

export interface XeroContact {
  ContactID: string;
  Name: string;
  EmailAddress?: string;
  FirstName?: string;
  LastName?: string;
  IsSupplier: boolean;
  IsCustomer: boolean;
  ContactStatus: string;
  Phones?: Array<{
    PhoneType: string;
    PhoneNumber: string;
  }>;
  Addresses?: Array<{
    AddressType: string;
    AddressLine1?: string;
    City?: string;
    Region?: string;
    PostalCode?: string;
    Country?: string;
  }>;
}

export interface XeroTenant {
  id: string;
  authEventId: string;
  tenantId: string;
  tenantType: string;
  tenantName: string;
}

export type XeroEntityType =
  | "profit_loss"
  | "profit_loss_monthly"
  | "balance_sheet"
  | "bank_accounts"
  | "invoices"
  | "contacts";

export interface SyncResult {
  entityType: XeroEntityType;
  success: boolean;
  error?: string;
  count?: number;
}
