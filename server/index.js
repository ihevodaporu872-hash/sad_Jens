import express from 'express';
import cors from 'cors';
import worksetRoutes from './routes/worksets.js';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// API routes
app.use('/api', worksetRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`[Server] Worksets API running on http://localhost:${PORT}`);
  console.log(`[Server] Health check: http://localhost:${PORT}/api/health`);
});
