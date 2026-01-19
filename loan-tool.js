// Loan Tool - Full Page Functionality
let loanData = null;
let amortizationSchedule = [];
let viewMode = 'yearly';

document.addEventListener('DOMContentLoaded', function () {
    initLoanTool();
});

function initLoanTool() {
    document.getElementById('calculate-loan')?.addEventListener('click', calculateLoan);
    document.getElementById('loan-export-csv')?.addEventListener('click', exportLoanToCSV);
    document.getElementById('loan-export-pdf')?.addEventListener('click', exportLoanToPDF);

    // Share and Print buttons
    document.getElementById('share-results')?.addEventListener('click', () => {
        if (!loanData) { showNotification('Calculate loan first', 'error'); return; }
        const url = ShareSave.generateShareUrl('loan-tool', {
            'loan-amount': loanData.principal,
            'interest-rate': loanData.annualRate,
            'loan-term': loanData.years,
            'extra-payment': loanData.extraPayment
        });
        ShareSave.copyToClipboard(url);
    });

    document.getElementById('print-results')?.addEventListener('click', () => {
        PrintHelper.print('main-content');
    });

    // Scenario buttons
    document.querySelectorAll('.scenario-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.getElementById('extra-payment').value = btn.dataset.extra;
            calculateLoan();
        });
    });

    // Amortization tabs
    document.querySelectorAll('.amort-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.amort-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            viewMode = tab.dataset.view;
            if (amortizationSchedule.length > 0) updateAmortizationTable();
        });
    });
}

function calculateLoan() {
    const principal = getInputValue('loan-amount') || 0;
    const annualRate = getInputValue('interest-rate') || 0;
    const years = getInputValue('loan-term') || 30;
    const extraPayment = getInputValue('extra-payment') || 0;

    fetch('/api/loan/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            principal: principal,
            annual_rate: annualRate,
            years: years,
            extra_payment: extraPayment
        })
    })
        .then(response => response.json())
        .then(data => {
            loanData = {
                principal: data.principal,
                annualRate: data.annualRate,
                years: data.years,
                extraPayment: data.extraPayment,
                monthlyPayment: data.monthlyPayment,
                standardInterest: data.standardInterest,
                acceleratedInterest: data.acceleratedInterest,
                interestSavings: data.interestSavings,
                monthsSaved: data.monthsSaved,
                standardMonths: data.standardMonths,
                acceleratedMonths: data.acceleratedMonths
            };

            amortizationSchedule = data.amortizationSchedule;

            // Update UI
            document.getElementById('monthly-payment-result').textContent = formatCurrency(data.monthlyPayment);
            document.getElementById('total-interest').textContent = formatCurrency(data.acceleratedInterest);
            document.getElementById('interest-savings').textContent = formatCurrency(data.interestSavings);
            document.getElementById('time-saved').textContent = data.monthsSaved > 0 ? `${Math.floor(data.monthsSaved / 12)}y ${data.monthsSaved % 12}m` : '0 months';

            // Payoff comparison
            document.getElementById('standard-payoff-bar').style.width = '100%';
            document.getElementById('accelerated-payoff-bar').style.width = (data.acceleratedYears / data.standardYears * 100) + '%';
            document.getElementById('standard-payoff-date').textContent = `${data.standardYears} years`;
            document.getElementById('accelerated-payoff-date').textContent = `${data.acceleratedYears} years`;

            updateLoanChartFromAPI(data.yearlySummary);
            updateAmortizationTable();

            showNotification('Loan calculated!', 'success');
        })
        .catch(error => {
            console.error('API error:', error);
            showNotification('Error calculating loan. Is the server running?', 'error');
        });
}


function generateAmortization(principal, monthlyRate, payment, extra) {
    const schedule = [];
    let balance = principal;
    let month = 0;

    while (balance > 0.01 && month < 600) {
        month++;
        const interestPayment = balance * monthlyRate;
        let principalPayment = payment - interestPayment + extra;

        if (principalPayment > balance) principalPayment = balance;
        balance -= principalPayment;

        schedule.push({
            month,
            payment: interestPayment + principalPayment,
            principal: principalPayment,
            interest: interestPayment,
            balance: Math.max(0, balance)
        });
    }

    return schedule;
}

