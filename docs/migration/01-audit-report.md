# Bridge & Value — WordPress Audit & Migration Plan

**Site audited:** https://bridgeandvalue.com/ · **Date:** 2026-11-09 · **Scope:** public site + public WordPress REST API (read-only, no changes made). No WordPress admin access yet; anything marked **[needs admin]** can't be confirmed from the public site.

Companion files in this folder:
- `url-inventory.tsv`: all 49 sitemap URLs with status, title, type and classification
- `media-inventory.tsv`: all 221 public media items with size, dimensions, alt text and whether live pages use them
- `02-migration-checklist.md`: the running checklist

All 221 original media files were downloaded with their `wp-content/uploads/YYYY/MM/` paths and filenames unchanged (8.7 MB).

---

## 0. Key findings

1. **Only 13 of the 49 sitemap URLs are real Bridge & Value content.** The other 36 are leftover sample content from the **Gerow** theme (ThemeDox; sample text mentions "Agilos"). They are public and indexed: `/home/`, `/home-two/`, `/home-four/`, `/home-five/`, `/team-details/` (placeholder phone "+123 8989 444", "info@gmail.com"), `/typography/`, `/our-projects/`, 13 `/project/*` pages and 13 `/project-cat/*` archives. **Decision needed** (see §7).
2. **The blog is empty.** There are 0 posts and 0 comments. `/blog/` shows "Nothing Found". All 6 categories and 6 tags are theme samples with 0 posts.
3. **There is no SEO plugin.** No page has a meta description, Open Graph tags or structured data. Titles follow WordPress's default "Page – Bridge and Value" pattern. The sitemap is WordPress core's (`/wp-sitemap.xml`). There is little SEO metadata to carry over, so the main risk is URL continuity.
4. **219 of 221 images have no alt text** (44 of the 45 images on live pages have none).
5. **Broken or placeholder items on the live site** (flagged, not fixed):
   - The footer "Request our Brochure" form renders **empty** (its shortcode outputs nothing), so visitors can't request the brochure today.
   - The Contact page Google Map points to **London Eye, London**, but the address shown is Paris.
   - The footer Twitter icon links to `#`.
6. **Email is on Google Workspace** (MX → `SMTP.GOOGLE.com`). The MX records must be kept unchanged during the domain cutover.
7. **The front page is WordPress page 75 with slug `home-three`** (title "Bridge and Values"). `/home-three/` 301-redirects to `/`.

---

## 1. Website inventory

### 1.1 Live pages (to replicate)

| URL | WP ID | Source | Content summary |
|---|---|---|---|
| `/` | page 75 | Elementor | Hero "Unlocking Your door to opportunities"; B2B / B2G / G2G cards; "We are bridging cross border partnerships" (CEO Abiodun Odunuga; Paris + Abuja affiliate); partner-logo carousel; 7 service cards; "Register For Business Mission to Paris 2026" CTA; YouTube video popup |
| `/about-us/` | page 81 | Elementor | Mission statement; B2B/B2G/G2G; 7 services; process (Design → Structure → Consolidate → Execute); CTA "Ready to Elevate Your Global Presence?"; video popup |
| `/our-services/` | page 83 | Elementor | "OUR SERVICES / WHAT WE DO FOR YOU" with a 7-service grid |
| `/services/international-business-development/` | services 859 | Gerow CPT + Elementor | Service detail page: sidebar listing the other services, "Get A Free Quote" form, long-form copy |
| `/services/investment-linkages-and-fundraising/` | 858 | same | same |
| `/services/training-and-capacity-building/` | 857 | same | same |
| `/services/trade-missions-and-expeditions/` | 856 | same | same |
| `/services/market-research-and-intelligence/` | 855 | same | same |
| `/services/digital-services/` | 854 | same | same |
| `/services/diaspora-engagement/` | 853 | same | same |
| `/business-mission/` | page 2204 | Elementor (edited 2026-07-10) | "Business Mission to Paris 2026" landing page (~725 words) with an **embedded Google Form** for registration, plus the shared B2B/services/process sections |
| `/contact-us/` | page 91 | Elementor | Email `contact@bridgeandvalue.com`, address "66 Avenue des Champs Elysees, 75008, Paris", contact form, Google Map |
| `/blog/` | page 52 (posts page) | Theme archive | Empty: "Nothing Found", search box, Categories ("No categories"), "Most Popular" |

