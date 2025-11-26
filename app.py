# Copyright (c) 2025 William y Angel.
# All rights reserved.

import sqlite3
import json
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

DATABASE = 'polygons.db'

def get_db():
    conn = sqlite3.connect(DATABASE)
    return conn

def create_table():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS polygons (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            points TEXT NOT NULL
        )
        """
    )
    conn.commit()
    conn.close()

@app.route('/polygons', methods=['GET', 'POST'])
def handle_polygons():
    conn = get_db()
    cursor = conn.cursor()

    if request.method == 'POST':
        data = request.get_json()
        points = data.get('points')
        name = data.get('name')

        if not points or not name:
            return jsonify({'error': 'Faltan datos (puntos o nombre)'}), 400

        # Convert points list to a JSON string for storage
        points_json = json.dumps(points)

        cursor.execute("INSERT INTO polygons (name, points) VALUES (?, ?)", (name, points_json))
        conn.commit()
        polygon_id = cursor.lastrowid
        conn.close()
        return jsonify({'message': 'Polígono guardado con éxito', 'id': polygon_id}), 201

    if request.method == 'GET':
        cursor.execute("SELECT id, name, points FROM polygons ORDER BY id DESC")
        polygons = cursor.fetchall()
        conn.close()
        
        polygon_list = []
        for poly in polygons:
            polygon_list.append({
                'id': poly[0],
                'name': poly[1],
                'points': json.loads(poly[2]) # Convert JSON string back to list
            })
            
        return jsonify(polygon_list)

@app.route('/polygons/<int:polygon_id>', methods=['DELETE'])
def delete_polygon(polygon_id):
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT id FROM polygons WHERE id = ?", (polygon_id,))
    polygon = cursor.fetchone()

    if polygon is None:
        conn.close()
        return jsonify({'error': 'Polígono no encontrado'}), 404

    cursor.execute("DELETE FROM polygons WHERE id = ?", (polygon_id,))
    conn.commit()
    conn.close()
    return jsonify({'message': 'Polígono eliminado con éxito'}), 200

if __name__ == '__main__':
    create_table()
    app.run(debug=True, port=5001)
