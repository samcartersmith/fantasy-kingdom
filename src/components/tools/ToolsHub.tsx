import { ToolTile } from "@/components/tools/ToolTile";
import { TOOLS } from "@/components/tools/tools-config";

export function ToolsHub() {
  return (
    <div className="py-8 sm:py-12 lg:py-14">
      <header className="text-center max-w-2xl mx-auto mb-10 sm:mb-12 lg:mb-14 space-y-3">
        <h1 className="dash-heading-page text-dash-text">Explore our tools</h1>
        <p className="text-sm sm:text-base text-dash-text/75 leading-relaxed">
          Dynasty trade, research, and league workflows in one place.
        </p>
      </header>

      <ul
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 lg:gap-6 max-w-6xl mx-auto list-none p-0 m-0"
        aria-label="Fantasy Kingdom tools"
      >
        {TOOLS.map((tool) => (
          <li key={tool.id}>
            <ToolTile
              href={tool.href}
              title={tool.title}
              blurb={tool.blurb}
              icon={tool.icon}
              available={tool.available}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