### 1.2 Global layout

- **Header** (Gerow theme header): logo (`2024/01/logo.svg`, 280 px wide via custom CSS), main menu, info bar with "Office Address" and "Email Address", search overlay (`?s=`). Menu items are **uppercase** (custom CSS).
- **Main menu** (`menu-main-menu`), flat with no sub-menus: About Us → `/about-us/` · Our Services → `/our-services/` · Register for BM Paris 2026 → `/business-mission/` · Blog → `/blog/` · Contact → `/contact-us/`
- **Footer** (Header Footer Elementor template; `footer-style-*` variants exist):
  - "Information" blurb and email
  - Quick Links: About us, Our Services, Our Blog, Contact us
  - "Request our Brochure" (empty form, "We'll never spam you!")
  - "Copyright © Bridge and Value | All Right Reserved"
  - LinkedIn link (`linkedin.com/company/bridge-and-value/`) and Twitter link (`#`)
- **Popups** (Elementor Pro):
  - #2245 opens on page load after **5 s** with a fadeIn animation, on all devices: "Register For Business Mission to Paris 2026 Now!" → `/business-mission/`
  - #2254 has the same content and is embedded through a shortcode
  - **[needs admin]** Display conditions (which pages, how often) aren't visible publicly.
- **Favicon:** `2024/01/cropped-FAVICON.png` (32/180/192/270 sizes)
- **Google Search Console verification meta tag** on every page: `OMDGm6o2idh3POa7LE0hnOmdlS_oFOVA5Apd-fMJ7o4` (**must keep**)

### 1.3 Design specification

| Token | Value | Source |
|---|---|---|
| Primary (green) | `#33b44b` | Customizer → `--tg-primary-color` |
| Secondary (near-black) | `#1e1e1e` | `--tg-secondary-color` |
| Blue accent | `#3c8bca` (also `#4fa4e7`, `#205f81` on the home page) | `--tg-blue`, post-75.css |
| Body/paragraph text | `#687799` | theme default |
| Heading colour (theme default) | `#00194C` | theme default |
| Border | `#E1E5EE` | theme default |
| Heading font | **Urbanist** 700 (primary 2rem, secondary 1rem/600) | Elementor kit (post-6) |
| Body font | **Poppins** 400 1rem; accent Poppins 500 italic | Elementor kit |
| Also loaded | Plus Jakarta Sans, Rubik (theme/Elementor defaults) | Google Fonts |
| Breakpoints | ≤767 px mobile, ≤1024 px tablet | Elementor CSS |
| Icons | Flaticon (theme set), Font Awesome 5, Elementor SVG icons | theme |

**Interactions in use on live pages:** Swiper image carousel (partner logos), Odometer counters, Jarallax parallax backgrounds, Magnific Popup (YouTube video), Elementor entrance animations, popup fadeIn, sticky header and search overlay (theme JS). The theme also loads GSAP/ScrollTrigger/SplitText, AOS, WOW, Isotope, Slick and particles; the rebuild will include only those the live pages actually use.

### 1.4 Forms

