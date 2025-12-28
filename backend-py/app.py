from flask import Flask, render_template, request, jsonify, send_from_directory, Response
from flask_cors import CORS
import sqlite3
import os
from datetime import datetime
import requests
from dotenv import load_dotenv

app = Flask(__name__, static_folder='public', template_folder='templates')
CORS(app)
load_dotenv()
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")
ELEVENLABS_VOICE_ID = os.getenv("ELEVENLABS_VOICE_ID")
ELEVENLABS_STT_API_KEY = os.getenv("ELEVENLABS_STT_API_KEY")

DB_PATH = os.path.join(os.path.dirname(__file__), 'database', 'queuepilot.db')

def init_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS tokens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            token_id TEXT UNIQUE NOT NULL,
            purpose TEXT NOT NULL,
            name TEXT NOT NULL,
            phone TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            status TEXT DEFAULT 'waiting'
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS daily_stats (
            date TEXT PRIMARY KEY,
            token_count INTEGER DEFAULT 0
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS ratings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            token_id TEXT NOT NULL,
            rating INTEGER NOT NULL,
            feedback TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    conn.commit()
    conn.close()

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def get_today_token_count():
    conn = get_db_connection()
    today = datetime.now().strftime('%Y-%m-%d')
    cursor = conn.cursor()
    cursor.execute('SELECT token_count FROM daily_stats WHERE date = ?', (today,))
    result = cursor.fetchone()
    conn.close()
    return result['token_count'] if result else 0

def increment_token_count():
    conn = get_db_connection()
    today = datetime.now().strftime('%Y-%m-%d')
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO daily_stats (date, token_count) VALUES (?, 1)
        ON CONFLICT(date) DO UPDATE SET token_count = token_count + 1
    ''', (today,))
    conn.commit()
    conn.close()

def generate_token_id():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT MAX(CAST(SUBSTR(token_id, 5) AS INTEGER)) as max_id FROM tokens')
    result = cursor.fetchone()
    conn.close()
    
    next_id = 1 if not result['max_id'] else result['max_id'] + 1
    return f"#QP-{next_id}"

@app.route('/pics/<path:filename>')
def serve_pics(filename):
    return send_from_directory('pics', filename)

@app.route('/')
def index():
    return render_template('form.html')

@app.route('/rating')
def rating():
    return render_template('rating.html')

@app.route('/final')
def final():
    return render_template('final.html')

@app.route('/admin')
def admin():
    return send_from_directory('public/admin', 'index.html')

@app.route('/api/check-limit', methods=['GET'])
def check_limit():
    try:
        today_count = get_today_token_count()
        return jsonify({
            'count': today_count,
            'limit': 500,
            'available': 500 - today_count,
            'limit_reached': today_count >= 500
        })
    except Exception as e:
        print(f"Error in check-limit: {str(e)}")
        return jsonify({
            'error': str(e),
            'limit_reached': False
        }), 500

@app.route('/api/create-token', methods=['POST'])
def create_token():
    try:
        data = request.json
        print(f"Received token creation request: {data}")
        
        today_count = get_today_token_count()
        if today_count >= 500:
            return jsonify({
                'success': False,
                'error': 'Daily token limit reached'
            }), 429
        
        if not all(key in data for key in ['purpose', 'name', 'phone']):
            return jsonify({
                'success': False,
                'error': 'Missing required fields'
            }), 400
        
        token_id = generate_token_id()
        
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO tokens (token_id, purpose, name, phone)
            VALUES (?, ?, ?, ?)
        ''', (token_id, data['purpose'], data['name'], data['phone']))
        conn.commit()
        increment_token_count()
        conn.close()
        
        print(f"Token created successfully: {token_id}")
        
        return jsonify({
            'success': True,
            'token_id': token_id,
            'count': get_today_token_count()
        })
    except Exception as e:
        print(f"Error in create-token: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/tokens', methods=['GET'])
def get_tokens():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('''
            SELECT token_id, purpose, name, phone, created_at, status
            FROM tokens
            ORDER BY created_at DESC
        ''')
        tokens = [dict(row) for row in cursor.fetchall()]
        conn.close()
        
        print(f"Returning {len(tokens)} tokens")
        
        return jsonify({
            'tokens': tokens,
            'today_count': get_today_token_count(),
            'limit': 500
        })
    except Exception as e:
        print(f"Error in tokens: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'error': str(e),
            'tokens': [],
            'today_count': 0,
            'limit': 500
        }), 500

