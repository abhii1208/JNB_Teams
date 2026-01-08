/**
 * Recurrence Rule JSON Schema Validator
 * RFC-5545 aligned, production-ready
 */

const Ajv = require('ajv');
const addFormats = require('ajv-formats');

// Initialize AJV with relaxed strict mode for complex schemas
const ajv = new Ajv({ 
    allErrors: true,
    strict: false,  // Relaxed to allow complex conditionals
    coerceTypes: false
});
addFormats(ajv);

/**
 * RRULE JSON Schema (Draft-07)
 */
const recurrenceRuleSchema = {
    $schema: 'http://json-schema.org/draft-07/schema#',
    $id: 'recurrence-rule',
    title: 'Recurring Rule (RRULE-compatible)',
    type: 'object',
    additionalProperties: false,

    properties: {
        freq: {
            type: 'string',
            enum: ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'],
            description: 'Recurrence frequency'
        },

        interval: {
            type: 'integer',
            minimum: 1,
            maximum: 365,
            default: 1,
            description: 'Repeat every N units'
        },

        byday: {
            type: ['array', 'null'],
            items: {
                type: 'string',
                enum: ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU']
            },
            uniqueItems: true,
            description: 'Days of the week'
        },

        bymonthday: {
            type: ['array', 'null'],
            items: {
                type: 'integer',
                minimum: -31,
                maximum: 31
            },
            uniqueItems: true,
            description: 'Days of the month (1-31, or -1 for last)'
        },

        bymonth: {
            type: ['array', 'null'],
            items: {
                type: 'integer',
                minimum: 1,
                maximum: 12
            },
            uniqueItems: true,
            description: 'Months (1-12)'
        },

        bysetpos: {
            type: ['integer', 'null'],
            minimum: -366,
            maximum: 366,
            description: 'Position within byday set (-1 for last)'
        },

        count: {
            type: ['integer', 'null'],
            minimum: 1,
            maximum: 999,
            description: 'Maximum number of occurrences'
        },

        until: {
            type: ['string', 'null'],
            format: 'date',
            description: 'End date (ISO-8601)'
        },

        wkst: {
            type: 'string',
            enum: ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'],
            default: 'MO',
            description: 'Week start day'
        },

        custom_dates: {
            type: ['array', 'null'],
            items: {
                type: 'string',
                format: 'date'
            },
            uniqueItems: true,
            minItems: 1,
            description: 'Override: specific dates only'
        }
    },

    // Either freq OR custom_dates must be present
    oneOf: [
        {
            required: ['custom_dates'],
            properties: {
                custom_dates: { type: 'array' }
            }
        },
        {
            required: ['freq']
        }
    ],

    // Validation rules
    allOf: [
        // Rule: bysetpos requires byday
        {
            if: {
                properties: { bysetpos: { type: 'integer' } },
                required: ['bysetpos']
            },
            then: {
                required: ['byday']
            }
        },
        // Rule: bymonthday only with MONTHLY/YEARLY
        {
            if: {
                properties: { bymonthday: { type: 'array' } },
                required: ['bymonthday']
            },
            then: {
                properties: {
                    freq: { enum: ['MONTHLY', 'YEARLY'] }
                }
            }
        }
    ]
};

// Compile the schema
const validateRule = ajv.compile(recurrenceRuleSchema);

/**
 * Custom validation beyond JSON Schema
 */
function customValidation(rule) {
    const errors = [];

    // Rule: count and until are mutually exclusive
    if (rule.count != null && rule.until != null) {
        errors.push({
            field: 'count/until',
            message: 'Cannot specify both count and until'
        });
    }

    // Rule: custom_dates cannot coexist with other RRULE fields
    if (rule.custom_dates && rule.custom_dates.length > 0) {
        const rruleFields = ['freq', 'interval', 'byday', 'bymonthday', 'bysetpos', 'count', 'until', 'bymonth'];
        const conflictingFields = rruleFields.filter(f => rule[f] != null);
        if (conflictingFields.length > 0) {
            errors.push({
                field: 'custom_dates',
                message: `custom_dates cannot be used with: ${conflictingFields.join(', ')}`
            });
        }
    }

    // Rule: bymonthday values cannot be 0
    if (rule.bymonthday && rule.bymonthday.includes(0)) {
        errors.push({
            field: 'bymonthday',
            message: 'bymonthday cannot contain 0'
        });
    }

    // Rule: bysetpos cannot be 0
    if (rule.bysetpos === 0) {
        errors.push({
            field: 'bysetpos',
            message: 'bysetpos cannot be 0'
        });
    }

    // Rule: WEEKLY should have byday for clarity
    if (rule.freq === 'WEEKLY' && (!rule.byday || rule.byday.length === 0)) {
        // This is a warning, not an error - we'll default to the start day
    }

    return errors;
}

/**
 * Normalize a recurrence rule (fill defaults, sort arrays, remove nulls)
 */
function normalizeRule(rule) {
    const normalized = { ...rule };

    // Set defaults
    if (normalized.freq && !normalized.interval) {
        normalized.interval = 1;
    }
    if (normalized.freq && !normalized.wkst) {
        normalized.wkst = 'MO';
    }

    // Sort arrays for consistency
    if (normalized.byday) {
        const dayOrder = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
        normalized.byday = [...normalized.byday].sort(
            (a, b) => dayOrder.indexOf(a) - dayOrder.indexOf(b)
        );
    }
    if (normalized.bymonthday) {
        normalized.bymonthday = [...normalized.bymonthday].sort((a, b) => a - b);
    }
    if (normalized.bymonth) {
        normalized.bymonth = [...normalized.bymonth].sort((a, b) => a - b);
    }
    if (normalized.custom_dates) {
        normalized.custom_dates = [...normalized.custom_dates].sort();
    }

    // Remove null/undefined values
    Object.keys(normalized).forEach(key => {
        if (normalized[key] === null || normalized[key] === undefined) {
            delete normalized[key];
        }
    });

    return normalized;
}

