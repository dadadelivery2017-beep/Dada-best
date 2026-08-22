const express = require('express');
const { Pool } = require('pg');
const { Resend } = require('resend');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve website files such as index.html and admin.html
app.use(express.static(__dirname));

const PORT = process.env.PORT || 8080;


// =========================================================
// ENVIRONMENT
// =========================================================

// סיסמת האדמין נשארת RESEND_API_KEY
const ADMIN_PASSWORD =
  process.env.RESEND_API_KEY || '12345678';

const DATABASE_URL =
  process.env.DATABASE_URL;

const RESEND_API_KEY =
  process.env.RESEND_API_KEY;

const TEST_EMAIL =
  process.env.TEST_EMAIL ||
  'dadadelivery2017@gmail.com';


// =========================================================
// RESEND
// =========================================================

const resend =
  RESEND_API_KEY
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

  const key =
    req.headers['x-admin-key'];


  if (
    !key ||
    key !== ADMIN_PASSWORD
  ) {

    return res.status(401).json({
      error: 'Unauthorized'
    });

  }


  next();
}


// =========================================================
// ADMIN LOGIN
// =========================================================

app.post(
  '/api/admin/login',
  (req, res) => {

    const password =
      String(
        req.body.password || ''
      );


    if (
      password !==
      ADMIN_PASSWORD
    ) {

      return res.status(401).json({
        error: 'סיסמה שגויה'
      });

    }


    res.json({
      success: true,
      adminKey: ADMIN_PASSWORD
    });

  }
);


// =========================================================
// PUBLIC PRODUCTS
// =========================================================

app.get(
  '/api/products',
  async (req, res) => {

    try {

      const result =
        await pool.query(`
          SELECT *
          FROM products
          WHERE active = TRUE
          ORDER BY id DESC
        `);


      res.json(
        result.rows
      );

    } catch (error) {

      console.error(
        'PUBLIC PRODUCTS ERROR:',
        error
      );


      res.status(500).json({
        error:
          'שגיאה בטעינת המוצרים'
      });

    }

  }
);


// =========================================================
// ADMIN PRODUCTS - GET
// =========================================================

app.get(
  '/api/admin/products',
  adminAuth,
  async (req, res) => {

    try {

      const result =
        await pool.query(`
          SELECT *
          FROM products
          ORDER BY id DESC
        `);


      res.json(
        result.rows
      );

    } catch (error) {

      console.error(
        'ADMIN PRODUCTS GET ERROR:',
        error
      );


      res.status(500).json({
        error:
          'שגיאה בטעינת המוצרים'
      });

    }

  }
);


// =========================================================
// ADMIN PRODUCTS - CREATE
// =========================================================

