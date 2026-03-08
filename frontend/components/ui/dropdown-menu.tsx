"use client";

import { HoverButton } from "@/components/ui/hover-glow-button";
import { ChevronDown, ChevronUp } from "lucide-react";
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

type DropdownMenuProps = {
    options?: {
        label: React.ReactNode;
        onClick: () => void;
        Icon?: React.ReactNode;
    }[];
    children?: React.ReactNode;
    customPanel?: React.ReactNode;
    direction?: "up" | "down";
    menuWidth?: string;
    align?: "start" | "end";
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
};

const DropdownMenu = ({
    options,
    children,
    customPanel,
    direction = "down",
    align = "start",
    menuWidth = "w-48",
    open,
    onOpenChange
}: DropdownMenuProps) => {
    const [internalOpen, setInternalOpen] = useState(false);

    const isControlled = open !== undefined;
    const isOpen = isControlled ? open : internalOpen;

    const toggleDropdown = () => {
        if (isControlled && onOpenChange) {
            onOpenChange(!isOpen);
        } else {
            setInternalOpen(!isOpen);
        }
    };

    const handleOptionClick = (onClick: () => void) => {
        onClick();
        if (isControlled && onOpenChange) {
            onOpenChange(false);
        } else {
            setInternalOpen(false);
        }
    };

    const isUp = direction === "up";

    return (
        <div className="relative">
            <HoverButton
                onClick={toggleDropdown}
                backgroundColor="rgba(17, 17, 17, 0.6)"
                glowColor="#10b981"
                textColor="#ffffff"
                hoverTextColor="#ffffff"
                className="px-4 py-2 shadow-[0_0_20px_rgba(0,0,0,0.2)] border border-[#ffffff10] rounded-xl backdrop-blur-sm"
            >
                {children ?? "Menu"}
                <>
                    <motion.span
                        className="ml-2"
                        animate={{ rotate: isOpen ? (isUp ? -180 : 180) : 0 }}
                        transition={{ duration: 0.4, ease: "easeInOut", type: "spring" }}
                    >
                        {isUp ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </motion.span>
                </>
            </HoverButton>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ y: isUp ? 5 : -5, scale: 0.95, filter: "blur(10px)" }}
                        animate={{ y: 0, scale: 1, filter: "blur(0px)" }}
                        exit={{ y: isUp ? 5 : -5, scale: 0.95, opacity: 0, filter: "blur(10px)" }}
                        transition={{ duration: 0.6, ease: "circInOut", type: "spring" }}
                        className={`absolute z-40 ${isUp ? 'bottom-full mb-2' : 'mt-2'} p-1 bg-[#11111198] rounded-xl shadow-[0_0_20px_rgba(0,0,0,0.2)] backdrop-blur-sm flex flex-col gap-2 ${menuWidth} origin-${isUp ? 'bottom' : 'top'} ${align === 'end' ? 'right-0' : 'left-0'}`}
                    >
                        {customPanel ? customPanel : (
                            options && options.length > 0 ? (
                                options.map((option, index) => (
                                    <motion.button
                                        initial={{
                                            opacity: 0,
                                            x: 10,
                                            scale: 0.95,
                                            filter: "blur(10px)",
                                        }}
                                        animate={{ opacity: 1, x: 0, scale: 1, filter: "blur(0px)" }}
                                        exit={{
                                            opacity: 0,
                                            x: 10,
                                            scale: 0.95,
                                            filter: "blur(10px)",
                                        }}
                                        transition={{
                                            duration: 0.4,
                                            delay: index * 0.1,
                                            ease: "easeInOut",
                                            type: "spring",
                                        }}
                                        whileHover={{
                                            backgroundColor: "#11111140",
                                            transition: {
                                                duration: 0.4,
                                                ease: "easeInOut",
                                            },
                                        }}
                                        whileTap={{
                                            scale: 0.95,
                                            transition: {
                                                duration: 0.2,
                                                ease: "easeInOut",
                                            },
                                        }}
                                        key={index}
                                        onClick={() => handleOptionClick(option.onClick)}
                                        className="px-2 py-3 cursor-pointer text-white text-sm rounded-lg w-full text-left flex items-center gap-x-2"
                                    >
                                        {option.Icon}
                                        <div className="flex-1 w-full">{option.label}</div>
                                    </motion.button>
                                ))
                            ) : (
                                <div className="px-4 py-2 text-white text-xs">No options</div>
                            )
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export { DropdownMenu };
