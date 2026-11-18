/**
 * The footer's "Request our Brochure" box. On WordPress it was a Mailchimp for WordPress
 * form (MC4WP form 310, "Footer Newsletter") whose plugin stopped working, so the box
 * rendered empty. The same markup (the theme styles .footer-newsletter) is put back into
 * the empty shortcode widget; components/SiteBehaviors.tsx sends it to /api/forms as the
 * "brochure" form, which saves it, notifies staff and emails the visitor the brochure
 * chosen in Admin → Settings.
 */

const FORM = `<form class="mc4wp-form mc4wp-form-310 bv-brochure-form" method="post" data-name="Footer Newsletter" novalidate>
<div class="mc4wp-form-fields"><div class="footer-newsletter">
<input type="email" name="email" placeholder="enter your e-mail" aria-label="Your email address" autocomplete="email" required />
<button type="submit">Submit Request</button>
</div></div>
<label style="display:none !important" aria-hidden="true">Leave this field empty if you're human: <input type="text" name="website" value="" tabindex="-1" autocomplete="off" /></label>
<div class="mc4wp-response" role="status" aria-live="polite"></div>
</form>`;

/** The footer's empty shortcode widget (Elementor element 82ef99c). */
const EMPTY_WIDGET = /(<div class="elementor-element elementor-element-82ef99c[^"]*"[^>]*>\s*<div class="elementor-widget-container">\s*<div class="elementor-shortcode">)\s*(<\/div>)/;

export function withBrochureForm(html: string): string {
  return html.replace(EMPTY_WIDGET, (_m, open: string, close: string) => `${open}${FORM}${close}`);
}
