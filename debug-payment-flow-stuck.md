# Debug Session: payment-flow-stuck [OPEN]

## Summary
- Symptom: after entering all customer details, the POS payment flow does not move forward and the user remains stuck on the same screen.
- Goal: determine whether the issue is caused by client-side validation/state, API response shape, stale recovery logic, or a swallowed async error.

## Hypotheses
1. The submit action is blocked client-side before the request is sent.
2. The request succeeds, but the next-step state is not updated in the POS app.
3. The backend response is missing fields required for the POS transition logic.
4. A stale pending-payment recovery path overrides the fresh flow.
5. An async error occurs after click/submit and is swallowed, so the UI never transitions.

## Evidence Plan
- Instrument the POS customer/payment submit handler before request, after response, and after state transition.
- Instrument the backend MOTO order creation route to capture the actual response shape.
- Reproduce one stuck flow and compare front-end event sequence with backend route execution.

## Findings
- Confirmed in `pos-app/src/App.jsx`: newly created POS customers were sent back to `customer-selection` after save.
- Confirmed in `pos-app/src/App.jsx`: customer selection only allows `verification.status === 'approved'`; pending customers are blocked with a message.
- Confirmed in `index.js`: `/pos/customers` creates only the customer record and does not create verification.
- Confirmed in `index.js`: `/pos/moto/orders` rejects any request with `customer_id` whose verification is not `approved`.
- Root cause: the POS add-customer flow returned the user to a list where the newly created customer could not be selected, creating a dead-end in the payment journey.

## Fix
- Continue the current payment as a named one-time customer after POS customer creation, instead of returning to the blocked pending-customer selection state.
- Keep the backend verified-customer rule intact for true `customer_id`-based verified payments.

## Status
- Phase: fix implemented
- Business logic modified: yes
