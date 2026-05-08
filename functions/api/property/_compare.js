import { getAddressSuggestions } from '../_property_addresses.js';

const EARTH_RADIUS_MILES = 3958.8;
const RESIDENTIAL_CLASS_CODES = new Set([
        '202', '203', '204', '205', '206', '207', '208', '209', '210',
        '211', '212', '218', '219', '234', '278', '295'
]);

const PROPERTY_SELECT = `
        id,
        pin,
        address,
        normalized_address,
        taxable_value,
        last_appeal_year,
        certified_land,
        certified_building,
        home_size,
        last_appeal_status,
        bedroom_count,
        bathroom_count,
        masonry_type,
        finished_basement,
        single_vs_multi_family,
        neighborhood_code,
        garage_size,
        property_class,
        pin_proration_rate,
        latitude,
        longitude,
        latitude_raw,
        longitude_raw,
        class_code
`;

function toNumber(value) {
        if (value === null || value === undefined || value === '') {
                return null;
        }

        const number = Number(value);
        return Number.isFinite(number) ? number : null;
}

function toInt(value) {
        const number = toNumber(value);
        return number === null ? null : Math.trunc(number);
}

function normalizeClassCode(value) {
        return String(value || '').trim();
}

function rowToProperty(row) {
        return {
                id: row.id,
                pin: row.pin,
                address: row.address,
                taxableValue: toNumber(row.taxable_value),
                lastAppealYear: row.last_appeal_year,
                certifiedLand: toNumber(row.certified_land),
                certifiedBuilding: toNumber(row.certified_building),
                homeSize: toNumber(row.home_size),
                lastAppealStatus: row.last_appeal_status,
                bedroomCount: toNumber(row.bedroom_count),
                bathroomCount: toNumber(row.bathroom_count),
                masonryType: row.masonry_type,
                finishedBasement: row.finished_basement,
                singleVsMultiFamily: row.single_vs_multi_family,
                neighborhoodCode: row.neighborhood_code,
                garageSize: row.garage_size,
                propertyClass: row.property_class,
                pinProrationRate: toNumber(row.pin_proration_rate),
                latitude: toNumber(row.latitude),
                longitude: toNumber(row.longitude),
                classCode: normalizeClassCode(row.class_code)
        };
}

