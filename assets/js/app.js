showSpinner();
var map;
var urlParams = getUrlParams();

/**
 * The sidebar filter controls.
 *
 * `param`  - the query parameter the registry expects
 * `urlKey` - the corresponding key in urlParams.searchValues
 * `text`   - free-text input rather than a select2 dropdown
 */
var FILTERS = [
    { param: 'name',             urlKey: 'name',             selector: '.form-control.search_name',        text: true },
    { param: 'mm_id',            urlKey: 'mmID',             selector: '.form-control.search_mm_id',       text: true },
    { param: 'registry_no',      urlKey: 'registryNo',       selector: '.form-control.search_registry_no', text: true },
    { param: 'edu_admin',        urlKey: 'eduAdmins',        selector: '#edu_admin' },
    { param: 'region_edu_admin', urlKey: 'regionEduAdmins',  selector: '#region_edu_admin' },
    { param: 'municipality',     urlKey: 'municipalities',   selector: '#municipality' },
    { param: 'unit_type',        urlKey: 'unitTypes',        selector: '#unit_type' },
    { param: 'orientation_type', urlKey: 'orientationTypes', selector: '#orientation_type' },
    { param: 'operation_shift',  urlKey: 'operationShifts',  selector: '#operation_shift' }
];

$(document).ready(function() {
    if (MapsConfig.embed) {
        return;
    }
    FILTERS.forEach(function (filter) {
        if (!filter.text) {
            $(filter.selector).select2({
                placeholder: '',
                sorter: function (data) {
                    return data.sort(function (a, b) {
                        return a.text.localeCompare(b.text);
                    });
                }
            });
        }
        var value = urlParams.searchValues[filter.urlKey];
        if (value && value.length) {
            $(filter.selector).val(value).trigger('change');
        }
    });
});

/**
 * Reads the sidebar controls and returns the active filters as a query string.
 * `encodeText` URL-encodes the free-text fields, which is what the shareable
 * link needs.
 */
