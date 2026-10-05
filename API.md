# Shimmery Central JSON API

Base URL: `http://127.0.0.1:3000/api`. The backend now uses PostgreSQL. POST requests use `Content-Type: application/json`. Login sets a session cookie. All other endpoints require that cookie. A response outside 2xx contains `{ "error": "message" }`.

Amounts named `*_cents` are integer centavos. Branch IDs are 1 (Main Store), 2 (Aroroy), 3 (Cataingan), 4 (Cawayan), and 5 (Masbate City). Product IDs and employee IDs are returned by the listing endpoints. Every branch is checked against the user's assignments.

| Method | Endpoint | Input / behavior |
|---|---|---|
| POST | `/login` | `{username,password}`; returns account and permitted branches |
| GET | `/me` | Returns current account and branches |
| POST | `/logout` | `{}`; invalidates current session |
| GET | `/dashboard?branch=1` | Branch sales, refunds, staff count, low stock and branch totals; money/staff restricted by role |
| GET | `/products?branch=1` | Product catalog, prices, stock and reorder thresholds |
| GET | `/suppliers` | Supplier details |
| POST | `/suppliers` | `{name,contact,items,terms}`; owner/purchasing |
| POST | `/sales` | `{branch,client_key,items:[{product_id,quantity}]}`; manager/retail |
| GET | `/receipts?branch=1&receipt=R-000001` | Receipt lines and return eligibility |
| POST | `/returns` | `{branch,receipt,kind:"refund"}` or kind `"defective"`; returns all remaining items |
| GET | `/orders?branch=1` | Purchase orders including line items |
| POST | `/orders` | `{branch,supplier_id,items:[{product_id,quantity}]}`; purchasing |
| POST | `/orders/approve` | `{branch,order_id}`; owner/manager |
| POST | `/deliveries` | `{branch,order_id,product_id,quantity,damaged_quantity}`; manager/purchasing/packing |
| GET | `/employees?branch=1` | Employees and daily rates; owner/manager/accounting |
| GET | `/attendance?branch=1&date=2026-10-05` | All branch employees and available time records |
| POST | `/attendance/scan` | `{branch,employee_id,action:"in"}` or action `"out"`; explicitly simulated |
| POST | `/payroll` | `{branch,employee_id,days,advance_cents}`; illustrative estimate |
| GET | `/setup` | Database counts and recent audit actions; owner/manager |

## Completed additional workflows

| Method | Endpoint | Input / behavior |
|---|---|---|
| POST | `/products` | `{branch,code,name,price_cents,cost_cents,supplier_id,reorder_level,opening_quantity}`; owner/manager |
| POST | `/products/update` | `{branch,product_id,name,price_cents,cost_cents,supplier_id,reorder_level}`; owner/manager |
| POST | `/reorder-levels` | `{branch,items:[{product_id,reorder_level}]}`; owner/manager/purchasing |
| POST | `/inventory/adjust` | `{branch,product_id,delta,reason}`; owner/manager; nonnegative resulting stock required |
| GET | `/movements?branch=1` | Most recent 100 branch stock movements |
| GET | `/replenishment?branch=1` | Open automatic low-stock proposals |
| POST | `/replenishment/order` | `{branch,proposal_id}`; purchasing converts an open proposal into a pending supplier order |
| GET | `/stock-requests?branch=2` | Requests where branch 2 is the destination |
| POST | `/stock-requests` | `{branch,source_branch,product_id,quantity}`; branch-authorized operational staff |
| POST | `/stock-requests/approve` | `{branch,request_id}`; owner/manager |
| POST | `/transfers` | `{request_id}` to fulfill an approved request, or `{source_branch,destination_branch,product_id,quantity,client_key}` for a direct transfer; owner/manager |
| POST | `/employees` | `{branch,name,daily_rate_cents}`; owner/manager |
| POST | `/employees/update` | `{branch,employee_id,name,daily_rate_cents}`; owner/manager |
| GET | `/attendance/summary?branch=1&start=2026-10-01&end=2026-10-31` | Completed attendance-day counts by employee; finance roles |
| GET | `/payroll-records?branch=1` | Stored payroll snapshots; finance roles |
| POST | `/payroll-records` | `{branch,employee_id,days,advance_cents,period_start,period_end}`; finance roles; overlapping periods rejected |
| GET | `/customers` | Wholesale customer registry; owner/manager/retail/accounting |
| POST | `/customers` | `{name,contact}`; owner/manager/retail |
| GET | `/wholesale?branch=1` | Quotes/orders including quoted lines |
| POST | `/wholesale` | `{branch,customer_id,items:[{product_id,quantity,price_cents}]}`; owner/manager/retail |
| POST | `/wholesale/accept` | `{branch,order_id}`; owner/manager |
| POST | `/wholesale/fulfill` | `{branch,order_id}`; manager/retail; records a single sale at the saved quote prices |
| GET | `/reports?branch=1` | Sales/refunds, ordered/received purchase costs, stored payroll totals and purchase registry; finance roles |
| GET | `/invoices?branch=1` | Supplier invoice amounts and ordered costs; finance roles |
| POST | `/invoices` | `{branch,order_id,invoice_number,amount_cents,invoice_date}`; finance roles; approved/received order required |
| GET | `/users` | Accounts and branch assignments; owner/manager; no password hashes returned |
| POST | `/users` | `{username,name,role,pin,branches:[1,2]}`; owner only |
| GET | `/sync-status?client_key=UUID` | Whether the current user's pending sale has already been saved centrally |

Purchase-order lines also accept `unit_cost_cents`; omitted values come from the central product cost. Responses preserve those costs and expose `total_cents` to authorized procurement/management roles. Packing does not receive purchase costs. Product catalog responses to retail/packing omit supplier costs.

Transfer retries reuse the same client key. Request fulfillment and wholesale fulfillment are also protected against duplicate deductions. Stock movements, payroll saves and administrative changes create audit events.

Offline sales may include `offline_recorded_at` as an ISO timestamp. The server stores it for audit while retaining its own authoritative `created_at` and receipt number. Cancellation/recovery of an unsynced browser journal entry is local UI behavior; no server transaction is reversed by canceling a pending entry.

### Sale example

```json
{
  "branch": 1,
  "client_key": "a-unique-uuid-for-this-sale",
  "items": [{ "product_id": 1, "quantity": 2 }]
}
```

The server ignores client prices and computes the total from current database prices. Use the same `client_key` for retries. A successfully retried transaction returns the original receipt with `duplicate: true`.

For queued offline sales add `offline: true` and `expected_price_cents` to each item. Changed prices or insufficient central stock return 409 without applying any part of the transaction.

### Errors

400: invalid input. 401: not logged in/expired session. 403: role/branch access denied or cross-origin request rejected. 404: record not found. 409: conflicting state, insufficient stock, duplicate record, already returned, or invalid delivery status. 413: request too large. 429: too many failed login attempts. 500: unexpected server error.
