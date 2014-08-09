/*global $, Windows, MSApp, navigator, FastClick, StatusBar */
var isIEMobile = /IEMobile/.test(navigator.userAgent),
    isAndroid = /Android|\bSilk\b/.test(navigator.userAgent),
    isiOS = /iP(ad|hone|od)/.test(navigator.userAgent),
    isWinApp = /MSAppHost/.test(navigator.userAgent),
    isReady = false,
    profile, storage, language;

// Prevent caching of AJAX requests on Android and Windows Phone devices
if (isAndroid) {
    $(this).ajaxStart(function(){
        try {
            navigator.app.clearCache();
        } catch (err) {}
    });
} else if (isIEMobile || isWinApp) {
    $.ajaxSetup({
        "cache": false
    });
}

// Redirect jQuery Mobile DOM manipulation to prevent error
if (isWinApp) {
    // Add link to privacy statement
    var settingsPane = Windows.UI.ApplicationSettings.SettingsPane.getForCurrentView();

    settingsPane.addEventListener("commandsrequested", function(eventArgs) {
        var applicationCommands = eventArgs.request.applicationCommands;
        var privacyCommand = new Windows.UI.ApplicationSettings.SettingsCommand("privacy", "Privacy Policy", function(){
            window.open("http://albahra.com/journal/privacy-policy");
        });
        applicationCommands.append(privacyCommand);
    });

    // Cache the old domManip function.
    $.fn.oldDomManIp = $.fn.domManip;
    // Override the domManip function with a call to the cached domManip function wrapped in a MSapp.execUnsafeLocalFunction call.
    $.fn.domManip = function (args, callback, allowIntersection) {
        var that = this;
        return MSApp.execUnsafeLocalFunction(function () {
            return that.oldDomManIp(args, callback, allowIntersection);
        });
    };
}

// Small wrapper to localStorage async method (for future expansion/change)
storage = {
    get: function(query,callback) {
        callback = callback || function(){};

        var data = {},
            i;

        if (typeof query === "object") {
            for (i in query) {
                if (query.hasOwnProperty(i)) {
                    data[query[i]] = localStorage.getItem(query[i]);
                }
            }
        } else if (typeof query === "string") {
            data[query] = localStorage.getItem(query);
        }

        callback(data);
    },
    set: function(query,callback) {
        callback = callback || function(){};

        var i;
        if (typeof query === "object") {
            for (i in query) {
                if (query.hasOwnProperty(i)) {
                    localStorage.setItem(i,query[i]);
                }
            }
        }

        callback(true);
    },
    remove: function(query,callback) {
        callback = callback || function(){};

        var i;

        if (typeof query === "object") {
            for (i in query) {
                if (query.hasOwnProperty(i)) {
                    localStorage.removeItem(query[i]);
                }
            }
        } else if (typeof query === "string") {
            localStorage.removeItem(query);
        }

        callback(true);
    }
};

$(document)
.ready(function() {
    //Attach FastClick handler
    FastClick.attach(document.body);

    //Update the language on the page using the browser's locale
    updateLang();

    //Use system browser for links on iOS and Windows Phone
    if (isiOS || isIEMobile) {
        $.mobile.document.on("click",".iab",function(){
            window.open(this.href,"_system","enableViewportScale=yes");
            return false;
        });
    } else if (isAndroid) {
        $.mobile.document.on("click",".iab",function(){
            window.open(this.href,"_blank","enableViewportScale=yes");
            return false;
        });
    }
})
.one("deviceready", function() {
    try {
        //Change the status bar to match the headers
        StatusBar.overlaysWebView(false);
        StatusBar.styleLightContent();
        StatusBar.backgroundColorByHexString("#1C1C1C");
    } catch (err) {}

    // Hide the splash screen
    setTimeout(function(){
        try {
            navigator.splashscreen.hide();
        } catch(err) {}
    },500);

    // For Android, Blackberry and Windows Phone devices catch the back button and redirect it
    $.mobile.document.on("backbutton",function(){
        goBack();
        return false;
    });

    isReady = true;
})
.one("mobileinit", function(){
    //After jQuery mobile is loaded set intial configuration
    $.mobile.defaultPageTransition = "fade";
    $.mobile.hoverDelay = 0;
    $.mobile.hashListeningEnabled = false;
})
.one("pagebeforechange", function(event) {
    // Let the framework know we're going to handle the first load
    event.preventDefault();

    // Bind the event handler for subsequent pagebeforechange requests
    $.mobile.document.on("pagebeforechange",function(e,data){
        var page = data.toPage,
            currPage = $(".ui-page-active"),
            hash;

        // Pagebeforechange event triggers twice (before and after) and this check ensures we get the before state
        if (typeof data.toPage !== "string") {
            return;
        }

        hash = $.mobile.path.parseUrl(page).hash;

        if (hash === "#"+currPage.attr("id") && (hash === "#start")) {
            // Cancel page load when navigating to the same page
            e.preventDefault();

            // Allow pages to navigate back by adjusting active index in history
            $.mobile.navigate.history.activeIndex--;

            // Remove the current page from the DOM
            currPage.remove();

            // Change to page without any animation or history change
            changePage(hash,{
                transition: "none",
                showLoadMsg: false
            });
            return;
        }

        // Animations are patchy if the page isn't scrolled to the top. This scrolls the page before the animation fires off
        if (data.options.role !== "popup" && !$(".ui-popup-active").length) {
            $.mobile.silentScroll(0);
        }
    });

    storage.get("profile",function(data){
        var timeout;

        if (!data.profile) {
            showDataRequest();
        } else {
            profile = data.profile;
            timeout = setInterval(function(){
                if (isReady) {
                    clearInterval(timeout);
                    startScan();
                }
            },100);
        }
    });
})
.on("resume",function(){
// Handle OS resume event triggered by PhoneGap
})
.on("pause",function(){
//Handle OS pause
})
.on("popupbeforeposition","#localization",checkCurrLang);

