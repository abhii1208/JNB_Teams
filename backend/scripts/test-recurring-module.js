/**
 * Comprehensive Test Script for Recurring Module
 * Tests all CRUD operations and edge cases
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';
let authToken = '';
let workspaceId = null;
let projectId = null;
let userId = null;
let seriesId = null;

// Color codes for console output
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m'
};

const log = {
    success: (msg) => console.log(`${colors.green}✓ ${msg}${colors.reset}`),
    error: (msg) => console.log(`${colors.red}✗ ${msg}${colors.reset}`),
    info: (msg) => console.log(`${colors.blue}ℹ ${msg}${colors.reset}`),
    warn: (msg) => console.log(`${colors.yellow}⚠ ${msg}${colors.reset}`)
};

/**
 * Login and get token
 */
async function login() {
    try {
        log.info('Logging in...');
        const response = await axios.post(`${BASE_URL}/user/login`, {
            identifier: 'demo@example.com',
            password: 'demo123'
        });
        
        authToken = response.data.token;
        userId = response.data.user.id;
        log.success(`Logged in as user ${userId}`);
        return response.data;
    } catch (error) {
        log.error(`Login failed: ${error.response?.data?.error || error.message}`);
        throw error;
    }
}

/**
 * Get workspace
 */
async function getWorkspace() {
    try {
        log.info('Fetching workspaces...');
        const response = await axios.get(`${BASE_URL}/workspaces`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        
        if (response.data.length === 0) {
            throw new Error('No workspaces found');
        }
        
        workspaceId = response.data[0].id;
        log.success(`Using workspace ${workspaceId}`);
        return response.data[0];
    } catch (error) {
        log.error(`Get workspace failed: ${error.response?.data?.error || error.message}`);
        throw error;
    }
}

/**
 * Get or create project
 */
async function getOrCreateProject() {
    try {
        log.info('Fetching projects...');
        const response = await axios.get(`${BASE_URL}/projects`, {
            headers: { Authorization: `Bearer ${authToken}` },
            params: { workspace_id: workspaceId }
        });
        
        if (response.data.length > 0) {
            projectId = response.data[0].id;
            log.success(`Using existing project ${projectId}`);
        } else {
            log.info('Creating new project...');
            const createResponse = await axios.post(
                `${BASE_URL}/projects`,
                {
                    name: 'Test Recurring Project',
                    workspace_id: workspaceId,
                    description: 'Project for testing recurring tasks'
                },
                { headers: { Authorization: `Bearer ${authToken}` } }
            );
            projectId = createResponse.data.id;
            log.success(`Created project ${projectId}`);
        }
        return projectId;
    } catch (error) {
        log.error(`Get/Create project failed: ${error.response?.data?.error || error.message}`);
        throw error;
    }
}

/**
 * Test: Get recurrence presets
 */
async function testGetPresets() {
    try {
        log.info('Testing GET /recurring/presets...');
        const response = await axios.get(`${BASE_URL}/recurring/presets`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        
        if (response.data.length > 0) {
            log.success(`Fetched ${response.data.length} presets`);
            console.log('Sample preset:', JSON.stringify(response.data[0], null, 2));
            return true;
        } else {
            log.warn('No presets returned');
            return false;
        }
    } catch (error) {
        log.error(`Get presets failed: ${error.response?.data?.error || error.message}`);
        return false;
    }
}

/**
 * Test: Validate recurrence rule
 */
async function testValidateRule() {
    try {
        log.info('Testing POST /recurring/validate...');
        
        // Valid rule
        const validResponse = await axios.post(
            `${BASE_URL}/recurring/validate`,
            {
                rule: {
                    frequency: 'daily',
                    interval: 1
                }
            },
            { headers: { Authorization: `Bearer ${authToken}` } }
        );
        
        if (validResponse.data.valid) {
            log.success('Valid rule validated successfully');
            console.log('Summary:', validResponse.data.summary);
        } else {
            log.error('Valid rule marked as invalid');
            return false;
        }
        
        // Invalid rule
        try {
            await axios.post(
                `${BASE_URL}/recurring/validate`,
                {
                    rule: {
                        frequency: 'invalid_freq'
                    }
                },
                { headers: { Authorization: `Bearer ${authToken}` } }
            );
            log.error('Invalid rule not caught');
            return false;
        } catch (error) {
            if (error.response?.status === 400) {
                log.success('Invalid rule properly rejected');
            } else {
                throw error;
            }
        }
        
        return true;
    } catch (error) {
        log.error(`Validate rule failed: ${error.response?.data?.error || error.message}`);
        return false;
    }
}

/**
 * Test: Preview occurrences
 */
async function testPreviewOccurrences() {
    try {
        log.info('Testing POST /recurring/preview...');
        const response = await axios.post(
            `${BASE_URL}/recurring/preview`,
            {
                rule: {
                    frequency: 'weekly',
                    interval: 1,
                    byWeekday: ['monday', 'wednesday', 'friday']
                },
                startDate: '2026-01-15',
                timezone: 'UTC',
                count: 5
            },
            { headers: { Authorization: `Bearer ${authToken}` } }
        );
        
        if (response.data.occurrences && response.data.occurrences.length > 0) {
            log.success(`Generated ${response.data.occurrences.length} preview occurrences`);
            console.log('Preview:', response.data.occurrences.slice(0, 3));
            return true;
        } else {
            log.error('No occurrences in preview');
            return false;
        }
    } catch (error) {
        log.error(`Preview failed: ${error.response?.data?.error || error.message}`);
        return false;
    }
}

/**
 * Test: Create recurring series
 */
async function testCreateSeries() {
    try {
        log.info('Testing POST /recurring - Create series...');
        const response = await axios.post(
            `${BASE_URL}/recurring`,
            {
                workspace_id: workspaceId,
                project_id: projectId,
                title: 'Daily Standup Meeting',
                description: 'Team daily standup',
                recurrence_rule: {
                    frequency: 'daily',
                    interval: 1,
                    byWeekday: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
                },
                timezone: 'UTC',
                start_date: '2026-01-15',
                end_date: '2026-03-31',
                assignment_strategy: 'static',
                static_assignee_id: userId,
                template: {
                    priority: 'Medium',
                    notes: 'Daily check-in',
                    estimated_hours: 0.25
                }
            },
            { headers: { Authorization: `Bearer ${authToken}` } }
        );
        
        if (response.data.id) {
            seriesId = response.data.id;
            log.success(`Created series ${seriesId}`);
            console.log('Series:', JSON.stringify(response.data, null, 2));
            return true;
        } else {
            log.error('No ID returned for created series');
            return false;
        }
    } catch (error) {
        log.error(`Create series failed: ${error.response?.data?.error || error.message}`);
        console.error('Error details:', error.response?.data);
        return false;
    }
}

/**
 * Test: List series in workspace
 */
async function testListSeries() {
    try {
        log.info('Testing GET /recurring/workspace/:workspaceId...');
        const response = await axios.get(
            `${BASE_URL}/recurring/workspace/${workspaceId}`,
            {
                headers: { Authorization: `Bearer ${authToken}` },
                params: {
                    includePaused: true,
                    includeDeleted: false
                }
            }
        );
        
        if (Array.isArray(response.data)) {
            log.success(`Found ${response.data.length} series in workspace`);
            if (response.data.length > 0) {
                console.log('First series:', JSON.stringify(response.data[0], null, 2));
            }
            return true;
        } else {
            log.error('Invalid response format');
            return false;
        }
    } catch (error) {
        log.error(`List series failed: ${error.response?.data?.error || error.message}`);
        console.error('Status:', error.response?.status);
        console.error('Data:', error.response?.data);
        return false;
    }
}

/**
 * Test: Get single series
 */
async function testGetSeries() {
    try {
        if (!seriesId) {
            log.warn('No series ID available, skipping');
            return false;
        }
        
        log.info(`Testing GET /recurring/${seriesId}...`);
        const response = await axios.get(
            `${BASE_URL}/recurring/${seriesId}`,
            { headers: { Authorization: `Bearer ${authToken}` } }
        );
        
        if (response.data.id === seriesId) {
            log.success('Fetched series details');
            console.log('Recent instances:', response.data.recent_instances?.length || 0);
            return true;
        } else {
            log.error('Wrong series returned');
            return false;
        }
    } catch (error) {
        log.error(`Get series failed: ${error.response?.data?.error || error.message}`);
        return false;
    }
}

/**
 * Test: Update series
 */
async function testUpdateSeries() {
    try {
        if (!seriesId) {
            log.warn('No series ID available, skipping');
            return false;
        }
        
        log.info(`Testing PUT /recurring/${seriesId}...`);
        const response = await axios.put(
            `${BASE_URL}/recurring/${seriesId}`,
            {
                title: 'Daily Standup Meeting (Updated)',
                description: 'Updated description'
            },
            { headers: { Authorization: `Bearer ${authToken}` } }
        );
        
        if (response.data.title === 'Daily Standup Meeting (Updated)') {
            log.success('Series updated successfully');
            return true;
        } else {
            log.error('Series not updated properly');
            return false;
        }
    } catch (error) {
        log.error(`Update series failed: ${error.response?.data?.error || error.message}`);
        return false;
    }
}

/**
 * Test: Pause series
 */
async function testPauseSeries() {
    try {
        if (!seriesId) {
            log.warn('No series ID available, skipping');
            return false;
        }
        
        log.info(`Testing POST /recurring/${seriesId}/pause...`);
        const response = await axios.post(
            `${BASE_URL}/recurring/${seriesId}/pause`,
            {},
            { headers: { Authorization: `Bearer ${authToken}` } }
        );
        
        if (response.data.series.paused_at) {
            log.success('Series paused successfully');
            return true;
        } else {
            log.error('Series not paused');
            return false;
        }
    } catch (error) {
        log.error(`Pause series failed: ${error.response?.data?.error || error.message}`);
        return false;
    }
}

/**
 * Test: Resume series
 */
async function testResumeSeries() {
    try {
        if (!seriesId) {
            log.warn('No series ID available, skipping');
            return false;
        }
        
        log.info(`Testing POST /recurring/${seriesId}/resume...`);
        const response = await axios.post(
            `${BASE_URL}/recurring/${seriesId}/resume`,
            {},
            { headers: { Authorization: `Bearer ${authToken}` } }
        );
        
        if (!response.data.series.paused_at) {
            log.success('Series resumed successfully');
            return true;
        } else {
            log.error('Series still paused');
            return false;
        }
    } catch (error) {
        log.error(`Resume series failed: ${error.response?.data?.error || error.message}`);
        return false;
    }
}

/**
 * Test: Add exception
 */
async function testAddException() {
    try {
        if (!seriesId) {
            log.warn('No series ID available, skipping');
            return false;
        }
        
        log.info(`Testing POST /recurring/${seriesId}/exception...`);
        const response = await axios.post(
            `${BASE_URL}/recurring/${seriesId}/exception`,
            {
                original_date: '2026-01-20',
                exception_type: 'skip',
                reason: 'Holiday'
            },
            { headers: { Authorization: `Bearer ${authToken}` } }
        );
        
        if (response.data.exception) {
            log.success('Exception added successfully');
            return true;
        } else {
            log.error('Exception not added');
            return false;
        }
    } catch (error) {
        log.error(`Add exception failed: ${error.response?.data?.error || error.message}`);
        return false;
    }
}

/**
 * Test: Manual generation
 */
async function testManualGeneration() {
    try {
        if (!seriesId) {
            log.warn('No series ID available, skipping');
            return false;
        }
        
        log.info(`Testing POST /recurring/${seriesId}/generate...`);
        const response = await axios.post(
            `${BASE_URL}/recurring/${seriesId}/generate`,
            { maxInstances: 5 },
            { headers: { Authorization: `Bearer ${authToken}` } }
        );
        
        if (response.data.generated !== undefined) {
            log.success(`Generated ${response.data.generated} instances`);
            console.log('Result:', response.data);
            return true;
        } else {
            log.error('No generation result');
            return false;
        }
    } catch (error) {
        log.error(`Manual generation failed: ${error.response?.data?.error || error.message}`);
        return false;
    }
}

/**
 * Test: Delete series
 */
async function testDeleteSeries() {
    try {
        if (!seriesId) {
            log.warn('No series ID available, skipping');
            return false;
        }
        
        log.info(`Testing DELETE /recurring/${seriesId}...`);
        const response = await axios.delete(
            `${BASE_URL}/recurring/${seriesId}`,
            { headers: { Authorization: `Bearer ${authToken}` } }
        );
        
        if (response.data.deleted) {
            log.success('Series deleted successfully');
            return true;
        } else {
            log.error('Series not deleted');
            return false;
        }
    } catch (error) {
        log.error(`Delete series failed: ${error.response?.data?.error || error.message}`);
        return false;
    }
}

/**
 * Main test runner
 */
async function runTests() {
    console.log('\n========================================');
    console.log('  RECURRING MODULE TEST SUITE');
    console.log('========================================\n');
    
    const results = {
        passed: 0,
        failed: 0,
        skipped: 0
    };
    
    try {
        // Setup
        await login();
        await getWorkspace();
        await getOrCreateProject();
        
        console.log('\n--- Running Tests ---\n');
        
        // Run all tests
        const tests = [
            { name: 'Get Presets', fn: testGetPresets },
            { name: 'Validate Rule', fn: testValidateRule },
            { name: 'Preview Occurrences', fn: testPreviewOccurrences },
            { name: 'Create Series', fn: testCreateSeries },
            { name: 'List Series', fn: testListSeries },
            { name: 'Get Series', fn: testGetSeries },
            { name: 'Update Series', fn: testUpdateSeries },
            { name: 'Pause Series', fn: testPauseSeries },
            { name: 'Resume Series', fn: testResumeSeries },
            { name: 'Add Exception', fn: testAddException },
            { name: 'Manual Generation', fn: testManualGeneration },
            { name: 'Delete Series', fn: testDeleteSeries }
        ];
        
        for (const test of tests) {
            try {
                const result = await test.fn();
                if (result) {
                    results.passed++;
                } else {
                    results.failed++;
                }
            } catch (error) {
                log.error(`Test "${test.name}" threw error: ${error.message}`);
                results.failed++;
            }
            console.log(''); // Blank line between tests
        }
        
    } catch (error) {
        log.error(`Test suite failed: ${error.message}`);
    }
    
    // Summary
    console.log('\n========================================');
    console.log('  TEST RESULTS');
    console.log('========================================');
    console.log(`${colors.green}Passed: ${results.passed}${colors.reset}`);
    console.log(`${colors.red}Failed: ${results.failed}${colors.reset}`);
    console.log(`${colors.yellow}Skipped: ${results.skipped}${colors.reset}`);
    console.log(`Total: ${results.passed + results.failed + results.skipped}`);
    console.log('========================================\n');
    
    process.exit(results.failed > 0 ? 1 : 0);
}

// Run tests
runTests().catch(error => {
    log.error(`Fatal error: ${error.message}`);
    process.exit(1);
});
