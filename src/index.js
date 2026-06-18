const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const path = require('path');
const dotenv = require('dotenv');
const db = require('./db');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

app.post('/api/signup', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required.' });
    }
    const existingUser = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(409).json({ message: 'Email already in use.' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await db.query(
      'INSERT INTO users (name, email, password, role, created_at) VALUES ($1, $2, $3, $4, NOW()) RETURNING id, name, email, role, created_at',
      [name, email, hashedPassword, role || 'user']
    );
    const user = result.rows[0];
    const token = jwt.sign({ userId: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '8h' });
    res.status(201).json({ user, token });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }
    const result = await db.query('SELECT id, name, email, password, role FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }
    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }
    const token = jwt.sign({ userId: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '8h' });
    res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role }, token });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

// GET all products for logged in user
app.get('/api/products', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Unauthorized' });
    const decoded = jwt.verify(token, JWT_SECRET);
    const result = await db.query(
  `SELECT p.*,
    (SELECT COUNT(*) FROM time_study t WHERE t.product_id = p.id) as time_study_count,
    (SELECT COUNT(*) FROM operation_bulletin o WHERE o.product_id = p.id) as ob_count
   FROM products p WHERE p.user_id = $1 ORDER BY p.created_at DESC`,
  [decoded.userId]
);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST create new product
app.post('/api/products', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Unauthorized' });
    const decoded = jwt.verify(token, JWT_SECRET);
    const { product_number, product_name, product_type, process_type, process_model, expected_cost, status } = req.body;
    if (!product_number || !product_name) return res.status(400).json({ message: 'Product number and name are required.' });
    const result = await db.query(
      `INSERT INTO products (user_id, product_number, product_name, product_type, process_type, process_model, expected_cost, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [decoded.userId, product_number, product_name, product_type, process_type, process_model, expected_cost || null, status || 'active']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ message: 'Product number already exists.' });
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT update product
app.put('/api/products/:id', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Unauthorized' });
    const decoded = jwt.verify(token, JWT_SECRET);
    const { product_number, product_name, product_type, process_type, process_model, expected_cost, status } = req.body;
    const result = await db.query(
      `UPDATE products SET product_number=$1, product_name=$2, product_type=$3, process_type=$4, process_model=$5, expected_cost=$6, status=$7
       WHERE id=$8 AND user_id=$9 RETURNING *`,
      [product_number, product_name, product_type, process_type, process_model, expected_cost || null, status, req.params.id, decoded.userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Product not found.' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET single product
app.get('/api/products/:id', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Unauthorized' });
    const decoded = jwt.verify(token, JWT_SECRET);
    const result = await db.query(
      'SELECT * FROM products WHERE id=$1 AND user_id=$2',
      [req.params.id, decoded.userId]
    );
    if (!result.rows.length) return res.status(404).json({ message: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET all products with operations summary for time study page
app.get('/api/timestudy/products', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Unauthorized' });
    const decoded = jwt.verify(token, JWT_SECRET);
    const result = await db.query(
      `SELECT p.*,
        COUNT(DISTINCT t.operation_id) as operation_count
       FROM products p
       LEFT JOIN time_study t ON t.product_id = p.id AND t.user_id = $1
       WHERE p.user_id = $1 AND p.status = 'active'
       GROUP BY p.id
       ORDER BY p.created_at DESC`,
      [decoded.userId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET operations list for a product
app.get('/api/timestudy/:productId/operations', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Unauthorized' });
    const decoded = jwt.verify(token, JWT_SECRET);
    const result = await db.query(
      `SELECT 
        operation_id,
        operation_name,
        operation_priority,
        operation_frequency,
        machine_type,
        manpower,
        COUNT(DISTINCT cycle_number) as cycle_count,
        COUNT(*) as reading_count
       FROM time_study
       WHERE product_id=$1 AND user_id=$2
       GROUP BY operation_id, operation_name, operation_priority, operation_frequency, machine_type, manpower
       ORDER BY operation_priority ASC`,
      [req.params.productId, decoded.userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST save new operation metadata / check priority
app.post('/api/timestudy/operation', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Unauthorized' });
    const decoded = jwt.verify(token, JWT_SECRET);
    const { product_id, operation_id, operation_name, operation_priority, operation_frequency, machine_type, manpower } = req.body;
    const conflict = await db.query(
      `SELECT id FROM time_study WHERE product_id=$1 AND user_id=$2 AND operation_priority=$3 AND operation_id != $4 LIMIT 1`,
      [product_id, decoded.userId, operation_priority, operation_id || '']
    );
    if (conflict.rows.length > 0) {
      return res.status(409).json({ message: 'Priority conflict', conflict: true });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST shift priorities
app.post('/api/timestudy/shiftpriorities', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Unauthorized' });
    const decoded = jwt.verify(token, JWT_SECRET);
    const { product_id, from_priority } = req.body;
    await db.query(
      `UPDATE time_study SET operation_priority = operation_priority + 1
       WHERE product_id=$1 AND user_id=$2 AND operation_priority >= $3`,
      [product_id, decoded.userId, from_priority]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST save full time study readings
app.post('/api/timestudy/save', async (req, res) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Unauthorized' });
    const decoded = jwt.verify(token, JWT_SECRET);
    const { product_id, operation_id, operation_name, operation_priority, operation_frequency, machine_type, manpower, cycle_number, readings } = req.body;

    await client.query(
      `DELETE FROM time_study WHERE product_id=$1 AND user_id=$2 AND operation_id=$3 AND cycle_number=$4`,
      [product_id, decoded.userId, operation_id, cycle_number]
    );

    for (const r of readings) {
      await client.query(
        `INSERT INTO time_study (user_id, product_id, operation_id, operation_name, operation_priority, operation_frequency, machine_type, manpower, motion_name, captured_time_sec, time_category, extra_allowance_sec, include_in_study, cycle_number)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [decoded.userId, product_id, operation_id, operation_name, operation_priority, operation_frequency, machine_type, manpower, r.motion_name, r.captured_time_sec, r.time_category || 'normal', r.extra_allowance_sec || 0, r.include_in_study !== false, cycle_number]
      );
    }

    await recalculateOB(decoded.userId, product_id, operation_id, client);
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  } finally {
    client.release();
  }
});

