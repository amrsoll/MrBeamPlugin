/*
 * View model for Mr_Beam
 *
 * Author: Teja
 * License: AGPLv3
 */

/**
 browser detection code
 https://stackoverflow.com/a/7768006/2631798
 Might not be perfect, but for now it's ok.
 */
var mrbeam = window.mrbeam;
var browser = {
    is_chrome: navigator.userAgent.indexOf("Chrome") > -1,
    is_explorer: navigator.userAgent.indexOf("MSIE") > -1,
    is_firefox: navigator.userAgent.indexOf("Firefox") > -1,
    is_safari: navigator.userAgent.indexOf("Safari") > -1,
    is_edge: navigator.userAgent.indexOf("Edge") > -1,
    is_opera: navigator.userAgent.toLowerCase().indexOf("op") > -1,
    is_ipad: navigator.userAgent.indexOf("iPad") > -1,
    is_supported: null,
    chrome_version: null,
};
if (browser.is_chrome && browser.is_safari) {
    browser.is_safari = false;
}
if (browser.is_chrome && browser.is_opera) {
    browser.is_chrome = false;
}
if (browser.is_chrome && browser.is_edge) {
    browser.is_chrome = false;
}

browser.chrome_version = navigator.userAgent.match(/Chrom(e|ium)\/([0-9]+)\./);
browser.chrome_version = browser.chrome_version
    ? parseInt(browser.chrome_version[2], 10)
    : null;

// supported browser
browser.is_supported =
    (browser.is_chrome && browser.chrome_version >= 60) || browser.is_ipad;
mrbeam.browser = browser;

// Mr Beam models
mrbeam.model = {
    MRBEAM2: "MRBEAM2",
    MRBEAM2_DC_R1: "MRBEAM2_DC_R1",
    MRBEAM2_DC_R2: "MRBEAM2_DC_R2",
    MRBEAM2_DC: "MRBEAM2_DC",
    is_mrbeam2: function () {
        return window.MRBEAM_MODEL === window.mrbeam.model.MRBEAM2;
    },
    is_mrbeam2_dreamcut_ready1: function () {
        return window.MRBEAM_MODEL === window.mrbeam.model.MRBEAM2_DC_R1;
    },
    is_mrbeam2_dreamcut_ready2: function () {
        return window.MRBEAM_MODEL === window.mrbeam.model.MRBEAM2_DC_R2;
    },
    is_mrbeam2_dreamcut: function () {
        return window.MRBEAM_MODEL === window.mrbeam.model.MRBEAM2_DC;
    },
};

/**
 * Test if OctoPrint of a specific or higher version is running.
 * @param expectedOctPrintVersion
 * @returns Boolean or undefined if VERSION is not set
 */
mrbeam.isOctoPrintVersionMin = function (expectedOctPrintVersion) {
    if (VERSION) {
        return mrbeam._isVersionOrHigher(
            VERSION.replace("v", ""),
            expectedOctPrintVersion
        );
    } else {
        return undefined;
    }
};

/**
 * compare two versions, return true if actualVersion is up to date, false otherwise
 * if both versions are in the form of major[.minor][.patch] then the comparison parses and compares as such
 * otherwise the versions are treated as strings and normal string compare is done
 * taken from: https://gist.github.com/prenagha/98bbb03e27163bc2f5e4
 * @param actualVersion
 * @param expectedVersion
 * @returns {boolean}
 */
mrbeam._isVersionOrHigher = function (actualVersion, expectedVersion) {
    var version_depth = 5;
    var VPAT = /^\d+(\.\d+){0,4}$/;

    if (
        !actualVersion ||
        !expectedVersion ||
        actualVersion.length === 0 ||
        expectedVersion.length === 0
    )
        return false;
    if (actualVersion == expectedVersion) return true;
    if (VPAT.test(actualVersion) && VPAT.test(expectedVersion)) {
        var lparts = actualVersion.split(".");
        while (lparts.length < version_depth) lparts.push("0");
        var rparts = expectedVersion.split(".");
        while (rparts.length < version_depth) rparts.push("0");
        for (var i = 0; i < version_depth; i++) {
            var l = parseInt(lparts[i], 10);
            var r = parseInt(rparts[i], 10);
            if (l === r) continue;
            return l > r;
        }
        return true;
    } else {
        return actualVersion >= expectedVersion;
    }
};

