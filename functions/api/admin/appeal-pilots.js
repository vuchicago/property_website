import {requireAdminAccount,jsonResponse,normalizeEmail} from './_admin.js';

export async function onRequest(context) {
    const {user,response}=await requireAdminAccount(context);
    if(response)return response;
    try {
        const db=context.env.DB;
        if(context.request.method==='GET') {
            const rows=await db.prepare('SELECT email, active, invited_by, created_at, updated_at FROM appeal_pilot_access ORDER BY created_at DESC, email').all();
            return jsonResponse({pilots:rows.results || []});
        }
        if(context.request.method!=='POST')return jsonResponse({error:'Method not allowed.'},405);
        const {email:rawEmail,active}=await context.request.json();
        const email=normalizeEmail(rawEmail);
        if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length>254 || typeof active!=='boolean')return jsonResponse({error:'Enter a valid email and access state.'},400);
        await db.prepare(`INSERT INTO appeal_pilot_access (email,active,invited_by) VALUES (?,?,?)
          ON CONFLICT(email) DO UPDATE SET active=excluded.active,invited_by=excluded.invited_by,updated_at=CURRENT_TIMESTAMP`).bind(email,active?1:0,user.email).run();
        return jsonResponse({success:true,email,active});
    } catch(error) {
        console.error('Appeal pilot management failed:',error.message);
        return jsonResponse({error:'Could not update pilot access. Confirm migration 0032 is applied.'},503);
    }
}