function updateLoanChart(schedule) {
    const canvas = document.getElementById('loan-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth * 2;
    canvas.height = canvas.offsetHeight * 2;
    ctx.scale(2, 2);

    const width = canvas.offsetWidth;
    const height = canvas.offsetHeight;
    const padding = { top: 20, right: 20, bottom: 40, left: 60 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    ctx.clearRect(0, 0, width, height);

    // Sample data points (every 12 months)
    const yearly = [];
    for (let i = 11; i < schedule.length; i += 12) {
        const yearData = schedule.slice(Math.max(0, i - 11), i + 1);
        yearly.push({
            year: Math.floor(i / 12) + 1,
            principal: yearData.reduce((s, p) => s + p.principal, 0),
            interest: yearData.reduce((s, p) => s + p.interest, 0)
        });
    }

    if (yearly.length === 0) return;

    const maxValue = Math.max(...yearly.map(y => y.principal + y.interest));
    const barWidth = (chartWidth / yearly.length) * 0.7;
    const barGap = (chartWidth / yearly.length) * 0.3;

    yearly.forEach((data, i) => {
        const x = padding.left + i * (barWidth + barGap) + barGap / 2;
        const principalHeight = (data.principal / maxValue) * chartHeight;
        const interestHeight = (data.interest / maxValue) * chartHeight;

        // Interest (bottom)
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(x, padding.top + chartHeight - interestHeight, barWidth, interestHeight);

        // Principal (top)
        ctx.fillStyle = '#6366f1';
        ctx.fillRect(x, padding.top + chartHeight - interestHeight - principalHeight, barWidth, principalHeight);

        // Year label
        ctx.fillStyle = '#6b7280';
        ctx.font = '10px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`Y${data.year}`, x + barWidth / 2, height - 10);
    });

    // Y-axis labels
    ctx.fillStyle = '#6b7280';
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 4; i++) {
        const value = (maxValue / 4) * i;
        const y = padding.top + chartHeight - (chartHeight / 4) * i;
        ctx.fillText(formatCurrencyShort(value), padding.left - 5, y + 3);
    }
}

function updateLoanChartFromAPI(yearlySummary) {
    const canvas = document.getElementById('loan-canvas');
    if (!canvas || !yearlySummary || yearlySummary.length === 0) return;

    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth * 2;
    canvas.height = canvas.offsetHeight * 2;
    ctx.scale(2, 2);

    const width = canvas.offsetWidth;
    const height = canvas.offsetHeight;
    const padding = { top: 20, right: 20, bottom: 40, left: 60 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    ctx.clearRect(0, 0, width, height);

    const maxValue = Math.max(...yearlySummary.map(y => y.principal + y.interest));
    const barWidth = (chartWidth / yearlySummary.length) * 0.7;
    const barGap = (chartWidth / yearlySummary.length) * 0.3;

    yearlySummary.forEach((data, i) => {
        const x = padding.left + i * (barWidth + barGap) + barGap / 2;
        const principalHeight = (data.principal / maxValue) * chartHeight;
        const interestHeight = (data.interest / maxValue) * chartHeight;

        // Interest (bottom)
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(x, padding.top + chartHeight - interestHeight, barWidth, interestHeight);

        // Principal (top)
        ctx.fillStyle = '#6366f1';
        ctx.fillRect(x, padding.top + chartHeight - interestHeight - principalHeight, barWidth, principalHeight);

        // Year label
        ctx.fillStyle = '#6b7280';
        ctx.font = '10px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`Y${data.year}`, x + barWidth / 2, height - 10);
    });

    // Y-axis labels
    ctx.fillStyle = '#6b7280';
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 4; i++) {
        const value = (maxValue / 4) * i;
        const y = padding.top + chartHeight - (chartHeight / 4) * i;
        ctx.fillText(formatCurrencyShort(value), padding.left - 5, y + 3);
    }
}

function updateAmortizationTable() {
    const body = document.getElementById('amortization-body');
    if (!body || amortizationSchedule.length === 0) return;

    let rows;
    if (viewMode === 'yearly') {
        const yearly = [];
        for (let i = 0; i < amortizationSchedule.length; i += 12) {
            const yearData = amortizationSchedule.slice(i, i + 12);
            yearly.push({
                period: `Year ${Math.floor(i / 12) + 1}`,
                payment: yearData.reduce((s, p) => s + p.payment, 0),
                principal: yearData.reduce((s, p) => s + p.principal, 0),
                interest: yearData.reduce((s, p) => s + p.interest, 0),
                balance: yearData[yearData.length - 1].balance
            });
        }
        rows = yearly;
    } else {
        rows = amortizationSchedule.slice(0, 60).map(p => ({
            period: `Month ${p.month}`,
            payment: p.payment,
            principal: p.principal,
            interest: p.interest,
            balance: p.balance
        }));
    }

    body.innerHTML = rows.map(r => `
        <tr>
            <td>${r.period}</td>
            <td>${formatCurrency(r.payment)}</td>
            <td>${formatCurrency(r.principal)}</td>
            <td>${formatCurrency(r.interest)}</td>
            <td>${formatCurrency(r.balance)}</td>
        </tr>
    `).join('');
}

function exportLoanToCSV() {
    if (!loanData || amortizationSchedule.length === 0) { showNotification('Calculate loan first', 'error'); return; }

    let csv = 'Month,Payment,Principal,Interest,Balance\n';
    amortizationSchedule.forEach(p => {
        csv += `${p.month},${p.payment.toFixed(2)},${p.principal.toFixed(2)},${p.interest.toFixed(2)},${p.balance.toFixed(2)}\n`;
    });

    downloadFile(csv, 'amortization-schedule.csv', 'text/csv');
    showNotification('CSV downloaded!', 'success');
}

function exportLoanToPDF() {
    if (!loanData) { showNotification('Calculate loan first', 'error'); return; }

    const content = `LOAN AMORTIZATION REPORT
Generated: ${new Date().toLocaleDateString()}

${'='.repeat(50)}
LOAN DETAILS
${'='.repeat(50)}
Loan Amount: ${formatCurrency(loanData.principal)}
Interest Rate: ${loanData.annualRate}%
Loan Term: ${loanData.years} years
Extra Monthly Payment: ${formatCurrency(loanData.extraPayment)}

${'='.repeat(50)}
RESULTS
${'='.repeat(50)}
Monthly Payment: ${formatCurrency(loanData.monthlyPayment)}
Total Interest: ${formatCurrency(loanData.acceleratedInterest)}
Interest Savings: ${formatCurrency(loanData.interestSavings)}
Time Saved: ${Math.floor(loanData.monthsSaved / 12)} years ${loanData.monthsSaved % 12} months
Payoff Time: ${(loanData.acceleratedMonths / 12).toFixed(1)} years

${'='.repeat(50)}
COMPARISON
${'='.repeat(50)}
Standard Payoff: ${loanData.standardMonths} months (${loanData.standardYears} years)
With Extra Payments: ${loanData.acceleratedMonths} months
`;

    downloadFile(content, 'loan-analysis-report.txt', 'text/plain');
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
