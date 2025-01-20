import pandas as pd
import numpy as np
import datetime as dt
from sklearn.preprocessing import StandardScaler

def preprocess_data(user_data):
    """Preprocess user data for RFM analysis."""
    required_columns = ['CustomerID', 'InvoiceDate']
    
    if not all(column in user_data.columns for column in required_columns):
        raise ValueError("Data must contain 'CustomerID' and 'InvoiceDate' columns.")
    
    if 'TotalPrice' not in user_data.columns:
        if 'Quantity' in user_data.columns and 'UnitPrice' in user_data.columns:
            user_data['TotalPrice'] = user_data['Quantity'] * user_data['UnitPrice']
        else:
            raise ValueError("Data must contain 'TotalPrice' or both 'Quantity' and 'UnitPrice' columns.")
    
    user_data['InvoiceDate'] = pd.to_datetime(user_data['InvoiceDate'], format='%d/%m/%Y %H:%M', errors='coerce')
    
    return user_data

def calculate_rfm(user_data):
    """Calculate RFM metrics from user data."""
    reference_date = dt.datetime.now()
    
    rfm_data = user_data.groupby('CustomerID').agg({
        'InvoiceDate': lambda x: (reference_date - x.max()).days,
        'CustomerID': 'count',
        'TotalPrice': 'sum'
    }).rename(columns={
        'InvoiceDate': 'Recency',
        'CustomerID': 'Frequency',
        'TotalPrice': 'Monetary'
    }).reset_index()

    # Log transformation for skewed data
    rfm_transformed = log_transform(rfm_data)

    # Remove outliers
    rfm_transformed = remove_outliers(rfm_transformed)

    # Scale the features
    rfm_scaled_df = scale_features(rfm_transformed[['Recency', 'Frequency', 'Monetary']])
    
    return pd.concat([rfm_transformed['CustomerID'].reset_index(drop=True), rfm_scaled_df], axis=1)

def log_transform (rfm_data):
    """Apply log transformation to RFM metrics if skewness is high."""
    skewness = rfm_data[['Recency', 'Frequency', 'Monetary']].skew()
    for column in ['Recency', 'Frequency', 'Monetary']:
        if skewness[column] > 0.5:
            rfm_data[column] = np.log1p(rfm_data[column])
    return rfm_data

def remove_outliers(rfm_data):
    """Remove outliers from RFM metrics using the IQR method."""
    for column in ['Recency', 'Frequency', 'Monetary']:
        Q1 = rfm_data[column].quantile(0.25)
        Q3 = rfm_data[column].quantile(0.75)
        IQR = Q3 - Q1
        lower_bound = Q1 - 1.5 * IQR
        upper_bound = Q3 + 1.5 * IQR
        rfm_data = rfm_data[(rfm_data[column] >= lower_bound) & (rfm_data[column] <= upper_bound)]
    return rfm_data

def scale_features(features):
    """Scale features using StandardScaler."""
    scaler = StandardScaler()
    scaled_values = scaler.fit_transform(features)
    return pd.DataFrame(scaled_values, columns=['Recency_Scaled', 'Frequency_Scaled', 'Monetary_Scaled'])

def calculate_price_range_data(user_data):
    """Categorize total price into defined ranges and count occurrences."""
    bins = [0, 50, 100, 500, 1000, user_data['TotalPrice'].max()]
    labels = ['Low (0-50)', 'Medium (50-100)', 'High (100-500)', 'Very High (500-1000)', 'Extremely High (1000+)']
    colors = ['midnightblue', 'darkmagenta', 'indianred', 'tomato', 'lightsalmon']

    user_data['PriceCategory'] = pd.cut(user_data['TotalPrice'], bins=bins, labels=labels)
    price_category_count = user_data['PriceCategory'].value_counts()

    return {
        "labels": price_category_count.index.tolist(),
        "values": price_category_count.values.tolist(),
        "colors": colors
    }

