// Appeal suggestions use the imported total assessed value, not requested market value.
function positiveValue(value) {
    if(typeof value!=='number' && typeof value!=='string')return null;
    const number=Number(value);
    return Number.isFinite(number) && number>0?number:null;
}

export const RESIDENTIAL_ASSESSMENT_RATIO=0.10;
export const MAX_APPEAL_COMPARISONS=5;
export const COMPARISON_VERSION='lower-average-distance-v1';

export function impliedMarketValue(assessedValue) {
    const value=positiveValue(assessedValue);
    return value===null?null:value/RESIDENTIAL_ASSESSMENT_RATIO;
}

export function impliedMarketValuePerSqft(property) {
    const value=impliedMarketValue(property?.taxableValue),size=positiveValue(property?.homeSize);
    return value===null || size===null?null:value/size;
}

export function lowerValuationComparables(snapshot) {
    const subjectValue=positiveValue(snapshot?.details?.taxableValue);
    if(subjectValue===null)return [];
    return (snapshot?.comparables || []).filter(item=>{
        const value=positiveValue(item.taxableValue);
        return value!==null && value<subjectValue;
    });
}

export function selectedAppealComparables(state) {
    const selected=new Set(state.intake?.selectedComparables || []),seen=new Set();
    return lowerValuationComparables(state.propertySnapshot).filter(item=>{const pin=String(item.pin);if(!selected.has(pin)||seen.has(pin))return false;seen.add(pin);return true;}).slice(0,MAX_APPEAL_COMPARISONS);
}

// Prefer street variety among already matched homes, without sorting for the lowest values.
export function suggestedAppealComparables(snapshot,limit=MAX_APPEAL_COMPARISONS) {
    const groups=new Map(),seen=new Set();
    for(const item of lowerValuationComparables(snapshot)) {
        const pin=String(item.pin || '');if(!pin || seen.has(pin))continue;seen.add(pin);
        const street=String(item.address || pin).replace(/^\s*\d+[a-z-]*\s+/i,'').trim().toLowerCase();
        if(!groups.has(street))groups.set(street,[]);groups.get(street).push(item);
    }
    const result=[];
    while(result.length<limit) {
        let added=false;
        for(const group of groups.values())if(group.length && result.length<limit){result.push(group.shift());added=true;}
        if(!added)break;
    }
    return result;
}

export function comparisonAverageMarketValue(state) {
    const rows=selectedAppealComparables(state);
    return rows.length?Number((rows.reduce((sum,item)=>sum+impliedMarketValue(item.taxableValue),0)/rows.length).toFixed(2)):null;
}

export function comparisonDistance(property,subject) {
    if(property?.distanceMiles!==null && property?.distanceMiles!==undefined && property?.distanceMiles!=='' && Number.isFinite(Number(property.distanceMiles)) && Number(property.distanceMiles)>=0)return Number(property.distanceMiles);
    const coords=[subject?.latitude,subject?.longitude,property?.latitude,property?.longitude];
    if(coords.some(value=>value===null || value===undefined || value==='' || !Number.isFinite(Number(value))))return null;
    const [lat1,lon1,lat2,lon2]=coords.map(Number);if(Math.abs(lat1)>90 || Math.abs(lat2)>90 || Math.abs(lon1)>180 || Math.abs(lon2)>180)return null;
    const rad=degrees=>degrees*Math.PI/180;
    const a=Math.sin(rad(lat2-lat1)/2)**2+Math.cos(rad(lat1))*Math.cos(rad(lat2))*Math.sin(rad(lon2-lon1)/2)**2;
    return 3958.8*2*Math.atan2(Math.sqrt(a),Math.sqrt(Math.max(0,1-a)));
}

export function comparisonDistanceLabel(property,subject) {
    const miles=comparisonDistance(property,subject);return miles===null?'Distance unavailable':`${miles.toFixed(2)} mi`;
}
