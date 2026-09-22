const HprAuthToken = require('../models/HprAuthToken');
const { isMongoConnected, memoryStore } = require('../config/db');

/**
 * The openapi spec declares `security: [bearerAuth: []]` globally (everything
 * except POST /auth/staff-login). Rather than stand up a second auth/token
 * system, this reuses the same HprAuthToken store that /api/v1/hpr/login
 * already issues tokens into — so a token obtained from EITHER /api/v1/hpr/login
 * or /api/v1/auth/staff-login works for every /api/v1/sessions/* route.
 *
 * DEMO NOTE: if no HPR tokens have ever been issued (fresh in-memory store,
 * nothing in Mongo yet), auth is left open so the kiosk flow (create session,
 * submit intake, etc.) isn't blocked before any staff member has logged in.
 * Once at least one token exists, it's enforced normally. Tighten this before
 * any real deployment — it's a hackathon-demo convenience, not a security model.
 */
async function requireBearerToken(req, res, next) {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

    const anyTokenExists = isMongoConnected()
      ? !!(await HprAuthToken.findOne({ status: 'ACTIVE' }))
      : (await memoryStore.find('HprAuthToken', { status: 'ACTIVE' })).length > 0;

    if (!anyTokenExists) {
      return next(); // demo mode — see note above
    }

    if (!token) {
      return res.status(401).json({ code: 'UNAUTHORIZED', message: 'Bearer token required. Obtain one via POST /api/v1/auth/staff-login.' });
    }

    const tokenDoc = isMongoConnected()
      ? await HprAuthToken.findOne({ token, status: 'ACTIVE' })
      : await memoryStore.findOne('HprAuthToken', { token, status: 'ACTIVE' });

    if (!tokenDoc || (tokenDoc.expiresAt && new Date(tokenDoc.expiresAt) < new Date())) {
      return res.status(401).json({ code: 'UNAUTHORIZED', message: 'Invalid or expired bearer token.' });
    }

    req.staff = tokenDoc;
    return next();
  } catch (err) {
    return res.status(500).json({ code: 'AUTH_CHECK_FAILED', message: err.message });
  }
}

module.exports = { requireBearerToken };
