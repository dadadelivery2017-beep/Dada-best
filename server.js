const express = require("express");
const { Pool } = require("pg");
const path = require("path");
const { Resend } = require("resend");

const app = express();
const PORT = process.env.PORT || 3000;

/* =========================
   RESEND
========================= */

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

/* =========================
   DATABASE
========================= */

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL
    ? { rejectUnauthorized: false }
    : false
});

/* =========================
   MIDDLEWARE
========================= */

app.use(express.json({ limit: "10mb" }));
app.use(express.static(__dirname));
app.disable("x-powered-by");

/* =========================
   ADMIN SECURITY
========================= */

function getAdminKeys() {
  return [
    process.env.ADMIN_KEY,
    process.env.DANIELADMIN
  ].filter(Boolean);
}

function requireAdmin(req, res, next) {
  const adminKeys = getAdminKeys();

  if (adminKeys.length === 0) {
    return res.status(500).json({
      error: "No admin password configured on the server"
    });
  }

  const receivedKey = req.headers["x-admin-key"];

  if (!receivedKey || !adminKeys.includes(receivedKey)) {
    return res.status(401).json({
      error: "Unauthorized"
    });
  }

  next();
}

/* =========================
   ADMIN LOGIN
========================= */

app.post("/api/admin/login", (req, res) => {
  const { password } = req.body || {};
  const adminKeys = getAdminKeys();

  if (!password || !adminKeys.includes(password)) {
    return res.status(401).json({
      error: "סיסמת אדמין שגויה"
    });
  }

  res.json({
    success: true,
    adminKey: password
  });
});

/* =========================
   DATABASE
========================= */

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

  await pool.query(`
    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      name VARCHAR(200) NOT NULL,
      description TEXT DEFAULT '',
      price NUMERIC(10,2) NOT NULL DEFAULT 0,
      stock INTEGER NOT NULL DEFAULT 0,
      image TEXT DEFAULT '',
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    ALTER TABLE products
    ADD COLUMN IF NOT EXISTS category VARCHAR(100) DEFAULT ''
  `);

  const countResult = await pool.query(
    "SELECT COUNT(*)::int AS count FROM products"
  );

  if (countResult.rows[0].count === 0) {
    await pool.query(`
      INSERT INTO products
        (
          name,
          description,
          price,
          stock,
          image,
          active,
          category
        )
      VALUES
        (
          'מצלמת אבטחה 4MP',
          'מצלמת IP איכותית לבית ולעסק.',
          349,
          20,
          '📹',
          TRUE,
          'מצלמות'
        ),
        (
          'NVR 8 ערוצים',
          'מערכת הקלטה לעד 8 מצלמות.',
          799,
          10,
          '💾',
          TRUE,
          'הקלטה'
        ),
        (
          'דיסק קשיח 2TB',
          'דיסק ייעודי למערכות הקלטה.',
          449,
          15,
          '💽',
          TRUE,
          'אחסון'
        ),
        (
          'מצלמת WiFi',
          'מצלמה אלחוטית עם צפייה מהטלפון.',
          299,
          25,
          '📡',
          TRUE,
          'מצלמות'
        ),
        (
          'ספק כוח למצלמות',
          'ספק כוח איכותי למערכות אבטחה.',
          89,
          40,
          '🔌',
          TRUE,
          'אביזרים'
        ),
        (
          'ערכת התקנה',
          'ציוד בסיסי להתקנת מצלמות.',
          159,
          12,
          '🧰',
          TRUE,
          'אביזרים'
        )
    `);

    console.log("Initial products created");
  }

  console.log("Database ready");
}

/* =========================
   HEALTH
========================= */

app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");

    res.json({
      success: true,
      message: "Dada Best server is working",
      emailService: resend ? "ready" : "not configured"
    });
  } catch (error) {
    console.error("HEALTH ERROR:", error);

    res.status(500).json({
      success: false,
      error: "Database connection failed"
    });
  }
});

