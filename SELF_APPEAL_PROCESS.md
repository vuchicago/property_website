# Personal Cook County self-appeal process

Rules checked November 3, 2026. This is the working playbook for testing an appeal of your own individually owned residential property. It is not a county form, an appraisal, or confirmation that an appeal has been filed. Recheck the current forms and rules for the selected assessment year.

## Current service scope — free preparation, optional paid fulfillment

The launch service is Assessor-only for individually owned single-family homes with one dwelling unit, including rented single-family homes. The service aggregates the property record, suggests comparisons, prefills the applicable official forms and builds the packet. Owners confirm missing facts, choose their grounds and requested value, provide only necessary personal evidence, then review and sign. Blank forms are supplied by the preparation desk, not the owner. Free preparation and downloads remain available once the actual official templates are imported; see [OFFICIAL_FORMS_SETUP.md](OFFICIAL_FORMS_SETUP.md). The existing personal checklist retains Board research for reference; it is not a Board fulfillment offering.

**The $49 fee must be confirmed paid before any DocuSign envelope is created or sent.** This fee covers DocuSign signing, printing, assembly, postage and tracking for the approved packet version. A pending checkout, checkout redirect, or client checkbox cannot unlock signing. Refunded payments cannot unlock signing or mailing. Preparation is free; DocuSign is part of paid fulfillment.

After payment: administrator reviews signature positions → creates DocuSign draft → previews it → sends owner invitation → service retrieves completed PDF and certificate → owner reviews signed version and authorizes mailing → hold until the township appeal window is open → dispatch → carrier delivery → county confirmation. These last three events are separate. Optional fulfillment manages the calendar; owners do not enter a deadline in the preparation form. Unpublished, unmatched, wrong-year or closed windows block dispatch.

DocuSign acceptance is a **user-authorized working assumption, not verified county acceptance**. The integration defaults to demo, requires Stripe test mode while in demo, and blocks real mailing of demo-signed packets. Standard DocuSign does not provide notarization; the initial integrated flow is limited to one owner signer and packets requiring no notarial act. See [DOCUSIGN_INTEGRATION.md](DOCUSIGN_INTEGRATION.md) for setup and test limitations.

## Document verification before migration

**Migrations 0029–0031 were reviewed and applied with owner authorization on November 3, 2026.** See [APPEAL_WORKFLOW_SCHEMA.md](APPEAL_WORKFLOW_SCHEMA.md). The following personal facts were supplied by the owner: 8501 Christiana Avenue, Skokie, IL 60076; purchased in 2020; last appeal in 2024. Ownership is reported, not independently verified. The working year is 2026, pending confirmation. The owner confirms they do not live there and rent it out. Title, PIN/class, unit count, recent appraisals and the chosen agency still need confirmation. Do not publish these personal case notes as a public website asset.

For this non-owner-occupied rental, begin with the following baseline and add the rental records below:

| Item | Status for this pilot | Execution |
|---|---|---|
| Current official application | Required for the chosen agency and year | Complete official signature/certification |
| Brief explaining requested relief | Required at Board; encouraged at Assessor | Follow form/portal instructions |
| Front color photograph | Required at both agencies for this rental; own-residence exception does not apply | Photo itself has no signature |
| Comparable-property evidence | Our planned evidence route; not mandatory for every possible argument | Source records need no new signature |
| Current assessment/PIN record | Preparation reference | No new signature |
| 2024 appeal and decision | Useful background; not automatically a required attachment | Preserve originals |
| 2020 purchase records | Outside 2026 recent-sale lookbacks; retain as background | Existing executed documents |
| Newer appraisals/valuation reports | Determine whether any exist, including refinancing reports | Appraiser's certification where applicable |

