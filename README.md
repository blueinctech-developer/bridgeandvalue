# Bridge & Value: independent website and admin

This is a Next.js 15 + TypeScript + PostgreSQL rebuild of https://bridgeandvalue.com, with its own admin dashboard and no WordPress. The live WordPress site is untouched.

## Run it locally

```bash
npm install
npm run db:import      # loads pages, media, menu, redirects and enquiries into the database
npm run admin:create   # creates the first administrator from ADMIN_EMAIL / ADMIN_PASSWORD in .env.local
npm run build
npm start              # website on http://localhost:3000, admin at /admin/
```

`.env.local` is git-ignored. Example:

```
ADMIN_EMAIL=you@example.com
ADMIN_NAME=Your Name
ADMIN_PASSWORD=at-least-12-characters
```

The local database is an embedded PostgreSQL (PGlite) in `.data/pglite`, and admin uploads go to `.data/uploads`. Both are git-ignored. Stop the server before running the `db:*` / `admin:*` scripts, because only one process can open the local database at a time (for the same reason the build pre-renders with a single worker).

## How it fits together

| Piece | Where | Notes |
|---|---|---|
| Database schema | `lib/db/migrations/*.sql` | Plain PostgreSQL, applied automatically. Tables: pages, blocks, media, menu_items, redirects, submissions, users, sessions, settings, activity. |
| Public pages | `app/[[...slug]]/page.tsx`, `lib/cms.ts` | Read from the database. Each page is the migrated markup with admin edits applied. Pages are pre-rendered and re-rendered automatically when edited. |
| Blog, archives, search, new pages | `lib/blog.ts`, `lib/routes.ts`, `app/search/` | Built from the Gerow theme's own blog markup and CSS (no WordPress original exists) inside the real site header/footer. Posts live at /post-name/ like WordPress. /blog/ shows the original WordPress page until the first post is published. |
| Content blocks | `lib/blocks.mjs` | Every Elementor widget is an editable block (texts, links, images, or rich text). Edits are **spliced into the original HTML**, so unedited pages are byte-for-byte identical to the migration and edited ones keep the exact design. |
| Admin | `app/admin/` | Server-rendered, with server actions in `app/admin/(panel)/actions.ts`. Every action checks the session and role, and is written to the activity log. |
| Auth | `lib/auth.ts`, `lib/password.mjs`, `middleware.ts` | scrypt password hashes; random session tokens stored hashed in the database; httpOnly SameSite cookie (Secure in production); 12-hour sessions; 5 failed sign-ins per 15 min lock that email+IP; roles `admin` / `editor`. |
| Redirects | `middleware.ts` + `/api/redirects/` | Managed in the admin; 301/302; picked up within 30 s. |
| Forms | `app/api/forms/route.ts` | Contact + Get A Free Quote → database → admin inbox. Server-side validation, honeypot, 10 submissions per IP per 10 min. |
| Styles, fonts, migrated media | `public/wp-content/...` | Same paths and filenames as WordPress, so existing image URLs keep working. |
| WordPress export | `content/wordpress-export/` | Elementor layouts, media list, menu and settings (see its README). Enquiries with personal data are in `data/legacy/` (git-ignored). |

## Admin features

