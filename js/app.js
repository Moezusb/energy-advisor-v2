/**
 * app.js - Main application logic
 * Initializes services, handles form submission, renders results
 */

class EnergyAdvisor {
    constructor() {
        this.initialized = false;
        this.currentAnalysis = null;
    }

    /**
     * Initialize the application
     */
    async init() {
        try {
            console.log('Initializing Energy Advisor...');

            // Initialize all services
            await geoService.init();
            await analysisEngine.init();

            this.setupEventListeners();
            this.initialized = true;

            console.log('Energy Advisor initialized successfully');
        } catch (error) {
            console.error('Initialization error:', error);
            this.showError('Failed to load data. Please refresh the page.');
        }
    }

    /**
     * Set up form event listeners
     */
    setupEventListeners() {
        const form = document.getElementById('advisorForm');
        const postalInput = document.getElementById('postalCode');
        const newAnalysisBtn = document.getElementById('newAnalysisBtn');
        const emptyStateBtn = document.getElementById('emptyStateBtn');

        // Form submission
        form.addEventListener('submit', (e) => this.handleSubmit(e));

        // Postal code input - update climate meter in real-time
        postalInput.addEventListener('input', (e) => this.updateClimateMeter(e.target.value));

        // New analysis button
        if (newAnalysisBtn) {
            newAnalysisBtn.addEventListener('click', () => this.resetForm());
        }

        // Empty state button
        if (emptyStateBtn) {
            emptyStateBtn.addEventListener('click', () => this.resetForm());
        }

        // Clear errors on field focus
        document.querySelectorAll('.form-input, .form-select').forEach(field => {
            field.addEventListener('focus', () => {
                Validator.clearFieldError(field.id);
            });
        });
    }

    /**
     * Update climate meter as user types postal code
     */
    updateClimateMeter(postalCode) {
        const meter = document.getElementById('climateBar');
        const hddValue = document.getElementById('hddValue');

        if (!postalCode || postalCode.length < 3) {
            meter.style.width = '0%';
            hddValue.textContent = '—';
            return;
        }

        const location = geoService.lookupPostalCode(postalCode.toUpperCase());
        if (!location) {
            meter.style.width = '0%';
            hddValue.textContent = '—';
            return;
        }

        // Scale meter from 0-5000 HDD (0-100%)
        const hdd = location.hdd;
        const percentage = Math.min((hdd / 5000) * 100, 100);
        meter.style.width = percentage + '%';
        hddValue.textContent = hdd + ' HDD';
    }

    /**
     * Handle form submission
     */
    async handleSubmit(event) {
        event.preventDefault();

        // Clear previous errors
        Validator.clearAllErrors();

        // Get form data
        const formData = {
            postalCode: document.getElementById('postalCode').value.trim(),
            buildingType: document.getElementById('buildingType').value,
            fuel: document.getElementById('currentFuel').value,
            annualSpend: document.getElementById('annualSpend').value,
            squareFeet: document.getElementById('squareFeet').value
        };

        // Validate
        const validation = Validator.validateForm(formData);
        if (!validation.valid) {
            this.displayValidationErrors(validation.errors);
            return;
        }

        // Show warnings if any
        if (Object.keys(validation.warnings).length > 0) {
            console.warn('Validation warnings:', validation.warnings);
            // Could show warnings to user, but proceed anyway
        }

        // Run analysis
        try {
            this.currentAnalysis = await analysisEngine.analyze(formData);
            this.displayResults();
        } catch (error) {
            console.error('Analysis error:', error);
            this.showError('Analysis failed. Please try again.');
        }
    }

    /**
     * Display validation errors
     */
    displayValidationErrors(errors) {
        for (const [fieldId, message] of Object.entries(errors)) {
            Validator.showFieldError(fieldId, message);
        }
    }

    /**
     * Display results
     */
    displayResults() {
        const analysis = this.currentAnalysis;

        // Hide form, show results
        document.getElementById('formSection').style.display = 'none';
        document.getElementById('resultsSection').style.display = 'block';
        document.getElementById('emptyState').style.display = 'none';

        // Update summary card
        document.getElementById('resultLocation').textContent = `${analysis.location.city}, ${analysis.location.province}`;
        document.getElementById('resultBuildingType').textContent = Formatter.buildingType(analysis.building.type);
        document.getElementById('resultFuel').textContent = Formatter.fuel(analysis.building.fuel);
        document.getElementById('resultSpend').textContent = Formatter.currency(analysis.building.annualSpend);

        // Display recommendations
        this.displayRecommendations(analysis.recommendations);

        // Display financing scenarios for top recommendation
        if (analysis.recommendations.length > 0) {
            this.displayFinancing(analysis.recommendations[0]);
        }

        // Display cold climate warning if applicable
        if (analysis.location.isCold) {
            const alert = document.getElementById('coldClimateAlert');
            const message = document.getElementById('coldClimateMessage');
            alert.style.display = 'block';
            message.textContent = 'This region requires cold-climate rated heat pumps (HSPF2 ≥ 8.0). Costs shown reflect this requirement.';
        } else {
            document.getElementById('coldClimateAlert').style.display = 'none';
        }

        // Display methodology
        document.getElementById('methodologyContent').innerHTML = Formatter.methodology(analysis);

        // Scroll to results
        document.getElementById('resultsSection').scrollIntoView({ behavior: 'smooth' });
    }

