// Main App JavaScript - Shared functionality across all pages
let selectedContactProperty = null;
let contactSuggestionAbort = null;
let selectedHomeProperty = null;
let homeSuggestionAbort = null;

document.addEventListener('DOMContentLoaded', function () {
    initThemeToggle();
    initMobileMenu();
    initScrollAnimations();
    initNavigation();
    initAppealDeadlineCalendar();
    initHeroAnimations();
    initPreviewTools();
    initFAQ();
    initContactForm();
    initHomePropertySearch();
});

// ========================================
// Theme Toggle (Dark Mode)
// ========================================
function initThemeToggle() {
    const toggle = document.getElementById('theme-toggle');
    const savedTheme = localStorage.getItem('theme') || 'light';

    document.documentElement.setAttribute('data-theme', savedTheme);

    toggle?.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme');
        const newTheme = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
    });
}

// ========================================
// Mobile Menu
// ========================================
function initMobileMenu() {
    const toggle = document.getElementById('mobile-toggle');
    const menu = document.getElementById('mobile-menu');

    toggle?.addEventListener('click', () => {
        toggle.classList.toggle('active');
        menu.classList.toggle('active');
    });

    // Close on link click
    document.querySelectorAll('.mobile-nav-links a').forEach(link => {
        link.addEventListener('click', () => {
            toggle?.classList.remove('active');
            menu?.classList.remove('active');
        });
    });
}

// ========================================
// Scroll Animations
// ========================================
function initScrollAnimations() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

    document.querySelectorAll('.animate-on-scroll, .animate-bar').forEach(el => {
        observer.observe(el);
    });
}

// ========================================
// Navigation
// ========================================
function initNavigation() {
    const navbar = document.querySelector('.navbar');

    window.addEventListener('scroll', () => {
        if (window.scrollY > 100) {
            navbar.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.1)';
        } else {
            navbar.style.boxShadow = 'none';
        }
    });

    // Smooth scroll for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(link => {
        link.addEventListener('click', e => {
            const href = link.getAttribute('href');
            if (href.length > 1) {
                const target = document.querySelector(href);
                if (target) {
                    e.preventDefault();
                    target.scrollIntoView({ behavior: 'smooth' });
                }
            }
        });
    });
}

// ========================================
// Appeal Deadline Calendar
// ========================================
function initAppealDeadlineCalendar() {
    const grid = document.getElementById('appeal-calendar-grid');
    const title = document.getElementById('appeal-calendar-title');
    const prevButton = document.getElementById('appeal-calendar-prev');
    const nextButton = document.getElementById('appeal-calendar-next');
    const list = document.getElementById('appeal-deadline-list');
    const count = document.getElementById('appeal-deadline-count');

    if (!grid || !title) return;

    const today = getCentralDate();
    let visibleMonth = today.getMonth();
    let visibleYear = today.getFullYear();

    const render = () => {
        renderAppealCalendarMonth(grid, title, visibleYear, visibleMonth, today);
        renderAppealDeadlineDashboard(list, count, today);
    };

    prevButton?.addEventListener('click', () => {
        const nextDate = new Date(visibleYear, visibleMonth - 1, 1);
        visibleMonth = nextDate.getMonth();
        visibleYear = nextDate.getFullYear();
        render();
    });

    nextButton?.addEventListener('click', () => {
        const nextDate = new Date(visibleYear, visibleMonth + 1, 1);
        visibleMonth = nextDate.getMonth();
        visibleYear = nextDate.getFullYear();
        render();
    });

    render();
}

function getCentralDate() {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Chicago',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric'
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return new Date(Number(values.year), Number(values.month) - 1, Number(values.day));
}

function hasAppealDate(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
}

function parseLocalDate(value) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
}

function getPostedAppealDeadlines() {
    const rows = Array.isArray(window.APPEAL_DEADLINES) ? window.APPEAL_DEADLINES : [];
    return rows
        .filter(item => hasAppealDate(item.start) && hasAppealDate(item.deadline))
        .map(item => ({
            ...item,
            startDate: parseLocalDate(item.start),
            deadlineDate: parseLocalDate(item.deadline)
        }));
}

