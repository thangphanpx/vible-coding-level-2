-- Schema CES CRM AI (SQLite). Chạy lại nhiều lần được (CREATE ... IF NOT EXISTS).
-- Quy ước: id là uuid (chuỗi 36 ký tự, tự sinh nếu không truyền); tiền là SỐ NGUYÊN theo đồng (cột *_vnd);
-- mọi bảng có created_at, updated_at (giờ UTC, ISO 8601); updated_at tự đổi khi sửa dòng (trigger ở cuối file).
-- Giá trị liệt kê lưu mã không dấu (ví dụ 'hen_tu_van'); giao diện hiển thị tên tiếng Việt.

-- 1. Người dùng
CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))) CHECK (length(id) = 36),
  email       TEXT NOT NULL UNIQUE,
  full_name   TEXT NOT NULL,
  role        TEXT NOT NULL CHECK (role IN ('admin', 'quan_ly_tuyen_sinh', 'tu_van_vien', 'quan_ly_lop_hoc')),
  active      INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  password_hash TEXT, -- bản băm scrypt, KHÔNG BAO GIỜ lưu mật khẩu thô; NULL = chưa có mật khẩu (không đăng nhập được)
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- 2. Khóa học
CREATE TABLE IF NOT EXISTS courses (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))) CHECK (length(id) = 36),
  name        TEXT NOT NULL UNIQUE,
  tuition_vnd INTEGER NOT NULL CHECK (typeof(tuition_vnd) = 'integer' AND tuition_vnd >= 0),
  sessions    INTEGER NOT NULL CHECK (typeof(sessions) = 'integer' AND sessions > 0),
  description TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- 3. Lịch khai giảng (một khóa học có nhiều đợt khai giảng)
CREATE TABLE IF NOT EXISTS course_intakes (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))) CHECK (length(id) = 36),
  course_id   TEXT NOT NULL REFERENCES courses (id),
  start_date  TEXT NOT NULL CHECK (start_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  seats       INTEGER NOT NULL CHECK (typeof(seats) = 'integer' AND seats > 0),
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (course_id, start_date)
);

-- 4. Khách tiềm năng
CREATE TABLE IF NOT EXISTS leads (
  id                   TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))) CHECK (length(id) = 36),
  full_name            TEXT NOT NULL,
  phone                TEXT NOT NULL,
  source               TEXT NOT NULL CHECK (source IN ('facebook', 'zalo', 'website', 'gioi_thieu', 'su_kien', 'khac')),
  interested_course_id TEXT REFERENCES courses (id),
  stage                TEXT NOT NULL DEFAULT 'moi' CHECK (stage IN ('moi', 'da_lien_he', 'hen_tu_van', 'dang_ky', 'khong_theo')),
  owner_id             TEXT REFERENCES users (id),
  free_time            TEXT,
  last_contacted_at    TEXT,
  created_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_leads_owner ON leads (owner_id);
CREATE INDEX IF NOT EXISTS idx_leads_stage ON leads (stage);
CREATE INDEX IF NOT EXISTS idx_leads_course ON leads (interested_course_id);

-- 5. Hoạt động theo từng khách (ghi chú, cuộc gọi, tin nhắn)
CREATE TABLE IF NOT EXISTS activities (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))) CHECK (length(id) = 36),
  lead_id     TEXT NOT NULL REFERENCES leads (id),
  user_id     TEXT REFERENCES users (id),
  type        TEXT NOT NULL CHECK (type IN ('ghi_chu', 'cuoc_goi', 'tin_nhan')),
  content     TEXT NOT NULL,
  by_ai       INTEGER NOT NULL DEFAULT 0 CHECK (by_ai IN (0, 1)),
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_activities_lead ON activities (lead_id);

-- 6. Việc cần làm
CREATE TABLE IF NOT EXISTS tasks (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))) CHECK (length(id) = 36),
  title       TEXT NOT NULL,
  due_date    TEXT NOT NULL CHECK (due_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  assignee_id TEXT REFERENCES users (id),
  lead_id     TEXT REFERENCES leads (id),
  type        TEXT NOT NULL CHECK (type IN ('goi_lai', 'gui_tai_lieu', 'nhac_hoc_phi', 'nhac_buoi_hoc', 'danh_gia_cuoi_khoa')),
  done        INTEGER NOT NULL DEFAULT 0 CHECK (done IN (0, 1)),
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks (assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_lead ON tasks (lead_id);

-- 7. Lớp học (thuộc một lịch khai giảng)
CREATE TABLE IF NOT EXISTS classes (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))) CHECK (length(id) = 36),
  name        TEXT NOT NULL UNIQUE,
  intake_id   TEXT NOT NULL REFERENCES course_intakes (id),
  instructor  TEXT NOT NULL,
  max_size    INTEGER NOT NULL DEFAULT 25 CHECK (typeof(max_size) = 'integer' AND max_size > 0),
  status      TEXT NOT NULL DEFAULT 'sap_mo' CHECK (status IN ('sap_mo', 'dang_hoc', 'ket_thuc')),
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- 8. Ghi danh (một khách đăng ký vào một lớp; tiền là số nguyên đồng)
CREATE TABLE IF NOT EXISTS enrollments (
  id                TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))) CHECK (length(id) = 36),
  lead_id           TEXT NOT NULL REFERENCES leads (id),
  class_id          TEXT NOT NULL REFERENCES classes (id),
  payment_plan      TEXT NOT NULL CHECK (payment_plan IN ('mot_lan', 'tra_gop')),
  total_tuition_vnd INTEGER NOT NULL CHECK (typeof(total_tuition_vnd) = 'integer' AND total_tuition_vnd >= 0),
  paid_vnd          INTEGER NOT NULL DEFAULT 0 CHECK (typeof(paid_vnd) = 'integer' AND paid_vnd >= 0),
  second_due_date   TEXT CHECK (second_due_date IS NULL OR second_due_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (lead_id, class_id),
  CHECK (paid_vnd <= total_tuition_vnd)
);
CREATE INDEX IF NOT EXISTS idx_enrollments_class ON enrollments (class_id);

