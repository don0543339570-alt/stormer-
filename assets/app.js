(function () {
  const C = window.SITE_CONFIG || {};
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = (n) => (Number(n) || 0).toLocaleString("en-US", { maximumFractionDigits: 2 });
  const params = new URLSearchParams(location.search);
  const CACHE_KEY = "prices-cache-v1";

  async function fetchJson(url, opts) {
    const r = await fetch(url, opts);
    if (!r.ok) throw new Error(url + " -> " + r.status);
    return r.json();
  }

  async function loadData() {
    try {
      const cached = JSON.parse(sessionStorage.getItem(CACHE_KEY) || "null");
      if (cached && Date.now() - cached.t < 60000) return cached.d;
    } catch (e) {}
    const { githubOwner: o, githubRepo: r, githubBranch: b = "main", pricesPath: p = "prices.json" } = C;
    const sources = [];
    if (o && r) {
      sources.push(() => fetchJson(`https://raw.githubusercontent.com/${o}/${r}/${b}/${p}?t=${Date.now()}`, { cache: "no-store" }));
      sources.push(() => fetchJson(`https://api.github.com/repos/${o}/${r}/contents/${p}?ref=${b}`, { headers: { Accept: "application/vnd.github.raw+json" }, cache: "no-store" }));
    }
    sources.push(() => fetchJson("prices.json?t=" + Date.now(), { cache: "no-store" }));
    for (const src of sources) {
      try {
        const d = await src();
        if (d && d.categories) {
          try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), d })); } catch (e) {}
          return d;
        }
      } catch (e) { /* try next source */ }
    }
    throw new Error("Could not load prices");
  }

  function clearCache() { try { sessionStorage.removeItem(CACHE_KEY); } catch (e) {} }

  const cur = (d) => esc(d.settings.currency_symbol || "₵");
  const groupCats = (d, key) => d.categories.filter((c) => c.group === key);
  const minPlan = (c) => (c.plans.length ? c.plans.reduce((a, b) => (Number(b.price) < Number(a.price) ? b : a)) : null);
  const catUrl = (c) => "hosting.html?c=" + encodeURIComponent(c.slug);

  function waLink(d, text) {
    const num = String(d.settings.whatsapp || "").replace(/\D/g, "");
    return num ? `https://wa.me/${num}?text=${encodeURIComponent(text)}` : "contact.html";
  }

  function header(d) {
    const groups = d.groups.map((g) => {
      const cats = groupCats(d, g.key);
      if (!cats.length) return "";
      return `<div class="dd"><span class="dd-title">${esc(g.label)} ▾</span><div class="dd-menu">${cats.map((c) => `<a href="${catUrl(c)}">${esc(c.name)}</a>`).join("")}</div></div>`;
    }).join("");
    return `<div class="wrap nav-row">
      <a class="logo" href="index.html">${esc(d.settings.site_name)}</a>
      <input type="checkbox" id="nav-toggle" class="nav-toggle">
      <label for="nav-toggle" class="burger" aria-label="Menu"><span></span><span></span><span></span></label>
      <nav class="menu"><a href="index.html">Home</a><a href="domains.html">Domains</a>${groups}<a href="contact.html">Contact</a></nav>
    </div>`;
  }

  function footer(d) {
    const s = d.settings;
    const cols = d.groups.map((g) => {
      const cats = groupCats(d, g.key);
      return cats.length ? `<div><h4>${esc(g.label)}</h4>${cats.map((c) => `<a href="${catUrl(c)}">${esc(c.name)}</a>`).join("")}</div>` : "";
    }).join("");
    return `<div class="wrap footer-grid">
      <div><div class="logo">${esc(s.site_name)}</div>
        <p>Call &amp; live chat support:<br>Mon – Fri: 8am – 5pm<br>Sat: 9am – 3pm</p>
        <p>WhatsApp &amp; email: always active – 24/7/365</p></div>
      ${cols}
      <div><h4>Contact</h4><span>${esc(s.phone)}</span><span>${esc(s.email)}</span><span>${esc(s.address)}</span>
        <a href="domains.html">Domain Registration</a></div>
    </div>
    <div class="wrap copy">© ${esc(s.site_name)}. All rights reserved.</div>`;
  }

  function priceTag(d, price, period) {
    return `<div class="price"><span class="cur">${cur(d)}</span>${fmt(price)}<span class="per">/${esc(period)}</span></div>`;
  }

  function planCard(d, c, p) {
    const text = `Hello, I want to order ${c.name} - ${p.name} (${d.settings.currency_symbol}${fmt(p.price)}/${p.period})`;
    return `<div class="plan${p.featured ? " featured" : ""}">
      ${p.featured ? '<div class="ribbon">Most popular</div>' : ""}
      <h3>${esc(p.name)}</h3>
      ${p.description ? `<p class="muted">${esc(p.description)}</p>` : ""}
      ${priceTag(d, p.price, p.period)}
      <ul>${(p.features || []).map((f) => `<li>${esc(f)}</li>`).join("")}</ul>
      <a class="btn" href="${esc(waLink(d, text))}" target="_blank" rel="noopener">Order</a>
    </div>`;
  }

  const pages = {
    home(d) {
      const s = d.settings;
      const prices = d.categories.flatMap((c) => c.plans.map((p) => Number(p.price)));
      const start = prices.length ? Math.min(...prices) : 0;
      const com = d.tlds.find((t) => t.ext === ".com");
      const highlight = ["linux-hosting", "vps-hosting", "dedicated-servers"].map((sl) => d.categories.find((c) => c.slug === sl)).filter(Boolean);
      return `
      <section class="hero"><div class="wrap">
        <h1>${esc(s.tagline)}</h1><p class="lead">Starting at</p>
        <div class="hero-price">${cur(d)}${fmt(start)}<span>/yr</span></div>
        <a class="btn btn-light" href="#plans">View Hosting Plans</a>
        <p class="since">Providing exceptional web hosting services since ${esc(s.since_year)}!</p>
      </div></section>
      <section class="domain-box"><div class="wrap center">
        <h2>Find Your Perfect Domain!</h2>
        ${com ? `<p class="muted">Grab a .COM domain for just ${cur(d)}${fmt(com.price)}.</p>` : ""}
        <form class="search" action="domains.html"><input name="q" placeholder="Find your new domain" required><button class="btn">Search</button></form>
        <div class="tlds">${d.tlds.slice(0, 6).map((t) => `<div class="tld"><b>${esc(t.ext)}</b><span>${cur(d)}${fmt(t.price)}/yr</span></div>`).join("")}</div>
      </div></section>
      <section class="grey" id="plans"><div class="wrap center">
        <h2>Affordable, Reliable &amp; Fast Web Hosting Services</h2>
        <p class="muted narrow">Get affordable, reliable &amp; fast web hosting for your website from ${esc(s.site_name)}. All our Linux shared hosting plans come with the cPanel control panel for easy management. Whether you have an e-commerce store or a business website with a huge amount of traffic, we have hosting for all your needs.</p>
        <div class="cards three">${highlight.map((c) => {
          const p = minPlan(c);
          const title = c.slug === "linux-hosting" ? "Shared" : c.name.split(" ")[0];
          return `<div class="card"><h3>${esc(title)}</h3><p class="muted">${esc(c.intro.split(".")[0])}.</p>
            ${p ? priceTag(d, p.price, p.period) : ""}<a class="btn btn-outline" href="${catUrl(c)}">Get started</a></div>`;
        }).join("")}</div>
      </div></section>
      <section><div class="wrap split">
        <div><h2>Easy Website Builder</h2>
          <p class="muted">Build your professional website using an easy-to-use editor and publish static web pages. 500+ responsive themes covering blogs, businesses, portfolios, restaurants, travel and more. 40+ widgets like sliders, galleries, contact forms, maps and social media. <b>No coding skills required.</b></p>
          <a class="btn btn-outline" href="hosting.html?c=website-builder">Learn More</a> <a class="btn" href="#plans">View Hosting Plans</a></div>
        <div class="mock"><div class="mock-bar"><i></i><i></i><i></i></div><div class="mock-body"><div></div><div></div><div></div><div></div></div></div>
      </div></section>
      <section class="grey"><div class="wrap center">
        <h2>Why Choose ${esc(s.site_name)}?</h2>
        <p class="muted narrow">Our web hosting is secure, fast and reliable. We know your website needs to be fast-loading and always accessible.</p>
        <div class="cards four">
          <div class="card feature"><div class="ico">✓</div><h4>Money-back Guarantee</h4><p class="muted">Buy with confidence knowing we guarantee your satisfaction.</p></div>
          <div class="card feature"><div class="ico">☎</div><h4>24/7 Support</h4><p class="muted">Your websites are our priority, we are here to serve you 24/7.</p></div>
          <div class="card feature"><div class="ico">☁</div><h4>Cloud Technology</h4><p class="muted">The latest cloud hosting technologies for your website.</p></div>
          <div class="card feature"><div class="ico">↑</div><h4>99.9% Uptime</h4><p class="muted">The availability of your website is our top priority.</p></div>
        </div>
      </div></section>
      <section><div class="wrap center"><h2>Our Best Features</h2><div class="chips">
        <span>SSD drives for all plans</span><span>Free SSL certificate</span><span>24/7 support</span><span>Money-back guarantee</span>
        <span>Latest speed technologies</span><span>Stable platform</span><span>One-click install scripts</span><span>Pay with Mobile Money</span>
      </div></div></section>
      <section class="cta"><div class="wrap center">
        <h2>Affordable &amp; Reliable Hosting Solutions from ${cur(d)}${fmt(start)}</h2>
        <a class="btn btn-light" href="#plans">Get Started Now</a>
      </div></section>`;
    },

    category(d) {
      const c = d.categories.find((x) => x.slug === params.get("c"));
      if (!c) return `<section><div class="wrap center"><h2>Page not found</h2><a class="btn" href="index.html">Go home</a></div></section>`;
      document.title = `${c.name} | ${d.settings.site_name}`;
      const others = d.categories.filter((x) => x.group === "hosting" && x.slug !== c.slug && x.plans.length).slice(0, 4);
      return `
      <section class="hero small"><div class="wrap"><h1>${esc(c.headline)}</h1><p class="lead narrow">${esc(c.intro)}</p></div></section>
      <section class="grey"><div class="wrap center"><h2>Choose your plan</h2>
        <div class="plans">${c.plans.length ? c.plans.map((p) => planCard(d, c, p)).join("") : '<p class="muted">No plans yet — contact us for pricing.</p>'}</div>
      </div></section>
      ${others.length ? `<section><div class="wrap center"><h2>Need Something Different?</h2><div class="cards four">${others.map((o) => {
        const p = minPlan(o);
        return `<div class="card"><h4>${esc(o.name)}</h4><p class="muted">as low as ${cur(d)}${fmt(p.price)}/${esc(p.period)}</p><a class="btn btn-outline" href="${catUrl(o)}">Get Started!</a></div>`;
      }).join("")}</div></div></section>` : ""}`;
    },

    domains(d) {
      document.title = `Domain Registration | ${d.settings.site_name}`;
      const name = (params.get("q") || "").trim().toLowerCase().split(".")[0].replace(/[^a-z0-9-]/g, "").replace(/^-+|-+$/g, "");
      return `
      <section class="hero small"><div class="wrap"><h1>Domain Registration</h1>
        <form class="search" action="domains.html"><input name="q" value="${esc(name)}" placeholder="Find your new domain" required><button class="btn">Search</button></form>
      </div></section>
      <section><div class="wrap">
        <h2 class="center">${name ? "Register " + esc(name) : "Domain Prices"}</h2>
        <div class="table-wrap"><table class="table"><thead><tr><th>Domain</th><th>Price</th><th></th></tr></thead><tbody>
        ${d.tlds.map((t) => {
          const text = `Hello, I want to register ${name || "a domain"}${t.ext} (${d.settings.currency_symbol}${fmt(t.price)}/yr)`;
          return `<tr><td><b>${esc(name)}${esc(t.ext)}</b></td><td>${cur(d)}${fmt(t.price)}/yr</td>
            <td class="right"><a class="btn small" target="_blank" rel="noopener" href="${esc(waLink(d, text))}">${name ? "Register" : "Order"}</a></td></tr>`;
        }).join("")}
        </tbody></table></div>
        <p class="muted center">Availability is confirmed when you place your order.</p>
      </div></section>`;
    },

    contact(d) {
      const s = d.settings;
      document.title = `Contact | ${s.site_name}`;
      return `
      <section class="hero small"><div class="wrap"><h1>Contact Us</h1><p class="lead">We're here to help 24/7.</p></div></section>
      <section><div class="wrap cards three">
        <div class="card"><h4>Phone</h4><p>${esc(s.phone)}</p></div>
        <div class="card"><h4>Email</h4><p><a href="mailto:${esc(s.email)}">${esc(s.email)}</a></p></div>
        <div class="card"><h4>Address</h4><p>${esc(s.address)}</p></div>
      </div>
      ${s.whatsapp ? `<div class="center"><a class="btn" target="_blank" rel="noopener" href="${esc(waLink(d, "Hello, I need help"))}">Chat on WhatsApp</a></div>` : ""}
      </section>`;
    },
  };

  function renderShell(d) {
    document.getElementById("site-header").innerHTML = header(d);
    document.getElementById("site-footer").innerHTML = footer(d);
    if (!document.title || document.title === "Loading…") document.title = `${d.settings.site_name} | ${d.settings.tagline}`;
  }

  async function render(page) {
    const app = document.getElementById("app");
    try {
      const d = await loadData();
      renderShell(d);
      app.innerHTML = pages[page](d);
      if (location.hash) document.querySelector(location.hash)?.scrollIntoView();
    } catch (e) {
      app.innerHTML = `<section><div class="wrap center"><h2>Sorry, prices could not be loaded.</h2><p class="muted">Please refresh the page.</p></div></section>`;
    }
  }

  window.Site = { render, renderShell, loadData, clearCache, esc, fmt, config: C };
})();