| Form | Where | Engine | Fields | Submission handling |
|---|---|---|---|---|
| Contact | `/contact-us/` | Elementor Pro Form | Name, **Email (required)**, Phone, Subject, Message → "Submit now" | **[needs admin]** recipient address, email template, and whether submissions are stored (Elementor → Submissions) |
| Get A Free Quote | all 7 service pages | Contact Form 7, form #1179 | **Your Name (required)**, **E-mail Address (required)**, Type Your Message → "Send Message" | **[needs admin]** CF7 mail tab (to/from/subject/body) |
| Brochure request | footer, every page | probably MC4WP (Mailchimp for WP) | renders nothing today | **[needs admin]** which form/list was intended; brochure PDF file |
| BM Paris 2026 registration | `/business-mission/` | Google Forms embed (`docs.google.com/forms/d/e/1FAIpQLSdVGMfCkKw…/viewform`) | external | Responses stay in Google; keep as an embed |
| Site search | header overlay, `/blog/` | WP search (`?s=`) | keyword | Rebuild as site search |

A Google reCAPTCHA script (`recaptcha/api.js?render=explicit`) loads on Contact. **[needs admin]** The site key and which form uses it.

### 1.5 SEO state (to preserve)

- Titles: `{Page title} – Bridge and Value`; the home page title is `Bridge and Value`.
- Canonical URLs: WordPress core self-canonicals with trailing slash.
- Meta robots: `max-image-preview:large` (WP default).
- Meta descriptions, Open Graph tags and JSON-LD: **none**.
- `robots.txt`: disallows `/wp-admin/` and points to `/wp-sitemap.xml`.
- Permalinks: `/%postname%/` with trailing slash; CPT bases `/services/`, `/project/`, `/project-cat/`.
- Existing 301s observed: `/home-three/` → `/`, `/sitemap.xml` → `/wp-sitemap.xml`, `/elementor-hf/*` → 301. **[needs admin]** any redirect plugin or `.htaccess` rules.

---

## 2. WordPress functionality inventory

**Stack:** WordPress 7.1.4 · PHP 8.1 · Hostinger (hcdn CDN) · theme **Gerow** (ThemeDox) + **gerow-core** companion plugin.

| Plugin / component | Evidence | What it does here | Rebuild approach |
|---|---|---|---|
| Elementor 4.3.5 | assets, generator tag | Page layouts for every live page | Typed React section components with content in the database |
| Elementor Pro | assets, `elementor-pro/v1` | Contact form, popups, theme builder | Native form, popup component, layout components |
| Header Footer Elementor 2.9.5 | `hfe` | Footer template | Footer component |
| Contact Form 7 6.1.6 | `contact-form-7/v1` | "Get A Free Quote" form | Native form + API route + email + database storage |
| gerow-core | plugin assets | CPTs `services` and `project`, taxonomy `project-cat`, `tg-*` widgets | Database models + components |
| Kirki | `kirki/v1` | Customizer (theme colours) | Site settings in admin |
| MC4WP (Mailchimp for WP) | `mc4wp/v1` | Likely the brochure signup | Mailchimp API call, or store the email and send the brochure by email |
| Wordfence + Login Security | `wordfence/v1` | Firewall and 2FA | Platform security, rate limiting, admin 2FA |
| Elementor AI / One / MCP Composer | namespaces | Editor tooling only | Not needed |
| NPS Survey | `nps-survey/v1` | Admin feedback prompt (bundled with HFE) | Not needed |
| WP core sitemap and search | `/wp-sitemap.xml` | Sitemap, search | `sitemap.ts`, search route |

**Content types**

| Type | Count |
|---|---|
| page | 13 public (front page = 75, posts page = 52) |
| services CPT | 7 |
| project CPT | 13 (demo) |
| project-cat taxonomy | 13 (demo) |
| post | 0 |
| category / tag | 6 / 6 (demo, empty) |
| Elementor library | popups 2245, 2254; footer templates |
| nav menu | 1 ("Main Menu") |
| Elementor Custom Code snippets | type exists; **[needs admin]** to see contents |

**Custom CSS (Customizer):**

```css
.logo img, .f-logo img, .fw-logo img { width: 280px; }
.navbar-wrap ul li a { text-transform: uppercase; }
```

**Not visible without admin access:** users and roles (REST returns 401), menu objects, form mail settings, stored form submissions, Elementor Custom Code, Wordfence settings, SMTP plugin (if any), drafts and private pages (the REST API reports 244 media items but only 221 are public), database tables.

