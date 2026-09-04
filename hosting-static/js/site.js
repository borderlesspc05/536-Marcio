(function () {
  const cfg = window.COTACONDO || {};
  const app = (cfg.appUrl || "").replace(/\/$/, "");

  document.querySelectorAll("[data-app-href]").forEach((el) => {
    const path = el.getAttribute("data-app-href") || "/";
    el.setAttribute("href", app ? `${app}${path}` : path);
  });

  document.querySelectorAll("[data-blog-href]").forEach((el) => {
    el.setAttribute("href", cfg.blogUrl || "https://blog.cotacondo.com.br");
  });

  document.querySelectorAll("[data-whatsapp-href]").forEach((el) => {
    el.setAttribute("href", cfg.whatsappUrl || "https://wa.me/5500000000000");
  });

  const supplierMedia = document.querySelector("[data-supplier-media]");
  if (supplierMedia && cfg.supplierVideoUrl) {
    try {
      const url = new URL(cfg.supplierVideoUrl);
      const host = url.hostname.replace(/^www\./, "");
      let videoId = "";
      if (host === "youtu.be") videoId = url.pathname.slice(1).split("/")[0] || "";
      if (["youtube.com", "m.youtube.com"].includes(host)) {
        videoId = url.searchParams.get("v") || url.pathname.match(/^\/(?:embed|shorts)\/([^/?]+)/)?.[1] || "";
      }
      if (/^[\w-]{6,20}$/.test(videoId)) {
        const iframe = document.createElement("iframe");
        iframe.src = `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1&playsinline=1`;
        iframe.title = "Conheça a CotaCondo para fornecedores";
        iframe.className = "supplier-video";
        iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
        iframe.allowFullscreen = true;
        iframe.referrerPolicy = "strict-origin-when-cross-origin";
        supplierMedia.replaceChildren(iframe);
      }
    } catch {
      // URL inválida: mantém o mascote como fallback visual.
    }
  }

  const year = document.querySelector("[data-year]");
  if (year) year.textContent = String(new Date().getFullYear());

  const header = document.querySelector("[data-header]");
  const onScroll = () => {
    if (!header) return;
    header.classList.toggle("is-scrolled", window.scrollY > 12);
  };
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  const toggle = document.querySelector("[data-menu-toggle]");
  const drawer = document.querySelector("[data-menu-drawer]");
  if (toggle && drawer) {
    toggle.addEventListener("click", () => {
      const open = drawer.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      document.body.style.overflow = open ? "hidden" : "";
    });
    drawer.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        drawer.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
        document.body.style.overflow = "";
      });
    });
  }

  const track = document.querySelector("[data-banner-track]");
  if (track) {
    const slides = Array.from(track.children);
    let index = 0;
    const go = (next) => {
      index = (next + slides.length) % slides.length;
      track.style.transform = `translateX(-${index * 100}%)`;
    };
    document.querySelector("[data-banner-prev]")?.addEventListener("click", () => go(index - 1));
    document.querySelector("[data-banner-next]")?.addEventListener("click", () => go(index + 1));
    if (slides.length > 1) setInterval(() => go(index + 1), 6000);
  }
})();
