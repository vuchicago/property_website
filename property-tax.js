let propertyMap = null;
let selectedProperty = null;
let searchResults = null;
let suggestionAbort = null;
let comparableSort = { index: null, direction: 'asc' };
const CURRENT_TAX_YEAR = 2024;
const CURRENT_STATE_EQUALIZER = 3.0355;
const COMPARABLE_COLUMNS = [
    { label: 'Address', value: c => escapeHtml(c.address), sortValue: c => c.address },
    { label: 'Taxable Value', value: c => formatCurrency(c.taxableValue), sortValue: c => c.taxableValue },
    { label: 'Last Appeal', value: c => escapeHtml(formatLastAppeal(c.lastAppealYear)), sortValue: c => Number(c.lastAppealYear) || c.lastAppealYear },
    { label: 'Home Size', value: c => c.homeSize ? `${formatNumber(c.homeSize)} sqft` : 'N/A', sortValue: c => c.homeSize },
    { label: 'Year Built', value: c => c.yearBuilt ? formatYear(c.yearBuilt) : 'N/A', sortValue: c => c.yearBuilt },
    { label: 'Beds', value: c => c.bedroomCount === null ? 'N/A' : formatNumber(c.bedroomCount), sortValue: c => c.bedroomCount },
    { label: 'Full Baths', value: c => formatFullBaths(c.bathroomCount), sortValue: c => bathParts(c.bathroomCount).fullBaths },
    { label: 'Half Baths', value: c => formatHalfBaths(c.bathroomCount), sortValue: c => bathParts(c.bathroomCount).halfBaths },
    { label: 'Distance', value: c => c.isSubjectProperty ? 'Searched Address' : (c.distanceMiles === null || c.distanceMiles === undefined ? 'N/A' : `${c.distanceMiles.toFixed(2)} mi`), sortValue: c => c.distanceMiles },
    { label: 'Certified Land', value: c => c.certifiedLand === null ? 'N/A' : formatCurrency(c.certifiedLand), sortValue: c => c.certifiedLand },
    { label: 'Certified Building', value: c => c.certifiedBuilding === null ? 'N/A' : formatCurrency(c.certifiedBuilding), sortValue: c => c.certifiedBuilding },
    { label: 'Masonry', value: c => escapeHtml(c.masonryType || 'N/A'), sortValue: c => c.masonryType },
    { label: 'Repair', value: c => escapeHtml(c.repairCondition || 'N/A'), sortValue: c => c.repairCondition },
    { label: 'Basement', value: c => escapeHtml(c.finishedBasement || 'N/A'), sortValue: c => c.finishedBasement },
    { label: 'Single/Multi', value: c => escapeHtml(c.singleVsMultiFamily || 'N/A'), sortValue: c => c.singleVsMultiFamily },
    { label: 'Neighborhood', value: c => escapeHtml(c.neighborhoodCode || 'N/A'), sortValue: c => c.neighborhoodCode },
    { label: 'Garage', value: c => escapeHtml(c.garageSize || 'N/A'), sortValue: c => c.garageSize },
    { label: 'Class', value: c => escapeHtml(c.propertyClass || c.classCode || 'N/A'), sortValue: c => c.propertyClass || c.classCode },
    { label: 'PIN Proration Code', value: c => c.pinProrationRate === null || c.pinProrationRate === undefined ? 'N/A' : escapeHtml(formatNumber(c.pinProrationRate)), sortValue: c => c.pinProrationRate },
    { label: 'Walkability Score', value: c => c.cmapWalkabilityTotalScore === null || c.cmapWalkabilityTotalScore === undefined ? 'N/A' : formatNumber(c.cmapWalkabilityTotalScore), sortValue: c => c.cmapWalkabilityTotalScore },
    { label: 'Township', value: c => escapeHtml(c.townshipName || 'N/A'), sortValue: c => c.townshipName },
    { label: 'Municipality', value: c => escapeHtml(c.municipalityName || 'N/A'), sortValue: c => c.municipalityName },
    { label: 'PIN', value: c => escapeHtml(c.pin || 'N/A'), sortValue: c => c.pin }
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
    const compsHeader = document.getElementById('comps-table-header');

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

    compsHeader?.addEventListener('click', event => {
        const button = event.target.closest('[data-sort-index]');
        if (!button || !searchResults?.target) return;

        const index = Number(button.dataset.sortIndex);
        if (comparableSort.index === index) {
            comparableSort.direction = comparableSort.direction === 'asc' ? 'desc' : 'asc';
        } else {
            comparableSort = { index, direction: 'asc' };
        }

        renderComparableRows(searchResults.target, searchResults.comparables || []);
    });

    searchBtn?.addEventListener('click', () => {
        if (!selectedProperty) {
            showNotification('Please choose a property from the suggestions', 'error');
            return;
        }

        searchProperty(Number(radiusSlider.value));
    });

    resetBtn?.addEventListener('click', resetPropertyResults);
    const openSimulationPanel = () => {
        if (!searchResults?.target) {
            showNotification('Run an analysis before simulating changes.', 'error');
            return;
        }

        populateSimulationForm(searchResults.target);
        simulationForm.hidden = !simulationForm.hidden;
        if (!simulationForm.hidden) {
            simulationForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    };
    simulateBtn?.addEventListener('click', openSimulationPanel);
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
    increaseRadiusBtn?.addEventListener('click', async () => {
        if (increaseRadiusBtn.dataset.action === 'appeal') {
            window.location.href = 'login.html?mode=signup&source=property-tax-appeal';
            return;
        }

        if (!selectedProperty) return;
        await searchLongerRadius({
            simulation: searchResults?.target?.isSimulated ? readSimulationForm() : null
        });
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
    setSelectedPropertyText(selectedPropertyLabel(selectedProperty));

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
    setSelectedPropertyText(selectedPropertyLabel(selectedProperty));
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
        if (!options.preserveSort) {
            comparableSort = { index: null, direction: 'asc' };
        }

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
        if (!options.quiet) {
            showNotification(`Found ${data.comparables.length} comparable properties`, 'success');
        }
        return data;
    } catch (error) {
        showNotification(error.message || 'Error searching property', 'error');
        return null;
    } finally {
        searchBtn.disabled = !selectedProperty;
        searchBtn.innerHTML = originalHtml;
    }
}

async function searchLongerRadius(options = {}) {
    const radiusSlider = document.getElementById('search-radius');
    const radiusValue = document.getElementById('radius-value');
    const button = document.getElementById('increase-radius-search');
    const originalText = button?.textContent || '';
    let radius = Number(searchResults?.radius || radiusSlider?.value || 0.5);
    let latestResult = searchResults;

    if (button) {
        button.disabled = true;
        button.textContent = 'Searching up to 5.0 mi';
    }

    try {
        while (radius < 5 && (latestResult?.summary?.comparableCount || 0) < 5) {
            radius = Math.min(5, Number((radius + 0.5).toFixed(1)));
            if (radiusSlider && radiusValue) {
                radiusSlider.value = String(radius);
                radiusValue.textContent = radius.toFixed(1);
            }

            latestResult = await searchProperty(radius, {
                simulation: options.simulation,
                quiet: true,
                preserveSort: true
            });

            if (!latestResult) {
                break;
            }
        }

        if (latestResult) {
            const count = latestResult.summary?.comparableCount || 0;
            showNotification(
                count >= 5
                    ? `Found ${count} comparable properties at ${latestResult.radius.toFixed(1)} miles`
                    : `Reached 5.0 miles with ${count} comparable properties`,
                count >= 5 ? 'success' : 'info'
            );
        }
    } finally {
        if (button) {
            button.disabled = false;
            button.textContent = originalText || 'Try Wider Radius';
        }
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
    const taxContext = taxContextForDisplay(target);
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
    setText('snapshot-beds', target.bedroomCount === null ? 'N/A' : formatNumber(target.bedroomCount));
    setText('snapshot-full-baths', formatFullBaths(target.bathroomCount));
    setText('snapshot-half-baths', formatHalfBaths(target.bathroomCount));
    setText('snapshot-year-built', target.yearBuilt ? formatYear(target.yearBuilt) : 'N/A');
    setText('snapshot-municipality', target.municipalityName || 'N/A');
    setText('snapshot-township', target.townshipName || 'N/A');
    setText('snapshot-next-appeal-window', target.appealCalendar?.nextAppealWindow || 'N/A');
    setText('snapshot-equalizer', `${formatEqualizer(taxContext.stateEqualizer)} (${taxContext.taxYear})`);
    setText('snapshot-tax-rate', formatTaxRate(taxContext.localTaxRate));
    setText('snapshot-eav', formatCurrency(taxContext.equalizedAssessedValue));
    setText('snapshot-exemptions', formatExemptions(taxContext.exemptions));
    setText('snapshot-single-multi', target.singleVsMultiFamily || 'N/A');
    setText('snapshot-basement', target.finishedBasement || 'N/A');
    setText('snapshot-garage', target.garageSize || 'N/A');
    setText('snapshot-type', target.propertyClass || target.classCode || 'N/A');
    if (target.isSimulated) {
        setSelectedPropertyText(`${selectedPropertyLabel(target).replace('Selected property:', 'Simulating changes for')}`);
    } else {
        setSelectedPropertyText(selectedPropertyLabel(target));
    }

    renderComparableRows(target, data.comparables);
    updateComparisonChart(
        'comparison-chart',
        target.taxableValue,
        summary.averageComparableValue,
        {
            yourLabel: 'Your Taxable Value',
            compLabel: 'Average Comp Taxable Value',
            formatter: formatCurrency
        }
    );
    updateComparisonChart(
        'comparison-chart-per-sqft',
        summary.subjectValuePerSqft,
        averageComparableValuePerSqft(data.comparables),
        {
            yourLabel: 'Your Taxable Value / Sqft',
            compLabel: 'Average Comp Taxable Value / Sqft',
            formatter: formatCurrencyPerSqft
        }
    );
    document.getElementById('export-csv').disabled = data.comparables.length === 0;
}

function simulationFieldMap() {
    return {
        yearBuilt: 'simulate-year-built',
        bedroomCount: 'simulate-bedroom-count',
        fullBathCount: 'simulate-full-bath-count',
        halfBathCount: 'simulate-half-bath-count',
        masonryType: 'simulate-masonry-type',
        repairCondition: 'simulate-repair-condition',
        singleVsMultiFamily: 'simulate-single-vs-multi-family'
    };
}

function populateSimulationForm(target) {
    Object.entries(simulationFieldMap()).forEach(([field, id]) => {
        const input = document.getElementById(id);
        if (!input) return;
        if (field === 'fullBathCount') {
            input.value = bathParts(target?.bathroomCount).fullBaths ?? '';
            return;
        }
        if (field === 'halfBathCount') {
            input.value = bathParts(target?.bathroomCount).halfBaths ?? '';
            return;
        }
        input.value = target?.[field] === null || target?.[field] === undefined ? '' : target[field];
    });
}

function readSimulationForm() {
    const numericFields = new Set([
        'yearBuilt',
        'bedroomCount',
        'fullBathCount',
        'halfBathCount'
    ]);

    const simulation = Object.entries(simulationFieldMap()).reduce((draft, [field, id]) => {
        const input = document.getElementById(id);
        if (!input) return draft;
        const value = input.value.trim();
        draft[field] = numericFields.has(field) ? (value === '' ? null : Number(value)) : value;
        return draft;
    }, {});

    const fullBaths = simulation.fullBathCount;
    const halfBaths = simulation.halfBathCount;
    simulation.bathroomCount = fullBaths === null && halfBaths === null
        ? null
        : (Number(fullBaths || 0) + Number(halfBaths || 0) * 0.5);
    delete simulation.fullBathCount;
    delete simulation.halfBathCount;
    return simulation;
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
        button.textContent = 'Try Wider Radius';
    } else {
        button.textContent = 'Try Wider Radius';
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
    const sortedRows = sortComparableRows(rows);

    body.innerHTML = sortedRows.map(c => `
        <tr${c.isSubjectProperty ? ' class="subject-property-row"' : ''}>
            ${COMPARABLE_COLUMNS.map(column => `<td>${column.value(c)}</td>`).join('')}
        </tr>
    `).join('');
}

function sortComparableRows(rows) {
    if (comparableSort.index === null) {
        return rows;
    }

    const column = COMPARABLE_COLUMNS[comparableSort.index];
    if (!column?.sortValue) {
        return rows;
    }

    const direction = comparableSort.direction === 'desc' ? -1 : 1;
    return [...rows].sort((left, right) => {
        const leftValue = column.sortValue(left);
        const rightValue = column.sortValue(right);
        const leftMissing = leftValue === null || leftValue === undefined || leftValue === '';
        const rightMissing = rightValue === null || rightValue === undefined || rightValue === '';

        if (leftMissing && rightMissing) return 0;
        if (leftMissing) return 1;
        if (rightMissing) return -1;

        if (typeof leftValue === 'number' && typeof rightValue === 'number') {
            return (leftValue - rightValue) * direction;
        }

        return String(leftValue).localeCompare(String(rightValue), undefined, {
            numeric: true,
            sensitivity: 'base'
        }) * direction;
    });
}

function renderComparableHeader() {
    const headerRow = document.getElementById('comps-table-header');
    if (!headerRow) return;

    headerRow.innerHTML = COMPARABLE_COLUMNS
        .map((column, index) => {
            const isSorted = comparableSort.index === index;
            const indicator = isSorted ? (comparableSort.direction === 'asc' ? ' ↑' : ' ↓') : '';
            return `<th><button type="button" class="table-sort-btn${isSorted ? ' is-active' : ''}" data-sort-index="${index}">${escapeHtml(column.label)}${indicator}</button></th>`;
        })
        .join('');
}

function updateComparisonChart(containerId, yourValue, avgValue, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!avgValue) {
        container.innerHTML = '<div class="chart-placeholder"><p>Not enough comparable value data to chart.</p></div>';
        return;
    }

    const formatter = options.formatter || formatCurrency;
    const maxValue = Math.max(yourValue || 0, avgValue || 0);
    const yourWidth = Math.max(4, (yourValue / maxValue) * 100);
    const avgWidth = Math.max(4, (avgValue / maxValue) * 100);

    container.innerHTML = `
        <div class="property-tax-chart-row">
            <span>${escapeHtml(options.yourLabel || 'Your Value')}</span>
            <div class="property-tax-chart-track">
                <div class="property-tax-chart-fill your-property" style="width:${yourWidth}%">${formatter(yourValue)}</div>
            </div>
        </div>
        <div class="property-tax-chart-row">
            <span>${escapeHtml(options.compLabel || 'Average Comp Value')}</span>
            <div class="property-tax-chart-track">
                <div class="property-tax-chart-fill avg-comps" style="width:${avgWidth}%">${formatter(avgValue)}</div>
            </div>
        </div>
    `;
}

function averageComparableValuePerSqft(comparables) {
    const values = (comparables || [])
        .map(item => {
            const taxableValue = Number(item.taxableValue);
            const homeSize = Number(item.homeSize);
            return Number.isFinite(taxableValue) && Number.isFinite(homeSize) && homeSize > 0
                ? taxableValue / homeSize
                : null;
        })
        .filter(value => value !== null);

    if (!values.length) return null;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
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
    comparableSort = { index: null, direction: 'asc' };
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
    button.textContent = 'Try Wider Radius';
}

function exportToCSV() {
    if (!searchResults) return;

    const rows = [
        ['Address', 'Taxable Value', 'Last Appeal Year', 'Certified Land', 'Certified Building', 'Home Size', 'Year Built', 'Last Appeal Status', 'Beds', 'Full Baths', 'Half Baths', 'Masonry Type', 'Repair Condition', 'Finished Basement', 'Single vs Multi Family', 'Neighborhood Code', 'Garage Size', 'Class Description', 'PIN Proration Rate', 'PIN', 'PIN10', 'Latitude', 'Longitude', 'Class Code', 'Condo Unit Sqft', 'Condo Parking Space', 'Condo Common Area', 'Distance Miles'],
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
            formatFullBaths(searchResults.target.bathroomCount),
            formatHalfBaths(searchResults.target.bathroomCount),
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
            formatFullBaths(c.bathroomCount),
            formatHalfBaths(c.bathroomCount),
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

function selectedPropertyLabel(property) {
    const address = property?.address || '';
    const pin = property?.pin || (Array.isArray(property?.pinList) ? property.pinList.join(', ') : '');
    const pinLabel = pin ? ` | ${String(pin).includes(',') ? 'PINs' : 'PIN'}: ${pin}` : '';
    return address ? `Selected property: ${address}${pinLabel}` : 'Enter an address and choose the closest match.';
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

function taxContextForDisplay(target) {
    const taxableValue = Number(target?.taxableValue);
    const fallbackEav = Number.isFinite(taxableValue)
        ? Math.round(taxableValue * CURRENT_STATE_EQUALIZER)
        : null;

    return {
        taxYear: target?.taxContext?.taxYear || CURRENT_TAX_YEAR,
        stateEqualizer: Number(target?.taxContext?.stateEqualizer) || CURRENT_STATE_EQUALIZER,
        equalizedAssessedValue: target?.taxContext?.equalizedAssessedValue ?? fallbackEav,
        localTaxRate: target?.taxContext?.localTaxRate ?? null,
        exemptions: Array.isArray(target?.taxContext?.exemptions) ? target.taxContext.exemptions : []
    };
}

function formatCurrencyPerSqft(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 'N/A';
    return `${new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 2
    }).format(number)}/sqft`;
}

function formatNumber(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 'N/A';
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: number % 1 ? 1 : 0 }).format(number);
}

function formatTaxRate(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 'Not imported';
    return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 }).format(number)}%`;
}

function formatEqualizer(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 'N/A';
    return number.toFixed(4);
}

function formatExemptions(exemptions) {
    if (!Array.isArray(exemptions) || !exemptions.length) return 'None imported';
    return exemptions.map(item => item.type).filter(Boolean).join(', ') || 'Imported';
}

function bathParts(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) {
        return { fullBaths: null, halfBaths: null };
    }

    const fullBaths = Math.trunc(number);
    const halfBaths = Math.round((number - fullBaths) * 2);
    return {
        fullBaths: fullBaths + Math.trunc(halfBaths / 2),
        halfBaths: halfBaths % 2
    };
}

function formatFullBaths(value) {
    const { fullBaths } = bathParts(value);
    return fullBaths === null ? 'N/A' : formatNumber(fullBaths);
}

function formatHalfBaths(value) {
    const { halfBaths } = bathParts(value);
    return halfBaths === null ? 'N/A' : formatNumber(halfBaths);
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
