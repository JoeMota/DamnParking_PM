/* Shared nav + scroll styling */
(function () {
  const toggle = document.querySelector('.nav-toggle');
  const links = document.querySelector('.nav-links');
  const nav = document.querySelector('.site-nav');

  if (toggle && links) {
    toggle.addEventListener('click', () => {
      const open = links.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  if (nav) {
    const onScroll = () => {
      nav.classList.toggle('is-scrolled', window.scrollY > 24);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  const path = location.pathname.replace(/\/$/, '') || '/';
  document.querySelectorAll('.nav-links a, .subnav a').forEach((a) => {
    try {
      const href = new URL(a.href).pathname.replace(/\/$/, '') || '/';
      if (href === path || (href !== '/' && path.endsWith(href))) {
        a.setAttribute('aria-current', 'page');
      }
    } catch (_) { /* ignore */ }
  });
})();
