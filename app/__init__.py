from flask import Flask
from app.routes import api_blueprint
from config import Config

# Creating a Flask app instance
app = Flask(__name__, template_folder=Config.TEMPLATE_DIR, static_folder=Config.STATIC_DIR)

# Register the API blueprint
app.register_blueprint(api_blueprint)