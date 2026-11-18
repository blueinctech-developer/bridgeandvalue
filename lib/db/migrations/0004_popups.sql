-- Pop-ups managed in Admin → Pop-ups.
-- kind 'elementor': a pop-up migrated from WordPress, kept in its page's markup with its exact
--   design (its text and image are edited as blocks of that page); only on/off, delay, schedule
--   and frequency are managed here. The Business Mission to Paris pop-up (Elementor 2245, home page).
-- kind 'custom': created in the admin (heading, text, image, button), shown on the pages chosen.
CREATE TABLE popups (
  id             serial PRIMARY KEY,
  kind           text NOT NULL DEFAULT 'custom' CHECK (kind IN ('custom', 'elementor')),
  name           text NOT NULL,                       -- shown in the admin only
  elementor_id   text,                                -- kind 'elementor': data-elementor-id in the page markup
  heading        text NOT NULL DEFAULT '',
  body_html      text NOT NULL DEFAULT '',
  image          text,                                -- media path or https address
  image_alt      text NOT NULL DEFAULT '',
  button_text    text NOT NULL DEFAULT '',
  button_url     text NOT NULL DEFAULT '',
  target         text NOT NULL DEFAULT 'home' CHECK (target IN ('all', 'home', 'pages')),
  paths          text[] NOT NULL DEFAULT '{}',        -- target 'pages': /about-us/ …
  delay_seconds  integer NOT NULL DEFAULT 5 CHECK (delay_seconds BETWEEN 0 AND 120),
  frequency      text NOT NULL DEFAULT 'always' CHECK (frequency IN ('always', 'session', 'day', 'once')),
  starts_at      timestamptz,
  ends_at        timestamptz,
  enabled        boolean NOT NULL DEFAULT true,
  position       integer NOT NULL DEFAULT 0,          -- lower shows first when several match a page
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- The existing pop-up, with the on/off and delay from Settings (as WordPress had it: home page,
-- on every visit). Settings → "Show the pop-up" no longer exists; this row replaces it.
INSERT INTO popups (kind, name, elementor_id, target, delay_seconds, frequency, enabled, position)
VALUES (
  'elementor',
  'Register for Business Mission to Paris 2026',
  '2245',
  'home',
  COALESCE((SELECT LEAST(120, GREATEST(0, (value->>'delaySeconds')::int)) FROM settings WHERE key = 'popup'), 5),
  'always',
  COALESCE((SELECT (value->>'enabled')::boolean FROM settings WHERE key = 'popup'), true),
  0
);
