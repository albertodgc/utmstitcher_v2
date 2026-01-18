(function () {
  try {
    var PREFIX = "__utmstitcher__";

    var KEYS = {
      visitor: PREFIX + "visitor_id",
      first: PREFIX + "first_touch",
      last: PREFIX + "last_touch",
      visits: PREFIX + "visit_count",
      landing: PREFIX + "landing_url",
      referrer: PREFIX + "referrer",
      identity: PREFIX + "identity",
    };

    function read(k) {
      try {
        return JSON.parse(localStorage.getItem(k));
      } catch {
        return null;
      }
    }

    function write(k, v) {
      localStorage.setItem(k, JSON.stringify(v));
    }

    function uuid() {
      if (crypto.randomUUID) return crypto.randomUUID();
      return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
        var r = (Math.random() * 16) | 0;
        return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
      });
    }

    function param(name) {
      return new URLSearchParams(location.search).get(name);
    }

    function clean(o) {
      var out = {};
      for (var k in o) if (o[k]) out[k] = o[k];
      return out;
    }

    /* ---------- init ---------- */

    var script = document.currentScript;
    if (!script) return;

    var siteKey = script.getAttribute("data-site");
    if (!siteKey) return;

    var apiBase = new URL(script.src).origin;

    var visitorId = read(KEYS.visitor);
    if (!visitorId) {
      visitorId = uuid();
      write(KEYS.visitor, visitorId);
    }

    write(KEYS.visits, (read(KEYS.visits) || 0) + 1);

    if (!read(KEYS.landing)) write(KEYS.landing, location.href);
    if (!read(KEYS.referrer) && document.referrer)
      write(KEYS.referrer, document.referrer);

    var utms = clean({
      utm_source: param("utm_source"),
      utm_medium: param("utm_medium"),
      utm_campaign: param("utm_campaign"),
      utm_term: param("utm_term"),
      utm_content: param("utm_content"),
      gclid: param("gclid"),
      fbclid: param("fbclid"),
    });

    if (!read(KEYS.first) && Object.keys(utms).length) {
      write(KEYS.first, { ...utms, ts: new Date().toISOString() });
    }

    if (Object.keys(utms).length) {
      write(KEYS.last, { ...utms, ts: new Date().toISOString() });
    }

    function send() {
      fetch(apiBase + "/api/collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          siteKey,
          visitorId,
          visitCount: read(KEYS.visits),
          firstTouch: read(KEYS.first),
          lastTouch: read(KEYS.last),
          landingUrl: read(KEYS.landing),
          referrer: read(KEYS.referrer),
          identity: read(KEYS.identity),
          pagePath: location.pathname,
          userAgent: navigator.userAgent,
        }),
      }).catch(function () {});
    }

    send(); // pageview

    /* ======================================================
       🔥 HUBSPOT IFRAME SUBMIT HANDLER (THE FIX)
       ====================================================== */

    window.addEventListener("message", function (e) {
      if (!e.data || e.data.type !== "hsFormCallback") return;
      if (e.data.eventName !== "onFormSubmitted") return;

      var fields = e.data.data || {};
      var identity = {};

      if (fields.email) identity.email = fields.email;
      if (fields.firstname) identity.first_name = fields.firstname;
      if (fields.lastname) identity.last_name = fields.lastname;

      if (!identity.email) return;

      write(KEYS.identity, identity);
      send();
    });

  } catch (e) {
    console.error("[UTM Stitcher]", e);
  }
})();
