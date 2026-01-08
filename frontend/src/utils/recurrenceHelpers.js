import { formatLongDate } from './date';

/**
 * Recurrence Helper Utilities
 * Human-readable summaries and validation for frontend
 */

/**
 * Generate human-readable summary of a recurrence rule
 * @param {object} rule - The recurrence rule JSON
 * @returns {string} Human-readable summary
 */
export function getRuleSummary(rule) {
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
        parts.push(`until ${formatDate(rule.until)}`);
    }

    return parts.join(' ');
}

function getOrdinalSuffix(n) {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return s[(v - 20) % 10] || s[v] || s[0];
}

function formatDate(dateStr) {
    return formatLongDate(dateStr) || dateStr;
}

/**
 * Recurrence presets for quick selection
 */
export const RECURRENCE_PRESETS = [
    {
        id: 'daily',
        label: 'Daily',
        rule: { freq: 'DAILY', interval: 1 }
    },
    {
        id: 'weekdays',
        label: 'Every weekday (Mon-Fri)',
        rule: { freq: 'WEEKLY', interval: 1, byday: ['MO', 'TU', 'WE', 'TH', 'FR'] }
    },
    {
        id: 'weekly',
        label: 'Weekly',
        rule: { freq: 'WEEKLY', interval: 1 }
    },
    {
        id: 'biweekly',
        label: 'Every 2 weeks',
        rule: { freq: 'WEEKLY', interval: 2 }
    },
    {
        id: 'monthly',
        label: 'Monthly',
        rule: { freq: 'MONTHLY', interval: 1 }
    },
    {
        id: 'monthlyLastWeekday',
        label: 'Monthly on last weekday',
        rule: { freq: 'MONTHLY', interval: 1, byday: ['MO', 'TU', 'WE', 'TH', 'FR'], bysetpos: -1 }
    },
    {
        id: 'quarterly',
        label: 'Quarterly',
        rule: { freq: 'YEARLY', interval: 1, bymonth: [1, 4, 7, 10] }
    },
    {
        id: 'yearly',
        label: 'Yearly',
        rule: { freq: 'YEARLY', interval: 1 }
    }
];

/**
 * Day of week options
 */
export const DAYS_OF_WEEK = [
    { value: 'MO', label: 'Monday', short: 'Mon' },
    { value: 'TU', label: 'Tuesday', short: 'Tue' },
    { value: 'WE', label: 'Wednesday', short: 'Wed' },
    { value: 'TH', label: 'Thursday', short: 'Thu' },
    { value: 'FR', label: 'Friday', short: 'Fri' },
    { value: 'SA', label: 'Saturday', short: 'Sat' },
    { value: 'SU', label: 'Sunday', short: 'Sun' }
];

/**
 * Position options for bysetpos
 */
export const POSITION_OPTIONS = [
    { value: 1, label: 'First' },
    { value: 2, label: 'Second' },
    { value: 3, label: 'Third' },
    { value: 4, label: 'Fourth' },
    { value: -1, label: 'Last' },
    { value: -2, label: 'Second to last' }
];

/**
 * Month options
 */
