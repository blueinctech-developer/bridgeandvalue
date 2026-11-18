import type { RenderedPage } from "@/lib/cms";
import { withMediaHost } from "@/lib/media";
import type { SliderConfig } from "./SiteBehaviors";
import SiteBehaviors from "./SiteBehaviors";

/**
 * Renders a migrated page: its original stylesheets (served locally), the
 * page markup with admin edits applied, and the client-side behaviours that
 * replace the WordPress theme/Elementor scripts.
 */
export default function LegacyPage({ page }: { page: RenderedPage }) {
  return (
    <>
      {page.stylesheets.map((href) => (
        <link key={href} rel="stylesheet" href={href} precedence="legacy" />
      ))}
      <style href={`inline-${page.path}`} precedence="legacy">
        {withMediaHost(page.inline_styles)}
      </style>
      {/* Apply the original <body> classes before first paint (theme CSS relies on them). */}
      <script dangerouslySetInnerHTML={{ __html: `document.body.className=${JSON.stringify(page.body_class)};` }} />
      {/* Images are served from the S3 media bucket when one is set up (lib/media.ts). */}
      <div id="page-content" dangerouslySetInnerHTML={{ __html: withMediaHost(page.html) }} />
      <SiteBehaviors path={page.path} sliders={page.sliders as SliderConfig[]} popup={page.popup} />
    </>
  );
}
