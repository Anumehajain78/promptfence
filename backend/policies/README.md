# Policies

Six Cedar policies, one per file, each named after its `@id`. Schema:
`schema.cedarschema` (principal `Agent` with `role`, resource `Order`,
context `amount` and `session_total`, both whole rupees).

Cedar's rules decide: any forbid beats any permit, and no matching permit
means deny. Python never overrides that; it only maps Cedar's answer to
ALLOW / APPROVAL / DENY (see `../README.md`).

| Policy id                    | Plain English                                                         | Result   |
|------------------------------|-----------------------------------------------------------------------|----------|
| allow-support-refund-small   | Support may refund up to ₹10,000 in a single call.                    | ALLOW    |
| hold-support-refund-large    | Support refunds above ₹10,000 need a human (`@decision("APPROVAL")`). | APPROVAL |
| cumulative-refund-ceiling-v1 | Support may not push the session's refund total above ₹50,000.        | DENY     |
| forbid-support-delete        | Support may never delete a customer.                                  | DENY     |
| allow-finance-refund         | Finance may refund up to ₹1,00,000 in a single call.                  | ALLOW    |
| forbid-intern-export         | Interns may never export customer data.                               | DENY     |

`cumulative-refund-ceiling-v1` uses the session ledger:
`context.session_total + context.amount > 50000`.
