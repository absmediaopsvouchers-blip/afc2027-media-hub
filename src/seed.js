'use strict';

/**
 * Initial seed data for the AFC Asian Cup 2027 Media Hub.
 *
 * getSeedData() is used the first time the store is initialised (no data yet).
 * Press-conference and news dates are generated RELATIVE TO TODAY (in the event
 * timezone) so the system looks live the moment it boots, whenever that is.
 *
 * Venue set follows the brief: 1 Main Media Centre, 2 Stadiums, 2 Training Sites.
 */

const { todayInTz } = require('./time');

// ---- small date helpers -----------------------------------------------------

/** "YYYY-MM-DD" for today (event tz) + offset days. */
function dayStr(offset = 0) {
  const base = todayInTz(); // YYYY-MM-DD in the event timezone
  const [y, m, d] = base.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + offset);
  return dt.toISOString().slice(0, 10);
}

/** ISO timestamp for "hours ago". */
function hoursAgo(h) {
  return new Date(Date.now() - h * 3600 * 1000).toISOString();
}

function getSeedData() {
  return {
    // Event metadata (drives the app header / branding).
    meta: {
      event: 'AFC Asian Cup 2027',
      city: 'Riyadh',
      subtitle: 'Media Operations Hub',
    },

    // Admin-editable theme (colours, fonts, header, logo, background). Empty =
    // use the built-in defaults; the client applies any overrides via CSS vars.
    settings: {},

    // Registered media members: email -> accreditation. Filled in as people
    // make their first request. Seeded with one demo account.
    users: [
      {
        email: 'demo.reporter@press.example',
        accreditationNumber: 'AFC-MED-10293',
        createdAt: hoursAgo(48),
      },
    ],

    // Issued vouchers (the audit trail the rules engine checks against).
    vouchers: [],

    // Custom tabs added to the Media Client app via the admin panel.
    tabs: [],

    // Admin action log (voucher resets, tab changes) shown in the analytics feed.
    auditLog: [],

    // Web Push subscriptions (endpoint + keys) registered by client-app browsers.
    pushSubscriptions: [],

    // Managed content categories (used by the News feed). Admin-editable so new
    // categories can be added without code changes. Each has a display colour.
    categories: [
      { id: 'CAT-ANNOUNCE', name: 'Announcement', color: '#2f6bff' },
      { id: 'CAT-ALERT', name: 'Alert', color: '#d12626' },
      { id: 'CAT-OPS', name: 'Operations', color: '#5c6a7e' },
      { id: 'CAT-TRANSPORT', name: 'Transport', color: '#138a4a' },
      { id: 'CAT-CATERING', name: 'Catering', color: '#b9710a' },
    ],

    // Venues available in the request dropdown (managed via the Admin CMS).
    locations: [
      { id: 'MMC-01', name: 'Main Media Centre', type: 'MMC', zone: 'Riyadh — Central', window: '08:00 – 23:00' },
      { id: 'STD-01', name: 'King Fahd International Stadium', type: 'Stadium', zone: 'Riyadh — North', window: 'Match windows' },
      { id: 'STD-02', name: 'King Saud University Stadium', type: 'Stadium', zone: 'Riyadh — West', window: 'Match windows' },
      { id: 'TRN-01', name: 'Prince Faisal bin Fahd Complex', type: 'Training', zone: 'Riyadh — Central', window: '09:00 – 20:00' },
      { id: 'TRN-02', name: 'Al-Shabab Club Training Field', type: 'Training', zone: 'Riyadh — East', window: '09:00 – 19:00' },
    ],

    // Press conference schedule (Tab 2 / Admin CMS).
    pressConferences: [
      { id: 'PC-1001', date: dayStr(0), time: '11:00', team: 'Saudi Arabia', room: 'PC Room 1', status: 'Concluded', note: 'Head Coach & Captain — matchday-minus-one briefing.' },
      { id: 'PC-1002', date: dayStr(0), time: '12:30', team: 'Japan', room: 'PC Room 2', status: 'Live', note: 'Head Coach & Goalkeeper — tactical preview and squad health.' },
      { id: 'PC-1003', date: dayStr(0), time: '14:00', team: 'Australia', room: 'PC Room 1', status: 'Delayed', note: 'Team Manager — delayed ~20 min, awaiting squad arrival.' },
      { id: 'PC-1004', date: dayStr(0), time: '16:00', team: 'Iran', room: 'PC Room 2', status: 'Scheduled', note: 'Head Coach & Designated Player — Group C preview.' },
      { id: 'PC-1005', date: dayStr(0), time: '18:30', team: 'South Korea', room: 'Main Auditorium', status: 'Scheduled', note: 'Pre-match press conference — full squad availability.' },
      { id: 'PC-1006', date: dayStr(1), time: '10:30', team: 'Qatar', room: 'PC Room 1', status: 'Scheduled', note: 'Defending champions — tournament opener media call.' },
      { id: 'PC-1007', date: dayStr(1), time: '11:30', team: 'Uzbekistan', room: 'PC Room 1', status: 'Scheduled', note: 'Head Coach & Captain — opening fixture preview.' },
      { id: 'PC-1008', date: dayStr(1), time: '13:00', team: 'Iraq', room: 'PC Room 2', status: 'Scheduled', note: 'National Press Officer — squad announcement.' },
    ],

    // News & media updates feed (Tab 3 / Admin CMS).
    news: [
      {
        id: 'NW-2001',
        title: 'Main Media Centre now open 08:00–23:00',
        body: 'The MMC is fully operational for the duration of the group stage. Workstations, high-speed Wi-Fi, the Media Café and the volunteer help desk are all available. Accreditation collection has moved to Entrance B.',
        category: 'Announcement',
        pinned: true,
        timestamp: hoursAgo(2),
      },
      {
        id: 'NW-2002',
        title: 'Shuttle frequency increased for evening matches',
        body: 'Due to high demand, MMC → King Fahd International Stadium shuttles will run every 10 minutes from 16:00 on matchdays. Allow 25 minutes for travel and security screening.',
        category: 'Transport',
        pinned: false,
        timestamp: hoursAgo(5),
      },
      {
        id: 'NW-2003',
        title: 'Mixed-zone access guidelines updated',
        body: 'Photographers and rights-holding broadcasters should collect coloured mixed-zone bibs from the venue media manager 60 minutes before kickoff. Written press access opens at full-time.',
        category: 'Operations',
        pinned: false,
        timestamp: hoursAgo(9),
      },
      {
        id: 'NW-2004',
        title: 'Media Café dinner service extended at MMC',
        body: 'Following feedback, hot dinner service at the MMC Media Café is extended to 22:30. Remember to generate your Dinner voucher in the app before joining the queue.',
        category: 'Catering',
        pinned: false,
        timestamp: hoursAgo(20),
      },
      {
        id: 'NW-2005',
        title: 'WEATHER: Heat advisory for afternoon training sessions',
        body: 'Temperatures are expected to reach 41°C this afternoon. Open training sessions at outdoor grounds may be shortened. Stay hydrated — water stations are available at all media positions.',
        category: 'Alert',
        pinned: false,
        timestamp: hoursAgo(26),
      },
      {
        id: 'NW-2006',
        title: 'Photographers’ briefing — King Saud University Stadium',
        body: 'A mandatory pitch-side photographers’ briefing will be held at King Saud University Stadium tomorrow at 09:30. Pitch access positions and flash restrictions will be confirmed.',
        category: 'Operations',
        pinned: false,
        timestamp: hoursAgo(30),
      },
    ],

    // Transport & shuttle information (Tab 4). MMC ⇄ stadiums / training sites.
    transport: [
      { id: 'TR-01', route: 'MMC ⇄ King Fahd International Stadium', type: 'Stadium', from: 'Main Media Centre', to: 'King Fahd International Stadium', frequency: 'Every 10 min (matchdays from 16:00)', firstDeparture: '08:00', lastDeparture: '00:30', duration: '~25 min', notes: 'Express service on matchdays. Boards at MMC Transport Mall, Bay 1.' },
      { id: 'TR-02', route: 'MMC ⇄ King Saud University Stadium', type: 'Stadium', from: 'Main Media Centre', to: 'King Saud University Stadium', frequency: 'Every 20 min', firstDeparture: '08:30', lastDeparture: '23:30', duration: '~30 min', notes: 'Boards at Bay 2. Add 15 min during peak traffic.' },
      { id: 'TR-03', route: 'MMC ⇄ Prince Faisal bin Fahd Complex', type: 'Training', from: 'Main Media Centre', to: 'Prince Faisal bin Fahd Complex', frequency: 'Every 30 min', firstDeparture: '08:45', lastDeparture: '20:00', duration: '~20 min', notes: 'Aligned with published open-training windows. Bay 4.' },
      { id: 'TR-04', route: 'MMC ⇄ Al-Shabab Club Training Field', type: 'Training', from: 'Main Media Centre', to: 'Al-Shabab Club Training Field', frequency: 'Every 45 min', firstDeparture: '09:00', lastDeparture: '19:30', duration: '~30 min', notes: 'On-request return after late sessions. Bay 5.' },
    ],
  };
}

module.exports = { getSeedData };