function toDateKey(date) {
    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, '0'),
        String(date.getDate()).padStart(2, '0')
    ].join('-');
}

function formatShortDate(date) {
    return new Intl.DateTimeFormat('en-US', {
        month: 'numeric',
        day: 'numeric',
        year: 'numeric'
    }).format(date);
}

function renderAppealCalendarMonth(grid, title, year, month, today) {
    title.textContent = new Intl.DateTimeFormat('en-US', {
        month: 'long',
        year: 'numeric'
    }).format(new Date(year, month, 1));
    grid.innerHTML = '';

    const deadlinesByDate = getPostedAppealDeadlines()
        .filter(item => item.deadlineDate >= today)
        .reduce((map, item) => {
            const key = toDateKey(item.deadlineDate);
            if (!map.has(key)) map.set(key, []);
            map.get(key).push(item);
            return map;
        }, new Map());

    ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach(day => {
        const header = document.createElement('div');
        header.className = 'calendar-day-header';
        header.textContent = day;
        grid.appendChild(header);
    });

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startOffset = firstDay.getDay();
    const totalCells = Math.ceil((startOffset + lastDay.getDate()) / 7) * 7;

    for (let cell = 0; cell < totalCells; cell += 1) {
        const date = new Date(year, month, cell - startOffset + 1);
        const deadlines = deadlinesByDate.get(toDateKey(date)) || [];
        const day = document.createElement('button');
        day.type = 'button';
        day.className = 'calendar-day';
        day.textContent = String(date.getDate());
        if (date.getMonth() !== month) day.classList.add('is-outside');
        if (toDateKey(date) === toDateKey(today)) day.classList.add('today');
        if (deadlines.length) {
            day.classList.add('deadline');
            day.setAttribute('aria-label', `${formatShortDate(date)} deadline: ${deadlines.map(item => item.township).join(', ')}`);
        }
        grid.appendChild(day);
    }
}

function renderAppealDeadlineDashboard(list, count, today) {
    if (!list || !count) return;

    const upcoming = getPostedAppealDeadlines()
        .filter(item => item.deadlineDate >= today)
        .sort((a, b) => a.deadlineDate - b.deadlineDate || a.township.localeCompare(b.township));

    count.textContent = `${upcoming.length} upcoming`;
    list.innerHTML = '';

    if (!upcoming.length) {
        const empty = document.createElement('p');
        empty.className = 'deadline-dashboard-empty';
        empty.textContent = 'No future appeal deadlines are posted yet. Check the official calendar for the newest schedule.';
        list.appendChild(empty);
        return;
    }

    upcoming.forEach(item => {
        const row = document.createElement('div');
        row.className = 'deadline-dashboard-row';

        const township = document.createElement('div');
        township.className = 'deadline-dashboard-township';
        township.textContent = item.township;

        const dates = document.createElement('div');
        dates.className = 'deadline-dashboard-dates';

        const deadline = document.createElement('strong');
        deadline.textContent = `Deadline: ${formatShortDate(item.deadlineDate)}`;

        const window = document.createElement('span');
        window.textContent = `${formatShortDate(item.startDate)} - ${formatShortDate(item.deadlineDate)}`;

        dates.append(deadline, window);
        row.append(township, dates);
        list.appendChild(row);
    });
}

// ========================================
// Hero Animations
// ========================================
function initHeroAnimations() {
    const statNumbers = document.querySelectorAll('.stat-number [data-count]');

    const animateCounter = (el, target) => {
        const duration = 2000;
        const step = target / (duration / 16);
        let current = 0;

        const update = () => {
            current += step;
            if (current < target) {
                el.textContent = Math.floor(current);
                requestAnimationFrame(update);
            } else {
                el.textContent = target;
            }
        };
        update();
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const target = parseInt(entry.target.getAttribute('data-count'));
                animateCounter(entry.target, target);
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.5 });

    statNumbers.forEach(stat => observer.observe(stat));
}

