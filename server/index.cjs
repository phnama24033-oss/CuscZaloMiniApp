const crypto = require("node:crypto");
const mysql = require("mysql2/promise");
const express = require("express");
const ExcelJS = require("exceljs");

const app = express();
const port = Number(process.env.API_PORT || 3001);
const adminToken = process.env.API_ADMIN_TOKEN;
const allowedOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowAllOrigins = allowedOrigins.includes("*");

function isLoopbackOrigin(origin) {
  if (!origin) return false;
  try {
    const hostname = new URL(origin).hostname.toLowerCase();
    return ["localhost", "127.0.0.1", "::1", "[::1]"].includes(hostname);
  } catch {
    return false;
  }
}

if (!adminToken || adminToken.length < 8) {
  throw new Error(
    "API_ADMIN_TOKEN must be set to a secret of at least 8 characters."
  );
}

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("API_PORT must be a valid TCP port.");
}

const requiredDatabaseConfig = ["DB_HOST", "DB_USER", "DB_NAME"];
const missingDatabaseConfig = requiredDatabaseConfig.filter(
  (key) => !process.env[key]?.trim()
);
const hasDatabasePasswordConfig = Object.prototype.hasOwnProperty.call(
  process.env,
  "DB_PASSWORD"
);
const localDatabaseHosts = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "[::1]",
]);
const isLocalDatabaseHost = localDatabaseHosts.has(
  (process.env.DB_HOST || "").trim().toLowerCase()
);
if (!hasDatabasePasswordConfig) {
  missingDatabaseConfig.push("DB_PASSWORD");
}
const exampleDatabaseConfig = requiredDatabaseConfig.filter((key) =>
  /^(replace-with|your[-_ ]|change[-_ ])/i.test(
    (process.env[key] || "").trim()
  )
);
const invalidDatabasePort =
  process.env.DB_PORT &&
  (!/^\d+$/.test(process.env.DB_PORT) ||
    Number(process.env.DB_PORT) < 1 ||
    Number(process.env.DB_PORT) > 65535);
const emptyPasswordOnRemoteHost =
  hasDatabasePasswordConfig &&
  !process.env.DB_PASSWORD?.trim() &&
  !isLocalDatabaseHost;
if (
  missingDatabaseConfig.length ||
  exampleDatabaseConfig.length ||
  invalidDatabasePort ||
  emptyPasswordOnRemoteHost
) {
  const problems = [
    ...missingDatabaseConfig,
    ...exampleDatabaseConfig.map((key) => `${key} (giá trị mẫu)`),
    ...(invalidDatabasePort ? ["DB_PORT (không hợp lệ)"] : []),
    ...(emptyPasswordOnRemoteHost
      ? ["DB_PASSWORD (rỗng chỉ được phép khi DB_HOST là localhost)"]
      : []),
  ];
  throw new Error(
    `Cấu hình MySQL chưa đầy đủ: ${problems.join(", ")}. ` +
      "Hãy điền các giá trị thật trong .env theo .env.example."
  );
}
if (!process.env.DB_PASSWORD?.trim()) {
  console.warn(
    "Cảnh báo: MySQL đang dùng mật khẩu rỗng trên host cục bộ; không dùng cấu hình này cho production."
  );
}

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
  queueLimit: 0,
  timezone: "Z",
  dateStrings: true,
  charset: "utf8mb4",
});

const phonePattern = /^0[35789]\d{8}$/;
const emailPattern =
  /^[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}$/;
const MAX_WHEEL_SLOTS = 12;

app.disable("x-powered-by");
app.use((req, res, next) => {
  const origin = req.get("origin");
  const localDevelopmentOrigin =
    process.env.NODE_ENV !== "production" && isLoopbackOrigin(origin);
  if (
    origin &&
    allowedOrigins.length &&
    !allowAllOrigins &&
    !allowedOrigins.includes(origin) &&
    !localDevelopmentOrigin
  ) {
    return res.status(403).json({ error: "Origin is not allowed." });
  }
  if (origin) {
    res.setHeader(
      "Access-Control-Allow-Origin",
      allowedOrigins.length && !allowAllOrigins ? origin : "*"
    );
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Authorization, Content-Type"
  );
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});
app.use(express.json({ limit: "16kb", strict: true }));

const requestTimes = new Map();
function rateLimit({ windowMs, max }) {
  return (req, res, next) => {
    const now = Date.now();
    const key = `${req.ip}:${req.path}`;
    const timestamps = (requestTimes.get(key) || []).filter(
      (timestamp) => now - timestamp < windowMs
    );
    if (timestamps.length >= max) {
      return res.status(429).json({ error: "Too many requests. Try again later." });
    }
    timestamps.push(now);
    requestTimes.set(key, timestamps);
    if (requestTimes.size > 10000) {
      for (const [entry, values] of requestTimes) {
        if (values.every((timestamp) => now - timestamp >= windowMs)) {
          requestTimes.delete(entry);
        }
      }
    }
    next();
  };
}

function requireAdmin(req, res, next) {
  const authorization = req.get("authorization") || "";
  const providedToken = authorization.startsWith("Bearer ")
    ? authorization.slice(7)
    : "";
  const expectedHash = crypto.createHash("sha256").update(adminToken).digest();
  const providedHash = crypto
    .createHash("sha256")
    .update(providedToken)
    .digest();
  if (!crypto.timingSafeEqual(expectedHash, providedHash)) {
    return res.status(401).json({ error: "Admin authentication required." });
  }
  next();
}

function normalizeText(value) {
  return typeof value === "string"
    ? value.normalize("NFC").replace(/\s+/gu, " ").trim()
    : "";
}

