/**
 * Central configuration for maps.sch.gr.
 *
 * Everything environment-specific lives here, so a dev or staging instance
 * differs from production by configuration rather than by patched code.
 *
 * To override, define window.MapsConfigOverride before this file is loaded:
 *
 *   <script>window.MapsConfigOverride = { baseMMUrl: 'https://mm.example/api/' };</script>
 */
var MapsConfig = (function () {
    var origin = window.location.origin ||
        (window.location.protocol + '//' + window.location.host);

    var attributionOSM = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors';

    var config = {
        /* Registry (MM) endpoints */
        baseMMUrl : 'https://mm.sch.gr/api/',
        mmSiteUrl : 'https://mm.sch.gr/',

        /* Our own URLs, used for the shareable link and the iframe snippet.
           Derived from the current origin so a staging instance links to itself. */
        baseHrefUrl : origin + '/main.html',
        baseEmbedHrefUrl : origin + '/embed.html',
        baseNewUrl : 'main.html',

        /* Initial view: the whole of Greece */
        latGR : '38.1',
        lngGR : '24.2',
        zoomGR : '7',

        /* Basemap */
        tileUrl : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png?lang=el',
        tileMaxZoom : 19,
        tileAttribution : attributionOSM,
        /* The embedded map carries a link back to us, since it is shown on other sites */
        embedAttribution : '<a href="' + origin + '" target="_blank">Χάρτης Μονάδων ΠΣΔ</a><br>' + attributionOSM,

        /* Set by embed.html. Disables the sidebar, filters and share controls. */
        embed : false,

        /* Whether the unit popup also lists the unit's websites.
           Costs one extra request to the registry per unit opened. */
        showUnitSites : true
    };

    var overrides = window.MapsConfigOverride || {};
    for (var key in overrides) {
        if (Object.prototype.hasOwnProperty.call(overrides, key)) {
            config[key] = overrides[key];
        }
    }

    /* The embedded map carries the link back to us, unless told otherwise */
    if (config.embed && !overrides.tileAttribution) {
        config.tileAttribution = config.embedAttribution;
    }

    return config;
})();