// ========================================
// Preview Tools (Home Page)
// ========================================
function initPreviewTools() {
    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(btn.dataset.tab + '-preview')?.classList.add('active');

            if (btn.dataset.tab === 'property' && !previewMapInitialized) {
                initPreviewMap();
            }
        });
    });

    // Preview search
    document.getElementById('preview-search')?.addEventListener('click', () => {
        const address = document.getElementById('preview-address').value.trim();
        if (!address) {
            showNotification('Enter an address', 'error');
            return;
        }
        showNotification('Use the full Property Tax Tool for detailed analysis!', 'info');
    });

    // Preview ROI calc
    document.getElementById('preview-calc-roi')?.addEventListener('click', () => {
        const price = getInputValue('preview-price') || 300000;
        const rent = getInputValue('preview-rent') || 2500;
        const noi = (rent * 12 * 0.95) - (rent * 2.4);
        const cap = (noi / price * 100).toFixed(1);
        const coc = ((noi - price * 0.8 * 0.065 / 12 * 12) / (price * 0.2) * 100).toFixed(1);
        document.getElementById('preview-cap').textContent = cap + '%';
        document.getElementById('preview-coc').textContent = coc + '%';
    });

    // Preview Loan calc
    document.getElementById('preview-calc-loan')?.addEventListener('click', () => {
        const loan = getInputValue('preview-loan') || 240000;
        const rate = getInputValue('preview-rate') || 6.5;
        const monthlyRate = rate / 100 / 12;
        const n = 360;
        const payment = loan * (monthlyRate * Math.pow(1 + monthlyRate, n)) / (Math.pow(1 + monthlyRate, n) - 1);
        const totalInterest = (payment * n) - loan;
        document.getElementById('preview-payment').textContent = formatCurrency(payment);
        document.getElementById('preview-interest').textContent = formatCurrency(totalInterest);
    });

    // Init preview map on first load if visible
    setTimeout(initPreviewMap, 500);
}

let previewMapInitialized = false;
function initPreviewMap() {
    const container = document.getElementById('preview-map');
    if (!container || previewMapInitialized || typeof L === 'undefined') return;

    try {
        const map = L.map(container).setView([41.8781, -87.6298], 12);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap'
        }).addTo(map);

        L.marker([41.8781, -87.6298]).addTo(map)
            .bindPopup('Chicago, IL - Enter an address to analyze');

        previewMapInitialized = true;
    } catch (e) {
        console.log('Map init skipped');
    }
}

// ========================================
// FAQ Accordion
// ========================================
function initFAQ() {
    document.querySelectorAll('.faq-question').forEach(button => {
        button.addEventListener('click', () => {
            const item = button.parentElement;
            const isActive = item.classList.contains('active');

            // Close all other items
            document.querySelectorAll('.faq-item').forEach(i => {
                i.classList.remove('active');
            });

            // Toggle current item
            if (!isActive) {
                item.classList.add('active');
            }
        });
    });
}

// ========================================
// Contact Form
// ========================================
function initContactForm() {
    const form = document.getElementById('contact-form');
    if (!form) return;

    initContactAddressSearch(form);
    initContactFieldValidation(form);

    form.addEventListener('submit', async e => {
        e.preventDefault();

        const btn = form.querySelector('button[type="submit"]');
        const originalText = btn.innerHTML;

        try {
            if (!validateContactForm(form)) return;

            btn.innerHTML = '<svg class="spinner" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" opacity="0.3" fill="none"/><path d="M12 2C6.47715 2 2 6.47715 2 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/></svg> Sending...';
            btn.disabled = true;

            const response = await fetch('/api/contact', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: document.getElementById('name')?.value.trim(),
                    email: document.getElementById('email')?.value.trim(),
                    phone: document.getElementById('phone')?.value.trim(),
                    propertyAddress: document.getElementById('property-address-contact')?.value.trim(),
                    inquiryType: document.getElementById('inquiry-type')?.value.trim(),
                    message: document.getElementById('message')?.value.trim()
                })
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({ error: 'Message could not be sent.' }));
                throw new Error(error.error || 'Message could not be sent.');
            }

            const data = await response.json().catch(() => ({}));
            showNotification(data.emailSent === false
                ? 'Message received. We\'ll be in touch soon.'
                : 'Message sent! We\'ll be in touch soon.', 'success');
            form.reset();
            selectedContactProperty = null;
            hideContactAddressSuggestions();
        } catch (error) {
            showNotification(error.message || 'Message could not be sent.', 'error');
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    });
}