---

## 3. Database & asset migration report

| Item | Status | Notes |
|---|---|---|
| Page content (13 pages) | ✅ Captured: REST JSON + rendered HTML + plain text | Elementor JSON (`_elementor_data`) needs a DB export to map sections exactly |
| Service CPT (7) | ✅ Rendered HTML + text | Not in REST; full fields need a DB export |
| Media originals | ✅ 221/221 downloaded (11.7 MB reported, 8.7 MB on disk) | 100 JPEG · 76 PNG · 29 WebP · 14 SVG · 1 PDF (`2023/08/Invoice.pdf`, likely a demo file) · 1 TXT. 45 used on live pages (2.5 MB). |
| Theme/plugin CSS & JS | ✅ Referenced, key files saved | Used as the visual reference, not copied into the new code |
| Media not in the public API (23) | ❌ needs admin | Probably attached to drafts or private items |
| Brochure PDF | ❌ not found anywhere | Needs to be supplied |
| Form submissions history | ❌ needs admin | Elementor Submissions export, plus Flamingo if installed |
| Users & roles | ❌ needs admin | |
| Redirects | ⚠️ partial | See §1.5 |

Large originals worth optimising during the rebuild (same filenames, served through Next/Image): `2026/07/Bridge-and-Value.png` (1.45 MB), `alex-knight-…-unsplash-scaled.jpg` (248 KB).

---

## 4. Integrations & dependencies

| Integration | Detail | Action at migration |
|---|---|---|
| Hostinger hosting | PHP 8.1, hcdn CDN | Keep WordPress running until sign-off |
| DNS | Hostinger nameservers (`ns1/ns2.dns-parking.com`) | Repoint only A/AAAA/CNAME; **keep MX and TXT records** |
| Google Workspace email | MX `SMTP.GOOGLE.com` | Unchanged. Use it as the SMTP sender (app password) or use Resend |
| Google Search Console | verification meta tag | Keep the tag; resubmit `/sitemap.xml` after launch |
| Google Forms | BM Paris 2026 registration | Keep the embed |
| Google Maps embed | Contact page (currently London Eye) | Keep the embed; confirm the location |
| Google reCAPTCHA | contact page script | Reuse the keys, or switch to Cloudflare Turnstile (your call) |
| YouTube | video `4YyqYNHZSeE` in popup | Keep |
| LinkedIn | company page link | Keep |
| Mailchimp (MC4WP) | brochure signup, probably | Needs API key and list ID, or a replacement |
| Google Fonts | Urbanist, Poppins (+ Plus Jakarta Sans, Rubik) | Self-host with `next/font` |
| Analytics | **none found** | Ask whether you want analytics added (not added by default) |

---

## 5. Proposed independent architecture

```
Next.js 15 (App Router, TypeScript) on Vercel
├─ app/(site)/…            public pages, statically generated + revalidated on publish
│   ├─ page.tsx, about-us/, our-services/, services/[slug]/, business-mission/,
│   │  contact-us/, blog/, blog/[slug]/ (ready for future posts), [slug]/ (generic CMS pages)
│   ├─ sitemap.ts, robots.ts   (+ /wp-sitemap.xml → /sitemap.xml 301)
├─ app/admin/…             admin dashboard (protected)
├─ app/api/…               form submission, media upload, revalidate
├─ middleware.ts           DB-driven redirects + admin auth guard
├─ components/sections/    Hero, PartnerCards (B2B/B2G/G2G), LogoCarousel, ServiceGrid,
│                          ServiceDetail, ProcessSteps, CtaBanner, VideoPopup, ContactBlock…
└─ lib/                    db (Drizzle/Prisma), auth, mail, storage, seo
Database: PostgreSQL (Neon via Vercel Marketplace)
Media:    Vercel Blob (or Cloudflare R2), keeping the original /wp-content/uploads/… paths via rewrite
Auth:     Auth.js credentials + argon2 hashing, roles (Admin / Editor / Author), optional TOTP 2FA
Email:    Nodemailer over Google Workspace SMTP, or Resend
Spam:     reCAPTCHA v3 or Turnstile + rate limiting + honeypot
```

