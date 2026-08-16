showSpinner();
defaultValues = {
    baseMMUrl : 'https://mm.sch.gr/api/',
    baseHrefUrl : 'https://maps.sch.gr/main.html',
    baseNewUrl : 'main.html',
    latGR : '38.1',
    lngGR : '24.2',
    zoomGR : '7'
};
var map;
var urlParams = getUrlParams();

//----------------------Initial variables for map--------------------------------------------------------
/* Basemap Layers */
var baseMap = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png?lang=el", {
    maxZoom: 19,
    lang: 'el',
    attribution: '<a href="https://maps.sch.gr" target="_blank">Χάρτης Μονάδων ΠΣΔ</a><br>&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors'
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

//Clear feature highlight when map is clicked
map.on("click", function() {
    highlight.clearLayers();
});

//-----------------------------Show markers to map-------------------------------------------------
if (Array.isArray(urlParams.urlValues) && urlParams.urlValues.length === 0)
{
    var urlCustom = defaultValues.baseMMUrl + 'units.geojson?state=1';
}
else
{
    var urlCustom = defaultValues.baseMMUrl + 'units.geojson?state=1&'+ urlParams.urlValues.join('&');
}

$.getJSON(urlCustom, function (results) {
    if (!_.isNil(results.data)) {
        units.addData(results.data);
        markerClusters.addLayer(units);
    } else {
        //console.log('MM API connection error');
    }
    hideSpinner();
});