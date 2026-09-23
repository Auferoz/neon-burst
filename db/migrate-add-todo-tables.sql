CREATE TABLE IF NOT EXISTS todo_projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT 'green',
  is_inbox INTEGER NOT NULL DEFAULT 0,
  sort_order REAL NOT NULL DEFAULT 0,
  archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS todo_sections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  sort_order REAL NOT NULL DEFAULT 0,
  FOREIGN KEY (project_id) REFERENCES todo_projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS todo_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  section_id INTEGER,
  parent_id INTEGER,
  title TEXT NOT NULL,
  description TEXT,
  priority INTEGER NOT NULL DEFAULT 4,
  sort_order REAL NOT NULL DEFAULT 0,
  due_date TEXT,
  due_time TEXT,
  recurrence TEXT,
  completed_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES todo_projects(id) ON DELETE CASCADE,
  FOREIGN KEY (section_id) REFERENCES todo_sections(id) ON DELETE SET NULL,
  FOREIGN KEY (parent_id) REFERENCES todo_tasks(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS todo_labels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT 'green'
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_todo_labels_name ON todo_labels(name COLLATE NOCASE);

CREATE TABLE IF NOT EXISTS todo_task_labels (
  task_id INTEGER NOT NULL,
  label_id INTEGER NOT NULL,
  PRIMARY KEY (task_id, label_id),
  FOREIGN KEY (task_id) REFERENCES todo_tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (label_id) REFERENCES todo_labels(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS todo_completions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL,
  completed_at TEXT NOT NULL,
  FOREIGN KEY (task_id) REFERENCES todo_tasks(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_todo_tasks_project_completed ON todo_tasks(project_id, completed_at);
CREATE INDEX IF NOT EXISTS idx_todo_tasks_due_date ON todo_tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_todo_tasks_parent ON todo_tasks(parent_id);
CREATE INDEX IF NOT EXISTS idx_todo_sections_project ON todo_sections(project_id);
CREATE INDEX IF NOT EXISTS idx_todo_completions_task ON todo_completions(task_id);
CREATE INDEX IF NOT EXISTS idx_todo_completions_completed_at ON todo_completions(completed_at);

INSERT INTO todo_projects (name, color, is_inbox, sort_order, archived)
SELECT 'Bandeja de entrada', 'green', 1, 0, 0
WHERE NOT EXISTS (SELECT 1 FROM todo_projects WHERE is_inbox = 1);
