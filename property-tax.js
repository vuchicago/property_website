// Property Tax Tool - Full Page Functionality
let propertyMap = null;
let markers = [];
let searchResults = null;

document.addEventListener('DOMContentLoaded', function () {
    initPropertyTaxTool();
});

function initPropertyTaxTool() {
    const radiusSlider = document.getElementById('search-radius');
    const radiusValue = document.getElementById('radius-value');
    const searchBtn = document.getElementById('search-property');
    const resetBtn = document.getElementById('reset-search');
    const addressInput = document.getElementById('property-address');
    const exportCsvBtn = document.getElementById('export-csv');
    const exportPdfBtn = document.getElementById('export-pdf');

    // Radius slider
    radiusSlider?.addEventListener('input', () => {
        radiusValue.textContent = radiusSlider.value;
    });

    // Search
    searchBtn?.addEventListener('click', () => {
        const address = addressInput.value.trim();
        if (!address) {
            showNotification('Please enter a property address', 'error');
            return;
        }
        simulatePropertySearch(address, parseFloat(radiusSlider.value));
    });

    // Reset
    resetBtn?.addEventListener('click', () => {
        addressInput.value = '';
        radiusSlider.value = 0.5;
        radiusValue.textContent = '0.5';
        resetPropertyResults();
    });

    // Export handlers
    exportCsvBtn?.addEventListener('click', exportToCSV);
    exportPdfBtn?.addEventListener('click', exportToPDF);
}

function simulatePropertySearch(address, radius) {
    const searchBtn = document.getElementById('search-property');
    searchBtn.disabled = true;
    searchBtn.innerHTML = '<svg class="spinner" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" opacity="0.3" fill="none"/><path d="M12 2C6.47715 2 2 6.47715 2 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/></svg> Searching...';

    fetch('/api/property/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, radius })
    })
        .then(response => response.json())
        .then(data => {
            searchResults = data;
            updatePropertyResults(searchResults);
            initializeMap(searchResults);

            document.getElementById('export-csv').disabled = false;
            document.getElementById('export-pdf').disabled = false;

            searchBtn.disabled = false;
            searchBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none"><path d="M21 21L15 15M17 10C17 13.866 13.866 17 10 17C6.13401 17 3 13.866 3 10C3 6.13401 6.13401 3 10 3C13.866 3 17 6.13401 17 10Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> Search Property';

            showNotification('Found ' + searchResults.comparables.length + ' comparable properties!', 'success');
        })
        .catch(error => {
            console.error('API error:', error);
            searchBtn.disabled = false;
            searchBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none"><path d="M21 21L15 15M17 10C17 13.866 13.866 17 10 17C6.13401 17 3 13.866 3 10C3 6.13401 6.13401 3 10 3C13.866 3 17 6.13401 17 10Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> Search Property';
            showNotification('Error searching property. Is the server running?', 'error');
        });
}


function generateDemoComps(address, radius) {
    const baseValue = 300000 + Math.random() * 150000;
    const comparables = [];
    const numComps = 5 + Math.floor(Math.random() * 8);

    const streets = ['Oak St', 'Maple Ave', 'Pine Rd', 'Elm Dr', 'Cedar Ln', 'Birch Way', 'Walnut Ct', 'Cherry Blvd'];

    for (let i = 0; i < numComps; i++) {
        const variance = (Math.random() - 0.5) * 0.3;
        const value = Math.round(baseValue * (1 + variance));
        const distance = Math.random() * radius;

        comparables.push({
            address: `${Math.floor(Math.random() * 9000) + 1000} ${streets[Math.floor(Math.random() * streets.length)]}`,
            value: value,
            lastAppeal: Math.random() > 0.5 ? `${2020 + Math.floor(Math.random() * 5)}` : 'None',
            sqft: 1200 + Math.floor(Math.random() * 1500),
            beds: 2 + Math.floor(Math.random() * 3),
            baths: 1 + Math.floor(Math.random() * 2),
            distance: distance.toFixed(2),
            lat: 41.8781 + (Math.random() - 0.5) * 0.02,
            lng: -87.6298 + (Math.random() - 0.5) * 0.02
        });
    }

    return {
        yourProperty: {
            address: address,
            value: Math.round(baseValue * 1.15),
            lat: 41.8781,
            lng: -87.6298
        },
        comparables: comparables.sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance)),
        radius: radius
    };
}

