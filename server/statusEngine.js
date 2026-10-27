// ================================================================
// 🧭 KIOTEL OPERATIONS INTELLIGENCE — DETERMINISTIC STATUS ENGINE
// Computes the 6 operational statuses using verified schedules,
// property timezones, overnight windows, coverage, and evidence.
// ================================================================

export const PROPERTY_STATUS = {
  LIVE: 'LIVE',                       // 1. Live / Operating
  NOT_YET_LIVE: 'NOT_YET_LIVE',       // 2. Not Yet Live
  OUTSIDE_HOURS: 'OUTSIDE_HOURS',     // 3. Outside Operating Hours
  AT_RISK: 'AT_RISK',                 // 4. At Risk
  SUSPENDED: 'SUSPENDED',             // 5. Not Operational / Suspended
  UNKNOWN: 'UNKNOWN'                  // 6. Unknown / Needs Verification
};

export const STATUS_LABELS = {
  LIVE: 'Live / Operating',
  NOT_YET_LIVE: 'Not Yet Live',
  OUTSIDE_HOURS: 'Outside Operating Hours',
  AT_RISK: 'At Risk',
  SUSPENDED: 'Not Operational / Suspended',
  UNKNOWN: 'Unknown / Needs Verification'
};

/**
 * Parse "HH:mm" string into minutes since 00:00 (0..1439)
 */
export const parseTimeToMinutes = (timeStr) => {
  if (!timeStr || typeof timeStr !== 'string' || !timeStr.includes(':')) return null;
  const [hStr, mStr] = timeStr.split(':');
  const h = Number(hStr);
  const m = Number(mStr);
  if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
};

/**
 * Get current local time (hours, minutes, formatted string) in a target IANA timezone
 */
export const getLocalTimeInTimezone = (timezone, referenceDate = new Date()) => {
  if (!timezone) return null;
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
    const parts = formatter.formatToParts(referenceDate);
    const map = {};
    parts.forEach(p => { map[p.type] = p.value; });
    const hour = Number(map.hour === '24' ? '0' : map.hour);
    const minute = Number(map.minute);
    return {
      hour,
      minute,
      minutesOfDay: hour * 60 + minute,
      formattedTime: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
      dateStr: `${map.year}-${map.month}-${map.day}`,
      timezone
    };
  } catch (err) {
    return null;
  }
};

/**
 * Evaluate whether current local time falls inside a scheduled operating window.
 * Supports standard same-day windows (e.g. 07:00 -> 23:00) AND overnight windows
 * crossing midnight (e.g. 22:00 -> 06:00 or 19:00 -> 07:00).
 */
export const isWithinOperatingWindow = (schedule, timezone, referenceDate = new Date()) => {
  if (!schedule || !schedule.type || schedule.type === 'UNKNOWN') {
    return { status: 'UNKNOWN', reason: 'Operating schedule is not configured or verified.' };
  }

  if (schedule.type === '24_7') {
    const local = getLocalTimeInTimezone(timezone || 'UTC', referenceDate);
    return {
      status: 'ACTIVE_WINDOW',
      isOvernight: false,
      localTime: local?.formattedTime || '24/7',
      reason: 'Scheduled 24/7 continuous operation.'
    };
  }

  if (!timezone) {
    return { status: 'UNKNOWN', reason: 'Property timezone is missing; cannot verify scheduled operating hours.' };
  }

  const local = getLocalTimeInTimezone(timezone, referenceDate);
  if (!local) {
    return { status: 'UNKNOWN', reason: `Invalid timezone "${timezone}".` };
  }

  const startMin = parseTimeToMinutes(schedule.startTime);
  const endMin = parseTimeToMinutes(schedule.endTime);

  if (startMin === null || endMin === null) {
    return { status: 'UNKNOWN', reason: 'Scheduled start or end time is missing or invalid.' };
  }

  const currentMin = local.minutesOfDay;
  const isOvernight = startMin > endMin; // Crosses midnight, e.g., 22:00 (1320) to 06:00 (360)

  let isInside = false;
  if (startMin === endMin) {
    isInside = true; // 24-hour loop
  } else if (!isOvernight) {
    isInside = currentMin >= startMin && currentMin < endMin;
  } else {
    // Overnight window across midnight: active if >= startMin (evening) OR < endMin (early morning)
    isInside = currentMin >= startMin || currentMin < endMin;
  }

  return {
    status: isInside ? 'ACTIVE_WINDOW' : 'OUTSIDE_WINDOW',
    isOvernight,
    localTime: local.formattedTime,
    windowLabel: `${schedule.startTime} - ${schedule.endTime} (${timezone}${isOvernight ? ', Overnight' : ''})`,
    reason: isInside
      ? `Local time ${local.formattedTime} (${timezone}) is within scheduled hours ${schedule.startTime}–${schedule.endTime}.`
      : `Local time ${local.formattedTime} (${timezone}) is outside scheduled operating hours ${schedule.startTime}–${schedule.endTime}.`
  };
};

