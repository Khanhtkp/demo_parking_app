var map = L.map('map').setView([10.7766, 106.7009], 15);

L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 20
}).addTo(map);

// Red marker (user location, initially null)
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
    className: "",  // remove default Leaflet styles
    iconSize: [40, 40],
    iconAnchor: [20, 20] // center the avatar
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

// When map is clicked → set user location
map.on("click", function (e) {
    let lat = e.latlng.lat;
    let lon = e.latlng.lng;

    // Remove previous user marker if exists
    if (window.userMarker) {
        map.removeLayer(window.userMarker);
    }

    // Add user marker (avatar icon)
    window.userMarker = L.marker(e.latlng, { icon: userIcon }).addTo(map);

    // Call backend routing API
    fetch(`/route?lat=${lat}&lon=${lon}`)
        .then(res => res.json())
        .then(data => {
            if (data.route && data.route.length > 0) {
                // Convert [lat, lon] arrays into LatLng objects
                window.routeCoords = data.route.map(pt => L.latLng(pt[0], pt[1]));

                // Remove previous route line if exists
                if (window.routeLine) {
                    map.removeLayer(window.routeLine);
                }

                // Draw new polyline
                window.routeLine = L.polyline(window.routeCoords, { color: "blue", weight: 4 }).addTo(map);
                map.fitBounds(window.routeLine.getBounds());

                // Show Start Going button
                const btnContainer = document.getElementById("startButtonContainer");
                if (btnContainer) {
                    btnContainer.style.display = "block"; // force visible
                    btnContainer.style.visibility = "visible"; // double safeguard
                }
                            }
        });
});

document.getElementById("startButton").addEventListener("click", function () {
    let i = 0;
    function move() {
        if (i < window.routeCoords.length) {
            window.userMarker.setLatLng(window.routeCoords[i]);
            i++;
            setTimeout(move, 1000);
        }
        else {
            // finish root
            let cost = 20000; // example: 20,000 VND
                L.popup()
                  .setLatLng(window.routeCoords[window.routeCoords.length - 1])
                  .setContent("You have arrived at the parking lot.<br>Parking fee: " + cost.toLocaleString() + " VND")
                  .openOn(window.map);
        }
    }
    move();
    document.getElementById("startButtonContainer").style.display = "none";
});

