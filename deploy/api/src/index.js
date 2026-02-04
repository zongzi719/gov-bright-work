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
              c.security_level, c.organization_id, c.is_leader, o.name as organization_name
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

// ==================== 通知图片 ====================

app.get('/api/notice-images', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, image_url, title FROM notice_images WHERE is_active = 1 ORDER BY sort_order'
    );
    res.json(rows);
  } catch (error) {
    console.error('Get notice images error:', error);
    res.status(500).json({ error: '获取通知图片失败' });
  }
});

// ==================== 轮播图/导航背景 ====================

app.get('/api/banners', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, image_url, title FROM banners WHERE is_active = 1 ORDER BY sort_order'
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

// 待办列表（带发起人信息）
app.get('/api/todo-items/list', async (req, res) => {
  try {
    const { assignee_id, filter } = req.query;
    
    if (!assignee_id) {
      return res.status(400).json({ error: '缺少 assignee_id 参数' });
    }
    
    let sql = `SELECT t.id, t.title, t.source_system, t.source_department, 
               t.created_at, t.priority, t.status, t.business_type, t.business_id,
               t.action_url, t.approval_instance_id, t.assignee_id, 
               t.process_result, t.processed_at,
               i.name as initiator_name, i.department as initiator_department
               FROM todo_items t
               LEFT JOIN contacts i ON t.initiator_id = i.id
               WHERE t.assignee_id = ?`;
    const params = [assignee_id];
    
    if (filter === 'pending') {
      sql += ` AND t.status IN ('pending', 'processing')`;
    } else if (filter === 'completed') {
      sql += ` AND t.status IN ('approved', 'rejected', 'completed') AND (t.process_result IS NULL OR t.process_result != 'cc_notified')`;
    } else if (filter === 'cc') {
      sql += ` AND t.process_result = 'cc_notified'`;
    }
    
    if (filter === 'completed') {
      sql += ' ORDER BY t.processed_at DESC';
    } else {
      sql += ' ORDER BY t.created_at DESC';
    }
    
    sql += ' LIMIT 50';
    
    const [rows] = await pool.execute(sql, params);
    
    // 格式化返回数据，匹配前端期望的结构
    const items = rows.map(row => ({
      id: row.id,
      title: row.title,
      source_system: row.source_system,
      source_department: row.source_department,
      created_at: row.created_at,
      priority: row.priority,
      status: row.status,
      business_type: row.business_type,
      business_id: row.business_id,
      action_url: row.action_url,
      approval_instance_id: row.approval_instance_id,
      assignee_id: row.assignee_id,
      process_result: row.process_result,
      processed_at: row.processed_at,
      initiator: row.initiator_name ? {
        name: row.initiator_name,
        department: row.initiator_department
      } : null
    }));
    
    res.json(items);
  } catch (error) {
    console.error('Get todo items list error:', error);
    res.status(500).json({ error: '获取待办列表失败' });
  }
});

// 更新待办状态
app.put('/api/todo-items/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, process_result, process_notes, processed_by } = req.body;
    
    const updates = [];
    const params = [];
    
    if (status) {
      updates.push('status = ?');
      params.push(status);
    }
    if (process_result !== undefined) {
      updates.push('process_result = ?');
      params.push(process_result);
    }
    if (process_notes !== undefined) {
      updates.push('process_notes = ?');
      params.push(process_notes);
    }
    if (processed_by) {
      updates.push('processed_by = ?');
      params.push(processed_by);
    }
    
    updates.push('processed_at = NOW()');
    updates.push('updated_at = NOW()');
    
    params.push(id);
    
    await pool.execute(
      `UPDATE todo_items SET ${updates.join(', ')} WHERE id = ?`,
      params
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Update todo item error:', error);
    res.status(500).json({ error: '更新待办失败' });
  }
});

// 删除待办
app.delete('/api/todo-items/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.execute('DELETE FROM todo_items WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete todo item error:', error);
    res.status(500).json({ error: '删除待办失败' });
  }
});

