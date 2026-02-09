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

// 日期格式转换 - ISO 8601 转 MySQL DATETIME
function formatDateForMySQL(isoString) {
  if (!isoString) return null;
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;
    return date.toISOString().slice(0, 19).replace('T', ' ');
  } catch {
    return isoString;
  }
}

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

// 登录验证 - 支持账号或手机号登录
app.post('/api/auth/login', async (req, res) => {
  try {
    const { mobile, password } = req.body; // mobile 字段现在可以是账号或手机号
    const [rows] = await pool.execute(
      `SELECT c.id, c.name, c.mobile, c.account, c.position, c.department, 
              c.security_level, c.organization_id, c.is_leader, o.name as organization_name
       FROM contacts c
       LEFT JOIN organizations o ON c.organization_id = o.id
       WHERE (c.mobile = ? OR c.account = ?) AND c.password_hash = ? AND c.is_active = 1`,
      [mobile, mobile, password]
    );
    
    if (rows.length === 0) {
      return res.status(401).json({ error: '账号或密码错误' });
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
    
    // 返回相对路径，让前端根据 API_BASE_URL 构建完整地址
    const fileUrl = `/uploads/${req.params.type}/${req.file.filename}`;
    
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

app.post('/api/organizations', async (req, res) => {
  try {
    const { name, short_name, parent_id, level, sort_order, address, phone, direct_supervisor_id, department_head_id } = req.body;
    const id = uuidv4();
    
    await pool.execute(
      `INSERT INTO organizations (id, name, short_name, parent_id, level, sort_order, address, phone, direct_supervisor_id, department_head_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [id, name, short_name || null, parent_id || null, level || 1, sort_order || 0, address || null, phone || null, direct_supervisor_id || null, department_head_id || null]
    );
    
    res.json({ id });
  } catch (error) {
    console.error('Create organization error:', error);
    res.status(500).json({ error: '创建组织失败' });
  }
});

app.put('/api/organizations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const fields = [];
    const values = [];
    
    if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
    if (updates.short_name !== undefined) { fields.push('short_name = ?'); values.push(updates.short_name); }
    if (updates.parent_id !== undefined) { fields.push('parent_id = ?'); values.push(updates.parent_id || null); }
    if (updates.level !== undefined) { fields.push('level = ?'); values.push(updates.level); }
    if (updates.sort_order !== undefined) { fields.push('sort_order = ?'); values.push(updates.sort_order); }
    if (updates.address !== undefined) { fields.push('address = ?'); values.push(updates.address); }
    if (updates.phone !== undefined) { fields.push('phone = ?'); values.push(updates.phone); }
    if (updates.direct_supervisor_id !== undefined) { fields.push('direct_supervisor_id = ?'); values.push(updates.direct_supervisor_id || null); }
    if (updates.department_head_id !== undefined) { fields.push('department_head_id = ?'); values.push(updates.department_head_id || null); }
    
    if (fields.length === 0) {
      return res.json({ success: true });
    }
    
    fields.push('updated_at = NOW()');
    values.push(id);
    
    await pool.execute(
      `UPDATE organizations SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Update organization error:', error);
    res.status(500).json({ error: '更新组织失败' });
  }
});

app.delete('/api/organizations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 先删除关联的联系人
    await pool.execute('DELETE FROM contacts WHERE organization_id = ?', [id]);
    // 再删除组织
    await pool.execute('DELETE FROM organizations WHERE id = ?', [id]);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Delete organization error:', error);
    res.status(500).json({ error: '删除组织失败' });
  }
});

// ==================== 通讯录 ====================

app.get('/api/contacts', async (req, res) => {
  try {
    const { organization_id, is_active, all, with_org, is_leader, ids, for_leave_balance } = req.query;
    
    // 假期余额专用查询 - 返回特定字段和关联的组织信息
    if (for_leave_balance === 'true') {
      const sql = `
        SELECT c.id, c.name, c.department, c.position, c.first_work_date, c.created_at,
               o.id as org_id, o.name as org_name
        FROM contacts c
        LEFT JOIN organizations o ON c.organization_id = o.id
        WHERE c.is_active = 1
        ORDER BY c.name
      `;
      const [rows] = await pool.execute(sql);
      const formatted = rows.map(row => ({
        id: row.id,
        name: row.name,
        department: row.department,
        position: row.position,
        first_work_date: row.first_work_date,
        created_at: row.created_at,
        organization: row.org_id ? { id: row.org_id, name: row.org_name } : null
      }));
      return res.json(formatted);
    }
    
    let sql = 'SELECT c.*, o.name as organization_name FROM contacts c LEFT JOIN organizations o ON c.organization_id = o.id WHERE 1=1';
    const params = [];
    
    if (ids) {
      const idList = ids.split(',');
      sql += ` AND c.id IN (${idList.map(() => '?').join(',')})`;
      params.push(...idList);
    }
    if (organization_id) {
      sql += ' AND c.organization_id = ?';
      params.push(organization_id);
    }
    if (is_active !== undefined && all !== 'true') {
      sql += ' AND c.is_active = ?';
      params.push(is_active === 'true' ? 1 : 0);
    }
    if (is_leader !== undefined) {
      sql += ' AND c.is_leader = ?';
      params.push(is_leader === 'true' ? 1 : 0);
    }
    
    sql += ' ORDER BY c.sort_order, c.created_at';
    
    const [rows] = await pool.execute(sql, params);
    
    // 如果需要 with_org 格式，添加 organization 对象
    if (with_org === 'true') {
      const formatted = rows.map(row => ({
        ...row,
        organization: row.organization_name ? { name: row.organization_name } : null
      }));
      return res.json(formatted);
    }
    
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

// 获取联系人所属组织的主管信息
app.get('/api/contacts/:id/organization-approvers', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT o.direct_supervisor_id, o.department_head_id
       FROM contacts c
       LEFT JOIN organizations o ON c.organization_id = o.id
       WHERE c.id = ?`,
      [req.params.id]
    );
    if (rows.length === 0) {
      return res.json({ direct_supervisor_id: null, department_head_id: null });
    }
    res.json(rows[0]);
  } catch (error) {
    console.error('Get organization approvers error:', error);
    res.status(500).json({ error: '获取主管信息失败' });
  }
});

app.post('/api/contacts', async (req, res) => {
  try {
    const { 
      organization_id, name, position, department, phone, mobile, email, 
      office_location, sort_order, is_active, status, status_note, 
      security_level, is_leader, first_work_date, password_hash, account 
    } = req.body;
    const id = uuidv4();
    
    await pool.execute(
      `INSERT INTO contacts (id, organization_id, name, position, department, phone, mobile, email, 
       office_location, sort_order, is_active, status, status_note, security_level, is_leader, 
       first_work_date, password_hash, account, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [id, organization_id, name, position || null, department || null, phone || null, 
       mobile || null, email || null, office_location || null, sort_order || 0, 
       is_active !== false ? 1 : 0, status || 'on_duty', status_note || null, 
       security_level || '公开', is_leader ? 1 : 0, first_work_date || null, password_hash || '123456',
       account || null]
    );
    
    res.json({ id });
  } catch (error) {
    console.error('Create contact error:', error);
    res.status(500).json({ error: '创建联系人失败' });
  }
});

app.put('/api/contacts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const fields = [];
    const values = [];
    
    if (updates.organization_id !== undefined) { fields.push('organization_id = ?'); values.push(updates.organization_id); }
    if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
    if (updates.position !== undefined) { fields.push('position = ?'); values.push(updates.position); }
    if (updates.department !== undefined) { fields.push('department = ?'); values.push(updates.department); }
    if (updates.phone !== undefined) { fields.push('phone = ?'); values.push(updates.phone); }
    if (updates.mobile !== undefined) { fields.push('mobile = ?'); values.push(updates.mobile); }
    if (updates.email !== undefined) { fields.push('email = ?'); values.push(updates.email); }
    if (updates.office_location !== undefined) { fields.push('office_location = ?'); values.push(updates.office_location); }
    if (updates.sort_order !== undefined) { fields.push('sort_order = ?'); values.push(updates.sort_order); }
    if (updates.is_active !== undefined) { fields.push('is_active = ?'); values.push(updates.is_active ? 1 : 0); }
    if (updates.status !== undefined) { fields.push('status = ?'); values.push(updates.status); }
    if (updates.status_note !== undefined) { fields.push('status_note = ?'); values.push(updates.status_note); }
    if (updates.security_level !== undefined) { fields.push('security_level = ?'); values.push(updates.security_level); }
    if (updates.is_leader !== undefined) { fields.push('is_leader = ?'); values.push(updates.is_leader ? 1 : 0); }
    if (updates.first_work_date !== undefined) { fields.push('first_work_date = ?'); values.push(updates.first_work_date); }
    if (updates.account !== undefined) { fields.push('account = ?'); values.push(updates.account); }
    
    if (fields.length === 0) {
      return res.json({ success: true });
    }
    
    fields.push('updated_at = NOW()');
    values.push(id);
    
    await pool.execute(
      `UPDATE contacts SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Update contact error:', error);
    res.status(500).json({ error: '更新联系人失败' });
  }
});

app.delete('/api/contacts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.execute('DELETE FROM contacts WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete contact error:', error);
    res.status(500).json({ error: '删除联系人失败' });
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
    const { all } = req.query;
    let sql = 'SELECT * FROM banners';
    if (all !== 'true') {
      sql += ' WHERE is_active = 1';
    }
    sql += ' ORDER BY sort_order';
    const [rows] = await pool.execute(sql);
    res.json(rows);
  } catch (error) {
    console.error('Get banners error:', error);
    res.status(500).json({ error: '获取背景失败' });
  }
});

app.post('/api/banners', async (req, res) => {
  try {
    const { image_url, title, sort_order, is_active } = req.body;
    const id = uuidv4();
    
    // 先删除旧的
    await pool.execute('DELETE FROM banners');
    
    // 插入新的
    await pool.execute(
      'INSERT INTO banners (id, image_url, title, sort_order, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())',
      [id, image_url, title || '导航栏背景', sort_order || 1, is_active !== false ? 1 : 0]
    );
    
    res.json({ success: true, id });
  } catch (error) {
    console.error('Create banner error:', error);
    res.status(500).json({ error: '保存背景失败' });
  }
});

app.put('/api/banners/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const fields = [];
    const values = [];
    
    if (updates.image_url !== undefined) { fields.push('image_url = ?'); values.push(updates.image_url); }
    if (updates.title !== undefined) { fields.push('title = ?'); values.push(updates.title); }
    if (updates.sort_order !== undefined) { fields.push('sort_order = ?'); values.push(updates.sort_order); }
    if (updates.is_active !== undefined) { fields.push('is_active = ?'); values.push(updates.is_active ? 1 : 0); }
    
    if (fields.length === 0) {
      return res.json({ success: true });
    }
    
    fields.push('updated_at = NOW()');
    values.push(id);
    
    await pool.execute(
      `UPDATE banners SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Update banner error:', error);
    res.status(500).json({ error: '更新背景失败' });
  }
});

app.delete('/api/banners/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.execute('DELETE FROM banners WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete banner error:', error);
    res.status(500).json({ error: '删除背景失败' });
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
               i.name as initiator_name, COALESCE(o.name, i.department) as initiator_department
               FROM todo_items t
               LEFT JOIN contacts i ON t.initiator_id = i.id
               LEFT JOIN organizations o ON i.organization_id = o.id
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
    
    // 先获取基础数据
    let baseSql = `SELECT ar.*, 
               c.name as contact_name, c.department as contact_department,
               hp.name as handover_person_name
               FROM absence_records ar
               LEFT JOIN contacts c ON ar.contact_id = c.id
               LEFT JOIN contacts hp ON ar.handover_person_id = hp.id
               WHERE 1=1`;
    const params = [];
    
    if (contact_id) {
      baseSql += ' AND ar.contact_id = ?';
      params.push(contact_id);
    }
    if (type) {
      baseSql += ' AND ar.type = ?';
      params.push(type);
    }
    if (status) {
      baseSql += ' AND ar.status = ?';
      params.push(status);
    }
    
    baseSql += ' ORDER BY ar.created_at DESC';
    
    const [rows] = await pool.execute(baseSql, params);
    
    // 批量查询审批实例状态（使用 SQL LOWER 函数确保大小写无关匹配）
    let approvalStatusMap = {};
    
    if (rows.length > 0) {
      // 分别查询每种业务类型的审批实例
      const businessTypes = [...new Set(rows.map(r => r.type))];
      
      for (const bType of businessTypes) {
        const typeRows = rows.filter(r => r.type === bType);
        if (typeRows.length === 0) continue;
        
        // 使用小写ID进行查询
        const typeBusinessIds = typeRows.map(r => String(r.id).toLowerCase());
        const placeholders = typeBusinessIds.map(() => 'LOWER(?)').join(',');
        
        // SQL 中同时对 business_id 和参数都使用 LOWER 确保匹配
        const sql = `SELECT business_id, status, form_data FROM approval_instances 
           WHERE LOWER(business_id) IN (${placeholders}) AND business_type = ?`;
        
        console.log(`[DEBUG-v5] SQL: ${sql}`);
        console.log(`[DEBUG-v5] Params:`, [...typeBusinessIds, bType]);
        
        const [aiRows] = await pool.execute(sql, [...typeBusinessIds, bType]);
        
        console.log(`[DEBUG-v5] Query result for business_type=${bType}: found ${aiRows.length} approval instances`);
        
        for (const ai of aiRows) {
          // 标准化 business_id 为小写字符串
          const normalizedId = String(ai.business_id).toLowerCase();
          console.log(`[DEBUG-v5] Mapping: business_id=${normalizedId}, status=${ai.status}`);
          approvalStatusMap[normalizedId] = {
            status: ai.status,
            form_data: ai.form_data
          };
        }
      }
    }
    
    console.log('[DEBUG-v5] Approval status map keys:', Object.keys(approvalStatusMap));
    console.log('[DEBUG-v5] Row IDs:', rows.map(r => String(r.id).toLowerCase()));
    
    // 格式化返回数据，合并审批实例的真实状态
    const result = rows.map(row => {
      let displayStatus = row.status;
      // 标准化 row.id 为小写进行匹配
      const normalizedRowId = String(row.id).toLowerCase();
      const approvalInfo = approvalStatusMap[normalizedRowId];
      
      // 如果有审批实例，使用审批实例的状态
      if (approvalInfo) {
        console.log(`[DEBUG-v5] Record ${row.id}: MATCHED! approval_status=${approvalInfo.status}`);
        displayStatus = approvalInfo.status;
        
        // 检查是否有退回信息
        if (approvalInfo.status === 'pending' && approvalInfo.form_data) {
          try {
            const formData = typeof approvalInfo.form_data === 'string' 
              ? JSON.parse(approvalInfo.form_data) 
              : approvalInfo.form_data;
            if (formData._return_info) {
              const returnType = formData._return_info.type;
              if (returnType === 'return_to_initiator_current') {
                displayStatus = 'returned_to_initiator';
              } else if (returnType === 'return_restart') {
                displayStatus = 'returned_restart';
              } else if (returnType === 'return_to_previous') {
                displayStatus = 'returned_to_previous';
              } else {
                displayStatus = 'returned_to_initiator';
              }
            }
          } catch (e) {
            // JSON 解析失败，使用原状态
          }
        }
      } else {
        console.log(`[DEBUG-v5] Record ${row.id}: NO MATCH found (normalized: ${normalizedRowId})`);
      }
      
      return {
        ...row,
        // 使用审批实例的真实状态覆盖业务表状态
        status: displayStatus,
        contacts: row.contact_id ? {
          name: row.contact_name,
          department: row.contact_department
        } : null,
        handover_person: row.handover_person_name ? {
          name: row.handover_person_name
        } : null
      };
    });
    
    res.json(result);
  } catch (error) {
    console.error('Get absence records error:', error);
    res.status(500).json({ error: '获取记录失败' });
  }
});

// 日期格式转换辅助函数：ISO 8601 转 MySQL DATETIME
function formatDateForMySQL(isoDateString) {
  if (!isoDateString) return null;
  try {
    const date = new Date(isoDateString);
    if (isNaN(date.getTime())) return isoDateString; // 无法解析则原样返回
    return date.toISOString().slice(0, 19).replace('T', ' ');
  } catch {
    return isoDateString;
  }
}

app.post('/api/absence-records', async (req, res) => {
  try {
    const id = uuidv4();
    const { 
      contact_id, type, reason, start_time, end_time,
      leave_type, duration_hours, duration_days, destination,
      transport_type, estimated_cost, companions, handover_person_id,
      handover_notes, contact_phone, out_type, out_location, notes, status
    } = req.body;
    
    // 日志记录请求体，便于调试
    console.log('Creating absence record:', { contact_id, type, reason, start_time, end_time, leave_type });
    
    // 构建动态SQL
    const fieldValues = { id };
    
    // 必填字段
    if (contact_id) fieldValues.contact_id = contact_id;
    if (type) fieldValues.type = type;
    if (reason) fieldValues.reason = reason;
    if (start_time) fieldValues.start_time = formatDateForMySQL(start_time);
    
    // 可选字段 - 日期字段需要格式转换
    if (end_time !== undefined && end_time !== null) fieldValues.end_time = formatDateForMySQL(end_time);
    if (leave_type !== undefined && leave_type !== null) fieldValues.leave_type = leave_type;
    if (duration_hours !== undefined && duration_hours !== null) fieldValues.duration_hours = duration_hours;
    if (duration_days !== undefined && duration_days !== null) fieldValues.duration_days = duration_days;
    if (destination !== undefined && destination !== null) fieldValues.destination = destination;
    if (transport_type !== undefined && transport_type !== null) fieldValues.transport_type = transport_type;
    if (estimated_cost !== undefined && estimated_cost !== null) fieldValues.estimated_cost = estimated_cost;
    if (companions !== undefined && companions !== null) fieldValues.companions = JSON.stringify(companions);
    if (handover_person_id !== undefined && handover_person_id !== null && handover_person_id !== '') fieldValues.handover_person_id = handover_person_id;
    if (handover_notes !== undefined && handover_notes !== null) fieldValues.handover_notes = handover_notes;
    if (contact_phone !== undefined && contact_phone !== null) fieldValues.contact_phone = contact_phone;
    if (out_type !== undefined && out_type !== null) fieldValues.out_type = out_type;
    if (out_location !== undefined && out_location !== null) fieldValues.out_location = out_location;
    if (notes !== undefined && notes !== null) fieldValues.notes = notes;
    if (status !== undefined && status !== null) fieldValues.status = status;
    
    const fields = Object.keys(fieldValues);
    const values = Object.values(fieldValues);
    const placeholders = fields.map(() => '?').join(', ');
    
    console.log('Insert SQL fields:', fields);
    
    await pool.execute(
      `INSERT INTO absence_records (${fields.join(', ')}) VALUES (${placeholders})`,
      values
    );
    
    res.json({ success: true, id });
  } catch (error) {
    console.error('Create absence record error:', error);
    res.status(500).json({ error: '创建记录失败', detail: error.message });
  }
});

// 批量获取缺勤记录（用于待办列表丰富显示）
app.get('/api/absence-records/batch', async (req, res) => {
  try {
    const { ids } = req.query;
    
    if (!ids) {
      return res.json([]);
    }
    
    const idList = ids.split(',').filter(id => id.trim());
    if (idList.length === 0) {
      return res.json([]);
    }
    
    const placeholders = idList.map(() => '?').join(',');
    const [rows] = await pool.execute(
      `SELECT ar.id, ar.reason, ar.leave_type, ar.type,
              c.name as contact_name
       FROM absence_records ar
       LEFT JOIN contacts c ON ar.contact_id = c.id
       WHERE ar.id IN (${placeholders})`,
      idList
    );
    
    // 格式化为前端期望的结构（模拟 Supabase）
    const result = rows.map(row => ({
      id: row.id,
      reason: row.reason,
      leave_type: row.leave_type,
      type: row.type,
      contacts: row.contact_name ? {
        name: row.contact_name
      } : null
    }));
    
    res.json(result);
  } catch (error) {
    console.error('Batch get absence records error:', error);
    res.status(500).json({ error: '批量获取缺勤记录失败' });
  }
});

// 获取单条缺勤记录详情（含联系人信息）
app.get('/api/absence-records/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.execute(
      `SELECT ar.*, 
              c.id as contact_id, c.name as contact_name, 
              COALESCE(o.name, c.department) as contact_department,
              hp.name as handover_person_name
       FROM absence_records ar
       LEFT JOIN contacts c ON ar.contact_id = c.id
       LEFT JOIN organizations o ON c.organization_id = o.id
       LEFT JOIN contacts hp ON ar.handover_person_id = hp.id
       WHERE ar.id = ?`,
      [id]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ error: '记录不存在' });
    }
    
    const row = rows[0];
    
    // 格式化返回数据，模拟 Supabase 的关联数据结构
    const result = {
      ...row,
      contacts: row.contact_id ? {
        id: row.contact_id,
        name: row.contact_name,
        department: row.contact_department
      } : null,
      handover_person: row.handover_person_name ? {
        name: row.handover_person_name
      } : null
    };
    
    // 删除冗余字段
    delete result.contact_name;
    delete result.contact_department;
    delete result.handover_person_name;
    
    res.json(result);
  } catch (error) {
    console.error('Get absence record by id error:', error);
    res.status(500).json({ error: '获取缺勤记录失败' });
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
    
    // 首先检查是否为硬编码的超级管理员（admin@gov.cn）
    if (email === 'admin@gov.cn' && password === 'admin123456') {
      return res.json({ 
        success: true, 
        admin: {
          id: 'super-admin',
          email: 'admin@gov.cn',
          name: '超级管理员',
          role: 'admin'
        }
      });
    }
    
    // 查找管理员账户（通过email字段或mobile字段）
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
    
    // 如果未找到，尝试检查 is_leader 为 true 的用户是否有管理权限
    if (admins.length === 0) {
      const [leaders] = await pool.execute(
        `SELECT c.id, c.name, c.email, c.mobile
         FROM contacts c
         WHERE (c.email = ? OR c.mobile = ?) 
           AND c.password_hash = ?
           AND c.is_leader = 1
           AND c.is_active = 1`,
        [email, email, password]
      );
      
      if (leaders.length > 0) {
        return res.json({ 
          success: true, 
          admin: {
            id: leaders[0].id,
            email: leaders[0].email || leaders[0].mobile,
            name: leaders[0].name,
            role: 'admin'
          }
        });
      }
      
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
      // 同时支持字符串 'true'/'false' 和数字 1/0
      sql += ' AND (is_active = ? OR is_active = ?)';
      params.push(is_active === 'true' ? 1 : 0);
      params.push(is_active === 'true' ? 'true' : 'false');
    }
    
    sql += ' ORDER BY name';
    
    const [rows] = await pool.execute(sql, params);
    
    // 确保返回数据格式正确，将 is_active 转为 boolean
    const formattedRows = rows.map(row => ({
      ...row,
      is_active: row.is_active === 1 || row.is_active === '1' || row.is_active === true || row.is_active === 'true'
    }));
    
    res.json(formattedRows);
  } catch (error) {
    console.error('Get office supplies error:', error);
    res.status(500).json({ error: '获取办公用品失败' });
  }
});

