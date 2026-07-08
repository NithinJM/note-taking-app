# NoteFlow

NoteFlow is a full-stack note-taking app built with Node.js, Express, MongoDB, Mongoose, JWT authentication, and a vanilla HTML/CSS/JavaScript front end.

Each user has a private note collection. Authenticated users can create, read, update, pin, archive, search, tag, and delete only their own notes.

## Features

- Email/password registration and login
- JWT-protected API routes
- MongoDB persistence with Mongoose models
- User-scoped note CRUD
- Server-side validation with clear error responses
- Responsive front-end interface
- Search, filters, tags, pinning, and archive controls

## Project Structure

```text
config/
  db.js
controllers/
  authController.js
  noteController.js
middleware/
  authMiddleware.js
  errorMiddleware.js
models/
  Note.js
  User.js
public/
  index.html
  script.js
  styles.css
routes/
  authRoutes.js
  noteRoutes.js
server.js
```

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Create a `.env` file from the example:

```bash
cp .env.example .env
```

3. Update `.env`:

```env
JWT_SECRET=replace-with-a-long-random-secret
MONGODB_URI=mongodb://127.0.0.1:27017/noteflow
PORT=3000
```

4. Start MongoDB locally, or replace `MONGODB_URI` with your MongoDB Atlas connection string.

5. Run the app:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Authentication

Send the returned token as a bearer token for protected endpoints:

```http
Authorization: Bearer <token>
```

## API Endpoints

### Register

`POST /api/auth/register`

Request:

```json
{
  "name": "Nithi",
  "email": "nithi@example.com",
  "password": "password123"
}
```

Response `201`:

```json
{
  "token": "jwt-token",
  "user": {
    "name": "Nithi",
    "email": "nithi@example.com",
    "id": "user-id"
  }
}
```

### Login

`POST /api/auth/login`

Request:

```json
{
  "email": "nithi@example.com",
  "password": "password123"
}
```

Response `200`:

```json
{
  "token": "jwt-token",
  "user": {
    "name": "Nithi",
    "email": "nithi@example.com",
    "id": "user-id"
  }
}
```

### Current User

`GET /api/auth/me`

Response `200`:

```json
{
  "user": {
    "name": "Nithi",
    "email": "nithi@example.com",
    "id": "user-id"
  }
}
```

### List Notes

`GET /api/notes`

Response `200`:

```json
[
  {
    "id": "note-id",
    "title": "Project ideas",
    "content": "Build a note taking app.",
    "category": "School",
    "tags": ["assignment", "express"],
    "isPinned": true,
    "isArchived": false,
    "user": "user-id",
    "createdAt": "2026-07-08T18:00:00.000Z",
    "updatedAt": "2026-07-08T18:00:00.000Z"
  }
]
```

### Get One Note

`GET /api/notes/:id`

Returns `404` if the note does not exist or does not belong to the signed-in user.

### Create Note

`POST /api/notes`

Request:

```json
{
  "title": "Project ideas",
  "content": "Build a note taking app.",
  "category": "School",
  "tags": ["assignment", "express"],
  "isPinned": true,
  "isArchived": false
}
```

Response `201`: the created note.

### Update Note

`PUT /api/notes/:id`

Request:

```json
{
  "title": "Updated title",
  "content": "Updated content",
  "category": "School",
  "tags": ["mongodb"],
  "isPinned": false,
  "isArchived": false
}
```

Response `200`: the updated note.

### Delete Note

`DELETE /api/notes/:id`

Response `200`:

```json
{
  "message": "Note deleted"
}
```

## Validation and Errors

Validation errors return status `400`:

```json
{
  "message": "Password must be at least 8 characters",
  "errors": ["Password must be at least 8 characters"]
}
```

Common statuses:

- `400`: invalid input or invalid note id
- `401`: missing, invalid, or expired token
- `404`: route or note not found
- `500`: server or configuration error
