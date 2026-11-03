import { onRequestGet as addresses } from './addresses.js';
import { findTargetProperty, findComparableProperties } from './property/_compare.js';

export async function propertySnapshot(context, propertyId) {
    const response = await addresses(context);
    if (!response.ok) throw Object.assign(new Error('Could not load your saved property.'), {status:503});
    const property = (await response.json()).find(p => p.id === propertyId);
    if (!property) throw Object.assign(new Error('Saved property not found.'), {status:404});
    let comparables = [], warning = '';
    try {
        const target = await findTargetProperty(context.env.DB, {pin:property.pin?.split(',')[0]?.trim(),address:property.address});
        if (target) comparables = (await findComparableProperties(context.env.DB,target,1)).slice(0,20);
    } catch { warning = 'Comparison data is unavailable. You can upload your own comparison evidence.'; }
    return {propertyId, address:property.address, propertyKey:property.property_key, pin:property.pin,
        details:property.propertyDetails, comparables, warning, capturedAt:new Date().toISOString(),
        source:'Imported Cook County property records. Assessment year is not verified; compare with your current county notice.'};
}
