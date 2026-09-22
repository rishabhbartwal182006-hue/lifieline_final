# MockDock — Comprehensive Codebase Audit & Fix Guide

This document provides an exhaustive breakdown of bugs, architectural bottlenecks, integration flaws, Groq LLM API problems, and code cleanliness issues discovered across the **MockDock** repository, along with detailed, actionable solutions and code fixes for each.

---

## Table of Contents

1. [High Priority / Breaking Bugs](#1-high-priority--breaking-bugs)
   - [1.1 Schema Validator Drops `"number"` Type (`db.py`)](#11-schema-validator-drops-number-type-dbpy)
   - [1.2 Invalid Default Groq LLM Model (`ai_schema.py`)](#12-invalid-default-groq-llm-model-ai_schemapy)
   - [1.3 Token Collision: Namespace Ownership vs. Mock Auth (`mock.py`)](#13-token-collision-namespace-ownership-vs-mock-auth-mockpy)
   - [1.4 Interceptor PUT and DELETE State Loss (`interceptor.py`)](#14-interceptor-put-and-delete-state-loss-interceptorpy)
   - [1.5 `render.yaml` Missing `DB_PATH` (Data Wiped on Every Restart)](#15-renderyaml-missing-db_path-data-wiped-on-every-restart)
   - [1.6 `requirements.txt` Encoded in UTF-16LE](#16-requirementstxt-encoded-in-utf-16le)
   - [1.7 Migration Script Crash (`scripts/migrate_schemas.py`)](#17-migration-script-crash-scriptsmigrate_schemaspy)
2. [Integration & Routing Issues](#2-integration--routing-issues)
   - [2.1 Single-Segment Route Matching Blocks Nested Routes (e.g., `/api/jobs`)](#21-single-segment-route-matching-blocks-nested-routes-eg-apijobs)
   - [2.2 Request Logger Fails on ID Routes, Reset Route, and Resource Names](#22-request-logger-fails-on-id-routes-reset-route-and-resource-names)
   - [2.3 Script Tag Interceptor Never Logs Requests to Dashboard](#23-script-tag-interceptor-never-logs-requests-to-dashboard)
   - [2.4 CORS OPTIONS Preflight Handled on Phantom Route](#24-cors-options-preflight-handled-on-phantom-route)
   - [2.5 Route Name Collision Risk (`/logs`, `/health`, `/records`)](#25-route-name-collision-risk-logs-health-records)
   - [2.6 Interceptor Fetch Override Breaks with `Request` Object](#26-interceptor-fetch-override-breaks-with-request-object)
3. [Groq LLM API Issues](#3-groq-llm-api-issues)
   - [3.1 Fragile Markdown Stripping & Lack of JSON Object Mode](#31-fragile-markdown-stripping--lack-of-json-object-mode)
   - [3.2 Array Generation Fallback & Parsing Fragility in `call_groq_records`](#32-array-generation-fallback--parsing-fragility-in-call_groq_records)
   - [3.3 Prompt Quality & Hardcoded Tokens/Timeouts](#33-prompt-quality--hardcoded-tokenstimeouts)
4. [Code Cleanliness, Duplication & Architectural Quality](#4-code-cleanliness-duplication--architectural-quality)
   - [4.1 Dead Code: `coerce_record()` in `create.py`](#41-dead-code-coerce_record-in-createpy)
   - [4.2 Duplicate Email Validation Implementations](#42-duplicate-email-validation-implementations)
   - [4.3 Mid-File Imports and Debug Print Statements in Production](#43-mid-file-imports-and-debug-print-statements-in-production)
   - [4.4 Redundant / Orphaned `static/index.html` vs `static/app.html`](#44-redundant--orphaned-staticindexhtml-vs-staticapphtml)
   - [4.5 Empty Nested `MOCKDOC/` Directory](#45-empty-nested-mockdoc-directory)
   - [4.6 Database Connection Management & Concurrency](#46-database-connection-management--concurrency)
   - [4.7 Untyped & Monolithic Frontend (`static/script.js`)](#47-untyped--monolithic-frontend-staticscriptjs)
5. [Summary Checklist & Roadmap](#5-summary-checklist--roadmap)

---

## 1. High Priority / Breaking Bugs

### 1.1 Schema Validator Drops `"number"` Type (`db.py`)

- **Location:** [`db.py:L413-L465`](file:///c:/Users/SAHIL/Desktop/MOCKDOC/db.py#L413-L465)
- **Problem:** 
  The schema normalizer allows fields with type `"number"`, and `VALID_TYPES` in `routes/create.py` accepts `"number"`. However, the recursive `validate()` function in `db.py` only implements handlers for:
  - `"object"`
  - `"array"`
  - `"string"`
  - `"integer"`
  - `"boolean"`
  
  There is **no** `if t == "number":` check. If any field has type `"number"` (e.g. `salary: number` in the test job board or `amount: number` in the expense tracker), `validate()` reaches the catch-all line 464:
  ```python
  return False, f'{".".join(path)}: unsupported type "{t}"'
  ```
  This causes any resource creation or record creation with floating point/decimal numbers to fail with:
  `salary: unsupported type "number"`.
- **How to Fix:**
  In [`db.py`](file:///c:/Users/SAHIL/Desktop/MOCKDOC/db.py), add validation for `number` (which in JSON/Python can be `int` or `float`, but not `bool`):
  ```python
  if t == "number":
      if not isinstance(data, (int, float)) or isinstance(data, bool):
          return False, f'{".".join(path)}: expected number'
      return True, None
  ```

---

### 1.2 Invalid Default Groq LLM Model (`ai_schema.py`)

- **Location:** [`routes/ai_schema.py:L11-L15`](file:///c:/Users/SAHIL/Desktop/MOCKDOC/routes/ai_schema.py#L11-L15)
- **Problem:**
  The fallback model is set to:
  ```python
  GROQ_MODEL = os.environ.get("GROQ_MODEL", "openai/gpt-oss-20b").strip()
  ```
  `openai/gpt-oss-20b` does not exist on Groq! Groq is an inference provider for open weights models like Meta LLaMA and Mistral. Calling Groq's API with `openai/gpt-oss-20b` returns an HTTP 400/404 error ("model not found").
  The README explicitly advertises **LLaMA 3.3 70B** (`llama-3.3-70b-versatile`).
- **How to Fix:**
  Change the fallback default model to `llama-3.3-70b-versatile` (or `llama-3.1-8b-instant` for lower latency/cost):
  ```python
  GROQ_MODEL = os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile").strip()
  ```

---

### 1.3 Token Collision: Namespace Ownership vs. Mock Auth (`mock.py`)

- **Location:** [`routes/mock.py:L40-L77`](file:///c:/Users/SAHIL/Desktop/MOCKDOC/routes/mock.py#L40-L77), [`routes/mock.py:L135-L146`](file:///c:/Users/SAHIL/Desktop/MOCKDOC/routes/mock.py#L135-L146)
- **Problem:**
  On write operations (`POST`, `PUT`, `DELETE`), `mock.py` performs **both**:
  1. `check_ownership(ns)`: Demands `Authorization: Bearer <namespace_token>`
  2. `check_auth(slug, route_path)`: Demands `Authorization: Bearer <auth_config_token>` for protected routes.
  
  Because both checks inspect the exact same HTTP header (`Authorization: Bearer ...`):
  - If a user sends the mock auth token, `check_ownership` fails with:
    `"unauthorized: invalid namespace token"`.
  - If a user sends the namespace ownership token, `check_auth` fails with:
    `"unauthorized"`.
  - Furthermore, for regular public mock APIs (no auth), external clients (curl, Postman, mobile apps, tests) cannot `POST` without having the internal platform ownership token, defeating the purpose of a public mock API.
- **How to Fix:**
  1. Separate administrative actions from mock API simulation.
  2. If platform ownership is needed, use a dedicated custom header:
     `X-MockDock-Token: <namespace_token>` or `X-Namespace-Token: <token>`.
  3. Reserve standard `Authorization: Bearer <token>` exclusively for simulated mock authentication (`check_auth`).
  4. Only require `check_ownership` on administrative endpoints (e.g. `DELETE /<slug>/<resource>/records` or editing resource definitions), not on ordinary mock data CRUD.

---

### 1.4 Interceptor PUT and DELETE State Loss (`interceptor.py`)

- **Location:** [`routes/interceptor.py:L189-L234`](file:///c:/Users/SAHIL/Desktop/MOCKDOC/routes/interceptor.py#L189-L234)
- **Problem:**
  In the client-side generated script:
  - `POST` appends new items to `_sessionRecords[path]`.
  - `PUT` creates a fake response with `putBody`, but **never modifies** `_sessionRecords` or `_routeMap[matchedBase].records`.
  - `DELETE` creates a fake response `{"deleted": true}`, but **never removes** the record from `_sessionRecords` or `_routeMap[matchedBase].records`.
  
  As seen in [`test1_job_board.html`](file:///c:/Users/SAHIL/Desktop/MOCKDOC/test%20file/test1_job_board.html), editing a job or deleting a job appears to work momentarily, but when the app immediately re-fetches `GET /api/jobs`, the deleted record is still there, and the updated record is reverted to its original values!
- **How to Fix:**
  In `build_interceptor_js()`:
  Maintain a single mutable record store per route:
  ```javascript
  // Initialize working store
  var _recordsStore = {};
  for (var r in _routeMap) {
    _recordsStore[r] = (_routeMap[r].records || []).slice();
  }
  ```
  - On `GET`: return `_recordsStore[path].slice()`
  - On `POST`: `_recordsStore[path].push(body)`
  - On `PUT`: find record index by `id` (checking both string and integer matching) and update in `_recordsStore[matchedBase]`.
  - On `DELETE`: filter out the item with matching `id` from `_recordsStore[matchedBase]`.

---

### 1.5 `render.yaml` Missing `DB_PATH` (Data Wiped on Every Restart)

- **Location:** [`render.yaml:L8-L11`](file:///c:/Users/SAHIL/Desktop/MOCKDOC/render.yaml#L8-L11) vs [`db.py:L6`](file:///c:/Users/SAHIL/Desktop/MOCKDOC/db.py#L6)
- **Problem:**
  `render.yaml` provisions a persistent disk at `/var/data`:
  ```yaml
  disks:
    - name: data
      mountPath: /var/data
      sizeGB: 1
  ```
  However, `render.yaml` does **not** specify `envVars` setting `DB_PATH=/var/data/mockdock.db`.
  As a result, `db.py` defaults to:
  ```python
  DB_PATH = os.environ.get("DB_PATH", os.path.join(os.path.dirname(__file__), "mockdock.db"))
  ```
  The database is written to the ephemeral app container filesystem instead of the mounted persistent disk. Every deployment, server restart, or container sleep permanently wipes all user namespaces and test data!
- **How to Fix:**
  Add the environment variable to [`render.yaml`](file:///c:/Users/SAHIL/Desktop/MOCKDOC/render.yaml):
  ```yaml
  services:
    - type: web
      name: mockdock
      env: python
      buildCommand: pip install -r requirements.txt
      startCommand: gunicorn app:app
      envVars:
        - key: DB_PATH
          value: /var/data/mockdock.db
        - key: GROQ_MODEL
          value: llama-3.3-70b-versatile
      disks:
        - name: data
          mountPath: /var/data
          sizeGB: 1
  ```

---

### 1.6 `requirements.txt` Encoded in UTF-16LE

- **Location:** [`requirements.txt`](file:///c:/Users/SAHIL/Desktop/MOCKDOC/requirements.txt)
- **Problem:**
  `requirements.txt` is encoded with a Byte Order Mark in **UTF-16LE**.
  Standard Linux environments, Docker, and certain CI/CD pipelines fail when `pip install -r requirements.txt` is executed against UTF-16 files (throwing null byte / syntax errors).
- **How to Fix:**
  Re-save `requirements.txt` as standard **UTF-8 (without BOM)** with Unix (`\n`) or Windows (`\r\n`) newlines.

---

### 1.7 Migration Script Crash (`scripts/migrate_schemas.py`)

- **Location:** [`scripts/migrate_schemas.py:L18-L20`](file:///c:/Users/SAHIL/Desktop/MOCKDOC/scripts/migrate_schemas.py#L18-L20)
- **Problem:**
  The script attempts to import `db.py` by adding its own directory to `sys.path`:
  ```python
  sys.path.insert(0, os.path.dirname(__file__))
  from db import get_connection, normalize_schema
  ```
  Since `migrate_schemas.py` is in `scripts/`, `os.path.dirname(__file__)` is `.../scripts`. `db.py` lives in the parent directory. Running `python scripts/migrate_schemas.py` crashes with:
  `ModuleNotFoundError: No module named 'db'`.
- **How to Fix:**
  Point `sys.path` to the parent directory:
  ```python
  sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
  ```

---

## 2. Integration & Routing Issues

### 2.1 Single-Segment Route Matching Blocks Nested Routes (e.g., `/api/jobs`)

- **Location:** [`routes/mock.py:L84, L103, L126, L169, L213, L242`](file:///c:/Users/SAHIL/Desktop/MOCKDOC/routes/mock.py)
- **Problem:**
  Routes are registered with:
  ```python
  @mock_bp.route("/<slug>/<resource_name>", methods=["GET"])
  ```
  In Flask, `<resource_name>` matches a single path string without slashes (`/`).
  If a user defines a resource route path as `/api/jobs` or `/v1/users`, calling `GET /myteam/api/jobs` returns a 404 from Flask because `/api/jobs` has two segments.
- **How to Fix:**
  Use Flask's `path` converter for the resource route:
  ```python
  @mock_bp.route("/<slug>/<path:resource_name>", methods=["GET"])
  @mock_bp.route("/<slug>/<path:resource_path>/<int:record_id>", methods=["GET"])
  ```
  Ensure route precedence does not collide with reserved endpoints like `/<slug>/logs` or `/<slug>/health`.

---

### 2.2 Request Logger Fails on ID Routes, Reset Route, and Resource Names

- **Location:** [`middleware/request_logger.py:L21-L29`](file:///c:/Users/SAHIL/Desktop/MOCKDOC/middleware/request_logger.py#L21-L29)
- **Problem:**
  The logger middleware checks:
  ```python
  segments = [segment for segment in path.split("/") if segment]
  if len(segments) != 2:
      return response
  ```
  - When a user performs `GET /myteam/jobs/1`, `PUT /myteam/jobs/1`, or `DELETE /myteam/jobs/1`, `len(segments)` is 3. **None of these requests are ever logged!**
  - Reset records (`DELETE /myteam/jobs/records`) has 3 segments. It is never logged.
  - The middleware calls `get_resource_by_name(namespace_slug, resource_name)`. If the resource name is "Job Board" and the route path is "/jobs", `get_resource_by_name` returns `None` and nothing is logged.
- **How to Fix:**
  Use `get_resource_by_route()` instead of `get_resource_by_name()`, and parse the route matching dynamically:
  ```python
  # Check if last segment is an integer record_id
  if len(segments) >= 3 and segments[-1].isdigit():
      route_segment = "/" + "/".join(segments[1:-1])
  else:
      route_segment = "/" + "/".join(segments[1:])
  ```

---

### 2.3 Script Tag Interceptor Never Logs Requests to Dashboard

- **Location:** [`routes/interceptor.py`](file:///c:/Users/SAHIL/Desktop/MOCKDOC/routes/interceptor.py)
- **Problem:**
  The MockDock dashboard includes an auto-refreshing "Request Logs" table and a "Health Status" indicator for each resource.
  However, the interceptor script runs purely inside client-side `window.fetch`. It never sends telemetry or log pings back to MockDock. As a result, developers using the script tag always see:
  - "No requests logged yet"
  - Health indicator permanently Red (because no requests exist in the `logs` table).
- **How to Fix:**
  In `build_interceptor_js()`, add an asynchronous non-blocking log beacon (e.g. using `navigator.sendBeacon` or fire-and-forget `_originalFetch('/api/logs/ingest', ...)`):
  ```javascript
  function _logRequest(method, route, status, duration) {
    try {
      var logUrl = '/* MOCKDOCK_HOST *//api/logs/beacon';
      navigator.sendBeacon(logUrl, JSON.stringify({
        namespace: '/* SLUG */',
        route: route,
        method: method,
        status_code: status,
        response_time_ms: duration
      }));
    } catch(e) {}
  }
  ```

---

### 2.4 CORS OPTIONS Preflight Handled on Phantom Route

- **Location:** [`app.py:L27-L29`](file:///c:/Users/SAHIL/Desktop/MOCKDOC/app.py#L27-L29)
- **Problem:**
  `app.py` has:
  ```python
  @app.route("/options-handler", methods=["OPTIONS"])
  def options_handler():
      return "", 204
  ```
  Browsers making cross-origin requests do **not** send preflight OPTIONS requests to `/options-handler`. They send OPTIONS to the exact target endpoint (e.g. `OPTIONS /myteam/jobs`). If the target route does not permit `OPTIONS`, Flask can return `405 Method Not Allowed`.
- **How to Fix:**
  Use `flask-cors` (standard) or register a global `@app.before_request` handler for `OPTIONS` requests:
  ```python
  @app.before_request
  def handle_options_preflight():
      if request.method == "OPTIONS":
          response = app.make_default_options_response()
          response.headers["Access-Control-Allow-Origin"] = "*"
          response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
          response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-MockDock-Token"
          return response
  ```

---

### 2.5 Route Name Collision Risk (`/logs`, `/health`, `/records`)

- **Location:** [`routes/logs.py`](file:///c:/Users/SAHIL/Desktop/MOCKDOC/routes/logs.py), [`routes/mock.py`](file:///c:/Users/SAHIL/Desktop/MOCKDOC/routes/mock.py)
- **Problem:**
  `/<slug>/logs` and `/<slug>/health` are reserved for internal endpoints. If a user creates a resource named `logs` or `health`, the mock endpoints will be shadowed by the platform endpoints.
  Likewise, `DELETE /<slug>/<resource>/records` conflicts if a record ID happens to be the string `"records"`.
- **How to Fix:**
  Prefix platform monitoring endpoints with `/api/`, e.g. `/api/<slug>/logs` and `/api/<slug>/health`, leaving the root namespace `/<slug>/...` purely for mock resources.

---

### 2.6 Interceptor Fetch Override Breaks with `Request` Object

- **Location:** [`routes/interceptor.py:L146-L149`](file:///c:/Users/SAHIL/Desktop/MOCKDOC/routes/interceptor.py#L146-L149)
- **Problem:**
  ```javascript
  window.fetch = function(input, init) {
    var url = (typeof input === 'string') ? input : input.url;
    var method = ((init && init.method) || 'GET').toUpperCase();
  ```
  If a frontend uses modern Fetch syntax passing a `Request` instance (`fetch(new Request('/api/jobs', { method: 'POST', body: ... }))`), `init` is undefined. The interceptor defaults `method` to `'GET'` and fails to read the request body or headers.
- **How to Fix:**
  Extract properties from `input` when `input` is an `instanceof Request`:
  ```javascript
  var url = (typeof input === 'string') ? input : input.url;
  var method = ((init && init.method) || (input && input.method) || 'GET').toUpperCase();
  ```

---

## 3. Groq LLM API Issues

### 3.1 Fragile Markdown Stripping & Lack of JSON Object Mode

- **Location:** [`routes/ai_schema.py:L68-L75`](file:///c:/Users/SAHIL/Desktop/MOCKDOC/routes/ai_schema.py#L68-L75)
- **Problem:**
  ```python
  # Strip any accidental markdown fences
  if raw_text.startswith("```"):
      lines = raw_text.splitlines()
      raw_text = "\n".join(
          line for line in lines if not line.startswith("```")
      ).strip()

  schema = json.loads(raw_text)
  ```
  If the LLM outputs conversational preamble before the markdown code fence (e.g. *"Sure! Here is your schema:\n```json\n{...}\n```"*), `raw_text.startswith("```")` is **False**. The markdown fence is not stripped, and `json.loads` immediately crashes with `json.JSONDecodeError` returning a 502 error to the frontend.
- **How to Fix:**
  1. Leverage Groq's native JSON Mode in the API request payload:
     ```python
     "response_format": {"type": "json_object"}
     ```
  2. Implement robust regex extraction that locates the outer `{...}` JSON block:
     ```python
     import re
     match = re.search(r"(\{.*\})", raw_text, re.DOTALL)
     if match:
         raw_text = match.group(1)
     ```

---

### 3.2 Array Generation Fallback & Parsing Fragility in `call_groq_records`

- **Location:** [`routes/ai_schema.py:L101-L150`](file:///c:/Users/SAHIL/Desktop/MOCKDOC/routes/ai_schema.py#L101-L150)
- **Problem:**
  `call_groq_records` asks the model for a JSON array `[...]`. Groq's `"response_format": {"type": "json_object"}` requires the root to be a JSON object, so `call_groq_records` avoids it. Without JSON mode, models frequently output intro text, markdown backticks, or trailing explanations, leading to decoding failures.
- **How to Fix:**
  Ask the model to return a root object: `{"records": [...]}` and enable `"response_format": {"type": "json_object"}`. Then simply extract `data["records"]`.

---

### 3.3 Prompt Quality & Hardcoded Tokens/Timeouts

- **Location:** [`routes/ai_schema.py:L17-L35`](file:///c:/Users/SAHIL/Desktop/MOCKDOC/routes/ai_schema.py#L17-L35)
- **Problem:**
  - The system prompt contains garbled phrasing:
    `JSON inside JSON is not applicable at all cost ,(no markdown, no explanation)`
  - Hardcoded low token limits (`max_tokens: 512`) can truncate complex schemas with multiple nested fields or enums, causing half-finished JSON strings that fail parsing.
- **How to Fix:**
  - Clean up the prompt to professional, concise instructions.
  - Increase `max_tokens` to `1024` for schemas and `2048` for records.

---

## 4. Code Cleanliness, Duplication & Architectural Quality

### 4.1 Dead Code: `coerce_record()` in `create.py`

- **Location:** [`routes/create.py:L110-L143`](file:///c:/Users/SAHIL/Desktop/MOCKDOC/routes/create.py#L110-L143)
- **Problem:**
  `coerce_record` is an 33-line function with custom type coercion for strings, integers, numbers, booleans, enums, and emails.
  It is **never called anywhere** in the application. In `routes/create.py:L164-L168`, records are validated using `validate(record, normalized)` from `db.py`, leaving `coerce_record` as unmaintained dead code.
- **How to Fix:**
  Remove the unused `coerce_record()` function to prevent confusion.

---

### 4.2 Duplicate Email Validation Implementations

- **Location:** [`routes/create.py:L103-L108`](file:///c:/Users/SAHIL/Desktop/MOCKDOC/routes/create.py#L103-L108) vs [`db.py:L447-L449`](file:///c:/Users/SAHIL/Desktop/MOCKDOC/db.py#L447-L449)
- **Problem:**
  - `create.py` checks: `isinstance(value, str) and "@" in value and "." in value.partition("@")[2]`.
  - `db.py` checks: `re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", data)`.
  - Having diverging ad-hoc validation logic creates inconsistent behavior.
- **How to Fix:**
  Consolidate all type and format validators into a single utility in `db.py` (or a dedicated `validators.py`).

---

### 4.3 Mid-File Imports and Debug Print Statements in Production

- **Location:** 
  - [`routes/namespace.py:L15-L17`](file:///c:/Users/SAHIL/Desktop/MOCKDOC/routes/namespace.py#L15-L17)
  - [`app.py:L33-L38`](file:///c:/Users/SAHIL/Desktop/MOCKDOC/app.py#L33-L38)
  - [`app.py:L61-L62`](file:///c:/Users/SAHIL/Desktop/MOCKDOC/app.py#L61-L62)
- **Problem:**
  - `routes/namespace.py` has imports (`from db import ...`, `import json`, `from flask import request`) in the middle of the file between route declarations.
  - `app.py` has blueprint imports halfway down the file.
  - `app.py:L62` has `print("ENV CHECK:", os.environ.get("GROQ_API_KEY"))` which can leak secret keys or clutter logs.
- **How to Fix:**
  - Follow PEP 8: Place all imports at the top of the file.
  - Remove debug prints and replace them with standard Python `logging`.

---

### 4.4 Redundant / Orphaned `static/index.html` vs `static/app.html`

- **Location:** [`static/index.html`](file:///c:/Users/SAHIL/Desktop/MOCKDOC/static/index.html) vs [`static/app.html`](file:///c:/Users/SAHIL/Desktop/MOCKDOC/static/app.html)
- **Problem:**
  `static/index.html` is an obsolete 33KB alternate app interface (featuring Three.js and custom cursors) that is no longer routed. `app.py` serves `landing.html` on `/` and `app.html` on `/app`.
  However, `README.md` refers to `index.html` as the App builder interface.
- **How to Fix:**
  Remove or archive `static/index.html` and update `README.md` to reference `app.html`.

---

### 4.5 Empty Nested `MOCKDOC/` Directory

- **Location:** `c:\Users\SAHIL\Desktop\MOCKDOC\MOCKDOC`
- **Problem:**
  There is an empty folder named `MOCKDOC` inside the root workspace repository from an accidental folder creation during clone or zip extraction.
- **How to Fix:**
  Delete the empty directory.

---

### 4.6 Database Connection Management & Concurrency

- **Location:** [`db.py`](file:///c:/Users/SAHIL/Desktop/MOCKDOC/db.py)
- **Problem:**
  - Every single query function in `db.py` opens a new connection (`sqlite3.connect(DB_PATH)`) and closes it immediately.
  - In a multi-worker production environment (e.g. `gunicorn app:app`), SQLite can throw `sqlite3.OperationalError: database is locked` during concurrent writes because write transactions are not configured with a busy timeout or WAL (Write-Ahead Logging) mode.
- **How to Fix:**
  In `get_connection()`:
  ```python
  def get_connection():
      conn = sqlite3.connect(DB_PATH, timeout=30.0)
      conn.execute("PRAGMA journal_mode = WAL;")
      conn.execute("PRAGMA synchronous = NORMAL;")
      conn.row_factory = sqlite3.Row
      return conn
  ```

---

### 4.7 Untyped & Monolithic Frontend (`static/script.js`)

- **Location:** [`static/script.js`](file:///c:/Users/SAHIL/Desktop/MOCKDOC/static/script.js)
- **Problem:**
  `script.js` is 1,776 lines long and mixes state management, DOM manipulation, polling, draft persistence, AI generation, and curl generation.
  - Uses `alert()` instead of standard toast notifications when in Viewer Mode.
  - In `buildCurl()`, lines 1136-1140 inject `-H "Authorization: Bearer <nsToken>"` for `POST`/`PUT`/`DELETE`, but inject `-H "Authorization: Bearer <mockAuthToken>"` for `GET`, creating mismatched curl documentation.
- **How to Fix:**
  - Replace `alert()` calls with `showToast(...)`.
  - Fix `buildCurl()` to consistently use the appropriate mock authorization header and keep platform tokens separated.

---

## 5. Summary Checklist & Roadmap

| Category | Issue | Impact | Difficulty |
|---|---|---|---|
---

### Issue 12: 5-Step Wizard State Desynchronization and Premature Advancement
- **Category:** Integration / Frontend UX
- **Severity:** 🔴 Critical
- **Symptoms:**
  - In the 5-step wizard UI, advancing from Step 3 (Schema & Auth) to Step 4 (Seed Records) did not populate `state.resources`.
  - When clicking "Generate Mock API", `/api/create` was called with an empty `resources: []` array, returning HTTP `400 "resources must be a non-empty array"`.
  - `wizSubmit()` prematurely executed `setTimeout(() => wizShow(5), 400)`, forcing the user onto Step 5 even on failure.
  - Step 5 cards remained frozen with "Waiting for generate…", "EXPIRED", and empty script tag.
  - `populateMethodCards()` was hooked to a non-existent `window.fillOutputPanel` instead of `window.renderOutput`.
- **Root Cause:**
  - `wizGoToStep4()` in [`static/app.html`](file:///c:/Users/SAHIL/Desktop/MOCKDOC/static/app.html) did not invoke resource serialization or `buildStep2()`.
  - Class name mismatches (`.endpoint-method` vs `.method-badge`) prevented dynamic extraction of endpoint URLs and cURL snippets.
- **Fix Applied:**
  1. Updated `wizGoToStep4()` to extract inputs, validate JSON schema, set `state.resources`, synchronize `state.auth`, and call `buildStep2()`.
  2. Pre-filled seed record textareas with valid sample records in `buildStep2()`, with fallback support in `getRecordsForIndex()`.
  3. Added defense-in-depth resource reconstruction in `submitCreate()` in [`static/script.js`](file:///c:/Users/SAHIL/Desktop/MOCKDOC/static/script.js).
  4. Changed `wizSubmit()` to wait for API resolution; only advance to Step 5 on HTTP 200 via `renderOutput()`.
  5. Hooked `populateMethodCards()` into `renderOutput()` and supported both `.endpoint-method` and `.method-badge` DOM selectors.

---

## Complete Issues Summary Matrix

| Issue Area | Problem | Severity | Effort |
| :--- | :--- | :--- | :--- |
| **Core Bug** | Missing `"number"` validation in `db.py` | 🔴 Critical (All numeric fields rejected) | Easy |
| **LLM API** | Invalid default model `openai/gpt-oss-20b` | 🔴 Critical (AI features fail by default) | Easy |
| **Integration** | Auth header clash (`check_ownership` vs `check_auth`) | 🔴 Critical (Protected writes impossible) | Medium |
| **Integration** | Interceptor PUT & DELETE not modifying state | 🔴 Critical (Simulated edits/deletions lost) | Medium |
| **Integration** | Wizard state desync (`resources: []` 400 error on `/api/create`) | 🔴 Critical (Stuck on generate screen) | Easy |
| **Deployment** | `render.yaml` missing `DB_PATH` | 🟠 High (Data wiped on every restart) | Easy |
| **Package** | `requirements.txt` encoded in UTF-16LE | 🟠 High (Deployment failures on Linux) | Easy |
| **Routing** | Single segment `<resource_name>` blocking `/api/jobs` | 🟠 High (Direct API 404s for common routes) | Medium |
| **Logging** | Logger middleware missing ID routes & resource routes | 🟡 Medium (Incomplete dashboard logs) | Medium |
| **LLM API** | Markdown stripping failing on conversational text | 🟡 Medium (Random 502 Bad Gateway from AI) | Easy |
| **Tooling** | `scripts/migrate_schemas.py` sys.path crash | 🟡 Medium (Migration script unusable) | Easy |
| **Cleanliness** | Dead code, debug prints, misplaced imports, orphaned files | 🟢 Low (Maintainability & code hygiene) | Easy |

---

*Generated for the MockDock project repository.*

