const HprAuthToken = require('../models/HprAuthToken');
const AuditLog = require('../models/AuditLog');
const { isMongoConnected, memoryStore } = require('../config/db');

/**
 * Security Gatekeeper: HPR Biometric Write-Lock Middleware
 * Enforces HPR authentication before allowing writes to permanent hospital database / ABDM network.
 */
const hprAuthMiddleware = async (req, res, next) => {
  try {
    // 1. Extract HPR Token from Header or Body
    const authHeader = req.headers['authorization'];
    const hprTokenHeader = req.headers['x-hpr-token'];
    
    let token = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (hprTokenHeader) {
      token = hprTokenHeader;
    } else if (req.body && req.body.hprToken) {
      token = req.body.hprToken;
    }

    if (!token) {
      // Audit log failed authorization attempt
      await logSecurityAudit('HPR_AUTH_FAILED', req, null, 'Missing HPR authentication bearer token');
      return res.status(401).json({
        success: false,
        error: "HPR_TOKEN_MISSING",
        message: "HPR Biometric Write-Lock Enforcement: Access Denied. Valid Healthcare Professional Registry (HPR) token is required to commit records."
      });
    }

    // 2. Fetch HPR Token record
    let doctorRecord = null;
    if (isMongoConnected()) {
      doctorRecord = await HprAuthToken.findOne({ token });
    } else {
      doctorRecord = await memoryStore.findOne('HprAuthToken', { token });
    }

    if (!doctorRecord) {
      await logSecurityAudit('HPR_AUTH_FAILED', req, null, 'Invalid or unrecognized HPR token token string');
      return res.status(401).json({
        success: false,
        error: "INVALID_HPR_TOKEN",
        message: "HPR Write-Lock Violation: Provided token does not match any active Healthcare Professional credentials in ABDM registry."
      });
    }

    // 3. Expiration & Status Check
    if (doctorRecord.status !== 'ACTIVE') {
      await logSecurityAudit('HPR_AUTH_FAILED', req, doctorRecord.hprId, `HPR Token status is ${doctorRecord.status}`);
      return res.status(403).json({
        success: false,
        error: "HPR_TOKEN_INACTIVE",
        message: `HPR Write-Lock Violation: HPR credential is ${doctorRecord.status}. Cannot process clinical write operation.`
      });
    }

    if (new Date(doctorRecord.expiresAt) < new Date()) {
      await logSecurityAudit('HPR_AUTH_FAILED', req, doctorRecord.hprId, 'HPR Token has expired');
      return res.status(403).json({
        success: false,
        error: "HPR_TOKEN_EXPIRED",
        message: "HPR Write-Lock Violation: HPR session token has expired. Re-authentication with biometric token required."
      });
    }

    // 4. Biometric Verification Gate
    if (!doctorRecord.biometricVerified) {
      await logSecurityAudit('HPR_AUTH_FAILED', req, doctorRecord.hprId, 'Biometric verification pending');
      return res.status(403).json({
        success: false,
        error: "BIOMETRIC_UNVERIFIED",
        message: "HPR Write-Lock Security: Biometric authentication missing. Healthcare professional must complete biometric sign-off."
      });
    }

    // Attach verified HPR practitioner to request context
    req.hprUser = {
      hprId: doctorRecord.hprId,
      doctorName: doctorRecord.doctorName,
      registrationNumber: doctorRecord.registrationNumber,
      stateCouncil: doctorRecord.stateCouncil || 'National Medical Commission',
      role: doctorRecord.role,
      token: doctorRecord.token
    };

    await logSecurityAudit('HPR_AUTH_SUCCESS', req, doctorRecord.hprId, 'HPR Biometric Write-Lock Gate Authorized');
    next();

  } catch (err) {
    console.error(`[HPR Auth Middleware Error]: ${err.message}`);
    return res.status(500).json({
      success: false,
      error: "HPR_AUTH_INTERNAL_ERROR",
      message: "Internal security engine error during HPR validation."
    });
  }
};

async function logSecurityAudit(action, req, hprId, reason) {
  const logId = `AUDIT-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
  const auditData = {
    logId,
    action,
    intakeId: req.body?.intakeId || req.params?.id || null,
    performedBy: hprId ? `HPR:${hprId}` : 'ANONYMOUS_CLIENT',
    hprId: hprId || null,
    ipAddress: req.ip || req.connection?.remoteAddress || '127.0.0.1',
    details: { reason, path: req.originalUrl, method: req.method },
    timestamp: new Date()
  };

  try {
    if (isMongoConnected()) {
      await AuditLog.create(auditData);
    } else {
      await memoryStore.save('AuditLog', auditData);
    }
  } catch (e) {
    // Non-blocking log error
  }
}

module.exports = hprAuthMiddleware;
