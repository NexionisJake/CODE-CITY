"use client";

import { useId } from "react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { MoonIcon, SunIcon } from "lucide-react";

interface SwitchToggleThemeProps {
    isDark: boolean;
    onToggle: (checked: boolean) => void;
}

const SwitchToggleThemeDemo = ({ isDark, onToggle }: SwitchToggleThemeProps) => {
    const id = useId();

    return (
        <div className="group inline-flex items-center gap-2 bg-gray-900/90 backdrop-blur px-3 py-2 ml-1 rounded-lg border border-gray-700 shadow-sm transition-all">
            <span
                id={`${id}-light`}
                className={cn(
                    "cursor-pointer text-left text-sm font-medium transition-colors duration-200",
                    isDark ? "text-gray-500 hover:text-gray-400" : "text-amber-400"
                )}
                aria-controls={id}
                onClick={() => onToggle(false)}
                title="Day Mode"
            >
                <SunIcon className="size-4" aria-hidden="true" />
            </span>

            <Switch
                id={id}
                checked={isDark}
                onCheckedChange={onToggle}
                aria-labelledby={`${id}-light ${id}-dark`}
                aria-label="Toggle between dark and light mode"
            />

            <span
                id={`${id}-dark`}
                className={cn(
                    "cursor-pointer text-right text-sm font-medium transition-colors duration-200",
                    !isDark ? "text-gray-500 hover:text-gray-400" : "text-indigo-400"
                )}
                aria-controls={id}
                onClick={() => onToggle(true)}
                title="Night Mode"
            >
                <MoonIcon className="size-4" aria-hidden="true" />
            </span>
        </div>
    );
};

export default SwitchToggleThemeDemo;
