import React, { useState, useEffect } from 'react';
import {
    Box,
    FormControl,
    FormLabel,
    Select,
    MenuItem,
    TextField,
    Checkbox,
    FormControlLabel,
    ToggleButton,
    ToggleButtonGroup,
    Typography,
    Paper,
    Chip,
    Stack,
    Alert,
    InputLabel,
    RadioGroup,
    Radio,
    Divider
} from '@mui/material';
import {
    getRuleSummary,
    RECURRENCE_PRESETS,
    DAYS_OF_WEEK,
    MONTHS,
    POSITION_OPTIONS,
    validateRule,
    buildRuleFromForm,
    parseRuleToForm,
    getDefaultFormState
} from '../../utils/recurrenceHelpers';

/**
 * RecurrenceRuleBuilder Component
 * Form-based UI for building recurrence rules
 * 
 * @param {object} props
 * @param {object} props.value - Current rule value
 * @param {function} props.onChange - Called with new rule when changed
 * @param {string} props.startDate - Series start date (for preview)
 * @param {boolean} props.showPreview - Whether to show occurrence preview
 */
function RecurrenceRuleBuilder({ value, onChange, startDate, showPreview = true }) {
    const [formState, setFormState] = useState(getDefaultFormState);
    const [mode, setMode] = useState('preset'); // 'preset' | 'custom'
    const [selectedPreset, setSelectedPreset] = useState('');
    const [errors, setErrors] = useState([]);
    const [preview, setPreview] = useState([]);
    const isSyncingRef = React.useRef(false);
    const shouldEmitDefaultRef = React.useRef(false);
    const lastEmittedRef = React.useRef('');

    const stableStringify = (input) => {
        const normalize = (valueToNormalize) => {
            if (Array.isArray(valueToNormalize)) {
                return valueToNormalize.map(normalize);
            }
            if (valueToNormalize && typeof valueToNormalize === 'object') {
                return Object.keys(valueToNormalize).sort().reduce((acc, key) => {
                    acc[key] = normalize(valueToNormalize[key]);
                    return acc;
                }, {});
            }
            return valueToNormalize;
        };
        return JSON.stringify(normalize(input ?? null));
    };
    const valueString = stableStringify(value);
    const weekdayDefaults = ['MO', 'TU', 'WE', 'TH', 'FR'];
    const configurablePresets = new Set(['weekly', 'biweekly', 'monthly', 'quarterly', 'yearly']);

    const startDateDefaults = React.useMemo(() => {
        if (!startDate) return null;
        const parts = startDate.split('T')[0].split('-');
        if (parts.length !== 3) return null;
        const year = Number.parseInt(parts[0], 10);
        const month = Number.parseInt(parts[1], 10);
        const day = Number.parseInt(parts[2], 10);
        if (!year || !month || !day) return null;
        const date = new Date(year, month - 1, day);
        const dayIndex = date.getDay();
        const dayMap = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
        return {
            weekday: dayMap[dayIndex],
            month,
            day
        };
    }, [startDate]);

    // Initialize from value (also update when value changes)
    useEffect(() => {
        isSyncingRef.current = true;
        if (!value) {
            shouldEmitDefaultRef.current = true;
            setFormState(getDefaultFormState());
            setMode('preset');
            setSelectedPreset('');
            return;
        }

        shouldEmitDefaultRef.current = false;
        const parsed = parseRuleToForm(value);
        setFormState(parsed);

        // Check if matches a preset
        const matchingPreset = RECURRENCE_PRESETS.find(p => 
            stableStringify(p.rule) === valueString
        );
        if (matchingPreset) {
            setSelectedPreset(matchingPreset.id);
            setMode('preset');
        } else {
            setSelectedPreset('');
            setMode('custom');
        }
    }, [valueString]);

    useEffect(() => {
        if (!startDateDefaults) return;
        setFormState(prev => {
            let next = prev;
            if (prev.freq === 'WEEKLY' && prev.selectedDays.length === 0 && startDateDefaults.weekday) {
                next = { ...next, selectedDays: [startDateDefaults.weekday] };
            }
            if (prev.freq === 'MONTHLY' && !prev.usePosition && !prev.monthDay && startDateDefaults.day) {
                next = { ...next, monthDay: startDateDefaults.day };
            }
            if (prev.freq === 'YEARLY') {
                if ((!prev.selectedMonths || prev.selectedMonths.length === 0) && startDateDefaults.month) {
                    next = { ...next, selectedMonths: [startDateDefaults.month] };
                }
                if (!prev.monthDay && startDateDefaults.day) {
                    next = { ...next, monthDay: startDateDefaults.day };
                }
            }
            return next === prev ? prev : next;
        });
    }, [startDateDefaults, formState.freq, formState.usePosition]);

    // Build and validate rule when form changes
    useEffect(() => {
        if (mode === 'preset' && selectedPreset) {
            const preset = RECURRENCE_PRESETS.find(p => p.id === selectedPreset);
            if (preset) {
                const validation = validateRule(preset.rule);
                setErrors(validation.errors);
                if (validation.valid) {
                    const nextString = stableStringify(preset.rule);
                    if (shouldEmitDefaultRef.current) {
                        shouldEmitDefaultRef.current = false;
                        if (nextString !== valueString) {
                            lastEmittedRef.current = nextString;
                            onChange(preset.rule);
                        }
                        isSyncingRef.current = false;
                        return;
                    }
                    if (isSyncingRef.current) {
                        isSyncingRef.current = false;
                        return;
                    }
                    if (nextString !== valueString && nextString !== lastEmittedRef.current) {
                        lastEmittedRef.current = nextString;
                        onChange(preset.rule);
                    }
                }
            }
        } else {
            const rule = buildRuleFromForm(formState);
            const validation = validateRule(rule);
            setErrors(validation.errors);
            if (validation.valid) {
                const nextString = stableStringify(rule);
                if (shouldEmitDefaultRef.current) {
                    shouldEmitDefaultRef.current = false;
                    if (nextString !== valueString) {
                        lastEmittedRef.current = nextString;
                        onChange(rule);
                    }
                    isSyncingRef.current = false;
                    return;
                }
                if (isSyncingRef.current) {
                    isSyncingRef.current = false;
                    return;
                }
                if (nextString !== valueString && nextString !== lastEmittedRef.current) {
                    lastEmittedRef.current = nextString;
                    onChange(rule);
                }
            }
        }
        isSyncingRef.current = false;
    }, [formState, mode, selectedPreset, onChange, valueString]);

    // Generate preview
    useEffect(() => {
        const rule = mode === 'preset' 
            ? RECURRENCE_PRESETS.find(p => p.id === selectedPreset)?.rule
            : buildRuleFromForm(formState);
        
        if (rule && startDate && showPreview) {
            // In a real app, this would call the backend /recurring/preview endpoint
            // For now, we show a placeholder
            setPreview([]);
        }
    }, [formState, mode, selectedPreset, startDate, showPreview]);

    const handleFormChange = (field, value) => {
        setFormState(prev => ({ ...prev, [field]: value }));
    };

    const handleDayToggle = (event, newDays) => {
        handleFormChange('selectedDays', newDays || []);
    };

    const handleMonthToggle = (event, newMonths) => {
        handleFormChange('selectedMonths', newMonths || []);
    };

    const handlePresetSelect = (event) => {
        const presetId = event.target.value;
        const preset = RECURRENCE_PRESETS.find(p => p.id === presetId);
        if (!preset) {
            setSelectedPreset(presetId);
            return;
        }
        if (configurablePresets.has(presetId)) {
            const parsed = parseRuleToForm(preset.rule);
            setSelectedPreset('');
            setMode('custom');
            setFormState(parsed);
            return;
        }
        setSelectedPreset(presetId);
    };

    const currentRule = mode === 'preset' 
        ? RECURRENCE_PRESETS.find(p => p.id === selectedPreset)?.rule
        : buildRuleFromForm(formState);

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Mode Selection */}
            <FormControl component="fieldset">
                <FormLabel>Recurrence Type</FormLabel>
                <RadioGroup
                    row
                    value={mode}
                    onChange={(e) => setMode(e.target.value)}
                >
                    <FormControlLabel value="preset" control={<Radio />} label="Quick preset" />
                    <FormControlLabel value="custom" control={<Radio />} label="Custom" />
                </RadioGroup>
            </FormControl>

            {/* Preset Selection */}
            {mode === 'preset' && (
                <FormControl fullWidth>
                    <InputLabel>Select Preset</InputLabel>
                    <Select
                        value={selectedPreset}
                        onChange={handlePresetSelect}
                        label="Select Preset"
                    >
                        {RECURRENCE_PRESETS.map(preset => (
                            <MenuItem key={preset.id} value={preset.id}>
                                {preset.label}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>
            )}

            {/* Custom Rule Builder */}
            {mode === 'custom' && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {/* Custom Dates Toggle */}
                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={formState.useCustomDates}
                                onChange={(e) => handleFormChange('useCustomDates', e.target.checked)}
                            />
                        }
                        label="Use specific dates instead of pattern"
                    />

                    {formState.useCustomDates ? (
                        /* Custom Dates Input */
                        <TextField
                            fullWidth
                            label="Custom Dates"
                            placeholder="Enter dates (YYYY-MM-DD), comma separated"
                            value={formState.customDates.join(', ')}
                            onChange={(e) => {
                                const dates = e.target.value
                                    .split(',')
                                    .map(d => d.trim())
                                    .filter(d => d);
                                handleFormChange('customDates', dates);
                            }}
                            helperText="Example: 2026-01-15, 2026-02-01, 2026-03-20"
                        />
                    ) : (
                        <>
                            {/* Frequency */}
                            <Stack direction="row" spacing={2}>
                                <FormControl sx={{ minWidth: 150 }}>
                                    <InputLabel>Repeat every</InputLabel>
                                    <Select
                                        value={formState.interval}
                                        onChange={(e) => handleFormChange('interval', e.target.value)}
                                        label="Repeat every"
                                    >
                                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12].map(n => (
                                            <MenuItem key={n} value={n}>{n}</MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>

                                <FormControl sx={{ minWidth: 150 }}>
                                    <InputLabel>Frequency</InputLabel>
                                    <Select
                                        value={formState.freq}
                                        onChange={(e) => handleFormChange('freq', e.target.value)}
                                        label="Frequency"
                                    >
                                        <MenuItem value="DAILY">Day(s)</MenuItem>
                                        <MenuItem value="WEEKLY">Week(s)</MenuItem>
                                        <MenuItem value="MONTHLY">Month(s)</MenuItem>
                                        <MenuItem value="YEARLY">Year(s)</MenuItem>
                                    </Select>
                                </FormControl>
                            </Stack>

                            {/* Weekly: Day Selection */}
                            {formState.freq === 'WEEKLY' && (
                                <Box>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                        <Typography variant="subtitle2">
                                            On these days:
                                        </Typography>
                                        <Chip
                                            label="Weekdays"
                                            size="small"
                                            variant="outlined"
                                            onClick={() => handleFormChange('selectedDays', weekdayDefaults)}
                                        />
                                    </Box>
                                    <ToggleButtonGroup
                                        value={formState.selectedDays}
                                        onChange={handleDayToggle}
                                        size="small"
                                    >
                                        {DAYS_OF_WEEK.map(day => (
                                            <ToggleButton key={day.value} value={day.value}>
                                                {day.short}
                                            </ToggleButton>
                                        ))}
                                    </ToggleButtonGroup>
                                </Box>
                            )}

                            {/* Monthly Options */}
                            {formState.freq === 'MONTHLY' && (
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                    <Chip
                                        label="Last weekday"
                                        size="small"
                                        variant="outlined"
                                        onClick={() => {
                                            handleFormChange('usePosition', true);
                                            handleFormChange('position', -1);
                                            handleFormChange('selectedDays', weekdayDefaults);
                                        }}
                                        sx={{ alignSelf: 'flex-start' }}
                                    />
                                    <FormControlLabel
                                        control={
                                            <Checkbox
                                                checked={formState.usePosition}
                                                onChange={(e) => handleFormChange('usePosition', e.target.checked)}
                                            />
                                        }
                                        label="Use day position (e.g., last Friday)"
                                    />

                                    {formState.usePosition ? (
                                        <Stack direction="row" spacing={2}>
                                            <FormControl sx={{ minWidth: 150 }}>
                                                <InputLabel>Position</InputLabel>
                                                <Select
                                                    value={formState.position}
                                                    onChange={(e) => handleFormChange('position', e.target.value)}
                                                    label="Position"
                                                >
                                                    {POSITION_OPTIONS.map(opt => (
                                                        <MenuItem key={opt.value} value={opt.value}>
                                                            {opt.label}
                                                        </MenuItem>
                                                    ))}
                                                </Select>
                                            </FormControl>

                                            <ToggleButtonGroup
                                                value={formState.selectedDays}
                                                onChange={handleDayToggle}
                                                size="small"
                                            >
                                                {DAYS_OF_WEEK.map(day => (
                                                    <ToggleButton key={day.value} value={day.value}>
                                                        {day.short}
                                                    </ToggleButton>
                                                ))}
                                            </ToggleButtonGroup>
                                        </Stack>
                                    ) : (
                                        <TextField
                                            type="number"
                                            label="Day of month"
                                            value={formState.monthDay}
                                            onChange={(e) => handleFormChange('monthDay', e.target.value)}
                                            inputProps={{ min: 1, max: 31 }}
                                            sx={{ width: 150 }}
                                            helperText="1-31, or -1 for last day"
                                        />
                                    )}
                                </Box>
                            )}

                            {formState.freq === 'YEARLY' && (
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                    <Box>
                                        <Typography variant="subtitle2" gutterBottom>
                                            Select months:
                                        </Typography>
                                        <ToggleButtonGroup
                                            value={formState.selectedMonths}
                                            onChange={handleMonthToggle}
                                            size="small"
                                        >
                                            {MONTHS.map(month => (
                                                <ToggleButton key={month.value} value={month.value}>
                                                    {month.label.slice(0, 3)}
                                                </ToggleButton>
                                            ))}
                                        </ToggleButtonGroup>
                                    </Box>
                                    <TextField
                                        type="number"
                                        label="Day of month"
                                        value={formState.monthDay}
                                        onChange={(e) => handleFormChange('monthDay', e.target.value)}
                                        inputProps={{ min: 1, max: 31 }}
                                        sx={{ width: 150 }}
                                        helperText="1-31, or -1 for last day"
                                    />
                                </Box>
                            )}

                            <Divider />

                            {/* End Conditions */}
                            <Typography variant="subtitle2">End condition (optional):</Typography>
                            
                            <Stack direction="row" spacing={2} alignItems="center">
                                <FormControlLabel
                                    control={
                                        <Checkbox
                                            checked={formState.useEndDate}
                                            onChange={(e) => {
                                                handleFormChange('useEndDate', e.target.checked);
                                                if (e.target.checked) handleFormChange('useCount', false);
                                            }}
                                        />
                                    }
                                    label="End by date"
                                />
                                {formState.useEndDate && (
                                    <TextField
                                        type="date"
                                        value={formState.endDate}
                                        onChange={(e) => handleFormChange('endDate', e.target.value)}
                                        size="small"
                                    />
                                )}
                            </Stack>

                            <Stack direction="row" spacing={2} alignItems="center">
                                <FormControlLabel
                                    control={
                                        <Checkbox
                                            checked={formState.useCount}
                                            onChange={(e) => {
                                                handleFormChange('useCount', e.target.checked);
                                                if (e.target.checked) handleFormChange('useEndDate', false);
                                            }}
                                        />
                                    }
                                    label="End after occurrences"
                                />
                                {formState.useCount && (
                                    <TextField
                                        type="number"
                                        value={formState.count}
                                        onChange={(e) => handleFormChange('count', e.target.value)}
                                        inputProps={{ min: 1, max: 999 }}
                                        size="small"
                                        sx={{ width: 100 }}
                                    />
                                )}
                            </Stack>
                        </>
                    )}
                </Box>
            )}

            {/* Validation Errors */}
            {errors.length > 0 && (
                <Alert severity="error">
                    {errors.map((err, i) => (
                        <div key={i}>{err}</div>
                    ))}
                </Alert>
            )}

            {/* Rule Summary */}
            {currentRule && errors.length === 0 && (
                <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                        Summary
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                        {getRuleSummary(currentRule)}
                    </Typography>
                </Paper>
            )}

            {/* Preview */}
            {showPreview && preview.length > 0 && (
                <Box>
                    <Typography variant="subtitle2" gutterBottom>
                        Next occurrences:
                    </Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        {preview.map((date, i) => (
                            <Chip key={i} label={date.formatted} size="small" variant="outlined" />
                        ))}
                    </Stack>
                </Box>
            )}
        </Box>
    );
}

export default RecurrenceRuleBuilder;