@app.route('/api/update-status', methods=['POST'])
def update_status():
    try:
        data = request.json
        token_id = data.get('token_id')
        status = data.get('status')
        
        print(f"Updating status for {token_id} to {status}")
        
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('UPDATE tokens SET status = ? WHERE token_id = ?', (status, token_id))
        conn.commit()
        conn.close()
        
        return jsonify({'success': True})
    except Exception as e:
        print(f"Error in update-status: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/speech-to-text', methods=['POST'])
def speech_to_text():
    try:
        if 'audio' not in request.files:
            return jsonify({'success': False, 'error': 'No audio file provided'}), 400
        
        audio_file = request.files['audio']
        language = request.form.get('language', 'en')
        
        print(f"STT Request - Language: {language}")
        
        url = "https://api.elevenlabs.io/v1/speech-to-text"
        
        headers = {
            "xi-api-key": ELEVENLABS_STT_API_KEY
        }
        
        audio_data = audio_file.read()
        
        files = {
            'file': ('audio.webm', audio_data, 'audio/webm')
        }
        
        data = {
            'model_id': 'scribe_v2'
        }
        
        print(f"Making request to Eleven Labs STT API...")
        response = requests.post(url, headers=headers, files=files, data=data, timeout=30)
        
        print(f"Eleven Labs STT Response Status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            text = result.get('text', '')
            print(f"Recognized text: {text}")
            return jsonify({'success': True, 'text': text})
        else:
            error_text = response.text
            print(f"Eleven Labs STT API Error: {error_text}")
            return jsonify({'success': False, 'error': f'STT error: {response.status_code}'}), 500
            
    except Exception as e:
        print(f"STT Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/text-to-speech', methods=['POST'])
def text_to_speech():
    try:
        data = request.json
        text = data.get('text', '')
        language = data.get('language', 'en')
        
        if not text:
            return jsonify({'success': False, 'error': 'No text provided'}), 400
        
        voice_id = "21m00Tcm4TlvDq8ikWAM" if language == 'ne' else ELEVENLABS_VOICE_ID
        
        url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
        
        headers = {
            "Accept": "audio/mpeg",
            "Content-Type": "application/json",
            "xi-api-key": ELEVENLABS_API_KEY
        }
        
        payload = {
            "text": text,
            "model_id": "eleven_multilingual_v2",
            "voice_settings": {
                "stability": 0.5,
                "similarity_boost": 0.75,
                "style": 0.0,
                "use_speaker_boost": True
            }
        }
        
        response = requests.post(url, json=payload, headers=headers, timeout=30)
        
        if response.status_code == 200:
            return Response(response.content, mimetype='audio/mpeg', headers={
                'Content-Type': 'audio/mpeg',
                'Cache-Control': 'no-cache',
                'Access-Control-Allow-Origin': '*'
            })
        else:
            return jsonify({'success': False, 'error': f'ElevenLabs error: {response.status_code}'}), 500
            
    except Exception as e:
        print(f"TTS Error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/submit-rating', methods=['POST'])
def submit_rating():
    try:
        data = request.json
        token_id = data.get('token_id')
        rating = data.get('rating')
        feedback = data.get('feedback', '')
        
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO ratings (token_id, rating, feedback)
            VALUES (?, ?, ?)
        ''', (token_id, rating, feedback))
        conn.commit()
        conn.close()
        
        return jsonify({'success': True})
    except Exception as e:
        print(f"Error in submit-rating: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

if __name__ == '__main__':
    init_db()
    print("Database initialized")
    print("Server starting on http://localhost:5000")
    print("Admin dashboard: http://localhost:5000/admin")
    app.run(debug=True, host='0.0.0.0', port=5000)