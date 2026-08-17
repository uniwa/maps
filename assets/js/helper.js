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
        zoom: getUrlParam('zoom', MapsConfig.zoomGR),
        lat: getUrlParam('lat', MapsConfig.latGR),
        lng: getUrlParam('lng', MapsConfig.lngGR)
    };
}

//---------------------General functions---------------------
/**
 * Collapses the panel down to its search bar, and back.
 *
 * The control lives in the bar, which never hides, so the panel can always be
 * brought back. The previous collapse button sat inside the part that got
 * hidden, leaving no visible way to reopen it.
 */
function togglePanel()
{
    var panel = document.getElementById('panel');
    var toggle = document.getElementById('panel-collapse');
    if (!panel) return;

    var collapsed = panel.classList.toggle('is-collapsed');
    if (toggle) {
        toggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
        toggle.querySelector('.sr-only').textContent = collapsed
            ? 'Εμφάνιση αποτελεσμάτων'
            : 'Απόκρυψη αποτελεσμάτων';
    }
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
                var APIEndpoint = MapsConfig.baseMMUrl + 'units?mm_id=' + feature.properties.mmId;
                return onUnitClick(APIEndpoint);
            }
        });
    }
}

function onUnitClick(APIEndpoint) {
    fetch(APIEndpoint)
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

    document.getElementById('feature-title').textContent = unitData.name;
    var info = document.getElementById('feature-info');
    info.replaceChildren(table);

    openUnitPanel();

    map.setView([latitude, longitude], 18);
    highlight.clearLayers().addLayer(
        L.circleMarker([latitude, longitude], highlightStyle)
    );
    keepUnitInView();

    /* On a narrow screen the details sheet takes over the lower half, so fold
       the search panel down to its bar and leave the map legible. */
    var panel = document.getElementById('panel');
    if (panel && !window.matchMedia('(min-width: 900px)').matches &&
        !panel.classList.contains('is-collapsed')) {
        togglePanel();
    }
}

/**
 * Unit details live in a panel rather than a dialog, so the map stays visible
 * and the pin you just clicked keeps its context. A modal covered the very
 * thing the visitor was looking at.
 */
function openUnitPanel() {
    var panel = document.getElementById('unit-panel');
    if (!panel) return;
    panel.hidden = false;
    /* Next frame, so the transition runs from the off-screen position */
    window.requestAnimationFrame(function () {
        panel.classList.add('is-open');
    });
    document.getElementById('feature-title').focus();
}

/**
 * On a phone the details sheet covers the lower half of the map, which is
 * exactly where setView just put the unit. Shift the view up so the pin sits
 * in the part still visible, the way map apps do when a card opens.
 */
function keepUnitInView() {
    var panel = document.getElementById('unit-panel');
    if (!panel || panel.hidden) return;
    if (window.matchMedia('(min-width: 900px)').matches) return;

    window.requestAnimationFrame(function () {
        var covered = panel.getBoundingClientRect().height;
        if (covered > 0) {
            map.panBy([0, covered / 2], { animate: false });
        }
    });
}

function closeUnitPanel() {
    var panel = document.getElementById('unit-panel');
    if (!panel || panel.hidden) return;
    panel.classList.remove('is-open');
    panel.hidden = true;
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