function updatePropertyResults(data) {
    const avgValue = data.comparables.reduce((sum, c) => sum + c.value, 0) / data.comparables.length;
    const difference = data.yourProperty.value - avgValue;

    document.getElementById('your-value').textContent = formatCurrency(data.yourProperty.value);
    document.getElementById('avg-value').textContent = formatCurrency(avgValue);
    document.getElementById('difference-value').textContent = formatCurrency(difference);
    document.getElementById('difference-value').style.color = difference > 0 ? 'var(--danger)' : 'var(--accent)';
    document.getElementById('property-count').textContent = data.comparables.length + ' properties found';

    const rec = document.getElementById('recommendation');
    if (difference > avgValue * 0.15) {
        rec.innerHTML = '<strong style="color: var(--danger);">⚠️ Strongly Consider Appealing</strong><br>Your property appears significantly overvalued.';
    } else if (difference > avgValue * 0.05) {
        rec.innerHTML = '<strong style="color: var(--warning);">📋 Appeal May Be Beneficial</strong><br>Your property may be overvalued.';
    } else {
        rec.innerHTML = '<strong style="color: var(--accent);">✓ Fair Valuation</strong><br>Your valuation appears in line with comparables.';
    }

    document.getElementById('comps-table-body').innerHTML = data.comparables.map(c => `
        <tr>
            <td>${c.address}</td>
            <td>${formatCurrency(c.value)}</td>
            <td>${c.lastAppeal}</td>
            <td>${c.sqft.toLocaleString()}</td>
            <td>${c.beds}</td>
            <td>${c.baths}</td>
            <td>${c.distance} mi</td>
        </tr>
    `).join('');

    updateComparisonChart(data.yourProperty.value, avgValue);
}

function updateComparisonChart(yourValue, avgValue) {
    const container = document.getElementById('comparison-chart');
    const maxValue = Math.max(yourValue, avgValue);

    container.innerHTML = `
        <div style="display: flex; justify-content: center; align-items: flex-end; gap: 3rem; height: 100%; padding: 1rem;">
            <div style="display: flex; flex-direction: column; align-items: center; gap: 0.75rem;">
                <div style="height: 150px; width: 80px; display: flex; align-items: flex-end;">
                    <div style="width: 100%; height: ${(yourValue / maxValue) * 100}%; background: linear-gradient(180deg, hsl(0,72%,51%) 0%, hsl(0,72%,61%) 100%); border-radius: 8px 8px 0 0; display: flex; align-items: flex-start; justify-content: center; padding-top: 0.5rem;">
                        <span style="font-size: 0.75rem; font-weight: 700; color: white;">${formatCurrency(yourValue)}</span>
                    </div>
                </div>
                <span style="font-size: 0.875rem; color: var(--dark-500); font-weight: 500;">Your Property</span>
            </div>
            <div style="display: flex; flex-direction: column; align-items: center; gap: 0.75rem;">
                <div style="height: 150px; width: 80px; display: flex; align-items: flex-end;">
                    <div style="width: 100%; height: ${(avgValue / maxValue) * 100}%; background: linear-gradient(180deg, hsl(160,84%,39%) 0%, hsl(160,84%,49%) 100%); border-radius: 8px 8px 0 0; display: flex; align-items: flex-start; justify-content: center; padding-top: 0.5rem;">
                        <span style="font-size: 0.75rem; font-weight: 700; color: white;">${formatCurrency(avgValue)}</span>
                    </div>
                </div>
                <span style="font-size: 0.875rem; color: var(--dark-500); font-weight: 500;">Avg. Comparable</span>
            </div>
        </div>
    `;
}

