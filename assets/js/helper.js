//---------------------Spinner functions---------------------
/* A CSS overlay, styled in app.css. Replaces spin.js, which drew the same
   thing with a canvas and 60 lines of inline styles. */
function showSpinner() {
    var overlay = document.getElementById('spinner');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'spinner';
        overlay.className = 'spinner-overlay';
        overlay.setAttribute('role', 'status');
        overlay.setAttribute('aria-label', 'Φόρτωση');
        overlay.innerHTML = '<div class="spinner-dial"></div>';
        document.body.appendChild(overlay);
    }
    overlay.hidden = false;
}

function hideSpinner() {
    var overlay = document.getElementById('spinner');
    if (overlay) {
        overlay.hidden = true;
    }
}

//---------------------Get url functions---------------------
function getUrlParam(parameter, defaultvalue) {
    var value = new URLSearchParams(window.location.search).get(parameter);
    return (value === null || value === '') ? defaultvalue : value;
}

function getUrlParams()
{
    /* The registry expects the same parameter names the URL uses, so values
       are passed through rather than translated. */
    var FIELDS = [
        { param: 'name',             key: 'name',             numeric: false },
        { param: 'mm_id',            key: 'mmID',             numeric: false },
        { param: 'registry_no',      key: 'registryNo',       numeric: false },
        { param: 'edu_admin',        key: 'eduAdmins',        numeric: true },
        { param: 'region_edu_admin', key: 'regionEduAdmins',  numeric: true },
        { param: 'municipality',     key: 'municipalities',   numeric: true },
        { param: 'unit_type',        key: 'unitTypes',        numeric: true },
        { param: 'orientation_type', key: 'orientationTypes', numeric: true },
        { param: 'operation_shift',  key: 'operationShifts',  numeric: true }
    ];

    var arrValues = [];
    var searchValues = {};

    FIELDS.forEach(function (field) {
        var raw = getUrlParam(field.param, '');
        if (raw === '' || raw === undefined) {
            searchValues[field.key] = '';
            return;
        }
        arrValues.push(field.param + '=' + encodeURIComponent(raw));
        searchValues[field.key] = field.numeric
            ? raw.split(',').map(function (item) { return parseInt(item, 10); })
            : raw.split(',');
    });

    return {
        urlValues: arrValues,
        searchValues: searchValues,
        /* The open unit. Deliberately not part of urlValues: it is a selection,
           not a filter, so it is never sent to the registry. */
        unit: getUrlParam('unit', ''),
        zoom: getUrlParam('zoom', MapsConfig.zoomGR),
        lat: getUrlParam('lat', MapsConfig.latGR),
        lng: getUrlParam('lng', MapsConfig.lngGR)
    };
}

//---------------------The open unit, in the address bar---------------------
/* Which unit's details are showing, so the share button knows what it is
   pointing at. null when the panel is closed. */
var selectedUnit = null;

/**
 * Reflects the open unit in the address bar, so the URL in front of the visitor
 * is the one worth copying.
 *
 * `unit` rather than the registry's `mm_id`: mm_id is a filter, and every
 * existing link and embed URL means it that way. A selection composes with
 * filters instead of replacing them, so whatever else the URL carries — filters,
 * position, zoom — is left alone.
 *
 * replaceState, not pushState: the address bar tracks what is on screen, and
 * looking at a dozen units on the way somewhere should not leave a dozen entries
 * for the back button to walk out through.
 */
function setUnitInUrl(mmId) {
    /* An iframe's own URL is not shareable, and rewriting it would be invisible */
    if (MapsConfig.embed) return;
    var params = new URLSearchParams(window.location.search);
    if (params.get('unit') === String(mmId)) return;
    params.set('unit', mmId);
    replaceUrlParams(params);
}

function clearUnitInUrl() {
    if (MapsConfig.embed) return;
    var params = new URLSearchParams(window.location.search);
    if (!params.has('unit')) return;
    params.delete('unit');
    replaceUrlParams(params);
}

function replaceUrlParams(params) {
    var query = params.toString();
    /* The current path, rather than a rebuilt one: whether the visitor arrived
       at main.html or at the directory index is their business. */
    window.history.replaceState({}, document.title,
        window.location.pathname + (query ? '?' + query : ''));
}

//---------------------General functions---------------------
/**
 * Narrows the sidebar to its icon rail, or opens it out again.
 *
 * The state lives on the container so both the rail and the tab can respond to
 * it. Collapsed leaves the rail behind rather than hiding the sidebar: there is
 * always something on screen identifying the service and offering a way back.
 */
