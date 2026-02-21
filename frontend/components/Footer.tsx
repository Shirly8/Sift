export default function Footer() {
  return (
    <footer className="py-16 flex justify-between items-center border-t border-neutral-border mt-16">

      {/* LEFT — last updated */}
      <span className="text-sm text-neutral-disabled-text">
        Last updated: 2 minutes ago • Data refreshes hourly
      </span>


      {/* RIGHT — links */}
      <div className="flex gap-16">
        <span className="text-sm text-neutral-disabled-text cursor-pointer">Export Report</span>
        <span className="text-sm text-neutral-disabled-text cursor-pointer">API</span>
      </div>
    </footer>
  );
}
