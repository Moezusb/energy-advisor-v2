/**
 * formatter.js - Display formatting utilities
 * Formats currency, percentages, confidence intervals, etc. for display
 */

class Formatter {
    /**
     * Format amount as currency (CAD)
     */
    static currency(amount) {
        return new Intl.NumberFormat('en-CA', {
            style: 'currency',
            currency: 'CAD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount);
    }

    /**
     * Format currency with decimals
     */
    static currencyDetailed(amount) {
        return new Intl.NumberFormat('en-CA', {
            style: 'currency',
            currency: 'CAD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount);
    }

    /**
     * Format percentage
     */
    static percentage(decimal, decimals = 1) {
        return (decimal * 100).toFixed(decimals) + '%';
    }

    /**
     * Format number with thousands separator
     */
    static number(num) {
        return num.toLocaleString('en-CA');
    }

    /**
     * Format building type for display
     */
    static buildingType(typeId) {
        const names = {
            residentialSingle: 'Single-Family Home',
            residentialCondo: 'Condo / Townhouse',
            residentialMulti: 'Multi-Unit (2-4)',
            commercialOffice: 'Commercial Office',
            commercialRetail: 'Retail',
            institutional: 'Institutional',
            industrialLight: 'Light Industrial',
            warehouse: 'Warehouse'
        };
        return names[typeId] || typeId;
    }

    /**
     * Format fuel type for display
     */
    static fuel(fuelId) {
        const names = {
            naturalGas: 'Natural Gas',
            heatingOil: 'Heating Oil',
            propane: 'Propane',
            electricBaseboard: 'Electric Baseboard',
            electricHeatPump: 'Electric Heat Pump',
            districtHeating: 'District Heating',
            wood: 'Wood / Pellets'
        };
        return names[fuelId] || fuelId;
    }

    /**
     * Format payback years with confidence interval
     */
    static paybackRange(paybackYears) {
        const low = (paybackYears * 0.85).toFixed(1);
        const high = (paybackYears * 1.15).toFixed(1);
        return `${low}–${high} years`;
    }

    /**
     * Format HDD value with label
     */
    static hdd(hddValue) {
        if (!hddValue) return '—';
        return `${this.number(Math.round(hddValue))} HDD`;
    }

    /**
     * Format climate zone
     */
    static climateZone(zone) {
        const names = {
            cold: 'Cold Climate',
            mild: 'Mild Climate'
        };
        return names[zone] || zone;
    }

    /**
     * Format confidence level as badge
     */
    static confidenceLevel(confidence) {
        const levels = {
            high: { label: 'High Confidence', color: 'green' },
            medium: { label: 'Medium Confidence', color: 'yellow' },
            low: { label: 'Estimate Only', color: 'orange' }
        };
        return levels[confidence] || levels.medium;
    }

    /**
     * Format recommendation card with stats
     */
    static recommendationCard(recommendation) {
        return {
            rank: recommendation.rank,
            name: recommendation.name,
            icon: recommendation.icon,
            cost: `$${this.number(Math.round(recommendation.cost.estimate))}`,
            costRange: `$${this.number(Math.round(recommendation.cost.low))}–$${this.number(Math.round(recommendation.cost.high))}`,
            annualSavings: `$${this.number(Math.round(recommendation.savings.annual))}`,
            savingsRate: recommendation.savings.rate + '%',
            payback: `${recommendation.payback.years} years`,
            paybackDetailed: `${recommendation.payback.withColdClimate} years`,
            roi: (recommendation.roi * 100).toFixed(0) + '%',
            suitability: (recommendation.suitability * 100).toFixed(0) + '%'
        };
    }

    /**
     * Format methodology/sources for display
     */
    static methodology(analysis) {
        const lines = [
            `<strong>Location:</strong> ${analysis.location.city}, ${analysis.location.province}`,
            `<strong>Heating Degree Days (HDD):</strong> ${this.hdd(analysis.location.hdd)}`,
            `<strong>Utility Rates:</strong> Gas: $${analysis.utility.gas.variable}/m³, Electricity: $${analysis.utility.electricity.residential}/kWh`,
            `<strong>Grid Emissions Factor:</strong> ${(analysis.utility.gridFactor).toFixed(3)} kg CO₂/kWh`,
            `<strong>Annual Energy Spend:</strong> ${this.currency(analysis.building.annualSpend)}`,
            `<strong>Data Sources:</strong> CER 2024 (grid), NRCAN (HDD), Provincial utilities (rates), ECCC (emissions)`,
            `<strong>Last Updated:</strong> Q1 2026 | <strong>Next Update:</strong> Q2 2026`
        ];

        return lines.join('<br>');
    }

    /**
     * Format confidence interval explanation
     */
    static confidenceExplanation(confidence) {
        const explanations = {
            high: 'Based on verified utility data and established retrofit pricing. Accurate within ±10%.',
            medium: 'Estimated from regional averages and industry standards. Accurate within ±20%.',
            low: 'Rough estimate only. Get quotes before deciding. Could vary by ±30% or more.'
        };
        return explanations[confidence] || explanations.medium;
    }

    /**
     * Format cold climate warning message
     */
    static coldClimateWarning(provinceCode, climateMessage) {
        return `⚠️ <strong>Cold Climate:</strong> ${climateMessage}`;
    }

    /**
     * Format financing scenario for display
     */
    static financingScenario(scenario) {
        return {
            name: scenario.name,
            subtitle: scenario.subtitle,
            monthlyPayment: scenario.monthlyPayment > 0
                ? this.currency(scenario.monthlyPayment)
                : 'Upfront',
            totalCost: this.currency(scenario.totalPayment),
            interestCost: scenario.interestPaid > 0
                ? this.currency(scenario.interestPaid)
                : 'None',
            netMonthly: scenario.netMonthlyYear1 > 0
                ? `+${this.currency(scenario.netMonthlyYear1)} saved`
                : `${this.currency(Math.abs(scenario.netMonthlyYear1))} cost`,
            description: scenario.description
        };
    }

    /**
     * Format currency per month
     */
    static currencyPerMonth(amount) {
        return this.currency(amount) + '/month';
    }

    /**
     * Format currency per year
     */
    static currencyPerYear(amount) {
        return this.currency(amount) + '/year';
    }

    /**
     * Format incentive list
     */
    static incentivesList(incentiveNames) {
        if (!incentiveNames || incentiveNames.length === 0) {
            return 'No provincial incentives available';
        }
        return incentiveNames.join(' • ');
    }

    /**
     * Format ROI as badge/label
     */
    static roiBadge(roi) {
        if (roi > 0.25) return '⭐ Excellent ROI';
        if (roi > 0.15) return '✓ Good ROI';
        if (roi > 0.05) return '→ Fair ROI';
        return 'Low ROI';
    }
}
