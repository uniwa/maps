showSpinner();
var map;
var urlParams = getUrlParams();

/**
 * The sidebar filter controls.
 *
 * `param`  - the query parameter the registry expects
 * `urlKey` - the corresponding key in urlParams.searchValues
 * `text`   - free-text input; anything else is a multi-select fed by `lookup`
 * `lookup` - the registry reference list the options come from
 */
var FILTERS = [
    { param: 'name',             urlKey: 'name',             selector: '#search_name',        text: true },
    { param: 'mm_id',            urlKey: 'mmID',             selector: '#search_mm_id',       text: true },
    { param: 'registry_no',      urlKey: 'registryNo',       selector: '#search_registry_no', text: true },
    { param: 'edu_admin',        urlKey: 'eduAdmins',        selector: '#edu_admin',        lookup: 'edu_admins' },
    { param: 'region_edu_admin', urlKey: 'regionEduAdmins',  selector: '#region_edu_admin', lookup: 'region_edu_admins' },
    { param: 'municipality',     urlKey: 'municipalities',   selector: '#municipality',     lookup: 'municipalities' },
    { param: 'unit_type',        urlKey: 'unitTypes',        selector: '#unit_type',        lookup: 'unit_types' },
    { param: 'orientation_type', urlKey: 'orientationTypes', selector: '#orientation_type', lookup: 'orientation_types' },
    { param: 'operation_shift',  urlKey: 'operationShifts',  selector: '#operation_shift',  lookup: 'operation_shifts' }
];

/* param -> multi-select instance, for the filters backed by a reference list */
var filterControls = {};

/* The features currently on the map, kept for proximity: whatever is loaded is
   what "nearest" means, so on a filtered view it is the nearest match. */
var loadedFeatures = [];

/* Where the visitor is, once they have asked. null until then. */
var located = null;

/* A location that arrived before the units did, to be answered once they land */
var pendingNearest = null;

function initFilters() {
    FILTERS.forEach(function (filter) {
        var value = urlParams.searchValues[filter.urlKey];

        if (filter.text) {
            var input = document.querySelector(filter.selector);
            if (input && value && value.length) {
                input.value = [].concat(value).join(',');
            }
            return;
        }

        var container = document.querySelector(filter.selector);
        if (!container) return;

        var control = MapsMultiSelect(container, {
            placeholder: 'Όλα',
            labelledBy: filter.param + '-label'
        });
        filterControls[filter.param] = control;

        /* Apply the URL's selection first, so a shared link shows its filters
           immediately rather than after nine lookup requests land. */
        if (value && value.length) {
            control.setValue(value);
        }

        MapsLookups.load(filter.lookup)
            .then(function (items) {
                control.setItems(items);
                if (value && value.length) {
                    control.setValue(value);
                }
            })
            .catch(function (err) {
                console.error('Could not load ' + filter.lookup, err);
                container.classList.add('ms-unavailable');
            });
    });
}

/**
 * Reads the sidebar controls and returns the active filters as a query string.
 * `encodeText` URL-encodes the free-text fields, which is what the shareable
 * link needs.
 */
function collectFilters(encodeText) {
    var params = [];
    FILTERS.forEach(function (filter) {
        var value;
        if (filter.text) {
            var input = document.querySelector(filter.selector);
            value = input ? input.value.trim() : '';
        } else {
            value = filterControls[filter.param] ? filterControls[filter.param].getValue() : null;
        }
        if (!value || value.length === 0) return;
        params.push(filter.param + '=' + (encodeText && filter.text ? encodeURI(value) : value));
    });
    return params.join('&');
}

/* Drop the current points and start a fresh layer */
function resetUnitsLayer() {
    markerClusters.removeLayer(units);
    units = L.geoJson(null, {
        pointToLayer: pointToLayer,
        onEachFeature: onEachFeature
    });
}

