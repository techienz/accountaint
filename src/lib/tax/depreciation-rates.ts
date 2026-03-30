/**
 * IRD-approved depreciation rates (IR265) for common business asset categories.
 * DV = diminishing value rate, SL = straight line rate.
 *
 * These rates change infrequently — last major update was 2020.
 * Source: IRD Depreciation Rate Finder / IR265 guide.
 */
export type DepreciationRateEntry = {
  category: string;
  assetType: string;
  estimatedLife: number; // years
  dvRate: number;
  slRate: number;
};

export const depreciationRates: DepreciationRateEntry[] = [
  // Office equipment
  { category: "Office Equipment", assetType: "Desk", estimatedLife: 10, dvRate: 0.20, slRate: 0.13 },
  { category: "Office Equipment", assetType: "Office chair", estimatedLife: 10, dvRate: 0.20, slRate: 0.13 },
  { category: "Office Equipment", assetType: "Filing cabinet", estimatedLife: 15, dvRate: 0.13, slRate: 0.085 },
  { category: "Office Equipment", assetType: "Bookshelf", estimatedLife: 15, dvRate: 0.13, slRate: 0.085 },

  // Computers & electronics
  { category: "Computers", assetType: "Desktop computer", estimatedLife: 4, dvRate: 0.50, slRate: 0.25 },
  { category: "Computers", assetType: "Laptop", estimatedLife: 4, dvRate: 0.50, slRate: 0.25 },
  { category: "Computers", assetType: "Tablet", estimatedLife: 4, dvRate: 0.50, slRate: 0.25 },
  { category: "Computers", assetType: "Computer monitor", estimatedLife: 4, dvRate: 0.50, slRate: 0.25 },
  { category: "Computers", assetType: "Printer", estimatedLife: 5, dvRate: 0.40, slRate: 0.20 },
  { category: "Computers", assetType: "Server", estimatedLife: 4, dvRate: 0.50, slRate: 0.25 },
  { category: "Computers", assetType: "Network equipment (router/switch)", estimatedLife: 5, dvRate: 0.40, slRate: 0.20 },

  // Software
  { category: "Software", assetType: "Purchased software", estimatedLife: 4, dvRate: 0.50, slRate: 0.25 },

  // Telecommunications
  { category: "Telecommunications", assetType: "Mobile phone", estimatedLife: 3, dvRate: 0.67, slRate: 0.335 },
  { category: "Telecommunications", assetType: "Telephone system", estimatedLife: 5, dvRate: 0.40, slRate: 0.20 },

  // Motor vehicles
  { category: "Motor Vehicles", assetType: "Motor vehicle (car)", estimatedLife: 5, dvRate: 0.30, slRate: 0.21 },
  { category: "Motor Vehicles", assetType: "Motor vehicle (van/ute)", estimatedLife: 5, dvRate: 0.30, slRate: 0.21 },
  { category: "Motor Vehicles", assetType: "Motorcycle", estimatedLife: 5, dvRate: 0.30, slRate: 0.21 },
  { category: "Motor Vehicles", assetType: "Trailer", estimatedLife: 10, dvRate: 0.20, slRate: 0.13 },

  // Building fit-out
  { category: "Building Fit-out", assetType: "Carpet", estimatedLife: 8, dvRate: 0.25, slRate: 0.16 },
  { category: "Building Fit-out", assetType: "Blinds/curtains", estimatedLife: 5, dvRate: 0.40, slRate: 0.20 },
  { category: "Building Fit-out", assetType: "Partitions (non-structural)", estimatedLife: 10, dvRate: 0.20, slRate: 0.13 },
  { category: "Building Fit-out", assetType: "Signage", estimatedLife: 5, dvRate: 0.40, slRate: 0.20 },

  // Tools & machinery
  { category: "Tools", assetType: "Power tools", estimatedLife: 5, dvRate: 0.40, slRate: 0.20 },
  { category: "Tools", assetType: "Hand tools", estimatedLife: 5, dvRate: 0.40, slRate: 0.20 },
  { category: "Machinery", assetType: "General machinery", estimatedLife: 10, dvRate: 0.20, slRate: 0.13 },
  { category: "Machinery", assetType: "Forklift", estimatedLife: 6, dvRate: 0.30, slRate: 0.21 },

  // Kitchen & hospitality
  { category: "Kitchen", assetType: "Refrigerator (commercial)", estimatedLife: 8, dvRate: 0.25, slRate: 0.16 },
  { category: "Kitchen", assetType: "Oven/stove (commercial)", estimatedLife: 8, dvRate: 0.25, slRate: 0.16 },
  { category: "Kitchen", assetType: "Dishwasher (commercial)", estimatedLife: 5, dvRate: 0.40, slRate: 0.20 },

  // Electrical
  { category: "Electrical", assetType: "Air conditioning unit", estimatedLife: 10, dvRate: 0.20, slRate: 0.13 },
  { category: "Electrical", assetType: "Heater (electric)", estimatedLife: 8, dvRate: 0.25, slRate: 0.16 },
  { category: "Electrical", assetType: "Security system/cameras", estimatedLife: 6, dvRate: 0.30, slRate: 0.21 },
];

/**
 * Get unique categories for dropdown.
 */
export function getCategories(): string[] {
  return [...new Set(depreciationRates.map((r) => r.category))];
}

/**
 * Get asset types within a category.
 */
export function getAssetTypesForCategory(category: string): DepreciationRateEntry[] {
  return depreciationRates.filter((r) => r.category === category);
}

/**
 * Find rates for a specific asset type.
 */
export function findRate(assetType: string): DepreciationRateEntry | undefined {
  return depreciationRates.find(
    (r) => r.assetType.toLowerCase() === assetType.toLowerCase()
  );
}
