import { requireFirebaseUser, jsonResponse } from './_auth.js';
import { findBestPropertyAddress, getPropertyAddressCount } from './_property_addresses.js';

export const onRequestGet = async (context) => {
        const { user, response } = await requireFirebaseUser(context.request);

        if (response) {
                return response;
        }

        if (!context.env.DB) {
                return jsonResponse({ error: 'Database not configured' }, 500);
        }

        try {
                const { results } = await context.env.DB.prepare(
                        `SELECT user_addresses.*,
                                (
                                  SELECT pin
                                  FROM property_addresses
                                  WHERE property_addresses.address = user_addresses.address
                                  LIMIT 1
                                ) AS pin,
                                (
                                  SELECT json_object(
                                    'pin', pin,
                                    'city', city,
                                    'zipCode', zip_code,
                                    'taxableValue', taxable_value,
                                    'homeSize', home_size,
                                    'yearBuilt', year_built,
                                    'lastAppealYear', last_appeal_year,
                                    'lastAppealStatus', last_appeal_status,
                                    'certifiedLand', certified_land,
                                    'certifiedBuilding', certified_building,
                                    'masonryType', masonry_type,
                                    'repairCondition', repair_condition,
                                    'classCode', class_code,
                                    'neighborhoodCode', neighborhood_code,
                                    'bedroomCount', bedroom_count,
                                    'bathroomCount', bathroom_count,
                                    'singleVsMultiFamily', single_vs_multi_family,
                                    'pinProrationRate', pin_proration_rate,
                                    'mailingName', mailing_name,
                                    'mailingAddress', mailing_address,
                                    'propertyClass', property_class,
                                    'pin10', pin10,
                                    'taxDistrictCode', tax_district_code,
                                    'municipalityNumber', municipality_number,
                                    'municipalityName', municipality_name,
                                    'taxMunicipalityName', tax_municipality_name,
                                    'cmapWalkabilityTotalScore', cmap_walkability_total_score,
                                    'cmapWalkabilityNoTransitScore', cmap_walkability_no_transit_score,
                                    'floodFsFactor', flood_fs_factor,
                                    'chicagoCommunityArea', chicago_community_area,
                                    'condoUnitSqft', condo_unit_sqft,
                                    'condoParkingSpace', condo_parking_space,
                                    'condoCommonArea', condo_common_area
                                  )
                                  FROM property_addresses
                                  WHERE property_addresses.address = user_addresses.address
                                  LIMIT 1
                                ) AS property_details
                         FROM user_addresses
                         WHERE user_addresses.customer_id = ?
                         ORDER BY user_addresses.created_at DESC`
                ).bind(user.uid).all();

                return jsonResponse(results.map(row => ({
                        ...row,
                        propertyDetails: row.property_details ? JSON.parse(row.property_details) : null,
                        property_details: undefined
                })));
        } catch (err) {
                return jsonResponse({ error: err.message }, 500);
        }
}

export const onRequestPost = async (context) => {
        const { user, response } = await requireFirebaseUser(context.request);

        if (response) {
                return response;
        }

        if (!context.env.DB) {
                return jsonResponse({ error: 'Database not configured' }, 500);
        }

        try {
                const { address } = await context.request.json();

                if (!address) {
                        return jsonResponse({ error: 'Missing address' }, 400);
                }

                const propertyAddress = await findBestPropertyAddress(context.env.DB, address);

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

                // Insert new address. We use INSERT OR IGNORE to handle the UNIQUE constraint
                // quietly if the user tries to add the same address again.
                const result = await context.env.DB.prepare(
                        "INSERT OR IGNORE INTO user_addresses (customer_id, address, email) VALUES (?, ?, ?)"
                ).bind(user.uid, propertyAddress.address, user.email || '').run();

                // If changes === 0, it means it was a duplicate (ignored due to UNIQUE constraint)
                if (result.meta && result.meta.changes === 0) {
                        return jsonResponse({
                                success: true,
                                message: 'Address already exists',
                                address: propertyAddress.address,
                                property: propertyAddress
                        });
                }

                return jsonResponse({
                        success: true,
                        address: propertyAddress.address,
                        property: propertyAddress
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
                const { address } = await context.request.json();

                if (!address) {
                        return jsonResponse({ error: 'Missing address' }, 400);
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

                const result = await context.env.DB.prepare(
                        "DELETE FROM user_addresses WHERE customer_id = ? AND address = ?"
                ).bind(user.uid, address).run();

                return jsonResponse({
                        success: true,
                        deleted: result.meta?.changes || 0
                });
        } catch (err) {
                return jsonResponse({ error: err.message }, 500);
        }
}
