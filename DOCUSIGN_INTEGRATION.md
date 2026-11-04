# DocuSign fulfillment integration

Status: framework deployed; DocuSign remains configured for demo and has not been connected to an actual sender account. Migrations 0029–0031 were applied to production D1 on November 3, 2026; see APPEAL_WORKFLOW_SCHEMA.md. All provider calls in automated tests are mocked.

## Product contract

Free preparation for single-family homes collects facts/evidence, owner-selected grounds and value, prefills reviewed official PDF templates, assembles the packet, and allows free review/download. Owners supply missing facts and applicable personal evidence; the preparation desk supplies reusable blank official forms. Actual PDFs must first be imported and mapped; see [OFFICIAL_FORMS_SETUP.md](OFFICIAL_FORMS_SETUP.md). County filing remains the owner's appeal.

The optional **$49** purchase includes DocuSign signing, printing, assembly, postage and tracking. **Server-confirmed payment is required before creating or sending any envelope**, including demo envelopes. Payment is linked to the exact approved packet version. Checkout, browser redirects and client-supplied payment flags never establish payment. Free preparation does not incur DocuSign API calls.

## Configure the demo account

Administrator payment testing is independent of DocuSign configuration. `APPEAL_CHECKOUT_TESTING=true` permits administrators to reuse the existing Stripe configuration even while `DEPLOYMENT_READY` is false. Production's existing credentials select **live Stripe**, so the administrator UI explicitly states that a card will be charged $49. No $99 Price is reused; the existing account/integration creates a $49 Checkout Session. Legacy credential aliases remain supported.

The separate **Test existing Stripe checkout** action works on an owned draft packet. Its verified payment is labeled **Payment Test**, does not create a fulfillment-order link, sends no fulfillment notifications, and never unlocks signing or mailing. A regular fulfillment purchase still requires an approved single-family packet and links payment to that approved version. Before full rollout, disable `APPEAL_CHECKOUT_TESTING`, configure the correct payment/signing environments, and enable normal readiness. The testing override does not enable DocuSign create/send/recover while readiness remains false.

1. Create a DocuSign developer/demo account and integration app. Generate an RSA keypair for JWT authentication. Keep the private key off the browser and out of Git.
2. Record the integration key, impersonated sender user's API user ID, and API account ID from the demo account.
3. Grant the sender user's consent for `signature impersonation` to this app. Use DocuSign's consent flow and a registered redirect URI; the application uses server-to-server JWT afterward.
4. Store these server-side Pages secrets through the Cloudflare dashboard or your normal secret-management workflow:
   - `DOCUSIGN_INTEGRATION_KEY`
   - `DOCUSIGN_USER_ID`
   - `DOCUSIGN_ACCOUNT_ID`
   - `DOCUSIGN_PRIVATE_KEY`: RSA **PKCS#8** PEM (`BEGIN PRIVATE KEY`). Convert a generated PKCS#1 key locally if necessary; never paste private keys into chat.
5. Set `DOCUSIGN_ENV=demo` (default, also in wrangler.jsonc). Use Stripe **test** credentials and signed webhook configuration. The server rejects live Stripe checkout while DocuSign is in demo.
6. Configure private R2; migrations through 0031 for this workflow are already applied (unrelated 0028 remains pending). The existing `DEPLOYMENT_READY` checkout gate remains in force. Do not enable it until an actual end-to-end sandbox exercise passes.

## API flow

- `POST /api/packet-start`: creates a free case from the authenticated user's saved property. No Stripe or DocuSign call.
- `POST /api/create-checkout-session`: requires approved Assessor packet owned by the user, fulfillment consent, configuration and a version without a paid fulfillment purchase. Fixed USD 49.00. Stripe session creation uses an idempotency key.
- Stripe's verified webhook or authenticated server-side session retrieval updates the payment record. Fulfillment eligibility joins that paid order to the case, owner and packet version.
- `POST /api/packet-signature`, `action=create`: admin-only; checks paid fulfillment, exact approved version, reviewed signature coordinates, one signer and no notarization. Creates a **draft**, not an emailed invitation. The signer is the case owner's account email, not a client-supplied address.
- `action=send`: admin-only; requires payment again and confirmation of preview in DocuSign. Sends the existing draft. No embedded signing session is needed: DocuSign emails the owner its signing link.
- `action=sync`: owner/admin; fetches the envelope status server-side. On completion, verifies the signer and downloads `combined` and `certificate` PDFs into private R2, then marks signed. No completion is inferred from a redirect or uploaded browser claim. Checks are limited to once per 15 minutes.
- `action=void`: admin cancels an unfinished envelope before revisions. Completed envelopes are retained; this version does not automatically revise completed envelopes.
- `action=recover`: looks up an uncertain creation by its stored DocuSign transaction ID. It does not blindly create another envelope.

## Signature placement and limitations

The admin enters reviewed PDF coordinates as JSON, for example `[{"page":1,"x":100,"y":500}]`. Page numbers are one-based. Multiple positions for the same owner are supported. These are example coordinates only: preview the **actual** envelope and every required field in DocuSign before sending. This implementation places signature tabs; other required fields must already be completed or configured during the draft preview. There is no automated legal-form inspection, identity-document verification, multi-owner routing or remote online notarization.

DocuSign acceptance by the Assessor is recorded as `assumed_unverified`, per the user's design instruction. A completed envelope confirms signing, not county acceptance. Demo-signed packets are blocked from actual dispatch. Production requires a DocuSign production app/account setup and appropriate API plan; demo credentials cannot simply be treated as production credentials.

## Failure recovery

Creation stores a unique transaction ID before contacting DocuSign. If the response is uncertain, use Recover instead of creating another case/envelope. If no unique envelope can be recovered, an administrator must inspect DocuSign and reconcile the operation. Do not delete pending rows to retry blindly.

Send retries read the existing envelope before attempting another send. A crashed in-flight operation retains its lock: inspect the envelope and reconcile the lock manually before retrying. An ordinary error releases the request's own lock. Provider errors do not expose tokens or private keys to the browser.

A revision clears approval/signature/mailing authorization and increments the packet version when the corrected PDF is uploaded. Fulfillment is version-bound. The initial framework does not transfer a purchase to another version; resolve/refund unused fulfillment manually before a new purchase. Refunds disable paid actions while preserving access to free preparation and existing downloads.

## Verify before release

Run `node --test tests/*.test.mjs`. Tests exercise real local JWT signing/verification with generated keys and mocked Google, Stripe and DocuSign responses. Browser fixtures cover mobile/desktop free preparation, unpaid downloads, optional checkout and demo signing controls. These tests do not replace a real sandbox test with your account.

No Connect webhook is configured in this version; completion is synchronized on demand with a 15-minute interval. Keep that limitation visible operationally. Postal tracking and county confirmation are separately recorded. Provisioning, a live sandbox round trip, delivery operations and production activation remain outstanding.

Sources:
- [JWT authentication](https://developers.docusign.com/platform/auth/jwt-get-token/)
- [Create envelope](https://developers.docusign.com/docs/esign-rest-api/reference/envelopes/envelopes/create/)
- [Retrieve envelope documents](https://developers.docusign.com/docs/esign-rest-api/reference/envelopes/envelopedocuments/get/)
