/* Original code, MIT license. Native runtime API compatibility sources in README. */
(function (root) {
  "use strict";

  function nextIndex(index, key, count, columns) {
    count = typeof count === "number" ? count : 12;
    columns = typeof columns === "number" && columns > 0 ? columns : 4;
    var row = Math.floor(index / columns), col = index % columns;
    if (key === 37 && col > 0) return index - 1;
    if (key === 39 && col < columns - 1 && index + 1 < count) return index + 1;
    if (key === 38 && row > 0) return index - columns;
    if (key === 40 && index + columns < count) return index + columns;
    return index;
  }

  function guideCellAt(spans, slot, slotCount) {
    if (!Array.isArray(spans) || !spans.length) return null;
    var start = 0, last = null;
    for (var i = 0; i < spans.length && start < slotCount; i++) {
      var span = typeof spans[i] === "number" && isFinite(spans[i]) ? Math.floor(spans[i]) : 1;
      span = Math.min(Math.max(span, 1), slotCount - start);
      last = { index: i, start: start, end: start + span };
      if (slot < last.end) return last;
      start = last.end;
    }
    return last;
  }

  function nextGuidePosition(layout, position, key, slotCount) {
    slotCount = typeof slotCount === "number" && slotCount > 0 && isFinite(slotCount) ? Math.floor(slotCount) : 3;
    if (!Array.isArray(layout) || !layout.length) return { row: -1, slot: -1, index: -1 };
    position = position || {};
    var row = typeof position.row === "number" && isFinite(position.row) ? Math.floor(position.row) : 0;
    var slot = typeof position.slot === "number" && isFinite(position.slot) ? Math.floor(position.slot) : 0;
    row = Math.max(0, Math.min(row, layout.length - 1));
    slot = Math.max(0, Math.min(slot, slotCount - 1));
    var cell = guideCellAt(layout[row], slot, slotCount);
    if (!cell) return { row: -1, slot: -1, index: -1 };
    slot = Math.min(slot, cell.end - 1);
    if (key === 37 && cell.start > 0) slot = cell.start - 1;
    else if (key === 39 && cell.end < slotCount) {
      var next = guideCellAt(layout[row], cell.end, slotCount);
      if (next && next.index !== cell.index) slot = cell.end;
    } else if (key === 38 && row > 0) row -= 1;
    else if (key === 40 && row + 1 < layout.length) row += 1;
    cell = guideCellAt(layout[row], slot, slotCount);
    if (!cell) return { row: -1, slot: -1, index: -1 };
    return { row: row, slot: Math.min(slot, cell.end - 1), index: cell.index };
  }

  function formatTime(minutes) {
    minutes = typeof minutes === "number" && isFinite(minutes) ? Math.floor(minutes) : 0;
    minutes = ((minutes % 1440) + 1440) % 1440;
    var hour = Math.floor(minutes / 60), minute = minutes % 60;
    return (hour % 12 || 12) + ":" + (minute < 10 ? "0" : "") + minute + (hour < 12 ? " AM" : " PM");
  }

  function halfHourTimeline(minutes) {
    minutes = typeof minutes === "number" && isFinite(minutes) ? Math.floor(minutes) : 0;
    var start = Math.floor(minutes / 30) * 30;
    return { start: start, labels: [formatTime(start), formatTime(start + 30), formatTime(start + 60)] };
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { nextIndex: nextIndex, nextGuidePosition: nextGuidePosition, formatTime: formatTime, halfHourTimeline: halfHourTimeline };
  }
  if (!root.document) return;

  var doc = root.document, grid = doc.getElementById("apps"), status = doc.getElementById("status");
  var guideGrid = doc.getElementById("guide-grid"), guideView = doc.getElementById("guide-view"), appsView = doc.getElementById("apps-view");
  var guideTab = doc.getElementById("guide-tab"), appsTab = doc.getElementById("apps-tab"), setup = doc.getElementById("setup");
  var help = doc.getElementById("help"), close = doc.getElementById("close");
  var programDialog = doc.getElementById("program-dialog"), programClose = doc.getElementById("program-close");
  var nav = [guideTab, appsTab, setup], swatches = doc.querySelectorAll(".swatch");
  var catalog = [], tiles = [], selected = 0, busy = false, bridgeEnabled = false, deviceInfo = {}, testMode = false;
  var activeView = "guide", activeModal = null, returnFocus = null, savedAccent = null;
  var guideButtons = [], guideLayout = [], guidePosition = { row: 0, slot: 0, index: 0 }, timeBase = 0;
  var nativeOrigin = root.location.protocol === "http:" && root.location.hostname === "127.0.0.1" && root.location.port === "12345";

  /* Original fictional listings. This guide does not contain a real TV feed. */
  var guide = [
    { number: "002", name: "LOCAL", programs: [
      { title: "Back to the good stuff", span: 1, genre: "Local", description: "Neighborhood stories, familiar faces, and a little local color. Settle in and see what's around the corner." },
      { title: "Around the Neighborhood", span: 1, genre: "Local", description: "A slow afternoon walk past front porches, corner stores, and the places everybody knows." },
      { title: "The Evening Bulletin", span: 1, genre: "Local", description: "Community notices, small-town stories, and a look at the week ahead." }
    ] },
    { number: "012", name: "TOONS", programs: [
      { title: "Saturday Morning Cartoons", span: 2, genre: "Animation", category: "kids", description: "A bowl of cereal, a blanket on the couch, and a whole hour of colorful adventures and impossible inventions." },
      { title: "After School", span: 1, genre: "Animation", category: "kids", description: "Homework can wait a little longer. A group of neighborhood friends turns an ordinary afternoon into an adventure." }
    ] },
    { number: "024", name: "RETRO", programs: [
      { title: "After School Arcade", span: 1, genre: "Retro", description: "High scores, pocket change, and the friendly rivalries of a neighborhood arcade." },
      { title: "Backyard Adventures", span: 2, genre: "Adventure", description: "Three friends, a hand-drawn map, and a summer mystery that starts just beyond the back fence." }
    ] },
    { number: "033", name: "DISC", programs: [
      { title: "How Things Work", span: 1, genre: "Discovery", description: "An up-close look inside everyday machines, from the first moving part to the finished idea." },
      { title: "Build It Again", span: 1, genre: "Discovery", description: "A forgotten workshop project gets a second chance through patient repairs and a little ingenuity." },
      { title: "A Closer Look", span: 1, genre: "Discovery", description: "Small discoveries hiding in ordinary places, explored one curious question at a time." }
    ] },
    { number: "041", name: "MOVIES", programs: [
      { title: "The Midnight Movie", span: 3, genre: "Movie", category: "movie", description: "On the last night of summer, an unexpected visitor sends a quiet roadside town on an unforgettable adventure." }
    ] },
    { number: "050", name: "SPORTS", programs: [
      { title: "Friday Night Highlights", span: 2, genre: "Sports", category: "sport", description: "Big plays, close finishes, and the atmosphere of a hometown game under the lights." },
      { title: "Overtime", span: 1, genre: "Sports", category: "sport", description: "A relaxed look back at the moments, teamwork, and decisions that made the game memorable." }
    ] }
  ];

  try { savedAccent = root.localStorage.getItem("local-home.cable-accent"); } catch (ignoredStorage) {}
  if (!/^(sage|glacier|amber)$/.test(savedAccent || "")) savedAccent = null;

  function setAccent(value, remember) {
    if (!/^(sage|glacier|amber)$/.test(value || "")) value = "sage";
    doc.body.setAttribute("data-accent", value);
    for (var i = 0; i < swatches.length; i++) {
      swatches[i].setAttribute("aria-pressed", swatches[i].getAttribute("data-accent") === value ? "true" : "false");
    }
    if (remember) {
      savedAccent = value;
      try { root.localStorage.setItem("local-home.cable-accent", value); } catch (ignoredStorage) {}
    }
  }

  function report(message) { status.textContent = message; }

  function selectedProgram() {
    var channel = guide[guidePosition.row], cell = guideCellAt(guideLayout[guidePosition.row], guidePosition.slot, 3);
    return { channel: channel, program: channel.programs[cell.index], start: cell.start, end: cell.end };
  }

  function programMeta(item) {
    return formatTime(timeBase + item.start * 30) + " – " + formatTime(timeBase + item.end * 30) +
      " · " + ((item.end - item.start) * 30) + " min · " + item.program.genre;
  }

  function updateProgramInfo() {
    var item = selectedProgram(), channel = item.channel.number + " " + item.channel.name;
    doc.getElementById("program-title").textContent = item.program.title;
    doc.getElementById("program-meta").textContent = programMeta(item);
    doc.getElementById("program-description").textContent = item.program.description;
    doc.getElementById("program-channel").textContent = channel;
    doc.getElementById("preview-channel").textContent = channel;
    doc.getElementById("preview-title").textContent = item.program.title;
    if (activeModal === programDialog) {
      doc.getElementById("program-dialog-title").textContent = item.program.title;
      doc.getElementById("program-dialog-meta").textContent = "Sample listing · " + channel + " · " + programMeta(item);
      doc.getElementById("program-dialog-description").textContent = item.program.description;
    }
  }

  function updateGuideSelection() {
    for (var row = 0; row < guideButtons.length; row++) {
      for (var index = 0; index < guideButtons[row].length; index++) {
        var chosen = row === guidePosition.row && index === guidePosition.index;
        guideButtons[row][index].tabIndex = chosen ? 0 : -1;
        guideButtons[row][index].setAttribute("aria-selected", chosen ? "true" : "false");
        guideButtons[row][index].setAttribute("data-active", chosen ? "true" : "false");
      }
    }
    updateProgramInfo();
  }

  function focusGuide(position) {
    guidePosition = nextGuidePosition(guideLayout, position, 0, 3);
    if (guidePosition.index < 0) return;
    updateGuideSelection();
    guideButtons[guidePosition.row][guidePosition.index].focus();
  }

  function selectGuideButton(button) {
    var row = Number(button.getAttribute("data-row")), slot = Number(button.getAttribute("data-slot"));
    var clicked = nextGuidePosition(guideLayout, { row: row, slot: slot }, 0, 3);
    if (guidePosition.row !== clicked.row || guidePosition.index !== clicked.index) guidePosition = clicked;
    updateGuideSelection();
  }

  function renderGuide() {
    guideGrid.textContent = ""; guideButtons = []; guideLayout = [];
    for (var r = 0; r < guide.length; r++) {
      var row = doc.createElement("div"), channel = doc.createElement("div"), number = doc.createElement("span");
      var name = doc.createElement("span"), programs = doc.createElement("div"), slot = 0, buttons = [], spans = [];
      row.className = "guide-row"; row.setAttribute("role", "row");
      channel.className = "channel-cell"; channel.setAttribute("role", "rowheader");
      number.className = "channel-number"; number.textContent = guide[r].number;
      name.className = "channel-name"; name.textContent = guide[r].name;
      channel.appendChild(number); channel.appendChild(name); row.appendChild(channel);
      programs.className = "programs"; programs.setAttribute("role", "presentation");
      for (var p = 0; p < guide[r].programs.length; p++) {
        var listing = guide[r].programs[p], button = doc.createElement("button");
        button.type = "button";
        button.className = "program-cell" + (listing.span > 1 ? " span-" + listing.span : "") + (listing.category ? " category-" + listing.category : "");
        button.textContent = listing.title;
        button.setAttribute("role", "gridcell");
        button.setAttribute("aria-colindex", slot + 2);
        button.setAttribute("aria-colspan", listing.span);
        button.setAttribute("aria-label", guide[r].number + " " + guide[r].name + ": " + listing.title + ", sample listing");
        button.setAttribute("data-row", r); button.setAttribute("data-slot", slot);
        button.onfocus = function () { selectGuideButton(this); };
        button.onclick = function () { selectGuideButton(this); openProgram(); };
        spans.push(listing.span); buttons.push(button); programs.appendChild(button); slot += listing.span;
      }
      guideLayout.push(spans); guideButtons.push(buttons); row.appendChild(programs); guideGrid.appendChild(row);
    }
    updateGuideSelection();
  }

  function updateClock() {
    var now = new Date(), minutes = now.getHours() * 60 + now.getMinutes(), timeline = halfHourTimeline(minutes);
    var days = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
    var months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    doc.getElementById("clock").textContent = formatTime(minutes);
    doc.getElementById("date").textContent = days[now.getDay()] + " " + months[now.getMonth()] + " " + now.getDate();
    for (var i = 0; i < 3; i++) doc.getElementById("time-" + i).textContent = timeline.labels[i];
    timeBase = timeline.start;
    updateProgramInfo();
  }

  function focusApp(index) {
    selected = Math.max(0, Math.min(index, tiles.length - 1));
    if (tiles[selected]) tiles[selected].focus();
  }

  function focusActiveView() {
    if (activeView === "guide") focusGuide(guidePosition); else focusApp(selected);
  }

  function setView(view, enter) {
    activeView = view === "apps" ? "apps" : "guide";
    guideView.hidden = activeView !== "guide"; appsView.hidden = activeView !== "apps";
    guideTab.setAttribute("aria-pressed", activeView === "guide" ? "true" : "false");
    appsTab.setAttribute("aria-pressed", activeView === "apps" ? "true" : "false");
    guideTab.setAttribute("data-active", activeView === "guide" ? "true" : "false");
    appsTab.setAttribute("data-active", activeView === "apps" ? "true" : "false");
    report(activeView === "guide" ? "Browse the guide · OK for program details" : (catalog.length ? "Choose an app to open" : "No apps added yet"));
    if (enter) focusActiveView();
  }

  function openModal(dialog, firstControl) {
    if (activeModal === dialog) return;
    if (activeModal) closeModal();
    returnFocus = doc.activeElement; activeModal = dialog; dialog.hidden = false;
    firstControl.focus();
  }

  function closeModal() {
    if (!activeModal) return;
    activeModal.hidden = true; activeModal = null;
    var opener = returnFocus; returnFocus = null;
    if (opener && doc.body.contains(opener)) opener.focus(); else focusActiveView();
  }

  function openSettings() { openModal(help, close); }

  function openProgram() {
    openModal(programDialog, programClose);
    updateProgramInfo();
  }

  function modalControls() {
    return activeModal ? Array.prototype.slice.call(activeModal.querySelectorAll("button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])")) : [];
  }

  function request(url, method, data, token, callback) {
    var xhr = new XMLHttpRequest();
    xhr.open(method, url, true); xhr.timeout = 7000;
    if (token) xhr.setRequestHeader("AUTH", token);
    if (data) xhr.setRequestHeader("Content-Type", "application/json");
    xhr.onload = function () {
      if (xhr.status < 200 || xhr.status >= 300) return callback("TV request failed (HTTP " + xhr.status + ").");
      try { callback(null, JSON.parse(xhr.responseText)); } catch (e) { callback("TV response was not valid JSON."); }
    };
    xhr.onerror = function () { callback("Local TV API could not be reached."); };
    xhr.ontimeout = function () { callback("Local TV API timed out."); };
    xhr.send(data ? JSON.stringify(data) : null);
  }

  function launch(index) {
    var app = catalog[index];
    if (!app) { openSettings(); return; }
    if (busy) return;
    if (!bridgeEnabled || !nativeOrigin) { report("App controls are not connected to this TV yet."); return; }
    busy = true; report("Requesting " + app.label + "…");
    request("http://127.0.0.1:7346/app/get_auth_token", "GET", null, null, function (error, result) {
      if (error) { busy = false; report(error); return; }
      var token = result && result.ITEM && result.ITEM.VALUE;
      if (typeof token !== "string" || !token) { busy = false; report("TV did not provide an authorization token."); return; }
      request("http://127.0.0.1:7346/app/launch", "PUT", { VALUE: app.launch }, token, function (err, reply) {
        busy = false;
        report(err || (reply && reply.STATUS && reply.STATUS.RESULT === "SUCCESS" ? "Launch request accepted for " + app.label + "." : "TV rejected the launch request."));
      });
    });
  }

  function validApp(app) {
    if (!app || typeof app.label !== "string" || !app.label.trim() || app.label.length > 64) return false;
    var v = app.launch;
    return v && typeof v.NAME_SPACE === "number" && isFinite(v.NAME_SPACE) && v.NAME_SPACE >= 0 && Math.floor(v.NAME_SPACE) === v.NAME_SPACE &&
      typeof v.APP_ID === "string" && v.APP_ID.length > 0 && v.APP_ID.length <= 128 && (v.MESSAGE === null || typeof v.MESSAGE === "string");
  }

  function renderApps() {
    var restore = activeView === "apps" && !activeModal && (grid.contains(doc.activeElement) || doc.activeElement === doc.body);
    grid.textContent = ""; tiles = [];
    grid.className = "apps" + (catalog.length ? "" : " is-empty");
    doc.getElementById("empty-state").hidden = catalog.length > 0;
    doc.getElementById("app-count").textContent = catalog.length ? catalog.length + (catalog.length === 1 ? " app" : " apps") : "Waiting for setup";
    for (var i = 0; i < Math.max(catalog.length, 1); i++) {
      var tile = doc.createElement("button"), number = doc.createElement("span"), label = doc.createElement("span"), hint = doc.createElement("span");
      tile.type = "button"; tile.className = "tile"; tile.setAttribute("data-index", i);
      number.className = "number"; number.textContent = catalog[i] ? (i + 1 < 10 ? "0" : "") + (i + 1) : "SETTINGS";
      label.className = "label"; label.textContent = catalog[i] ? catalog[i].label : "This TV";
      hint.className = "hint"; hint.textContent = catalog[i] ? "Open app" : "Appearance & details";
      tile.appendChild(number); tile.appendChild(label); tile.appendChild(hint);
      tile.onclick = function () { selected = Number(this.getAttribute("data-index")); launch(selected); };
      tile.onfocus = function () { selected = Number(this.getAttribute("data-index")); };
      tiles.push(tile); grid.appendChild(tile);
    }
    if (restore) focusApp(selected);
  }

  guideTab.onclick = function () { setView("guide", true); };
  appsTab.onclick = function () { setView("apps", true); };
  setup.onclick = openSettings; close.onclick = closeModal; programClose.onclick = closeModal;
  for (var s = 0; s < swatches.length; s++) swatches[s].onclick = function () { setAccent(this.getAttribute("data-accent"), true); };

  doc.addEventListener("keydown", function (event) {
    var key = event.keyCode || event.which, focused = doc.activeElement, i;
    if (key === 8 || key === 27 || key === 461 || key === 10009) {
      event.preventDefault(); if (activeModal) closeModal(); else openSettings(); return;
    }
    if (key === 13) {
      event.preventDefault(); if (focused && focused.tagName === "BUTTON") focused.click(); return;
    }
    if (activeModal) {
      var controls = modalControls(), current = controls.indexOf(focused);
      if (key === 9 && controls.length) {
        event.preventDefault();
        controls[(current + (event.shiftKey ? -1 : 1) + controls.length) % controls.length].focus();
      } else if (key >= 37 && key <= 40) {
        event.preventDefault();
        if (activeModal === help) {
          if (key === 38) close.focus();
          else if (key === 40 && focused === close) {
            var chosen = swatches[0];
            for (i = 0; i < swatches.length; i++) if (swatches[i].getAttribute("aria-pressed") === "true") chosen = swatches[i];
            if (chosen) chosen.focus();
          } else {
            var accentIndex = Array.prototype.indexOf.call(swatches, focused);
            if (key === 37 && accentIndex > 0) swatches[accentIndex - 1].focus();
            else if (key === 39 && accentIndex >= 0 && accentIndex + 1 < swatches.length) swatches[accentIndex + 1].focus();
          }
        }
      }
      return;
    }
    if (key < 37 || key > 40) return;
    event.preventDefault();
    var navIndex = nav.indexOf(focused);
    if (navIndex >= 0) {
      if (key === 37 || key === 39) {
        var target = Math.max(0, Math.min(navIndex + (key === 37 ? -1 : 1), nav.length - 1));
        nav[target].focus();
        if (target < 2) setView(target === 0 ? "guide" : "apps", false);
      } else if (key === 40) focusActiveView();
      return;
    }
    if (activeView === "guide") {
      if (key === 38 && guidePosition.row === 0) guideTab.focus();
      else focusGuide(nextGuidePosition(guideLayout, guidePosition, key, 3));
      return;
    }
    var columns = tiles.length && tiles[0].offsetWidth ? Math.max(1, Math.round(grid.clientWidth / tiles[0].offsetWidth)) : 4;
    if (key === 38 && selected < columns) appsTab.focus();
    else focusApp(nextIndex(selected, key, tiles.length, columns));
  });

  renderGuide(); renderApps(); updateClock(); setAccent(savedAccent, false); setView("guide", true);
  root.setInterval(updateClock, 30000);

  request("config.json", "GET", null, null, function (error, config) {
    if (error) { report("Sample guide ready · app setup unavailable"); return; }
    if (!config || !Array.isArray(config.apps) || config.apps.length > 12 || !config.apps.every(validApp)) {
      report("App setup needs attention · open Settings"); return;
    }
    catalog = config.apps; bridgeEnabled = !!(config.nativeBridge && config.nativeBridge.enabled === true);
    testMode = config.testMode === true; doc.getElementById("preview-badge").hidden = !testMode;
    setAccent(savedAccent || (config.appearance && config.appearance.accent), false);
    deviceInfo = config.device && typeof config.device === "object" ? config.device : {};
    if (typeof deviceInfo.model !== "string") deviceInfo.model = "";
    if (typeof deviceInfo.firmware !== "string") deviceInfo.firmware = "";
    doc.getElementById("device-info").textContent = deviceInfo.model ? deviceInfo.model + (deviceInfo.firmware ? " · firmware " + deviceInfo.firmware : "") : "Device details have not been configured.";
    if (typeof config.title === "string" && config.title.length <= 64 && config.title.trim()) doc.getElementById("title").textContent = config.title;
    doc.getElementById("bridge-state").textContent = nativeOrigin && bridgeEnabled ? "App controls enabled. Launch support still needs verification." : "App controls are not connected yet.";
    renderApps();
    report(activeView === "guide" ? "Browse the guide · OK for program details" : (catalog.length ? "Choose an app to open" : "No apps added yet"));
  });
}(typeof window !== "undefined" ? window : {}));