/**
 * Validate a recurrence rule
 * @param {object} rule - The recurrence rule JSON
 * @returns {{ valid: boolean, errors: array, normalized: object|null }}
 */
function validateRecurrenceRule(rule) {
    // JSON Schema validation
    const schemaValid = validateRule(rule);
    
    if (!schemaValid) {
        return {
            valid: false,
            errors: validateRule.errors.map(e => ({
                field: e.instancePath || e.params?.missingProperty || 'root',
                message: e.message
            })),
            normalized: null
        };
    }

    // Custom validation
    const customErrors = customValidation(rule);
    if (customErrors.length > 0) {
        return {
            valid: false,
            errors: customErrors,
            normalized: null
        };
    }

    // Success - return normalized rule
    return {
        valid: true,
        errors: [],
        normalized: normalizeRule(rule)
    };
}

/**
 * Generate human-readable summary of a recurrence rule
 */
function getRuleSummary(rule) {
    if (!rule) return 'No recurrence';

    // Custom dates
    if (rule.custom_dates && rule.custom_dates.length > 0) {
        const count = rule.custom_dates.length;
        return `${count} specific date${count > 1 ? 's' : ''}`;
    }

    const parts = [];
    const freq = rule.freq;
    const interval = rule.interval || 1;

    // Frequency base
    const freqMap = {
        DAILY: interval === 1 ? 'Daily' : `Every ${interval} days`,
        WEEKLY: interval === 1 ? 'Weekly' : `Every ${interval} weeks`,
        MONTHLY: interval === 1 ? 'Monthly' : `Every ${interval} months`,
        YEARLY: interval === 1 ? 'Yearly' : `Every ${interval} years`
    };
    parts.push(freqMap[freq] || freq);

    // Days of week
    if (rule.byday && rule.byday.length > 0) {
        const dayNames = {
            MO: 'Mon', TU: 'Tue', WE: 'Wed', TH: 'Thu', FR: 'Fri', SA: 'Sat', SU: 'Sun'
        };
        const weekdays = ['MO', 'TU', 'WE', 'TH', 'FR'];
        
        // Check for "every weekday" pattern
        if (rule.byday.length === 5 && weekdays.every(d => rule.byday.includes(d))) {
            if (rule.bysetpos === -1) {
                parts.push('on the last weekday');
            } else if (rule.bysetpos === 1) {
                parts.push('on the first weekday');
            } else {
                parts.push('on weekdays');
            }
        } else {
            const days = rule.byday.map(d => dayNames[d]).join(', ');
            if (rule.bysetpos) {
                const posMap = { 1: 'first', 2: 'second', 3: 'third', 4: 'fourth', '-1': 'last', '-2': 'second to last' };
                parts.push(`on the ${posMap[rule.bysetpos] || rule.bysetpos} ${days}`);
            } else {
                parts.push(`on ${days}`);
            }
        }
    }

    // Day of month
    if (rule.bymonthday && rule.bymonthday.length > 0) {
        const days = rule.bymonthday.map(d => {
            if (d === -1) return 'last day';
            if (d < 0) return `${Math.abs(d)} days from end`;
            return `${d}${getOrdinalSuffix(d)}`;
        }).join(', ');
        parts.push(`on the ${days}`);
    }

    // Month
    if (rule.bymonth && rule.bymonth.length > 0) {
        const monthNames = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                           'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const months = rule.bymonth.map(m => monthNames[m]).join(', ');
        parts.push(`in ${months}`);
    }

    // End condition
    if (rule.count) {
        parts.push(`(${rule.count} times)`);
    }
    if (rule.until) {
        parts.push(`until ${rule.until}`);
    }

    return parts.join(' ');
}

function getOrdinalSuffix(n) {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return s[(v - 20) % 10] || s[v] || s[0];
}

/**
 * Common recurrence presets for UI
 */
const RECURRENCE_PRESETS = {
    daily: {
        label: 'Daily',
        rule: { freq: 'DAILY', interval: 1 }
    },
    weekdays: {
        label: 'Every weekday',
        rule: { freq: 'WEEKLY', interval: 1, byday: ['MO', 'TU', 'WE', 'TH', 'FR'] }
    },
    weekly: {
        label: 'Weekly',
        rule: { freq: 'WEEKLY', interval: 1 }
    },
    biweekly: {
        label: 'Every 2 weeks',
        rule: { freq: 'WEEKLY', interval: 2 }
    },
    monthly: {
        label: 'Monthly',
        rule: { freq: 'MONTHLY', interval: 1 }
    },
    monthlyLastWeekday: {
        label: 'Monthly on last weekday',
        rule: { freq: 'MONTHLY', interval: 1, byday: ['MO', 'TU', 'WE', 'TH', 'FR'], bysetpos: -1 }
    },
    quarterly: {
        label: 'Quarterly',
        rule: { freq: 'MONTHLY', interval: 3 }
    },
    yearly: {
        label: 'Yearly',
        rule: { freq: 'YEARLY', interval: 1 }
    }
};

module.exports = {
    validateRecurrenceRule,
    normalizeRule,
    getRuleSummary,
    RECURRENCE_PRESETS,
    recurrenceRuleSchema
};
