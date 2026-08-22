const express = require('express');
const { Pool } = require('pg');
const { Resend } = require('resend');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 8080;

const ADMIN_PASSWORD =
  process.env.ADMIN_PASSWORD || '1234';

const DATABASE_URL =
  process.env.DATABASE_URL;

const RESEND_API_KEY =
  process.env.RESEND_API_KEY;

const TEST_EMAIL =
  process.env.TEST_EMAIL ||
  'dadadelivery2017@gmail.com';

const resend =
  RESEND_API_KEY
    ? new Resend(RESEND_API_KEY)
    : null;

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL
    ? { rejectUnauthorized: false }
    : false
});


/* =========================================================
   DATABASE
========================================================= */

async function initDatabase() {

  await pool.query(`
    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      price NUMERIC(12,2) DEFAULT 0,
      stock INTEGER DEFAULT 0,
      category TEXT DEFAULT '',
      image TEXT DEFAULT '',
      active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      order_number TEXT UNIQUE NOT NULL,
      customer_name TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      email TEXT DEFAULT '',
      shipping TEXT DEFAULT '',
      city TEXT DEFAULT '',
      street TEXT DEFAULT '',
      house_number TEXT DEFAULT '',
      apartment TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      items JSONB DEFAULT '[]',
      total NUMERIC(12,2) DEFAULT 0,
      status TEXT DEFAULT 'חדשה',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log('Database ready');
}


/* =========================================================
   ADMIN AUTH
========================================================= */

function adminAuth(req, res, next) {

  const key = req.headers['x-admin-key'];

  if (!key || key !== ADMIN_PASSWORD) {

    return res.status(401).json({
      error: 'Unauthorized'
    });

  }

  next();
}


/* =========================================================
   ADMIN LOGIN
========================================================= */

app.post(
  '/api/admin/login',
  (req, res) => {

    const password =
      String(req.body.password || '');

    if (password !== ADMIN_PASSWORD) {

      return res.status(401).json({
        error: 'סיסמה שגויה'
      });

    }

    res.json({
      adminKey: ADMIN_PASSWORD
    });

  }
);


/* =========================================================
   PUBLIC PRODUCTS
========================================================= */

app.get(
  '/api/products',
  async (req, res) => {

    try {

      const result =
        await pool.query(
          'SELECT * FROM products WHERE active = TRUE ORDER BY id DESC'
        );

      res.json(result.rows);

    } catch (error) {

      console.error(error);

      res.status(500).json({
        error: 'שגיאה בטעינת המוצרים'
      });

    }

  }
);


/* =========================================================
   ADMIN PRODUCTS - GET
========================================================= */

app.get(
  '/api/admin/products',
  adminAuth,
  async (req, res) => {

    try {

      const result =
        await pool.query(
          'SELECT * FROM products ORDER BY id DESC'
        );

      res.json(result.rows);

    } catch (error) {

      console.error(error);

      res.status(500).json({
        error: 'שגיאה בטעינת המוצרים'
      });

    }

  }
);


/* =========================================================
   ADMIN PRODUCTS - CREATE
========================================================= */

app.post(
  '/api/admin/products',
  adminAuth,
  async (req, res) => {

    try {

      const body = req.body || {};

      const name =
        String(body.name || '').trim();

      const description =
        String(body.description || '');

      const price =
        Number(body.price || 0);

      const stock =
        Number(body.stock || 0);

      const category =
        String(body.category || '');

      const image =
        String(body.image || '');

      const active =
        body.active !== false;

      if (!name) {

        return res.status(400).json({
          error: 'חסר שם מוצר'
        });

      }

      const result =
        await pool.query(
          `
          INSERT INTO products
          (name, description, price, stock, category, image, active)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING *
          `,
          [
            name,
            description,
            price,
            stock,
            category,
            image,
            active
          ]
        );

      res.json(result.rows[0]);

    } catch (error) {

      console.error(error);

      res.status(500).json({
        error: 'שגיאה בהוספת מוצר'
      });

    }

  }
);


/* =========================================================
   ADMIN PRODUCTS - UPDATE
========================================================= */

app.patch(
  '/api/admin/products/:id',
  adminAuth,
  async (req, res) => {

    try {

      const id =
        Number(req.params.id);

      const body =
        req.body || {};

      const name =
        String(body.name || '').trim();

      const description =
        String(body.description || '');

      const price =
        Number(body.price || 0);

      const stock =
        Number(body.stock || 0);

      const category =
        String(body.category || '');

      const image =
        String(body.image || '');

      const active =
        body.active !== false;

      if (!Number.isInteger(id)) {

        return res.status(400).json({
          error: 'מזהה מוצר לא תקין'
        });

      }

      if (!name) {

        return res.status(400).json({
          error: 'חסר שם מוצר'
        });

      }

      const result =
        await pool.query(
          `
          UPDATE products
          SET
            name = $1,
            description = $2,
            price = $3,
            stock = $4,
            category = $5,
            image = $6,
            active = $7
          WHERE id = $8
          RETURNING *
          `,
          [
            name,
            description,
            price,
            stock,
            category,
            image,
            active,
            id
          ]
        );

      if (!result.rows.length) {

        return res.status(404).json({
          error: 'המוצר לא נמצא'
        });

      }

      res.json(result.rows[0]);

    } catch (error) {

      console.error(error);

      res.status(500).json({
        error: 'שגיאה בעדכון מוצר'
      });

    }

  }
);


/* =========================================================
   ADMIN PRODUCTS - DELETE
========================================================= */

app.delete(
  '/api/admin/products/:id',
  adminAuth,
  async (req, res) => {

    try {

      const id =
        Number(req.params.id);

      if (!Number.isInteger(id)) {

        return res.status(400).json({
          error: 'מזהה מוצר לא תקין'
        });

      }

      const result =
        await pool.query(
          `
          DELETE FROM products
          WHERE id = $1
          RETURNING *
          `,
          [id]
        );

      if (!result.rows.length) {

        return res.status(404).json({
          error: 'המוצר לא נמצא'
        });

      }

      res.json({
        success: true
      });

    } catch (error) {

      console.error(error);

      res.status(500).json({
        error: 'שגיאה במחיקת מוצר'
      });

    }

  }
);


/* =========================================================
   ORDERS - GET
========================================================= */

app.get(
  '/api/orders',
  adminAuth,
  async (req, res) => {

    try {

      const result =
        await pool.query(
          'SELECT * FROM orders ORDER BY created_at DESC'
        );

      res.json(result.rows);

    } catch (error) {

      console.error(error);

      res.status(500).json({
        error: 'שגיאה בטעינת ההזמנות'
      });

    }

  }
);


/* =========================================================
   ORDERS - CREATE
========================================================= */

app.post(
  '/api/orders',
  async (req, res) => {

    try {

      const body =
        req.body || {};

      const customerName =
        String(body.customer_name || '');

      const phone =
        String(body.phone || '');

      const email =
        String(body.email || '');

      const shipping =
        String(body.shipping || '');

      const city =
        String(body.city || '');

      const street =
        String(body.street || '');

      const houseNumber =
        String(body.house_number || '');

      const apartment =
        String(body.apartment || '');

      const notes =
        String(body.notes || '');

      const items =
        Array.isArray(body.items)
          ? body.items
          : [];

      const total =
        Number(body.total || 0);

      const orderNumber =
        'DB-' + Date.now();

      const result =
        await pool.query(
          `
          INSERT INTO orders (
            order_number,
            customer_name,
            phone,
            email,
            shipping,
            city,
            street,
            house_number,
            apartment,
            notes,
            items,
            total,
            status
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8,
            $9,
            $10,
            $11,
            $12,
            $13
          )
          RETURNING *
          `,
          [
            orderNumber,
            customerName,
            phone,
            email,
            shipping,
            city,
            street,
            houseNumber,
            apartment,
            notes,
            JSON.stringify(items),
            total,
            'חדשה'
          ]
        );

      res.json({
        success: true,
        order: result.rows[0]
      });

    } catch (error) {

      console.error(error);

      res.status(500).json({
        error: 'שגיאה ביצירת הזמנה'
      });

    }

  }
);


/* =========================================================
   ORDERS - UPDATE STATUS
========================================================= */

app.patch(
  '/api/orders/:id',
  adminAuth,
  async (req, res) => {

    try {

      const id =
        Number(req.params.id);

      const status =
        String(
          req.body.status || 'חדשה'
        );

      if (!Number.isInteger(id)) {

        return res.status(400).json({
          error: 'מזהה הזמנה לא תקין'
        });

      }

      const result =
        await pool.query(
          `
          UPDATE orders
          SET status = $1
          WHERE id = $2
          RETURNING *
          `,
          [
            status,
            id
          ]
        );

      if (!result.rows.length) {

        return res.status(404).json({
          error: 'ההזמנה לא נמצאה'
        });

      }

      res.json(result.rows[0]);

    } catch (error) {

      console.error(error);

      res.status(500).json({
        error: 'שגיאה בעדכון הזמנה'
      });

    }

  }
);


/* =========================================================
   ORDERS - DELETE
========================================================= */

app.delete(
  '/api/orders/:id',
  adminAuth,
  async (req, res) => {

    try {

      const id =
        Number(req.params.id);

      if (!Number.isInteger(id)) {

        return res.status(400).json({
          error: 'מזהה הזמנה לא תקין'
        });

      }

      const result =
        await pool.query(
          `
          DELETE FROM orders
          WHERE id = $1
          RETURNING *
          `,
          [id]
        );

      if (!result.rows.length) {

        return res.status(404).json({
          error: 'ההזמנה לא נמצאה'
        });

      }

      res.json({
        success: true
      });

    } catch (error) {

      console.error(error);

      res.status(500).json({
        error: 'שגיאה במחיקת הזמנה'
      });

    }

  }
);


/* =========================================================
   RESEND TEST EMAIL
========================================================= */

app.post(
  '/api/admin/test-email',
  adminAuth,
  async (req, res) => {

    if (!resend) {

      return res.status(500).json({
        error:
          'RESEND_API_KEY לא מוגדר ב-Railway'
      });

    }

    try {

      const result =
        await resend.emails.send({
          from: 'onboarding@resend.dev',
          to: TEST_EMAIL,
          subject: 'Dada Best - בדיקת מייל',
          html: `
            <div dir="rtl" style="font-family:Arial,sans-serif">
              <h1>Dada Best</h1>
              <p>זהו מייל בדיקה.</p>
              <p>מערכת המייל מחוברת בהצלחה ל-Resend.</p>
            </div>
          `
        });

      console.log(
        'TEST EMAIL RESULT:',
        result
      );

      if (result && result.error) {

        console.error(
          'RESEND ERROR:',
          result.error
        );

        return res.status(400).json({
          error:
            result.error.message ||
            'Resend לא הצליח לשלוח את המייל'
        });

      }

      res.json({
        success: true,
        message: 'המייל נשלח בהצלחה',
        id:
          result &&
          result.data &&
          result.data.id
            ? result.data.id
            : null
      });

    } catch (error) {

      console.error(
        'TEST EMAIL ERROR:',
        error
      );

      res.status(500).json({
        error:
          error.message ||
          'שגיאה בשליחת המייל'
      });

    }

  }
);


/* =========================================================
   HEALTH
========================================================= */

app.get(
  '/health',
  (req, res) => {

    res.json({
      ok: true,
      database: Boolean(DATABASE_URL),
      email: Boolean(RESEND_API_KEY)
    });

  }
);


/* =========================================================
   START SERVER
========================================================= */

async function start() {

  try {

    await initDatabase();

    app.listen(
      PORT,
      '0.0.0.0',
      () => {

        console.log(
          'Dada Best running on port ' +
          PORT
        );

        console.log(
          'Email service:',
          resend
            ? 'READY'
            : 'NOT CONFIGURED'
        );

      }
    );

  } catch (error) {

    console.error(
      'STARTUP ERROR:',
      error
    );

    process.exit(1);

  }

}

start();
