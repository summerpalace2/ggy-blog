import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";

const url = process.env.DATABASE_URL || "";
let pool: mysql.Pool | null = null;

function getPool(): mysql.Pool {
  if (!pool) {
    pool = mysql.createPool({ uri: url, ssl: { rejectUnauthorized: false }, connectionLimit: 1, connectTimeout: 15000, waitForConnections: false });
  }
  return pool;
}

export async function query<T = any>(sql: string, params?: any[]): Promise<T[]> {
  const [rows] = await getPool().execute(sql, params);
  return rows as T[];
}

export async function initDb() {
  const p = getPool();
  await p.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(100) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      role ENUM('user','admin') NOT NULL DEFAULT 'user',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await p.execute(`
    CREATE TABLE IF NOT EXISTS comments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      post_slug VARCHAR(500) NOT NULL,
      user_id INT NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);
  await p.execute(`
    CREATE TABLE IF NOT EXISTS posts (
      slug VARCHAR(500) NOT NULL,
      category VARCHAR(100) NOT NULL,
      title VARCHAR(500) NOT NULL,
      content LONGTEXT NOT NULL,
      description TEXT,
      tags JSON,
      published TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (slug, category)
    )
  `);

  const [rows] = await p.execute("SELECT id FROM users WHERE username = ?", ["admin"]) as any;
  if (rows.length === 0) {
    const hash = bcrypt.hashSync("admin123", 10);
    await p.execute("INSERT INTO users (username, password, role) VALUES (?, ?, ?)", ["admin", hash, "admin"]);
  }
}