function initHomePropertySearch() {
    const search = document.getElementById('home-property-search');
    if (!search) return;

    const addressInput = document.getElementById('home-property-address');
    const suggestions = document.getElementById('home-address-suggestions');
    const analyzeBtn = document.getElementById('home-analyze-property');
    if (!addressInput || !suggestions || !analyzeBtn) return;

    addressInput.addEventListener('input', debounceContact(() => {
        selectedHomeProperty = null;
        analyzeBtn.hidden = true;
        fetchHomeAddressSuggestions(addressInput.value.trim());
    }, 220));

    addressInput.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
            hideHomeAddressSuggestions();
        } else if (event.key === 'Enter' && suggestions.classList.contains('is-visible')) {
            const firstSuggestion = suggestions.querySelector('[data-property-id]');
            if (firstSuggestion) {
                event.preventDefault();
                selectHomeAddressSuggestion(firstSuggestion);
            }
        }
    });

    suggestions.addEventListener('click', event => {
        const button = event.target.closest('[data-property-id]');
        if (!button) return;
        selectHomeAddressSuggestion(button);
    });

    analyzeBtn.addEventListener('click', () => {
        if (!selectedHomeProperty) {
            showNotification('Please choose a property from the suggestions', 'error');
            return;
        }

        const params = new URLSearchParams({
            propertyId: String(selectedHomeProperty.id),
            pin: selectedHomeProperty.pin || '',
            address: selectedHomeProperty.address,
            auto: '1'
        });
        window.location.href = `property-tax.html?${params.toString()}`;
    });

    document.addEventListener('click', event => {
        if (!event.target.closest('#home-property-search .address-search-wrap')) {
            hideHomeAddressSuggestions();
        }
    });
}

