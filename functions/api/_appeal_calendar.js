const OFFICIAL_CALENDAR_URL = 'https://www.cookcountyassessoril.gov/assessment-calendar-and-deadlines';

const APPEAL_CALENDAR_2025 = [
        ['Norwood Park', '3/24/2025', '5/5/2025', '6/5/2025', '6/19/2025', '7/7/2025 - 8/5/2025', 'north-suburbs'],
        ['Evanston', '4/9/2025', '5/21/2025', '6/20/2025', '7/3/2025', '7/7/2025 - 8/5/2025', 'north-suburbs'],
        ['New Trier', '4/23/2025', '6/5/2025', '7/21/2025', '7/31/2025', '8/18/2025 - 9/16/2025', 'north-suburbs'],
        ['Elk Grove', '5/6/2025', '6/18/2025', '7/31/2025', '8/7/2025', '8/18/2025 - 9/16/2025', 'north-suburbs'],
        ['Maine', '6/4/2025', '7/18/2025', '8/18/2025', '8/27/2025', '9/22/2025 - 10/21/2025', 'north-suburbs'],
        ['Northfield', '6/17/2025', '7/31/2025', '9/12/2025', '9/25/2025', '9/22/2025 - 10/21/2025', 'north-suburbs'],
        ['Barrington', '7/3/2025', '8/15/2025', '9/5/2025', '9/18/2025', '9/22/2025 - 10/21/2025', 'north-suburbs'],
        ['Leyden', '7/21/2025', '9/2/2025', '10/10/2025', '10/22/2025', '10/23/2025 - 11/21/2025', 'north-suburbs'],
        ['Wheeling', '8/18/2025', '9/30/2025', '10/30/2025', '11/6/2025', '11/20/2025 - 12/19/2025', 'north-suburbs'],
        ['Palatine', '9/9/2025', '10/22/2025', '11/24/2025', '12/4/2025', '1/5/2026 - 2/3/2026', 'north-suburbs'],
        ['Niles', '10/22/2025', '12/5/2025', '12/26/2025', '1/8/2026', '1/20/2026 - 2/18/2026', 'north-suburbs'],
        ['Schaumburg', '10/2/2025', '11/17/2025', '12/12/2025', '12/18/2025', '', 'north-suburbs'],
        ['Hanover', '11/6/2025', '12/22/2025', '1/2/2026', '1/8/2026', '1/20/2026 - 2/18/2026', 'north-suburbs'],
        ['Riverside', '3/7/2025', '4/18/2025', '6/4/2025', '6/12/2025', '7/7/2025 - 8/5/2025', 'south-west-chicago'],
        ['River Forest', '3/7/2025', '4/18/2025', '6/4/2025', '6/19/2025', '7/7/2025 - 8/5/2025', 'south-west-chicago'],
        ['Rogers Park', '3/12/2025', '4/23/2025', '6/4/2025', '6/11/2025', '7/7/2025 - 8/5/2025', 'south-west-chicago'],
        ['Berwyn', '3/25/2025', '5/6/2025', '6/10/2025', '6/19/2025', '7/7/2025 - 8/5/2025', 'south-west-chicago'],
        ['Oak Park', '4/8/2025', '5/20/2025', '6/25/2025', '7/2/2025', '7/21/2025 - 8/19/2025', 'south-west-chicago'],
        ['Palos', '4/19/2025', '6/2/2025', '6/26/2025', '7/3/2025', '7/21/2025 - 8/19/2025', 'south-west-chicago'],
        ['Cicero', '4/24/2025', '6/6/2025', '7/10/2025', '7/17/2025', '7/21/2025 - 8/19/2025', 'south-west-chicago'],
        ['Lake View', '5/23/2025', '7/9/2025', '8/5/2025', '8/13/2025', '8/18/2025 - 9/16/2025', 'south-west-chicago'],
        ['Lyons', '6/2/2025', '7/16/2025', '8/13/2025', '8/21/2025', '8/18/2025 - 9/16/2025', 'south-west-chicago'],
        ['Stickney', '6/11/2025', '7/25/2025', '8/20/2025', '8/28/2025', '9/22/2025 - 10/21/2025', 'south-west-chicago'],
        ['West Chicago', '7/9/2025', '8/20/2025', '9/18/2025', '9/25/2025', '9/22/2025 - 10/21/2025', 'south-west-chicago'],
        ['Lemont', '7/21/2025', '9/2/2025', '9/30/2025', '10/10/2025', '10/23/2025 - 11/21/2025', 'south-west-chicago'],
        ['Bremen', '7/10/2025', '8/21/2025', '9/24/2025', '10/2/2025', '10/23/2025 - 11/21/2025', 'south-west-chicago'],
        ['Jefferson', '8/21/2025', '10/3/2025', '11/14/2025', '11/22/2025', '11/20/2025 - 12/19/2025', 'south-west-chicago'],
        ['Hyde Park', '8/4/2025', '9/16/2025', '10/16/2025', '10/23/2025', '10/23/2025 - 11/21/2025', 'south-west-chicago'],
        ['Proviso', '8/25/2025', '10/7/2025', '11/4/2025', '11/12/2025', '11/20/2025 - 12/19/2025', 'south-west-chicago'],
        ['Calumet', '7/30/2025', '9/11/2025', '9/30/2025', '10/10/2025', '10/23/2025 - 11/21/2025', 'south-west-chicago'],
        ['Rich', '10/21/2025', '12/4/2025', '12/22/2025', '1/2/2026', '1/20/2026 - 2/18/2026', 'south-west-chicago'],
        ['Worth', '8/11/2025', '9/23/2025', '10/20/2025', '10/30/2025', '10/23/2025 - 11/21/2025', 'south-west-chicago'],
        ['Orland', '9/10/2025', '10/23/2025', '11/18/2025', '11/27/2025', '1/5/2026 - 2/3/2026', 'south-west-chicago'],
        ['Thornton', '10/1/2025', '11/14/2025', '12/3/2025', '12/11/2025', '1/5/2026 - 2/3/2026', 'south-west-chicago'],
        ['Bloom', '10/24/2025', '12/9/2025', '12/30/2025', '1/7/2026', '1/20/2026 - 2/18/2026', 'south-west-chicago'],
        ['South Chicago', '10/15/2025', '11/28/2025', '12/19/2025', '12/27/2025', '1/20/2026 - 2/18/2026', 'south-west-chicago'],
        ['Lake', '9/22/2025', '11/4/2025', '11/26/2025', '12/3/2025', '1/5/2026 - 2/3/2026', 'south-west-chicago'],
        ['North Chicago', '10/7/2025', '11/20/2025', '12/16/2025', '12/24/2025', '1/20/2026 - 2/18/2026', 'south-west-chicago']
].map(([name, reassessmentNoticeDate, lastFileDate, aRollCertifiedDate, aRollPublishedDate, boardOfReviewAppealDates, region]) => ({
        name,
        reassessmentNoticeDate,
        lastFileDate,
        aRollCertifiedDate,
        aRollPublishedDate,
        boardOfReviewAppealDates,
        region
}));

