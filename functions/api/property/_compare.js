import { getAddressSuggestions } from '../_property_addresses.js';

const EARTH_RADIUS_MILES = 3958.8;
const RESIDENTIAL_CLASS_CODES = new Set([
        '202', '203', '204', '205', '206', '207', '208', '209', '210',
        '211', '212', '218', '219', '234', '278', '295'
]);
const APPEAL_MODEL_APPLICABLE_CLASS_CODES = new Set([...RESIDENTIAL_CLASS_CODES, '299']);
const DEFAULT_VALUE_PER_SQFT_SIGNAL_PERCENT = 3;
const DEFAULT_TAXABLE_VALUE_SIGNAL_PERCENT = 5;

const PROPERTY_SELECT = `
        id,
        pin,
        address,
        normalized_address,
        city,
        zip_code,
        taxable_value,
        last_appeal_year,
        certified_land,
        certified_building,
        home_size,
        year_built,
        last_appeal_status,
        bedroom_count,
        bathroom_count,
        masonry_type,
        finished_basement,
        repair_condition,
        single_vs_multi_family,
        neighborhood_code,
        garage_size,
        property_class,
        pin_proration_rate,
        pin10,
        latitude,
        longitude,
        class_code,
        tax_district_code,
        municipality_number,
        municipality_name,
        tax_municipality_name,
        cmap_walkability_total_score,
        cmap_walkability_no_transit_score,
        flood_fs_factor,
        chicago_community_area,
        condo_unit_sqft,
        condo_building_sqft,
        condo_building_non_units,
        condo_building_pins,
        condo_building_mixed_use,
        condo_parking_space,
        condo_common_area
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
                normalizedAddress: row.normalized_address,
                city: row.city,
                zipCode: toInt(row.zip_code),
                taxableValue: toNumber(row.taxable_value),
                lastAppealYear: row.last_appeal_year,
                certifiedLand: toNumber(row.certified_land),
                certifiedBuilding: toNumber(row.certified_building),
                homeSize: toNumber(row.home_size),
                yearBuilt: toNumber(row.year_built),
                lastAppealStatus: row.last_appeal_status,
                bedroomCount: toNumber(row.bedroom_count),
                bathroomCount: toNumber(row.bathroom_count),
                masonryType: row.masonry_type,
                finishedBasement: row.finished_basement,
                repairCondition: row.repair_condition,
                singleVsMultiFamily: row.single_vs_multi_family,
                neighborhoodCode: row.neighborhood_code,
                garageSize: row.garage_size,
                propertyClass: row.property_class,
                pinProrationRate: toNumber(row.pin_proration_rate),
                pin10: row.pin10,
                latitude: toNumber(row.latitude),
                longitude: toNumber(row.longitude),
                classCode: normalizeClassCode(row.class_code),
                taxDistrictCode: toNumber(row.tax_district_code),
                municipalityNumber: toNumber(row.municipality_number),
                municipalityName: row.municipality_name,
                taxMunicipalityName: row.tax_municipality_name,
                cmapWalkabilityTotalScore: toNumber(row.cmap_walkability_total_score),
                cmapWalkabilityNoTransitScore: toNumber(row.cmap_walkability_no_transit_score),
                floodFsFactor: toNumber(row.flood_fs_factor),
                chicagoCommunityArea: row.chicago_community_area,
                condoUnitSqft: toNumber(row.condo_unit_sqft),
                condoBuildingSqft: toNumber(row.condo_building_sqft),
                condoBuildingNonUnits: toNumber(row.condo_building_non_units),
                condoBuildingPins: toNumber(row.condo_building_pins),
                condoBuildingMixedUse: row.condo_building_mixed_use,
                condoParkingSpace: row.condo_parking_space,
                condoCommonArea: row.condo_common_area
        };
}

function firstValid(values) {
        return values.find(value => value !== null && value !== undefined && String(value).trim() !== '');
}

function sumValues(values) {
        const numbers = values
                .map(toNumber)
                .filter(value => value !== null);
        return numbers.length ? numbers.reduce((sum, value) => sum + value, 0) : null;
}

function propertyGroupKey(property) {
        if (property.pinProrationRate !== null && property.pinProrationRate < 1) {
                return `${property.normalizedAddress || property.address}|fractional`;
        }
        return `${property.normalizedAddress || property.address}|pin:${property.pin || property.id}`;
}

function aggregatePropertiesByAddress(properties, preferredClassCode = null) {
        const groups = new Map();

        properties.forEach(property => {
                const key = propertyGroupKey(property);
                if (!key) return;
                if (!groups.has(key)) {
                        groups.set(key, []);
                }
                groups.get(key).push(property);
        });

        return Array.from(groups.values()).map(group => {
                const preferred = preferredClassCode
                        ? group.find(item => normalizeClassCode(item.classCode) === preferredClassCode)
                        : null;
                const orderedGroup = preferred ? [preferred, ...group.filter(item => item !== preferred)] : group;
                const base = orderedGroup[0];
                const pins = Array.from(new Set(group.map(item => item.pin).filter(Boolean)));
                return {
                        ...base,
                        pin: pins.join(', '),
                        pinList: pins,
                        pinCount: pins.length,
                        taxableValue: sumValues(group.map(item => item.taxableValue)),
                        certifiedLand: sumValues(group.map(item => item.certifiedLand)),
                        certifiedBuilding: sumValues(group.map(item => item.certifiedBuilding)),
                        pinProrationRate: toNumber(firstValid(orderedGroup.map(item => item.pinProrationRate))),
                        latitude: toNumber(firstValid(group.map(item => item.latitude))),
                        longitude: toNumber(firstValid(group.map(item => item.longitude))),
                        lastAppealYear: firstValid(orderedGroup.map(item => item.lastAppealYear)),
                        lastAppealStatus: firstValid(orderedGroup.map(item => item.lastAppealStatus)),
                        propertyClass: firstValid(orderedGroup.map(item => item.propertyClass)),
                        classCode: normalizeClassCode(firstValid(orderedGroup.map(item => item.classCode))),
                        neighborhoodCode: firstValid(orderedGroup.map(item => item.neighborhoodCode)),
                        masonryType: firstValid(orderedGroup.map(item => item.masonryType)),
                        finishedBasement: firstValid(orderedGroup.map(item => item.finishedBasement)),
                        repairCondition: firstValid(orderedGroup.map(item => item.repairCondition)),
                        singleVsMultiFamily: firstValid(orderedGroup.map(item => item.singleVsMultiFamily)),
                        garageSize: firstValid(orderedGroup.map(item => item.garageSize)),
                        pin10: firstValid(orderedGroup.map(item => item.pin10)),
                        taxDistrictCode: toNumber(firstValid(orderedGroup.map(item => item.taxDistrictCode))),
                        municipalityNumber: toNumber(firstValid(orderedGroup.map(item => item.municipalityNumber))),
                        municipalityName: firstValid(orderedGroup.map(item => item.municipalityName)),
                        taxMunicipalityName: firstValid(orderedGroup.map(item => item.taxMunicipalityName)),
                        cmapWalkabilityTotalScore: toNumber(firstValid(orderedGroup.map(item => item.cmapWalkabilityTotalScore))),
                        cmapWalkabilityNoTransitScore: toNumber(firstValid(orderedGroup.map(item => item.cmapWalkabilityNoTransitScore))),
                        floodFsFactor: toNumber(firstValid(orderedGroup.map(item => item.floodFsFactor))),
                        chicagoCommunityArea: firstValid(orderedGroup.map(item => item.chicagoCommunityArea)),
                        sourcePins: group
                };
        });
}

async function getAddressGroupByNormalizedAddress(db, normalizedAddress) {
        if (!normalizedAddress) return [];
        const { results } = await db.prepare(
                `SELECT ${PROPERTY_SELECT}
                 FROM property_addresses
                 WHERE normalized_address = ?`
        ).bind(normalizedAddress).all();
        return aggregatePropertiesByAddress((results || []).map(rowToProperty));
}

async function getPropertyGroup(db, row) {
        if (!row) return [];
        const property = rowToProperty(row);
        if (property.pinProrationRate !== null && property.pinProrationRate < 1) {
                const { results } = await db.prepare(
                        `SELECT ${PROPERTY_SELECT}
                         FROM property_addresses
                         WHERE normalized_address = ?
                           AND pin_proration_rate IS NOT NULL
                           AND pin_proration_rate < 1`
                ).bind(row.normalized_address).all();
                return aggregatePropertiesByAddress((results || []).map(rowToProperty));
        }
        return [property];
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

function validText(value) {
        return value !== null &&
                value !== undefined &&
                String(value).trim() !== '' &&
                !['none', 'nan', '0'].includes(String(value).trim().toLowerCase());
}

function optionalSameValue(candidateValue, targetValue) {
        return !validText(targetValue) || sameValue(candidateValue, targetValue);
}

function optionalNumericRange(value, center, lowerMult, upperMult, absoluteDelta = null) {
        if (center === null || center === undefined || center <= 0) {
                return true;
        }

        if (value === null || value === undefined) {
                return false;
        }

        if (absoluteDelta !== null) {
                return within(value, center - absoluteDelta, center + absoluteDelta);
        }

        return within(value, center * lowerMult, center * upperMult);
}

function valuePerSqft(value, sqft) {
        if (value === null || value === undefined || sqft === null || sqft === undefined || sqft <= 0) {
                return null;
        }

        return value / sqft;
}

function percentageThreshold(env, name, fallbackPercent) {
        const rawValue = env?.[name];
        const parsedValue = rawValue === undefined || rawValue === null || rawValue === ''
                ? null
                : Number(rawValue);

        if (!Number.isFinite(parsedValue) || parsedValue < 0) {
                return fallbackPercent / 100;
        }

        return parsedValue > 1 ? parsedValue / 100 : parsedValue;
}

function uniformityThresholds(env) {
        return {
                valuePerSqft: percentageThreshold(
                        env,
                        'UNIFORMITY_VALUE_PER_SQFT_SIGNAL_PERCENT',
                        DEFAULT_VALUE_PER_SQFT_SIGNAL_PERCENT
                ),
                taxableValue: percentageThreshold(
                        env,
                        'UNIFORMITY_TAXABLE_VALUE_SIGNAL_PERCENT',
                        DEFAULT_TAXABLE_VALUE_SIGNAL_PERCENT
                )
        };
}

function compUniformityStats(target, comparables) {
        const value = target?.taxableValue ?? null;
        const subjectValuePerSqft = valuePerSqft(value, target?.homeSize);
        const taxableValues = comparables
                .map(item => item.taxableValue)
                .filter(value => value !== null && value !== undefined);
        const compValuePerSqft = comparables
                .map(item => valuePerSqft(item.taxableValue, item.homeSize))
                .filter(value => value !== null && Number.isFinite(value))
                .sort((a, b) => a - b);
        const averageValue = taxableValues.length
                ? taxableValues.reduce((sum, item) => sum + item, 0) / taxableValues.length
                : null;
        const medianValuePerSqft = compValuePerSqft.length
                ? (
                        compValuePerSqft.length % 2
                                ? compValuePerSqft[Math.floor(compValuePerSqft.length / 2)]
                                : (compValuePerSqft[compValuePerSqft.length / 2 - 1] + compValuePerSqft[compValuePerSqft.length / 2]) / 2
                )
                : null;

        return {
                value,
                averageValue,
                lowerValueCount: value === null ? 0 : taxableValues.filter(item => item < value).length,
                subjectValuePerSqft,
                medianValuePerSqft,
                lowerValuePerSqftCount: subjectValuePerSqft === null
                        ? 0
                        : compValuePerSqft.filter(item => item < subjectValuePerSqft).length,
                validValuePerSqftComparables: compValuePerSqft.length
        };
}

function hasUniformityAppealSignal(stats, thresholds = uniformityThresholds()) {
        if (
                stats.validValuePerSqftComparables >= 5 &&
                stats.subjectValuePerSqft !== null &&
                stats.medianValuePerSqft !== null
        ) {
                return stats.subjectValuePerSqft > stats.medianValuePerSqft * (1 + thresholds.valuePerSqft) &&
                        stats.lowerValuePerSqftCount >= 3;
        }

        if (stats.averageValue !== null && stats.averageValue > 0 && stats.value !== null) {
                return stats.value > stats.averageValue * (1 + thresholds.taxableValue) &&
                        stats.lowerValueCount >= 3;
        }

        return false;
}

function compContext(target) {
        return target?.classCode === '299'
                ? 'same condo building or closely similar condo units'
                : 'similar nearby properties matched on class, neighborhood, size, bedrooms, baths, construction, proration, and available age/condition fields';
}

function matchesComparableRules(candidate, target) {
        const classCode = target.classCode;

        if (classCode === 'EX') {
                return false;
        }

        if (!APPEAL_MODEL_APPLICABLE_CLASS_CODES.has(classCode)) {
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
                        candidate.homeSize <= target.homeSize * 1.15 &&
                        within(candidate.certifiedLand, target.certifiedLand * 0.8, target.certifiedLand * 1.2) &&
                        within(candidate.bedroomCount, target.bedroomCount, target.bedroomCount + 1) &&
                        within(candidate.bathroomCount, target.bathroomCount, target.bathroomCount + 1) &&
                        sameValue(candidate.masonryType, target.masonryType) &&
                        sameValue(candidate.singleVsMultiFamily, target.singleVsMultiFamily) &&
                        optionalNumericRange(candidate.yearBuilt, target.yearBuilt, null, null, 15) &&
                        optionalSameValue(candidate.repairCondition, target.repairCondition)
                );
        }

        if (classCode === '299') {
                return optionalSameValue(candidate.pin10, target.pin10) &&
                        optionalNumericRange(candidate.homeSize, target.homeSize, 0.85, 1.15) &&
                        optionalNumericRange(candidate.bedroomCount, target.bedroomCount, null, null, 0) &&
                        optionalNumericRange(candidate.bathroomCount, target.bathroomCount, null, null, 1) &&
                        optionalSameValue(candidate.condoParkingSpace, target.condoParkingSpace) &&
                        optionalSameValue(candidate.condoCommonArea, target.condoCommonArea);
        }

        return false;
}

function decisionFor(target, comparables, radius, env, now = new Date()) {
        if (!target) {
                return {
                        decision: 'Please Enter Valid Cook County Address',
                        label: 'Please enter a valid Cook County address',
                        reason: ''
                };
        }

        if (!APPEAL_MODEL_APPLICABLE_CLASS_CODES.has(target.classCode)) {
                return {
                        decision: 'Not Applicable',
                        label: 'Not applicable',
                        reason: `Property Class Type is ${target.propertyClass || target.classCode || 'Unknown'}`
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

        const lastAppealYear = toInt(target.lastAppealYear);
        const currentYear = now.getFullYear();

        if (lastAppealYear === currentYear) {
                return {
                        decision: 'No Appeal',
                        label: 'Appeal likely not needed',
                        reason: 'You just appealed recently.'
                };
        }

        const stats = compUniformityStats(target, comparables);
        const context = compContext(target);

        if (hasUniformityAppealSignal(stats, uniformityThresholds(env))) {
                if (
                        stats.validValuePerSqftComparables >= 5 &&
                        stats.subjectValuePerSqft !== null &&
                        stats.medianValuePerSqft !== null
                ) {
                        const pctHigher = (stats.subjectValuePerSqft - stats.medianValuePerSqft) / stats.medianValuePerSqft;
                        return {
                                decision: 'Yes, Appeal',
                                label: 'Appeal recommended',
                                reason: `Uniformity signal: your assessed value per sqft is ${(pctHigher * 100).toFixed(1)}% above the median of ${comparables.length} ${context}; ${stats.lowerValuePerSqftCount} comps have lower assessed value per sqft.`
                        };
                }

                const pctHigher = (stats.value - stats.averageValue) / stats.averageValue;
                return {
                        decision: 'Yes, Appeal',
                        label: 'Appeal recommended',
                        reason: `Uniformity signal: your taxable value is ${(pctHigher * 100).toFixed(1)}% above the average of ${comparables.length} ${context}; ${stats.lowerValueCount} comps have lower taxable value.`
                };
        }

        if (
                stats.validValuePerSqftComparables >= 5 &&
                stats.subjectValuePerSqft !== null &&
                stats.medianValuePerSqft !== null
        ) {
                const pctDiff = (stats.subjectValuePerSqft - stats.medianValuePerSqft) / stats.medianValuePerSqft;
                return {
                        decision: 'No Need to Appeal',
                        label: 'Appeal likely not needed',
                        reason: `Your assessed value per sqft is ${(pctDiff * 100).toFixed(1)}% versus the median of ${comparables.length} ${context}; this does not show a strong uniformity appeal signal.`
                };
        }

        return {
                decision: 'No Need to Appeal',
                label: 'Appeal likely not needed',
                reason: `Your taxable value is in line with ${comparables.length} ${context}; this does not show a strong uniformity appeal signal.`
        };
}

export async function findTargetProperty(db, { id, pin, address }) {
        if (id) {
                const row = await db.prepare(
                        `SELECT ${PROPERTY_SELECT} FROM property_addresses WHERE id = ? LIMIT 1`
                ).bind(id).first();
                if (row) {
                        return (await getPropertyGroup(db, row))[0] || rowToProperty(row);
                }
        }

        if (pin) {
                const row = await db.prepare(
                        `SELECT ${PROPERTY_SELECT} FROM property_addresses WHERE pin = ? LIMIT 1`
                ).bind(pin).first();
                if (row) {
                        return (await getPropertyGroup(db, row))[0] || rowToProperty(row);
                }
        }

        const suggestions = await getAddressSuggestions(db, address || '', 1);
        const best = suggestions[0];
        if (!best || best.score < 160) {
                return null;
        }

        const row = await db.prepare(
                `SELECT ${PROPERTY_SELECT} FROM property_addresses WHERE id = ? LIMIT 1`
        ).bind(best.id).first();
        return row ? ((await getPropertyGroup(db, row))[0] || rowToProperty(row)) : null;
}

export async function findComparableProperties(db, target, radius) {
        if (!target?.latitude || !target?.longitude || !target.classCode) {
                return [];
        }

        if (!APPEAL_MODEL_APPLICABLE_CLASS_CODES.has(target.classCode)) {
                return [];
        }

        const latDelta = radius / 69;
        const lonDelta = radius / Math.max(1, Math.cos(target.latitude * Math.PI / 180) * 69);
        const clauses = [
                'class_code = ?',
                'latitude BETWEEN ? AND ?',
                'longitude BETWEEN ? AND ?',
                'latitude IS NOT NULL',
                'longitude IS NOT NULL'
        ];
        const params = [
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
                if (!target.neighborhoodCode) {
                        return [];
                }

                if (
                        target.homeSize === null ||
                        target.certifiedLand === null ||
                        target.bedroomCount === null ||
                        target.bathroomCount === null
                ) {
                        return [];
                }

                clauses.push(
                        'neighborhood_code = ?',
                        'home_size >= ?',
                        'home_size <= ?',
                        'bedroom_count BETWEEN ? AND ?',
                        'bathroom_count BETWEEN ? AND ?',
                        'masonry_type = ?',
                        'single_vs_multi_family = ?'
                );
                params.push(
                        target.neighborhoodCode,
                        target.homeSize * 0.9,
                        target.homeSize * 1.15,
                        target.bedroomCount,
                        target.bedroomCount + 1,
                        target.bathroomCount,
                        target.bathroomCount + 1,
                        target.masonryType,
                        target.singleVsMultiFamily
                );
                if (target.yearBuilt !== null && target.yearBuilt > 0) {
                        clauses.push('year_built BETWEEN ? AND ?');
                        params.push(target.yearBuilt - 15, target.yearBuilt + 15);
                }
                if (validText(target.repairCondition)) {
                        clauses.push('repair_condition = ?');
                        params.push(target.repairCondition);
                }
        } else if (target.classCode === '299') {
                if (validText(target.pin10)) {
                        clauses.push('pin10 = ?');
                        params.push(target.pin10);
                }
                if (target.homeSize !== null && target.homeSize > 0) {
                        clauses.push('home_size BETWEEN ? AND ?');
                        params.push(target.homeSize * 0.85, target.homeSize * 1.15);
                }
                if (target.bedroomCount !== null && target.bedroomCount > 0) {
                        clauses.push('bedroom_count BETWEEN ? AND ?');
                        params.push(target.bedroomCount, target.bedroomCount);
                }
                if (target.bathroomCount !== null && target.bathroomCount > 0) {
                        clauses.push('bathroom_count BETWEEN ? AND ?');
                        params.push(target.bathroomCount - 1, target.bathroomCount + 1);
                }
                if (validText(target.condoParkingSpace)) {
                        clauses.push('condo_parking_space = ?');
                        params.push(target.condoParkingSpace);
                }
                if (validText(target.condoCommonArea)) {
                        clauses.push('condo_common_area = ?');
                        params.push(target.condoCommonArea);
                }
        }

        const { results } = await db.prepare(
                `SELECT ${PROPERTY_SELECT}
                 FROM property_addresses
                 WHERE normalized_address IN (
                         SELECT DISTINCT normalized_address
                         FROM property_addresses
                         WHERE ${clauses.join(' AND ')}
                         LIMIT 10000
                 )`
        ).bind(...params).all();

        return aggregatePropertiesByAddress((results || []).map(rowToProperty), target.classCode)
                .map(property => ({
                        ...property,
                        distanceMiles: milesBetween(target, property)
                }))
                .filter(property => property.distanceMiles <= radius)
                .filter(property => propertyGroupKey(property) !== propertyGroupKey(target))
                .filter(property => matchesComparableRules(property, target))
                .sort((a, b) => a.distanceMiles - b.distanceMiles || (a.taxableValue || 0) - (b.taxableValue || 0));
}

export function buildAnalysis(target, comparables, radius, env) {
        const averageComparableValue = comparables.length
                ? comparables.reduce((sum, item) => sum + (item.taxableValue || 0), 0) / comparables.length
                : null;
        const lowerValueCount = target
                ? comparables.filter(item => item.taxableValue !== null && item.taxableValue < target.taxableValue).length
                : 0;
        const stats = target ? compUniformityStats(target, comparables) : null;

        return {
                target,
                comparables,
                radius,
                summary: {
                        comparableCount: comparables.length,
                        averageComparableValue,
                        lowerValueCount,
                        subjectValuePerSqft: stats?.subjectValuePerSqft ?? null,
                        medianComparableValuePerSqft: stats?.medianValuePerSqft ?? null,
                        lowerValuePerSqftCount: stats?.lowerValuePerSqftCount ?? 0,
                        validValuePerSqftComparables: stats?.validValuePerSqftComparables ?? 0,
                        differenceFromAverage: averageComparableValue === null || !target
                                ? null
                                : target.taxableValue - averageComparableValue
                },
                appeal: decisionFor(target, comparables, radius, env)
        };
}
