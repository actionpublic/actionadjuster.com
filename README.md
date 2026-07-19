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
ADMIN_USERNAME=ilanR18
ADMIN_PASSWORD=choose-a-private-password
ADMIN_TOKEN_SECRET=choose-a-long-random-secret
```

Local development defaults to username `ilanR18` and password `!LoveHashem1836`.

For persistent production storage, add Vercel KV to the project. Vercel will
provide `KV_REST_API_URL` and `KV_REST_API_TOKEN`. Without KV, local development
uses a temporary file store and production serverless data is not guaranteed to
persist.
