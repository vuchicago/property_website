/**
 * Components.js - Reusable UI Components for Cook County Tax Compare
 * Includes: Tooltips, Loading States, Form Validation, Share/Save, Print
 */

// ========================================
// Tooltip Component
// ========================================
class Tooltip {
    static definitions = {
        'cap-rate': {
            title: 'Capitalization Rate (CAP Rate)',
            description: 'Annual net operating income divided by property value. A higher CAP rate indicates higher potential return but also higher risk. Typical residential rates: 4-10%.'
        },
        'cash-on-cash': {
            title: 'Cash-on-Cash Return',
            description: 'Annual pre-tax cash flow divided by total cash invested. Measures the return on your actual cash investment, accounting for financing. Target: 8-12% for good deals.'
        },
        'noi': {
            title: 'Net Operating Income (NOI)',
            description: 'Total rental income minus operating expenses (excluding mortgage). This is the property\'s profit before debt service.'
        },
        'assessed-value': {
            title: 'Assessed Value',
            description: 'The value assigned to your property by the Cook County Assessor for tax purposes. This is typically 10% of the estimated market value for residential properties.'
        },
        'equalized-value': {
            title: 'Equalized Assessed Value (EAV)',
            description: 'Assessed value multiplied by the state equalization factor. This ensures fair taxation across all Illinois counties.'
        },
        'tax-rate': {
            title: 'Tax Rate',
            description: 'The combined rate from all taxing districts (schools, parks, city, etc.) applied to your EAV to calculate your tax bill.'
        },
        'amortization': {
            title: 'Amortization',
            description: 'The process of paying off a loan through regular payments. Each payment covers interest and reduces the principal balance.'
        },
        'principal': {
            title: 'Principal',
            description: 'The original amount borrowed, or the remaining balance owed on a loan, excluding interest.'
        },
        'interest-savings': {
            title: 'Interest Savings',
            description: 'The amount of interest you avoid paying by making extra payments, which reduces your loan term and total interest.'
        }
    };

    static init() {
        // Create tooltip container
        if (!document.getElementById('tooltip-container')) {
            const container = document.createElement('div');
            container.id = 'tooltip-container';
            container.className = 'tooltip-container';
            container.setAttribute('role', 'tooltip');
            container.setAttribute('aria-hidden', 'true');
            container.innerHTML = `
                <div class="tooltip-header"></div>
                <div class="tooltip-body"></div>
            `;
            document.body.appendChild(container);
        }

        // Attach event listeners to all tooltip triggers
        document.querySelectorAll('[data-tooltip]').forEach(trigger => {
            trigger.setAttribute('tabindex', '0');
            trigger.setAttribute('aria-describedby', 'tooltip-container');

            trigger.addEventListener('mouseenter', (e) => Tooltip.show(e.target));
            trigger.addEventListener('mouseleave', () => Tooltip.hide());
            trigger.addEventListener('focus', (e) => Tooltip.show(e.target));
            trigger.addEventListener('blur', () => Tooltip.hide());
        });
    }

    static show(trigger) {
        const key = trigger.dataset.tooltip;
        const definition = Tooltip.definitions[key];
        if (!definition) return;

        const container = document.getElementById('tooltip-container');
        container.querySelector('.tooltip-header').textContent = definition.title;
        container.querySelector('.tooltip-body').textContent = definition.description;

        // Position tooltip
        const rect = trigger.getBoundingClientRect();
        const tooltipRect = container.getBoundingClientRect();

        let top = rect.bottom + 10;
        let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);

        // Keep within viewport
        if (left < 10) left = 10;
        if (left + tooltipRect.width > window.innerWidth - 10) {
            left = window.innerWidth - tooltipRect.width - 10;
        }
        if (top + tooltipRect.height > window.innerHeight - 10) {
            top = rect.top - tooltipRect.height - 10;
        }

        container.style.top = `${top}px`;
        container.style.left = `${left}px`;
        container.classList.add('visible');
        container.setAttribute('aria-hidden', 'false');
    }

    static hide() {
        const container = document.getElementById('tooltip-container');
        if (container) {
            container.classList.remove('visible');
            container.setAttribute('aria-hidden', 'true');
        }
    }
}

