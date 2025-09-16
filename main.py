# backend/main.py
from fastapi import FastAPI, Query, Request
from fastapi.middleware.cors import CORSMiddleware
import osmnx as ox
from osmnx import geocoder, features, routing
import networkx as nx
from shapely.geometry import Point
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

graphs = {}

app.mount("/data", StaticFiles(directory="data"), name="data")
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates") # sets the folder path where html files save


# Cache graphs for places to avoid rebuilding every request

@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    return templates.TemplateResponse("main_page.html", {"request": request})


@app.get("/map")
async def map_page(request: Request):
    return templates.TemplateResponse("map.html", {"request": request})

# Routing API
@app.get("/route")
def get_route(lat: float = Query(...), lon: float = Query(...)):
    """
    Compute shortest path from user location to the nearest parking lot.
    Uses boundary points of parking polygons to ensure the route reaches the street.
    """
    import shapely.geometry as geom

    # Build drivable road network
    G = ox.graph_from_point((lat, lon), dist=1000, network_type="drive_service", simplify=True)

    # Nearest graph node to user
    orig_node = ox.distance.nearest_nodes(G, lon, lat)

    # Find nearby parking features
    tags = {"amenity": "parking"}
    gdf = ox.features_from_point((lat, lon), dist=1000, tags=tags)

    nearest_park_node = None
    min_dist = float("inf")
    chosen_parking_geom = None

    for _, row in gdf.iterrows():
        parking_geom = row.geometry
        candidate_points = []

        if parking_geom.geom_type == "Point":
            candidate_points.append(parking_geom)

        elif parking_geom.geom_type in ["Polygon", "MultiPolygon"]:
            # Use boundary coordinates instead of centroid
            if parking_geom.geom_type == "Polygon":
                coords = list(parking_geom.exterior.coords)
            else:
                coords = []
                for poly in parking_geom.geoms:
                    coords.extend(list(poly.exterior.coords))
            candidate_points = [geom.Point(x, y) for x, y in coords]

        # Check all candidate points
        for pt in candidate_points:
            plon, plat = pt.x, pt.y
            park_node = ox.distance.nearest_nodes(G, plon, plat)
            try:
                dist = nx.shortest_path_length(G, orig_node, park_node, weight="length")
                if dist < min_dist:
                    min_dist = dist
                    nearest_park_node = park_node
                    chosen_parking_geom = parking_geom
            except nx.NetworkXNoPath:
                continue

    route_coords = []
    if nearest_park_node is not None:
        route = nx.shortest_path(G, orig_node, nearest_park_node, weight="length")
        for n in route:
            node_data = G.nodes[n]
            route_coords.append([node_data["y"], node_data["x"]])

    return {
        "route": route_coords,
        "start": {"lat": lat, "lon": lon},
        "target_parking": chosen_parking_geom.__geo_interface__ if chosen_parking_geom else None
    }

# To run: uvicorn main:app --reload --host 0.0.0.0 --port 8000