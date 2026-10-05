# Hosted school demo

App: https://shimmery-central.onrender.com

Source: https://github.com/Luis-Miguel-Velarde/shimmery-central (private)

Render service: `shimmery-central`, ID `srv-db1tnbrncjis73cao6ig`, Node.js 24.21.0, Free instance, Ohio. Build `npm ci`; start `npm start`; health `/healthz`. Deploys automatically from GitHub main.

Database: existing Neon project `SysInteg`, production branch, default `neondb`, PostgreSQL 18, Ohio, Free plan. Connection pooling is enabled. Public-schema connections omit startup search_path options for Neon compatibility; TLS uses certificate verification.

Credentials live in Render environment settings. Use username `manager` and the private PIN entered during setup. Other initial fictional accounts use the same initial PIN; owner can create individual accounts. Changing SEED_PIN after accounts are created does not reset them. Passwords and PINs are excluded from source and shared ZIPs.

This cloud database is separate from the local database and starts with fictional seed records. The laptop does not need to remain on. Fingerprint attendance and payroll deduction rates retain their school-demo limitations.

Render Free sleeps with inactivity, so allow roughly a minute for the first visit and open it ahead of a presentation. Free usage quotas apply. Maintain exports before important demonstrations.
