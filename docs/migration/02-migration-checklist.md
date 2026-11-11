# Migration Checklist

Legend: [x] done · [ ] to do · (A) blocked on admin access/backup · (D) blocked on your decision

## Phase 1 — Public audit
- [x] Sitemap and URL structure (49 URLs) → `url-inventory.tsv`
- [x] Page layouts and sections for the live pages
- [x] Typography, colours, breakpoints
- [x] Header, footer, menu, popups
- [x] Forms and fields
- [x] SEO metadata and canonicals, robots.txt
- [x] External integrations, hosting, DNS/MX
- [ ] Visual capture at 1440/1024/768/375 px for pixel comparison

## Phase 2 — Backend extraction
- [ ] (A) DB dump + wp-content backup received (still useful: CF7 mail settings, ACF field groups)
- [x] Elementor JSON for all pages, services, projects, footers, popups, kit (2026-11-11) → `content/wordpress-export/`
- [x] Elementor contact-form mail settings (report §9.3)
- [ ] (A) CF7 "Get A Free Quote" mail settings (plugin deactivated; needs DB export)
- [x] Popup display conditions (front page only)
- [x] Users and roles (2 administrators)
- [x] Redirects: no redirect plugin or rules
- [x] Custom code (Simple Custom CSS & JS, ASE head code), SMTP (ASE → Amazon SES)
- [x] All 244 media items listed; the 23 non-public ones downloaded
- [x] 37 historic contact submissions → `data/legacy/form-submissions.json` (git-ignored, personal data)
- [ ] ⚠️ Security cleanup of the live WordPress site (report §9.1), owner action

## Phase 3 — Assets
- [x] 221 public media originals downloaded, paths preserved
- [x] Media inventory with alt text and usage
- [ ] (A) Brochure PDF
- [ ] Self-hosted fonts (Urbanist, Poppins)

## Phase 4–5 — Build
- [ ] (D) Decisions in report §7
- [x] Scaffold Next.js 15 + TypeScript (2026-11-09)
- [x] Database (PostgreSQL schema; PGlite locally) + import script (2026-11-11)
- [x] Auth: sessions, roles admin/editor, throttled sign-in (2026-11-11)
- [x] Admin: dashboard, pages/services block editor + SEO, footer, enquiries (+CSV), media (+upload, alt text), menu, SEO overview, redirects, users, settings, activity log, account (2026-11-11; tested, see README)
- [ ] Production DB (Neon) + object storage + CI
- [ ] Email notifications for enquiries
- [x] Blog (posts, scheduling, categories/tags, archives), new pages, site search (2026-11-11; tested, see README)
- [ ] Admin 2FA
- [x] Milestone 1 replica: all 47 public URLs + 404 rendered from migrated markup, local assets, no WordPress JS (2026-11-09; see README "Verified")
- [x] Live pages editable: every Elementor widget is an editable block (text, links, images, rich text), applied to the original markup
- [x] Public pages ×13 + header/footer/popup
- [x] Theme demo pages ×33 rendered and editable (as pages in the admin)
- [x] Forms: validation + spam throttling + inbox (email delivery still open, see above)
- [x] Data import script (`npm run db:import`)

## Phase 6 — SEO
- [ ] Same URLs + trailing slashes
- [ ] Titles and canonicals identical
- [ ] Sitemap, robots, GSC verification tag
- [x] Redirect map of existing redirects (`/home-three/`, `/elementor-hf/*`, `/wp-sitemap.xml`) → `redirects.json`
- [ ] Add `/wp-admin` and `/wp-login.php` redirects, plus any redirects found in the WP backup
- [ ] Sitemap includes all 46 public URLs (13 live + 33 theme demo; decision 2026-11-09: rebuild demo pages)

## Phase 7 — QA
- [ ] Link crawl, forms, media, responsive, a11y, performance, security, admin

## Phase 8 — Cutover
- [ ] Vercel env vars, domain, SSL, backups
- [ ] DNS switch (MX untouched), GSC resubmit, 404 monitoring
- [ ] WordPress kept live until sign-off
