# Saved-property self-appeal workflow

Implemented 2026-11-03. Assessor only; individually owned residential property with up to six units. No new database migration is required. State uses the existing versioned `appeal_packets` JSON and private `APPEAL_PACKETS` R2 binding (`cookcountystorage`).

## Owner flow

1. Add/select a property in My account, then choose **Prepare my appeal · Free**. A property link starts/resumes the current-year case; the workspace selector supports another assessment year. Repeated starts reuse the existing case. New IDs are deterministic per owner, saved property, and year.
2. Review the imported property snapshot (PINs, township, class, size, year built, prior appeal and available values). The imported assessment year is not certified; compare it with the current county notice. Choose the grounds, requested **fair market value**, verified deadline and explanation yourself.
3. Answer the occupancy/document questions. A rental is not an owner-occupied residence. Choose suitable imported assessment comparisons or provide an external exhibit. Assessment comparisons do not substitute for sale/appraisal evidence on a market-value claim.
4. Complete the current [official Assessor application](https://www.cookcountyassessoril.gov/form-document/residential-appeal-form) and upload its PDF. Automatic filling of this official form is **not implemented**: the current asset server refused automated retrieval. The site provides the reviewed information to transfer; it does not fabricate an official application.
5. Upload categorized evidence. The checklist records document presence, not substantive approval. Required categories depend on the selected facts: current notice, property photo for non-owner-occupied appeals, comparisons/market evidence/corrections, and applicable sale, appraisal, condo, condition or affidavit documents. Date each subject photo. Review signature and notary requirements on the actual forms. Ordinary DocuSign does not notarize.
6. Build a combined PDF: completed application first, owner statement, imported property record, chosen assessment comparisons, attachment index, then the remaining evidence. Review every page. Free downloads remain available without purchase; the owner signs and submits using the accepted county channel, retaining confirmation.
7. Optional **$49** fulfillment becomes available after approval. Existing verified Stripe payment is required **before any DocuSign envelope is created**. It includes signing, printing, assembly, postage and tracking. The desk checks placement, sends the invitation, syncs completed documents, obtains mailing authorization, and records dispatch/delivery. Postal delivery is distinct from county filing.

## Limits and operational status

- DocuSign is still configured for **demo**. Demo requires Stripe test mode and cannot dispatch real mail. Provider credentials and live setup remain necessary; this change does not enable purchases or deploy production.
- Mailing and signature-method acceptance require the existing fulfillment review. User has authorized assuming DocuSign acceptance for this pilot; county acceptance has not been confirmed.
- No automated submission, automatic postal dispatch, appraisal, title verification, legal representation, signature verification of uploads, or notarial service is claimed.
- PDFs/JPGs/PNGs only. Individual uploads: 15 MB; evidence aggregate: 25 MB; assembled packet must fit the existing 15 MB packet-upload limit. PDFs are capped at 100 pages per attachment and 150 combined pages. Encrypted, corrupt or missing files fail assembly. Existing signed original uploads remain separately downloadable; merged PDF pages are copies.
- Evidence removal changes the working manifest without deleting historical R2 objects. Approved packet snapshots remain immutable. Revisions require reapproval and active DocuSign envelopes must be voided first.
- Third-party library: pinned MIT-licensed pdf-lib 1.17.1, vendored locally. No runtime dependency download.

## Verification

Run `node --test tests/*.test.mjs`, `python3 tests/packet-schema.test.py`, `bash build.sh`, and `npx --no-install wrangler pages functions build functions --outdir /tmp/cookcounty-builder-worker`. Browser fixtures exercise desktop/mobile intake, free downloads, checkout consent, DocuSign draft controls and the demo mailing block without provider calls.
