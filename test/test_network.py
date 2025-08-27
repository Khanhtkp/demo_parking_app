import osmnx as ox
place = 'Ho Chi Minh City, Vietnam'
G = ox.graph_from_place(place, network_type='drive')

# Plot the graph
fig, ax = ox.plot_graph(G)