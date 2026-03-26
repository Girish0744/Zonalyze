from sqlalchemy import text
from app.db.session import engine


def test_database_connection():
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return True, "Database connection successful"
    except Exception as e:
        return False, str(e)