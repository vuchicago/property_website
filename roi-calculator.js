// ROI Calculator - Full Page Functionality
let roiData = null;

document.addEventListener('DOMContentLoaded', function () {
    initROICalculator();
    calculateROI(); // Initial calculation
});

function initROICalculator() {
    const inputs = ['purchase-price', 'down-payment', 'closing-costs', 'rehab-costs', 'monthly-rent', 'vacancy-rate', 'monthly-expenses', 'mortgage-payment'];

    inputs.forEach(id => {
        const el = document.getElementById(id);
        el?.addEventListener('input', calculateROI);
    });

    document.getElementById('roi-export-csv')?.addEventListener('click', exportROIToCSV);
    document.getElementById('roi-export-pdf')?.addEventListener('click', exportROIToPDF);

    // Share and Print buttons
    document.getElementById('share-results')?.addEventListener('click', () => {
        if (!roiData) { showNotification('Calculate ROI first', 'error'); return; }
        const url = ShareSave.generateShareUrl('roi-calculator', {
            'purchase-price': roiData.purchasePrice,
            'down-payment': roiData.downPayment / roiData.purchasePrice * 100,
            'closing-costs': roiData.closingCosts,
            'rehab-costs': roiData.rehabCosts,
            'monthly-rent': roiData.monthlyRent,
            'vacancy-rate': roiData.vacancyRate,
            'monthly-expenses': roiData.monthlyExpenses,
            'mortgage-payment': roiData.mortgagePayment
        });
        ShareSave.copyToClipboard(url);
    });

    document.getElementById('print-results')?.addEventListener('click', () => {
        PrintHelper.print('main-content');
    });
}

function calculateROI() {
    const purchasePrice = getInputValue('purchase-price') || 0;
    const downPaymentPct = getInputValue('down-payment') || 0;
    const closingCosts = getInputValue('closing-costs') || 0;
    const rehabCosts = getInputValue('rehab-costs') || 0;
    const monthlyRent = getInputValue('monthly-rent') || 0;
    const vacancyRate = getInputValue('vacancy-rate') || 0;
    const monthlyExpenses = getInputValue('monthly-expenses') || 0;
    const mortgagePayment = getInputValue('mortgage-payment') || 0;

    fetch('/api/roi/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            purchase_price: purchasePrice,
            down_payment_pct: downPaymentPct,
            closing_costs: closingCosts,
            rehab_costs: rehabCosts,
            monthly_rent: monthlyRent,
            vacancy_rate: vacancyRate,
            monthly_expenses: monthlyExpenses,
            mortgage_payment: mortgagePayment
        })
    })
        .then(response => response.json())
        .then(data => {
            roiData = {
                purchasePrice: data.purchasePrice,
                downPayment: data.downPayment,
                closingCosts: data.closingCosts,
                rehabCosts: data.rehabCosts,
                monthlyRent: data.monthlyRent,
                vacancyRate: data.vacancyRate,
                monthlyExpenses: data.monthlyExpenses,
                mortgagePayment: data.mortgagePayment,
                totalCashInvested: data.totalCashInvested,
                noi: data.noi,
                annualCashFlow: data.annualCashFlow,
                monthlyCashFlow: data.monthlyCashFlow,
                capRate: data.capRate,
                cocReturn: data.cocReturn,
                breakEvenRent: data.breakEvenRent
            };

            // Update UI
            document.getElementById('coc-return').textContent = data.cocReturn.toFixed(2) + '%';
            document.getElementById('noi-value').textContent = formatCurrency(data.noi) + '/yr';
            document.getElementById('cap-rate').textContent = data.capRate.toFixed(2) + '%';
            document.getElementById('cash-flow').textContent = formatCurrency(data.annualCashFlow) + '/yr';
            document.getElementById('monthly-cash-flow').textContent = formatCurrency(data.monthlyCashFlow) + '/mo';
            document.getElementById('break-even-rent').textContent = formatCurrency(data.breakEvenRent) + '/mo';
            document.getElementById('total-invested').textContent = formatCurrency(data.totalCashInvested);

            updateROIChart(data.downPayment, data.closingCosts, data.rehabCosts);
            updateInsightsFromAPI(data.insights);
        })
        .catch(error => {
            console.error('API error:', error);
            showNotification('Error calculating ROI. Is the server running?', 'error');
        });
}

