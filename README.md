# Shimmery Central — completed local school demo

A working implementation of the supplied UI and documentation scope, adapted to a fresh database and simulated fingerprint attendance. The app uses Node.js 24+, a JSON REST API, central PostgreSQL, and browser-local offline storage.

## Start on this computer

For online hosting with Render and Neon, follow [HOSTING.md](HOSTING.md). Hosted initial account PINs come from your private `SEED_PIN`, instead of the local demo PIN below.

1. Double-click **start.cmd** in this folder.
2. Open **http://127.0.0.1:3000** in your browser.
3. Choose a demo account and log in with PIN **1234**.
4. Keep the server console open. Press Ctrl+C in that console to stop it.

If it says the app is already running, open the URL. PostgreSQL must be running. The private `.env` created by `setup-postgres.cmd` contains the project database connection; do not share it.

## Run on another computer / from the project ZIP

Install Node.js 24+ and PostgreSQL, extract the ZIP into a folder, and run `setup-postgres.cmd` to configure that computer's database. The script looks for installed PostgreSQL command-line tools. Then run `start.cmd`; it installs the locked npm dependency if needed. Alternative terminal commands are `npm ci` and `npm start`.

The ZIP contains source, dependency manifests, schema, tests and documentation. It excludes database credentials, node_modules, and the current database files. Another computer starts with fictional seed data. Existing local demo records on this computer were preserved when moving from SQLite to PostgreSQL.

## Demo accounts

| Username | Role / branch |
|---|---|
| owner | Business Owner, all branches |
| manager | Manager, all branches |
| purchasing | Purchasing Staff, all branches |
| accounting | Accounting Staff, all branches |
| retail | Retail Staff, Main Store |
| packing | Packing Staff, Main Store |
| retail_2 ... retail_5 | Retail Staff at branch 2 ... 5 |
| packing_2 ... packing_5 | Packing Staff at branch 2 ... 5 |

Branches: 1 Main Store, 2 Aroroy, 3 Cataingan, 4 Cawayan, 5 Masbate City. Initial demo PINs are 1234. The owner can create more accounts and assign branches. Use separate browser profiles or private windows for simultaneous accounts.

## Included workflows

- Role-based login and server-enforced branch permissions.
- Central product catalog, prices, supplier costs, opening inventory and reorder levels.
- Retail cash sales, unique printable receipts, stock checks and full-receipt returns within seven days. Defective returns refund the customer without restocking damaged goods.
- Supplier registration, manual supplier orders, automatic replenishment proposals, management approval, partial delivery receipt and damage recording.
- Branch stock requests, approvals, transfers, stock adjustments and inventory movement history.
- Wholesale customers, multi-product quotes, management acceptance, cash-sale fulfillment and printable quotes/orders.
- Employee maintenance, simulated fingerprint scans, persisted attendance, attendance-based day counts and saved payroll snapshots with printable payslips.
- Accounting branch totals, supplier cost registry and supplier invoice records with variance from ordered costs.
- Pricing labels for packing, database counts and audit history.
- Offline cash-sales queue, branch catalog cache, reloadable offline app shell, retry protection and pending/conflict review.

## Presentation walkthrough

1. **Owner/Manager — Product Catalog:** inspect or create a product. Opening stock is assigned to the selected branch. Prices and codes are central; reorder thresholds are branch-specific. Record a negative damage adjustment if desired.
2. **Purchasing — Purchasing:** inspect automatically generated low-stock proposals. Convert one into a pending supplier order, or enter manual quantities and costs. Set branch reorder levels. Print the purchase order.
3. **Manager — Purchasing:** approve the order.
4. **Packing — Logistics:** select an approved order and receive goods, entering damaged quantity separately. Only usable quantity increases stock. View/print product pricing labels.
5. **Retail — Point of Sale:** add products and record a cash sale. Print the receipt. Look up the receipt and process a full return. A receipt cannot be refunded twice.
6. **Branch Retail — Branch Stock:** request stock from the main store. **Manager:** select the destination branch, approve the request and fulfill it. Inspect the source and destination movement histories.
7. **Retail — Wholesale:** create a fictional customer, add quote lines and save a quote. **Manager:** accept it. **Retail/Manager:** fulfill it once and inspect the resulting receipt reference.
8. **Manager — Personnel:** time in and out using **Simulate scan**. The UI explicitly says no scanner is connected.
9. **Accounting — Personnel:** choose a pay period and click **Use completed attendance days**, review days/advance, calculate and save payroll. Reload the app and print the stored payslip. Overlapping periods for the same employee are rejected.
10. **Accounting — Accounting Reports:** review branch sales, refunds, ordered/received costs and saved payroll totals. Record a fictional supplier invoice against an approved/received order and inspect its cost variance.
11. **Manager/Retail — POS:** load branch products online, click Online to simulate offline, record cash sales, and reload. Pending sales remain. Reconnect and see each UUID sync once. You can also stop the central Node server after the offline shell is installed, reload, record a sale, restart the server and reconnect.
12. **Owner/Manager — Database Setup:** show PostgreSQL status, record counts and recent audit events.

