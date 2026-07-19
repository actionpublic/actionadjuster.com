# Action Adjusters Website

Static website for Action Adjusters, built for `actionadjuster.com`.

## Files

- `index.html` - homepage markup
- `styles.css` - responsive styling and brand presentation
- `script.js` - mobile navigation and claim form submission
- `admin/` - password-protected claim notification dashboard
- `api/` - Vercel serverless routes for form submissions and admin login
- `assets/` - logo, brand board, and hero imagery

## Local Preview

Run:

```bash
npx vercel dev --listen 8766
```

Then open:

```text
http://localhost:8766/
http://localhost:8766/admin/
```

## Admin Dashboard

The claim form posts to `/api/claims`. Admins can log in at `/admin/` to manage
claim inquiries, turn inquiries into leads, convert leads into clients, track
follow-ups, add internal notes, post client-visible updates, and attach small
prototype documents. The admin CRM also includes an admin user profile section
and editable client portal user profiles on client records.

Clients can use `/portal/` with their email and portal code after portal access
is enabled on a client record. Client portal users can view and edit their basic
profile details, view claim updates/documents, and upload documents.

Document upload/storage in this version is a lightweight prototype stored with
the claim record. Use proper object storage before production document handling.

Set these Vercel environment variables before using the dashboard in production:

```text
ADMIN_USERNAME=IlanR18
ADMIN_PASSWORD=choose-a-private-password
ADMIN_TOKEN_SECRET=choose-a-long-random-secret
RECAPTCHA_SITE_KEY=your-google-recaptcha-site-key
RECAPTCHA_SECRET_KEY=your-google-recaptcha-secret-key
BLOB_READ_WRITE_TOKEN=provided-by-vercel-blob
```

Local development defaults to username `IlanR18` and password `!LoveHashem1836`.
Local development also uses Google's public reCAPTCHA test keys if no
reCAPTCHA keys are configured.

Production CRM data is stored in the connected private Vercel Blob store. Without
`BLOB_READ_WRITE_TOKEN`, local development falls back to a temporary file store.
