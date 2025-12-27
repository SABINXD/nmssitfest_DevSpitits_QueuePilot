# from flask import Flask, request, jsonify
# from flask_cors import CORS
# import mysql.connector
# from datetime import datetime
# import os

# app = Flask(__name__)
# CORS(app)

# # MySQL Database Configuration
# DB_CONFIG = {
#     'host': 'localhost',
#     'user': 'root',
#     'password': '',  # Add your MySQL password here
#     'database': 'queuepilot'
# }

# def get_db_connection():
#     """Create and return a database connection"""
#     try:
#         connection = mysql.connector.connect(**DB_CONFIG)
#         return connection
#     except mysql.connector.Error as err:
#         print(f"Database connection error: {err}")
#         return None

# def init_database():
#     """Initialize database and create tables if they don't exist"""
#     try:
#         connection = mysql.connector.connect(
#             host=DB_CONFIG['host'],
#             user=DB_CONFIG['user'],
#             password=DB_CONFIG['password']
#         )
#         cursor = connection.cursor()
        
#         # Create database if it doesn't exist
#         cursor.execute(f"CREATE DATABASE IF NOT EXISTS {DB_CONFIG['database']}")
#         cursor.execute(f"USE {DB_CONFIG['database']}")
        
#         # Create bookings table
#         cursor.execute("""
#             CREATE TABLE IF NOT EXISTS bookings (
#                 id INT AUTO_INCREMENT PRIMARY KEY,
#                 token_number VARCHAR(50) UNIQUE NOT NULL,
#                 customer_name VARCHAR(255) NOT NULL,
#                 phone VARCHAR(20) DEFAULT 'N/A',
#                 problem TEXT NOT NULL,
#                 estimated_time INT NOT NULL,
#                 notification_time DATETIME NOT NULL,
#                 status VARCHAR(50) DEFAULT 'waiting',
#                 created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
#                 updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
#                 INDEX idx_token (token_number),
#                 INDEX idx_status (status),
#                 INDEX idx_created (created_at)
#             )
#         """)
        
#         connection.commit()
#         cursor.close()
#         connection.close()
#         print("Database initialized successfully!")
        
#     except mysql.connector.Error as err:
#         print(f"Database initialization error: {err}")

# @app.route('/api/health', methods=['GET'])
# def health_check():
#     """Health check endpoint"""
#     return jsonify({
#         'status': 'healthy',
#         'timestamp': datetime.now().isoformat()
#     })

# @app.route('/api/bookings', methods=['POST'])
# def create_booking():
#     """Create a new booking"""
#     try:
#         data = request.json
        
#         # Validate required fields
#         required_fields = ['tokenNumber', 'customerName', 'problem', 'estimatedTime', 'notificationTime']
#         for field in required_fields:
#             if field not in data:
#                 return jsonify({'error': f'Missing required field: {field}'}), 400
        
#         connection = get_db_connection()
#         if not connection:
#             return jsonify({'error': 'Database connection failed'}), 500
        
#         cursor = connection.cursor()
        
#         # Insert booking
#         query = """
#             INSERT INTO bookings 
#             (token_number, customer_name, phone, problem, estimated_time, notification_time, status, created_at)
#             VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
#         """
        
#         values = (
#             data['tokenNumber'],
#             data['customerName'],
#             data.get('phone', 'N/A'),
#             data['problem'],
#             data['estimatedTime'],
#             data['notificationTime'],
#             data.get('status', 'waiting'),
#             data.get('createdAt', datetime.now().isoformat())
#         )
        
#         cursor.execute(query, values)
#         connection.commit()
        
#         booking_id = cursor.lastrowid
        
#         cursor.close()
#         connection.close()
        
#         return jsonify({
#             'status': 'success',
#             'message': 'Booking created successfully',
#             'bookingId': booking_id,
#             'tokenNumber': data['tokenNumber']
#         }), 201
        
#     except mysql.connector.Error as err:
#         return jsonify({'error': f'Database error: {str(err)}'}), 500
#     except Exception as e:
#         return jsonify({'error': f'Server error: {str(e)}'}), 500

# @app.route('/api/bookings', methods=['GET'])
# def get_bookings():
#     """Get all bookings"""
#     try:
#         connection = get_db_connection()
#         if not connection:
#             return jsonify({'error': 'Database connection failed'}), 500
        
#         cursor = connection.cursor(dictionary=True)
        
#         # Get query parameters
#         status = request.args.get('status', None)
#         limit = request.args.get('limit', 100)
        
#         # Build query
#         if status:
#             query = "SELECT * FROM bookings WHERE status = %s ORDER BY created_at DESC LIMIT %s"
#             cursor.execute(query, (status, int(limit)))
#         else:
#             query = "SELECT * FROM bookings ORDER BY created_at DESC LIMIT %s"
#             cursor.execute(query, (int(limit),))
        
#         bookings = cursor.fetchall()
        
#         cursor.close()
#         connection.close()
        
#         return jsonify({
#             'status': 'success',
#             'count': len(bookings),
#             'bookings': bookings
#         })
        