async function fetchHomeAddressSuggestions(query) {
    const suggestions = document.getElementById('home-address-suggestions');
    if (!suggestions) return;

    if (homeSuggestionAbort) {
        homeSuggestionAbort.abort();
    }

    if (query.length < 3) {
        suggestions.innerHTML = '';
        suggestions.classList.remove('is-visible');
        return;
    }

    homeSuggestionAbort = new AbortController();
    suggestions.innerHTML = '<div class="address-suggestion-helper">Searching Cook County addresses...</div>';
    suggestions.classList.add('is-visible');

    try {
        const response = await fetch(`/api/property/suggest?q=${encodeURIComponent(query)}&limit=5`, {
            signal: homeSuggestionAbort.signal
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Unable to load suggestions');

        renderHomeAddressSuggestions(data.suggestions || []);
    } catch (error) {
        if (error.name === 'AbortError') return;
        suggestions.innerHTML = '<div class="address-suggestion-helper">Could not load suggestions.</div>';
    }
}

function renderHomeAddressSuggestions(items) {
    const suggestions = document.getElementById('home-address-suggestions');
    if (!suggestions) return;

    if (!items.length) {
        suggestions.innerHTML = '<div class="address-suggestion-helper">No close matches yet. Try the full street number, street name, city, or ZIP.</div>';
        suggestions.classList.add('is-visible');
        return;
    }

    suggestions.innerHTML = items.map(item => `
        <button type="button" class="address-suggestion" data-property-id="${escapeHtml(item.id)}"
            data-address="${escapeHtml(item.address)}" data-pin="${escapeHtml(item.pin || '')}">
            ${escapeHtml(item.address)}
            <span>${item.pin ? `PIN ${escapeHtml(item.pin)}` : 'Cook County property record'}</span>
        </button>
    `).join('');
    suggestions.classList.add('is-visible');
}

function selectHomeAddressSuggestion(button) {
    const addressInput = document.getElementById('home-property-address');
    const analyzeBtn = document.getElementById('home-analyze-property');
    if (!addressInput || !analyzeBtn) return;

    selectedHomeProperty = {
        id: Number(button.dataset.propertyId),
        pin: button.dataset.pin || '',
        address: button.dataset.address || button.textContent.trim()
    };
    addressInput.value = selectedHomeProperty.address;
    analyzeBtn.hidden = false;
    hideHomeAddressSuggestions();
}

function hideHomeAddressSuggestions() {
    document.getElementById('home-address-suggestions')?.classList.remove('is-visible');
}

function initContactAddressSearch(form) {
    const addressInput = form.querySelector('#property-address-contact');
    const suggestions = form.querySelector('#contact-address-suggestions');
    if (!addressInput || !suggestions) return;

    addressInput.addEventListener('input', debounceContact(() => {
        selectedContactProperty = null;
        addressInput.setCustomValidity('');
        fetchContactAddressSuggestions(addressInput.value.trim());
    }, 220));

    addressInput.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
            hideContactAddressSuggestions();
        } else if (event.key === 'Enter' && suggestions.classList.contains('is-visible')) {
            const firstSuggestion = suggestions.querySelector('[data-property-id]');
            if (firstSuggestion) {
                event.preventDefault();
                selectContactAddressSuggestion(firstSuggestion);
            }
        }
    });

    suggestions.addEventListener('click', event => {
        const button = event.target.closest('[data-property-id]');
        if (!button) return;
        selectContactAddressSuggestion(button);
    });

    document.addEventListener('click', event => {
        if (!event.target.closest('#contact-form .address-search-wrap')) {
            hideContactAddressSuggestions();
        }
    });
}

function initContactFieldValidation(form) {
    const emailInput = form.querySelector('#email');
    const phoneInput = form.querySelector('#phone');

    emailInput?.addEventListener('input', () => emailInput.setCustomValidity(''));
    phoneInput?.addEventListener('input', () => phoneInput.setCustomValidity(''));
}

