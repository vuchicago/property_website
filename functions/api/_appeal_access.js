export const PILOT_ADMIN_EMAIL = 'vuchicago@gmail.com';

export async function appealAccess(db, user) {
    if (!user?.email || !user.emailVerified) return {allowed:false,admin:false};
    const email = user.email.trim().toLowerCase();
    // The primary administrator always retains access, including before invitations exist.
    if (email === PILOT_ADMIN_EMAIL) return {allowed:true,admin:true};
    const role = await db.prepare("SELECT role FROM admins WHERE lower(email) = ? AND role IN ('admin','superadmin')").bind(email).first();
    if (role) return {allowed:true,admin:true};
    const invite = await db.prepare('SELECT active FROM appeal_pilot_access WHERE email = ?').bind(email).first();
    return {allowed:invite?.active === 1,admin:false};
}
