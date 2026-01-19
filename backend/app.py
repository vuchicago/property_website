"""
Flask Backend for Cook County Tax Compare

Run with: flask run --port 5000
"""
import os
from flask import Flask, send_from_directory
from flask_cors import CORS

from api.property_tax import property_tax_bp
from api.roi_calculator import roi_calculator_bp
from api.loan_tool import loan_tool_bp


def create_app():
    app = Flask(__name__, static_folder='..', static_url_path='')
    
    # Enable CORS for all routes
    CORS(app)
    
    # Register API blueprints
    app.register_blueprint(property_tax_bp, url_prefix='/api')
    app.register_blueprint(roi_calculator_bp, url_prefix='/api')
    app.register_blueprint(loan_tool_bp, url_prefix='/api')
    
    # Serve static files from parent directory
    @app.route('/')
    def index():
        return send_from_directory('..', 'index.html')
    
    @app.route('/<path:path>')
    def static_files(path):
        return send_from_directory('..', path)
    
    return app


app = create_app()

if __name__ == '__main__':
    app.run(debug=True, port=5000)
