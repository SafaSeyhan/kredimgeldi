# Membership system setup (Supabase)

The site is static (GitHub Pages serves `/docs`), so accounts are handled by
[Supabase Auth](https://supabase.com/docs/guides/auth), a hosted service with a free tier.
Until the steps below are done, the sign in page shows "Üyelik sistemi henüz yapılandırılmadı"
and nothing else on the site changes.

## 1. Create the project

1. Sign up at https://supabase.com and create a new project (pick the Frankfurt / eu-central region).
2. Open **Project Settings > API Keys** and copy the **Project URL** and the **publishable** key
   (called "anon public" in older projects).
3. Paste them into `docs/assets/js/auth-config.js` (already done for project `olqucdyyuhgwgsyswwlj`).
   The publishable key is meant to be public. Never put the `secret` / `service_role` key in the site.

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

## 5. Loan application profile table

The account page (`hesabim.html`) lets signed-in customers save the personal details a loan
application needs. They are stored in a `loan_profiles` table in the same Supabase project.

1. Open **SQL Editor > New query** in the Supabase dashboard.
2. Paste the whole of [`supabase/loan_profiles.sql`](supabase/loan_profiles.sql) and click **Run**.
   It is safe to run more than once.
3. Check **Table Editor > loan_profiles**: it should show "RLS enabled" and four policies.

Row Level Security means each signed-in user can only read, insert, update and delete their own
row; visitors who are not signed in cannot touch the table at all. You (the project owner) can see
every customer's row in the Table Editor. Until the SQL is run, the account page shows a notice and
the profile forms are disabled.

Saved fields: name, T.C. kimlik no (checksum validated), birth date (18+), gender, marital status,
education, dependents; mobile phone, city, district, address, postal code, residence status;
employment status, occupation, employer, job start month, net monthly income, other income,
monthly debt payments, salary bank; loan type, amount, term; KVKK consent (with timestamp) and
accuracy declaration.

## What's included

| Page | What it does |
| --- | --- |
| `login.html` | Sign in (with "Beni Hatırla"), sign up (name, email, password, KVKK consent), Google/Facebook buttons |
| `password.html` | Sends the reset email; the link in the email opens the same page with a "new password" form |
| `hesabim.html` | Account page: welcome banner with profile completion, loan application profile in four sections (saved to `loan_profiles`), change password, delete saved details, sign out. Redirects to sign in when logged out |
| Header & mobile menu | "Giriş Yap / Üye Ol" become "<name> / Çıkış Yap" when signed in |

Code: `docs/assets/js/auth.js` (all auth logic), `docs/assets/js/auth-config.js` (keys),
`docs/assets/js/hesabim.js` + `docs/assets/css/hesabim.css` (account page).

## Forms, guest applications and the admin panel

Run `supabase/formlar_ve_yonetim.sql` in the SQL Editor (after `loan_applications.sql`). Before running it,
change the e-mail on the last line to the account that should manage the site.

- Contact forms (İletişim, SSS, Kampanyalar, service pages) save to `contact_messages`.
- The footer "Abone Ol" field saves to `newsletter_subscribers`.
- Applications made without signing in are saved to `loan_applications` with an empty `user_id`.
- `yonetim.html` (e.g. https://kredimgeldi.com/yonetim.html) lists applications, messages and subscribers
  for accounts in `admin_users`, lets you set an application's result, and exports each list as CSV.
  To add another manager: `insert into admin_users (user_id) select id from auth.users where email = '...';`