/**
 * Push a new PNotify notification.
 * If pn_obj contains attribute 'id',
 * this method makes sure that only one notification with the same id is shown at a time.
 * @param pn_obj PNotify configuration
 */
mrbeam.updatePNotify = function (pn_obj) {
    pn_obj.id = pn_obj.id || "id_" + Date.now();
    // find notification in screen
    let existing_notification = null;
    for (let n = 0; n < PNotify.notices.length; n++) {
        if (
            PNotify.notices[n].state != "closed" &&
            PNotify.notices[n].options &&
            PNotify.notices[n].options.id == pn_obj.id
        ) {
            existing_notification = PNotify.notices[n];
            break;
        }
    }
    if (existing_notification) {
        existing_notification.update(pn_obj);
    } else {
        new PNotify(pn_obj);
    }
};

/**
 * Opens an offline version of the KB (pdf) in a new tab/window respecting user's language
 * @param document - document name without path: '43000431865_custom_materials.pdf'
 *                   The document itself needs to be located in static/docs/offline_kb/{locale}/{doc}
 * @param availableLanguages - Array of languages in which the document is available. default: ['en', 'de']
 * @returns false
 */
mrbeam.openOfflineKbUrl = function (document, availableLanguages) {
    availableLanguages = availableLanguages || ["en", "de"];
    var myLang = "en";
    if (typeof LOCALE !== "undefined" && availableLanguages.includes(LOCALE)) {
        myLang = LOCALE;
    }
    var url =
        "/plugin/mrbeam/static/docs/offline_kb/" + myLang + "/" + document;
    window.open(url, "_blank");
    return false;
};

/**
 * For debugging offline_kb articles.
 * Stops periodic online check and sets the state to offline/
 * @param locale - if set changes the global LOCALE param.
 *                 (Note that most content doesn't change right away, but offline_kb links do.)
 */
mrbeam.debugSetOfflineState = function (locale) {
    if (locale) {
        LOCALE = locale;
    }
    // this will terribly crash if page is not initialized as expected.
    mrbeam.viewModels.mrbeamViewModel.debugSetOfflineState();
};

mrbeam.mrb_state = undefined;
mrbeam.isOnline = undefined;
mrbeam.viewModels = {};

mrbeam.isBeta = function () {
    return MRBEAM_SW_TIER === "BETA";
};

mrbeam.isDev = function () {
    return MRBEAM_SW_TIER === "DEV";
};

mrbeam.isProd = function () {
    return MRBEAM_SW_TIER === "PROD";
};

mrbeam.isWatterottMode = function () {
    return INITIAL_CALIBRATION === true;
};

