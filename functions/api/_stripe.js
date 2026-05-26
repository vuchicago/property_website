export function getStripeConfig(env) {
        const mode = getStripeMode(env);
        const secretKey = mode === 'live'
                ? env.STRIPE_LIVE_SECRET_KEY || env.STRIPE_SECRET_KEY || env.STRIPE_API_KEY
                : env.STRIPE_TEST_SECRET_KEY || env.STRIPE_SECRET_KEY || env.STRIPE_API_KEY;
        const publishableKey = mode === 'live'
                ? env.STRIPE_LIVE_PUBLISHABLE_KEY || env.STRIPE_PUBLISHABLE_KEY || env.stripe_publishable_key
                : env.STRIPE_TEST_PUBLISHABLE_KEY || env.STRIPE_PUBLISHABLE_KEY || env.stripe_publishable_key;
        const webhookSecret = mode === 'live'
                ? env.STRIPE_LIVE_WEBHOOK_SECRET || env.STRIPE_WEBHOOK_SECRET
                : env.STRIPE_TEST_WEBHOOK_SECRET || env.STRIPE_WEBHOOK_SECRET;

        return {
                mode,
                secretKey,
                publishableKey,
                webhookSecret
        };
}

export function getStripeMode(env) {
        const explicitMode = String(env.STRIPE_MODE || '').trim().toLowerCase();
        if (explicitMode === 'live' || explicitMode === 'test') {
                return explicitMode;
        }

        return isProductionDeployment(env) ? 'live' : 'test';
}

function isProductionDeployment(env) {
        const branch = String(env.CF_PAGES_BRANCH || '').trim();
        const productionBranch = String(env.PRODUCTION_BRANCH || 'Production').trim();

        if (branch) {
                return branch === productionBranch;
        }

        return isEnabled(env.IS_PRODUCTION) || isEnabled(env.PRODUCTION);
}

function isEnabled(value) {
        return ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());
}