// 获取单个办公用品
app.get('/api/office-supplies/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.execute(
      'SELECT id, current_stock, name FROM office_supplies WHERE id = ?',
      [id]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ error: '物品不存在' });
    }
    
    res.json(rows[0]);
  } catch (error) {
    console.error('Get office supply by id error:', error);
    res.status(500).json({ error: '获取办公用品失败' });
  }
});

// ==================== 日程管理 ====================

app.get('/api/schedules', async (req, res) => {
  try {
    const { contact_id, schedule_date, start_date, end_date } = req.query;
    let sql = `SELECT s.*, c.name as contact_name, c.department as contact_department,
               o.name as organization_name
               FROM schedules s
               LEFT JOIN contacts c ON s.contact_id = c.id
               LEFT JOIN organizations o ON c.organization_id = o.id
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
    
    // 格式化返回数据，添加嵌套的 contact 对象以匹配前端期望格式
    const formattedRows = rows.map(row => ({
      id: row.id,
      contact_id: row.contact_id,
      title: row.title,
      schedule_date: row.schedule_date,
      start_time: row.start_time,
      end_time: row.end_time,
      location: row.location,
      notes: row.notes,
      created_at: row.created_at,
      updated_at: row.updated_at,
      contact: {
        id: row.contact_id,
        name: row.contact_name,
        department: row.contact_department,
        organization: row.organization_name ? { name: row.organization_name } : null
      }
    }));
    
    res.json(formattedRows);
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
    const { applicant_id, applicant_name, department, reason, total_amount, purchase_date } = req.body;
    
    // 如果没有提供 purchase_date，使用当前日期
    const purchaseDateValue = purchase_date || new Date().toISOString().split('T')[0];
    
    await pool.execute(
      `INSERT INTO supply_purchases (id, applicant_id, applicant_name, department, reason, total_amount, purchase_date, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [id, applicant_id, applicant_name, department, reason, total_amount || 0, purchaseDateValue]
    );
    
    res.json({ success: true, id });
  } catch (error) {
    console.error('Create supply purchase error:', error);
    res.status(500).json({ error: '创建采购申请失败', detail: error.message });
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
            procurement_method, budget_amount, total_amount, expected_completion_date, purchase_date } = req.body;
    
    // 如果没有提供 purchase_date，使用当前日期
    const purchaseDateValue = purchase_date || new Date().toISOString().split('T')[0];
    
    await pool.execute(
      `INSERT INTO purchase_requests (id, requested_by, department, purpose, reason, funding_source, 
       funding_detail, procurement_method, budget_amount, total_amount, expected_completion_date, purchase_date, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [id, requested_by, department, purpose, reason, funding_source, 
       funding_detail, procurement_method, budget_amount || 0, total_amount || 0, expected_completion_date, purchaseDateValue]
    );
    
    res.json({ success: true, id });
  } catch (error) {
    console.error('Create purchase request error:', error);
    res.status(500).json({ error: '创建采购申请失败', detail: error.message });
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

// 按 ID 更新菜谱
app.put('/api/canteen-menus/id/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { breakfast, lunch, dinner } = req.body;
    
    await pool.execute(
      `UPDATE canteen_menus SET breakfast = ?, lunch = ?, dinner = ?, updated_at = NOW()
       WHERE id = ?`,
      [JSON.stringify(breakfast || []), JSON.stringify(lunch || []), JSON.stringify(dinner || []), id]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Update canteen menu by id error:', error);
    res.status(500).json({ error: '更新菜单失败' });
  }
});

// 创建菜谱
app.post('/api/canteen-menus', async (req, res) => {
  try {
    const { day_of_week, breakfast, lunch, dinner } = req.body;
    const id = uuidv4();
    
    await pool.execute(
      `INSERT INTO canteen_menus (id, day_of_week, breakfast, lunch, dinner, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
      [id, day_of_week, JSON.stringify(breakfast || []), JSON.stringify(lunch || []), JSON.stringify(dinner || [])]
    );
    
    res.json({ success: true, id });
  } catch (error) {
    console.error('Create canteen menu error:', error);
    res.status(500).json({ error: '创建菜单失败' });
  }
});

