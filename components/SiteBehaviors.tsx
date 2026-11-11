"use client";

import { useEffect } from "react";
export type SliderConfig = {
  selector: string;
  kind: "slick" | "swiper-theme";
  options: {
    slidesToShow?: number;
    autoplay?: boolean;
    arrows?: boolean;
    dots?: boolean;
    speed?: number;
    responsive?: { breakpoint: number; settings: { slidesToShow?: number } }[];
  };
};
export type PopupSettings = { enabled: boolean; delaySeconds: number };

/**
 * Re-implements, without jQuery or WordPress, the front-end behaviour that the
 * Gerow theme (main.js), Elementor and Contact Form 7 scripts provided.
 * Each block names the original behaviour it replaces.
 */
export default function SiteBehaviors({ path, sliders, popup }: { path: string; sliders: SliderConfig[]; popup: PopupSettings }) {
  useEffect(() => {
    // The migrated WordPress markup is not always tag-balanced, so the browser
    // can close #page-content early and hoist trailing elements (footer
    // popups) to <body>. Query the whole document rather than the wrapper.
    if (!document.getElementById("page-content")) return;
    const root = document.body;
    const cleanups: (() => void)[] = [];
    const on = <K extends keyof HTMLElementEventMap>(el: EventTarget, ev: K | string, fn: (e: Event) => void, opts?: AddEventListenerOptions) => {
      el.addEventListener(ev, fn, opts);
      cleanups.push(() => el.removeEventListener(ev, fn, opts));
    };
    const $$ = <T extends Element = HTMLElement>(sel: string, scope: ParentNode = root) => Array.from(scope.querySelectorAll<T & Element>(sel)) as T[];
    const parseSettings = (el: Element): Record<string, any> => {
      try {
        return JSON.parse(el.getAttribute("data-settings") || "{}");
      } catch {
        return {};
      }
    };

    // Theme: preloader
    $$("#preloader").forEach((el) => (el.style.display = "none"));

    // Theme: data-background / data-bg-color
    $$("[data-background]").forEach((el) => (el.style.backgroundImage = `url(${el.getAttribute("data-background")})`));
    $$("[data-bg-color]").forEach((el) => (el.style.backgroundColor = el.getAttribute("data-bg-color") || ""));

    // Elementor: lazy-loaded container backgrounds
    $$(".e-con.e-parent").forEach((el) => el.classList.add("e-lazyloaded"));

    // Theme: mobile menu (copies the desktop menu into the off-canvas panel)
    const mainMenu = root.querySelector(".menu-area .main-menu");
    const outer = root.querySelector(".mobile-menu .menu-box .menu-outer");
    if (mainMenu && outer && !outer.children.length) outer.innerHTML = mainMenu.innerHTML;
    $$(".mobile-nav-toggler").forEach((b) => on(b, "click", () => document.body.classList.add("mobile-menu-visible")));
    $$(".menu-backdrop, .mobile-menu .close-btn").forEach((b) => on(b, "click", () => document.body.classList.remove("mobile-menu-visible")));

    // Theme: sticky header + scroll-to-top
    const onScroll = () => {
      const stuck = window.scrollY >= 245;
      document.getElementById("sticky-header")?.classList.toggle("sticky-menu", stuck);
      document.getElementById("header-fixed-height")?.classList.toggle("active-height", stuck);
      $$(".scroll-to-target").forEach((b) => b.classList.toggle("open", stuck));
    };
    on(window, "scroll", onScroll, { passive: true });
    onScroll();
    $$(".scroll-to-target").forEach((b) => on(b, "click", (e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }));

    // Theme: search popup + off-canvas info panel
    $$(".search-open-btn").forEach((b) => on(b, "click", () => {
      document.querySelector(".search__popup")?.classList.add("search-opened");
      document.querySelector(".search-popup-overlay")?.classList.add("search-popup-overlay-open");
    }));
    $$(".search-close-btn, .search-popup-overlay").forEach((b) => on(b, "click", () => {
      document.querySelector(".search__popup")?.classList.remove("search-opened");
      document.querySelector(".search-popup-overlay")?.classList.remove("search-popup-overlay-open");
    }));
    $$(".menu-tigger").forEach((b) => on(b, "click", (e) => { e.preventDefault(); $$(".extra-info, .offcanvas-overly").forEach((x) => x.classList.add("active")); }));
    $$(".menu-close, .offcanvas-overly").forEach((b) => on(b, "click", () => $$(".extra-info, .offcanvas-overly").forEach((x) => x.classList.remove("active"))));

    // Bootstrap: collapse (FAQ) and tabs (pricing) used on theme demo pages
    $$("[data-bs-toggle='collapse']").forEach((b) => on(b, "click", (e) => {
      e.preventDefault();
      const target = document.querySelector<HTMLElement>(b.getAttribute("data-bs-target") || b.getAttribute("href") || "");
      if (!target) return;
      const parentSel = target.getAttribute("data-bs-parent");
      const willOpen = !target.classList.contains("show");
      if (parentSel) document.querySelectorAll(`${parentSel} .collapse.show`).forEach((o) => {
        o.classList.remove("show");
        document.querySelector(`[data-bs-target='#${o.id}']`)?.classList.add("collapsed");
      });
      target.classList.toggle("show", willOpen);
      b.classList.toggle("collapsed", !willOpen);
      b.setAttribute("aria-expanded", String(willOpen));
    }));
    $$("[data-bs-toggle='tab'], [data-bs-toggle='pill']").forEach((b) => on(b, "click", (e) => {
      e.preventDefault();
      const target = document.querySelector(b.getAttribute("data-bs-target") || b.getAttribute("href") || "");
      if (!target?.parentElement) return;
      b.closest("ul, nav")?.querySelectorAll(".active").forEach((a) => a.classList.remove("active"));
      b.classList.add("active");
      Array.from(target.parentElement.children).forEach((p) => p.classList.remove("show", "active"));
      target.classList.add("show", "active");
    }));

    // Reveal-on-scroll: Elementor entrance animations, AOS, WOW, theme .has-animation, odometer counters
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const el = entry.target as HTMLElement;
        io.unobserve(el);
        if (el.classList.contains("elementor-invisible")) {
          const s = parseSettings(el);
          const name = s._animation || s.animation;
          const delay = Number(s._animation_delay || s.animation_delay || 0);
          setTimeout(() => {
            el.classList.remove("elementor-invisible");
            if (name && name !== "none") el.classList.add("animated", name);
          }, delay);
        }
        if (el.hasAttribute("data-aos")) el.classList.add("aos-animate");
        if (el.classList.contains("wow")) {
          el.style.visibility = "visible";
          el.style.animationDelay = el.getAttribute("data-wow-delay") || "";
          el.style.animationDuration = el.getAttribute("data-wow-duration") || "";
          el.classList.add("animated");
        }
        if (el.classList.contains("has-animation")) el.classList.add("active-animation");
        if (el.classList.contains("odometer")) countUp(el);
      }
    }, { rootMargin: "0px 0px -60px 0px" });
    $$("[data-aos]").forEach((el) => el.classList.add("aos-init"));
    $$(".wow").forEach((el) => (el.style.visibility = "hidden"));
    $$(".elementor-invisible, [data-aos], .wow, .has-animation, .odometer").forEach((el) => io.observe(el));
    cleanups.push(() => io.disconnect());

    // Magnific Popup: YouTube video lightbox
    $$("a.popup-video").forEach((a) => on(a, "click", (e) => {
      e.preventDefault();
      const id = (a.getAttribute("href") || "").match(/(?:v=|youtu\.be\/|embed\/)([\w-]{11})/)?.[1];
      if (id) openVideo(id);
    }));

    // Elementor image carousel (Swiper) + theme slick/swiper sliders
    let swipers: { destroy: () => void }[] = [];
    import("swiper/bundle").then(({ default: Swiper }) => {
      $$(".elementor-widget-image-carousel").forEach((w) => {
        const s = parseSettings(w);
        const container = w.querySelector<HTMLElement>(".swiper");
        if (!container) return;
        const n = (v: unknown, d: number) => Number(v) || d;
        swipers.push(new Swiper(container, {
          slidesPerView: n(s.slides_to_show_mobile, 1),
          slidesPerGroup: n(s.slides_to_scroll_mobile, 1),
          spaceBetween: n(s.image_spacing_custom?.size, 20),
          loop: s.infinite !== "",
          speed: n(s.speed, 500),
          autoplay: s.autoplay === "yes" ? { delay: n(s.autoplay_speed, 5000), pauseOnMouseEnter: s.pause_on_hover === "yes", disableOnInteraction: s.pause_on_interaction === "yes" } : false,
          breakpoints: {
            768: { slidesPerView: n(s.slides_to_show_tablet, 3), slidesPerGroup: n(s.slides_to_scroll_tablet, 1) },
            1025: { slidesPerView: n(s.slides_to_show, 3), slidesPerGroup: n(s.slides_to_scroll, 1) },
          },
          pagination: { el: container.querySelector<HTMLElement>(".swiper-pagination"), clickable: true },
          navigation: { nextEl: w.querySelector<HTMLElement>(".elementor-swiper-button-next"), prevEl: w.querySelector<HTMLElement>(".elementor-swiper-button-prev") },
        }));
      });
      for (const cfg of sliders.filter((x) => x.kind === "swiper-theme")) {
        const el = root.querySelector<HTMLElement>(cfg.selector);
        if (el) swipers.push(new Swiper(el, { slidesPerView: 1, spaceBetween: 30, loop: true, autoplay: { delay: 5000 }, breakpoints: { 768: { slidesPerView: 2 }, 1200: { slidesPerView: 3 } } }));
      }
    });
    cleanups.push(() => swipers.forEach((s) => s.destroy()));
    for (const cfg of sliders.filter((x) => x.kind === "slick")) {
      $$(cfg.selector).forEach((el) => cleanups.push(slick(el, cfg.options)));
    }
    // Theme hero slider (initialised by the theme's widget script, not inline): one slide at a time.
    $$(".slider-active").forEach((el) => cleanups.push(slick(el, { slidesToShow: 1, autoplay: true, speed: 1000 })));

    // Elementor Pro popup #2245: opens 5s after page load on the home page.
    $$("[data-elementor-type='popup']").forEach((p) => {
      const s = JSON.parse(p.getAttribute("data-elementor-settings") || "{}");
      if (p.classList.contains("elementor-location-popup")) {
        p.style.display = "none";
        if (popup.enabled && s.triggers?.page_load === "yes") {
          const t = setTimeout(() => openPopup(p), Math.max(0, Number(popup.delaySeconds) || 0) * 1000);
          cleanups.push(() => clearTimeout(t));
        }
      }
    });

    // Forms: Contact Form 7 and Elementor Pro form -> /api/forms
    $$<HTMLFormElement>("form.wpcf7-form").forEach((f) => on(f, "submit", (e) => { e.preventDefault(); submitCf7(f, path); }));
    $$<HTMLFormElement>("form.elementor-form").forEach((f) => on(f, "submit", (e) => { e.preventDefault(); submitElementor(f, path); }));

    return () => cleanups.forEach((c) => c());
  }, [path, sliders, popup.enabled, popup.delaySeconds]);

  return null;
}

