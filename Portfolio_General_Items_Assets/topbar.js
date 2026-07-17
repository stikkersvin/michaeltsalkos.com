// Inject shared top bar and handle dark mode toggle
(function () {
  const path = decodeURIComponent(window.location.pathname || '');
  const marker = '/Web Portfolio';
  const idx = path.indexOf(marker);
  const githubProjectBase = window.location.hostname.endsWith('.github.io')
    ? `/${path.split('/').filter(Boolean)[0] || ''}`
    : '';
  const base = idx >= 0 ? path.slice(0, idx + marker.length) : githubProjectBase;
  const linkGraphic = `${base}/index.html?view=spatial`;
  const linkFonts = `${base}/Portfolio_Fonts_Tab/Portfolio_Fonts_Landingpage/fonts.html`;
  const linkAbout = `${base}/Portfolio_About/about.html`;

  const TOPBAR_HTML = `
    <nav class="topbar-nav">
      <a href="${linkGraphic}">Graphic Design</a>
      <a href="${linkFonts}">Fonts</a>
    </nav>
    <button class="topbar-menu-button" type="button" aria-expanded="false" aria-controls="topbarMobileMenu" aria-label="Open menu">
      <span></span>
      <span></span>
    </button>
    <header class="topbar-header"><a href="${linkGraphic}">MICHAEL TSALKOS™</a></header>
    <a class="topbar-about" href="${linkAbout}">About</a>
    <button class="topbar-switch" id="sharedThemeSwitch" role="switch" aria-checked="false" aria-label="Toggle dark mode">
      <div class="topbar-knob" id="sharedKnob"></div>
    </button>
    <div class="topbar-mobile-menu" id="topbarMobileMenu" aria-hidden="true">
      <nav>
        <a href="${linkGraphic}">Graphic Design</a>
        <a href="${linkFonts}">Fonts</a>
        <a href="${linkAbout}">About</a>
      </nav>
    </div>
  `;

  const wrapper = document.createElement('div');
  wrapper.innerHTML = TOPBAR_HTML.trim();
  const frag = document.createDocumentFragment();
  while (wrapper.firstChild) {
    frag.appendChild(wrapper.firstChild);
  }
  document.body.appendChild(frag);

  const switchBtn = document.getElementById('sharedThemeSwitch');
  const knob = document.getElementById('sharedKnob');
  const menuButton = document.querySelector('.topbar-menu-button');
  const mobileMenu = document.getElementById('topbarMobileMenu');
  if (!switchBtn || !knob) return;

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

  const setMenuOpen = (open) => {
    if (!menuButton || !mobileMenu) return;
    menuButton.setAttribute('aria-expanded', String(open));
    mobileMenu.setAttribute('aria-hidden', String(!open));
    document.body.classList.toggle('topbar-menu-open', open);
  };

  menuButton?.addEventListener('click', () => {
    setMenuOpen(menuButton.getAttribute('aria-expanded') !== 'true');
  });

  mobileMenu?.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => setMenuOpen(false));
  });

  window.addEventListener('keydown', event => {
    if (event.key === 'Escape') setMenuOpen(false);
  });

  const dist = 40 - 2 - 16 - 2;
  const applyState = (dark) => {
    document.body.classList.toggle('dark', dark);
    knob.style.transform = `translateX(${dark ? dist : 0}px)`;
    switchBtn.setAttribute('aria-checked', String(dark));
    try { localStorage.setItem('theme-dark', dark ? '1' : '0'); } catch (e) {}
  };

  // Load persisted theme
  let storedDark = null;
  try {
    const v = localStorage.getItem('theme-dark');
    if (v === '1') storedDark = true;
    if (v === '0') storedDark = false;
  } catch (e) {}
  applyState(storedDark !== null ? storedDark : document.body.classList.contains('dark'));

  switchBtn.addEventListener('click', () => {
    const dark = !document.body.classList.contains('dark');
    applyState(dark);
    const x = dark ? dist : 0;
    knob.animate(
      [
        { transform: `translateX(${x}px)` },
        { transform: `translateX(${dark ? x + 2 : x - 2}px)` },
        { transform: `translateX(${x}px)` },
      ],
      { duration: 350, easing: 'cubic-bezier(0.25, 1.5, 0.5, 1)' }
    );
  });
})();
