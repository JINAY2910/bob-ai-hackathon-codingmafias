import pandas as pd
import os
import pickle
from sklearn.metrics import roc_auc_score, accuracy_score, classification_report, confusion_matrix

def evaluate_model():
    print("Loading test data and model...")
    
    # 1. Load Data
    data_path = 'data/processed/engineered_features.csv'
    if not os.path.exists(data_path):
        print("Data not found. Run data_processing.py and feature_engineering.py first.")
        return
        
    data = pd.read_csv(data_path)
    data['date'] = pd.to_datetime(data['date'])
    data = data.sort_values(by='date')
    
    # Isolate the test set (November & December 2019)
    split_date = pd.to_datetime('2019-11-01')
    test = data[data['date'] >= split_date]
    
    features_to_use = [
        'active_vessels', 'vessel_arrivals', 'vessel_departures',
        'arrivals_next_1d', 'arrivals_next_3d_sum',
        'total_berths', 'berth_utilization_ratio'
    ]
    target = 'congestion_target'
    
    X_test = test[features_to_use]
    y_test = test[target]
    
    # 2. Load Model
    model_path = 'models/congestion_model.pkl'
    if not os.path.exists(model_path):
        print("Model not found. Run train_model.py first.")
        return
        
    with open(model_path, 'rb') as f:
        model = pickle.load(f)
        
    # 3. Make Predictions
    print(f"Testing on {len(X_test)} samples from Nov-Dec 2019...\n")
    y_pred = model.predict(X_test)
    y_pred_proba = model.predict_proba(X_test)[:, 1]
    
    # 4. Calculate Metrics
    roc_auc = roc_auc_score(y_test, y_pred_proba)
    acc = accuracy_score(y_test, y_pred)
    cm = confusion_matrix(y_test, y_pred)
    
    # 5. Print Detailed Report
    print("="*40)
    print("        MODEL ACCURACY REPORT")
    print("="*40)
    print(f"Overall Accuracy:  {acc*100:.2f}%")
    print(f"ROC-AUC Score:     {roc_auc:.4f} (1.0 is perfect)")
    print("-" * 40)
    
    print("\n[ Confusion Matrix ]")
    print(f"True Negatives (Correctly predicted Normal):     {cm[0][0]}")
    print(f"False Positives (Falsely predicted Congested):   {cm[0][1]}")
    print(f"False Negatives (Missed Congestion):             {cm[1][0]}")
    print(f"True Positives (Correctly caught Congestion):    {cm[1][1]}")
    
    print("\n[ Detailed Classification Report ]")
    print(classification_report(y_test, y_pred, target_names=["Normal (0)", "Congested (1)"]))
    
    # 6. Feature Importance
    print("-" * 40)
    print("[ Top 3 Most Important Features ]")
    importances = model.feature_importances_
    feature_importance_df = pd.DataFrame({'Feature': features_to_use, 'Importance': importances})
    feature_importance_df = feature_importance_df.sort_values(by='Importance', ascending=False)
    
    for i, (idx, row) in enumerate(feature_importance_df.head(3).iterrows()):
        print(f"{i+1}. {row['Feature']} ({row['Importance']*100:.1f}%)")

if __name__ == "__main__":
    evaluate_model()
