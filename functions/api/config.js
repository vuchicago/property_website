
export const onRequestGet = async (context) => {
        const appealHelpAmountCents = Number(context.env.APPEAL_HELP_AMOUNT_CENTS || 9900);
        // It is safe to expose the publishable key
        return new Response(JSON.stringify({
                publishableKey: context.env.STRIPE_PUBLISHABLE_KEY || context.env.stripe_publishable_key,
                deploymentReady: isEnabled(context.env.DEPLOYMENT_READY),
                appealHelpAmountCents: Number.isInteger(appealHelpAmountCents) ? appealHelpAmountCents : 9900
        }), {
                headers: { 'Content-Type': 'application/json' }
        });
}

function isEnabled(value) {
        return ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());
}
