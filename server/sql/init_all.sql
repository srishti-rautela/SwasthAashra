DROP DATABASE IF EXISTS swasthashra;
CREATE DATABASE swasthashra CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE swasthashra;
-- Users
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE,
  password VARCHAR(255),
  role ENUM('patient','doctor','staff','admin','pharmacy','insurance') NOT NULL DEFAULT 'patient',
  gender VARCHAR(20) NULL,
  age INT NULL,
  contact VARCHAR(30) NULL,
  department VARCHAR(100) NULL,
  specialization VARCHAR(100) NULL,
  patient_code VARCHAR(20) UNIQUE NULL, -- P-YYYYMMDD-XXXX (set by backend)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Notifications
CREATE TABLE notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  message VARCHAR(255) NOT NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX (user_id),
  CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Doctor–Patient assignments
CREATE TABLE doctor_patient_assignments (
  doctor_id INT NOT NULL,
  patient_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (doctor_id, patient_id),
  CONSTRAINT fk_dpa_doctor  FOREIGN KEY (doctor_id)  REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_dpa_patient FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Appointments
CREATE TABLE appointments (
  appointment_id INT AUTO_INCREMENT PRIMARY KEY,
  patient_user_id INT NOT NULL,           -- FK to users.id
  patient_id VARCHAR(20) NOT NULL,        -- human-friendly patient_code
  doctor_id INT NOT NULL,                 -- FK to users.id (doctor)
  appointment_date DATE NOT NULL,
  appointment_time TIME NOT NULL,
  reason TEXT,
  status ENUM('Pending','Confirmed','Completed','Cancelled') DEFAULT 'Pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX (patient_user_id),
  INDEX (patient_id),
  INDEX (doctor_id, appointment_date, appointment_time),
  INDEX (status),
  CONSTRAINT fk_appt_patient FOREIGN KEY (patient_user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_appt_doctor  FOREIGN KEY (doctor_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Appointment attachments
CREATE TABLE appointment_files (
  id INT AUTO_INCREMENT PRIMARY KEY,
  appointment_id INT NOT NULL,
  filename VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  size INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX (appointment_id),
  CONSTRAINT fk_appt_file FOREIGN KEY (appointment_id) REFERENCES appointments(appointment_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Helpful view for UI
DROP VIEW IF EXISTS appointments_view;
CREATE VIEW appointments_view AS
SELECT
  a.appointment_id        AS id,
  a.patient_user_id,
  a.patient_id,
  a.doctor_id,
  a.appointment_date,
  a.appointment_time,
  a.reason,
  a.status,
  a.created_at,
  p.name                  AS patient_name,
  d.name                  AS doctor_name
FROM appointments a
JOIN users p ON p.id = a.patient_user_id
JOIN users d ON d.id = a.doctor_id;

-- Prescriptions
CREATE TABLE IF NOT EXISTS prescriptions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  patient_id INT NOT NULL,
  doctor_id INT NOT NULL,
  medicines TEXT NOT NULL,
  -- Updated status enum for doctor→pharmacy flow
  status ENUM('Pending','Processing','Completed') NOT NULL DEFAULT 'Pending',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  INDEX (patient_id),
  INDEX (doctor_id),
  CONSTRAINT fk_rx_patient FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_rx_doctor  FOREIGN KEY (doctor_id)  REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Discharges
CREATE TABLE discharges (
  id INT AUTO_INCREMENT PRIMARY KEY,
  patient_id INT NOT NULL,
  doctor_id INT NOT NULL,
  type ENUM('Discharge','Transfer') NOT NULL DEFAULT 'Discharge',
  diagnosis TEXT NOT NULL,
  treatment TEXT,
  remarks TEXT,
  follow_up_date DATE NULL,
  status ENUM('Pending','Completed','Rejected') DEFAULT 'Pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL DEFAULT NULL,
  INDEX(patient_id),
  INDEX(doctor_id),
  CONSTRAINT fk_discharge_patient FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_discharge_doctor FOREIGN KEY (doctor_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Billing
CREATE TABLE IF NOT EXISTS billing (
  id INT AUTO_INCREMENT PRIMARY KEY,
  discharge_id INT NOT NULL,
  amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  status ENUM('Pending','Paid','Cancelled') DEFAULT 'Pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX (discharge_id),
  CONSTRAINT fk_billing_discharge FOREIGN KEY (discharge_id) REFERENCES discharges(id) ON DELETE CASCADE
) ENGINE=InnoDB;
CREATE TABLE pharmacy_bills (
    id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT NOT NULL,
    prescription_id INT NULL,
    total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX(patient_id),

    CONSTRAINT fk_pb_patient
        FOREIGN KEY (patient_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_pb_prescription
        FOREIGN KEY (prescription_id)
        REFERENCES prescriptions(id)
        ON DELETE SET NULL
);
-- approvals table per department
CREATE TABLE IF NOT EXISTS discharge_approvals (
  id INT AUTO_INCREMENT PRIMARY KEY,
  discharge_id INT NOT NULL,
  department ENUM('Staff','Pharmacy','Insurance') NOT NULL,
  status ENUM('Pending','Approved','Rejected') NOT NULL DEFAULT 'Pending',
  details TEXT NULL,
  reviewed_by INT NULL,
  reviewed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_discharge_department (discharge_id, department),
  INDEX (discharge_id),
  CONSTRAINT fk_da_discharge FOREIGN KEY (discharge_id) REFERENCES discharges(id) ON DELETE CASCADE
) ENGINE=InnoDB;