import os
import shutil
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand


PRIVATE_SUBDIRS = (
    "payment_proofs",
    "promotion_proofs",
    "dispute_evidence",
    "seller_applications",
    "site_visits",
    "commission_receipts",
    "inspection_payment_proofs",
    "inspection_checkins",
    "inspection_checkouts",
    "inspection_evidence",
)


class Command(BaseCommand):
    help = "Relocates sensitive KYC, payment proof, dispute, and inspection media from public MEDIA_ROOT to PRIVATE_MEDIA_ROOT."

    def add_arguments(self, parser):
        parser.add_argument(
            "--commit",
            action="store_true",
            help="Perform file moves (default is dry-run).",
        )

    def handle(self, *args, **options):
        commit = bool(options.get("commit"))
        pub_root = Path(settings.MEDIA_ROOT).resolve()
        priv_root = Path(settings.PRIVATE_MEDIA_ROOT).resolve()
        priv_root.mkdir(parents=True, exist_ok=True)

        moved = 0
        skipped = 0

        for subdir in PRIVATE_SUBDIRS:
            src_dir = pub_root / subdir
            if not src_dir.exists():
                continue
            for root, _dirs, files in os.walk(src_dir):
                for fname in files:
                    src_file = Path(root) / fname
                    rel = src_file.relative_to(pub_root)
                    dst_file = priv_root / rel
                    if dst_file.exists():
                        skipped += 1
                        if commit:
                            try:
                                src_file.unlink()
                            except OSError:
                                pass
                        continue
                    if commit:
                        dst_file.parent.mkdir(parents=True, exist_ok=True)
                        shutil.move(str(src_file), str(dst_file))
                    moved += 1

        mode = "COMMITTED" if commit else "DRY-RUN"
        self.stdout.write(
            self.style.SUCCESS(
                f"[migrate_private_media] ({mode}) moved={moved}, already_present={skipped}, dest={priv_root}"
            )
        )
