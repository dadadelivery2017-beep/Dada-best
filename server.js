const express = require("express");
const { Pool } = require("pg");
const path = require("path");
const app = express();
const PORT = process.env.PORT || 3000;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL
    ? { rejectUnauthorized: false }
    : false
});
app.use(express.json());
app.use(express.static(__dirname));
async function initDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      order_number VARCHAR(50) UNIQUE NOT NULL,
      customer_name VARCHAR(150) NOT NULL,
      phone VARCHAR(50) NOT NULL,
      email VARCHAR(150),
      city VARCHAR(100) NOT NULL,
      street VARCHAR(150) NOT NULL,
      house_number VARCHAR(30) NOT NULL,
      apartment VARCHAR(30),
      zip VARCHAR(30),
      shipping VARCHAR(100),
      notes TEXT,
      items JSONB NOT NULL,
      total NUMERIC(10,2) NOT NULL,
      status VARCHAR(50) DEFAULT 'חדשה',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log("Database ready");
}
app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({
      success: true,
      message: "Dada Best server is working"
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false
    });
  }
});
app.get("/api/orders", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM orders ORDER BY created_at DESC"
    );
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Failed to load orders"
    });
  }
});
app.post("/api/orders", async (req, res) => {
  try {
    const { customer, items, total } = req.body;
    if (
      !customer ||
      !customer.name ||
      !customer.phone ||
      !customer.city ||
      !customer.street ||
      !customer.house
    ) {
      return res.status(400).json({
        error: "Missing customer information"
      });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        error: "Order is empty"
      });
    }
    const orderNumber =
      "DADA-" + Date.now().toString().slice(-8);
    const result = await pool.query(
      `
      INSERT INTO orders (
        order_number,
        customer_name,
        phone,
        email,
        city,
        street,
        house_number,
        apartment,
        zip,
        shipping,
        notes,
        items,
        total
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13
      )
      RETURNING *
      `,
      [
        orderNumber,
        customer.name,
        customer.phone,
        customer.email || "",
        customer.city,
        customer.street,
        customer.house,
        customer.apartment || "",
        customer.zip || "",
        customer.shipping || "משלוח רגיל",
        customer.notes || "",
        JSON.stringify(items),
        Number(total) || 0
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("CREATE ORDER ERROR:", error);
    res.status(500).json({
      error: "Failed to create order"
    });
  }
});
app.patch("/api/orders/:id", async (req, res) => {
  try {
    const { status } = req.body;
    const result = await pool.query(
      `
      UPDATE orders
      SET status = $1
      WHERE id = $2
      RETURNING *
      `,
      [status, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Order not found"
      });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Failed to update order"
    });
  }
});
app.delete("/api/orders/:id", async (req, res) => {
  try {
    await pool.query(
      "DELETE FROM orders WHERE id = $1",
      [req.params.id]
    );
    res.json({
      success: true
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Failed to delete order"
    });
  }
});
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});
async function start() {
  try {
    await initDatabase();
    app.listen(PORT, "0.0.0.0", () => {
      console.log(
        `Dada Best running on port ${PORT}`
      );
    });
  } catch (error) {
    console.error(
      "SERVER START ERROR:",
      error
    );
    process.exit(1);
  }
}
start();
