/* What's new: version history shown on changelog.html.
   Add a new entry to the TOP each time APP_VERSION is bumped. */

const CHANGELOG = [
  {
    version: "1.7.7",
    date: "2026-07-25",
    notes: [
      "Home now opens on a compact month calendar: today is highlighted and each day with something scheduled shows a dot — red for overdue, amber for due soon, pink for upcoming.",
      "Tap a dotted day to see exactly what's due then (service, road tax or insurance) and jump to that vehicle; use the arrows to look ahead by month.",
      "Your full service history sits just below the calendar, newest first."
    ]
  },
  {
    version: "1.7.6",
    date: "2026-07-25",
    notes: [
      "Settings now shows the app icon (tap to go Home) instead of a back arrow, since it's a tab in the bottom bar.",
      "The back button now returns you to where you actually came from — open a vehicle from Home and back goes to Home; open it from the garage and back goes to the garage.",
      "After saving a service record or vehicle, pressing back no longer drops you into the form you just saved."
    ]
  },
  {
    version: "1.7.5",
    date: "2026-07-25",
    notes: [
      "Removed the top-right account avatar — your profile and Sign out now live on the Settings tab, reachable from the bottom bar."
    ]
  },
  {
    version: "1.7.4",
    date: "2026-07-25",
    notes: [
      "New Home screen: an at-a-glance agenda of what's due across your whole garage — overdue, due soon and upcoming services, plus road tax and insurance, sorted soonest first, with your recent services below.",
      "A bottom tab bar to move between Home, Vehicles and Settings.",
      "Your garage (the list of vehicles) now lives under the Vehicles tab."
    ]
  },
  {
    version: "1.7.3",
    date: "2026-07-24",
    notes: [
      "Fresh coat of paint: buttons, inputs and cards now use rounder corners and softer, more layered shadows (a HeroUI-style look).",
      "Buttons and chips gently press down when you tap them, and inputs sit on a subtle fill that brightens on hover — no layout or feature changes."
    ]
  },
  {
    version: "1.7.2",
    date: "2026-07-16",
    notes: [
      "App shortcuts: long-press the app icon (Android/desktop) for quick \"Add record\" and \"Update odometer\" actions.",
      "With one vehicle in the garage, a shortcut jumps straight to the form or dialog; with several, it opens the garage to pick from."
    ]
  },
  {
    version: "1.7.1",
    date: "2026-07-16",
    notes: [
      "Under the hood: the top bar (back button / app icon + account menu) is now built by a single shared script instead of being copy-pasted into every page. Nothing changes visually."
    ]
  },
  {
    version: "1.7.0",
    date: "2026-07-16",
    notes: [
      "The app now works offline and opens instantly: pages and scripts are cached on your device (service worker).",
      "Quick odometer update — tap Update on the odometer card (or the garage card's ⋮ menu) to log your current km without a service record.",
      "Road tax and insurance expiry dates per vehicle, with a warning 30 days before they lapse — set them in Edit details.",
      "Reminders now also watch the odometer: a record's next-service km can turn it due soon (within 1,000 km) or overdue, not just the date.",
      "Record form: ticking an item now auto-fills the next service date/odometer (still editable), and the odometer field shows your last saved reading.",
      "Number fields now open the numeric keypad on phones."
    ]
  },
  {
    version: "1.6.1",
    date: "2026-07-15",
    notes: [
      "Tidied the vehicle cards: removed the \"View logs\" button and the logs count.",
      "Fixed the email wrapping in the avatar popup (smaller text, wider popup).",
      "Moved the version number into the Settings list as a plain row, and removed it from the avatar popup."
    ]
  },
  {
    version: "1.6.0",
    date: "2026-07-15",
    notes: [
      "Edit and Delete for a vehicle moved to a ⋮ menu on each garage card — the logbook page is now cleaner.",
      "Removed \"Clear all\" from the logbook (delete individual records via their ⋮ menu).",
      "Add vehicle is now a floating + button on mobile (with a tooltip), matching Add record."
    ]
  },
  {
    version: "1.5.4",
    date: "2026-07-15",
    notes: [
      "Record cards now have a coloured left stripe by status: green = serviced, red = overdue, amber = due soon, blue = upcoming."
    ]
  },
  {
    version: "1.5.3",
    date: "2026-07-15",
    notes: [
      "Mobile: the vehicle summary is now a compact 2-column layout instead of four tall cards.",
      "Mobile: each record's ⋮ menu button stays neatly at the top-right of the card.",
      "Mobile: added a floating + button to quickly add a record (Clear all stays in the header)."
    ]
  },
  {
    version: "1.5.2",
    date: "2026-07-14",
    notes: [
      "Tidied the avatar popup: a profile header (avatar + email), then Settings and Sign out as clean rows, with the version in a footer."
    ]
  },
  {
    version: "1.5.1",
    date: "2026-07-14",
    notes: [
      "Tapping the avatar now opens a quick popup with your email, a Settings link, Sign out and the version — Settings is still there for the full details."
    ]
  },
  {
    version: "1.5.0",
    date: "2026-07-14",
    notes: [
      "New Settings page gathering your profile (email + sign out), Manage categories, Reminder settings and What's new.",
      "The top-right avatar now opens Settings in one tap instead of a crowded menu.",
      "Added section titles above the intro text on the garage, add/edit vehicle and add/edit record pages."
    ]
  },
  {
    version: "1.4.3",
    date: "2026-07-14",
    notes: [
      "Logbook group headers now read clearly, e.g. \"Due soon · 2 services\" instead of just a number."
    ]
  },
  {
    version: "1.4.2",
    date: "2026-07-14",
    notes: [
      "Lists now show a skeleton placeholder while data loads (garage, logbook, categories, reminders) so it's clear something's on the way."
    ]
  },
  {
    version: "1.4.1",
    date: "2026-07-14",
    notes: [
      "Logbook is now grouped into Overdue, Due soon, Upcoming and History sections, each with a count.",
      "Each record's actions (Mark serviced, Edit, Delete) are now tidied into a single ⋮ menu at the top-right of the card."
    ]
  },
  {
    version: "1.4.0",
    date: "2026-07-14",
    notes: [
      "Removed the separate Service reminders panel — each logbook card now shows its own days-left status.",
      "Cards are highlighted when a service is due soon or overdue.",
      "New \"Mark serviced\" button on each record: tap it when you've done that service (even early) to clear the reminder; tap again to undo."
    ]
  },
  {
    version: "1.3.3",
    date: "2026-07-14",
    notes: [
      "Logbook now sorts by next-service date (soonest first), so what's due next is at the top. Records with no next date sit at the bottom, newest first."
    ]
  },
  {
    version: "1.3.2",
    date: "2026-07-14",
    notes: [
      "Cleaner header: the app icon on the home screen, and a round back button on other pages.",
      "Dropped the breadcrumb and the page-title text for a simpler, Airbnb-style top bar."
    ]
  },
  {
    version: "1.3.1",
    date: "2026-07-14",
    notes: [
      "Reorganized the project into a tidy public/ folder (css/, js/, assets/). No change to how the app looks or works."
    ]
  },
  {
    version: "1.3.0",
    date: "2026-07-14",
    notes: [
      "Each page now shows its own title in the header (e.g. the vehicle's name) instead of the app name.",
      "Replaced the back button with a breadcrumb trail, so you can see where you are and jump up any level.",
      "Moved the version number out of the header into the account menu."
    ]
  },
  {
    version: "1.2.1",
    date: "2026-07-14",
    notes: [
      "New app icon — a white gauge on coral — matching the redesign on your home screen."
    ]
  },
  {
    version: "1.2.0",
    date: "2026-07-14",
    notes: [
      "Fresh Airbnb-inspired look: coral accent, cleaner white cards, rounder corners and softer shadows.",
      "New \"Suggest next service\" button on the record form estimates the next date and odometer from the items you serviced (editable)."
    ]
  },
  {
    version: "1.1.2",
    date: "2026-07-14",
    notes: [
      "Every page now has a short subtitle explaining what it does.",
      "Added helper hints on form fields (units, what's optional, how reminders work).",
      "Added hover tooltips on the version tag, the menu button, and the main actions."
    ]
  },
  {
    version: "1.1.1",
    date: "2026-07-14",
    notes: [
      "Delete, Clear all and Reset now show in red so destructive actions stand out.",
      "Required fields are marked with an asterisk.",
      "Empty garage/logbook now show a quick Add button, and forms focus the first field on desktop.",
      "Toned down the oversized page title for a more balanced header."
    ]
  },
  {
    version: "1.1.0",
    date: "2026-07-14",
    notes: [
      "Adding and editing now happen on their own screens: the garage and logbook stay clean lists.",
      "Tap \"Add vehicle\" / \"Add record\" (or Edit) to open a dedicated form, and Back returns you to the list.",
      "You're asked to confirm before leaving a form with unsaved changes."
    ]
  },
  {
    version: "1.0.9",
    date: "2026-07-14",
    notes: [
      "Added this What's new page — tap the version number any time to see what changed."
    ]
  },
  {
    version: "1.0.8",
    date: "2026-07-14",
    notes: [
      "Reminder settings moved to its own page, reachable from the account menu."
    ]
  },
  {
    version: "1.0.7",
    date: "2026-07-14",
    notes: [
      "Vehicle photos are now checked (type and size) and auto-compressed before saving.",
      "Clear inline feedback when a photo is rejected or after it's compressed."
    ]
  },
  {
    version: "1.0.6",
    date: "2026-07-14",
    notes: [
      "Add a photo to each vehicle, shown on its garage card.",
      "Friendlier confirmation dialogs before deleting, signing out, or leaving with unsaved changes."
    ]
  },
  {
    version: "1.0.0",
    notes: [
      "Initial release: multi-vehicle garage, service log book, categorized records, and per-category reminders."
    ]
  }
];