/**
 * Determine the operational status of a property with full evidence & missing-data reporting.
 * Never guesses LIVE when data is missing or unverified.
 */
export const evaluatePropertyStatus = (property, allIncidents = [], referenceDate = new Date()) => {
  const missingInfo = [];
  const supportingFacts = [];
  const nowMs = referenceDate.getTime();

  // Check for active incidents affecting this property
  const propIncidents = allIncidents.filter(
    inc => (inc.propertyId === property.id || (inc.propertyIds && inc.propertyIds.includes(property.id))) &&
           inc.resolutionState !== 'RESOLVED_VERIFIED'
  );

  const criticalOrHighIncidents = propIncidents.filter(
    inc => inc.seriousness?.severity === 'CRITICAL' || inc.seriousness?.severity === 'HIGH'
  );

  // 0. Check explicit human status override if verified
  if (property.manualStatusOverride && property.manualStatusOverride.status) {
    return {
      status: property.manualStatusOverride.status,
      statusLabel: STATUS_LABELS[property.manualStatusOverride.status] || property.manualStatusOverride.status,
      reason: `Manual verification by ${property.manualStatusOverride.updatedBy || 'Ops Manager'}: ${property.manualStatusOverride.reason}`,
      isVerified: true,
      missingInfo: [],
      supportingFacts: [`Human override set at ${property.manualStatusOverride.timestamp}`],
      activeIncidentsCount: propIncidents.length,
      criticalIncidentsCount: criticalOrHighIncidents.length,
      latestEvidence: property.lastEvidence || null
    };
  }

  // 1. Check Launch Status
  if (!property.launchStatus || property.launchStatus === 'UNKNOWN') {
    missingInfo.push('Launch status not verified (whether property is launched & in service)');
  } else if (property.launchStatus === 'NOT_YET_LIVE') {
    return {
      status: PROPERTY_STATUS.NOT_YET_LIVE,
      statusLabel: STATUS_LABELS.NOT_YET_LIVE,
      reason: property.launchDate
        ? `Property has not launched yet (Scheduled Go-Live: ${property.launchDate}).`
        : 'Property is in onboarding / pre-launch phase and not yet in service.',
      isVerified: !!property.humanVerified,
      missingInfo,
      supportingFacts: [`Launch status: NOT_YET_LIVE`],
      activeIncidentsCount: propIncidents.length,
      criticalIncidentsCount: criticalOrHighIncidents.length,
      latestEvidence: property.lastEvidence || null
    };
  } else if (property.launchStatus === 'SUSPENDED') {
    return {
      status: PROPERTY_STATUS.SUSPENDED,
      statusLabel: STATUS_LABELS.SUSPENDED,
      reason: property.suspensionReason || 'Verified evidence indicates operations are currently stopped or suspended.',
      isVerified: true,
      missingInfo: [],
      supportingFacts: [`Launch/Service status: SUSPENDED`],
      activeIncidentsCount: propIncidents.length,
      criticalIncidentsCount: criticalOrHighIncidents.length,
      latestEvidence: property.lastEvidence || null
    };
  }

  // 2. Check Operating Schedule & Timezone
  const windowEval = isWithinOperatingWindow(property.schedule, property.timezone, referenceDate);
  if (windowEval.status === 'UNKNOWN') {
    missingInfo.push(windowEval.reason);
  } else {
    supportingFacts.push(windowEval.reason);
  }

  // If verified as outside operating hours, return OUTSIDE_HOURS (unless there's a critical incident)
  if (property.launchStatus === 'LAUNCHED' && windowEval.status === 'OUTSIDE_WINDOW') {
    return {
      status: PROPERTY_STATUS.OUTSIDE_HOURS,
      statusLabel: STATUS_LABELS.OUTSIDE_HOURS,
      reason: windowEval.reason,
      localTime: windowEval.localTime,
      windowLabel: windowEval.windowLabel,
      isVerified: !!property.humanVerified,
      missingInfo,
      supportingFacts,
      activeIncidentsCount: propIncidents.length,
      criticalIncidentsCount: criticalOrHighIncidents.length,
      latestEvidence: property.lastEvidence || null
    };
  }

  // 3. Check Coverage Arrangement (Dedicated vs Shared)
  const coverage = property.coverage || { type: 'UNKNOWN', coverageConfirmed: false };
  if (!coverage.type || coverage.type === 'UNKNOWN') {
    missingInfo.push('Coverage model (Dedicated vs Shared team) is not specified');
  } else {
    supportingFacts.push(
      `Coverage Model: ${coverage.type === 'DEDICATED' ? 'Dedicated Agent' : 'Shared Operations Pool'} (${coverage.assignedTeamOrAgent || 'Unassigned'})`
    );
  }

  if (!coverage.coverageConfirmed) {
    missingInfo.push('Active shift agent/team coverage is not confirmed for the current window');
  }

  // 4. Check for Serious Operational Issues (AT_RISK)
  if (criticalOrHighIncidents.length > 0) {
    const topInc = criticalOrHighIncidents[0];
    return {
      status: PROPERTY_STATUS.AT_RISK,
      statusLabel: STATUS_LABELS.AT_RISK,
      reason: `Active ${topInc.seriousness.severity} issue affecting operations: "${topInc.title}" (${topInc.resolutionState.replace(/_/g, ' ')}).`,
      localTime: windowEval.localTime,
      windowLabel: windowEval.windowLabel,
      isVerified: true,
      missingInfo,
      supportingFacts: [
        ...supportingFacts,
        `${criticalOrHighIncidents.length} unresolved Critical/High incident(s) require attention.`
      ],
      activeIncidentsCount: propIncidents.length,
      criticalIncidentsCount: criticalOrHighIncidents.length,
      latestEvidence: {
        source: `Incident ${topInc.id} (${topInc.groupName || property.name})`,
        summary: topInc.summary || topInc.title,
        timestamp: topInc.latestUpdateAt || topInc.raisedAt
      }
    };
  }

  if (property.coverageGapReported) {
    return {
      status: PROPERTY_STATUS.AT_RISK,
      statusLabel: STATUS_LABELS.AT_RISK,
      reason: `Staffing or coverage gap reported: ${property.coverageGapReason || 'Agent coverage missing during active operating window.'}`,
      localTime: windowEval.localTime,
      windowLabel: windowEval.windowLabel,
      isVerified: true,
      missingInfo,
      supportingFacts,
      activeIncidentsCount: propIncidents.length,
      criticalIncidentsCount: criticalOrHighIncidents.length,
      latestEvidence: property.lastEvidence || null
    };
  }

  // 5. Check if any required verification data is missing or stale -> UNKNOWN
  const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours
  const evidenceTimeMs = property.lastEvidence?.timestamp ? new Date(property.lastEvidence.timestamp).getTime() : null;
  const coverageTimeMs = coverage.lastCoverageVerifiedAt ? new Date(coverage.lastCoverageVerifiedAt).getTime() : null;
  const latestVerificationMs = Math.max(evidenceTimeMs || 0, coverageTimeMs || 0);

  if (!latestVerificationMs) {
    missingInfo.push('No recent operational evidence or shift coverage confirmation recorded');
  } else if (nowMs - latestVerificationMs > STALE_THRESHOLD_MS) {
    const hoursOld = Math.round((nowMs - latestVerificationMs) / (60 * 60 * 1000));
    missingInfo.push(`Latest operational/coverage evidence is stale (${hoursOld}h old)`);
  }

  if (missingInfo.length > 0) {
    return {
      status: PROPERTY_STATUS.UNKNOWN,
      statusLabel: STATUS_LABELS.UNKNOWN,
      reason: `Cannot verify Live status: ${missingInfo.join('; ')}.`,
      localTime: windowEval.localTime,
      windowLabel: windowEval.windowLabel,
      isVerified: false,
      missingInfo,
      supportingFacts,
      activeIncidentsCount: propIncidents.length,
      criticalIncidentsCount: criticalOrHighIncidents.length,
      latestEvidence: property.lastEvidence || null
    };
  }

  // 6. All checks passed: Property is launched, within operating hours, coverage is confirmed (Dedicated or Shared), no critical blockers, and backed by recent evidence
  return {
    status: PROPERTY_STATUS.LIVE,
    statusLabel: STATUS_LABELS.LIVE,
    reason: `Scheduled to operate now (${windowEval.windowLabel || '24/7'}), ${coverage.type.toLowerCase()} coverage confirmed (${coverage.assignedTeamOrAgent}), supported by recent evidence.`,
    localTime: windowEval.localTime,
    windowLabel: windowEval.windowLabel,
    isVerified: true,
    missingInfo: [],
    supportingFacts,
    activeIncidentsCount: propIncidents.length,
    criticalIncidentsCount: 0,
    latestEvidence: property.lastEvidence || {
      source: 'Shift Coverage Verification',
      summary: `${coverage.type} coverage confirmed (${coverage.assignedTeamOrAgent})`,
      timestamp: coverage.lastCoverageVerifiedAt
    }
  };
};
