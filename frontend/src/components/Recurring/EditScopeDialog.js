import React, { useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Radio,
    RadioGroup,
    FormControlLabel,
    FormControl,
    Typography,
    Box,
    Alert
} from '@mui/material';
import { formatLongDate } from '../../utils/date';

/**
 * EditScopeDialog Component
 * Prompts user to choose edit scope: This only / This and future / Entire series
 * 
 * @param {object} props
 * @param {boolean} props.open - Whether dialog is open
 * @param {function} props.onClose - Called when dialog is closed
 * @param {function} props.onConfirm - Called with selected scope: 'this' | 'future' | 'series'
 * @param {string} props.taskDate - The date of the task being edited
 * @param {string} props.entityType - 'task' or 'series' (for display text)
 */
function EditScopeDialog({ 
    open, 
    onClose, 
    onConfirm, 
    taskDate,
    entityType = 'task' 
}) {
    const [scope, setScope] = useState('this');
    const [loading, setLoading] = useState(false);

    const handleConfirm = async () => {
        setLoading(true);
        try {
            await onConfirm(scope);
            onClose();
        } catch (err) {
            console.error('Edit scope error:', err);
        } finally {
            setLoading(false);
        }
    };

    const scopeDescriptions = {
        this: `Only this occurrence on ${taskDate ? (formatLongDate(taskDate) || 'this date') : 'this date'} will be changed.`,
        future: 'This and all future occurrences will be updated. A new series will be created.',
        series: 'All occurrences in the series will be updated. Past completed tasks remain unchanged.'
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>
                Edit Recurring {entityType === 'task' ? 'Task' : 'Series'}
            </DialogTitle>
            
            <DialogContent>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    This {entityType} is part of a recurring series. Choose what to update:
                </Typography>

                <FormControl component="fieldset" fullWidth>
                    <RadioGroup
                        value={scope}
                        onChange={(e) => setScope(e.target.value)}
                    >
                        <Box sx={{ mb: 2 }}>
                            <FormControlLabel
                                value="this"
                                control={<Radio />}
                                label={<strong>This occurrence only</strong>}
                            />
                            <Typography variant="body2" color="text.secondary" sx={{ ml: 4 }}>
                                {scopeDescriptions.this}
                            </Typography>
                        </Box>

                        <Box sx={{ mb: 2 }}>
                            <FormControlLabel
                                value="future"
                                control={<Radio />}
                                label={<strong>This and future occurrences</strong>}
                            />
                            <Typography variant="body2" color="text.secondary" sx={{ ml: 4 }}>
                                {scopeDescriptions.future}
                            </Typography>
                        </Box>

                        <Box>
                            <FormControlLabel
                                value="series"
                                control={<Radio />}
                                label={<strong>All occurrences in the series</strong>}
                            />
                            <Typography variant="body2" color="text.secondary" sx={{ ml: 4 }}>
                                {scopeDescriptions.series}
                            </Typography>
                        </Box>
                    </RadioGroup>
                </FormControl>

                {scope === 'future' && (
                    <Alert severity="info" sx={{ mt: 2 }}>
                        This will split the series. Past tasks stay with the original series, 
                        future tasks will belong to a new series.
                    </Alert>
                )}

                {scope === 'series' && (
                    <Alert severity="warning" sx={{ mt: 2 }}>
                        Only future unfinished tasks will be regenerated. 
                        Completed tasks are never modified.
                    </Alert>
                )}
            </DialogContent>

            <DialogActions>
                <Button onClick={onClose} disabled={loading}>
                    Cancel
                </Button>
                <Button 
                    onClick={handleConfirm} 
                    variant="contained" 
                    disabled={loading}
                >
                    {loading ? 'Updating...' : 'Continue'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}

/**
 * DeleteScopeDialog Component
 * Prompts user to choose delete scope for recurring tasks
 */
function DeleteScopeDialog({
    open,
    onClose,
    onConfirm,
    taskDate
}) {
    const [scope, setScope] = useState('this');
    const [loading, setLoading] = useState(false);

    const handleConfirm = async () => {
        setLoading(true);
        try {
            await onConfirm(scope);
            onClose();
        } catch (err) {
            console.error('Delete scope error:', err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>Delete Recurring Task</DialogTitle>
            
            <DialogContent>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    This task is part of a recurring series. Choose what to delete:
                </Typography>

                <FormControl component="fieldset" fullWidth>
                    <RadioGroup
                        value={scope}
                        onChange={(e) => setScope(e.target.value)}
                    >
                        <Box sx={{ mb: 2 }}>
                            <FormControlLabel
                                value="this"
                                control={<Radio />}
                                label={<strong>This occurrence only</strong>}
                            />
                            <Typography variant="body2" color="text.secondary" sx={{ ml: 4 }}>
                                Delete this task. The series will skip this date in the future.
                            </Typography>
                        </Box>

                        <Box sx={{ mb: 2 }}>
                            <FormControlLabel
                                value="future"
                                control={<Radio />}
                                label={<strong>This and all future occurrences</strong>}
                            />
                            <Typography variant="body2" color="text.secondary" sx={{ ml: 4 }}>
                                End the series from this date onwards.
                            </Typography>
                        </Box>

                        <Box>
                            <FormControlLabel
                                value="series"
                                control={<Radio />}
                                label={<strong>Entire series</strong>}
                            />
                            <Typography variant="body2" color="text.secondary" sx={{ ml: 4 }}>
                                Delete the series. All generated tasks will be preserved but unlinked.
                            </Typography>
                        </Box>
                    </RadioGroup>
                </FormControl>

                <Alert severity="warning" sx={{ mt: 2 }}>
                    Completed tasks are never deleted. This action cannot be undone.
                </Alert>
            </DialogContent>

            <DialogActions>
                <Button onClick={onClose} disabled={loading}>
                    Cancel
                </Button>
                <Button 
                    onClick={handleConfirm} 
                    variant="contained" 
                    color="error"
                    disabled={loading}
                >
                    {loading ? 'Deleting...' : 'Delete'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}

export { EditScopeDialog, DeleteScopeDialog };
export default EditScopeDialog;