| Area | What you can do | Who |
|---|---|---|
| Dashboard | New enquiries, content and SEO counts, latest enquiries, recent activity | All |
| Pages & services | Edit every page's text, links, images (with alt text) and rich text; title, meta description, canonical, noindex, sitemap inclusion, draft/published; restore any block to the original | All |
| Blog posts | Write posts in a visual editor (headings, bold/italic, lists, quotes, links, images from Media, HTML view; pasted Word/Google Docs formatting is cleaned). Featured image + alt text, excerpt, categories and tags, SEO title/description, noindex. Save draft, publish, schedule for a future date (Paris time), unpublish, private preview | All (delete: admin) |
| Categories & tags | Add, rename and delete. The 6 WordPress categories and 6 tags are kept, each with an archive at /category/… or /tag/… | All |
| New pages | Create pages at /your-address/ with the theme's title banner (optional background image) and rich content; draft/publish/preview; renaming a live page adds a 301 automatically | All (delete: admin) |
| Footer | Edit the shared footer once for the whole site | All |
| Enquiries | Inbox with New/Read/Archived, search, filter by form, detail view, reply by email, CSV export | All (delete: admin) |
| Media | All 244 migrated files plus uploads (JPG/PNG/WebP/GIF/PDF, 10 MB); alt text applied site-wide to images that have none | All (delete uploads: admin) |
| Menu | Edit, add, remove and reorder the main navigation (desktop and mobile) | All |
| SEO overview | Title, description and indexing checks for every URL; links to sitemap.xml and robots.txt | All |
| Redirects | Add and delete 301/302 redirects (refuses to hide a published page) | All |
| Users | Add administrators and editors, change roles, deactivate, reset passwords (can't lock out the last admin) | Admin |
| Settings | Site name, contact details, home-page pop-up on/off and delay, enquiry recipient, Google verification code | Admin |
| Activity log | Who changed what, and when | Admin |
| Your account | Change your own password | All |

## Verified on 2026-11-11 (local build)

- **Public site:**
  - 48 pages render from the database.
  - 472 internal links and assets were checked, and none are broken.
  - The sitemap lists 46 URLs, and the existing 301s (`/home-three/`, `/wp-sitemap.xml`, `/elementor-hf/*`) work.
- **Layout:** unedited pages are identical to the migrated markup. Element by element, they match the live site for anonymous visitors.
- **Sign-in:**
  - Wrong password → error.
  - Correct password → dashboard.
  - A forged session cookie or a signed-out browser → login page.
  - CSV export without a session is refused.
- **Edits update the public site immediately:**
  - Home headline edit → visible on `/`, then "Restore original" → back to the original text.
  - Meta description → appears in `<head>`.
  - Menu item → appears in the navigation, with the current page marked.
  - Media alt text → applied to the image on the page.
  - Pop-up off/on → reflected on the home page.
- **Uploads:**
  - A PNG upload is served at `/uploads/...`.
  - An HTML file is rejected.
  - A deleted upload returns 404.
- **Redirects:** a new redirect gives a 301 within 30 s. Redirecting a live page is refused.
- **Enquiries:**
  - A test quote submission arrives as "new" and becomes "read" when opened.
  - The CSV export neutralises spreadsheet formulas.
  - Deleting an enquiry works.
- **Users and roles:**
  - A weak password is refused.
  - A test editor can edit content but is refused Users and Settings, and doesn't see them in the menu.
  - An admin can't remove their own admin rights.
  - Deactivating a user works.
- **Phone width:** the admin has no sideways scroll at 375 px.

All test data was removed afterwards. The database is back to the imported state (no edits, 37 enquiries, 5 menu items).

## Verified on 2026-11-11: blog and new pages

- **Writing a post:** typed with the editor toolbar (heading and paragraph), featured image chosen with the media picker and given alt text, category ticked, published.
  - The post renders in the site's blog design with the menu on Blog.
  - It shows on /blog/, /category/business/, in the sidebar, in search and in sitemap.xml.
  - It has its canonical URL, meta description, social-sharing tags and Article structured data.
- **Unpublishing and scheduling:**
  - Unpublish → 404, and /blog/ reverts to the original page.
  - A date in 2027 → shown as Scheduled, hidden publicly, previewable when signed in, and the time stays 09:00 Paris time.
- **New pages:**
  - Reserved or taken addresses (/blog/, /about-us/) are refused.
  - A draft returns 404 publicly; preview needs sign-in.
  - Publishing shows the theme title banner with breadcrumb.
  - A script tag and a `javascript:` link in the content were stripped.
  - Renaming the live page made the old address 301 to the new one.
- **Categories:** created with an automatic slug, archive page live, and deleted again. Empty archives are marked noindex.
- **Search:** `/?s=…` (the theme's search boxes) finds pages by their own content and posts. Text that only appears in the footer no longer matches every page.
- **Deletes:** every delete button needs two clicks.
- **Cleanup:** test content was removed afterwards. Regression checks: 472 links and assets OK, sitemap 46 URLs, /blog/ identical to WordPress.

## Deploying to Vercel

The live WordPress site stays untouched. Deployments are **noindex** (header + robots.txt) until `ALLOW_INDEXING=true` is set at domain cutover.

1. **GitHub:** keep this repository **private**. It contains the commercial Gerow theme and Elementor Pro stylesheets (their licences don't allow public redistribution) and the migration audit, which describes security problems on the live WordPress site.
2. **Vercel → Add New → Project:** import `blueinctech-developer/bridgeandvalue`. The defaults are fine (framework Next.js, `npm run build`).
3. **Vercel → project → Storage:**
   - **Create a Neon Postgres database** and connect it to the project. This sets `DATABASE_URL`.
   - **Create a Blob store** and connect it. This sets `BLOB_READ_WRITE_TOKEN`.
4. **Load the content into the hosted database** (from this computer):
   - Copy the database's `DATABASE_URL` into a new file `.env.prod.local` (git-ignored; Next.js doesn't read it).
   - Run `npm run db:import:prod`. This creates the tables and imports the pages, media list, menu, redirects and the 37 enquiries (from `data/legacy`, which stays on this computer).
5. **Create your administrator account:**
   - Add `ADMIN_EMAIL`, `ADMIN_NAME` and a strong `ADMIN_PASSWORD` (12+ characters) to `.env.prod.local`.
   - Run `npm run admin:create:prod`, then remove the password line from the file.
6. **Vercel → Deployments → Redeploy,** so the pre-rendered pages are built from the imported content.
7. **Domain cutover (later, after sign-off):**
   - Add `bridgeandvalue.com` in Vercel and set `ALLOW_INDEXING=true`.
   - At Hostinger, change only the A/CNAME records (**keep the MX records for Google Workspace email**).
   - Resubmit `sitemap.xml` in Google Search Console.

Status 2026-11-16: deployed as Vercel project **bridgeandvalue-zchh** (https://bridgeandvalue-zchh.vercel.app) with Neon Postgres (Frankfurt). The content is imported and the admin account created. Live check: 472 links/assets OK, sitemap 46 URLs, 301s, canonicals, the Google verification tag, form validation and search all work, and the site is noindex until cutover.

Notes:
- On the Hobby plan, Vercel only deploys commits authored by the project owner. This repository is configured to commit as `blueinctech-developer`.
- Sign-in and form rate limits are per server instance.
- Scheduled posts appear within an hour of their publish time.

## Not done yet

- **Email notifications** for new enquiries. This needs an email account (WordPress used Amazon SES).

- **Blog comments** (the WordPress blog had none) and RSS feeds (disabled on the WordPress site).
- **Two-factor sign-in** for administrators.
- **Domain cutover** to bridgeandvalue.com (see step 7 of "Deploying to Vercel").