// 根据审批实例ID删除待办
app.delete('/api/todo-items/by-instance/:instanceId', async (req, res) => {
  try {
    const { instanceId } = req.params;
    await pool.execute('DELETE FROM todo_items WHERE approval_instance_id = ?', [instanceId]);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete todo items by instance error:', error);
    res.status(500).json({ error: '删除待办失败' });
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

// ==================== 管理员认证 ====================

// 管理员登录
app.post('/api/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // 查找管理员账户（通过email字段或预设管理员）
    // 离线版管理员存储在 contacts 表，通过 user_roles 关联 admin 角色
    const [admins] = await pool.execute(
      `SELECT c.id, c.name, c.email, c.mobile
       FROM contacts c
       INNER JOIN user_roles ur ON ur.user_id = c.id
       WHERE (c.email = ? OR c.mobile = ?) 
         AND c.password_hash = ?
         AND ur.role = 'admin'
         AND c.is_active = 1`,
      [email, email, password]
    );
    
    if (admins.length === 0) {
      return res.status(401).json({ error: '账号或密码错误，或没有管理员权限' });
    }
    
    res.json({ 
      success: true, 
      admin: {
        id: admins[0].id,
        email: admins[0].email || admins[0].mobile,
        name: admins[0].name,
        role: 'admin'
      }
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ error: '登录失败' });
  }
});

// ==================== 办公用品 ====================

app.get('/api/office-supplies', async (req, res) => {
  try {
    const { is_active } = req.query;
    let sql = 'SELECT * FROM office_supplies WHERE 1=1';
    const params = [];
    
    if (is_active !== undefined) {
      sql += ' AND is_active = ?';
      params.push(is_active === 'true' ? 1 : 0);
    }
    
    sql += ' ORDER BY name';
    
    const [rows] = await pool.execute(sql, params);
    res.json(rows);
  } catch (error) {
    console.error('Get office supplies error:', error);
    res.status(500).json({ error: '获取办公用品失败' });
  }
});

// ==================== 日程管理 ====================

app.get('/api/schedules', async (req, res) => {
  try {
    const { contact_id, schedule_date, start_date, end_date } = req.query;
    let sql = `SELECT s.*, c.name as contact_name, c.department as contact_department
               FROM schedules s
               LEFT JOIN contacts c ON s.contact_id = c.id
               WHERE 1=1`;
    const params = [];
    
    if (contact_id) {
      sql += ' AND s.contact_id = ?';
      params.push(contact_id);
    }
    if (schedule_date) {
      sql += ' AND s.schedule_date = ?';
      params.push(schedule_date);
    }
    // 支持日期范围查询
    if (start_date) {
      sql += ' AND s.schedule_date >= ?';
      params.push(start_date);
    }
    if (end_date) {
      sql += ' AND s.schedule_date <= ?';
      params.push(end_date);
    }
    
    sql += ' ORDER BY s.schedule_date, s.start_time';
    
    const [rows] = await pool.execute(sql, params);
    res.json(rows);
  } catch (error) {
    console.error('Get schedules error:', error);
    res.status(500).json({ error: '获取日程失败' });
  }
});

// ==================== 物资领用 ====================

app.get('/api/supply-requisitions', async (req, res) => {
  try {
    const { requisition_by, status } = req.query;
    let sql = `SELECT sr.*, c.name as requisition_by_name
               FROM supply_requisitions sr
               LEFT JOIN contacts c ON sr.requisition_by = c.id
               WHERE 1=1`;
    const params = [];
    
    if (requisition_by) {
      sql += ' AND sr.requisition_by = ?';
      params.push(requisition_by);
    }
    if (status) {
      sql += ' AND sr.status = ?';
      params.push(status);
    }
    
    sql += ' ORDER BY sr.created_at DESC';
    
    const [rows] = await pool.execute(sql, params);
    res.json(rows);
  } catch (error) {
    console.error('Get supply requisitions error:', error);
    res.status(500).json({ error: '获取领用申请失败' });
  }
});

app.post('/api/supply-requisitions', async (req, res) => {
  try {
    const id = uuidv4();
    const { requisition_by, supply_id, quantity, reason } = req.body;
    
    await pool.execute(
      `INSERT INTO supply_requisitions (id, requisition_by, supply_id, quantity, status)
       VALUES (?, ?, ?, ?, 'pending')`,
      [id, requisition_by, supply_id, quantity]
    );
    
    res.json({ success: true, id });
  } catch (error) {
    console.error('Create supply requisition error:', error);
    res.status(500).json({ error: '创建领用申请失败' });
  }
});

// 领用明细
app.get('/api/supply-requisition-items', async (req, res) => {
  try {
    const { requisition_id } = req.query;
    let sql = `SELECT sri.*, os.name as supply_name, os.unit, os.specification
               FROM supply_requisition_items sri
               LEFT JOIN office_supplies os ON sri.supply_id = os.id
               WHERE 1=1`;
    const params = [];
    
    if (requisition_id) {
      sql += ' AND sri.requisition_id = ?';
      params.push(requisition_id);
    }
    
    const [rows] = await pool.execute(sql, params);
    res.json(rows);
  } catch (error) {
    console.error('Get supply requisition items error:', error);
    res.status(500).json({ error: '获取领用明细失败' });
  }
});

app.post('/api/supply-requisition-items', async (req, res) => {
  try {
    const id = uuidv4();
    const { requisition_id, supply_id, quantity } = req.body;
    
    await pool.execute(
      `INSERT INTO supply_requisition_items (id, requisition_id, supply_id, quantity)
       VALUES (?, ?, ?, ?)`,
      [id, requisition_id, supply_id, quantity]
    );
    
    res.json({ success: true, id });
  } catch (error) {
    console.error('Create supply requisition item error:', error);
    res.status(500).json({ error: '创建领用明细失败' });
  }
});

// ==================== 物资采购 ====================

app.get('/api/supply-purchases', async (req, res) => {
  try {
    const { applicant_id, status } = req.query;
    let sql = 'SELECT * FROM supply_purchases WHERE 1=1';
    const params = [];
    
    if (applicant_id) {
      sql += ' AND applicant_id = ?';
      params.push(applicant_id);
    }
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    
    sql += ' ORDER BY created_at DESC';
    
    const [rows] = await pool.execute(sql, params);
    res.json(rows);
  } catch (error) {
    console.error('Get supply purchases error:', error);
    res.status(500).json({ error: '获取采购申请失败' });
  }
});

app.post('/api/supply-purchases', async (req, res) => {
  try {
    const id = uuidv4();
    const { applicant_id, applicant_name, department, reason, total_amount } = req.body;
    
    await pool.execute(
      `INSERT INTO supply_purchases (id, applicant_id, applicant_name, department, reason, total_amount, status)
       VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
      [id, applicant_id, applicant_name, department, reason, total_amount || 0]
    );
    
    res.json({ success: true, id });
  } catch (error) {
    console.error('Create supply purchase error:', error);
    res.status(500).json({ error: '创建采购申请失败' });
  }
});

app.get('/api/supply-purchase-items', async (req, res) => {
  try {
    const { purchase_id } = req.query;
    let sql = `SELECT spi.*, os.name as supply_name
               FROM supply_purchase_items spi
               LEFT JOIN office_supplies os ON spi.supply_id = os.id
               WHERE 1=1`;
    const params = [];
    
    if (purchase_id) {
      sql += ' AND spi.purchase_id = ?';
      params.push(purchase_id);
    }
    
    const [rows] = await pool.execute(sql, params);
    res.json(rows);
  } catch (error) {
    console.error('Get supply purchase items error:', error);
    res.status(500).json({ error: '获取采购明细失败' });
  }
});

app.post('/api/supply-purchase-items', async (req, res) => {
  try {
    const id = uuidv4();
    const { purchase_id, supply_id, item_name, specification, unit, quantity, unit_price, amount, remarks } = req.body;
    
    await pool.execute(
      `INSERT INTO supply_purchase_items (id, purchase_id, supply_id, item_name, specification, unit, quantity, unit_price, amount, remarks)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, purchase_id, supply_id, item_name, specification, unit, quantity || 1, unit_price || 0, amount || 0, remarks]
    );
    
    res.json({ success: true, id });
  } catch (error) {
    console.error('Create supply purchase item error:', error);
    res.status(500).json({ error: '创建采购明细失败' });
  }
});

