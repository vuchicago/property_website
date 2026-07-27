import {
        APPEAL_CALENDAR,
        APPEAL_CALENDAR_SOURCE_LAST_UPDATED,
        CURRENT_CALENDAR_URL,
        OFFICIAL_CALENDAR_URL
} from './_appeal_deadlines.js';

const TODAY = new Date();
const TODAY_DATE = new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate());

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

function compactName(value) {
        return normalizeText(value).replace(/\s+/g, '');
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
        const compactCandidate = compactName(candidate);

        let best = null;
        let bestScore = 0;

        for (const entry of APPEAL_CALENDAR) {
                const official = normalizeText(entry.name);
                if (official === candidate) return { entry, confidence: 1, matchedBy: 'exact' };
                if (compactName(official) === compactCandidate) {
                        return { entry, confidence: 1, matchedBy: 'normalized-exact' };
                }

                const score = levenshteinRatio(candidate, official);
                if (score > bestScore) {
                        best = entry;
                        bestScore = score;
                }
        }

        return best && bestScore >= 0.92 ? { entry: best, confidence: bestScore, matchedBy: 'similarity' } : null;
}

function parseDate(value) {
        const match = String(value || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (!match) return null;

        const [, month, day, year] = match;
        return new Date(Number(year), Number(month) - 1, Number(day));
}

function calendarPayload(entry, matchedBy, confidence, lookupName) {
        const assessorAppealWindow = entry.reassessmentNoticeDate && entry.lastFileDate
                ? `${entry.reassessmentNoticeDate} - ${entry.lastFileDate}`
                : entry.lastFileDate || null;
        const lastFileDate = parseDate(entry.lastFileDate);
        const nextAppealWindow = lastFileDate
                ? (lastFileDate < TODAY_DATE ? 'Past Appeal Window' : `Open For Appeals Until ${entry.lastFileDate}`)
                : null;

        return {
                areaName: entry.name,
                lookupName,
                reassessmentNoticeDate: entry.reassessmentNoticeDate || null,
                lastFileDate: entry.lastFileDate || null,
                assessorAppealWindow,
                nextAppealWindow,
                aRollCertifiedDate: entry.aRollCertifiedDate || null,
                aRollPublishedDate: entry.aRollPublishedDate || null,
                boardOfReviewAppealDates: entry.boardOfReviewAppealDates || null,
                region: entry.region,
                matchedBy,
                confidence,
                sourceUrl: OFFICIAL_CALENDAR_URL,
                currentSourceUrl: CURRENT_CALENDAR_URL,
                sourceLastUpdated: APPEAL_CALENDAR_SOURCE_LAST_UPDATED,
                note: nextAppealWindow ? null : 'No current or future appeal window is posted for this area. Check the official Cook County Assessor calendar.'
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
                currentSourceUrl: CURRENT_CALENDAR_URL,
                sourceLastUpdated: APPEAL_CALENDAR_SOURCE_LAST_UPDATED,
                nextAppealWindow: null,
                assessorAppealWindow: null,
                matchedBy: 'none',
                confidence: 0,
                note: 'Calendar area could not be matched confidently. Check the official Cook County Assessor calendar.'
        };
}
