const express = require('express');
const { Pool } = require('pg');
const { Resend } = require('resend');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve index.html, admin.html and other website files
app.use(express.static(__dirname));

const PORT = process.env.PORT || 8080;

// =========================================================
// ENVIRONMENT
// =========================================================

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const ADMIN_PASSWORD = RESEND_API_KEY || '12345678';

const DATABASE_URL = process.env.DATABASE_URL || '';

const ADMIN_EMAIL =
  process.env.ADMIN_EMAIL || 'dadadelivery2017@gmail.com';

const TEST_EMAIL =
  process.env.TEST_EMAIL || ADMIN_EMAIL;

const FROM_EMAIL =
  process.env.FROM_EMAIL || 'onboarding@resend.dev';

// =========================================================
// RESEND
// =========================================================

const resend = RESEND_API_KEY
  ? new Resend(RESEND_API_KEY)
  : null;

// =========================================================
// DATABASE
// =========================================================

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL
    ? { rejectUnauthorized: false }
    : false
});

// =========================================================
// DATABASE INIT
// =========================================================

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
      items JSONB DEFAULT '[]'::jsonb,
      total NUMERIC(12,2) DEFAULT 0,
      status TEXT DEFAULT 'חדשה',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log('Database ready');
}

// =========================================================
// ADMIN AUTH
// =========================================================

function adminAuth(req, res, next) {
  const key = String(req.headers['x-admin-key'] || '');

  if (!key || key !== ADMIN_PASSWORD) {
    return res.status(401).json({
      error: 'Unauthorized'
    });
  }

  next();
}

// =========================================================
// ADMIN LOGIN
// =========================================================

app.post('/api/admin/login', (req, res) => {
  try {
    const password = String(req.body?.password || '');

    if (password !== ADMIN_PASSWORD) {
      return res.status(401).json({
        error: 'סיסמה שגויה'
      });
    }

    return res.json({
      success: true,
      adminKey: ADMIN_PASSWORD
    });
  } catch (error) {
    console.error('LOGIN ERROR:', error);

    return res.status(500).json({
      error: 'שגיאה בהתחברות'
    });
  }
});

// =========================================================
// PUBLIC PRODUCTS
// =========================================================

app.get('/api/products', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT *
      FROM products
      WHERE active = TRUE
      ORDER BY id DESC
    `);

    return res.json(result.rows);
  } catch (error) {
    console.error('PUBLIC PRODUCTS ERROR:', error);

    return res.status(500).json({
      error: 'שגיאה בטעינת המוצרים'
    });
  }
});

// =========================================================
// ADMIN PRODUCTS - GET
// =========================================================

app.get('/api/admin/products', adminAuth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT *
      FROM products
      ORDER BY id DESC
    `);

    return res.json(result.rows);
  } catch (error) {
    console.error('ADMIN PRODUCTS GET ERROR:', error);

    return res.status(500).json({
      error: 'שגיאה בטעינת המוצרים'
    });
  }
});

// =========================================================
// ADMIN PRODUCTS - CREATE
// =========================================================