$(function () {
    // MR_BEAM_OCTOPRINT_PRIVATE_API_ACCESS
    // Force input of the "Add User" E-mail address in Settings > Access Control to lowercase.
    $("#settings-usersDialogAddUserName").attr(
        "data-bind",
        "value: $root.access.users.editor.name, valueUpdate: 'afterkeydown'"
    );
    // Check if the entered e-mail address is valid and show error if not.
    $(
        "#settings-usersDialogAddUser > div.modal-body > form > div:nth-child(1)"
    ).attr(
        "data-bind",
        "css: {error: $root.mrbeam.userTyped() && !$root.mrbeam.validUsername()}"
    );
    $(
        "#settings-usersDialogAddUser > div.modal-body > form > div:nth-child(1) > div"
    ).append(
        '<span class="help-inline" data-bind="visible: $root.mrbeam.userTyped() && !$root.mrbeam.validUsername(), text: $root.mrbeam.invalidEmailHelp"></span>'
    );

    function MrbeamViewModel(parameters) {
        var self = this;
        window.mrbeam.viewModels["mrbeamViewModel"] = self;

        self.settings = parameters[0];
        self.wizardacl = parameters[1];
        self.access = parameters[2];
        self.loginState = parameters[3];
        self.system = parameters[4];

        // MR_BEAM_OCTOPRINT_PRIVATE_API_ACCESS
        self.settings.mrbeam = self;

        self._online_check_last_state = null;
        self._online_check_interval = null;
        self._ajaxErrorRegistered = false;

        self.userTyped = ko.observable(false);
        self.invalidEmailHelp = gettext("Invalid e-mail address");

        // This extender forces the input value to lowercase. Used in loginsreen_viewmode.js and wizard_acl.js
        window.ko.extenders.lowercase = function (target, option) {
            target.subscribe(function (newValue) {
                if (newValue !== undefined) {
                    target(newValue.toLowerCase());
                }
            });
            return target;
        };

        self.access.users.currentUser.subscribe(function (currentUser) {
            // todo iratxe
            if (currentUser === undefined) {
                // MR_BEAM_OCTOPRINT_PRIVATE_API_ACCESS
                // For "Add User" set the Admin checked by default
                // self.access.currentUser.admin(true)
            }
        });

        self.access.users.editor.name.subscribe(function (username) {
            if (username) {
                self.userTyped(true);
            } else {
                self.userTyped(false);
            }
        });

        self.validUsername = ko.pureComputed(function () {
            return self.wizardacl.regexValidateEmail.test(
                self.access.users.editor.name()
            );
        });

        self.onStartup = function () {
            self.start_online_check_interval();

            // set env flag in body for experimental_feature_beta and  experimental_feature_dev
            if (mrbeam.isDev()) {
                $("body").addClass("env_dev");
                $("body").removeClass("env_beta");
                $("body").removeClass("env_prod");
            } else if (mrbeam.isBeta()) {
                $("body").addClass("env_beta");
                $("body").removeClass("env_prod");
            } else if (mrbeam.isProd()) {
                $("body").addClass("env_prod");
                $("body").removeClass("env_dev");
                $("body").removeClass("env_beta");
            }

            $(window).on("orientationchange", self.onOrientationchange);
            self.setBodyScrollTop();

            // MR_BEAM_OCTOPRINT_PRIVATE_API_ACCESS
            // Change "Username" label in Settings > Access Control > Add user
            $(
                "#settings-usersDialogAddUser > div.modal-body > form > div:nth-child(1) > label"
            ).text(gettext("E-mail address"));
        };

        self.onAllBound = function () {
            self.set_settings_analytics_links();
        };

        self.onStartupComplete = function () {
            self.presetLoginUser();
        };
        self.onCurtainOpened = function () {
            self.removeOpSafeModeOptionFromSystemMenu();
            self.showBrowserWarning();
            self.showBetaNotifications();
        };

        self.onOrientationchange = function () {
            self.setBodyScrollTop();
        };

        self.setBodyScrollTop = function () {
            $("body").scrollTop(0);
        };

        self.onDataUpdaterPluginMessage = function (plugin, data) {
            if (plugin != "mrbeam") {
                return;
            }

            if ("frontend_notification" in data) {
                var notification = data["frontend_notification"];
                var delay = notification["delay"]
                    ? notification["delay"] * 1000
                    : 10 * 1000;
                new PNotify({
                    title: notification["title"],
                    text: notification["text"],
                    type: notification["type"] || "info",
                    hide: !(
                        notification["hide"] == false ||
                        notification["sticky"] == true
                    ),
                    delay: delay,
                });
            }
        };

        self.onUserLoggedIn = function () {
            self.removeOpSafeModeOptionFromSystemMenu();

            if (!self._ajaxErrorRegistered) {
                $(document).ajaxError(function (
                    event,
                    jqXHR,
                    settings,
                    thrownError
                ) {
                    if (jqXHR.status == 401) {
                        self._handle_session_expired(settings.url);
                    }
                });
            }
        };

        self.onUserLoggedOut = function () {
            self.presetLoginUser();
        };

        self.start_online_check_interval = function () {
            self.do_online_check();
            self._online_check_interval = setInterval(
                self.do_online_check,
                60 * 1000
            );
        };

        self.debugSetOfflineState = function (offline) {
            let online = typeof offline !== "undefined" ? offline : false;
            clearInterval(self._online_check_interval);
            mrbeam.isOnline = online;
            self.set_offline_links(online);
        };

        self.do_online_check = function () {
            $.ajax({
                type: "HEAD",
                async: true,
                url: "http://find.mr-beam.org/onlinecheck",
            })
                .done(function () {
                    if (self._online_check_last_state !== true) {
                        console.log("Online check: Online");
                    }
                    self._online_check_last_state = true;
                    mrbeam.isOnline = true;
                    self.set_offline_links(self._online_check_last_state);
                })
                .fail(function () {
                    if (self._online_check_last_state !== false) {
                        console.log("Online check: Offline");
                    }
                    mrbeam.isOnline = false;
                    self._online_check_last_state = false;
                    self.set_offline_links(self._online_check_last_state);
                });
        };

        self.set_offline_links = function (online) {
            if (online) {
                $("body").addClass("online");
                $("body").removeClass("offline");
            } else {
                $("body").addClass("offline");
                $("body").removeClass("online");
            }
        };

        self._handle_session_expired = function (triggerUrl) {
            if (self.loginState && self.loginState.loggedIn()) {
                if (
                    !triggerUrl.includes("api/logout") &&
                    !triggerUrl.includes("plugin/mrbeam/console")
                ) {
                    console.error(
                        "Server responded UNAUTHORIZED and loginStateViewModel is loggedIn. Error. Trying passive login..."
                    );
                    let pn_obj = {
                        id: "session_expired",
                        title: gettext("Session expired"),
                        text: gettext("Trying to do a re-login..."),
                        type: "warn",
                        hide: true,
                    };
                    mrbeam.updatePNotify(pn_obj);

                    // try passive login
                    self.loginState.requestData().always(function () {
                        if (self.loginState.loggedIn()) {
                            let pn_obj = {
                                id: "session_expired",
                                title: gettext("Session expired"),
                                text: gettext(
                                    "Re-login successful.<br/>Please repeat the last action."
                                ),
                                type: "warn",
                                hide: true,
                            };
                            mrbeam.updatePNotify(pn_obj);
                        } else {
                            let pn_obj = {
                                id: "session_expired",
                                title: gettext("Session expired"),
                                text: gettext("Please login again."),
                                type: "warn",
                                hide: true,
                            };
                            mrbeam.updatePNotify(pn_obj);
                        }
                        // Reconnect socket connection
                        OctoPrint.socket.reconnect();
                    });
                }
            } else {
                console.log(
                    "Server responded UNAUTHORIZED and loginStateViewModel is loggedOut. Consistent."
                );
            }
        };

        self.set_settings_analytics_links = function () {
            $(".settings_analytics_link").on("click", function (event) {
                // Prevent url change
                event.preventDefault();
                // Open the "Settings" menu
                $("#settings_tab_btn").tab("show");
                // Go to the "Analytics" tab
                $(
                    '[data-toggle="tab"][href="#settings_plugin_mrbeam_analytics"]'
                ).trigger("click");
            });
        };

        self.showBrowserWarning = function () {
            console.log(
                "Supported Browser: " + mrbeam.browser.is_supported,
                " - ",
                window.mrbeam.browser
            );
            if (!mrbeam.browser.is_supported) {
                new PNotify({
                    title: gettext("Browser not supported."),
                    text: _.sprintf(
                        gettext(
                            "Mr Beam makes use of latest web technologies which might not be fully supported by your browser.%(br)sPlease use the latest version of%(br)s%(open)sGoogle Chrome%(close)s for Mr Beam."
                        ),
                        {
                            br: "<br/>",
                            open:
                                "<a href='https://www.google.com/chrome/' target='_blank'>",
                            close: "</a>",
                        }
                    ),
                    type: "warn",
                    hide: false,
                });
            }
        };

        self.showBetaNotifications = function () {
            if (
                mrbeam.isBeta() &&
                !self.settings.settings.plugins.mrbeam.analyticsEnabled()
            ) {
                new PNotify({
                    title: gettext(
                        "Beta user: Please consider enabling Mr Beam analytics!"
                    ),
                    text: _.sprintf(
                        gettext(
                            "As you are currently in our Beta channel, you would help us " +
                                "tremendously sharing%(br)sthe laser job insights, so we can improve%(br)san overall experience " +
                                "working with the%(br)s Mr Beam. Thank you!%(br)s%(open)sGo to analytics settings%(close)s"
                        ),
                        {
                            open:
                                '<a href=\'#\' data-toggle="tab" id="beta_notification_analytics_link" class="settings_analytics_link" style="font-weight:bold">',
                            close: "</a>",
                            br: "<br>",
                        }
                    ),
                    type: "warn",
                    hide: false,
                });

                self.set_settings_analytics_links();
                $("#beta_notification_analytics_link").one("click", function (
                    event
                ) {
                    // Close notification
                    $('[title="Close"]')[0].click();
                });
            }
        };

        self.presetLoginUser = function () {
            if (MRBEAM_ENV_SUPPORT_MODE) {
                self.loginState.loginUser(
                    "support" + String.fromCharCode(0x0040) + "mr-beam.org"
                );
                self.loginState.loginPass("a");
            } else if (MRBEAM_ENV === "DEV") {
                self.loginState.loginUser(
                    "dev" + String.fromCharCode(0x0040) + "mr-beam.org"
                );
                self.loginState.loginPass("a");
            }
        };

        /**
         * MR_BEAM_OCTOPRINT_PRIVATE_API_ACCESS
         * Hides the option "Restart OctoPrint in safe mode"
         * Removes the 4th element from the system menu.
         */
        self.removeOpSafeModeOptionFromSystemMenu = function () {
            self.system.systemActions.remove(function (c) {
                return c.action === "restart_safe";
            });
        };

        // Backdrop Temporary Solution - start
        // Todo: should be removed once OctoPrint is updated
        const mutationTargetNode = document.body;
        const mutationConfig = {
            childList: true,
            attributes: false,
            characterData: false,
            subtree: false,
            attributeOldValue: false,
            characterDataOldValue: false,
        };
        const mutationCallback = function (mutationsList, observer) {
            for (let mutation of mutationsList) {
                if (mutation.type === "childList") {
                    (function ($) {
                        $.fn.inlineStyle = function (prop) {
                            return this.prop("style")[$.camelCase(prop)];
                        };
                    })(jQuery);
                    let modalElement = $(".modal-scrollable");
                    let backDrop = $(".modal-backdrop");
                    if (modalElement.length !== 0) {
                        modalElement.each(function () {
                            if (
                                !$(this)[0].hasChildNodes() &&
                                modalElement.length === 1
                            ) {
                                setTimeout(() => {
                                    if (
                                        !$(this)[0].hasChildNodes() &&
                                        modalElement.length === 1
                                    ) {
                                        $("body").removeClass("modal-open");
                                        backDrop.remove();
                                        $(this)[0].remove();
                                        console.warn(
                                            "mutationCallback: removed incomplete modal after 500ms"
                                        );
                                    }
                                }, 500);
                            } else if (
                                !$(this)[0].hasChildNodes() &&
                                modalElement.length > 1 &&
                                $(this).next().hasClass("modal-backdrop")
                            ) {
                                $(this).next().remove();
                                $(this)[0].remove();
                            } else if (
                                $(this)[0].hasChildNodes() &&
                                modalElement.length === 1 &&
                                $(this)
                                    .find(".modal.hide.fade")
                                    .inlineStyle("display") === "none"
                            ) {
                                setTimeout(() => {
                                    if (
                                        $(this)
                                            .find(".modal.hide.fade")
                                            .hasClass("modal") &&
                                        $(this)
                                            .find(".modal.hide.fade")
                                            .inlineStyle("display") === "none"
                                    ) {
                                        document.body.append(
                                            $(this).find(".modal.hide.fade")[0]
                                        );
                                    }
                                }, 500);
                            }
                        });
                    } else if (
                        modalElement.length === 0 &&
                        backDrop.length !== 0
                    ) {
                        backDrop.remove();
                    }
                }
            }
        };
        const observer = new MutationObserver(mutationCallback);
        observer.observe(mutationTargetNode, mutationConfig);
        // Backdrop Temporary Solution - end
    }

    // view model class, parameters for constructor, container to bind to
    OCTOPRINT_VIEWMODELS.push([
        MrbeamViewModel,

        // e.g. loginStateViewModel, settingsViewModel, ...
        [
            "settingsViewModel",
            "wizardAclViewModel",
            "accessViewModel",
            "loginStateViewModel",
            "systemViewModel",
        ],

        // e.g. #settings_plugin_mrbeam, #tab_plugin_mrbeam, ...
        [
            /* ... */
        ],
    ]);
});
