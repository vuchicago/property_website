import { requireFirebaseUser, jsonResponse } from './_auth.js';
import { singleFamilyEligibility } from '../../packet-scope.js';
import { recordCheckoutAppeal } from './_appeals.js';
import { getStripeConfig } from './_stripe.js';
import { MAIL_FULFILLMENT_AMOUNT_CENTS } from './_packet_pricing.js';
import { paidFulfillment, isFreePacket } from './_fulfillment.js';
import { docusignConfigured } from './_docusign.js';

export async function onRequestPost({request,env}) {
    const {user,response} = await requireFirebaseUser(request);
    if (response) return response;
    if (!['1','true','yes','on'].includes(String(env.DEPLOYMENT_READY).toLowerCase())) return jsonResponse({error:'Fulfillment checkout is not available yet. Free preparation remains available.'},403);
    if (!env.APPEAL_PACKETS) return jsonResponse({error:'Private storage is not configured.'},503);
    const stripe = getStripeConfig(env);
    if (!stripe.secretKey || !stripe.webhookSecret || !docusignConfigured(env)) return jsonResponse({error:'Signing and payment configuration must be completed before checkout.'},503);
    if ((env.DOCUSIGN_ENV || 'demo') === 'demo' && stripe.mode !== 'test') return jsonResponse({error:'DocuSign demo requires Stripe test mode. Live purchases are disabled.'},503);
    try {
        const {packetId,fulfillmentAccepted} = await request.json();
        if (!isFreePacket(packetId) || fulfillmentAccepted !== true) return jsonResponse({error:'Choose your free packet and accept the $49 signing, print-and-mail terms.'},400);
        const appeal = await env.DB.prepare('SELECT * FROM appeals WHERE transaction_id = ? AND customer_id = ?').bind(packetId,user.uid).first();
        if (!appeal) return jsonResponse({error:'Packet not found.'},404);
        const row = await env.DB.prepare('SELECT state_json, revision FROM appeal_packets WHERE transaction_id = ?').bind(packetId).first();
        const state = row && JSON.parse(row.state_json);
        if (state?.status !== 'approved' || state.intake?.agency !== 'assessor' || state.approval?.version !== state.version) return jsonResponse({error:'Review and approve your Assessor packet before purchasing fulfillment.'},409);
        if(state.intake.singleFamilyScope!==true || singleFamilyEligibility(state.propertySnapshot?.details).eligible===false)return jsonResponse({error:'Fulfillment currently supports single-family homes with one dwelling unit only. Confirm the property scope before checkout.'},409);
        if (await paidFulfillment(env.DB,packetId,state.version,user.uid)) return jsonResponse({error:'Fulfillment is already paid for this packet version.'},409);
        // Fail before charging when either storage or migration 0031 is missing.
        await env.APPEAL_PACKETS.head('packet-service-readiness-check');
        const domain = env.STRIPE_CHECKOUT_DOMAIN || new URL(request.url).origin;
        const body = new URLSearchParams({mode:'payment',client_reference_id:user.uid,
            'line_items[0][price_data][currency]':'usd',
            'line_items[0][price_data][unit_amount]':String(MAIL_FULFILLMENT_AMOUNT_CENTS),
            'line_items[0][price_data][product_data][name]':'Assessor Appeal — DocuSign, Print & Mail',
            'line_items[0][price_data][product_data][description]':'Optional fulfillment: signing, printing, assembly, postage and tracking. Preparation and downloads are free.',
            'line_items[0][quantity]':'1',
            success_url:`${domain}/return.html?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url:`${domain}/appeal-packet.html?id=${encodeURIComponent(packetId)}`,
            customer_email:user.email});
        const metadata = {packetId,packetVersion:String(state.version),serviceType:'assessor_print_mail',serviceTermsVersion:'2026-11-03-fulfillment',
            propertyAddress:appeal.property_address,propertyKey:appeal.property_key || '',propertyPin:appeal.property_pin || '',
            customerName:state.intake.ownerName,userEmail:user.email,contractNameConfirmed:'true',signatureAcceptance:'assumed_unverified'};
        for (const [key,value] of Object.entries(metadata)) {body.set(`metadata[${key}]`,value);body.set(`payment_intent_data[metadata][${key}]`,value);}
        body.set('payment_intent_data[receipt_email]',user.email);
        const result = await fetch('https://api.stripe.com/v1/checkout/sessions',{method:'POST',headers:{Authorization:`Bearer ${stripe.secretKey}`,'Content-Type':'application/x-www-form-urlencoded','Idempotency-Key':`fulfillment-${packetId}-${state.version}-${row.revision}-${new Date().toISOString().slice(0,10)}`},body});
        const session = await result.json();
        if (!result.ok) throw new Error('Stripe checkout could not be created.');
        await recordCheckoutAppeal(env,{transactionId:session.id,customerId:user.uid,customerName:state.intake.ownerName,customerEmail:user.email,
            propertyAddress:appeal.property_address,propertyKey:appeal.property_key,propertyPin:appeal.property_pin,
            paymentIntentId:typeof session.payment_intent === 'string' ? session.payment_intent : null,
            paymentAmount:MAIL_FULFILLMENT_AMOUNT_CENTS,paymentStatus:session.payment_status || 'unpaid'});
        await env.DB.prepare('INSERT OR IGNORE INTO packet_fulfillment_orders (session_id, packet_id, packet_version, customer_id) VALUES (?, ?, ?, ?)').bind(session.id,packetId,state.version,user.uid).run();
        return jsonResponse({url:session.url,stripeMode:stripe.mode});
    } catch (error) {
        console.error('Fulfillment checkout failed:',error.message);
        return jsonResponse({error:'Could not start fulfillment checkout. Check service configuration and try again.'},503);
    }
}
