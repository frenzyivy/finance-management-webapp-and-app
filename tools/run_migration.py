"""
Execute SQL migration files against Supabase.

Usage:
    python run_migration.py <migration_file_or_directory>

Examples:
    python run_migration.py ../supabase/migrations/20260410000001_create_profiles.sql
    python run_migration.py ../supabase/migrations/  # Runs all migrations in order
"""

import sys
import os
import glob
from supabase_client import get_client


def run_migration(client, filepath: str) -> bool:
    """Execute a single SQL migration file."""
    filename = os.path.basename(filepath)
    print(f"\n--- Running migration: {filename} ---")

    with open(filepath, 'r', encoding='utf-8') as f:
        sql = f.read()

    if not sql.strip():
        print(f"  Skipping empty file: {filename}")
        return True

    try:
        client.postgrest.session.headers.update({
            "Content-Type": "application/json"
        })
        # Execute SQL via Supabase's rpc or direct query
        result = client.rpc('exec_sql', {'query': sql}).execute()
        print(f"  ✓ Migration successful: {filename}")
        return True
    except Exception as e:
        print(f"  ✗ Migration failed: {filename}")
        print(f"    Error: {e}")
        print(f"    TIP: You can run this SQL manually in Supabase Dashboard → SQL Editor")
        return False


def main():
    if len(sys.argv) < 2:
        print("Usage: python run_migration.py <migration_file_or_directory>")
        sys.exit(1)

    path = sys.argv[1]
    client = get_client()

    if os.path.isdir(path):
        # Run all .sql files in directory, sorted by filename
        files = sorted(glob.glob(os.path.join(path, '*.sql')))
        if not files:
            print(f"No .sql files found in {path}")
            sys.exit(1)

        print(f"Found {len(files)} migration file(s)")
        success_count = 0
        fail_count = 0

        for filepath in files:
            if run_migration(client, filepath):
                success_count += 1
            else:
                fail_count += 1
                print(f"  Stopping at first failure. Fix and re-run.")
                break

        print(f"\nResults: {success_count} succeeded, {fail_count} failed")
    else:
        # Run single file
        if not os.path.exists(path):
            print(f"File not found: {path}")
            sys.exit(1)
        run_migration(client, path)


if __name__ == '__main__':
    main()
