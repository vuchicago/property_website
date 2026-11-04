import { getSavedProperties } from './addresses.js';
import { findTargetProperty, findComparableProperties } from './property/_compare.js';
import { lowerValuationComparables, suggestedAppealComparables, COMPARISON_VERSION } from '../../packet-comparisons.js';

export async function refreshComparisonSnapshot(db,snapshot={}) {
    let comparables=snapshot.comparables || [],warning='',radius=null,details=snapshot.details || {};
    try {
        const target=await findTargetProperty(db,details.recordId?{id:details.recordId}:{pin:String(snapshot.pin || '').split(',')[0].trim()});
        if(target) {
            details={...details,latitude:target.latitude,longitude:target.longitude};
            for(radius of [1,2,3,5]) {
                const matches=lowerValuationComparables({details,comparables:await findComparableProperties(db,target,radius)});
                if(matches.length)comparables=matches;
                if(matches.length>=5)break;
            }
        }
    }catch{warning='Comparison search could not be refreshed. Review the available imported comparisons.';}
    const pool=suggestedAppealComparables({details,comparables},20);
    if(pool.length<5)warning=`Only ${pool.length} lower-valued matching properties are available. No higher-valued properties were added.`;
    return {...snapshot,details,comparables:pool,comparisonVersion:COMPARISON_VERSION,comparisonRadius:radius,comparisonWarning:warning};
}

export async function propertySnapshot(context, propertyId, userId) {
    const [property] = await getSavedProperties(context.env.DB, userId, { propertyId });
    if (!property) throw Object.assign(new Error('Saved property not found.'), {status:404});
    return refreshComparisonSnapshot(context.env.DB,{propertyId,address:property.address,propertyKey:property.property_key,pin:property.pin,
        details:property.propertyDetails,capturedAt:new Date().toISOString(),
        source:'Imported Cook County property records. Assessment year is not verified; compare with your current county notice.'});
}
