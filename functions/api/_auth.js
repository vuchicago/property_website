const FIREBASE_PROJECT_ID = 'cookcounty-tax-compare';
const FIREBASE_ISSUER = `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`;
const FIREBASE_CERTS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

let jwksCache = null;
let jwksCacheExpiresAt = 0;

function jsonResponse(body, status = 200) {
        return new Response(JSON.stringify(body), {
                status,
                headers: { 'Content-Type': 'application/json' }
        });
}

function base64UrlToBytes(value) {
        const base64 = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
        const binary = atob(base64);
        return Uint8Array.from(binary, char => char.charCodeAt(0));
}

function decodeJwtPart(value) {
        const bytes = base64UrlToBytes(value);
        return JSON.parse(new TextDecoder().decode(bytes));
}

async function getFirebaseJwks() {
        const now = Date.now();
        if (jwksCache && jwksCacheExpiresAt > now) {
                return jwksCache;
        }

        const response = await fetch(FIREBASE_CERTS_URL);
        if (!response.ok) {
                throw new Error('Unable to load Firebase public keys');
        }

        jwksCache = await response.json();
        const cacheControl = response.headers.get('cache-control') || '';
        const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
        const maxAge = maxAgeMatch ? Number(maxAgeMatch[1]) : 3600;
        jwksCacheExpiresAt = now + maxAge * 1000;
        return jwksCache;
}

export async function requireFirebaseUser(request) {
        const header = request.headers.get('authorization') || '';
        const match = header.match(/^Bearer\s+(.+)$/i);

        if (!match) {
                return { response: jsonResponse({ error: 'Missing authorization token' }, 401) };
        }

        try {
                const token = match[1];
                const parts = token.split('.');
                if (parts.length !== 3) {
                        throw new Error('Invalid token format');
                }

                const [encodedHeader, encodedPayload, encodedSignature] = parts;
                const headerJson = decodeJwtPart(encodedHeader);
                const payload = decodeJwtPart(encodedPayload);
                const jwks = await getFirebaseJwks();
                const key = jwks.keys?.find(item => item.kid === headerJson.kid);

                if (!key) {
                        throw new Error('Unknown Firebase signing key');
                }

                const cryptoKey = await crypto.subtle.importKey(
                        'jwk',
                        key,
                        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
                        false,
                        ['verify']
                );
                const signedContent = new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`);
                const signature = base64UrlToBytes(encodedSignature);
                const verified = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', cryptoKey, signature, signedContent);

                if (!verified) {
                        throw new Error('Invalid token signature');
                }

                const nowSeconds = Math.floor(Date.now() / 1000);
                if (payload.aud !== FIREBASE_PROJECT_ID || payload.iss !== FIREBASE_ISSUER || payload.exp <= nowSeconds || !payload.sub) {
                        throw new Error('Invalid token claims');
                }

                return {
                        user: {
                                uid: payload.sub,
                                email: payload.email || null
                        }
                };
        } catch (error) {
                return { response: jsonResponse({ error: 'Unauthorized' }, 401) };
        }
}

export { jsonResponse };