/* One result row, built as DOM so unit names need no escaping */
function featureRow(feature, distanceText) {
    var row = document.createElement('tr');
    row.className = 'feature-row';
    row.dataset.testid = 'feature-row';
    row.dataset.mmId = feature.properties.mmId;
    row.dataset.name = feature.properties.name;
    row.dataset.lat = feature.geometry.coordinates[1];
    row.dataset.lng = feature.geometry.coordinates[0];

    var iconCell = document.createElement('td');
    var icon = document.createElement('img');
    icon.width = 16;
    icon.height = 18;
    icon.alt = '';
    icon.src = 'assets/img/unit.png';
    iconCell.appendChild(icon);

    var nameCell = document.createElement('td');
    nameCell.className = 'feature-name';
    nameCell.textContent = feature.properties.name;

    if (distanceText) {
        var distance = document.createElement('span');
        distance.className = 'feature-distance';
        distance.textContent = distanceText;
        nameCell.appendChild(distance);
    }

    var chevronCell = document.createElement('td');
    chevronCell.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#i-chevron-right"></use></svg>';

    row.appendChild(iconCell);
    row.appendChild(nameCell);
    row.appendChild(chevronCell);
    return row;
}

/**
 * Fetches units from the registry and puts them on the map.
 *
 * `query`      - extra query string, without the leading '&'
 * `renderList` - also draw the sidebar result list
 */
function loadUnits(query, renderList) {
    var url = MapsConfig.baseMMUrl + 'units.geojson?state=1' + (query ? '&' + query : '');

    fetch(url)
        .then(function (response) { return response.json(); })
        .then(function (results) {
            if (!results || results.data == null) {
                throw new Error('unexpected response');
            }
            if (renderList) {
                var body = document.querySelector('#feature-list tbody');
                if (results.count === 0) {
                    var row = document.createElement('tr');
                    var cell = document.createElement('td');
                    cell.colSpan = 3;
                    var message = document.createElement('p');
                    message.className = 'rip';
                    message.dataset.testid = 'no-results';
                    message.textContent = 'Κανένα Αποτέλεσμα';
                    cell.appendChild(message);
                    row.appendChild(cell);
                    body.appendChild(row);
                } else {
                    var fragment = document.createDocumentFragment();
                    results.data.features.forEach(function (feature) {
                        fragment.appendChild(featureRow(feature));
                    });
                    body.appendChild(fragment);
                }
            }
            loadedFeatures = results.data.features || [];
            units.addData(results.data);
            markerClusters.addLayer(units);
            hideSpinner();

            /* A location that was waiting for these */
            if (pendingNearest) {
                showNearest(pendingNearest.lat, pendingNearest.lng, pendingNearest.accuracy);
            }
        })
        .catch(function (err) {
            console.error('MM api connection error - ' + url, err);
            hideSpinner();
        });
}

//----------------------Initial variables for map--------------------------------------------------------
/* Basemap Layers */
var baseMap = L.tileLayer(MapsConfig.tileUrl, {
    maxZoom: MapsConfig.tileMaxZoom,
    lang: 'el',
    attribution: MapsConfig.tileAttribution
});
/* Overlay Layers */
var highlight = L.geoJson(null);
var highlightStyle = {
  stroke: false,
  fillColor: "#800000",
  fillOpacity: 0.7,
  radius: 15
};
/* Single marker cluster layer to hold all clusters */
var markerClusters = new L.MarkerClusterGroup({
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: false,
    zoomToBoundsOnClick: true
});
/* Empty layer placeholder, swapped out whenever the filters change */
var units = L.geoJson(null, {
  pointToLayer: pointToLayer,
  onEachFeature: onEachFeature
});

map = L.map("map", {
    zoom: urlParams.zoom,
    center: [urlParams.lat, urlParams.lng],
    layers: [baseMap, markerClusters, highlight],
    zoomControl: false,
    attributionControl: false
});

var attributionControl = L.control({ position: "bottomright" });
attributionControl.onAdd = function () {
    var div = L.DomUtil.create("div", "leaflet-control-attribution");
    div.innerHTML = baseMap.getAttribution();
    return div;
};
map.addControl(attributionControl);
L.control.zoom({ position: "bottomright" }).addTo(map);

