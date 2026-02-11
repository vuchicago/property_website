#!/bin/bash

# Script to add calculator mode toggle to ROI Calculator and Loan Tool pages
# This adds the toggle HTML after the page header section

echo "Adding calculator mode toggle to ROI Calculator and Loan Tool pages..."

# Define the toggle HTML
read -r -d '' TOGGLE_HTML << 'EOF'

    <!-- Calculator Mode Toggle -->
    <section class="tool-page" style="padding-top: var(--space-8);">
        <div class="container">
            <div class="calculator-mode-toggle">
                <svg class="toggle-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M9.75 17L9 20L8 21H16L15 20L14.25 17M3 13H21M5 17H19C20.1046 17 21 16.1046 21 15V5C21 3.89543 20.1046 3 19 3H5C3.89543 3 3 3.89543 3 5V15C3 16.1046 3.89543 17 5 17Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <span class="toggle-label">Local Calculator</span>
                <div class="toggle-switch" id="calc-mode-toggle">
                    <div class="toggle-slider"></div>
                </div>
                <span class="toggle-label">Hugging Face App</span>
                <svg class="toggle-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M21 16V8C20.9996 7.64927 20.9071 7.30481 20.7315 7.00116C20.556 6.69751 20.3037 6.44536 20 6.27L13 2.27C12.696 2.09446 12.3511 2.00205 12 2.00205C11.6489 2.00205 11.304 2.09446 11 2.27L4 6.27C3.69626 6.44536 3.44398 6.69751 3.26846 7.00116C3.09294 7.30481 3.00036 7.64927 3 8V16C3.00036 16.3507 3.09294 16.6952 3.26846 16.9988C3.44398 17.3025 3.69626 17.5546 4 17.73L11 21.73C11.304 21.9055 11.6489 21.9979 12 21.9979C12.3511 21.9979 12.696 21.9055 13 21.73L20 17.73C20.3037 17.5546 20.556 17.3025 20.7315 16.9988C20.9071 16.6952 20.9996 16.3507 21 16Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M7.5 4.21L12 6.81L16.5 4.21M12 22.08V12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </div>
        </div>
    </section>

EOF

echo "Toggle HTML prepared. Manual integration required for roi-calculator.html and loan-tool.html"
echo "The toggle needs to be added after the page-header section and before the main tool section."
echo "Additionally, the main tool content needs to be wrapped in calculator-view divs."
