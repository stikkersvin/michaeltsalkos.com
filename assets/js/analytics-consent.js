(function () {
  const measurementId = 'G-BXM3D8V356';
  const storageKey = 'analytics-consent';

  function loadAnalytics() {
    if (window.__analyticsLoaded) return;
    window.__analyticsLoaded = true;

    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() {
      window.dataLayer.push(arguments);
    };

    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    document.head.appendChild(script);

    window.gtag('js', new Date());
    window.gtag('config', measurementId);
  }

  function saveChoice(choice) {
    try {
      window.localStorage.setItem(storageKey, choice);
    } catch (error) {}
  }

  function readChoice() {
    try {
      return window.localStorage.getItem(storageKey);
    } catch (error) {
      return null;
    }
  }

  function buildBanner() {
    const style = document.createElement('style');
    style.textContent = `
      .cookie-consent {
        position: fixed;
        right: 1rem;
        bottom: 1rem;
        z-index: 100000;
        display: flex;
        align-items: center;
        gap: 0.8rem;
        max-width: min(28rem, calc(100vw - 2rem));
        padding: 0.9rem 1rem;
        border: 1px solid rgba(10, 10, 10, 0.16);
        background: rgba(255, 255, 255, 0.96);
        color: #0a0a0a;
        font: 400 0.82rem/1.25 "Helvetica Neue", Helvetica, Arial, sans-serif;
        box-shadow: 0 0.5rem 2rem rgba(0, 0, 0, 0.12);
      }

      .cookie-consent p {
        margin: 0;
      }

      .cookie-consent-actions {
        display: flex;
        flex: 0 0 auto;
        gap: 0.45rem;
      }

      .cookie-consent button {
        border: 1px solid currentColor;
        background: transparent;
        color: inherit;
        cursor: pointer;
        font: inherit;
        padding: 0.42rem 0.58rem;
      }

      .cookie-consent button[data-cookie-accept] {
        background: #0a0a0a;
        color: #fff;
      }

      @media (max-width: 560px) {
        .cookie-consent {
          left: 1rem;
          right: 1rem;
          align-items: stretch;
          flex-direction: column;
        }

        .cookie-consent-actions {
          width: 100%;
        }

        .cookie-consent button {
          flex: 1 1 0;
        }
      }
    `;

    const banner = document.createElement('div');
    banner.className = 'cookie-consent';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-label', 'Cookie consent');
    banner.innerHTML = `
      <p>This site uses Google Analytics to understand visits.</p>
      <div class="cookie-consent-actions">
        <button type="button" data-cookie-reject>Reject</button>
        <button type="button" data-cookie-accept>Accept</button>
      </div>
    `;

    const removeBanner = () => {
      banner.remove();
      style.remove();
    };

    banner.querySelector('[data-cookie-accept]').addEventListener('click', () => {
      saveChoice('accepted');
      loadAnalytics();
      removeBanner();
    });

    banner.querySelector('[data-cookie-reject]').addEventListener('click', () => {
      saveChoice('rejected');
      removeBanner();
    });

    document.head.appendChild(style);
    document.body.appendChild(banner);
  }

  function init() {
    const choice = readChoice();
    if (choice === 'accepted') {
      loadAnalytics();
      return;
    }

    if (choice !== 'rejected') {
      buildBanner();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