/* =========================
   PRODUCTS - PUBLIC
========================= */

app.get("/api/products", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        id,
        name,
        description,
        price,
        stock,
        image,
        active,
        category
      FROM products
      WHERE active = TRUE
      ORDER BY id ASC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error("LOAD PRODUCTS ERROR:", error);

    res.status(500).json({
      error: "Failed to load products"
    });
  }
});

/* =========================
   PRODUCTS - ADMIN
========================= */

app.get(
  "/api/admin/products",
  requireAdmin,
  async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT *
        FROM products
        ORDER BY id DESC
      `);

      res.json(result.rows);
    } catch (error) {
      console.error("ADMIN PRODUCTS ERROR:", error);

      res.status(500).json({
        error: "Failed to load products"
      });
    }
  }
);

/* =========================
   CREATE PRODUCT
========================= */

app.post(
  "/api/admin/products",
  requireAdmin,
  async (req, res) => {
    try {
      const {
        name,
        description,
        price,
        stock,
        image,
        active,
        category
      } = req.body;

      if (!name || !String(name).trim()) {
        return res.status(400).json({
          error: "Product name is required"
        });
      }

      const productPrice = Number(price);
      const productStock = Number(stock);

      if (
        !Number.isFinite(productPrice) ||
        productPrice < 0
      ) {
        return res.status(400).json({
          error: "Invalid price"
        });
      }

      if (
        !Number.isInteger(productStock) ||
        productStock < 0
      ) {
        return res.status(400).json({
          error: "Invalid stock"
        });
      }

      const result = await pool.query(`
        INSERT INTO products
          (
            name,
            description,
            price,
            stock,
            image,
            active,
            category
          )
        VALUES
          ($1,$2,$3,$4,$5,$6,$7)
        RETURNING *
      `, [
        String(name).trim(),
        String(description || "").trim(),
        productPrice,
        productStock,
        String(image || "").trim(),
        active !== false,
        String(category || "").trim()
      ]);

      res.status(201).json(result.rows[0]);

    } catch (error) {
      console.error("CREATE PRODUCT ERROR:", error);

      res.status(500).json({
        error: "Failed to create product"
      });
    }
  }
);

/* =========================
   UPDATE PRODUCT
========================= */

app.patch(
  "/api/admin/products/:id",
  requireAdmin,
  async (req, res) => {
    try {
      const {
        name,
        description,
        price,
        stock,
        image,
        active,
        category
      } = req.body;

      if (!name || !String(name).trim()) {
        return res.status(400).json({
          error: "Product name is required"
        });
      }

      const productPrice = Number(price);
      const productStock = Number(stock);

      if (
        !Number.isFinite(productPrice) ||
        productPrice < 0
      ) {
        return res.status(400).json({
          error: "Invalid price"
        });
      }

      if (
        !Number.isInteger(productStock) ||
        productStock < 0
      ) {
        return res.status(400).json({
          error: "Invalid stock"
        });
      }

      const result = await pool.query(`
        UPDATE products
        SET
          name = $1,
          description = $2,
          price = $3,
          stock = $4,
          image = $5,
          active = $6,
          category = $7,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $8
        RETURNING *
      `, [
        String(name).trim(),
        String(description || "").trim(),
        productPrice,
        productStock,
        String(image || "").trim(),
        active !== false,
        String(category || "").trim(),
        req.params.id
      ]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: "Product not found"
        });
      }

      res.json(result.rows[0]);

    } catch (error) {
      console.error("UPDATE PRODUCT ERROR:", error);

      res.status(500).json({
        error: "Failed to update product"
      });
    }
  }
);

/* =========================
   DELETE PRODUCT
========================= */

app.delete(
  "/api/admin/products/:id",
  requireAdmin,
  async (req, res) => {
    try {
      const result = await pool.query(`
        DELETE FROM products
        WHERE id = $1
        RETURNING id
      `, [req.params.id]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: "Product not found"
        });
      }

      res.json({
        success: true
      });

    } catch (error) {
      console.error("DELETE PRODUCT ERROR:", error);

      res.status(500).json({
        error: "Failed to delete product"
      });
    }
  }
);

/* =========================
   ORDERS - ADMIN
========================= */

app.get(
  "/api/orders",
  requireAdmin,
  async (req, res) => {
    try {
      const result = await pool.query(
        "SELECT * FROM orders ORDER BY created_at DESC"
      );

      res.json(result.rows);

    } catch (error) {
      console.error("LOAD ORDERS ERROR:", error);

      res.status(500).json({
        error: "Failed to load orders"
      });
    }
  }
);

/* =========================
   CREATE ORDER
========================= */

app.post(
  "/api/orders",
  async (req, res) => {
    try {
      const {
        customer,
        items,
        total
      } = req.body;

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

      if (
        !Array.isArray(items) ||
        items.length === 0
      ) {
        return res.status(400).json({
          error: "Order is empty"
        });
      }

      const orderNumber =
        "DADA-" +
        Date.now().toString().slice(-8);

      const result = await pool.query(`
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
          $1,$2,$3,$4,$5,$6,$7,
          $8,$9,$10,$11,$12,$13
        )
        RETURNING *
      `, [
        orderNumber,
        String(customer.name).trim(),
        String(customer.phone).trim(),
        String(customer.email || "").trim(),
        String(customer.city).trim(),
        String(customer.street).trim(),
        String(customer.house).trim(),
        String(customer.apartment || "").trim(),
        String(customer.zip || "").trim(),
        String(customer.shipping || "משלוח רגיל").trim(),
        String(customer.notes || "").trim(),
        JSON.stringify(items),
        Number(total) || 0
      ]);

      res.status(201).json(result.rows[0]);

    } catch (error) {
      console.error("CREATE ORDER ERROR:", error);

      res.status(500).json({
        error: "Failed to create order"
      });
    }
  }
);

/* =========================
   UPDATE ORDER
========================= */

app.patch(
  "/api/orders/:id",
  requireAdmin,
  async (req, res) => {
    try {
      const { status } = req.body;

      const allowedStatuses = [
        "חדשה",
        "בטיפול",
        "נשלחה",
        "הושלמה"
      ];

      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({
          error: "Invalid order status"
        });
      }

      const result = await pool.query(`
        UPDATE orders
        SET status = $1
        WHERE id = $2
        RETURNING *
      `, [
        status,
        req.params.id
      ]);

      if (!result.rows.length) {
        return res.status(404).json({
          error: "Order not found"
        });
      }

      res.json(result.rows[0]);

    } catch (error) {
      console.error("UPDATE ORDER ERROR:", error);

      res.status(500).json({
        error: "Failed to update order"
      });
    }
  }
);

/* =========================
   DELETE ORDER
========================= */

app.delete(
  "/api/orders/:id",
  requireAdmin,
  async (req, res) => {
    try {
      const result = await pool.query(
        "DELETE FROM orders WHERE id = $1 RETURNING id",
        [req.params.id]
      );

      if (!result.rows.length) {
        return res.status(404).json({
          error: "Order not found"
        });
      }

      res.json({
        success: true
      });

    } catch (error) {
      console.error("DELETE ORDER ERROR:", error);

      res.status(500).json({
        error: "Failed to delete order"
      });
    }
  }
);

/* =========================
   HOME
========================= */

app.get("/", (req, res) => {
  res.sendFile(
    path.join(__dirname, "index.html")
  );
});

/* =========================
   START
========================= */

async function start() {
  try {
    await initDatabase();

    app.listen(
      PORT,
      "0.0.0.0",
      () => {
        console.log(
          `Dada Best running on port ${PORT}`
        );

        console.log(
          `Email service: ${
            resend ? "READY" : "NOT CONFIGURED"
          }`
        );
      }
    );

  } catch (error) {
    console.error(
      "SERVER START ERROR:",
      error
    );

    process.exit(1);
  }
}

start();
