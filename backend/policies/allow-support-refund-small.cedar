@id("allow-support-refund-small")
// Support agents may refund up to ₹10,000 in a single call.
permit (
  principal is Agent,
  action == Action::"refund",
  resource is Order
)
when { principal.role == "support" && context.amount <= 10000 };
