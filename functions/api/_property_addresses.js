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
        const queryNumber = queryTokens.find(token => /^\d+$/.test(token));
        const queryStreetTokens = queryTokens.filter(token => !/^\d+$/.test(token) && token.length >= 3);
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

        if (queryNumber && candidateTokenSet.has(queryNumber)) {
                score += 1200;
                if (candidateTokens[0] === queryNumber) {
                        score += 400;
                }
        }

        const matchedStreetTokens = queryStreetTokens.filter(token => candidateTokenSet.has(token)).length;
        if (queryStreetTokens.length) {
                score += matchedStreetTokens * 900;
                if (matchedStreetTokens === queryStreetTokens.length) {
                        score += 1600;
                }
        }

        if (queryTokens.length) {
                score += Math.round((matchedTokens / queryTokens.length) * 500);
        }

        score += levenshteinRatio(canonicalQuery, canonicalCandidate) * 4;
        score += tokenSetRatio(canonicalQuery, canonicalCandidate) * 3;
        score -= Math.min(180, Math.abs(canonicalCandidate.length - canonicalQuery.length) * 3);
        return score;
}

function prefixUpperBound(prefix) {
        if (!prefix) {
                return null;
        }

        return `${prefix}\uffff`;
}

function addPrefixClause(clauses, params, column, prefix) {
        const normalizedPrefix = normalizeAddress(prefix);
        const upperBound = prefixUpperBound(normalizedPrefix);
        if (!normalizedPrefix || !upperBound) {
                return;
        }

        clauses.push(`(${column} >= ? AND ${column} < ?)`);
        params.push(normalizedPrefix, upperBound);
}

function buildSearchTableCandidateQuery(query, limit) {
        const normalizedQuery = normalizeAddress(query);
        const canonicalQuery = canonicalAddress(query);
        const tokens = addressTokens(canonicalQuery);
        const firstNumber = tokens.find(token => /^\d+$/.test(token));
        const params = [];
        const clauses = [];

        clauses.push('normalized_address = ?');
        params.push(normalizedQuery);

        if (canonicalQuery !== normalizedQuery) {
                clauses.push('normalized_address = ?');
                params.push(canonicalQuery);
        }

        addPrefixClause(clauses, params, 'normalized_address', normalizedQuery);
        addPrefixClause(clauses, params, 'normalized_address', canonicalQuery);

        if (firstNumber) {
                addPrefixClause(clauses, params, 'normalized_address', firstNumber);
        }
        if (/^\d{10,14}$/.test(normalizedQuery)) {
                addPrefixClause(clauses, params, 'pin', normalizedQuery);
        }

        params.push(Math.max(limit * 8, 40));

        return {
                sql: `SELECT
                        id,
                        pin,
                        address,
                        normalized_address,
                        property_key,
                        mailing_name,
                        pin_proration_rate
                      FROM property_address_search
                      WHERE ${clauses.join(' OR ')}
                      ORDER BY normalized_address
                      LIMIT ?`,
                params
        };
}

function buildCandidateQuery(query, limit, { broad = false } = {}) {
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

        addPrefixClause(clauses, params, 'normalized_address', normalizedQuery);
        addPrefixClause(clauses, params, 'normalized_address', canonicalQuery);

        if (firstNumber) {
                addPrefixClause(clauses, params, 'normalized_address', firstNumber);
        } else if (broad && streetToken) {
                clauses.push('normalized_address LIKE ?');
                params.push(`%${streetToken}%`);
        }

        if (broad && normalizedQuery.length >= 10) {
                clauses.push('normalized_address LIKE ?');
                params.push(`%${normalizedQuery}%`);
        }

        if (/^\d{10,14}$/.test(normalizedQuery)) {
                addPrefixClause(clauses, params, 'pin', normalizedQuery);
        }

        params.push(Math.max(limit * 8, 40));
        const propertyKey = `CASE
                        WHEN pin_proration_rate IS NOT NULL AND pin_proration_rate < 1
                        THEN normalized_address || '|fractional'
                        ELSE normalized_address || '|pin:' || COALESCE(pin, id)
                      END`;

        return {
                sql: `SELECT
                        MIN(id) AS id,
                        group_concat(pin, ', ') AS pin,
                        address,
                        normalized_address,
                        ${propertyKey} AS property_key,
                        MAX(mailing_name) AS mailing_name,
                        SUM(pin_proration_rate) AS pin_proration_rate
                      FROM property_addresses
                      WHERE ${clauses.join(' OR ')}
                      GROUP BY property_key
                      ORDER BY normalized_address
                      LIMIT ?`,
                params
        };
}

