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
     * Estimate cost for an intervention
     */
    estimateCost(interventionId, intervention, buildingType, squareFeet) {
        const costModel = this.costModelsData[interventionId];
        if (!costModel) {
            return null;
        }

        let baseCost;

        // Get building type cost model
        if (buildingType.startsWith('residential')) {
            const model = costModel.residential;
            baseCost = Math.max(
                model.baseMin,
                Math.min(model.baseMax, squareFeet * model.perSqFt)
            );
        } else if (buildingType.startsWith('commercial')) {
            const model = costModel.commercial || costModel.residential;
            baseCost = Math.max(
                model.baseMin,
                Math.min(model.baseMax, squareFeet * model.perSqFt)
            );
        } else if (buildingType === 'warehouse') {
            const model = costModel.warehouse || costModel.commercial || costModel.residential;
            baseCost = Math.max(
                model.baseMin,
                Math.min(model.baseMax, squareFeet * model.perSqFt)
            );
        } else if (buildingType === 'institutional') {
            const model = costModel.commercial || costModel.residential;
            baseCost = Math.max(
                model.baseMin,
                Math.min(model.baseMax, squareFeet * model.perSqFt)
            );
        }

        return {
            cost: baseCost,
            low: baseCost * 0.85,
            high: baseCost * 1.15
        };
    }
}

// Export singleton instance
const analysisEngine = new AnalysisEngine();