// ==================== 采购申请 ====================

app.get('/api/purchase-requests', async (req, res) => {
  try {
    const { requested_by, status } = req.query;
    let sql = `SELECT pr.*, c.name as requested_by_name, os.name as supply_name
               FROM purchase_requests pr
               LEFT JOIN contacts c ON pr.requested_by = c.id
               LEFT JOIN office_supplies os ON pr.supply_id = os.id
               WHERE 1=1`;
    const params = [];
    
    if (requested_by) {
      sql += ' AND pr.requested_by = ?';
      params.push(requested_by);
    }
    if (status) {
      sql += ' AND pr.status = ?';
      params.push(status);
    }
    
    sql += ' ORDER BY pr.created_at DESC';
    
    const [rows] = await pool.execute(sql, params);
    res.json(rows);
  } catch (error) {
    console.error('Get purchase requests error:', error);
    res.status(500).json({ error: '获取采购申请失败' });
  }
});

app.post('/api/purchase-requests', async (req, res) => {
  try {
    const id = uuidv4();
    const { requested_by, department, purpose, reason, funding_source, funding_detail, 
            procurement_method, budget_amount, total_amount, expected_completion_date } = req.body;
    
    await pool.execute(
      `INSERT INTO purchase_requests (id, requested_by, department, purpose, reason, funding_source, 
       funding_detail, procurement_method, budget_amount, total_amount, expected_completion_date, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [id, requested_by, department, purpose, reason, funding_source, 
       funding_detail, procurement_method, budget_amount || 0, total_amount || 0, expected_completion_date]
    );
    
    res.json({ success: true, id });
  } catch (error) {
    console.error('Create purchase request error:', error);
    res.status(500).json({ error: '创建采购申请失败' });
  }
});

app.get('/api/purchase-request-items', async (req, res) => {
  try {
    const { request_id } = req.query;
    let sql = `SELECT pri.*, os.name as supply_name
               FROM purchase_request_items pri
               LEFT JOIN office_supplies os ON pri.supply_id = os.id
               WHERE 1=1`;
    const params = [];
    
    if (request_id) {
      sql += ' AND pri.request_id = ?';
      params.push(request_id);
    }
    
    const [rows] = await pool.execute(sql, params);
    res.json(rows);
  } catch (error) {
    console.error('Get purchase request items error:', error);
    res.status(500).json({ error: '获取采购明细失败' });
  }
});

app.post('/api/purchase-request-items', async (req, res) => {
  try {
    const id = uuidv4();
    const { request_id, supply_id, item_name, specification, unit, quantity, unit_price, amount, category_link, remarks } = req.body;
    
    await pool.execute(
      `INSERT INTO purchase_request_items (id, request_id, supply_id, item_name, specification, unit, quantity, unit_price, amount, category_link, remarks)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, request_id, supply_id, item_name, specification, unit, quantity || 1, unit_price || 0, amount || 0, category_link, remarks]
    );
    
    res.json({ success: true, id });
  } catch (error) {
    console.error('Create purchase request item error:', error);
    res.status(500).json({ error: '创建采购明细失败' });
  }
});

