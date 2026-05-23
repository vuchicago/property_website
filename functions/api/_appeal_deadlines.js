export const OFFICIAL_CALENDAR_URL = 'https://www.cookcountyassessoril.gov/assessment-calendar-and-deadlines';
export const CURRENT_CALENDAR_URL = 'https://rpie.cookcountyassessor.com/assessment-calendar-and-deadlines';
export const APPEAL_CALENDAR_SOURCE_LAST_UPDATED = '5/20/2026';

const APPEAL_CALENDAR_ROWS = [
        ['Oak Park', '5/6/2026', '6/18/2026', '', '', '', 'south-west-suburbs'],
        ['Riverside', '4/24/2026', '6/8/2026', '', '', '', 'south-west-suburbs'],
        ['River Forest', '4/20/2026', '6/2/2026', '', '', '', 'south-west-suburbs'],
        ['Berwyn', '5/20/2026', '7/6/2026', '', '', '', 'south-west-suburbs'],
        ['Palos', '', '', '', '', '', 'south-west-suburbs'],
        ['Cicero', '', '', '', '', '', 'south-west-suburbs'],
        ['Stickney', '', '', '', '', '', 'south-west-suburbs'],
        ['Lyons', '', '', '', '', '', 'south-west-suburbs'],
        ['Bremen', '', '', '', '', '', 'south-west-suburbs'],
        ['Lemont', '', '', '', '', '', 'south-west-suburbs'],
        ['Worth', '', '', '', '', '', 'south-west-suburbs'],
        ['Calumet', '', '', '', '', '', 'south-west-suburbs'],
        ['Proviso', '', '', '', '', '', 'south-west-suburbs'],
        ['Orland', '', '', '', '', '', 'south-west-suburbs'],
        ['Thornton', '', '', '', '', '', 'south-west-suburbs'],
        ['Rich', '', '', '', '', '', 'south-west-suburbs'],
        ['Bloom', '', '', '', '', '', 'south-west-suburbs'],
        ['New Trier', '5/7/2026', '6/22/2026', '', '', '', 'north-suburbs-chicago'],
        ['Norwood Park', '4/13/2026', '5/26/2026', '', '', '', 'north-suburbs-chicago'],
        ['Rogers Park', '4/17/2026', '6/1/2026', '', '', '', 'north-suburbs-chicago'],
        ['Evanston', '4/22/2026', '6/4/2026', '', '', '', 'north-suburbs-chicago'],
        ['Lake View', '', '', '', '', '', 'north-suburbs-chicago'],
        ['Maine', '', '', '', '', '', 'north-suburbs-chicago'],
        ['Elk Grove', '', '', '', '', '', 'north-suburbs-chicago'],
        ['West Chicago', '', '', '', '', '', 'north-suburbs-chicago'],
        ['Northfield', '', '', '', '', '', 'north-suburbs-chicago'],
        ['Barrington', '', '', '', '', '', 'north-suburbs-chicago'],
        ['Hyde Park', '', '', '', '', '', 'north-suburbs-chicago'],
        ['Leyden', '', '', '', '', '', 'north-suburbs-chicago'],
        ['Lake', '', '', '', '', '', 'north-suburbs-chicago'],
        ['Wheeling', '', '', '', '', '', 'north-suburbs-chicago'],
        ['Palatine', '', '', '', '', '', 'north-suburbs-chicago'],
        ['Jefferson', '', '', '', '', '', 'north-suburbs-chicago'],
        ['Schaumburg', '', '', '', '', '', 'north-suburbs-chicago'],
        ['North Chicago', '', '', '', '', '', 'north-suburbs-chicago'],
        ['Niles', '', '', '', '', '', 'north-suburbs-chicago'],
        ['Hanover', '', '', '', '', '', 'north-suburbs-chicago'],
        ['South Chicago', '', '', '', '', '', 'north-suburbs-chicago']
];

export const APPEAL_CALENDAR = APPEAL_CALENDAR_ROWS.map(([
        name,
        reassessmentNoticeDate,
        lastFileDate,
        aRollCertifiedDate,
        aRollPublishedDate,
        boardOfReviewAppealDates,
        region
]) => ({
        name,
        reassessmentNoticeDate,
        lastFileDate,
        aRollCertifiedDate,
        aRollPublishedDate,
        boardOfReviewAppealDates,
        region
}));
