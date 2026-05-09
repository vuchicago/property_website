let propertyMap = null;
let selectedProperty = null;
let searchResults = null;
let suggestionAbort = null;
let propertyTabCycleTimer = null;
let propertyTabCycleStopped = false;

document.addEventListener('DOMContentLoaded', initPropertyTaxTool);

function initPropertyTaxTool() {
    const app = document.getElementById('property-tax-app');
    if (!app) return;

    const radiusSlider = document.getElementById('search-radius');
    const radiusValue = document.getElementById('radius-value');
    const searchBtn = document.getElementById('search-property');
    const resetBtn = document.getElementById('reset-search');
    const addressInput = document.getElementById('property-address');
    const suggestions = document.getElementById('property-address-suggestions');
    const exportCsvBtn = document.getElementById('export-csv');
    const increaseRadiusBtn = document.getElementById('increase-radius-search');

    radiusSlider?.addEventListener('input', () => {
        radiusValue.textContent = Number(radiusSlider.value).toFixed(1);
    });

    addressInput?.addEventListener('input', debounce(() => {
        selectedProperty = null;
        searchBtn.disabled = true;
        setSelectedPropertyText('Choose a property from the suggestions.');
        fetchAddressSuggestions(addressInput.value.trim());
    }, 220));

    addressInput?.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            hideSuggestions();
        } else if (event.key === 'Enter' && document.getElementById('property-address-suggestions')?.classList.contains('is-visible')) {
            const firstSuggestion = document.querySelector('#property-address-suggestions [data-property-id]');
            if (firstSuggestion) {
                event.preventDefault();
                selectSuggestion(firstSuggestion);
            }
        }
    });

    document.addEventListener('click', (event) => {
        if (!event.target.closest('.address-search-wrap')) {
            hideSuggestions();
        }
    });

    suggestions?.addEventListener('click', (event) => {
        const button = event.target.closest('[data-property-id]');
        if (!button) return;

        selectSuggestion(button);
    });

    searchBtn?.addEventListener('click', () => {
        if (!selectedProperty) {
            showNotification('Please choose a property from the suggestions', 'error');
            return;
        }

        searchProperty(Number(radiusSlider.value));
    });

    resetBtn?.addEventListener('click', resetPropertyResults);
    exportCsvBtn?.addEventListener('click', exportToCSV);
    increaseRadiusBtn?.addEventListener('click', () => {
        if (increaseRadiusBtn.dataset.action === 'appeal') {
            window.location.href = 'login.html?mode=signup&source=property-tax-appeal';
            return;
        }

        if (!selectedProperty) return;
        const nextRadius = Math.min(5, Number((Number(radiusSlider.value) + 0.5).toFixed(1)));
        radiusSlider.value = String(nextRadius);
        radiusValue.textContent = nextRadius.toFixed(1);
        searchProperty(nextRadius);
    });

    document.querySelectorAll('.property-tax-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            stopPropertyTabCycle();
            activateTab(tab.dataset.tab);
        });
    });

    hydratePropertyFromQuery();
}

function hydratePropertyFromQuery() {
    const params = new URLSearchParams(window.location.search);
    const id = Number(params.get('propertyId') || params.get('id'));
    const address = params.get('address') || '';
    if (!id || !address) return;

    const addressInput = document.getElementById('property-address');
    const searchBtn = document.getElementById('search-property');
    const radiusSlider = document.getElementById('search-radius');
    const radiusValue = document.getElementById('radius-value');
    const radius = Math.max(0.1, Math.min(5, Number(params.get('radius') || radiusSlider?.value || 0.5)));

    selectedProperty = {
        id,
        pin: params.get('pin') || '',
        address
    };

    if (addressInput) {
        addressInput.value = selectedProperty.address;
    }
    if (searchBtn) {
        searchBtn.disabled = false;
    }
    if (radiusSlider && radiusValue) {
        radiusSlider.value = String(radius);
        radiusValue.textContent = radius.toFixed(1);
    }
    setSelectedPropertyText(`Selected property: ${selectedProperty.address}`);

    if (params.get('auto') === '1') {
        requestAnimationFrame(() => searchProperty(radius, { scrollToResults: true }));
    }
}

