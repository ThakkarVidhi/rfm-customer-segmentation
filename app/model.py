import pickle
from config import Config

def load_model():
    """Load the pre-trained model from the specified path."""
    with open(Config.MODEL_PATH, 'rb') as file:
        model = pickle.load(file)
        return model

def apply_model(model, rfm_data):
    """Apply the clustering model to the RFM data to predict cluster labels."""
    rfm_values = rfm_data[['Recency_Scaled', 'Frequency_Scaled', 'Monetary_Scaled']]
    cluster_labels = model.predict(rfm_values)
    return cluster_labels