async function fetchContactAddressSuggestions(query) {
    const suggestions = document.getElementById('contact-address-suggestions');
    if (!suggestions) return;

    if (contactSuggestionAbort) {
        contactSuggestionAbort.abort();
    }

    if (query.length < 3) {
        suggestions.innerHTML = '';
        suggestions.classList.remove('is-visible');
        return;
    }

    contactSuggestionAbort = new AbortController();
    suggestions.innerHTML = '<div class="address-suggestion-helper">Searching Cook County addresses...</div>';
    suggestions.classList.add('is-visible');

    try {
        const response = await fetch(`/api/property/suggest?q=${encodeURIComponent(query)}&limit=5`, {
            signal: contactSuggestionAbort.signal
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Unable to load suggestions');

        renderContactAddressSuggestions(data.suggestions || []);
    } catch (error) {
        if (error.name === 'AbortError') return;
        suggestions.innerHTML = '<div class="address-suggestion-helper">Could not load suggestions.</div>';
    }
}

function renderContactAddressSuggestions(items) {
    const suggestions = document.getElementById('contact-address-suggestions');
    if (!suggestions) return;

    if (!items.length) {
        suggestions.innerHTML = '<div class="address-suggestion-helper">No close matches yet. Try the full street number, street name, city, or ZIP.</div>';
        suggestions.classList.add('is-visible');
        return;
    }

    suggestions.innerHTML = items.map(item => `
        <button type="button" class="address-suggestion" data-property-id="${escapeHtml(item.id)}"
            data-address="${escapeHtml(item.address)}" data-pin="${escapeHtml(item.pin || '')}">
            ${escapeHtml(item.address)}
            <span>${item.pin ? `PIN ${escapeHtml(item.pin)}` : 'Cook County property record'}</span>
        </button>
    `).join('');
    suggestions.classList.add('is-visible');
}

function selectContactAddressSuggestion(button) {
    const addressInput = document.getElementById('property-address-contact');
    if (!addressInput) return;

    selectedContactProperty = {
        id: Number(button.dataset.propertyId),
        pin: button.dataset.pin || '',
        address: button.dataset.address || button.textContent.trim()
    };
    addressInput.value = selectedContactProperty.address;
    addressInput.setCustomValidity('');
    hideContactAddressSuggestions();
}

function hideContactAddressSuggestions() {
    document.getElementById('contact-address-suggestions')?.classList.remove('is-visible');
}

function validateContactForm(form) {
    const emailInput = form.querySelector('#email');
    const phoneInput = form.querySelector('#phone');
    const addressInput = form.querySelector('#property-address-contact');
    const email = emailInput?.value.trim() || '';
    const phone = phoneInput?.value.trim() || '';
    const address = addressInput?.value.trim() || '';

    emailInput?.setCustomValidity(isValidEmail(email) ? '' : 'Enter a valid email address.');
    phoneInput?.setCustomValidity(isValidPhone(phone) ? '' : 'Enter a valid 10-digit phone number.');

    if (addressInput) {
        const hasSelectedAddress = selectedContactProperty?.address === address;
        addressInput.setCustomValidity(hasSelectedAddress ? '' : 'Choose a property address from the suggestions.');
    }

    if (!form.checkValidity()) {
        form.reportValidity();
        return false;
    }

    return true;
}

function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

function isValidPhone(value) {
    const digits = value.replace(/\D/g, '');
    return digits.length === 10 || (digits.length === 11 && digits.startsWith('1'));
}

function debounceContact(fn, wait) {
    let timeout = null;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn(...args), wait);
    };
}

function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    })[char]);
}

// ========================================
// Utility Functions
// ========================================
function formatCurrency(value) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(value);
}

function formatCurrencyShort(value) {
    if (value >= 1000000) return '$' + (value / 1000000).toFixed(1) + 'M';
    if (value >= 1000) return '$' + (value / 1000).toFixed(0) + 'K';
    return '$' + value.toFixed(0);
}

function getInputValue(id) {
    const el = document.getElementById(id);
    return el ? parseFloat(el.value) || 0 : 0;
}

function showNotification(message, type = 'info') {
    const existing = document.querySelector('.notification');
    if (existing) existing.remove();

    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <span>${message}</span>
        <button onclick="this.parentElement.remove()">×</button>
    `;

    document.body.appendChild(notification);

    // Add notification styles if not exists
    if (!document.getElementById('notification-styles')) {
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            .notification {
                position: fixed;
                bottom: 24px;
                right: 24px;
                padding: 16px 20px;
                border-radius: 12px;
                background: #1f2937;
                color: white;
                display: flex;
                align-items: center;
                gap: 12px;
                box-shadow: 0 10px 40px rgba(0,0,0,0.3);
                z-index: 9999;
                animation: slideIn 0.3s ease;
            }
            .notification-success { background: #059669; }
            .notification-error { background: #dc2626; }
            .notification-info { background: #6366f1; }
            .notification button {
                background: none;
                border: none;
                color: white;
                font-size: 20px;
                cursor: pointer;
                opacity: 0.7;
            }
            .notification button:hover { opacity: 1; }
            @keyframes slideIn {
                from { transform: translateX(100px); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            .spinner { animation: spin 1s linear infinite; width: 20px; height: 20px; }
            @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        `;
        document.head.appendChild(style);
    }

    setTimeout(() => notification.remove(), 4000);
}