// ==================== 菜单更新 ====================

app.put('/api/canteen-menus/:dayOfWeek', async (req, res) => {
  try {
    const { dayOfWeek } = req.params;
    const { breakfast, lunch, dinner } = req.body;
    
    // 检查是否存在
    const [existing] = await pool.execute(
      'SELECT id FROM canteen_menus WHERE day_of_week = ?',
      [dayOfWeek]
    );
    
    if (existing.length > 0) {
      await pool.execute(
        `UPDATE canteen_menus SET breakfast = ?, lunch = ?, dinner = ?, updated_at = NOW()
         WHERE day_of_week = ?`,
        [JSON.stringify(breakfast || []), JSON.stringify(lunch || []), JSON.stringify(dinner || []), dayOfWeek]
      );
    } else {
      const id = uuidv4();
      await pool.execute(
        `INSERT INTO canteen_menus (id, day_of_week, breakfast, lunch, dinner)
         VALUES (?, ?, ?, ?, ?)`,
        [id, dayOfWeek, JSON.stringify(breakfast || []), JSON.stringify(lunch || []), JSON.stringify(dinner || [])]
      );
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Update canteen menu error:', error);
    res.status(500).json({ error: '更新菜单失败' });
  }
});

// ==================== 审批模板 ====================

app.get('/api/approval-templates', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM approval_templates WHERE is_active = 1'
    );
    res.json(rows);
  } catch (error) {
    console.error('Get approval templates error:', error);
    res.status(500).json({ error: '获取审批模板失败' });
  }
});

