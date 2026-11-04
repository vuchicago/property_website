# Official forms supplied by the preparation service

The current pilot supports individually owned single-family homes with one dwelling unit. An owner-occupied house and a rented single-family house are both eligible. Known condo, multi-family, mixed-use and commercial records cannot start a new packet or buy fulfillment. Existing documents are retained.

## One-time administrator setup

The Assessor's actual blank PDFs must be imported before a complete filing packet can be generated. The **free preparation copy remains downloadable immediately**, including collected data and uploads plus a cover listing missing items and marking it not ready to file. It never requires payment or changes packet approval/version. On November 3, 2026 the official PDF asset host returned HTTP 403. No county application has been recreated, guessed, or replaced by a synthetic form. Automated tests use clearly identified test PDFs in temporary local storage only.

1. Sign in as an administrator and open `official-forms.html`, linked from **Free Appeal Testers** and the packet preparation desk.
2. Choose the assessment year and form kind. Open the official source, obtain its current fillable PDF and select the file. Maximum 4 MB and 20 pages.
3. **Inspect PDF fields**. Map each field to a confirmed data source, a literal value, or an explicit non-applicable skip with a reason. Signature fields must stay blank. The page lists the supported sources and actual field names.
4. Review every field and checkbox against the real official form. Application mappings must cover contact/address details, year, PIN, township, requested value, owner/residential/single-family/current-year status and the supported appeal grounds. For combined attestation text, use a template such as `I, {{ownerName}}, confirm the photo of {{propertyAddress}}, PIN {{primaryPin}}, was taken on {{photoDate}}.`
5. Confirm the form/year, mappings and blank signatures; publish the reviewed template. Use a new reviewed template when the agency changes the form. The service keeps immutable PDF versions and records the template source/revision in generated packets.

The official source pages are the [Assessor application](https://www.cookcountyassessoril.gov/form-document/residential-appeal-form) and [Assessor forms directory](https://www.cookcountyassessoril.gov/forms). The current application page links `CCAO_form_realEstateAssessedValuationAppeal_consolidated_2026_fillable_1_0.pdf`. Import and map the real PDF before treating this integration as ready for live case generation.

## Owner workflow

- Saved property and owner details prefill the intake. The account's verified email supplies the application email. Phone and missing required mailing details are collected once.
- The owner confirms the single-family scope, occupancy, grounds, requested value and supplied facts. A uniformity statement and up to five comparisons are suggested for review. Correction arguments require the owner's actual facts.
- The service supplies the official application, generated statement, property summary, comparison exhibit, attachment index and applicable official attestations. Owners do not download blank forms or copy the same information into them.
- The owner uploads only applicable personal evidence, such as dated photos, required comparison photos, closing records, an existing appraisal or correction/damage records. Photos without a visible date trigger an official photo-date attestation using the capture date provided. Recent purchases require the date, price, seller and relationship disclosure.
- The owner reviews the finished packet and completes required signatures or notarization. Ordinary DocuSign does not notarize. Free downloads and owner submission remain available. Optional $49 fulfillment still requires payment before any DocuSign envelope, and signed/authorized packets wait for an open township window.

This is packet preparation, not an automatic SmartFile submission or a county filing confirmation. The service's template library and rules must be maintained against the [current Assessor rules](https://rpie.cookcountyassessor.com/official-appeal-rules-cook-county-assessor). Cases requiring another official form remain a preparation-desk review task; the system does not certify an arbitrary uploaded document as complete.

## Storage and validation

The existing private `APPEAL_PACKETS` binding stores `official-forms/assessor/{year}/{kind}/published.json` and immutable revision PDFs. No database migration is needed. Only administrator accounts may inspect/publish templates; owner packet access remains protected by owner identity and pilot permissions.

Template validation requires mapping coverage and explicit skips, rejects pre-signed templates, preserves blank signature blocks, and blocks missing facts or text that cannot fit the official fields. A template for one year cannot satisfy another year's case. Missing templates hold the complete filing packet while retaining saved intake, uploads and free preparation-copy downloads. No Stripe or DocuSign calls occur during import, prefilling or free PDF assembly.