// 删除菜谱
app.delete('/api/canteen-menus/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    await pool.execute('DELETE FROM canteen_menus WHERE id = ?', [id]);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Delete canteen menu error:', error);
    res.status(500).json({ error: '删除菜单失败' });
  }
});

// ==================== 审批模板 ====================

// 获取审批模板列表
app.get('/api/approval-templates', async (req, res) => {
  try {
    const { include_inactive } = req.query;
    let sql = 'SELECT * FROM approval_templates';
    if (!include_inactive || include_inactive !== 'true') {
      sql += ' WHERE is_active = 1';
    }
    sql += ' ORDER BY created_at DESC';
    
    const [rows] = await pool.execute(sql);
    res.json(rows);
  } catch (error) {
    console.error('Get approval templates error:', error);
    res.status(500).json({ error: '获取审批模板失败' });
  }
});

// 创建审批模板
app.post('/api/approval-templates', async (req, res) => {
  try {
    const { name, code, description, icon, business_type, is_active = true } = req.body;
    const id = uuidv4();
    
    await pool.execute(
      `INSERT INTO approval_templates (id, name, code, description, icon, business_type, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [id, name, code, description || null, icon || '📋', business_type, is_active ? 1 : 0]
    );
    
    // 返回创建的模板完整信息
    const [rows] = await pool.execute('SELECT * FROM approval_templates WHERE id = ?', [id]);
    res.json(rows[0]);
  } catch (error) {
    console.error('Create approval template error:', error);
    res.status(500).json({ error: '创建审批模板失败' });
  }
});

// 更新审批模板
app.put('/api/approval-templates/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const fields = [];
    const values = [];
    
    if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
    if (updates.description !== undefined) { fields.push('description = ?'); values.push(updates.description); }
    if (updates.icon !== undefined) { fields.push('icon = ?'); values.push(updates.icon); }
    if (updates.business_type !== undefined) { fields.push('business_type = ?'); values.push(updates.business_type); }
    if (updates.is_active !== undefined) { fields.push('is_active = ?'); values.push(updates.is_active ? 1 : 0); }
    
    if (fields.length === 0) {
      return res.json({ success: true });
    }
    
    fields.push('updated_at = NOW()');
    values.push(id);
    
    await pool.execute(
      `UPDATE approval_templates SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Update approval template error:', error);
    res.status(500).json({ error: '更新审批模板失败' });
  }
});

// 初始化/种子审批模板
app.post('/api/approval-templates/seed', async (req, res) => {
  try {
    // 预设的审批模板
    const templates = [
      { name: '出差申请', code: 'PROC_BUSINESS_TRIP', icon: '🚗', business_type: 'business_trip', description: '员工出差申请流程' },
      { name: '请假申请', code: 'PROC_LEAVE', icon: '🏖️', business_type: 'leave', description: '员工请假申请流程' },
      { name: '外出申请', code: 'PROC_OUT', icon: '🚶', business_type: 'out', description: '员工临时外出申请流程' },
      { name: '物品领用', code: 'PROC_SUPPLY_REQ', icon: '📦', business_type: 'supply_requisition', description: '办公用品领用申请流程' },
      { name: '采购申请', code: 'PROC_PURCHASE', icon: '💰', business_type: 'purchase_request', description: '办公用品采购申请流程' },
      { name: '办公采购', code: 'PROC_SUPPLY_PURCHASE', icon: '🛒', business_type: 'supply_purchase', description: '处室办公用品采购申请流程' },
    ];
    
    let insertedCount = 0;
    
    for (const tpl of templates) {
      // 检查是否已存在该业务类型
      const [existing] = await pool.execute(
        'SELECT id FROM approval_templates WHERE business_type = ?',
        [tpl.business_type]
      );
      
      if (existing.length === 0) {
        const id = uuidv4();
        await pool.execute(
          `INSERT INTO approval_templates (id, name, code, description, icon, business_type, is_active, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 1, NOW(), NOW())`,
          [id, tpl.name, tpl.code, tpl.description, tpl.icon, tpl.business_type]
        );
        insertedCount++;
      }
    }
    
    res.json({ success: true, count: insertedCount });
  } catch (error) {
    console.error('Seed approval templates error:', error);
    res.status(500).json({ error: '初始化审批模板失败' });
  }
});

// ==================== 审批实例 ====================

app.get('/api/approval-instances', async (req, res) => {
  try {
    const { business_id, business_type } = req.query;
    // 联合查询获取 initiator 信息
    let sql = `SELECT ai.*, c.name as initiator_name, COALESCE(o.name, c.department) as initiator_department
               FROM approval_instances ai
               LEFT JOIN contacts c ON ai.initiator_id = c.id
               LEFT JOIN organizations o ON c.organization_id = o.id
               WHERE 1=1`;
    const params = [];
    
    if (business_id) {
      sql += ' AND ai.business_id = ?';
      params.push(business_id);
    }
    if (business_type) {
      sql += ' AND ai.business_type = ?';
      params.push(business_type);
    }
    
    sql += ' ORDER BY ai.created_at DESC';
    
    const [rows] = await pool.execute(sql, params);
    
    // 格式化返回数据，添加嵌套的 initiator 对象
    const result = rows.map(row => ({
      ...row,
      form_data: typeof row.form_data === 'string' ? JSON.parse(row.form_data) : row.form_data,
      initiator: row.initiator_name ? {
        name: row.initiator_name,
        department: row.initiator_department
      } : null
    }));
    
    // 如果查询单条，返回第一条
    if (business_id && business_type && result.length > 0) {
      res.json(result[0]);
    } else {
      res.json(result);
    }
  } catch (error) {
    console.error('Get approval instances error:', error);
    res.status(500).json({ error: '获取审批实例失败' });
  }
});

// 获取单个审批实例（按ID）
app.get('/api/approval-instances/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.execute(
      `SELECT ai.*, c.name as initiator_name, COALESCE(o.name, c.department) as initiator_department
       FROM approval_instances ai
       LEFT JOIN contacts c ON ai.initiator_id = c.id
       LEFT JOIN organizations o ON c.organization_id = o.id
       WHERE ai.id = ?`,
      [id]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ error: '审批实例不存在' });
    }
    
    const row = rows[0];
    res.json({
      ...row,
      form_data: typeof row.form_data === 'string' ? JSON.parse(row.form_data) : row.form_data,
      initiator: row.initiator_name ? {
        name: row.initiator_name,
        department: row.initiator_department
      } : null
    });
  } catch (error) {
    console.error('Get approval instance by id error:', error);
    res.status(500).json({ error: '获取审批实例失败' });
  }
});

