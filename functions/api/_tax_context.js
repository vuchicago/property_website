export const CURRENT_TAX_YEAR = 2024;
export const CURRENT_STATE_EQUALIZER = 3.0355;

function toNumber(value) {
        if (value === null || value === undefined || value === '') {
                return null;
        }

        const number = Number(value);
        return Number.isFinite(number) ? number : null;
}

function normalizeTaxCode(value) {
        const number = toNumber(value);
        if (number !== null) {
                return String(Math.trunc(number));
        }
        return String(value || '').trim();
}

function propertyPins(property) {
        if (Array.isArray(property?.pinList)) {
                return property.pinList.filter(Boolean).map(String);
        }

        return String(property?.pin || '')
                .split(',')
                .map(pin => pin.trim())
                .filter(Boolean);
}

export function baseTaxContext(property, taxYear = CURRENT_TAX_YEAR) {
        const taxableValue = toNumber(property?.taxableValue);
        const equalizedAssessedValue = taxableValue === null
                ? null
                : Math.round(taxableValue * CURRENT_STATE_EQUALIZER);

        return {
                taxYear,
                stateEqualizer: CURRENT_STATE_EQUALIZER,
                equalizedAssessedValue,
                taxDistrictCode: property?.taxDistrictCode ?? null,
                localTaxRate: null,
                localTaxRatePercent: null,
                exemptions: [],
                totalExemptionEav: null,
                adjustedEav: equalizedAssessedValue,
                estimatedTaxBill: null
        };
}

export async function getPropertyTaxContext(db, property, taxYear = CURRENT_TAX_YEAR) {
        const context = baseTaxContext(property, taxYear);
        if (!db || !property) {
                return context;
        }

        const taxCode = normalizeTaxCode(property.taxDistrictCode);
        if (taxCode) {
                const rateRow = await db.prepare(
                        `SELECT composite_tax_rate
                         FROM property_tax_rates
                         WHERE tax_year = ? AND tax_district_code = ?
                         LIMIT 1`
                ).bind(taxYear, taxCode).first().catch(() => null);

                const rate = toNumber(rateRow?.composite_tax_rate);
                if (rate !== null) {
                        context.localTaxRate = rate;
                        context.localTaxRatePercent = rate;
                }
        }

        const pins = propertyPins(property);
        if (pins.length) {
                const placeholders = pins.map(() => '?').join(', ');
                const { results = [] } = await db.prepare(
                        `SELECT pin, exemption_type, exemption_amount_eav
                         FROM property_tax_exemptions
                         WHERE tax_year = ? AND pin IN (${placeholders})
                         ORDER BY pin, exemption_type`
                ).bind(taxYear, ...pins).all().catch(() => ({ results: [] }));

                context.exemptions = results.map(row => ({
                        pin: row.pin,
                        type: row.exemption_type,
                        amountEav: toNumber(row.exemption_amount_eav)
                }));

                const amounts = context.exemptions
                        .map(item => item.amountEav)
                        .filter(value => value !== null);
                context.totalExemptionEav = amounts.length
                        ? amounts.reduce((sum, value) => sum + value, 0)
                        : null;
        }

        if (context.equalizedAssessedValue !== null && context.totalExemptionEav !== null) {
                context.adjustedEav = Math.max(0, context.equalizedAssessedValue - context.totalExemptionEav);
        }

        if (context.adjustedEav !== null && context.localTaxRate !== null) {
                context.estimatedTaxBill = Math.round(context.adjustedEav * (context.localTaxRate / 100));
        }

        return context;
}

export async function attachPropertyTaxContext(db, property, taxYear = CURRENT_TAX_YEAR) {
        if (!property) {
                return property;
        }

        return {
                ...property,
                taxContext: await getPropertyTaxContext(db, property, taxYear)
        };
}
