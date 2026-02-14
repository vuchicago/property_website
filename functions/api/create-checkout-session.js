
import Stripe from 'stripe';

export const onRequestPost = async (context) => {
        const stripe = new Stripe(context.env.STRIPE_SECRET_KEY || context.env.STRIPE_API_KEY);

        try {
                // Read body if needed, e.g. for custom price or quantity
                // const body = await context.request.json(); 

                // Use the Price ID provided by the user or env var
                // For now using the placeholder as discussed in the plan
                const PRICE_ID = context.env.STRIPE_PRICE_ID || 'price_H5ggYJDq';
                const DOMAIN = context.env.YOUR_DOMAIN || new URL(context.request.url).origin;

                const session = await stripe.checkout.sessions.create({
                        ui_mode: 'embedded',
                        line_items: [
                                {
                                        price: PRICE_ID,
                                        quantity: 1,
                                },
                        ],
                        mode: 'payment',
                        return_url: `${DOMAIN}/return.html?session_id={CHECKOUT_SESSION_ID}`,
                });

                return new Response(JSON.stringify({ clientSecret: session.client_secret }), {
                        headers: { 'Content-Type': 'application/json' }
                });

        } catch (err) {
                return new Response(JSON.stringify({ error: err.message }), {
                        status: 500,
                        headers: { 'Content-Type': 'application/json' }
                });
        }
}
