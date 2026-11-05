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
  if (typeof module !== "undefined" && module.exports) module.exports = { nextIndex: nextIndex };
  if (!root.document) return;
  var doc = root.document, grid = doc.getElementById("apps"), status = doc.getElementById("status");
  var help = doc.getElementById("help"), setup = doc.getElementById("setup"), close = doc.getElementById("close");
  var catalog = [], tiles = [], selected = 0, busy = false, bridgeEnabled = false, deviceInfo = {}, testMode = false;
  var returnFocus = null, savedAccent = null, swatches = doc.querySelectorAll(".swatch");
  var nativeOrigin = root.location.protocol === "http:" && root.location.hostname === "127.0.0.1" && root.location.port === "12345";
  try { savedAccent = root.localStorage.getItem("local-home.accent"); } catch (ignoredStorage) {}
  function setAccent(value, remember) {
    if (!/^(sage|glacier|amber)$/.test(value || "")) value = "sage";
    doc.body.setAttribute("data-accent", value);
    for (var i = 0; i < swatches.length; i++) swatches[i].setAttribute("aria-pressed", swatches[i].getAttribute("data-accent") === value ? "true" : "false");
    if (remember) { savedAccent = value; try { root.localStorage.setItem("local-home.accent", value); } catch (ignoredStorage) {} }
  }
  for (var s = 0; s < swatches.length; s++) swatches[s].onclick = function () { setAccent(this.getAttribute("data-accent"), true); };
  function updateClock() {
    var now = new Date(), hours = now.getHours(), minutes = now.getMinutes();
    var days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    var months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    doc.getElementById("clock").textContent = (hours % 12 || 12) + ":" + (minutes < 10 ? "0" : "") + minutes;
    doc.getElementById("date").textContent = days[now.getDay()] + ", " + months[now.getMonth()] + " " + now.getDate();
    doc.getElementById("greeting").textContent = hours >= 5 && hours < 12 ? "GOOD MORNING" : (hours >= 12 && hours < 17 ? "GOOD AFTERNOON" : "GOOD EVENING");
  }
  updateClock(); root.setInterval(updateClock, 30000); setAccent(savedAccent, false);
  function report(message) { status.textContent = message; }
  function telemetryReady() {
    /* Same-origin execution receipt only. No identifiers, tokens or key contents. */
    try {
      var receipt = new XMLHttpRequest();
      receipt.open("GET", "telemetry?event=ready", true); receipt.timeout = 3000;
      receipt.send();
    } catch (ignored) { /* Receipt availability never blocks the TV UI. */ }
  }
  function focus(index) { selected = Math.max(0, Math.min(index, tiles.length - 1)); if (tiles[selected]) tiles[selected].focus(); }
  function showHelp() { returnFocus = doc.activeElement; help.hidden = false; close.focus(); }
  function hideHelp() { help.hidden = true; if (returnFocus && doc.body.contains(returnFocus)) returnFocus.focus(); else focus(selected); }
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
    if (!app) { showHelp(); return; }
    if (busy) return;
    if (!bridgeEnabled || !nativeOrigin) {
      report("App controls are not connected to this TV yet."); return;
    }
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
      typeof v.APP_ID === "string" && v.APP_ID.length > 0 && v.APP_ID.length <= 128 &&
      (v.MESSAGE === null || typeof v.MESSAGE === "string");
  }
  function render() {
    var restoreGridFocus = doc.activeElement !== setup && help.hidden;
    grid.textContent = ""; tiles = [];
    grid.className = "apps" + (catalog.length ? "" : " is-empty");
    doc.body.className = catalog.length ? "has-apps" : "";
    doc.getElementById("empty-state").hidden = catalog.length > 0;
    doc.getElementById("app-count").textContent = catalog.length ? catalog.length + (catalog.length === 1 ? " app" : " apps") : "Waiting for setup";
    for (var i = 0; i < Math.max(catalog.length, 1); i++) {
      var tile = doc.createElement("button"), number = doc.createElement("span"), label = doc.createElement("span"), hint = doc.createElement("span");
      tile.className = "tile";
      tile.setAttribute("data-row", Math.floor(i / 4)); tile.setAttribute("data-col", i % 4); tile.setAttribute("data-index", i);
      number.className = "number"; number.textContent = catalog[i] ? (i + 1 < 10 ? "0" : "") + (i + 1) : "SETTINGS";
      label.className = "label"; label.textContent = catalog[i] ? catalog[i].label : "This TV";
      hint.className = "hint"; hint.textContent = catalog[i] ? "Open app" : "Appearance & details";
      tile.appendChild(number); tile.appendChild(label); tile.appendChild(hint);
      tile.onclick = function () { selected = Number(this.getAttribute("data-index")); launch(selected); };
      tile.onfocus = function () { selected = Number(this.getAttribute("data-index")); };
      tiles.push(tile); grid.appendChild(tile);
    }
    if (restoreGridFocus) focus(selected);
  }
  setup.onclick = showHelp; close.onclick = hideHelp;
  doc.addEventListener("keydown", function (event) {
    var key = event.keyCode || event.which;
    if (key === 8 || key === 27 || key === 461 || key === 10009) {
      event.preventDefault(); if (help.hidden) showHelp(); else hideHelp(); return;
    }
    if (key === 13) {
      event.preventDefault();
      if (doc.activeElement && doc.activeElement.tagName === "BUTTON") doc.activeElement.click();
      return;
    }
    if (!help.hidden) {
      var controls = [close], current = 0;
      for (var i = 0; i < swatches.length; i++) controls.push(swatches[i]);
      for (var j = 0; j < controls.length; j++) if (controls[j] === doc.activeElement) current = j;
      if (key === 9) {
        event.preventDefault();
        var direction = event.shiftKey ? -1 : 1;
        controls[(current + direction + controls.length) % controls.length].focus();
      } else if (key >= 37 && key <= 40) {
        event.preventDefault();
        if (key === 38) close.focus();
        else if (key === 40 && current === 0) {
          var chosen = 1;
          for (var c = 1; c < controls.length; c++) if (controls[c].getAttribute("aria-pressed") === "true") chosen = c;
          controls[chosen].focus();
        } else if (key === 37 && current > 1) controls[current - 1].focus();
        else if (key === 39 && current > 0 && current < controls.length - 1) controls[current + 1].focus();
      }
      return;
    }
    if (key >= 37 && key <= 40) {
      event.preventDefault();
      if (doc.activeElement === setup) { if (key === 40) focus(selected); return; }
      var columns = tiles.length ? Math.max(1, Math.round(grid.clientWidth / tiles[0].offsetWidth)) : 1;
      if (key === 38 && selected < columns) setup.focus(); else focus(nextIndex(selected, key, tiles.length, columns));
    }
  });
  render();
  request("config.json", "GET", null, null, function (error, config) {
    if (error) { report("Setup is unavailable · open Settings"); telemetryReady(); return; }
    if (!config || !Array.isArray(config.apps) || config.apps.length > 12 || !config.apps.every(validApp)) {
      report("App setup needs attention · open Settings"); telemetryReady(); return;
    }
    catalog = config.apps; bridgeEnabled = !!(config.nativeBridge && config.nativeBridge.enabled === true);
    testMode = config.testMode === true;
    doc.getElementById("preview-badge").hidden = !testMode;
    setAccent(savedAccent || (config.appearance && config.appearance.accent), false);
    deviceInfo = config.device && typeof config.device === "object" ? config.device : {};
    if (typeof deviceInfo.model !== "string") deviceInfo.model = "";
    if (typeof deviceInfo.firmware !== "string") deviceInfo.firmware = "";
    doc.getElementById("device-info").textContent = deviceInfo.model ? deviceInfo.model + (deviceInfo.firmware ? " · firmware " + deviceInfo.firmware : "") : "Device details have not been configured.";
    if (typeof config.title === "string" && config.title.length <= 64 && config.title.trim()) doc.getElementById("title").textContent = config.title;
    doc.getElementById("bridge-state").textContent = nativeOrigin && bridgeEnabled ? "App controls enabled. Launch support still needs verification." : "App controls are not connected yet.";
    render(); report(testMode ? "Interface preview" : (catalog.length ? "Choose an app to open" : "No apps added yet"));
    telemetryReady();
  });
}(typeof window !== "undefined" ? window : {}));
