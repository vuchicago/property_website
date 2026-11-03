# Test the appeal pilot before Production

Run from this repository on your machine:

```bash
./scripts/appeal-local.sh
```

The script builds the site, creates a separate local D1 database and R2 store under ignored `.wrangler/appeal-pilot`, applies the packet schema and migration 0032, inserts five **fictional** Skokie properties, then starts Cloudflare Pages at `http://localhost:8788`. It never uses `--remote`. Checkout is held off with `DEPLOYMENT_READY=0`, Stripe is fixed to test mode, and DocuSign is demo. Stop with Ctrl-C; start again to keep your local data. The local seed's `123 TEST AVE SKOKIE` and PIN `00000000000001` are invented for testing. It does not copy production account data or evidence.

1. Sign in with a verified Firebase account. The primary administrator (`vuchicago@gmail.com`) has pilot access automatically. If your Firebase project does not allow `localhost`, add it to the Firebase authorized domains before testing sign-in.
2. On My account, add `123 TEST AVE SKOKIE`. Select **Prepare my appeal**. Confirm the saved property's imported data, complete the owner intake, upload test PDF evidence and build/download the packet. Use only synthetic documents locally.
3. Open `/admin.html` as an administrator. In **Free Appeal Testers**, enter a tester's verified account email and grant access. Share the ordinary sign-in URL yourself. Sign in as the tester, add a property, and verify free preparation. Pause the tester and verify that free workspace access is blocked. Administrators retain access through their role.
4. In a private window while signed out, visit `/#contact` and submit a test waitlist entry. Test that a signed-in account without pilot access sees **Join appeal waitlist** rather than the free packet action.
5. Run `bash scripts/test.sh`, then the browser checks in [TESTING.md](TESTING.md). Compile the Functions with `npx --no-install wrangler pages functions build functions --outdir /tmp/cookcounty-regression-worker`. Do not run remote migrations or a Pages deploy during local tests.

When the local workflow is satisfactory, deploy a preview branch with its own D1 database and private R2 bucket, apply migration 0032 there, and repeat the sign-in, invitation, waitlist, download, and $49 **test mode** checkout checks. Then apply migration 0032 to Production D1 and publish the reviewed branch. Production is not changed by the local script. The real DocuSign credentials and live mailing workflow remain separate from this pilot.

The public waitlist accepts a typed property address; selecting a matching suggestion is optional. Phone is optional. The isolated local server has no outbound email credentials, so submissions are saved in local D1 without sending notification email.

## Optional $49 checkout in local test mode

The default command disables checkout. To test it, stop the server, put **test-only** Stripe and DocuSign demo credentials in the ignored file `.wrangler/appeal-pilot/project-payments/.dev.vars`, and run:

```bash
./scripts/appeal-local.sh --payments
```

The file needs `STRIPE_TEST_SECRET_KEY`, `STRIPE_TEST_WEBHOOK_SECRET`, `DOCUSIGN_INTEGRATION_KEY`, `DOCUSIGN_USER_ID`, `DOCUSIGN_ACCOUNT_ID`, and `DOCUSIGN_PRIVATE_KEY` (with escaped newline characters). Never put live keys there. Start Stripe CLI webhook forwarding to `http://localhost:8788/api/webhook`, copy its test `whsec_...` value into `STRIPE_TEST_WEBHOOK_SECRET`, then restart payment mode. Use Stripe's test card and the DocuSign demo account. The script rejects live Stripe keys and production DocuSign mode. Checkout still requires an approved packet. Verify that the envelope is created only after the test payment webhook confirms payment. Demo signatures cannot authorize real mail dispatch.