// 获取版本信息（按ID）
app.get('/api/approval-process-versions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.execute(
      'SELECT * FROM approval_process_versions WHERE id = ?',
      [id]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ error: '版本不存在' });
    }
    
    const row = rows[0];
    res.json({
      ...row,
      nodes_snapshot: typeof row.nodes_snapshot === 'string' ? JSON.parse(row.nodes_snapshot) : row.nodes_snapshot
    });
  } catch (error) {
    console.error('Get approval process version by id error:', error);
    res.status(500).json({ error: '获取审批流程版本失败' });
  }
});

// ==================== 审批记录 ====================

app.get('/api/approval-records', async (req, res) => {
  try {
    const { instance_id, node_name } = req.query;
    
    // 如果有 node_name 参数，返回简化结构用于审批流程推进
    if (node_name) {
      const [rows] = await pool.execute(
        `SELECT status, created_at, approver_id
         FROM approval_records
         WHERE instance_id = ? AND node_name = ?
         ORDER BY created_at DESC`,
        [instance_id, node_name]
      );
      return res.json(rows);
    }
    
    // 默认返回完整结构
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

// 批量更新审批记录（按实例ID和状态）
app.put('/api/approval-records/by-instance/:instanceId', async (req, res) => {
  try {
    const { instanceId } = req.params;
    const { current_status, updates } = req.body;
    
    const setClauses = [];
    const params = [];
    
    if (updates.status !== undefined) { setClauses.push('status = ?'); params.push(updates.status); }
    if (updates.comment !== undefined) { setClauses.push('comment = ?'); params.push(updates.comment); }
    if (updates.processed_at !== undefined) { setClauses.push('processed_at = ?'); params.push(formatDateForMySQL(updates.processed_at)); }
    setClauses.push('updated_at = NOW()');
    
    params.push(instanceId, current_status);
    
    await pool.execute(
      `UPDATE approval_records SET ${setClauses.join(', ')} WHERE instance_id = ? AND status = ?`,
      params
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Batch update approval records error:', error);
    res.status(500).json({ error: '批量更新审批记录失败' });
  }
});

// 批量更新待办事项（按实例ID和状态）
app.put('/api/todo-items/by-instance/:instanceId', async (req, res) => {
  try {
    const { instanceId } = req.params;
    const { current_status, updates } = req.body;
    
    const setClauses = [];
    const params = [];
    
    if (updates.status !== undefined) { setClauses.push('status = ?'); params.push(updates.status); }
    if (updates.process_result !== undefined) { setClauses.push('process_result = ?'); params.push(updates.process_result); }
    if (updates.process_notes !== undefined) { setClauses.push('process_notes = ?'); params.push(updates.process_notes); }
    if (updates.processed_at !== undefined) { setClauses.push('processed_at = ?'); params.push(formatDateForMySQL(updates.processed_at)); }
    setClauses.push('updated_at = NOW()');
    
    params.push(instanceId, current_status);
    
    await pool.execute(
      `UPDATE todo_items SET ${setClauses.join(', ')} WHERE approval_instance_id = ? AND status = ?`,
      params
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Batch update todo items error:', error);
    res.status(500).json({ error: '批量更新待办事项失败' });
  }
});

// 获取缺勤记录的联系人ID
app.get('/api/absence-records/:id/contact', async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.execute(
      'SELECT contact_id FROM absence_records WHERE id = ?',
      [id]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ error: '记录不存在' });
    }
    
    res.json(rows[0]);
  } catch (error) {
    console.error('Get absence record contact error:', error);
    res.status(500).json({ error: '获取联系人失败' });
  }
});

// ==================== 假期余额 ====================

// 获取假期余额列表（带联系人信息）
app.get('/api/leave-balances', async (req, res) => {
  try {
    const { year, with_contacts } = req.query;
    const currentYear = year || new Date().getFullYear();
    
    if (with_contacts === 'true') {
      const sql = `
        SELECT lb.*,
               c.id as contact_id_ref, c.name as contact_name, c.department as contact_department,
               c.position as contact_position, c.first_work_date, c.created_at as contact_created_at,
               o.id as org_id, o.name as org_name
        FROM leave_balances lb
        LEFT JOIN contacts c ON lb.contact_id = c.id
        LEFT JOIN organizations o ON c.organization_id = o.id
        WHERE lb.year = ?
        ORDER BY lb.created_at DESC
      `;
      const [rows] = await pool.execute(sql, [currentYear]);
      
      // 格式化为前端期望的嵌套结构
      const formatted = rows.map(row => ({
        id: row.id,
        contact_id: row.contact_id,
        year: row.year,
        annual_leave_total: row.annual_leave_total,
        annual_leave_used: row.annual_leave_used,
        sick_leave_total: row.sick_leave_total,
        sick_leave_used: row.sick_leave_used,
        personal_leave_total: row.personal_leave_total,
        personal_leave_used: row.personal_leave_used,
        paternity_leave_total: row.paternity_leave_total,
        paternity_leave_used: row.paternity_leave_used,
        bereavement_leave_total: row.bereavement_leave_total,
        bereavement_leave_used: row.bereavement_leave_used,
        maternity_leave_total: row.maternity_leave_total,
        maternity_leave_used: row.maternity_leave_used,
        nursing_leave_total: row.nursing_leave_total,
        nursing_leave_used: row.nursing_leave_used,
        marriage_leave_total: row.marriage_leave_total,
        marriage_leave_used: row.marriage_leave_used,
        compensatory_leave_total: row.compensatory_leave_total,
        compensatory_leave_used: row.compensatory_leave_used,
        created_at: row.created_at,
        updated_at: row.updated_at,
        contacts: row.contact_id_ref ? {
          id: row.contact_id_ref,
          name: row.contact_name,
          department: row.contact_department,
          position: row.contact_position,
          first_work_date: row.first_work_date,
          created_at: row.contact_created_at,
          organization: row.org_id ? { id: row.org_id, name: row.org_name } : null
        } : null
      }));
      return res.json(formatted);
    }
    
    // 简单列表
    const [rows] = await pool.execute(
      'SELECT * FROM leave_balances WHERE year = ? ORDER BY created_at DESC',
      [currentYear]
    );
    res.json(rows);
  } catch (error) {
    console.error('Get leave balances error:', error);
    res.status(500).json({ error: '获取假期余额列表失败' });
  }
});

// 获取单个联系人假期余额
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

// 检查假期余额是否存在
app.get('/api/leave-balances/check', async (req, res) => {
  try {
    const { contact_id, year } = req.query;
    const [rows] = await pool.execute(
      'SELECT id FROM leave_balances WHERE contact_id = ? AND year = ?',
      [contact_id, year]
    );
    res.json(rows.length > 0 ? rows[0] : null);
  } catch (error) {
    console.error('Check leave balance error:', error);
    res.status(500).json({ error: '检查失败' });
  }
});

// 创建假期余额
app.post('/api/leave-balances', async (req, res) => {
  try {
    const balance = req.body;
    const id = uuidv4();
    
    await pool.execute(
      `INSERT INTO leave_balances (
        id, contact_id, year,
        annual_leave_total, annual_leave_used,
        sick_leave_total, sick_leave_used,
        personal_leave_total, personal_leave_used,
        paternity_leave_total, paternity_leave_used,
        bereavement_leave_total, bereavement_leave_used,
        maternity_leave_total, maternity_leave_used,
        nursing_leave_total, nursing_leave_used,
        marriage_leave_total, marriage_leave_used,
        compensatory_leave_total, compensatory_leave_used
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, balance.contact_id, balance.year,
        balance.annual_leave_total || 0, balance.annual_leave_used || 0,
        balance.sick_leave_total || 0, balance.sick_leave_used || 0,
        balance.personal_leave_total || 0, balance.personal_leave_used || 0,
        balance.paternity_leave_total || 0, balance.paternity_leave_used || 0,
        balance.bereavement_leave_total || 0, balance.bereavement_leave_used || 0,
        balance.maternity_leave_total || 0, balance.maternity_leave_used || 0,
        balance.nursing_leave_total || 0, balance.nursing_leave_used || 0,
        balance.marriage_leave_total || 0, balance.marriage_leave_used || 0,
        balance.compensatory_leave_total || 0, balance.compensatory_leave_used || 0
      ]
    );
    
    res.json({ id });
  } catch (error) {
    console.error('Create leave balance error:', error);
    res.status(500).json({ error: '创建失败' });
  }
});

// 更新假期余额
app.put('/api/leave-balances/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const fields = [];
    const params = [];
    
    const allowedFields = [
      'annual_leave_total', 'sick_leave_total', 'personal_leave_total',
      'paternity_leave_total', 'bereavement_leave_total', 'maternity_leave_total',
      'nursing_leave_total', 'marriage_leave_total', 'compensatory_leave_total'
    ];
    
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        fields.push(`${field} = ?`);
        params.push(updates[field]);
      }
    }
    
    if (fields.length === 0) {
      return res.status(400).json({ error: '没有要更新的字段' });
    }
    
    fields.push('updated_at = NOW()');
    params.push(id);
    
    await pool.execute(
      `UPDATE leave_balances SET ${fields.join(', ')} WHERE id = ?`,
      params
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Update leave balance error:', error);
    res.status(500).json({ error: '更新失败' });
  }
});

// 批量创建假期余额
app.post('/api/leave-balances/batch', async (req, res) => {
  try {
    const balances = req.body;
    
    for (const balance of balances) {
      const id = uuidv4();
      await pool.execute(
        `INSERT INTO leave_balances (
          id, contact_id, year,
          annual_leave_total, annual_leave_used,
          sick_leave_total, sick_leave_used,
          personal_leave_total, personal_leave_used,
          paternity_leave_total, paternity_leave_used,
          bereavement_leave_total, bereavement_leave_used,
          maternity_leave_total, maternity_leave_used,
          nursing_leave_total, nursing_leave_used,
          marriage_leave_total, marriage_leave_used,
          compensatory_leave_total, compensatory_leave_used
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id, balance.contact_id, balance.year,
          balance.annual_leave_total || 0, balance.annual_leave_used || 0,
          balance.sick_leave_total || 0, balance.sick_leave_used || 0,
          balance.personal_leave_total || 0, balance.personal_leave_used || 0,
          balance.paternity_leave_total || 0, balance.paternity_leave_used || 0,
          balance.bereavement_leave_total || 0, balance.bereavement_leave_used || 0,
          balance.maternity_leave_total || 0, balance.maternity_leave_used || 0,
          balance.nursing_leave_total || 0, balance.nursing_leave_used || 0,
          balance.marriage_leave_total || 0, balance.marriage_leave_used || 0,
          balance.compensatory_leave_total || 0, balance.compensatory_leave_used || 0
        ]
      );
    }
    
    res.json({ success: true, count: balances.length });
  } catch (error) {
    console.error('Batch create leave balances error:', error);
    res.status(500).json({ error: '批量创建失败' });
  }
});

