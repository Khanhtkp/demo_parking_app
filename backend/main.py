# backend/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import osmnx as ox
from osmnx import geocoder, features, routing
import networkx as nx

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # allow all origins
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load map and graph once at startup
place_name = "Hoan Kiem, Hanoi, Vietnam"
region = geocoder.geocode_to_gdf(place_name)

G = ox.graph_from_place(place_name, network_type="drive_service", simplify=False)
G = nx.subgraph(G, max(nx.strongly_connected_components(G), key=len)).copy()

# Precompute parking nodes
tags = {"amenity": "parking"}
gdf = features.features_from_place(place_name, tags=tags)
parking_nodes = [n for n, data in G.nodes(data=True) if data.get("amenity") == "parking"]

@app.get("/route")
def get_route(lat: float, lon: float):
    # find nearest node to user location
    orig_node = ox.distance.nearest_nodes(G, lon, lat)

    # find nearest parking node
    min_dist = float("inf")
    nearest_park_node = None
    parking_points = []
    parking_polygons = []

    for _, row in gdf.iterrows():
        geom = row.geometry
        candidate_nodes = []

        if geom.geom_type == "Point":
            plat, plon = geom.y, geom.x
            parking_points.append({"lat": plat, "lon": plon})
            for n in parking_nodes:
                if abs(G.nodes[n]['x'] - plon) < 1e-6 and abs(G.nodes[n]['y'] - plat) < 1e-6:
                    candidate_nodes.append(n)

        elif geom.geom_type in ["Polygon", "MultiPolygon"]:
            boundary_points = []
            if geom.geom_type == "Polygon":
                boundary_points = list(geom.exterior.coords)
            else:  # MultiPolygon
                for poly in geom.geoms:
                    boundary_points.extend(list(poly.exterior.coords))

            parking_polygons.append({
                "coordinates": [[lat, lon] for lon, lat in boundary_points]
            })

            for plon, plat in boundary_points[::max(1, len(boundary_points)//20)]:
                candidate_nodes.append(ox.distance.nearest_nodes(G, plon, plat))

        for node in candidate_nodes:
            try:
                dist = nx.shortest_path_length(G, orig_node, node, weight="length")
                if dist < min_dist:
                    min_dist = dist
                    nearest_park_node = node
            except nx.NetworkXNoPath:
                continue

    # fallback if no polygon points
    for p in parking_points:
        node = ox.distance.nearest_nodes(G, p["lon"], p["lat"])
        try:
            dist = nx.shortest_path_length(G, orig_node, node, weight="length")
            if dist < min_dist:
                min_dist = dist
                nearest_park_node = node
        except nx.NetworkXNoPath:
            continue

    # compute route coordinates
    route_coords = []
    if nearest_park_node is not None:
        try:
            route = nx.shortest_path(G, orig_node, nearest_park_node, weight="length")
            for n in route:
                node_data = G.nodes[n]
                route_coords.append({"lat": node_data["y"], "lon": node_data["x"]})
        except nx.NetworkXNoPath:
            pass

    return {
        "current_location": {"lat": lat, "lon": lon},
        "parking_points": parking_points,
        "parking_polygons": parking_polygons,
        "route": route_coords
    }