function milesBetween(a, b) {
        const lat1 = a.latitude * Math.PI / 180;
        const lat2 = b.latitude * Math.PI / 180;
        const dLat = (b.latitude - a.latitude) * Math.PI / 180;
        const dLon = (b.longitude - a.longitude) * Math.PI / 180;
        const sinLat = Math.sin(dLat / 2);
        const sinLon = Math.sin(dLon / 2);
        const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLon * sinLon;
        return EARTH_RADIUS_MILES * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function within(value, min, max) {
        return value !== null && value >= min && value <= max;
}

function sameValue(left, right) {
        if (left === null || left === undefined || right === null || right === undefined) {
                return left === right;
        }

        return String(left) === String(right);
}

function matchesComparableRules(candidate, target) {
        const classCode = target.classCode;

        if (classCode === 'EX') {
                return false;
        }

        if (RESIDENTIAL_CLASS_CODES.has(classCode)) {
                if (
                        target.homeSize === null ||
                        target.certifiedLand === null ||
                        target.bedroomCount === null ||
                        target.bathroomCount === null
                ) {
                        return false;
                }

                return (
                        candidate.homeSize !== null &&
                        candidate.homeSize >= target.homeSize * 0.9 &&
                        within(candidate.certifiedLand, target.certifiedLand * 0.8, target.certifiedLand * 1.2) &&
                        within(candidate.bedroomCount, target.bedroomCount, target.bedroomCount + 1) &&
                        within(candidate.bathroomCount, target.bathroomCount, target.bathroomCount + 1) &&
                        sameValue(candidate.masonryType, target.masonryType) &&
                        sameValue(candidate.pinProrationRate, target.pinProrationRate) &&
                        sameValue(candidate.singleVsMultiFamily, target.singleVsMultiFamily)
                );
        }

        if ((classCode === '100' || classCode === '241') && target.homeSize !== null) {
                return true;
        }

        if (target.taxableValue === null || target.certifiedLand === null) {
                return false;
        }

        return (
                within(candidate.taxableValue, target.taxableValue * 0.9, target.taxableValue * 1.15) &&
                within(candidate.certifiedLand, target.certifiedLand * 0.8, target.certifiedLand * 1.2)
        );
}

function decisionFor(target, comparables, radius, now = new Date()) {
        if (!target) {
                return {
                        decision: 'Please Enter Valid Cook County Address',
                        label: 'Please enter a valid Cook County address',
                        reason: ''
                };
        }

        if (comparables.length < 5) {
                if (radius >= 5) {
                        return {
                                decision: 'Not enough comps',
                                label: 'Not enough comparable properties',
                                reason: `Only ${comparables.length} comparable properties were found within the maximum 5.0 mile radius.`
                        };
                }

                return {
                        decision: 'Not enough comps, please increase radius length',
                        label: 'Not enough comparable properties',
                        reason: `Only ${comparables.length} comparable properties were found within ${radius.toFixed(1)} miles. Increase the radius and run the analysis again.`
                };
        }

        const average = comparables.reduce((sum, item) => sum + (item.taxableValue || 0), 0) / comparables.length;
        const lowerValueCount = comparables.filter(item => item.taxableValue !== null && item.taxableValue < target.taxableValue).length;
        const lastAppealYear = toInt(target.lastAppealYear);
        const currentYear = now.getFullYear();

        if (average && (target.taxableValue - average) / average > 0.02) {
                return {
                        decision: 'Yes, Appeal',
                        label: 'Appeal recommended',
                        reason: `Your taxable value is ${((target.taxableValue - average) / average * 100).toFixed(2)}% higher than average comps and ${lowerValueCount} comps have lower taxable value.`
                };
        }

        if (lastAppealYear === currentYear) {
                return {
                        decision: 'No Appeal',
                        label: 'Appeal likely not needed',
                        reason: 'You just appealed recently.'
                };
        }

        if (lowerValueCount > 4) {
                return {
                        decision: 'Yes, Appeal',
                        label: 'Appeal recommended',
                        reason: `Your taxable value is higher than ${lowerValueCount} comps. There are ${comparables.length} comps in radius.`
                };
        }

        if (lastAppealYear !== null && lastAppealYear < currentYear - 3) {
                return {
                        decision: 'Yes, Appeal',
                        label: 'Appeal recommended',
                        reason: "It's been more than 3 years since last appeal."
                };
        }

        return {
                decision: 'No Need to Appeal',
                label: 'Appeal likely not needed',
                reason: 'Your taxable value is in line with comps.'
        };
}

export async function findTargetProperty(db, { id, pin, address }) {
        if (id) {
                const row = await db.prepare(
                        `SELECT ${PROPERTY_SELECT} FROM property_addresses WHERE id = ? LIMIT 1`
                ).bind(id).first();
                if (row) return rowToProperty(row);
        }

        if (pin) {
                const row = await db.prepare(
                        `SELECT ${PROPERTY_SELECT} FROM property_addresses WHERE pin = ? LIMIT 1`
                ).bind(pin).first();
                if (row) return rowToProperty(row);
        }

        const suggestions = await getAddressSuggestions(db, address || '', 1);
        const best = suggestions[0];
        if (!best || best.score < 160) {
                return null;
        }

        const row = await db.prepare(
                `SELECT ${PROPERTY_SELECT} FROM property_addresses WHERE id = ? LIMIT 1`
        ).bind(best.id).first();
        return row ? rowToProperty(row) : null;
}

export async function findComparableProperties(db, target, radius) {
        if (!target?.latitude || !target?.longitude || !target.neighborhoodCode || !target.classCode) {
                return [];
        }

        const latDelta = radius / 69;
        const lonDelta = radius / Math.max(1, Math.cos(target.latitude * Math.PI / 180) * 69);
        const clauses = [
                'neighborhood_code = ?',
                'class_code = ?',
                'latitude BETWEEN ? AND ?',
                'longitude BETWEEN ? AND ?',
                'latitude IS NOT NULL',
                'longitude IS NOT NULL'
        ];
        const params = [
                target.neighborhoodCode,
                target.classCode,
                target.latitude - latDelta,
                target.latitude + latDelta,
                target.longitude - lonDelta,
                target.longitude + lonDelta
        ];

        if (target.classCode === 'EX') {
                return [];
        }

        if (RESIDENTIAL_CLASS_CODES.has(target.classCode)) {
                if (
                        target.homeSize === null ||
                        target.certifiedLand === null ||
                        target.bedroomCount === null ||
                        target.bathroomCount === null
                ) {
                        return [];
                }

                clauses.push(
                        'home_size >= ?',
                        'certified_land BETWEEN ? AND ?',
                        'bedroom_count BETWEEN ? AND ?',
                        'bathroom_count BETWEEN ? AND ?',
                        'masonry_type = ?',
                        'pin_proration_rate = ?',
                        'single_vs_multi_family = ?'
                );
                params.push(
                        target.homeSize * 0.9,
                        target.certifiedLand * 0.8,
                        target.certifiedLand * 1.2,
                        target.bedroomCount,
                        target.bedroomCount + 1,
                        target.bathroomCount,
                        target.bathroomCount + 1,
                        target.masonryType,
                        target.pinProrationRate,
                        target.singleVsMultiFamily
                );
        } else if (!((target.classCode === '100' || target.classCode === '241') && target.homeSize !== null)) {
                if (target.taxableValue === null || target.certifiedLand === null) {
                        return [];
                }

                clauses.push(
                        'taxable_value BETWEEN ? AND ?',
                        'certified_land BETWEEN ? AND ?'
                );
                params.push(
                        target.taxableValue * 0.9,
                        target.taxableValue * 1.15,
                        target.certifiedLand * 0.8,
                        target.certifiedLand * 1.2
                );
        }

        const { results } = await db.prepare(
                `SELECT ${PROPERTY_SELECT}
                 FROM property_addresses
                 WHERE ${clauses.join(' AND ')}
                 LIMIT 10000`
        ).bind(...params).all();

        return (results || [])
                .map(rowToProperty)
                .map(property => ({
                        ...property,
                        distanceMiles: milesBetween(target, property)
                }))
                .filter(property => property.distanceMiles <= radius)
                .filter(property => matchesComparableRules(property, target))
                .sort((a, b) => a.distanceMiles - b.distanceMiles || (a.taxableValue || 0) - (b.taxableValue || 0));
}

export function buildAnalysis(target, comparables, radius) {
        const averageComparableValue = comparables.length
                ? comparables.reduce((sum, item) => sum + (item.taxableValue || 0), 0) / comparables.length
                : null;
        const lowerValueCount = target
                ? comparables.filter(item => item.taxableValue !== null && item.taxableValue < target.taxableValue).length
                : 0;

        return {
                target,
                comparables,
                radius,
                summary: {
                        comparableCount: comparables.length,
                        averageComparableValue,
                        lowerValueCount,
                        differenceFromAverage: averageComparableValue === null || !target
                                ? null
                                : target.taxableValue - averageComparableValue
                },
                appeal: decisionFor(target, comparables, radius)
        };
}
