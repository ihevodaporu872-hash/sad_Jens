import { Router } from 'express';
import { randomUUID } from 'crypto';
import db from '../db.js';

const router = Router();

// GET /api/models/:modelId/worksets
router.get('/models/:modelId/worksets', (req, res) => {
  const { modelId } = req.params;
  const rows = db.prepare('SELECT * FROM worksets WHERE model_id = ? ORDER BY created_at ASC').all(modelId);

  const worksets = rows.map(rowToWorkset);
  res.json(worksets);
});

// POST /api/models/:modelId/worksets
router.post('/models/:modelId/worksets', (req, res) => {
  const { modelId } = req.params;
  const { name, color = '#FF8800', opacity = 0.35, elementIds } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }

  const id = randomUUID();
  const now = new Date().toISOString();
  const expressIds = JSON.stringify(elementIds?.expressIds || []);
  const globalIds = JSON.stringify(elementIds?.globalIds || []);

  db.prepare(`
    INSERT INTO worksets (id, model_id, name, color, opacity, express_ids, global_ids, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, modelId, name, color, opacity, expressIds, globalIds, now, now);

  const row = db.prepare('SELECT * FROM worksets WHERE id = ?').get(id);
  res.status(201).json(rowToWorkset(row));
});

// PUT /api/models/:modelId/worksets/:worksetId
router.put('/models/:modelId/worksets/:worksetId', (req, res) => {
  const { modelId, worksetId } = req.params;
  const existing = db.prepare('SELECT * FROM worksets WHERE id = ? AND model_id = ?').get(worksetId, modelId);

  if (!existing) {
    return res.status(404).json({ error: 'Workset not found' });
  }

  const updates = req.body;
  const now = new Date().toISOString();

  const name = updates.name ?? existing.name;
  const color = updates.color ?? existing.color;
  const opacity = updates.opacity ?? existing.opacity;
  const expressIds = updates.elementIds?.expressIds
    ? JSON.stringify(updates.elementIds.expressIds)
    : existing.express_ids;
  const globalIds = updates.elementIds?.globalIds
    ? JSON.stringify(updates.elementIds.globalIds)
    : existing.global_ids;

  db.prepare(`
    UPDATE worksets SET name = ?, color = ?, opacity = ?, express_ids = ?, global_ids = ?, updated_at = ?
    WHERE id = ? AND model_id = ?
  `).run(name, color, opacity, expressIds, globalIds, now, worksetId, modelId);

  const row = db.prepare('SELECT * FROM worksets WHERE id = ?').get(worksetId);
  res.json(rowToWorkset(row));
});

// DELETE /api/models/:modelId/worksets/:worksetId
router.delete('/models/:modelId/worksets/:worksetId', (req, res) => {
  const { modelId, worksetId } = req.params;
  const result = db.prepare('DELETE FROM worksets WHERE id = ? AND model_id = ?').run(worksetId, modelId);

  if (result.changes === 0) {
    return res.status(404).json({ error: 'Workset not found' });
  }

  res.json({ message: 'Deleted' });
});

// Helper: convert DB row to API response
function rowToWorkset(row) {
  return {
    id: row.id,
    modelId: row.model_id,
    name: row.name,
    color: row.color,
    opacity: row.opacity,
    elementIds: {
      expressIds: JSON.parse(row.express_ids),
      globalIds: JSON.parse(row.global_ids),
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export default router;
