# Perl to Python Converter Web App

A simple web-based Perl to Python converter with:
- a browser UI
- a Node.js backend
- optional OpenAI API support
- a built-in fallback converter for local use

## Structure

- `public/` — HTML, CSS, and JavaScript for the web page
- `server.js` — backend server and conversion logic
- `.env.example` — sample environment variables

## Run locally

1. Install Node.js (18+ recommended)
2. Copy `.env.example` to `.env` and add your OpenAI key if you want OpenAI-powered conversions.
3. Run:

   npm install
   npm start

4. Open http://localhost:3000

## Notes

- If `OPENAI_API_KEY` is not set, the app runs with the built-in fallback converter.
- The fallback converter is intentionally simple and best for small math-style Perl snippets.
