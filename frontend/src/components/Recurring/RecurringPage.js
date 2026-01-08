import React, { useState } from 'react';
import { Box } from '@mui/material';
import SeriesList from './SeriesList';
import SeriesForm from './SeriesForm';
import SeriesDetail from './SeriesDetail';

/**
 * RecurringPage - Container component for recurring module
 * Manages view state and renders appropriate child component
 */
function RecurringPage({ workspace, user }) {
    // View states: 'list', 'create', 'edit', 'detail'
    const [view, setView] = useState('list');
    const [selectedSeries, setSelectedSeries] = useState(null);

    // Navigation handlers
    const handleCreate = () => {
        setSelectedSeries(null);
        setView('create');
    };

    const handleEdit = (series) => {
        setSelectedSeries(series);
        setView('edit');
    };

    const handleViewDetail = (seriesId) => {
        setSelectedSeries({ id: seriesId });
        setView('detail');
    };

    const handleBack = () => {
        setSelectedSeries(null);
        setView('list');
    };

    const handleSaveSuccess = () => {
        setSelectedSeries(null);
        setView('list');
    };

    // Render appropriate view
    const renderView = () => {
        switch (view) {
            case 'create':
                return (
                    <SeriesForm
                        workspace={workspace}
                        onCancel={handleBack}
                        onSuccess={handleSaveSuccess}
                    />
                );
            case 'edit':
                return (
                    <SeriesForm
                        workspace={workspace}
                        series={selectedSeries}
                        onCancel={handleBack}
                        onSuccess={handleSaveSuccess}
                    />
                );
            case 'detail':
                return (
                    <SeriesDetail
                        seriesId={selectedSeries?.id}
                        workspace={workspace}
                        onBack={handleBack}
                        onEdit={handleEdit}
                    />
                );
            case 'list':
            default:
                return (
                    <SeriesList
                        workspace={workspace}
                        onCreateNew={handleCreate}
                        onEdit={handleEdit}
                        onViewDetail={handleViewDetail}
                    />
                );
        }
    };

    return (
        <Box sx={{ height: '100%', overflow: 'auto' }}>
            {renderView()}
        </Box>
    );
}

export default RecurringPage;