// 扣减假期余额
app.post('/api/leave-balances/deduct', async (req, res) => {
  try {
    const { contactId, leaveType, durationHours, durationDays } = req.body;
    const currentYear = new Date().getFullYear();
    
    // 根据假期类型确定扣减字段和值
    let fieldUsed = '';
    let deductValue = 0;
    
    switch (leaveType) {
      case 'sick':
        fieldUsed = 'sick_leave_used';
        deductValue = durationHours || (durationDays * 8);
        break;
      case 'annual':
        fieldUsed = 'annual_leave_used';
        deductValue = durationHours || (durationDays * 8);
        break;
      case 'personal':
        fieldUsed = 'personal_leave_used';
        deductValue = durationDays || (durationHours / 8);
        break;
      case 'paternity':
        fieldUsed = 'paternity_leave_used';
        deductValue = durationDays || (durationHours / 8);
        break;
      case 'bereavement':
        fieldUsed = 'bereavement_leave_used';
        deductValue = durationDays || (durationHours / 8);
        break;
      case 'maternity':
        fieldUsed = 'maternity_leave_used';
        deductValue = durationDays || (durationHours / 8);
        break;
      case 'nursing':
        fieldUsed = 'nursing_leave_used';
        deductValue = durationHours || (durationDays * 8);
        break;
      case 'marriage':
        fieldUsed = 'marriage_leave_used';
        deductValue = durationDays || (durationHours / 8);
        break;
      case 'compensatory':
        fieldUsed = 'compensatory_leave_used';
        deductValue = durationHours || (durationDays * 8);
        break;
      default:
        return res.status(400).json({ error: '无效的假期类型' });
    }
    
    // 确保有假期余额记录
    const [existing] = await pool.execute(
      'SELECT id FROM leave_balances WHERE contact_id = ? AND year = ?',
      [contactId, currentYear]
    );
    
    if (existing.length === 0) {
      // 创建新记录
      const id = uuidv4();
      await pool.execute(
        `INSERT INTO leave_balances (id, contact_id, year, ${fieldUsed}) VALUES (?, ?, ?, ?)`,
        [id, contactId, currentYear, deductValue]
      );
    } else {
      // 更新已用假期
      await pool.execute(
        `UPDATE leave_balances SET ${fieldUsed} = ${fieldUsed} + ?, updated_at = NOW() WHERE contact_id = ? AND year = ?`,
        [deductValue, contactId, currentYear]
      );
    }
    
    console.log(`[LEAVE-DEDUCT] ${leaveType} deducted: ${deductValue} for contact ${contactId}`);
    res.json({ success: true });
  } catch (error) {
    console.error('Deduct leave balance error:', error);
    res.status(500).json({ error: '扣减假期余额失败' });
  }
});

// ==================== 领导日程 ====================