/* Where am I, and what is near me: the half of the navigation work that needs
   no routing provider. */
var youAreHere = L.layerGroup().addTo(map);

/* The embed has no sidebar to list results in, and does not load nearby.js */
var locateOptions = {
    onLocate: showNearest,
    onError: function (message) {
        var info = document.getElementById('units_info');
        if (info) info.textContent = message;
    }
};

if (!MapsConfig.embed) {
    MapsNearby.locateControl(locateOptions).addTo(map);
}

/**
 * Marks the visitor's position and lists the closest units to it.
 *
 * "Closest" means closest among the units currently loaded, so with a filter
 * applied it answers "the nearest ΓΥΜΝΑΣΙΟ" rather than the nearest anything.
 */
function showNearest(lat, lng, accuracy) {
    located = { lat: lat, lng: lng };

    youAreHere.clearLayers();
    L.circleMarker([lat, lng], {
        radius: 7,
        color: '#fff',
        weight: 2,
        fillColor: '#1a73e8',
        fillOpacity: 1
    }).addTo(youAreHere);
    if (accuracy && accuracy > 40) {
        L.circle([lat, lng], {
            radius: accuracy,
            color: '#1a73e8',
            weight: 1,
            fillColor: '#1a73e8',
            fillOpacity: 0.1
        }).addTo(youAreHere);
    }

    var info = document.getElementById('units_info');
    var body = document.querySelector('#feature-list tbody');

    /* On a plain visit the location can arrive before the units do -- the fix
       is instant, the 379 KB of units is not -- so hold the position and answer
       it once they land, rather than reporting nothing nearby. */
    if (loadedFeatures.length === 0) {
        pendingNearest = { lat: lat, lng: lng, accuracy: accuracy };
        info.textContent = 'Αναζήτηση κοντινών μονάδων…';
        return;
    }
    pendingNearest = null;

    var closest = MapsNearby.nearest(loadedFeatures, lat, lng, 15);
    if (closest.length === 0) {
        info.textContent = 'Δεν βρέθηκαν μονάδες κοντά σας.';
        return;
    }

    /* Deliberately not expanding the sidebar: the visitor asked where they were,
       not for the panel to be opened over the map they were looking at. The map
       moving to their area is the acknowledgement; a dot on the rail says the
       list is ready when they want it. */
    markRailNews();
    info.textContent = 'Κοντινότερες μονάδες στη θέση σας';

    body.replaceChildren();
    var fragment = document.createDocumentFragment();
    closest.forEach(function (hit) {
        fragment.appendChild(featureRow(hit.feature, MapsNearby.format(hit.metres)));
    });
    body.appendChild(fragment);

    /* Frame the visitor and the nearest handful, rather than jumping to a fixed
       zoom that might contain none of them. */
    map.fitBounds(L.latLngBounds(
        [[lat, lng]].concat(closest.slice(0, 5).map(function (hit) {
            return [hit.feature.geometry.coordinates[1], hit.feature.geometry.coordinates[0]];
        }))
    ), { padding: [60, 60], maxZoom: 15 });
}