function initializeMap(data) {
    const placeholder = document.getElementById('map-placeholder');
    if (placeholder) placeholder.style.display = 'none';

    if (propertyMap) {
        propertyMap.remove();
    }

    const mapContainer = document.getElementById('property-map');
    propertyMap = L.map(mapContainer).setView([data.yourProperty.lat, data.yourProperty.lng], 14);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(propertyMap);

    // Your property marker
    const yourIcon = L.divIcon({
        className: 'custom-marker',
        html: '<div style="background: var(--primary); color: white; padding: 8px 12px; border-radius: 8px; font-weight: 600; font-size: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); white-space: nowrap;">📍 Your Property</div>',
        iconSize: [100, 30],
        iconAnchor: [50, 30]
    });
    L.marker([data.yourProperty.lat, data.yourProperty.lng], { icon: yourIcon }).addTo(propertyMap)
        .bindPopup(`<strong>${data.yourProperty.address}</strong><br>Value: ${formatCurrency(data.yourProperty.value)}`);

    // Comparable markers
    data.comparables.forEach((comp, i) => {
        const compIcon = L.divIcon({
            className: 'custom-marker',
            html: `<div style="background: var(--accent); color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; box-shadow: 0 2px 8px rgba(0,0,0,0.3);">${i + 1}</div>`,
            iconSize: [24, 24],
            iconAnchor: [12, 12]
        });
        L.marker([comp.lat, comp.lng], { icon: compIcon }).addTo(propertyMap)
            .bindPopup(`<strong>${comp.address}</strong><br>Value: ${formatCurrency(comp.value)}<br>Distance: ${comp.distance} mi`);
    });

    // Radius circle
    L.circle([data.yourProperty.lat, data.yourProperty.lng], {
        radius: data.radius * 1609.34,
        color: 'var(--primary)',
        fillColor: 'var(--primary)',
        fillOpacity: 0.1
    }).addTo(propertyMap);
}

function resetPropertyResults() {
    document.getElementById('your-value').textContent = '$0';
    document.getElementById('avg-value').textContent = '$0';
    document.getElementById('difference-value').textContent = '$0';
    document.getElementById('property-count').textContent = '0 properties found';
    document.getElementById('recommendation').innerHTML = 'Enter an address to see your analysis';
    document.getElementById('comps-table-body').innerHTML = '<tr class="placeholder-row"><td colspan="7">Search for a property to see comparables</td></tr>';
    document.getElementById('comparison-chart').innerHTML = '<div class="chart-placeholder"><p>Chart will appear after search</p></div>';

    if (propertyMap) {
        propertyMap.remove();
        propertyMap = null;
    }
    document.getElementById('map-placeholder').style.display = 'flex';
    document.getElementById('export-csv').disabled = true;
    document.getElementById('export-pdf').disabled = true;
    searchResults = null;
}

function exportToCSV() {
    if (!searchResults) return;

    let csv = 'Address,Taxable Value,Last Appeal,Home Size (sqft),Beds,Baths,Distance (mi)\n';
    csv += `"${searchResults.yourProperty.address}",${searchResults.yourProperty.value},Your Property,-,-,-,-\n`;
    searchResults.comparables.forEach(c => {
        csv += `"${c.address}",${c.value},${c.lastAppeal},${c.sqft},${c.beds},${c.baths},${c.distance}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'property-comparables.csv';
    a.click();
    URL.revokeObjectURL(url);
    showNotification('CSV downloaded successfully!', 'success');
}

function exportToPDF() {
    if (!searchResults) return;

    const avgValue = searchResults.comparables.reduce((s, c) => s + c.value, 0) / searchResults.comparables.length;
    const diff = searchResults.yourProperty.value - avgValue;

    let content = `PROPERTY TAX COMPARISON REPORT
Generated: ${new Date().toLocaleDateString()}

YOUR PROPERTY
Address: ${searchResults.yourProperty.address}
Taxable Value: ${formatCurrency(searchResults.yourProperty.value)}

ANALYSIS SUMMARY
Average Comparable Value: ${formatCurrency(avgValue)}
Difference: ${formatCurrency(diff)} (${diff > 0 ? 'OVERVALUED' : 'FAIR'})

COMPARABLE PROPERTIES (${searchResults.comparables.length} found)
${'='.repeat(80)}
`;
    searchResults.comparables.forEach((c, i) => {
        content += `\n${i + 1}. ${c.address}\n   Value: ${formatCurrency(c.value)} | Size: ${c.sqft} sqft | Beds: ${c.beds} | Baths: ${c.baths} | Distance: ${c.distance} mi\n`;
    });

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'property-tax-report.txt';
    a.click();
    URL.revokeObjectURL(url);
    showNotification('Report downloaded!', 'success');
}
