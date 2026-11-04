// Appeal suggestions use the imported total assessed value, not requested market value.
function positiveValue(value) {
    if(typeof value!=='number' && typeof value!=='string')return null;
    const number=Number(value);
    return Number.isFinite(number) && number>0?number:null;
}

export const RESIDENTIAL_ASSESSMENT_RATIO=0.10;
export const MAX_APPEAL_COMPARISONS=5;

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
    const selected=new Set(state.intake?.selectedComparables || []);
    return lowerValuationComparables(state.propertySnapshot).filter(item=>selected.has(String(item.pin))).slice(0,MAX_APPEAL_COMPARISONS);
}