// ==================== 审批实例 ====================

app.get('/api/approval-instances', async (req, res) => {
  try {
    const { business_id, business_type } = req.query;
    let sql = 'SELECT * FROM approval_instances WHERE 1=1';
    const params = [];
    
    if (business_id) {
      sql += ' AND business_id = ?';
      params.push(business_id);
    }
    if (business_type) {
      sql += ' AND business_type = ?';
      params.push(business_type);
    }
    
    sql += ' ORDER BY created_at DESC';
    
    const [rows] = await pool.execute(sql, params);
    res.json(rows);
  } catch (error) {
    console.error('Get approval instances error:', error);
    res.status(500).json({ error: '获取审批实例失败' });
  }
});

// ==================== 审批记录 ====================

app.get('/api/approval-records', async (req, res) => {
  try {
    const { instance_id } = req.query;
    const [rows] = await pool.execute(
      `SELECT ar.*, c.name as approver_name, c.department as approver_department
       FROM approval_records ar
       LEFT JOIN contacts c ON ar.approver_id = c.id
       WHERE ar.instance_id = ?
       ORDER BY ar.node_index`,
      [instance_id]
    );
    
    // 格式化为前端期望的结构
    const records = rows.map(row => ({
      ...row,
      approver: row.approver_name ? {
        name: row.approver_name,
        department: row.approver_department
      } : null
    }));
    
    res.json(records);
  } catch (error) {
    console.error('Get approval records error:', error);
    res.status(500).json({ error: '获取审批记录失败' });
  }
});

// ==================== 假期余额 ====================

app.get('/api/leave-balances/:contactId', async (req, res) => {
  try {
    const { contactId } = req.params;
    const { year } = req.query;
    const currentYear = year || new Date().getFullYear();
    
    const [rows] = await pool.execute(
      'SELECT * FROM leave_balances WHERE contact_id = ? AND year = ?',
      [contactId, currentYear]
    );
    
    res.json(rows.length > 0 ? rows[0] : null);
  } catch (error) {
    console.error('Get leave balance error:', error);
    res.status(500).json({ error: '获取假期余额失败' });
  }
});

// ==================== 领导日程 ====================

app.get('/api/leader-schedules', async (req, res) => {
  try {
    const { leader_ids, start_date, end_date } = req.query;
    
    if (!leader_ids) {
      return res.json([]);
    }
    
    const ids = leader_ids.split(',');
    const placeholders = ids.map(() => '?').join(',');
    
    let sql = `SELECT ls.*, c.id as leader_id, c.name as leader_name, c.department as leader_department, c.position as leader_position
               FROM leader_schedules ls
               LEFT JOIN contacts c ON ls.leader_id = c.id
               WHERE ls.leader_id IN (${placeholders})`;
    const params = [...ids];
    
    if (start_date) {
      sql += ' AND ls.schedule_date >= ?';
      params.push(start_date);
    }
    if (end_date) {
      sql += ' AND ls.schedule_date <= ?';
      params.push(end_date);
    }
    
    sql += ' ORDER BY ls.schedule_date, ls.start_time';
    
    const [rows] = await pool.execute(sql, params);
    
    // 格式化为前端期望的结构
    const schedules = rows.map(row => ({
      ...row,
      leader: {
        id: row.leader_id,
        name: row.leader_name,
        department: row.leader_department,
        position: row.leader_position
      }
    }));
    
    res.json(schedules);
  } catch (error) {
    console.error('Get leader schedules error:', error);
    res.status(500).json({ error: '获取领导日程失败' });
  }
});