**Why section components instead of an Elementor clone:** each live page is a fixed stack of about 5–10 known section types. Modelling pages as an ordered list of typed sections (with editable text, images, links and buttons per section) lets editors change any content in the admin and reorder or add sections, while the pixel styling stays faithful to the original. A free-form drag-and-drop builder would add a lot of complexity without giving visitors anything new.

**Admin modules (Phase 5):**

- Dashboard
- Pages (section editor + SEO panel)
- Services
- Blog posts, categories and tags
- Media library (upload, alt text)
- Menus
- Forms
- Submissions / enquiries (inbox, status, CSV export)
- Popups
- Users and roles
- SEO defaults
- Redirects
- Site settings (logo, colours, contact details, socials, footer, verification tags)
- Audit log

**URL preservation:**

- Every live URL keeps the same path and trailing slash (`trailingSlash: true`).
- `/wp-content/uploads/*` URLs keep resolving.
- `/feed/` and `/?s=` are handled.
- `/wp-admin`, `/wp-login.php` → 301 to `/admin`.

---

## 6. Migration implementation plan

| # | Stage | Output | Gate |
|---|---|---|---|
| 0 | **Access & backup** | Full WP backup (DB `.sql` + `wp-content`) and WXR export from you; read-only review | Backup received |
| 1 | Backend extraction | Elementor JSON per page, form and mail settings, menus, users, redirects, Custom Code, the 23 hidden media items; this report updated | Inventory complete |
| 2 | Decisions | Your answers to §7 | Approved |
| 3 | Scaffold | Next.js + DB schema + auth + storage + CI on GitHub → Vercel preview | Preview URL live |
| 4 | Public site | Header/footer/popups + 13 live pages, pixel-compared against the original at 1440 / 1024 / 768 / 375 px | Visual sign-off |
| 5 | Forms & email | Contact, Quote, Brochure: DB storage + email + spam protection | Test submissions arrive |
| 6 | Admin | Modules above; editing revalidates the public page | Editor walkthrough |
| 7 | Data import | Scripted import of pages, services, media (alt text), menus, settings; historic submissions if exported | Counts reconcile |
| 8 | SEO | Titles, canonicals, sitemap, robots, redirect map, verification tag, 404 page | Crawl diff = 0 broken |
| 9 | QA | Link crawl, Lighthouse (perf/a11y/SEO), security headers, auth tests, console errors, cross-device check | QA report |
| 10 | Cutover | Lower DNS TTL → switch A/CNAME to Vercel (MX untouched) → SSL → GSC sitemap → monitor 404s for 2–4 weeks; WordPress stays on Hostinger as fallback | Your go-ahead |

---

## 7. Decisions needed from you

1. ✅ **Decided 2026-11-09: the theme demo pages are rebuilt exactly as they are.** That covers 33 pages, at the same URLs and with the same content:
   - `/home/`, `/home-two/`, `/home-four/`, `/home-five/`
   - `/team-details/`, `/typography/`, `/our-projects/`
   - 13 `/project/*` pages
   - 13 `/project-cat/*` archives

   They stay in the sitemap. This adds the `project` content type and the `project-cat` taxonomy to the database and admin. The 3 `/elementor-hf/*` template URLs already 301 to `/` on the live site, so they keep that redirect. `redirects.json` now holds only redirects that exist today.
2. **Known defects** (empty brochure form, London map, Twitter `#`, missing alt text): replicate exactly as they are, or fix during the rebuild? I won't change them without your approval.
3. **Blog:** keep the empty `/blog/` page as it is, with blog management in the admin for future posts?
4. **Brochure:** which PDF, and should signups go to Mailchimp?
5. **Stack choices:** OK with Vercel + Neon Postgres + Vercel Blob? Google Workspace SMTP or Resend for email?

