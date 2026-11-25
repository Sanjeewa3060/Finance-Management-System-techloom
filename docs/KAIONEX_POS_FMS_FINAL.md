# KAIONEX POS and FMS — final output

Organization: `techloomai`. This zip is FMS only. POS is a separate repository.

| Document | Use it for |
| --- | --- |
| This file | What is done, what is not, and how to turn it on |
| `docs/KAIONEX_POS_FMS_HOW_IT_WORKS.md` | Short runtime guide |
| `docs/KAIONEX_POS_FMS_SHARED_LOGIN_RESEARCH.md` | Every option, authorization, and the 19 risks |
| `docs/KAIONEX_POS_FMS_ASGARDEO_LOGIN.md` | Console steps for the first and second product |

## Decision

One customer is one Asgardeo user, one email, one password. FMS opens only for `kaionex-fms`. POS opens only for `kaionex-pos`. Buying the second product adds the other group to that same user.

Inside the product, the local role still decides the work. A group is not a role. Staff passwords stay on the password form.

## Implemented in this FMS zip

| Behavior | Where |
| --- | --- |
| Button stays off until a real client ID exists | `src/auth/asgardeoConfig.js` |
| Authorization Code + PKCE, no client secret, tokens in SDK `sessionStorage` | `src/auth/asgardeoConfig.js`, `src/auth/AsgardeoRoot.jsx` |
| ID token signature and issuer are checked | `tokenValidation.idToken` |
| Groups read from `groups`, `roles`, `group`, and the WSO2 group URIs | `src/auth/groups.js` |
| `kaionex-fms` or a path ending in `/kaionex-fms` opens FMS. Anything else goes to `/unauthorized` and gets no FMS session | `src/App.jsx`, `src/components/Unauthorized.jsx` |
| Missing group is a denial. It is never treated as allow | `src/App.jsx` |
| New Asgardeo email creates `admin_accounts` with a random unusable hash. The Asgardeo password is not stored | `src/auth/linkCustomer.js` |
| Existing admin email is reused and its password is not changed | `src/auth/linkCustomer.js` |
| Company, department, or staff email is refused. Those people keep the password form | `src/auth/linkCustomer.js` |
| Asgardeo does not replace a company or department session unless the person clicked the button | `src/App.jsx` |
| Sign-out of an Asgardeo session calls Asgardeo `signOut` | `src/App.jsx` |
| Remember-me is off for Asgardeo profiles | `persistAuthUser(..., false)` |
| Company, department, company-user, and setup-admin password login still work | `src/App.jsx` |

Checked without a live Asgardeo token: the group reader allows FMS only, POS only is denied, both is allowed, none is denied, a path suffix matches, and a WSO2 claim matches. Password login for `admin@kaionex.com` reached the dashboard.

## Authorization that ships now

| Person | Door | Inside FMS |
| --- | --- | --- |
| Asgardeo user with `kaionex-fms`, email not used by staff | Opens | `admin` for this one-operator zip |
| Asgardeo user with only `kaionex-pos`, or no groups | `/unauthorized` | No row created |
| Company, department, company user | Password form | Their existing role and company or department |
| Setup admin `admin@kaionex.com` | Password form | `admin` |

The buyer-as-`company` link is not built. It is required before a second shop shares this database. Until then, an allowed new Asgardeo user can see every company.

## Not implemented here

| Item | Why it is not in this zip |
| --- | --- |
| Live Asgardeo login | No Kaionex FMS client ID has been supplied. None was invented. |
| POS application | POS code is not in this repository. It must repeat the same door with `kaionex-pos` and the POS database. |
| Row level security | The current app uses the publishable key with row level security off. Turning it on would change every query. It stays a separate project. |
| Action groups and action scopes | Rejected. A group name cannot point at a company id. |
| Second user, copied password, SAML, parent-domain cookie | Rejected. |

## Turn the customer door on

In https://console.asgardeo.io/t/techloomai/app/getting-started create **Kaionex FMS**:

- Single-page app, OpenID Connect
- Redirect and logout: `http://localhost:5173`
- Allowed origin: `http://localhost:5173`
- Groups `kaionex-fms` and `kaionex-pos`
- Release groups on the ID token
- Public self-signup off
- Users cannot add their own groups
- Exact redirect only, no wildcard

Put only the client ID in `.env`, then restart `npm run dev`:

```text
VITE_ASGARDEO_CLIENT_ID=<Kaionex FMS client ID>
VITE_ASGARDEO_BASE_URL=https://api.asgardeo.io/t/techloomai
VITE_ASGARDEO_SIGN_IN_REDIRECT_URL=http://localhost:5173
VITE_ASGARDEO_SIGN_OUT_REDIRECT_URL=http://localhost:5173
VITE_ASGARDEO_SCOPES=openid profile email groups
```

Do not commit `.env`. Do not put a client secret or the service-role key in a `VITE_` name.

POS uses its own application, client ID, origin, and group `kaionex-pos`. Same organization and same user.

## Prove it before a customer password is sent

| User | Groups | FMS | POS |
| --- | --- | --- | --- |
| A | `kaionex-fms` | Opens | Denied |
| B | `kaionex-pos` | Denied | Opens |
| C | both | Opens | Opens |
| D | none | Denied | Denied |

Also prove: company and department password login, refresh, sign-out, `/dashboard` after the Asgardeo session ends, and a staff email refused on Continue with Asgardeo.

Read the first ID token. If the group claim name is new, add it in `src/auth/groups.js` in both products. Do not allow a missing group.

## Give a product

| Moment | Action |
| --- | --- |
| First product | Create one user. Set the password. Add only that product’s group. |
| Second product | Open the same user. Add the other group. Do not change the email or password. |
| Remove a product | Remove that group. Data stays. The open tab sees the change on the next load. |
