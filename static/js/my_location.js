// Map initialization (same)
var map = L.map('map').setView([10.7766, 106.7009], 15);

L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 20
}).addTo(map);

// Red marker (user location)
var userIcon = L.divIcon({
    html: `<div style="
        width:40px;
        height:40px;
        border-radius:50%;
        overflow:hidden;
        border:2px solid #d33;
        box-shadow:0 0 5px rgba(0,0,0,0.3);
    "><img src="static/images/loc.jpg" style="width:100%;height:100%;object-fit:cover;" /></div>`,
    className: "",
    iconSize: [40, 40],
    iconAnchor: [20, 20]
});

// Parking layers
var parkingLayer = new L.GeoJSON.AJAX("/data/parking_region_only.geojson", {
    style: feature => ({ color: "blue", weight: 1, fillColor: "lightblue", fillOpacity: 0.3 }),
    onEachFeature: (feature, layer) => {
        layer.bindTooltip(
            "<b>" + (feature.properties.name || "Parking Lot") + "</b><br/>Slots: " + (feature.properties.capacity || "N/A"),
            { direction: "top", offset: [0, -10] }
        );
    }
}).addTo(map);

var parkingPoints = new L.GeoJSON.AJAX("/data/parking.geojson", {
    pointToLayer: (feature, latlng) => L.circleMarker(latlng, { radius: 6, color: "blue", fillColor: "blue", fillOpacity: 0.8 }),
    onEachFeature: (feature, layer) => {
        layer.bindTooltip(
            "<b>" + (feature.properties.name || "Parking Point") + "</b><br/>Slots: " + (feature.properties.capacity || "N/A"),
            { direction: "top", offset: [0, -10] }
        );
    }
}).addTo(map);

// Timer + cost variables
let timerInterval = null;
let elapsedSeconds = 0;
const ratePerSecond = 200;
const timerElement = document.getElementById("timer");

// Smooth movement function
function animateMarker(routeCoords, marker, callback) {
    let index = 0;
    let fraction = 0;
    const speed = 0.005; // adjust: smaller = slower, larger = faster

    function step() {
        if (index >= routeCoords.length - 1) {
            if (callback) callback();
            return;
        }

        const start = routeCoords[index];
        const end = routeCoords[index + 1];

        const lat = start.lat + (end.lat - start.lat) * fraction;
        const lng = start.lng + (end.lng - start.lng) * fraction;

        marker.setLatLng([lat, lng]);

        fraction += speed;
        if (fraction >= 1) {
            fraction = 0;
            index++;
        }

        requestAnimationFrame(step);
    }

    step();
}

// Map click → fetch route
map.on("click", function (e) {
    let lat = e.latlng.lat;
    let lon = e.latlng.lng;

    if (window.userMarker) map.removeLayer(window.userMarker);
    window.userMarker = L.marker(e.latlng, { icon: userIcon }).addTo(map);

    fetch(`/route?lat=${lat}&lon=${lon}`)
        .then(res => res.json())
        .then(data => {
            if (data.route && data.route.length > 0) {
                window.routeCoords = data.route.map(pt => L.latLng(pt[0], pt[1]));

                if (window.routeLine) map.removeLayer(window.routeLine);
                window.routeLine = L.polyline(window.routeCoords, { color: "blue", weight: 4 }).addTo(map);
                map.fitBounds(window.routeLine.getBounds());

                document.getElementById("startButtonContainer").style.display = "block";
            } else {
                L.popup().setLatLng(e.latlng).setContent("No nearby parking lot available.").openOn(map);
            }
        })
        .catch(err => {
            console.error(err);
            L.popup().setLatLng(e.latlng).setContent("Error while finding route.").openOn(map);
        });
});

// Start button → smooth marker + timer
document.getElementById("startButton").addEventListener("click", function () {
    elapsedSeconds = 0;

    // Update timer every second
    timerInterval = setInterval(() => {
        elapsedSeconds++;
        const cost = elapsedSeconds * ratePerSecond;
        timerElement.textContent = `Time: ${elapsedSeconds}s | Cost: ${cost.toLocaleString()} VND`;
    }, 1000);

    // Animate marker smoothly
    animateMarker(window.routeCoords, window.userMarker, () => {
        clearInterval(timerInterval);
        const totalCost = elapsedSeconds * ratePerSecond;
        L.popup()
            .setLatLng(window.routeCoords[window.routeCoords.length - 1])
            .setContent(`You have arrived at the parking lot.<br>Time: ${elapsedSeconds}s<br>Parking fee: ${totalCost.toLocaleString()} VND`)
            .openOn(map);
    });

    document.getElementById("startButtonContainer").style.display = "none";
});
