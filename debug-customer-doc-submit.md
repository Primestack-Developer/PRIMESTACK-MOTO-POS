# Debug Session: customer-doc-submit [OPEN]

## Summary
- Symptom: merchant uploads customer documents during customer creation, but after submit the customer shows as `not submitted`.
- Goal: determine whether the failure is in UI payload creation, backend verification creation, or customer-list refresh/rendering.

## Hypotheses
1. The merchant UI sends the wrong payload shape, so `documents` arrives empty or malformed.
2. The backend creates the customer but fails while creating `CustomerVerification` or its admin notification.
3. The customer refresh response omits or delays `verification`, causing a false `not submitted` status in the table.
4. Existing verification uniqueness/upsert behavior conflicts with the new create-and-submit flow.
5. The uploaded file state is lost before submit, so the request contains customer fields without documents.

## Evidence Plan
- Add instrumentation to:
  - merchant add-customer submit path
  - merchant customer create controller
  - merchant customers fetch/render path
- Reproduce one submission and compare payload, backend insert result, and rendered status.

## Findings
- Confirmed: live `/merchant/customers` in `index.js` used `validate(schemas.createCustomer)`, and that schema did not include `documents` or `notes`.
- Confirmed: Zod validation replaced `req.body` with parsed data, so uploaded documents were stripped before the handler.
- Confirmed: live `/merchant/customers` handler only created the customer record and returned `{ customer }`, without creating `CustomerVerification`.
- Confirmed: live `/merchant/customers` list did not include `verification`, so the merchant dashboard rendered `not_submitted`.

## Status
- Phase: fix implemented
- Business logic modified: yes
