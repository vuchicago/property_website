export function normalizeAddress(value) {
        return String(value || '')
                .toUpperCase()
                .replace(/[^A-Z0-9]+/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
}

function canonicalAddress(value) {
        const suffixes = new Map([
                ['AVENUE', 'AVE'],
                ['STREET', 'ST'],
                ['ROAD', 'RD'],
                ['BOULEVARD', 'BLVD'],
                ['DRIVE', 'DR'],
                ['COURT', 'CT'],
                ['PLACE', 'PL'],
                ['LANE', 'LN'],
                ['TERRACE', 'TER'],
                ['CIRCLE', 'CIR'],
                ['PARKWAY', 'PKWY'],
                ['HIGHWAY', 'HWY'],
                ['NORTH', 'N'],
                ['SOUTH', 'S'],
                ['EAST', 'E'],
                ['WEST', 'W']
        ]);

        return normalizeAddress(value)
                .split(' ')
                .map(token => suffixes.get(token) || token)
                .join(' ');
}

function addressTokens(value) {
        return canonicalAddress(value)
                .split(' ')
                .filter(token => token.length > 1 || /^\d+$/.test(token));
}

function levenshteinRatio(left, right) {
        if (left === right) {
                return 100;
        }

        if (!left || !right) {
                return 0;
        }

        const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
        const current = Array(right.length + 1).fill(0);

        for (let i = 1; i <= left.length; i += 1) {
                current[0] = i;
                for (let j = 1; j <= right.length; j += 1) {
                        const substitutionCost = left[i - 1] === right[j - 1] ? 0 : 1;
                        current[j] = Math.min(
                                current[j - 1] + 1,
                                previous[j] + 1,
                                previous[j - 1] + substitutionCost
                        );
                }
                previous.splice(0, previous.length, ...current);
        }

        const distance = previous[right.length];
        return Math.round((1 - distance / Math.max(left.length, right.length)) * 100);
}

function tokenSetRatio(left, right) {
        const leftTokens = new Set(addressTokens(left));
        const rightTokens = new Set(addressTokens(right));

        if (!leftTokens.size || !rightTokens.size) {
                return 0;
        }

        let intersection = 0;
        leftTokens.forEach(token => {
                if (rightTokens.has(token)) {
                        intersection += 1;
                }
        });

        return Math.round((2 * intersection / (leftTokens.size + rightTokens.size)) * 100);
}

function scoreAddressMatch(query, candidate) {
        const normalizedQuery = normalizeAddress(query);
        const normalizedCandidate = normalizeAddress(candidate.normalized_address || candidate.address);
        const canonicalQuery = canonicalAddress(query);
        const canonicalCandidate = canonicalAddress(candidate.normalized_address || candidate.address);

        if (!normalizedQuery || !normalizedCandidate) {
                return 0;
        }

        if (canonicalCandidate === canonicalQuery) {
                return 5000;
        }

        let score = 0;

        if (normalizedCandidate === normalizedQuery) {
                score += 2500;
        }

        if (canonicalCandidate.startsWith(canonicalQuery)) {
                score += 1400;
        }

        if (canonicalCandidate.includes(canonicalQuery)) {
                score += 1200;
        }

        if (canonicalQuery.includes(canonicalCandidate)) {
                score += 900;
        }

        const queryTokens = addressTokens(canonicalQuery);
        const candidateTokens = addressTokens(canonicalCandidate);
        const candidateTokenSet = new Set(candidateTokens);
        let matchedTokens = 0;

        queryTokens.forEach((token, index) => {
                if (candidateTokenSet.has(token)) {
                        matchedTokens += 1;
                        score += index === 0 && /^\d+$/.test(token) ? 450 : 110;
                } else if (candidateTokens.some(candidateToken => candidateToken.startsWith(token))) {
                        matchedTokens += 0.5;
                        score += 55;
                }
        });

        if (queryTokens.length) {
                score += Math.round((matchedTokens / queryTokens.length) * 500);
        }

        score += levenshteinRatio(canonicalQuery, canonicalCandidate) * 4;
        score += tokenSetRatio(canonicalQuery, canonicalCandidate) * 3;
        score -= Math.min(180, Math.abs(canonicalCandidate.length - canonicalQuery.length) * 3);
        return score;
}

function buildCandidateQuery(query, limit) {
        const normalizedQuery = normalizeAddress(query);
        const canonicalQuery = canonicalAddress(query);
        const tokens = addressTokens(canonicalQuery);
        const firstNumber = tokens.find(token => /^\d+$/.test(token));
        const streetToken = tokens.find(token => !/^\d+$/.test(token) && token.length >= 3);
        const params = [];
        const clauses = [];

        clauses.push('normalized_address = ?');
        params.push(normalizedQuery);

        if (canonicalQuery !== normalizedQuery) {
                clauses.push('normalized_address = ?');
                params.push(canonicalQuery);
        }

        clauses.push('normalized_address LIKE ?');
        params.push(`${normalizedQuery}%`);

        clauses.push('normalized_address LIKE ?');
        params.push(`${canonicalQuery}%`);

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

export async function getAddressSuggestions(db, query, limit = 5) {
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
