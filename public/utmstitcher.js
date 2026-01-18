(function () {
  try {
    var STORAGE_PREFIX = "__utmstitcher__";

    var VISITOR_KEY = STORAGE_PREFIX + "visitor_id";
    var FIRST_TOUCH_KEY = STORAGE_PREFIX + "first_touch";
    var LAST_TOUCH_KEY = STORAGE_PREFIX + "last_touch";
    var VISIT_COUNT_KEY = STORAGE_PREFIX + "visit_count";
    var LANDING_URL_KEY = STORAGE_PREFIX + "landing_url";
    var REFERRER_KEY = STORAGE_PREFIX + "referrer";
    var IDENTITY_KEY = STORAGE_PREFIX + "identity";

    function uuidv4() {
      if (crypto.randomUUID) return crypto.randomUUID();
      return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
        var r = (Math.random() * 16) | 0,
          v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    }

    function getParam(name) {
      return new URLSearchParams(window.location.search).get(name);
    }

    function collectUtms() {
      return {
        utm_source: getParam("utm_source"),
        utm_medium: getParam("utm_medium"),
        utm_campaign: getParam("utm_campaign"),
        utm_term: getParam("utm_term"),
        utm_content: getParam("utm_content"),
        gclid: getParam("gclid"),
        fbclid: getParam("fbclid"),
        ttclid: getParam("ttclid"),
        msclkid: getParam("msclkid"),
      };
    }

    function clean(obj) {
      var out = {};
      for (var k in obj) if (obj[k]) out[k] = obj[k];
      return out;
    }

    function read(key) {
      try {
        return JSON.parse(localStorage.getItem(key));
      } catch {
        return null;
      }
    }

    function write(key, value) {
      localStorage.setItem(key, JSON.stringify(value));
    }

    var script = document.currentScript;
    if (!script) return;

    var siteKey = script.getAttribute("data-site");
    if (!siteKey) return;

    var apiBase = new URL(script.src).origin;

    // Visitor ID
    var visitorId = read(VISITOR_KEY);
    if (!visitorId) {
      visitorId = uuidv4();
      write(VISITOR_KEY, visitorId);
    }

    // First landing
    if (!read(LANDING_URL_KEY)) write(LANDING_URL_KEY, location.href);
    if (!read(REFERRER_KEY) && document.referrer) write(REFERRER_KEY, document.referrer);

    var visitCount = (read(VISIT_COUNT_KEY) || 0) + 1;
    write(VISIT_COUNT_KEY, visitCount);

    var utms = clean(collectUtms());

    var firstTouch = read(FIRST_TOUCH_KEY);
    var lastTouch = read(LAST_TOUCH_KEY);

    if (!firstTouch && Object.keys(utms).length) {
      firstTouch = {
        ...utms,
        landing_page: location.pathname,
        timestamp: new Date().toISOString(),
      };
      write(FIRST_TOUCH_KEY, firstTouch);
    }

    if (Object.keys(utms).length) {
      lastTouch = {
        ...utms,
        landing_page: location.pathname,
        timestamp: new Date().toISOString(),
      };
      write(LAST_TOUCH_KEY, lastTouch);
    }

    function readIdentity() {
      var identity = read(IDENTITY_KEY);
      if (!identity || !identity.email) return null;
      return identity;
    }

    function sendEvent() {
      fetch(apiBase + "/api/collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          siteKey,
          visitorId,
          visitCount,
          firstTouch: read(FIRST_TOUCH_KEY),
          lastTouch: read(LAST_TOUCH_KEY),
          landingUrl: read(LANDING_URL_KEY),
          referrer: read(REFERRER_KEY),
          identity: readIdentity(),
          pagePath: location.pathname,
          userAgent: navigator.userAgent,
        }),
      }).catch(function () {});
    }

    // Fire on page load
    sendEvent();

    // HubSpot form capture (ROBUST)
    window.addEventListener("message", function (event) {
      if (
        event.data &&
        event.data.type === "hsFormCallback" &&
        event.data.eventName === "onFormSubmit"
      ) {
        try {
          var f = event.data.data || {};

          var email =
            f.email ||
            f.Email ||
            f["email_address"] ||
            f["hs_email"] ||
            null;

          if (email) {
            write(IDENTITY_KEY, {
              email: email,
              first_name: f.firstname || f.first_name || null,
              last_name: f.lastname || f.last_name || null,
            });
          }
        } catch (e) {}

        sendEvent();
      }
    });
  } catch (e) {
    console.error("[UTM Stitcher]", e);
  }
})();