## Important demo boundaries

- Fingerprint matching is simulated. No biometric data is collected.
- Payroll deductions are sample rules: SSS 5% of gross, PhilHealth 2.5%, Pag-IBIG 2% capped at PHP 200. These are not statutory payroll formulas. Completed attendance days mean days with both a time-in and time-out; no shift duration, overtime, leave or lateness formula is implied. Authorized staff review the entered days before saving.
- Offline operation needs a prior online visit/login and cached products for that branch. The app shell must have installed successfully in the browser. New login, personnel, purchasing and other non-POS mutations need the central server. Browser data must be retained until transactions sync. The offline account snapshot expires after eight hours and central session authorization is rechecked on sync.
- Offline sales retain their original local timestamp for audit, but receive server timestamps and central receipt numbers when synced. Price or stock conflicts remain queued until resolved. A pending transaction can be canceled locally after checking that it has not been saved centrally; canceled journal entries can be restored.
- Five branches are represented centrally with branch-local browser storage. This is a local demonstration, not five deployed SQL servers. Remote devices/online hosting are not configured. The default server binds to loopback; remote offline web apps would need HTTPS and appropriate deployment.
- Supplier messages and bank payments are not sent. Supplier invoices are registered documents, with one invoice per purchase order in this demo. No tax invoice certification or audited financial statements are claimed.
- Returns apply to all remaining items on a receipt; partial item refunds/exchanges are not implemented.
- Corporate legacy data was unavailable. The system creates fictional master data; the prior student's SQLite demo was imported once and its original file retained. No corporate migration or overnight production cutover is claimed.

## Files and database

- `server.js` / `backend.js`: HTTP service and business workflows.
- `database.js`: PostgreSQL pool, transactions and environment loading.
- `postgres.sql`: current relational schema; `schema.sql`: earlier SQLite source schema retained for reference.
- `public/index.html`, `app.js`, `extra.js`: UI based on the supplied prototype.
- `public/sw.js`: static offline app shell; IndexedDB/localStorage keep the branch cache and transaction journal.
- `API.md`: endpoints. `ARCHITECTURE.md`: architecture and synchronization decisions.
- `REQUIREMENTS.md`: documentation traceability and agreed demo adaptations.
- `VERIFICATION.md`: checks performed. `test/api.test.js`: isolated PostgreSQL integration tests.

Database: `shimmery_central`. Application role: `shimmery_app`. Connection settings remain in `.env`, which is ignored by Git and excluded from the ZIP.

## Tests

```powershell
npm test
```

Tests use a uniquely named temporary schema in the configured PostgreSQL database. They create fictional fixtures, run the workflows and remove only their own schema. They do not alter the public demo records. PostgreSQL and the `.env` configuration are required. The suite verifies permissions, stock/price checks, transactional rollback, concurrent sales, retries, returns, procurement/delivery, transfers, replenishment, wholesale, payroll snapshots, invoice records and logout.

## Configuration and backup

Optional runtime environment variables: `PORT` (3000), `HOST` (127.0.0.1). PostgreSQL settings are `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER` and `PGPASSWORD`, read from `.env`. Never put real credentials into the sample file or shared ZIP.

Use pgAdmin Backup for the `shimmery_central` database before presentation changes or moving computers. The source ZIP is not a backup of your current database. Do not delete browser storage while offline sales remain pending.