function selectSuggestion(button) {
    const addressInput = document.getElementById('property-address');
    const searchBtn = document.getElementById('search-property');

    selectedProperty = {
        id: Number(button.dataset.propertyId),
        pin: button.dataset.pin || '',
        address: button.dataset.address || button.textContent.trim()
    };
    addressInput.value = selectedProperty.address;
    searchBtn.disabled = false;
    setSelectedPropertyText(`Selected property: ${selectedProperty.address}`);
    hideSuggestions();
}

function debounce(fn, wait) {
    let timeout = null;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn(...args), wait);
    };
}

async function fetchAddressSuggestions(query) {
    const suggestions = document.getElementById('property-address-suggestions');
    if (!suggestions) return;

    if (suggestionAbort) {
        suggestionAbort.abort();
    }

    if (query.length < 3) {
        suggestions.innerHTML = '';
        suggestions.classList.remove('is-visible');
        setSelectedPropertyText('Start with the street number for best results.');
        return;
    }

    suggestionAbort = new AbortController();
    suggestions.innerHTML = '<div class="address-suggestion-helper">Searching Cook County addresses...</div>';
    suggestions.classList.add('is-visible');

    try {
        const response = await fetch(`/api/property/suggest?q=${encodeURIComponent(query)}&limit=5`, {
            signal: suggestionAbort.signal
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Unable to load suggestions');

        renderSuggestions(data.suggestions || []);
    } catch (error) {
        if (error.name === 'AbortError') return;
        suggestions.innerHTML = '<div class="address-suggestion-helper">Could not load suggestions.</div>';
    }
}

function renderSuggestions(items) {
    const suggestions = document.getElementById('property-address-suggestions');
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

function hideSuggestions() {
    document.getElementById('property-address-suggestions')?.classList.remove('is-visible');
}

async function searchProperty(radius, options = {}) {
    const searchBtn = document.getElementById('search-property');
    const originalHtml = searchBtn.innerHTML;
    searchBtn.disabled = true;
    searchBtn.innerHTML = '<svg class="spinner" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" opacity="0.3" fill="none"/><path d="M12 2C6.477 2 2 6.477 2 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/></svg> Analyzing';

    try {
        const response = await fetch('/api/property/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: selectedProperty.id,
                pin: selectedProperty.pin,
                address: selectedProperty.address,
                radius
            })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Property search failed');

        searchResults = data;
        updatePropertyResults(data);
        if (options.scrollToResults) {
            scrollPropertyResultsIntoView();
        }
        if (document.getElementById('tab-map')?.classList.contains('is-active')) {
            initializeMap(data);
        } else {
            clearMap();
        }
        showNotification(`Found ${data.comparables.length} comparable properties`, 'success');
    } catch (error) {
        showNotification(error.message || 'Error searching property', 'error');
    } finally {
        searchBtn.disabled = !selectedProperty;
        searchBtn.innerHTML = originalHtml;
    }
}

function scrollPropertyResultsIntoView() {
    const target = document.getElementById('property-tax-results') || document.getElementById('appeal-decision');
    if (!target) return;

    setTimeout(() => {
        const top = target.getBoundingClientRect().top + window.scrollY - 96;
        window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    }, 80);
}

function updatePropertyResults(data) {
    const target = data.target;
    const summary = data.summary;

    document.getElementById('property-tax-empty').hidden = true;
    document.getElementById('property-tax-results').hidden = false;

    updateDecision(data.appeal);
    updateWiderRadiusButton(data);
    setText('your-value', formatCurrency(target.taxableValue));
    setText('summary-your-value', formatCurrency(target.taxableValue));
    setText('avg-value', summary.averageComparableValue === null ? 'N/A' : formatCurrency(summary.averageComparableValue));
    setText('property-count', summary.comparableCount.toLocaleString());
    setText('lower-value-count', summary.lowerValueCount.toLocaleString());
    setText('last-appeal', formatLastAppeal(target.lastAppealYear));
    setText('home-size', target.homeSize ? `${formatNumber(target.homeSize)} sqft` : 'N/A');
    setText('beds-baths', target.bedroomCount !== null && target.bathroomCount !== null ? `${formatNumber(target.bedroomCount)} / ${formatNumber(target.bathroomCount)}` : 'N/A');
    setText('snapshot-type', target.propertyClass || target.classCode || 'N/A');

    renderComparableRows(data.comparables);
    updateComparisonChart(target.taxableValue, summary.averageComparableValue);
    document.getElementById('export-csv').disabled = data.comparables.length === 0;
    startPropertyTabCycle();
}

function updateWiderRadiusButton(data) {
    const button = document.getElementById('increase-radius-search');
    if (!button) return;

    if (data.appeal?.decision === 'Yes, Appeal') {
        button.hidden = false;
        button.dataset.action = 'appeal';
        button.classList.remove('btn-secondary');
        button.classList.add('btn-primary', 'appeal-cta-btn');
        button.textContent = 'I want to appeal';
        return;
    }

    const canWiden = data.summary.comparableCount < 5 && data.radius < 5;
    button.hidden = !canWiden;
    button.dataset.action = 'widen';
    button.classList.remove('btn-primary', 'appeal-cta-btn');
    button.classList.add('btn-secondary');
    if (canWiden) {
        const nextRadius = Math.min(5, Number((data.radius + 0.5).toFixed(1)));
        button.textContent = `Try ${nextRadius.toFixed(1)} mi radius`;
    } else {
        button.textContent = 'Try a wider radius';
    }
}

function updateDecision(appeal) {
    const card = document.getElementById('appeal-decision');
    card.classList.remove('decision-yes', 'decision-no', 'decision-info');
    if (appeal.decision === 'Yes, Appeal') {
        card.classList.add('decision-yes');
    } else if (appeal.decision === 'No Appeal' || appeal.decision === 'No Need to Appeal') {
        card.classList.add('decision-no');
    } else {
        card.classList.add('decision-info');
    }

    setText('decision-label', appeal.label || appeal.decision);
    setText('decision-reason', appeal.reason || '');
}

function renderComparableRows(comparables) {
    const body = document.getElementById('comps-table-body');
    if (!comparables.length) {
        body.innerHTML = '<tr class="placeholder-row"><td colspan="16">No comparable properties matched the current filters.</td></tr>';
        return;
    }

    body.innerHTML = comparables.map(c => `
        <tr>
            <td>${escapeHtml(c.address)}</td>
            <td>${formatCurrency(c.taxableValue)}</td>
            <td>${escapeHtml(formatLastAppeal(c.lastAppealYear))}</td>
            <td>${c.homeSize ? `${formatNumber(c.homeSize)} sqft` : 'N/A'}</td>
            <td>${c.bedroomCount === null ? 'N/A' : formatNumber(c.bedroomCount)}</td>
            <td>${c.bathroomCount === null ? 'N/A' : formatNumber(c.bathroomCount)}</td>
            <td>${c.distanceMiles.toFixed(2)} mi</td>
            <td>${c.certifiedLand === null ? 'N/A' : formatCurrency(c.certifiedLand)}</td>
            <td>${c.certifiedBuilding === null ? 'N/A' : formatCurrency(c.certifiedBuilding)}</td>
            <td>${escapeHtml(c.masonryType || 'N/A')}</td>
            <td>${escapeHtml(c.finishedBasement || 'N/A')}</td>
            <td>${escapeHtml(c.singleVsMultiFamily || 'N/A')}</td>
            <td>${escapeHtml(c.neighborhoodCode || 'N/A')}</td>
            <td>${escapeHtml(c.garageSize || 'N/A')}</td>
            <td>${escapeHtml(c.propertyClass || c.classCode || 'N/A')}</td>
            <td>${escapeHtml(c.pin || 'N/A')}</td>
        </tr>
    `).join('');
}

function updateComparisonChart(yourValue, avgValue) {
    const container = document.getElementById('comparison-chart');
    if (!container) return;

    if (!avgValue) {
        container.innerHTML = '<div class="chart-placeholder"><p>Not enough comparable value data to chart.</p></div>';
        return;
    }

    const maxValue = Math.max(yourValue || 0, avgValue || 0);
    const yourWidth = Math.max(4, (yourValue / maxValue) * 100);
    const avgWidth = Math.max(4, (avgValue / maxValue) * 100);

    container.innerHTML = `
        <div class="property-tax-chart-row">
            <span>Your Taxable Value</span>
            <div class="property-tax-chart-track">
                <div class="property-tax-chart-fill your-property" style="width:${yourWidth}%">${formatCurrency(yourValue)}</div>
            </div>
        </div>
        <div class="property-tax-chart-row">
            <span>Average Comp Taxable Value</span>
            <div class="property-tax-chart-track">
                <div class="property-tax-chart-fill avg-comps" style="width:${avgWidth}%">${formatCurrency(avgValue)}</div>
            </div>
        </div>
    `;
}

function initializeMap(data) {
    const target = data.target;
    const mapContainer = document.getElementById('property-map');
    const placeholder = document.getElementById('map-placeholder');

    if (!target.latitude || !target.longitude || !window.L || !mapContainer) {
        return;
    }

    if (propertyMap) {
        propertyMap.remove();
        propertyMap = null;
    }

    if (placeholder) placeholder.style.display = 'none';

    propertyMap = L.map(mapContainer).setView([target.latitude, target.longitude], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(propertyMap);

    L.circle([target.latitude, target.longitude], {
        radius: data.radius * 1609.34,
        color: '#3b82f6',
        fillColor: '#3b82f6',
        fillOpacity: 0.14
    }).addTo(propertyMap);

    L.marker([target.latitude, target.longitude]).addTo(propertyMap)
        .bindPopup(`<strong>${escapeHtml(target.address)}</strong><br>${formatCurrency(target.taxableValue)}`);

    data.comparables.forEach((comp, index) => {
        if (!comp.latitude || !comp.longitude) return;
        if (comp.latitude === target.latitude && comp.longitude === target.longitude) return;

        const icon = L.divIcon({
            className: 'property-tax-map-marker',
            html: `<span>${index + 1}</span>`,
            iconSize: [28, 28],
            iconAnchor: [14, 14]
        });
        L.marker([comp.latitude, comp.longitude], { icon }).addTo(propertyMap)
            .bindPopup(`<strong>${escapeHtml(comp.address)}</strong><br>${formatCurrency(comp.taxableValue)}<br>${comp.distanceMiles.toFixed(2)} mi`);
    });

    setTimeout(() => propertyMap?.invalidateSize(), 50);
}

function clearMap() {
    const placeholder = document.getElementById('map-placeholder');

    if (propertyMap) {
        propertyMap.remove();
        propertyMap = null;
    }

    if (placeholder) {
        placeholder.style.display = 'flex';
    }
}

function activateTab(tabName) {
    document.querySelectorAll('.property-tax-tab').forEach(tab => {
        tab.classList.toggle('is-active', tab.dataset.tab === tabName);
    });
    document.querySelectorAll('.property-tax-tab-panel').forEach(panel => {
        panel.classList.toggle('is-active', panel.id === `tab-${tabName}`);
    });
    if (tabName === 'map' && searchResults) {
        if (!propertyMap) {
            initializeMap(searchResults);
        } else {
            setTimeout(() => propertyMap.invalidateSize(), 80);
        }
    }
}

function startPropertyTabCycle() {
    if (propertyTabCycleStopped) return;

    clearInterval(propertyTabCycleTimer);
    const tabs = Array.from(document.querySelectorAll('.property-tax-tab'));
    if (tabs.length < 2) return;

    propertyTabCycleTimer = setInterval(() => {
        const activeIndex = Math.max(0, tabs.findIndex(tab => tab.classList.contains('is-active')));
        const nextTab = tabs[(activeIndex + 1) % tabs.length];
        activateTab(nextTab.dataset.tab);
    }, 3000);
}

function stopPropertyTabCycle() {
    propertyTabCycleStopped = true;
    clearInterval(propertyTabCycleTimer);
    propertyTabCycleTimer = null;
}

function resetPropertyResults() {
    selectedProperty = null;
    searchResults = null;
    document.getElementById('property-address').value = '';
    document.getElementById('search-radius').value = '0.5';
    document.getElementById('radius-value').textContent = '0.5';
    document.getElementById('search-property').disabled = true;
    document.getElementById('property-tax-empty').hidden = false;
    document.getElementById('property-tax-results').hidden = true;
    document.getElementById('export-csv').disabled = true;
    resetResultActionButton();
    setSelectedPropertyText('Enter an address and choose the closest match.');
    hideSuggestions();
    clearMap();
    clearInterval(propertyTabCycleTimer);
    propertyTabCycleTimer = null;
    propertyTabCycleStopped = false;
    activateTab('chart');
}

function resetResultActionButton() {
    const button = document.getElementById('increase-radius-search');
    if (!button) return;

    button.hidden = true;
    button.dataset.action = 'widen';
    button.classList.remove('btn-primary', 'appeal-cta-btn');
    button.classList.add('btn-secondary');
    button.textContent = 'Try a wider radius';
}

function exportToCSV() {
    if (!searchResults) return;

    const rows = [
        ['Address', 'Taxable Value', 'Last Appeal Year', 'Certified Land', 'Certified Building', 'Home Size', 'Last Appeal Status', 'Beds', 'Baths', 'Masonry Type', 'Finished Basement', 'Single vs Multi Family', 'Neighborhood Code', 'Garage Size', 'Class Description', 'PIN Proration Rate', 'PIN', 'Latitude', 'Longitude', 'Class Code', 'Distance Miles'],
        [
            searchResults.target.address,
            searchResults.target.taxableValue,
            searchResults.target.lastAppealYear || '',
            searchResults.target.certifiedLand || '',
            searchResults.target.certifiedBuilding || '',
            searchResults.target.homeSize || '',
            searchResults.target.lastAppealStatus || '',
            searchResults.target.bedroomCount || '',
            searchResults.target.bathroomCount || '',
            searchResults.target.masonryType || '',
            searchResults.target.finishedBasement || '',
            searchResults.target.singleVsMultiFamily || '',
            searchResults.target.neighborhoodCode || '',
            searchResults.target.garageSize || '',
            searchResults.target.propertyClass || '',
            searchResults.target.pinProrationRate || '',
            searchResults.target.pin || '',
            searchResults.target.latitude || '',
            searchResults.target.longitude || '',
            searchResults.target.classCode || '',
            'Your Property'
        ],
        ...searchResults.comparables.map(c => [
            c.address,
            c.taxableValue,
            c.lastAppealYear || '',
            c.certifiedLand || '',
            c.certifiedBuilding || '',
            c.homeSize || '',
            c.lastAppealStatus || '',
            c.bedroomCount || '',
            c.bathroomCount || '',
            c.masonryType || '',
            c.finishedBasement || '',
            c.singleVsMultiFamily || '',
            c.neighborhoodCode || '',
            c.garageSize || '',
            c.propertyClass || '',
            c.pinProrationRate || '',
            c.pin || '',
            c.latitude || '',
            c.longitude || '',
            c.classCode || '',
            c.distanceMiles.toFixed(3)
        ])
    ];

    const csv = rows.map(row => row.map(csvCell).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'property_comps.csv';
    a.click();
    URL.revokeObjectURL(url);
    showNotification('CSV downloaded successfully', 'success');
}

function csvCell(value) {
    return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function setSelectedPropertyText(value) {
    setText('selected-property', value);
}

function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
}

function formatCurrency(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 'N/A';
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0
    }).format(number);
}

function formatNumber(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 'N/A';
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: number % 1 ? 1 : 0 }).format(number);
}

function formatLastAppeal(value) {
    const number = Number(value);
    if (!Number.isFinite(number) || !value) {
        return 'No Appeal in past 12 years';
    }
    return String(Math.trunc(number));
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