app.post('/api/admin/products', adminAuth, async (req, res) => {
  try {
    const body = req.body || {};

    const name = String(body.name || '').trim();
    const description = String(body.description || '');
    const price = Number(body.price || 0);
    const stock = Number(body.stock || 0);
    const category = String(body.category || '');
    const image = String(body.image || '');
    const active = body.active !== false;

    if (!name) {
      return res.status(400).json({
        error: 'חסר שם מוצר'
      });
    }

    const result = await pool.query(
      `
      INSERT INTO products
      (
        name,
        description,
        price,
        stock,
        category,
        image,
        active
      )
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

    return res.json(result.rows[0]);
  } catch (error) {
    console.error('PRODUCT CREATE ERROR:', error);

    return res.status(500).json({
      error: 'שגיאה בהוספת מוצר'
    });
  }
});

// =========================================================
// ADMIN PRODUCTS - UPDATE
// =========================================================

app.patch('/api/admin/products/:id', adminAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const body = req.body || {};

    const name = String(body.name || '').trim();
    const description = String(body.description || '');
    const price = Number(body.price || 0);
    const stock = Number(body.stock || 0);
    const category = String(body.category || '');
    const image = String(body.image || '');
    const active = body.active !== false;

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

    const result = await pool.query(
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

    return res.json(result.rows[0]);
  } catch (error) {
    console.error('PRODUCT UPDATE ERROR:', error);

    return res.status(500).json({
      error: 'שגיאה בעדכון מוצר'
    });
  }
});

// =========================================================
// ADMIN PRODUCTS - DELETE
// =========================================================

app.delete('/api/admin/products/:id', adminAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id)) {
      return res.status(400).json({
        error: 'מזהה מוצר לא תקין'
      });
    }

    const result = await pool.query(
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

    return res.json({
      success: true
    });
  } catch (error) {
    console.error('PRODUCT DELETE ERROR:', error);

    return res.status(500).json({
      error: 'שגיאה במחיקת מוצר'
    });
  }
});

// =========================================================
// ORDERS - GET
// =========================================================

app.get('/api/orders', adminAuth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT *
      FROM orders
      ORDER BY created_at DESC
    `);

    return res.json(result.rows);
  } catch (error) {
    console.error('ORDERS GET ERROR:', error);

    return res.status(500).json({
      error: 'שגיאה בטעינת ההזמנות'
    });
  }
});

// =========================================================
// SEND NEW ORDER EMAILS
// =========================================================

