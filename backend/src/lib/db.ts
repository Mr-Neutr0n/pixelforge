import pg from "pg";

const { Pool } = pg;

let pool: pg.Pool;

function getPool(): pg.Pool {
  if (pool) return pool;
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  return pool;
}

export async function initDb(): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS sprites (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        prompt TEXT NOT NULL,
        character_image_url TEXT NOT NULL,
        sprite_sheets JSONB NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_sprites_created_at ON sprites(created_at DESC)
    `);
    console.log("Database initialized: sprites table ready");
  } finally {
    client.release();
  }
}

export async function saveSpriteToDb(
  id: string,
  prompt: string,
  characterImageUrl: string,
  spriteSheets: Record<string, { url: string }>
): Promise<void> {
  await getPool().query(
    `INSERT INTO sprites (id, prompt, character_image_url, sprite_sheets)
     VALUES ($1, $2, $3, $4)`,
    [id, prompt, characterImageUrl, JSON.stringify(spriteSheets)]
  );
}

export async function getSprites(
  page: number = 1,
  limit: number = 20
): Promise<{ sprites: any[]; total: number; page: number; totalPages: number }> {
  const offset = (page - 1) * limit;

  const [countResult, dataResult] = await Promise.all([
    getPool().query("SELECT COUNT(*) FROM sprites"),
    getPool().query(
      `SELECT id, prompt, character_image_url, created_at
       FROM sprites ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    ),
  ]);

  const total = parseInt(countResult.rows[0].count, 10);
  return {
    sprites: dataResult.rows.map((r) => ({
      id: r.id,
      prompt: r.prompt,
      characterImageUrl: r.character_image_url,
      createdAt: r.created_at,
    })),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

export async function getSpriteById(id: string): Promise<any | null> {
  const result = await getPool().query(
    `SELECT id, prompt, character_image_url, sprite_sheets, created_at
     FROM sprites WHERE id = $1`,
    [id]
  );

  if (result.rows.length === 0) return null;

  const r = result.rows[0];
  return {
    id: r.id,
    prompt: r.prompt,
    characterImageUrl: r.character_image_url,
    spriteSheets: typeof r.sprite_sheets === "string"
      ? JSON.parse(r.sprite_sheets)
      : r.sprite_sheets,
    createdAt: r.created_at,
  };
}
