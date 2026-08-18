# Car data

This folder contains the newer Saudi vehicle catalogue that was saved alongside the auction project.

## Catalogue

The 167-row catalogue is split into four CSV files so it can be transferred reliably through the GitHub connector:

- `cars-001-045.csv`
- `cars-046-090.csv`
- `cars-091-135.csv`
- `cars-136-167.csv`

Each file repeats the same header. When importing into a database, read all four files and concatenate their rows.

If you want one local file on macOS/Linux:

```bash
(head -n 1 cars-001-045.csv && tail -n +2 -q cars-*.csv) > cars.csv
```

The important fields are `id`, Arabic name, brand, model, year, trim, specs, category, and the intended `image_filename`.

## Images

The actual vehicle image binaries are not included in this GitHub migration. `image_filename` is retained so downloaded/relicensed images can be mapped deterministically later. The app already has `public/cars/placeholder.svg` as a graceful fallback.

For the first multiplayer version, prioritize the catalogue/gameplay over filling every image. Claude can later add an image-fetch/import pipeline using sources that permit the intended use.