#     except mysql.connector.Error as err:
#         return jsonify({'error': f'Database error: {str(err)}'}), 500
#     except Exception as e:
#         return jsonify({'error': f'Server error: {str(e)}'}), 500

# @app.route('/api/bookings/<token_number>', methods=['GET'])
# def get_booking(token_number):
#     """Get a specific booking by token number"""
#     try:
#         connection = get_db_connection()
#         if not connection:
#             return jsonify({'error': 'Database connection failed'}), 500
        
#         cursor = connection.cursor(dictionary=True)
        
#         query = "SELECT * FROM bookings WHERE token_number = %s"
#         cursor.execute(query, (token_number,))
        
#         booking = cursor.fetchone()
        
#         cursor.close()
#         connection.close()
        
#         if booking:
#             return jsonify({
#                 'status': 'success',
#                 'booking': booking
#             })
#         else:
#             return jsonify({'error': 'Booking not found'}), 404
        
#     except mysql.connector.Error as err:
#         return jsonify({'error': f'Database error: {str(err)}'}), 500
#     except Exception as e:
#         return jsonify({'error': f'Server error: {str(e)}'}), 500

# @app.route('/api/bookings/<token_number>', methods=['PUT'])
# def update_booking(token_number):
#     """Update a booking status"""
#     try:
#         data = request.json
        
#         connection = get_db_connection()
#         if not connection:
#             return jsonify({'error': 'Database connection failed'}), 500
        
#         cursor = connection.cursor()
        
#         # Build update query dynamically based on provided fields
#         update_fields = []
#         values = []
        
#         if 'status' in data:
#             update_fields.append("status = %s")
#             values.append(data['status'])
        
#         if 'estimatedTime' in data:
#             update_fields.append("estimated_time = %s")
#             values.append(data['estimatedTime'])
        
#         if not update_fields:
#             return jsonify({'error': 'No fields to update'}), 400
        
#         values.append(token_number)
        
#         query = f"UPDATE bookings SET {', '.join(update_fields)} WHERE token_number = %s"
#         cursor.execute(query, values)
#         connection.commit()
        
#         cursor.close()
#         connection.close()
        
#         return jsonify({
#             'status': 'success',
#             'message': 'Booking updated successfully'
#         })
        
#     except mysql.connector.Error as err:
#         return jsonify({'error': f'Database error: {str(err)}'}), 500
#     except Exception as e:
#         return jsonify({'error': f'Server error: {str(e)}'}), 500

# @app.route('/api/bookings/<token_number>', methods=['DELETE'])
# def delete_booking(token_number):
#     """Delete a booking"""
#     try:
#         connection = get_db_connection()
#         if not connection:
#             return jsonify({'error': 'Database connection failed'}), 500
        
#         cursor = connection.cursor()
        
#         query = "DELETE FROM bookings WHERE token_number = %s"
#         cursor.execute(query, (token_number,))
#         connection.commit()
        
#         cursor.close()
#         connection.close()
        
#         return jsonify({
#             'status': 'success',
#             'message': 'Booking deleted successfully'
#         })
        
#     except mysql.connector.Error as err:
#         return jsonify({'error': f'Database error: {str(err)}'}), 500
#     except Exception as e:
#         return jsonify({'error': f'Server error: {str(e)}'}), 500

# @app.route('/api/stats', methods=['GET'])
# def get_stats():
#     """Get dashboard statistics"""
#     try:
#         connection = get_db_connection()
#         if not connection:
#             return jsonify({'error': 'Database connection failed'}), 500
        
#         cursor = connection.cursor(dictionary=True)
        
#         # Get total bookings
#         cursor.execute("SELECT COUNT(*) as total FROM bookings")
#         total = cursor.fetchone()['total']
        
#         # Get today's bookings
#         cursor.execute("""
#             SELECT COUNT(*) as today FROM bookings 
#             WHERE DATE(created_at) = CURDATE()
#         """)
#         today = cursor.fetchone()['today']
        
#         # Get waiting bookings
#         cursor.execute("SELECT COUNT(*) as waiting FROM bookings WHERE status = 'waiting'")
#         waiting = cursor.fetchone()['waiting']
        
#         # Get completed bookings
#         cursor.execute("SELECT COUNT(*) as completed FROM bookings WHERE status = 'completed'")
#         completed = cursor.fetchone()['completed']
        
#         cursor.close()
#         connection.close()
        
#         return jsonify({
#             'status': 'success',
#             'stats': {
#                 'total': total,
#                 'today': today,
#                 'waiting': waiting,
#                 'completed': completed
#             }
#         })
        
#     except mysql.connector.Error as err:
#         return jsonify({'error': f'Database error: {str(err)}'}), 500
#     except Exception as e:
#         return jsonify({'error': f'Server error: {str(e)}'}), 500

# if __name__ == '__main__':
#     # Initialize database on startup
#     init_database()
    
#     # Run the Flask app
#     app.run(debug=True, host='0.0.0.0', port=5000)