//-----------------------------Wire up the interface----------------------------
document.addEventListener('DOMContentLoaded', function () {
    if (MapsConfig.embed) {
        return;
    }

    initFilters();

    var body = document.querySelector('#feature-list tbody');

    /* Result rows are added and removed constantly, so listen on the table */
    body.addEventListener('click', function (event) {
        var row = event.target.closest('.feature-row');
        if (!row) return;
        onUnitClick(row.dataset.mmId, {
            name: row.dataset.name,
            lat: row.dataset.lat,
            lng: row.dataset.lng
        });
    });

    if (!('ontouchstart' in window)) {
        body.addEventListener('mouseover', function (event) {
            var row = event.target.closest('.feature-row');
            if (!row) return;
            highlight.clearLayers().addLayer(
                L.circleMarker([row.dataset.lat, row.dataset.lng], highlightStyle)
            );
        });
        body.addEventListener('mouseout', clearHighlight);
    }

    document.getElementById('filters').addEventListener('submit', function (event) {
        event.preventDefault();
        applyFilters();
    });

    document.getElementById('filters').addEventListener('reset', function () {
        Object.keys(filterControls).forEach(function (param) {
            filterControls[param].clear();
        });
    });

    document.getElementById('panel-collapse').addEventListener('click', togglePanel);

    /* The rail carries search and the footer material, nothing else: opening
       straight into the filters was a confusing place to arrive. */
    document.getElementById('rail-search').addEventListener('click', function () {
        expandPanel();
        document.getElementById('search_name').focus();
    });
    /* The footer carries these, so opening the sidebar is what reveals them */
    document.getElementById('rail-menu').addEventListener('click', expandPanel);

    document.getElementById('about-btn').addEventListener('click', function () {
        openModal('aboutModal');
    });
    document.getElementById('legend-btn').addEventListener('click', function () {
        openModal('legendModal');
    });

    document.getElementById('geo-hint-action').addEventListener('click', function () {
        dismissGeoHint(true);
        /* Clicking the real control keeps one code path, and the browser still
           counts this as user-activated because it happens in this handler. */
        document.getElementById('locate-btn').click();
    });
    document.getElementById('geo-hint-close').addEventListener('click', function () {
        dismissGeoHint(true);
    });

    /* Finding the button unaided means the hint has done its job */
    var locateButton = document.getElementById('locate-btn');
    if (locateButton) {
        locateButton.addEventListener('click', function () { dismissGeoHint(true); });
    }

    document.getElementById('unit-panel-close').addEventListener('click', closeUnitPanel);
    document.getElementById('unit-panel-share').addEventListener('click', shareUnit);

    /* Escape closes the details panel, matching the dialogs' behaviour */
    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') {
            closeUnitPanel();
        }
    });

    /* Search-as-you-type: picking a suggestion goes straight to that unit */
    MapsSearch({
        onPick: function (item) {
            onUnitClick(item.mmId, item);
        }
    });

    /* A name typed into the search box is still a filter, so open the
       disclosure when the URL carried one of the other eight. */
    var advanced = document.getElementById('advanced-filters');
    var hasAdvanced = FILTERS.some(function (filter) {
        if (filter.param === 'name') return false;
        var value = urlParams.searchValues[filter.urlKey];
        return value && value.length;
    });
    if (advanced && hasAdvanced) {
        advanced.open = true;
    }

    //-----------------------------Show markers to map---------------------------
    var initialQuery = urlParams.urlValues.join('&');
    var sharedUnit = urlParams.unit;

    /* Start narrowed to the rail, so the map leads. A link carrying filters or a
       unit is the exception: 87% of real visits arrive that way, and they arrive
       to see results -- landing them on a bare rail would hide the very thing
       the link was shared for. */
    setPanelCollapsed(initialQuery === '' && sharedUnit === '');

    if (initialQuery === '') {
        loadUnits('', false);

        /* Nothing specific was asked for, so show what is nearby -- but only
           for visitors who have already granted the permission. A cold prompt
           on load is not worth what it costs; anyone who has never been asked
           gets the hint below instead. */
        if (sharedUnit === '') {
            MapsNearby.locateIfPermitted(locateOptions);
            maybeShowGeoHint();
        }
    } else {
        body.replaceChildren();
        resetUnitsLayer();
        map.setView([urlParams.lat, urlParams.lng], urlParams.zoom);
        loadUnits(initialQuery, true);
    }

    /* A link to a particular unit opens its card, without waiting for the
       379 KB of points: the two requests run alongside each other. */
    if (sharedUnit !== '') {
        onUnitClick(sharedUnit, null);
    }
});

/* The embedded map has no sidebar, so it renders no result list. It does have
   the details panel, which needs its close button and Escape wired up. */
