const DEFAULT_SITE_KEY = '6LeNgd4sAAAAAKKCg97Ad6Pt5RjyqPBHV1unrCj7';
const DEFAULT_THRESHOLD = 0.5;
const ALLOWED_ACTIONS = new Set(['password_login', 'password_signup']);

export const onRequestPost = async (context) => {
        try {
                const { token, action } = await context.request.json();
                const expectedAction = String(action || '').trim();

                if (!token || !ALLOWED_ACTIONS.has(expectedAction)) {
                        return jsonResponse({ error: 'Invalid reCAPTCHA request.' }, 400);
                }

                const projectId = context.env.RECAPTCHA_PROJECT_ID;
                const apiKey = context.env.RECAPTCHA_ENTERPRISE_API_KEY;
                const siteKey = context.env.RECAPTCHA_SITE_KEY || DEFAULT_SITE_KEY;
                const threshold = Number(context.env.RECAPTCHA_MIN_SCORE || DEFAULT_THRESHOLD);

                if (!projectId || !apiKey) {
                        return jsonResponse({ error: 'reCAPTCHA is not configured.' }, 500);
                }

                const response = await fetch(
                        `https://recaptchaenterprise.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/assessments?key=${encodeURIComponent(apiKey)}`,
                        {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                        event: {
                                                token,
                                                siteKey,
                                                expectedAction
                                        }
                                })
                        }
                );

                const assessment = await response.json();

                if (!response.ok) {
                        return jsonResponse({ error: 'Could not verify reCAPTCHA.' }, 500);
                }

                const tokenProperties = assessment.tokenProperties || {};
                const riskAnalysis = assessment.riskAnalysis || {};

                if (!tokenProperties.valid) {
                        return jsonResponse({ error: 'reCAPTCHA verification failed.' }, 403);
                }

                if (tokenProperties.action && tokenProperties.action !== expectedAction) {
                        return jsonResponse({ error: 'reCAPTCHA action mismatch.' }, 403);
                }

                const score = typeof riskAnalysis.score === 'number' ? riskAnalysis.score : 0;
                if (score < threshold) {
                        return jsonResponse({ error: 'reCAPTCHA score was too low.' }, 403);
                }

                return jsonResponse({ success: true, score });
        } catch (error) {
                return jsonResponse({ error: 'Could not verify reCAPTCHA.' }, 500);
        }
};

function jsonResponse(body, status = 200) {
        return new Response(JSON.stringify(body), {
                status,
                headers: { 'Content-Type': 'application/json' }
        });
}
