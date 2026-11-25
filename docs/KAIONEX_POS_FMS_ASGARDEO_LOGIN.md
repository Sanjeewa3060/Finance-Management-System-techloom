# KAIONEX POS and FMS — one login (Asgardeo)

Operator note for Techloom. Final status: `docs/KAIONEX_POS_FMS_FINAL.md`. How the code runs: `docs/KAIONEX_POS_FMS_HOW_IT_WORKS.md`. Full comparison: `docs/KAIONEX_POS_FMS_SHARED_LOGIN_RESEARCH.md`. A customer who buys **POS** or **FMS** receives one email and one password. If Techloom later gives them the other product, they keep that same login. A second user account is not created.

**Console:** [Asgardeo getting started — organization `techloomai`](https://console.asgardeo.io/t/techloomai/app/getting-started)

**Products in this note**

| Product | What it is |
|---------|------------|
| KAIONEX FMS | This Finance Management System |
| KAIONEX POS | Point of Sale |

EMS and E-COM can use the same pattern later. This document covers POS and FMS only.

## Rule

One customer = **one user** in the `techloomai` Asgardeo organization.

| Event | What Techloom does | What the customer uses |
|-------|--------------------|------------------------|
| Buys the first product (POS or FMS) | Create the user, set the password, add only that product’s group | The email and password Techloom sends |
| Later receives the other product | Open the **same** user and add the other group | The **same** email and password |

Asgardeo answers: who is this person, and may they open POS, FMS, or both?

Each product still keeps its own business data. FMS keeps companies, departments, and transactions. POS keeps sales and stock. The shared login does not merge those databases.

## FMS implementation

FMS uses the supported SDK `@asgardeo/react` (Authorization Code with PKCE, `tokenRequest.authMethod: none`). Tokens stay in `sessionStorage` managed by the SDK. The app does not put the access token in `localStorage` and does not use a client secret.

The sign-in page keeps the existing email and password form for company and department staff. **Continue with Asgardeo** is the customer login.

After Asgardeo returns, FMS reads groups from the ID token. It checks `groups`, `roles`, and the WSO2 group claim URIs. A value of `kaionex-fms` or a path ending in `/kaionex-fms` is allowed. `kaionex-pos` alone, or no groups, opens `/unauthorized`.

A matching `admin_accounts` row is reused by email. The stored password is not changed and the Asgardeo password is never written to Supabase. If no admin row exists, FMS creates one with a random unusable hash so the existing admin screens keep working. Company and department rows are not converted.

The button stays disabled until `VITE_ASGARDEO_CLIENT_ID` is set. Restart `npm run dev` after adding it.

## Current password login

Company, department, and the local setup admin still sign in with the password stored in Supabase. The setup admin is `admin@kaionex.com`. Those passwords are unchanged.

Asgardeo opens FMS only after `VITE_ASGARDEO_CLIENT_ID` is set and the account has `kaionex-fms`. POS is not connected in this app.

## Setup in the `techloomai` organization

Do this once, in [the getting-started console](https://console.asgardeo.io/t/techloomai/app/getting-started).

1. Create two applications in this same organization:
   - **Kaionex FMS** — single-page app, OpenID Connect. Redirect for local research: `http://localhost:5173`
   - **Kaionex POS** — single-page app, OpenID Connect. Use the POS app’s own redirect URL.
2. Create two groups:
   - `kaionex-fms` — may open Finance
   - `kaionex-pos` — may open POS
3. Turn off public self-signup if customers must only receive accounts that Techloom creates.
4. After a test sign-in, confirm the ID token includes the email and the groups.

Write down, and do not commit secrets into git:

- FMS client ID
- POS client ID
- Redirect URL for each app
- Group names exactly as created

## Give the first product

Example: the customer buys FMS only.

1. In Asgardeo, create **one** user with the customer’s email.
2. Set the password yourself.
3. Add the user to `kaionex-fms` only. Do not add `kaionex-pos`.
4. Send the customer the email and password, and the FMS address.

They can sign in to FMS. POS stays closed because they are not in `kaionex-pos`.

If the first purchase is POS, do the same steps with `kaionex-pos` only.

## Give the second product

Example: that same customer later gets POS.

1. Search for the **existing** user. Do not create another user.
2. Add `kaionex-pos`. Leave `kaionex-fms` in place.
3. Do not change the email or password.
4. Tell them POS is now available on the same login.

They sign in with the original email and password. Both products open. A customer who only has FMS still cannot open POS.

## What to prove in research

Use two test users in `techloomai`.

| Test user | Groups | Expected result |
|-----------|--------|-----------------|
| Buyer of both | `kaionex-fms` and `kaionex-pos` | One password opens FMS and POS. The second app does not ask for a password again in the same browser. |
| Buyer of FMS only | `kaionex-fms` | FMS opens. POS refuses them. |

Check the token after login and confirm the email and only the assigned groups are present.

## What each app will do later

When the apps are connected:

1. The Sign in button sends the user to Asgardeo, not to a password stored in that app.
2. Asgardeo returns the email and groups.
3. FMS allows the session only if `kaionex-fms` is present.
4. POS allows the session only if `kaionex-pos` is present.
5. FMS still loads that person’s companies and transactions from Supabase. POS still loads that person’s sales data from the POS database.

Company staff and department logins inside FMS can stay inside FMS. The Asgardeo user is the customer Techloom sold a product to.

## Do not do this

- Do not create a second Asgardeo user when the customer buys the other product.
- Do not issue a second password for the second product.
- Do not put the Asgardeo client secret in the React app or in a `VITE_` variable.
- Do not commit client secrets, passwords, or tokens to this repository.