For 2026, the recent-sale/report lookbacks are generally January 1, 2024 onward at the Assessor and January 1, 2023 onward at the Board, measured against the January 1, 2026 lien date. A 2020 purchase alone does not trigger recent-sale documents. A sale-price argument can still require transaction evidence. No new appraisal purchase is automatically required. See [Assessor Rules 12–15](https://rpie.cookcountyassessor.com/official-appeal-rules-cook-county-assessor) and [Board Rules 18–19](https://www.cookcountyboardofreview.com/board-review-official-rules).

### Rental-specific documents for this property

For a **2026 Board appeal**, Rule 20 adds:

- Schedule E for **2023, 2024 and 2025**.
- The lease if one lease covers the entire property; review lease summaries/rent rolls and any requested records if there are multiple leases.
- A lease-party relationship affidavit, identifying any relationship beyond landlord/tenant (or stating none); the rule exempts apartment buildings with more than 12 units.
- If returns are unfiled or combine properties: an explanatory affidavit plus a property-specific income/expense statement signed by the affiant.
- Only if seeking vacancy relief: the additional Rule 20–21 financial records, Vacancy/Occupancy Affidavit, dated interior photos, and vacancy/marketing explanation with supporting records.

Use the reviewed Board affidavit's sworn certificate (Notary Public or Board Deputy). These requirements apply even when the argument is comparable assessments rather than rental income. [Board Rules 20–21](https://www.cookcountyboardofreview.com/board-review-official-rules)

For the **Assessor**, Rule 16 excludes residential properties with **six units or fewer** from its income-producing-property requirements. Verify classification and unit count before requiring RPIE and three years of financials. The front-photo requirement still applies; for a comps argument, also include comparable-property photos under Rule 15 because this is not the owner's residence. [Assessor Rules 12, 15–16](https://rpie.cookcountyassessor.com/official-appeal-rules-cook-county-assessor)

Do not change the site's defaults for every property based on this single case. When this personal case is created, record `ownResidence: false` and `rental: true`; no personal case record has been created during this review; only the workflow schema has been migrated.

### Actual forms inspected

- **Board 2026 complaint:** the [August PDF linked from the forms page](https://www.cookcountyboardofreview.com/sites/g/files/ywwepo261/files/document/file/2026-08/2026%20Complaint%20form.pdf) has an appellant signature/certification and no notary block. Leave the attorneys-only section for attorneys. The July PDF linked from the rules page contains an inconsistent 2024 year in its extracted certification; use the current forms-page version or portal, and check the year before execution.
- **Board affidavits:** [General](https://www.cookcountyboardofreview.com/sites/g/files/ywwepo261/files/document/file/2026-07/GenAffidavit2026.pdf), [Vacancy/Occupancy](https://www.cookcountyboardofreview.com/sites/g/files/ywwepo261/files/document/file/2026-07/Vacc-OccAff-2026.pdf), and [Short Form Authenticity](https://www.cookcountyboardofreview.com/sites/g/files/ywwepo261/files/document/file/2026-07/ShrtFormAff-2026.pdf) all contain an affiant signature and a sworn certificate for a Notary Public or Board Deputy. Their availability does not mean all three belong in every packet.
- **Assessor General Attestation:** the [published form](https://prodassets.cookcountyassessoril.gov/s3fs-public/form_documents/GENERAL%20ATTESTATION.pdf?VersionId=Scv9r.2TGhnKPUCQDa_vAYAKF8XKuDNX) includes both signer and notary blocks. Using this form to attest to a photo date introduces a notarial requirement; do not label it an ordinary unsigned attachment. Verify the current version before use.

Ordinary DocuSign acceptance for a printed complaint remains unconfirmed. The absence of a notary block on the Board complaint does not establish acceptance of every electronic signature method.

### Remaining checks before calling the personal packet complete

- Verify the PIN, class, title and chosen assessment year against the official property record, then identify the available filing route.
- Confirm unit count and residential classification, lease coverage, title holder, and whether any vacancy relief is requested. Rental use and non-owner occupancy are confirmed. The Assessor's small-residential exception must not be applied to the Board.
- Confirm any newer appraisal, refinancing valuation, damage, vacancy, demolition or characteristic correction. These facts can add documents or affidavits.
- Identify who handled the 2024 appeal and whether any current-year filing or authorization exists. A prior-year appeal alone is not a current filing.
- Resolve the Assessor's conflicting public guidance: its residential overview says owners need not supply comps, while Rule 15 specifies at least three for comps-based arguments. For this pilot, prepare five suitable comps; do not describe a comps upload as universal to all appeals.

The checklist is a reviewed baseline, not yet a finalized property-specific filing packet. The database migration is now complete; no county submission or agency inquiry was performed.

## Start in your account

1. Sign in with your verified `vuchicago@gmail.com` account.
2. Add the property under **My properties**, selecting the correct property from the address results.
3. Choose **Self-appeal this property**.
4. Select **Assessor** or **Board of Review**, plus the assessment tax year. These are separate cases and deadlines; the tax-bill payment year may differ from the assessment year.
5. Complete the situation questions and save. This personal pilot has no Stripe checkout or preparation fee.
6. Work through the generated document list in order. Save your notes and progress. Upload relevant documents to their checklist categories.
7. Export your preparation summary or print it as a PDF. This summary is a working index, not a substitute for an official complaint.
8. Submit the official application yourself, then upload the county receipt and record its reference/date. Upload the decision when received.

The pilot is limited to verified administrator or invited account emails and by ownership of the saved property record. Administrators grant, pause and restore pilot access in the dashboard. There is no admin impersonation, email-account access, automatic county submission, or automatic DocuSign signing in this personal flow.

## Before choosing a route

Confirm the deed/title ownership, property class, township, assessment year, all related PINs, and any existing attorney or association appeal. A saved address is not proof of title. This pilot assumes individually titled class-2 residential property; trusts, businesses, association-wide cases and other classes need additional review.

Individual owners may appear for themselves at the Board; entities generally require counsel. The Board's residential category includes houses and qualifying small residential/mixed-use buildings. [Board residential guidance](https://www.cookcountyboardofreview.com/assessment-appeals/residential)

Keep separate records for the Assessor and Board. Do not duplicate an existing complaint merely because you are using this website. Resolve existing representation before filing another appeal.

## Ordered packet and document checklist

This is an assembly order for your working file, not an agency-mandated exhibit order. The website adds conditional rows based on your answers. “Required verification” describes a preparation task, not necessarily an attachment the county requires.

| Order | Document / task | When to include | Signature | Notarization |
|---|---|---|---|---|
| 1 | Property record, assessment notice and PIN list | Always review; keep as reference | No new signature on county records | No |
| 2 | Verified filing/evidence deadlines | Always record; use the correct agency and year | No | No |
| 3 | Current official complaint or portal application | Always | Owner completes required signature/certification | Inspect current form; do not assume required or waived |
| 4 | Explanation and requested value | Prepare for every case; Board requires a brief | Follow applicable form signature blocks | Only if the statement must be sworn |
| 5 | Property photograph | Include unless a specific exception applies | None on photo; a date attestation may need signature | Attestation follows its own requirements |
| 6 | Comparable-property records | Uniformity or sales-comparison argument | No new signature on source records | No routine notarization |
| 7 | Corrected-characteristic evidence | Incorrect size, classification, rooms, etc. | Required statements signed by the appropriate person | Depends on statement/form |
| 8 | Purchase agreement, closing statement, deed and relevant transfer records | Recent sale or sale-price argument | Keep executed documents intact | Do not re-notarize existing records routinely |
| 9 | Complete appraisal / valuation reports | Existing reports subject to disclosure or appraisal argument | Appraiser supplies certification; homeowner does not sign as appraiser | No routine extra notarization |
| 10 | Condominium/unit supporting records | Unit or townhome claim | Applicable owner forms | Depends on form |
| 11 | Rental/financial records | Rental or mixed-use situation | Sign required business statements | Missing/combined records may require affidavit |
| 12 | Damage, condition, repair or vacancy records | Claim relies on those facts | Authors sign reports; owner signs required statements | Conditional affidavits |
| 13 | Required affidavits or attestations | Triggered by facts or agency instructions | Person with knowledge signs | Follow the current form; a notarial act is separate from ordinary e-signing |
| 14 | Final review | Every case | Check all required signatures | Check applicable certificates and seals |
| 15 | Official submission receipt and submitted copy | After actual submission | Agency-generated receipt | No |
| 16 | Decision and follow-up correspondence | After county response | Preserve original records | No routine notarization |

## Agency-specific checks

### Cook County Assessor

Use SmartFile as the normal route. Complete the complaint and evidence by the township closing date. For a comps argument, review Rule 15: at least three comparables, with five recommended. Provide their PINs. A person appealing their own residence has a photo exception. Recent sale and existing valuation-report disclosure lookbacks are generally two years from January 1 of the appeal year. A substantial sale/valuation difference can trigger an affidavit. Rental/class exceptions and condo rules require separate review. Current forms control signatures and notarization; signed scans may be accepted, but originals can be requested. [Assessor rules, especially 2, 5, 10–17](https://rpie.cookcountyassessor.com/official-appeal-rules-cook-county-assessor)

The application uses your email account for filing communications. Save its submission acknowledgment and docket information; the Assessor says decisions are sent by mail. An unfinished online draft is not a submission. [Official online filing instructions](https://www.cookcountyassessoril.gov/online-appeals)

### Cook County Board of Review

Use its separate official complaint and portal. Rule 14 requires a brief and a recent front color photo. Check its separately announced evidence period. Sale and appraisal disclosure rules use three-year lookbacks; rental cases can require three years of Schedule E and additional financial records/affidavits. The taxpayer signs the complaint. Paper complaints require duplicate copies. The rules address USPS postmarks for received mailed complaints, but you still need to verify the full current mailing instructions. [Board rules, especially 5–9, 14, 16–20](https://www.cookcountyboardofreview.com/board-review-official-rules)

The live rules and some older FAQs differ in their descriptions of evidence requirements. Use the current rules and obtain clarification for your property type before filing; do not assume a generic “no evidence needed” FAQ overrides a specific requirement.

## Choose the argument and assemble evidence

- **Uniformity:** compare assessments of genuinely similar properties, with relevant characteristics and source records.
- **Overvaluation:** explain the market-value evidence; gather qualifying sales, your purchase documents or existing appraisals as appropriate.
- **Incorrect characteristics:** identify the recorded error, the correction sought, and evidence of the correct facts.

A higher tax bill by itself does not establish that the property assessment is wrong. Distinguish market value, assessed value and tax savings. Do not describe an automated comparison report as a licensed appraisal. [Assessor explanation of appeal grounds](https://www.cookcountyassessoril.gov/faq/i-think-your-office-has-overvalued-my-home-what-should-i-do)

## Signature and notarization decision

For each official form, inspect the signature blocks and any jurat or notary section before signing. Identify who must sign and whether the document calls for a sworn statement. If required, arrange the notarial act in the permitted manner. Keep original executed documents.

For this pilot, prefer the agency's own portal certification. Printed DocuSign acceptance for all appeal forms is **unconfirmed**. An ordinary DocuSign certificate does not by itself provide notarization. If you choose paper submission, obtain agency-specific confirmation or use its accepted handwritten-signature procedure. The website's completion checks are your review notes, not legally executed signatures.

## Final filing review

Verify the current year, owner name, PINs, requested values, dates, legibility, signatures, required notarization, and attachment completeness. Remove sensitive personal identifiers from evidence before uploading or filing. Download the submitted version and retain it separately from working drafts.

Open the [Assessor portal instructions](https://www.cookcountyassessoril.gov/online-appeals) or [Board portal](https://appeals.cookcountyboardofreview.com/). Use your own county account and complete the actual submission. For mail, first confirm the receiving address, copies and whether receipt or postmark governs timeliness. A website checkbox, DocuSign completion, postal tracking event or payment is not an official filing receipt.

Upload the official receipt under **Official county filing receipt**, then record its reference and date. The workspace labels this as **owner-recorded**, not independently verified. Monitor follow-up requests and hearing instructions. Store the result letter; investigate any further appeal options and their deadlines separately.

## Pilot implementation and release

- Entry: `self-appeal.html?property=<saved-address-id>`.
- Progress: D1 migration `0030_create_self_appeal_cases.sql`, keyed by authenticated user, saved address, agency and year.
- Documents: private `APPEAL_PACKETS` R2 binding, shared storage infrastructure with a separate `self-appeals/` object prefix. Maximum 5 MB per file; 50 files per case. No public bucket access.
- Saving checklist/notes works without R2. Uploads require R2 configuration. Database migration is required for the workspace.
- Changed situation answers clear completion marks for fresh review; documents and previous county receipts are retained.
- Automated official-form packet generation, multi-signer/notarial signing and county submission automation remain later work. The separate optional fulfillment workspace now includes the DocuSign API integration; see DOCUSIGN_INTEGRATION.md.
- Before generalizing, complete one real personal case, record the actual forms and signature requirements encountered, and reconcile the checklist with agency feedback.

No filing is made by creating or using this Markdown file.
