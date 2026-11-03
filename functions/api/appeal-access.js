import {requireFirebaseUser,jsonResponse} from './_auth.js';
import {appealAccess} from './_appeal_access.js';

export async function onRequestGet({request,env}) {
    const {user,response}=await requireFirebaseUser(request);
    if(response)return response;
    if(!env.DB)return jsonResponse({error:'Database is not configured.'},503);
    try {
        const access=await appealAccess(env.DB,user);
        return jsonResponse(access);
    } catch(error) {
        console.error('Appeal access check failed:',error.message);
        return jsonResponse({error:'Appeal pilot access is unavailable.'},503);
    }
}