app.post(
  '/api/admin/products',
  adminAuth,
  async (req, res) => {

    try {

      const body =
        req.body || {};


      const name =
        String(
          body.name || ''
        ).trim();


      const description =
        String(
          body.description || ''
        );


      const price =
        Number(
          body.price || 0
        );


      const stock =
        Number(
          body.stock || 0
        );


      const category =
        String(
          body.category || ''
        );


      const image =
        String(
          body.image || ''
        );


      const active =
        body.active !== false;


      if (!name) {

        return res.status(400).json({
          error:
            'חסר שם מוצר'
        });

      }


      const result =
        await pool.query(

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
          VALUES
          (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7
          )
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


      res.json(
        result.rows[0]
      );

    } catch (error) {

      console.error(
        'PRODUCT CREATE ERROR:',
        error
      );


      res.status(500).json({
        error:
          'שגיאה בהוספת מוצר'
      });

    }

  }
);


// =========================================================
// ADMIN PRODUCTS - UPDATE
// =========================================================

app.patch(
  '/api/admin/products/:id',
  adminAuth,
  async (req, res) => {

    try {

      const id =
        Number(
          req.params.id
        );


      const body =
        req.body || {};


      const name =
        String(
          body.name || ''
        ).trim();


      const description =
        String(
          body.description || ''
        );


      const price =
        Number(
          body.price || 0
        );


      const stock =
        Number(
          body.stock || 0
        );


      const category =
        String(
          body.category || ''
        );


      const image =
        String(
          body.image || ''
        );


      const active =
        body.active !== false;


      if (!name) {

        return res.status(400).json({
          error:
            'חסר שם מוצר'
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


      if (
        !result.rows.length
      ) {

        return res.status(404).json({
          error:
            'המוצר לא נמצא'
        });

      }


      res.json(
        result.rows[0]
      );

    } catch (error) {

      console.error(
        'PRODUCT UPDATE ERROR:',
        error
      );


      res.status(500).json({
        error:
          'שגיאה בעדכון מוצר'
      });

    }

  }
);


// =========================================================
// ADMIN PRODUCTS - DELETE
// =========================================================

app.delete(
  '/api/admin/products/:id',
  adminAuth,
  async (req, res) => {

    try {

      const id =
        Number(
          req.params.id
        );


      const result =
        await pool.query(

          `
          DELETE FROM products
          WHERE id = $1
          RETURNING *
          `,

          [id]

        );


      if (
        !result.rows.length
      ) {

        return res.status(404).json({
          error:
            'המוצר לא נמצא'
        });

      }


      res.json({
        success: true
      });

    } catch (error) {

      console.error(
        'PRODUCT DELETE ERROR:',
        error
      );


      res.status(500).json({
        error:
          'שגיאה במחיקת מוצר'
      });

    }

  }
);


// =========================================================
// ORDERS - GET
// =========================================================

app.get(
  '/api/orders',
  adminAuth,
  async (req, res) => {

    try {

      const result =
        await pool.query(`
          SELECT *
          FROM orders
          ORDER BY created_at DESC
        `);


      res.json(
        result.rows
      );

    } catch (error) {

      console.error(
        'ORDERS GET ERROR:',
        error
      );


      res.status(500).json({
        error:
          'שגיאה בטעינת ההזמנות'
      });

    }

  }
);


// =========================================================
// AUTOMATIC ORDER EMAIL
// =========================================================

async function sendNewOrderEmail(order) {

  if (!resend) {

    console.error(
      'AUTOMATIC EMAIL: RESEND_API_KEY is missing'
    );

    return {
      success: false,
      error:
        'RESEND_API_KEY לא מוגדר'
    };

  }


  try {

    let items = [];


    try {

      items =
        typeof order.items === 'string'
          ? JSON.parse(order.items)
          : (
              Array.isArray(order.items)
                ? order.items
                : []
            );

    } catch {

      items = [];

    }


    const itemsHtml =
      items.length

        ? items.map(item => {

            const quantity =
              Number(
                item.quantity || 1
              );

            const price =
              Number(
                item.price || 0
              );

            const lineTotal =
              price * quantity;


            return `
              <tr>
                <td style="
                  padding:8px;
                  border-bottom:1px solid #eee;
                ">
                  ${escapeHtml(
                    item.name || 'מוצר'
                  )}
                </td>

                <td style="
                  padding:8px;
                  border-bottom:1px solid #eee;
                  text-align:center;
                ">
                  ${quantity}
                </td>

                <td style="
                  padding:8px;
                  border-bottom:1px solid #eee;
                ">
                  ${lineTotal.toFixed(2)} ₪
                </td>
              </tr>
            `;

          }).join('')

        : `
          <tr>
            <td colspan="3">
              אין פירוט פריטים
            </td>
          </tr>
        `;


    const address =
      [
        order.city,
        order.street,
        order.house_number
      ]
      .filter(Boolean)
      .join(', ');


    const apartment =
      order.apartment
        ? `, דירה ${escapeHtml(order.apartment)}`
        : '';


    const result =
      await resend.emails.send({

        from:
          'onboarding@resend.dev',

        to:
          TEST_EMAIL,

        subject:
          `🛒 הזמנה חדשה ${order.order_number} - Dada Best`,

        html: `

          <div
            dir="rtl"
            style="
              font-family:Arial,sans-serif;
              max-width:700px;
              margin:auto;
              color:#172033;
            "
          >

            <div
              style="
                background:#0f172a;
                color:white;
                padding:20px;
                border-radius:12px 12px 0 0;
              "
            >

              <h1 style="margin:0;">
                🛒 Dada Best
              </h1>

              <p style="margin:8px 0 0;">
                התקבלה הזמנה חדשה
              </p>

            </div>


            <div
              style="
                background:#ffffff;
                padding:25px;
                border:1px solid #e2e8f0;
                border-top:0;
              "
            >

              <h2>
                הזמנה ${escapeHtml(order.order_number)}
              </h2>


              <div
                style="
                  background:#f8fafc;
                  padding:15px;
                  border-radius:10px;
                  margin-bottom:20px;
                "
              >

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
                  ${escapeHtml(
                    order.email || 'לא נמסר'
                  )}
                </p>

                <p>
                  <strong>משלוח:</strong>
                  ${escapeHtml(
                    order.shipping || ''
                  )}
                </p>

                <p>
                  <strong>כתובת:</strong>
                  ${escapeHtml(address)}
                  ${apartment}
                </p>

                <p>
                  <strong>הערות:</strong>
                  ${escapeHtml(
                    order.notes || 'אין'
                  )}
                </p>

              </div>


              <h3>
                פריטים
              </h3>


              <table
                style="
                  width:100%;
                  border-collapse:collapse;
                "
              >

                <thead>

                  <tr
                    style="
                      background:#f1f5f9;
                    "
                  >

                    <th style="padding:10px;">
                      מוצר
                    </th>

                    <th style="padding:10px;">
                      כמות
                    </th>

                    <th style="padding:10px;">
                      מחיר
                    </th>

                  </tr>

                </thead>


                <tbody>
                  ${itemsHtml}
                </tbody>

              </table>


              <div
                style="
                  margin-top:20px;
                  padding:15px;
                  background:#eff6ff;
                  border-radius:10px;
                  font-size:22px;
                  font-weight:bold;
                  text-align:center;
                "
              >

                סה״כ:
                ${Number(
                  order.total || 0
                ).toFixed(2)}
                ₪

              </div>


              <p
                style="
                  margin-top:20px;
                  color:#64748b;
                  font-size:13px;
                "
              >

                סטטוס:
                ${escapeHtml(
                  order.status || 'חדשה'
                )}

              </p>

            </div>

          </div>

        `

      });


    console.log(
      'AUTOMATIC ORDER EMAIL RESULT:',
      result
    );


    if (
      result &&
      result.error
    ) {

      console.error(
        'AUTOMATIC ORDER EMAIL ERROR:',
        result.error
      );


      return {
        success: false,
        error:
          result.error.message ||
          'Resend לא הצליח לשלוח את המייל'
      };

    }


    return {
      success: true,
      id:
        result &&
        result.data &&
        result.data.id
          ? result.data.id
          : null
    };


  } catch (error) {

    console.error(
      'AUTOMATIC ORDER EMAIL EXCEPTION:',
      error
    );


    return {
      success: false,
      error:
        error.message ||
        'שגיאה בשליחת מייל ההזמנה'
    };

  }

}


// =========================================================
// ORDERS - CREATE
// =========================================================

app.post(
  '/api/orders',
  async (req, res) => {

    try {

      const body =
        req.body || {};


      const customerName =
        String(
          body.customer_name || ''
        );


      const phone =
        String(
          body.phone || ''
        );


      const email =
        String(
          body.email || ''
        );


      const shipping =
        String(
          body.shipping || ''
        );


      const city =
        String(
          body.city || ''
        );


      const street =
        String(
          body.street || ''
        );


      const houseNumber =
        String(
          body.house_number || ''
        );


      const apartment =
        String(
          body.apartment || ''
        );


      const notes =
        String(
          body.notes || ''
        );


      const items =
        Array.isArray(body.items)
          ? body.items
          : [];


      const total =
        Number(
          body.total || 0
        );


      const orderNumber =
        'DB-' +
        Date.now();


      // -----------------------------------------------------
      // SAVE ORDER
      // -----------------------------------------------------

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


      const order =
        result.rows[0];


      console.log(
        'NEW ORDER CREATED:',
        order.order_number
      );


      // -----------------------------------------------------
      // AUTOMATIC EMAIL
      // -----------------------------------------------------

      const emailResult =
        await sendNewOrderEmail(
          order
        );


      if (
        emailResult.success
      ) {

        console.log(
          'ORDER EMAIL SENT:',
          order.order_number,
          emailResult.id || ''
        );

      } else {

        console.error(
          'ORDER EMAIL FAILED:',
          order.order_number,
          emailResult.error
        );

      }


      // -----------------------------------------------------
      // RESPONSE
      // -----------------------------------------------------

      res.json({

        success: true,

        order: order,

        emailSent:
          emailResult.success,

        emailId:
          emailResult.id || null

      });


    } catch (error) {

      console.error(
        'ORDER CREATE ERROR:',
        error
      );


      res.status(500).json({

        error:
          'שגיאה ביצירת הזמנה'

      });

    }

  }
);


// =========================================================
// ORDERS - UPDATE STATUS
// =========================================================

app.patch(
  '/api/orders/:id',
  adminAuth,
  async (req, res) => {

    try {

      const id =
        Number(
          req.params.id
        );


      const status =
        String(
          req.body.status ||
          'חדשה'
        );


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


      if (
        !result.rows.length
      ) {

        return res.status(404).json({
          error:
            'ההזמנה לא נמצאה'
        });

      }


      res.json(
        result.rows[0]
      );


    } catch (error) {

      console.error(
        'ORDER STATUS ERROR:',
        error
      );


      res.status(500).json({
        error:
          'שגיאה בעדכון הזמנה'
      });

    }

  }
);


// =========================================================
// ORDERS - DELETE
// =========================================================

app.delete(
  '/api/orders/:id',
  adminAuth,
  async (req, res) => {

    try {

      const id =
        Number(
          req.params.id
        );


      const result =
        await pool.query(

          `
          DELETE FROM orders
          WHERE id = $1
          RETURNING *
          `,

          [id]

        );


      if (
        !result.rows.length
      ) {

        return res.status(404).json({
          error:
            'ההזמנה לא נמצאה'
        });

      }


      res.json({
        success: true
      });


    } catch (error) {

      console.error(
        'ORDER DELETE ERROR:',
        error
      );


      res.status(500).json({
        error:
          'שגיאה במחיקת הזמנה'
      });

    }

  }
);


// =========================================================
// RESEND TEST EMAIL
// =========================================================

app.post(
  '/api/admin/test-email',
  adminAuth,
  async (req, res) => {

    console.log(
      'TEST EMAIL REQUEST RECEIVED'
    );


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

          from:
            'onboarding@resend.dev',

          to:
            TEST_EMAIL,

          subject:
            'Dada Best - בדיקת מייל',

          html: `

            <div
              dir="rtl"
              style="
                font-family:Arial,sans-serif;
              "
            >

              <h1>
                Dada Best
              </h1>

              <p>
                זהו מייל בדיקה.
              </p>

              <p>
                מערכת המייל מחוברת
                בהצלחה ל-Resend.
              </p>

            </div>

          `

        });


      console.log(
        'RESEND RESULT:',
        result
      );


      if (
        result &&
        result.error
      ) {

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

        message:
          'המייל נשלח בהצלחה',

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

app.get(
  '/health',
  (req, res) => {

    res.json({

      ok: true,

      database:
        Boolean(
          DATABASE_URL
        ),

      email:
        Boolean(
          RESEND_API_KEY
        ),

      automaticOrderEmail:
        Boolean(
          RESEND_API_KEY
        ),

      testEmailEndpoint:
        true

    });

  }
);


// =========================================================
// ROOT API STATUS
// =========================================================

app.get(
  '/api/status',
  (req, res) => {

    res.json({

      success: true,

      message:
        'Dada Best server is working'

    });

  }
);


// =========================================================
// ESCAPE HTML
// =========================================================

function escapeHtml(value) {

  return String(
    value ?? ''
  )

    .replaceAll(
      '&',
      '&amp;'
    )

    .replaceAll(
      '<',
      '&lt;'
    )

    .replaceAll(
      '>',
      '&gt;'
    )

    .replaceAll(
      '"',
      '&quot;'
    )

    .replaceAll(
      "'",
      '&#039;'
    );

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
          'Automatic order email:',
          resend
            ? 'READY'
            : 'NOT CONFIGURED'
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
