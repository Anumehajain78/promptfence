@id("forbid-support-delete")
// Support agents may never delete a customer.
forbid (
  principal is Agent,
  action == Action::"delete_customer",
  resource is Order
)
when { principal.role == "support" };