const CHICAGO_COMMUNITY_AREA_ALIASES = new Map(Object.entries({
        ROGERS_PARK: 'Rogers Park',
        LAKE_VIEW: 'Lake View',
        LINCOLN_PARK: 'Lake View',
        UPTOWN: 'Lake View',
        EDGEWATER: 'Lake View',
        JEFFERSON_PARK: 'Jefferson',
        NORWOOD_PARK: 'Jefferson',
        EDISON_PARK: 'Jefferson',
        FOREST_GLEN: 'Jefferson',
        PORTAGE_PARK: 'Jefferson',
        IRVING_PARK: 'Jefferson',
        DUNNING: 'Jefferson',
        HYDE_PARK: 'Hyde Park',
        KENWOOD: 'Hyde Park',
        WOODLAWN: 'Hyde Park',
        SOUTH_SHORE: 'Hyde Park',
        AVALON_PARK: 'Hyde Park',
        CALUMET_HEIGHTS: 'Hyde Park',
        SOUTH_DEERING: 'Hyde Park',
        RIVERDALE: 'Hyde Park',
        HEGEWISCH: 'Hyde Park',
        SOUTH_CHICAGO: 'South Chicago',
        EAST_SIDE: 'South Chicago',
        WEST_TOWN: 'West Chicago',
        NEAR_WEST_SIDE: 'West Chicago',
        AUSTIN: 'West Chicago',
        HUMBOLDT_PARK: 'West Chicago',
        WEST_GARFIELD_PARK: 'West Chicago',
        EAST_GARFIELD_PARK: 'West Chicago',
        NORTH_LAWNDALE: 'West Chicago',
        SOUTH_LAWNDALE: 'West Chicago',
        LOWER_WEST_SIDE: 'West Chicago',
        LOOP: 'North Chicago',
        NEAR_NORTH_SIDE: 'North Chicago',
        NORTH_CENTER: 'North Chicago',
        LINCOLN_SQUARE: 'North Chicago',
        WEST_RIDGE: 'North Chicago',
        ALBANY_PARK: 'North Chicago',
        LOGAN_SQUARE: 'North Chicago',
        LAKE: 'Lake',
        NEW_CITY: 'Lake',
        BRIGHTON_PARK: 'Lake',
        MCKINLEY_PARK: 'Lake',
        BRIDGEPORT: 'Lake',
        ARMOUR_SQUARE: 'Lake',
        FULLER_PARK: 'Lake',
        ENGLEWOOD: 'Lake',
        WEST_ENGLEWOOD: 'Lake',
        CHICAGO_LAWN: 'Lake',
        GAGE_PARK: 'Lake',
        WEST_LAWN: 'Lake'
}));

