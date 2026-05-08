// Main App JavaScript - Shared functionality across all pages
document.addEventListener('DOMContentLoaded', function () {
    initThemeToggle();
    initMobileMenu();
    initScrollAnimations();
    initNavigation();
    initHeroAnimations();
    initPreviewTools();
    initFAQ();
    initContactForm();
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

    form?.addEventListener('submit', async e => {
        e.preventDefault();

        const btn = form.querySelector('button[type="submit"]');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<svg class="spinner" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" opacity="0.3" fill="none"/><path d="M12 2C6.47715 2 2 6.47715 2 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/></svg> Sending...';
        btn.disabled = true;

        try {
            const response = await fetch('/api/contact', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: document.getElementById('name')?.value.trim(),
                    email: document.getElementById('email')?.value.trim(),
                    phone: document.getElementById('phone')?.value.trim(),
                    propertyAddress: document.getElementById('property-address-contact')?.value.trim(),
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
        } catch (error) {
            showNotification(error.message || 'Message could not be sent.', 'error');
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    });
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
