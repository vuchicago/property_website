export const OFFICIAL_CALENDAR_URL = 'https://www.cookcountyassessoril.gov/assessment-calendar-and-deadlines';
export const CURRENT_CALENDAR_URL = 'https://rpie.cookcountyassessor.com/assessment-calendar-and-deadlines';
export const APPEAL_CALENDAR_SOURCE_LAST_UPDATED = '10/30/2026';

const APPEAL_CALENDAR_ROWS = [
        ['Oak Park', '5/6/2026', '6/18/2026', '', '', '', 'south-west-suburbs'],
        ['Riverside', '4/24/2026', '6/8/2026', '', '', '', 'south-west-suburbs'],
        ['River Forest', '4/20/2026', '6/2/2026', '', '', '', 'south-west-suburbs'],
        ['Berwyn', '5/20/2026', '7/6/2026', '', '', '', 'south-west-suburbs'],
        ['Palos', '6/3/2026', '7/17/2026', '', '', '', 'south-west-suburbs'],
        ['Cicero', '6/17/2026', '7/31/2026', '', '', '', 'south-west-suburbs'],
        ['Stickney', '6/29/2026', '8/12/2026', '', '', '', 'south-west-suburbs'],
        ['Lyons', '7/23/2026', '9/3/2026', '', '', '', 'south-west-suburbs'],
        ['Bremen', '8/12/2026', '9/24/2026', '', '', '', 'south-west-suburbs'],
        ['Lemont', '8/17/2026', '9/29/2026', '', '', '', 'south-west-suburbs'],
        ['Worth', '9/1/2026', '10/15/2026', '', '', '', 'south-west-suburbs'],
        ['Calumet', '8/20/2026', '10/2/2026', '', '', '', 'south-west-suburbs'],
        ['Proviso', '9/14/2026', '10/27/2026', '', '', '', 'south-west-suburbs'],
        ['Orland', '9/24/2026', '11/6/2026', '', '', '', 'south-west-suburbs'],
        ['Thornton', '10/8/2026', '11/23/2026', '', '', '', 'south-west-suburbs'],
        ['Rich', '10/21/2026', '12/4/2026', '', '', '', 'south-west-suburbs'],
        ['Bloom', '', '', '', '', '', 'south-west-suburbs'],
        ['New Trier', '5/7/2026', '6/22/2026', '', '', '', 'north-suburbs-chicago'],
        ['Norwood Park', '4/13/2026', '5/26/2026', '', '', '', 'north-suburbs-chicago'],
        ['Rogers Park', '4/17/2026', '6/1/2026', '', '', '', 'north-suburbs-chicago'],
        ['Evanston', '4/22/2026', '6/4/2026', '', '', '', 'north-suburbs-chicago'],
        ['Lake View', '5/28/2026', '7/13/2026', '', '', '', 'north-suburbs-chicago'],
        ['Maine', '6/5/2026', '7/21/2026', '', '', '', 'north-suburbs-chicago'],
        ['Elk Grove', '6/22/2026', '8/4/2026', '', '', '', 'north-suburbs-chicago'],
        ['West Chicago', '7/10/2026', '8/21/2026', '', '', '', 'north-suburbs-chicago'],
        ['Northfield', '7/24/2026', '9/4/2026', '', '', '', 'north-suburbs-chicago'],
        ['Barrington', '8/11/2026', '9/23/2026', '', '', '', 'north-suburbs-chicago'],
        ['Hyde Park', '8/26/2026', '10/8/2026', '', '', '', 'north-suburbs-chicago'],
        ['Leyden', '8/31/2026', '10/14/2026', '', '', '', 'north-suburbs-chicago'],
        ['Lake', '9/16/2026', '10/29/2026', '', '', '', 'north-suburbs-chicago'],
        ['Wheeling', '9/9/2026', '10/22/2026', '', '', '', 'north-suburbs-chicago'],
        ['Palatine', '9/22/2026', '11/4/2026', '', '', '', 'north-suburbs-chicago'],
        ['Jefferson', '9/29/2026', '11/12/2026', '', '', '', 'north-suburbs-chicago'],
        ['Schaumburg', '10/6/2026', '11/19/2026', '', '', '', 'north-suburbs-chicago'],
        ['North Chicago', '10/9/2026', '11/24/2026', '', '', '', 'north-suburbs-chicago'],
        ['Niles', '10/20/2026', '12/3/2026', '', '', '', 'north-suburbs-chicago'],
        ['Hanover', '10/22/2026', '12/7/2026', '', '', '', 'north-suburbs-chicago'],
        ['South Chicago', '10/30/2026', '12/15/2026', '', '', '', 'north-suburbs-chicago']
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
