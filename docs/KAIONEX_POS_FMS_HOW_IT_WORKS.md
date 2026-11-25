# How the shared login is implemented

Small guide for KAIONEX FMS and POS. Organization: `techloomai`. Final status: `docs/KAIONEX_POS_FMS_FINAL.md`.

Long comparison: `docs/KAIONEX_POS_FMS_SHARED_LOGIN_RESEARCH.md`.
Operator steps: `docs/KAIONEX_POS_FMS_ASGARDEO_LOGIN.md`.

## What we ship

One customer. One Asgardeo user. One email. One password.

| Product | Asgardeo application | Group that opens it |
| --- | --- | --- |
| FMS | Kaionex FMS | `kaionex-fms` |
| POS | Kaionex POS | `kaionex-pos` |

Both applications live in the same organization. Buying the second product adds the other group to the **same** user. No second user. No second password. FMS data stays in Supabase. POS data stays in the POS database.

Staff passwords inside FMS (company, department, company user, setup admin) stay on the old form. **Continue with Asgardeo** is only the customer Techloom sold a product to.

## What happens on a click

```text
Customer clicks Continue with Asgardeo
        |
        v
Asgardeo login (email + the one password)
        |
        v
ID token comes back to that product only
        |
        +-- group missing --> /unauthorized, no product session
        |
        +-- group present --> email already a company, department, or staff login
        |                      --> stop, password form only
        |
        +-- group present --> find admin row by email
                                reuse it, do not change its password
                                if missing, create an admin row with an unusable random hash
                                open FMS
```

The Asgardeo password is never saved in FMS or POS. Tokens stay in the SDK `sessionStorage`. The browser app has no client secret.

## Authorization

The group only opens the product. The local role decides the work inside it. Full write-up: section 7 of `docs/KAIONEX_POS_FMS_SHARED_LOGIN_RESEARCH.md`.

| Check | FMS | POS |
| --- | --- | --- |
| Door | `kaionex-fms` | `kaionex-pos` |
| Inside | `admin`, `company`, `department`, `company_user` | POS role and store, in the POS database |

Company, department, and company-user passwords never go through Asgardeo. Their screens stay on those roles.

This zip links an allowed Asgardeo email to `admin_accounts` with role `admin`. That sees every company. It fits one operator. When many customers share one FMS, the buyer must be a `company` row for their own company, not an admin. That narrower link is not built yet.

Do not add groups such as `kaionex-fms-admin` or scopes such as `fms.read` for button checks. A group cannot name a company id, and this app does not send the Asgardeo access token to an API. Hiding a menu is not enough while Supabase row level security is off.

## Risks to watch

The full list is section 11 of `docs/KAIONEX_POS_FMS_SHARED_LOGIN_RESEARCH.md`.

| Before a customer password is sent | Before many shops share one FMS |
| --- | --- |
| Self-signup off, and users cannot add their own groups | Do not leave the buyer as `admin` |
| Exact redirect URL only, no wildcard, localhost removed in production | Do not reuse a company or staff email for the Asgardeo user |
| No client secret and no service-role key in the browser | Database checks are a separate project; the screen check is not enough |
| First real token checked, then users A–D | |
| Few people can open the `techloomai` console | |

Sign-out ends the Asgardeo session for both products. A group removed in the console is seen on the next load, not in a tab that is already open. If Asgardeo is down, the customer button fails and the staff password form still works.

The second product can skip the password while the Asgardeo browser session is still valid. Each app still checks its own group and loads its own data. Sign-out calls Asgardeo `signOut`, so a shared computer is not left signed in.

## FMS in this zip

Already coded. The button stays off until the client ID is in `.env`.

| Job | File |
| --- | --- |
| Read env. Empty client ID means off | `src/auth/asgardeoConfig.js` |
| Read groups and email from the token | `src/auth/groups.js` |
| Reuse or create `admin_accounts` | `src/auth/linkCustomer.js` |
| Wrap the app | `src/auth/AsgardeoRoot.jsx`, `src/main.jsx` |
| Button | `src/components/Login.jsx` |
| Deny page | `src/components/Unauthorized.jsx` |
| Allow, link, sign-out | `src/App.jsx` |

Allowed claim values: `kaionex-fms`, or a path ending in `/kaionex-fms`. Claims checked: `groups`, `roles`, `group`, and the WSO2 group URIs. Email comes from `email`, `preferred_username`, `username`, or `upn`.

Set this, then restart `npm run dev`:

```text
VITE_ASGARDEO_CLIENT_ID=<Kaionex FMS client ID only>
VITE_ASGARDEO_BASE_URL=https://api.asgardeo.io/t/techloomai
VITE_ASGARDEO_SIGN_IN_REDIRECT_URL=http://localhost:5173
VITE_ASGARDEO_SIGN_OUT_REDIRECT_URL=http://localhost:5173
VITE_ASGARDEO_SCOPES=openid profile email groups
```

Do not commit `.env`. Do not put a client secret in any `VITE_` name.

Console for the FMS app: single-page app, OpenID Connect, redirect and logout `http://localhost:5173`, allowed origin `http://localhost:5173`, groups released on the ID token.

## POS, same pattern

POS code is not in this zip. In the POS repo:

1. Create application **Kaionex POS** in `techloomai`. Its own client ID. Its own redirect, logout, and origin.
2. Install `@asgardeo/react`. Same base URL, scopes, PKCE, `sessionStorage`, no secret.
3. Copy the group reader. Allow only `kaionex-pos`.
4. Link by email to the POS user or store. Do not read or write FMS `admin_accounts`.
5. Keep any POS staff password on its current screen.
6. Sign out through the SDK.

## Day-to-day for Techloom

| Moment | Action |
| --- | --- |
| Customer buys FMS only | Create the user. Set the password. Add `kaionex-fms` only. Send the FMS address. |
| Customer buys POS only | Same user steps with `kaionex-pos` only. |
| Same customer gets the other product | Open that user. Add the missing group. Do not change the email or password. |
| Customer must lose one product | Remove that group. Leave the other group and the business data. |

## Check before calling it done

| User | Groups | FMS | POS |
| --- | --- | --- | --- |
| A | `kaionex-fms` | Opens | Denied |
| B | `kaionex-pos` | Denied | Opens |
| C | both | Opens | Opens |
| D | none | Denied | Denied |

Also check company and department password login, refresh, sign-out, and that `/dashboard` does nothing after the Asgardeo session ends.

Live Asgardeo login is not done yet. It starts when the Kaionex FMS client ID is pasted in.
