import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { MongoClient, ObjectId } from 'mongodb';

const app = express();
const port = 3009;

// MongoDB setup
const mongoUrl = "mongodb://localhost:27017";
const database = 'node_project';
const collectionName = 'todo';

const client = new MongoClient(mongoUrl);

let db; // We'll initialize once

async function connectDB() {
  await client.connect();
  db = client.db(database);
  console.log('✅ MongoDB connected');
}
connectDB().catch(err => {
  console.error('MongoDB connection failed:', err);
  process.exit(1);
});

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Static files setup
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, "public")));

// EJS setup
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Helper-> get collection
const getCollection = () => db.collection(collectionName);

// Middleware to inject activePage to res.locals for use in templates
app.use((req, res, next) => {
  // Set activePage based on route path for navbar highlighting
  if (req.path === '/') res.locals.activePage = 'list';
  else if (req.path.startsWith('/add')) res.locals.activePage = 'add';
  else if (req.path.startsWith('/update')) res.locals.activePage = 'update';
  else res.locals.activePage = '';
  next();
});

// Async wrapper to reduce try/catch repetition
const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Routes

app.get('/', asyncHandler(async (req, res) => {
  const result = await getCollection().find().toArray();
  res.render("list", { result });
}));

app.get('/add', (req, res) => {
  res.render("add");
});

app.post('/add', asyncHandler(async (req, res) => {
  const { title, description } = req.body;
  if (!title?.trim() || !description?.trim()) {
    return res.status(400).send("Title and description are required");
  }

  const result = await getCollection().insertOne({ title: title.trim(), description: description.trim() });
  res.redirect(result.insertedId ? "/" : "/add");
}));

app.get('/update/:id', asyncHandler(async (req, res) => {
  const task = await getCollection().findOne({ _id: new ObjectId(req.params.id) });
  if (!task) return res.status(404).send("Task not found");
  res.render("update", { task });
}));

app.post('/update/:id', asyncHandler(async (req, res) => {
  const { title, description } = req.body;
  if (!title?.trim() || !description?.trim()) {
    return res.status(400).send("Title and description are required");
  }

  await getCollection().updateOne(
    { _id: new ObjectId(req.params.id) },
    { $set: { title: title.trim(), description: description.trim() } }
  );
  res.redirect('/');
}));

app.get('/task/:id', asyncHandler(async (req, res) => {
  const task = await getCollection().findOne({ _id: new ObjectId(req.params.id) });
  if (!task) return res.status(404).send("Task not found");
  res.render("task", { task });
}));

app.get('/delete/:id', asyncHandler(async (req, res) => {
  await getCollection().deleteOne({ _id: new ObjectId(req.params.id) });
  res.redirect('/');
}));

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).send('Internal Server Error');
});

// Start server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