function countUp(el: HTMLElement) {
  const target = Number(el.getAttribute("data-count") || el.textContent || 0);
  if (!target) return;
  const start = performance.now();
  const dur = 2000;
  const step = (t: number) => {
    const k = Math.min(1, (t - start) / dur);
    el.textContent = String(Math.round(target * (1 - Math.pow(1 - k, 3))));
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/** Minimal slick replacement producing slick's DOM/classes so the theme's slick.css applies. */
function slick(el: HTMLElement, o: SliderConfig["options"]): () => void {
  if (el.classList.contains("slick-initialized")) return () => {};
  const slides = Array.from(el.children) as HTMLElement[];
  const list = document.createElement("div");
  list.className = "slick-list draggable";
  list.style.overflow = "hidden";
  const track = document.createElement("div");
  track.className = "slick-track";
  track.style.display = "flex";
  track.style.transition = `transform ${o.speed ?? 500}ms ease`;
  slides.forEach((s) => { s.classList.add("slick-slide"); track.appendChild(s); });
  list.appendChild(track);
  el.appendChild(list);
  el.classList.add("slick-initialized", "slick-slider");
  let index = 0;
  const perView = () => {
    let n = o.slidesToShow ?? 1;
    for (const r of [...(o.responsive ?? [])].sort((a, b) => b.breakpoint - a.breakpoint)) {
      if (window.innerWidth < r.breakpoint && r.settings.slidesToShow) n = r.settings.slidesToShow;
    }
    return n;
  };
  let dots: HTMLUListElement | null = null;
  if (o.dots) {
    dots = document.createElement("ul");
    dots.className = "slick-dots";
    dots.setAttribute("role", "tablist");
    el.appendChild(dots);
  }
  const layout = () => {
    const n = perView();
    slides.forEach((s) => (s.style.flex = `0 0 ${100 / n}%`));
    const max = Math.max(0, slides.length - n);
    if (index > max) index = 0;
    track.style.transform = `translateX(-${(100 / n) * index}%)`;
    slides.forEach((s, i) => s.classList.toggle("slick-active", i >= index && i < index + n));
    if (dots) {
      const pages = max + 1;
      if (dots.children.length !== pages) {
        dots.innerHTML = Array.from({ length: pages }, (_, i) => `<li role="presentation"><button type="button" role="tab" aria-label="${i + 1} of ${pages}">${i + 1}</button></li>`).join("");
        Array.from(dots.children).forEach((li, i) => li.addEventListener("click", () => { index = i; layout(); }));
      }
      Array.from(dots.children).forEach((li, i) => li.classList.toggle("slick-active", i === index));
    }
  };
  const next = () => { index = index + 1 > slides.length - perView() ? 0 : index + 1; layout(); };
  const prev = () => { index = index - 1 < 0 ? Math.max(0, slides.length - perView()) : index - 1; layout(); };
  layout();
  window.addEventListener("resize", layout);
  // Custom arrows the theme places next to testimonial sliders
  const scope = el.parentElement ?? el;
  const nextBtn = scope.querySelector(".slider-next, .testimonial-nav .next, .slick-next");
  const prevBtn = scope.querySelector(".slider-prev, .testimonial-nav .prev, .slick-prev");
  nextBtn?.addEventListener("click", next);
  prevBtn?.addEventListener("click", prev);
  const timer = o.autoplay ? window.setInterval(next, 3000 + (o.speed ?? 500)) : 0;
  return () => { window.removeEventListener("resize", layout); clearInterval(timer); nextBtn?.removeEventListener("click", next); prevBtn?.removeEventListener("click", prev); };
}

/** Magnific Popup iframe markup, styled by the theme's magnific-popup.css. */
function openVideo(id: string) {
  const bg = document.createElement("div");
  bg.className = "mfp-bg mfp-ready";
  const wrap = document.createElement("div");
  wrap.className = "mfp-wrap mfp-close-btn-in mfp-auto-cursor mfp-ready";
  wrap.tabIndex = -1;
  wrap.style.cssText = "top:0;position:fixed;overflow:hidden auto;";
  wrap.innerHTML = `<div class="mfp-container mfp-s-ready mfp-iframe-holder"><div class="mfp-content"><div class="mfp-iframe-scaler">
    <button title="Close (Esc)" type="button" class="mfp-close">×</button>
    <iframe class="mfp-iframe" src="https://www.youtube.com/embed/${id}?autoplay=1" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>
    </div></div></div>`;
  const close = () => { bg.remove(); wrap.remove(); document.removeEventListener("keydown", esc); };
  const esc = (e: KeyboardEvent) => e.key === "Escape" && close();
  wrap.addEventListener("click", (e) => { const t = e.target as HTMLElement; if (t.classList.contains("mfp-close") || t.classList.contains("mfp-container")) close(); });
  document.addEventListener("keydown", esc);
  document.body.append(bg, wrap);
}

/** Elementor Pro lightbox popup markup, styled by popup.min.css. */
function openPopup(content: HTMLElement) {
  const id = content.getAttribute("data-elementor-id");
  const modal = document.createElement("div");
  modal.id = `elementor-popup-modal-${id}`;
  modal.className = "dialog-widget dialog-lightbox-widget dialog-type-buttons dialog-type-lightbox elementor-popup-modal";
  modal.style.display = "flex";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  const box = document.createElement("div");
  box.className = "dialog-widget-content dialog-lightbox-widget-content animated fadeIn";
  box.style.animationDuration = "1.4s";
  const closeBtn = document.createElement("a");
  closeBtn.className = "dialog-close-button dialog-lightbox-close-button";
  closeBtn.setAttribute("role", "button");
  closeBtn.setAttribute("aria-label", "Close");
  closeBtn.tabIndex = 0;
  closeBtn.innerHTML = '<svg class="e-font-icon-svg e-eicon-close" viewBox="0 0 1000 1000" xmlns="http://www.w3.org/2000/svg"><path d="M742 167L500 408 258 167C246 154 233 150 217 150 196 150 179 158 167 167 154 179 150 196 150 212 150 229 154 242 171 254L408 500 167 742C138 771 138 800 167 829 196 858 225 858 254 829L496 587 738 829C750 842 767 846 783 846 800 846 817 842 829 829 842 817 846 804 846 783 846 767 842 750 829 737L588 500 833 258C863 229 863 200 833 171 804 137 775 137 742 167Z"></path></svg>';
  const msg = document.createElement("div");
  msg.className = "dialog-message dialog-lightbox-message";
  const placeholder = document.createComment("popup");
  content.replaceWith(placeholder);
  content.style.display = "";
  msg.appendChild(content);
  box.append(closeBtn, msg);
  modal.appendChild(box);
  const close = () => { modal.remove(); content.style.display = "none"; placeholder.replaceWith(content); document.removeEventListener("keydown", esc); };
  const esc = (e: KeyboardEvent) => e.key === "Escape" && close();
  closeBtn.addEventListener("click", close);
  modal.addEventListener("click", (e) => e.target === modal && close());
  document.addEventListener("keydown", esc);
  document.body.appendChild(modal);
}

async function post(form: string, page: string, fields: Record<string, string>) {
  const res = await fetch("/api/forms/", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ form, page, fields }) });
  return (await res.json()) as { ok: boolean; invalid?: Record<string, string>; message?: string };
}

