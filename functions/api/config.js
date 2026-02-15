
export const onRequestGet = async (context) => {
        // It is safe to expose the publishable key
        return new Response(JSON.stringify({
                publishableKey: context.env.STRIPE_PUBLISHABLE_KEY || context.env.stripe_publishable_key
        }), {
                headers: { 'Content-Type': 'application/json' }
        });
}
