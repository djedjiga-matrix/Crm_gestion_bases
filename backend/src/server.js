require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');

const db = require('./db');
const contactsRouter = require('./routes/contacts');
const campaignsRouter = require('./routes/campaigns');
const exportsRouter = require('./routes/exports');
const importRouter = require('./routes/import');
const referenceRouter = require('./routes/reference');
const statsRouter = require('./routes/stats');
const enrichmentRouter = require('./routes/enrichment');
const authorizedCpRouter = require('./routes/authorized-cp');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Upload configuration
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

// Routes
app.use('/api/contacts', contactsRouter);
app.use('/api/campaigns', campaignsRouter);
app.use('/api/exports', exportsRouter);
app.use('/api/import', upload.single('file'), importRouter);
app.use('/api/reference', referenceRouter);
app.use('/api/stats', statsRouter);
app.use('/api/enrichment', enrichmentRouter);
app.use('/api/authorized-cp', upload.single('file'), authorizedCpRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 Database: ${process.env.DB_NAME}`);
});
