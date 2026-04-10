"""
Generate TypeScript types from Supabase schema.
Runs the Supabase CLI to generate types and writes them to the web and mobile apps.

Usage:
    python generate_types.py

Prerequisites:
    - Supabase CLI installed (`npm install -g supabase`)
    - SUPABASE_URL and SUPABASE_SERVICE_KEY in .env
"""

import os
import subprocess
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

PROJECT_ROOT = os.path.join(os.path.dirname(__file__), '..')
WEB_TYPES_PATH = os.path.join(PROJECT_ROOT, 'web', 'src', 'types', 'database.ts')
MOBILE_TYPES_PATH = os.path.join(PROJECT_ROOT, 'mobile', 'src', 'types', 'database.ts')


def generate_types():
    """Generate TypeScript types using Supabase CLI."""
    supabase_url = os.getenv('SUPABASE_URL', '')
    project_ref = supabase_url.replace('https://', '').replace('.supabase.co', '')

    if not project_ref:
        print("ERROR: SUPABASE_URL not set in .env")
        return

    print(f"Generating types for project: {project_ref}")

    try:
        result = subprocess.run(
            ['npx', 'supabase', 'gen', 'types', 'typescript',
             '--project-id', project_ref],
            capture_output=True, text=True, cwd=PROJECT_ROOT
        )

        if result.returncode != 0:
            print(f"Error: {result.stderr}")
            print("TIP: Make sure you're logged in with `npx supabase login`")
            return

        types_content = result.stdout

        # Write to web app
        os.makedirs(os.path.dirname(WEB_TYPES_PATH), exist_ok=True)
        with open(WEB_TYPES_PATH, 'w', encoding='utf-8') as f:
            f.write(types_content)
        print(f"  ✓ Written to {WEB_TYPES_PATH}")

        # Write to mobile app
        os.makedirs(os.path.dirname(MOBILE_TYPES_PATH), exist_ok=True)
        with open(MOBILE_TYPES_PATH, 'w', encoding='utf-8') as f:
            f.write(types_content)
        print(f"  ✓ Written to {MOBILE_TYPES_PATH}")

        print("\nTypes generated successfully!")

    except FileNotFoundError:
        print("ERROR: Supabase CLI not found.")
        print("Install with: npm install -g supabase")


if __name__ == '__main__':
    generate_types()
