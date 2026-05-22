let propertyMap = null;
let selectedProperty = null;
let searchResults = null;
let suggestionAbort = null;
const COMPARABLE_COLUMNS = [
    { label: 'Address', value: c => escapeHtml(c.address) },
    { label: 'Taxable Value', value: c => formatCurrency(c.taxableValue) },
    { label: 'Last Appeal', value: c => escapeHtml(formatLastAppeal(c.lastAppealYear)) },
    { label: 'Home Size', value: c => c.homeSize ? `${formatNumber(c.homeSize)} sqft` : 'N/A' },
    { label: 'Year Built', value: c => c.yearBuilt ? formatYear(c.yearBuilt) : 'N/A' },
    { label: 'Beds', value: c => c.bedroomCount === null ? 'N/A' : formatNumber(c.bedroomCount) },
    { label: 'Baths', value: c => c.bathroomCount === null ? 'N/A' : formatNumber(c.bathroomCount) },
    { label: 'Distance', value: c => c.isSubjectProperty ? 'Searched Address' : (c.distanceMiles === null || c.distanceMiles === undefined ? 'N/A' : `${c.distanceMiles.toFixed(2)} mi`) },
    { label: 'Certified Land', value: c => c.certifiedLand === null ? 'N/A' : formatCurrency(c.certifiedLand) },
    { label: 'Certified Building', value: c => c.certifiedBuilding === null ? 'N/A' : formatCurrency(c.certifiedBuilding) },
    { label: 'Masonry', value: c => escapeHtml(c.masonryType || 'N/A') },
    { label: 'Repair', value: c => escapeHtml(c.repairCondition || 'N/A') },
    { label: 'Basement', value: c => escapeHtml(c.finishedBasement || 'N/A') },
    { label: 'Single/Multi', value: c => escapeHtml(c.singleVsMultiFamily || 'N/A') },
    { label: 'Neighborhood', value: c => escapeHtml(c.neighborhoodCode || 'N/A') },
    { label: 'Garage', value: c => escapeHtml(c.garageSize || 'N/A') },
    { label: 'Class', value: c => escapeHtml(c.propertyClass || c.classCode || 'N/A') },
    { label: 'PIN Proration Code', value: c => c.pinProrationRate === null || c.pinProrationRate === undefined ? 'N/A' : escapeHtml(formatNumber(c.pinProrationRate)) },
    { label: 'Walkability Score', value: c => c.cmapWalkabilityTotalScore === null || c.cmapWalkabilityTotalScore === undefined ? 'N/A' : formatNumber(c.cmapWalkabilityTotalScore) },
    { label: 'Municipality', value: c => escapeHtml(c.municipalityName || 'N/A') },
    { label: 'PIN', value: c => escapeHtml(c.pin || 'N/A') }
];

document.addEventListener('DOMContentLoaded', initPropertyTaxTool);

