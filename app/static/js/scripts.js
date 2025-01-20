document.addEventListener('DOMContentLoaded', () => {
    const uploadSection = document.getElementById('uploadSection');
    const uploadForm = document.getElementById('uploadForm');
    const fileInput = document.getElementById('fileInput');
    const loader = document.getElementById('loader');
    const overlay = document.getElementById('overlay');
    const chartsSection = document.getElementById('charts-section');
    const errorMessage = document.getElementById('error-message');
    const analyzeAgainSection = document.getElementById('analyze-again-section');
    const analyzeAgainButton = document.getElementById('analyzeAgainButton');

    // Handle file upload form submission
    uploadForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        if (!fileInput.files[0]) {
            errorMessage.textContent = 'Please select a file.';
            return;
        }

        // Show loader, hide upload section
        toggleVisibility(uploadSection, false);
        toggleVisibility(analyzeAgainSection, false);
        toggleVisibility(loader, true);
        toggleVisibility(overlay, true);
        toggleVisibility(chartsSection, false);
        errorMessage.textContent = '';

        const formData = new FormData();
        formData.append('file', fileInput.files[0]);

        try {
            const response = await fetch('/upload', { method: 'POST', body: formData });
            if (!response.ok) throw new Error(await response.text());

            const result = await response.json();
            toggleVisibility(loader, false);
            toggleVisibility(overlay, false);
            toggleVisibility(chartsSection, true);
            toggleVisibility(analyzeAgainSection, true);

            renderCharts(result);
        } catch (error) {
            toggleVisibility(loader, false);
            toggleVisibility(overlay, false);
            errorMessage.textContent = `Error: ${error.message}`;
            toggleVisibility(analyzeAgainSection, true);
        }
    });

    // Reset state when "Analyze Again" button is clicked
    analyzeAgainButton.addEventListener('click', () => {
        toggleVisibility(uploadSection, true);
        uploadForm.reset();
        fileInput.value = '';
        errorMessage.textContent = '';
        toggleVisibility(chartsSection, false);
        toggleVisibility(analyzeAgainSection, false);
    });
});

// Helper function to toggle visibility of elements
function toggleVisibility(element, show) {
    element.style.display = show ? 'block' : 'none';
}

// Function to render charts based on the uploaded data
function renderCharts(data) {
    if (!data || !data.rfm_metrics || !data.cluster_labels || !data.price_range_data || !data.top_performance_trend_data || !data.revenue_by_country || !data.monthly_sales_trend) return;

    const { recency_scaled, frequency_scaled, monetary_scaled } = data.rfm_metrics;
    const clusterLabels = data.cluster_labels;
    const clusterCounts = getClusterCounts(clusterLabels);
    const hoverTexts = calculateHoverTexts(clusterCounts);

    // Render customer segmentation pie chart
    renderPieChart(clusterCounts, hoverTexts);

    // Render radar chart for RFM metrics
    renderRadarChart(recency_scaled, frequency_scaled, monetary_scaled);

    // Render price range donut chart
    renderDonutChart(data.price_range_data);

    // Render revenue by country map
    renderRevenueByCountryMap(data.revenue_by_country);

    // Render monthly sales trend line chart
    renderSalesTrendChart(data.monthly_sales_trend);

    // Render top performance trends for products and customers
    renderTopPerformanceTrends(data.top_performance_trend_data);
}

// Calculate the count of each cluster
function getClusterCounts(clusterLabels) {
    return clusterLabels.reduce((acc, cluster) => {
        acc[cluster] = (acc[cluster] || 0) + 1;
        return acc;
    }, {});
}

// Calculate hover text for pie chart
function calculateHoverTexts(clusterCounts) {
    const total = Object.values(clusterCounts).reduce((sum, value) => sum + value, 0);
    return Object.keys(clusterCounts).map(cluster => {
        const size = clusterCounts[cluster];
        const percentage = ((size / total) * 100).toFixed(2);
        return `Cluster ${cluster}<br>Cluster Size: ${size}<br>Percentage of Total Data: ${percentage}%`;
    });
}

