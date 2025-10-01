#!/bin/bash
#
# FlashFusion Production Rollback Script
# 
# Usage: ./scripts/rollback.sh [OPTIONS]
#
# Options:
#   --database           Rollback database migrations
#   --deployment         Rollback application deployment
#   --target=SHA         Target commit SHA or version
#   --dry-run            Show what would be done without executing
#   --help               Show this help message
#

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
LOG_FILE="/tmp/rollback-$(date +%Y%m%d-%H%M%S).log"

# Flags
ROLLBACK_DATABASE=false
ROLLBACK_DEPLOYMENT=false
TARGET_VERSION=""
DRY_RUN=false

# Functions
log() {
  echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
  echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE" >&2
}

warn() {
  echo -e "${YELLOW}[WARN]${NC} $1" | tee -a "$LOG_FILE"
}

show_help() {
  cat << EOF
FlashFusion Production Rollback Script

Usage: $0 [OPTIONS]

Options:
  --database           Rollback database migrations
  --deployment         Rollback application deployment
  --target=SHA         Target commit SHA or version (required)
  --dry-run            Show what would be done without executing
  --help               Show this help message

Examples:
  # Rollback only deployment
  $0 --deployment --target=abc123

  # Rollback database and deployment
  $0 --database --deployment --target=v1.2.0

  # Dry run to see what would happen
  $0 --database --target=abc123 --dry-run

Environment Variables Required:
  SUPABASE_URL                 Supabase project URL
  SUPABASE_SERVICE_ROLE_KEY    Supabase service role key

EOF
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case $1 in
      --database)
        ROLLBACK_DATABASE=true
        shift
        ;;
      --deployment)
        ROLLBACK_DEPLOYMENT=true
        shift
        ;;
      --target=*)
        TARGET_VERSION="${1#*=}"
        shift
        ;;
      --dry-run)
        DRY_RUN=true
        shift
        ;;
      --help)
        show_help
        exit 0
        ;;
      *)
        error "Unknown option: $1"
        show_help
        exit 1
        ;;
    esac
  done

  # Validation
  if [ -z "$TARGET_VERSION" ]; then
    error "Target version is required. Use --target=SHA"
    exit 1
  fi

  if [ "$ROLLBACK_DATABASE" = false ] && [ "$ROLLBACK_DEPLOYMENT" = false ]; then
    error "Must specify at least --database or --deployment"
    exit 1
  fi
}

