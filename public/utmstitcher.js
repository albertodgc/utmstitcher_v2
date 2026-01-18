(function () {
  try {
    var PREFIX = "__utmstitcher__";
    var VISITOR_KEY = PREFIX + "visitor_id";
    var IDENTIFIED_KEY = PREFIX + "identified";
    var FIRST_TOUCH_KEY = PREFIX + "first_touch";
    var LAST_TOUCH_KEY = PREFIX + "last_touch";
    var VISIT_COUNT_KEY = PREFIX + "visit_count";

    var COLLECT_ENDPOINT = "https://app.utmstitcher.com/api/collect";
    var IDENTIFY_ENDPOINT = "https://app.utmstitcher.com/api/identify";

    var scriptTag = document.currentScript;
    var SITE_KEY = scriptTag && scriptTag.getAttribute("data-site");

    if (!SITE_KEY) return;

    /* ------------------------
       Utilities
    ------------------------- */

    function uuid() {
      if (crypto.randomUUID) return crypto.randomUUID();
      return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0,
          v = c === "x" ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    }

    function getLS(key) {
      try { return localStorage.getItem(key); } catch { return null; }
    }

    function setLS(key, value) {
      try { localStorage.setItem(key, value); } catch {}
    }

    function getParam(name) {
      return new URLSearchParams(window.location.search).get(name);
    }

    function collectUTMs() {
      var utm = {
        utm_source: getParam("utm_source"),
        utm_medium: getParam("utm_medium"),
        utm_campaign: getParam("utm_campaign"),
        utm_term: getParam("utm_term"),
        utm_content: getParam("utm_content"),
      };

      var hasAny = Object.values(utm).some(Boolean);
      return hasAny ? JSON.stringify(utm) : null;
    }

    /* ------------------------
       Visitor bootstrap
    ------------------------- */

    var visitorId = getLS(VISITOR_KEY);
    if (!visitorId) {
      visitorId = uuid();
      setLS(VISITOR_KEY, visitorId);
    }

    var visitCount = parseInt(getLS(VISIT_COUNT_KEY) || "0", 10) + 1;
    setLS(VISIT_COUNT_KEY, String(visitCount));

    var utms = collectUTMs();
    var firstTouch = getLS(FIRST_TOUCH_KEY);
    var lastTouch = utms || getLS(LAST_TOUCH_KEY);

    if (!firstTouch && utms) {
      setLS(FIRST_TOUCH_KEY, utms);
      firstTouch = utms;
    }

    if (utms) setLS(LAST_TOUCH_KEY, utms);

    /* ------------------------
       Send collect event
    ------------------------- */

    fetch(COLLECT_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + SITE_KEY
      },
      body: JSON.stringify({
        siteKey: SITE_KEY,
        visitorId: visitorId,
        visitCount: visitCount,
        firstTouch: firstTouch,
        lastTouch: lastTouch,
        pagePath: location.pathname,
        userAgent: navigator.userAgent
      })
    }).catch(function () {});

    /* ------------------------
       Identity capture
    ------------------------- */

    function extractIdentity(form) {
      var email = form.querySelector('input[type="email"], input[name*="email" i]');
      if (!email || !email.value) return null;

      var firstName =
        form.querySelector('input[name*="first" i]') ||
        form.querySelector('input[name*="fname" i]');

      var lastName =
        form.querySelector('input[name*="last" i]') ||
        form.querySelector('input[name*="lname" i]');

      return {
        email: email.value.trim(),
        firstName: firstName ? firstName.value.trim() : null,
        lastName: lastName ? lastName.value.trim() : null
      };
    }

    function identifyOnce(identity) {
      if (!identity.email) return;
      if (getLS(IDENTIFIED_KEY) === identity.email) return;

      fetch(IDENTIFY_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + SITE_KEY
        },
        body: JSON.stringify({
          siteKey: SITE_KEY,
          visitorId: visitorId,
          email: identity.email,
          firstName: identity.firstName,
          lastName: identity.lastName
        })
      }).then(function () {
        setLS(IDENTIFIED_KEY, identity.email);
      }).catch(function () {});
    }

    /* ------------------------
       Form listeners
    ------------------------- */

    document.addEventListener("submit", function (e) {
      var form = e.target;
      if (!form || !form.querySelector) return;

      var identity = extractIdentity(form);
      if (identity) identifyOnce(identity);
    }, true);

    /* ------------------------
       HubSpot forms support
    ------------------------- */

    if (window.hbspt && window.hbspt.forms) {
      window.hbspt.forms.onFormSubmit(function ($form) {
        try {
          var el = $form[0];
          var identity = extractIdentity(el);
          if (identity) identifyOnce(identity);
        } catch {}
      });
    }

  } catch (e) {
    console.warn("[utmstitcher] init failed", e);
  }
})();
