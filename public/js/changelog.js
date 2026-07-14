/* What's new: version history shown on changelog.html.
   Add a new entry to the TOP each time APP_VERSION is bumped. */

const CHANGELOG = [
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

setupBackButton("./index.html");

window.onPullRefresh = async () => {
  await refreshData();
  renderChangelog();
};

bootWithFallback(renderChangelog);