if (MapsConfig.embed) {
    document.addEventListener('DOMContentLoaded', function () {
        var close = document.getElementById('unit-panel-close');
        if (close) close.addEventListener('click', closeUnitPanel);
        document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape') closeUnitPanel();
        });
        /* An embed can be pointed at one unit's card too, which is how a school
           site shows its own entry */
        if (urlParams.unit !== '') {
            onUnitClick(urlParams.unit, null);
        }
    });
    loadUnits(urlParams.urlValues.join('&'), false);
}

function applyFilters() {
    clearHighlight();
    /* A new search is not the old unit's card, and the URL is about to lose the
       selection anyway */
    closeUnitPanel();
    window.history.pushState({}, document.title, MapsConfig.baseNewUrl);
    showSpinner();

    document.querySelector('#feature-list tbody').replaceChildren();
    document.getElementById('units_info').replaceChildren();
    resetUnitsLayer();
    map.setView([MapsConfig.latGR, MapsConfig.lngGR], MapsConfig.zoomGR);
    loadUnits(collectFilters(false), true);
}

/**
 * Flags the rail's search icon when results have arrived while the sidebar is
 * narrowed, so something changed silently rather than being thrown in the way.
 * Cleared as soon as the sidebar is opened.
 */
function markRailNews() {
    var container = document.getElementById('container');
    var button = document.getElementById('rail-search');
    if (!container || !button) return;
    if (container.classList.contains('panel-collapsed')) {
        button.classList.add('has-news');
    }
}

var GEO_HINT_KEY = 'maps.geoHint.dismissed';

/**
 * Offers the locate control to someone who has never been asked for the
 * permission — a dismissible bubble pointing at the button, rather than a modal
 * across the map or a prompt fired before the visitor knows what this is.
 */
function maybeShowGeoHint() {
    var hint = document.getElementById('geo-hint');
    if (!hint) return;

    try {
        if (window.localStorage.getItem(GEO_HINT_KEY)) return;
    } catch (err) {
        /* Private browsing: showing it every time is better than never */
    }

    function show() {
        hint.hidden = false;
        var control = document.querySelector('.locate-control');
        if (control) control.classList.add('is-hinted');
    }

    if (!navigator.permissions || !navigator.permissions.query) {
        show();
        return;
    }
    navigator.permissions.query({ name: 'geolocation' })
        .then(function (status) {
            /* Already granted locates by itself; already denied has made its
               choice. Only 'prompt' is worth a nudge. */
            if (status.state === 'prompt') show();
        })
        .catch(show);
}

function dismissGeoHint(remember) {
    var hint = document.getElementById('geo-hint');
    if (hint) hint.hidden = true;
    var control = document.querySelector('.locate-control');
    if (control) control.classList.remove('is-hinted');
    if (remember) {
        try { window.localStorage.setItem(GEO_HINT_KEY, '1'); } catch (err) { /* ignore */ }
    }
}

/**
 * A click on open map puts the sidebar away, which closes any open details with
 * it. One tap, not two: needing a second one to finish the job was worse than
 * the small collapse tab it was meant to make up for.
 */
map.on("click", function () {
    highlight.clearLayers();
    if (!MapsConfig.embed) {
        setPanelCollapsed(true);
    }
});

/**
 * Builds one labelled read-only field with a copy button.
 * Replaces clipboard.js, which needed the value to live in the DOM first so
 * it could be selected by id.
 */
function shareField(label, value) {
    var wrapper = document.createElement('div');
    wrapper.className = 'share-field';

    var caption = document.createElement('label');
    caption.textContent = label;

    var input = document.createElement('input');
    input.type = 'text';
    input.readOnly = true;
    input.value = value;
    input.addEventListener('focus', function () { input.select(); });

    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn';
    button.title = 'Αντιγραφή στο πρόχειρο';
    button.innerHTML = '<img src="assets/img/clippy-16.svg" alt="Αντιγραφή στο πρόχειρο">';
    button.addEventListener('click', function () {
        copyText(value).then(function (ok) {
            button.title = ok ? 'Επιτυχία Αντιγραφής' : 'Αποτυχία Αντιγραφής';
            setTimeout(function () { button.title = 'Αντιγραφή στο πρόχειρο'; }, 1500);
        });
    });

    caption.appendChild(input);
    wrapper.appendChild(caption);
    wrapper.appendChild(button);
    return wrapper;
}

