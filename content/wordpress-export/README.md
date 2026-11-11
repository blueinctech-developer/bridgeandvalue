# WordPress export (2026-11-11)

Read-only export from the bridgeandvalue.com admin, made with an administrator session. Nothing in WordPress was changed. These files are the source material for turning the migrated pages into editable sections in the new admin.

| File | Contents |
|---|---|
| `pages-templates.json` | All 15 pages: published, plus 2 empty drafts (ids 3, 1173). Includes status, template, dates and full meta, including **`_elementor_data`** (the layout tree) and page settings for the 12 Elementor pages. Also the 9 Elementor library items: popups 2245/2254 with display conditions, header draft, "Services Detailed", "Page Hero", loop item, "home layout", and kits 6/871. |
| `services-projects-footers.json` | The 7 services, 13 projects and 3 footer templates (`elementor-hf`), each with its Elementor element tree and document settings (title, slug, excerpt, featured image), plus the 13 `project-cat` terms |
| `site-media-menus.json` | Elementor kit #6 settings (global colours, typography, buttons, forms, breakpoints), the Main Menu and its 5 items, site settings, and categories/tags. Private email addresses and the WordPress admin usernames were removed before committing. *Its `media` array is empty; use `media.json`.* |
| `media.json` | All **244** media items: title, alt text, caption, description, dimensions, file size, parent post and every generated size URL. This includes the 23 items not visible publicly, now also downloaded into `public/wp-content/uploads/`. |

Form submissions (37 contact enquiries, with names, emails and messages) are in `data/legacy/form-submissions.json`. That file is **git-ignored on purpose** because it holds personal data. It's to be imported into the new admin's enquiries inbox.

## Elementor global colours (kit #6)

| Name | Value |
|---|---|
| Primary | `#3C8BCA` |
| Secondary | `#33B44B` |
| Text | `#121212` |
| Accent | `#5CC46F` |

The theme itself uses `#33b44b` as its primary colour (Customizer), so the green and blue swap roles between the theme and Elementor.