function updateInsightsFromAPI(insights) {
    const cocInsight = document.getElementById('insight-coc');
    const capInsight = document.getElementById('insight-cap');
    const cashInsight = document.getElementById('insight-cashflow');

    if (cocInsight && insights.coc) {
        cocInsight.className = 'insight-card ' + (insights.coc.status === 'good' ? 'good' : insights.coc.status === 'warning' ? 'warning' : '');
        cocInsight.querySelector('.insight-icon').textContent = insights.coc.status === 'good' ? '✓' : insights.coc.status === 'warning' ? '⚠️' : '💡';
        cocInsight.querySelector('p').textContent = insights.coc.message;
    }

    if (capInsight && insights.cap) {
        capInsight.className = 'insight-card ' + (insights.cap.status === 'good' ? 'good' : insights.cap.status === 'warning' ? 'warning' : '');
        capInsight.querySelector('.insight-icon').textContent = insights.cap.status === 'good' ? '✓' : insights.cap.status === 'warning' ? '⚠️' : '💡';
        capInsight.querySelector('p').textContent = insights.cap.message;
    }

    if (cashInsight && insights.cashflow) {
        cashInsight.className = 'insight-card ' + (insights.cashflow.status === 'good' ? 'good' : insights.cashflow.status === 'warning' ? 'warning' : '');
        cashInsight.querySelector('.insight-icon').textContent = insights.cashflow.status === 'good' ? '✓' : insights.cashflow.status === 'warning' ? '⚠️' : '💡';
        cashInsight.querySelector('p').textContent = insights.cashflow.message;
    }
}

function updateROIChart(downPayment, closingCosts, rehabCosts) {
    const canvas = document.getElementById('roi-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const total = downPayment + closingCosts + rehabCosts;
    if (total === 0) return;

    canvas.width = canvas.offsetWidth * 2;
    canvas.height = canvas.offsetHeight * 2;
    ctx.scale(2, 2);

    const width = canvas.offsetWidth;
    const height = canvas.offsetHeight;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 2 - 20;

    ctx.clearRect(0, 0, width, height);

    const segments = [
        { value: downPayment, color: '#6366f1', label: 'Down Payment' },
        { value: closingCosts, color: '#22c55e', label: 'Closing Costs' },
        { value: rehabCosts, color: '#f59e0b', label: 'Rehab Costs' }
    ].filter(s => s.value > 0);

    let startAngle = -Math.PI / 2;
    segments.forEach(seg => {
        const sliceAngle = (seg.value / total) * 2 * Math.PI;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
        ctx.closePath();
        ctx.fillStyle = seg.color;
        ctx.fill();
        startAngle += sliceAngle;
    });

    // Center hole
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius * 0.6, 0, 2 * Math.PI);
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--white') || '#fff';
    ctx.fill();

    // Center text
    ctx.fillStyle = '#1f2937';
    ctx.font = 'bold 14px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Total Investment', centerX, centerY - 8);
    ctx.font = 'bold 18px Inter, sans-serif';
    ctx.fillText(formatCurrency(total), centerX, centerY + 14);
}

function updateInsights(coc, cap, cashFlow) {
    const cocInsight = document.getElementById('insight-coc');
    const capInsight = document.getElementById('insight-cap');
    const cashInsight = document.getElementById('insight-cashflow');

    if (cocInsight) {
        cocInsight.className = 'insight-card ' + (coc >= 8 ? 'good' : coc >= 4 ? '' : 'warning');
        cocInsight.querySelector('.insight-icon').textContent = coc >= 8 ? '✓' : coc >= 4 ? '💡' : '⚠️';
        cocInsight.querySelector('p').textContent = coc >= 8 ? 'Excellent return above the 8% benchmark!' : coc >= 4 ? 'Moderate return. Consider ways to increase income.' : 'Low return. Review expenses and rent pricing.';
    }

    if (capInsight) {
        capInsight.className = 'insight-card ' + (cap >= 6 ? 'good' : cap >= 4 ? '' : 'warning');
        capInsight.querySelector('.insight-icon').textContent = cap >= 6 ? '✓' : cap >= 4 ? '💡' : '⚠️';
        capInsight.querySelector('p').textContent = cap >= 6 ? 'Strong CAP rate indicates solid investment.' : cap >= 4 ? 'Average CAP rate for the market.' : 'Low CAP rate - property may be overpriced.';
    }

    if (cashInsight) {
        cashInsight.className = 'insight-card ' + (cashFlow > 200 ? 'good' : cashFlow > 0 ? '' : 'warning');
        cashInsight.querySelector('.insight-icon').textContent = cashFlow > 200 ? '✓' : cashFlow > 0 ? '💡' : '⚠️';
        cashInsight.querySelector('p').textContent = cashFlow > 200 ? 'Strong positive cash flow!' : cashFlow > 0 ? 'Positive but thin margins.' : 'Negative cash flow - property costs more than it earns.';
    }
}