// Render Pie Chart for customer segmentation
function renderPieChart(clusterCounts, hoverTexts) {
    const pieData = [{
        values: Object.values(clusterCounts),
        labels: Object.keys(clusterCounts).map(cluster => `Cluster ${cluster}`),
        type: 'pie',
        textinfo: 'label+percent',
        hoverinfo: 'text',
        text: hoverTexts
    }];

    const pieLayout = { margin: { t: 40, b: 20 }, width: '100%' };
    const pieChart = document.getElementById('pieChart');
    Plotly.newPlot(pieChart, pieData, pieLayout);

    pieChart.on('plotly_restyle', (eventData) => {
        const visibleValues = eventData[0]?.values[0];
        if (visibleValues) {
            const updatedHoverTexts = calculateHoverTexts(visibleValues);
            Plotly.restyle(pieChart, { text: [updatedHoverTexts] });
        }
    });
}

// Render Radar Chart for RFM metrics
function renderRadarChart(recency_scaled, frequency_scaled, monetary_scaled) {
    const radarData = [{
        type: 'scatterpolar',
        r: [average(recency_scaled), average(frequency_scaled), average(monetary_scaled)],
        theta: ['Recency', 'Frequency', 'Monetary'],
        fill: 'toself',
        name: 'Average'
    }];

    const radarLayout = {
        polar: { radialaxis: { visible: true, title: { text: 'Average Value' }, tickfont: { size: 12 } }, angularaxis: { tickfont: { size: 12 } } },
        margin: { t: 40, b: 20 },
        width: '100%'
    };

    Plotly.newPlot('radarChart', radarData, radarLayout);
}

// Render Donut Chart for price range
function renderDonutChart({ labels, values, colors }) {
    const donutData = [{
        values,
        labels,
        type: 'pie',
        hole: 0.5,
        marker: { colors },
        textinfo: 'label+percent',
        hoverinfo: 'label+percent',
        textposition: 'inside',
        textfont: { size: 12, color: '#FFFFFF' }
    }];

    const donutLayout = {
        margin: { t: 40, b: 20 },
        width: '100%',
        showlegend: true,
        legend: {
            orientation: 'v',
            x: 1.3,
            y: 0.9,
            xanchor: 'left',
            yanchor: 'top',
            font: { size: 12, color: '#333333' }
        },
        annotations: [{
            font: { size: 14, color: '#333333' },
            showarrow: false,
            text: 'Price Categories',
            x: 0.5,
            y: 0.5
        }]
    };

    Plotly.newPlot('priceRangeChart', donutData, donutLayout);
}

// Render revenue by country map
function renderRevenueByCountryMap({ countries, revenues, log_revenues, quantities }) {
    const mapData = [{
        type: 'choropleth',
        locationmode: 'country names',
        locations: countries,
        z: log_revenues,
        text: countries.map((country, i) =>
            `${country}<br>Log Revenue: ${log_revenues[i].toFixed(2)}<br>Total Revenue: ${revenues[i].toFixed(2)}<br>Total Quantity: ${quantities[i]}`
        ),
        colorscale: 'Viridis',
        colorbar: { title: 'Log-Transformed Revenue', titleside: 'right' },
        hoverinfo: 'location+z+text'
    }];

    const mapLayout = {
        title: 'Revenue by Country (Log-Transformed)',
        geo: { projection: { type: 'mercator' } },
        margin: { t: 40, b: 20, l: 100 }
    };

    Plotly.newPlot("revenueByCountryMap", mapData, mapLayout);
}

// Render Monthly Sales Trend Line Chart
function renderSalesTrendChart({ labels, values }) {
    const salesTrendData = [{
        x: labels,
        y: values,
        type: 'scatter',
        mode: 'lines+markers',
        marker: { color: '#1f77b4', size: 6 },
        line: { width: 2 },
        hovertemplate: 'Month-Year: %{x}<br>Total Sales: %{y:.2f}',
        text: values,
        textposition: 'top center'
    }];

    const salesTrendLayout = {
        xaxis: { title: 'Month-Year', tickangle: -45, automargin: true },
        yaxis: { title: 'Total Sales', tickformat: ',.2f', automargin: true },
        margin: { t: 40, b: 20, l: 100 },
        showlegend: false
    };

    Plotly.newPlot('monthlySalesTrendChart', salesTrendData, salesTrendLayout);
}