function buildStreetTokenQuery(query, limit) {
        const canonicalQuery = canonicalAddress(query);
        const tokens = addressTokens(canonicalQuery);
        const firstNumber = tokens.find(token => /^\d+$/.test(token));
        const streetToken = tokens.find(token => !/^\d+$/.test(token) && token.length >= 3);

        if (!firstNumber || !streetToken) {
                return null;
        }

        const propertyKey = `CASE
                        WHEN pin_proration_rate IS NOT NULL AND pin_proration_rate < 1
                        THEN normalized_address || '|fractional'
                        ELSE normalized_address || '|pin:' || COALESCE(pin, id)
                      END`;

        return {
                sql: `SELECT
                        MIN(id) AS id,
                        group_concat(pin, ', ') AS pin,
                        address,
                        normalized_address,
                        ${propertyKey} AS property_key,
                        MAX(mailing_name) AS mailing_name,
                        SUM(pin_proration_rate) AS pin_proration_rate
                      FROM property_addresses
                      WHERE normalized_address >= ?
                        AND normalized_address < ?
                        AND normalized_address LIKE ?
                      GROUP BY property_key
                      ORDER BY normalized_address
                      LIMIT ?`,
                params: [
                        firstNumber,
                        prefixUpperBound(firstNumber),
                        `%${streetToken}%`,
                        Math.max(limit * 12, 60)
                ]
        };
}

async function getStreetTokenSuggestions(db, normalizedQuery, limit, rankCandidates) {
        const streetTokenQuery = buildStreetTokenQuery(normalizedQuery, limit);
        if (!streetTokenQuery) {
                return [];
        }

        const streetTokenResults = await db.prepare(streetTokenQuery.sql).bind(...streetTokenQuery.params).all();
        return rankCandidates(streetTokenResults.results);
}

export async function getAddressSuggestions(db, query, limit = 5) {
        const normalizedQuery = normalizeAddress(query);

        if (normalizedQuery.length < 3) {
                return [];
        }

        const rankCandidates = results => (results || [])
                .map(candidate => ({
                        ...candidate,
                        score: scoreAddressMatch(normalizedQuery, candidate)
                }))
                .filter(candidate => candidate.score > 0)
                .sort((a, b) => b.score - a.score || a.address.length - b.address.length)
                .slice(0, limit);

        try {
                const searchTableQuery = buildSearchTableCandidateQuery(normalizedQuery, limit);
                const searchTableResults = await db.prepare(searchTableQuery.sql).bind(...searchTableQuery.params).all();
                const searchTableSuggestions = rankCandidates(searchTableResults.results);

                if (normalizedQuery.length < 6) {
                        return searchTableSuggestions;
                }

                const streetTokenSuggestions = await getStreetTokenSuggestions(db, normalizedQuery, limit, rankCandidates);
                const byPropertyKey = new Map();

                [...searchTableSuggestions, ...streetTokenSuggestions].forEach(candidate => {
                        const key = candidate.property_key || candidate.id;
                        const existing = byPropertyKey.get(key);
                        if (!existing || candidate.score > existing.score) {
                                byPropertyKey.set(key, candidate);
                        }
                });

                const blendedSuggestions = Array.from(byPropertyKey.values())
                        .sort((a, b) => b.score - a.score || a.address.length - b.address.length)
                        .slice(0, limit);

                if (
                        blendedSuggestions.length >= limit ||
                        streetTokenSuggestions.length ||
                        searchTableSuggestions.some(candidate => candidate.score >= 4500)
                ) {
                        return blendedSuggestions;
                }
        } catch (error) {
                if (!String(error?.message || '').toLowerCase().includes('property_address_search')) {
                        throw error;
                }
        }

        const fastQuery = buildCandidateQuery(normalizedQuery, limit);
        const fastResults = await db.prepare(fastQuery.sql).bind(...fastQuery.params).all();
        const fastSuggestions = rankCandidates(fastResults.results);

        if (fastSuggestions.length >= limit || normalizedQuery.length < 6) {
                return fastSuggestions;
        }

        const streetTokenSuggestions = await getStreetTokenSuggestions(db, normalizedQuery, limit, rankCandidates);

        const broadQuery = buildCandidateQuery(normalizedQuery, limit, { broad: true });
        const broadResults = await db.prepare(broadQuery.sql).bind(...broadQuery.params).all();
        const byPropertyKey = new Map();

        [...fastSuggestions, ...streetTokenSuggestions, ...rankCandidates(broadResults.results)].forEach(candidate => {
                const key = candidate.property_key || candidate.id;
                const existing = byPropertyKey.get(key);
                if (!existing || candidate.score > existing.score) {
                        byPropertyKey.set(key, candidate);
                }
        });

        return Array.from(byPropertyKey.values())
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
