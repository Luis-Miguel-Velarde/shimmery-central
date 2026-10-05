# Documentation traceability — completed local demo

The source is the user's 11-page System Architecture Project 2 documentation for Shimmery Enterprises. This is an implementation checklist derived from its charter and principles, not an instructor-issued rubric.

The user authorized new fictional data because the corporate legacy database is unavailable, and simulated fingerprint matching because no scanner is available. The implementation demonstrates five branch contexts on one computer using central PostgreSQL and browser-local branch storage. Actual corporate deployment is not claimed.

| Document requirement | Reference | Delivered implementation |
|---|---|---|
| Central visibility across five locations | Charter, page 1; principles, page 3 | Five branch inventory contexts, management branch selection, branch reports and server-side branch access |
| Unique central product identifiers | Assumptions, page 1; Single Source of Truth, page 3 | Central catalog administration, unique codes, pricing and branch reorder thresholds |
| Retail POS and receipts | Charter, page 1; stakeholders, page 2 | Persisted cash sales, printable receipt numbers, stock deductions and seven-day full-receipt returns inherited from the supplied UI |
| Inventory movement on sale, receipt, return, damage and transfer | Assumptions, page 1 | Transactional inventory updates, damaged delivery quantities, audited stock adjustments and paired branch transfer movements |
| Registered supplier orders | Objectives, page 1; process, pages 9-11 | Supplier registry, purchase lines/costs, approval, partial delivery, printable order documents |
| Automatic low-stock order generation for review | Proactive Supply Chain Visibility, page 3 | One open replenishment proposal per branch/product; outstanding orders/requests reduce the proposed amount; purchasing reviews and converts proposals into registered orders |
| Branch stock requests/distribution | In scope, page 1; process diagram, page 10 | Destination branch requests, management approval and atomic stock transfer fulfillment |
| Payroll integrated into database | Objectives/success criteria, page 1; principle, page 3 | Employee records, attendance, completed-day counts and saved payroll snapshots with printable payslips |
| Restricted payroll access | Integrated Core Operations, page 3 | Owner/manager/accounting authorization at the API |
| Wholesale quotes/requests, customers and orders | Assumptions, page 1; stakeholders, page 2; context, pages 4-7 | Wholesale customer registry, quote lines at negotiated prices, acceptance and single-use cash-sale fulfillment |
| Accounting and order costs | Charter, page 1; accounting stakeholder, page 2; process, page 10 | Supplier costs, ordered/received totals, branch sales/refunds/payroll totals and supplier invoice registry with variance from ordered cost |
| Offline branch operation and resynchronization | Assumptions, page 1; principles, page 3 | Reloadable cached POS shell, IndexedDB branch cache/journal, localStorage checkout journal, cash-sale queuing, idempotent sync and conflict review; verified while the Node server was stopped |
| Packing product pricing | Context, page 4; capabilities, pages 8-9 | Logistics product-price table and printable pricing labels |

## Scope interpretation and boundaries

- Supplier communications are explicitly outside scope in the charter. The app stores/prints orders; it does not send supplier emails/messages or execute payments, despite those activities appearing in the current-state process diagram.
- Broad current-state staff duties such as hiring/firing, contracts and tax filing do not create full HR/legal/tax module requirements by themselves. The implementation focuses on the charter's operational integration scope.
- The overnight transition constraint is a deployment consideration. A new local demo and preservation of the student's earlier SQLite data do not establish a real overnight corporate migration.
- The source does not prescribe a database engine; PostgreSQL was chosen and installed for the central database. The initial SQLite demo is preserved as the import source rather than used as the active central database.
- Offline branch databases are demonstrated through browser-local storage, not five deployed PostgreSQL replicas. A previously authorized account and previously loaded branch catalog are required; new offline logins are unavailable.
- Fingerprint matching and contribution rates remain visibly simulated/illustrative. Payroll day counts count completed time-in/out dates; staff can review manual corrections before saving. No overtime/leave/shift or statutory deduction formula was supplied.
- The source describes five stores but names four municipalities. The demo uses the original UI's separate Main Store and Masbate City entries; names remain editable implementation assumptions until confirmed by the project team.

## Acceptance evidence

`VERIFICATION.md` records passing isolated PostgreSQL workflow tests and browser checks. `README.md` supplies the complete presentation walkthrough. `ARCHITECTURE.md` explains the central/branch topology, transaction and synchronization design. `API.md` and `postgres.sql` document the implementation interfaces and data model.
