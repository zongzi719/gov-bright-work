const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
const PORT = process.env.API_PORT || 3001;

// 中间件
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../../uploads')));

// 数据库连接池
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'gov_platform',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// 文件上传配置
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadType = req.params.type || 'misc';
    const uploadDir = path.join(__dirname, '../../uploads', uploadType);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const filename = `${Date.now()}-${uuidv4()}${ext}`;
    cb(null, filename);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|xls|xlsx/;
    const ext = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mime = allowedTypes.test(file.mimetype);
    if (ext || mime) {
      cb(null, true);
    } else {
      cb(new Error('不支持的文件类型'));
    }
  }
});

// ==================== 认证相关 ====================

// 登录验证
app.post('/api/auth/login', async (req, res) => {
  try {
    const { mobile, password } = req.body;
    const [rows] = await pool.execute(
      `SELECT c.id, c.name, c.mobile, c.position, c.department, 
              c.security_level, c.organization_id, o.name as organization_name
       FROM contacts c
       LEFT JOIN organizations o ON c.organization_id = o.id
       WHERE c.mobile = ? AND c.password_hash = ? AND c.is_active = 1`,
      [mobile, password]
    );
    
    if (rows.length === 0) {
      return res.status(401).json({ error: '手机号或密码错误' });
    }
    
    res.json({ success: true, user: rows[0] });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: '登录失败' });
  }
});

// 修改密码
app.post('/api/auth/change-password', async (req, res) => {
  try {
    const { userId, oldPassword, newPassword } = req.body;
    
    const [user] = await pool.execute(
      'SELECT id FROM contacts WHERE id = ? AND password_hash = ?',
      [userId, oldPassword]
    );
    
    if (user.length === 0) {
      return res.status(400).json({ error: '原密码错误' });
    }
    
    await pool.execute(
      'UPDATE contacts SET password_hash = ?, updated_at = NOW() WHERE id = ?',
      [newPassword, userId]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: '修改密码失败' });
  }
});

// ==================== 文件上传 ====================

app.post('/api/upload/:type', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '没有上传文件' });
    }
    
    const baseUrl = process.env.API_BASE_URL || `http://localhost:${PORT}`;
    const fileUrl = `${baseUrl}/uploads/${req.params.type}/${req.file.filename}`;
    
    res.json({
      success: true,
      url: fileUrl,
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: '上传失败' });
  }
});

// ==================== 组织架构 ====================

app.get('/api/organizations', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM organizations ORDER BY sort_order, created_at'
    );
    res.json(rows);
  } catch (error) {
    console.error('Get organizations error:', error);
    res.status(500).json({ error: '获取组织架构失败' });
  }
});

// ==================== 通讯录 ====================

app.get('/api/contacts', async (req, res) => {
  try {
    const { organization_id, is_active } = req.query;
    let sql = 'SELECT c.*, o.name as organization_name FROM contacts c LEFT JOIN organizations o ON c.organization_id = o.id WHERE 1=1';
    const params = [];
    
    if (organization_id) {
      sql += ' AND c.organization_id = ?';
      params.push(organization_id);
    }
    if (is_active !== undefined) {
      sql += ' AND c.is_active = ?';
      params.push(is_active === 'true' ? 1 : 0);
    }
    
    sql += ' ORDER BY c.sort_order, c.created_at';
    
    const [rows] = await pool.execute(sql, params);
    res.json(rows);
  } catch (error) {
    console.error('Get contacts error:', error);
    res.status(500).json({ error: '获取通讯录失败' });
  }
});

