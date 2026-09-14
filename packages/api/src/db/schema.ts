/**
 * Authoritative column whitelist per table.
 * Request bodies may ONLY set these columns — every key is validated against
 * this map before it reaches a SQL statement. This closes injection through
 * dynamic column names in the CRUD layer.
 */
export const TABLE_COLUMNS: Record<string, string[]> = {
  customers: ["name", "email", "phone", "address", "notes"],
  properties: ["customer_id", "name", "address", "type"],
  technicians: ["name", "email", "phone", "specialty", "active"],
  jobs: [
    "customer_id",
    "property_id",
    "technician_id",
    "title",
    "description",
    "status",
    "priority",
    "scheduled_for",
    "estimate_amount",
    "actual_amount"
  ],
  estimates: ["job_id", "customer_id", "amount", "status", "line_items"],
  invoices: ["job_id", "customer_id", "estimate_id", "amount", "status", "issued_at", "paid_at"],
  payments: ["invoice_id", "customer_id", "amount", "method", "status", "external_ref", "received_at"]
};

/** Columns owned by the server — never settable from a request body. */
export const SERVER_OWNED_COLUMNS = ["id", "tenant_id", "created_at"];

export function isKnownTable(table: string): boolean {
  return Object.prototype.hasOwnProperty.call(TABLE_COLUMNS, table);
}