/**
 * Hands out a link to the open unit.
 *
 * The address bar already carries it, but nobody selects a URL out of the
 * address bar on a phone -- and two thirds of the traffic is phones. So: the
 * device's own share sheet where there is one, a copied link where there is not.
 */
function shareUnit() {
    if (!selectedUnit) return;
    var url = MapsConfig.baseHrefUrl + '?unit=' + encodeURIComponent(selectedUnit.mmId);

    /* A pointer that cannot hover is the honest test for "this is a phone".
       navigator.share on its own is also true in desktop Chrome, where a copied
       link is the more useful answer. */
    if (navigator.share && window.matchMedia('(hover: none)').matches) {
        navigator.share({ title: selectedUnit.name || document.title, url: url })
            .catch(function () { /* dismissing the sheet is not a failure */ });
        return;
    }

    copyText(url).then(function (ok) {
        showShareNote(ok
            ? 'Ο σύνδεσμος αντιγράφηκε'
            : 'Δεν ήταν δυνατή η αντιγραφή του συνδέσμου.');
    });
}

var shareNoteTimer = null;

function showShareNote(message) {
    var note = document.getElementById('unit-share-note');
    if (!note) return;
    note.textContent = message;
    note.hidden = false;
    if (shareNoteTimer) window.clearTimeout(shareNoteTimer);
    shareNoteTimer = window.setTimeout(function () { note.hidden = true; }, 3000);
}

/* navigator.clipboard needs a secure context, so keep a fallback for plain
   http, which is how a dev instance is usually served. */
function copyText(value) {
    if (navigator.clipboard && window.isSecureContext) {
        return navigator.clipboard.writeText(value)
            .then(function () { return true; })
            .catch(function () { return false; });
    }
    var scratch = document.createElement('textarea');
    scratch.value = value;
    scratch.setAttribute('readonly', '');
    scratch.style.position = 'fixed';
    scratch.style.opacity = '0';
    document.body.appendChild(scratch);
    scratch.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
    document.body.removeChild(scratch);
    return Promise.resolve(ok);
}

//create href with right click. The embedded map has no share controls.
if (!MapsConfig.embed) {
map.on('contextmenu', function (e) {
    var filters = collectFilters(true);
    var searchParamsFormat = filters ? '&' + filters : '';

    var urlCustom = MapsConfig.baseHrefUrl +
        '?zoom=' + e.target.getZoom() +
        '&lat=' + e.latlng.lat.toFixed(6) +
        '&lng=' + e.latlng.lng.toFixed(6) +
        searchParamsFormat;
    var urlEmbedCustom = MapsConfig.baseEmbedHrefUrl +
        '?zoom=' + e.target.getZoom() +
        '&lat=' + e.latlng.lat.toFixed(6) +
        '&lng=' + e.latlng.lng.toFixed(6) +
        searchParamsFormat;
    var iframeLarge = '<iframe src="' + urlEmbedCustom + '" width="800" height="600" frameborder="0" scrolling="no"></iframe>';

    var share = document.createElement('div');
    share.className = 'share-popup';
    share.appendChild(shareField('Αντιγραφή Συνδέσμου', urlCustom));
    share.appendChild(shareField('Αντιγραφή Iframe', iframeLarge));

    var hint = document.createElement('p');
    hint.className = 'share-hint';
    hint.innerHTML = 'Για τα blogs.sch.gr και schoolpress.sch.gr απλώς<br>αντιγράψτε και επικολλήστε τον Σύνδεσμο μέσα στο άρθρο σας.';
    share.appendChild(hint);

    L.popup()
        .setLatLng(e.latlng)
        .setContent(share)
        .addTo(map)
        .openOn(map);
});
}
