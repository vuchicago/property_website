
import { getStripeConfig } from './_stripe.js';
import { MAIL_FULFILLMENT_AMOUNT_CENTS } from './_packet_pricing.js';
import { enabled } from './_checkout_access.js';

export const onRequestGet = async (context) => {
        const appealHelpAmountCents = MAIL_FULFILLMENT_AMOUNT_CENTS;
        const stripe = getStripeConfig(context.env);
        // It is safe to expose the publishable key
        return new Response(JSON.stringify({
                publishableKey: stripe.publishableKey,
                stripeMode: stripe.mode,
                deploymentReady: isEnabled(context.env.DEPLOYMENT_READY) && Boolean(context.env.APPEAL_PACKETS),
                checkoutTesting:enabled(context.env.APPEAL_CHECKOUT_TESTING),
                checkoutConfigured:Boolean(stripe.secretKey && stripe.webhookSecret && context.env.APPEAL_PACKETS),
                appealHelpAmountCents
        }), {
                headers: {
                        'Content-Type': 'application/json',
                        'Cache-Control': 'no-store'
                }
        });
}

function isEnabled(value) {
        return ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());
}
