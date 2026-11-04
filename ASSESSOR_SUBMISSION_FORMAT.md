# Assessor packet presentation

Researched November 3, 2026. Scope: individually owned Class 2 single-family homes. This is our presentation design, not an official county packet template or a claim that the county mandates this page order.

## Official guidance used

- [Residential valuation](https://www.cookcountyassessoril.gov/how-residential-property-valued-0): residential assessments are 10% of estimated market value. Display **implied market value = assessed value ÷ 0.10**. Preserve assessed-value fields where the official application asks for them.
- [Comparable-property guidance](https://rpie.cookcountyassessor.com/what-are-comparable-properties): comparison quality depends on location, class, age, building/land area and construction. Same class alone is insufficient.
- [2026 appeal rules, particularly Rules 2, 12 and 15](https://rpie.cookcountyassessor.com/official-appeal-rules-cook-county-assessor): completed official forms, signatures where requested, legible supporting records, comparable PINs and applicable photos matter. Rule 15 calls for at least three comps and recommends five; it cautions against selecting solely for lower value. The own-residence photo exception does not apply to a rental. Follow the current form's notarization instructions.

The main .gov pages returned HTTP 403 during direct retrieval; the Assessor's own `rpie.cookcountyassessor.com` site exposed the current rules and comparison guidance. The 2026 [annual-meeting presentation](https://prodassets.cookcountyassessoril.gov/s3fs-public/form_documents/2026%20Annual%20Meeting%203.25.2026.pdf) also explains subject photographs and date attestations. Government PDF templates still require the existing reviewed import process; no recreated government application is included.

## Report design

1. Actual prefilled official application and applicable attestations, with signature blocks blank.
2. Owner statement: property, all PINs, appeal year, township, contact details, current implied market value, owner's requested market/assessed value and grounds. The owner chooses the request; the system does not infer it from an average.
3. Exhibit A: human-readable subject characteristics, implied market value and value per building square foot, capture date and source limitations. Do not print database keys such as `taxableValue` as field labels.
4. Exhibit B: landscape comparison grid with the subject alongside **up to five** selected comps. Include addresses, PINs, township/neighborhood, class, building area, year, bedrooms/baths, construction, implied market value, value per square foot and percentage below the subject.
5. Attachment/signature index with actual PDF page references, template source/revision and a reminder to complete the official signature/notary blocks.
6. Original supporting PDF pages and dated color images. Generated report pages carry page numbers; official forms and uploaded pages are preserved.

The product's requested filter retains only positive assessed values strictly below the subject's, before selecting five, in existing similarity order. Equal, higher or unknown values never fill empty slots. This is a disclosed, filtered **assessment comparison** set; implied values are not sale prices, an independent appraisal or a complete market survey. Actual sales/appraisals remain separate evidence for market-value grounds. Meaningful differences and current-year records still need owner review. Land square footage is not currently available in this snapshot and is not fabricated from land assessment dollars.

Missing forms/evidence yield a clearly marked preparation copy. That copy does not approve the packet, create a signature envelope or confirm filing.

## Preview

[Fictional preparation-copy PDF](examples/assessor-preparation-example.pdf). Rebuild with `node scripts/preview-assessor-packet.mjs`. It deliberately has no government templates or supporting photos and is marked not ready to file. It is not copied into the public deployment by the build script.
