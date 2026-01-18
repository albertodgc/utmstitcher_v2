(function () {
    if (!window.addEventListener) return;
  
    window.addEventListener("message", function (event) {
      try {
        if (
          event.data?.type === "hsFormCallback" &&
          event.data.eventName === "onFormSubmit"
        ) {
          var data = event.data.data || {};
          var email =
            data.email ||
            data.Email ||
            data["email"] ||
            data["Email"];
  
          if (!email || !window.utmStitcherIdentify) return;
  
          window.utmStitcherIdentify({
            email: email,
            firstName: data.firstname || data.first_name || null,
            lastName: data.lastname || data.last_name || null,
          });
        }
      } catch {}
    });
  })();
  