function collectFilters(encodeText) {
    var params = [];
    FILTERS.forEach(function (filter) {
        var value = $(filter.selector).val();
        if (!value || value.length === 0) {
            return;
        }
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

function featureRow(feature) {
    return '<tr class="feature-row" data-testid="feature-row"' +
        ' mm_id="' + feature.properties.mmId + '"' +
        ' name_sch="' + sanitization(feature.properties.name) + '"' +
        ' lat="' + feature.geometry.coordinates[1] + '"' +
        ' lng="' + feature.geometry.coordinates[0] + '">' +
        '<td style="vertical-align: middle;"><img width="16" height="18" src="assets/img/unit.png"></td>' +
        '<td class="feature-name">' + sanitization(feature.properties.name) + '</td>' +
        '<td style="vertical-align: middle;"><i class="fa fa-chevron-right pull-right"></i></td>' +
        '</tr>';
}

/**
 * Fetches units from the registry and puts them on the map.
 *
 * `query`      - extra query string, without the leading '&'
 * `renderList` - also draw the sidebar result list
 */
function loadUnits(query, renderList) {
    var url = MapsConfig.baseMMUrl + 'units.geojson?state=1' + (query ? '&' + query : '');

    $.getJSON(url, function (results) {
        if (results?.data == null) {
            console.log('MM api connection error - ' + url);
            hideSpinner();
            return;
        }
        if (renderList) {
            var res = $('#feature-list tbody');
            if (results.count === 0) {
                res.append('<tr><td colspan="3"><h4 class="rip" data-testid="no-results">Κανένα Αποτέλεσμα</h4></td></tr>');
            } else {
                res.append(results.data.features.map(featureRow).join(''));
            }
            // Adjust sidebar height to extend to the bottom
            $('.sidebar-table').height(function(index, height) {
                return window.innerHeight - $(this).offset().top;
            });
        }
        units.addData(results.data);
        markerClusters.addLayer(units);
        hideSpinner();
    });
}

//Run when user click on unit name at left row
$(document).on("click", ".feature-row", function () {
    var urlCustom = MapsConfig.baseMMUrl + 'units?mm_id=' + $(this).attr("mm_id");
    $(document).off("mouseout", ".feature-row", clearHighlight);
    onUnitClick(urlCustom)
});

//show red circle when mouse is over unit name at left row
if ( !("ontouchstart" in window) ) {
  $(document).on("mouseover", ".feature-row", function(e) {
      highlight.clearLayers().addLayer(
          L.circleMarker(
              [$(this).attr("lat"), $(this).attr("lng")],
              highlightStyle
          )
      );
  });
}

//remove red circle when mouse is leave from unit name at left row
$(document).on("mouseout", ".feature-row", clearHighlight);


//left column-----------------------------------------------------
//reset button
$("#reset").click(function() {
    FILTERS.forEach(function (filter) {
        if (!filter.text) {
            $(filter.selector).val('').trigger('change');
        }
    });
    $(':input').val('');
});

//navbar menu-----------------------------------------------------
//search
$("#list-btn").click(function() {
    animateSidebar();
    return false;
});
//informations
$("#about-btn").click(function() {
  $("#aboutModal").modal("show");
  $(".navbar-collapse.in").collapse("hide");
  return false;
});
//contact
$("#legend-btn").click(function() {
  $("#legendModal").modal("show");
  $(".navbar-collapse.in").collapse("hide");
  return false;
});
//only at response
$("#nav-btn").click(function() {
  $(".navbar-collapse").collapse("toggle");
  return false;
});
//only at response
$("#sidebar-toggle-btn").click(function() {
  animateSidebar();
  return false;
});

$("#sidebar-hide-btn").click(function() {
  animateSidebar();
  return false;
});

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
/* Empty layer placeholder to add to layer control for listening when to add/remove units to markerClusters layer */
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
//added atributor control
var attributionControl = L.control({
    position: "bottomright"
});
attributionControl.onAdd = function () {
    var div = L.DomUtil.create("div", "leaflet-control-attribution");
    div.innerHTML = baseMap.getAttribution();
    return div;
};
map.addControl(attributionControl);
//added zoom control
var zoomControl = L.control.zoom({
    position: "bottomright"
}).addTo(map);

//-----------------------------Show markers to map-------------------------------------------------
$('#units_info').empty();
var initialQuery = urlParams.urlValues.join('&');
/* The embedded map has no sidebar, so it never renders the result list */
if (MapsConfig.embed || initialQuery === '') {
    loadUnits(initialQuery, false);
}
else
{
    document.getElementById("sidebar-news").style.display = "none";
    $('#feature-list tbody').empty();
    resetUnitsLayer();
    map.setView(
        [urlParams.lat, urlParams.lng],
        urlParams.zoom
    );
    loadUnits(initialQuery, true);
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

/* Highlight search box text on click TODO remove?*/
$("#searchbox").click(function () {
  $(this).select();
});

/* Prevent hitting enter from refreshing the page TODO check*/
$("#searchbox").keypress(function (e) {
  if (e.which == 13) {
    e.preventDefault();
  }
});

//TODO remove?
$("#featureModal").on("hidden.bs.modal", function (e) {
  $(document).on("mouseout", ".feature-row", clearHighlight);
});

//run when user click at search
$('#apply-filters').click(function() {
    document.getElementById("sidebar-news").style.display = "none";
    clearHighlight();
    window.history.pushState({}, document.title, MapsConfig.baseNewUrl);
    showSpinner();
    $('#feature-list tbody').empty();
    $('#units_info').empty();
    resetUnitsLayer();
    map.setView(
        [MapsConfig.latGR, MapsConfig.lngGR],
        MapsConfig.zoomGR
    );
    loadUnits(collectFilters(false), true);
});
