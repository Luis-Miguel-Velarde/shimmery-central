# Verification record

Verified on the user's Windows computer against the configured PostgreSQL 18 project database using installed Node.js 24.21.0.

## Automated checks

Command: `node --test --test-isolation=none test/api.test.js`.

Result: **16 tests passed, 0 failed** (15 workflow subtests plus their parent). Tests used a fresh `shimmery_test_<timestamp>` schema and removed that schema after completing. The public demonstration records were preserved.

Coverage:

- Session login/logout, role restrictions, branch assignments and cross-origin rejection.
- Server-authoritative retail prices, nonnegative stock, invalid quantities and offline price conflicts.
- Retried transaction keys, transaction rollback and two concurrent checkouts competing for one remaining unit.
- Single-use full-receipt refunds and defective goods not being restocked.
- Supplier registry, order approval, partial receipts, damage and over-delivery rejection.
- Catalog/employee maintenance and audited inventory adjustments.
- Unique automatic replenishment proposals and one-time conversion to supplier orders.
- Branch requests, approval, atomic source/destination stock movements and duplicate transfer protection.
- Persistent payroll snapshots, period overlap rejection and completed attendance-day counts.
- Wholesale quote acceptance and fulfillment once at the quoted price.
- Owner-created scoped accounts and denied administrative access from retail.
- Purchasing-controlled reorder levels and supplier invoice registration/variance data.

## Browser checks

- Logged in as Manager, inspected the central catalog and confirmed new modules and supplier costs rendered.
- Created a pending cash sale in offline simulation.
- Stopped the central Node HTTP server entirely, then reloaded the browser page. The service worker supplied the app shell; cached products and the pending sale remained available.
- Recorded a second cash sale while the server was still stopped.
- Restarted the server and reconnected. Both pending transactions synchronized and the displayed pending acknowledgment became central receipt R-000003. Cached stock matched the post-sync central stock.
- Recorded a simulated time-in and time-out, loaded completed attendance days into the payroll period, and saved a payroll record.
- Reloaded the browser and returned to Personnel & Payroll. The saved record remained listed with its employee, period, days and net pay, with a printable payslip action.

## Limits of verification

These checks verify a local demonstration with fictional data and browser branch storage. They do not establish corporate-network deployment, real fingerprint-device integration, statutory payroll compliance, supplier message delivery, actual bank payments or legacy corporate migration. Those are outside the agreed demonstration adaptations.