function setPanelCollapsed(collapsed)
{
    var container = document.getElementById('container');
    var toggle = document.getElementById('panel-collapse');
    if (!container) return;

    container.classList.toggle('panel-collapsed', collapsed);

    if (collapsed) {
        /* Details are the sidebar's content, so collapsing closes them. Left
           open they were squeezed into the width of the rail. */
        closeUnitPanel();
    } else {
        /* Opening the sidebar is seeing whatever the dot was about */
        if (toggle) toggle.classList.remove('has-news');
    }
    if (toggle) {
        toggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
        toggle.querySelector('.sr-only').textContent = collapsed
            ? 'Άνοιγμα πλαϊνής στήλης'
            : 'Σύμπτυξη πλαϊνής στήλης';
    }
    if (typeof map !== 'undefined' && map) {
        map.invalidateSize();
    }
}

function togglePanel()
{
    var container = document.getElementById('container');
    setPanelCollapsed(!container.classList.contains('panel-collapsed'));
}

/** Opens the sidebar if it is currently narrowed to the rail. */
function expandPanel()
{
    setPanelCollapsed(false);
}

function clearHighlight() {
    highlight.clearLayers();
}

function pointToLayer (feature, latlng) {
    return L.marker(latlng, {
        icon: L.icon({
            iconUrl: "assets/img/unit.png",
            iconSize: [24, 28],
            iconAnchor: [12, 28],
            popupAnchor: [0, -25]
        }),
        title: feature.properties.name,
        riseOnHover: true
    });
}

function onEachFeature(feature,layer) {
    if (feature.properties) {
        layer.on({
            click: function() {
                return onUnitClick(feature.properties.mmId, {
                    name: feature.properties.name,
                    lat: feature.geometry.coordinates[1],
                    lng: feature.geometry.coordinates[0]
                });
            }
        });
    }
}

/**
 * Opens the details straight away, with whatever is already known, and fills the
 * rest in when the registry answers.
 *
 * The name and position come from the point that was clicked, so the panel and
 * the map move immediately. Waiting for the fetch first meant a click did
 * nothing visible for a few hundred milliseconds.
 */
function showUnitLoading(preview) {
    var title = document.getElementById('feature-title');
    var info = document.getElementById('feature-info');
    if (!title || !info) return;

    title.textContent = (preview && preview.name) ? preview.name : 'Φόρτωση…';

    /* A new selection, so any "link copied" message from the last one is stale */
    var note = document.getElementById('unit-share-note');
    if (note) note.hidden = true;

    var loading = document.createElement('p');
    loading.className = 'unit-loading';
    loading.dataset.testid = 'unit-loading';
    loading.setAttribute('role', 'status');
    loading.innerHTML = '<span class="unit-loading-dial"></span>';
    loading.appendChild(document.createTextNode('Φόρτωση στοιχείων…'));
    info.replaceChildren(loading);

    openUnitPanel();

    if (preview && isFinite(preview.lat) && isFinite(preview.lng)) {
        map.setView([Number(preview.lat), Number(preview.lng)], 18);
        highlight.clearLayers().addLayer(
            L.circleMarker([Number(preview.lat), Number(preview.lng)], highlightStyle)
        );
    }
}

function showUnitError() {
    var info = document.getElementById('feature-info');
    if (!info) return;
    var message = document.createElement('p');
    message.className = 'unit-loading';
    message.dataset.testid = 'unit-error';
    message.textContent = 'Δεν ήταν δυνατή η φόρτωση των στοιχείων.';
    info.replaceChildren(message);
}

function onUnitClick(mmId, preview) {
    selectedUnit = { mmId: mmId, name: (preview && preview.name) || '' };
    setUnitInUrl(mmId);
    showUnitLoading(preview);

    fetch(MapsConfig.baseMMUrl + 'units?mm_id=' + encodeURIComponent(mmId))
        .then(function (response) { return response.json(); })
        .then(function (results) {
            if (!results || !results.data || !results.data[0]) {
                throw new Error('no unit in response');
            }
            var unitData = results.data[0];

            if (!MapsConfig.showUnitSites) {
                showUnitModal(unitData, null);
                return null;
            }
            /* Websites come from a separate endpoint. Show the popup either
               way, rather than swallowing it when that request fails. */
            return fetch(MapsConfig.mmSiteUrl + 'client/views/sch_sites_export.php?mm_id=' + encodeURIComponent(unitData.mm_id))
                .then(function (response) { return response.json(); })
                .catch(function () { return null; })
                .then(function (sites) { showUnitModal(unitData, sites); });
        })
        .catch(function (err) {
            console.error('MM api connection error - Unit Info', err);
            showUnitError();
        });
}

/* One row of the unit table. `value` may be a string or a node. Building this
   as DOM rather than concatenated HTML removes the escaping question entirely. */
