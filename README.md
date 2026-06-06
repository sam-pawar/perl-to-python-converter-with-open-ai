# Perl to Python Converter Web App

A web-based Perl to Python converter with:
- a browser UI
- a Node.js backend
- optional OpenAI API support
- a built-in fallback converter for small Perl snippets

## Structure

- `public/` — frontend assets (`index.html`, `styles.css`, `app.js`)
- `server.js` — backend server and conversion logic
- `.env.example` — sample environment variables
- `test/` — unit tests for the built-in converter

## Requirements

- Node.js 18 or later

## Setup

1. Install dependencies:

   npm install

2. Copy `.env.example` to `.env` and add your OpenAI key if you want OpenAI-powered conversions.

3. Start the app:

   npm start

4. For development with hot reload:

   npm run dev

5. Open http://localhost:3000

## Testing

Run the built-in converter tests with:

```bash
npm test
```

## Notes

- If `OPENAI_API_KEY` is not set or OpenAI conversion fails, the app uses the built-in fallback converter.
- The fallback converter is intentionally simple and best for short Perl examples. It does not cover full Perl syntax, arrays, hashes, or regex-heavy code.
- The backend now uses Express for safer static file serving, JSON parsing, and route handling.