// ==================== 领导日程权限 ====================

app.get('/api/leader-schedule-permissions', async (req, res) => {
  try {
    const { user_id } = req.query;
    const [rows] = await pool.execute(
      'SELECT * FROM leader_schedule_permissions WHERE user_id = ?',
      [user_id]
    );
    res.json(rows);
  } catch (error) {
    console.error('Get leader schedule permissions error:', error);
    res.status(500).json({ error: '获取权限失败' });
  }
});

// ==================== 日程管理 CRUD ====================

app.post('/api/schedules', async (req, res) => {
  try {
    const id = uuidv4();
    const { contact_id, title, schedule_date, start_time, end_time, location, notes } = req.body;
    
    await pool.execute(
      `INSERT INTO schedules (id, contact_id, title, schedule_date, start_time, end_time, location, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, contact_id, title, schedule_date, start_time, end_time, location, notes]
    );
    
    res.json({ success: true, id });
  } catch (error) {
    console.error('Create schedule error:', error);
    res.status(500).json({ error: '创建日程失败' });
  }
});

app.put('/api/schedules/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, schedule_date, start_time, end_time, location, notes } = req.body;
    
    await pool.execute(
      `UPDATE schedules SET title = ?, schedule_date = ?, start_time = ?, end_time = ?, location = ?, notes = ?, updated_at = NOW()
       WHERE id = ?`,
      [title, schedule_date, start_time, end_time, location, notes, id]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Update schedule error:', error);
    res.status(500).json({ error: '更新日程失败' });
  }
});

app.delete('/api/schedules/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.execute('DELETE FROM schedules WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete schedule error:', error);
    res.status(500).json({ error: '删除日程失败' });
  }
});

// ==================== 待办事项扩展 ====================

app.get('/api/todo-items', async (req, res) => {
  try {
    const { assignee_id, status, process_result_ne, limit = 20 } = req.query;
    
    let sql = `
      SELECT t.*, 
             c.name as initiator_name, c.department as initiator_department
      FROM todo_items t
      LEFT JOIN contacts c ON t.initiator_id = c.id
      WHERE t.assignee_id = ?
    `;
    const params = [assignee_id];
    
    if (status) {
      const statusList = status.split(',');
      sql += ` AND t.status IN (${statusList.map(() => '?').join(',')})`;
      params.push(...statusList);
    }
    
    if (process_result_ne) {
      sql += ` AND (t.process_result IS NULL OR t.process_result != ?)`;
      params.push(process_result_ne);
    }
    
    sql += ` ORDER BY t.created_at DESC LIMIT ?`;
    params.push(parseInt(limit));
    
    const [rows] = await pool.execute(sql, params);
    
    // 格式化为前端期望的结构
    const items = rows.map(row => ({
      ...row,
      initiator: {
        name: row.initiator_name,
        department: row.initiator_department
      }
    }));
    
    res.json(items);
  } catch (error) {
    console.error('Get todo items error:', error);
    res.status(500).json({ error: '获取待办失败' });
  }
});

app.post('/api/todo-items', async (req, res) => {
  try {
    const id = uuidv4();
    const { 
      source = 'internal', business_type, business_id, title, description,
      priority = 'normal', status = 'pending', process_result,
      initiator_id, assignee_id, approval_instance_id, approval_version_number
    } = req.body;
    
    await pool.execute(
      `INSERT INTO todo_items (id, source, business_type, business_id, title, description, priority, status, process_result, initiator_id, assignee_id, approval_instance_id, approval_version_number)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, source, business_type, business_id, title, description, priority, status, process_result, initiator_id, assignee_id, approval_instance_id, approval_version_number]
    );
    
    res.json({ id });
  } catch (error) {
    console.error('Create todo item error:', error);
    res.status(500).json({ error: '创建待办失败' });
  }
});