app.get('/api/leader-schedules', async (req, res) => {
  try {
    const { leader_ids, start_date, end_date } = req.query;
    
    let sql = `SELECT ls.*, c.id as leader_id, c.name as leader_name, c.department as leader_department, c.position as leader_position
               FROM leader_schedules ls
               LEFT JOIN contacts c ON ls.leader_id = c.id
               WHERE 1=1`;
    const params = [];
    
    // 如果传了 leader_ids，则按领导筛选
    if (leader_ids) {
      const ids = leader_ids.split(',');
      const placeholders = ids.map(() => '?').join(',');
      sql += ` AND ls.leader_id IN (${placeholders})`;
      params.push(...ids);
    }
    
    // 日期范围筛选
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

// 新增领导日程
app.post('/api/leader-schedules', async (req, res) => {
  try {
    const id = uuidv4();
    const { leader_id, title, schedule_date, start_time, end_time, schedule_type, location, notes } = req.body;
    
    await pool.execute(
      `INSERT INTO leader_schedules (id, leader_id, title, schedule_date, start_time, end_time, schedule_type, location, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, leader_id, title, schedule_date, start_time, end_time, schedule_type || 'meeting', location || null, notes || null]
    );
    
    res.json({ id, success: true });
  } catch (error) {
    console.error('Create leader schedule error:', error);
    res.status(500).json({ error: '创建领导日程失败' });
  }
});

// 更新领导日程
app.put('/api/leader-schedules/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, schedule_date, start_time, end_time, schedule_type, location, notes } = req.body;
    
    await pool.execute(
      `UPDATE leader_schedules SET title = ?, schedule_date = ?, start_time = ?, end_time = ?, schedule_type = ?, location = ?, notes = ?, updated_at = NOW()
       WHERE id = ?`,
      [title, schedule_date, start_time, end_time, schedule_type, location, notes, id]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Update leader schedule error:', error);
    res.status(500).json({ error: '更新领导日程失败' });
  }
});

// 删除领导日程
app.delete('/api/leader-schedules/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.execute('DELETE FROM leader_schedules WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete leader schedule error:', error);
    res.status(500).json({ error: '删除领导日程失败' });
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
             c.name as initiator_name, 
             COALESCE(o.name, c.department) as initiator_department
      FROM todo_items t
      LEFT JOIN contacts c ON t.initiator_id = c.id
      LEFT JOIN organizations o ON c.organization_id = o.id
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
      initiator_id, assignee_id, approval_instance_id, approval_version_number,
      source_department, source_system
    } = req.body;
    
    // 验证必填字段
    if (!business_type || !title || !assignee_id) {
      console.error('Missing required fields:', { business_type, title, assignee_id });
      return res.status(400).json({ error: '缺少必填字段' });
    }
    
    // 处理 undefined 值为 null
    const safeDescription = description || null;
    const safeProcessResult = process_result || null;
    const safeInitiatorId = initiator_id || null;
    const safeApprovalInstanceId = approval_instance_id || null;
    const safeApprovalVersionNumber = approval_version_number !== undefined ? approval_version_number : null;
    
    // 如果没有传入 source_department，尝试从 initiator_id 获取
    let finalSourceDepartment = source_department || null;
    if (!finalSourceDepartment && safeInitiatorId) {
      try {
        const [initiatorRows] = await pool.execute(
          `SELECT COALESCE(o.name, c.department) as department 
           FROM contacts c 
           LEFT JOIN organizations o ON c.organization_id = o.id 
           WHERE c.id = ?`,
          [safeInitiatorId]
        );
        if (initiatorRows.length > 0) {
          finalSourceDepartment = initiatorRows[0].department || null;
        }
      } catch (e) {
        console.error('Failed to fetch initiator department:', e.message);
      }
    }
    
    console.log('Creating todo item:', { id, business_type, business_id, title, assignee_id, source_department: finalSourceDepartment });
    
    await pool.execute(
      `INSERT INTO todo_items (id, source, business_type, business_id, title, description, priority, status, process_result, initiator_id, assignee_id, approval_instance_id, approval_version_number, source_department, source_system)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, source, business_type, business_id || null, title, safeDescription, priority, status, safeProcessResult, safeInitiatorId, assignee_id, safeApprovalInstanceId, safeApprovalVersionNumber, finalSourceDepartment, source_system || null]
    );
    
    console.log('Todo item created successfully:', id);
    res.json({ id });
  } catch (error) {
    console.error('Create todo item error:', error.message, error.code);
    res.status(500).json({ error: '创建待办失败: ' + error.message });
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
    
    // 验证必填字段
    if (!template_id || !version_id || !business_type || !business_id || !initiator_id) {
      console.error('Missing required fields for approval instance:', { template_id, version_id, business_type, business_id, initiator_id });
      return res.status(400).json({ error: '缺少必填字段' });
    }
    
    console.log('Creating approval instance:', { id, template_id, business_type, business_id, initiator_id });
    
    await pool.execute(
      `INSERT INTO approval_instances (id, template_id, version_id, version_number, business_type, business_id, initiator_id, status, current_node_index, form_data)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, template_id, version_id, version_number || 1, business_type, business_id, initiator_id, status, current_node_index, JSON.stringify(form_data)]
    );
    
    console.log('Approval instance created successfully:', id);
    res.json({ id });
  } catch (error) {
    console.error('Create approval instance error:', error.message, error.code);
    res.status(500).json({ error: '创建审批实例失败: ' + error.message });
  }
});

app.put('/api/approval-instances/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, current_node_index, completed_at, form_data } = req.body;
    
    console.log('[INSTANCE-UPDATE] Updating approval instance:', {
      id,
      status,
      current_node_index,
      completed_at: completed_at ? 'set' : 'not set',
      has_form_data: !!form_data
    });
    
    const updates = [];
    const params = [];
    
    if (status !== undefined) { updates.push('status = ?'); params.push(status); }
    if (current_node_index !== undefined) { updates.push('current_node_index = ?'); params.push(current_node_index); }
    if (completed_at !== undefined) { updates.push('completed_at = ?'); params.push(formatDateForMySQL(completed_at)); }
    if (form_data !== undefined) { updates.push('form_data = ?'); params.push(JSON.stringify(form_data)); }
    updates.push('updated_at = NOW()');
    
    params.push(id);
    
    const sql = `UPDATE approval_instances SET ${updates.join(', ')} WHERE id = ?`;
    console.log('[INSTANCE-UPDATE] SQL:', sql);
    console.log('[INSTANCE-UPDATE] Params:', params);
    
    const [result] = await pool.execute(sql, params);
    
    console.log('[INSTANCE-UPDATE] Result:', { affectedRows: result.affectedRows, changedRows: result.changedRows });
    
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
    
    // 验证必填字段
    if (!instance_id) {
      return res.status(400).json({ error: '缺少 instance_id', detail: 'instance_id is required' });
    }
    if (!approver_id) {
      return res.status(400).json({ error: '缺少审批人ID', detail: 'approver_id is required' });
    }
    if (!node_name) {
      return res.status(400).json({ error: '缺少节点名称', detail: 'node_name is required' });
    }
    
    console.log('Creating approval record:', { id, instance_id, node_index, node_name, node_type, approver_id, status });
    
    await pool.execute(
      `INSERT INTO approval_records (id, instance_id, node_index, node_name, node_type, approver_id, status, comment)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, instance_id, node_index, node_name, node_type || 'approver', approver_id, status, comment || null]
    );
    
    res.json({ id });
  } catch (error) {
    console.error('Create approval record error:', error);
    res.status(500).json({ error: '创建审批记录失败', detail: error.message });
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
    if (processed_at !== undefined) { updates.push('processed_at = ?'); params.push(formatDateForMySQL(processed_at)); }
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
    const { template_id, is_current, all } = req.query;
    
    let sql = 'SELECT * FROM approval_process_versions WHERE template_id = ?';
    const params = [template_id];
    
    if (!all && is_current !== undefined) {
      sql += ' AND is_current = ?';
      params.push(is_current === 'true' ? 1 : 0);
    }
    
    sql += ' ORDER BY version_number DESC';
    
    if (!all) {
      sql += ' LIMIT 1';
    }
    
    const [rows] = await pool.execute(sql, params);
    
    const result = rows.map(row => ({
      ...row,
      nodes_snapshot: typeof row.nodes_snapshot === 'string' ? JSON.parse(row.nodes_snapshot) : row.nodes_snapshot
    }));
    
    if (!all && result.length > 0) {
      res.json(result[0]);
    } else if (!all) {
      res.json(null);
    } else {
      res.json(result);
    }
  } catch (error) {
    console.error('Get approval process versions error:', error);
    res.status(500).json({ error: '获取审批流程版本失败' });
  }
});

app.post('/api/approval-process-versions', async (req, res) => {
  try {
    const id = uuidv4();
    const { template_id, version_number, version_name, nodes_snapshot, is_current, published_by } = req.body;
    
    await pool.execute(
      `INSERT INTO approval_process_versions (id, template_id, version_number, version_name, nodes_snapshot, is_current, published_by, published_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [id, template_id, version_number, version_name, JSON.stringify(nodes_snapshot), is_current ? 1 : 0, published_by || 'admin']
    );
    
    res.json({ id });
  } catch (error) {
    console.error('Create approval process version error:', error);
    res.status(500).json({ error: '创建审批流程版本失败' });
  }
});

app.put('/api/approval-process-versions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { is_current } = req.body;
    
    const updates = [];
    const params = [];
    
    if (is_current !== undefined) {
      updates.push('is_current = ?');
      params.push(is_current ? 1 : 0);
    }
    
    if (updates.length === 0) {
      return res.json({ success: true });
    }
    
    params.push(id);
    await pool.execute(`UPDATE approval_process_versions SET ${updates.join(', ')} WHERE id = ?`, params);
    res.json({ success: true });
  } catch (error) {
    console.error('Update approval process version error:', error);
    res.status(500).json({ error: '更新审批流程版本失败' });
  }
});

app.put('/api/approval-process-versions/unset-current/:templateId', async (req, res) => {
  try {
    const { templateId } = req.params;
    await pool.execute('UPDATE approval_process_versions SET is_current = 0 WHERE template_id = ?', [templateId]);
    res.json({ success: true });
  } catch (error) {
    console.error('Unset current versions error:', error);
    res.status(500).json({ error: '取消当前版本失败' });
  }
});

// ==================== 审批节点 ====================

app.get('/api/approval-nodes', async (req, res) => {
  try {
    const { template_id } = req.query;
    
    const [rows] = await pool.execute(
      'SELECT * FROM approval_nodes WHERE template_id = ? ORDER BY sort_order',
      [template_id]
    );
    
    // 解析 JSON 字段
    const result = rows.map(row => ({
      ...row,
      approver_ids: typeof row.approver_ids === 'string' ? JSON.parse(row.approver_ids) : row.approver_ids,
      condition_expression: typeof row.condition_expression === 'string' ? JSON.parse(row.condition_expression) : row.condition_expression,
      field_permissions: typeof row.field_permissions === 'string' ? JSON.parse(row.field_permissions) : row.field_permissions,
    }));
    
    res.json(result);
  } catch (error) {
    console.error('Get approval nodes error:', error);
    res.status(500).json({ error: '获取审批节点失败' });
  }
});

app.post('/api/approval-nodes', async (req, res) => {
  try {
    const id = uuidv4();
    const { 
      template_id, node_type, node_name, approver_type, approver_ids, 
      sort_order, condition_expression, field_permissions, approval_mode 
    } = req.body;
    
    await pool.execute(
      `INSERT INTO approval_nodes (id, template_id, node_type, node_name, approver_type, approver_ids, sort_order, condition_expression, field_permissions, approval_mode)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, 
        template_id, 
        node_type, 
        node_name, 
        approver_type || 'self', 
        JSON.stringify(approver_ids || []), 
        sort_order || 0, 
        condition_expression ? JSON.stringify(condition_expression) : null,
        field_permissions ? JSON.stringify(field_permissions) : null,
        approval_mode || 'countersign'
      ]
    );
    
    // 返回创建的节点
    const [rows] = await pool.execute('SELECT * FROM approval_nodes WHERE id = ?', [id]);
    const row = rows[0];
    
    res.json({
      ...row,
      approver_ids: typeof row.approver_ids === 'string' ? JSON.parse(row.approver_ids) : row.approver_ids,
      condition_expression: typeof row.condition_expression === 'string' ? JSON.parse(row.condition_expression) : row.condition_expression,
      field_permissions: typeof row.field_permissions === 'string' ? JSON.parse(row.field_permissions) : row.field_permissions,
    });
  } catch (error) {
    console.error('Create approval node error:', error);
    res.status(500).json({ error: '创建审批节点失败' });
  }
});