const MUNICIPALITY_ALIASES = new Map(Object.entries({
        VILLAGE_OF_SKOKIE: 'Niles',
        VILLAGE_OF_LINCOLNWOOD: 'Niles',
        VILLAGE_OF_MORTON_GROVE: 'Niles',
        VILLAGE_OF_NILES: 'Niles',
        CITY_OF_DES_PLAINES: 'Maine',
        VILLAGE_OF_PARK_RIDGE: 'Maine',
        VILLAGE_OF_GLENCOE: 'New Trier',
        VILLAGE_OF_WINNETKA: 'New Trier',
        VILLAGE_OF_WILMETTE: 'New Trier',
        VILLAGE_OF_KENILWORTH: 'New Trier',
        VILLAGE_OF_NORTHFIELD: 'Northfield',
        VILLAGE_OF_GLENVIEW: 'Northfield',
        VILLAGE_OF_NORTHBROOK: 'Northfield',
        VILLAGE_OF_OAK_PARK: 'Oak Park',
        VILLAGE_OF_RIVER_FOREST: 'River Forest',
        VILLAGE_OF_RIVERSIDE: 'Riverside',
        CITY_OF_BERWYN: 'Berwyn',
        TOWN_OF_CICERO: 'Cicero',
        VILLAGE_OF_ORLAND_PARK: 'Orland',
        VILLAGE_OF_ORLAND_HILLS: 'Orland',
        VILLAGE_OF_PALOS_PARK: 'Palos',
        VILLAGE_OF_PALOS_HEIGHTS: 'Palos',
        VILLAGE_OF_PALOS_HILLS: 'Palos',
        VILLAGE_OF_WORTH: 'Worth',
        VILLAGE_OF_SCHAUMBURG: 'Schaumburg',
        VILLAGE_OF_HANOVER_PARK: 'Hanover',
        VILLAGE_OF_BARRINGTON: 'Barrington',
        VILLAGE_OF_LEMONT: 'Lemont'
}));