// GET readings for a specific operation and cycle
app.get('/api/timestudy/:productId/:operationId/readings', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Unauthorized' });
    const decoded = jwt.verify(token, JWT_SECRET);
    const cycle = req.query.cycle || 1;
    const result = await db.query(
      `SELECT * FROM time_study 
       WHERE product_id=$1 AND operation_id=$2 AND user_id=$3 AND cycle_number=$4
       ORDER BY id ASC`,
      [req.params.productId, req.params.operationId, decoded.userId, cycle]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Auto-calculate and upsert OB when time study saves
async function recalculateOB(userId, productId, operationId, client) {
  const studyData = await client.query(
    `SELECT 
      operation_name, operation_priority, operation_frequency, machine_type, manpower,
      COUNT(DISTINCT cycle_number) as cycle_count,
      AVG(cycle_total) as avg_time_sec
     FROM (
       SELECT cycle_number, operation_name, operation_priority, operation_frequency, machine_type, manpower,
         SUM(captured_time_sec) FILTER (WHERE include_in_study = true) as cycle_total
       FROM time_study
       WHERE user_id=$1 AND product_id=$2 AND operation_id=$3
       GROUP BY cycle_number, operation_name, operation_priority, operation_frequency, machine_type, manpower
     ) cycles
     GROUP BY operation_name, operation_priority, operation_frequency, machine_type, manpower`,
    [userId, productId, operationId]
  );

  if (!studyData.rows.length) return;
  const s = studyData.rows[0];

  const existing = await client.query(
    `SELECT efficiency, wage_per_day FROM operation_bulletin WHERE user_id=$1 AND product_id=$2 AND operation_id=$3`,
    [userId, productId, operationId]
  );

  const efficiency = existing.rows.length ? parseFloat(existing.rows[0].efficiency) : 0.85;
  const wage = existing.rows.length ? parseFloat(existing.rows[0].wage_per_day) : 600;

  const avg_time_sec = parseFloat(s.avg_time_sec) || 0;
  const manpower = parseInt(s.manpower) || 1;
  const frequency = parseFloat(s.operation_frequency) || 1;
  const cycle_count = parseInt(s.cycle_count) || 0;

  const time_per_person = avg_time_sec * manpower;
  const smv = (time_per_person / frequency / 60) / efficiency;
  const hr_cost_per_day = wage * manpower;
  const target_per_hour = smv > 0 ? 60 / smv : 0;
  const target_per_day = target_per_hour * 8;
  const cost_per_piece = target_per_day > 0 ? hr_cost_per_day / target_per_day : 0;

  await client.query(
    `INSERT INTO operation_bulletin 
      (user_id, product_id, operation_id, operation_name, operation_priority, operation_frequency, machine_type, manpower, cycle_count, avg_time_sec, time_per_person, efficiency, smv, wage_per_day, hr_cost_per_day, target_per_hour, target_per_day, cost_per_piece, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,NOW())
     ON CONFLICT (user_id, product_id, operation_id) DO UPDATE SET
      operation_name=$4, operation_priority=$5, operation_frequency=$6, machine_type=$7, manpower=$8,
      cycle_count=$9, avg_time_sec=$10, time_per_person=$11, smv=$13,
      hr_cost_per_day=$15, target_per_hour=$16, target_per_day=$17, cost_per_piece=$18,
      updated_at=NOW()`,
    [userId, productId, operationId, s.operation_name, s.operation_priority, s.operation_frequency,
     s.machine_type, manpower, cycle_count, avg_time_sec, time_per_person, efficiency, smv,
     wage, hr_cost_per_day, target_per_hour, target_per_day, cost_per_piece]
  );
}

// GET OB products list
app.get('/api/ob/products', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Unauthorized' });
    const decoded = jwt.verify(token, JWT_SECRET);
    const result = await db.query(
  `SELECT p.id, p.product_number, p.product_name, p.product_type, p.process_type, p.status,
    COUNT(ob.id) as operation_count,
    ROUND(SUM(ob.smv)::numeric, 4) as total_smv
   FROM products p
   LEFT JOIN operation_bulletin ob ON ob.product_id = p.id AND ob.user_id = $1
   WHERE p.user_id = $1 AND p.status = 'active'
   GROUP BY p.id
   ORDER BY p.created_at DESC`,
  [decoded.userId]
);
    res.json(result.rows);
  } catch (err) {
    console.error('OB products error:', err);
    res.status(500).json({ message: err.message });
  }
});