    /**
     * Display recommendation cards
     */
    displayRecommendations(recommendations) {
        const grid = document.getElementById('recommendationsGrid');
        grid.innerHTML = '';

        recommendations.forEach((rec, index) => {
            const card = document.createElement('div');
            card.className = 'recommendation-card';

            const savingsPercentage = (rec.savings.rate * 100).toFixed(0);

            card.innerHTML = `
                <div class="recommendation-rank">Top ${index + 1}</div>
                <h3 class="recommendation-name">${rec.name}</h3>
                
                <div class="recommendation-stats">
                    <div class="stat">
                        <span class="stat-label">Cost Estimate</span>
                        <span class="stat-value">${Formatter.currency(rec.cost.estimate)}</span>
                    </div>
                    <div class="stat">
                        <span class="stat-label">Annual Savings</span>
                        <span class="stat-value positive">$${Formatter.number(Math.round(rec.savings.annual))}</span>
                    </div>
                    <div class="stat">
                        <span class="stat-label">Simple Payback</span>
                        <span class="stat-value">${rec.payback.years} years</span>
                    </div>
                    <div class="stat">
                        <span class="stat-label">ROI</span>
                        <span class="stat-value">${(rec.roi * 100).toFixed(0)}%</span>
                    </div>
                </div>

                <p class="recommendation-description">${rec.description}</p>

                <details class="details-box">
                    <summary>More Details</summary>
                    <div class="details-content">
                        <p><strong>Cost Range:</strong> $${Formatter.number(Math.round(rec.cost.low))}–$${Formatter.number(Math.round(rec.cost.high))}</p>
                        <p><strong>Savings Rate:</strong> ${rec.savings.rate}% of annual energy spend</p>
                        <p><strong>Suitability for your building:</strong> ${(rec.suitability * 100).toFixed(0)}%</p>
                        ${rec.hasColdemateFlag ? `<p><strong>⚠️ Cold Climate Note:</strong> ${rec.coldClimateMessage}</p>` : ''}
                        <p><strong>Incentives:</strong> ${rec.incentives.join(', ')}</p>
                    </div>
                </details>
            `;

            grid.appendChild(card);
        });
    }

    /**
     * Display financing scenarios
     */
    displayFinancing(topRecommendation) {
        const section = document.getElementById('financingSection');
        const grid = document.getElementById('financingGrid');

        const scenarios = FinanceCalculator.generateScenarios(
            topRecommendation.cost.estimate,
            topRecommendation.savings.annual
        );

        grid.innerHTML = '';

        scenarios.forEach(scenario => {
            const card = document.createElement('div');
            card.className = 'financing-card';

            card.innerHTML = `
                <div class="financing-scenario">${scenario.name}</div>
                <p style="color: var(--color-neutral-500); font-size: 0.875rem; margin-bottom: var(--space-4);">${scenario.subtitle}</p>

                <div class="financing-item">
                    <span class="financing-label">Monthly Payment</span>
                    <span class="financing-value">${scenario.monthlyPayment > 0 ? Formatter.currency(scenario.monthlyPayment) : 'Upfront'}</span>
                </div>

                <div class="financing-item">
                    <span class="financing-label">Total Cost</span>
                    <span class="financing-value">${Formatter.currency(scenario.totalPayment)}</span>
                </div>

                <div class="financing-item">
                    <span class="financing-label">Interest Paid</span>
                    <span class="financing-value">${Formatter.currency(scenario.interestPaid)}</span>
                </div>

                <div class="financing-item">
                    <span class="financing-label">Monthly Net (Year 1)</span>
                    <span class="financing-value" style="color: ${scenario.netMonthlyYear1 > 0 ? 'var(--color-success)' : 'var(--color-neutral-700)'}">
                        ${scenario.netMonthlyYear1 > 0 ? '+' : ''}${Formatter.currency(scenario.netMonthlyYear1)}
                    </span>
                </div>

                <p style="font-size: 0.875rem; color: var(--color-neutral-600); margin-top: var(--space-6); padding-top: var(--space-6); border-top: 1px solid var(--color-neutral-200);">
                    ${scenario.description}
                </p>
            `;

            grid.appendChild(card);
        });

        section.style.display = 'block';
    }

    /**
     * Reset form and go back
     */
    resetForm() {
        document.getElementById('advisorForm').reset();
        document.getElementById('formSection').style.display = 'block';
        document.getElementById('resultsSection').style.display = 'none';
        document.getElementById('emptyState').style.display = 'none';
        document.getElementById('coldClimateAlert').style.display = 'none';

        // Clear climate meter
        document.getElementById('climateBar').style.width = '0%';
        document.getElementById('hddValue').textContent = '—';

        Validator.clearAllErrors();
        document.getElementById('formSection').scrollIntoView({ behavior: 'smooth' });
    }

    /**
     * Show error message
     */
    showError(message) {
        const alertDiv = document.createElement('div');
        alertDiv.className = 'alert alert-warning';
        alertDiv.innerHTML = `
            <span class="alert-icon">⚠️</span>
            <div class="alert-content">
                <p>${message}</p>
            </div>
        `;

        const main = document.querySelector('.main-content');
        main.insertBefore(alertDiv, main.firstChild);

        setTimeout(() => alertDiv.remove(), 5000);
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    const app = new EnergyAdvisor();
    await app.init();
});
