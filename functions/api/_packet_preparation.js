import { getSavedProperties } from './addresses.js';
import { findTargetProperty, findComparableProperties } from './property/_compare.js';

export async function propertySnapshot(context, propertyId, userId) {
    const [property] = await getSavedProperties(context.env.DB, userId, { propertyId });
    if (!property) throw Object.assign(new Error('Saved property not found.'), {status:404});
    let comparables = [], warning = '';
    try {
        const target = property.propertyDetails?.recordId
            ? await findTargetProperty(context.env.DB, {id:property.propertyDetails.recordId})
            : null;
        if (target) comparables = (await findComparableProperties(context.env.DB,target,1)).slice(0,20);
    } catch { warning = 'Comparison data is unavailable. You can upload your own comparison evidence.'; }
    return {propertyId, address:property.address, propertyKey:property.property_key, pin:property.pin,
        details:property.propertyDetails, comparables, warning, capturedAt:new Date().toISOString(),
        source:'Imported Cook County property records. Assessment year is not verified; compare with your current county notice.'};
}
