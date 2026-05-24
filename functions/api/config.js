
export const onRequestGet = async (context) => {
        const appealHelpAmountCents = parseAmountCents(context.env.APPEAL_HELP_AMOUNT_CENTS, 9900);
        // It is safe to expose the publishable key
        return new Response(JSON.stringify({
                publishableKey: context.env.STRIPE_PUBLISHABLE_KEY || context.env.stripe_publishable_key,
                deploymentReady: isEnabled(context.env.DEPLOYMENT_READY),
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

function parseAmountCents(value, fallbackCents) {
        const raw = String(value ?? '').trim();
        if (!raw) return fallbackCents;

        const numeric = Number(raw);
        if (!Number.isFinite(numeric)) return fallbackCents;

        if (raw.includes('.')) {
                return Math.round(numeric * 100);
        }

        return Math.round(numeric);
}
