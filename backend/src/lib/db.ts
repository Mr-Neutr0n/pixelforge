import pg from "pg";

const { Pool } = pg;
let pool: pg.Pool | undefined;

export function getPool(): pg.Pool {
  if (pool) return pool;
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) throw new Error("DATABASE_URL is required");
  pool = new Pool({ connectionString, max: 8, connectionTimeoutMillis: 5_000 });
  pool.on("connect", (client) => {
    void client.query("SET timezone = 'UTC'");
  });
  return pool;
}

export async function initDb(): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query(`
      CREATE TABLE IF NOT EXISTS sprites (
        id UUID PRIMARY KEY,
        prompt TEXT NOT NULL,
        character_image_url TEXT NOT NULL,
        sprite_sheets JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query("CREATE INDEX IF NOT EXISTS idx_sprites_created_at ON sprites(created_at DESC)");
    await client.query(`
      CREATE TABLE IF NOT EXISTS generation_daily (
        day DATE PRIMARY KEY,
        total INTEGER NOT NULL DEFAULT 0 CHECK (total >= 0)
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS generation_ip_daily (
        day DATE NOT NULL,
        ip_hash TEXT NOT NULL,
        total INTEGER NOT NULL DEFAULT 0 CHECK (total >= 0),
        PRIMARY KEY (day, ip_hash)
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS generation_sessions (
        token_hash TEXT PRIMARY KEY,
        day DATE NOT NULL,
        ip_hash TEXT NOT NULL,
        provider_calls INTEGER NOT NULL DEFAULT 0 CHECK (provider_calls >= 0),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query("CREATE INDEX IF NOT EXISTS idx_generation_sessions_day ON generation_sessions(day)");
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function checkDatabase(): Promise<void> {
  await getPool().query("SELECT 1");
}

export async function saveSpriteToDb(
  id: string,
  prompt: string,
  characterImageKey: string,
  spriteSheets: Record<string, { key: string }>,
): Promise<void> {
  await getPool().query(
    `INSERT INTO sprites (id, prompt, character_image_url, sprite_sheets)
     VALUES ($1, $2, $3, $4)`,
    [id, prompt.slice(0, 1_000), characterImageKey, JSON.stringify(spriteSheets)],
  );
}

export async function getSprites(
  page = 1,
  limit = 20,
): Promise<{ sprites: Array<{ id: string; prompt: string; characterImageKey: string; createdAt: string }>; total: number; page: number; totalPages: number }> {
  const offset = (page - 1) * limit;
  const [countResult, dataResult] = await Promise.all([
    getPool().query("SELECT COUNT(*) FROM sprites"),
    getPool().query(
      `SELECT id, prompt, character_image_url, created_at
       FROM sprites ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset],
    ),
  ]);
  const total = Number.parseInt(countResult.rows[0].count, 10);
  return {
    sprites: dataResult.rows.map((row) => ({
      id: row.id,
      prompt: row.prompt,
      characterImageKey: row.character_image_url,
      createdAt: row.created_at,
    })),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

export async function getSpriteById(id: string): Promise<{
  id: string;
  prompt: string;
  characterImageKey: string;
  spriteSheets: Record<string, { key: string }>;
  createdAt: string;
} | null> {
  const result = await getPool().query(
    `SELECT id, prompt, character_image_url, sprite_sheets, created_at
     FROM sprites WHERE id = $1`,
    [id],
  );
  if (!result.rows.length) return null;
  const row = result.rows[0];
  return {
    id: row.id,
    prompt: row.prompt,
    characterImageKey: row.character_image_url,
    spriteSheets: typeof row.sprite_sheets === "string" ? JSON.parse(row.sprite_sheets) : row.sprite_sheets,
    createdAt: row.created_at,
  };
}