app.put('/api/approval-nodes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const setClauses = [];
    const params = [];
    
    Object.keys(updates).forEach(key => {
      if (['approver_ids', 'condition_expression', 'field_permissions'].includes(key)) {
        setClauses.push(`${key} = ?`);
        params.push(updates[key] ? JSON.stringify(updates[key]) : null);
      } else {
        setClauses.push(`${key} = ?`);
        params.push(updates[key]);
      }
    });
    
    setClauses.push('updated_at = NOW()');
    params.push(id);
    
    await pool.execute(`UPDATE approval_nodes SET ${setClauses.join(', ')} WHERE id = ?`, params);
    
    // 返回更新后的节点
    const [rows] = await pool.execute('SELECT * FROM approval_nodes WHERE id = ?', [id]);
    const row = rows[0];
    
    res.json({
      ...row,
      approver_ids: typeof row.approver_ids === 'string' ? JSON.parse(row.approver_ids) : row.approver_ids,
      condition_expression: typeof row.condition_expression === 'string' ? JSON.parse(row.condition_expression) : row.condition_expression,
      field_permissions: typeof row.field_permissions === 'string' ? JSON.parse(row.field_permissions) : row.field_permissions,
    });
  } catch (error) {
    console.error('Update approval node error:', error);
    res.status(500).json({ error: '更新审批节点失败' });
  }
});

app.delete('/api/approval-nodes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.execute('DELETE FROM approval_nodes WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete approval node error:', error);
    res.status(500).json({ error: '删除审批节点失败' });
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
    
    // 转换日期格式为 MySQL 格式
    const formattedStartTime = formatDateForMySQL(start_time);
    const formattedEndTime = formatDateForMySQL(end_time);
    
    await pool.execute(
      `INSERT INTO absence_records (id, contact_id, type, reason, start_time, end_time, leave_type, out_type, out_location, destination, transport_type, companions, estimated_cost, duration_hours, duration_days, handover_person_id, handover_notes, contact_phone, notes, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, contact_id, type, reason, formattedStartTime, formattedEndTime, leave_type, out_type, out_location, destination, transport_type, companions ? JSON.stringify(companions) : null, estimated_cost, duration_hours, duration_days, handover_person_id, handover_notes, contact_phone, notes, status]
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
    if (approved_at !== undefined) { updates.push('approved_at = ?'); params.push(formatDateForMySQL(approved_at)); }
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

// ==================== 通知公告管理 ====================

// 获取所有通知公告（管理后台）
app.get('/api/notices', async (req, res) => {
  try {
    const { department, is_published } = req.query;
    let sql = 'SELECT * FROM notices';
    const conditions = [];
    const params = [];
    
    if (department && department !== 'all') {
      conditions.push('department = ?');
      params.push(department);
    }
    if (is_published !== undefined) {
      conditions.push('is_published = ?');
      params.push(is_published === 'true' ? 1 : 0);
    }
    
    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    sql += ' ORDER BY is_pinned DESC, created_at DESC';
    
    const [rows] = await pool.execute(sql, params);
    res.json(rows);
  } catch (error) {
    console.error('Get notices error:', error);
    res.status(500).json({ error: '获取通知公告失败' });
  }
});

// 创建通知公告
app.post('/api/notices', async (req, res) => {
  try {
    const id = uuidv4();
    const { title, department, content, is_pinned, is_published, security_level, publish_scope, publish_scope_ids } = req.body;
    
    await pool.execute(
      `INSERT INTO notices (id, title, department, content, is_pinned, is_published, security_level, publish_scope, publish_scope_ids)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, title, department, content || null, is_pinned ? 1 : 0, is_published !== false ? 1 : 0, 
       security_level || '公开', publish_scope || 'all', JSON.stringify(publish_scope_ids || [])]
    );
    
    res.json({ id });
  } catch (error) {
    console.error('Create notice error:', error);
    res.status(500).json({ error: '创建通知公告失败' });
  }
});

// 更新通知公告
app.put('/api/notices/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const setClauses = [];
    const params = [];
    
    Object.keys(updates).forEach(key => {
      if (key === 'publish_scope_ids') {
        setClauses.push(`${key} = ?`);
        params.push(JSON.stringify(updates[key]));
      } else if (key === 'is_pinned' || key === 'is_published') {
        setClauses.push(`${key} = ?`);
        params.push(updates[key] ? 1 : 0);
      } else {
        setClauses.push(`${key} = ?`);
        params.push(updates[key]);
      }
    });
    
    params.push(id);
    await pool.execute(`UPDATE notices SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = ?`, params);
    res.json({ success: true });
  } catch (error) {
    console.error('Update notice error:', error);
    res.status(500).json({ error: '更新通知公告失败' });
  }
});

// 删除通知公告
app.delete('/api/notices/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.execute('DELETE FROM notices WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete notice error:', error);
    res.status(500).json({ error: '删除通知公告失败' });
  }
});

// ==================== 通知公告图片管理 ====================

// 获取所有通知图片
app.get('/api/notice-images', async (req, res) => {
  try {
    const { all } = req.query;
    let sql = 'SELECT * FROM notice_images';
    if (!all) {
      sql += ' WHERE is_active = 1';
    }
    sql += ' ORDER BY sort_order';
    
    const [rows] = await pool.execute(sql);
    res.json(rows);
  } catch (error) {
    console.error('Get notice images error:', error);
    res.status(500).json({ error: '获取通知图片失败' });
  }
});

// 创建通知图片
app.post('/api/notice-images', async (req, res) => {
  try {
    const id = uuidv4();
    const { image_url, title, sort_order, is_active } = req.body;
    
    await pool.execute(
      `INSERT INTO notice_images (id, image_url, title, sort_order, is_active)
       VALUES (?, ?, ?, ?, ?)`,
      [id, image_url, title || '', sort_order || 0, is_active !== false ? 1 : 0]
    );
    
    res.json({ id });
  } catch (error) {
    console.error('Create notice image error:', error);
    res.status(500).json({ error: '创建通知图片失败' });
  }
});

// 更新通知图片
app.put('/api/notice-images/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const setClauses = [];
    const params = [];
    
    Object.keys(updates).forEach(key => {
      if (key === 'is_active') {
        setClauses.push(`${key} = ?`);
        params.push(updates[key] ? 1 : 0);
      } else {
        setClauses.push(`${key} = ?`);
        params.push(updates[key]);
      }
    });
    
    params.push(id);
    await pool.execute(`UPDATE notice_images SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = ?`, params);
    res.json({ success: true });
  } catch (error) {
    console.error('Update notice image error:', error);
    res.status(500).json({ error: '更新通知图片失败' });
  }
});

// 删除通知图片
app.delete('/api/notice-images/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.execute('DELETE FROM notice_images WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete notice image error:', error);
    res.status(500).json({ error: '删除通知图片失败' });
  }
});

// ==================== 领导日程权限管理 ====================

// 获取所有领导日程权限
app.get('/api/leader-schedule-permissions', async (req, res) => {
  try {
    const { user_id } = req.query;
    
    let sql = `SELECT lsp.*, c.name as leader_name 
               FROM leader_schedule_permissions lsp
               LEFT JOIN contacts c ON lsp.leader_id = c.id`;
    const params = [];
    
    if (user_id) {
      sql += ' WHERE lsp.user_id = ?';
      params.push(user_id);
    }
    sql += ' ORDER BY lsp.created_at DESC';
    
    const [rows] = await pool.execute(sql, params);
    
    // 转换为前端期望的格式
    const result = rows.map(row => ({
      ...row,
      leader: row.leader_name ? { name: row.leader_name } : null
    }));
    
    res.json(result);
  } catch (error) {
    console.error('Get leader schedule permissions error:', error);
    res.status(500).json({ error: '获取领导日程权限失败' });
  }
});

