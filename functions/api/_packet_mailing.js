import { getAppealCalendarForProperty } from './_appeal_calendar.js';

const chicagoDay = value => new Intl.DateTimeFormat('en-CA', {timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
function calendarDate(value) {
    const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value || '');
    if (!match) return null;
    const iso = `${match[3]}-${match[1].padStart(2,'0')}-${match[2].padStart(2,'0')}`;
    const parsed = new Date(`${iso}T12:00:00Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0,10) === iso ? iso : null;
}

export function packetMailingWindow(state, now = new Date().toISOString()) {
    // Resolve against the service calendar, not an owner-entered deadline or
    // dates captured when the property was originally added.
    const calendar = getAppealCalendarForProperty(state.propertySnapshot?.details);
    const taxYear = state.intake?.taxYear ?? state.taxYear;
    const opensOn = calendarDate(calendar.reassessmentNoticeDate);
    const closesOn = calendarDate(calendar.lastFileDate);
    const matched = calendar.confidence === 1 && calendar.matchedBy?.startsWith('township-');
    const known = matched && opensOn && closesOn && opensOn <= closesOn && Number(opensOn.slice(0,4)) === Number(taxYear) && Number(closesOn.slice(0,4)) === Number(taxYear);
    const today = chicagoDay(now);
    return {
        status: !known ? 'unannounced' : today < opensOn ? 'upcoming' : today > closesOn ? 'closed' : 'open',
        township: matched ? calendar.areaName : null,
        taxYear,
        opensOn: known ? opensOn : null,
        closesOn: known ? closesOn : null,
        sourceUrl: calendar.sourceUrl,
        sourceLastUpdated: calendar.sourceLastUpdated
    };
}

export function requireOpenMailingWindow(state, now) {
    const window = packetMailingWindow(state, now);
    if (window.status !== 'open') throw Object.assign(new Error(window.status === 'upcoming'
        ? `Mailing is on hold until the ${window.township} appeal window opens on ${window.opensOn}.`
        : window.status === 'closed' ? 'The appeal window for this assessment year is closed. Do not dispatch this packet.'
        : 'Mailing is on hold until a township appeal window is published and matched to this assessment year.'), {status:409});
    return window;
}