function normalizePhone(value) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  const phone = trimmed.startsWith("+84") ? `0${trimmed.slice(3)}` : trimmed;
  return phonePattern.test(phone) ? phone : "";
}

function normalizeSearch(value) {
  return normalizeText(value)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/đ/giu, "d")
    .toLowerCase()
    .replace(/[%_\\]/g, "")
    .slice(0, 100);
}

function parsePositiveInteger(value) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

function toIsoDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const text = String(value);
  const date = new Date(text.includes("T") ? text : `${text.replace(" ", "T")}Z`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeOaUrl(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  let url;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error("OA URL chưa đúng định dạng.");
  }
  if (
    url.protocol !== "https:" ||
    !["zalo.me", "oa.zalo.me"].includes(url.hostname) ||
    url.pathname === "/"
  ) {
    throw new Error("OA URL phải là đường dẫn HTTPS hợp lệ của Zalo.");
  }
  return url.toString();
}

function validateRegistration(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const name = normalizeText(body.name);
  const phone = normalizePhone(body.phone);
  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const zaloUserId =
    typeof body.zaloUserId === "string" ? body.zaloUserId.trim() : "";
  const provinceId = parsePositiveInteger(body.provinceId);
  const majorId = parsePositiveInteger(body.majorId);
  const schoolId =
    body.schoolId === null ? null : parsePositiveInteger(body.schoolId);
  const schoolOther = normalizeText(body.schoolOther);
  const exactlyOneSchool =
    (schoolId !== null && schoolOther.length === 0) ||
    (schoolId === null && schoolOther.length >= 3 && schoolOther.length <= 150);

  if (name.length < 2 || name.length > 100) return null;
  if (!phone || email.length > 254 || !emailPattern.test(email)) return null;
  if (!zaloUserId || zaloUserId.length > 64 || !/^[\x20-\x7E]+$/.test(zaloUserId)) {
    return null;
  }
  if (!provinceId || !majorId || !exactlyOneSchool || body.consent !== true) {
    return null;
  }
  return {
    name,
    phone,
    email,
    zaloUserId,
    provinceId,
    majorId,
    schoolId,
    schoolOther: schoolId === null ? schoolOther : null,
  };
}

async function getWheelSlots(connection = pool) {
  const [rows] = await connection.execute(
    `SELECT wp.id, wp.label, wp.is_reward AS isReward, wp.weight
     FROM wheel_prizes wp
     JOIN games g ON g.id = wp.game_id
     WHERE g.code = 'lucky_wheel' AND g.is_active = 1 AND wp.is_active = 1
     ORDER BY wp.sort_order, wp.id`
  );
  return rows.map((slot) => ({
    ...slot,
    id: Number(slot.id),
    weight: Number(slot.weight),
    isReward: Boolean(slot.isReward),
  }));
}

function getDateFilter(column, startDate, endDate) {
  const clauses = [];
  const params = [];
  if (startDate) {
    clauses.push(`DATE(${column}) >= ?`);
    params.push(startDate);
  }
  if (endDate) {
    clauses.push(`DATE(${column}) <= ?`);
    params.push(endDate);
  }
  return {
    sql: clauses.length ? ` AND ${clauses.join(" AND ")}` : "",
    params,
  };
}

function parseReportDate(value) {
  if (value === undefined || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return undefined;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value
    ? undefined
    : value;
}

app.get("/api/health", async (_req, res, next) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", database: "mysql" });
  } catch (error) {
    next(error);
  }
});

app.get("/api/provinces", async (_req, res, next) => {
  try {
    const [rows] = await pool.execute(
      "SELECT id, name FROM provinces WHERE is_active = 1 ORDER BY sort_order, name"
    );
    res.json(rows.map((row) => ({ id: Number(row.id), name: row.name })));
  } catch (error) {
    next(error);
  }
});

app.get("/api/schools", async (req, res, next) => {
  const provinceId = parsePositiveInteger(req.query.provinceId);
  if (!provinceId) {
    return res.status(400).json({ error: "Vui lòng chọn tỉnh/thành hợp lệ." });
  }
  const query = normalizeSearch(req.query.q);
  const search = `%${query}%`;
  try {
    const [rows] = await pool.execute(
      `SELECT id, name, display_name AS displayName
       FROM schools
       WHERE province_id = ? AND is_active = 1
         AND (? = '' OR search_text LIKE ? OR LOWER(display_name) LIKE LOWER(?))
       ORDER BY display_name
       LIMIT 30`,
      [provinceId, query, search, search]
    );
    res.json(
      rows.map((row) => ({
        id: Number(row.id),
        name: row.name,
        displayName: row.displayName,
      }))
    );
  } catch (error) {
    next(error);
  }
});

app.get("/api/interests", async (_req, res, next) => {
  try {
    const [rows] = await pool.execute(
      "SELECT id, name FROM majors WHERE is_active = 1 ORDER BY sort_order, name"
    );
    res.json(rows.map((row) => ({ id: Number(row.id), name: row.name })));
  } catch (error) {
    next(error);
  }
});