// Render top performance trends for products and customers
function renderTopPerformanceTrends({ top_customers, top_products_sales, top_products_returns }) {
    renderTopProductsSalesChart(top_products_sales);
    renderTopProductsReturnsChart(top_products_returns);
    renderTopCustomersChart(top_customers);
}

// Render bar chart for top products by sales volume
function renderTopProductsSalesChart({ labels, values }) {
    const productSalesData = [{
        x: values,
        y: labels,
        type: 'bar',
        orientation: 'h',
        marker: { color: generateColorRange(10, 'rgba(255, 165, 0, ') },
        hovertemplate: 'Product: %{y}<br>Number of Sales: %{x}',
        text: values,
        textposition: 'outside',
        textfont: { size: 10 },
        width: 0.5
    }];

    const productSalesLayout = {
        xaxis: { title: 'Number of Sales', tickformat: ',', automargin: true },
        yaxis: { title: 'Product Description (StockCode)', automargin: true },
        margin: { t: 40, b: 20, l: 100 },
        barmode: 'group',
        showlegend: false
    };

    Plotly.newPlot('topProductsSalesChart', productSalesData, productSalesLayout);
}

// Render bar chart for top products by return rate
function renderTopProductsReturnsChart({ labels, values }) {
    const productReturnsData = [{
        x: values,
        y: labels,
        type: 'bar',
        orientation: 'h',
        marker: { color: generateColorRange(10, 'rgba(220, 20, 60, ') },
        hovertemplate: 'Product: %{y}<br>Number of Returns: %{x}',
        text: values,
        textposition: 'outside',
        textfont: { size: 10 },
        width: 0.5
    }];

    const productReturnsLayout = {
        xaxis: { title: 'Number of Returns', tickformat: ',', automargin: true },
        yaxis: { title: 'Product Description (StockCode)', automargin: true },
        margin: { t: 40, b: 20, l: 100 },
        barmode: 'group',
        showlegend: false
    };

    Plotly.newPlot('topProductsReturnsChart', productReturnsData, productReturnsLayout);
}

// Render bar chart for top customers by product count
function renderTopCustomersChart({ labels, values }) {
    const sortedData = labels.map((id, index) => ({ id, count: values[index] }))
        .sort((a, b) => b.count - a.count);

    const customerData = [{
        x: sortedData.map(item => item.id),
        y: sortedData.map(item => item.count),
        type: 'bar',
        marker: { color: ['#3b6cb7', '#5b84c9', '#7a9cda', '#9ab4eb', '#bacedc', '#dab6cd', '#e79eaf', '#f38691', '#fa6e73', '#ff5645']},
        hovertemplate: 'CustomerID: %{x}<br>Number of Products Bought: %{y}',
        text: sortedData.map(item => item.count),
        textposition: 'outside',
        textfont: { size: 12 },
        width: 0.6
    }];

    const customerLayout = {
        xaxis: {
            title: 'Customer Identification (CustomerID)',
            type: 'category',
            tickmode: 'array',
            tickvals: sortedData.map(item => item.id),
            ticktext: sortedData.map(item => item.id),
            automargin: true
        },
        yaxis: { title: 'Number of Products Bought', tickformat: ',', automargin: true },
        margin: { t: 40, b: 20, l: 100 },
        barmode: 'group',
        showlegend: false
    };

    Plotly.newPlot('topCustomersChart', customerData, customerLayout);
}

// Generate a color range for charts
function generateColorRange(count, baseColor) {
    return Array(count).fill().map((_, index) => `${baseColor}${(index + 1) / count})`);
}

// Calculate the average of an array
function average(array) {
    return array.reduce((sum, value) => sum + value, 0) / array.length;
}

function toggleDescription(descriptionId) {
    const descriptionDiv = document.getElementById(descriptionId);
    const toggleButton = descriptionDiv.previousElementSibling.querySelector('.toggle-description');
    
    if (descriptionDiv.style.display === "none" || descriptionDiv.style.display === "") {
        descriptionDiv.style.display = "block";
        toggleButton.querySelector('.toggle-text').textContent = "Hide Information";
        toggleButton.querySelector('.toggle-icon').textContent = "▲";
    } else {
        descriptionDiv.style.display = "none";
        toggleButton.querySelector('.toggle-text').textContent = "View Information";
        toggleButton.querySelector('.toggle-icon').textContent = "▼";
    }
}