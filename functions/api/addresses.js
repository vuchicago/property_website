import { requireFirebaseUser, jsonResponse } from './_auth.js';
import { getAppealCalendarForProperty } from './_appeal_calendar.js';
import { findBestPropertyAddress, getPropertyAddressCount } from './_property_addresses.js';
import { attachPropertyTaxContext } from './_tax_context.js';

const PROPERTY_GROUP_KEY = `CASE
        WHEN pin_proration_rate IS NOT NULL AND pin_proration_rate < 1
        THEN normalized_address || '|fractional'
        ELSE normalized_address || '|pin:' || COALESCE(pin, id)
END`;

// The normalized-address predicate lets SQLite use the existing address index.
// Matching only the computed group key scans the entire county table per property.
export async function getSavedProperties(db, userId, { summary = false, propertyId = null } = {}) {
        const filter = 'user_addresses.customer_id = ?' + (propertyId === null ? '' : ' AND user_addresses.id = ?');
        const params = propertyId === null ? [userId] : [userId, propertyId];
        if (summary) {
                const { results = [] } = await db.prepare(
                        `SELECT id, address, property_key, created_at FROM user_addresses WHERE ${filter} ORDER BY created_at DESC`
                ).bind(...params).all();
                return results;
        }
        const { results = [] } = await db.prepare(
                `SELECT user_addresses.*,
                                (
                                  SELECT group_concat(pin, ', ')
                                  FROM property_addresses
                                  WHERE normalized_address = substr(user_addresses.property_key, 1, instr(user_addresses.property_key, '|') - 1)
                                    AND ${PROPERTY_GROUP_KEY} = user_addresses.property_key
                                ) AS pin,
                                (
                                  SELECT json_object(
                                    'recordId', MIN(id),
                                    'pin', group_concat(pin, ', '),
                                    'pinCount', COUNT(pin),
                                    'city', MAX(city),
                                    'zipCode', MAX(zip_code),
                                    'taxableValue', SUM(taxable_value),
                                    'homeSize', home_size,
                                    'yearBuilt', year_built,
                                    'lastAppealYear', last_appeal_year,
                                    'lastAppealStatus', last_appeal_status,
                                    'certifiedLand', SUM(certified_land),
                                    'certifiedBuilding', SUM(certified_building),
                                    'masonryType', masonry_type,
                                    'repairCondition', repair_condition,
                                    'classCode', class_code,
                                    'neighborhoodCode', neighborhood_code,
                                    'bedroomCount', bedroom_count,
                                    'bathroomCount', bathroom_count,
                                    'singleVsMultiFamily', single_vs_multi_family,
                                    'pinProrationRate', MAX(pin_proration_rate),
                                    'mailingName', mailing_name,
                                    'mailingAddress', mailing_address,
                                    'propertyClass', property_class,
                                    'pin10', pin10,
                                    'taxDistrictCode', tax_district_code,
                                    'municipalityNumber', municipality_number,
                                    'municipalityName', municipality_name,
                                    'taxMunicipalityName', tax_municipality_name,
                                    'townshipName', township_name,
                                    'townshipCode', township_code,
                                    'cmapWalkabilityTotalScore', cmap_walkability_total_score,
                                    'cmapWalkabilityNoTransitScore', cmap_walkability_no_transit_score,
                                    'floodFsFactor', flood_fs_factor,
                                    'chicagoCommunityArea', chicago_community_area,
                                    'condoUnitSqft', condo_unit_sqft,
                                    'condoParkingSpace', condo_parking_space,
                                    'condoCommonArea', condo_common_area
                                  )
                                  FROM property_addresses
                                  WHERE normalized_address = substr(user_addresses.property_key, 1, instr(user_addresses.property_key, '|') - 1)
                                    AND ${PROPERTY_GROUP_KEY} = user_addresses.property_key
                                ) AS property_details
                         FROM user_addresses
                         WHERE ${filter}
                         ORDER BY user_addresses.created_at DESC`
        ).bind(...params).all();
        return Promise.all(results.map(async row => {
                const propertyDetails = row.property_details ? JSON.parse(row.property_details) : null;
                if (propertyDetails?.recordId != null) {
                        propertyDetails.appealCalendar = getAppealCalendarForProperty(propertyDetails);
                        Object.assign(propertyDetails, await attachPropertyTaxContext(db, propertyDetails));
                }
                return { ...row, propertyDetails: propertyDetails?.recordId != null ? propertyDetails : null, property_details: undefined };
        }));
}

export const onRequestGet = async (context) => {
        const { user, response } = await requireFirebaseUser(context.request);
        if (response) return response;
        if (!context.env.DB) return jsonResponse({ error: 'Database not configured' }, 500);
        try {
                const summary = new URL(context.request.url).searchParams.get('summary') === '1';
                const rawPropertyId = new URL(context.request.url).searchParams.get('propertyId');
                const propertyId = rawPropertyId === null ? null : Number(rawPropertyId);
                if (propertyId !== null && (!Number.isInteger(propertyId) || propertyId < 1)) return jsonResponse({error:'Choose a valid saved property.'},400);
                const result = jsonResponse(await getSavedProperties(context.env.DB, user.uid, { summary, propertyId }));
                result.headers.set('Cache-Control', 'private, no-store');
                return result;
        } catch (error) {
                console.error('Saved property query failed:', error.message);
                return jsonResponse({ error: 'Could not load saved properties. Please try again.' }, 503);
        }
};

