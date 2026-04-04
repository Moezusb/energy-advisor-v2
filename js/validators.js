/**
 * validators.js - Input validation and sanity checks
 * Ensures user input is reasonable before analysis
 */

class Validator {
    /**
     * Validate postal code format and existence
     * @param {string} postalCode - First 3 characters
     * @returns {object} { valid: boolean, error: string }
     */
    static validatePostalCode(postalCode) {
        if (!postalCode || postalCode.trim() === '') {
            return { valid: false, error: 'Postal code is required' };
        }

        const cleaned = postalCode.toUpperCase().trim();

        if (cleaned.length !== 3) {
            return { valid: false, error: 'Enter first 3 characters (e.g., M1A, T1A)' };
        }

        if (!geoService.isValidPostalCode(cleaned)) {
            return { valid: false, error: 'Postal code not found. Check and try again.' };
        }

        return { valid: true, error: null };
    }

    /**
     * Validate building type
     * @param {string} buildingType - Selected building type
     * @returns {object} { valid: boolean, error: string }
     */
    static validateBuildingType(buildingType) {
        const validTypes = [
            'residentialSingle',
            'residentialCondo',
            'residentialMulti',
            'commercialOffice',
            'commercialRetail',
            'institutional',
            'industrialLight',
            'warehouse'
        ];

        if (!buildingType || !validTypes.includes(buildingType)) {
            return { valid: false, error: 'Please select a valid building type' };
        }

        return { valid: true, error: null };
    }

    /**
     * Validate heating fuel type
     * @param {string} fuel - Selected fuel
     * @returns {object} { valid: boolean, error: string }
     */
    static validateFuel(fuel) {
        const validFuels = [
            'naturalGas',
            'heatingOil',
            'propane',
            'electricBaseboard',
            'electricHeatPump',
            'districtHeating',
            'wood'
        ];

        if (!fuel || !validFuels.includes(fuel)) {
            return { valid: false, error: 'Please select a valid heating fuel' };
        }

        return { valid: true, error: null };
    }

    /**
     * Validate annual energy spend
     * @param {number|string} spend - Annual spend in CAD
     * @returns {object} { valid: boolean, error: string, warning: string }
     */
    static validateAnnualSpend(spend) {
        const num = parseFloat(spend);

        if (!spend || isNaN(num)) {
            return { valid: false, error: 'Annual spend is required' };
        }

        if (num < 100) {
            return { valid: false, error: 'Annual spend must be at least $100' };
        }

        if (num > 100000) {
            return { valid: false, error: 'Annual spend cannot exceed $100,000' };
        }

        let warning = null;

        // Sanity check: warn if unusually high/low for building type
        if (num < 500) {
            warning = 'Unusually low. Is this the total annual energy cost?';
        }

        if (num > 50000) {
            warning = 'Unusually high. Is this annual or monthly?';
        }

        return { valid: true, error: null, warning };
    }

    /**
     * Validate building size (optional)
     * @param {number|string} sqft - Building size in sq ft
     * @returns {object} { valid: boolean, error: string, warning: string }
     */
    static validateBuildingSize(sqft) {
        if (!sqft || sqft.trim() === '') {
            // Optional field
            return { valid: true, error: null };
        }

        const num = parseFloat(sqft);

        if (isNaN(num)) {
            return { valid: false, error: 'Building size must be a number' };
        }

        if (num < 100) {
            return { valid: false, error: 'Building size must be at least 100 sq ft' };
        }

        if (num > 500000) {
            return { valid: false, error: 'Building size cannot exceed 500,000 sq ft' };
        }

        let warning = null;

        // Sanity check: warn if energy intensity is unusual
        // Rough benchmarks: residential 1-2 $/sqft, commercial 1-3 $/sqft
        const energyIntensity = parseFloat(document.getElementById('annualSpend')?.value || 0) / num;

        if (energyIntensity > 6) {
            warning = `Energy intensity is ${energyIntensity.toFixed(2)} $/sqft (high - check inputs)`;
        }

        if (energyIntensity < 0.1) {
            warning = `Energy intensity is ${energyIntensity.toFixed(2)} $/sqft (low - check inputs)`;
        }

        return { valid: true, error: null, warning };
    }

    /**
     * Validate entire form
     * @param {object} formData - { postalCode, buildingType, fuel, annualSpend, squareFeet }
     * @returns {object} { valid: boolean, errors: object, warnings: object }
     */
    static validateForm(formData) {
        const errors = {};
        const warnings = {};

        // Postal Code
        const postalValidation = this.validatePostalCode(formData.postalCode);
        if (!postalValidation.valid) {
            errors.postalCode = postalValidation.error;
        }

        // Building Type
        const buildingValidation = this.validateBuildingType(formData.buildingType);
        if (!buildingValidation.valid) {
            errors.buildingType = buildingValidation.error;
        }

        // Fuel
        const fuelValidation = this.validateFuel(formData.fuel);
        if (!fuelValidation.valid) {
            errors.fuel = fuelValidation.error;
        }

        // Annual Spend
        const spendValidation = this.validateAnnualSpend(formData.annualSpend);
        if (!spendValidation.valid) {
            errors.annualSpend = spendValidation.error;
        }
        if (spendValidation.warning) {
            warnings.annualSpend = spendValidation.warning;
        }

        // Building Size (optional)
        if (formData.squareFeet) {
            const sizeValidation = this.validateBuildingSize(formData.squareFeet);
            if (!sizeValidation.valid) {
                errors.squareFeet = sizeValidation.error;
            }
            if (sizeValidation.warning) {
                warnings.squareFeet = sizeValidation.warning;
            }
        }

        return {
            valid: Object.keys(errors).length === 0,
            errors,
            warnings
        };
    }

    /**
     * Show validation error for a field
     * @param {string} fieldId - DOM element ID
     * @param {string} errorMessage - Error message to display
     */
    static showFieldError(fieldId, errorMessage) {
        const field = document.getElementById(fieldId);
        if (!field) return;

        field.classList.add('error');
        const existing = field.parentElement.querySelector('.field-error');
        if (existing) existing.remove();

        const errorEl = document.createElement('div');
        errorEl.className = 'field-error';
        errorEl.textContent = errorMessage;
        field.parentElement.appendChild(errorEl);
    }

    /**
     * Clear validation error for a field
     * @param {string} fieldId - DOM element ID
     */
    static clearFieldError(fieldId) {
        const field = document.getElementById(fieldId);
        if (!field) return;

        field.classList.remove('error');
        const errorEl = field.parentElement.querySelector('.field-error');
        if (errorEl) errorEl.remove();
    }

    /**
     * Clear all validation errors
     */
    static clearAllErrors() {
        document.querySelectorAll('.field-error').forEach(el => el.remove());
        document.querySelectorAll('.form-input, .form-select').forEach(el => {
            el.classList.remove('error');
        });
    }
}
