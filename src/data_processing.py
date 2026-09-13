import pandas as pd
import os

def load_and_merge_data(raw_data_dir, processed_data_dir):
    print("Loading datasets...")
    
    # Read portcalls (sep is '|')
    portcalls_path = os.path.join(raw_data_dir, "portcalls.csv")
    portcalls = pd.read_csv(portcalls_path, sep='|')
    
    # Read vesseltype_enriched (sep is '|')
    vesseltypes_path = os.path.join(raw_data_dir, "vesseltype_enriched.csv")
    vesseltypes = pd.read_csv(vesseltypes_path, sep='|')
    
    # Read berths (sep is '|')
    berths_path = os.path.join(raw_data_dir, "berths.csv")
    berths = pd.read_csv(berths_path, sep='|')
    
    print("Merging portcalls with vessel types...")
    # Merge portcalls with vesseltypes
    portcalls = portcalls.merge(vesseltypes[['mmsi', 'vesseltype']], on='mmsi', how='left')
    
    # Convert timestamps to datetime
    portcalls['ts_start'] = pd.to_datetime(portcalls['ts_start'], errors='coerce')
    portcalls['ts_end'] = pd.to_datetime(portcalls['ts_end'], errors='coerce')
    
    # Drop rows without valid start times
    portcalls = portcalls.dropna(subset=['ts_start'])
    
    print("Aggregating berth capacity per port...")
    # Calculate static berth capacity per port
    berths_count = berths.groupby('portid').size().reset_index(name='total_berths')
    # Assuming 'port' in portcalls matches 'portid' in berths.
    berths_count = berths_count.rename(columns={'portid': 'port'})
    
    # Save processed files
    os.makedirs(processed_data_dir, exist_ok=True)
    portcalls.to_csv(os.path.join(processed_data_dir, 'portcalls_processed.csv'), index=False)
    berths_count.to_csv(os.path.join(processed_data_dir, 'berths_capacity.csv'), index=False)
    
    print(f"Processed data saved to {processed_data_dir}")

if __name__ == "__main__":
    load_and_merge_data("data/raw", "data/processed")
