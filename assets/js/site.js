/* Shared nav + mobile menu */
(function () {
  const toggle = document.querySelector('.nav-toggle');
  const links = document.querySelector('.nav-links');
  if (toggle && links) {
    toggle.addEventListener('click', () => {
      const open = links.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  // Mark current nav item
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
