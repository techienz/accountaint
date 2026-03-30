import type { McpToolDefinition, McpToolContext } from "./server";
import { executeTool } from "@/lib/ai/tools";

const TAX_TOOL_NAMES = [
  "get_upcoming_deadlines",
  "get_tax_rates",
  "get_business_config",
  "get_shareholder_balances",
  "get_salary_dividend_advice",
  "get_tax_prep_summary",
  "get_tax_savings_target",
  "get_asset_register",
  "calculate_depreciation",
  "calculate_home_office",
  "calculate_vehicle_claim",
  "get_acc_estimate",
];

const TAX_TOOL_DESCRIPTIONS: Record<string, string> = {
  get_upcoming_deadlines: "Get upcoming tax deadlines (GST, PAYE, provisional, income tax).",
  get_tax_rates: "Get current NZ tax rates for the business's tax year.",
  get_business_config: "Get business configuration (entity type, GST status, etc).",
  get_shareholder_balances: "Get shareholder current account balances with deemed dividend warnings.",
  get_salary_dividend_advice: "Run salary/dividend optimiser for tax-optimal split.",
  get_tax_prep_summary: "Get IR4/IR3 tax return preparation status.",
  get_tax_savings_target: "Calculate monthly tax savings target.",
  get_asset_register: "Get fixed asset register with book values.",
  calculate_depreciation: "Run annual depreciation calculation.",
  calculate_home_office: "Calculate home office deduction.",
  calculate_vehicle_claim: "Calculate vehicle expense claim.",
  get_acc_estimate: "Estimate ACC levy.",
};

const TAX_TOOL_SCHEMAS: Record<string, Record<string, unknown>> = {
  get_upcoming_deadlines: {
    type: "object",
    properties: { months_ahead: { type: "number" } },
    required: [],
  },
  get_tax_rates: { type: "object", properties: {}, required: [] },
  get_business_config: { type: "object", properties: {}, required: [] },
  get_shareholder_balances: {
    type: "object",
    properties: { tax_year: { type: "string" } },
    required: [],
  },
  get_salary_dividend_advice: {
    type: "object",
    properties: {
      company_profit: { type: "number" },
      other_personal_income: { type: "number" },
    },
    required: ["company_profit"],
  },
  get_tax_prep_summary: {
    type: "object",
    properties: { tax_year: { type: "string" } },
    required: [],
  },
  get_tax_savings_target: {
    type: "object",
    properties: { tax_year: { type: "string" } },
    required: [],
  },
  get_asset_register: { type: "object", properties: {}, required: [] },
  calculate_depreciation: {
    type: "object",
    properties: { tax_year: { type: "string" } },
    required: [],
  },
  calculate_home_office: {
    type: "object",
    properties: {
      office_area_sqm: { type: "number" },
      total_area_sqm: { type: "number" },
      rates: { type: "number" },
      insurance: { type: "number" },
      mortgage_interest: { type: "number" },
      rent: { type: "number" },
      power: { type: "number" },
      internet: { type: "number" },
    },
    required: ["office_area_sqm", "total_area_sqm"],
  },
  calculate_vehicle_claim: {
    type: "object",
    properties: {
      method: { type: "string", enum: ["mileage_rate", "actual_cost"] },
      total_business_km: { type: "number" },
      business_use_percentage: { type: "number" },
      fuel: { type: "number" },
      insurance: { type: "number" },
      rego: { type: "number" },
      maintenance: { type: "number" },
      depreciation: { type: "number" },
    },
    required: ["method"],
  },
  get_acc_estimate: {
    type: "object",
    properties: {
      liable_earnings: { type: "number" },
      levy_rate: { type: "number" },
    },
    required: ["liable_earnings", "levy_rate"],
  },
};

export const taxEngineTools: McpToolDefinition[] = TAX_TOOL_NAMES.map((name) => ({
  name,
  description: TAX_TOOL_DESCRIPTIONS[name],
  inputSchema: TAX_TOOL_SCHEMAS[name],
  handler: async (input: Record<string, unknown>, context: McpToolContext) => {
    return executeTool(name, input, context.businessId, context.userId, context.sanitisationMap);
  },
}));
