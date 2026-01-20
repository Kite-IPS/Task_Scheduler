#!/bin/bash
# Restore Script for Task Schedule Application (Linux)

#!/bin/bash
# Simple Restore Script
# Restores database + media files from backup

# Show available backups if none specified
if [ -z "$1" ]; then
    echo "Available backups:"
    ls -dt backups/backup_* 2>/dev/null | while read backup; do echo "  $backup"; done
    echo ""
    echo "Usage: ./restore.sh backups/backup_2026-01-20_17-34-22"
    exit
fi

BACKUP_FOLDER=$1

# Check if backup exists
if [ ! -d "$BACKUP_FOLDER" ]; then
    echo "Error: Backup folder not found!"
    exit
fi

# Confirm before restoring
echo "WARNING: This will replace all current data!"
read -p "Continue? Type 'yes' to proceed: " confirm
if [ "$confirm" != "yes" ]; then
    echo "Cancelled"
    exit
fi

echo ""
echo "Restoring from: $BACKUP_FOLDER"

# 1. Start containers
docker-compose up -d
sleep 5

# 2. Copy database to container
docker cp "$BACKUP_FOLDER/database.json" backend:/app/data/restore.json

# 3. Clear old data and load backup
docker exec backend python manage.py flush --no-input
docker exec backend python manage.py loaddata /app/data/restore.json

# 4. Restore media files
if [ -d "$BACKUP_FOLDER/media" ]; then
    docker cp "$BACKUP_FOLDER/media" backend:/app/
fi

# 5. Cleanup
docker exec backend rm /app/data/restore.json

echo "Done! Data restored successfully"
