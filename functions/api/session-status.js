
import Stripe from 'stripe';

export const onRequestGet = async (context) => {
        const stripe = new Stripe(context.env.STRIPE_SECRET_KEY || context.env.STRIPE_API_KEY);
        const { searchParams } = new URL(context.request.url);
        const sessionId = searchParams.get('session_id');

        if (!sessionId) {
                return new Response(JSON.stringify({ error: 'Missing session_id' }), {
                        status: 400,
                        headers: { 'Content-Type': 'application/json' }
                });
        }

        try {
                const session = await stripe.checkout.sessions.retrieve(sessionId);

                return new Response(JSON.stringify({
                        status: session.status,
                        customer_email: session.customer_details?.email
                }), {
                        headers: { 'Content-Type': 'application/json' }
                });

        } catch (err) {
                return new Response(JSON.stringify({ error: err.message }), {
                        status: 500,
                        headers: { 'Content-Type': 'application/json' }
                });
        }
}
