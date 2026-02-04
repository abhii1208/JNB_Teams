#!/bin/bash

echo "Starting backend server..."
cd /c/Projects/team/backend

# Kill any existing processes on port 5000
netstat -ano | grep :5000 | awk '{print $5}' | sort -u | xargs -I {} taskkill /PID {} /F 2>/dev/null

# Start the server
npm start