//Set AJAX timeout
$.ajaxSetup({
    timeout: 10000
});

// Show page requesting typical user information
function showDataRequest() {

}

// Load bar code scanner and process sign in
function startScan() {
    showError("Invalid URL");
}

// Accessory functions for jQuery Mobile
function changePage(toPage,opts) {
    opts = opts || {};
    if (toPage.indexOf("#") !== 0) {
        toPage = "#"+toPage;
    }

    $.mobile.pageContainer.pagecontainer("change",toPage,opts);
}

function goBack(keepIndex) {
    var page = $(".ui-page-active").attr("id"),
        managerStart = (page === "site-control" && !$("#site-control").find(".ui-btn-left").is(":visible"));

    if (page === "signin" || page === "start" || managerStart) {
        navigator.app.exitApp();
    } else {
        changePage($.mobile.navigate.history.getPrev().url);
        $.mobile.document.one("pagehide",function(){
            if (!keepIndex) {
                $.mobile.navigate.history.activeIndex -= 2;
            }
        });
    }
}

// show error message
function showError(msg,dur) {
    dur = dur || 2500;

    $.mobile.loading("show", {
        text: msg,
        textVisible: true,
        textonly: true,
        theme: "b"
    });
    // hide after delay
    setTimeout(function(){$.mobile.loading("hide");},dur);
}

//Localization functions
function _(key) {
    //Translate item (key) based on currently defined language
    if (typeof language === "object" && language.hasOwnProperty(key)) {
        var trans = language[key];
        return trans ? trans : key;
    } else {
        //If English
        return key;
    }
}

function setLang() {
    //Update all static elements to the current language
    $("[data-translate]").text(function() {
        var el = $(this),
            txt = el.data("translate");

        if (el.is("input[type='submit']")) {
            el.val(_(txt));
            // Update button for jQuery Mobile
            if (el.parent("div.ui-btn").length > 0) {
                el.button("refresh");
            }
        } else {
            return _(txt);
        }
    });
    $(".ui-toolbar-back-btn").text(_("Back"));
    $.mobile.toolbar.prototype.options.backBtnText = _("Back");

    checkCurrLang();
}

function updateLang(lang) {
    //Empty out the current language (English is provided as the key)
    language = {};

    if (typeof lang === "undefined") {
        storage.get("lang",function(data){
            //Identify the current browser's locale
            var locale = "en";

            locale = data.lang || navigator.language || navigator.browserLanguage || navigator.systemLanguage || navigator.userLanguage || locale;

            updateLang(locale.substring(0,2));
        });
        return;
    }

    storage.set({"lang":lang});

    if (lang === "en") {
        setLang();
        return;
    }

    $.getJSON("locale/"+lang+".json",function(store){
        language = store.messages;
        setLang();
    }).fail(setLang);
}

function checkCurrLang() {
    storage.get("lang",function(data){
        $("#localization").find("a").each(function(a,b){
            var item = $(b);
            if (item.data("lang-code") === data.lang) {
                item.removeClass("ui-icon-carat-r").addClass("ui-icon-check");
            } else {
                item.removeClass("ui-icon-check").addClass("ui-icon-carat-r");
            }
        });
    });
}
