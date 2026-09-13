import pandas as pd
import os
import numpy as np

def engineer_features(processed_data_dir, raw_data_dir):
    print("Loading processed datasets...")
    portcalls = pd.read_csv(os.path.join(processed_data_dir, 'portcalls_processed.csv'))
    portcalls['ts_start'] = pd.to_datetime(portcalls['ts_start'])
    portcalls['ts_end'] = pd.to_datetime(portcalls['ts_end'])
    portcalls['date'] = portcalls['ts_start'].dt.date
    
    berths = pd.read_csv(os.path.join(processed_data_dir, 'berths_capacity.csv'))
    
    print("Loading ml_port_day for target variables...")
    ml_port_day = pd.read_csv(os.path.join(raw_data_dir, 'ml_port_day.csv'))
    ml_port_day['time_window'] = pd.to_datetime(ml_port_day['time_window']).dt.date
    
    print("Engineering ETA (Arrivals) features...")
    # Group by port and date to get daily arrivals
    daily_arrivals = portcalls.groupby(['port', 'date']).size().reset_index(name='daily_arrivals')
    
    # Generate lag and rolling features for arrivals
    # First, ensure a complete date range per port to avoid missing days
    all_dates = pd.date_range(start=daily_arrivals['date'].min(), end=daily_arrivals['date'].max()).date
    ports = daily_arrivals['port'].unique()
    
    idx = pd.MultiIndex.from_product([ports, all_dates], names=['port', 'date'])
    daily_arrivals = daily_arrivals.set_index(['port', 'date']).reindex(idx, fill_value=0).reset_index()
    daily_arrivals['date'] = pd.to_datetime(daily_arrivals['date'])
    daily_arrivals = daily_arrivals.sort_values(['port', 'date'])
    
    # Calculate ETA features (using ts_start as perfect ETA)
    daily_arrivals['arrivals_next_1d'] = daily_arrivals.groupby('port')['daily_arrivals'].shift(-1)
    daily_arrivals['arrivals_next_3d_sum'] = daily_arrivals.groupby('port')['daily_arrivals'].shift(-1).rolling(window=3, min_periods=1).sum()
    
    print("Calculating Active Vessels and Berth Utilization...")
    # To calculate active vessels accurately per day, we need to count how many vessels overlap with each day.
    # For a large dataset, this can be slow. Since ml_port_day already has active_vessels, we can just use that 
    # to calculate berth utilization!
    
    features = ml_port_day[['port', 'time_window', 'active_vessels', 'vessel_arrivals', 'vessel_departures', 'congestion_target', 'congestion_score']].copy()
    features['date'] = pd.to_datetime(features['time_window'])
    features = features.drop(columns=['time_window'])
    
    # Merge engineered ETA features
    features = features.merge(daily_arrivals[['port', 'date', 'arrivals_next_1d', 'arrivals_next_3d_sum']], on=['port', 'date'], how='left')
    
    # Merge Berth Capacity
    features = features.merge(berths, on='port', how='left')
    
    # Assume ports missing from berths.csv have a median capacity of 1 to avoid inf/zero division
    median_berths = features['total_berths'].median()
    if pd.isna(median_berths) or median_berths == 0:
        median_berths = 1
    features['total_berths'] = features['total_berths'].fillna(median_berths)
    
    # Calculate Berth Utilization Ratio
    features['berth_utilization_ratio'] = features['active_vessels'] / features['total_berths']
    
    # Handle missing target variables (drop them since we need ground truth to train)
    print(f"Dropping {features['congestion_target'].isna().sum()} rows with missing target.")
    features = features.dropna(subset=['congestion_target'])
    
    # Fill remaining NaNs in features with 0 (e.g. at the end of the time series where next 1d is unknown)
    features = features.fillna(0)
    
    print("Saving engineered features...")
    features.to_csv(os.path.join(processed_data_dir, 'engineered_features.csv'), index=False)
    print(f"Features saved to {processed_data_dir}/engineered_features.csv")

if __name__ == "__main__":
    engineer_features("data/processed", "data/raw")