// GET full OB for a product
app.get('/api/ob/:productId', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Unauthorized' });
    const decoded = jwt.verify(token, JWT_SECRET);

    const ob = await db.query(
      `SELECT * FROM operation_bulletin 
       WHERE product_id=$1 AND user_id=$2 
       ORDER BY operation_priority ASC`,
      [req.params.productId, decoded.userId]
    );

    // Get cycle data for matrix
    const cycles = await db.query(
      `SELECT operation_id, cycle_number,
        SUM(captured_time_sec) FILTER (WHERE include_in_study = true) as cycle_total
       FROM time_study
       WHERE product_id=$1 AND user_id=$2
       GROUP BY operation_id, cycle_number
       ORDER BY operation_id, cycle_number`,
      [req.params.productId, decoded.userId]
    );

    const maxCycles = await db.query(
      `SELECT MAX(cycle_count) as max_cycles FROM operation_bulletin WHERE product_id=$1 AND user_id=$2`,
      [req.params.productId, decoded.userId]
    );

    res.json({
      operations: ob.rows,
      cycle_matrix: cycles.rows,
      max_cycles: parseInt(maxCycles.rows[0]?.max_cycles) || 0
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT update efficiency and wage for a product's OB
app.put('/api/ob/:productId/settings', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Unauthorized' });
    const decoded = jwt.verify(token, JWT_SECRET);
    const { efficiency, wage_per_day } = req.body;
    const eff = parseFloat(efficiency) / 100;

    const ops = await db.query(
      `SELECT * FROM operation_bulletin WHERE product_id=$1 AND user_id=$2`,
      [req.params.productId, decoded.userId]
    );

    for (const op of ops.rows) {
      const smv = (parseFloat(op.time_per_person) / parseFloat(op.operation_frequency) / 60) / eff;
      const hr_cost_per_day = parseFloat(wage_per_day) * parseInt(op.manpower);
      const target_per_hour = smv > 0 ? 60 / smv : 0;
      const target_per_day = target_per_hour * 8;
      const cost_per_piece = target_per_day > 0 ? hr_cost_per_day / target_per_day : 0;

      await db.query(
        `UPDATE operation_bulletin SET 
          efficiency=$1, wage_per_day=$2, smv=$3, hr_cost_per_day=$4,
          target_per_hour=$5, target_per_day=$6, cost_per_piece=$7, updated_at=NOW()
         WHERE product_id=$8 AND user_id=$9 AND operation_id=$10`,
        [eff, wage_per_day, smv, hr_cost_per_day, target_per_hour, target_per_day, cost_per_piece,
         req.params.productId, decoded.userId, op.operation_id]
      );
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST save efficiency entry
app.post('/api/efficiency', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Unauthorized' });
    const decoded = jwt.verify(token, JWT_SECRET);
    const { product_id, line_no, process_type, manpower, sam, output, working_hours, ot_hours, available_minutes, produced_minutes, efficiency_percent, hr_cost_per_day, cost_per_piece, per_person_productivity, wage_per_day } = req.body;
    await db.query(
      `INSERT INTO efficiency_tracker (user_id, product_id, line_no, process_type, manpower, sam, output, working_hours, ot_hours, available_minutes, produced_minutes, efficiency_percent, hr_cost_per_day, cost_per_piece, per_person_productivity)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [decoded.userId, product_id, line_no, process_type, manpower, sam, output, working_hours, ot_hours, available_minutes, produced_minutes, efficiency_percent, hr_cost_per_day, cost_per_piece, per_person_productivity]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET today's efficiency entries for charts
app.get('/api/efficiency/today', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Unauthorized' });
    const decoded = jwt.verify(token, JWT_SECRET);
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const result = await db.query(
      `SELECT e.*, p.product_name, p.product_number 
       FROM efficiency_tracker e
       LEFT JOIN products p ON p.id = e.product_id
       WHERE e.user_id=$1 AND e.date=$2
       ORDER BY e.process_type, e.line_no ASC`,
      [decoded.userId, date]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET efficiency history
app.get('/api/efficiency/history', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Unauthorized' });
    const decoded = jwt.verify(token, JWT_SECRET);
    const result = await db.query(
      `SELECT e.*, p.product_name, p.product_number
       FROM efficiency_tracker e
       LEFT JOIN products p ON p.id = e.product_id
       WHERE e.user_id=$1
       ORDER BY e.date DESC, e.process_type, e.line_no ASC`,
      [decoded.userId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT update efficiency entry
app.put('/api/efficiency/:id', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Unauthorized' });
    const decoded = jwt.verify(token, JWT_SECRET);
    const { output, manpower, working_hours, ot_hours, wage_per_day, line_no,
            available_minutes, produced_minutes, efficiency_percent,
            hr_cost_per_day, cost_per_piece, per_person_productivity } = req.body;
    const result = await db.query(
      `UPDATE efficiency_tracker SET
        output=$1, manpower=$2, working_hours=$3, ot_hours=$4, wage_per_day=$5, line_no=$6,
        available_minutes=$7, produced_minutes=$8, efficiency_percent=$9,
        hr_cost_per_day=$10, cost_per_piece=$11, per_person_productivity=$12
       WHERE id=$13 AND user_id=$14 RETURNING id`,
      [output, manpower, working_hours, ot_hours, wage_per_day, line_no,
       available_minutes, produced_minutes, efficiency_percent,
       hr_cost_per_day, cost_per_piece, per_person_productivity,
       req.params.id, decoded.userId]
    );
    if (!result.rows.length) return res.status(404).json({ message: 'Not found' });
    res.json({ success: true });
  } catch (err) {
    console.error(err); res.status(500).json({ message: 'Server error' });
  }
});

// GET today's loss time entries
app.get('/api/losstime/today', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Unauthorized' });
    const decoded = jwt.verify(token, JWT_SECRET);
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const result = await db.query(
      `SELECT l.*, p.product_name, p.product_number
       FROM loss_time_tracker l
       LEFT JOIN products p ON p.id = l.product_id
       WHERE l.user_id=$1 AND l.date=$2
       ORDER BY l.created_at DESC`,
      [decoded.userId, date]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err); res.status(500).json({ message: 'Server error' });
  }
});

// GET loss reasons for a specific efficiency entry
app.get('/api/losstime/entry/:efficiencyEntryId', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Unauthorized' });
    const decoded = jwt.verify(token, JWT_SECRET);
    const result = await db.query(
      `SELECT * FROM loss_time_tracker
       WHERE user_id=$1 AND efficiency_entry_id=$2
       ORDER BY created_at ASC`,
      [decoded.userId, req.params.efficiencyEntryId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err); res.status(500).json({ message: 'Server error' });
  }
});

// POST save loss time reasons (replaces existing for that entry)
app.post('/api/losstime/save', async (req, res) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Unauthorized' });
    const decoded = jwt.verify(token, JWT_SECRET);
    const { efficiency_entry_id, product_id, line_no, process_type, total_loss_minutes, reasons } = req.body;

    // Delete existing reasons for this entry first
    await client.query(
      `DELETE FROM loss_time_tracker WHERE user_id=$1 AND efficiency_entry_id=$2`,
      [decoded.userId, efficiency_entry_id]
    );

    // Insert new reasons
    for (const r of reasons) {
      await client.query(
        `INSERT INTO loss_time_tracker (user_id, product_id, line_no, process_type, efficiency_entry_id, loss_time_category, loss_time_reason, loss_minutes_recorded, date)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,CURRENT_DATE)`,
        [decoded.userId, product_id, line_no, process_type, efficiency_entry_id, r.category, r.reason, r.minutes]
      );
    }

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err); res.status(500).json({ message: 'Server error' });
  } finally {
    client.release();
  }
});

// GET loss time history
app.get('/api/losstime/history', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Unauthorized' });
    const decoded = jwt.verify(token, JWT_SECRET);
    const result = await db.query(
      `SELECT l.*, p.product_name, p.product_number
       FROM loss_time_tracker l
       LEFT JOIN products p ON p.id = l.product_id
       WHERE l.user_id=$1
       ORDER BY l.date DESC, l.created_at DESC`,
      [decoded.userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err); res.status(500).json({ message: 'Server error' });
  }
});

app.use((req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Nexorium IE Tools server is running on http://localhost:${PORT}`);
});