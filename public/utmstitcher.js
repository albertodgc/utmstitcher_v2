(function () {
    try {
      /* ===============================
         CONFIG
      =============================== */
  
      var STORAGE_PREFIX = "__utmstitcher__";
      var VISITOR_KEY = STORAGE_PREFIX + "visitor_id";
      var FIRST_TOUCH_KEY = STORAGE_PREFIX + "first_touch";
      var LAST_TOUCH_KEY = STORAGE_PREFIX + "last_touch";
      var VISIT_COUNT_KEY = STORAGE_PREFIX + "visit_count";
  
      /* ===============================
         HELPERS
      =============================== */
  
      function uuidv4() {
        if (window.crypto && crypto.randomUUID) {
          return crypto.randomUUID();
        }
        return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
          var r = (Math.random() * 16) | 0,
            v = c === "x" ? r : (r & 0x3) | 0x8;
          return v.toString(16);
        });
      }
  
      function getParam(name) {
        var params = new URLSearchParams(window.location.search);
        return params.get(name);
      }
  
      function hasAnyUtm(params) {
        return (
          params.utm_source ||
          params.utm_medium ||
          params.utm_campaign ||
          params.utm_term ||
          params.utm_content ||
          params.gclid ||
          params.fbclid ||
          params.ttclid ||
          params.msclkid
        );
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
        for (var k in obj) {
          if (obj[k]) out[k] = obj[k];
        }
        return out;
      }
  
      function read(key) {
        try {
          var v = localStorage.getItem(key);
          return v ? JSON.parse(v) : null;
        } catch {
          return null;
        }
      }
  
      function write(key, value) {
        try {
          localStorage.setItem(key, JSON.stringify(value));
        } catch {}
      }
  
      /* ===============================
         BOOTSTRAP
      =============================== */
  
      var currentScript = document.currentScript;
      if (!currentScript) return;
  
      var siteKey = currentScript.getAttribute("data-site");
      if (!siteKey) return;
  
      /* ===============================
         VISITOR ID
      =============================== */
  
      var visitorId = read(VISITOR_KEY);
      if (!visitorId) {
        visitorId = uuidv4();
        write(VISITOR_KEY, visitorId);
      }
  
      /* ===============================
         VISIT COUNT
      =============================== */
  
      var visitCount = read(VISIT_COUNT_KEY) || 0;
      visitCount += 1;
      write(VISIT_COUNT_KEY, visitCount);
  
      /* ===============================
         UTM HANDLING
      =============================== */
  
      var utms = clean(collectUtms());
  
      var firstTouch = read(FIRST_TOUCH_KEY);
      var lastTouch = read(LAST_TOUCH_KEY);
  
      if (!firstTouch && hasAnyUtm(utms)) {
        firstTouch = {
          ...utms,
          landing_page: window.location.pathname,
          timestamp: new Date().toISOString(),
        };
        write(FIRST_TOUCH_KEY, firstTouch);
      }
  
      if (hasAnyUtm(utms)) {
        lastTouch = {
          ...utms,
          landing_page: window.location.pathname,
          timestamp: new Date().toISOString(),
        };
        write(LAST_TOUCH_KEY, lastTouch);
      }
  
      /* ===============================
         PAYLOAD
      =============================== */
  
      var payload = {
        siteKey: siteKey,
        visitorId: visitorId,
        visitCount: visitCount,
        firstTouch: firstTouch,
        lastTouch: lastTouch,
        pagePath: window.location.pathname,
        userAgent: navigator.userAgent,
      };
  
      /* ===============================
         SEND EVENT
      =============================== */
  
      fetch("/api/collect", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch(function () {
        // fail silently
      });
    } catch {
      // fail silently
    }
  })();
  