/** Contact Form 7 front-end states and default messages. */
async function submitCf7(f: HTMLFormElement, page: string) {
  const out = f.querySelector<HTMLElement>(".wpcf7-response-output");
  f.querySelectorAll(".wpcf7-not-valid-tip").forEach((t) => t.remove());
  f.querySelectorAll(".wpcf7-not-valid").forEach((t) => { t.classList.remove("wpcf7-not-valid"); t.setAttribute("aria-invalid", "false"); });
  f.classList.add("submitting");
  const fields: Record<string, string> = {};
  new FormData(f).forEach((v, k) => { if (!k.startsWith("_wpcf7")) fields[k] = String(v); });
  const set = (status: string, text: string) => {
    f.className = `wpcf7-form ${status}`;
    f.setAttribute("data-status", status);
    if (out) { out.textContent = text; out.setAttribute("aria-hidden", "false"); }
  };
  try {
    const r = await post("quote", page, fields);
    if (r.ok) { set("sent", "Thank you for your message. It has been sent."); f.reset(); return; }
    for (const [name, msg] of Object.entries(r.invalid ?? {})) {
      const input = f.querySelector(`[name='${name}']`);
      input?.classList.add("wpcf7-not-valid");
      input?.setAttribute("aria-invalid", "true");
      input?.insertAdjacentHTML("afterend", `<span class="wpcf7-not-valid-tip" aria-hidden="true">${msg === "This field is required." ? "Please fill out this field." : msg}</span>`);
    }
    set("invalid", r.invalid ? "One or more fields have an error. Please check and try again." : "There was an error trying to send your message. Please try again later.");
  } catch {
    set("failed", "There was an error trying to send your message. Please try again later.");
  }
}

