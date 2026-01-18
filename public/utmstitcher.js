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

    // --- Visitor ---
    var visitorId = read(VISITOR_KEY);
    if (!visitorId) {
      visitorId = uuidv4();
      write(VISITOR_KEY, visitorId);
    }

    if (!read(LANDING_URL_KEY)) write(LANDING_URL_KEY, location.href);
    if (!read(REFERRER_KEY) && document.referrer)
      write(REFERRER_KEY, document.referrer);

    write(VISIT_COUNT_KEY, (read(VISIT_COUNT_KEY) || 0) + 1);

    var utms = clean({
      utm_source: getParam("utm_source"),
      utm_medium: getParam("utm_medium"),
      utm_campaign: getParam("utm_campaign"),
      utm_term: getParam("utm_term"),
      utm_content: getParam("utm_content"),
      gclid: getParam("gclid"),
      fbclid: getParam("fbclid"),
      ttclid: getParam("ttclid"),
      msclkid: getParam("msclkid"),
    });

    if (!read(FIRST_TOUCH_KEY) && Object.keys(utms).length) {
      write(FIRST_TOUCH_KEY, {
        ...utms,
        landing_page: location.pathname,
        timestamp: new Date().toISOString(),
      });
    }

    if (Object.keys(utms).length) {
      write(LAST_TOUCH_KEY, {
        ...utms,
        landing_page: location.pathname,
        timestamp: new Date().toISOString(),
      });
    }

    function sendEvent() {
      fetch(apiBase + "/api/collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          siteKey,
          visitorId,
          visitCount: read(VISIT_COUNT_KEY),
          firstTouch: read(FIRST_TOUCH_KEY),
          lastTouch: read(LAST_TOUCH_KEY),
          landingUrl: read(LANDING_URL_KEY),
          referrer: read(REFERRER_KEY),
          identity: read(IDENTITY_KEY),
          pagePath: location.pathname,
          userAgent: navigator.userAgent,
        }),
      }).catch(function () {});
    }

    sendEvent();

    // 🔥 HUBSPOT WP FIX: CAPTURE ON BUTTON CLICK
    function attachButtonCapture() {
      var buttons = document.querySelectorAll(
        'form button, form input[type="submit"]'
      );

      buttons.forEach(function (btn) {
        if (btn.__utmstitcher_bound) return;
        btn.__utmstitcher_bound = true;

        btn.addEventListener(
          "click",
          function () {
            try {
              var form = btn.closest("form");
              if (!form) return;

              var email =
                form.querySelector('input[type="email"]') ||
                form.querySelector('input[name="email"]');

              if (!email || !email.value) return;

              var identity = { email: email.value };

              var first =
                form.querySelector('input[name="firstname"]') ||
                form.querySelector('input[name="first_name"]');
              var last =
                form.querySelector('input[name="lastname"]') ||
                form.querySelector('input[name="last_name"]');

              if (first && first.value) identity.first_name = first.value;
              if (last && last.value) identity.last_name = last.value;

              write(IDENTITY_KEY, identity);
            } catch (e) {
              console.error("[UTM Stitcher] capture failed", e);
            }

            sendEvent();
          },
          true
        );
      });
    }

    attachButtonCapture();
    setTimeout(attachButtonCapture, 1000);
    setTimeout(attachButtonCapture, 3000);
    setTimeout(attachButtonCapture, 5000);
  } catch (e) {
    console.error("[UTM Stitcher] fatal error", e);
  }
})();
