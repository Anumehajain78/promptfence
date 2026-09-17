@id("hold-support-refund-large")
@decision("APPROVAL")
// Support refunds above ₹10,000 are permitted only as APPROVAL (a human must confirm); see app.py.
permit (
  principal is Agent,
  action == Action::"refund",
  resource is Order
)
when { principal.role == "support" && context.amount > 10000 };