app.get("/api/games", async (_req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT id, code, name, description, icon_url AS iconUrl, route_path AS routePath
       FROM games WHERE is_active = 1 ORDER BY sort_order, id`
    );
    res.json(rows.map((row) => ({ ...row, id: Number(row.id) })));
  } catch (error) {
    next(error);
  }
});

app.get("/api/game/wheel", async (_req, res, next) => {
  try {
    res.json(await getWheelSlots());
  } catch (error) {
    next(error);
  }
});

app.get(
  "/api/game/puzzle/status",
  rateLimit({ windowMs: 60_000, max: 60 }),
  async (req, res, next) => {
    const studentId = parsePositiveInteger(req.query.playerId);
    if (!studentId) {
      return res.status(400).json({ error: "Mã học sinh không hợp lệ." });
    }
    try {
      await pool.execute(
        `UPDATE puzzle_plays
         SET status = 'failed', completed_at = UTC_TIMESTAMP(3)
         WHERE student_id = ? AND status = 'started'
           AND TIMESTAMPDIFF(MICROSECOND, started_at, UTC_TIMESTAMP(3))
             >= CASE \`level\` WHEN 1 THEN 30000000 ELSE 45000000 END`,
        [studentId]
      );
      const [rows] = await pool.execute(
        `SELECT id, \`level\`, status, started_at AS startedAt,
                completed_at AS completedAt
         FROM puzzle_plays WHERE student_id = ? ORDER BY \`level\``,
        [studentId]
      );
      res.json(
        {
          plays: rows.map((row) => ({
            ...row,
            id: Number(row.id),
            level: Number(row.level),
            startedAt: toIsoDate(row.startedAt),
            completedAt: toIsoDate(row.completedAt),
          })),
        }
      );
    } catch (error) {
      next(error);
    }
  }
);

app.post(
  "/api/game/puzzle/plays",
  rateLimit({ windowMs: 60_000, max: 20 }),
  async (req, res, next) => {
    const studentId = parsePositiveInteger(req.body?.playerId);
    const level = Number(req.body?.level);
    if (!studentId || (level !== 1 && level !== 2)) {
      return res.status(400).json({ error: "Cấp độ không hợp lệ." });
    }

    let connection;
    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();
      const [students] = await connection.execute(
        "SELECT id FROM students WHERE id = ? FOR UPDATE",
        [studentId]
      );
      if (!students.length) {
        await connection.rollback();
        return res.status(404).json({ error: "Không tìm thấy học sinh." });
      }

      const [previousPlays] = await connection.execute(
        "SELECT id FROM puzzle_plays WHERE student_id = ? AND `level` = ?",
        [studentId, level]
      );
      if (previousPlays.length) {
        await connection.rollback();
        return res.status(409).json({
          error: "Bạn đã sử dụng lượt chơi duy nhất của cấp độ này.",
        });
      }
      if (level === 2) {
        const [completedLevels] = await connection.execute(
          "SELECT id FROM puzzle_plays WHERE student_id = ? AND `level` = 1 AND status = 'completed'",
          [studentId]
        );
        if (!completedLevels.length) {
          await connection.rollback();
          return res.status(403).json({
            error: "Bạn cần hoàn thành cấp 1 trước khi chơi cấp 2.",
          });
        }
      }

      const [result] = await connection.execute(
        `INSERT INTO puzzle_plays (student_id, \`level\`, status, started_at)
         VALUES (?, ?, 'started', UTC_TIMESTAMP(3))`,
        [studentId, level]
      );
      const [plays] = await connection.execute(
        `SELECT id, \`level\`, status, started_at AS startedAt,
                completed_at AS completedAt
         FROM puzzle_plays WHERE id = ?`,
        [result.insertId]
      );
      await connection.commit();
      const play = plays[0];
      res.status(201).json({
        ...play,
        id: Number(play.id),
        level: Number(play.level),
        startedAt: toIsoDate(play.startedAt),
        completedAt: toIsoDate(play.completedAt),
      });
    } catch (error) {
      if (connection) {
        try {
          await connection.rollback();
        } catch {
          // The connection may already have rolled back.
        }
      }
      if (error && error.code === "ER_DUP_ENTRY") {
        return res.status(409).json({
          error: "Bạn đã sử dụng lượt chơi duy nhất của cấp độ này.",
        });
      }
      next(error);
    } finally {
      connection?.release();
    }
  }
);

app.post(
  "/api/game/puzzle/complete",
  rateLimit({ windowMs: 60_000, max: 20 }),
  async (req, res, next) => {
    const studentId = parsePositiveInteger(req.body?.playerId);
    const level = Number(req.body?.level);
    const playId = parsePositiveInteger(req.body?.playId);
    const solution = req.body?.solution;
    const pieceCount = level === 1 ? 9 : level === 2 ? 12 : 0;
    if (
      !studentId ||
      !playId ||
      !pieceCount ||
      !Array.isArray(solution) ||
      solution.length !== pieceCount ||
      solution.some((piece, index) => piece !== index)
    ) {
      return res.status(400).json({ error: "Kết quả ghép hình không hợp lệ." });
    }

    let connection;
    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();
      const [students] = await connection.execute(
        "SELECT id FROM students WHERE id = ? FOR UPDATE",
        [studentId]
      );
      if (!students.length) {
        await connection.rollback();
        return res.status(404).json({ error: "Không tìm thấy học sinh." });
      }

      const [plays] = await connection.execute(
        `SELECT id, \`level\`, status, started_at AS startedAt,
                TIMESTAMPDIFF(MICROSECOND, started_at, UTC_TIMESTAMP(3)) AS elapsedMicroseconds
         FROM puzzle_plays WHERE id = ? AND student_id = ? AND \`level\` = ? FOR UPDATE`,
        [playId, studentId, level]
      );
      if (!plays.length || plays[0].status !== "started") {
        await connection.rollback();
        return res.status(409).json({
          error: "Lượt chơi này không còn hiệu lực.",
        });
      }

      const play = plays[0];
      const timeLimit = level === 1 ? 30_000_000 : 45_000_000;
      if (Number(play.elapsedMicroseconds) >= timeLimit) {
        await connection.execute(
          "UPDATE puzzle_plays SET status = 'failed', completed_at = UTC_TIMESTAMP(3) WHERE id = ?",
          [play.id]
        );
        await connection.commit();
        return res.status(409).json({
          error: "Bạn đã hết thời gian của cấp độ này.",
        });
      }

      await connection.execute(
        `UPDATE puzzle_plays
         SET status = 'completed', completed_at = UTC_TIMESTAMP(3)
         WHERE id = ?`,
        [play.id]
      );
      const [completed] = await connection.execute(
        `SELECT id, \`level\`, status, started_at AS startedAt,
                completed_at AS completedAt
         FROM puzzle_plays WHERE id = ?`,
        [play.id]
      );
      await connection.commit();
      res.json({
        ...completed[0],
        id: Number(completed[0].id),
        level: Number(completed[0].level),
        startedAt: toIsoDate(completed[0].startedAt),
        completedAt: toIsoDate(completed[0].completedAt),
      });
    } catch (error) {
      if (connection) {
        try {
          await connection.rollback();
        } catch {
          // The connection may already have rolled back.
        }
      }
      next(error);
    } finally {
      connection?.release();
    }
  }
);

