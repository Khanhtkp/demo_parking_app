import folium
import osmnx as ox

# Location: Ben Thanh Market area
place = "District 1, Ho Chi Minh City, Vietnam"
tags = {"amenity": "parking"}

# Get parking lot locations
parking = ox.features_from_place(place, tags)

# Extract coordinates of first 5 parking lots
parking_coords = []
for _, row in parking.iterrows():
    if row.geometry.geom_type == "Point":
        parking_coords.append((row.geometry.y, row.geometry.x))
    elif row.geometry.geom_type in ["Polygon", "MultiPolygon"]:
        # Get centroid if it's a polygon
        centroid = row.geometry.centroid
        parking_coords.append((centroid.y, centroid.x))

# Pick a "fake" user location near the first parking lot
user_location = (parking_coords[0][0] + 0.001, parking_coords[0][1] + 0.001)

# Initialize map centered on user
m = folium.Map(location=user_location, zoom_start=16) # this just creates a real map

# Add user marker (red dot)
folium.CircleMarker(
    location=user_location,
    radius=8,
    color="red",
    fill=True,
    fill_color="red",
    popup="You (simulated)"
).add_to(m)

# Add parking lot markers (blue)
for coord in parking_coords[:5]:
    folium.Marker(
        location=coord,
        icon=folium.Icon(color="blue", icon="info-sign"),
        popup="Parking lot"
    ).add_to(m)

moving_marker = folium.Marker(
    location=user_location,
    popup="Me (moving)",
    icon=folium.Icon(color="red")
)
moving_marker.add_to(m)

# Save to HTML
js = f'''
<script>
    var marker = {moving_marker.get_name()};
    var latlngs = [
        [{user_location[0]}, {user_location[1]}],
        [{parking_location[0]}, {parking_location[1]}]
    ];

    var i = 0;
    function moveMarker() {{
        if (i < latlngs.length) {{
            marker.setLatLng(latlngs[i]);
            i++;
            setTimeout(moveMarker, 1000);  // 1 second per step
        }}
    }}
    moveMarker();
</script>

'''
m.get_root().html.add_child(folium.Element(js))

m.save("map_with_user_and_parking.html")
print("✅ Map saved as map_with_user_and_parking.html")
