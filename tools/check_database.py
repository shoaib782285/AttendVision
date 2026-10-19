import sqlite3
from pathlib import Path


DB_PATH = Path(__file__).resolve().parent.parent / "attendance.db"


with sqlite3.connect(DB_PATH) as connection:
    tables = connection.execute(
        """
        SELECT name
        FROM sqlite_master
        WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
        ORDER BY name
        """
    ).fetchall()

print(f"SQLite database: {DB_PATH}")
print("Connection successful.")
print("Tables:", ", ".join(row[0] for row in tables) or "none")
