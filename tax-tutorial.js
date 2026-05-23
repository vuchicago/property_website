document.addEventListener('DOMContentLoaded', () => {
    initTaxTutorialCalculator();
});

function initTaxTutorialCalculator() {
    const form = document.getElementById('tax-tutorial-calculator');
    if (!form) return;

    const fields = {
        marketValue: document.getElementById('tutorial-market-value'),
        assessmentLevel: document.getElementById('tutorial-assessment-level'),
        equalizer: document.getElementById('tutorial-equalizer'),
        taxRate: document.getElementById('tutorial-tax-rate'),
        exemption: document.getElementById('tutorial-exemption')
    };

    const outputs = {
        assessedValue: document.getElementById('tutorial-assessed-value'),
        eav: document.getElementById('tutorial-eav'),
        taxBeforeExemptions: document.getElementById('tutorial-before-exemptions'),
        finalBill: document.getElementById('tutorial-final-bill'),
        formula: document.getElementById('tutorial-formula'),
        eavBar: document.getElementById('tutorial-eav-bar'),
        billBar: document.getElementById('tutorial-bill-bar')
    };

    const update = () => {
        const marketValue = numberValue(fields.marketValue, 410000);
        const assessmentLevel = numberValue(fields.assessmentLevel, 10) / 100;
        const equalizer = numberValue(fields.equalizer, 3.0355);
        const taxRate = numberValue(fields.taxRate, 17.601587) / 100;
        const exemption = numberValue(fields.exemption, 10000);

        const assessedValue = marketValue * assessmentLevel;
        const eav = assessedValue * equalizer;
        const taxBeforeExemptions = eav * taxRate;
        const adjustedEav = Math.max(0, eav - exemption);
        const finalBill = adjustedEav * taxRate;

        setText(outputs.assessedValue, currency(assessedValue));
        setText(outputs.eav, currency(eav));
        setText(outputs.taxBeforeExemptions, currency(taxBeforeExemptions));
        setText(outputs.finalBill, currency(finalBill));
        setText(
            outputs.formula,
            `((${currency(marketValue)} x ${(assessmentLevel * 100).toFixed(1)}% x ${equalizer.toFixed(4)}) - ${currency(exemption)} exemption EAV) x ${(taxRate * 100).toFixed(4)}%`
        );

        if (outputs.eavBar && outputs.billBar) {
            const eavRatio = Math.min(100, Math.max(8, (eav / Math.max(marketValue, 1)) * 100));
            const billRatio = Math.min(100, Math.max(8, (finalBill / Math.max(taxBeforeExemptions, 1)) * 100));
            outputs.eavBar.style.width = `${eavRatio}%`;
            outputs.billBar.style.width = `${billRatio}%`;
        }
    };

    Object.values(fields).forEach(input => input?.addEventListener('input', update));
    update();
}

function numberValue(input, fallback) {
    const value = Number(input?.value);
    return Number.isFinite(value) ? value : fallback;
}

function setText(element, value) {
    if (element) element.textContent = value;
}

function currency(value) {
    return Number(value).toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0
    });
}