app.get('/api/contacts/:id', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT c.*, o.name as organization_name 
       FROM contacts c 
       LEFT JOIN organizations o ON c.organization_id = o.id 
       WHERE c.id = ?`,
      [req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: '联系人不存在' });
    }
    res.json(rows[0]);
  } catch (error) {
    console.error('Get contact error:', error);
    res.status(500).json({ error: '获取联系人失败' });
  }
});

// ==================== 公告通知 ====================

app.get('/api/notices', async (req, res) => {
  try {
    const { is_published } = req.query;
    let sql = 'SELECT * FROM notices WHERE 1=1';
    const params = [];
    
    if (is_published !== undefined) {
      sql += ' AND is_published = ?';
      params.push(is_published === 'true' ? 1 : 0);
    }
    
    sql += ' ORDER BY is_pinned DESC, created_at DESC';
    
    const [rows] = await pool.execute(sql, params);
    res.json(rows);
  } catch (error) {
    console.error('Get notices error:', error);
    res.status(500).json({ error: '获取公告失败' });
  }
});

// ==================== 轮播图/导航背景 ====================

app.get('/api/banners', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM banners WHERE is_active = 1 ORDER BY sort_order LIMIT 1'
    );
    res.json(rows);
  } catch (error) {
    console.error('Get banners error:', error);
    res.status(500).json({ error: '获取背景失败' });
  }
});

app.post('/api/banners', async (req, res) => {
  try {
    const { image_url, title } = req.body;
    const id = uuidv4();
    
    // 先删除旧的
    await pool.execute('DELETE FROM banners');
    
    // 插入新的
    await pool.execute(
      'INSERT INTO banners (id, image_url, title, sort_order, is_active) VALUES (?, ?, ?, 1, 1)',
      [id, image_url, title || '导航栏背景']
    );
    
    res.json({ success: true, id });
  } catch (error) {
    console.error('Create banner error:', error);
    res.status(500).json({ error: '保存背景失败' });
  }
});

// ==================== 食堂菜单 ====================

app.get('/api/canteen-menus', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM canteen_menus ORDER BY day_of_week'
    );
    // 解析JSON字段
    const menus = rows.map(row => ({
      ...row,
      breakfast: JSON.parse(row.breakfast || '[]'),
      lunch: JSON.parse(row.lunch || '[]'),
      dinner: JSON.parse(row.dinner || '[]')
    }));
    res.json(menus);
  } catch (error) {
    console.error('Get menus error:', error);
    res.status(500).json({ error: '获取菜单失败' });
  }
});

// ==================== 待办事项 ====================

app.get('/api/todo-items', async (req, res) => {
  try {
    const { assignee_id, status } = req.query;
    let sql = `SELECT t.*, 
               i.name as initiator_name,
               a.name as assignee_name
               FROM todo_items t
               LEFT JOIN contacts i ON t.initiator_id = i.id
               LEFT JOIN contacts a ON t.assignee_id = a.id
               WHERE 1=1`;
    const params = [];
    
    if (assignee_id) {
      sql += ' AND t.assignee_id = ?';
      params.push(assignee_id);
    }
    if (status) {
      const statuses = status.split(',');
      sql += ` AND t.status IN (${statuses.map(() => '?').join(',')})`;
      params.push(...statuses);
    }
    
    sql += ' ORDER BY t.created_at DESC';
    
    const [rows] = await pool.execute(sql, params);
    res.json(rows);
  } catch (error) {
    console.error('Get todo items error:', error);
    res.status(500).json({ error: '获取待办失败' });
  }
});

// 待办数量统计
app.get('/api/todo-items/count', async (req, res) => {
  try {
    const { assignee_id } = req.query;
    const [rows] = await pool.execute(
      `SELECT COUNT(*) as count FROM todo_items 
       WHERE assignee_id = ? AND status IN ('pending', 'processing')`,
      [assignee_id]
    );
    res.json({ count: rows[0].count });
  } catch (error) {
    console.error('Get todo count error:', error);
    res.status(500).json({ error: '获取待办数量失败' });
  }
});

// ==================== 请假/外出/出差记录 ====================

app.get('/api/absence-records', async (req, res) => {
  try {
    const { contact_id, type, status } = req.query;
    let sql = `SELECT ar.*, c.name as contact_name 
               FROM absence_records ar
               LEFT JOIN contacts c ON ar.contact_id = c.id
               WHERE 1=1`;
    const params = [];
    
    if (contact_id) {
      sql += ' AND ar.contact_id = ?';
      params.push(contact_id);
    }
    if (type) {
      sql += ' AND ar.type = ?';
      params.push(type);
    }
    if (status) {
      sql += ' AND ar.status = ?';
      params.push(status);
    }
    
    sql += ' ORDER BY ar.created_at DESC';
    
    const [rows] = await pool.execute(sql, params);
    res.json(rows);
  } catch (error) {
    console.error('Get absence records error:', error);
    res.status(500).json({ error: '获取记录失败' });
  }
});

app.post('/api/absence-records', async (req, res) => {
  try {
    const id = uuidv4();
    const fields = ['id', 'contact_id', 'type', 'reason', 'start_time', 'end_time', 
                    'leave_type', 'duration_hours', 'duration_days', 'destination',
                    'transport_type', 'estimated_cost', 'companions', 'handover_person_id',
                    'handover_notes', 'contact_phone', 'out_type', 'out_location'];
    
    const values = [id];
    const placeholders = ['?'];
    
    fields.slice(1).forEach(field => {
      if (req.body[field] !== undefined) {
        values.push(field === 'companions' ? JSON.stringify(req.body[field]) : req.body[field]);
        placeholders.push('?');
      }
    });
    
    const usedFields = ['id', ...fields.slice(1).filter(f => req.body[f] !== undefined)];
    
    await pool.execute(
      `INSERT INTO absence_records (${usedFields.join(', ')}) VALUES (${placeholders.join(', ')})`,
      values
    );
    
    res.json({ success: true, id });
  } catch (error) {
    console.error('Create absence record error:', error);
    res.status(500).json({ error: '创建记录失败' });
  }
});

// ==================== 文件收发 ====================

app.get('/api/file-transfers', async (req, res) => {
  try {
    const { status } = req.query;
    let sql = 'SELECT * FROM file_transfers WHERE 1=1';
    const params = [];
    
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    
    sql += ' ORDER BY created_at DESC';
    
    const [rows] = await pool.execute(sql, params);
    // 解析attachments JSON
    const transfers = rows.map(row => ({
      ...row,
      attachments: JSON.parse(row.attachments || '[]')
    }));
    res.json(transfers);
  } catch (error) {
    console.error('Get file transfers error:', error);
    res.status(500).json({ error: '获取文件收发失败' });
  }
});

app.post('/api/file-transfers', async (req, res) => {
  try {
    const id = uuidv4();
    const { title, doc_number, send_unit, security_level, urgency, attachments, ...rest } = req.body;
    
    await pool.execute(
      `INSERT INTO file_transfers (id, title, doc_number, send_unit, security_level, urgency, attachments)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, title, doc_number, send_unit, security_level || '公开', urgency || '普通', JSON.stringify(attachments || [])]
    );
    
    res.json({ success: true, id });
  } catch (error) {
    console.error('Create file transfer error:', error);
    res.status(500).json({ error: '创建文件收发失败' });
  }
});

// ==================== 健康检查 ====================

app.get('/api/health', async (req, res) => {
  try {
    await pool.execute('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    res.status(500).json({ status: 'error', database: 'disconnected' });
  }
});

// 启动服务
app.listen(PORT, '0.0.0.0', () => {
  console.log(`API服务已启动: http://0.0.0.0:${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/api/health`);
});