def calculate_top_performance_trend_data(user_data):
    """Calculate top performance trends in sales and returns."""
    
    # Ensure required columns are present
    required_columns = ['CustomerID', 'StockCode', 'Quantity', 'UnitPrice', 'Description']
    if not all(col in user_data.columns for col in required_columns):
        raise ValueError(f"Missing one or more required columns: {', '.join(required_columns)}")

    # Separate returns and keep only positive quantities
    returns = user_data[user_data['Quantity'] < 0]
    user_data = user_data[user_data['Quantity'] > 0]

    # Initialize return rate data
    returns_rate_data = {'labels': [], 'values': []}

    if not returns.empty:
        # Calculate total returns and sales for each product
        returns_summary = returns.groupby('StockCode')['Quantity'].sum().abs()
        sales_summary = user_data.groupby('StockCode')['Quantity'].sum()

        # Merge returns and sales data to calculate return rates
        return_rate_df = returns_summary.to_frame(name='TotalReturns').join(
            sales_summary.to_frame(name='TotalSales'), how='inner'
        )
        return_rate_df['ReturnRate'] = return_rate_df['TotalReturns'] / return_rate_df['TotalSales']
        top_returns = return_rate_df.nlargest(10, 'ReturnRate')

        # Filter out invalid stock codes and prepare return rate data
        top_returns = top_returns[top_returns.index.str.contains(r'^[^?]*$', na=False)].dropna()
        top_returns_desc = user_data[user_data['StockCode'].isin(top_returns.index)].dropna(subset=['Description'])
        top_returns_desc['Label'] = top_returns_desc['Description'] + ' (' + top_returns_desc['StockCode'] + ')'
        top_returns_desc = top_returns_desc.drop_duplicates(subset=['Label'])

        # Sort return rates in ascending order
        sorted_top_returns = top_returns.sort_values(by='ReturnRate', ascending=True)

        returns_rate_data = {
            'labels': top_returns_desc['Label'].tolist()[:10],  # Limit to top 10
            'values': sorted_top_returns['ReturnRate'].tolist()[:10]  # Limit to top 10
        }

    # Calculate top 10 customers based on quantity purchased
    top_customers = user_data.groupby('CustomerID')['Quantity'].sum().nlargest(10).sort_index()

    # Calculate top 10 products by sales volume
    top_products_sales = user_data.groupby('StockCode')['Quantity'].sum().nlargest(10)
    top_products_sales = top_products_sales[top_products_sales.index.str.contains(r'^[^?]*$', na=False)].dropna()

    # Get product descriptions for top products by sales
    top_products_sales_desc = user_data[user_data['StockCode'].isin(top_products_sales.index)].dropna(subset=['Description'])
    top_products_sales_desc['Label'] = top_products_sales_desc['Description'] + ' (' + top_products_sales_desc['StockCode'] + ')'
    top_products_sales_desc = top_products_sales_desc.drop_duplicates(subset=['Label'])

    # Sort sales data in ascending order
    sorted_top_products_sales = top_products_sales.sort_values(ascending=True)

    return {
        'top_customers': {
            'labels': top_customers.index.tolist(),
            'values': top_customers.values.tolist()
        },
        'top_products_sales': {
            'labels': top_products_sales_desc['Label'].tolist()[:10],  # Limit to top 10
            'values': sorted_top_products_sales.values.tolist()[:10]  # Limit to top 10
        },
        'top_products_returns': returns_rate_data
    }

def calculate_revenue_by_country(user_data):
    """Calculate total revenue and quantity sold by country."""
    user_data['Revenue'] = user_data['Quantity'] * user_data['UnitPrice']
    revenue_by_country = user_data.groupby('Country').agg({
        'Revenue': 'sum',
        'Quantity': 'sum'
    }).reset_index()

    revenue_by_country['Log_Revenue'] = np.log1p(revenue_by_country['Revenue'])

    return {
        'countries': revenue_by_country['Country'].tolist(),
        'revenues': revenue_by_country['Revenue'].tolist(),
        'log_revenues': revenue_by_country['Log_Revenue'].tolist(),
        'quantities': revenue_by_country['Quantity'].tolist()
    }

def calculate_monthly_sales_trend(user_data):
    """Calculate monthly sales trends from user data."""
    # Create a copy of the input DataFrame to avoid modifying the original data
    user_data = user_data.copy()

    # Convert InvoiceDate to datetime and drop rows with invalid or missing dates
    user_data['InvoiceDate'] = pd.to_datetime(user_data['InvoiceDate'], errors='coerce')
    user_data = user_data.dropna(subset=['InvoiceDate'])

    # Extract year and month as separate columns for grouping
    user_data['Year'] = user_data['InvoiceDate'].dt.year
    user_data['Month'] = user_data['InvoiceDate'].dt.month

    # Processing the Month column
    user_data = user_data.dropna(subset=['Month']) 
    user_data['Month'] = user_data['Month'].astype(int)

    # Group by year and month, then calculate the total sales
    monthly_sales = user_data.groupby(['Year', 'Month'])['TotalPrice'].sum().reset_index()

    # Format the Year-Month data into a single column for labeling
    monthly_sales['MonthYear'] = monthly_sales.apply(
        lambda row: f"{int(row['Year'])}-{int(row['Month']):02d}", axis=1
    )

    return {
        "labels": monthly_sales['MonthYear'].tolist(),
        "values": monthly_sales['TotalPrice'].tolist()
    }
