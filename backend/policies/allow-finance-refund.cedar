@id("allow-finance-refund")
// Finance agents may refund up to ₹1,00,000 in a single call.
permit (
  principal is Agent,
  action == Action::"refund",
  resource is Order
)
when { principal.role == "finance" && context.amount <= 100000 };
