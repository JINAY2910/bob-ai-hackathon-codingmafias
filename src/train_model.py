import pandas as pd
import os
import xgboost as xgb
from sklearn.metrics import roc_auc_score, accuracy_score, classification_report
import pickle

def train_model(processed_data_dir, models_dir):
    print("Loading engineered features...")
    data = pd.read_csv(os.path.join(processed_data_dir, 'engineered_features.csv'))
    
    # Sort chronologically to do a proper time-based split
    data['date'] = pd.to_datetime(data['date'])
    data = data.sort_values(by='date')
    
    # Time-based train/test split
    # Since data is 2019-01-01 to 2019-12-31, let's use Nov & Dec for testing
    split_date = pd.to_datetime('2019-11-01')
    
    train = data[data['date'] < split_date]
    test = data[data['date'] >= split_date]
    
    features_to_use = [
        'active_vessels', 'vessel_arrivals', 'vessel_departures',
        'arrivals_next_1d', 'arrivals_next_3d_sum',
        'total_berths', 'berth_utilization_ratio'
    ]
    
    target = 'congestion_target'
    
    X_train = train[features_to_use]
    y_train = train[target]
    
    X_test = test[features_to_use]
    y_test = test[target]
    
    print(f"Training on {len(X_train)} samples, Testing on {len(X_test)} samples...")
    
    # Initialize XGBoost Classifier
    # scale_pos_weight helps if the dataset is imbalanced
    pos_weight = (len(y_train) - y_train.sum()) / max(y_train.sum(), 1)
    
    model = xgb.XGBClassifier(
        n_estimators=100,
        max_depth=5,
        learning_rate=0.1,
        scale_pos_weight=pos_weight,
        random_state=42,
        use_label_encoder=False,
        eval_metric='logloss'
    )
    
    print("Training XGBoost model...")
    model.fit(X_train, y_train)
    
    print("Evaluating model...")
    y_pred = model.predict(X_test)
    y_pred_proba = model.predict_proba(X_test)[:, 1]
    
    roc_auc = roc_auc_score(y_test, y_pred_proba)
    acc = accuracy_score(y_test, y_pred)
    
    print("\n--- Model Evaluation ---")
    print(f"ROC-AUC Score: {roc_auc:.4f}")
    print(f"Accuracy: {acc:.4f}")
    print("\nClassification Report:")
    print(classification_report(y_test, y_pred))
    
    # Save the model
    os.makedirs(models_dir, exist_ok=True)
    model_path = os.path.join(models_dir, 'congestion_model.pkl')
    with open(model_path, 'wb') as f:
        pickle.dump(model, f)
    print(f"Model saved to {model_path}")

if __name__ == "__main__":
    train_model("data/processed", "models")
