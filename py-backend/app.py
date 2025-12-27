from flask import Flask, request, jsonify, send_file, send_from_directory
from flask_cors import CORS
from io import BytesIO
from gtts import gTTS
import requests

app = Flask(__name__, static_folder='.', static_url_path='')
CORS(app, resources={r"/api/*": {"origins": "*"}})

GROQ_API_KEY = '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'
GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'

@app.route('/')
def home():
    try:
        return send_from_directory('.', 'chat.html')
    except:
        return jsonify({'error': 'chat.html not found', 'status': 'error'}), 404

@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({'status': 'healthy', 'message': 'Backend is running'})

@app.route('/api/chat', methods=['POST', 'OPTIONS'])
def chat():
    if request.method == 'OPTIONS':
        return '', 204
    
    try:
        req_data = request.get_json()
        user_message = req_data['message']
        
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {GROQ_API_KEY}'
        }
        
        payload = {
            "messages": [
                {"role": "system", "content": "You are a helpful AI assistant."},
                {"role": "user", "content": user_message}
            ],
            "model": "llama-3.3-70b-versatile",
            "temperature": 0.7,
            "max_tokens": 1024
        }
        
        print(f"Sending: {user_message}")
        
        resp = requests.post(GROQ_API_URL, headers=headers, json=payload, timeout=30)
        
        print(f"Status: {resp.status_code}")
        
        if resp.status_code == 200:
            json_resp = resp.json()
            bot_msg = json_resp['choices'][0]['message']['content']
            return jsonify({'response': bot_msg, 'status': 'success'})
        else:
            return jsonify({'error': resp.text, 'status': 'error'}), resp.status_code
            
    except Exception as e:
        print(f"Error: {e}")
        return jsonify({'error': str(e), 'status': 'error'}), 500

@app.route('/api/text-to-speech', methods=['POST', 'OPTIONS'])
def text_to_speech():
    if request.method == 'OPTIONS':
        return '', 204
        
    try:
        req_data = request.get_json()
        text_content = req_data['text']
        
        tts = gTTS(text=text_content, lang='en', slow=False)
        audio_buffer = BytesIO()
        tts.write_to_fp(audio_buffer)
        audio_buffer.seek(0)
        
        return send_file(audio_buffer, mimetype='audio/mp3', as_attachment=False, download_name='speech.mp3')
    except Exception as e:
        print(f"TTS error: {e}")
        return jsonify({'error': str(e), 'status': 'error'}), 500

if __name__ == '__main__':
    print("🚀 Server: http://localhost:5000")
    print("💬 Using Groq AI (Llama 3.3 70B) - FREE & FAST!")
    app.run(debug=True, host='0.0.0.0', port=5000)