import os
from datetime import datetime
from flask import Blueprint, request, jsonify, render_template
import pandas as pd
import numpy as np
from app.utils import (
    preprocess_data,
    calculate_rfm,
    calculate_price_range_data,
    calculate_top_performance_trend_data,
    calculate_revenue_by_country,
    calculate_monthly_sales_trend
)
from app.model import load_model, apply_model
from config import Config

# Blueprint for API routes
api_blueprint = Blueprint("api", __name__)

@api_blueprint.route("/", methods=["GET"])
def home():
    """Render the home page."""
    return render_template("index.html")

@api_blueprint.route('/upload', methods=['POST'])
def upload_file():
    """Handle file upload and process user data."""
    try:
        if 'file' not in request.files:
            return 'No file uploaded', 400
        
        file = request.files['file']
        if file.filename == '':
            return 'No selected file', 400
        
        # Load user data into a DataFrame
        user_data = pd.read_csv(file, encoding='ISO-8859-1')
        user_data.columns = user_data.columns.str.strip()

        # Preprocess data and calculate RFM metrics
        user_data = preprocess_data(user_data)
        rfm_data = calculate_rfm(user_data)

        # Load the pre-trained model and predict clusters
        model = load_model()
        clusters = apply_model(model, rfm_data)

        if isinstance(clusters, np.ndarray):
            cluster_list = clusters.tolist()
        else:
            cluster_list = clusters

        # Prepare additional data for analysis
        price_range_data = calculate_price_range_data(user_data)
        top_performance_trend_data = calculate_top_performance_trend_data(user_data)
        revenue_data = calculate_revenue_by_country(user_data)
        monthly_sales_trend = calculate_monthly_sales_trend(user_data)

        print(top_performance_trend_data, " top_performance_trend_data") 

        # Prepare results for the response
        results = {
            "rfm_metrics": {
                "recency_scaled": rfm_data["Recency_Scaled"].tolist(),
                "frequency_scaled": rfm_data["Frequency_Scaled"].tolist(),
                "monetary_scaled": rfm_data["Monetary_Scaled"].tolist(),
            },
            "cluster_labels": cluster_list,
            "price_range_data": price_range_data,
            "top_performance_trend_data": top_performance_trend_data,
            "revenue_by_country": revenue_data,
            "monthly_sales_trend": monthly_sales_trend
        }

        return jsonify(results)

    except Exception as e:
        print("Error processing file:", e)
        return f"An error occurred while processing the file: {str(e)}", 500