// 创建领导日程权限
app.post('/api/leader-schedule-permissions', async (req, res) => {
  try {
    const id = uuidv4();
    const { user_id, leader_id, can_view_all } = req.body;
    
    await pool.execute(
      `INSERT INTO leader_schedule_permissions (id, user_id, leader_id, can_view_all)
       VALUES (?, ?, ?, ?)`,
      [id, user_id, leader_id || null, can_view_all ? 1 : 0]
    );
    
    res.json({ id });
  } catch (error) {
    console.error('Create leader schedule permission error:', error);
    res.status(500).json({ error: '创建领导日程权限失败' });
  }
});

// 批量创建领导日程权限
app.post('/api/leader-schedule-permissions/batch', async (req, res) => {
  try {
    const { permissions } = req.body;
    
    for (const perm of permissions) {
      const id = uuidv4();
      await pool.execute(
        `INSERT INTO leader_schedule_permissions (id, user_id, leader_id, can_view_all)
         VALUES (?, ?, ?, ?)`,
        [id, perm.user_id, perm.leader_id || null, perm.can_view_all ? 1 : 0]
      );
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Batch create leader schedule permissions error:', error);
    res.status(500).json({ error: '批量创建领导日程权限失败' });
  }
});

// 删除用户的所有领导日程权限
app.delete('/api/leader-schedule-permissions/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    await pool.execute('DELETE FROM leader_schedule_permissions WHERE user_id = ?', [userId]);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete leader schedule permissions error:', error);
    res.status(500).json({ error: '删除领导日程权限失败' });
  }
});

// ==================== 审批表单字段 ====================

app.get('/api/approval-form-fields', async (req, res) => {
  try {
    const { template_id } = req.query;
    if (!template_id) {
      return res.status(400).json({ error: '缺少 template_id 参数' });
    }
    
    const [rows] = await pool.execute(
      `SELECT * FROM approval_form_fields WHERE template_id = ? ORDER BY sort_order ASC`,
      [template_id]
    );
    
    // 解析 field_options JSON 字段
    const fields = rows.map(row => ({
      ...row,
      field_options: row.field_options ? (typeof row.field_options === 'string' ? JSON.parse(row.field_options) : row.field_options) : null
    }));
    
    res.json(fields);
  } catch (error) {
    console.error('Get approval form fields error:', error);
    res.status(500).json({ error: '获取表单字段失败' });
  }
});

app.post('/api/approval-form-fields', async (req, res) => {
  try {
    const id = uuidv4();
    const { 
      template_id, field_type = 'text', field_name, field_label, 
      placeholder, is_required = false, sort_order = 0, field_options, col_span = 2, default_value
    } = req.body;
    
    if (!template_id || !field_name || !field_label) {
      return res.status(400).json({ error: '缺少必填字段: template_id, field_name, field_label' });
    }
    
    await pool.execute(
      `INSERT INTO approval_form_fields (id, template_id, field_type, field_name, field_label, placeholder, is_required, sort_order, field_options, col_span, default_value)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, template_id, field_type, field_name, field_label, placeholder, is_required ? 1 : 0, sort_order, field_options ? JSON.stringify(field_options) : null, col_span, default_value]
    );
    
    res.json({ id });
  } catch (error) {
    console.error('Create approval form field error:', error);
    res.status(500).json({ error: '创建表单字段失败' });
  }
});

app.put('/api/approval-form-fields/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { field_type, field_label, placeholder, is_required, sort_order, field_options, col_span, default_value } = req.body;
    
    const updates = [];
    const params = [];
    
    if (field_type !== undefined) { updates.push('field_type = ?'); params.push(field_type); }
    if (field_label !== undefined) { updates.push('field_label = ?'); params.push(field_label); }
    if (placeholder !== undefined) { updates.push('placeholder = ?'); params.push(placeholder); }
    if (is_required !== undefined) { updates.push('is_required = ?'); params.push(is_required ? 1 : 0); }
    if (sort_order !== undefined) { updates.push('sort_order = ?'); params.push(sort_order); }
    if (field_options !== undefined) { updates.push('field_options = ?'); params.push(field_options ? JSON.stringify(field_options) : null); }
    if (col_span !== undefined) { updates.push('col_span = ?'); params.push(col_span); }
    if (default_value !== undefined) { updates.push('default_value = ?'); params.push(default_value); }
    updates.push('updated_at = NOW()');
    
    params.push(id);
    
    await pool.execute(
      `UPDATE approval_form_fields SET ${updates.join(', ')} WHERE id = ?`,
      params
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Update approval form field error:', error);
    res.status(500).json({ error: '更新表单字段失败' });
  }
});

app.delete('/api/approval-form-fields/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.execute('DELETE FROM approval_form_fields WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete approval form field error:', error);
    res.status(500).json({ error: '删除表单字段失败' });
  }
});

// 批量插入表单字段（用于初始化默认字段）
app.post('/api/approval-form-fields/batch', async (req, res) => {
  try {
    const { fields } = req.body;
    if (!fields || !Array.isArray(fields) || fields.length === 0) {
      return res.status(400).json({ error: '缺少字段数组' });
    }
    
    const insertedIds = [];
    for (const field of fields) {
      const id = uuidv4();
      const { 
        template_id, field_type = 'text', field_name, field_label, 
        placeholder, is_required = false, sort_order = 0, field_options, col_span = 2
      } = field;
      
      await pool.execute(
        `INSERT INTO approval_form_fields (id, template_id, field_type, field_name, field_label, placeholder, is_required, sort_order, field_options, col_span)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, template_id, field_type, field_name, field_label, placeholder, is_required ? 1 : 0, sort_order, field_options ? JSON.stringify(field_options) : null, col_span]
      );
      
      insertedIds.push(id);
    }
    
    res.json({ success: true, count: insertedIds.length, ids: insertedIds });
  } catch (error) {
    console.error('Batch create approval form fields error:', error);
    res.status(500).json({ error: '批量创建表单字段失败' });
  }
});

// ==================== 管理后台 API ====================

// 获取管理后台缺勤记录（带联系人信息）
app.get('/api/admin/absence-records', async (req, res) => {
  try {
    const { type } = req.query;
    const sql = `
      SELECT ar.*,
             c.id as contact_id_ref, c.name as contact_name, c.department as contact_department,
             c.position as contact_position,
             o.name as org_name
      FROM absence_records ar
      LEFT JOIN contacts c ON ar.contact_id = c.id
      LEFT JOIN organizations o ON c.organization_id = o.id
      WHERE ar.type = ?
      ORDER BY ar.created_at DESC
    `;
    const [rows] = await pool.execute(sql, [type]);
    
    // 格式化为前端期望的嵌套结构
    const formatted = rows.map(row => ({
      ...row,
      contacts: row.contact_id_ref ? {
        id: row.contact_id_ref,
        name: row.contact_name,
        department: row.contact_department,
        position: row.contact_position,
        organization: row.org_name ? { name: row.org_name } : null
      } : null
    }));
    res.json(formatted);
  } catch (error) {
    console.error('Get admin absence records error:', error);
    res.status(500).json({ error: '获取记录失败' });
  }
});

// 获取审批实例状态（批量）
app.get('/api/admin/approval-instances', async (req, res) => {
  try {
    const { business_type, business_ids } = req.query;
    if (!business_ids) {
      return res.json([]);
    }
    
    const ids = business_ids.split(',');
    const placeholders = ids.map(() => '?').join(',');
    
    const [rows] = await pool.execute(
      `SELECT business_id, status, form_data FROM approval_instances 
       WHERE business_type = ? AND business_id IN (${placeholders})`,
      [business_type, ...ids]
    );
    
    // 解析 JSON 字段
    const formatted = rows.map(row => ({
      ...row,
      form_data: typeof row.form_data === 'string' ? JSON.parse(row.form_data) : row.form_data
    }));
    res.json(formatted);
  } catch (error) {
    console.error('Get admin approval instances error:', error);
    res.status(500).json({ error: '获取审批状态失败' });
  }
});

// 获取单个审批实例详情
app.get('/api/admin/approval-instance', async (req, res) => {
  try {
    const { business_id, business_type } = req.query;
    const [rows] = await pool.execute(
      `SELECT status, form_data FROM approval_instances 
       WHERE business_id = ? AND business_type = ?`,
      [business_id, business_type]
    );
    
    if (rows.length === 0) {
      return res.json(null);
    }
    
    const row = rows[0];
    res.json({
      status: row.status,
      form_data: typeof row.form_data === 'string' ? JSON.parse(row.form_data) : row.form_data
    });
  } catch (error) {
    console.error('Get admin approval instance error:', error);
    res.status(500).json({ error: '获取审批实例失败' });
  }
});

// 删除缺勤记录及相关审批数据
app.delete('/api/admin/absence-records/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { business_type } = req.query;
    
    // 1. 获取审批实例ID
    const [instances] = await pool.execute(
      'SELECT id FROM approval_instances WHERE business_id = ? AND business_type = ?',
      [id, business_type]
    );
    
    if (instances.length > 0) {
      const instanceId = instances[0].id;
      
      // 2. 删除待办事项
      await pool.execute('DELETE FROM todo_items WHERE approval_instance_id = ?', [instanceId]);
      
      // 3. 删除审批记录
      await pool.execute('DELETE FROM approval_records WHERE instance_id = ?', [instanceId]);
      
      // 4. 删除审批实例
      await pool.execute('DELETE FROM approval_instances WHERE id = ?', [instanceId]);
    }
    
    // 5. 删除业务记录
    await pool.execute('DELETE FROM absence_records WHERE id = ?', [id]);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Delete admin absence record error:', error);
    res.status(500).json({ error: '删除失败' });
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