-- 9. Tài liệu (kho tri thức)
CREATE TABLE IF NOT EXISTS documents (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))) CHECK (length(id) = 36),
  title       TEXT NOT NULL,
  file_name   TEXT NOT NULL,
  uploaded_by TEXT REFERENCES users (id),
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- 10. Đoạn tài liệu (cắt nhỏ để tìm kiếm; cột embedding để trống cho đến khi làm phần tìm kiếm)
CREATE TABLE IF NOT EXISTS document_chunks (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))) CHECK (length(id) = 36),
  document_id TEXT NOT NULL REFERENCES documents (id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL CHECK (chunk_index >= 0),
  heading     TEXT,
  content     TEXT NOT NULL,
  embedding   BLOB,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (document_id, chunk_index)
);

-- 11. Nhật ký (ai làm gì, lúc nào, có phải do AI làm)
CREATE TABLE IF NOT EXISTS audit_logs (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))) CHECK (length(id) = 36),
  user_id     TEXT REFERENCES users (id),
  action      TEXT NOT NULL,
  entity_type TEXT,
  entity_id   TEXT,
  detail      TEXT,
  by_ai       INTEGER NOT NULL DEFAULT 0 CHECK (by_ai IN (0, 1)),
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs (created_at);

-- 12. Lịch sử trò chuyện với trợ lý AI (theo người dùng)
CREATE TABLE IF NOT EXISTS chat_messages (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))) CHECK (length(id) = 36),
  user_id     TEXT NOT NULL REFERENCES users (id),
  lead_id     TEXT REFERENCES leads (id),
  role        TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content     TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_chat_user ON chat_messages (user_id, created_at);

-- 13. Phiên đăng nhập (cookie giữ mã ngẫu nhiên; DB chỉ lưu HMAC của mã đó)
CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))) CHECK (length(id) = 36),
  user_id     TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,
  expires_at  TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions (user_id);

-- 14. Lần đăng nhập sai (để giới hạn 10 lần / 15 phút theo email)
CREATE TABLE IF NOT EXISTS login_attempts (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))) CHECK (length(id) = 36),
  email       TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON login_attempts (email, created_at);

-- Trigger: tự cập nhật updated_at khi sửa dòng mà không tự đặt updated_at.
CREATE TRIGGER IF NOT EXISTS trg_users_updated_at AFTER UPDATE ON users
FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE users SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id;
END;
CREATE TRIGGER IF NOT EXISTS trg_courses_updated_at AFTER UPDATE ON courses
FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE courses SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id;
END;
CREATE TRIGGER IF NOT EXISTS trg_course_intakes_updated_at AFTER UPDATE ON course_intakes
FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE course_intakes SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id;
END;
CREATE TRIGGER IF NOT EXISTS trg_leads_updated_at AFTER UPDATE ON leads
FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE leads SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id;
END;
CREATE TRIGGER IF NOT EXISTS trg_activities_updated_at AFTER UPDATE ON activities
FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE activities SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id;
END;
CREATE TRIGGER IF NOT EXISTS trg_tasks_updated_at AFTER UPDATE ON tasks
FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE tasks SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id;
END;
CREATE TRIGGER IF NOT EXISTS trg_classes_updated_at AFTER UPDATE ON classes
FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE classes SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id;
END;
CREATE TRIGGER IF NOT EXISTS trg_enrollments_updated_at AFTER UPDATE ON enrollments
FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE enrollments SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id;
END;
CREATE TRIGGER IF NOT EXISTS trg_documents_updated_at AFTER UPDATE ON documents
FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE documents SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id;
END;
CREATE TRIGGER IF NOT EXISTS trg_document_chunks_updated_at AFTER UPDATE ON document_chunks
FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE document_chunks SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id;
END;
CREATE TRIGGER IF NOT EXISTS trg_audit_logs_updated_at AFTER UPDATE ON audit_logs
FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE audit_logs SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id;
END;
CREATE TRIGGER IF NOT EXISTS trg_chat_messages_updated_at AFTER UPDATE ON chat_messages
FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE chat_messages SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id;
END;
CREATE TRIGGER IF NOT EXISTS trg_sessions_updated_at AFTER UPDATE ON sessions
FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE sessions SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id;
END;
CREATE TRIGGER IF NOT EXISTS trg_login_attempts_updated_at AFTER UPDATE ON login_attempts
FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE login_attempts SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id;
END;
