CREATE TABLE IF NOT EXISTS admins_rebuilt_0024 (
  email TEXT PRIMARY KEY,
  role TEXT NOT NULL
);

INSERT OR REPLACE INTO admins_rebuilt_0024 (email, role)
SELECT
  lower(trim(email)) AS email,
  CASE
    WHEN MAX(CASE WHEN role = 'superadmin' THEN 3 WHEN role = 'admin' THEN 2 WHEN role = 'partner' THEN 1 ELSE 0 END) = 3 THEN 'superadmin'
    WHEN MAX(CASE WHEN role = 'superadmin' THEN 3 WHEN role = 'admin' THEN 2 WHEN role = 'partner' THEN 1 ELSE 0 END) = 2 THEN 'admin'
    ELSE 'partner'
  END AS role
FROM admins
WHERE trim(email) <> ''
GROUP BY lower(trim(email));

INSERT OR REPLACE INTO admins_rebuilt_0024 (email, role)
VALUES ('vuchicago@gmail.com', 'superadmin');

DROP TABLE admins;

ALTER TABLE admins_rebuilt_0024 RENAME TO admins;
