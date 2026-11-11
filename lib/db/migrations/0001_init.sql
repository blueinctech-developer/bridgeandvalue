-- Bridge & Value CMS schema (PostgreSQL). Applied in order by lib/db/migrate.mjs.

CREATE TABLE users (
  id            serial PRIMARY KEY,
  email         text NOT NULL UNIQUE,
  name          text NOT NULL,
  role          text NOT NULL CHECK (role IN ('admin', 'editor')),
  password_hash text NOT NULL,
  active        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz
);

CREATE TABLE sessions (
  id         text PRIMARY KEY,               -- sha256 of the cookie token
  user_id    integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- One row per public URL. `html` is the migrated markup (never edited directly);
-- editable content lives in `blocks` and is applied at render time.
CREATE TABLE pages (
  id               serial PRIMARY KEY,
  path             text NOT NULL UNIQUE,      -- e.g. /about-us/
  slug             text NOT NULL,
  kind             text NOT NULL,              -- page | service | project | project-cat | author | system
  status           text NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'draft')),
  title            text NOT NULL,              -- <title>
  meta_description text,
  canonical        text,
  robots           text,
  in_sitemap       boolean NOT NULL DEFAULT true,
  body_class       text NOT NULL DEFAULT '',
  stylesheets      jsonb NOT NULL DEFAULT '[]',
  inline_styles    text NOT NULL DEFAULT '',
  sliders          jsonb NOT NULL DEFAULT '[]',
  html             text NOT NULL,
  wp_id            integer,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  updated_by       integer REFERENCES users(id) ON DELETE SET NULL
);

-- Editable content blocks (Elementor widgets). page_id NULL = global (footer).
CREATE TABLE blocks (
  id          serial PRIMARY KEY,
  page_id     integer REFERENCES pages(id) ON DELETE CASCADE,
  element_id  text NOT NULL,
  widget_type text NOT NULL,
  position    integer NOT NULL,
  label       text NOT NULL,
  original    jsonb NOT NULL,                  -- fields as migrated
  content     jsonb,                           -- edited fields (NULL = unchanged)
  updated_at  timestamptz,
  updated_by  integer REFERENCES users(id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX blocks_page_element ON blocks (COALESCE(page_id, 0), element_id);

CREATE TABLE media (
  id         serial PRIMARY KEY,
  path       text NOT NULL UNIQUE,             -- /wp-content/uploads/2024/01/logo.svg or /uploads/...
  mime_type  text NOT NULL,
  width      integer,
  height     integer,
  filesize   integer,
  title      text NOT NULL DEFAULT '',
  alt_text   text NOT NULL DEFAULT '',
  caption    text NOT NULL DEFAULT '',
  source     text NOT NULL DEFAULT 'wordpress' CHECK (source IN ('wordpress', 'upload')),
  wp_id      integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE menu_items (
  id       serial PRIMARY KEY,
  menu     text NOT NULL DEFAULT 'main',
  label    text NOT NULL,
  url      text NOT NULL,
  position integer NOT NULL,
  new_tab  boolean NOT NULL DEFAULT false
);

CREATE TABLE redirects (
  id          serial PRIMARY KEY,
  source      text NOT NULL UNIQUE,            -- path, with trailing slash
  destination text NOT NULL,
  status_code integer NOT NULL DEFAULT 301 CHECK (status_code IN (301, 302, 307, 308)),
  note        text NOT NULL DEFAULT '',
  hits        integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE submissions (
  id          serial PRIMARY KEY,
  form        text NOT NULL,                   -- contact | quote | legacy form name
  page        text NOT NULL DEFAULT '',
  fields      jsonb NOT NULL,
  status      text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'read', 'archived')),
  email_sent  boolean,
  legacy_id   integer UNIQUE,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX submissions_created ON submissions (created_at DESC);

CREATE TABLE settings (
  key   text PRIMARY KEY,
  value jsonb NOT NULL
);

CREATE TABLE activity (
  id         serial PRIMARY KEY,
  user_id    integer REFERENCES users(id) ON DELETE SET NULL,
  action     text NOT NULL,
  entity     text NOT NULL,
  entity_id  text,
  detail     jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX activity_created ON activity (created_at DESC);
