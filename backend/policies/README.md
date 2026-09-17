# Policies

Placeholder. The Cedar files (`*.cedar`) and schema land here next.
Six policies, no more. Precedence when several match: DENY > APPROVAL > ALLOW.
Anything no policy permits is denied (Cedar default-deny).

| # | Policy id (proposed)            | Plain English                                                                 | Decision |
|---|---------------------------------|-------------------------------------------------------------------------------|----------|
| 1 | support-refund-limit-v1         | A support agent may refund up to ₹10,000 in a single call.                    | ALLOW    |
| 2 | support-refund-approval-v1      | A support agent refund above ₹10,000 in a single call needs a human.          | APPROVAL |
| 3 | cumulative-refund-ceiling-v1    | A support agent may not push the session's refund total above ₹50,000.        | DENY     |
| 4 | support-delete-customer-v1      | A support agent may never delete a customer.                                  | DENY     |
| 5 | finance-refund-limit-v1         | A finance agent may refund up to ₹100,000 in a single call.                   | ALLOW    |
| 6 | intern-export-customer-data-v1  | An intern agent may never export customer data.                               | DENY     |

Policy 3 is evaluated against the session ledger: `running_refund_total + amount > 50000`.