/** Elementor Pro form front-end states and default messages. */
async function submitElementor(f: HTMLFormElement, page: string) {
  f.querySelectorAll(".elementor-message, .elementor-error .elementor-message").forEach((m) => m.remove());
  f.querySelectorAll(".elementor-error").forEach((g) => g.classList.remove("elementor-error"));
  f.classList.add("elementor-form-waiting");
  const fields: Record<string, string> = {};
  new FormData(f).forEach((v, k) => {
    const m = k.match(/^form_fields\[(.+)\]$/);
    if (m) fields[m[1] === "field_6f4576e" ? "phone" : m[1] === "field_0827996" ? "subject" : m[1]] = String(v);
  });
  const msg = (cls: string, text: string) => f.insertAdjacentHTML("beforeend", `<div class="elementor-message ${cls}" role="alert">${text}</div>`);
  try {
    const r = await post("contact", page, fields);
    f.classList.remove("elementor-form-waiting");
    if (r.ok) { msg("elementor-message-success", "Your submission was successful."); f.reset(); return; }
    for (const [name, text] of Object.entries(r.invalid ?? {})) {
      const group = f.querySelector(`.elementor-field-group-${name}`);
      group?.classList.add("elementor-error");
      group?.insertAdjacentHTML("beforeend", `<span class="elementor-message elementor-message-danger elementor-help-inline elementor-form-help-inline" role="alert">${text}</span>`);
    }
    msg("elementor-message-danger", "Your submission failed because of an error.");
  } catch {
    f.classList.remove("elementor-form-waiting");
    msg("elementor-message-danger", "Your submission failed because of an error.");
  }
}