function unitRow(label, value) {
    var tr = document.createElement('tr');
    var th = document.createElement('th');
    th.textContent = label;
    var td = document.createElement('td');
    if (value instanceof Node) {
        td.appendChild(value);
    } else {
        td.textContent = value == null ? '' : String(value);
    }
    tr.appendChild(th);
    tr.appendChild(td);
    return tr;
}

function unitLink(href, text) {
    var link = document.createElement('a');
    link.className = 'url-break';
    link.href = href;
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = text;
    return link;
}

function showUnitModal(unitData, sites) {
    var latitude = unitData.latitude ?? 0;
    var longitude = unitData.longitude ?? 0;

    var table = document.createElement('table');
    table.className = 'unit-table';
    var body = document.createElement('tbody');
    table.appendChild(body);

    /* The name is the panel's heading, so repeating it as a row is noise */
    body.appendChild(unitRow('Κωδικός ΜΜ', unitLink(
        MapsConfig.mmSiteUrl + 'main.php?auth=0&mm_id=' + encodeURIComponent(unitData.mm_id),
        unitData.mm_id)));
    body.appendChild(unitRow('Κωδικός Υπουργείου', unitData.registry_no ?? ''));
    body.appendChild(unitRow('Διεύθυνση Εκπαίδευσης', unitData.edu_admin ?? ''));
    body.appendChild(unitRow('Περιφέρεια Εκπαίδευσης', unitData.region_edu_admin ?? ''));
    body.appendChild(unitRow('Δήμος', unitData.municipality ?? ''));
    body.appendChild(unitRow('Τύπος Μονάδας', unitData.unit_type ?? ''));
    body.appendChild(unitRow('Προσανατολισμός', unitData.orientation_type ?? ''));

    if (sites != null) {
        var siteList = document.createElement('span');
        var rows = (sites.data && sites.data.sites) ? sites.data.sites : [];
        if (rows.length === 0) {
            siteList.textContent = '-';
        } else {
            rows.forEach(function (site, index) {
                if (index > 0) siteList.appendChild(document.createElement('br'));
                siteList.appendChild(unitLink('https://' + site.url, site.url));
            });
        }
        body.appendChild(unitRow('Ιστότοποι', siteList));
    }

    body.appendChild(unitRow('Ωράριο Λειτουργίας', unitData.operation_shift ?? ''));
    body.appendChild(unitRow('Διεύθυνση', unitData.street_address ?? ''));
    body.appendChild(unitRow('Τ.Κ.', unitData.postal_code ?? ''));
    body.appendChild(unitRow('Τηλέφωνο', unitData.phone_number ?? ''));
    body.appendChild(unitRow('Fax', unitData.fax_number ?? ''));
    body.appendChild(unitRow('Email', unitData.email ?? ''));

    /* No distance row here: the results list already carries the distance on
       every row, and repeating it in the card only added a line of small print
       to the bottom of a table nobody scrolls that far down. */

    selectedUnit = { mmId: unitData.mm_id, name: unitData.name };
    document.getElementById('feature-title').textContent = unitData.name;
    var info = document.getElementById('feature-info');
    info.replaceChildren(table);

    openUnitPanel();

    map.setView([latitude, longitude], 18);
    highlight.clearLayers().addLayer(
        L.circleMarker([latitude, longitude], highlightStyle)
    );

}

/**
 * Unit details live in a panel rather than a dialog, so the map stays visible
 * and the pin you just clicked keeps its context. A modal covered the very
 * thing the visitor was looking at.
 */
function openUnitPanel() {
    var panel = document.getElementById('unit-panel');
    if (!panel) return;
    /* The details are the sidebar's content now, so it has to be open */
    if (typeof expandPanel === 'function') expandPanel();
    panel.hidden = false;
    /* Next frame, so the transition runs from the off-screen position */
    window.requestAnimationFrame(function () {
        panel.classList.add('is-open');
    });
    document.getElementById('feature-title').focus();
}

function closeUnitPanel() {
    var panel = document.getElementById('unit-panel');
    if (!panel || panel.hidden) return;
    panel.classList.remove('is-open');
    panel.hidden = true;
    selectedUnit = null;
    clearUnitInUrl();
    clearHighlight();
}

/* <dialog> replaces the Bootstrap modal for the informational popups. Closing
   is handled by the method="dialog" forms in the markup, and Escape is free. */
function openModal(id) {
    var dialog = document.getElementById(id);
    if (!dialog) return;
    if (typeof dialog.showModal === 'function') {
        dialog.showModal();
    } else {
        dialog.setAttribute('open', '');
    }
}
