/**
 * Recurrence Engine
 * Computes next occurrence dates based on RRULE-compatible JSON
 * Timezone-aware, DST-safe
 */

const { DateTime, Interval } = require('luxon');

// Day mapping for RRULE
const DAY_MAP = {
    MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6, SU: 7
};

const DAY_REVERSE = {
    1: 'MO', 2: 'TU', 3: 'WE', 4: 'TH', 5: 'FR', 6: 'SA', 7: 'SU'
};

const normalizeDateInput = (value, timezone = 'UTC') => {
    if (!value) return null;
    if (value instanceof Date) {
        const dt = DateTime.fromJSDate(value, { zone: timezone });
        return dt.isValid ? dt.toISODate() : null;
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        const dt = DateTime.fromISO(trimmed, { zone: timezone });
        if (dt.isValid) return dt.toISODate();
        const fallback = DateTime.fromJSDate(new Date(trimmed), { zone: timezone });
        return fallback.isValid ? fallback.toISODate() : null;
    }
    return null;
};

/**
 * Compute the next occurrence after a given date
 * @param {object} rule - The recurrence rule JSON
 * @param {string} fromDate - ISO date string (YYYY-MM-DD) to compute from
 * @param {string} timezone - IANA timezone (e.g., 'America/New_York')
 * @returns {string|null} - Next occurrence date (YYYY-MM-DD) or null if none
 */
function computeNextOccurrence(rule, fromDate, timezone = 'UTC', startDate = null) {
    const normalizedFromDate = normalizeDateInput(fromDate, timezone);
    if (!normalizedFromDate) return null;

    // Handle custom dates
    if (rule.custom_dates && rule.custom_dates.length > 0) {
        return getNextCustomDate(rule.custom_dates, normalizedFromDate);
    }

    // Parse from date in the series timezone
    let dt = DateTime.fromISO(normalizedFromDate, { zone: timezone });
    
    // Move to start of next day to avoid returning same date
    dt = dt.plus({ days: 1 }).startOf('day');

    const maxIterations = 366 * 2; // Safety limit (2 years)
    let iterations = 0;

    while (iterations < maxIterations) {
        iterations++;

        // Check until constraint
        if (rule.until && dt.toISODate() > rule.until) {
            return null;
        }

        // Check if current date matches the rule
        if (matchesRule(dt, rule, timezone, startDate)) {
            return dt.toISODate();
        }

        // Advance to next candidate
        dt = advanceToNextCandidate(dt, rule);
    }

    // Safety: no match found within limit
    console.warn('computeNextOccurrence: max iterations reached');
    return null;
}

/**
 * Get next date from custom_dates list
 */
function getNextCustomDate(customDates, fromDate) {
    const sortedDates = [...customDates].sort();
    for (const date of sortedDates) {
        if (date > fromDate) {
            return date;
        }
    }
    return null;
}

/**
 * Check if a DateTime matches the recurrence rule
 */
function matchesRule(dt, rule, timezone, startDate) {
    const freq = rule.freq;

    // Check bymonth constraint
    if (rule.bymonth && rule.bymonth.length > 0) {
        if (!rule.bymonth.includes(dt.month)) {
            return false;
        }
    }

    // For MONTHLY/YEARLY with bysetpos, use special handling
    if ((freq === 'MONTHLY' || freq === 'YEARLY') && rule.bysetpos != null && rule.byday) {
        return matchesBySetPos(dt, rule);
    }

    // Check bymonthday constraint
    if (rule.bymonthday && rule.bymonthday.length > 0) {
        const dayOfMonth = dt.day;
        const daysInMonth = dt.daysInMonth;
        
        const matches = rule.bymonthday.some(d => {
            if (d > 0) return d === dayOfMonth;
            if (d < 0) return (daysInMonth + d + 1) === dayOfMonth;
            return false;
        });
        
        if (!matches) return false;
    }

    // Check byday constraint (without bysetpos)
    if (rule.byday && rule.byday.length > 0 && rule.bysetpos == null) {
        const dayOfWeek = DAY_REVERSE[dt.weekday];
        if (!rule.byday.includes(dayOfWeek)) {
            return false;
        }
    }

    // Check interval for the frequency
    return matchesInterval(dt, rule, timezone, startDate);
}

/**
 * Check if date matches bysetpos constraint
 * e.g., "last Friday" or "first Monday"
 */
function matchesBySetPos(dt, rule) {
    const targetDays = rule.byday.map(d => DAY_MAP[d]);
    const dayOfWeek = dt.weekday;
    
    // Current day must be one of the target days
    if (!targetDays.includes(dayOfWeek)) {
        return false;
    }

    // Get all matching days in the month
    const matchingDays = [];
    const monthStart = dt.startOf('month');
    const daysInMonth = dt.daysInMonth;

    for (let d = 1; d <= daysInMonth; d++) {
        const checkDate = monthStart.set({ day: d });
        if (targetDays.includes(checkDate.weekday)) {
            matchingDays.push(d);
        }
    }

    // Check bysetpos
    const pos = rule.bysetpos;
    let targetDay;

    if (pos > 0) {
        targetDay = matchingDays[pos - 1];
    } else if (pos < 0) {
        targetDay = matchingDays[matchingDays.length + pos];
    }

    return dt.day === targetDay;
}

/**
 * Check if date matches the interval requirement
 */
function matchesInterval(dt, rule, timezone, startDate) {
    // For interval checking, we need a reference point
    // This would typically be the series start_date
    // For simplicity, we'll assume interval=1 always matches
    // Real implementation should track from series start
    
    const interval = rule.interval || 1;
    if (interval === 1) return true;
    if (!startDate) return true;

    const intervalsSinceStart = calculateIntervalCount(startDate, dt.toISODate(), rule, timezone);
    return intervalsSinceStart % interval === 0;
}

