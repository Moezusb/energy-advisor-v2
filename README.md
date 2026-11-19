# Building Energy Advisor V2

**Live tool:** [moezusb.github.io/energy-advisor-v2](https://moezusb.github.io/energy-advisor-v2/)

A browser-based retrofit screening tool for Canadian buildings. Enter the first three characters of a postal code, building type, heating fuel, and annual energy spend, and get ranked retrofit recommendations with savings ranges, payback, carbon reduction, and cash-versus-loan financing scenarios.

This is a screening tool, not a certified energy audit. It replaces the original [building-energy-advisor](https://github.com/Moezusb/building-energy-advisor) with a modular rebuild that adds:
- **Zero-cost hosting** (GitHub Pages)
- **Quarterly data updates** (Q1, Q2, Q3, Q4)
- **Postal code awareness** (HDD-indexed savings by location)
- **Cold-climate transparency** (20% cost adder for AB/SK ASHP)
- **Financing scenarios** (cash vs. loan payback)
- **Confidence intervals** (ranges on all estimates)

---

## Data Layer

All data files created and validated:

### Data Files (114 KB total)

| File | Size | Records | Purpose |
|------|------|---------|---------|
| `provinces.json` | 14 KB | 10 | Utility rates, grid factors, climate zones, incentives |
| `postal-codes.json` | 65 KB | 412 | Postal code → HDD, province, incentives lookup |
| `interventions.json` | 23 KB | 7 | Retrofit specs, costs, savings, cold-climate flags |
| `cost-models.json` | 5 KB | - | Building-type cost curves (replaces formula) |
| `CHANGELOG.json` | 2.3 KB | 1 | Data version history + next update schedule |

---

## Key Improvements from V1

### 1. Grid Emission Factors (Updated to 2024)
- **AB**: 0.54 → 0.48 kg CO₂/kWh (declining coal, phase-out by 2030)
- **NS**: 0.57 → 0.42 (rapid decarbonization, coal closure)
- **ON**: Added winter/summer variance (0.08 winter, 0.02 summer)
- **All provinces**: Added trend notes + next update dates

### 2. Utility Rates (Q1 2026)
- **Fixed charges included**: Gas rates now have fixed monthly component
- **Preferential rates noted**: QC heat pump rate at $0.0658/kWh (vs. $0.0801 standard)
- **Residential vs. commercial**: Separated where data varies
- **Source links**: Each rate cites official utility tariff

### 3. Cost Models (Replaces Magic Formula)
- **Residential ASHP**: $2.50/sq ft ($8k–$18k for typical home)
- **Commercial ASHP**: $1.50/sq ft ($25k–$60k depending on size)
- **Warehouse**: $0.80/sq ft (simple systems, lower cost)
- **Variants**: Ductless mini-split costs separate from central

### 4. Postal Code HDD Lookup
- **412 postal prefixes** covering all provinces
- **Toronto**: 3,400 HDD (baseline)
- **Thunder Bay**: 4,600 HDD (+31% absolute savings vs. Toronto)
- **Calgary**: 3,200 HDD (smaller impact than Thunder Bay)
- **Impact**: Users in different regions see appropriately scaled estimates

### 5. Cold-Climate ASHP
- **Applies to**: AB, SK, MB (provinces flagged in `interventions.json`)
- **Penalty**: 20% cost adder ($12k → $14.4k for typical unit)
- **Savings impact**: 45% → 38% (COP degradation below −15°C)
- **Spec requirement**: HSPF2 ≥ 8.0 for code compliance
- **User messaging**: "Alberta & Saskatchewan require cold-climate rated unit"

### 6. Separated Heating vs. DHW
- **Heating fraction**: 70% of residential gas bill (modeled per fuel type)
- **DHW fraction**: 30% (unchanged by ASHP)
- **Result**: Users see ~32% total savings vs. 45% heating-only
- **Honest estimate**: Avoids disappointment when actual savings are lower

### 7. Financing Scenarios
- **Simple payback**: X years (cash purchase)
- **Loan @ 7% / 10 years**: +$Y/month net cash flow from year 1
- **Loan @ 7% / 15 years**: +$Z/month net cash flow from year 1
- **Impact**: Makes projects feasible for people without upfront capital

---

## Data Structure

### provinces.json
```json
{
  "AB": {
    "name": "Alberta",
    "utility": {
      "gas": { "variable": 0.058, "fixed": 16.50, "source": "..." },
      "electricity": { "residential": 0.145, "commercial": 0.138 }
    },
    "grid": {
      "factor": 0.48,
      "winter": 0.52,
      "summer": 0.38,
      "trend": "Declining 2–3%/year due to coal phase-out by 2030",
      "confidence": "high"
    },
    "climate": { "zone": "cold", "flag": "ASHP requires HSPF2 ≥ 8.0" },
    "incentives": [...]
  }
}
```

### postal-codes.json
```json
{
  "M1A": {
    "city": "Toronto",
    "province": "ON",
    "hdd": 3400,
    "gridZone": "central",
    "incentives": ["greener_homes"]
  }
}
```

### interventions.json
```json
{
  "ashp": {
    "name": "Air-Source Heat Pump",
    "specs": {
      "standard": { "hspf2Min": 7.0, "cop": 2.5, "minTemp": -10 },
      "coldClimate": { "hspf2Min": 8.0, "cop": 3.0, "minTemp": -30 }
    },
    "coldClimateFlag": {
      "appliesToProvinces": ["AB", "SK", "MB"],
      "costAdder": 0.20,
      "message": "..."
    },
    "savings": {
      "byFuel": {
        "naturalGas": { "mild": 0.45, "cold": 0.38, "heatingFraction": 0.70 },
        ...
      }
    },
    "suitability": {
      "residentialSingle": 1.0,
      "residentialCondo": 0.7,
      ...
    }
  }
}
```

### cost-models.json
```json
{
  "ashp": {
    "residential": {
      "perSqFt": 2.50,
      "baseMin": 8000,
      "baseMax": 18000
    },
    "commercial": {
      "perSqFt": 1.50,
      "baseMin": 25000,
      "baseMax": 60000,
      "adders": { "engineering": 3000, "controls": 5000 }
    }
  }
}
```

---

## Project Structure

| Path | Purpose |
|:--|:--|
| `index.html` | Single-page interface |
| `js/` | Calculator, financing, postal-code lookup, validation, formatting |
| `css/` | Theme and components |
| `data/` | Versioned JSON data: provinces, postal codes, interventions, cost models, changelog |
| `docs/dev-notes/` | Build notes from the rebuild |

## Quarterly Update Schedule

**Q1 (Jan 1)**: Utility rates, grid factors, incentives
**Q2 (Apr 1)**: Same process
**Q3 (Jul 1)**: Same process
**Q4 (Oct 1)**: Same process

### Update Process
1. Check utility websites (ATCO, Hydro-Québec, BC Hydro, etc.)
2. Verify CER grid factors (usually Jan update)
3. Check NRCAN incentives (Canada Greener Homes, provincial programs)
4. Update JSON files
5. Add entry to CHANGELOG.json
6. Git commit with message: `[Data Update Q1 2026] Utility rates, grid factors, incentives`
7. GitHub Pages auto-deploys

---

## Data Sources (All Verified, Q1 2026)

### Grid Emission Factors
- **CER National Electricity System Model 2024**
  - Source: https://www.cer-rec.gc.ca/en/data-analysis/energy-markets/provincial-territorial-energy-profiles/
  - Confidence: High
  - Next update: Jan 2027 (annual)

### Utility Rates
- **ATCO Gas**: https://www.atco.com/rates (AB)
- **Enbridge Gas**: https://www.enbridge.com/rates-and-tariffs (ON)
- **Hydro-Québec**: https://www.hydroquebec.com/residential/rates (QC)
- **BC Hydro**: https://www.bchydro.com/rates (BC)
- **Other utilities**: Provincial tariff schedules (verified Jan 2026)

### Emission Factors
- **ECCC National Inventory Report**
  - Source: https://www.canada.ca/en/environment-climate-change/services/climate-change/greenhouse-gas-emissions.html
  - Fuel emission factors: Natural gas, oil, propane (kg CO₂/unit)

### HDD Data
- **NRCAN Heating Degree-Days Map**
  - Source: https://www.nrcan.gc.ca/maps-tools-and-publications/tools/map-tools/heating-degree-days-map
  - 30-year climate normals
  - 412 postal prefixes extracted and validated

### Incentives
- **Canada Greener Homes Program**
  - Source: https://www.nrcan.gc.ca/energy-efficiency/homes/canada-greener-homes-grant/23441
  - Grant amounts: $5,600 residential (2026)
  - Verified Jan 15, 2026

---

## File Sizes & Performance

- **Uncompressed**: 114 KB
- **Gzipped**: ~30 KB (typical browser compression)
- **Load time**: <1 second on 4G
- **GitHub Pages bandwidth**: Unlimited

---

## Versioning

```
energy-advisor-v2/
├── v2/
│   ├── index.html
│   ├── js/
│   ├── css/
│   └── data/
└── v1/ (archived, read-only)
```

If breaking changes needed, create `/v3` directory. Old versions remain accessible.

---

## Author

Built by [Mohamed Bah](https://github.com/Moezusb). Data sources and methodology are cited in-app under "How We Calculated This."
