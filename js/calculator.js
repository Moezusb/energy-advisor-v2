/**
 * calculator.js - Analysis engine
 * Calculates retrofit suitability, costs, savings, payback periods
 * Ranks recommendations by ROI
 */

class AnalysisEngine {
    constructor() {
        this.interventionsData = null;
        this.costModelsData = null;
        this.initialized = false;
    }

    /**
     * Initialize by loading data files
     */
    async init() {
        try {
            const [interventionsRes, costModelsRes] = await Promise.all([
                fetch('data/interventions.json'),
                fetch('data/cost-models.json')
            ]);

            this.interventionsData = await interventionsRes.json();
            this.costModelsData = await costModelsRes.json();
            this.initialized = true;
        } catch (error) {
            console.error('Error loading analysis data:', error);
            throw new Error('Could not load retrofit data');
        }
    }

    /**
     * Run full analysis for a building
     * @param {object} input - { postalCode, buildingType, fuel, annualSpend, squareFeet }
     * @returns {object} Analysis results with ranked recommendations
     */
    async analyze(input) {
        if (!this.initialized) {
            throw new Error('AnalysisEngine not initialized. Call init() first.');
        }

        // Get location data
        const province = geoService.getProvince(input.postalCode);
        const hdd = geoService.getHDD(input.postalCode);
        const city = geoService.getCity(input.postalCode);
        const provinceData = geoService.getProvinceData(province);
        const isCold = geoService.isColdClimate(province);

        // Calculate HDD multiplier for scaling savings
        const hddMultiplier = geoService.getHDDMultiplier(hdd);

        // Score all interventions
        const interventionScores = [];

        for (const [interventionId, intervention] of Object.entries(this.interventionsData)) {
            const score = this.scoreIntervention(
                interventionId,
                intervention,
                input.buildingType,
                input.fuel,
                input.annualSpend,
                input.squareFeet,
                provinceData,
                hdd,
                hddMultiplier,
                isCold
            );

            if (score) {
                interventionScores.push(score);
            }
        }

        // Sort by ROI (highest first)
        interventionScores.sort((a, b) => b.roi - a.roi);

        return {
            location: {
                postalCode: input.postalCode,
                city,
                province,
                hdd,
                hddMultiplier,
                isCold,
                climateZone: geoService.getClimateZone(province)
            },
            building: {
                type: input.buildingType,
                fuel: input.fuel,
                annualSpend: input.annualSpend,
                squareFeet: input.squareFeet
            },
            utility: {
                gas: provinceData.utility.gas,
                electricity: provinceData.utility.electricity,
                gridFactor: provinceData.grid.factor
            },
            recommendations: interventionScores.slice(0, 3), // Top 3
            allRecommendations: interventionScores,
            incentives: geoService.getIncentives(input.postalCode)
        };
    }

    /**
     * Score a single intervention
     * @returns {object} Score with cost, savings, payback, suitability, etc.
     */
    scoreIntervention(id, intervention, buildingType, fuel, annualSpend, squareFeet, provinceData, hdd, hddMultiplier, isCold) {
        // 1. Calculate suitability score (0-1)
        const suitabilityMultiplier = intervention.suitability[buildingType] || 0;
        if (suitabilityMultiplier === 0) {
            return null; // Not suitable for this building type
        }

        // 2. Get cost estimate
        const costEstimate = this.estimateCost(
            id,
            intervention,
            buildingType,
            squareFeet || 2000 // Default 2000 sqft if not provided
        );

        if (!costEstimate) {
            return null;
        }

        // 3. Calculate annual savings
        const baseSavingsRate = intervention.savings.byFuel[fuel]?.mild || 0;
        if (baseSavingsRate === 0) {
            return null; // No savings for this fuel type
        }

        // Adjust for climate (cold vs mild)
        const climateAdjustedSavingsRate = this.adjustSavingsForClimate(
            baseSavingsRate,
            hdd,
            intervention.savings.byFuel[fuel]
        );

        // Account for heating vs DHW split if applicable
        let adjustedSavingsRate = climateAdjustedSavingsRate;
        if (intervention.savings.byFuel[fuel].heatingFraction) {
            const heatingFraction = intervention.savings.byFuel[fuel].heatingFraction;
            adjustedSavingsRate = climateAdjustedSavingsRate * heatingFraction;
        }

        const annualSavings = annualSpend * adjustedSavingsRate;

        // 4. Calculate payback (simple payback, no financing)
        const simplePayback = costEstimate.cost / annualSavings;

        // 5. Calculate ROI (simplified: annual savings / cost)
        const roi = annualSavings / costEstimate.cost;

        // 6. Cold climate cost adder
        let costAdder = 0;
        if (isCold && intervention.coldClimateFlag?.appliesToProvinces?.includes(provinceData.utility.gas.source.substring(0, 2))) {
            costAdder = intervention.coldClimateFlag.costAdder || 0;
        }

        const finalCost = costEstimate.cost * (1 + costAdder);
        const finalPayback = finalCost / annualSavings;
        const finalRoi = annualSavings / finalCost;

        return {
            id,
            name: intervention.name,
            icon: intervention.icon,
            category: intervention.category,
            cost: {
                low: costEstimate.low,
                high: costEstimate.high,
                estimate: finalCost,
                confidence: 'medium'
            },
            savings: {
                annual: annualSavings,
                rate: (adjustedSavingsRate * 100).toFixed(1),
                confidence: 'medium'
            },
            payback: {
                simple: simplePayback.toFixed(1),
                withColdClimate: finalPayback.toFixed(1),
                years: Math.round(finalPayback)
            },
            roi,
            suitability: suitabilityMultiplier,
            hasColdemateFlag: isCold && intervention.coldClimateFlag?.appliesToProvinces?.includes(geoService.getProvince(provinceData.utility.gas.source.substring(0, 2))),
            coldClimateMessage: intervention.coldClimateFlag?.message,
            description: intervention.description,
            incentives: intervention.incentives,
            exploreData: intervention.exploreData
        };
    }