async function sendNewOrderEmails(order) {
  if (!resend) {
    console.error('Cannot send order emails: RESEND_API_KEY is missing');
    return;
  }

  let items = [];

  try {
    items =
      typeof order.items === 'string'
        ? JSON.parse(order.items)
        : Array.isArray(order.items)
          ? order.items
          : [];
  } catch {
    items = [];
  }

  const itemsHtml = items.length
    ? items
        .map(item => {
          const name = String(item.name || 'מוצר');
          const quantity = Number(item.quantity || 1);
          const price = Number(item.price || 0);
          const subtotal = price * quantity;

          return `
            <tr>
              <td style="padding:8px;border-bottom:1px solid #eee;">
                ${escapeHtml(name)}
              </td>
              <td style="padding:8px;border-bottom:1px solid #eee;">
                ${quantity}
              </td>
              <td style="padding:8px;border-bottom:1px solid #eee;">
                ${subtotal.toFixed(2)} ₪
              </td>
            </tr>
          `;
        })
        .join('')
    : `
      <tr>
        <td colspan="3" style="padding:8px;">
          אין פירוט מוצרים
        </td>
      </tr>
    `;

  const customerEmail = String(order.email || '').trim();

  const commonHtml = `
    <div
      dir="rtl"
      style="
        font-family:Arial,sans-serif;
        max-width:700px;
        margin:auto;
        color:#172033;
      "
    >

      <h1 style="color:#2563eb;">
        Dada Best
      </h1>

      <h2>
        הזמנה חדשה ${escapeHtml(order.order_number)}
      </h2>

      <p>
        <strong>לקוח:</strong>
        ${escapeHtml(order.customer_name)}
      </p>

      <p>
        <strong>טלפון:</strong>
        ${escapeHtml(order.phone)}
      </p>

      <p>
        <strong>אימייל:</strong>
        ${escapeHtml(order.email || 'לא נמסר')}
      </p>

      <p>
        <strong>משלוח:</strong>
        ${escapeHtml(order.shipping || '')}
      </p>

      <p>
        <strong>כתובת:</strong>
        ${escapeHtml(order.city || '')},
        ${escapeHtml(order.street || '')}
        ${escapeHtml(order.house_number || '')}
        ${
          order.apartment
            ? `, דירה ${escapeHtml(order.apartment)}`
            : ''
        }
      </p>

      <p>
        <strong>הערות:</strong>
        ${escapeHtml(order.notes || 'אין')}
      </p>

      <h3>פריטים</h3>

      <table
        style="
          width:100%;
          border-collapse:collapse;
          text-align:right;
        "
      >
        <thead>
          <tr>
            <th style="padding:8px;">מוצר</th>
            <th style="padding:8px;">כמות</th>
            <th style="padding:8px;">סה״כ</th>
          </tr>
        </thead>

        <tbody>
          ${itemsHtml}
        </tbody>
      </table>

      <h2>
        סה״כ:
        ${Number(order.total || 0).toFixed(2)} ₪
      </h2>

    </div>
  `;

  // ---------------------------------------------------------
  // EMAIL TO ADMIN
  // ---------------------------------------------------------

  try {
    const adminResult = await resend.emails.send({
      from: FROM_EMAIL,
      to: ADMIN_EMAIL,
      subject:
        `Dada Best - הזמנה חדשה ${order.order_number}`,
      html: commonHtml
    });

    console.log(
      'ADMIN ORDER EMAIL RESULT:',
      adminResult
    );
  } catch (error) {
    console.error(
      'ADMIN ORDER EMAIL ERROR:',
      error
    );
  }

  // ---------------------------------------------------------
  // EMAIL TO CUSTOMER
  // ---------------------------------------------------------

  if (!customerEmail) {
    console.log(
      'Customer email not provided - skipping customer email'
    );

    return;
  }

  const customerHtml = `
    <div
      dir="rtl"
      style="
        font-family:Arial,sans-serif;
        max-width:700px;
        margin:auto;
        color:#172033;
      "
    >

      <h1 style="color:#2563eb;">
        Dada Best
      </h1>

      <h2>
        תודה על ההזמנה!
      </h2>

      <p>
        שלום ${escapeHtml(order.customer_name || '')},
      </p>

      <p>
        קיבלנו את ההזמנה שלך בהצלחה.
      </p>

      <p>
        <strong>מספר הזמנה:</strong>
        ${escapeHtml(order.order_number)}
      </p>

      <h3>סיכום ההזמנה</h3>

      <table
        style="
          width:100%;
          border-collapse:collapse;
          text-align:right;
        "
      >
        <thead>
          <tr>
            <th style="padding:8px;">מוצר</th>
            <th style="padding:8px;">כמות</th>
            <th style="padding:8px;">סה״כ</th>
          </tr>
        </thead>

        <tbody>
          ${itemsHtml}
        </tbody>
      </table>

      <h2>
        סה״כ:
        ${Number(order.total || 0).toFixed(2)} ₪
      </h2>

      <p>
        ניצור איתך קשר לגבי המשך הטיפול בהזמנה.
      </p>

      <p>
        תודה,
        <br>
        Dada Best
      </p>

    </div>
  `;

  try {
    const customerResult = await resend.emails.send({
      from: FROM_EMAIL,
      to: customerEmail,
      subject:
        `Dada Best - אישור הזמנה ${order.order_number}`,
      html: customerHtml
    });

    console.log(
      'CUSTOMER ORDER EMAIL RESULT:',
      customerResult
    );
  } catch (error) {
    console.error(
      'CUSTOMER ORDER EMAIL ERROR:',
      error
    );
  }
}

// =========================================================
// ORDERS - CREATE
// =========================================================