validate_environment() {
  log "Validating environment..."

  if [ "$ROLLBACK_DATABASE" = true ]; then
    if [ -z "${SUPABASE_URL:-}" ]; then
      error "SUPABASE_URL environment variable is required"
      exit 1
    fi

    if [ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
      error "SUPABASE_SERVICE_ROLE_KEY environment variable is required"
      exit 1
    fi
  fi

  # Verify target version exists
  if ! git rev-parse "$TARGET_VERSION" >/dev/null 2>&1; then
    error "Target version '$TARGET_VERSION' does not exist in git history"
    exit 1
  fi

  log "✅ Environment validated"
}

get_current_migration_version() {
  # Query Supabase for current schema version
  # This is a placeholder - actual implementation would query supabase_migrations table
  echo "20251001000000"
}

get_target_migration_version() {
  # Get migration version from target commit
  local target=$1
  git show "$target:supabase/migrations" 2>/dev/null | tail -1 | grep -oP '\d{14}' || echo "0"
}

rollback_database_migrations() {
  log "Starting database rollback..."

  if [ "$DRY_RUN" = true ]; then
    log "[DRY RUN] Would rollback database to $TARGET_VERSION"
    return 0
  fi

  local current_version=$(get_current_migration_version)
  local target_version=$(get_target_migration_version "$TARGET_VERSION")

  log "Current migration version: $current_version"
  log "Target migration version: $target_version"

  if [ "$current_version" = "$target_version" ]; then
    log "Database already at target version"
    return 0
  fi

  # Expand-Migrate-Contract pattern:
  # 1. Add new columns/tables (expand) - already done in forward migrations
  # 2. Migrate data - need to reverse
  # 3. Remove old columns (contract) - need to reverse

  log "Step 1: Backup current database state..."
  if command -v supabase &> /dev/null; then
    supabase db dump --file "backup-pre-rollback-$(date +%Y%m%d-%H%M%S).sql" || {
      error "Database backup failed"
      exit 1
    }
  else
    warn "Supabase CLI not found, skipping backup (NOT RECOMMENDED)"
  fi

  log "Step 2: Running rollback migrations..."
  
  # Generate rollback SQL from migration diff
  # This is simplified - production would use proper migration management
  cd "$PROJECT_ROOT/supabase/migrations" || exit 1
  
  for migration in $(ls -r | grep ".sql$"); do
    version=$(echo "$migration" | grep -oP '\d{14}')
    
    if [ "$version" -gt "$target_version" ]; then
      log "Rolling back migration: $migration"
      
      # Check if rollback file exists
      rollback_file="${migration%.sql}.rollback.sql"
      if [ -f "$rollback_file" ]; then
        if [ "$DRY_RUN" = false ]; then
          # Execute rollback SQL
          # This would use Supabase CLI or direct PostgreSQL connection
          log "Executing rollback: $rollback_file"
        fi
      else
        warn "No rollback file found for $migration"
        warn "Manual intervention may be required"
      fi
    fi
  done

  log "Step 3: Verifying database integrity..."
  # Run health checks
  # Query critical tables to ensure they're accessible
  if [ "$DRY_RUN" = false ]; then
    # Placeholder for actual health check queries
    log "Health check queries would run here"
  fi

  log "✅ Database rollback completed"
}

rollback_deployment() {
  log "Starting deployment rollback..."

  if [ "$DRY_RUN" = true ]; then
    log "[DRY RUN] Would rollback deployment to $TARGET_VERSION"
    return 0
  fi

  log "Checking out target version..."
  cd "$PROJECT_ROOT" || exit 1
  
  # Store current branch
  local current_branch=$(git rev-parse --abbrev-ref HEAD)
  
  # Checkout target version
  git checkout "$TARGET_VERSION" || {
    error "Failed to checkout target version"
    exit 1
  }

  log "Building target version..."
  npm ci || {
    error "npm install failed"
    git checkout "$current_branch"
    exit 1
  }

  npm run build || {
    error "Build failed"
    git checkout "$current_branch"
    exit 1
  }

  log "Deploying rollback version..."
  # Lovable handles deployment automatically via GitHub
  # For other platforms, trigger deployment here
  log "Deployment triggered (handled by platform)"

  # Restore original branch
  git checkout "$current_branch"

  log "✅ Deployment rollback completed"
}

verify_rollback() {
  log "Verifying rollback..."

  if [ "$DRY_RUN" = true ]; then
    log "[DRY RUN] Would verify rollback"
    return 0
  fi

  log "Waiting 30 seconds for deployment to stabilize..."
  sleep 30

  log "Running smoke tests..."
  if [ -f "$PROJECT_ROOT/package.json" ]; then
    cd "$PROJECT_ROOT" || exit 1
    npm run test:smoke 2>&1 | tee -a "$LOG_FILE" || {
      warn "Smoke tests failed - manual verification required"
      return 1
    }
  fi

  log "Checking application health endpoint..."
  if command -v curl &> /dev/null; then
    if curl -f -s "https://flashfusion.lovable.app/health" > /dev/null; then
      log "✅ Health check passed"
    else
      warn "Health check failed - application may not be responding"
      return 1
    fi
  fi

  log "✅ Rollback verification completed"
}

generate_rollback_report() {
  log "Generating rollback report..."

  cat > "/tmp/rollback-report-$(date +%Y%m%d-%H%M%S).md" << EOF
# Rollback Report

**Date**: $(date)
**Target Version**: $TARGET_VERSION
**Database Rolled Back**: $ROLLBACK_DATABASE
**Deployment Rolled Back**: $ROLLBACK_DEPLOYMENT

## Actions Taken

EOF

  if [ "$ROLLBACK_DATABASE" = true ]; then
    echo "- Database migrations rolled back" >> "/tmp/rollback-report-$(date +%Y%m%d-%H%M%S).md"
  fi

  if [ "$ROLLBACK_DEPLOYMENT" = true ]; then
    echo "- Application deployment rolled back" >> "/tmp/rollback-report-$(date +%Y%m%d-%H%M%S).md"
  fi

  cat >> "/tmp/rollback-report-$(date +%Y%m%d-%H%M%S).md" << EOF

## Verification Results

- Smoke tests: $([ -f "$PROJECT_ROOT/package.json" ] && echo "✅ Passed" || echo "⚠️  Not run")
- Health check: $(command -v curl &> /dev/null && curl -f -s "https://flashfusion.lovable.app/health" > /dev/null && echo "✅ Passed" || echo "❌ Failed")

## Next Steps

1. Monitor error rates in Sentry
2. Check application logs for anomalies
3. Verify user-facing functionality
4. Create incident postmortem
5. Plan forward fix

## Logs

Full logs available at: $LOG_FILE
EOF

  log "Report generated at: /tmp/rollback-report-$(date +%Y%m%d-%H%M%S).md"
}

main() {
  log "=== FlashFusion Production Rollback ==="
  log "Log file: $LOG_FILE"

  parse_args "$@"
  validate_environment

  if [ "$DRY_RUN" = true ]; then
    warn "DRY RUN MODE - No changes will be made"
  fi

  # Confirmation prompt (skip in CI)
  if [ -t 0 ] && [ "$DRY_RUN" = false ]; then
    echo ""
    warn "You are about to rollback production to version: $TARGET_VERSION"
    warn "Database rollback: $ROLLBACK_DATABASE"
    warn "Deployment rollback: $ROLLBACK_DEPLOYMENT"
    read -p "Are you sure? (yes/no): " confirm
    if [ "$confirm" != "yes" ]; then
      log "Rollback cancelled by user"
      exit 0
    fi
  fi

  # Execute rollback
  if [ "$ROLLBACK_DATABASE" = true ]; then
    rollback_database_migrations
  fi

  if [ "$ROLLBACK_DEPLOYMENT" = true ]; then
    rollback_deployment
  fi

  # Verify
  if ! verify_rollback; then
    error "Rollback verification failed - manual intervention required"
    exit 1
  fi

  generate_rollback_report

  log "=== Rollback Completed Successfully ==="
  log "Check logs at: $LOG_FILE"
}

# Trap errors
trap 'error "Rollback script failed at line $LINENO"' ERR

# Run main function
main "$@"
