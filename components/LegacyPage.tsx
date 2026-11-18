import type { RenderedPage } from "@/lib/cms";
import { withMediaHost } from "@/lib/media";
import { withBrochureForm } from "@/lib/brochure";
import type { PopupConfig } from "@/lib/popups";
import type { SliderConfig } from "./SiteBehaviors";
import SiteBehaviors from "./SiteBehaviors";

const DIALOG_CSS = ["/wp-content/plugins/elementor/assets/css/conditionals/dialog.min.css", "/wp-content/plugins/elementor-pro/assets/css/conditionals/popup.min.css"];

/**
 * Elementor loads a popup's stylesheets only when the popup can appear, so they
 * weren't in the migrated page's list: the base dialog styles (fixed, full-screen
 * backdrop), Elementor Pro's popup layout, and each popup's own design file.
 * Pop-ups created in the admin use the same dialog plus public/bv-popup.css.
 */
function popupStylesheets(html: string, popups: PopupConfig[]): string[] {
  const ids = [...html.matchAll(/data-elementor-type="popup"[^>]*data-elementor-id="(\d+)"|data-elementor-id="(\d+)"[^>]*data-elementor-type="popup"/g)].map((m) => m[1] ?? m[2]);
  const custom = popups.some((p) => p.kind === "custom");
  if (!ids.length && !custom) return [];
  return [...DIALOG_CSS, ...ids.map((id) => `/wp-content/uploads/elementor/css/post-${id}.css`), ...(custom ? ["/bv-popup.css"] : [])];
}

/**
 * Renders a migrated page: its original stylesheets (served locally), the
 * page markup with admin edits applied, and the client-side behaviours that
 * replace the WordPress theme/Elementor scripts. `popups` are the pop-ups from
 * Admin → Pop-ups that may appear on this page (lib/popups.ts); none on previews.
 */
export default function LegacyPage({ page, popups = [] }: { page: RenderedPage; popups?: PopupConfig[] }) {
  const stylesheets = [...new Set([...page.stylesheets, ...popupStylesheets(page.html, popups)])];
  const customHtml = popups.map((p) => p.html ?? "").join("\n");
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
      {/* Pop-ups created in the admin wait here, hidden, until SiteBehaviors opens one. */}
      {customHtml && <div id="bv-popups" hidden dangerouslySetInnerHTML={{ __html: customHtml }} />}
      <SiteBehaviors path={page.path} sliders={page.sliders as SliderConfig[]} popups={popups.map((p) => ({ ...p, html: null }))} />
    </>
  );
}
