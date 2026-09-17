@id("forbid-intern-export")
// Intern agents may never export customer data.
forbid (
  principal is Agent,
  action == Action::"export_customer_data",
  resource is Order
)
when { principal.role == "intern" };
