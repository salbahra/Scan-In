/*global $, Windows, MSApp, navigator, cordova, FastClick, StatusBar, escape */
var isIEMobile = /IEMobile/.test(navigator.userAgent),
    isAndroid = /Android|\bSilk\b/.test(navigator.userAgent),
    isiOS = /iP(ad|hone|od)/.test(navigator.userAgent),
    isWinApp = /MSAppHost/.test(navigator.userAgent),
    dataMap = {
        "Laboratory Medicine Report": {
            id: "dHp1cWFIUjFGbWN5VVBTNDZPMEhTSlE6MA",
            firstname: "entry.2.single",
            lastname: "entry.5.single",
            date: "entry.8.single",
            degree: "entry.6.group",
            position: "entry.9.group",
            didPresent: "entry.11.group",
            coi: "entry.13.group",
            email: "entry.10.single",
            name: "entry.18.group"
        },
        "AP Grand Rounds": {
            id: "dHkwbTZQeGxSd2R6WmZmeUZtNzROR3c6MA",
            firstname: "entry.2.single",
            lastname: "entry.5.single",
            date: "entry.8.single",
            degree: "entry.6.group",
            isResident: "entry.9.group",
            email: "entry.10.single",
            name: "entry.7.group"
        }
    },
    profile = {
        lastname: "",
        firstname: "",
        degree: "",
        position: "",
        email: ""
    },
    isReady = false,
    storage, language;

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

    $("#startScan").on("click",function(){
        startScan();
        return false;
    });
})
.one("deviceready", function() {
    try {
        //Change the status bar to match the headers
        StatusBar.overlaysWebView(false);
        StatusBar.styleDefault();
        StatusBar.backgroundColorByHexString("#F9F9F9");
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
    $.mobile.defaultPageTransition = "none";
    $.mobile.activeBtnClass = "disabled";
    $.mobile.hashListeningEnabled = false;
})
.one("pagebeforechange", function() {
    // Bind the event handler for subsequent pagebeforechange requests
    $.mobile.document.on("pagebeforechange",function(e,data){
        var page = data.toPage,
            hash;

        // Pagebeforechange event triggers twice (before and after) and this check ensures we get the before state
        if (typeof data.toPage !== "string") {
            return;
        }

        hash = $.mobile.path.parseUrl(page).hash;

        // Animations are patchy if the page isn't scrolled to the top. This scrolls the page before the animation fires off
        if (data.options.role !== "popup" && !$(".ui-popup-active").length) {
            $.mobile.silentScroll(0);
        }

        // Cycle through page possbilities and call their init functions
        if (hash === "#dataRequest") {
            showDataRequest();
        } else if (hash === "#about") {
            $(hash).find("button[data-icon='back']").one("click",goBack);
        }
    });

    storage.get("profile",function(data){
        var timeout;
        if (data.profile) {
            profile = JSON.parse(data.profile);
            updateStartMenu();
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
    storage.get("profile",function(data){
        if (data.profile) {
            profile = JSON.parse(data.profile);
            updateStartMenu();
            setTimeout(startScan,10);
        }
    });
})
.on("pause",function(){
//Handle OS pause
})
.on("pageshow","#start",function(){
    var page = $("#start");
    fixInputClick(page);
    page.find("li img").off("vclick").on("vclick",startScan);
    page.off("swipeleft").one("swipeleft",function(){
        changePage("#dataRequest",{
            transition: "slide"
        });
    });
})
.on("popupbeforeposition","#localization",checkCurrLang);

//Set AJAX timeout
$.ajaxSetup({
    timeout: 10000
});

// Show page requesting typical user information
function showDataRequest() {
    var page = $("<div data-role='page' id='dataRequest'>" +
            "<div class='ui-content' role='main'>" +
                "<p class='center'>"+_("User Information")+"</p>" +
                "<p class='center smaller rain-desc'>"+_("In order to facilitate a quicker login your information will be collected and saved to your device for future use. After this initial setup you will be greeted with the barcode scanner to finish your sign-in.")+"</p>" +
                "<ul data-role='listview' data-inset='true'>" +
                    "<li><div class='ui-field-contain'><fieldset><form>" +
                        "<label for='lastname'>"+_("Last Name")+"</label><input data-mini='true' type='text' max='255' name='lastname' id='lastname' value='"+profile.lastname+"' />" +
                        "<label for='firstname'>"+_("First Name")+"</label><input data-mini='true' type='text' max='255' name='firstname' id='firstname' value='"+profile.firstname+"' />" +
                        "<label for='degree'>"+_("Credentials")+"</label><select data-mini='true' name='degree' id='degree'>" +
                            "<option "+(profile.degree==="MD" ? "selected " : "")+"value='MD'>"+_("MD")+"</option>" +
                            "<option "+(profile.degree==="DO" ? "selected " : "")+"value='DO'>"+_("DO")+"</option>" +
                            "<option "+(profile.degree==="PhD" ? "selected " : "")+"value='PhD'>"+_("PhD")+"</option>" +
                            "<option "+(profile.degree==="PharmD" ? "selected " : "")+"value='PharmD'>"+_("PharmD")+"</option>" +
                            "<option "+(profile.degree==="LVN" ? "selected " : "")+"value='LVN'>"+_("LVN")+"</option>" +
                            "<option "+(profile.degree==="RN" ? "selected " : "")+"value='RN'>"+_("RN")+"</option>" +
                            "<option "+(profile.degree==="PA" ? "selected " : "")+"value='PA'>"+_("PA")+"</option>" +
                            "<option "+(profile.degree==="MT/CLS/MLS" ? "selected " : "")+"value='MT/CLS/MLS'>"+_("MT/CLS/MLS")+"</option>" +
                            "<option "+(profile.degree==="Other" ? "selected " : "")+"value='Other'>"+_("Other")+"</option>" +
                        "</select>" +
                        "<label for='position'>"+_("Position")+"</label><select data-mini='true' name='position' id='position'>" +
                            "<option "+(profile.position==="Faculty" ? "selected " : "")+"value='Faculty'>"+_("Faculty")+"</option>" +
                            "<option "+(profile.position==="Fellow" ? "selected " : "")+"value='Fellow'>"+_("Fellow")+"</option>" +
                            "<option "+(profile.position==="Resident" ? "selected " : "")+"value='Resident'>"+_("Resident")+"</option>" +
                            "<option "+(profile.position==="Student" ? "selected " : "")+"value='Student'>"+_("Student")+"</option>" +
                            "<option "+(profile.position==="Staff" ? "selected " : "")+"value='Staff'>"+_("Staff")+"</option>" +
                            "<option "+(profile.position==="Other" ? "selected " : "")+"value='Other'>"+_("Other")+"</option>" +
                        "</select>" +
                        "<label for='email'>"+_("Email Address")+"</label><input data-mini='true' type='email' max='255' name='email' id='email' value='"+profile.email+"' />" +
                        "<input type='submit' data-mini='true' value='Submit' />" +
                        "<button data-theme='b' data-mini='true'>"+_("Cancel")+"</button>" +
                    "</form></fieldset></div></li>" +
                "</ul>" +
            "</div>" +
        "</div>"),
        form = page.find("form");

    form.on("submit",function(){
        var data = form.serializeArray(),
            i;

        for (i=0; i<data.length; i++) {
            profile[data[i].name] = data[i].value;
        }

        storage.set({
            "profile": JSON.stringify(profile)
        }, function(){
            updateStartMenu();
            goBack();
            startScan();
        });

        return false;
    });

    form.on("click","button",function(){
        goBack();
        return false;
    });

    page.one({
        pagehide: function(){
            page.remove();
        },
        swiperight: function(){
            changePage("#start",{
                transition: "slide",
                reverse: true
            });
        }
    });

    fixInputClick(page);

    page.appendTo("body");
}

// Load bar code scanner
function startScan() {
    if (typeof cordova === "object" && typeof cordova.plugins.barcodeScanner === "object") {
        cordova.plugins.barcodeScanner.scan(
            function (result) {
                // If user canceled then return to start page
                if (result.cancelled) {
                    return;
                }

                var signIn = function() {
                        // Submit sign in to Google
                        $.get("https://spreadsheets.google.com/spreadsheet/formResponse?formkey="+formKey[1]+"&"+data).retry({times:3, statusCodes: [0,408,500]}).then(
                            function(reply){
                                reply = $(reply).find(".errorheader");
                                if (reply.length) {
                                    showError("Unable to finish sign in. Please check your information is properly filled out and try again.");
                                    return;
                                }
                                // Show success
                                showError("Sign in was successful!",8000);
                            },function(){
                                // Show failure
                                showError("Unable to finish sign in due to a connection problem. Please try again.");
                            }
                        );
                    },
                    getData = function(didPresent,coi) {
                        var coiMap = ["Not applicable, I did not present","No","Yes, explained in the presentation"],
                            now = new Date(),
                            isResident = (profile.position && profile.position === "Resident") ? _("Yes") : _("No"),
                            key;

                        didPresent = didPresent ? _("Yes") : _("No");
                        coi = coiMap[coi];

                        for (key in dataMap[form]) {
                            if (dataMap[form].hasOwnProperty(key) && profile.hasOwnProperty(key)) {
                                if (typeof dataMap[form][key] === "function") {
                                    data += dataMap[form][key]() + "&";
                                } else if (typeof dataMap[form][key] === "string") {
                                    data += dataMap[form][key]+"="+escape(profile[key])+"&";
                                }
                            }
                        }

                        if (dataMap[form].hasOwnProperty("didPresent")) {
                            data += dataMap[form].didPresent + "=" + escape(didPresent) + "&";
                        }
                        if (dataMap[form].hasOwnProperty("coi")) {
                            data += dataMap[form].coi + "=" + escape(coi) + "&";
                        }
                        if (dataMap[form].hasOwnProperty("isResident")) {
                            data += dataMap[form]["isResident"] + "=" + isResident + "&";
                        }
                        data += dataMap[form].name + "=" + escape(form) + "&";
                        data += dataMap[form].date + "=" + escape((now.getMonth()+1)+"/"+now.getDate()+"/"+now.getFullYear().toString().slice(2));
                        signIn();
                    },
                    formKey = $.mobile.path.parseUrl(result.text).hrefNoHash.match(/https?:\/\/docs.google.com\/spreadsheet\/viewform\?(?:.*)?formkey=(.*)(?:&.*)?/) || [],
                    hasMatch = false,
                    data = "",
                    form;

                if (typeof formKey[1] !== "string") {
                    showError(_("A Google form was not identified within the barcode. Please ensure the correct barcode has been scanned."),3000);
                    return;
                }

                for (form in dataMap) {
                    if (dataMap.hasOwnProperty(form) && dataMap[form].id === formKey[1]) {
                        hasMatch = true;
                        break;
                    }
                }

                if (!hasMatch) {
                    showError(_("This URL is not for a known form. Please contact the developer for assistance."),3000);
                    return;
                }

                if (dataMap[form].hasOwnProperty("didPresent")) {
                    // Ask for presenting today and if so, any conflict of interest
                    areYouSure(_("Did You Present Today?"),"").then(
                        function(){
                            if (dataMap[form].hasOwnProperty("coi")) {
                                areYouSure(_("Do you have any new conflict of interests to declare?"),"").then(
                                    function(){
                                        getData(true,2);
                                    },
                                    function(){
                                        getData(true,1);
                                    }
                                );
                            } else {
                                getData(true);
                            }
                        },
                        function(){
                            getData(false,0);
                        }
                    );
                } else {
                    getData();
                }
            },
            function() {
                showError(_("Unable to open the camera on your device. Please ensure the camera is working and try again."),4000);
            }
        );
    } else {
        showError(_("Your device is currently unsupported for barcode scanning."));
    }
}

// Accessory functions
function updateStartMenu() {
    var page = $("#start"),
        info = page.find("a[href='#dataRequest']").parent(),
        scan = page.find("#startScan").parent();

    info.find("a").text(_("Edit Information"));
    scan.show();
}

function fixInputClick(page) {
    // Handle Fast Click quirks
    if (!FastClick.notNeeded(document.body)) {
        page.find("input[type='checkbox']:not([data-role='flipswitch'])").addClass("needsclick");
        page.find(".ui-select > .ui-btn").each(function(a,b){
            var ele = $(b),
                id = ele.attr("id");

            ele.attr("data-rel","popup");
            ele.attr("href","#"+id.slice(0,-6)+"listbox");
        });
    }
}

// Accessory functions for jQuery Mobile
function areYouSure(question, helptext) {
    var popup = $(
        "<div data-role='popup' data-overlay-theme='b' id='sure'>"+
            "<h3 class='sure-1 center'>"+question+"</h3>"+
            "<p class='sure-2 center'>"+helptext+"</p>"+
            "<a class='sure-do ui-btn ui-btn-b ui-corner-all ui-shadow' href='#'>"+_("Yes")+"</a>"+
            "<a class='sure-dont ui-btn ui-corner-all ui-shadow' href='#'>"+_("No")+"</a>"+
        "</div>"
    ),
    cleanUp = function(){
        try {
            StatusBar.backgroundColorByHexString("#F9F9F9");
        } catch (err) {}
        popup.popup("close");
    },
    dfd = new $.Deferred();

    //Bind buttons
    popup.find(".sure-do").one("click.sure", function() {
        cleanUp();
        dfd.resolve();
        return false;
    });
    popup.find(".sure-dont").one("click.sure", function() {
        cleanUp();
        dfd.reject();
        return false;
    });

    popup.one("popupafterclose", function(){
        $(this).popup("destroy").remove();
    }).enhanceWithin();

    $(".ui-page-active").append(popup);

    try {
        StatusBar.backgroundColorByHexString("#8F8F8F");
    } catch (err) {}

    popup.popup({history: false, positionTo: "window"}).popup("open");

    return dfd.promise();
}

function changePage(toPage,opts) {
    opts = opts || {};
    if (toPage.indexOf("#") !== 0) {
        toPage = "#"+toPage;
    }

    $.mobile.pageContainer.pagecontainer("change",toPage,opts);
}

function goBack() {
    var page = $(".ui-page-active").attr("id"),
        prev;

    if (page === "start") {
        navigator.app.exitApp();
    } else {
        prev = $.mobile.navigate.history.getPrev().url;
        if (prev !== $.mobile.path.parseUrl(prev).hash) {
            prev = "#start";
        }

        changePage(prev);
        $.mobile.document.one("pagehide",function(){
            $.mobile.navigate.history.activeIndex -= 1;
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