## 8. Credentials, permissions & information still required

I can't sign in to WordPress or other services myself. Please provide the outputs below rather than passwords where possible.

- [ ] **Full backup:** database SQL dump + `wp-content` zip (Hostinger hPanel → Backups, or UpdraftPlus / All-in-One WP Migration export)
- [ ] **WXR export:** WP Admin → Tools → Export → All content
- [ ] **Screenshots or exports from WP Admin** (or a read-only session you drive while I guide you):
  - Elementor form actions
  - CF7 mail tab for form #1179
  - Popup display conditions
  - Elementor → Submissions (CSV)
  - Users list with roles
  - Plugins list
  - Elementor → Custom Code
  - Settings → Permalinks
- [ ] Mailchimp API key and audience ID (if the brochure goes to Mailchimp), plus the **brochure PDF**
- [ ] reCAPTCHA site/secret keys (or approval to use Turnstile)
- [ ] Google Search Console access (to verify, submit the sitemap and monitor)
- [ ] DNS access at Hostinger (only at cutover)
- [ ] GitHub repo access (`blueinctech-developer/bridgeandvalue`, empty today) and a Vercel team/project
- [ ] Email sending account (Google Workspace app password or Resend API key) and the recipient address for enquiries
- [ ] Correct map location, Twitter/X URL (if any), and any analytics you want

---

## 9. WordPress backend findings (read-only admin review, 2026-11-11)

Reviewed while signed in as an administrator. Nothing was changed, activated, deactivated or saved.

### 9.1 ⚠️ Security: signs of compromise (urgent, separate from the migration)

| Finding | Why it matters |
|---|---|
| Plugins **`knbsizwonx`** and **`nccxemfmxb`** (author "Carlos Sebastian", v2.12.1, inactive). Their description is just their own name, and their wordpress.org links don't exist. Their folders exist on the server (HTTP 403, versus 404 for a missing folder). | Randomly named fake plugins are a common backdoor pattern. Their code can still be run directly even while inactive. |
| Theme **`whyaqouyvo`** posing as "Twenty Fifteen", with no author or description | Same pattern |
| **Wordfence** and **Contact Form 7** were active on 2026-11-09 and are inactive on 2026-11-11 | Security plugin switched off. CF7 being off has **broken the live quote forms**: service pages now show the raw text `[contact-form-7 id="540abab" title="Get A Free Quote"]`. |
| Two `hostinger-auto-updates-plugin-<random>` copies and **MainWP Child** (inactive) | Probably legitimate (Hostinger/MainWP), but confirm that you installed them |
| Last UpdraftPlus backup: **Feb 1, 2024** | No recent clean backup to restore from |
| User accounts: only `blueinchost` and `DevAdmin` (both administrators) | ✅ No unknown admin accounts |
| Inserted head code (ASE) contains only the Google verification tag; the one custom CSS file is clean | ✅ Nothing injected there |

**Recommended (your call, not done):**
1. Take a full backup now (Hostinger hPanel).
2. Have Hostinger or a security service scan and remove `knbsizwonx`, `nccxemfmxb` and `whyaqouyvo`.
3. Change the WordPress, Hostinger, FTP/SFTP and database passwords, and the WordPress salts.
4. Re-enable Wordfence and run a scan.
5. Find out who deactivated Wordfence and CF7, and when.

The new site doesn't reuse any WordPress code or scripts, so these files can't carry over into it.

### 9.2 Plugins (21 installed)

