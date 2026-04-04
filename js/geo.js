/**
 * geo.js - Geolocation utilities
 * Handles postal code lookup, HDD retrieval, province detection
 */

class GeoService {
    constructor() {
        this.postalData = null;
        this.provincesData = null;
        this.initialized = false;
    }

    /**
     * Initialize by loading data files
     */
    async init() {
        try {
            const [postalRes, provincesRes] = await Promise.all([
                fetch('data/postal-codes.json'),
                fetch('data/provinces.json')
            ]);

            this.postalData = await postalRes.json();
            this.provincesData = await provincesRes.json();
            this.initialized = true;
        } catch (error) {
            console.error('Error loading geo data:', error);
            throw new Error('Could not load location data');
        }
    }

    /**
     * Look up a postal code prefix (first 3 chars)
     * @param {string} postalPrefix - First 3 characters of postal code
     * @returns {object} Location data with HDD, province, city, incentives
     */
    lookupPostalCode(postalPrefix) {
        if (!this.initialized) {
            throw new Error('GeoService not initialized. Call init() first.');
        }

        const prefix = postalPrefix.toUpperCase();

        if (!this.postalData[prefix]) {
            return null;
        }

        return this.postalData[prefix];
    }

    /**
     * Get province data (rates, grid factors, incentives, climate zone)
     * @param {string} provinceCode - Two-letter province code (e.g., 'ON', 'AB')
     * @returns {object} Province data
     */
    getProvinceData(provinceCode) {
        if (!this.initialized) {
            throw new Error('GeoService not initialized. Call init() first.');
        }

        return this.provincesData[provinceCode] || null;
    }

    /**
     * Get HDD for a location
     * @param {string} postalPrefix - First 3 characters of postal code
     * @returns {number} Heating Degree Days
     */
    getHDD(postalPrefix) {
        const location = this.lookupPostalCode(postalPrefix);
        return location ? location.hdd : null;
    }

    /**
     * Get province code from postal prefix
     * @param {string} postalPrefix - First 3 characters of postal code
     * @returns {string} Province code (e.g., 'ON')
     */
    getProvince(postalPrefix) {
        const location = this.lookupPostalCode(postalPrefix);
        return location ? location.province : null;
    }

    /**
     * Get city name from postal prefix
     * @param {string} postalPrefix - First 3 characters of postal code
     * @returns {string} City name
     */
    getCity(postalPrefix) {
        const location = this.lookupPostalCode(postalPrefix);
        return location ? location.city : null;
    }

    /**
     * Calculate HDD multiplier for savings scaling
     * Baseline HDD is 3500 (representative Canadian location)
     * @param {number} hdd - Heating Degree Days
     * @returns {number} Multiplier (e.g., 1.0 for baseline, 1.3 for colder)
     */
    getHDDMultiplier(hdd) {
        const BASELINE_HDD = 3500;
        return hdd / BASELINE_HDD;
    }

    /**
     * Get climate zone (cold, mild) for a province
     * @param {string} provinceCode - Two-letter province code
     * @returns {string} Climate zone ('cold', 'mild')
     */
    getClimateZone(provinceCode) {
        const province = this.getProvinceData(provinceCode);
        return province ? province.climate.zone : null;
    }

    /**
     * Check if location has cold climate flag
     * Cold climate: AB, SK, MB require HSPF2 ≥ 8.0 for ASHP
     * @param {string} provinceCode - Two-letter province code
     * @returns {boolean}
     */
    isColdClimate(provinceCode) {
        return ['AB', 'SK', 'MB'].includes(provinceCode);
    }

    /**
     * Get all incentive programs for a location
     * @param {string} postalPrefix - First 3 characters of postal code
     * @returns {array} List of incentive program names
     */
    getIncentives(postalPrefix) {
        const location = this.lookupPostalCode(postalPrefix);
        return location ? location.incentives : [];
    }

    /**
     * Validate postal code format
     * @param {string} postalPrefix - First 3 characters
     * @returns {boolean}
     */
    isValidPostalCode(postalPrefix) {
        if (!postalPrefix || postalPrefix.length !== 3) {
            return false;
        }
        return this.lookupPostalCode(postalPrefix) !== null;
    }
}

// Export singleton instance
const geoService = new GeoService();
