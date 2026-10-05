# Free deployment: Render + Neon

This deployment starts a separate, fresh school database with fictional records. It does not upload the local PostgreSQL database. The hosted API and UI run together on Render; persistent data stays in Neon.

## 1. GitHub

Create a private repository named `shimmery-central`. Extract `shimmery-central-hosting.zip`, open its folder, and upload the folder's CONTENTS using GitHub's Add file > Upload files. `package.json`, `server.js`, and `public/` must appear at the repository root, without another wrapping folder. Commit the upload.

The hosting ZIP excludes `.env`, `node_modules/`, and `data/`. Never upload your local database password or Neon connection string to GitHub. If the browser omits dotfiles, the deployment still works with the Render settings below; preserve `.gitignore` before using Git locally.

## 2. Neon

Use your Neon project and its default PostgreSQL database. In its dashboard, click **Connect**, choose the branch/database/role, enable connection pooling, and copy the PostgreSQL connection string. Keep it private. Leave SSL parameters attached. No manual schema SQL is necessary: the app initializes its tables and seed records on first start.

Choose a database region close to your Render region where available.

## 3. Render

Choose **New > Web Service**, connect GitHub, and select the repository. Configure:

| Setting | Value |
|---|---|
| Name | shimmery-central (or another available name) |
| Language | Node |
| Branch | main (or the branch containing the upload) |
| Root Directory | Leave blank if package.json is at the repository root |
| Build Command | npm ci |
| Start Command | npm start |
| Instance Type | Free |
| Health Check Path | /healthz |

Add these environment variables BEFORE creating the service:

| Key | Value |
|---|---|
| NODE_ENV | production |
| NODE_VERSION | 24.21.0 |
| HOST | 0.0.0.0 |
| DATABASE_URL | Your private Neon PostgreSQL connection string |
| SEED_PIN | A private PIN you choose, 8–12 digits with varying digits |

Keep the last two values private. Render supplies `PORT`; leave it alone. You do not need PGHOST, PGUSER, PGPASSWORD or the local Windows setup scripts on Render.

Click **Create Web Service**. After deployment succeeds, open the supplied HTTPS URL. Log in as `manager` (all operational modules) or `owner` (account creation) with the SEED_PIN you chose. All initial fictional accounts in README use that initial hosted PIN. The hosted login page does not show the PIN or account shortcuts. Share it only with your project team; create individual accounts through the owner's Accounts screen as needed.

SEED_PIN is used only when accounts are first created. Changing that variable later does not reset existing account PINs. Do not point this app at a database used by another project.

## 4. Verify

Confirm login, catalog, one sale, and receipt. Refresh to confirm persistence. Open Database Setup as manager and check PostgreSQL counts. Test a second account in a private browser window. Offline cash sales require an online login and catalog load first, on that same browser and hosted URL. Browser storage from localhost is separate from the hosted site.

For deployment errors, share the error text or a screenshot of Render's logs, with connection strings/passwords hidden. Do not share the environment variable values.

## Free-plan behavior

Render Free sleeps after 15 minutes without traffic and may take about a minute to wake. Open it before presenting. Stay within free usage quotas and choose no paid resources. We use Neon because Render Free PostgreSQL expires after 30 days. Keep a database export before important demos.

Official references: https://render.com/docs/web-services, https://render.com/docs/free, https://neon.com/docs/connect/connect-from-any-app.

The cloud connection uses certificate-verified TLS. HTTPS sessions use Secure, HttpOnly cookies. Fingerprint attendance remains simulated and payroll deduction rates remain illustrative.