| Plugin | Status | Used for | In the new site |
|---|---|---|---|
| Elementor 4.4.0 + Elementor Pro 4.4.0 | active | All page layouts, contact form, popups, loop items | Section components, form API, popup |
| Gerow theme 1.1 + Gerow Core 1.1 | active | Theme, `services`/`project` CPTs, `tg-*` widgets | Components + DB models |
| Ultimate Addons for Elementor (Header Footer Elementor) 2.9.7 | active | Footer template | Footer component |
| Kirki 6.4.2 | active | Theme colours | Site settings |
| Admin and Site Enhancements (ASE) 9.3.2 | active | **SMTP (Amazon SES, us-east-1, port 587, From `contact@bridgeandvalue.com` / "Bridge and Value", force-from on)**, head-code insertion (GSC tag), **feeds disabled**, **author slugs obfuscated** (explains `/author/<hash>/`), XML-RPC disabled, SVG uploads, revisions control, admin UI tweaks | Email via SES or another provider; no feeds (matches); author URL replicated |
| Simple Custom CSS and JS 3.55 | active | One CSS file (header line + bold 18px menu), already in the replica | Global CSS |
| MC4WP: Mailchimp for WordPress 4.15.0 | active | **No API key: never connected.** That is why the footer brochure form is empty. | Needs a decision (see §7.4) |
| Advanced Custom Fields 6.8.11 | active | `_acf_changed` meta only; no field groups observed in use yet | Check in the DB export |
| Breadcrumb NavXT 7.5.2 | active | Page-header breadcrumbs | Breadcrumb component |
| Classic Editor 1.7.0 | active | Editor preference | n/a |
| ElementsKit Pro 4.10.6 | active | Its required Lite plugin is **not installed**, so it does nothing | n/a |
| UpdraftPlus 1.26.14 | active | Backups (last one Feb 2024) | Platform backups |
| Contact Form 7 6.1.6 | **inactive** | "Get A Free Quote" form (id `540abab`) on the 7 service pages | Form API (working in the replica) |
| Wordfence 9.1.1 | **inactive** | Security | Platform security |
| ASE Pro, Hostinger auto-updates ×2, MainWP Child | inactive | none | n/a |
| `knbsizwonx`, `nccxemfmxb` | inactive | **suspicious**, see 9.1 | **Not migrated** |

Themes installed: Gerow (active), Seargin (unused business theme), `whyaqouyvo` (suspicious).

### 9.3 Forms

- **Contact form** (Elementor, page 91, element `dee940b`):
  - Sends to `contact@bridgeandvalue.com`.
  - Subject: `New message from [name]`. Body: all fields.
  - The **From address is set to the visitor's email**. Through SES this fails unless "force from" overrides it, and that may explain failed sends.
  - Fields: Name, Email (required), Phone, Subject, Message, **reCAPTCHA v3**.
  - Messages:

    | Case | Message |
    |---|---|
    | Success | "Your submission was successful." |
    | Error | "Your submission failed because of an error." |
    | Required field | "This field is required." |
    | Invalid form | "Your submission failed because the form is invalid." |

    The replica uses these same texts.
- **Saved submissions:** 37 (2024-02-07 → 2026-10-28). 13 are from "Contact Form" and 24 from "New Form" (an earlier version), both on Contact Us. **9 of 37 email notifications failed**, and all 37 are still marked "new". They can be exported into the new admin (they contain personal data, so they were not copied during this review).
- **Get A Free Quote** (CF7 `540abab`): its mail settings couldn't be read because CF7 is deactivated. They're in the database export.

### 9.4 Popups, templates, menus, permalinks, redirects

- Popup **2245 "BM Paris 2026"**: display condition **front page only**; page-load trigger after 5 s. This matches the replica.
- Popup 2254 is a duplicate, embedded by shortcode in the footer.
- Elementor library also holds: header draft #1874, "Services Detailed" #1714, "Page Hero" #1711, loop item #1297, "home layout" #1279, and kits #6 (active) and #871.
- Main Menu (id 38, location `main-menu`), 5 items, flat: matches the replica.
- Permalinks `/%postname%/`. No redirect plugin or redirect rules, so `redirects.json` is complete for WordPress-level redirects.
- Site email (admin) is a Blueinc Gmail address. Site logo is attachment 1204; site icon is attachment 1211.
