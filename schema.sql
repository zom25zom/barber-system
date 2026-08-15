-- Database Schema for Barbershop Booking & Management System

DROP TABLE IF EXISTS barbers;
CREATE TABLE barbers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    title TEXT,
    avatar TEXT,
    workDays TEXT, -- JSON array of numbers, e.g. '[0,1,2,3,4,6]'
    workStart TEXT,
    workEnd TEXT,
    isOff INTEGER DEFAULT 0,
    rating REAL
);

DROP TABLE IF EXISTS services;
CREATE TABLE services (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    price REAL,
    duration INTEGER,
    category TEXT,
    description TEXT
);

DROP TABLE IF EXISTS bookings;
CREATE TABLE bookings (
    id TEXT PRIMARY KEY,
    customerName TEXT NOT NULL,
    customerPhone TEXT NOT NULL,
    barberId TEXT NOT NULL,
    serviceIds TEXT NOT NULL, -- JSON array of strings, e.g. '["s1","s2"]'
    totalPrice REAL,
    totalDuration INTEGER,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    status TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    notes TEXT
);

DROP TABLE IF EXISTS notifications;
CREATE TABLE notifications (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    type TEXT NOT NULL,
    read INTEGER DEFAULT 0,
    bookingId TEXT
);

DROP TABLE IF EXISTS settings;
CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT
);

-- Seed Initial Barbers
INSERT INTO barbers (id, name, title, avatar, workDays, workStart, workEnd, isOff, rating) VALUES
('b1', 'أحمد علي', 'كبير الحلاقين - خبير قصات كلاسيكية ومودرن', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80', '[0,1,2,3,4,6]', '14:00', '23:00', 0, 4.9),
('b2', 'مصطفى حسن', 'أخصائي تسريحات حديثة وتدريج دقيق', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80', '[0,1,2,3,4,5,6]', '15:00', '00:00', 0, 4.8),
('b3', 'عمر الفاروق', 'خبير العناية بالبشرة واللحية وتجهيز العرسان', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80', '[0,2,3,4,5,6]', '16:00', '01:00', 0, 4.95);

-- Seed Initial Services
INSERT INTO services (id, name, price, duration, category, description) VALUES
('s1', 'قص شعر ملكي + تصفيف', 75, 30, 'شعر', 'قص متقن تناسب ملامح الوجه مع غسيل وتصفيف بالاستشوار والمنتجات العالمية.'),
('s2', 'تحديد وتشذيب اللحية مع البخار', 45, 20, 'لحية', 'تحديد بالشفره مع بخار دافئ وزيوت مغذية للبشرة واللحية.'),
('s3', 'باقة VIP الشاملة (قص + لحية + تنظيف بشرة + مساج)', 160, 65, 'باقات', 'العناية الكاملة الكبرى: قص وتحديد وتنظيف بشرة عميق بالأجهزة ومساج للكتفين.'),
('s4', 'تنظيف بشرة بقناع الفحم وقناع الذهب', 85, 30, 'بشرة', 'إزالة الخلايا الميتة والرؤوس السوداء مع قناع الذهب لترطيب نضر.'),
('s5', 'صبغة لحية وشعر احترافية', 90, 40, 'صبغة', 'تغطية كاملة للشيب بمنتجات خالية من الأمونيا تحافظ على حيوية الشعر.'),
('s6', 'قص وتحديد للأطفال (أقل من 12 سنة)', 50, 20, 'شعر', 'قصة مريحة ولطيفة للأطفال في جو ممتع وهادئ.');

-- Seed default settings (like the admin password)
INSERT INTO settings (key, value) VALUES
('admin_password', 'admin123');