app.put('/api/todo-items/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, process_result, processed_at, processed_by } = req.body;
    
    const updates = [];
    const params = [];
    
    if (status !== undefined) { updates.push('status = ?'); params.push(status); }
    if (process_result !== undefined) { updates.push('process_result = ?'); params.push(process_result); }
    if (processed_at !== undefined) { updates.push('processed_at = ?'); params.push(processed_at); }
    if (processed_by !== undefined) { updates.push('processed_by = ?'); params.push(processed_by); }
    updates.push('updated_at = NOW()');
    
    params.push(id);
    
    await pool.execute(
      `UPDATE todo_items SET ${updates.join(', ')} WHERE id = ?`,
      params
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Update todo item error:', error);
    res.status(500).json({ error: '更新待办失败' });
  }
});

// ==================== 审批实例扩展 ====================

app.post('/api/approval-instances', async (req, res) => {
  try {
    const id = uuidv4();
    const { 
      template_id, version_id, version_number, business_type, business_id,
      initiator_id, status = 'pending', current_node_index = 0, form_data = {}
    } = req.body;
    
    await pool.execute(
      `INSERT INTO approval_instances (id, template_id, version_id, version_number, business_type, business_id, initiator_id, status, current_node_index, form_data)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, template_id, version_id, version_number, business_type, business_id, initiator_id, status, current_node_index, JSON.stringify(form_data)]
    );
    
    res.json({ id });
  } catch (error) {
    console.error('Create approval instance error:', error);
    res.status(500).json({ error: '创建审批实例失败' });
  }
});

app.put('/api/approval-instances/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, current_node_index, completed_at, form_data } = req.body;
    
    const updates = [];
    const params = [];
    
    if (status !== undefined) { updates.push('status = ?'); params.push(status); }
    if (current_node_index !== undefined) { updates.push('current_node_index = ?'); params.push(current_node_index); }
    if (completed_at !== undefined) { updates.push('completed_at = ?'); params.push(completed_at); }
    if (form_data !== undefined) { updates.push('form_data = ?'); params.push(JSON.stringify(form_data)); }
    updates.push('updated_at = NOW()');
    
    params.push(id);
    
    await pool.execute(
      `UPDATE approval_instances SET ${updates.join(', ')} WHERE id = ?`,
      params
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Update approval instance error:', error);
    res.status(500).json({ error: '更新审批实例失败' });
  }
});

// ==================== 审批记录扩展 ====================

app.post('/api/approval-records', async (req, res) => {
  try {
    const id = uuidv4();
    const { instance_id, node_index, node_name, node_type, approver_id, status = 'pending', comment } = req.body;
    
    await pool.execute(
      `INSERT INTO approval_records (id, instance_id, node_index, node_name, node_type, approver_id, status, comment)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, instance_id, node_index, node_name, node_type, approver_id, status, comment]
    );
    
    res.json({ id });
  } catch (error) {
    console.error('Create approval record error:', error);
    res.status(500).json({ error: '创建审批记录失败' });
  }
});

app.put('/api/approval-records/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, comment, processed_at } = req.body;
    
    const updates = [];
    const params = [];
    
    if (status !== undefined) { updates.push('status = ?'); params.push(status); }
    if (comment !== undefined) { updates.push('comment = ?'); params.push(comment); }
    if (processed_at !== undefined) { updates.push('processed_at = ?'); params.push(processed_at); }
    updates.push('updated_at = NOW()');
    
    params.push(id);
    
    await pool.execute(
      `UPDATE approval_records SET ${updates.join(', ')} WHERE id = ?`,
      params
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Update approval record error:', error);
    res.status(500).json({ error: '更新审批记录失败' });
  }
});

