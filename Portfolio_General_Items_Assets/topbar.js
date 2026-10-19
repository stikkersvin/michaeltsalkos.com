// Inject shared top bar and handle desktop dark mode toggle
(function () {
  document.querySelectorAll(
    '.site-topbar, .topbar-nav, .topbar-header, .topbar-mobile-nav, .topbar-about, .topbar-switch'
  ).forEach((element) => element.remove());

  const path = decodeURIComponent(window.location.pathname || '');
  const base = new URL('../', document.currentScript.src).href.replace(/\/$/, '');
  const linkGraphic = `${base}/index.html?view=spatial`;
  const linkFonts = `${base}/Portfolio_Fonts_Tab/Portfolio_Fonts_Landingpage/fonts.html`;
  const linkAbout = `${base}/Portfolio_About/about.html`;
  const isFonts = path.includes('/Portfolio_Fonts_Tab/');
  const isAbout = path.includes('/Portfolio_About/');

  const TOPBAR_HTML = `
    <div class="site-topbar" data-shared-topbar>
    <nav class="topbar-links" aria-label="Main navigation">
      <a href="${linkGraphic}" ${!isFonts && !isAbout ? 'aria-current="page"' : ''}>Graphic Design</a>
      <a href="${linkFonts}" ${isFonts ? 'aria-current="page"' : ''}>Fonts</a>
    </nav>
    <a class="topbar-name" href="${linkGraphic}" aria-label="Michael Tsalkos — selected work">MICHAEL TSALKOS™</a>
    <div class="topbar-tools">
      <div class="topbar-view-slot"></div>
      <a href="${linkAbout}" ${isAbout ? 'aria-current="page"' : ''}>About</a>
    <button class="topbar-theme" id="sharedThemeSwitch" role="switch" aria-checked="false" aria-label="Toggle dark mode">
      <div class="topbar-knob" id="sharedKnob"></div>
    </button>
    </div>
    </div>
  `;

  const wrapper = document.createElement('div');
  wrapper.innerHTML = TOPBAR_HTML.trim();
  const frag = document.createDocumentFragment();
  while (wrapper.firstChild) frag.appendChild(wrapper.firstChild);
  document.body.appendChild(frag);

  const sharedBar = document.querySelector('.site-topbar');
  const syncBarHeight = () => document.documentElement.style.setProperty('--navigation-half-height', `${sharedBar.getBoundingClientRect().height / 2}px`);
  new ResizeObserver(syncBarHeight).observe(sharedBar);
  syncBarHeight();

  const mountViewToggle = () => {
    const viewToggle = document.querySelector('.view-toggle');
    const slot = document.querySelector('.topbar-view-slot');
    if (viewToggle) slot.appendChild(viewToggle);
    else if (isAbout) {
      const links = document.createElement('nav');
      links.className = 'topbar-view-links';
      links.setAttribute('aria-label', 'Project view');
      links.innerHTML = `<a href="${linkGraphic}">Selected</a><a href="${base}/index.html?view=list">All</a>`;
      slot.appendChild(links);
    }
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountViewToggle, { once: true });
  } else {
    mountViewToggle();
  }

  const switchBtn = document.getElementById('sharedThemeSwitch');
  const knob = document.getElementById('sharedKnob');

  const mobileHeaderQuery = window.matchMedia('(max-width: 768px)');
  let viewportOffsetFrame = null;
  const syncMobileViewportOffset = () => {
    viewportOffsetFrame = null;
    const offset = mobileHeaderQuery.matches && window.visualViewport
      ? Math.max(0, window.visualViewport.offsetTop || 0)
      : 0;
    document.documentElement.style.setProperty('--topbar-visual-offset', `${offset}px`);
  };
  const queueMobileViewportOffset = () => {
    if (viewportOffsetFrame !== null) return;
    viewportOffsetFrame = window.requestAnimationFrame(syncMobileViewportOffset);
  };

  syncMobileViewportOffset();
  if (mobileHeaderQuery.addEventListener) {
    mobileHeaderQuery.addEventListener('change', queueMobileViewportOffset);
  } else if (mobileHeaderQuery.addListener) {
    mobileHeaderQuery.addListener(queueMobileViewportOffset);
  }
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', queueMobileViewportOffset);
    window.visualViewport.addEventListener('scroll', queueMobileViewportOffset);
  }
  window.addEventListener('orientationchange', queueMobileViewportOffset);

  if (!switchBtn || !knob) return;

  const applyState = (dark) => {
    document.body.classList.toggle('dark', dark);
    switchBtn.setAttribute('aria-checked', String(dark));
    try { localStorage.setItem('theme-dark', dark ? '1' : '0'); } catch (e) {}
  };

  let storedDark = null;
  try {
    const v = localStorage.getItem('theme-dark');
    if (v === '1') storedDark = true;
    if (v === '0') storedDark = false;
  } catch (e) {}
  applyState(storedDark !== null ? storedDark : true);

  switchBtn.addEventListener('click', () => {
    const dark = !document.body.classList.contains('dark');
    applyState(dark);
  });
})();