// ========================================
// Loading State Component
// ========================================
class LoadingState {
    static show(elementId, message = 'Calculating...') {
        const element = document.getElementById(elementId);
        if (!element) return;

        element.classList.add('is-loading');

        // Add loading overlay if not exists
        if (!element.querySelector('.loading-overlay')) {
            const overlay = document.createElement('div');
            overlay.className = 'loading-overlay';
            overlay.innerHTML = `
                <div class="loading-spinner"></div>
                <span class="loading-text">${message}</span>
            `;
            element.style.position = 'relative';
            element.appendChild(overlay);
        }
    }

    static hide(elementId) {
        const element = document.getElementById(elementId);
        if (!element) return;

        element.classList.remove('is-loading');
        const overlay = element.querySelector('.loading-overlay');
        if (overlay) {
            overlay.remove();
        }
    }

    static showButton(button, text = 'Processing...') {
        if (!button) return;
        button.disabled = true;
        button.dataset.originalText = button.innerHTML;
        button.innerHTML = `<span class="btn-spinner"></span> ${text}`;
        button.classList.add('is-loading');
    }

    static hideButton(button) {
        if (!button) return;
        button.disabled = false;
        button.innerHTML = button.dataset.originalText || button.innerHTML;
        button.classList.remove('is-loading');
    }
}

// ========================================
// Form Validation Component
// ========================================
class FormValidator {
    static rules = {
        required: (value) => value.trim() !== '' || 'This field is required',
        number: (value) => !isNaN(parseFloat(value)) || 'Please enter a valid number',
        positive: (value) => parseFloat(value) > 0 || 'Please enter a positive number',
        min: (min) => (value) => parseFloat(value) >= min || `Minimum value is ${min}`,
        max: (max) => (value) => parseFloat(value) <= max || `Maximum value is ${max}`,
        percentage: (value) => (parseFloat(value) >= 0 && parseFloat(value) <= 100) || 'Please enter a value between 0 and 100'
    };

    static validate(input, rules = ['required', 'number', 'positive']) {
        const value = input.value;
        const errors = [];

        rules.forEach(rule => {
            let validator;
            let ruleName = rule;

            if (typeof rule === 'object') {
                ruleName = Object.keys(rule)[0];
                validator = FormValidator.rules[ruleName](rule[ruleName]);
            } else {
                validator = FormValidator.rules[rule];
            }

            if (validator) {
                const result = validator(value);
                if (result !== true) {
                    errors.push(result);
                }
            }
        });

        FormValidator.showValidation(input, errors);
        return errors.length === 0;
    }

    static showValidation(input, errors) {
        // Remove existing error
        const existingError = input.parentElement.querySelector('.validation-error');
        if (existingError) existingError.remove();
        input.classList.remove('input-error', 'input-valid');

        if (errors.length > 0) {
            input.classList.add('input-error');
            const errorEl = document.createElement('span');
            errorEl.className = 'validation-error';
            errorEl.textContent = errors[0];
            errorEl.setAttribute('role', 'alert');
            input.parentElement.appendChild(errorEl);
        } else {
            input.classList.add('input-valid');
        }
    }

    static clearValidation(input) {
        const existingError = input.parentElement.querySelector('.validation-error');
        if (existingError) existingError.remove();
        input.classList.remove('input-error', 'input-valid');
    }

    static validateForm(formId, fieldRules) {
        let isValid = true;
        Object.entries(fieldRules).forEach(([fieldId, rules]) => {
            const input = document.getElementById(fieldId);
            if (input && !FormValidator.validate(input, rules)) {
                isValid = false;
            }
        });
        return isValid;
    }
}

// ========================================
// Share/Save Component
// ========================================
class ShareSave {
    static generateShareUrl(tool, data) {
        const params = new URLSearchParams(data);
        const baseUrl = window.location.origin + window.location.pathname.replace(/[^/]*$/, '');
        return `${baseUrl}${tool}.html?${params.toString()}`;
    }

    static async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            showNotification('Link copied to clipboard!', 'success');
            return true;
        } catch (err) {
            // Fallback for older browsers
            const textarea = document.createElement('textarea');
            textarea.value = text;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            showNotification('Link copied to clipboard!', 'success');
            return true;
        }
    }

    static loadFromUrl() {
        const params = new URLSearchParams(window.location.search);
        const data = {};
        params.forEach((value, key) => {
            const input = document.getElementById(key);
            if (input) {
                input.value = value;
                data[key] = value;
            }
        });
        return data;
    }

    static saveToLocalStorage(key, data) {
        try {
            const history = JSON.parse(localStorage.getItem('ccTaxCompare_history') || '[]');
            const entry = {
                key,
                data,
                timestamp: new Date().toISOString()
            };
            history.unshift(entry);
            // Keep only last 10 entries
            localStorage.setItem('ccTaxCompare_history', JSON.stringify(history.slice(0, 10)));
            showNotification('Calculation saved!', 'success');
        } catch (err) {
            console.error('Failed to save:', err);
        }
    }

    static getHistory() {
        try {
            return JSON.parse(localStorage.getItem('ccTaxCompare_history') || '[]');
        } catch {
            return [];
        }
    }
}

