const DEFAULT_ADMIN_EMAIL = 'vu@cookcountytaxcompare.com';
const DEFAULT_CLOUDFLARE_FROM_EMAIL = 'Cook County Tax Compare <notifications@inquiry.cookcountytaxcompare.com>';

export async function sendPaymentNotification(env, payment) {
        const to = env.ADMIN_NOTIFICATION_EMAIL || DEFAULT_ADMIN_EMAIL;
        const from = getDefaultFrom(env);
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

        return sendNotificationEmail(env, {
                from,
                to,
                subject: `Pending appeal: ${propertyAddress}`,
                html,
                text
        });
}

export async function sendNotificationEmail(env, email) {
        if (env.RESEND_API_KEY) {
                return sendWithResend(env.RESEND_API_KEY, email);
        }

        if (env.CLOUDFLARE_EMAIL_API_TOKEN && env.CLOUDFLARE_ACCOUNT_ID) {
                return sendWithCloudflareEmailApi(env, email);
        }

        if (env.EMAIL && typeof env.EMAIL.send === 'function') {
                return sendWithCloudflareEmail(env.EMAIL, email);
        }

        console.warn('No outbound email provider is configured.');
        return { skipped: true, reason: 'email_not_configured' };
}

async function sendWithResend(apiKey, email) {
        const response = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                        from: email.from,
                        to: email.to,
                        reply_to: email.replyTo,
                        subject: email.subject,
                        html: email.html,
                        text: email.text
                })
        });

        if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Email notification failed: ${errorText}`);
        }

        return response.json();
}

async function sendWithCloudflareEmailApi(env, email) {
        const response = await fetch(
                `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/email/sending/send`,
                {
                        method: 'POST',
                        headers: {
                                'Authorization': `Bearer ${env.CLOUDFLARE_EMAIL_API_TOKEN}`,
                                'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                                from: parseEmailIdentity(email.from),
                                to: email.to,
                                reply_to: email.replyTo,
                                subject: email.subject,
                                html: email.html,
                                text: email.text || stripHtml(email.html || '')
                        })
                }
        );

        const result = await response.json().catch(() => null);
        if (!response.ok || result?.success === false) {
                const errorText = result ? JSON.stringify(result) : await response.text();
                throw new Error(`Cloudflare email notification failed: ${errorText}`);
        }

        return { success: true, provider: 'cloudflare_email_api', result };
}

async function sendWithCloudflareEmail(binding, email) {
        await binding.send({
                from: email.from,
                to: email.to,
                replyTo: email.replyTo,
                subject: email.subject,
                html: email.html,
                text: email.text || stripHtml(email.html || '')
        });
        return { success: true, provider: 'cloudflare_email' };
}

function parseEmailIdentity(value) {
        const input = String(value || '').trim();
        const match = input.match(/^(.+?)\s*<([^>]+)>$/);
        if (!match) {
                return input;
        }

        return {
                name: match[1].replace(/^["']|["']$/g, '').trim(),
                address: match[2].trim()
        };
}

function stripHtml(value) {
        return String(value || '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '');
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

function getDefaultFrom(env) {
        if (env.NOTIFICATION_FROM_EMAIL) {
                return env.NOTIFICATION_FROM_EMAIL;
        }

        if (env.RESEND_API_KEY) {
                return 'Cook County Tax Compare <onboarding@resend.dev>';
        }

        return DEFAULT_CLOUDFLARE_FROM_EMAIL;
}
