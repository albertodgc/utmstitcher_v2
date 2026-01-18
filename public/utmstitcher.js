(function () {
  try {
    var STORAGE_PREFIX = "__utmstitcher__";
    var VISITOR_KEY = STORAGE_PREFIX + "visitor_id";
    var FIRST_TOUCH_KEY = STORAGE_PREFIX + "first_touch";
    var LAST_TOUCH_KEY = STORAGE_PREFIX + "last_touch";
    var VISIT_COUNT_KEY = STORAGE_PREFIX + "visit_count";
    var IDENTIFIED_KEY = STORAGE_PREFIX + "identified_email";

    var COLLECT_ENDPOINT = "https://app.utmstitcher.com/api/collect";
    var SITE_KEY = document.currentScript?.getAttribute("data-site");

    if (!SITE_KEY) return;

    // -----------------------------
    // Utilities
    // -----------------------------
    function uuid() {
      return crypto.randomUUID
        ? crypto.randomUUID()
        : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
            var r = (Math.random() * 16) | 0,
              v = c === "x" ? r : (r & 0x3) | 0x8;
            return v.toString(16);
          });
    }

    function getLS(k) {
      try {
        return JSON.parse(localStorage.getItem(k));
      } catch {
        return null;
      }
    }

    function setLS(k, v) {
      localStorage.setItem(k, JSON.stringify(v));
    }

    function getParam(name) {
      return new URLSearchParams(window.location.search).get(name);
    }

    // -----------------------------
    // Attribution (UTM + Referrer)
    // -----------------------------
    function collectAttribution() {
      var utm = {
        utm_source: getParam("utm_source"),
        utm_medium: getParam("utm_medium"),
        utm_campaign: getParam("utm_campaign"),
        utm_term: getParam("utm_term"),
        utm_content: getParam("utm_content"),
        landing_page: location.href,
      };

      // If any UTM exists → use it
      if (Object.values(utm).some(Boolean)) {
        return utm;
      }

      // Fallback to referrer attribution
      if (document.referrer) {
        try {
          var ref = new URL(document.referrer);
          return {
            utm_source: ref.hostname,
            utm_medium: "referral",
            utm_campaign: null,
            utm_term: null,
            utm_content: null,
            landing_page: location.href,
          };
        } catch {}
      }

      return null;
    }

    // -----------------------------
    // Visitor identity
    // -----------------------------
    var visitorId = getLS(VISITOR_KEY);
    if (!visitorId) {
      visitorId = uuid();
      setLS(VISITOR_KEY, visitorId);
    }

    var visitCount = (getLS(VISIT_COUNT_KEY) || 0) + 1;
    setLS(VISIT_COUNT_KEY, visitCount);

    // -----------------------------
    // First / Last touch logic
    // -----------------------------
    var attribution = collectAttribution();
    var firstTouch = getLS(FIRST_TOUCH_KEY);
    var lastTouch = getLS(LAST_TOUCH_KEY);

    if (attribution) {
      // New attribution → update last touch
      if (!firstTouch) {
        firstTouch = attribution;
        setLS(FIRST_TOUCH_KEY, attribution);
      }
      lastTouch = attribution;
      setLS(LAST_TOUCH_KEY, attribution);
    } else if (firstTouch && !lastTouch) {
      // Carry forward attribution (industry standard)
      lastTouch = firstTouch;
      setLS(LAST_TOUCH_KEY, firstTouch);
    }

    // -----------------------------
    // Identity buffer (email capture)
    // -----------------------------
    var pendingIdentity = null;

    window.utmStitcherIdentify = function (payload) {
      if (!payload?.email) return;

      var lastIdentified = getLS(IDENTIFIED_KEY);
      if (lastIdentified === payload.email) return;

      pendingIdentity = {
        email: payload.email,
        first_name: payload.firstName || null,
        last_name: payload.lastName || null,
      };

      setLS(IDENTIFIED_KEY, payload.email);
    };

    // -----------------------------
    // Send event
    // -----------------------------
    fetch(COLLECT_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        siteKey: SITE_KEY,
        visitorId: visitorId,
        visitCount: visitCount,
        firstTouch: firstTouch,
        lastTouch: lastTouch,
        pagePath: location.pathname,
        userAgent: navigator.userAgent,
        identity: pendingIdentity,
      }),
    }).catch(function () {});
  } catch (e) {
    console.warn("utmstitcher error", e);
  }
})();
