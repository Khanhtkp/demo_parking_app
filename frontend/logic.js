var map = L.map('map').setView([10.7766, 106.7009], 16);  

L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 20
}).addTo(map);

// Red marker
var marker = L.circleMarker([10.7766, 106.7009], {radius: 8, color: "red"}).addTo(map); // red dot representing users

// Load route GeoJSON
var routeLayer = new L.GeoJSON.AJAX("../data/route.geojson", {
    style: { color: "blue", weight: 4 }
}).addTo(map); // blueline representing the driving path

var parkingLayer = new L.GeoJSON.AJAX("../data/parking.geojson", {
    pointToLayer: function (feature, latlng) {
        var marker = L.marker(latlng, {
        icon: L.icon({
            iconUrl: "https://cdn-icons-png.flaticon.com/512/252/252025.png",
        iconSize: [24, 24]
    })
    });
    var name = feature.properties.name;
    var capacity = feature.properties.capacity;

    marker.bindTooltip(
        "<b>" + name + "</b><br/>" +
        "Slots: " + capacity,
        {
            permanent: false,   // only show on hover
            direction: "top",   // position above the marker
            offset: [0, -10],   // little spacing above
            sticky: true        // follow the mouse if hovering near
        }
    );
    return marker;
}


}).addTo(map);

var bounds = L.latLngBounds(
    [10.7735, 106.6975],  // southwest corner
    [10.7795, 106.7040]   // northeast corner
);
map.setMaxBounds(bounds);
// After data is loaded
routeLayer.on('data:loaded', function() {
// Extract coordinates correctly
var coords = routeLayer.getLayers()[0].getLatLngs();
console.log(coords);

// Handle nested structure (MultiLineString)
if (Array.isArray(coords[0])) {
    coords = coords.flat(); 
}

// Fit map to route
map.fitBounds(L.polyline(coords).getBounds());

// Animate red dot
let i = 0;
function move() {
    if (i < coords.length) {
    marker.setLatLng(coords[i]);
    i++;
    setTimeout(move, 1000); // adjust speed ⏱
    }
}
move();
});