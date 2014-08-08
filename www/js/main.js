/*global $, Windows, MSApp, navigator, chrome, FastClick, StatusBar, escape */
var isIEMobile = /IEMobile/.test(navigator.userAgent),
    isAndroid = /Android|\bSilk\b/.test(navigator.userAgent),
    isiOS = /iP(ad|hone|od)/.test(navigator.userAgent),
    isFireFoxOS = /^.*?\Mobile\b.*?\Firefox\b.*?$/m.test(navigator.userAgent),
    isWinApp = /MSAppHost/.test(navigator.userAgent),
    isOSXApp = isOSXApp || false,
    isChromeApp = typeof chrome === "object" && typeof chrome.storage === "object",
    retryCount = 3;

// Fix CSS for Chrome Web Store apps
if (isChromeApp) {
    insertStyle("html,body{overflow-y:scroll}");
}

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
} else if (isFireFoxOS) {
    // Allow cross domain AJAX requests in FireFox OS
    $.ajaxSetup({
      xhrFields: {
        mozSystem: true
      }
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

$(document)
.ready(function() {
    //Attach FastClick handler
    FastClick.attach(document.body);

    //Update the language on the page using the browser's locale
    update_lang();

    //Change history method for Chrome Packaged Apps
    if (isChromeApp) {
        $.mobile.document.on("click",".ui-toolbar-back-btn",function(){
            goBack();
            return false;
        });
    }

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

    // Check if device is on a local network
    checkAutoScan();

    // For Android, Blackberry and Windows Phone devices catch the back button and redirect it
    $.mobile.document.on("backbutton",function(){
        goBack();
        return false;
    });
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

    //On initial load check if a valid configuration is present
    check_configured(true);
})
.on("resume",function(){
// Handle OS resume event triggered by PhoneGap
    var page = $(".ui-page-active").attr("id");
})
.on("pause",function(){
//Handle OS pause
})
.on("pageshow",function(e){
    var newpage = "#"+e.target.id,
        $newpage = $(newpage);

    // Fix issues between jQuery Mobile and FastClick
    fixInputClick($newpage);

    if (newpage === "#signin") {
        // Bind event handler to open panel when swiping on the main page
        $newpage.off("swiperight").on("swiperight", function() {
            if ($(".ui-page-active").jqmData("panel") !== "open" && !$(".ui-page-active .ui-popup-active").length) {
                open_panel();
            }
        });
    }
})
.on("popupbeforeposition","#localization",check_curr_lang);

//Set AJAX timeout
$.ajaxSetup({
    timeout: 6000
});


// Check configuration
function check_configured(firstLoad) {

}

// Accessory functions for jQuery Mobile
function areYouSure(text1, text2, callback) {
    var popup = $(
        "<div data-role='popup' data-overlay-theme='b' id='sure'>"+
            "<h3 class='sure-1 center'>"+text1+"</h3>"+
            "<p class='sure-2 center'>"+text2+"</p>"+
            "<a class='sure-do ui-btn ui-btn-b ui-corner-all ui-shadow' href='#'>"+_("Yes")+"</a>"+
            "<a class='sure-dont ui-btn ui-corner-all ui-shadow' href='#'>"+_("No")+"</a>"+
        "</div>"
    );

    //Bind buttons
    popup.find(".sure-do").one("click.sure", function() {
        $("#sure").popup("close");
        callback();
        return false;
    });
    popup.find(".sure-dont").one("click.sure", function() {
        $("#sure").popup("close");
        return false;
    });

    popup.one("popupafterclose", function(){
        $(this).popup("destroy").remove();
    }).enhanceWithin();

    $(".ui-page-active").append(popup);

    $("#sure").popup({history: false, positionTo: "window"}).popup("open");
}

function showDurationBox(seconds,title,callback,maximum,granularity) {
    $("#durationBox").popup("destroy").remove();

    title = title || "Duration";
    callback = callback || function(){};
    granularity = granularity || 0;

    var keys = ["days","hours","minutes","seconds"],
        text = [_("Days"),_("Hours"),_("Minutes"),_("Seconds")],
        conv = [86400,3600,60,1],
        total = 4 - granularity,
        start = 0,
        arr = sec2dhms(seconds),
        i;

    if (maximum) {
        for (i=conv.length-1; i>=0; i--) {
            if (maximum < conv[i]) {
                start = i+1;
                total = (conv.length - start) - granularity;
                break;
            }
        }
    }

    var incrbts = "<fieldset class='ui-grid-"+String.fromCharCode(95+(total))+" incr'>",
        inputs = "<div class='ui-grid-"+String.fromCharCode(95+(total))+" inputs'>",
        decrbts = "<fieldset class='ui-grid-"+String.fromCharCode(95+(total))+" decr'>",
        popup = $("<div data-role='popup' id='durationBox' data-theme='a' data-overlay-theme='b'>" +
            "<div data-role='header' data-theme='b'>" +
                "<h1>"+title+"</h1>" +
            "</div>" +
            "<div class='ui-content'>" +
                "<span>" +
                    "<a href='#' class='submit_duration' data-role='button' data-corners='true' data-shadow='true' data-mini='true'>"+_("Set Duration")+"</a>" +
                "</span>" +
            "</div>" +
        "</div>"),
        changeValue = function(pos,dir){
            var input = $(popup.find(".inputs input")[pos]),
                val = parseInt(input.val());

            if ((dir === -1 && val === 0) || (dir === 1 && (getValue() + conv[pos+start]) > maximum)) {
                return;
            }

            input.val(val+dir);
        },
        getValue = function() {
            return dhms2sec({
                "days": parseInt(popup.find(".days").val()) || 0,
                "hours": parseInt(popup.find(".hours").val()) || 0,
                "minutes": parseInt(popup.find(".minutes").val()) || 0,
                "seconds": parseInt(popup.find(".seconds").val()) || 0
            });
        };

    for (i=start; i<conv.length - granularity; i++) {
        incrbts += "<div "+((total > 1) ? "class='ui-block-"+String.fromCharCode(97+i-start)+"'" : "")+"><a href='#'' data-role='button' data-mini='true' data-corners='true' data-icon='plus' data-iconpos='bottom'></a></div>";
        inputs += "<div "+((total > 1) ? "class='ui-block-"+String.fromCharCode(97+i-start)+"'" : "")+"><label>"+_(text[i])+"</label><input class='"+keys[i]+"' type='number' pattern='[0-9]*' value='"+arr[keys[i]]+"'></div>";
        decrbts += "<div "+((total > 1) ? "class='ui-block-"+String.fromCharCode(97+i-start)+"'" : "")+"><a href='#' data-role='button' data-mini='true' data-corners='true' data-icon='minus' data-iconpos='bottom'></a></div>";
    }

    incrbts += "</fieldset>";
    inputs += "</div>";
    decrbts += "</fieldset>";

    popup.find("span").prepend(incrbts+inputs+decrbts);

    popup.find(".incr").children().on("vclick",function(){
        var pos = $(this).index();
        changeValue(pos,1);
        return false;
    });

    popup.find(".decr").children().on("vclick",function(){
        var pos = $(this).index();
        changeValue(pos,-1);
        return false;
    });

    $(".ui-page-active").append(popup);

    popup
    .css("max-width","350px")
    .popup({
        history: false,
        "positionTo": "window"
    })
    .one("popupafterclose",function(){
        $(this).popup("destroy").remove();
    })
    .on("click",".submit_duration",function(){
        callback(getValue());
        popup.popup("close");
        return false;
    })
    .enhanceWithin().popup("open");
}

function changePage(toPage,opts) {
    opts = opts || {};
    if (toPage.indexOf("#") !== 0) {
        toPage = "#"+toPage;
    }

    $.mobile.pageContainer.pagecontainer("change",toPage,opts);
}

// Close the panel before page transition to avoid bug in jQM 1.4+
function changeFromPanel(page) {
    var $panel = $("#signin-settings");
    $panel.one("panelclose", function(){
        changePage("#"+page);
    });
    $panel.panel("close");
}

// Show loading indicator within element(s)
function showLoading(ele) {
    $(ele).off("click").html("<p class='ui-icon ui-icon-loading mini-load'></p>");
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
function showerror(msg,dur) {
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

// Accessory functions
function fixInputClick(page) {
    // Handle Fast Click quirks
    if (!FastClick.notNeeded(document.body)) {
        page.find("input[type='checkbox']:not([data-role='flipswitch'])").addClass("needsclick");
        page.find(".ui-collapsible-heading-toggle").on("click",function(){
            var heading = $(this);

            setTimeout(function(){
                heading.removeClass("ui-btn-active");
            },100);
        });
        page.find(".ui-select > .ui-btn").each(function(a,b){
            var ele = $(b),
                id = ele.attr("id");

            ele.attr("data-rel","popup");
            ele.attr("href","#"+id.slice(0,-6)+"listbox");
        });
    }
}

// Insert style string into the DOM
function insertStyle(style) {
    var a=document.createElement("style");
    a.innerHTML=style;
    document.head.appendChild(a);
}

// Convert all elements in array to integer
function parseIntArray(arr) {
    for(var i=0; i<arr.length; i++) {arr[i] = +arr[i];}
    return arr;
}

// Small wrapper to handle Chrome vs localStorage usage
storage = {
    get: function(query,callback) {
        callback = callback || function(){};

        if (isChromeApp) {
            chrome.storage.local.get(query,callback);
        } else {
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
        }
    },
    set: function(query,callback) {
        callback = callback || function(){};

        if (isChromeApp) {
            chrome.storage.local.set(query,callback);
        } else {
            var i;
            if (typeof query === "object") {
                for (i in query) {
                    if (query.hasOwnProperty(i)) {
                        localStorage.setItem(i,query[i]);
                    }
                }
            }

            callback(true);
        }
    },
    remove: function(query,callback) {
        callback = callback || function(){};

        if (isChromeApp) {
            chrome.storage.local.remove(query,callback);
        } else {
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
    }
};

// Add ability to unique sort arrays
function getUnique(inputArray) {
    var outputArray = [];
    for (var i = 0; i < inputArray.length; i++) {
        if (($.inArray(inputArray[i], outputArray)) === -1) {
            outputArray.push(inputArray[i]);
        }
    }
    return outputArray;
}

// pad a single digit with a leading zero
function pad(number) {
    var r = String(number);
    if ( r.length === 1 ) {
        r = "0" + r;
    }
    return r;
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

function set_lang() {
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

    check_curr_lang();
}

function update_lang(lang) {
    //Empty out the current language (English is provided as the key)
    language = {};

    if (typeof lang === "undefined") {
        storage.get("lang",function(data){
            //Identify the current browser's locale
            var locale = "en";

            locale = data.lang || navigator.language || navigator.browserLanguage || navigator.systemLanguage || navigator.userLanguage || locale;

            update_lang(locale.substring(0,2));
        });
        return;
    }

    storage.set({"lang":lang});

    if (lang === "en") {
        set_lang();
        return;
    }

    $.getJSON("locale/"+lang+".json",function(store){
        language = store.messages;
        set_lang();
    }).fail(set_lang);
}

function check_curr_lang() {
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
