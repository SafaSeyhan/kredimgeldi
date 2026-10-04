# Membership system setup (Supabase)

The site is static (GitHub Pages serves `/docs`), so accounts are handled by
[Supabase Auth](https://supabase.com/docs/guides/auth), a hosted service with a free tier.
Until the steps below are done, the sign in page shows "Üyelik sistemi henüz yapılandırılmadı"
and nothing else on the site changes.

## 1. Create the project

1. Sign up at https://supabase.com and create a new project (pick the Frankfurt / eu-central region).
2. Open **Project Settings > API** and copy the **Project URL** and the **anon public** key.
3. Paste them into `docs/assets/js/auth-config.js`.
   The anon key is meant to be public. Never put the `service_role` key in the site.

## 2. URL settings

In **Authentication > URL Configuration**:

- **Site URL**: `https://kredimgeldi.com`
- **Redirect URLs**: add
  - `https://kredimgeldi.com/hesabim.html`
  - `https://kredimgeldi.com/password.html`
  - (optional, for local testing) `http://localhost:8000/*`

## 3. Email

**Authentication > Providers > Email** is on by default with "Confirm email" enabled, which is
what the sign up form expects (it tells the user to check their inbox).

Supabase's built-in mailer is limited to a few emails per hour. Before launch, set up a real SMTP
sender under **Project Settings > Authentication > SMTP Settings** (e.g. Resend, Brevo, or your
domain's mail provider) and translate the templates under **Authentication > Email Templates**
to Turkish.

## 4. Google / Facebook sign in (optional)

The "Google ile Giriş Yap" and "Facebook ile Giriş Yap" buttons work once the provider is
enabled under **Authentication > Providers**. Each needs an OAuth app created in Google Cloud
Console / Meta for Developers, with the callback URL Supabase shows on that page.
Until then the buttons show "Bu giriş yöntemi henüz aktif değil."

## What's included

| Page | What it does |
| --- | --- |
| `login.html` | Sign in (with "Beni Hatırla"), sign up (name, email, password, KVKK consent), Google/Facebook buttons |
| `password.html` | Sends the reset email; the link in the email opens the same page with a "new password" form |
| `hesabim.html` | Account page (name, email, member since, change password, sign out). Redirects to sign in when logged out |
| Header & mobile menu | "Giriş Yap / Üye Ol" become "<name> / Çıkış Yap" when signed in |

Code: `docs/assets/js/auth.js` (all auth logic) and `docs/assets/js/auth-config.js` (keys).