// ==================== 审批流程版本 ====================

app.get('/api/approval-process-versions', async (req, res) => {
  try {
    const { template_id, is_current } = req.query;
    
    let sql = 'SELECT id, version_number, nodes_snapshot FROM approval_process_versions WHERE template_id = ?';
    const params = [template_id];
    
    if (is_current !== undefined) {
      sql += ' AND is_current = ?';
      params.push(is_current === 'true' ? 1 : 0);
    }
    
    sql += ' ORDER BY version_number DESC LIMIT 1';
    
    const [rows] = await pool.execute(sql, params);
    
    if (rows.length > 0) {
      const row = rows[0];
      res.json({
        ...row,
        nodes_snapshot: typeof row.nodes_snapshot === 'string' ? JSON.parse(row.nodes_snapshot) : row.nodes_snapshot
      });
    } else {
      res.json(null);
    }
  } catch (error) {
    console.error('Get approval process versions error:', error);
    res.status(500).json({ error: '获取审批流程版本失败' });
  }
});

// ==================== 缺勤记录扩展 ====================

app.post('/api/absence-records', async (req, res) => {
  try {
    const id = uuidv4();
    const {
      contact_id, type, reason, start_time, end_time,
      leave_type, out_type, out_location, destination, transport_type,
      companions, estimated_cost, duration_hours, duration_days,
      handover_person_id, handover_notes, contact_phone, notes, status = 'pending'
    } = req.body;
    
    await pool.execute(
      `INSERT INTO absence_records (id, contact_id, type, reason, start_time, end_time, leave_type, out_type, out_location, destination, transport_type, companions, estimated_cost, duration_hours, duration_days, handover_person_id, handover_notes, contact_phone, notes, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, contact_id, type, reason, start_time, end_time, leave_type, out_type, out_location, destination, transport_type, companions ? JSON.stringify(companions) : null, estimated_cost, duration_hours, duration_days, handover_person_id, handover_notes, contact_phone, notes, status]
    );
    
    res.json({ id });
  } catch (error) {
    console.error('Create absence record error:', error);
    res.status(500).json({ error: '创建缺勤记录失败' });
  }
});

app.put('/api/absence-records/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, approved_at, approved_by } = req.body;
    
    const updates = [];
    const params = [];
    
    if (status !== undefined) { updates.push('status = ?'); params.push(status); }
    if (approved_at !== undefined) { updates.push('approved_at = ?'); params.push(approved_at); }
    if (approved_by !== undefined) { updates.push('approved_by = ?'); params.push(approved_by); }
    updates.push('updated_at = NOW()');
    
    params.push(id);
    
    await pool.execute(
      `UPDATE absence_records SET ${updates.join(', ')} WHERE id = ?`,
      params
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Update absence record error:', error);
    res.status(500).json({ error: '更新缺勤记录失败' });
  }
});

// ==================== 库存变动 ====================

app.post('/api/stock-movements', async (req, res) => {
  try {
    const id = uuidv4();
    const {
      supply_id, movement_type, quantity, before_stock, after_stock,
      reference_type, reference_id, operator_name, notes
    } = req.body;
    
    await pool.execute(
      `INSERT INTO stock_movements (id, supply_id, movement_type, quantity, before_stock, after_stock, reference_type, reference_id, operator_name, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, supply_id, movement_type, quantity, before_stock, after_stock, reference_type, reference_id, operator_name, notes]
    );
    
    res.json({ id });
  } catch (error) {
    console.error('Create stock movement error:', error);
    res.status(500).json({ error: '创建库存变动失败' });
  }
});

// ==================== 办公用品库存更新 ====================

app.put('/api/office-supplies/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { current_stock } = req.body;
    
    await pool.execute(
      'UPDATE office_supplies SET current_stock = ?, updated_at = NOW() WHERE id = ?',
      [current_stock, id]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Update office supply error:', error);
    res.status(500).json({ error: '更新办公用品失败' });
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
