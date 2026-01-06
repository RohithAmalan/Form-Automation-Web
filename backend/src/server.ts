import './prelude'; // MUST BE FIRST
import express from 'express';
import cors from 'cors';
import session from 'express-session';
import pgSession from 'connect-pg-simple';
import passport from './auth/passport';
import authRoutes from './routes/auth.routes';
import formRoutes from './routes/form.routes';
import templateRoutes from './routes/template.routes';
import { JobModel } from './models/job.model';
import { LogModel } from './models/log.model';
import { runWorker } from './queue/taskQueue';
import { globalErrorHandler } from './middleware/errorHandler';
import pool from './config/db';

const app = express();
const PORT = process.env.PORT || 3001;
const PgStore = pgSession(session);

// --- SESSION & PASSPORT ---
app.use(session({
  store: new PgStore({
    pool: pool,
    tableName: 'session'
  }),
  secret: process.env.SESSION_SECRET || 'dev_secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 } // 30 days
}));

app.use(passport.initialize());
app.use(passport.session());
// --------------------------

app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true
})); // Update CORS
app.use(express.json());


// Mount Routes
app.use('/auth', authRoutes); // Auth Routes
app.use('/templates', templateRoutes); // Templates mounted at /templates prefix
app.use('/', formRoutes);

// Global Error Handler (Must be last)
// Global Error Handler (Must be last)
app.use(globalErrorHandler);


app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Test Form Route (Keeping for legacy/debug)
app.get('/test-form', (req, res) => {
  res.send(`
    <html>
      <body>
        <h1>Test Form</h1>
        <form>
          <label for="name">Name:</label><br>
          <input type="text" id="name" name="name"><br>
          <label for="email">Email:</label><br>
          <input type="email" id="email" name="email"><br>
          <label for="message">Message:</label><br>
          <textarea id="message" name="message"></textarea><br><br>
          <button type="submit" id="submit">Submit</button>
        </form>
      </body>
    </html>
  `);
});

app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);

  try {
    const count = await JobModel.failStuckJobs();
    if (count && count > 0) {
      console.log(`⚠️  Crash Recovery: Marked ${count} stuck jobs as FAILED.`);
    } else {
      console.log("✅ No stuck jobs found on startup.");
    }
  } catch (e) {
    console.error("Crash recovery failed:", e);
  }

  // Start Worker
  runWorker().catch(err => console.error("Worker failed to start:", err));
});