function exportROIToCSV() {
    if (!roiData) { showNotification('Calculate ROI first', 'error'); return; }

    const csv = `Metric,Value
Purchase Price,${roiData.purchasePrice}
Down Payment,${roiData.downPayment}
Closing Costs,${roiData.closingCosts}
Rehab Costs,${roiData.rehabCosts}
Total Cash Invested,${roiData.totalCashInvested}
Monthly Rent,${roiData.monthlyRent}
Vacancy Rate,${roiData.vacancyRate}%
Monthly Expenses,${roiData.monthlyExpenses}
Mortgage Payment,${roiData.mortgagePayment}
Net Operating Income (Annual),${roiData.noi}
Annual Cash Flow,${roiData.annualCashFlow}
Monthly Cash Flow,${roiData.monthlyCashFlow}
CAP Rate,${roiData.capRate.toFixed(2)}%
Cash on Cash Return,${roiData.cocReturn.toFixed(2)}%
Break-Even Rent,${roiData.breakEvenRent}`;

    downloadFile(csv, 'roi-analysis.csv', 'text/csv');
    showNotification('CSV downloaded!', 'success');
}

function exportROIToPDF() {
    if (!roiData) { showNotification('Calculate ROI first', 'error'); return; }

    const content = `REAL ESTATE ROI ANALYSIS REPORT
Generated: ${new Date().toLocaleDateString()}

${'='.repeat(50)}
PROPERTY DETAILS
${'='.repeat(50)}
Purchase Price: ${formatCurrency(roiData.purchasePrice)}
Down Payment: ${formatCurrency(roiData.downPayment)}
Closing Costs: ${formatCurrency(roiData.closingCosts)}
Rehab Costs: ${formatCurrency(roiData.rehabCosts)}
Total Cash Invested: ${formatCurrency(roiData.totalCashInvested)}

${'='.repeat(50)}
INCOME & EXPENSES
${'='.repeat(50)}
Monthly Rent: ${formatCurrency(roiData.monthlyRent)}
Vacancy Rate: ${roiData.vacancyRate}%
Monthly Operating Expenses: ${formatCurrency(roiData.monthlyExpenses)}
Monthly Mortgage Payment: ${formatCurrency(roiData.mortgagePayment)}

${'='.repeat(50)}
KEY METRICS
${'='.repeat(50)}
Net Operating Income (NOI): ${formatCurrency(roiData.noi)}/year
CAP Rate: ${roiData.capRate.toFixed(2)}%
Cash on Cash Return: ${roiData.cocReturn.toFixed(2)}%
Annual Cash Flow: ${formatCurrency(roiData.annualCashFlow)}
Monthly Cash Flow: ${formatCurrency(roiData.monthlyCashFlow)}
Break-Even Rent: ${formatCurrency(roiData.breakEvenRent)}/month

${'='.repeat(50)}
RECOMMENDATION
${'='.repeat(50)}
${roiData.cocReturn >= 8 ? 'STRONG INVESTMENT - Cash on Cash return exceeds 8% benchmark.' : roiData.cocReturn >= 4 ? 'MODERATE INVESTMENT - Consider negotiating better terms.' : 'WEAK INVESTMENT - Review pricing and expenses carefully.'}
`;

    downloadFile(content, 'roi-analysis-report.txt', 'text/plain');
    showNotification('Report downloaded!', 'success');
}

function downloadFile(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}