function renderChangelog() {
  const list = document.querySelector("#changelogList");
  if (!list) return;

  const current = typeof APP_VERSION === "string" ? APP_VERSION : "";
  const frag = document.createDocumentFragment();

  for (const entry of CHANGELOG) {
    const card = document.createElement("article");
    card.className = "changelog-entry";

    const head = document.createElement("div");
    head.className = "changelog-head";

    const version = document.createElement("h2");
    version.className = "changelog-version";
    version.textContent = `v${entry.version}`;
    head.append(version);

    if (entry.version === current) {
      const badge = document.createElement("span");
      badge.className = "changelog-current";
      badge.textContent = "Current";
      head.append(badge);
    }

    if (entry.date) {
      const date = document.createElement("span");
      date.className = "changelog-date";
      date.textContent = entry.date;
      head.append(date);
    }

    card.append(head);

    const notes = document.createElement("ul");
    notes.className = "changelog-notes";
    for (const note of entry.notes) {
      const li = document.createElement("li");
      li.textContent = note;
      notes.append(li);
    }
    card.append(notes);

    frag.append(card);
  }

  list.replaceChildren(frag);
}

setupBackButton("./settings.html");

window.onPullRefresh = async () => {
  await refreshData();
  renderChangelog();
};

bootWithFallback(renderChangelog);
