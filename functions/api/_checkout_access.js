import { getStripeConfig } from './_stripe.js';
import { appealAccess } from './_appeal_access.js';
import { docusignConfigured } from './_docusign.js';

export const enabled = value => ['1','true','yes','on'].includes(String(value || '').trim().toLowerCase());
export async function checkoutAccess(env,user) {
    const stripe=getStripeConfig(env);
    const testing=enabled(env.APPEAL_CHECKOUT_TESTING) && (await appealAccess(env.DB,user)).admin;
    const ready=enabled(env.DEPLOYMENT_READY);
    const configured=Boolean(env.APPEAL_PACKETS && stripe.secretKey && stripe.webhookSecret);
    const signingReady=docusignConfigured(env) && ((env.DOCUSIGN_ENV || 'demo')!=='demo' || stripe.mode==='test');
    return {enabled:configured && (testing || (ready && signingReady)),testing,mode:stripe.mode,configured,signingReady,ready};
}
