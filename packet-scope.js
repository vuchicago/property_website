// One-dwelling-unit house classes, including individually assessed row homes.
const SINGLE_FAMILY_CLASSES = new Set(['202','203','204','205','206','207','208','209','210','234','278','295']);
export function singleFamilyEligibility(details = {}) {
    const code = String(details?.classCode ?? details?.class_code ?? '').trim().toUpperCase();
    const normalizedCode=code.replace(/[^0-9]/g,'');
    const use = String(details?.singleVsMultiFamily ?? details?.single_vs_multi_family ?? '').trim().toLowerCase();
    if (['2','3'].includes(use) || /multi|mixed|condo|apartment/.test(use) || (code && !SINGLE_FAMILY_CLASSES.has(normalizedCode))) {
        return {eligible:false,message:'Appeal preparation currently supports single-family homes with one dwelling unit only. Condos, multi-family, mixed-use and commercial properties are not supported.'};
    }
    return {eligible:code || /single/.test(use) || use==='1' ? true : null,message:'Confirm this is a single-family home with one dwelling unit.'};
}
