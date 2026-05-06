const DEFAULT_ADMIN_EMAIL = 'vu@cookcountytaxcompare.com';

export async function sendPaymentNotification(env, payment) {
        const apiKey = env.RESEND_API_KEY;
        if (!apiKey) {
                console.warn('RESEND_API_KEY is not configured; skipping payment notification email.');
                return { skipped: true, reason: 'missing_resend_api_key' };
        }

        const to = env.ADMIN_NOTIFICATION_EMAIL || DEFAULT_ADMIN_EMAIL;
        const from = env.NOTIFICATION_FROM_EMAIL || 'Cook County Tax Compare <onboarding@resend.dev>';
        const paymentDate = payment.paymentDate ? new Date(payment.paymentDate).toLocaleString('en-US', {
                timeZone: 'America/Chicago',
                dateStyle: 'medium',
                timeStyle: 'short'
        }) : new Date().toLocaleString('en-US', {
                timeZone: 'America/Chicago',
                dateStyle: 'medium',
                timeStyle: 'short'
        });

        const payerName = payment.customerName || 'Not provided';
        const payerEmail = payment.customerEmail || 'Not provided';
        const propertyAddress = payment.propertyAddress || 'Not provided';
        const amount = typeof payment.paymentAmount === 'number'
                ? `$${(payment.paymentAmount / 100).toFixed(2)}`
                : 'Not provided';

        const html = `
                <h2>New Pending Property Appeal</h2>
                <p>A customer paid for appeal help and the appeal is now pending in the admin dashboard.</p>
                <table cellpadding="8" cellspacing="0" style="border-collapse: collapse;">
                        <tr><td><strong>Name</strong></td><td>${escapeHtml(payerName)}</td></tr>
                        <tr><td><strong>Email</strong></td><td>${escapeHtml(payerEmail)}</td></tr>
                        <tr><td><strong>Property Address</strong></td><td>${escapeHtml(propertyAddress)}</td></tr>
                        <tr><td><strong>Payment Date</strong></td><td>${escapeHtml(paymentDate)}</td></tr>
                        <tr><td><strong>Amount</strong></td><td>${escapeHtml(amount)}</td></tr>
                        <tr><td><strong>Stripe Session</strong></td><td>${escapeHtml(payment.transactionId || 'Not provided')}</td></tr>
                </table>
        `;

        const text = [
                'New Pending Property Appeal',
                '',
                'A customer paid for appeal help and the appeal is now pending in the admin dashboard.',
                '',
                `Name: ${payerName}`,
                `Email: ${payerEmail}`,
                `Property Address: ${propertyAddress}`,
                `Payment Date: ${paymentDate}`,
                `Amount: ${amount}`,
                `Stripe Session: ${payment.transactionId || 'Not provided'}`
        ].join('\n');

        const response = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                        from,
                        to,
                        subject: `Pending appeal: ${propertyAddress}`,
                        html,
                        text
                })
        });

        if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Email notification failed: ${errorText}`);
        }

        return response.json();
}

function escapeHtml(value) {
        return String(value || '').replace(/[&<>"']/g, char => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#039;'
        })[char]);
}
