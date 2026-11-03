// Shared navigation for every page using the site header.
const sections = [
  ['Products', [['Property Tax Tool', 'property-tax.html'], ['ROI Tool', 'roi-calculator.html'], ['Loan Tool', 'loan-tool.html']]],
  ['Solutions', [['Insurance', 'insurance.html'], ['How Taxes Work', 'how-property-taxes-work.html'], ['FAQ', 'index.html#faq']]],
  ['Company', [['Partners', 'partners.html'], ['Contact', 'index.html#contact']]],
];

function initSiteNavigation() {
  const navbar = document.querySelector('.navbar');
  const desktop = navbar?.querySelector('.nav-links');
  if (!desktop) return;
  const current = (location.pathname.replace(/\/+$/, '').split('/').pop() || 'index').replace(/\.html$/, '');
  const active = href => href.split('#')[0].replace(/\.html$/, '') === current && !href.includes('#');
  const chevron = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 9 6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

  desktop.innerHTML = sections.map(([title, links], index) => `
    <li class="nav-dropdown">
      <button type="button" class="nav-dropdown-trigger${links.some(([, href]) => active(href)) ? ' active' : ''}" aria-haspopup="true" aria-expanded="false" aria-controls="site-nav-menu-${index}">${title}${chevron}</button>
      <div class="nav-dropdown-menu" id="site-nav-menu-${index}">${links.map(([label, href]) => `<a href="${href}"${active(href) ? ' class="active" aria-current="page"' : ''}>${label}</a>`).join('')}</div>
    </li>`).join('');

  let mobile = navbar.querySelector('#mobile-menu');
  if (!mobile) {
    mobile = document.createElement('div');
    mobile.id = 'mobile-menu';
    mobile.className = 'mobile-menu';
    navbar.append(mobile);
  }
  mobile.innerHTML = `<ul class="mobile-nav-links">${sections.map(([title, links]) => `<li class="mobile-nav-group"><span>${title}</span>${links.map(([label, href]) => `<a href="${href}"${active(href) ? ' class="active" aria-current="page"' : ''}>${label}</a>`).join('')}</li>`).join('')}</ul>`;

  let actions = navbar.querySelector('.nav-actions');
  if (!actions) {
    actions = document.createElement('div');
    actions.className = 'nav-actions';
    navbar.querySelector('.nav-container').append(actions);
  }
  let toggle = navbar.querySelector('#mobile-toggle');
  if (!toggle) {
    toggle = document.createElement('button');
    toggle.id = 'mobile-toggle';
    toggle.className = 'mobile-toggle';
    toggle.innerHTML = '<span></span><span></span><span></span>';
    actions.append(toggle);
  }
  toggle.type = 'button';
  toggle.setAttribute('aria-label', 'Open menu');
  toggle.setAttribute('aria-controls', 'mobile-menu');
  toggle.setAttribute('aria-expanded', 'false');
  toggle.addEventListener('click', () => {
    const open = !mobile.classList.contains('active');
    mobile.classList.toggle('active', open);
    toggle.classList.toggle('active', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  });
  mobile.addEventListener('click', event => {
    if (!event.target.closest('a')) return;
    mobile.classList.remove('active');
    toggle.classList.remove('active');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Open menu');
  });

  const closeMenus = except => navbar.querySelectorAll('.nav-dropdown').forEach(menu => {
    if (menu === except) return;
    menu.classList.remove('is-open');
    menu.querySelector('.nav-dropdown-trigger')?.setAttribute('aria-expanded', 'false');
  });
  navbar.addEventListener('click', event => {
    const trigger = event.target.closest('.nav-dropdown-trigger');
    if (!trigger || !navbar.contains(trigger)) return;
    const menu = trigger.closest('.nav-dropdown');
    const open = !menu.classList.contains('is-open');
    closeMenus(menu);
    menu.classList.remove('is-dismissed');
    menu.classList.toggle('is-open', open);
    trigger.setAttribute('aria-expanded', String(open));
  });
  navbar.addEventListener('mouseenter', event => {
    const menu = event.target.closest?.('.nav-dropdown');
    if (menu && navbar.contains(menu) && !menu.classList.contains('is-dismissed')) menu.querySelector('.nav-dropdown-trigger')?.setAttribute('aria-expanded', 'true');
  }, true);
  navbar.addEventListener('mouseleave', event => {
    const menu = event.target.closest?.('.nav-dropdown');
    if (menu && !menu.contains(event.relatedTarget)) {
      menu.classList.remove('is-dismissed');
      if (!menu.classList.contains('is-open')) menu.querySelector('.nav-dropdown-trigger')?.setAttribute('aria-expanded', 'false');
    }
  }, true);
  navbar.addEventListener('focusout', event => {
    const menu = event.target.closest?.('.nav-dropdown');
    if (menu && !menu.contains(event.relatedTarget)) menu.classList.remove('is-dismissed');
  });
  document.addEventListener('click', event => { if (!navbar.contains(event.target)) closeMenus(); });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    const open = navbar.querySelector('.nav-dropdown:focus-within') || navbar.querySelector('.nav-dropdown.is-open') || navbar.querySelector('.nav-dropdown:hover');
    closeMenus();
    if (open) {
      open.querySelector('.nav-dropdown-trigger')?.focus();
      open.classList.add('is-dismissed');
    }
    mobile.classList.remove('active');
    toggle.classList.remove('active');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Open menu');
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initSiteNavigation, { once: true });
else initSiteNavigation();