app.get("/api/game/spins/status", async (req, res, next) => {
  const studentId = parsePositiveInteger(req.query.playerId);
  if (!studentId) {
    return res.status(400).json({ error: "Mã học sinh không hợp lệ." });
  }
  try {
    const [rows] = await pool.execute(
      `SELECT gp.id
       FROM game_plays gp
       JOIN games g ON g.id = gp.game_id
       WHERE gp.student_id = ? AND g.code = 'lucky_wheel'
       LIMIT 1`,
      [studentId]
    );
    res.json({ used: rows.length > 0 });
  } catch (error) {
    next(error);
  }
});

app.get(
  "/api/players/:id/rewards",
  rateLimit({ windowMs: 60_000, max: 60 }),
  async (req, res, next) => {
    const studentId = parsePositiveInteger(req.params.id);
    if (!studentId) {
      return res.status(400).json({ error: "Mã học sinh không hợp lệ." });
    }
    try {
      const [rows] = await pool.execute(
        `SELECT gp.id, g.name AS gameName, gp.reward_label AS reward,
                gp.played_at AS receivedAt
         FROM game_plays gp
         JOIN games g ON g.id = gp.game_id
         WHERE gp.student_id = ? AND gp.reward_label IS NOT NULL
         ORDER BY gp.played_at DESC, gp.id DESC`,
        [studentId]
      );
      res.json(
        rows.map((row) => ({
          ...row,
          id: Number(row.id),
          receivedAt: toIsoDate(row.receivedAt),
        }))
      );
    } catch (error) {
      next(error);
    }
  }
);

app.post(
  "/api/players",
  rateLimit({ windowMs: 60_000, max: 5 }),
  async (req, res, next) => {
    const localTestId =
      typeof req.body?.zaloUserId === "string" &&
      req.body.zaloUserId.startsWith("local-dev:");
    const origin = req.get("origin");
    const localTestOrigin =
      process.env.NODE_ENV !== "production" && isLoopbackOrigin(origin);
    const remoteTestModeEnabled =
      process.env.ALLOW_ZALO_TEST_REGISTRATIONS === "true";
    if (localTestId && !localTestOrigin && !remoteTestModeEnabled) {
      return res.status(403).json({
        error: "API chưa bật chế độ ghi hồ sơ ID kiểm thử.",
      });
    }

    const student = validateRegistration(req.body);
    if (!student) {
      return res.status(400).json({ error: "Thông tin đăng ký không hợp lệ." });
    }

    let connection;
    try {
      connection = await pool.getConnection();
      const [[provinceRows], [majorRows]] = await Promise.all([
        connection.execute(
          "SELECT id FROM provinces WHERE id = ? AND is_active = 1",
          [student.provinceId]
        ),
        connection.execute(
          "SELECT id, name FROM majors WHERE id = ? AND is_active = 1",
          [student.majorId]
        ),
      ]);
      if (!provinceRows.length) {
        return res.status(400).json({ error: "Tỉnh/thành đã chọn không khả dụng." });
      }
      if (!majorRows.length) {
        return res.status(400).json({ error: "Ngành quan tâm đã chọn không khả dụng." });
      }

      let school = null;
      if (student.schoolId !== null) {
        const [schools] = await connection.execute(
          `SELECT id, display_name AS displayName
           FROM schools
           WHERE id = ? AND province_id = ? AND is_active = 1`,
          [student.schoolId, student.provinceId]
        );
        if (!schools.length) {
          return res.status(400).json({
            error: "Trường đã chọn không thuộc tỉnh/thành hoặc không còn khả dụng.",
          });
        }
        school = schools[0];
      }

      const [oaSettings] = await connection.execute(
        "SELECT setting_value AS oaUrl FROM app_settings WHERE setting_key = ?",
        ["recruitment_oa_url"]
      );
      const oaUrl = normalizeOaUrl(oaSettings[0]?.oaUrl);
      const [result] = await connection.execute(
        `INSERT INTO students
          (zalo_user_id, full_name, phone, email, province_id, school_id,
           school_other, major_id, consented_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP())`,
        [
          student.zaloUserId,
          student.name,
          student.phone,
          student.email,
          student.provinceId,
          student.schoolId,
          student.schoolOther,
          student.majorId,
        ]
      );
      const createdAt = new Date().toISOString();
      res.status(201).json({
        id: Number(result.insertId),
        createdAt,
        oaUrl,
        profile: {
          name: student.name,
          phone: student.phone,
          email: student.email,
          province: provinceRows[0].name,
          school: school?.displayName || student.schoolOther,
          major: majorRows[0].name,
          createdAt,
        },
      });
    } catch (error) {
      if (error && error.code === "ER_DUP_ENTRY") {
        const duplicateField = String(error.message).includes("uq_students_phone")
          ? "Số điện thoại"
          : "Tài khoản Zalo";
        return res.status(409).json({
          error: `${duplicateField} này đã được đăng ký trước đó.`,
        });
      }
      next(error);
    } finally {
      connection?.release();
    }
  }
);