    /**
     * Adjust savings rate for climate (HDD)
     */
    adjustSavingsForClimate(baseRate, hdd, fuelData) {
        if (!fuelData.cold || !fuelData.mild) {
            return baseRate;
        }

        // Linear interpolation between mild and cold
        // Mild = 2500 HDD, Cold = 4500 HDD
        const MILD_HDD = 2500;
        const COLD_HDD = 4500;

        if (hdd <= MILD_HDD) {
            return fuelData.mild;
        }

        if (hdd >= COLD_HDD) {
            return fuelData.cold;
        }

        // Interpolate
        const ratio = (hdd - MILD_HDD) / (COLD_HDD - MILD_HDD);
        return fuelData.mild + (fuelData.cold - fuelData.mild) * ratio;
    }

    /**
     * Estimate cost for an intervention with detailed logic
     * Handles multiple patterns: perSqFt, perWatt, fixed total, systemSizes
     */
    estimateCost(interventionId, intervention, buildingType, squareFeet) {
        const costModel = this.costModelsData[interventionId];
        if (!costModel) {
            return null;
        }

        let model = null;
        let baseCost = 0;
        let adders = 0;

        // Select model based on building type
        if (buildingType.startsWith('residential')) {
            model = costModel.residential;
        } else if (buildingType.startsWith('commercial') || buildingType === 'institutional') {
            model = costModel.commercial || costModel.residential;
        } else if (buildingType === 'warehouse') {
            model = costModel.warehouse || costModel.commercial || costModel.residential;
        }

        if (!model) {
            return null;
        }

        // PATTERN 1: Fixed total cost (smart controls, LED lighting, dual-energy)
        if (model.total) {
            baseCost = model.total;
        }
        // PATTERN 2: Per-watt cost with system sizes (solar PV)
        else if (model.perWatt && model.systemSizes) {
            // Select system size based on annual spend (proxy for energy usage)
            // Residential: ~2000-5000 kWh/year typical
            // Estimate system size: 5-10 kW for residential, 50-250 kW for commercial
            let systemSize = buildingType.startsWith('residential') ? '10kW' : '100kW';
            
            // For residential, scale by building size
            if (buildingType.startsWith('residential') && squareFeet) {
                if (squareFeet < 1500) systemSize = '8kW';
                else if (squareFeet > 3500) systemSize = '15kW';
                else systemSize = '10kW';
            }

            const systemData = model.systemSizes[systemSize];
            if (systemData && systemData.cost) {
                baseCost = systemData.cost;
            } else {
                // Fallback: use perWatt * estimated system size
                const estimatedWatts = buildingType.startsWith('residential') ? 10000 : 100000;
                baseCost = estimatedWatts * model.perWatt;
            }
        }
        // PATTERN 3: Per-sqft cost with min/max clamping (ASHP, envelope, etc.)
        else if (model.perSqFt) {
            const perSqFtCost = squareFeet * model.perSqFt;
            baseCost = Math.max(
                model.baseMin || 0,
                Math.min(model.baseMax || Infinity, perSqFtCost)
            );
        }

        // Add commercial adders (engineering, controls, commissioning, drilling, etc.)
        if (model.adders) {
            adders = Object.values(model.adders).reduce((sum, cost) => sum + cost, 0);
        }

        const finalCost = baseCost + adders;

        // Calculate confidence range (±15% for standard, ±20% for custom)
        const hasCustomization = model.adders || model.variants || model.systemSizes;
        const rangeFactor = hasCustomization ? 0.20 : 0.15;

        return {
            cost: finalCost,
            low: finalCost * (1 - rangeFactor),
            high: finalCost * (1 + rangeFactor),
            breakdown: {
                baseCost,
                adders,
                total: finalCost,
                source: model.perSqFt ? `${model.perSqFt}$/sqft + adders` : 'cost model'
            }
        };
    }
}

// Export singleton instance
const analysisEngine = new AnalysisEngine();
