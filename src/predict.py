import pickle
import pandas as pd
import os

def run_prediction():
    # 1. Load the trained model
    model_path = 'models/congestion_model.pkl'
    if not os.path.exists(model_path):
        print(f"Error: Model not found at {model_path}. Run train_model.py first.")
        return

    with open(model_path, 'rb') as f:
        model = pickle.load(f)
        
    print("Model loaded successfully!\n")

    # 2. Create some sample "fake" data to test the model
    # These match the 7 features the model was trained on
    # 'active_vessels', 'vessel_arrivals', 'vessel_departures', 'arrivals_next_1d', 'arrivals_next_3d_sum', 'total_berths', 'berth_utilization_ratio'
    
    sample_data = pd.DataFrame([
        {
            "Scenario": "Healthy Port",
            "active_vessels": 10,
            "vessel_arrivals": 2,
            "vessel_departures": 3,
            "arrivals_next_1d": 2,
            "arrivals_next_3d_sum": 6,
            "total_berths": 15,
            "berth_utilization_ratio": 10/15 # 0.66
        },
        {
            "Scenario": "Congested Port",
            "active_vessels": 25,
            "vessel_arrivals": 8,
            "vessel_departures": 2,
            "arrivals_next_1d": 12,
            "arrivals_next_3d_sum": 30,
            "total_berths": 15,
            "berth_utilization_ratio": 25/15 # 1.66 (Over capacity)
        }
    ])
    
    # 3. Separate features from the scenario name
    features = sample_data.drop(columns=['Scenario'])
    
    # 4. Make predictions
    predictions = model.predict(features)
    probabilities = model.predict_proba(features)[:, 1]
    
    # 5. Print results
    for i, row in sample_data.iterrows():
        print(f"--- {row['Scenario']} ---")
        print(f"Berth Utilization: {row['berth_utilization_ratio']:.2f}")
        print(f"Incoming Vessels (Next 3 Days): {row['arrivals_next_3d_sum']}")
        print(f"Prediction: {'CONGESTION HOTSPOT' if predictions[i] == 1 else 'NORMAL'}")
        print(f"Congestion Probability: {probabilities[i]*100:.1f}%\n")

if __name__ == "__main__":
    run_prediction()
