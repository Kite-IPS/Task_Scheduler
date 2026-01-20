#!/bin/bash
# Simple Backup Script - Best Practice
# Saves database + media files to organized backups folder

# Setup
BACKUP_FOLDER="backups/backup_$(date +%Y-%m-%d_%H-%M-%S)"
mkdir -p "$BACKUP_FOLDER"

echo "Creating backup..."

# 1. Export database from container
docker exec backend python manage.py dumpdata --indent 2 -o /app/data/temp.json

# 2. Copy database to backup folder
docker cp backend:/app/data/temp.json "$BACKUP_FOLDER/database.json"

# 3. Copy media files to backup folder
docker cp backend:/app/media "$BACKUP_FOLDER/media" 2>/dev/null

# 4. Cleanup temp file
docker exec backend rm /app/data/temp.json

echo "Done! Backup saved to: $BACKUP_FOLDER"

# Auto-cleanup: Keep only last 7 backups
BACKUP_COUNT=$(ls -d backups/backup_* 2>/dev/null | wc -l)
if [ $BACKUP_COUNT -gt 7 ]; then
    ls -dt backups/backup_* | tail -n +8 | xargs rm -rf
    echo "Old backups cleaned up"
fi
