// Inject shared top bar and handle desktop dark mode toggle
(function () {
  // Set the initial theme before measuring the bar. A layout measurement with
  // the light theme first would start a background fade on every new page.
  let storedDark = null;
  try {
    const value = localStorage.getItem('theme-dark');
    if (value === '1') storedDark = true;
    if (value === '0') storedDark = false;
  } catch (error) {}
  document.body.classList.toggle('dark', storedDark !== null ? storedDark : true);

  document.querySelectorAll(
    '.site-topbar, .site-copyright, .topbar-nav, .topbar-header, .topbar-mobile-nav, .topbar-about, .topbar-switch'
  ).forEach((element) => element.remove());

  const path = decodeURIComponent(window.location.pathname || '');
  const base = new URL('../', document.currentScript.src).href.replace(/\/$/, '');
  const linkGraphic = `${base}/index.html?view=spatial`;
  const linkFonts = `${base}/Portfolio_Fonts_Tab/Portfolio_Fonts_Landingpage/fonts.html`;
  const linkAbout = `${base}/Portfolio_About/about.html`;
  const isFonts = path.includes('/Portfolio_Fonts_Tab/');
  const isAbout = path.includes('/Portfolio_About/');

  // Fonts lives to the left; About lives below. Animate the navigation
  // snapshots without loading either page's media in advance.
  const pageTransitionDirection = (from, to) => {
    if (!from || !to) return null;
    const fromURL = new URL(from);
    const toURL = new URL(to);
    if (fromURL.origin !== toURL.origin) return null;
    const aboutPath = new URL(linkAbout).pathname;
    const fontsPath = new URL(linkFonts).pathname;
    const workPath = new URL(linkGraphic).pathname;
    const isWork = (url) => url.pathname === workPath || url.pathname === new URL(`${base}/`).pathname;
    const isTopLevel = (url) => isWork(url) || url.pathname === fontsPath;
    if (isTopLevel(fromURL) && toURL.pathname === aboutPath) return 'to-about';
    if (fromURL.pathname === aboutPath && isTopLevel(toURL)) return 'from-about';
    if (isWork(fromURL) && toURL.pathname === fontsPath) return 'to-fonts';
    if (fromURL.pathname === fontsPath && isWork(toURL)) return 'from-fonts';
    return null;
  };
  const preparePageTransition = (transition, from, to) => {
    if (!transition) return;
    const direction = pageTransitionDirection(from, to);
    if (!direction || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      transition.skipTransition();
      return;
    }
    document.documentElement.dataset.viewDirection = direction;
    transition.ready.catch(() => {});
    transition.finished.catch(() => {}).finally(() => {
      if (document.documentElement.dataset.viewDirection === direction) {
        delete document.documentElement.dataset.viewDirection;
      }
    });
  };
  window.addEventListener('pageswap', (event) => {
    preparePageTransition(event.viewTransition, location.href, event.activation?.entry?.url);
  });
  window.addEventListener('pagereveal', (event) => {
    preparePageTransition(event.viewTransition, window.navigation?.activation?.from?.url, location.href);
  });

  // Older browsers can animate ordinary elements even without page snapshots.
  // Keep the shared bar outside these animations, and animate only after a
  // navigation is requested: no destination media needs to be preloaded.
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const fallbackKey = 'portfolio-pending-push';
  const pushVectors = {
    'to-all': [-1, 0], 'from-fonts': [-1, 0],
    'to-selected': [1, 0], 'to-fonts': [1, 0],
    'to-about': [0, -1], 'from-about': [0, 1]
  };
  const fallbackAnimations = new Set();
  async function animatePage(direction, entering) {
    if (motionPreference.matches || !Element.prototype.animate) return;
    const vector = pushVectors[direction];
    if (!vector) return;
    document.documentElement.classList.add('portfolio-push-active');
    const offset = `translate(${vector[0] * innerWidth * (entering ? -1 : 1)}px, ${vector[1] * innerHeight * (entering ? -1 : 1)}px)`;
    const animations = Array.from(document.body.children)
      .filter((element) => !element.matches('.site-topbar, script, style, link') && element.getClientRects().length)
      .map((element) => element.animate(
        [{ transform: entering ? offset : 'translate(0, 0)' },
          { transform: entering ? 'translate(0, 0)' : offset }],
        { duration: 325, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'both', composite: 'add' }
      ));
    animations.forEach((animation) => fallbackAnimations.add(animation));
    await Promise.all(animations.map((animation) => animation.finished.catch(() => {})));
  }
  function clearPageAnimations() {
    fallbackAnimations.forEach((animation) => animation.cancel());
    fallbackAnimations.clear();
    document.documentElement.classList.remove('portfolio-push-active');
  }
  window.portfolioPushTransition = async (update, direction) => {
    try {
      await animatePage(direction, false);
      await update();
      clearPageAnimations();
      await animatePage(direction, true);
    } finally {
      clearPageAnimations();
    }
  };
  motionPreference.addEventListener('change', clearPageAnimations);
  // Cancel retained exit styles when Back restores a page from memory.
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
      clearPageAnimations();
      fallbackNavigating = false;
    }
  });

  const nativePageTransitions = 'onpageswap' in window && 'onpagereveal' in window
    && typeof CSSViewTransitionRule !== 'undefined';
  let fallbackNavigating = false;
  document.addEventListener('click', async (event) => {
    const anchor = event.target.closest?.('.site-topbar a[href]');
    if (!anchor || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey
      || event.shiftKey || event.altKey || anchor.hasAttribute('download')
      || (anchor.target && anchor.target !== '_self') || nativePageTransitions || motionPreference.matches) return;
    const direction = pageTransitionDirection(location.href, anchor.href);
    if (!direction) return;
    if (fallbackNavigating) { event.preventDefault(); return; }
    // Storage carries only a URL and direction, never page markup or assets.
    try {
      sessionStorage.setItem(fallbackKey, JSON.stringify({ url: anchor.href, direction, time: Date.now() }));
    } catch (error) { return; }
    event.preventDefault();
    fallbackNavigating = true;
    await animatePage(direction, false);
    location.assign(anchor.href);
  });
  const enterFallbackPage = () => {
    let pending;
    try {
      pending = JSON.parse(sessionStorage.getItem(fallbackKey));
      sessionStorage.removeItem(fallbackKey);
    } catch (error) { return; }
    if (!pending || pending.url !== location.href || Date.now() - pending.time > 15000) return;
    animatePage(pending.direction, true).finally(clearPageAnimations);
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', enterFallbackPage, { once: true });
  } else {
    enterFallbackPage();
  }

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
      <img class="topbar-knob" id="sharedKnob" src="${base}/favicon.png" alt="" aria-hidden="true" draggable="false" />
    </button>
    </div>
    </div>
    <small class="site-copyright">©2026</small>
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

  const copyright = document.querySelector('.site-copyright');
  const copyrightViewport = window.matchMedia('(max-width: 760px) and (pointer: coarse)');
  function positionCopyright() {
    const rail = document.querySelector('.mobile-selected-rail');
    const target = copyrightViewport.matches && rail ? rail
      : copyrightViewport.matches && isAbout ? document.querySelector('.experience-panel')
      : document.body.classList.contains('list-view') ? document.querySelector('.work-grid')
      : document.querySelector('.fonts-page') || document.body;
    target?.appendChild(copyright);
  }
  copyrightViewport.addEventListener('change', () => window.requestAnimationFrame(positionCopyright));
  window.addEventListener('portfolio:viewchange', positionCopyright);

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
    sharedBar.querySelectorAll('.topbar-links a, .topbar-tools > a, .topbar-view-links a, .view-toggle button')
      .forEach((item) => item.classList.add('topbar-item'));
    positionCopyright();
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

  applyState(storedDark !== null ? storedDark : true);

  switchBtn.addEventListener('click', () => {
    const dark = !document.body.classList.contains('dark');
    applyState(dark);
  });
})();
