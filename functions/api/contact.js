import { sendNotificationEmail } from './_email.js';

const ADMIN_EMAIL = 'vu@cookcountytaxcompare.com';

export const onRequestPost = async (context) => {
        try {
                const { name, email, phone, propertyAddress, message, inquiryType, insuranceTypes } = await context.request.json();

                const isInsuranceInquiry = String(inquiryType || '').toLowerCase() === 'insurance';

                if (!name || (!email && !isInsuranceInquiry)) {
                        return jsonResponse({ error: 'Name and email are required' }, 400);
                }

                if (isInsuranceInquiry && !email && !phone) {
                        return jsonResponse({ error: 'Please provide an email address or phone number.' }, 400);
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
                const normalizedType = isInsuranceInquiry ? 'Insurance Inquiry' : 'Appeal Help Request';
                const selectedInsurance = Array.isArray(insuranceTypes) && insuranceTypes.length
                        ? insuranceTypes.join(', ')
                        : 'Not provided';

                const html = `
                        <h2>New ${escapeHtml(normalizedType)}</h2>
                        <table cellpadding="8" cellspacing="0" style="border-collapse: collapse;">
                                <tr><td><strong>Inquiry Type</strong></td><td>${escapeHtml(normalizedType)}</td></tr>
                                <tr><td><strong>Name</strong></td><td>${escapeHtml(name)}</td></tr>
                                <tr><td><strong>Email</strong></td><td>${escapeHtml(email)}</td></tr>
                                <tr><td><strong>Phone</strong></td><td>${escapeHtml(phone || 'Not provided')}</td></tr>
                                <tr><td><strong>Insurance Interest</strong></td><td>${escapeHtml(selectedInsurance)}</td></tr>
                                <tr><td><strong>Property Address</strong></td><td>${escapeHtml(propertyAddress || 'Not provided')}</td></tr>
                                <tr><td><strong>Submitted</strong></td><td>${escapeHtml(submittedAt)}</td></tr>
                        </table>
                        <h3>Message</h3>
                        <p>${escapeHtml(message || 'No message provided').replace(/\n/g, '<br>')}</p>
                `;
                const text = [
                        `New ${normalizedType}`,
                        '',
                        `Inquiry Type: ${normalizedType}`,
                        `Name: ${name}`,
                        `Email: ${email}`,
                        `Phone: ${phone || 'Not provided'}`,
                        `Insurance Interest: ${selectedInsurance}`,
                        `Property Address: ${propertyAddress || 'Not provided'}`,
                        `Submitted: ${submittedAt}`,
                        '',
                        'Message:',
                        message || 'No message provided'
                ].join('\n');

                const result = await sendNotificationEmail(context.env, {
                        from,
                        to,
                        replyTo: email || undefined,
                        subject: `${normalizedType} from ${name}`,
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
