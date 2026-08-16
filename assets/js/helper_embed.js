//---------------------Spinner functions---------------------
// Function to display the spinner
function showSpinner() {
    // Initialize
    if ($('.kintone-spinner').length == 0) {
        // Create elements for the spinner and the background of the spinner
        var spin_div = $('<div id ="kintone-spin" class="kintone-spinner"></div>');
        var spin_bg_div = $('<div id ="kintone-spin-bg" class="kintone-spinner"></div>');

        // Append spinner to the body
        $(document.body).append(spin_div, spin_bg_div);

        // Set a style for the spinner
        $(spin_div).css({
            'position': 'fixed',
            'top': '50%',
            'left': '50%',
            'z-index': '510',
            'background-color': '#fff',
            'padding': '26px',
            '-moz-border-radius': '4px',
            '-webkit-border-radius': '4px',
            'border-radius': '4px'
        });
        $(spin_bg_div).css({
            'position': 'absolute',
            'top': '0px',
            'left': '0px',
            'z-index': '500',
            'width': '100%',
            'height': '200%',
            'background-color': '#000',
            'opacity': '0.5',
            'filter': 'alpha(opacity=50)',
            '-ms-filter': "alpha(opacity=50)"
        });

        // Set options for the spinner
        var opts = {
            'color': '#000'
        };

        // Create the spinner
        new Spinner(opts).spin(document.getElementById('kintone-spin'));
    }

    // Display the spinner
    $('.kintone-spinner').show();
}

// Function to hide the spinner
function hideSpinner() {
    // Hide the spinner
    $('.kintone-spinner').hide();
}

//---------------------Get utr functions---------------------
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
    var zoom = getUrlParam('zoom', defaultValues.zoomGR);
    var lat = getUrlParam('lat', defaultValues.latGR);
    var lng = getUrlParam('lng', defaultValues.lngGR);

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
        arrValues.push('operation_shifts=' + urlOperationShift);
    }

    return {
        urlValues: arrValues,
        searchValues: {
            name: _.isNil(searchName) ? '' : searchName,
            mmID: _.isNil(searchMMID) ? '' : searchMMID,
            registryNo: _.isNil(searchRegistryNo) ? '' : searchRegistryNo,
            eduAdmins: _.isNil(searchEduAdmins) ? '' : searchEduAdmins,
            regionEduAdmins: _.isNil(searchRegionEduAdmins) ? '' : searchRegionEduAdmins,
            municipalities: _.isNil(searchMunicipalities) ? '' : searchMunicipalities,
            unitTypes: _.isNil(searchUnitTypes) ? '' : searchUnitTypes,
            orientationTypes: _.isNil(searchOrientationTypes) ? '' : searchOrientationTypes,
            operationShifts: _.isNil(searchOperationShifts) ? '' : searchOperationShifts
        },
        zoom: zoom,
        lat: lat,
        lng: lng
    }
}

//---------------------General functions---------------------
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
                var APIEndpoint = defaultValues.baseMMUrl + 'units?mm_id=' + feature.properties.mmId;
                return onUnitClick(APIEndpoint);
            }
        });
    }
}

function onUnitClick(APIEndpoint) {
    $.getJSON(APIEndpoint, function (results) {
        if (!_.isNil(results.data[0])) {
            var unitData = results.data[0];
            var registryNo = !_.isNil(unitData.registry_no) ? unitData.registry_no : '';
            var eduAdmin = !_.isNil(unitData.edu_admin) ? unitData.edu_admin : '';
            var regionEduAdmin = !_.isNil(unitData.region_edu_admin) ? unitData.region_edu_admin : '';
            var municipality = !_.isNil(unitData.municipality) ? unitData.municipality : '';
            var unitType = !_.isNil(unitData.unit_type) ? unitData.unit_type : '';
            var orientationType = !_.isNil(unitData.orientation_type) ? unitData.orientation_type : '';
            var operationShift = !_.isNil(unitData.operation_shift) ? unitData.operation_shift : '';
            var streetAddress = !_.isNil(unitData.street_address) ? unitData.street_address : '';
            var postalCode = !_.isNil(unitData.postal_code) ? unitData.postal_code : '';
            var phoneNumber = !_.isNil(unitData.phone_number) ? unitData.phone_number : '';
            var faxNumber = !_.isNil(unitData.fax_number) ? unitData.fax_number : '';
            var email = !_.isNil(unitData.email) ? unitData.email : '';
            var latitude = !_.isNil(unitData.latitude) ? unitData.latitude : 0;
            var longitude = !_.isNil(unitData.longitude) ? unitData.longitude : 0;
            var content = "<table class='table table-striped table-bordered table-condensed'>" +
                "<tr><th>Όνομα</th><td>" + unitData.name +
                "<tr><th>Κωδικός ΜΜ</th><td><a class='url-break' href=https://mm.sch.gr/main.php?auth=0&mm_id=" + unitData.mm_id + " target='_blank'>" + unitData.mm_id + "</a></td></tr>" +
                "<tr><th>Κωδικός Υπουργείου</th><td>" + registryNo + "</td></tr>" +
                "<tr><th>Διεύθυνση Εκπαίδευσης</th><td>" + eduAdmin + "</td></tr>" +
                "<tr><th>Περιφέρεια Εκπαίδευσης</th><td>" + regionEduAdmin + "</td></tr>" +
                "<tr><th>Δήμος</th><td>" + municipality + "</td></tr>" +
                "<tr><th>Τύπος Μονάδας</th><td>" + unitType + "</td></tr>" +
                "<tr><th>Προσανατολισμός</th><td>" + orientationType + "</td></tr>" +
                "<tr><th>Ωράριο Λειτουργίας</th><td>" + operationShift + "</td></tr>" +
                "<tr><th>Διεύθυνση</th><td>" + streetAddress + "</td></tr>" +
                "<tr><th>Τ.Κ.</th><td>" + postalCode + "</td></tr>" +
                "<tr><th>Τηλέφωνο</th><td>" + phoneNumber + "</td></tr>" +
                "<tr><th>Fax</th><td>" + faxNumber + "</td></tr>" +
                "<tr><th>Email</th><td>" + email + "</td></tr>" +
                "<table>";

            $("#feature-title").html(unitData.name);
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
        else {
            //console.log('MM api connection error - Unit Info');
        }
    });
}
