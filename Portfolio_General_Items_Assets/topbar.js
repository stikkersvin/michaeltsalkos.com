// Inject shared top bar
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
  const isFonts = path.includes('/Portfolio_Fonts_Tab/');
  const primaryLink = isFonts ? linkGraphic : linkFonts;
  const primaryLabel = isFonts ? 'Graphic Design' : 'Fonts';

  const TOPBAR_HTML = `
    <header class="topbar-header"><a href="${linkGraphic}">MICHAEL TSALKOS™</a></header>
    <nav class="topbar-nav">
      <a href="${primaryLink}">${primaryLabel}</a>
      <a href="${linkAbout}">About</a>
    </nav>
  `;

  const wrapper = document.createElement('div');
  wrapper.innerHTML = TOPBAR_HTML.trim();
  const frag = document.createDocumentFragment();
  while (wrapper.firstChild) {
    frag.appendChild(wrapper.firstChild);
  }
  document.body.appendChild(frag);

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
})();