app.post(
  "/api/game/spins",
  rateLimit({ windowMs: 60_000, max: 20 }),
  async (req, res, next) => {
    const studentId = parsePositiveInteger(req.body?.playerId);
    if (!studentId) {
      return res.status(400).json({ error: "Mã học sinh không hợp lệ." });
    }

    let connection;
    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();
      const [students] = await connection.execute(
        "SELECT id FROM students WHERE id = ? FOR UPDATE",
        [studentId]
      );
      if (!students.length) {
        await connection.rollback();
        return res.status(404).json({ error: "Không tìm thấy học sinh." });
      }

      const [games] = await connection.execute(
        "SELECT id FROM games WHERE code = 'lucky_wheel' AND is_active = 1"
      );
      if (!games.length) {
        await connection.rollback();
        return res.status(503).json({ error: "Trò chơi hiện không khả dụng." });
      }
      const gameId = Number(games[0].id);
      const [previousPlays] = await connection.execute(
        "SELECT id FROM game_plays WHERE student_id = ? AND game_id = ? LIMIT 1",
        [studentId, gameId]
      );
      if (previousPlays.length) {
        await connection.rollback();
        return res.status(409).json({
          error: "Bạn đã sử dụng lượt quay duy nhất của mình.",
        });
      }

      const wheel = await getWheelSlots(connection);
      if (wheel.length < 2) {
        await connection.rollback();
        return res.status(503).json({
          error: "Vòng quay cần có ít nhất 2 ô đang hoạt động.",
        });
      }
      const totalWeight = wheel.reduce((total, slot) => total + slot.weight, 0);
      let ticket = crypto.randomInt(totalWeight);
      let slotIndex = 0;
      for (const [index, slot] of wheel.entries()) {
        ticket -= slot.weight;
        if (ticket < 0) {
          slotIndex = index;
          break;
        }
      }
      const selectedSlot = wheel[slotIndex];
      const reward = selectedSlot.isReward ? selectedSlot.label : null;
      const createdAt = new Date().toISOString();
      await connection.execute(
        `INSERT INTO game_plays
          (student_id, game_id, wheel_prize_id, result_label, reward_label, played_at)
         VALUES (?, ?, ?, ?, ?, UTC_TIMESTAMP(3))`,
        [studentId, gameId, selectedSlot.id, selectedSlot.label, reward]
      );
      await connection.commit();
      res.status(201).json({
        slotId: selectedSlot.id,
        slotIndex,
        reward,
        createdAt,
        wheel: wheel.map(({ weight: _weight, ...slot }) => slot),
      });
    } catch (error) {
      if (connection) {
        try {
          await connection.rollback();
        } catch {
          // The connection may already have rolled back.
        }
      }
      if (error && error.code === "ER_DUP_ENTRY") {
        return res.status(409).json({
          error: "Bạn đã sử dụng lượt quay duy nhất của mình.",
        });
      }
      next(error);
    } finally {
      connection?.release();
    }
  }
);

