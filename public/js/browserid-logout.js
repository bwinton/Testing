(function ($) {
    "use strict";

    var options = {
        auto:       true
    ,   debug:      false
    ,   selector:   "#browserid-logout"
    };
    var $win = $(window);
    $(options.selector).click(function () {
      $.getJSON("/browserid/logout", function(data) {
        console.log("logout returned = " + data);
        location.reload();
      });
    });
    if (options.debug) {
        $win.on("logout-attempt", function () {
            console.log("[BrowserID] attempting to log out");
        });
        $win.on("login-response", function (ev, ass) {
            console.log("[BrowserID] login responded with assertion: " + (ass ? ass : "*none*"));
        });
        $win.on("received-assertion", function (ev, ass) {
            console.log("[BrowserID] assertion received: " + ass);
        });
        $win.on("login-error", function (ev, type, data) {
            console.log("[BrowserID] error: " + type, data);
        });
        $win.on("login-success", function (ev, data) {
            console.log("[BrowserID] success!", data);
        });
    }
    if (options.auto) {
        $win.on("login-success", function (ev, data) {
            location.reload();
        });
    }
})(jQuery);
