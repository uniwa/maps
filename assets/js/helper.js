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
function getUrlVars() {
    var vars = {};
    var parts = window.location.href.replace(/[?&]+([^=&]+)=([^&]*)/gi, function(m,key,value) {
        vars[key] = value;
    });
    return vars;
}

function getUrlParam(parameter, defaultvalue) {
    var urlparameter = defaultvalue;
    if(window.location.href.indexOf(parameter) > -1){
        urlparameter = getUrlVars()[parameter];
    }
    return urlparameter;
}

function getUrlParams()
{
    var arrValues = [];
    var urlName = getUrlParam('name', '');
    var urlMMID = getUrlParam('mm_id', '');
    var urlRegistryNo = getUrlParam('registry_no', '');
    var urlEduAdmin = getUrlParam('edu_admin', '');
    var urlRegionEduAdmin = getUrlParam('region_edu_admin', '');
    var urlMunicipality = getUrlParam('municipality', '');
    var urlUnitType = getUrlParam('unit_type', '');
    var urlOrientationType = getUrlParam('orientation_type', '');
    var urlOperationShift = getUrlParam('operation_shift', '');
    var zoom = getUrlParam('zoom', MapsConfig.zoomGR);
    var lat = getUrlParam('lat', MapsConfig.latGR);
    var lng = getUrlParam('lng', MapsConfig.lngGR);

    if (urlName != '' && urlName !== undefined)
    {
        var searchName = urlName.split(',').map(function (item)
        {
            return decodeURI(item);
        });
        arrValues.push('name=' + urlName);
    }
    if (urlMMID != '' && urlMMID !== undefined)
    {
        var searchMMID = urlMMID.split(',').map(function (item)
        {
            return decodeURI(item);
        });
        arrValues.push('mm_id=' + urlMMID);
    }
    if (urlRegistryNo != '' && urlRegistryNo !== undefined)
    {
        var searchRegistryNo = urlRegistryNo.split(',').map(function (item)
        {
            return decodeURI(item);
        });
        arrValues.push('registry_no=' + urlRegistryNo);
    }
    if (urlEduAdmin != '' && urlEduAdmin !== undefined)
    {
        var searchEduAdmins = urlEduAdmin.split(',').map(function (item)
        {
            return parseInt(item, 10);
        });
        arrValues.push('edu_admin=' + urlEduAdmin);
    }
    if (urlRegionEduAdmin != '' && urlRegionEduAdmin !== undefined)
    {
        var searchRegionEduAdmins = urlRegionEduAdmin.split(',').map(function (item)
        {
            return parseInt(item, 10);
        });
        arrValues.push('region_edu_admin=' + urlRegionEduAdmin);
    }
    if (urlMunicipality != '' && urlMunicipality !== undefined)
    {
        var searchMunicipalities = urlMunicipality.split(',').map(function (item)
        {
            return parseInt(item, 10);
        });
        arrValues.push('municipality=' + urlMunicipality);
    }
    if (urlUnitType != '' && urlUnitType !== undefined)
    {
        var searchUnitTypes = urlUnitType.split(',').map(function (item)
        {
            return parseInt(item, 10);
        });
        arrValues.push('unit_type=' + urlUnitType);
    }
    if (urlOrientationType != '' && urlOrientationType !== undefined)
    {
        var searchOrientationTypes = urlOrientationType.split(',').map(function (item)
        {
            return parseInt(item, 10);
        });
        arrValues.push('orientation_type=' + urlOrientationType);
    }
    if (urlOperationShift != '' && urlOperationShift !== undefined)
    {
        var searchOperationShifts = urlOperationShift.split(',').map(function (item)
        {
            return parseInt(item, 10);
        });
        arrValues.push('operation_shift=' + urlOperationShift);
    }

    return {
        urlValues: arrValues,
        searchValues: {
            name: searchName ?? '',
            mmID: searchMMID ?? '',
            registryNo: searchRegistryNo ?? '',
            eduAdmins: searchEduAdmins ?? '',
            regionEduAdmins: searchRegionEduAdmins ?? '',
            municipalities: searchMunicipalities ?? '',
            unitTypes: searchUnitTypes ?? '',
            orientationTypes: searchOrientationTypes ?? '',
            operationShifts: searchOperationShifts ?? ''
        },
        zoom: zoom,
        lat: lat,
        lng: lng
    }
}