app.post(
  "/api/zalo/phone",
  rateLimit({ windowMs: 60_000, max: 10 }),
  async (req, res) => {
    const accessToken =
      typeof req.body?.accessToken === "string" ? req.body.accessToken : "";
    const code = typeof req.body?.code === "string" ? req.body.code : "";
    if (!accessToken || !code || !process.env.ZALO_SECRET_KEY) {
      return res.status(503).json({
        error: "Dịch vụ lấy số điện thoại chưa được cấu hình.",
      });
    }

    try {
      const response = await fetch("https://graph.zalo.me/v2.0/me/info", {
        headers: {
          access_token: accessToken,
          code,
          secret_key: process.env.ZALO_SECRET_KEY,
        },
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) {
        return res.status(502).json({
          error: "Không thể xác minh số điện thoại với Zalo.",
        });
      }
      const data = await response.json();
      const phone = data?.data?.number;
      if (typeof phone !== "string" || !normalizePhone(phone)) {
        return res.status(502).json({
          error: "Zalo trả về số điện thoại không hợp lệ.",
        });
      }
      res.json({ phone: normalizePhone(phone) });
    } catch {
      res.status(502).json({
        error: "Không thể kết nối dịch vụ xác minh số điện thoại.",
      });
    }
  }
);

app.get("/api/admin/interests", requireAdmin, async (_req, res, next) => {
  try {
    const [rows] = await pool.execute(
      "SELECT id, name FROM majors WHERE is_active = 1 ORDER BY sort_order, name"
    );
    res.json(rows.map((row) => ({ id: Number(row.id), name: row.name })));
  } catch (error) {
    next(error);
  }
});

app.get("/api/admin/oa", requireAdmin, async (_req, res, next) => {
  try {
    const [rows] = await pool.execute(
      "SELECT setting_value AS oaUrl FROM app_settings WHERE setting_key = ?",
      ["recruitment_oa_url"]
    );
    res.json({ oaUrl: rows[0]?.oaUrl || null });
  } catch (error) {
    next(error);
  }
});

app.put("/api/admin/oa", requireAdmin, async (req, res, next) => {
  let oaUrl;
  try {
    oaUrl = normalizeOaUrl(req.body?.oaUrl);
  } catch (error) {
    return res.status(400).json({
      error:
        error instanceof Error
          ? error.message
          : "OA URL chưa đúng định dạng.",
    });
  }
  if (!oaUrl) {
    return res.status(400).json({ error: "Vui lòng nhập OA URL." });
  }

  try {
    await pool.execute(
      `INSERT INTO app_settings (setting_key, setting_value)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
      ["recruitment_oa_url", oaUrl]
    );
    res.json({ oaUrl });
  } catch (error) {
    next(error);
  }
});

app.post("/api/admin/interests", requireAdmin, async (req, res, next) => {
  const name = normalizeText(req.body?.name);
  if (name.length < 2 || name.length > 100) {
    return res.status(400).json({ error: "Tên ngành cần từ 2 đến 100 ký tự." });
  }
  try {
    const [duplicates] = await pool.execute(
      "SELECT id, is_active AS isActive FROM majors WHERE LOWER(name) = LOWER(?) LIMIT 1",
      [name]
    );
    if (duplicates.length) {
      if (!duplicates[0].isActive) {
        await pool.execute(
          "UPDATE majors SET is_active = 1 WHERE id = ?",
          [duplicates[0].id]
        );
        return res.status(201).json({
          id: Number(duplicates[0].id),
          name,
        });
      }
      return res.status(409).json({ error: "Ngành quan tâm này đã tồn tại." });
    }
    const [result] = await pool.execute(
      "INSERT INTO majors (name, sort_order) VALUES (?, 0)",
      [name]
    );
    res.status(201).json({ id: Number(result.insertId), name });
  } catch (error) {
    next(error);
  }
});

app.put("/api/admin/interests/:id", requireAdmin, async (req, res, next) => {
  const id = parsePositiveInteger(req.params.id);
  const name = normalizeText(req.body?.name);
  if (!id || name.length < 2 || name.length > 100) {
    return res.status(400).json({ error: "Thông tin ngành quan tâm không hợp lệ." });
  }
  try {
    const [duplicates] = await pool.execute(
      "SELECT id FROM majors WHERE id != ? AND LOWER(name) = LOWER(?) LIMIT 1",
      [id, name]
    );
    if (duplicates.length) {
      return res.status(409).json({ error: "Ngành quan tâm này đã tồn tại." });
    }
    const [result] = await pool.execute(
      "UPDATE majors SET name = ? WHERE id = ? AND is_active = 1",
      [name, id]
    );
    if (!result.affectedRows) {
      const [rows] = await pool.execute(
        "SELECT id FROM majors WHERE id = ? AND is_active = 1",
        [id]
      );
      if (!rows.length) {
        return res.status(404).json({ error: "Không tìm thấy ngành quan tâm." });
      }
    }
    res.json({ id, name });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/admin/interests/:id", requireAdmin, async (req, res, next) => {
  const id = parsePositiveInteger(req.params.id);
  if (!id) {
    return res.status(400).json({ error: "Mã ngành quan tâm không hợp lệ." });
  }
  try {
    const [result] = await pool.execute(
      "UPDATE majors SET is_active = 0 WHERE id = ? AND is_active = 1",
      [id]
    );
    if (!result.affectedRows) {
      return res.status(404).json({ error: "Không tìm thấy ngành quan tâm." });
    }
    res.json({ deleted: true });
  } catch (error) {
    next(error);
  }
});

app.get("/api/admin/wheel", requireAdmin, async (_req, res, next) => {
  try {
    res.json(await getWheelSlots());
  } catch (error) {
    next(error);
  }
});

app.post("/api/admin/wheel", requireAdmin, async (req, res, next) => {
  const label = normalizeText(req.body?.label);
  const isReward = req.body?.isReward;
  if (!label || label.length > 100 || typeof isReward !== "boolean") {
    return res.status(400).json({ error: "Tên ô và loại kết quả không hợp lệ." });
  }
  try {
    const [games] = await pool.execute(
      "SELECT id FROM games WHERE code = 'lucky_wheel' AND is_active = 1"
    );
    if (!games.length) {
      return res.status(503).json({ error: "Trò chơi vòng quay chưa được cấu hình." });
    }
    const gameId = Number(games[0].id);
    const [countRows] = await pool.execute(
      "SELECT COUNT(*) AS count FROM wheel_prizes WHERE game_id = ? AND is_active = 1",
      [gameId]
    );
    if (Number(countRows[0].count) >= MAX_WHEEL_SLOTS) {
      return res.status(400).json({
        error: `Vòng quay chỉ hỗ trợ tối đa ${MAX_WHEEL_SLOTS} ô.`,
      });
    }
    const [result] = await pool.execute(
      `INSERT INTO wheel_prizes (game_id, label, is_reward, weight, sort_order)
       VALUES (?, ?, ?, 1, ?)`,
      [gameId, label, Number(isReward), Number(countRows[0].count)]
    );
    res.status(201).json({
      id: Number(result.insertId),
      label,
      isReward,
    });
  } catch (error) {
    next(error);
  }
});

app.put("/api/admin/wheel/:id", requireAdmin, async (req, res, next) => {
  const id = parsePositiveInteger(req.params.id);
  const label = normalizeText(req.body?.label);
  const isReward = req.body?.isReward;
  if (!id || !label || label.length > 100 || typeof isReward !== "boolean") {
    return res.status(400).json({ error: "Thông tin ô vòng quay không hợp lệ." });
  }
  try {
    const [result] = await pool.execute(
      `UPDATE wheel_prizes wp
       JOIN games g ON g.id = wp.game_id
       SET wp.label = ?, wp.is_reward = ?
       WHERE wp.id = ? AND wp.is_active = 1 AND g.code = 'lucky_wheel'`,
      [label, Number(isReward), id]
    );
    if (!result.affectedRows) {
      const [rows] = await pool.execute(
        `SELECT wp.id FROM wheel_prizes wp
         JOIN games g ON g.id = wp.game_id
         WHERE wp.id = ? AND wp.is_active = 1 AND g.code = 'lucky_wheel'`,
        [id]
      );
      if (!rows.length) {
        return res.status(404).json({ error: "Không tìm thấy ô vòng quay." });
      }
    }
    res.json({ id, label, isReward });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/admin/wheel/:id", requireAdmin, async (req, res, next) => {
  const id = parsePositiveInteger(req.params.id);
  if (!id) {
    return res.status(400).json({ error: "Mã ô vòng quay không hợp lệ." });
  }
  try {
    const [games] = await pool.execute(
      "SELECT id FROM games WHERE code = 'lucky_wheel' AND is_active = 1"
    );
    if (!games.length) {
      return res.status(503).json({ error: "Trò chơi vòng quay chưa được cấu hình." });
    }
    const gameId = Number(games[0].id);
    const [countRows] = await pool.execute(
      "SELECT COUNT(*) AS count FROM wheel_prizes WHERE game_id = ? AND is_active = 1",
      [gameId]
    );
    if (Number(countRows[0].count) <= 2) {
      return res.status(400).json({ error: "Vòng quay cần giữ ít nhất 2 ô." });
    }
    const [result] = await pool.execute(
      "UPDATE wheel_prizes SET is_active = 0 WHERE id = ? AND game_id = ? AND is_active = 1",
      [id, gameId]
    );
    if (!result.affectedRows) {
      return res.status(404).json({ error: "Không tìm thấy ô vòng quay." });
    }
    res.json({ deleted: true });
  } catch (error) {
    next(error);
  }
});

app.get("/api/admin/stats", requireAdmin, async (_req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT
        (SELECT COUNT(*) FROM students) AS playerCount,
        (SELECT COUNT(*) FROM game_plays) AS spinCount,
        (SELECT COUNT(*) FROM game_plays WHERE reward_label IS NOT NULL) AS rewardCount`
    );
    res.json({
      playerCount: Number(rows[0].playerCount),
      spinCount: Number(rows[0].spinCount),
      rewardCount: Number(rows[0].rewardCount),
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/admin/players", requireAdmin, async (req, res, next) => {
  const query = normalizeText(req.query.q);
  const requestedPage = Number(req.query.page || 1);
  const requestedLimit = Number(req.query.limit || 20);
  const page =
    Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const limit =
    Number.isSafeInteger(requestedLimit) && requestedLimit > 0
      ? Math.min(requestedLimit, 100)
      : 20;
  const offset = (page - 1) * limit;
  const search = `%${query.replace(/[%_\\]/g, "")}%`;
  const where =
    "WHERE (? = '' OR full_name LIKE ? OR phone LIKE ? OR email LIKE ? OR province LIKE ? OR school LIKE ? OR major LIKE ?)";
  const params = [query, search, search, search, search, search, search];
  try {
    const [[countRow], [rows]] = await Promise.all([
      pool.execute(`SELECT COUNT(*) AS count FROM v_students_full ${where}`, params),
      pool.execute(
        `SELECT id, full_name AS name, phone, email, province, school, major,
          major AS interest, created_at AS createdAt,
          is_following_oa AS isFollowingOa,
          IF(wheel_played_at IS NULL, 0, 1) AS spinCount,
          IF(wheel_reward IS NULL, 0, 1) AS rewardCount,
          wheel_reward AS latestReward, wheel_played_at AS lastPlayedAt
         FROM v_students_full ${where}
         ORDER BY created_at DESC, id DESC
         LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      ),
    ]);
    res.json({
      players: rows.map((row) => ({
        ...row,
        id: String(row.id),
        isFollowingOa: Boolean(row.isFollowingOa),
        spinCount: Number(row.spinCount),
        rewardCount: Number(row.rewardCount),
        createdAt: toIsoDate(row.createdAt),
        lastPlayedAt: toIsoDate(row.lastPlayedAt),
      })),
      total: Number(countRow[0].count),
      page,
      limit,
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/admin/export", requireAdmin, async (req, res, next) => {
  const startDate = parseReportDate(req.query.startDate);
  const endDate = parseReportDate(req.query.endDate);
  if (startDate === undefined || endDate === undefined) {
    return res.status(400).json({ error: "Ngày lọc báo cáo không hợp lệ." });
  }
  if (startDate && endDate && startDate > endDate) {
    return res.status(400).json({
      error: "Ngày bắt đầu không được sau ngày kết thúc.",
    });
  }

  try {
    const studentFilter = getDateFilter("created_at", startDate, endDate);
    const playedFilter = getDateFilter("played_at", startDate, endDate);
    const [studentStatsRows, playStatsRows, studentsRows, playsRows, majorRows] =
      await Promise.all([
        pool.execute(
          `SELECT COUNT(*) AS count FROM students WHERE 1 = 1${studentFilter.sql}`,
          studentFilter.params
        ),
        pool.execute(
          `SELECT COUNT(*) AS spinCount,
            SUM(reward_label IS NOT NULL) AS rewardCount
           FROM game_plays WHERE 1 = 1${playedFilter.sql}`,
          playedFilter.params
        ),
        pool.execute(
          `SELECT id, full_name AS name, phone, email, province, school, major,
            is_following_oa,
            created_at AS createdAt, wheel_reward AS latestReward,
            wheel_played_at AS lastPlayedAt
           FROM v_students_full WHERE 1 = 1${studentFilter.sql}
           ORDER BY created_at DESC`,
          studentFilter.params
        ),
        pool.execute(
          `SELECT gp.id, s.id AS studentId, s.full_name AS name, s.phone,
            m.name AS major, gp.reward_label AS reward, gp.played_at AS createdAt
           FROM game_plays gp
           JOIN students s ON s.id = gp.student_id
           JOIN majors m ON m.id = s.major_id
           WHERE 1 = 1${playedFilter.sql}
           ORDER BY gp.played_at DESC`,
          playedFilter.params
        ),
        pool.execute(
          `SELECT major, COUNT(*) AS playerCount
           FROM v_students_full WHERE 1 = 1${studentFilter.sql}
           GROUP BY major ORDER BY playerCount DESC, major`,
          studentFilter.params
        ),
      ]);
    const playerCount = Number(studentStatsRows[0][0].count);
    const spinCount = Number(playStatsRows[0][0].spinCount || 0);
    const rewardCount = Number(playStatsRows[0][0].rewardCount || 0);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "CUSC";
    workbook.created = new Date();
    workbook.subject = "Danh sách học sinh đăng ký tuyển sinh";

    const summary = workbook.addWorksheet("Tổng kết");
    summary.addRows([
      ["BÁO CÁO TUYỂN SINH"],
      ["Thời gian xuất", new Date()],
      [
        "Khoảng thời gian đăng ký",
        startDate || endDate
          ? `${startDate || "Không giới hạn"} đến ${endDate || "Không giới hạn"}`
          : "Toàn bộ thời gian",
      ],
      ["Chỉ số", "Giá trị"],
      ["Học sinh đăng ký", playerCount],
      ["Lượt chơi", spinCount],
      ["Lượt trúng thưởng", rewardCount],
      [],
      ["Ngành quan tâm", "Số học sinh"],
      ...majorRows[0].map((row) => [row.major, Number(row.playerCount)]),
    ]);
    summary.columns = [{ width: 36 }, { width: 28 }];
    summary.getCell("B2").numFmt = "dd/mm/yyyy hh:mm";
    summary.getRow(1).font = { bold: true, size: 16 };
    for (const rowNumber of [4, 9]) {
      summary.getRow(rowNumber).font = { bold: true, color: { argb: "FF0755B8" } };
    }
    summary.views = [{ state: "frozen", ySplit: 4 }];

    const studentSheet = workbook.addWorksheet("Học sinh");
    studentSheet.columns = [
      { header: "Mã học sinh", key: "id", width: 16 },
      { header: "Họ tên", key: "name", width: 26 },
      { header: "Số điện thoại", key: "phone", width: 18 },
      { header: "Email", key: "email", width: 30 },
      { header: "Tỉnh/thành", key: "province", width: 22 },
      { header: "Trường", key: "school", width: 40 },
      { header: "Ngành quan tâm", key: "major", width: 32 },
      { header: "Trạng thái OA", key: "oaStatus", width: 22 },
      { header: "Ngày đăng ký", key: "createdAt", width: 22 },
      { header: "Kết quả vòng quay", key: "latestReward", width: 28 },
      { header: "Thời gian chơi", key: "lastPlayedAt", width: 22 },
    ];
    studentSheet.addRows(
      studentsRows[0].map((row) => ({
        ...row,
        oaStatus: row.is_following_oa ? "Đã xác minh" : "Chưa xác minh",
        createdAt: toIsoDate(row.createdAt)
          ? new Date(toIsoDate(row.createdAt))
          : null,
        lastPlayedAt: toIsoDate(row.lastPlayedAt)
          ? new Date(toIsoDate(row.lastPlayedAt))
          : null,
      }))
    );
    studentSheet.views = [{ state: "frozen", ySplit: 1 }];
    studentSheet.autoFilter = { from: "A1", to: "K1" };

    const playSheet = workbook.addWorksheet("Lượt chơi");
    playSheet.columns = [
      { header: "Mã lượt chơi", key: "id", width: 16 },
      { header: "Mã học sinh", key: "studentId", width: 16 },
      { header: "Họ tên", key: "name", width: 26 },
      { header: "Số điện thoại", key: "phone", width: 18 },
      { header: "Ngành quan tâm", key: "major", width: 32 },
      { header: "Kết quả", key: "reward", width: 32 },
      { header: "Thời gian chơi", key: "createdAt", width: 22 },
    ];
    playSheet.addRows(
      playsRows[0].map((row) => ({
        ...row,
        createdAt: toIsoDate(row.createdAt)
          ? new Date(toIsoDate(row.createdAt))
          : null,
        reward: row.reward || "Chúc bạn may mắn lần sau!",
      }))
    );
    playSheet.views = [{ state: "frozen", ySplit: 1 }];
    playSheet.autoFilter = { from: "A1", to: "G1" };

    for (const sheet of [studentSheet, playSheet]) {
      sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      sheet.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF0068FF" },
      };
    }
    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="cusc-student-report.xlsx"'
    );
    res.send(Buffer.from(buffer));
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  if (error instanceof SyntaxError && "body" in error) {
    return res.status(400).json({ error: "JSON không hợp lệ." });
  }
  if (error && error.type === "entity.too.large") {
    return res.status(413).json({ error: "Dữ liệu gửi lên quá lớn." });
  }
  console.error("API request failed:", error);
  res.status(500).json({ error: "Lỗi máy chủ." });
});

const server = app.listen(port, "0.0.0.0", async () => {
  try {
    await pool.query("SELECT 1");
    console.log(`MySQL API server listening on port ${port}`);
  } catch (error) {
    console.error("Could not connect to MySQL:", error);
    server.close(() => {
      pool.end().finally(() => {
        process.exitCode = 1;
      });
    });
  }
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    server.close(() => {
      pool.end().finally(() => process.exit(0));
    });
  });
}
