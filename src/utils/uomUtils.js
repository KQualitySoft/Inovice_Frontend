// UOM (Unit of Measure) conversion and normalization utilities
// Supported UOMs: Pcs, Kg, Gram, Liter, Milliliter

// Canonical token mappings
export function normalizeUom(uom) {
  const s = String(uom || '').trim().toLowerCase();
  if (!s) return '';

  // Weight: kg, gram
  if (/^(kg|kgs|kilogram|kilograms)$/.test(s)) return 'kg';
  if (/^(g|gm|gms|gram|grams)$/.test(s)) return 'gram';

  // Volume: liter, milliliter
  if (/^(l|lt|ltr|ltrs|liter|liters|litre|litres)$/.test(s)) return 'liter';
  if (/^(ml|mls|milliliter|milliliters|millilitre|millilitres)$/.test(s)) return 'ml';

  // Count: pcs
  if (/^(pcs|pc|piece|pieces)$/.test(s)) return 'pcs';

  return s;
}

// Display title for standard UOM tokens
export const UOM_DISPLAY_NAMES = {
  pcs: 'Pcs',
  kg: 'Kg',
  gram: 'Gram',
  liter: 'Liter',
  ml: 'Milliliter'
};

export function isStandardUom(uom) {
  const norm = normalizeUom(uom);
  return Boolean(norm && UOM_DISPLAY_NAMES[norm]);
}

export function getDisplayUom(uom) {
  const norm = normalizeUom(uom);
  return UOM_DISPLAY_NAMES[norm] || uom;
}

// Relative conversion factors to standard unit in each family
const WEIGHT_TO_KG = {
  kg: 1.0,
  gram: 0.001
};

const VOLUME_TO_L = {
  liter: 1.0,
  ml: 0.001
};

const COUNT_TO_PCS = {
  pcs: 1.0
};

// Check if two UOMs belong to the same convertible family
export function areUomsCompatible(uom1, uom2) {
  const u1 = normalizeUom(uom1);
  const u2 = normalizeUom(uom2);
  if (!u1 || !u2) return false;
  if (u1 === u2) return true;
  if (WEIGHT_TO_KG[u1] && WEIGHT_TO_KG[u2]) return true;
  if (VOLUME_TO_L[u1] && VOLUME_TO_L[u2]) return true;
  if (COUNT_TO_PCS[u1] && COUNT_TO_PCS[u2]) return true;
  return false;
}

// Get the conversion factor from baseUom to currentUom
// displayedRate = baseRate / factor
// baseRate = displayedRate * factor
export function getUomConversionFactor(baseUom, currentUom) {
  const u1 = normalizeUom(baseUom);
  const u2 = normalizeUom(currentUom);

  if (!u1 || !u2 || u1 === u2) return 1.0;

  if (WEIGHT_TO_KG[u1] && WEIGHT_TO_KG[u2]) {
    return WEIGHT_TO_KG[u1] / WEIGHT_TO_KG[u2];
  }

  if (VOLUME_TO_L[u1] && VOLUME_TO_L[u2]) {
    return VOLUME_TO_L[u1] / VOLUME_TO_L[u2];
  }

  if (COUNT_TO_PCS[u1] && COUNT_TO_PCS[u2]) {
    return COUNT_TO_PCS[u1] / COUNT_TO_PCS[u2];
  }

  return 1.0;
}

// Format rate cleanly (e.g. 100, 0.5, 0.025)
export function formatRate(val) {
  const num = typeof val === 'number' ? val : parseFloat(val);
  if (isNaN(num) || num === 0) return '';
  if (num % 1 === 0) return num.toString();
  return parseFloat(num.toFixed(4)).toString();
}

// Parse quantity input in case user entered unit along with quantity, e.g. "500gm", "2.5 kg", "100ml", "10pcs"
export function parseQtyInput(val) {
  const str = String(val || '').trim();
  if (!str) return null;

  const match = str.match(/^([\d.]+)\s*([a-zA-Z]+)$/);
  if (match) {
    const qtyNum = parseFloat(match[1]);
    const rawUnit = match[2];
    const norm = normalizeUom(rawUnit);
    if (UOM_DISPLAY_NAMES[norm]) {
      return {
        qty: isNaN(qtyNum) ? match[1] : qtyNum,
        uom: UOM_DISPLAY_NAMES[norm]
      };
    }
  }
  return null;
}
