import test from 'node:test';
import assert from 'node:assert/strict';
import {getStripeConfig} from '../functions/api/_stripe.js';
test('existing legacy Stripe secret aliases are reused without accepting a publishable key as a secret',()=>{
    const config=getStripeConfig({CF_PAGES_BRANCH:'Production',STRIPE_SECRET_KEY:'pk_live_not_a_secret',stripe_secret:'sk_live_existing',STRIPE_PUBLISHABLE_KEY:'pk_live_existing',STRIPE_WEBHOOK_SECRET:'whsec_existing'});
    assert.equal(config.mode,'live');assert.equal(config.secretKey,'sk_live_existing');assert.equal(config.publishableKey,'pk_live_existing');assert.equal(config.webhookSecret,'whsec_existing');
});
test('test mode cannot select a live Stripe credential',()=>{
    assert.equal(getStripeConfig({STRIPE_MODE:'test',STRIPE_SECRET_KEY:'sk_live_existing'}).secretKey,undefined);
});
