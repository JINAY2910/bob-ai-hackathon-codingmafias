"""Command-line entry point for Feature 2."""

import argparse

from .berth_crane_optimizer import optimize_feature2


def main() -> None:
    parser = argparse.ArgumentParser(description="Optimize berth and quay-crane assignments.")
    parser.add_argument("--input-dir", default="data/feature2")
    parser.add_argument("--output-dir", default="data/feature2/results")
    parser.add_argument("--max-service-hours", type=float, default=72.0)
    parser.add_argument("--limit", type=int, default=None)
    args = parser.parse_args()
    assignments, summary = optimize_feature2(
        input_dir=args.input_dir, output_dir=args.output_dir,
        max_service_hours=args.max_service_hours, limit=args.limit,
    )
    assigned = assignments[assignments["status"].eq("assigned")]
    print(f"Processed vessels: {len(assignments):,}")
    print(f"Assigned vessels: {len(assigned):,}")
    print(f"Unassigned vessels: {len(assignments) - len(assigned):,}")
    print(f"Average waiting hours: {assigned['waiting_time_hours'].mean():.4f}" if len(assigned) else "Average waiting hours: n/a")
    print(f"Ports summarized: {len(summary):,}")
    report_path = f"{args.output_dir}/optimizer_report.txt"
    print(f"Report file: {report_path}")


if __name__ == "__main__":
    main()