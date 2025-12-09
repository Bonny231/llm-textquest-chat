from flask import Flask, render_template, request, jsonify, session, redirect, url_for
from models import db, chat_with_llm, ChatHistory
from datetime import datetime, timezone, timedelta
import dotenv

env = dotenv.dotenv_values(".env")
SECRET_KEY = env.get("SECRET_KEY")

app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///site.db"
app.config['SESSION_TYPE'] = 'filesystem'
app.config['SECRET_KEY'] = SECRET_KEY

db.init_app(app)

@app.route("/")
def home():
    # Получаем историю в формате для отображения
    chat_history = []
    entries = ChatHistory.query.order_by(ChatHistory.timestamp.asc()).all()
    
    for entry in entries:
        chat_history.append({
            "sender": entry.role,  # 'user' или 'assistant'
            "text": entry.content,
            "timestamp": entry.timestamp.isoformat()
        })
    
    return render_template("index.html", chat_history=chat_history)

@app.route("/api/history")
def get_chat_history():
    try:
        entries = ChatHistory.query.order_by(ChatHistory.timestamp.asc()).all()
        history = []
        
        for entry in entries:
            history.append({
                "sender": entry.role,  # 'user' или 'assistant'
                "text": entry.content,
                "timestamp": entry.timestamp.isoformat()
            })
        
        return jsonify({
            "success": True, 
            "messages": history,
            "total_count": len(history)
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/chat", methods=["POST"])
def chat():
    try:
        data = request.get_json()
        user_message = data.get("message", "").strip()
        
        if not user_message:
            return jsonify({"success": False, "error": "Сообщение не может быть пустым"}), 400
        
        # Получаем ответ от LLM с историей
        llm_reply = chat_with_llm(
            user_message, 
            use_history=True,
            history_limit=10 
        )
        
        msk_time = datetime.now(timezone.utc).astimezone(timezone(timedelta(hours=3)))
        
        return jsonify({
            "success": True,
            "reply": llm_reply,
            "timestamp": msk_time.isoformat()
        })
        
    except Exception as e:
        print(f"ERROR: {str(e)}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/api/clear", methods=["POST"])
def clear_chat():
    try:
        ChatHistory.query.delete()
        db.session.commit()
        
        return redirect(url_for('home'))
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

if __name__ == "__main__":
    with app.app_context():
        db.create_all()
    app.run(debug=True)