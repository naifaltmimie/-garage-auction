#!/usr/bin/env python3
"""Create a deterministic image-search worklist for the transferred car catalogue.

This intentionally does not scrape/download arbitrary copyrighted images. It reads all
cars-*.csv files and writes `image_search_worklist.csv` with the desired filename and
a search query Claude/a developer can use when sourcing appropriately licensed images.
"""

from __future__ import annotations

import csv
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE / "image_search_worklist.csv"


def iter_cars():
    for path in sorted(HERE.glob("cars-*.csv")):
        with path.open("r", encoding="utf-8-sig", newline="") as f:
            yield from csv.DictReader(f)


def main() -> None:
    rows = []
    for car in iter_cars():
        rows.append(
            {
                "id": car["id"],
                "name": car["name"],
                "image_filename": car["image_filename"],
                "search_query": f'{car["brand"]} {car["model"]} {car["year"]} {car["trim"]} exterior car',
            }
        )

    with OUT.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(
            f, fieldnames=["id", "name", "image_filename", "search_query"]
        )
        writer.writeheader()
        writer.writerows(rows)

    print(f"Wrote {len(rows)} rows to {OUT.name}")


if __name__ == "__main__":
    main()
