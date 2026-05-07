import { sendNotificationEmail } from './_email.js';

const ADMIN_EMAIL = 'vu@cookcountytaxcompare.com';

export const onRequestPost = async (context) => {
        try {
                const { name, email, phone, propertyAddress, message } = await context.request.json();

                if (!name || !email) {
                        return jsonResponse({ error: 'Name and email are required' }, 400);
                }

                const submittedAt = new Date().toLocaleString('en-US', {
                        timeZone: 'America/Chicago',
                        dateStyle: 'medium',
                        timeStyle: 'short'
                });
                const to = context.env.ADMIN_NOTIFICATION_EMAIL || ADMIN_EMAIL;
                const from = context.env.NOTIFICATION_FROM_EMAIL
                        || (context.env.RESEND_API_KEY
                                ? 'Cook County Tax Compare <onboarding@resend.dev>'
                                : 'Cook County Tax Compare <notifications@inquiry.cookcountytaxcompare.com>');

                const html = `
                        <h2>New Appeal Help Request</h2>
                        <table cellpadding="8" cellspacing="0" style="border-collapse: collapse;">
                                <tr><td><strong>Name</strong></td><td>${escapeHtml(name)}</td></tr>
                                <tr><td><strong>Email</strong></td><td>${escapeHtml(email)}</td></tr>
                                <tr><td><strong>Phone</strong></td><td>${escapeHtml(phone || 'Not provided')}</td></tr>
                                <tr><td><strong>Property Address</strong></td><td>${escapeHtml(propertyAddress || 'Not provided')}</td></tr>
                                <tr><td><strong>Submitted</strong></td><td>${escapeHtml(submittedAt)}</td></tr>
                        </table>
                        <h3>Message</h3>
                        <p>${escapeHtml(message || 'No message provided').replace(/\n/g, '<br>')}</p>
                `;
                const text = [
                        'New Appeal Help Request',
                        '',
                        `Name: ${name}`,
                        `Email: ${email}`,
                        `Phone: ${phone || 'Not provided'}`,
                        `Property Address: ${propertyAddress || 'Not provided'}`,
                        `Submitted: ${submittedAt}`,
                        '',
                        'Message:',
                        message || 'No message provided'
                ].join('\n');

                const result = await sendNotificationEmail(context.env, {
                        from,
                        to,
                        replyTo: email,
                        subject: `Appeal help request from ${name}`,
                        html,
                        text
                });

                if (result?.skipped) {
                        return jsonResponse({ error: 'Email service is not configured' }, 500);
                }

                return jsonResponse({ success: true });
        } catch (error) {
                return jsonResponse({ error: 'Failed to send message' }, 500);
        }
};

function jsonResponse(body, status = 200) {
        return new Response(JSON.stringify(body), {
                status,
                headers: { 'Content-Type': 'application/json' }
        });
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
