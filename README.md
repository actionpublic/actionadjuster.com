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

The claim form posts to `/api/claims`. Admins can log in at `/admin/` to see
claim notifications.

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