//---------------------General functions---------------------
function animateSidebar()
{
    $("#sidebar").animate({
        width: "toggle"
    }, 350, function () {
        map.invalidateSize();
    });
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

function sanitization(string) {
    var sanitize_string='';
    if (string) {
        sanitize_string = string.replace(/&/g, "&amp;").replace(/>/g, "&gt;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
    }
    return sanitize_string;
}

function onUnitClick(APIEndpoint) {
    $.getJSON(APIEndpoint, function (results) {
        if (results?.data?.[0] == null) {
            //console.log('MM api connection error - Unit Info');
            return;
        }
        var unitData = results.data[0];

        if (!MapsConfig.showUnitSites) {
            showUnitModal(unitData, null);
            return;
        }
        /* Websites live in a separate endpoint. Use always() so a failure there
           still opens the modal, rather than swallowing it silently. */
        $.getJSON(MapsConfig.mmSiteUrl + "client/views/sch_sites_export.php?mm_id=" + unitData.mm_id)
            .always(function (sites) {
                showUnitModal(unitData, sites);
            });
    });
}

function showUnitModal(unitData, sites) {
    var registryNo = unitData.registry_no ?? '';
    var eduAdmin = unitData.edu_admin ?? '';
    var regionEduAdmin = unitData.region_edu_admin ?? '';
    var municipality = unitData.municipality ?? '';
    var unitType = unitData.unit_type ?? '';
    var orientationType = unitData.orientation_type ?? '';
    var operationShift = unitData.operation_shift ?? '';
    var streetAddress = unitData.street_address ?? '';
    var postalCode = unitData.postal_code ?? '';
    var phoneNumber = unitData.phone_number ?? '';
    var faxNumber = unitData.fax_number ?? '';
    var email = unitData.email ?? '';
    var latitude = unitData.latitude ?? 0;
    var longitude = unitData.longitude ?? 0;

    var sitesRow = '';
    if (sites != null) {
        sitesRow = "<tr><th>Ιστότοποι</th><td>" + (sites?.data?.sites ? sites.data.sites.map((site) => {
            return "<a class='url-break' href='https://" + site.url + "' target='_blank'>" + site.url + "</a>";
        }).join("<br />") : "-") + "</td></tr>";
    }

    var content = "<table class='table table-striped table-bordered table-condensed'>" +
      "<tr><th>Όνομα</th><td>" + sanitization(unitData.name) +
      "<tr><th>Κωδικός ΜΜ</th><td><a class='url-break' href=" + MapsConfig.mmSiteUrl + "main.php?auth=0&mm_id=" + unitData.mm_id + " target='_blank'>" + unitData.mm_id + "</a></td></tr>" +
      "<tr><th>Κωδικός Υπουργείου</th><td>" + registryNo + "</td></tr>" +
      "<tr><th>Διεύθυνση Εκπαίδευσης</th><td>" + eduAdmin + "</td></tr>" +
      "<tr><th>Περιφέρεια Εκπαίδευσης</th><td>" + regionEduAdmin + "</td></tr>" +
      "<tr><th>Δήμος</th><td>" + municipality + "</td></tr>" +
      "<tr><th>Τύπος Μονάδας</th><td>" + unitType + "</td></tr>" +
      "<tr><th>Προσανατολισμός</th><td>" + orientationType + "</td></tr>" +
      sitesRow +
      "<tr><th>Ωράριο Λειτουργίας</th><td>" + operationShift + "</td></tr>" +
      "<tr><th>Διεύθυνση</th><td>" + streetAddress + "</td></tr>" +
      "<tr><th>Τ.Κ.</th><td>" + postalCode + "</td></tr>" +
      "<tr><th>Τηλέφωνο</th><td>" + phoneNumber + "</td></tr>" +
      "<tr><th>Fax</th><td>" + faxNumber + "</td></tr>" +
      "<tr><th>Email</th><td>" + email + "</td></tr>" +
      "<table>";

    $("#feature-title").text(unitData.name);
    $("#feature-info").html(content);
    $("#featureModal").modal('show');
    map.setView([latitude, longitude], 18);
    highlight.clearLayers().addLayer(
      L.circleMarker(
        [latitude, longitude],
        highlightStyle
      )
    );

    /* Hide sidebar and go to the map on small screens */
    if (document.body.clientWidth <= 767) {
        $("#sidebar").hide();
        map.invalidateSize();
    }
}

function setTooltip(btn, message) {
    $(btn).tooltip('hide')
        .attr('data-original-title', message)
        .tooltip('show');
}

function hideTooltip(btn) {
    setTimeout(function() {
        $(btn).tooltip('hide');
    }, 1000);
}