function normalizeKey(value) {
        return String(value || '')
                .toUpperCase()
                .replace(/&/g, ' AND ')
                .replace(/[^A-Z0-9]+/g, '_')
                .replace(/^_+|_+$/g, '');
}

function normalizeText(value) {
        return String(value || '')
                .toLowerCase()
                .replace(/\b(city|village|town|township)\s+of\s+/g, ' ')
                .replace(/\b(city|village|town|township|the)\b/g, ' ')
                .replace(/[^a-z0-9]+/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
}

function levenshteinRatio(left, right) {
        if (left === right) return 1;
        if (!left || !right) return 0;

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
        return 1 - distance / Math.max(left.length, right.length);
}

function matchCalendarName(value) {
        const candidate = normalizeText(value);
        if (!candidate) return null;

        let best = null;
        let bestScore = 0;

        for (const entry of APPEAL_CALENDAR_2025) {
                const official = normalizeText(entry.name);
                if (official === candidate) return { entry, confidence: 1, matchedBy: 'exact' };

                const score = levenshteinRatio(candidate, official);
                if (score > bestScore) {
                        best = entry;
                        bestScore = score;
                }
        }

        return best && bestScore >= 0.92 ? { entry: best, confidence: bestScore, matchedBy: 'similarity' } : null;
}

function calendarPayload(entry, matchedBy, confidence, lookupName) {
        return {
                areaName: entry.name,
                lookupName,
                reassessmentNoticeDate: entry.reassessmentNoticeDate || null,
                lastFileDate: entry.lastFileDate || null,
                aRollCertifiedDate: entry.aRollCertifiedDate || null,
                aRollPublishedDate: entry.aRollPublishedDate || null,
                boardOfReviewAppealDates: entry.boardOfReviewAppealDates || null,
                region: entry.region,
                matchedBy,
                confidence,
                sourceUrl: OFFICIAL_CALENDAR_URL,
                sourceLastUpdated: '1/27/2026'
        };
}

export function getAppealCalendarForProperty(property) {
        const townshipName = property?.townshipName || property?.township_name || '';
        const townshipMatch = matchCalendarName(townshipName);
        if (townshipMatch) {
                return calendarPayload(townshipMatch.entry, `township-${townshipMatch.matchedBy}`, townshipMatch.confidence, townshipName);
        }

        const taxMunicipalityName = String(property?.taxMunicipalityName || '').toUpperCase();
        const isChicago = taxMunicipalityName === 'CITY OF CHICAGO' ||
                String(property?.municipalityName || '').toUpperCase() === 'CITY OF CHICAGO';

        if (isChicago) {
                const communityArea = property?.chicagoCommunityArea || '';
                const alias = CHICAGO_COMMUNITY_AREA_ALIASES.get(normalizeKey(communityArea));
                const match = alias ? matchCalendarName(alias) : matchCalendarName(communityArea);
                if (match) {
                        return calendarPayload(match.entry, alias ? 'chicago-community-area-alias' : match.matchedBy, match.confidence, communityArea || alias);
                }
        }

        const municipalityName = property?.municipalityName || property?.taxMunicipalityName || '';
        const alias = MUNICIPALITY_ALIASES.get(normalizeKey(municipalityName));
        const match = alias ? matchCalendarName(alias) : matchCalendarName(municipalityName);
        if (match) {
                return calendarPayload(match.entry, alias ? 'municipality-alias' : match.matchedBy, match.confidence, municipalityName || alias);
        }

        return {
                areaName: null,
                lookupName: isChicago ? property?.chicagoCommunityArea || '' : municipalityName,
                sourceUrl: OFFICIAL_CALENDAR_URL,
                sourceLastUpdated: '1/27/2026',
                matchedBy: 'none',
                confidence: 0,
                note: 'Calendar area could not be matched confidently. Check the official Cook County Assessor calendar.'
        };
}
