@id("cumulative-refund-ceiling-v1")
// Support agents may not push the session's refund total above ₹3,55,000.
forbid (
  principal is Agent,
  action == Action::"refund",
  resource is Order
)
when {
  principal.role == "support" &&
  context.session_total + context.amount > 355000
};
