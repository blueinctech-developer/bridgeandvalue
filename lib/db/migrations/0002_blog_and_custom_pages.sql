-- Blog posts, categories/tags, and pages created in the new admin.

CREATE TABLE posts (
  id               serial PRIMARY KEY,
  slug             text NOT NULL UNIQUE,         -- URL is /<slug>/ (WordPress /%postname%/ permalinks)
  title            text NOT NULL,
  excerpt          text NOT NULL DEFAULT '',
  content_html     text NOT NULL DEFAULT '',
  featured_image   text,                          -- media path
  featured_alt     text NOT NULL DEFAULT '',
  status           text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  published_at     timestamptz,                   -- future date + published = scheduled
  author_id        integer REFERENCES users(id) ON DELETE SET NULL,
  meta_title       text,
  meta_description text,
  noindex          boolean NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  updated_by       integer REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX posts_published ON posts (status, published_at DESC);

CREATE TABLE terms (
  id          serial PRIMARY KEY,
  taxonomy    text NOT NULL CHECK (taxonomy IN ('category', 'tag')),
  name        text NOT NULL,
  slug        text NOT NULL,
  description text NOT NULL DEFAULT '',
  wp_id       integer,
  UNIQUE (taxonomy, slug)
);

CREATE TABLE post_terms (
  post_id integer NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  term_id integer NOT NULL REFERENCES terms(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, term_id)
);

-- The categories and tags that existed in WordPress (all empty there).
INSERT INTO terms (taxonomy, name, slug, wp_id) VALUES
  ('category', 'Blog', 'blog', 1), ('category', 'Business', 'business', 2), ('category', 'Coding', 'coding', 3),
  ('category', 'Consulting', 'consulting', 4), ('category', 'Design', 'design', 5), ('category', 'Development', 'development', 6),
  ('tag', 'Agency', 'agency', 7), ('tag', 'Career', 'career', 8), ('tag', 'Consultancy', 'consultancy', 9),
  ('tag', 'Data', 'data', 10), ('tag', 'Design', 'design', 11), ('tag', 'Finance', 'finance', 12);

-- Pages created in the admin (kind = 'custom') store their content here;
-- migrated pages keep using `html` + blocks.
ALTER TABLE pages ADD COLUMN content_html text;
ALTER TABLE pages ADD COLUMN hero_image text;
