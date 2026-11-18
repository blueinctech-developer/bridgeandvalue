import type { RenderedPage } from "@/lib/cms";
import { withMediaHost } from "@/lib/media";
import { withBrochureForm } from "@/lib/brochure";
import type { SliderConfig } from "./SiteBehaviors";
import SiteBehaviors from "./SiteBehaviors";

/**
 * Elementor loads a popup's stylesheets only when the popup can appear, so they
 * weren't in the migrated page's list: the base dialog styles (fixed, full-screen
 * backdrop), Elementor Pro's popup layout, and each popup's own design file.
 */
function popupStylesheets(html: string): string[] {
  const ids = [...html.matchAll(/data-elementor-type="popup"[^>]*data-elementor-id="(\d+)"|data-elementor-id="(\d+)"[^>]*data-elementor-type="popup"/g)].map((m) => m[1] ?? m[2]);
  if (!ids.length) return [];
  return [
    "/wp-content/plugins/elementor/assets/css/conditionals/dialog.min.css",
    "/wp-content/plugins/elementor-pro/assets/css/conditionals/popup.min.css",
    ...ids.map((id) => `/wp-content/uploads/elementor/css/post-${id}.css`),
  ];
}

/**
 * Renders a migrated page: its original stylesheets (served locally), the
 * page markup with admin edits applied, and the client-side behaviours that
 * replace the WordPress theme/Elementor scripts.
 */
export default function LegacyPage({ page }: { page: RenderedPage }) {
  const stylesheets = [...new Set([...page.stylesheets, ...popupStylesheets(page.html)])];
  return (
    <>
      {stylesheets.map((href) => (
        <link key={href} rel="stylesheet" href={href} precedence="legacy" />
      ))}
      <style href={`inline-${page.path}`} precedence="legacy">
        {withMediaHost(page.inline_styles)}
      </style>
      {/* Apply the original <body> classes before first paint (theme CSS relies on them). */}
      <script dangerouslySetInnerHTML={{ __html: `document.body.className=${JSON.stringify(page.body_class)};` }} />
      {/* Images are served from the S3 media bucket when one is set up (lib/media.ts); the footer gets its brochure form back (lib/brochure.ts). */}
      <div id="page-content" dangerouslySetInnerHTML={{ __html: withBrochureForm(withMediaHost(page.html)) }} />
      <SiteBehaviors path={page.path} sliders={page.sliders as SliderConfig[]} popup={page.popup} />
    </>
  );
}
