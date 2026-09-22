import os
from dotenv import load_dotenv

# Load environment variables FIRST
load_dotenv(override=True)

from flask import Flask, request
from db import init_db
from middleware.request_logger import register_request_logger
from routes.ai_schema import ai_schema_bp
from routes.create import create_bp
from routes.interceptor import interceptor_bp
from routes.logs import logs_bp
from routes.mock import mock_bp
from routes.namespace import namespace_bp

app = Flask(__name__, static_folder="static", static_url_path="")

with app.app_context():
    init_db()


# Handle CORS preflight globally
@app.before_request
def handle_options_preflight():
    if request.method == "OPTIONS":
        response = app.make_default_options_response()
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-MockDock-Token, X-Namespace-Token"
        return response


# Apply CORS headers on every response
@app.after_request
def apply_cors(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-MockDock-Token, X-Namespace-Token"
    return response


# Blueprints
app.register_blueprint(ai_schema_bp)
app.register_blueprint(create_bp)
app.register_blueprint(mock_bp)
app.register_blueprint(interceptor_bp)
app.register_blueprint(namespace_bp)
app.register_blueprint(logs_bp)

register_request_logger(app)


@app.route("/")
def landing():
    return app.send_static_file("landing.html")


@app.route("/app")
def app_page():
    return app.send_static_file("app.html")


if __name__ == "__main__":
    app.run(debug=True)