app.post('/api/orders', async (req, res) => {
  try {
    const body = req.body || {};

    const customerName =
      String(body.customer_name || '').trim();

    const phone =
      String(body.phone || '').trim();

    const email =
      String(body.email || '').trim();

    const shipping =
      String(body.shipping || '').trim();

    const city =
      String(body.city || '').trim();

    const street =
      String(body.street || '').trim();

    const houseNumber =
      String(body.house_number || '').trim();

    const apartment =
      String(body.apartment || '').trim();

    const notes =
      String(body.notes || '').trim();

    const items =
      Array.isArray(body.items)
        ? body.items
        : [];

    const total =
      Number(body.total || 0);

    const orderNumber =
      'DB-' + Date.now();

    const result = await pool.query(
      `
      INSERT INTO orders
      (
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
      VALUES
      (
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

    const order = result.rows[0];

    // Return success immediately.
    // Email sending happens after the order is saved.
    res.json({
      success: true,
      order
    });

    // Send email to admin and customer.
    await sendNewOrderEmails(order);

  } catch (error) {
    console.error('ORDER CREATE ERROR:', error);

    if (!res.headersSent) {
      return res.status(500).json({
        error: 'שגיאה ביצירת הזמנה'
      });
    }
  }
});

// =========================================================
// ORDERS - UPDATE STATUS
// =========================================================

app.patch('/api/orders/:id', adminAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);

    const status =
      String(req.body?.status || 'חדשה');

    if (!Number.isInteger(id)) {
      return res.status(400).json({
        error: 'מזהה הזמנה לא תקין'
      });
    }

    const result = await pool.query(
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

    return res.json(result.rows[0]);
  } catch (error) {
    console.error('ORDER STATUS ERROR:', error);

    return res.status(500).json({
      error: 'שגיאה בעדכון הזמנה'
    });
  }
});

// =========================================================
// ORDERS - DELETE
// =========================================================

app.delete('/api/orders/:id', adminAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id)) {
      return res.status(400).json({
        error: 'מזהה הזמנה לא תקין'
      });
    }

    const result = await pool.query(
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

    return res.json({
      success: true
    });
  } catch (error) {
    console.error('ORDER DELETE ERROR:', error);

    return res.status(500).json({
      error: 'שגיאה במחיקת הזמנה'
    });
  }
});

// =========================================================
// RESEND TEST EMAIL
// =========================================================

app.post(
  '/api/admin/test-email',
  adminAuth,
  async (req, res) => {

    console.log('TEST EMAIL REQUEST RECEIVED');

    if (!resend) {
      console.error(
        'RESEND_API_KEY is missing'
      );

      return res.status(500).json({
        error:
          'RESEND_API_KEY לא מוגדר ב-Railway'
      });
    }

    try {
      console.log(
        'Sending test email to:',
        TEST_EMAIL
      );

      const result =
        await resend.emails.send({
          from: FROM_EMAIL,
          to: TEST_EMAIL,
          subject:
            'Dada Best - בדיקת מייל',
          html: `
            <div
              dir="rtl"
              style="font-family:Arial,sans-serif;"
            >
              <h1>Dada Best</h1>

              <p>
                זהו מייל בדיקה.
              </p>

              <p>
                מערכת המייל מחוברת בהצלחה ל-Resend.
              </p>
            </div>
          `
        });

      console.log(
        'RESEND RESULT:',
        result
      );

      if (result?.error) {
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

      return res.json({
        success: true,
        message: 'המייל נשלח בהצלחה',
        id:
          result?.data?.id || null
      });

    } catch (error) {
      console.error(
        'TEST EMAIL ERROR:',
        error
      );

      return res.status(500).json({
        error:
          error.message ||
          'שגיאה בשליחת המייל'
      });
    }
  }
);

// =========================================================
// HEALTH
// =========================================================

app.get('/health', (req, res) => {
  return res.json({
    ok: true,
    database: Boolean(DATABASE_URL),
    email: Boolean(RESEND_API_KEY),
    testEmailEndpoint: true
  });
});

// =========================================================
// API STATUS
// =========================================================

app.get('/api/status', (req, res) => {
  return res.json({
    success: true,
    message:
      'Dada Best server is working'
  });
});

// =========================================================
// ESCAPE HTML
// =========================================================

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

// =========================================================
// START SERVER
// =========================================================

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

        console.log(
          'Admin email:',
          ADMIN_EMAIL
        );

        console.log(
          'Test email endpoint:',
          'POST /api/admin/test-email'
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