// ========================================
// Print Helper
// ========================================
class PrintHelper {
    static print(sectionId = null) {
        if (sectionId) {
            const section = document.getElementById(sectionId);
            if (section) {
                section.classList.add('print-target');
            }
        }
        window.print();
        if (sectionId) {
            const section = document.getElementById(sectionId);
            if (section) {
                section.classList.remove('print-target');
            }
        }
    }
}

// ========================================
// Accessibility Helpers
// ========================================
class A11y {
    static init() {
        // Add skip link
        if (!document.querySelector('.skip-link')) {
            const skipLink = document.createElement('a');
            skipLink.href = '#main-content';
            skipLink.className = 'skip-link';
            skipLink.textContent = 'Skip to main content';
            document.body.insertBefore(skipLink, document.body.firstChild);
        }

        // Enhance focus visibility
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                document.body.classList.add('keyboard-nav');
            }
        });

        document.addEventListener('mousedown', () => {
            document.body.classList.remove('keyboard-nav');
        });

        // Add aria-live region for notifications
        if (!document.getElementById('aria-live')) {
            const liveRegion = document.createElement('div');
            liveRegion.id = 'aria-live';
            liveRegion.className = 'sr-only';
            liveRegion.setAttribute('aria-live', 'polite');
            liveRegion.setAttribute('aria-atomic', 'true');
            document.body.appendChild(liveRegion);
        }
    }

    static announce(message) {
        const liveRegion = document.getElementById('aria-live');
        if (liveRegion) {
            liveRegion.textContent = message;
            setTimeout(() => { liveRegion.textContent = ''; }, 1000);
        }
    }
}

// ========================================
// Calculator Mode Toggle Component
// ========================================
class CalculatorToggle {
    static init() {
        const toggle = document.getElementById('calc-mode-toggle');
        if (!toggle) return;

        toggle.addEventListener('click', () => {
            CalculatorToggle.toggleMode();
        });

        // Load saved preference
        const savedMode = localStorage.getItem('calculator-mode') || 'local';
        if (savedMode === 'huggingface') {
            CalculatorToggle.setMode('huggingface');
        }
    }

    static toggleMode() {
        const toggle = document.getElementById('calc-mode-toggle');
        const isHuggingFace = toggle.classList.contains('active');

        if (isHuggingFace) {
            CalculatorToggle.setMode('local');
        } else {
            CalculatorToggle.setMode('huggingface');
        }
    }

    static setMode(mode) {
        const toggle = document.getElementById('calc-mode-toggle');
        const localCalc = document.getElementById('local-calculator');
        const hfCalc = document.getElementById('huggingface-calculator');

        if (mode === 'huggingface') {
            toggle.classList.add('active');
            localCalc?.classList.remove('active');
            hfCalc?.classList.add('active');
            localStorage.setItem('calculator-mode', 'huggingface');
            A11y.announce('Switched to Hugging Face calculator');
        } else {
            toggle.classList.remove('active');
            localCalc?.classList.add('active');
            hfCalc?.classList.remove('active');
            localStorage.setItem('calculator-mode', 'local');
            A11y.announce('Switched to local calculator');
        }
    }
}

// ========================================
// Initialize Components
// ========================================
document.addEventListener('DOMContentLoaded', function () {
    Tooltip.init();
    A11y.init();
    CalculatorToggle.init();

    // Load shared URL data if present
    if (window.location.search) {
        const data = ShareSave.loadFromUrl();
        if (Object.keys(data).length > 0) {
            // Trigger calculation if data was loaded
            const calcBtn = document.querySelector('[id*="calculate"]');
            if (calcBtn) {
                setTimeout(() => calcBtn.click(), 100);
            }
        }
    }
});

// Export for use in other scripts
window.Tooltip = Tooltip;
window.LoadingState = LoadingState;
window.FormValidator = FormValidator;
window.ShareSave = ShareSave;
window.PrintHelper = PrintHelper;
window.A11y = A11y;
window.CalculatorToggle = CalculatorToggle;

