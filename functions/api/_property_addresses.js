export function normalizeAddress(value) {
        return String(value || '')
                .toUpperCase()
                .replace(/[^A-Z0-9]+/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
}

function addressTokens(value) {
        return normalizeAddress(value)
                .split(' ')
                .filter(token => token.length > 1 || /^\d+$/.test(token));
}

function scoreAddressMatch(query, candidate) {
        const normalizedQuery = normalizeAddress(query);
        const normalizedCandidate = normalizeAddress(candidate.normalized_address || candidate.address);

        if (!normalizedQuery || !normalizedCandidate) {
                return 0;
        }

        if (normalizedCandidate === normalizedQuery) {
                return 1000;
        }

        let score = 0;

        if (normalizedCandidate.startsWith(normalizedQuery)) {
                score += 700;
        }

        if (normalizedCandidate.includes(normalizedQuery)) {
                score += 600;
        }

        if (normalizedQuery.includes(normalizedCandidate)) {
                score += 500;
        }

        const queryTokens = addressTokens(query);
        const candidateTokens = addressTokens(normalizedCandidate);
        const candidateTokenSet = new Set(candidateTokens);
        let matchedTokens = 0;

        queryTokens.forEach((token, index) => {
                if (candidateTokenSet.has(token)) {
                        matchedTokens += 1;
                        score += index === 0 && /^\d+$/.test(token) ? 120 : 55;
                } else if (candidateTokens.some(candidateToken => candidateToken.startsWith(token))) {
                        matchedTokens += 0.5;
                        score += 25;
                }
        });

        if (queryTokens.length) {
                score += Math.round((matchedTokens / queryTokens.length) * 200);
        }

        score -= Math.min(80, Math.abs(normalizedCandidate.length - normalizedQuery.length));
        return score;
}

function buildCandidateQuery(query, limit) {
        const normalizedQuery = normalizeAddress(query);
        const tokens = addressTokens(query);
        const firstNumber = tokens.find(token => /^\d+$/.test(token));
        const streetToken = tokens.find(token => !/^\d+$/.test(token) && token.length >= 3);
        const params = [];
        const clauses = [];

        clauses.push('normalized_address = ?');
        params.push(normalizedQuery);

        clauses.push('normalized_address LIKE ?');
        params.push(`${normalizedQuery}%`);

        if (firstNumber && streetToken) {
                clauses.push('normalized_address LIKE ?');
                params.push(`${firstNumber}%${streetToken}%`);
        } else if (firstNumber) {
                clauses.push('normalized_address LIKE ?');
                params.push(`${firstNumber}%`);
        } else if (streetToken) {
                clauses.push('normalized_address LIKE ?');
                params.push(`%${streetToken}%`);
        }

        if (normalizedQuery.length >= 10) {
                clauses.push('normalized_address LIKE ?');
                params.push(`%${normalizedQuery}%`);
        }

        if (/^\d{10,14}$/.test(normalizedQuery)) {
                clauses.push('pin LIKE ?');
                params.push(`${normalizedQuery}%`);
        }

        params.push(Math.max(limit * 8, 40));

        return {
                sql: `SELECT id, pin, address, normalized_address
                      FROM property_addresses
                      WHERE ${clauses.join(' OR ')}
                      LIMIT ?`,
                params
        };
}

export async function getAddressSuggestions(db, query, limit = 8) {
        const normalizedQuery = normalizeAddress(query);

        if (normalizedQuery.length < 3) {
                return [];
        }

        const { sql, params } = buildCandidateQuery(normalizedQuery, limit);
        const { results } = await db.prepare(sql).bind(...params).all();

        return (results || [])
                .map(candidate => ({
                        ...candidate,
                        score: scoreAddressMatch(normalizedQuery, candidate)
                }))
                .filter(candidate => candidate.score > 0)
                .sort((a, b) => b.score - a.score || a.address.length - b.address.length)
                .slice(0, limit);
}

export async function findBestPropertyAddress(db, address) {
        const suggestions = await getAddressSuggestions(db, address, 1);
        const best = suggestions[0];

        if (!best || best.score < 160) {
                return null;
        }

        return best;
}

export async function getPropertyAddressCount(db) {
        const row = await db.prepare(
                'SELECT COUNT(*) AS count FROM property_addresses'
        ).first();

        return Number(row?.count || 0);
}
