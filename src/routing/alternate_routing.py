import pandas as pd
import os

def calculate_alternate_routes(raw_data_dir, processed_data_dir):
    print("Loading datasets...")
    
    # 1. Load segments (network graph)
    segments_path = os.path.join(raw_data_dir, 'segments_port2port.csv')
    if not os.path.exists(segments_path):
        print(f"Error: {segments_path} not found.")
        return
    segments = pd.read_csv(segments_path, sep='|')
    
    # Clean up segments (keep only origin, destination, and traffic volume)
    # We use 'number_all' as the proxy for connectivity/traffic
    segments['number_all'] = pd.to_numeric(segments['number_all'], errors='coerce').fillna(0)
    
    # We want a bi-directional graph: if traffic flows A->B, B is a valid alternate for A, and A is valid for B.
    # To do this, we can group by both directions.
    forward_edges = segments[['port_origin', 'port_destination', 'number_all']].copy()
    forward_edges.columns = ['port', 'connected_port', 'traffic']
    
    backward_edges = segments[['port_destination', 'port_origin', 'number_all']].copy()
    backward_edges.columns = ['port', 'connected_port', 'traffic']
    
    # Combine and aggregate traffic
    all_connections = pd.concat([forward_edges, backward_edges])
    graph = all_connections.groupby(['port', 'connected_port'])['traffic'].sum().reset_index()
    
    # 2. Load Berth Capacity (to ensure alternate ports have actual parking spots)
    berths_capacity_path = os.path.join(processed_data_dir, 'berths_capacity.csv')
    if not os.path.exists(berths_capacity_path):
        print(f"Error: {berths_capacity_path} not found. Run data_processing.py first.")
        return
    berths = pd.read_csv(berths_capacity_path)
    
    # 3. Load Port Names for readability
    ports_path = os.path.join(raw_data_dir, 'ports.csv')
    ports = pd.read_csv(ports_path, sep='|')
    # Assuming 'id' matches 'port'
    ports['id'] = pd.to_numeric(ports['id'], errors='coerce')
    port_names = ports[['id', 'portname', 'countryname']].set_index('id')
    
    print("Calculating Top 3 Alternate Routes for every port...")
    
    # Merge capacity into the graph for the CONNECTED port
    # Convert types to avoid merge issues
    graph['connected_port'] = pd.to_numeric(graph['connected_port'], errors='coerce')
    berths['port'] = pd.to_numeric(berths['port'], errors='coerce')
    
    graph = graph.merge(berths, left_on='connected_port', right_on='port', how='left')
    graph = graph.rename(columns={'total_berths': 'alternate_port_capacity'})
    graph = graph.drop(columns=['port_y'])
    graph = graph.rename(columns={'port_x': 'port'})
    
    # Filter out alternate ports that have 0 or NaN capacity (they can't accept diverted ships)
    graph = graph[graph['alternate_port_capacity'] > 0]
    
    # Calculate a "Viability Score"
    # Score = Traffic Volume * (1 + (Capacity / 10))
    # This favors highly connected ports, but gives a boost to massive ports that can absorb traffic
    graph['viability_score'] = graph['traffic'] * (1 + (graph['alternate_port_capacity'] / 10.0))
    
    # Sort and pick top 3 for each port
    graph = graph.sort_values(by=['port', 'viability_score'], ascending=[True, False])
    
    results = []
    
    for port_id, group in graph.groupby('port'):
        top_3 = group.head(3)
        
        # Get the original port name
        try:
            origin_name = port_names.loc[port_id, 'portname']
        except KeyError:
            origin_name = f"Port_{port_id}"
            
        row = {
            'port_id': port_id,
            'port_name': origin_name,
        }
        
        for i, (_, alt) in enumerate(top_3.iterrows(), start=1):
            alt_id = alt['connected_port']
            try:
                alt_name = port_names.loc[alt_id, 'portname']
            except KeyError:
                alt_name = f"Port_{alt_id}"
                
            row[f'alt_{i}_id'] = alt_id
            row[f'alt_{i}_name'] = alt_name
            row[f'alt_{i}_score'] = round(alt['viability_score'], 2)
            row[f'alt_{i}_capacity'] = alt['alternate_port_capacity']
            
        results.append(row)
        
    final_df = pd.DataFrame(results)
    
    output_dir = os.path.join('data', 'feature3')
    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, 'alternate_routes.csv')
    final_df.to_csv(output_path, index=False)
    
    print(f"Success! Generated alternate routes for {len(final_df)} ports.")
    print(f"Saved to: {output_path}")
    
    # Preview
    print("\n--- Sample Output ---")
    print(final_df.head(5).to_string())

if __name__ == "__main__":
    calculate_alternate_routes("data/raw", "data/processed")