/**
 * Advance to the next candidate date based on frequency
 */
function advanceToNextCandidate(dt, rule) {
    const freq = rule.freq;
    const interval = rule.interval || 1;

    switch (freq) {
        case 'DAILY':
            return dt.plus({ days: 1 });

        case 'WEEKLY':
            // If we have byday, advance day by day
            if (rule.byday && rule.byday.length > 0) {
                return dt.plus({ days: 1 });
            }
            // Otherwise advance by interval weeks
            return dt.plus({ days: 1 });

        case 'MONTHLY':
            // Advance day by day within constraints
            if (rule.bysetpos || rule.bymonthday) {
                const nextDay = dt.plus({ days: 1 });
                // If we've passed the current month, jump to next month
                if (nextDay.month !== dt.month) {
                    return nextDay.startOf('month');
                }
                return nextDay;
            }
            return dt.plus({ days: 1 });

        case 'YEARLY':
            return dt.plus({ days: 1 });

        default:
            return dt.plus({ days: 1 });
    }
}

/**
 * Generate multiple occurrences
 * @param {object} rule - Recurrence rule
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} timezone - Timezone
 * @param {object} options - { maxCount, untilDate, windowDays }
 * @returns {string[]} - Array of occurrence dates
 */
function generateOccurrences(rule, startDate, timezone, options = {}) {
    const { 
        maxCount = 10, 
        untilDate = null,
        windowDays = 60 
    } = options;

    const normalizedStartDate = normalizeDateInput(startDate, timezone);
    if (!normalizedStartDate) return [];

    const occurrences = [];
    let currentDate = DateTime.fromISO(normalizedStartDate, { zone: timezone })
        .minus({ days: 1 })
        .toISODate();
    const endDate = untilDate || 
        DateTime.fromISO(normalizedStartDate, { zone: timezone })
            .plus({ days: windowDays })
            .toISODate();

    // Respect rule's count and until
    const effectiveMaxCount = rule.count ? Math.min(rule.count, maxCount) : maxCount;
    const effectiveEndDate = rule.until ? 
        (rule.until < endDate ? rule.until : endDate) : endDate;

    while (occurrences.length < effectiveMaxCount) {
        const nextDate = computeNextOccurrence(rule, currentDate, timezone, normalizedStartDate);
        
        if (!nextDate) break;
        if (nextDate > effectiveEndDate) break;

        occurrences.push(nextDate);
        currentDate = nextDate;
    }

    return occurrences;
}

/**
 * Check if a specific date would be an occurrence
 * @param {object} rule - Recurrence rule
 * @param {string} date - Date to check (YYYY-MM-DD)
 * @param {string} timezone - Timezone
 * @returns {boolean}
 */
function isOccurrence(rule, date, timezone = 'UTC', startDate = null) {
    // Handle custom dates
    if (rule.custom_dates && rule.custom_dates.length > 0) {
        return rule.custom_dates.includes(date);
    }

    const normalizedDate = normalizeDateInput(date, timezone);
    if (!normalizedDate) return false;
    const dt = DateTime.fromISO(normalizedDate, { zone: timezone });
    return matchesRule(dt, rule, timezone, startDate);
}

/**
 * Get a preview of upcoming occurrences (for UI)
 * @param {object} rule - Recurrence rule
 * @param {string} startDate - Start date
 * @param {string} timezone - Timezone
 * @param {number} count - Number of occurrences to preview
 * @returns {Array<{date: string, dayOfWeek: string, formatted: string}>}
 */
function previewOccurrences(rule, startDate, timezone, count = 5) {
    const dates = generateOccurrences(rule, startDate, timezone, { maxCount: count });
    
    return dates.map(date => {
        const dt = DateTime.fromISO(date, { zone: timezone });
        return {
            date,
            dayOfWeek: dt.weekdayLong,
            formatted: dt.toLocaleString(DateTime.DATE_FULL)
        };
    });
}

/**
 * Calculate the interval epoch for accurate interval tracking
 * @param {string} startDate - Series start date
 * @param {string} currentDate - Current date being checked
 * @param {object} rule - Recurrence rule
 * @returns {number} - Number of intervals since start
 */
function calculateIntervalCount(startDate, currentDate, rule, timezone = 'UTC') {
    const normalizedStart = normalizeDateInput(startDate, timezone);
    const normalizedCurrent = normalizeDateInput(currentDate, timezone);
    if (!normalizedStart || !normalizedCurrent) return 0;
    const start = DateTime.fromISO(normalizedStart, { zone: timezone });
    const current = DateTime.fromISO(normalizedCurrent, { zone: timezone });
    const diff = Interval.fromDateTimes(start, current);

    switch (rule.freq) {
        case 'DAILY':
            return Math.floor(diff.length('days'));
        case 'WEEKLY':
            return Math.floor(diff.length('weeks'));
        case 'MONTHLY':
            return Math.floor(diff.length('months'));
        case 'YEARLY':
            return Math.floor(diff.length('years'));
        default:
            return 0;
    }
}

/**
 * Validate that a date is valid for generation
 * Checks against end date, count limits, etc.
 */
function isValidForGeneration(rule, date, options = {}) {
    const { endDate, currentCount = 0 } = options;

    // Check rule's until
    if (rule.until && date > rule.until) {
        return false;
    }

    // Check rule's count
    if (rule.count && currentCount >= rule.count) {
        return false;
    }

    // Check series end date
    if (endDate && date > endDate) {
        return false;
    }

    return true;
}

module.exports = {
    computeNextOccurrence,
    generateOccurrences,
    isOccurrence,
    previewOccurrences,
    calculateIntervalCount,
    isValidForGeneration,
    DAY_MAP,
    DAY_REVERSE
};