export const MONTHS = [
    { value: 1, label: 'January' },
    { value: 2, label: 'February' },
    { value: 3, label: 'March' },
    { value: 4, label: 'April' },
    { value: 5, label: 'May' },
    { value: 6, label: 'June' },
    { value: 7, label: 'July' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'October' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' }
];

/**
 * Validate a recurrence rule on the frontend
 * @param {object} rule - The rule to validate
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateRule(rule) {
    const errors = [];

    if (!rule) {
        return { valid: false, errors: ['Rule is required'] };
    }

    // Must have freq OR custom_dates
    if (!rule.freq && (!rule.custom_dates || rule.custom_dates.length === 0)) {
        errors.push('Frequency or custom dates required');
    }

    // Validate freq
    if (rule.freq && !['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'].includes(rule.freq)) {
        errors.push('Invalid frequency');
    }

    // Validate interval
    if (rule.interval !== undefined && (rule.interval < 1 || rule.interval > 365)) {
        errors.push('Interval must be between 1 and 365');
    }

    // bysetpos requires byday
    if (rule.bysetpos && (!rule.byday || rule.byday.length === 0)) {
        errors.push('Position requires days of week selection');
    }

    if (rule.freq === 'WEEKLY' && (!rule.byday || rule.byday.length === 0)) {
        errors.push('Select at least one weekday');
    }

    if (rule.freq === 'MONTHLY') {
        const hasPosition = rule.bysetpos != null;
        const hasMonthDay = rule.bymonthday && rule.bymonthday.length > 0;
        if (!hasPosition && !hasMonthDay) {
            errors.push('Select a day of the month or a position');
        }
        if (hasPosition && (!rule.byday || rule.byday.length === 0)) {
            errors.push('Select a weekday for the monthly position');
        }
    }

    if (rule.freq === 'YEARLY') {
        const hasMonth = rule.bymonth && rule.bymonth.length > 0;
        const hasMonthDay = rule.bymonthday && rule.bymonthday.length > 0;
        if (!hasMonth) {
            errors.push('Select at least one month');
        }
        if (!hasMonthDay) {
            errors.push('Select a day of the month');
        }
    }

    // count and until are mutually exclusive
    if (rule.count && rule.until) {
        errors.push('Cannot specify both count and end date');
    }

    // custom_dates with other fields
    if (rule.custom_dates && rule.custom_dates.length > 0 && rule.freq) {
        errors.push('Custom dates cannot be used with frequency');
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Build a rule from form state
 * @param {object} formState - Form field values
 * @returns {object} Recurrence rule JSON
 */
export function buildRuleFromForm(formState) {
    const {
        useCustomDates,
        customDates,
        freq,
        interval,
        selectedDays,
        selectedMonths,
        usePosition,
        position,
        monthDay,
        useEndDate,
        endDate,
        useCount,
        count
    } = formState;

    // Custom dates mode
    if (useCustomDates && customDates.length > 0) {
        return {
            custom_dates: customDates.filter(d => d).sort()
        };
    }

    // Build standard rule
    const rule = {
        freq,
        interval: interval || 1
    };

    // Weekly days
    if (freq === 'WEEKLY' && selectedDays.length > 0) {
        rule.byday = selectedDays;
    }

    // Monthly with position (e.g., "last Friday")
    if (freq === 'MONTHLY' && usePosition && selectedDays.length > 0) {
        rule.byday = selectedDays;
        rule.bysetpos = position;
    }
    // Monthly with specific day
    else if (freq === 'MONTHLY' && monthDay) {
        rule.bymonthday = [parseInt(monthDay)];
    }

    if (freq === 'YEARLY') {
        if (selectedMonths && selectedMonths.length > 0) {
            rule.bymonth = selectedMonths;
        }
        if (monthDay) {
            rule.bymonthday = [parseInt(monthDay)];
        }
    }

    // End conditions
    if (useEndDate && endDate) {
        rule.until = endDate;
    } else if (useCount && count) {
        rule.count = parseInt(count);
    }

    return rule;
}

/**
 * Parse a rule into form state
 * @param {object} rule - Recurrence rule JSON
 * @returns {object} Form state object
 */
export function parseRuleToForm(rule) {
    if (!rule) {
        return getDefaultFormState();
    }

    // Custom dates
    if (rule.custom_dates && rule.custom_dates.length > 0) {
        return {
            ...getDefaultFormState(),
            useCustomDates: true,
            customDates: rule.custom_dates
        };
    }

    return {
        useCustomDates: false,
        customDates: [],
        freq: rule.freq || 'WEEKLY',
        interval: rule.interval || 1,
        selectedDays: rule.byday || [],
        selectedMonths: rule.bymonth || [],
        usePosition: rule.bysetpos != null,
        position: rule.bysetpos || -1,
        monthDay: rule.bymonthday ? rule.bymonthday[0] : '',
        useEndDate: !!rule.until,
        endDate: rule.until || '',
        useCount: !!rule.count,
        count: rule.count || ''
    };
}

/**
 * Get default form state
 */
export function getDefaultFormState() {
    return {
        useCustomDates: false,
        customDates: [],
        freq: 'WEEKLY',
        interval: 1,
        selectedDays: [],
        selectedMonths: [],
        usePosition: false,
        position: -1,
        monthDay: '',
        useEndDate: false,
        endDate: '',
        useCount: false,
        count: ''
    };
}

/**
 * Format relative time for reminders
 */
export function formatReminderOffset(offset) {
    const { value, unit } = offset;
    if (value === 1) {
        return `1 ${unit} before`;
    }
    return `${value} ${unit}s before`;
}

/**
 * Default reminder presets
 */
export const REMINDER_PRESETS = [
    { value: 1, unit: 'day', label: '1 day before' },
    { value: 2, unit: 'days', label: '2 days before' },
    { value: 1, unit: 'week', label: '1 week before' },
    { value: 1, unit: 'hour', label: '1 hour before' }
];
