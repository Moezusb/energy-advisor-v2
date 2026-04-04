/**
 * finance.js - Financing calculations
 * Calculates loan payments and net cash flow scenarios
 */

class FinanceCalculator {
    /**
     * Calculate loan payment (monthly)
     * Uses standard amortization formula: M = P * [r(1+r)^n] / [(1+r)^n - 1]
     * @param {number} principal - Amount borrowed
     * @param {number} annualRate - Annual interest rate (as decimal, e.g., 0.07 for 7%)
     * @param {number} years - Loan term in years
     * @returns {number} Monthly payment
     */
    static calculateMonthlyPayment(principal, annualRate, years) {
        const monthlyRate = annualRate / 12;
        const numPayments = years * 12;

        if (monthlyRate === 0) {
            return principal / numPayments;
        }

        const payment =
            (principal * monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
            (Math.pow(1 + monthlyRate, numPayments) - 1);

        return payment;
    }

    /**
     * Calculate total interest paid over loan term
     */
    static calculateTotalInterest(principal, monthlyPayment, years) {
        return monthlyPayment * (years * 12) - principal;
    }

    /**
     * Generate financing scenarios for a retrofit cost
     * @param {number} retrofitCost - Cost of the retrofit
     * @param {number} annualSavings - Annual energy savings
     * @returns {object} Scenarios including cash purchase, 10-year loan, 15-year loan
     */
    static generateScenarios(retrofitCost, annualSavings) {
        const scenarios = [];

        // Scenario 1: Cash purchase (no financing)
        scenarios.push({
            name: 'Cash Purchase',
            subtitle: 'Pay upfront',
            cost: retrofitCost,
            monthlyPayment: 0,
            totalPayment: retrofitCost,
            interestPaid: 0,
            years: 0,
            netMonthlyYear1: annualSavings / 12,
            payoffMonth: 1,
            description: `Pay $${this.formatCurrency(retrofitCost)} upfront. No financing costs.`
        });

        // Scenario 2: 10-year loan @ 7%
        const rate10 = 0.07;
        const monthlyPayment10 = this.calculateMonthlyPayment(retrofitCost, rate10, 10);
        const totalInterest10 = this.calculateTotalInterest(retrofitCost, monthlyPayment10, 10);
        const netMonthly10 = (annualSavings / 12) - monthlyPayment10;

        scenarios.push({
            name: '10-Year Loan',
            subtitle: 'Most Popular',
            cost: retrofitCost,
            monthlyPayment: monthlyPayment10,
            totalPayment: retrofitCost + totalInterest10,
            interestPaid: totalInterest10,
            years: 10,
            netMonthlyYear1: netMonthly10,
            payoffMonth: 10 * 12,
            rate: rate10,
            description: netMonthly10 > 0
                ? `Pay $${this.formatCurrency(monthlyPayment10)}/month for 10 years. Save $${this.formatCurrency(Math.abs(netMonthly10))}/month in cash flow from year 1.`
                : `Pay $${this.formatCurrency(monthlyPayment10)}/month. Break even in ~${Math.round(retrofitCost / annualSavings)} years.`
        });

        // Scenario 3: 15-year loan @ 7%
        const rate15 = 0.07;
        const monthlyPayment15 = this.calculateMonthlyPayment(retrofitCost, rate15, 15);
        const totalInterest15 = this.calculateTotalInterest(retrofitCost, monthlyPayment15, 15);
        const netMonthly15 = (annualSavings / 12) - monthlyPayment15;

        scenarios.push({
            name: '15-Year Loan',
            subtitle: 'Lower Monthly Payment',
            cost: retrofitCost,
            monthlyPayment: monthlyPayment15,
            totalPayment: retrofitCost + totalInterest15,
            interestPaid: totalInterest15,
            years: 15,
            netMonthlyYear1: netMonthly15,
            payoffMonth: 15 * 12,
            rate: rate15,
            description: netMonthly15 > 0
                ? `Pay $${this.formatCurrency(monthlyPayment15)}/month for 15 years. Save $${this.formatCurrency(Math.abs(netMonthly15))}/month in cash flow from year 1.`
                : `Pay $${this.formatCurrency(monthlyPayment15)}/month. Break even in ~${Math.round(retrofitCost / annualSavings)} years.`
        });

        return scenarios;
    }

    /**
     * Calculate payoff date
     * When annual savings exceed loan payments
     * @param {number} annualSavings - Annual energy savings
     * @param {number} monthlyPayment - Monthly loan payment
     * @returns {number} Months until payoff
     */
    static calculatePayoffMonths(annualSavings, monthlyPayment) {
        const monthlySavings = annualSavings / 12;
        const monthlyNetSavings = monthlySavings - monthlyPayment;

        if (monthlyNetSavings >= 0) {
            return 1; // Immediate payoff
        }

        // This is approximate (doesn't account for amortization)
        // For detailed calculation, would need iterative approach
        return Math.ceil(12 / (annualSavings / monthlyPayment));
    }

    /**
     * Format currency
     */
    static formatCurrency(amount) {
        return amount.toLocaleString('en-CA', {
            style: 'currency',
            currency: 'CAD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        });
    }

    /**
     * Calculate cash flow for a given year
     */
    static calculateYearlyNetCashFlow(year, monthlyPayment, annualSavings) {
        if (year <= 0) return 0;
        if (monthlyPayment === 0) return annualSavings; // Paid in cash

        const yearlyPayment = monthlyPayment * 12;
        return annualSavings - yearlyPayment;
    }

    /**
     * Calculate cumulative cash flow (break-even analysis)
     */
    static calculateCumulativeCashFlow(retrofitCost, monthlyPayment, annualSavings, maxYears = 20) {
        const cashFlow = [];
        let cumulative = -retrofitCost; // Start negative (cost of retrofit)

        for (let year = 1; year <= maxYears; year++) {
            const yearlyPayment = monthlyPayment * 12;
            const netCashFlow = annualSavings - yearlyPayment;
            cumulative += netCashFlow;

            cashFlow.push({
                year,
                annualSavings,
                annualPayment: yearlyPayment,
                netCashFlow,
                cumulative
            });

            // Stop after break-even
            if (cumulative >= 0) {
                break;
            }
        }

        return cashFlow;
    }
}
