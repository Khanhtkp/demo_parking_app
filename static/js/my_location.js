var map = L.map('map').setView([10.7766, 106.7009], 15);

L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 20
}).addTo(map);

// Red marker (user location)
var userIcon = L.divIcon({
    html: `
      <div style="
          width:40px;
          height:40px;
          border-radius:50%;
          overflow:hidden;
          border:2px solid #d33;
          box-shadow:0 0 5px rgba(0,0,0,0.3);
      ">
        <img src="static/images/loc.jpg"
             style="width:100%;height:100%;object-fit:cover;" />
      </div>
    `,
    className: "",
    iconSize: [40, 40],
    iconAnchor: [20, 20]
});

// Parking layer
var parkingLayer = new L.GeoJSON.AJAX("/data/parking_region_only.geojson", {
    style: function (feature) {
        return {
            color: "blue",
            weight: 1,
            fillColor: "lightblue",
            fillOpacity: 0.3
        };
    },
    onEachFeature: function (feature, layer) {
        layer.bindTooltip(
            "<b>" + (feature.properties.name || "Parking Lot") + "</b><br/>" +
            "Slots: " + (feature.properties.capacity || "N/A"),
            {direction: "top", offset: [0, -10]}
        );
    }
}).addTo(map);
var parkingPoints = new L.GeoJSON.AJAX("/data/parking.geojson", {
    pointToLayer: function (feature, latlng) {
        return L.circleMarker(latlng, {
            radius: 6,
            color: "blue",
            fillColor: "blue",
            fillOpacity: 0.8
        });
    },
    onEachFeature: function (feature, layer) {
        layer.bindTooltip(
            "<b>" + (feature.properties.name || "Parking Point") + "</b><br/>" +
            "Slots: " + (feature.properties.capacity || "N/A"),
            {direction: "top", offset: [0, -10]}
        );
    }
}).addTo(map);

// When map is clicked → set user location
map.on("click", function (e) {
    let lat = e.latlng.lat;
    let lon = e.latlng.lng;
    console.log("Current location (clicked):", lat, lon);
    if (window.userMarker) {
        map.removeLayer(window.userMarker);
    }

    window.userMarker = L.marker(e.latlng, { icon: userIcon }).addTo(map);

    fetch(`/route?lat=${lat}&lon=${lon}`)
        .then(res => res.json())
        .then(data => {
            console.log("Route coords:", data.route);
            if (data.route && data.route.length > 0) {
                window.routeCoords = data.route.map(pt => L.latLng(pt[0], pt[1]));

                if (window.routeLine) {
                    map.removeLayer(window.routeLine);
                }

                window.routeLine = L.polyline(window.routeCoords, { color: "blue", weight: 4 }).addTo(map);
                map.fitBounds(window.routeLine.getBounds());

                const btnContainer = document.getElementById("startButtonContainer");
                if (btnContainer) {
                    btnContainer.style.display = "block";
                    btnContainer.style.visibility = "visible";
                }
            } else {
                // ⚠️ No parking lot found nearby
                L.popup()
                    .setLatLng(e.latlng)
                    .setContent("No nearby parking lot available.")
                    .openOn(map);
            }
        })
        .catch(err => {
            console.error(err);
            L.popup()
                .setLatLng(e.latlng)
                .setContent("Error while finding route.")
                .openOn(map);
        });
});

// Timer + cost variables
let timerInterval = null;
let elapsedSeconds = 0;
const ratePerSecond = 200; // 200 VND per second (example)
const timerElement = document.getElementById("timer");

// Start going button
document.getElementById("startButton").addEventListener("click", function () {
    let i = 0;
    elapsedSeconds = 0;

    // Start timer
    timerInterval = setInterval(() => {
        elapsedSeconds++;
        const cost = elapsedSeconds * ratePerSecond;
        timerElement.textContent = `Time: ${elapsedSeconds}s | Cost: ${cost.toLocaleString()} VND`;
    }, 1000);

    function move() {
        if (i < window.routeCoords.length) {
            window.userMarker.setLatLng(window.routeCoords[i]);
            i++;
            setTimeout(move, 1000);
        } else {
            clearInterval(timerInterval);

            const totalCost = elapsedSeconds * ratePerSecond;
            L.popup()
                .setLatLng(window.routeCoords[window.routeCoords.length - 1])
                .setContent(
                    `You have arrived at the parking lot.<br>
                     Time: ${elapsedSeconds}s<br>
                     Parking fee: ${totalCost.toLocaleString()} VND`
                )
                .openOn(map);
        }
    }

    move();
    document.getElementById("startButtonContainer").style.display = "none";
});
