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
function featureRow(feature) {
    var row = document.createElement('tr');
    row.className = 'feature-row';
    row.dataset.testid = 'feature-row';
    row.dataset.mmId = feature.properties.mmId;
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
            units.addData(results.data);
            markerClusters.addLayer(units);
            hideSpinner();
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

//-----------------------------Wire up the interface----------------------------
document.addEventListener('DOMContentLoaded', function () {
    if (MapsConfig.embed) {
        return;
    }

    initFilters();

    var container = document.getElementById('container');
    var sidebar = document.getElementById('sidebar');
    var body = document.querySelector('#feature-list tbody');

    /* Result rows are added and removed constantly, so listen on the table */
    body.addEventListener('click', function (event) {
        var row = event.target.closest('.feature-row');
        if (!row) return;
        onUnitClick(MapsConfig.baseMMUrl + 'units?mm_id=' + row.dataset.mmId);
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

    document.getElementById('sidebar-hide-btn').addEventListener('click', animateSidebar);
    document.getElementById('sidebar-toggle-btn').addEventListener('click', animateSidebar);
    document.getElementById('list-btn').addEventListener('click', animateSidebar);

    var navToggle = document.getElementById('nav-btn');
    var nav = document.getElementById('site-nav');
    navToggle.addEventListener('click', function () {
        var open = nav.classList.toggle('is-open');
        navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    document.getElementById('about-btn').addEventListener('click', function () {
        nav.classList.remove('is-open');
        openModal('aboutModal');
    });
    document.getElementById('legend-btn').addEventListener('click', function () {
        nav.classList.remove('is-open');
        openModal('legendModal');
    });

    document.getElementById('unit-panel-close').addEventListener('click', closeUnitPanel);

    /* Escape closes the details panel, matching the dialogs' behaviour */
    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') {
            closeUnitPanel();
        }
    });

    /* Search-as-you-type: picking a suggestion goes straight to that unit */
    MapsSearch({
        onPick: function (item) {
            map.setView([item.lat, item.lng], 17);
            onUnitClick(MapsConfig.baseMMUrl + 'units?mm_id=' + item.mmId);
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
    if (initialQuery === '') {
        loadUnits('', false);
    } else {
        body.replaceChildren();
        resetUnitsLayer();
        map.setView([urlParams.lat, urlParams.lng], urlParams.zoom);
        loadUnits(initialQuery, true);
        /* A shared link arrives with filters, so show the results rather than
           making the visitor find the search button. */
        if (!window.matchMedia('(min-width: 900px)').matches) {
            sidebar.classList.add('is-open');
            document.getElementById('sidebar-toggle-btn').setAttribute('aria-expanded', 'true');
        }
    }

    void container;
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
    });
    loadUnits(urlParams.urlValues.join('&'), false);
}

function applyFilters() {
    clearHighlight();
    window.history.pushState({}, document.title, MapsConfig.baseNewUrl);
    showSpinner();

    document.querySelector('#feature-list tbody').replaceChildren();
    document.getElementById('units_info').replaceChildren();
    resetUnitsLayer();
    map.setView([MapsConfig.latGR, MapsConfig.lngGR], MapsConfig.zoomGR);
    loadUnits(collectFilters(false), true);
}

//Clear feature highlight when map is clicked
map.on("click", function() {
    highlight.clearLayers();
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