function initPropertyTaxTool() {
    const app = document.getElementById('property-tax-app');
    if (!app) return;

    const radiusSlider = document.getElementById('search-radius');
    const radiusValue = document.getElementById('radius-value');
    const searchBtn = document.getElementById('search-property');
    const resetBtn = document.getElementById('reset-search');
    const simulateBtn = document.getElementById('simulate-search');
    const simulationForm = document.getElementById('simulation-panel');
    const resetSimulationBtn = document.getElementById('reset-simulation');
    const addressInput = document.getElementById('property-address');
    const suggestions = document.getElementById('property-address-suggestions');
    const exportCsvBtn = document.getElementById('export-csv');
    const increaseRadiusBtn = document.getElementById('increase-radius-search');

    renderComparableHeader();

    radiusSlider?.addEventListener('input', () => {
        radiusValue.textContent = Number(radiusSlider.value).toFixed(1);
    });

    addressInput?.addEventListener('input', debounce(() => {
        selectedProperty = null;
        searchResults = null;
        searchBtn.disabled = true;
        simulateBtn.disabled = true;
        simulationForm.hidden = true;
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
    simulateBtn?.addEventListener('click', () => {
        if (!searchResults?.target) {
            showNotification('Run an analysis before simulating changes.', 'error');
            return;
        }

        populateSimulationForm(searchResults.target);
        simulationForm.hidden = !simulationForm.hidden;
    });
    resetSimulationBtn?.addEventListener('click', () => {
        if (searchResults?.target) {
            populateSimulationForm(searchResults.target);
        }
    });
    simulationForm?.addEventListener('submit', event => {
        event.preventDefault();
        if (!selectedProperty) {
            showNotification('Choose a property before running a simulation.', 'error');
            return;
        }

        searchProperty(Number(radiusSlider.value), {
            simulation: readSimulationForm(),
            scrollToResults: true
        });
    });
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
            <span>${escapeHtml([
                item.pin ? `PIN ${item.pin}` : 'Cook County property record',
                item.mailingName || '',
                item.pinProrationRate ? `Proration ${formatNumber(item.pinProrationRate)}` : ''
            ].filter(Boolean).join(' | '))}</span>
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
                radius,
                ...(options.simulation ? { simulation: options.simulation } : {})
            })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Property search failed');

        searchResults = data;
        updatePropertyResults(data);
        if (!options.simulation) {
            populateSimulationForm(data.target);
        }
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
    document.getElementById('simulate-search').disabled = false;

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
    setText('snapshot-year-built', target.yearBuilt ? formatYear(target.yearBuilt) : 'N/A');
    setText('snapshot-municipality', target.municipalityName || 'N/A');
    setText('snapshot-type', target.propertyClass || target.classCode || 'N/A');
    if (target.isSimulated) {
        setSelectedPropertyText(`Simulating changes for ${target.address}`);
    }

    renderComparableRows(target, data.comparables);
    updateComparisonChart(target.taxableValue, summary.averageComparableValue);
    document.getElementById('export-csv').disabled = data.comparables.length === 0;
}

function simulationFieldMap() {
    return {
        taxableValue: 'simulate-taxable-value',
        certifiedLand: 'simulate-certified-land',
        certifiedBuilding: 'simulate-certified-building',
        homeSize: 'simulate-home-size',
        yearBuilt: 'simulate-year-built',
        bedroomCount: 'simulate-bedroom-count',
        bathroomCount: 'simulate-bathroom-count',
        masonryType: 'simulate-masonry-type',
        repairCondition: 'simulate-repair-condition',
        singleVsMultiFamily: 'simulate-single-vs-multi-family'
    };
}

function populateSimulationForm(target) {
    Object.entries(simulationFieldMap()).forEach(([field, id]) => {
        const input = document.getElementById(id);
        if (!input) return;
        input.value = target?.[field] === null || target?.[field] === undefined ? '' : target[field];
    });
}

function readSimulationForm() {
    const numericFields = new Set([
        'taxableValue',
        'certifiedLand',
        'certifiedBuilding',
        'homeSize',
        'yearBuilt',
        'bedroomCount',
        'bathroomCount'
    ]);

    return Object.entries(simulationFieldMap()).reduce((simulation, [field, id]) => {
        const input = document.getElementById(id);
        if (!input) return simulation;
        const value = input.value.trim();
        simulation[field] = numericFields.has(field) ? (value === '' ? null : Number(value)) : value;
        return simulation;
    }, {});
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

function renderComparableRows(target, comparables) {
    const body = document.getElementById('comps-table-body');
    renderComparableHeader();

    if (!target && !comparables.length) {
        body.innerHTML = `<tr class="placeholder-row"><td colspan="${COMPARABLE_COLUMNS.length}">No comparable properties matched the current filters.</td></tr>`;
        return;
    }

    const rows = target
        ? [{ ...target, distanceMiles: null, isSubjectProperty: true }, ...comparables]
        : comparables;

    body.innerHTML = rows.map(c => `
        <tr${c.isSubjectProperty ? ' class="subject-property-row"' : ''}>
            ${COMPARABLE_COLUMNS.map(column => `<td>${column.value(c)}</td>`).join('')}
        </tr>
    `).join('');
}

function renderComparableHeader() {
    const headerRow = document.getElementById('comps-table-header');
    if (!headerRow) return;

    headerRow.innerHTML = COMPARABLE_COLUMNS
        .map(column => `<th>${escapeHtml(column.label)}</th>`)
        .join('');
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

function resetPropertyResults() {
    selectedProperty = null;
    searchResults = null;
    document.getElementById('property-address').value = '';
    document.getElementById('search-radius').value = '0.5';
    document.getElementById('radius-value').textContent = '0.5';
    document.getElementById('search-property').disabled = true;
    document.getElementById('simulate-search').disabled = true;
    document.getElementById('simulation-panel').hidden = true;
    document.getElementById('property-tax-empty').hidden = false;
    document.getElementById('property-tax-results').hidden = true;
    document.getElementById('export-csv').disabled = true;
    resetResultActionButton();
    setSelectedPropertyText('Enter an address and choose the closest match.');
    hideSuggestions();
    clearMap();
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
        ['Address', 'Taxable Value', 'Last Appeal Year', 'Certified Land', 'Certified Building', 'Home Size', 'Year Built', 'Last Appeal Status', 'Beds', 'Baths', 'Masonry Type', 'Repair Condition', 'Finished Basement', 'Single vs Multi Family', 'Neighborhood Code', 'Garage Size', 'Class Description', 'PIN Proration Rate', 'PIN', 'PIN10', 'Latitude', 'Longitude', 'Class Code', 'Condo Unit Sqft', 'Condo Parking Space', 'Condo Common Area', 'Distance Miles'],
        [
            searchResults.target.address,
            searchResults.target.taxableValue,
            searchResults.target.lastAppealYear || '',
            searchResults.target.certifiedLand || '',
            searchResults.target.certifiedBuilding || '',
            searchResults.target.homeSize || '',
            searchResults.target.yearBuilt || '',
            searchResults.target.lastAppealStatus || '',
            searchResults.target.bedroomCount || '',
            searchResults.target.bathroomCount || '',
            searchResults.target.masonryType || '',
            searchResults.target.repairCondition || '',
            searchResults.target.finishedBasement || '',
            searchResults.target.singleVsMultiFamily || '',
            searchResults.target.neighborhoodCode || '',
            searchResults.target.garageSize || '',
            searchResults.target.propertyClass || '',
            searchResults.target.pinProrationRate || '',
            searchResults.target.pin || '',
            searchResults.target.pin10 || '',
            searchResults.target.latitude || '',
            searchResults.target.longitude || '',
            searchResults.target.classCode || '',
            searchResults.target.condoUnitSqft || '',
            searchResults.target.condoParkingSpace || '',
            searchResults.target.condoCommonArea || '',
            'Your Property'
        ],
        ...searchResults.comparables.map(c => [
            c.address,
            c.taxableValue,
            c.lastAppealYear || '',
            c.certifiedLand || '',
            c.certifiedBuilding || '',
            c.homeSize || '',
            c.yearBuilt || '',
            c.lastAppealStatus || '',
            c.bedroomCount || '',
            c.bathroomCount || '',
            c.masonryType || '',
            c.repairCondition || '',
            c.finishedBasement || '',
            c.singleVsMultiFamily || '',
            c.neighborhoodCode || '',
            c.garageSize || '',
            c.propertyClass || '',
            c.pinProrationRate || '',
            c.pin || '',
            c.pin10 || '',
            c.latitude || '',
            c.longitude || '',
            c.classCode || '',
            c.condoUnitSqft || '',
            c.condoParkingSpace || '',
            c.condoCommonArea || '',
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

function formatYear(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 'N/A';
    return String(Math.trunc(number));
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
