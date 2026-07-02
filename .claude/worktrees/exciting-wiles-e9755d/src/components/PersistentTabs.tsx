"use client";

import { Tabs } from "@/components/ui/tabs";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useCallback, type ReactNode } from "react";

interface PersistentTabsProps {
    defaultValue: string;
    paramName?: string;
    className?: string;
    children: ReactNode;
}

/**
 * A Tabs wrapper that persists the active tab via URL search params.
 * This prevents the tab from resetting to the default when router.refresh() is called.
 */
export function PersistentTabs({ defaultValue, paramName = "tab", className, children }: PersistentTabsProps) {
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();

    const currentTab = searchParams.get(paramName) || defaultValue;

    const handleTabChange = useCallback((value: string) => {
        const params = new URLSearchParams(searchParams.toString());
        if (value === defaultValue) {
            params.delete(paramName);
        } else {
            params.set(paramName, value);
        }
        const qs = params.toString();
        router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false });
    }, [searchParams, router, pathname, paramName, defaultValue]);

    return (
        <Tabs value={currentTab} onValueChange={handleTabChange} className={className}>
            {children}
        </Tabs>
    );
}
