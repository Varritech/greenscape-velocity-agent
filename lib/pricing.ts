// Pricing library. The proposal-draft prompt's hard rule: the LLM must NOT
// invent prices — it picks line items from this table. Add a new feature here
// before the agent can quote it.
export interface PricingItem {
  unit: "sf" | "each" | "lf";
  price: number;
  label: string;
}

export const PRICING_LIBRARY: Record<string, PricingItem> = {
  travertine_paver_french_16x24: {
    unit: "sf",
    price: 24,
    label: "Travertine pavers, French pattern 16x24",
  },
  travertine_pool_coping_bullnose: {
    unit: "lf",
    price: 42,
    label: "Travertine pool coping, bullnose",
  },
  demo_concrete_slab: {
    unit: "sf",
    price: 6,
    label: "Demo existing concrete slab",
  },
  demo_stamped_concrete: {
    unit: "sf",
    price: 7,
    label: "Demo stamped concrete deck",
  },
  bbq_island_8ft_granite: {
    unit: "each",
    price: 7800,
    label: "BBQ island, 8 ft, granite top",
  },
  outdoor_kitchen_14ft_granite: {
    unit: "each",
    price: 18500,
    label: "Outdoor kitchen, 14 ft, granite top",
  },
  pizza_oven_wood_fired: {
    unit: "each",
    price: 4800,
    label: "Wood-fired pizza oven",
  },
  pergola_cedar_12x14_stained: {
    unit: "each",
    price: 6200,
    label: "Pergola, cedar 12x14, stained",
  },
  pergola_cedar_14x18_stained: {
    unit: "each",
    price: 8200,
    label: "Pergola, cedar 14x18, stained",
  },
  low_voltage_path_light: {
    unit: "each",
    price: 180,
    label: "Low-voltage path light",
  },
  bbq_task_light: {
    unit: "each",
    price: 320,
    label: "BBQ task light",
  },
  gas_fire_pit_round: {
    unit: "each",
    price: 3600,
    label: "Gas fire pit, round",
  },
};

export function pricingLibraryJson(): string {
  return JSON.stringify(
    Object.fromEntries(
      Object.entries(PRICING_LIBRARY).map(([k, v]) => [k, { unit: v.unit, price: v.price }]),
    ),
  );
}
