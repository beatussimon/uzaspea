import os
import gzip
import shutil
import tempfile
from datetime import datetime
from pathlib import Path
import urllib.request
import urllib.error

from django.core.management.base import BaseCommand
from django.conf import settings


class Command(BaseCommand):
    help = "Downloads and installs the latest free DB-IP Country Lite database (.mmdb)"

    def add_arguments(self, parser):
        parser.add_argument(
            '--non-fatal',
            action='store_true',
            help='Log warning and exit 0 if download or update fails (safe for automated CI/CD deployments).'
        )

    def handle(self, *args, **options):
        non_fatal = options.get('non_fatal', False)
        target_path = getattr(settings, 'GEOIP_MMDB_PATH', None)
        if not target_path:
            target_path = Path(settings.BASE_DIR) / 'geoip' / 'country.mmdb'
        target_path = Path(target_path)
        target_path.parent.mkdir(parents=True, exist_ok=True)

        now = datetime.utcnow()
        year = now.strftime('%Y')
        month = now.strftime('%m')

        # Candidates: current month, previous month
        prev_month = f"{now.month - 1:02d}" if now.month > 1 else "12"
        prev_year = year if now.month > 1 else str(now.year - 1)

        urls = [
            f"https://download.db-ip.com/free/dbip-country-lite-{year}-{month}.mmdb.gz",
            f"https://download.db-ip.com/free/dbip-country-lite-{prev_year}-{prev_month}.mmdb.gz",
        ]

        success = False
        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_gz = Path(tmp_dir) / 'download.mmdb.gz'
            tmp_mmdb = Path(tmp_dir) / 'country.mmdb'

            for url in urls:
                self.stdout.write(f"Attempting download from: {url}")
                try:
                    req = urllib.request.Request(
                        url,
                        headers={'User-Agent': 'SokoniMax-GeoIP-Updater/2.0'}
                    )
                    with urllib.request.urlopen(req, timeout=30) as response, open(tmp_gz, 'wb') as out_file:
                        shutil.copyfileobj(response, out_file)

                    # Decompress gzip
                    with gzip.open(tmp_gz, 'rb') as gz_in, open(tmp_mmdb, 'wb') as f_out:
                        shutil.copyfileobj(gz_in, f_out)

                    # Verify mmdb with maxminddb
                    try:
                        import maxminddb
                        with maxminddb.open_database(str(tmp_mmdb)) as reader:
                            test_lookup = reader.get('1.1.1.1')
                            self.stdout.write(self.style.SUCCESS(f"Verified MMDB: 1.1.1.1 resolved to {test_lookup.get('country', {}).get('iso_code', 'OK')}"))
                    except ImportError:
                        self.stdout.write(self.style.WARNING("maxminddb library not installed; skipping verification."))

                    # Atomic replace
                    target_tmp = target_path.with_suffix('.tmp')
                    shutil.copyfile(tmp_mmdb, target_tmp)
                    os.replace(target_tmp, target_path)

                    self.stdout.write(self.style.SUCCESS(f"Successfully installed country.mmdb to {target_path}"))
                    success = True
                    break
                except Exception as e:
                    self.stdout.write(self.style.WARNING(f"Failed to fetch or verify from {url}: {e}"))

        if not success:
            msg = "Could not download or update GeoIP country database from any mirror."
            if non_fatal:
                self.stdout.write(self.style.WARNING(f"NON-FATAL: {msg} Keeping existing database if present."))
            else:
                self.stderr.write(self.style.ERROR(msg))
                raise SystemExit(1)