export const onRequestPost = async (context) => {
        const { user, response } = await requireFirebaseUser(context.request);

        if (response) {
                return response;
        }

        if (!context.env.DB) {
                return jsonResponse({ error: 'Database not configured' }, 500);
        }

        try {
                const { address, propertyKey } = await context.request.json();

                if (!address) {
                        return jsonResponse({ error: 'Missing address' }, 400);
                }

                const propertyAddress = propertyKey
                        ? await context.env.DB.prepare(
                                `SELECT MIN(id) AS id,
                                        group_concat(pin, ', ') AS pin,
                                        address,
                                        normalized_address,
                                        ${PROPERTY_GROUP_KEY} AS property_key,
                                        MAX(mailing_name) AS mailing_name,
                                        SUM(pin_proration_rate) AS pin_proration_rate
                                 FROM property_addresses
                                 WHERE normalized_address = ? AND ${PROPERTY_GROUP_KEY} = ?
                                 GROUP BY property_key
                                 LIMIT 1`
                        ).bind(String(propertyKey).split('|')[0],propertyKey).first()
                        : await findBestPropertyAddress(context.env.DB, address);

                if (!propertyAddress) {
                        const propertyAddressCount = await getPropertyAddressCount(context.env.DB);
                        if (propertyAddressCount === 0) {
                                return jsonResponse({
                                        error: 'The Cook County property address database has not been imported yet. Please import property_addresses before adding properties.'
                                }, 400);
                        }

                        return jsonResponse({
                                error: 'Please enter a valid Cook County property address from our database.'
                        }, 400);
                }

                const result = await context.env.DB.prepare(
                        "INSERT OR IGNORE INTO user_addresses (customer_id, address, property_key, email) VALUES (?, ?, ?, ?)"
                ).bind(user.uid, propertyAddress.address, propertyAddress.property_key, user.email || '').run();
                const savedProperty = await context.env.DB.prepare(
                        'SELECT id, address, property_key, created_at FROM user_addresses WHERE customer_id = ? AND property_key = ?'
                ).bind(user.uid,propertyAddress.property_key).first();

                // If changes === 0, it means it was a duplicate (ignored due to UNIQUE constraint)
                if (result.meta && result.meta.changes === 0) {
                        return jsonResponse({
                                success: true,
                                message: 'Address already exists',
                                address: propertyAddress.address,
                                propertyKey: propertyAddress.property_key,
                                property: propertyAddress,
                                savedProperty
                        });
                }

                return jsonResponse({
                        success: true,
                        address: propertyAddress.address,
                        propertyKey: propertyAddress.property_key,
                        property: propertyAddress,
                        savedProperty
                });
        } catch (err) {
                return jsonResponse({ error: err.message }, 500);
        }
}

export const onRequestDelete = async (context) => {
        const { user, response } = await requireFirebaseUser(context.request);

        if (response) {
                return response;
        }

        if (!context.env.DB) {
                return jsonResponse({ error: 'Database not configured' }, 500);
        }

        try {
                const { address, propertyKey } = await context.request.json();

                if (!address && !propertyKey) {
                        return jsonResponse({ error: 'Missing address or property key' }, 400);
                }

                const appeal = await context.env.DB.prepare(
                        `SELECT id
                         FROM appeals
                         WHERE customer_id = ? AND property_address = ?
                         LIMIT 1`
                ).bind(user.uid, address).first();

                if (appeal) {
                        return jsonResponse({
                                error: 'This property already has an appeal record and cannot be deleted.'
                        }, 400);
                }

                const selfAppealTable = await context.env.DB.prepare(
                        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'self_appeal_cases'"
                ).first();
                const selfAppealGuard = selfAppealTable
                        ? ' AND NOT EXISTS (SELECT 1 FROM self_appeal_cases WHERE self_appeal_cases.customer_id = user_addresses.customer_id AND self_appeal_cases.address_id = user_addresses.id)'
                        : '';
                const result = await context.env.DB.prepare(
                        (propertyKey
                                ? "DELETE FROM user_addresses WHERE customer_id = ? AND property_key = ?"
                                : "DELETE FROM user_addresses WHERE customer_id = ? AND address = ?") + selfAppealGuard
                ).bind(user.uid, propertyKey || address).run();
                if (!result.meta?.changes && selfAppealTable) {
                        return jsonResponse({ error: 'Property was not deleted. Properties with saved self-appeal work must be retained.' }, 409);
                }

                return jsonResponse({
                        success: true,
                        deleted: result.meta?.changes || 0
                });
        } catch (err) {
                return jsonResponse({ error: err.message }, 500);
        }
}
